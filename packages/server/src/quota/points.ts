/**
 * V2.2 家庭共享积分换算
 *
 * 积分是用户视角的平台消耗单位，和模型真实成本（ModelUsageLedger.microCost）
 * 分开核算。平台积分公式可独立调整定价策略。
 *
 * 换算规则：
 *   积分 = perRequest
 *        + ceil(inputTokens / 1000) * inputPer1k
 *        + ceil(outputTokens / 1000) * outputPer1k
 *        + images * perImage
 *
 * 所有换算必须在预占时用上限估、结算时用实际值。
 */

export type PointsRateConfig = {
  /** 每次请求基础消耗（会话生成） */
  perRequest: number;
  /** 每 1000 输入 tokens 的消耗 */
  inputPer1k: number;
  /** 每 1000 输出 tokens 的消耗 */
  outputPer1k: number;
  /** 每张图片的消耗 */
  perImage: number;
};

export type UsageInput = {
  inputTokens: number;
  outputTokens: number;
  images: number;
};

/** 平台默认积分定价（可后续通过后台配置调整） */
export const DEFAULT_POINTS_RATES: PointsRateConfig = {
  perRequest: 1,
  inputPer1k: 2,
  outputPer1k: 6,
  perImage: 10,
};

/**
 * 根据实际用量和费率计算消耗的平台积分。
 * token 数向上取整到每 1000 块，保证预占估算在结算时不超估。
 */
export function calculatePoints(
  usage: UsageInput,
  rates: PointsRateConfig = DEFAULT_POINTS_RATES,
): number {
  if (usage.inputTokens < 0 || usage.outputTokens < 0 || usage.images < 0) {
    throw new Error("Usage values must be non-negative");
  }
  const inputChunks = Math.ceil(usage.inputTokens / 1000);
  const outputChunks = Math.ceil(usage.outputTokens / 1000);
  return (
    rates.perRequest +
    inputChunks * rates.inputPer1k +
    outputChunks * rates.outputPer1k +
    usage.images * rates.perImage
  );
}

/**
 * 预占估算：用最坏情况（输入按当前 tokens、输出按 maxOutputTokens 上限）估算。
 * 结算后以实际用量重新计算；差额通过 settle 流程中的 RESERVE 释放退回给 available。
 */
export function estimateReservationPoints(params: {
  inputTokens: number;
  maxOutputTokens: number;
  images?: number;
  rates?: PointsRateConfig;
}): number {
  return calculatePoints(
    {
      inputTokens: params.inputTokens,
      outputTokens: params.maxOutputTokens,
      images: params.images ?? 0,
    },
    params.rates ?? DEFAULT_POINTS_RATES,
  );
}

/**
 * 结算差额计算：返回正数表示结算多余预占（需补扣，不应该发生），
 * 返回负数表示预占有剩余（应释放差额）。
 */
export function settleDifference(params: {
  reservedPoints: number;
  actualUsage: UsageInput;
  rates?: PointsRateConfig;
}): number {
  const actualPoints = calculatePoints(params.actualUsage, params.rates ?? DEFAULT_POINTS_RATES);
  return actualPoints - params.reservedPoints;
}
