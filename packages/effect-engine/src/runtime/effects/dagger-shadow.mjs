// An almost-human dark reflection crosses a polished ceremonial blade.
// It is a single short event. The diagonal blade stencil is reinforced by a
// material alpha mask in the site, so no silhouette is ever cast onto the room.
export function createDaggerShadow({params}) {
  let elapsed=0,disposed=false,painted=false;
  const duration=()=>params.duration/params.speed;
  const complete=()=>disposed||elapsed>=duration();
  const clamp=x=>Math.max(0,Math.min(1,x));
  return {
    update(dt){if(!disposed)elapsed=Math.min(duration(),elapsed+Math.max(0,dt));},
    render(ctx,{width,height}){
      painted=false;
      if(complete()||width<=0||height<=0)return;
      const t=clamp(elapsed/duration());
      const envelope=Math.pow(Math.sin(Math.PI*t),1.3);
      if(envelope<=.003)return;
      const x=(.70-.60*t)*width, y=(.35+.50*t)*height;
      const unit=Math.min(width,height);
      const radius=Math.max(1,unit*.13*params.figureScale);
      ctx.save();
      // Approximate the photographed blade's taper; the PNG alpha stencil
      // attached to this Canvas provides the final pixel-accurate boundary.
      ctx.beginPath();
      ctx.moveTo(width*.48,height*.41);
      ctx.lineTo(width*.63,height*.51);
      ctx.lineTo(width*.08,height*.99);
      ctx.lineTo(width*.066,height*.965);
      ctx.closePath();
      ctx.clip();
      // A faint cool gleam outlines the moving reflection without lighting
      // the surrounding tabletop. No recognizable face or body detail.
      const edge=ctx.createRadialGradient(x,y,radius*.2,x,y,radius*2.1);
      edge.addColorStop(0,'rgba(129,151,160,0)');
      edge.addColorStop(.48,'rgba(111,133,146,.18)');
      edge.addColorStop(1,'rgba(92,119,133,0)');
      ctx.globalAlpha=params.opacity*envelope;
      ctx.fillStyle=edge;
      ctx.beginPath();ctx.ellipse(x,y,radius*2.1,radius*2.4,-.65,0,Math.PI*2);ctx.fill();
      // Distorted head and shoulder: reflected as a dark, vertically stretched
      // fragment, never a free-standing figure in front of the object.
      ctx.translate(x,y);ctx.rotate(-.67);
      ctx.scale(params.figureScale,1);
      const fill=ctx.createRadialGradient(0,0,radius*.15,0,0,radius*1.55);
      fill.addColorStop(0,'rgba(5,8,13,.94)');
      fill.addColorStop(.56,'rgba(9,13,19,.66)');
      fill.addColorStop(1,'rgba(13,17,23,0)');
      ctx.fillStyle=fill;
      ctx.beginPath();ctx.ellipse(0,-radius*.55,radius*.55,radius*.84,.08,0,Math.PI*2);ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-radius*.42,-radius*.18);
      ctx.quadraticCurveTo(-radius*1.18,radius*.13,-radius*.94,radius*1.55);
      ctx.quadraticCurveTo(0,radius*2.2,radius*.9,radius*1.55);
      ctx.quadraticCurveTo(radius*1.18,radius*.05,radius*.42,-radius*.18);
      ctx.closePath();ctx.fill();
      ctx.restore();
      painted=true;
    },
    isComplete:complete,
    inspect:()=>({type:'dagger-shadow',elapsed,painted,disposed,complete:complete()}),
    destroy(){disposed=true;painted=false;},
  };
}
