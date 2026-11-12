// Single droplet + restrained impact tremor. The photographed stone is the
// original source of truth; moving the actual stone will use a future isolated
// foreground asset. This finite layer produces no perpetual ticker load.
export function createStoneDrop({params}) {
  let elapsed=0,disposed=false,phase='waiting';
  const duration=()=>params.duration/params.speed;
  const complete=()=>disposed||elapsed>=duration();
  const clamp=v=>Math.max(0,Math.min(1,v));
  return {
    update(dt) {
      if(!disposed)elapsed=Math.min(duration(),elapsed+Math.max(0,dt));
    },
    render(ctx,{width,height}) {
      if(complete()||!(width>0&&height>0))return;
      const t=clamp(elapsed/duration());
      const impact=.52,fallStart=.12;
      const cx=width*.5,cy=height*.58;
      const unit=Math.min(width,height);
      const dropletRadius=Math.max(.7,unit*.075*params.dropSize);
      ctx.save();
      ctx.globalAlpha=params.opacity;
      if(t<impact&&t>=fallStart){
        phase='falling';
        const fall=clamp((t-fallStart)/(impact-fallStart));
        const easing=fall*fall;
        const y=cy-height*.73*(1-easing);
        ctx.fillStyle='#c7d6d6';
        ctx.beginPath();ctx.ellipse(cx,y,dropletRadius*.62,dropletRadius*1.12,0,0,Math.PI*2);ctx.fill();
        ctx.globalAlpha*=.7;
        ctx.strokeStyle='#f4f5ec';ctx.lineWidth=Math.max(.6,dropletRadius*.15);
        ctx.beginPath();ctx.moveTo(cx-dropletRadius*.17,y-dropletRadius*.6);
        ctx.lineTo(cx-dropletRadius*.25,y-dropletRadius*.12);ctx.stroke();
      }else if(t>=impact){
        phase='impact';
        const after=clamp((t-impact)/(1-impact));
        const fade=Math.pow(1-after,1.45);
        // The dark wet contact mark stays in the photographed rock boundary.
        ctx.globalAlpha=params.opacity*.27*fade;
        ctx.fillStyle='#1b272b';
        ctx.beginPath();ctx.ellipse(cx,cy,unit*(.035+after*.05)*params.dropSize,
          unit*(.012+after*.025)*params.dropSize,0,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#b9c9c7';
        ctx.lineWidth=Math.max(.6,unit*.008);
        for(let i=0;i<2;i++){
          const ring=after-i*.16;
          if(ring<=0||ring>=1)continue;
          ctx.globalAlpha=params.opacity*.4*fade*(1-ring);
          ctx.beginPath();ctx.ellipse(cx,cy,unit*(.025+ring*.22),
            unit*(.014+ring*.08),0,0,Math.PI*2);ctx.stroke();
        }
        // Alternating subpixel highlights imply a short, damped vibration.
        // A physically displaced silhouette is deliberately left to the
        // separate stone foreground image instead of faking the room plate.
        const tremor=Math.sin(after*42)*Math.pow(1-after,2)*params.tremor;
        if(Math.abs(tremor)>.004){
          ctx.globalAlpha=params.opacity*Math.min(.35,Math.abs(tremor)*.5)*fade;
          ctx.strokeStyle='#c2c5b8';
          ctx.lineWidth=Math.max(.5,unit*.005);
          ctx.beginPath();
          const x=cx+unit*tremor*.09;
          ctx.moveTo(x-unit*.27,cy+unit*.09);
          ctx.lineTo(x-unit*.1,cy+unit*.11);
          ctx.moveTo(x+unit*.14,cy+unit*.08);
          ctx.lineTo(x+unit*.25,cy+unit*.065);
          ctx.stroke();
        }
      }else phase='waiting';
      ctx.restore();
    },
    isComplete:complete,
    inspect:()=>({type:'stone-drop',elapsed,phase,disposed,complete:complete()}),
    destroy(){disposed=true;phase='disposed';},
  };
}
