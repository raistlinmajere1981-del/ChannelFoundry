// A hand-inked compass lock on the photographed Evren board. Coordinates
// belong to its 1536 x 1024 portrait, normalized to the rendered book host.
// Hover interaction and frame lifecycle are owned by object-overlay.mjs.
const TAU=Math.PI*2;
const clamp=x=>Math.max(0,Math.min(1,x));
export function sealTracePoint(u){
  const a=u*TAU-Math.PI*.53;
  // Projection follows the compass engraving of the real cover, not a
  // radial halo extending over its spine or printed title.
  return {x:.525+.118*Math.cos(a)+.015*Math.sin(a),
    y:.512+.095*Math.sin(a)+.008*Math.cos(a)};
}
export function createSealTrace({params}){
  let time=0,active=0,disposed=false;
  let interactionProgress=0;
  return {
    setProgress(value){
      const next=clamp(Number(value)||0);
      if(next===0&&interactionProgress>0)time=0;
      interactionProgress=next;
    },
    update(dt){if(!disposed)time=Math.min(30,time+Math.max(0,dt));},
    render(ctx,{width,height}={}){
      active=0;
      if(disposed||!interactionProgress||!(width>0&&height>0))return;
      const speed=params.speed??1;
      const phase=clamp(time*speed/2.7),opacity=params.opacity*interactionProgress;
      const line=Math.max(.55,Math.min(width,height)*.003*(params.stroke??1));
      // A quiet ink ring stays after the lock settles; the brighter thread
      // only travels until the first circuit completes.
      ctx.save();
      ctx.globalCompositeOperation='screen';
      const coordinates=u=>{const p=sealTracePoint(u);return [p.x*width,p.y*height];};
      const path=(start,end,steps)=>{
        ctx.beginPath();
        for(let i=0;i<=steps;i++){
          const [x,y]=coordinates(start+(end-start)*i/steps);
          if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);
        }
      };
      ctx.lineCap='round';ctx.lineJoin='round';
      path(0,1,100);
      ctx.lineWidth=line*.72;
      ctx.strokeStyle='rgba(204,166,98,'+(.14*opacity)+')';
      ctx.stroke();
      // The traveling filament is a short illuminated arc, not an
      // entire bright ring painted at once.
      const position=phase*.97;
      if(phase<1){
        ctx.lineWidth=line*1.4;
        ctx.strokeStyle='rgba(247,216,150,'+(.85*opacity)+')';
        ctx.shadowColor='#f9d18a';ctx.shadowBlur=Math.min(13,line*5);
        path(Math.max(0,position-.11),position,24);ctx.stroke();
        const [sx,sy]=coordinates(position);
        ctx.beginPath();ctx.arc(sx,sy,line*1.28,0,TAU);
        ctx.fillStyle='rgba(255,234,183,'+(.9*opacity)+')';ctx.fill();
      }
      // During the last third the cardinal points of the already engraved
      // compass meet in the middle, suggesting its seal has unlocked.
      if(phase>.65){
        const awaken=clamp((phase-.65)/.3)*opacity;
        const center={x:.53*width,y:.517*height};
        const rays=[[0,-.070],[.071,0],[0,.070],[-.071,0],[.047,-.042],[.04,.044],[-.046,.043],[-.046,-.043]];
        ctx.shadowBlur=Math.min(7,line*3);
        ctx.strokeStyle='rgba(232,195,128,'+(.44*awaken)+')';
        ctx.lineWidth=line*.65;
        for(const [dx,dy] of rays){
          ctx.beginPath();ctx.moveTo(center.x,center.y);
          ctx.lineTo(center.x+dx*width,center.y+dy*height);ctx.stroke();
        }
        ctx.beginPath();ctx.arc(center.x,center.y,line*.95,0,TAU);
        ctx.fillStyle='rgba(255,222,162,'+(.72*awaken)+')';ctx.fill();
      }
      ctx.restore();active=1;
    },
    inspect:()=>({type:'seal-trace',time,active,interactionProgress,disposed}),
    destroy(){disposed=true;active=0;},
  };
}
