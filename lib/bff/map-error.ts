/**
 * Map Data Platform / unknown errors → BffError with HTTP status.
 */

import { isDataPlatformHttpError } from "@/lib/data-platform/http";
import { isApiFootballError } from "@/lib/data-platform/providers/api-football/errors";
import { BffError, isBffError } from "@/lib/bff/errors";

export function toBffError(error: unknown): BffError {
  if (isBffError(error)) return error;

  if (isApiFootballError(error)) {
    if (error.apiFootballCode === "missing_api_key") {
      return new BffError({
        message: error.message,
        code: "unauthorized",
        status: 401,
        details: error.details,
        cause: error,
      });
    }
    if (
      error.apiFootballCode === "empty_response" ||
      error.code === "not_found"
    ) {
      return new BffError({
        message: error.message,
        code: "not_found",
        status: 404,
        details: error.details,
        cause: error,
      });
    }
    if (error.code === "rate_limited") {
      return new BffError({
        message: error.message,
        code: "rate_limited",
        status: 429,
        details: error.details,
        cause: error,
      });
    }
    return new BffError({
      message: error.message,
      code: "provider_error",
      status: 502,
      details: error.details,
      cause: error,
    });
  }

  if (isDataPlatformHttpError(error)) {
    if (error.code === "unauthorized") {
      return new BffError({
        message: error.message,
        code: "unauthorized",
        status: 401,
        details: error.details,
        cause: error,
      });
    }
    if (error.code === "not_found") {
      return new BffError({
        message: error.message,
        code: "not_found",
        status: 404,
        details: error.details,
        cause: error,
      });
    }
    if (error.code === "rate_limited") {
      return new BffError({
        message: error.message,
        code: "rate_limited",
        status: 429,
        details: error.details,
        cause: error,
      });
    }
    return new BffError({
      message: error.message,
      code: "provider_error",
      status: 502,
      details: error.details,
      cause: error,
    });
  }

  return new BffError({
    message: error instanceof Error ? error.message : "Internal BFF error",
    code: "internal_error",
    status: 500,
    cause: error,
  });
}
