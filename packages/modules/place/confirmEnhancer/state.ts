// packages/modules/place/confirmEnhancer/state.ts
export type ConfirmState = {
  autoSendEnabled: boolean;
  sendTimeInit: boolean;
};

export function makeState(storage: {get<T>(k:string, d:T):Promise<T>, set<T>(k:string,v:T):Promise<void>}) {
  const KEY = 'confirm_state';
  let s: ConfirmState = { autoSendEnabled: false, sendTimeInit: false };

  return {
    async load() {
      const v = await storage.get<ConfirmState>(KEY, s);
      s = { autoSendEnabled: !!v.autoSendEnabled, sendTimeInit: !!v.sendTimeInit };
    },
    get() { return s; },
    async set(p: Partial<ConfirmState>) { s = { ...s, ...p }; await storage.set(KEY, s); },
    async setAndSave(p: Partial<ConfirmState>) { await this.set(p); }
  };
}
