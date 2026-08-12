/**
 * V2.3 Task 7 试听预约状态机（纯函数）
 *
 * 合法转换：
 * - REQUESTED + ACCEPT → ACCEPTED
 * - REQUESTED + REJECT → REJECTED
 * - REQUESTED + PROPOSE_RESCHEDULE → RESCHEDULE_PROPOSED
 * - ACCEPTED + PROPOSE_RESCHEDULE → RESCHEDULE_PROPOSED
 * - ACCEPTED + PARENT_CONFIRM → PARENT_CONFIRMED
 * - RESCHEDULE_PROPOSED + PARENT_CONFIRM → PARENT_CONFIRMED
 * - PARENT_CONFIRMED + MARK_READY → READY
 * - READY + COMPLETE → COMPLETED
 * - 任何非终态 + CANCEL → CANCELLED
 *
 * 终态：REJECTED、COMPLETED、CANCELLED，不接受任何事件。
 * 非法转换抛 AppError("RESOURCE_CONFLICT", 409, ...)。
 */
import { AppError } from "../errors/app-error";
import type { TrialBookingStatus } from "@lightning-tiger/shared/api";

export type TrialEvent =
  | "ACCEPT"
  | "REJECT"
  | "PROPOSE_RESCHEDULE"
  | "PARENT_CONFIRM"
  | "CANCEL"
  | "COMPLETE"
  | "MARK_READY";

/** 终态集合：不接受任何事件（包括 CANCEL）。 */
const TERMINAL_STATUSES: TrialBookingStatus[] = ["REJECTED", "COMPLETED", "CANCELLED"];

/** 非法转换的错误消息前缀。 */
function illegalTransitionMessage(from: TrialBookingStatus, event: TrialEvent): string {
  return `Illegal trial booking transition: ${from} + ${event}`;
}

/**
 * 计算从当前状态出发，应用指定事件后的下一个状态。
 * 非法转换抛 AppError("RESOURCE_CONFLICT", 409)。
 */
export function transition(
  from: TrialBookingStatus,
  event: TrialEvent,
): TrialBookingStatus {
  // CANCEL 对任何非终态都合法
  if (event === "CANCEL") {
    if (TERMINAL_STATUSES.includes(from)) {
      throw new AppError(
        "RESOURCE_CONFLICT",
        409,
        illegalTransitionMessage(from, event),
      );
    }
    return "CANCELLED";
  }

  // 其他事件的合法转换表
  switch (from) {
    case "REQUESTED":
      if (event === "ACCEPT") return "ACCEPTED";
      if (event === "REJECT") return "REJECTED";
      if (event === "PROPOSE_RESCHEDULE") return "RESCHEDULE_PROPOSED";
      break;
    case "ACCEPTED":
      if (event === "PROPOSE_RESCHEDULE") return "RESCHEDULE_PROPOSED";
      if (event === "PARENT_CONFIRM") return "PARENT_CONFIRMED";
      break;
    case "RESCHEDULE_PROPOSED":
      if (event === "PARENT_CONFIRM") return "PARENT_CONFIRMED";
      break;
    case "PARENT_CONFIRMED":
      if (event === "MARK_READY") return "READY";
      break;
    case "READY":
      if (event === "COMPLETE") return "COMPLETED";
      break;
    default:
      // 终态或其他状态不接受任何事件
      break;
  }

  throw new AppError(
    "RESOURCE_CONFLICT",
    409,
    illegalTransitionMessage(from, event),
  );
}
