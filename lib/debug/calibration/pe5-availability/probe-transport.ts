/**
 * PE-5.3D — offline fixture shapes.
 *
 * These types describe the envelope the runner reads. They do not authorize a
 * caller callback, and no production entry accepts an object of this shape as
 * a transport.
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
  headers?: Readonly<Record<string, string | number | undefined>>;
};
