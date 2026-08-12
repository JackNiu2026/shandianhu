export type ProfileRebuilder = {
  rebuild(childId: string): Promise<{ id: string; learningProfileId: string }>;
};

export type ReportCreator = {
  findOrCreateForProfile(profileId: string, versionId: string): Promise<{ id: string }>;
};

export type ReportEnqueuer = {
  enqueue(
    type: "REPORT_GENERATION",
    dedupeKey: string,
    payload: { reportId: string },
  ): Promise<unknown>;
};

export class ProfileRebuildProcessor {
  constructor(
    private readonly profiles: ProfileRebuilder,
    private readonly reports?: ReportCreator,
    private readonly reportJobs?: ReportEnqueuer,
  ) {}

  async run(payload: { childId: string }): Promise<{ id: string; learningProfileId: string }> {
    const version = await this.profiles.rebuild(payload.childId);
    // rebuild 完成后自动创建报告并触发 PDF 生成（幂等：dedupeKey 基于 reportId）
    if (this.reports && this.reportJobs) {
      const report = await this.reports.findOrCreateForProfile(version.learningProfileId, version.id);
      await this.reportJobs.enqueue("REPORT_GENERATION", `report:${report.id}:pdf`, { reportId: report.id });
    }
    return version;
  }
}
