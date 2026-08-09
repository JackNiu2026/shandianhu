import { useState } from "react";
import Taro from "@tarojs/taro";
import { View, Text, Image, Textarea, Video } from "@tarojs/components";
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
    if (nextGrade === "小学" && !(subjects.slice(0, 3) as readonly string[]).includes(subject)) setSubject("数学");
  };

  return (
    <View className="modal-backdrop centered-modal">
      <View className="sheet needs-sheet">
        <View className="handle" />
        <Text className="eyebrow">TELL US ABOUT YOUR CHILD</Text>
        <Text className="h2">先告诉我们三件事</Text>
        <Text className="sheet-note">这样推荐的每一位老师，都真的教这个学段和科目。</Text>
        <View className="needs-group">
          <Text className="label">孩子的学段</Text>
          <View className="chip-row">
            {grades.map((g) => (
              <View key={g} className={`button${g === grade ? " on" : ""}`} onClick={() => chooseGrade(g)}>
                <Text>{g}</Text>
              </View>
            ))}
          </View>
        </View>
        <View className="needs-group">
          <Text className="label">想补的科目</Text>
          <View className="chip-row">
            {availableSubjects.map((s) => (
              <View key={s} className={`button${s === subject ? " on" : ""}`} onClick={() => setSubject(s)}>
                <Text>{s}</Text>
              </View>
            ))}
          </View>
        </View>
        <View className="needs-group">
          <Text className="label">单次课预算（60 分钟）</Text>
          <View className="chip-row">
            {budgetOptions.map((option) => (
              <View
                key={option.value}
                className={`button${option.value === budget ? " on" : ""}`}
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
        <Text className="h2">{teacher.name}老师的保障</Text>
        <View className="check-list">
          {teacher.checks.map((c) => (
            <Text key={c}>✓ {c}</Text>
          ))}
        </View>
        <Text className="h3">家长怎么说</Text>
        {teacher.reviews.map((r) => (
          <View className="blockquote" key={r.by}>
            <Text className="p">“{r.text}”</Text>
            <Text className="cite">{r.by}</Text>
          </View>
        ))}
        <Text className="h3">平台规则</Text>
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
        <Text className="h2">先和 {teacher.name}老师聊一节</Text>
        <Text className="sheet-note">
          免费试听，不需要订阅。先了解孩子的情况，再决定是否长期跟学。
        </Text>
        <View className="trial-teacher">
          <View className="trial-avatar" style={{ backgroundColor: teacher.color }}>
            {teacher.avatar ? <Image src={teacher.avatar} mode="aspectFill" /> : <Text>{teacher.name[0]}</Text>}
          </View>
          <View className="trial-info">
            <Text className="b">
              {teacher.name}老师 <Text className="i">✓</Text>
            </Text>
            <Text className="span">
              {teacher.subject} · {teacher.years}教龄 · ★ {teacher.rating}
            </Text>
          </View>
          <Text className="em">免费</Text>
        </View>
        <Text className="trial-slot-label">选择方便的时间</Text>
        <View className="slot-grid">
          {teacher.slots.map((slot) => (
            <View
              className="button"
              key={slot}
              onClick={() => {
                onBook(teacher.name, slot);
                onClose();
              }}
            >
              <Text>{slot}</Text>
              <Text className="small">60 分钟试听</Text>
            </View>
          ))}
        </View>
        <Text className="sheet-foot">预约成功后，老师的联系方式会在「消息」中开放</Text>
      </View>
    </View>
  );
}

/* ============ 评价弹窗 ============ */
export function ReviewSheet({
  teacherName,
  onClose,
  onSubmit,
}: {
  teacherName: string;
  onClose: () => void;
  onSubmit: (rating: number, text: string) => void;
}) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");

  return (
    <View className="modal-backdrop centered-modal" onClick={onClose}>
      <View className="sheet review-sheet" catchTap={noop}>
        <View className="close" onClick={onClose}>
          <Text>×</Text>
        </View>
        <Text className="eyebrow">SHARE YOUR EXPERIENCE</Text>
        <Text className="h2">评价 {teacherName}老师</Text>
        <View className="rating-row">
          {[1, 2, 3, 4, 5].map((star) => (
            <Text key={star} className={star <= rating ? "on" : ""} onClick={() => setRating(star)}>
              ★
            </Text>
          ))}
        </View>
        <Textarea
          className="review-textarea"
          placeholder="说说老师上课的优点和可以改进的地方..."
          value={text}
          onInput={(e) => setText(e.detail.value)}
        />
        <View
          className="sheet-btn"
          onClick={() => {
            onSubmit(rating, text);
            onClose();
          }}
        >
          <Text>提交评价</Text>
        </View>
      </View>
    </View>
  );
}

/* ============ 视频播放弹窗 ============ */
/**
 * P0-5 视频播放器真实化
 * - 有 video URL 时：用 Taro Video 组件播放真实视频（controls + autoplay）
 * - 无 video URL 时：保留 Image 封面 + CSS 假进度条 + "演示版本"提示
 *   （当前所有 teacher.video 为空字符串，走降级路径）
 * 未来后端补充视频 URL 后，自动切换到真实播放
 */
export function VideoPlayer({ teacher, onClose }: { teacher: Teacher; onClose: () => void }) {
  const hasVideo = Boolean(teacher.video && teacher.video.trim().length > 0);
  return (
    <View className="modal-backdrop center" onClick={onClose}>
      <View className="player" catchTap={noop}>
        {hasVideo ? (
          <Video
            src={teacher.video}
            controls
            autoplay
            objectFit="cover"
            showCenterPlayBtn
            showPlayBtn
            showFullscreenBtn
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
          />
        ) : (
          <>
            <Image src={teacher.video || ""} mode="aspectFill" />
            <View className="player-shade" />
            <View className="player-info">
              <Text className="b">{teacher.name}老师 · 试听片段</Text>
              <Text className="span">
                {teacher.subject} · {teacher.tags[2] ?? teacher.tags[0]}
              </Text>
            </View>
            <View className="player-bar">
              <View className="i" />
            </View>
            <View className="player-demo-hint">
              <Text>演示版本 · 视频即将上线</Text>
            </View>
          </>
        )}
        <View className="player-close" onClick={onClose}>
          <Text>×</Text>
        </View>
      </View>
    </View>
  );
}

/* ============ 会员弹窗 ============ */
/**
 * P1-4: 订阅弹窗标注演示版本
 * 微信支付集成需商户号 + 支付接口，当前为演示版本
 * 点击"开通会员"按钮显示提示，后续接入 wx.requestPayment
 */
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
        <Text className="h2">想同时对比多位老师？</Text>
        <Text className="p">试听和联系单个老师始终免费。会员适合想一次多约几位、横向比较的家长。</Text>
        <View className="membership-benefits">
          <Text className="span">✓ 不限次数联系与预约</Text>
          <Text className="span">✓ 每月 3 次免费试听（非会员 1 次）</Text>
          <Text className="span">✓ 30 天内不合适可无限次换老师</Text>
          <Text className="span">✓ 专属顾问帮你筛老师</Text>
        </View>
        <View
          className="subscribe-btn"
          onClick={() => {
            Taro.showToast({ title: "支付功能即将上线，敬请期待", icon: "none" });
          }}
        >
          <Text>开通会员 · ¥19.9 / 月</Text>
        </View>
        <Text className="small">演示版本 · 随时可取消 · 未使用可申请全额退</Text>
      </View>
    </View>
  );
}

