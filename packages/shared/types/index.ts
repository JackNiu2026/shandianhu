export type Tab = "match" | "test" | "diagnose" | "me";
export type Role = "parent" | "teacher" | null;
export type Grade = "小学" | "初中" | "高中";

export type Prefs = {
  grade: Grade;
  subject: string;
  budget: number;
};

export type Teacher = {
  id?: string;
  name: string;
  age: string;
  school: string;
  subject: string;
  grades: Grade[];
  mode: string;
  tags: string[];
  color: string;
  avatar?: string;
  note: string;
  rating: string;
  students: string;
  years: string;
  price: number;
  slots: string[];
  video: string;
  checks: string[];
  reviews: { by: string; text: string }[];
};

export type Dim = "EI" | "SN" | "TF" | "JP";

export type Question = {
  title: string;
  dim: Dim;
  options: { text: string; letter: string }[];
};

export type MBTIResult = {
  code: string;
  label: string;
  profile: string;
  advice: string[];
};

export type ChatMessage = {
  mine: boolean;
  text: string;
  time: string;
};

export type BookedInfo = {
  teacher: string;
  slot: string;
  teacherId?: string;
};

export type WeakPoint = {
  topic: string;
  mastery: number;
};

export type ErrorTypeStat = {
  type: string;
  count: number;
  ratio: number;
};

export type QuestionAnalysis = {
  question: string;
  errorType: string;
  analysis: string;
  correctApproach: string;
};

export type DiagnosisReport = {
  id: string;
  subject: string;
  grade: string;
  overallScore: number;
  level: string;
  weakPoints: WeakPoint[];
  errorTypes: ErrorTypeStat[];
  questionAnalysis: QuestionAnalysis[];
  suggestions: string[];
  createdAt: string;
};
