// Studio-only live composition guide. The old V4 hard-coded rectangles were
// captured from an obsolete concept image; these guides now derive from the
// current unsaved scene and current room presentation on every redraw.
export const COMPOSITION_FRAME=Object.freeze({width:1774,height:887,aspect:2});
export const COMPOSITION_MODES=Object.freeze(['off','focus','details','all']);
export const FOCUS_IDS=Object.freeze(['research-journal','community-journal','camera','vefk-stand']);
const focus=new Set(FOCUS_IDS);
export function validateCompositionGuide(guide){
  const ids=new Set();
  for(const box of guide){
    if(ids.has(box.id))throw Error('Tekrarlanan kompozisyon bölgesi: '+box.id);
    ids.add(box.id);
    if(!['x','y','width','height'].every(key=>Number.isFinite(box[key]))||
      box.x<0||box.y<0||box.width<=0||box.height<=0||
      box.x+box.width>1.000000001||box.y+box.height>1.000000001)
      throw Error('2:1 çalışma kadrajını aşan yerleşim bölgesi: '+box.id);
  }
  return guide;
}
export function compositionGuideForScene(scene,mode,{areaFor,visible=()=>true}={}){
  if(mode==='off')return [];
  if(!COMPOSITION_MODES.includes(mode))throw Error('Geçersiz plan görünümü: '+mode);
  if(typeof areaFor!=='function')throw Error('Anlık plan için nesne yerleşimi gerekli.');
  const result=[];
  for(const object of scene?.objects??[]){
    if(!visible(object)||object.visible===false)continue;
    if(mode==='focus'&&!focus.has(object.id))continue;
    if(mode==='details'&&focus.has(object.id))continue;
    const area=areaFor(object);
    if(!area)continue;
    result.push({id:object.id,label:object.name,
      x:area.x,y:area.y,width:area.width,height:area.height});
  }
  return validateCompositionGuide(result);
}
