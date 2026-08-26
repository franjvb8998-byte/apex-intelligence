/**
 * API-Football specific errors.
 * Wraps / extends the shared Data Platform HTTP error model.
 */

import {
  DataPlatformHttpError,
  type HttpErrorCode,
  isDataPlatformHttpError,
} from "@/lib/data-platform/http/errors";

export type ApiFootballErrorCode =
  | HttpErrorCode
  | "missing_api_key"
  | "empty_response"
  | "vendor_error";

export class ApiFootballError extends DataPlatformHttpError {
  readonly apiFootballCode: ApiFootballErrorCode;

  constructor(input: {
    message: string;
    code: ApiFootballErrorCode;
    status?: number | null;
    details?: unknown;
    cause?: unknown;
  }) {
    const httpCode: HttpErrorCode =
      input.code === "missing_api_key"
        ? "unauthorized"
        : input.code === "empty_response"
          ? "not_found"
          : input.code === "vendor_error"
            ? "provider"
            : input.code;

    super({
      message: input.message,
      code: httpCode,
      status: input.status,
      providerId: "api-football",
      details: input.details,
      cause: input.cause,
    });
    this.name = "ApiFootballError";
    this.apiFootballCode = input.code;
  }
}

export function isApiFootballError(error: unknown): error is ApiFootballError {
  return error instanceof ApiFootballError;
}

export function toApiFootballError(error: unknown): ApiFootballError {
  if (isApiFootballError(error)) return error;
  if (isDataPlatformHttpError(error)) {
    return new ApiFootballError({
      message: error.message,
      code: error.code,
      status: error.status,
      details: error.details,
      cause: error,
    });
  }
  return new ApiFootballError({
    message: error instanceof Error ? error.message : "Unknown API-Football error",
    code: "provider",
    cause: error,
  });
}
