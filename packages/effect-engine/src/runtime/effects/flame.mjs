import {between} from '../random.mjs';

const OUTER='#e8681d', MIDDLE='#ffb43c', CORE='#fff2b0';

// A layered, coherent flame: seeded phases give a stable character, while all
// motion is a smooth function of shared ticker time. No per-frame allocation.
export function createFlame({random, params}) {
  let enabled=params.enabled!==false, disposed=false, active=0, time=0;
  const phases=[random()*Math.PI*2,random()*Math.PI*2,random()*Math.PI*2];
  const lean=between(random,-1,1);
  function shape(ctx,width,height,layer){
    const baseX=width*.5,baseY=height*.98;
    const belly=width*(.235-layer*.046);
    // The envelope and luminous core follow the same draft; the wick stays fixed.
    const drift=Math.sin(time*2.1+phases[0])*.14+Math.sin(time*4.7+phases[1])*.055;
    const stretch=Math.sin(time*3.1+phases[2])*.031+Math.sin(time*5.3+phases[0])*.018;
    const tipX=baseX+width*(drift*params.sway+lean*.018)*(1-layer*.18);
    const tipY=height*(.07+layer*.17+stretch);
    ctx.beginPath();
    ctx.moveTo(baseX,baseY);
    ctx.bezierCurveTo(baseX-belly*1.4,height*.92,baseX-belly,height*.64,tipX,tipY);
    ctx.bezierCurveTo(tipX+belly*.07,height*.44,baseX+belly*1.75,height*.82,baseX,baseY);
    ctx.closePath();
  }
  return {
    update(dt){
      if(!enabled||disposed)return;
      time=(time+Math.max(0,dt)*params.speed)%3600;
    },
    render(ctx,frame={}){
      active=0;
      if(!enabled||disposed)return;
      const width=frame.width??ctx.canvas?.width??1;
      const height=frame.height??ctx.canvas?.height??1;
      if(width<=0||height<=0)return;
      ctx.save();
      ctx.globalCompositeOperation='lighter';
      for(const [layer,color,alpha] of [[0,OUTER,.34],[1,MIDDLE,.42],[2,CORE,.72]]){
        ctx.globalAlpha=Math.min(1,params.opacity*alpha);
        ctx.fillStyle=color;
        shape(ctx,width,height,layer);
        ctx.fill();
      }
      ctx.restore();
      active=1;
    },
    inspect:()=>({type:'flame',enabled,disposed,active,time,phases:[...phases],lean}),
    destroy(){disposed=true;active=0;},
  };
}
