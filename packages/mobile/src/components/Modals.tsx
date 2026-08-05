import { useState } from "react";
import { View, Text, Image } from "@tarojs/components";
import type { Prefs, Grade, Teacher, Role } from "@lightning-tiger/shared";
import { subjects, grades, budgetOptions } from "@lightning-tiger/shared";

const noop = () => {};

/* ============ 筛选弹窗 ============ */
export function NeedsSheet({
  prefs,
  onDone,
  onClose,
}: {
  prefs: Prefs | null;
  onDone: (prefs: Prefs) => void;
  onClose?: () => void;
}) {
  const [grade, setGrade] = useState<Grade>(prefs?.grade ?? "初中");
  const [subject, setSubject] = useState(prefs?.subject ?? "数学");
  const [budget, setBudget] = useState(
    prefs?.budget && prefs.budget <= 100 ? 100 : prefs?.budget && prefs.budget <= 200 ? 200 : 999,
  );
  const availableSubjects = grade === "小学" ? subjects.slice(0, 3) : subjects;
  const chooseGrade = (nextGrade: Grade) => {
    setGrade(nextGrade);
    if (nextGrade === "小学" && !subjects.slice(0, 3).includes(subject)) setSubject("数学");
  };

  return (
    <View className="modal-backdrop centered-modal">
      <View className="sheet needs-sheet">
        <View className="handle" />
        <Text className="eyebrow">TELL US ABOUT YOUR CHILD</Text>
        <Text>先告诉我们三件事</Text>
        <Text className="sheet-note">这样推荐的每一位老师，都真的教这个学段和科目。</Text>
        <View className="needs-group">
          <Text>孩子的学段</Text>
          <View className="chip-row">
            {grades.map((g) => (
              <View key={g} className={g === grade ? "on" : ""} onClick={() => chooseGrade(g)}>
                <Text>{g}</Text>
              </View>
            ))}
          </View>
        </View>
        <View className="needs-group">
          <Text>想补的科目</Text>
          <View className="chip-row">
            {availableSubjects.map((s) => (
              <View key={s} className={s === subject ? "on" : ""} onClick={() => setSubject(s)}>
                <Text>{s}</Text>
              </View>
            ))}
          </View>
        </View>
        <View className="needs-group">
          <Text>单次课预算（60 分钟）</Text>
          <View className="chip-row">
            {budgetOptions.map((option) => (
              <View
                key={option.value}
                className={option.value === budget ? "on" : ""}
                onClick={() => setBudget(option.value)}
              >
                <Text>{option.label}</Text>
              </View>
            ))}
          </View>
        </View>
        <View className="sheet-btn" onClick={() => onDone({ grade, subject, budget })}>
          <Text>开始为孩子找老师</Text>
        </View>
        {onClose && (
          <View className="text-btn" onClick={onClose}>
            <Text>取消</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/* ============ 保障详情弹窗 ============ */
export function TrustSheet({ teacher, onClose }: { teacher: Teacher; onClose: () => void }) {
  return (
    <View className="modal-backdrop" onClick={onClose}>
      <View className="sheet trust-sheet" catchTap={noop}>
        <View className="handle" />
        <Text className="eyebrow">SAFETY &amp; TRUST</Text>
        <Text>{teacher.name}老师的保障</Text>
        <View className="check-list">
          {teacher.checks.map((c) => (
            <Text key={c}>✓ {c}</Text>
          ))}
        </View>
        <Text>家长怎么说</Text>
        {teacher.reviews.map((r) => (
          <View key={r.by}>
            <Text>“{r.text}”</Text>
            <Text>{r.by}</Text>
          </View>
        ))}
        <Text>平台规则</Text>
        <View className="rule-list">
          <View>
            <Text>线上课全程可录制，家长可回看 30 天</Text>
          </View>
          <View>
            <Text>首次试听免费，不满意不产生费用</Text>
          </View>
          <View>
            <Text>付费后 7 天内可免费更换老师，剩余课时全额退</Text>
          </View>
          <View>
            <Text>投诉 24 小时内平台介入，处理结果书面反馈</Text>
          </View>
        </View>
        <View className="sheet-btn" onClick={onClose}>
          <Text>我知道了</Text>
        </View>
      </View>
    </View>
  );
}

/* ============ 预约弹窗 ============ */
export function BookSheet({
  teacher,
  onClose,
  onBook,
}: {
  teacher: Teacher;
  onClose: () => void;
  onBook: (teacherName: string, slot: string) => void;
}) {
  return (
    <View className="modal-backdrop centered-modal" onClick={onClose}>
      <View className="sheet book-sheet" catchTap={noop}>
        <View className="close" onClick={onClose}>
          <Text>×</Text>
        </View>
        <Text className="eyebrow">FREE TRIAL · 60 MIN</Text>
        <Text>先和 {teacher.name}老师聊一节</Text>
        <Text className="sheet-note">
          免费试听，不需要订阅。先了解孩子的情况，再决定是否长期跟学。
        </Text>
        <View className="trial-teacher">
          <View className="trial-avatar" style={{ backgroundColor: teacher.color }}>
            {teacher.avatar ? <Image src={teacher.avatar} /> : <Text>{teacher.name[0]}</Text>}
          </View>
          <View>
            <Text>
              {teacher.name}老师 <Text>✓</Text>
            </Text>
            <Text>
              {teacher.subject} · {teacher.years}教龄 · ★ {teacher.rating}
            </Text>
          </View>
          <Text>免费</Text>
        </View>
        <Text className="trial-slot-label">选择方便的时间</Text>
        <View className="slot-grid">
          {teacher.slots.map((slot) => (
            <View
              key={slot}
              onClick={() => {
                onBook(teacher.name, slot);
                onClose();
              }}
            >
              <Text>{slot}</Text>
              <Text>60 分钟试听</Text>
            </View>
          ))}
        </View>
        <Text className="sheet-foot">预约成功后，老师的联系方式会在「消息」中开放</Text>
      </View>
    </View>
  );
}

/* ============ 视频播放弹窗 ============ */
export function VideoPlayer({ teacher, onClose }: { teacher: Teacher; onClose: () => void }) {
  return (
    <View className="modal-backdrop center" onClick={onClose}>
      <View className="player" catchTap={noop}>
        <Image src={teacher.video} />
        <View className="player-shade" />
        <View className="player-info">
          <Text>{teacher.name}老师 · 试听片段</Text>
          <Text>
            {teacher.subject} · {teacher.tags[2] ?? teacher.tags[0]}
          </Text>
        </View>
        <View className="player-bar">
          <View />
        </View>
        <View className="player-close" onClick={onClose}>
          <Text>×</Text>
        </View>
      </View>
    </View>
  );
}

/* ============ 会员弹窗 ============ */
export function SubscribeModal({ onClose }: { onClose: () => void }) {
  return (
    <View className="modal-backdrop" onClick={onClose}>
      <View className="sheet subscribe-modal" catchTap={noop}>
        <View className="close" onClick={onClose}>
          <Text>×</Text>
        </View>
        <View className="lock-art">
          <Text>✦</Text>
        </View>
        <Text className="eyebrow">闪电虎会员 · 可选</Text>
        <Text>想同时对比多位老师？</Text>
        <Text>试听和联系单个老师始终免费。会员适合想一次多约几位、横向比较的家长。</Text>
        <View className="membership-benefits">
          <Text>✓ 不限次数联系与预约</Text>
          <Text>✓ 每月 3 次免费试听（非会员 1 次）</Text>
          <Text>✓ 30 天内不合适可无限次换老师</Text>
          <Text>✓ 专属顾问帮你筛老师</Text>
        </View>
        <View className="subscribe-btn" onClick={onClose}>
          <Text>开通会员 · ¥19.9 / 月</Text>
        </View>
        <Text>随时可取消 · 未使用可申请全额退</Text>
      </View>
    </View>
  );
}

/* ============ 名片弹窗 ============ */
export function PosterModal({
  teacherName,
  onClose,
}: {
  teacherName: string;
  onClose: () => void;
}) {
  return (
    <View className="modal-backdrop centered-modal" onClick={onClose}>
      <View className="sheet teacher-poster-modal" catchTap={noop}>
        <View className="close" onClick={onClose}>
          <Text>×</Text>
        </View>
        <Text className="eyebrow">LIGHTNING TIGER · TEACHER CARD</Text>
        <View className="teacher-poster">
          <View className="poster-brand">
            <Text>闪</Text>
            <Text>电虎 </Text>
            <Text>严选一对一家教</Text>
          </View>
          <View className="poster-main">
            <View className="poster-avatar">
              <Text>{teacherName[0]}</Text>
            </View>
            <View>
              <Text>复旦大学 · 数学与应用数学</Text>
              <Text>
                {teacherName} <Text>✓</Text>
              </Text>
              <Text>中考数学 · 竞赛启蒙</Text>
            </View>
          </View>
          <Text className="poster-quote">“把抽象的数学，讲成孩子愿意自己动手解决的问题。”</Text>
          <View className="poster-metrics">
            <Text>
              <Text>4.9</Text>
              <Text>综合评分</Text>
            </Text>
            <Text>
              <Text>32</Text>
              <Text>累计学生</Text>
            </Text>
            <Text>
              <Text>186</Text>
              <Text>授课课时</Text>
            </Text>
          </View>
          <View className="poster-footer">
            <View className="poster-code">
              <Text>▦</Text>
            </View>
            <Text>
              扫码查看老师详情{"\n"}预约免费试听
            </Text>
          </View>
        </View>
        <View className="sheet-btn" onClick={onClose}>
          <Text>保存名片海报</Text>
        </View>
      </View>
    </View>
  );
}

/* ============ 设置弹窗 ============ */
export function SettingsModal({
  onClose,
  onSwitchRole,
}: {
  onClose: () => void;
  onSwitchRole: () => void;
}) {
  return (
    <View className="modal-backdrop centered-modal" onClick={onClose}>
      <View className="sheet settings-modal settings-menu" catchTap={noop}>
        <View className="settings-head">
          <View>
            <Text className="eyebrow">ACCOUNT SETTINGS</Text>
            <Text>设置</Text>
          </View>
          <View className="close" onClick={onClose}>
            <Text>×</Text>
          </View>
        </View>
        <View className="settings-menu-item" onClick={onSwitchRole}>
          <Text className="settings-menu-icon">⇄</Text>
          <Text>
            <Text>切换身份</Text>
            <Text>在家长与老师工作台之间切换</Text>
          </Text>
          <Text>›</Text>
        </View>
      </View>
    </View>
  );
}

/* ============ 角色选择弹窗 ============ */
export function RoleModal({
  onSelect,
  hasRole,
  onClose,
}: {
  onSelect: (role: Role) => void;
  hasRole: boolean;
  onClose: () => void;
}) {
  return (
    <View className="modal-backdrop centered-modal">
      <View className="sheet role-modal">
        <View className="handle" />
        <Text className="eyebrow">WELCOME TO LIGHTNING TIGER</Text>
        <Text>你的身份是？</Text>
        <View onClick={() => onSelect("parent")}>
          <Text className="role-icon peach">⌂</Text>
          <Text>
            <Text>我是家长</Text>
            <Text>为孩子寻找合拍的老师</Text>
          </Text>
          <Text>›</Text>
        </View>
        <View onClick={() => onSelect("teacher")}>
          <Text className="role-icon green">✎</Text>
          <Text>
            <Text>我是老师</Text>
            <Text>开启专业陪伴之旅</Text>
          </Text>
          <Text>›</Text>
        </View>
        {hasRole && (
          <View className="text-btn" onClick={onClose}>
            <Text>暂不切换</Text>
          </View>
        )}
      </View>
    </View>
  );
}
