export interface ModuleContext {
  url: URL;
  host: string;
  path: string;
  screen: string;
  mode: string;
  bus: { emit<T>(t:string,p:T):void; on<T>(t:string,h:(p:T)=>void):()=>void };
  storage: { get<T>(k:string,d:T):Promise<T>; set<T>(k:string,v:T):Promise<void> };
  mount: (id?: string) => { root: ShadowRoot; host: HTMLElement; render: (html: string) => void; dispose: () => void };
}

export interface DsModule {
  id: string;
  when(ctx: ModuleContext): boolean;
  run(ctx: ModuleContext): void | Promise<void>;
}
