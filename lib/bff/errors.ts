/**
 * BFF domain errors with HTTP status mapping.
 */

export type BffErrorCode =
  | "bad_request"
  | "not_found"
  | "unauthorized"
  | "provider_error"
  | "rate_limited"
  | "internal_error";

export class BffError extends Error {
  readonly code: BffErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(input: {
    message: string;
    code: BffErrorCode;
    status: number;
    details?: unknown;
    cause?: unknown;
  }) {
    super(input.message, input.cause !== undefined ? { cause: input.cause } : undefined);
    this.name = "BffError";
    this.code = input.code;
    this.status = input.status;
    this.details = input.details;
  }
}

export function badRequest(message: string, details?: unknown): BffError {
  return new BffError({ message, code: "bad_request", status: 400, details });
}

export function notFound(message: string, details?: unknown): BffError {
  return new BffError({ message, code: "not_found", status: 404, details });
}

export function isBffError(error: unknown): error is BffError {
  return error instanceof BffError;
}
