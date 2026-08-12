import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { fetchTask, submitWrongQuestion, type WrongQuestionSubmission } from "../../services/api";

const TASK_KEY = "wrong-question-task";
const INPUT_KEY = "wrong-question-input";
const POLL_INTERVAL_MS = 2_000;
const terminalStatuses = new Set(["SUCCEEDED", "FAILED", "DEAD_LETTER"]);

function newIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function AssessmentWrongPage() {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState("等待上传错题图片");
  const [savedInput, setSavedInput] = useState<WrongQuestionSubmission | null>(null);
  const visible = useRef(true);

  const saveTask = useCallback((nextTaskId: string) => {
    Taro.setStorageSync(TASK_KEY, nextTaskId);
    setTaskId(nextTaskId);
  }, []);

  useEffect(() => {
    const storedTask = Taro.getStorageSync(TASK_KEY) as string | undefined;
    const storedInput = Taro.getStorageSync(INPUT_KEY) as WrongQuestionSubmission | undefined;
    if (storedTask) setTaskId(storedTask);
    if (storedInput) setSavedInput(storedInput);
    const onShow = () => { visible.current = true; };
    const onHide = () => { visible.current = false; };
    Taro.onAppShow(onShow);
    Taro.onAppHide(onHide);
    return () => { Taro.offAppShow(onShow); Taro.offAppHide(onHide); };
  }, []);

  useEffect(() => {
    if (!taskId) return;
    let stopped = false;
    const poll = async () => {
      if (stopped || !visible.current) return;
      try {
        const task = await fetchTask(taskId);
        if (stopped) return;
        setStatus(task.status === "SUCCEEDED" ? "分析完成" : task.status === "FAILED" || task.status === "DEAD_LETTER" ? "分析失败" : "正在分析");
        if (terminalStatuses.has(task.status)) stopped = true;
      } catch {
        if (!stopped) setStatus("无法获取任务状态");
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => { stopped = true; clearInterval(timer); };
  }, [taskId]);

  const retry = useCallback(async () => {
    if (!savedInput) return;
    const nextInput = { ...savedInput, idempotencyKey: newIdempotencyKey() };
    Taro.setStorageSync(INPUT_KEY, nextInput);
    setSavedInput(nextInput);
    setStatus("正在提交重新分析");
    try {
      const submission = await submitWrongQuestion(nextInput);
      saveTask(submission.taskId);
      setStatus("正在分析");
    } catch {
      setStatus("重新分析提交失败");
    }
  }, [saveTask, savedInput]);

  return <View className="assessment-wrong"><Text>错题诊断</Text><Text>{status}</Text>{taskId && <Text>任务已保存，可返回后继续查看</Text>}{(status === "分析失败" && savedInput) && <Button onClick={retry}>重新分析</Button>}</View>;
}
