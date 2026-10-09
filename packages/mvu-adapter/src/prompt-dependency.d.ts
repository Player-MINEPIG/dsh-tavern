/** Trusted Host input; never accept a VM-selected resource, scope or consumer. */
export interface MvuPromptDependencyRequest {
  id?: `mvu:${string}`;
  scope: { authority: 'local'; sessionId: string };
  event: {
    preview: boolean; turn?: number | null; step?: number | null;
    usage: 'prompt-template-dependency' | 'world-book-variable';
    consumer: { adapterId: 'tavern.prompt-templates'; id: `prompt-template:${string}` } | { adapterId: 'tavern.world-books'; id: `world-book:${string}` };
  };
  signal?: AbortSignal;
}
export type MvuJson = null | boolean | number | string | MvuJson[] | { [key: string]: MvuJson };
export interface MvuPromptDependencyResult {
  id: `mvu:${string}`; adapterId: 'tavern.mvu';
  /** Detached whole variables, including stat_data/schema; world-book sends use the persisted pre-turn checkpoint. */
  content: { [key: string]: MvuJson };
  revision: number;
  configRevision: number | null;
  /** Synchronous Host-only lease. Check again at final assembly with no intervening await. */
  checkCurrent(): boolean;
}
export interface MvuPromptDependencyService {
  readonly protocolVersion: 1;
  resolvePromptDependency(request: MvuPromptDependencyRequest): Promise<MvuPromptDependencyResult | null>;
  getManagementDefaults(args: {id:string;scope?:{authority?:'local';sessionId?:string}}): import('../../memory-sources/index.js').SourceManagementDefaults | null;
  registerUsage(handler: (request: Record<string, unknown>) => unknown, options?: {providerId:'dsh-memory-manager'}): () => void;
}
