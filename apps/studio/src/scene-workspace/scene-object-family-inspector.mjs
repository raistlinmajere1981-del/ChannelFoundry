// Read-only physical object-family detail panel. It only consumes the
// validated report and never mutates scene objects or effect identities.
import {el} from './dom.mjs';
import {OBJECT_FAMILY_STAGES,OBJECT_PART_STATES} from './object-families-v4.mjs';

export function renderObjectFamilyInspector({parent,host,report,objectId}){
  if(!parent||!host)return;
  const entry=report?.entries.find(item=>item.id===objectId);
  parent.hidden=!entry;
  host.replaceChildren();
  if(!entry)return;
  host.append(el('div',{class:'scene-family-status','data-family-stage':entry.stage},
    el('strong',{text:OBJECT_FAMILY_STAGES[entry.stage]}),
    el('span',{text:entry.group+' · '+entry.parts.length+' fiziksel parça'})));
  for(const part of entry.parts){
    const line=el('div',{class:'scene-family-part','data-part-state':part.state},
      el('strong',{text:part.label}),
      el('span',{text:OBJECT_PART_STATES[part.state]}));
    if(part.detail)line.append(el('p',{text:part.detail}));
    if(part.asset)line.append(el('code',{text:part.asset}));
    host.append(line);
  }
  host.append(el('p',{class:'scene-family-summary',text:entry.effects.length+
    ' efekt · '+entry.enabledEffectCount+' etkin · '+entry.activeAnchors.length+' ankraj'}));
  host.append(el('p',{class:'scene-family-summary',text:'Ankrajlar: '+entry.activeAnchors.join(', ')}));
  if(entry.missingAnchors.length)host.append(el('p',{class:'scene-family-summary',title:'Henüz eklenmemiş ankrajlar',
    text:'Planlanan ankrajlar: '+entry.missingAnchors.join(', ')}));
  host.append(el('p',{class:'scene-family-summary',
    text:'Toplam '+report.entries.length+' nesne · '+report.counts.independent+
      ' bağımsız · '+report.counts.partial+' kısmi · '+report.counts['needs-art']+' görsel bekliyor'}));
}
