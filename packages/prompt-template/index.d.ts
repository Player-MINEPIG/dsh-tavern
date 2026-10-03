import type { SourceContext, SourceOutput } from '../request-assembler/index.js'
export interface TemplateResource {
  id: `prompt-template:${string}`; name: string; content: string; enabled: boolean;
  sessionIds: string[]; variables?: unknown; variableResourceId?: `mvu:${string}`;
}
export const TEMPLATE_SOURCE: 'pmp-dsh-tavern/prompt-template'
export function compileTemplate(content: string): string
export function renderTemplate(content: string, snapshot?: Record<string, unknown>, options?: {
  signal?: AbortSignal; timeLimit?: number; memoryLimit?: number; maxOutput?: number;
}): Promise<string>
export function inspectTemplateMetadata(input?: { name?: string; content?: string }): {
  language: 'ejs-style' | 'text'; originalTags: string[]; suggestedOn?: 'before_model_request';
  placementRequired?: true; supported: boolean; diagnostics: Array<{code: string; stage: string}>; content: string;
}
export class PromptTemplateService {
  constructor(options: { storageDir: string; resources?: TemplateResource[]; getVariables?: (args: unknown) => unknown; worldBooks?: unknown })
  readonly id: 'tavern.prompt-templates'; readonly authority: 'local'; readonly strategyOwner: 'source';
  readonly optionCatalog: Record<string, unknown>;
  read(args: {id: string; scope?: {sessionId?: string; authority?: 'local'}; signal?: AbortSignal}): Record<string, unknown> | null;
  list(args?: {scope?: {sessionId?: string; authority?: 'local'}; signal?: AbortSignal}): Array<Record<string, unknown>>;
  validateConfig(config: Record<string, unknown>): void;
  update(args: {id: string; content: string; expectedRevision: string; operationId: string; scope?: {sessionId?: string; authority?: 'local'}; signal?: AbortSignal}): Record<string, unknown>;
  copy(args: {id: string; newId: string; scope?: {sessionId?: string; authority?: 'local'}; signal?: AbortSignal}): Record<string, unknown>;
  setManagementMode(args: {id: string; mode: 'native' | 'managed'; expectedRevision: string; operationId: string; scope?: {sessionId?: string; authority?: 'local'}; signal?: AbortSignal}): Record<string, unknown>;
  registerUsage(handler: (request: Record<string, unknown>) => unknown): () => void;
  observe(handler: (event: Record<string, unknown>) => void): () => void;
  resolve(context: SourceContext): Promise<SourceOutput>;
  validateResolved(context: SourceContext): void;
  dispose(): void;
}
