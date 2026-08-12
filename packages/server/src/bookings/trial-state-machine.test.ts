import { describe, expect, it } from "vitest";
import { transition, type TrialEvent } from "./trial-state-machine";
import type { TrialBookingStatus } from "@lightning-tiger/shared/api";
import { AppError } from "../errors/app-error";

// ─── 合法转换 ───────────────────────────────────────────────

describe("trial-state-machine transition (legal)", () => {
  it.each<[TrialBookingStatus, TrialEvent, TrialBookingStatus]>([
    ["REQUESTED", "ACCEPT", "ACCEPTED"],
    ["REQUESTED", "REJECT", "REJECTED"],
    ["REQUESTED", "PROPOSE_RESCHEDULE", "RESCHEDULE_PROPOSED"],
    ["ACCEPTED", "PROPOSE_RESCHEDULE", "RESCHEDULE_PROPOSED"],
    ["ACCEPTED", "PARENT_CONFIRM", "PARENT_CONFIRMED"],
    ["RESCHEDULE_PROPOSED", "PARENT_CONFIRM", "PARENT_CONFIRMED"],
    ["PARENT_CONFIRMED", "MARK_READY", "READY"],
    ["READY", "COMPLETE", "COMPLETED"],
  ])("transitions %s + %s → %s", (from, event, to) => {
    expect(transition(from, event)).toBe(to);
  });

  it("allows CANCEL from any non-terminal state", () => {
    const nonTerminal: TrialBookingStatus[] = [
      "REQUESTED",
      "ACCEPTED",
      "RESCHEDULE_PROPOSED",
      "PARENT_CONFIRMED",
      "READY",
    ];
    for (const from of nonTerminal) {
      expect(transition(from, "CANCEL")).toBe("CANCELLED");
    }
  });
});

// ─── 非法转换 ───────────────────────────────────────────────

describe("trial-state-machine transition (illegal)", () => {
  it.each<[TrialBookingStatus, TrialEvent]>([
    // ACCEPTED 不能再次 ACCEPT
    ["ACCEPTED", "ACCEPT"],
    // PARENT_CONFIRMED 不能 ACCEPT
    ["PARENT_CONFIRMED", "ACCEPT"],
    // REQUESTED 不能 PARENT_CONFIRM（需要先 ACCEPT）
    ["REQUESTED", "PARENT_CONFIRM"],
    // REQUESTED 不能 MARK_READY
    ["REQUESTED", "MARK_READY"],
    // REQUESTED 不能 COMPLETE
    ["REQUESTED", "COMPLETE"],
    // ACCEPTED 不能 MARK_READY
    ["ACCEPTED", "MARK_READY"],
    // ACCEPTED 不能 COMPLETE
    ["ACCEPTED", "COMPLETE"],
    // RESCHEDULE_PROPOSED 不能 ACCEPT
    ["RESCHEDULE_PROPOSED", "ACCEPT"],
    // RESCHEDULE_PROPOSED 不能 MARK_READY
    ["RESCHEDULE_PROPOSED", "MARK_READY"],
    // PARENT_CONFIRMED 不能再次 PARENT_CONFIRM
    ["PARENT_CONFIRMED", "PARENT_CONFIRM"],
    // READY 不能再次 MARK_READY
    ["READY", "MARK_READY"],
    // READY 不能 PARENT_CONFIRM
    ["READY", "PARENT_CONFIRM"],
  ])("rejects %s + %s with RESOURCE_CONFLICT", (from, event) => {
    expect(() => transition(from, event)).toThrow(AppError);
    try {
      transition(from, event);
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toMatchObject({ code: "RESOURCE_CONFLICT", status: 409 });
    }
  });

  it("rejects any event from terminal states", () => {
    const terminal: TrialBookingStatus[] = ["REJECTED", "COMPLETED", "CANCELLED"];
    const events: TrialEvent[] = [
      "ACCEPT",
      "REJECT",
      "PROPOSE_RESCHEDULE",
      "PARENT_CONFIRM",
      "CANCEL",
      "COMPLETE",
      "MARK_READY",
    ];
    for (const from of terminal) {
      for (const event of events) {
        expect(() => transition(from, event)).toThrow(AppError);
        try {
          transition(from, event);
          throw new Error("should have thrown");
        } catch (error) {
          expect(error).toMatchObject({ code: "RESOURCE_CONFLICT", status: 409 });
        }
      }
    }
  });
});
