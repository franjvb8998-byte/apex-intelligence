/** Opaque provider identifiers — extend by adding a string union member + adapter. */
export type DataProviderId =
  | "api-football"
  | "sportmonks"
  | "football-data"
  | "mock";

/** APEX canonical IDs (UUIDs once persisted; may be deterministic stubs in mocks). */
export type ApexId = string;

export type ExternalRef = {
  provider: DataProviderId;
  externalId: string;
};
