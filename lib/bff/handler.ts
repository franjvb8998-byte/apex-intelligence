/**
 * Shared BFF route wrapper — logging, uniform JSON, error → HTTP status.
 */

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { readDataProviderConfig } from "@/lib/data-platform/provider-factory";
import { toBffError } from "@/lib/bff/map-error";
import { logBffEvent } from "@/lib/bff/logging";
import type {
  BffErrorResponse,
  BffMeta,
  BffSuccessResponse,
} from "@/lib/bff/types";

export type ApiHandlerContext = {
  request: Request;
  requestId: string;
  url: URL;
  searchParams: URLSearchParams;
};

export type ApiHandlerResult<T> = {
  data: T;
  /** Override provider stamped in meta (defaults to env selection). */
  provider?: string;
  status?: number;
};

function buildMeta(
  requestId: string,
  provider: string,
): BffMeta {
  return {
    requestId,
    provider,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Wrap a Route Handler body with uniform success/error envelopes + logging.
 */
export async function withApiHandler<T>(
  request: Request,
  handler: (ctx: ApiHandlerContext) => Promise<ApiHandlerResult<T> | T>,
): Promise<NextResponse> {
  const requestId = randomUUID();
  const url = new URL(request.url);
  const started = Date.now();
  const defaultProvider = readDataProviderConfig().provider;

  try {
    const raw = await handler({
      request,
      requestId,
      url,
      searchParams: url.searchParams,
    });

    const result: ApiHandlerResult<T> =
      raw !== null &&
      typeof raw === "object" &&
      "data" in (raw as object)
        ? (raw as ApiHandlerResult<T>)
        : { data: raw as T };

    const provider = result.provider ?? defaultProvider;
    const status = result.status ?? 200;
    const body: BffSuccessResponse<T> = {
      ok: true,
      data: result.data,
      meta: buildMeta(requestId, provider),
    };

    logBffEvent({
      level: "info",
      message: "bff.request.ok",
      requestId,
      path: url.pathname,
      method: request.method,
      status,
      provider,
      durationMs: Date.now() - started,
    });

    return NextResponse.json(body, { status });
  } catch (error) {
    const bffError = toBffError(error);
    const body: BffErrorResponse = {
      ok: false,
      error: {
        code: bffError.code,
        message: bffError.message,
        details: bffError.details,
      },
      meta: buildMeta(requestId, defaultProvider),
    };

    logBffEvent({
      level: "error",
      message: "bff.request.error",
      requestId,
      path: url.pathname,
      method: request.method,
      status: bffError.status,
      provider: defaultProvider,
      durationMs: Date.now() - started,
      error: {
        name: bffError.name,
        message: bffError.message,
        code: bffError.code,
      },
    });

    return NextResponse.json(body, { status: bffError.status });
  }
}
