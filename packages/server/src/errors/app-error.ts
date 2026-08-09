import type { ApiErrorCode } from "../../../shared/api";

export class AppError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
