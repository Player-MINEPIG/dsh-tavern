import type { RequestSourceRegistry, SourceContext, SourceOutput } from '../request-assembler/index.js'
import type { TemplateResource, PromptTemplateService } from '../prompt-template/index.js'
export const MEMORY_SOURCE_SERVICE: 'tavernMemorySources'
export interface ResourceAccess { id: string; scope?: {sessionId?: string; authority?: 'local'}; signal?: AbortSignal }
export interface MemorySourceAdapter {
  readonly id: string; readonly name: string; readonly authority: 'local'; readonly strategyOwner: 'source';
  readonly optionCatalog: Record<string, unknown>;
  read(args: ResourceAccess): Record<string, unknown> | null;
  list(args?: Omit<ResourceAccess, 'id'>): Array<Record<string, unknown>>;
  validateConfig(config: Record<string, unknown>): void;
  setManagementMode(args: ResourceAccess & {mode: 'native' | 'managed'; expectedRevision: string; operationId: string}): Record<string, unknown>;
  registerUsage(handler: (request: Record<string, unknown>) => unknown): () => void;
  observe(handler: (event: Record<string, unknown>) => void): () => void;
  dispose(): void;
}
export interface MemorySources {
  protocolVersion: 1; adapters: MemorySourceAdapter[]; templates: PromptTemplateService;
  worldBooks: MemorySourceAdapter & { filter(context: SourceContext, output: SourceOutput): Promise<SourceOutput>; validateResolved(context: SourceContext): void; catalog(context:SourceContext): unknown[]; resolvePromptDependency(args:{id:string;context:SourceContext;event:Record<string,unknown>}): Promise<{id:string;adapterId:string;content:unknown;revision:string;configRevision:unknown;checkCurrent:()=>boolean}> };
  validateAssembly(assembly: unknown): void;
  observeRequest(request: unknown, session: unknown): void;
  dispose(): void;
}
export function createMemorySources(options: { storageDir: string; store: unknown; resources?: TemplateResource[]; characters?: unknown; getSelection?: (sessionId:string) => {worldBookIds:string[];characterId:string|null;selectionRevision:number}; resolveVariables?: (args: unknown) => unknown }): MemorySources
export function installMemorySources(ctx: unknown, service: MemorySources, registry: RequestSourceRegistry): void
