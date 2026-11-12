import { useEffect, useMemo, useState } from "react";

/** Main content editor: shared selection and image dock live in EditorialWorkspaceV3. */
type WorkspaceRelation = { key: string; runId: number; fromKey: string; toKey: string; label: string; sourceVideoIds: string[]; state: "draft" | "approved"; updatedAt: string };
type LegacyItem = StudioPersistedItem & { relatedCount: number };
type PropsBase = {
  onReload: () => Promise<void>;
  onStatus?: (message: string | null, tone?: "success" | "error") => void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
};
type WorkspaceProps = PropsBase & { node: StudioUniverseWorkspaceNode; relations: WorkspaceRelation[]; allNodes: StudioUniverseWorkspaceNode[] };
type LegacyProps = PropsBase & { item: LegacyItem; relations: StudioPersistedRelation[]; allItems: LegacyItem[] };
type EditorBridge = NonNullable<typeof window.channelFoundryStudio> & {
  universeWorkspaceUpdate(input: { key: string; name: string; summary: string; aliases: string[]; state: "draft" | "approved"; roles?: string[]; isMainCharacter?: boolean; storyNames?: string[]; characterNames?: string[]; locationNames?: string[]; objectNames?: string[] }): Promise<StudioUniverseWorkspaceNode>;
};
const kindLabels: Record<StudioUniverseWorkspaceNode["kind"], string> = { story: "Hikâye", character: "Muhatap", event: "Olay", location: "Mekân", object: "Nesne" };
const legacyLabels: Record<StudioPersistedItem["kind"], string> = { video: "Kayıt", character: "Muhatap", event: "Olay", file: "Dosya" };
const lines = (value: string) => value.split(/\r?\n|,/).map((entry) => entry.trim()).filter(Boolean);
const payloadArray = (node: StudioUniverseWorkspaceNode, key: string) => {
  const value = (node.payload as Record<string, unknown> | undefined)?.[key];
  return Array.isArray(value) ? value.map((entry) => String(entry ?? "").trim()).filter(Boolean) : [];
};
const detailArray = (node: StudioUniverseWorkspaceNode, key: "sequence" | "details") => {
  const raw = (node.payload as Record<string, unknown> | undefined)?.[key];
  return (Array.isArray(raw) ? raw : []).map((entry) => {
    if (!entry || typeof entry !== "object") return null;
    const row = entry as Record<string, unknown>;
    const text = String(row.text ?? "").trim();
    return text ? { text, sourceVideoIds: Array.isArray(row.sourceVideoIds) ? row.sourceVideoIds.map(String) : [] } : null;
  }).filter((entry): entry is { text: string; sourceVideoIds: string[] } => Boolean(entry));
};
function TextLines({ label, value, onChange, placeholder }: { label: string; value: string; onChange(value: string): void; placeholder?: string }) {
  return <label><span>{label}</span><textarea rows={3} placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)}/></label>;
}

