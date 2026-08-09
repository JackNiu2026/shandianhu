export class AssessmentAnalyzer {
  constructor(private readonly database: any, private readonly signer: any, private readonly gateway: any) {}
  async run({ runId }: { runId: string }) {
    try { await this.gateway.complete({ runId }); } catch { await this.database.assessmentRun.update({ where: { id: runId }, data: { status: "FAILED" } }); return; }
  }
}
