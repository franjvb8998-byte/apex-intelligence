/**
 * PE-5.3B — probe transport boundary.
 * The runner depends on this interface only. No HTTP client lives here.
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

export type Pe53bTransport = {
  readonly kind: "in_memory";
  request(input: Pe53bTransportRequest): Promise<Pe53bTransportResponse>;
};
