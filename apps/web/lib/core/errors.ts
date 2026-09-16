export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_ERROR"
  | "PERMISSION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "NETWORK_ERROR"
  | "DATABASE_ERROR"
  | "PAYMENT_ERROR"
  | "SYNC_ERROR";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly cause?: unknown;

  constructor(code: AppErrorCode, message: string, status = 500, cause?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

export function toUserError(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error instanceof AppError) return error;
  return new AppError("DATABASE_ERROR", fallback, 500, error);
}