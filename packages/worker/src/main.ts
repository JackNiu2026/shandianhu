/**
 * 闪电虎 Worker 进程入口。
 *
 * 职责：
 * 1. 装配 4 个 job 处理器并按 AsyncJobType 路由（dispatcher）。
 * 2. 调用 startJobWorker 消费 BullMQ "async-jobs" 队列。
 * 3. 定时触发隐私清理（扫描性任务，非 payload 驱动）。
 * 4. 优雅退出（SIGTERM/SIGINT 断开 DB 连接）。
 *
 * 运行：pnpm --filter @lightning-tiger/worker start  (生产)
 *      pnpm --filter @lightning-tiger/worker dev    (开发，tsx watch)
 *
 * 依赖环境变量：DATABASE_URL、REDIS_URL、COS_*、MODEL_KEY_ENCRYPTION_KEY
 */
import { PrismaClient } from "@prisma/client";
import { createServer } from "node:http";
import pino from "pino";
import {
  CosFileSigner,
  JobService,
  OpenAiCompatibleGateway,
  ProfileService,
  ReportService,
  type ProfileDatabase,
  type ReportDatabase,
} from "@lightning-tiger/server";
import { createDispatcher } from "./dispatcher";
import { startJobWorker } from "./worker";
import { AssessmentAnalyzer, type AssessmentAnalyzerDatabase, type VisionGateway } from "./processors/assessment-analyze";
import { ProfileRebuildProcessor } from "./processors/profile-rebuild";
import { CosPdfStorage, ReportPdfProcessor, type ReportPdfDatabase } from "./processors/report-pdf";
import { PrivacyCleanupProcessor, type PrivacyCleanupDatabase, type PrivacyObjectStorage } from "./processors/privacy-cleanup";

const logger = pino({ name: "lightning-tiger-worker" });

const prisma = new PrismaClient();
const signer = new CosFileSigner();
// OpenAiCompatibleGateway 运行时满足 VisionGateway 契约（complete<T> 用 zod schema 校验并返回 output），
// 但其泛型返回类型推断为具体 schema 类型而非 T，故此处用 unknown 中转断言。
const gateway = new OpenAiCompatibleGateway() as unknown as VisionGateway;
const profiles = new ProfileService(prisma as unknown as ProfileDatabase);
const reports = new ReportService(prisma as unknown as ReportDatabase);
const jobs = new JobService();

// 装配 4 个处理器。Prisma 实例的方法签名比各处理器手写的窄化接口更宽，故用 unknown 中转。
const assessmentAnalyzer = new AssessmentAnalyzer(
  prisma as unknown as AssessmentAnalyzerDatabase,
  signer,
  gateway,
);
const profileRebuild = new ProfileRebuildProcessor(profiles, reports, jobs);
const reportPdf = new ReportPdfProcessor(
  prisma as unknown as ReportPdfDatabase,
  new CosPdfStorage(signer),
);
const privacyStorage: PrivacyObjectStorage = {
  remove: (objectKey) => signer.remove({ objectKey }),
};
const privacyCleanup = new PrivacyCleanupProcessor(
  prisma as unknown as PrivacyCleanupDatabase,
  privacyStorage,
);

/** 按 AsyncJobType 路由到对应处理器的统一 JobProcessor */
const dispatcher = createDispatcher({ assessmentAnalyzer, profileRebuild, reportPdf });

// 隐私清理定时扫描：每小时扫描已过 purgeAfter 的孩子并物理清除 PII。
const PRIVACY_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const cleanupTimer = setInterval(() => {
  privacyCleanup.run().then(
    (result) => logger.info(result, "privacy cleanup completed"),
    (error) => logger.error({ error }, "privacy cleanup failed"),
  );
}, PRIVACY_CLEANUP_INTERVAL_MS);
cleanupTimer.unref();

const worker = startJobWorker(dispatcher, jobs);
logger.info({ queue: "async-jobs" }, "worker started, consuming jobs");

const healthPort = Number(process.env.WORKER_HEALTH_PORT || 3001);
const healthServer = createServer(async (request, response) => {
  if (request.url === "/live") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  if (request.url === "/ready") {
    try {
      await Promise.all([
        prisma.$queryRaw`SELECT 1`,
        worker.isReady ? worker.isReady() : Promise.reject(new Error("queue readiness unavailable")),
      ]);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: true, database: "ready", queue: "ready" }));
    } catch (error) {
      logger.warn({ error }, "worker readiness check failed");
      response.writeHead(503, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: false }));
    }
    return;
  }
  response.writeHead(404).end();
});
healthServer.listen(healthPort, "0.0.0.0", () => {
  logger.info({ healthPort }, "worker health endpoint listening");
});

// 启动后立即跑一次隐私清理（补偿启动期间过期的记录）
privacyCleanup.run().then(
  (result) => logger.info(result, "initial privacy cleanup completed"),
  (error) => logger.error({ error }, "initial privacy cleanup failed"),
);

// 优雅退出
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down worker");
  clearInterval(cleanupTimer);
  try {
    await worker.close?.();
    await new Promise<void>((resolve) => healthServer.close(() => resolve()));
    await prisma.$disconnect();
  } catch (error) {
    logger.error({ error }, "error disconnecting prisma");
  }
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

export { worker };