export function WorkspaceRecordDetail({ node, onReload, onStatus, onDirtyChange, onBusyChange }: WorkspaceProps) {
  const bridge = window.channelFoundryStudio as EditorBridge | undefined;
  const [name, setName] = useState(node.name);
  const [summary, setSummary] = useState(node.summary);
  const [aliases, setAliases] = useState(node.aliases.join("\n"));
  const [roles, setRoles] = useState(payloadArray(node,"roles").join("\n"));
  const [main, setMain] = useState(Boolean(node.isMainCharacter));
  const [storyNames, setStoryNames] = useState(payloadArray(node,"storyNames").join("\n"));
  const [characterNames, setCharacterNames] = useState(payloadArray(node,"characterNames").join("\n"));
  const [locationNames, setLocationNames] = useState(payloadArray(node,"locationNames").join("\n"));
  const [objectNames, setObjectNames] = useState(payloadArray(node,"objectNames").join("\n"));
  const [state, setState] = useState<"draft" | "approved">(node.state);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setName(node.name);setSummary(node.summary);setAliases(node.aliases.join("\n"));
    setRoles(payloadArray(node,"roles").join("\n"));setMain(Boolean(node.isMainCharacter));
    setStoryNames(payloadArray(node,"storyNames").join("\n"));setCharacterNames(payloadArray(node,"characterNames").join("\n"));
    setLocationNames(payloadArray(node,"locationNames").join("\n"));setObjectNames(payloadArray(node,"objectNames").join("\n"));setState(node.state);
  }, [node.key,node.updatedAt]);
  const original = JSON.stringify([node.name,node.summary,node.aliases.join("\n"),payloadArray(node,"roles").join("\n"),Boolean(node.isMainCharacter),payloadArray(node,"storyNames").join("\n"),payloadArray(node,"characterNames").join("\n"),payloadArray(node,"locationNames").join("\n"),payloadArray(node,"objectNames").join("\n"),node.state]);
  const dirty = JSON.stringify([name,summary,aliases,roles,main,storyNames,characterNames,locationNames,objectNames,state])!==original;
  useEffect(()=>onDirtyChange?.(dirty),[dirty,onDirtyChange]);
  useEffect(()=>onBusyChange?.(busy),[busy,onBusyChange]);
  const sequence = useMemo(()=>{const list=detailArray(node,"sequence");return list.length?list:detailArray(node,"details");},[node]);
  const save = async()=>{
    if(!bridge||busy||!dirty)return;
    setBusy(true);onStatus?.(null);
    try {
      await bridge.universeWorkspaceUpdate({key:node.key,name:name.trim()||node.name,summary,aliases:lines(aliases),state,roles:lines(roles),...(node.kind==="character"?{isMainCharacter:main}:{}),storyNames:lines(storyNames),characterNames:lines(characterNames),locationNames:lines(locationNames),objectNames:lines(objectNames)});
      await onReload();onStatus?.("Kayıt kaydedildi.","success");
    }catch(e){onStatus?.(`Kayıt kaydedilemedi: ${e instanceof Error?e.message:String(e)}`,"error");}
    finally{setBusy(false);}
  };
  return <div className="record-v3-form">
    <header className="record-v3-heading"><div><small>{kindLabels[node.kind].toUpperCase()} · AI EVRENİ</small><h2>{node.name}</h2><span>{state==="approved"?"Onaylı":"İncelemede"} · {node.sourceVideoIds.length} kaynak</span></div><button className="primary-button" disabled={busy||!dirty} onClick={()=>void save()}>{busy?"Kaydediliyor…":dirty?"Kaydet *":"Kaydedildi"}</button></header>
    <section className="record-v3-section"><div className="record-v3-section-title">Kimlik ve özet</div><div className="record-v3-fields">
      <label><span>Başlık / ad</span><input value={name} onChange={event=>setName(event.target.value)}/></label>
      <label><span>Özet</span><textarea className="record-v3-summary" value={summary} onChange={event=>setSummary(event.target.value)}/></label>
      <div className="record-v3-duo"><TextLines label="Diğer adlar" value={aliases} onChange={setAliases} placeholder="Varsa alternatif isimler"/><label><span>Durum</span><select value={state} onChange={event=>setState(event.target.value as "approved"|"draft")}><option value="approved">Onaylı</option><option value="draft">Taslak / incelemede</option></select></label></div>
      {node.kind==="character"&&<><label className="record-v3-checkbox"><input type="checkbox" checked={main} onChange={event=>setMain(event.target.checked)}/><span>Ana karakter</span></label><TextLines label="Roller / türler" value={roles} onChange={setRoles}/></>}
    </div></section>
    {node.kind==="story"&&<details className="record-v3-section" open><summary>Anlatı akışı <span>{sequence.length} adım</span></summary><div className="record-v3-sequence">{sequence.map((entry,i)=><article key={i}><strong>{String(i+1).padStart(2,"0")}</strong><div><p>{entry.text}</p><small>{entry.sourceVideoIds.length} kaynak video</small></div></article>)}{!sequence.length&&<p className="record-v3-empty">Bu hikâyede henüz sıralı anlatı akışı yok.</p>}</div></details>}
    {node.kind!=="story"&&sequence.length>0&&<details className="record-v3-section"><summary>Kaynaklı notlar <span>{sequence.length}</span></summary><div className="record-v3-sequence">{sequence.map((entry,i)=><article key={i}><strong>{String(i+1).padStart(2,"0")}</strong><div><p>{entry.text}</p><small>{entry.sourceVideoIds.length} kaynak video</small></div></article>)}</div></details>}
    <details className="record-v3-section"><summary>Evren bağlamı <span>Hikâye · Muhatap · Mekân · Nesne</span></summary><div className="record-v3-fields">
      <TextLines label="Bağlı hikâyeler" value={storyNames} onChange={setStoryNames}/>
      {node.kind!=="character"&&<TextLines label="Muhataplar" value={characterNames} onChange={setCharacterNames}/>}
      <TextLines label="Mekânlar" value={locationNames} onChange={setLocationNames}/>
      <TextLines label="Nesneler" value={objectNames} onChange={setObjectNames}/>
    </div></details>
  </div>;
}

