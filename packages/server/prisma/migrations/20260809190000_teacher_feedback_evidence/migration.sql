-- V2.3 Task 11: 老师反馈回流画像
-- 扩展 EvidenceSource 枚举，新增 TEACHER_FEEDBACK 值
ALTER TYPE "EvidenceSource" ADD VALUE IF NOT EXISTS 'TEACHER_FEEDBACK';
