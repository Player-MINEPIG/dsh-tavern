/** Trusted Host input; never accept a VM-selected resource, scope or consumer. */
export interface MvuPromptDependencyRequest {
  id: `mvu:${string}`;
  scope: { authority: 'local'; sessionId: string };
  event: {
    preview: boolean; turn?: number | null; step?: number | null;
    usage: 'prompt-template-dependency';
    consumer: { adapterId: 'tavern.prompt-templates'; id: `prompt-template:${string}` };
  };
  signal?: AbortSignal;
}
export type MvuJson = null | boolean | number | string | MvuJson[] | { [key: string]: MvuJson };
export interface MvuPromptDependencyResult {
  id: `mvu:${string}`; adapterId: 'tavern.mvu';
  /** Detached whole variables, including stat_data/schema; not a historical record. */
  content: { [key: string]: MvuJson };
  revision: number;
  configRevision: number | null;
  /** Synchronous Host-only lease. Check again at final assembly with no intervening await. */
  checkCurrent(): boolean;
}
export interface MvuPromptDependencyService {
  readonly protocolVersion: 1;
  resolvePromptDependency(request: MvuPromptDependencyRequest): Promise<MvuPromptDependencyResult | null>;
}
