/**
 * Minimal fetch-based HTTP client for Data Platform adapters.
 * Injectable for unit tests (pass a custom `fetch` / client).
 */

import {
  DataPlatformHttpError,
  type HttpErrorCode,
} from "@/lib/data-platform/http/errors";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type HttpRequest = {
  method?: HttpMethod;
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  /** Override default timeout (ms). */
  timeoutMs?: number;
};

export type HttpResponse<T = unknown> = {
  status: number;
  headers: Headers;
  data: T;
};

export type HttpClientOptions = {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  /** Default request timeout in ms (default 12_000). */
  timeoutMs?: number;
  /** Optional provider id stamped on errors. */
  providerId?: string;
  /** Inject for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
};

export type HttpClient = {
  request<T = unknown>(input: HttpRequest): Promise<HttpResponse<T>>;
  get<T = unknown>(
    path: string,
    query?: HttpRequest["query"],
    init?: Omit<HttpRequest, "method" | "path" | "query">,
  ): Promise<HttpResponse<T>>;
};

function buildUrl(
  baseUrl: string,
  path: string,
  query?: HttpRequest["query"],
): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${normalizedPath}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function mapStatusToCode(status: number): HttpErrorCode {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  return "http_status";
}

/**
 * Create a small HTTP client bound to a vendor base URL.
 */
export function createHttpClient(options: HttpClientOptions): HttpClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const defaultTimeout = options.timeoutMs ?? 12_000;
  const providerId = options.providerId ?? null;

  async function request<T = unknown>(
    input: HttpRequest,
  ): Promise<HttpResponse<T>> {
    const timeoutMs = input.timeoutMs ?? defaultTimeout;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const onAbort = () => controller.abort();
    if (input.signal) {
      if (input.signal.aborted) controller.abort();
      else input.signal.addEventListener("abort", onAbort, { once: true });
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...options.defaultHeaders,
      ...input.headers,
    };

    let body: string | undefined;
    if (input.body !== undefined) {
      headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
      body = JSON.stringify(input.body);
    }

    try {
      const response = await fetchImpl(
        buildUrl(options.baseUrl, input.path, input.query),
        {
          method: input.method ?? "GET",
          headers,
          body,
          signal: controller.signal,
        },
      );

      const text = await response.text();
      let data: unknown = null;
      if (text.length > 0) {
        try {
          data = JSON.parse(text) as unknown;
        } catch (cause) {
          throw new DataPlatformHttpError({
            message: `Invalid JSON from ${options.baseUrl}${input.path}`,
            code: "invalid_json",
            status: response.status,
            providerId,
            details: text.slice(0, 200),
            cause,
          });
        }
      }

      if (!response.ok) {
        throw new DataPlatformHttpError({
          message: `HTTP ${response.status} from ${input.path}`,
          code: mapStatusToCode(response.status),
          status: response.status,
          providerId,
          details: data,
        });
      }

      return {
        status: response.status,
        headers: response.headers,
        data: data as T,
      };
    } catch (error) {
      if (error instanceof DataPlatformHttpError) throw error;
      if (
        error instanceof Error &&
        (error.name === "AbortError" || error.name === "TimeoutError")
      ) {
        throw new DataPlatformHttpError({
          message: `Request timed out after ${timeoutMs}ms (${input.path})`,
          code: "timeout",
          providerId,
          cause: error,
        });
      }
      throw new DataPlatformHttpError({
        message: `Network error calling ${input.path}`,
        code: "network",
        providerId,
        cause: error,
      });
    } finally {
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", onAbort);
    }
  }

  return {
    request,
    get(path, query, init) {
      return request({ ...init, method: "GET", path, query });
    },
  };
}
