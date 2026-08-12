import { z } from "zod";

export const teacherFeedbackSchema = z.object({
  lessonContent: z.array(z.string().min(1)).min(1).max(10),
  performance: z.enum(["STRONG", "STEADY", "NEEDS_SUPPORT"]),
  difficulties: z.array(z.string().min(1)).max(10),
  suggestions: z.array(z.string().min(1)).min(1).max(10),
  privateTeacherNote: z.string().max(1000).optional(),
});

export type TeacherFeedbackInput = z.infer<typeof teacherFeedbackSchema>;
