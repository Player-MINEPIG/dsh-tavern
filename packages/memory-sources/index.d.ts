import type { RequestSourceRegistry, SourceContext, SourceOutput } from 'dsh-prompt-assembler'
import type { TemplateResource, PromptTemplateService } from '../prompt-template/index.js'
export const MEMORY_SOURCE_SERVICE: 'tavernMemorySources'
export interface ResourceAccess { id: string; scope?: {sessionId?: string; authority?: 'local'}; signal?: AbortSignal }
export interface SourceManagementDefaults {
  protocolVersion: 1; revision: string; configuration: {type: string; store?: Record<string, unknown>; retrieve?: Record<string, unknown>};
  scopePolicy: 'source-bound'; checkCurrent(): boolean;
}
export interface BoundResourceMetadata {
  readonly id: string; readonly adapterId: string; readonly name: string; readonly type: 'world-book' | 'prompt-template' | 'mvu-state';
  readonly revision: string | number; readonly managementMode: 'native' | 'managed'; readonly enabled?: boolean; readonly sourceError?: string;
  readonly binding: Readonly<{sessionId: string; kind: string; characterId?: string; templateId?: string; instanceCreatedAt?: string | number; origins?: readonly string[]; presetId?: string; userId?: string}>;
}
export interface BoundResourceSnapshot { readonly items: readonly BoundResourceMetadata[]; readonly revision: string; readonly checkCurrent: () => boolean }
export interface BoundResourceRequest { scope: {sessionId: string; authority?: 'local'}; signal?: AbortSignal }
export interface MemorySourceAdapter {
  readonly id: string; readonly name: string; readonly authority: 'local'; readonly strategyOwner: 'source';
  readonly optionCatalog: Record<string, unknown>;
  read(args: ResourceAccess): Record<string, unknown> | null;
  list(args?: Omit<ResourceAccess, 'id'>): Array<Record<string, unknown>>;
  listBound(args: BoundResourceRequest): BoundResourceSnapshot;
  validateConfig(config: Record<string, unknown>): void;
  setManagementMode(args: ResourceAccess & {mode: 'native' | 'managed'; expectedRevision: string; operationId: string}): Record<string, unknown>;
  getManagementDefaults(args: Omit<ResourceAccess, 'signal'>): SourceManagementDefaults | null;
  registerUsage(handler: (request: Record<string, unknown>) => unknown, options?: {providerId: 'dsh-memory-manager'}): () => void;
  observe(handler: (event: Record<string, unknown>) => void): () => void;
  dispose(): void;
}
export interface MemorySources {
  protocolVersion: 1; adapters: MemorySourceAdapter[]; templates: PromptTemplateService;
  listBound(args: BoundResourceRequest): Promise<BoundResourceSnapshot>;
  worldBooks: MemorySourceAdapter & { filter(context: SourceContext, output: SourceOutput): Promise<SourceOutput>; validateResolved(context: SourceContext): void; catalog(context:SourceContext): unknown[]; resolvePromptDependency(args:{id:string;context:SourceContext;event:Record<string,unknown>}): Promise<{id:string;adapterId:string;content:unknown;revision:string;configRevision:unknown;checkCurrent:()=>boolean}> };
  validateAssembly(assembly: unknown): void;
  observeRequest(request: unknown, session: unknown): void;
  dispose(): void;
}
export function createMemorySources(options: { storageDir: string; store: unknown; resources?: TemplateResource[]; characters?: unknown;
  getSelection?: (sessionId:string) => {worldBookIds:string[];characterId:string|null;selectionRevision:number|string}; getSession?: (sessionId:string) => unknown;
  getMvu?: () => {listBound(args:BoundResourceRequest):BoundResourceSnapshot|Promise<BoundResourceSnapshot>; resolvePromptDependency?(args:import('../mvu-adapter/src/prompt-dependency.js').MvuPromptDependencyRequest):Promise<import('../mvu-adapter/src/prompt-dependency.js').MvuPromptDependencyResult|null>}|undefined; resolveVariables?: (args: unknown) => unknown }): MemorySources
export function installMemorySources(ctx: unknown, service: MemorySources, registry: RequestSourceRegistry): void
