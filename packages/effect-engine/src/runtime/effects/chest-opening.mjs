// Synchronized finite chest motion and light. No idle ticker or new 3D engine.
const clamp = x => Math.max(0,Math.min(1,x));
export function chestPulseProgress(elapsed,params){
  const total=params.duration/params.speed;
  if(elapsed<=0||elapsed>=total)return 0;
  const t=clamp(elapsed/total),open=.24,hold=Math.min(.56,Math.max(0,params.hold));
  if(t<open){const u=t/open;return u*u*(3-2*u);}
  if(t<open+hold)return 1;
  const u=clamp((t-open-hold)/(1-open-hold));
  return 1-(u*u*(3-2*u));
}
export function createChestLid({params}){
  let elapsed=0,disposed=false;
  const total=()=>params.duration/params.speed;
  const complete=()=>disposed||elapsed>=total();
  const progress=()=>disposed?0:chestPulseProgress(elapsed,params);
  return {
    update(dt){if(!disposed)elapsed=Math.min(total(),elapsed+Math.max(0,dt));},
    motion:()=>{const p=progress();return {angle:0,tilt:p?-params.openAngle*p:0};},
    isComplete:complete,
    inspect:()=>({type:'chest-lid-open',elapsed,progress:progress(),disposed}),
    destroy(){disposed=true;},
  };
}
export function createChestLight({params}){
  let elapsed=0,disposed=false,painted=false;
  const total=()=>params.duration/params.speed;
  const complete=()=>disposed||elapsed>=total();
  const progress=()=>disposed?0:chestPulseProgress(elapsed,params);
  return {
    update(dt){if(!disposed)elapsed=Math.min(total(),elapsed+Math.max(0,dt));},
    render(ctx,{width,height}){
      painted=false;
      const intensity=progress()*params.opacity;
      if(complete()||intensity<.003||width<=0||height<=0)return;
      ctx.save();
      // The authored interior-light mask covers the upper half of the square chest
      // material. Paint in that aperture, not below its masked boundary.
      const centerX=width*.5,centerY=height*.44,span=Math.max(1,width*.43*params.spread);
      const halo=ctx.createRadialGradient(centerX,centerY,0,centerX,centerY,span*1.75);
      halo.addColorStop(0,'rgba(255,215,118,'+(.96*intensity)+')');
      halo.addColorStop(.36,'rgba(245,160,57,'+(.60*intensity)+')');
      halo.addColorStop(1,'rgba(191,94,33,0)');
      ctx.fillStyle=halo;
      ctx.fillRect(0,0,width,height);
      ctx.strokeStyle='rgba(255,201,110,'+(.75*intensity)+')';
      ctx.lineWidth=Math.max(.6,height*.008*params.spread);
      ctx.beginPath();ctx.moveTo(width*.10,centerY);ctx.lineTo(width*.9,centerY);ctx.stroke();
      ctx.restore();
      painted=true;
    },
    isComplete:complete,
    inspect:()=>({type:'chest-light-leak',elapsed,progress:progress(),painted,disposed}),
    destroy(){disposed=true;painted=false;},
  };
}
