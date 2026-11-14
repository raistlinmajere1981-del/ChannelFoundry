// Reusable Studio inspector input primitives. The control is not tied to
// the scene model, history, publication or any global editor state.
import {el,field} from './dom.mjs';

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

export function numberInput(label,value,change,attrs={}){
  const input=el('input',{type:'number',value,...attrs,'aria-label':label+' hassas değer'});
  const min=Number(attrs.min),max=Number(attrs.max);
  const bounded=attrs.min!==undefined&&attrs.max!==undefined&&Number.isFinite(min)&&Number.isFinite(max)&&max>min;
  const step=Number(attrs.step)>0?Number(attrs.step):1;
  const precision=(String(step).split('.')[1]??'').length;
  const normalized=next=>{
    if(!Number.isFinite(next))return null;
    const value=bounded?clamp(next,min,max):next;
    return Number(value.toFixed(Math.min(8,precision+2)));
  };
  const commit=next=>{const valid=normalized(next);if(valid!==null)change(valid);};
  input.addEventListener('change',()=>commit(input.valueAsNumber));
  const slider=bounded?el('input',{type:'range',min,max,step,value:clamp(Number(value),min,max),
    'aria-label':label+' kaydırıcı',title:label+' · Fare ile kaydır, sayıyla hassaslaştır'}):null;
  if(slider){
    slider.addEventListener('input',()=>{input.value=slider.value;});
    slider.addEventListener('change',()=>commit(slider.valueAsNumber));
    input.addEventListener('input',()=>{if(Number.isFinite(input.valueAsNumber))slider.value=String(clamp(input.valueAsNumber,min,max));});
  }
  const wheelAdjust=event=>{
    event.preventDefault();
    const current=Number.isFinite(input.valueAsNumber)?input.valueAsNumber:Number(value);
    const factor=event.shiftKey ? 0.1 : event.altKey ? 10 : 1;
    const next=normalized(current+(event.deltaY<0?1:-1)*step*factor);
    if(next===null)return;
    input.value=String(next);
    if(slider)slider.value=String(next);
    commit(next);
  };
  input.addEventListener('wheel',wheelAdjust,{passive:false});
  slider?.addEventListener('wheel',wheelAdjust,{passive:false});
  return field(label,slider?el('div',{class:'scene-number-pair'},slider,input):input);
}

export function checkField(label,checked,change,attrs={}){
  return field(label,el('input',{type:'checkbox',checked,onchange:event=>change(event.target.checked),...attrs}));
}
