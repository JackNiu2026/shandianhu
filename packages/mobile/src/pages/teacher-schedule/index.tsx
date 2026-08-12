/**
 * V2.3 老师排期页
 *
 * 管理老师的周期可授课时间规则和日期例外。
 * - 周期规则：按周几设置可授课时间段
 * - 日期例外：指定日期标记可用/不可用
 */
import { useCallback, useEffect, useState } from "react";
import { Button, Input, ScrollView, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { TopBar } from "@/components/TopBar";
import {
  getAvailabilityExceptions,
  getWeeklyAvailability,
  setAvailabilityException,
  setWeeklyAvailability,
  type AvailabilityExceptionDto,
  type WeeklyAvailabilityRuleDto,
} from "@/services/api";
import "./index.scss";

const WEEKDAYS = [
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
  { value: 7, label: "周日" },
];

type RuleDraft = { weekday: number; startMinute: number; endMinute: number };

export default function TeacherSchedulePage() {
  const [rules, setRules] = useState<WeeklyAvailabilityRuleDto[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityExceptionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 新增规则的草稿
  const [draftWeekday, setDraftWeekday] = useState(1);
  const [draftStart, setDraftStart] = useState("09:00");
  const [draftEnd, setDraftEnd] = useState("11:00");

  // 例外草稿
  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionType, setExceptionType] = useState<"AVAILABLE" | "UNAVAILABLE">("UNAVAILABLE");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [weekly, exc] = await Promise.all([
        getWeeklyAvailability(),
        getAvailabilityExceptions(),
      ]);
      setRules(weekly);
      setExceptions(exc);
    } catch {
      Taro.showToast({ title: "加载失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // 将 HH:MM 转换为分钟数
  const timeToMinute = (time: string): number => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  // 将分钟数转换为 HH:MM
  const minuteToTime = (minute: number): string => {
    const h = Math.floor(minute / 60);
    const m = minute % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  // 添加规则到本地列表
  const addRule = () => {
    const startMinute = timeToMinute(draftStart);
    const endMinute = timeToMinute(draftEnd);
    if (endMinute <= startMinute) {
      Taro.showToast({ title: "结束时间须大于开始", icon: "none" });
      return;
    }
    // 构造临时规则（id 由服务端生成）
    const newRule: WeeklyAvailabilityRuleDto = {
      id: `draft-${Date.now()}`,
      weekday: draftWeekday,
      startMinute,
      endMinute,
    };
    setRules((prev) => [...prev, newRule]);
  };

  // 移除本地规则
  const removeRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  // 保存周期规则（批量替换）
  const onSaveRules = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload: RuleDraft[] = rules.map((r) => ({
        weekday: r.weekday,
        startMinute: r.startMinute,
        endMinute: r.endMinute,
      }));
      const saved = await setWeeklyAvailability(payload);
      setRules(saved);
      Taro.showToast({ title: "已保存", icon: "success" });
    } catch {
      Taro.showToast({ title: "保存失败", icon: "none" });
    } finally {
      setSaving(false);
    }
  };

  // 设置日期例外
  const onSetException = async () => {
    if (!exceptionDate) {
      Taro.showToast({ title: "请选择日期", icon: "none" });
      return;
    }
    try {
      await setAvailabilityException({
        date: exceptionDate,
        type: exceptionType,
      });
      Taro.showToast({ title: "已设置", icon: "success" });
      setExceptionDate("");
      await load();
    } catch {
      Taro.showToast({ title: "设置失败", icon: "none" });
    }
  };

  return (
    <View className="teacher-schedule-screen">
      <TopBar eyebrow="TEACHER" title="排期管理" subtitle="设置可授课时间" />

      <ScrollView scrollY className="schedule-body">
        {loading ? (
          <View className="schedule-empty">加载中…</View>
        ) : (
          <>
            {/* 周期规则 */}
            <View className="section">
              <Text className="section-title">周期可授课时间</Text>

              {/* 已有规则列表 */}
              {rules.length > 0 && (
                <View className="rule-list">
                  {rules.map((rule) => (
                    <View key={rule.id} className="rule-item">
                      <Text className="rule-weekday">{labelWeekday(rule.weekday)}</Text>
                      <Text className="rule-time">
                        {minuteToTime(rule.startMinute)} — {minuteToTime(rule.endMinute)}
                      </Text>
                      <Text className="rule-remove" onClick={() => removeRule(rule.id)}>删除</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* 新增规则 */}
              <View className="rule-add">
                <View className="rule-add-row">
                  <Text className="rule-label">星期</Text>
                  <View className="weekday-picker">
                    {WEEKDAYS.map((wd) => (
                      <View
                        key={wd.value}
                        className={`weekday-chip ${draftWeekday === wd.value ? "active" : ""}`}
                        onClick={() => setDraftWeekday(wd.value)}
                      >
                        <Text>{wd.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View className="rule-add-row">
                  <Text className="rule-label">开始</Text>
                  <Input
                    className="time-input"
                    type="text"
                    value={draftStart}
                    placeholder="09:00"
                    onInput={(e) => setDraftStart(e.detail.value)}
                  />
                  <Text className="rule-label">结束</Text>
                  <Input
                    className="time-input"
                    type="text"
                    value={draftEnd}
                    placeholder="11:00"
                    onInput={(e) => setDraftEnd(e.detail.value)}
                  />
                </View>
                <Button className="action-btn add" onClick={addRule}>添加时段</Button>
              </View>

              <Button className="action-btn save" onClick={onSaveRules} disabled={saving}>
                {saving ? "保存中…" : "保存周期规则"}
              </Button>
            </View>

            {/* 日期例外 */}
            <View className="section">
              <Text className="section-title">日期例外</Text>

              {/* 已有例外列表 */}
              {exceptions.length > 0 && (
                <View className="exception-list">
                  {exceptions.map((exc) => (
                    <View key={exc.id} className="exception-item">
                      <Text className="exception-date">{exc.date}</Text>
                      <Text className={`exception-type ${exc.type.toLowerCase()}`}>
                        {exc.type === "AVAILABLE" ? "可授课" : "不可授课"}
                      </Text>
                      {exc.reason && <Text className="exception-reason">{exc.reason}</Text>}
                    </View>
                  ))}
                </View>
              )}

              {/* 新增例外 */}
              <View className="exception-add">
                <Input
                  className="date-input"
                  type="text"
                  value={exceptionDate}
                  placeholder="日期 YYYY-MM-DD"
                  onInput={(e) => setExceptionDate(e.detail.value)}
                />
                <View className="type-toggle">
                  <View
                    className={`type-chip ${exceptionType === "UNAVAILABLE" ? "active unavailable" : ""}`}
                    onClick={() => setExceptionType("UNAVAILABLE")}
                  >
                    <Text>不可授课</Text>
                  </View>
                  <View
                    className={`type-chip ${exceptionType === "AVAILABLE" ? "active available" : ""}`}
                    onClick={() => setExceptionType("AVAILABLE")}
                  >
                    <Text>可授课</Text>
                  </View>
                </View>
                <Button className="action-btn add" onClick={onSetException}>设置例外</Button>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function labelWeekday(weekday: number): string {
  const map: Record<number, string> = { 1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五", 6: "周六", 7: "周日" };
  return map[weekday] ?? `周${weekday}`;
}
