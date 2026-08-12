import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import PDFDocument from "pdfkit";
import { CosFileSigner, type FileSigner } from "@lightning-tiger/server";

export type RedactedReportInput = {
  childName: string;
  grade: string | null;
  schoolName?: string | null;
  parentPhone?: string | null;
  objectKey?: string | null;
  reportDate: Date;
  body: {
    evidenceCount: number;
    confidence: number | null;
    evidenceIds: string[];
    latestObservedAt: string | null;
  };
};

export function buildRedactedReportText(input: RedactedReportInput): string {
  const childLabel = input.childName.trim().slice(0, 1) || "孩";
  const grade = input.grade?.trim() || "未填写年级";
  const confidence = input.body.confidence === null
    ? "暂无法计算"
    : `${Math.round(input.body.confidence * 100)}%`;

  return [
    "学习情况报告",
    `学生：${childLabel}同学`,
    `年级：${grade}`,
    `报告日期：${formatDate(input.reportDate)}`,
    "综合结论",
    `证据数量：${input.body.evidenceCount}`,
    `当前可信度：${confidence}`,
    "建议：结合本报告中的证据范围，安排后续学习与复盘。",
  ].join("\n");
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type ReportRecord = {
  id: string;
  childId: string;
  status: "DRAFT" | "READY" | "ARCHIVED";
  fileObjectId?: string | null;
  body: RedactedReportInput["body"];
  child: {
    name: string;
    grade: string | null;
    parentProfile: { id: string; userId: string };
  };
};

type ReportPdfTransaction = {
  fileObject: {
    create(args: { data: {
      id: string;
      ownerUserId: string;
      parentProfileId: string;
      childId: string;
      objectKey: string;
      contentType: "application/pdf";
      byteSize: number;
      visibility: "PRIVATE";
      purpose: "REPORT_EXPORT";
      status: "ACTIVE";
    } }): Promise<unknown>;
  };
  learningReport: {
    update(args: { where: { id: string }; data: { fileObjectId: string; status: "READY"; publishedAt: Date } }): Promise<unknown>;
  };
};

export type ReportPdfDatabase = {
  learningReport: {
    findUnique(args: { where: { id: string }; include?: unknown }): Promise<ReportRecord | null>;
  };
  $transaction<T>(callback: (transaction: ReportPdfTransaction) => Promise<T>): Promise<T>;
};

export type PdfRenderer = {
  render(text: string): Promise<Buffer>;
};

export type ReportPdfStorage = {
  put(input: { objectKey: string; contentType: "application/pdf"; body: Buffer }): Promise<void>;
};

type ReportPdfDependencies = {
  createId: () => string;
  clock: () => Date;
};

const defaultDependencies: ReportPdfDependencies = { createId: randomUUID, clock: () => new Date() };

export class ReportPdfProcessor {
  constructor(
    private readonly database: ReportPdfDatabase,
    private readonly storage: ReportPdfStorage,
    private readonly renderer: PdfRenderer = new PdfKitRenderer(),
    private readonly dependencies: ReportPdfDependencies = defaultDependencies,
  ) {}

  async run(payload: { reportId: string }): Promise<{ fileId: string }> {
    const report = await this.database.learningReport.findUnique({
      where: { id: payload.reportId },
      include: { child: { include: { parentProfile: true } } },
    });
    if (!report) throw new Error("Report not found");
    if (report.status === "READY" && report.fileObjectId) return { fileId: report.fileObjectId };
    if (report.status !== "DRAFT") throw new Error("Report cannot be exported");

    const text = buildRedactedReportText({
      childName: report.child.name,
      grade: report.child.grade,
      reportDate: this.dependencies.clock(),
      body: report.body,
    });
    const fileId = this.dependencies.createId();
    const objectKey = `reports/${report.childId}/${fileId}.pdf`;
    const body = await this.renderer.render(text);
    await this.storage.put({ objectKey, contentType: "application/pdf", body });

    await this.database.$transaction(async (transaction) => {
      await transaction.fileObject.create({
        data: {
          id: fileId,
          ownerUserId: report.child.parentProfile.userId,
          parentProfileId: report.child.parentProfile.id,
          childId: report.childId,
          objectKey,
          contentType: "application/pdf",
          byteSize: body.byteLength,
          visibility: "PRIVATE",
          purpose: "REPORT_EXPORT",
          status: "ACTIVE",
        },
      });
      await transaction.learningReport.update({
        where: { id: report.id },
        data: { fileObjectId: fileId, status: "READY", publishedAt: this.dependencies.clock() },
      });
    });

    return { fileId };
  }
}

export class PdfKitRenderer implements PdfRenderer {
  async render(text: string): Promise<Buffer> {
    const document = new PDFDocument({ margin: 48 });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    const complete = new Promise<Buffer>((resolve, reject) => {
      document.on("end", () => resolve(Buffer.concat(chunks)));
      document.on("error", reject);
    });
    const require = createRequire(import.meta.url);
    document.registerFont("NotoSansSC", require.resolve("@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff2"));
    document.font("NotoSansSC").fontSize(12).text(text, { lineGap: 8 });
    document.end();
    return complete;
  }
}

export class CosPdfStorage implements ReportPdfStorage {
  constructor(
    private readonly signer: FileSigner = new CosFileSigner(),
    private readonly request: typeof fetch = fetch,
  ) {}

  async put(input: { objectKey: string; contentType: "application/pdf"; body: Buffer }): Promise<void> {
    const uploadUrl = await this.signer.signPut({
      objectKey: input.objectKey,
      contentType: input.contentType,
      contentLength: input.body.byteLength,
      expiresInSeconds: 10 * 60,
    });
    const response = await this.request(uploadUrl, {
      method: "PUT",
      headers: { "content-type": input.contentType, "content-length": String(input.body.byteLength) },
      body: input.body.buffer.slice(input.body.byteOffset, input.body.byteOffset + input.body.byteLength) as ArrayBuffer,
    });
    if (!response.ok) throw new Error("Report PDF upload failed");
  }
}
