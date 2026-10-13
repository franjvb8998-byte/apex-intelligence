/**
 * PE-5.3C — probe transport shapes.
 * These types describe an in-memory double. They do not authorize one.
 * A caller-supplied label or callback is not evidence of offline isolation.
 */

export type Pe53bTransportQuery = {
  readonly fixture: string;
};

export type Pe53bTransportRequest = {
  path: "/fixtures/lineups" | "/injuries";
  query: Pe53bTransportQuery;
};

export type Pe53bTransportResponse = {
  status: number;
  body: unknown;
  headers?: Readonly<Record<string, string | undefined>>;
};

/**
 * Untrusted double shape used by the testing boundary.
 * Possession of this shape is not a capability.
 */
export type Pe53bTransport = {
  request(input: Pe53bTransportRequest): Promise<Pe53bTransportResponse>;
};
