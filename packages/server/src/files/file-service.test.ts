import { describe, expect, it, vi } from "vitest";
import {
  FileService,
  type FileServiceDatabase,
  type FileSigner,
} from "./file-service";

type Parent = { id: string; userId: string };
type Child = { id: string; parentProfileId: string; deletedAt: Date | null };
type FileRecord = {
  id: string;
  ownerUserId: string;
  parentProfileId: string | null;
  childId: string | null;
  objectKey: string;
  contentType: string;
  byteSize: number;
  status: "ACTIVE" | "DELETED" | "REVOKED";
  deletedAt: Date | null;
  revokedAt: Date | null;
};

function createDatabase(
  parents: Parent[],
  children: Child[],
  files: FileRecord[] = [],
): FileServiceDatabase {
  return {
    $transaction: async (callback) => callback({
      parentProfile: {
        findUnique: async ({ where: { userId } }) => parents.find((parent) => parent.userId === userId) ?? null,
      },
      child: {
        findUnique: async ({ where: { id } }) => children.find((child) => child.id === id) ?? null,
      },
      fileObject: {
        create: async ({ data }) => {
          const record: FileRecord = {
            id: data.id,
            ownerUserId: data.ownerUserId,
            parentProfileId: data.parentProfileId,
            childId: data.childId,
            objectKey: data.objectKey,
            contentType: data.contentType,
            byteSize: data.byteSize,
            status: "ACTIVE",
            deletedAt: null,
            revokedAt: null,
          };
          files.push(record);
          return record;
        },
        findUnique: async ({ where: { id } }) => files.find((file) => file.id === id) ?? null,
      },
    }),
  };
}

function createSigner(): FileSigner {
  return {
    signPut: vi.fn().mockResolvedValue("https://cos.example/upload"),
    signGet: vi.fn().mockResolvedValue("https://cos.example/download"),
  };
}

const parentA = { id: "parent-a", userId: "user-a" };
const parentB = { id: "parent-b", userId: "user-b" };
const childA = { id: "child-a", parentProfileId: "parent-a", deletedAt: null };
const childB = { id: "child-b", parentProfileId: "parent-b", deletedAt: null };

describe("FileService", () => {
  it.each([
    [{ contentType: "image/svg+xml", byteSize: 100 }, "VALIDATION_ERROR"],
    [{ contentType: "image/jpeg", byteSize: 10_485_761 }, "VALIDATION_ERROR"],
  ])("rejects unsafe assessment files", async (input, code) => {
    const service = new FileService(createDatabase([parentA], [childA]), createSigner(), {
      createId: () => "file-1",
    });

    await expect(service.issueUpload("user-a", "child-a", input)).rejects.toMatchObject({ code, status: 400 });
  });

  it("rejects an upload for another parent's child", async () => {
    const service = new FileService(createDatabase([parentA, parentB], [childA, childB]), createSigner(), {
      createId: () => "file-1",
    });

    await expect(service.issueUpload("user-a", "child-b", { contentType: "image/png", byteSize: 100 }))
      .rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("rejects an upload for a soft-deleted child", async () => {
    const deletedChild = { ...childA, deletedAt: new Date("2026-01-01") };
    const service = new FileService(createDatabase([parentA], [deletedChild]), createSigner(), {
      createId: () => "file-1",
    });

    await expect(service.issueUpload("user-a", "child-a", { contentType: "image/webp", byteSize: 100 }))
      .rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("stores only metadata and uses a stable ten-minute upload URL", async () => {
    const files: FileRecord[] = [];
    const signer = createSigner();
    const service = new FileService(createDatabase([parentA], [childA], files), signer, {
      createId: () => "file-1",
    });

    const upload = await service.issueUpload("user-a", "child-a", {
      contentType: "image/jpeg",
      byteSize: 100,
    });

    expect(upload).toEqual({
      fileId: "file-1",
      uploadUrl: "https://cos.example/upload",
      expiresInSeconds: 600,
    });
    expect(files).toEqual([expect.objectContaining({
      id: "file-1",
      ownerUserId: "user-a",
      parentProfileId: "parent-a",
      childId: "child-a",
      objectKey: "families/parent-a/children/child-a/ASSESSMENT_UPLOAD/file-1",
      contentType: "image/jpeg",
      byteSize: 100,
    })]);
    expect(files[0]).not.toHaveProperty("uploadUrl");
    expect(signer.signPut).toHaveBeenCalledWith({
      objectKey: "families/parent-a/children/child-a/ASSESSMENT_UPLOAD/file-1",
      contentType: "image/jpeg",
      expiresInSeconds: 600,
    });
  });

  it("returns a signed download URL only for an active owned file", async () => {
    const file: FileRecord = {
      id: "file-1",
      ownerUserId: "user-a",
      parentProfileId: "parent-a",
      childId: "child-a",
      objectKey: "families/parent-a/children/child-a/ASSESSMENT_UPLOAD/file-1",
      contentType: "image/png",
      byteSize: 100,
      status: "ACTIVE",
      deletedAt: null,
      revokedAt: null,
    };
    const signer = createSigner();
    const service = new FileService(createDatabase([parentA], [childA], [file]), signer);

    await expect(service.issueDownload("user-a", "file-1")).resolves.toEqual({
      downloadUrl: "https://cos.example/download",
      expiresInSeconds: 600,
    });
    expect(signer.signGet).toHaveBeenCalledWith({ objectKey: file.objectKey, expiresInSeconds: 600 });
  });

  it.each([
    [{ status: "DELETED" as const, deletedAt: new Date(), revokedAt: null }],
    [{ status: "REVOKED" as const, deletedAt: null, revokedAt: new Date() }],
  ])("rejects downloads for deleted or revoked files", async (lifecycle) => {
    const file: FileRecord = {
      id: "file-1",
      ownerUserId: "user-a",
      parentProfileId: "parent-a",
      childId: "child-a",
      objectKey: "families/parent-a/children/child-a/ASSESSMENT_UPLOAD/file-1",
      contentType: "image/png",
      byteSize: 100,
      ...lifecycle,
    };
    const service = new FileService(createDatabase([parentA], [childA], [file]), createSigner());

    await expect(service.issueDownload("user-a", "file-1"))
      .rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("rejects downloads for files owned by another family", async () => {
    const file: FileRecord = {
      id: "file-1",
      ownerUserId: "user-b",
      parentProfileId: "parent-b",
      childId: "child-b",
      objectKey: "families/parent-b/children/child-b/ASSESSMENT_UPLOAD/file-1",
      contentType: "image/png",
      byteSize: 100,
      status: "ACTIVE",
      deletedAt: null,
      revokedAt: null,
    };
    const service = new FileService(createDatabase([parentA, parentB], [childA, childB], [file]), createSigner());

    await expect(service.issueDownload("user-a", "file-1"))
      .rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});
