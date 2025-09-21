type H = (p:any)=>void;
export class EventBus {
  private m = new Map<string, Set<H>>();
  on<T>(t:string,h:(p:T)=>void){ (this.m.get(t) ?? this.m.set(t,new Set()).get(t)!).add(h as H); return ()=>this.m.get(t)?.delete(h as H); }
  emit<T>(t:string,p:T){ this.m.get(t)?.forEach(h=>h(p)); }
}
