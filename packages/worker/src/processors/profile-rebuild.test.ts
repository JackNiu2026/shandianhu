import { describe, expect, it, vi } from "vitest";
import { ProfileRebuildProcessor } from "./profile-rebuild";

describe("ProfileRebuildProcessor", () => {
  it("delegates rebuilding to the profile service for the requested child", async () => {
    const profiles = { rebuild: vi.fn().mockResolvedValue({ id: "version-1" }) };
    const processor = new ProfileRebuildProcessor(profiles);

    await expect(processor.run({ childId: "child-1" })).resolves.toEqual({ id: "version-1" });
    expect(profiles.rebuild).toHaveBeenCalledWith("child-1");
  });
});