/* ============ 名片弹窗 ============ */
export function PosterModal({
  teacher,
  onClose,
}: {
  teacher: Teacher;
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
            <Text className="span">电虎</Text>
            <Text className="small">严选一对一家教</Text>
          </View>
          <View className="poster-main">
            <View className="poster-avatar">
              {teacher.avatar ? <Image src={teacher.avatar} mode="aspectFill" /> : <Text>{teacher.name[0]}</Text>}
            </View>
            <View>
              <Text className="p">{teacher.school} · {teacher.subject}</Text>
              <Text className="h2">
                {teacher.name}老师 <Text className="i">✓</Text>
              </Text>
              <Text className="span">{teacher.tags.join(" · ")}</Text>
            </View>
          </View>
          <Text className="poster-quote">“{teacher.note}”</Text>
          <View className="poster-metrics">
            <Text className="span">
              <Text className="b">{teacher.rating}</Text>
              <Text className="small">综合评分</Text>
            </Text>
            <Text className="span">
              <Text className="b">{teacher.students}</Text>
              <Text className="small">累计学生</Text>
            </Text>
            <Text className="span">
              <Text className="b">186</Text>
              <Text className="small">授课课时</Text>
            </Text>
          </View>
          <View className="poster-footer">
            <View className="poster-code">
              <View className="poster-code-grid">
                {/* P1-5: 伪二维码图案（Canvas 绘制真实二维码需引入 weapp-qrcode，
                     当前用 CSS grid 模拟二维码视觉，标注"扫码查看"） */}
                {Array.from({ length: 49 }).map((_, i) => (
                  <View
                    key={i}
                    className="poster-code-cell"
                    style={{
                      backgroundColor:
                        // 定位角 + 随机图案模拟
                        i < 3 || i % 7 < 3 || i % 3 === 0 || (i > 20 && i < 30 && i % 2 === 0)
                          ? "#151617"
                          : "#fffdfa",
                    }}
                  />
                ))}
              </View>
            </View>
            <Text className="p">
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
            <Text className="h2">设置</Text>
          </View>
          <View className="close" onClick={onClose}>
            <Text>×</Text>
          </View>
        </View>
        <View className="settings-menu-item" onClick={onSwitchRole}>
          <Text className="settings-menu-icon">⇄</Text>
          <Text className="settings-menu-text">
            <Text className="b">切换身份</Text>
            <Text className="small">在家长与老师工作台之间切换</Text>
          </Text>
          <Text className="i">›</Text>
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
        <Text className="h2">你的身份是？</Text>
        <View className="button" onClick={() => onSelect("parent")}>
          <Text className="role-icon peach">⌂</Text>
          <Text>
            <Text className="b">我是家长</Text>
            <Text className="small">为孩子寻找合拍的老师</Text>
          </Text>
          <Text className="i">›</Text>
        </View>
        <View className="button" onClick={() => onSelect("teacher")}>
          <Text className="role-icon green">✎</Text>
          <Text>
            <Text className="b">我是老师</Text>
            <Text className="small">开启专业陪伴之旅</Text>
          </Text>
          <Text className="i">›</Text>
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
