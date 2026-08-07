import { useState } from "react";
import { View, Text, Input, Button } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useAppStore } from "@/store";
import { parentLogin, parentRegister, setAuthToken } from "@/services/api";
import "./index.scss";

export default function LoginPage() {
  const { dispatch } = useAppStore();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [childGrade, setChildGrade] = useState("初中");
  const [loading, setLoading] = useState(false);

  // 已有 token 时自动跳转
  Taro.useReady(() => {
    const token = Taro.getStorageSync("auth-token");
    if (token) {
      Taro.switchTab({ url: "/pages/match/index" });
    }
  });

  const handleSubmit = async () => {
    if (!phone || !password) {
      Taro.showToast({ title: "请填写手机号和密码", icon: "none" });
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const res = await parentLogin({ phone, password });
        if (res.success && res.token) {
          handleLoginSuccess(res.token, res.user);
        }
      } else {
        if (!name) {
          Taro.showToast({ title: "请填写姓名", icon: "none" });
          return;
        }
        await parentRegister({ name, phone, password, childGrade });
        // 注册成功后自动登录
        const loginRes = await parentLogin({ phone, password });
        if (loginRes.success && loginRes.token) {
          handleLoginSuccess(loginRes.token, loginRes.user);
        }
      }
    } catch (err) {
      console.error("[Login Error]", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (token: string, user: { id: string; name: string; phone: string }) => {
    setAuthToken(token);
    dispatch({
      type: "SET_PARENT",
      id: user.id,
      name: user.name,
      avatar: user.name[0] || "家",
    });
    Taro.showToast({ title: "登录成功", icon: "success" });
    setTimeout(() => {
      Taro.switchTab({ url: "/pages/match/index" });
    }, 500);
  };

  return (
    <View className="login-screen">
      <View className="login-hero">
        <View className="login-logo">
          <Text>⚡</Text>
        </View>
        <Text className="login-title">闪电虎</Text>
        <Text className="login-subtitle">严选一对一家教</Text>
      </View>

      <View className="login-card">
        <View className="login-tabs">
          <View
            className={`login-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => setMode("login")}
          >
            <Text>登录</Text>
          </View>
          <View
            className={`login-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => setMode("register")}
          >
            <Text>注册</Text>
          </View>
        </View>

        {mode === "register" && (
          <View className="login-field">
            <Text className="login-label">姓名</Text>
            <Input
              className="login-input"
              value={name}
              onInput={(e) => setName(e.detail.value)}
              placeholder="请输入您的姓名"
              maxlength={50}
            />
          </View>
        )}

        <View className="login-field">
          <Text className="login-label">手机号</Text>
          <Input
            className="login-input"
            type="number"
            value={phone}
            onInput={(e) => setPhone(e.detail.value)}
            placeholder="请输入手机号"
            maxlength={11}
          />
        </View>

        <View className="login-field">
          <Text className="login-label">密码</Text>
          <Input
            className="login-input"
            password
            value={password}
            onInput={(e) => setPassword(e.detail.value)}
            placeholder={mode === "login" ? "请输入密码" : "密码至少 8 位"}
            maxlength={100}
          />
        </View>

        {mode === "register" && (
          <View className="login-field">
            <Text className="login-label">孩子学段</Text>
            <View className="login-grade-row">
              {["小学", "初中", "高中"].map((g) => (
                <View
                  key={g}
                  className={`login-grade ${childGrade === g ? "active" : ""}`}
                  onClick={() => setChildGrade(g)}
                >
                  <Text>{g}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Button
          className="login-btn"
          loading={loading}
          disabled={loading}
          onClick={handleSubmit}
        >
          {mode === "login" ? "登录" : "注册并登录"}
        </Button>

        <Text className="login-foot">
          登录即表示同意《用户协议》和《隐私政策》
        </Text>
      </View>
    </View>
  );
}
