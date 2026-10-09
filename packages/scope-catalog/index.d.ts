export const SCOPE_CATALOG_SERVICE: 'tavernScopeCatalog'
export type ScopeField = 'characterId' | 'presetId' | 'userId'
export interface ScopeCatalog {
  readonly protocolVersion: 1; readonly authority: 'local';
  searchScopes(args: {field: ScopeField; query?: string; cursor?: string | null; limit?: number; scope?: {sessionId?: string}; signal?: AbortSignal}): Promise<{items: Array<{id:string;name:string}>;nextCursor:string|null}>;
  resolveScopeContext(args: {sessionId:string;signal?:AbortSignal}): Promise<{scope:{sessionId:string;characterId:string|null;presetId:string|null;userId:string|null};revision:string;checkCurrent:()=>boolean}>;
  dispose(): void;
}
export function createScopeCatalog(options: {sources:Record<ScopeField,{scopeMetadata():{items:Array<{id:string;name:string}>;generation:string;checkCurrent:()=>boolean}}>;
  getSelection:(sessionId:string)=>{characterCardId:string|null;presetId:string|null;userId:string|null};getSelectionRevision:(sessionId:string)=>unknown;getSession:(sessionId:string)=>unknown;
  isVisible?:(field:ScopeField,row:{id:string;name:string},scope:{sessionId?:string})=>boolean;getVisibilityRevision?:(scope:{sessionId?:string})=>unknown}): ScopeCatalog;
export function installScopeCatalog(ctx:unknown,catalog:ScopeCatalog): void;
