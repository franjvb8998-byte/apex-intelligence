/** Opaque graph node id — UUID when persisted; stable strings in mocks. */
export type GraphId = string;

export type GraphEntityKind =
  | "team"
  | "player"
  | "coach"
  | "referee"
  | "competition"
  | "stadium"
  | "match"
  | "event"
  | "playing_style"
  | "metric";

export type GraphNodeBase = {
  id: GraphId;
  kind: GraphEntityKind;
  name: string;
  /** Free-form tags for filtering / embeddings later. */
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
};
