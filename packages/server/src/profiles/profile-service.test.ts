import { describe, expect, it, vi } from "vitest";
import { ProfileService } from "./profile-service";

type Evidence = {
  id: string;
  childId: string;
  source: string;
  observedAt: Date;
  payload: unknown;
  revokedAt: Date | null;
};

type StoredVersion = {
  id: string;
  learningProfileId: string;
  version: number;
  ruleVersion: string;
  snapshot: Record<string, unknown>;
  confidenceBasis: Record<string, unknown>;
};

function createDatabase(evidence: Evidence[]) {
  const versions: StoredVersion[] = [];
  const events: string[] = [];
  let currentVersionId: string | undefined;
  let evidenceQuery: unknown;
  let locked = false;
  const waiters: Array<() => void> = [];

  async function acquireLock() {
    if (locked) {
      await new Promise<void>((resolve) => waiters.push(resolve));
    } else {
      locked = true;
    }

    return () => {
      const next = waiters.shift();
      if (next) next();
      else locked = false;
    };
  }

  const database = {
    $transaction: async <T>(callback: (tx: any) => Promise<T>) => {
      let releaseLock: (() => void) | undefined;
      const tx = {
        $executeRawUnsafe: vi.fn(async () => {
          events.push("lock");
          releaseLock = await acquireLock();
        }),
        learningEvidence: {
          findMany: vi.fn(async (query) => {
            events.push("evidence");
            evidenceQuery = query;
            return evidence
              .filter((item) => item.revokedAt === null)
              .sort((left, right) => left.observedAt.getTime() - right.observedAt.getTime());
          }),
        },
        learningProfile: {
          upsert: vi.fn(async () => ({ id: "profile-1" })),
          update: vi.fn(async ({ data }: { data: { currentVersionId: string } }) => {
            currentVersionId = data.currentVersionId;
          }),
        },
        learningProfileVersion: {
          count: vi.fn(async () => versions.length),
          create: vi.fn(async ({ data }: { data: Omit<StoredVersion, "id"> }) => {
            const created: StoredVersion = {
              ...data,
              id: `version-${data.version}`,
              snapshot: JSON.parse(JSON.stringify(data.snapshot)),
              confidenceBasis: JSON.parse(JSON.stringify(data.confidenceBasis)),
            };
            versions.push(created);
            return created;
          }),
        },
      };

      try {
        events.push("transaction");
        return await callback(tx);
      } finally {
        releaseLock?.();
      }
    },
  };

  return {
    database,
    events,
    versions,
    evidenceQuery: () => evidenceQuery,
    currentVersionId: () => currentVersionId,
  };
}

describe("ProfileService", () => {
  it("creates an empty profile without fabricated weaknesses or suggestions", async () => {
    const store = createDatabase([
      {
        id: "revoked-evidence",
        childId: "child-1",
        source: "ASSESSMENT",
        observedAt: new Date("2026-08-08T00:00:00.000Z"),
        payload: { knowledgePoints: ["fractions"] },
        revokedAt: new Date("2026-08-09T00:00:00.000Z"),
      },
    ]);
    const profiles = new ProfileService(store.database, () => new Date("2026-08-09T00:00:00.000Z"));

    const version = await profiles.rebuild("child-1");

    expect(store.events).toEqual(["transaction", "lock", "evidence"]);
    expect(store.evidenceQuery()).toMatchObject({ where: { childId: "child-1", revokedAt: null } });
    expect(version).toMatchObject({ id: "version-1", version: 1 });
    expect(store.versions[0]?.snapshot).toEqual({
      evidenceIds: [],
      evidenceCount: 0,
      latestObservedAt: null,
      confidence: 0,
    });
    expect(store.versions[0]?.snapshot).not.toHaveProperty("weaknesses");
    expect(store.versions[0]?.snapshot).not.toHaveProperty("suggestions");
    expect(store.currentVersionId()).toBe("version-1");
  });

  it("creates a new immutable snapshot for every rebuild", async () => {
    const evidence: Evidence[] = [
      {
        id: "evidence-1",
        childId: "child-1",
        source: "ASSESSMENT",
        observedAt: new Date("2026-08-01T00:00:00.000Z"),
        payload: { knowledgePoints: ["fractions"] },
        revokedAt: null,
      },
    ];
    const store = createDatabase(evidence);
    const profiles = new ProfileService(store.database, () => new Date("2026-08-09T00:00:00.000Z"));

    const first = await profiles.rebuild("child-1");
    evidence.push({
      id: "evidence-2",
      childId: "child-1",
      source: "PRACTICE",
      observedAt: new Date("2026-08-08T00:00:00.000Z"),
      payload: { knowledgePoints: ["decimals"] },
      revokedAt: null,
    });
    const second = await profiles.rebuild("child-1");

    expect(second.version).toBe(first.version + 1);
    expect(store.versions[0]?.snapshot).toEqual({
      evidenceIds: ["evidence-1"],
      evidenceCount: 1,
      latestObservedAt: "2026-08-01T00:00:00.000Z",
      confidence: expect.any(Number),
    });
    expect(store.versions[1]?.snapshot).toMatchObject({
      evidenceIds: ["evidence-1", "evidence-2"],
      evidenceCount: 2,
      latestObservedAt: "2026-08-08T00:00:00.000Z",
    });
    expect(store.currentVersionId()).toBe("version-2");
  });

  it("serializes concurrent rebuilds with the advisory transaction lock", async () => {
    const store = createDatabase([]);
    const profiles = new ProfileService(store.database, () => new Date("2026-08-09T00:00:00.000Z"));

    const [first, second] = await Promise.all([
      profiles.rebuild("child-1"),
      profiles.rebuild("child-1"),
    ]);

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(store.events).toEqual([
      "transaction",
      "lock",
      "transaction",
      "lock",
      "evidence",
      "evidence",
    ]);
  });
});
