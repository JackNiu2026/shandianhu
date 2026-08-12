import { JobProcessingError, type AsyncJobRecord } from "@lightning-tiger/server";
import type { AssessmentAnalyzer } from "./processors/assessment-analyze";
import type { ProfileRebuildProcessor } from "./processors/profile-rebuild";
import type { ReportPdfProcessor } from "./processors/report-pdf";
import type { JobProcessor } from "./worker";

export interface DispatcherProcessors {
  assessmentAnalyzer: Pick<AssessmentAnalyzer, "run">;
  profileRebuild: Pick<ProfileRebuildProcessor, "run">;
  reportPdf: Pick<ReportPdfProcessor, "run">;
}

function readPayload(job: Pick<AsyncJobRecord, "id" | "type" | "payload">): Record<string, string> {
  const payload = job.payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, string>;
  }
  return {};
}

/**
 * 按 AsyncJobType 将持久化的 job 路由到对应处理器。
 * FILE_PROCESSING 由定时隐私清理扫描触发，不走 payload 路由；
 * 缺失必填字段或未知类型一律视为终端错误（FILE_CORRUPT），避免无限重试。
 */
export function createDispatcher(processors: DispatcherProcessors): JobProcessor {
  return {
    async process(job: Pick<AsyncJobRecord, "id" | "type" | "payload">) {
      const payload = readPayload(job);
      switch (job.type) {
        case "ASSESSMENT_PROCESSING": {
          if (!payload.runId) {
            throw new JobProcessingError("FILE_CORRUPT", `Missing runId in payload of job ${job.id}`);
          }
          return processors.assessmentAnalyzer.run({ runId: payload.runId });
        }
        case "PROFILE_GENERATION": {
          if (!payload.childId) {
            throw new JobProcessingError("FILE_CORRUPT", `Missing childId in payload of job ${job.id}`);
          }
          return processors.profileRebuild.run({ childId: payload.childId });
        }
        case "REPORT_GENERATION": {
          if (!payload.reportId) {
            throw new JobProcessingError("FILE_CORRUPT", `Missing reportId in payload of job ${job.id}`);
          }
          return processors.reportPdf.run({ reportId: payload.reportId });
        }
        case "FILE_PROCESSING": {
          // 隐私清理是扫描性任务，由 Worker 启动后的定时器触发，不走 payload 路由。
          throw new JobProcessingError(
            "FILE_CORRUPT",
            `FILE_PROCESSING jobs are handled by the scheduled privacy cleanup, not by payload (job ${job.id})`,
          );
        }
        case "TUTORING_SUMMARY": {
          throw new JobProcessingError(
            "MODEL_SCHEMA_INVALID",
            `TUTORING_SUMMARY is not enabled for the current data model (job ${job.id})`,
          );
        }
        default:
          throw new JobProcessingError("FILE_CORRUPT", `Unknown job type "${job.type}" for job ${job.id}`);
      }
    },
  };
}
