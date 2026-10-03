export interface OpeningSourceIdentity {
  version: 1; owner: 'pmp-dsh-tavern'; sessionId: string; characterId: string;
  /** Zero based: 0 is original first_mes; hash the original before regex/macros. */
  greetingIndex: number; greetingSha256: string; identitySha256: string;
}
export type OpeningId = 'default' | 'police_done' | 'hospital_done' | 'alisa_party' | 'pool';
export interface OpeningHelperEntry {
  name: string; enabled: boolean; content: string; probability: number;
  strategy: { type: 'selective'; keys: string[]; keys_secondary: { logic: 'and_any'; keys: string[] }; scan_depth: 'same_as_global' };
  position: { type: 'at_depth'; role: 'system'; depth: number; order: number };
  recursion: { prevent_incoming: false; prevent_outgoing: false; delay_until: null };
  effect: { sticky: null; cooldown: null; delay: null }; extra: { comment: string };
}
export interface OpeningProposal {
  proposalId: string; expectedRevision: number; entriesHash: string; entries: OpeningHelperEntry[];
  openingId: OpeningId; entryCount: number; expiresAt: number; sourceIdentity: OpeningSourceIdentity; resourceId: string;
}
export interface OpeningReceipt {
  ok: true; skipped?: true; inserted: number; existing: number; updated: number;
  targetWorldbook: string | null; method: 'session-local'; receiptId: string; resourceId: string | null; revision: number;
}
export const OPENING_WORLD_BOOK_SERVICE: 'tavernOpeningWorldBooks';
export class OpeningWorldBookService {
  constructor(options: { storageDir: string; characters: { get(id: string): unknown }; getSelection(id: string): unknown; getSelectionRevision(id: string): unknown; getSession(id: string): unknown; onChange?(): void });
  prepare(args: { sourceIdentity: OpeningSourceIdentity; openingId: OpeningId; identitySource: string; source?: { url: string; sha256: string; content: string }; signal?: AbortSignal }): OpeningProposal;
  /** Trusted UI only; never expose this confirmation primitive to the guest VM. */
  commit(args: { proposalId: string; expectedRevision: number; operationId: string; sourceIdentity: OpeningSourceIdentity; reviewed: true; write: true; signal?: AbortSignal }): OpeningReceipt;
  selectedIds(sessionId: string, selection?: unknown): string[];
  get(id: string, sessionId: string): unknown;
  list(sessionId: string): { id: string }[];
  revision(): string;
  dispose(): void;
}
