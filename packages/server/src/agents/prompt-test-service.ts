/**
 * V2.2 提示词测试服务
 *
 * 编排提示词测试流程：
 * 1. 读取目标 DRAFT/TESTING 版本内容
 * 2. 调用模型网关以 prompt 为 system 消息、testInput 为 user 消息
 * 3. 成功：记录 AgentPromptTest（passed=true）并将版本提升为 TESTED
 * 4. 失败：记录 AgentPromptTest（passed=false）并将版本保持 DRAFT
 * 5. 写 AuditLog
 *
 * 模型用量（ModelUsageLedger）由网关内部记录，通过 callId 与 AgentPromptTest 关联。
 */
import { randomUUID } from "node:crypto";
import { AppError } from "../errors/app-error";
import { OpenAiCompatibleGateway } from "../models/openai-gateway";
import { AuditService } from "../audit/audit-service";
import { PromptService, type AdminContext } from "./prompt-service";

export type PromptTestResult = {
  callId: string;
  output: string;
  passed: boolean;
  versionStatus: string;
};

const MAX_TEST_INPUT_LENGTH = 4096;

export class PromptTestService {
  constructor(
    private readonly prompts: PromptService = new PromptService(),
    private readonly gateway: OpenAiCompatibleGateway = new OpenAiCompatibleGateway(),
    private readonly audit: AuditService = new AuditService(),
  ) {}

  async runTest(
    agentId: string,
    versionId: string,
    testInput: string,
    ctx: AdminContext,
  ): Promise<PromptTestResult> {
    if (!testInput.trim()) {
      throw new AppError("VALIDATION_ERROR", 400, "Test input cannot be empty");
    }
    if (testInput.length > MAX_TEST_INPUT_LENGTH) {
      throw new AppError("VALIDATION_ERROR", 400, `Test input exceeds ${MAX_TEST_INPUT_LENGTH} characters`);
    }

    const version = await this.prompts.getVersion(versionId);
    if (version.agentId !== agentId) {
      throw new AppError("VALIDATION_ERROR", 400, "Prompt version does not belong to this agent");
    }
    if (version.status !== "DRAFT" && version.status !== "TESTING") {
      throw new AppError(
        "RESOURCE_CONFLICT",
        409,
        `Cannot test prompt version in ${version.status} status (requires DRAFT or TESTING)`,
      );
    }

    const callId = randomUUID();

    try {
      const result = await this.gateway.completeText({
        purpose: "PROMPT_TEST",
        messages: [
          { role: "system", content: version.content },
          { role: "user", content: testInput },
        ],
        callId,
      });

      const updated = await this.prompts.recordSuccessfulTest(versionId, callId, ctx);

      await this.audit.record({
        actorKind: "ADMIN",
        actorAdminUserId: ctx.adminUserId,
        entityType: "AGENT_PROMPT_VERSION",
        entityId: versionId,
        action: "UPDATE",
        diff: { testStatus: "TESTED", passed: true, callId, fromSequence: version.sequence },
      });

      return {
        callId: result.callId,
        output: result.output,
        passed: true,
        versionStatus: updated.status,
      };
    } catch (error) {
      const errorMessage = error instanceof AppError ? error.message : "Model provider request failed";

      try {
        const updated = await this.prompts.recordFailedTest(versionId, callId, ctx, errorMessage);
        await this.audit.record({
          actorKind: "ADMIN",
          actorAdminUserId: ctx.adminUserId,
          entityType: "AGENT_PROMPT_VERSION",
          entityId: versionId,
          action: "UPDATE",
          diff: { testStatus: "FAILED", passed: false, callId, fromSequence: version.sequence, error: errorMessage },
        });
        return { callId, output: errorMessage, passed: false, versionStatus: updated.status };
      } catch {
        // 网关可能因模型不可用而未写入 ModelUsageLedger，导致 FK 约束失败。
        // 仍然记录审计并返回失败结果，但不创建 AgentPromptTest 记录。
        await this.audit.record({
          actorKind: "ADMIN",
          actorAdminUserId: ctx.adminUserId,
          entityType: "AGENT_PROMPT_VERSION",
          entityId: versionId,
          action: "UPDATE",
          diff: { testStatus: "FAILED", passed: false, callId, fromSequence: version.sequence, error: errorMessage, usageRecorded: false },
        });
        return { callId, output: errorMessage, passed: false, versionStatus: version.status };
      }
    }
  }
}
