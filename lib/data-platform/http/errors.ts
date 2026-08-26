/**
 * Shared HTTP errors for Data Platform providers.
 * No vendor-specific logic here.
 */

export type HttpErrorCode =
  | "network"
  | "timeout"
  | "http_status"
  | "invalid_json"
  | "rate_limited"
  | "unauthorized"
  | "not_found"
  | "provider";

export class DataPlatformHttpError extends Error {
  readonly code: HttpErrorCode;
  readonly status: number | null;
  readonly providerId: string | null;
  readonly details: unknown;

  constructor(input: {
    message: string;
    code: HttpErrorCode;
    status?: number | null;
    providerId?: string | null;
    details?: unknown;
    cause?: unknown;
  }) {
    super(input.message, input.cause !== undefined ? { cause: input.cause } : undefined);
    this.name = "DataPlatformHttpError";
    this.code = input.code;
    this.status = input.status ?? null;
    this.providerId = input.providerId ?? null;
    this.details = input.details;
  }
}

export function isDataPlatformHttpError(
  error: unknown,
): error is DataPlatformHttpError {
  return error instanceof DataPlatformHttpError;
}
