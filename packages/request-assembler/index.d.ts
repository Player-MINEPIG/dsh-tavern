import type {} from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' { interface Context { tavernRequestSources: RequestSourceRegistry } }

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type Role = 'preserve' | 'system' | 'user' | 'assistant'
export type Lifetime = 'request' | 'snapshot'
export type Stability = 'asset' | 'conversation' | 'evaluation' | 'assembly' | 'snapshot'
export interface Rule { id: string; kind: string; enabled: boolean; role: Role; lifetime: Lifetime; depth: number | null; text: string; name: string }
export interface Preset { format: 'dsh-tavern-request-assembly'; version: 1; name: string; placement: 'st' | 'modules'; rules: Rule[]; id?: string }
export interface NativeMessage { id: string; role: string; content: Array<{ type: string; [key: string]: unknown }>; source?: { kind?: string; [key: string]: unknown }; [key: string]: unknown }
/** Detached and deeply frozen at runtime. Resolvers must be read-only in both modes. */
export interface SourceContext {
  readonly sessionId: string; readonly turn: number | null; readonly step: number | null;
  readonly preview: boolean; readonly signal?: AbortSignal;
  readonly preset: Readonly<Preset>; readonly assets: Readonly<Record<string, unknown>>;
  readonly nativeMessages: readonly NativeMessage[]; readonly inputIds: readonly string[];
}
export interface Descriptor {
  id: string; pluginId: string; name: string; version: number; stability: Stability;
  dependencies: string[]; multiple: boolean; roles: Role[]; lifetimes: Lifetime[]; depth: boolean;
  generationRequiresPlugin: boolean; recordedContentSurvivesRemoval: true;
}
export interface BlockBase {
  id: string; name?: string; referenceOnly?: boolean; stability?: Stability;
  source?: { resourceId?: string; field?: string }; depth?: number; group?: string;
  children?: Json[];
}
export interface TextBlock extends BlockBase {
  type: 'text'; text: string; role?: Exclude<Role, 'preserve'>;
  /** Source-validated literal text inserted after ordinary macro expansion, without recursive evaluation. */
  literalMacros?: Record<string, string>;
  claims?: Array<{ sourceId: string; blockId: string }>;
  targetSourceId?: string;
}
export interface NativeBlock extends BlockBase { type: 'native'; messageIds: string[] }
export interface ReferenceBlock extends BlockBase {
  type: 'reference'; sourceId: string; blockIds?: string[];
  honorEnabled?: boolean; useOwnerRule?: boolean; lock?: boolean; owner?: string;
}
export interface SourceOutput { blocks: Array<TextBlock | NativeBlock | ReferenceBlock>; macros?: Record<string, string>; diagnostics?: Json[] }
export type SourceDefinition = Pick<Descriptor, 'id' | 'pluginId' | 'name'> & Partial<Omit<Descriptor, 'id' | 'pluginId' | 'name'>> & {
  resolve(context: SourceContext, rule: Readonly<Rule>): SourceOutput | Promise<SourceOutput>;
  /** Read-only synchronous lease check after all asynchronous sources have resolved. */
  validateResolved?(context: SourceContext): void;
}
export const ASSEMBLY_SERVICE: 'tavernRequestSources'
export const SOURCE_PROTOCOL_VERSION: 1
export class RequestSourceRegistry {
  readonly version: 1;
  register(source: SourceDefinition): () => void;
  list(): Descriptor[];
  resolve(context: SourceContext): Promise<unknown>;
  resolveSync(context: SourceContext): unknown;
}
export interface BuiltinSourceOptions { worldbookPolicy?(context: SourceContext, output: SourceOutput): SourceOutput | Promise<SourceOutput>; worldbookValidateResolved?(context: SourceContext): void }
export function registerBuiltinSources(registry: RequestSourceRegistry, options?: BuiltinSourceOptions): () => void
export function createDefaultRegistry(options?: BuiltinSourceOptions): RequestSourceRegistry
export interface AssemblyOptions {
  preset: Preset; registry?: RequestSourceRegistry; assets?: Record<string, unknown>;
  nativeMessages?: NativeMessage[]; inputIds?: string[]; previous?: AssemblyResult | null;
  snapshots?: unknown[]; maxBytes?: number; preview?: boolean;
  sessionId?: string; turn?: number; step?: number; signal?: AbortSignal;
}
export interface AssemblyResult { messages: NativeMessage[]; nodes: Array<Record<string, unknown>>; sources: Descriptor[]; snapshots: unknown[]; diagnostics: Json[]; [key: string]: unknown }
export function assembleRequest(options: AssemblyOptions): AssemblyResult
export function assembleRequestAsync(options: AssemblyOptions): Promise<AssemblyResult>
export function textOf(message: NativeMessage): string
export const FORMAT: 'dsh-tavern-request-assembly'
export const BUILTINS: readonly Preset[]
export function normalizePreset(value: unknown): Preset
