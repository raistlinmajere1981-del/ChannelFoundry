import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';

type Handler={dirty:boolean;busy:boolean;save:()=>Promise<void>;revert:()=>void};
type Snapshot={dirty:string[];busy:string[];saving:boolean;notice:string;error:string};
type Manager={register:(id:string,handler:Handler)=>()=>void;sync:()=>void;saveAll:()=>Promise<void>;revertAll:()=>void;state:Snapshot};
const SettingsContext=createContext<Manager|null>(null);
export const SETTINGS_DIRTY_KEY='channel-foundry:settings-unsaved';
export const SETTINGS_BUSY_KEY='channel-foundry:settings-busy';

export function SettingsController({children}:{children:ReactNode}){
  const handlers=useRef(new Map<string,Handler>());
  const [state,setState]=useState<Snapshot>({dirty:[],busy:[],saving:false,notice:'',error:''});
  const sync=useCallback(()=>{
    const values=Array.from(handlers.current);
    const dirty=values.filter(([,handler])=>handler.dirty).map(([id])=>id);
    const busy=values.filter(([,handler])=>handler.busy).map(([id])=>id);
    setState(prev=>{
      if(JSON.stringify(prev.dirty)===JSON.stringify(dirty)&&JSON.stringify(prev.busy)===JSON.stringify(busy))return prev;
      return {...prev,dirty,busy,notice:dirty.length?'':prev.notice};
    });
    sessionStorage.setItem(SETTINGS_DIRTY_KEY,dirty.length?'1':'0');
    sessionStorage.setItem(SETTINGS_BUSY_KEY,busy.length?'1':'0');
  },[]);
  const register=useCallback((id:string,handler:Handler)=>{
    handlers.current.set(id,handler);sync();
    return()=>{if(handlers.current.get(id)===handler){handlers.current.delete(id);sync();}};
  },[sync]);
  const saveAll=useCallback(async()=>{
    if(Array.from(handlers.current.values()).some(handler=>handler.busy))return;
    setState(prev=>({...prev,saving:true,notice:'',error:''}));
    const done:string[]=[];
    try{
      // Ordered partial commit. Existing secure credentials and SQLite-backed stores
      // are not moved into a shared, unsafe transaction or plaintext form.
      for(const [id,handler] of handlers.current){
        if(!handler.dirty)continue;
        await handler.save();done.push(id);
      }
      setState(prev=>({...prev,notice:done.length?`${done.length} bölüm kaydedildi.`:'Değişiklik yok.'}));
    }catch(error){
      const reason=error instanceof Error?error.message:String(error);
      setState(prev=>({...prev,error:`${done.length?done.join(', ')+' kaydedildi; ':''}${reason}`}));
    }finally{setState(prev=>({...prev,saving:false}));sync();}
  },[sync]);
  const revertAll=useCallback(()=>{
    if(Array.from(handlers.current.values()).some(handler=>handler.busy))return;
    for(const handler of handlers.current.values())if(handler.dirty)handler.revert();
    setState(prev=>({...prev,notice:'Kaydedilmemiş değişikliklerden vazgeçildi.',error:''}));
    sync();
  },[sync]);
  useEffect(()=>{
    const onUnload=(event:BeforeUnloadEvent)=>{
      if(sessionStorage.getItem(SETTINGS_DIRTY_KEY)==='1'||sessionStorage.getItem(SETTINGS_BUSY_KEY)==='1'){
        event.preventDefault();event.returnValue='';
      }
    };
    window.addEventListener('beforeunload',onUnload);
    return()=>{window.removeEventListener('beforeunload',onUnload);sessionStorage.removeItem(SETTINGS_DIRTY_KEY);sessionStorage.removeItem(SETTINGS_BUSY_KEY);};
  },[]);
  const value=useMemo(()=>({register,sync,saveAll,revertAll,state}),[register,sync,saveAll,revertAll,state]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
export function useSettingsManager(){return useContext(SettingsContext);}
export function useSettingsSection(id:string,dirty:boolean,busy:boolean,save:()=>Promise<void>,revert:()=>void){
  const manager=useSettingsManager();
  const handler=useRef<Handler>({dirty,busy,save,revert});
  handler.current={dirty,busy,save,revert};
  useEffect(()=>{
    if(!manager)return;
    // Stable registration even when an editor changes its callbacks.
    const proxy:Handler={get dirty(){return handler.current.dirty;},get busy(){return handler.current.busy;},save:()=>handler.current.save(),revert:()=>handler.current.revert()};
    return manager.register(id,proxy);
  },[manager?.register,id]);
  useEffect(()=>{manager?.sync();},[manager?.sync,id,dirty,busy]);
  return Boolean(manager);
}