export function LegacyRecordDetail({item,onReload,onStatus,onDirtyChange,onBusyChange}:LegacyProps){
  const bridge=window.channelFoundryStudio;
  const [title,setTitle]=useState(item.title),[meta,setMeta]=useState(item.meta),[summary,setSummary]=useState(item.summary),[status,setStatus]=useState(item.status),[busy,setBusy]=useState(false);
  useEffect(()=>{setTitle(item.title);setMeta(item.meta);setSummary(item.summary);setStatus(item.status);},[item.key,item.title,item.meta,item.summary,item.status]);
  const dirty=title!==item.title||meta!==item.meta||summary!==item.summary||status!==item.status;
  useEffect(()=>onDirtyChange?.(dirty),[dirty,onDirtyChange]);
  useEffect(()=>onBusyChange?.(busy),[busy,onBusyChange]);
  const save=async()=>{if(!bridge||busy||!dirty)return;setBusy(true);onStatus?.(null);try{await bridge.saveItem({...item,title:title.trim()||item.title,meta,summary,status});await onReload();onStatus?.("Kayıt kaydedildi.","success");}catch(e){onStatus?.(`Kayıt kaydedilemedi: ${e instanceof Error?e.message:String(e)}`,"error");}finally{setBusy(false);}};
  return <div className="record-v3-form">
    <header className="record-v3-heading"><div><small>MANUEL {legacyLabels[item.kind].toUpperCase()}</small><h2>{item.title}</h2><span>{status==="published"?"Yayında":"Taslak"} · {item.relatedCount} bağlantı</span></div><button className="primary-button" disabled={busy||!dirty} onClick={()=>void save()}>{busy?"Kaydediliyor…":dirty?"Kaydet *":"Kaydedildi"}</button></header>
    <section className="record-v3-section"><div className="record-v3-section-title">Kayıt bilgileri</div><div className="record-v3-fields">
      <label><span>Başlık / ad</span><input value={title} onChange={event=>setTitle(event.target.value)}/></label>
      <label><span>Özet</span><textarea className="record-v3-summary" value={summary} onChange={event=>setSummary(event.target.value)}/></label>
      <div className="record-v3-duo"><label><span>Bağlam / tarih</span><input value={meta} onChange={event=>setMeta(event.target.value)}/></label><label><span>Durum</span><select value={status} onChange={event=>setStatus(event.target.value as StudioPersistedItem["status"])}><option value="draft">Taslak</option><option value="published">Yayında</option></select></label></div>
    </div></section>
  </div>;
}
