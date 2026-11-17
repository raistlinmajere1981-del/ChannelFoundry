// A single paint on a state change, not a frame-based visual effect.
// Repaint the corresponding wall area using very small per-row offsets.
// The robe's alpha silhouettes the refracted background so the hanger stays
// physically in the photograph when the separate robe image disappears.
export function drawRefractedSilhouette(canvas,room,mask,pose,distortionPx=2.2){
  if(!canvas||!room?.naturalWidth||!mask?.naturalWidth)return false;
  const ctx=canvas.getContext('2d',{alpha:true});
  if(!ctx)return false;
  const sourceW=room.naturalWidth,sourceH=room.naturalHeight;
  const w=Math.max(1,Math.min(1024,Math.round(pose.width*sourceW)));
  const h=Math.max(1,Math.min(1024,Math.round(pose.height*sourceH)));
  canvas.width=w;canvas.height=h;
  const sx=pose.x*sourceW,sy=pose.y*sourceH;
  const sw=pose.width*sourceW,sh=pose.height*sourceH;
  ctx.clearRect(0,0,w,h);
  if(distortionPx<=0)return true;
  const step=2;
  for(let y=0;y<h;y+=step){
    const row=Math.min(step,h-y);
    const shift=distortionPx*(.65*Math.sin(y*.046)+.35*Math.sin(y*.013+1.8));
    const cropX=Math.min(Math.max(0,sx+shift*sw/w),sourceW-sw);
    ctx.drawImage(room,cropX,sy+(y/h)*sh,sw,(row/h)*sh,0,y,w,row);
  }
  ctx.globalCompositeOperation='destination-in';
  ctx.drawImage(mask,0,0,w,h);
  ctx.globalCompositeOperation='source-over';
  return true;
}

// The contour belongs to the garment alpha, not to the refracted wall.
// Paint only its outer edge so zero distortion and zero fabric opacity can
// still leave an independently adjustable silhouette. No animation ticker.
export function drawRobeSilhouetteEdge(canvas,room,mask,pose,opacity){
  if(!canvas||!room?.naturalWidth||!mask?.naturalWidth)return false;
  const ctx=canvas.getContext('2d',{alpha:true,willReadFrequently:true});
  if(!ctx)return false;
  const w=Math.max(1,Math.min(1024,Math.round(pose.width*room.naturalWidth)));
  const h=Math.max(1,Math.min(1024,Math.round(pose.height*room.naturalHeight)));
  canvas.width=w;canvas.height=h;
  ctx.clearRect(0,0,w,h);
  if(opacity<=0)return true;
  ctx.drawImage(mask,0,0,w,h);
  const source=ctx.getImageData(0,0,w,h).data;
  const edge=ctx.createImageData(w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4;
    let alpha=source[i+3];
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const nx=x+dx,ny=y+dy;
      if(nx>=0&&nx<w&&ny>=0&&ny<h)
        alpha=Math.max(alpha,source[(ny*w+nx)*4+3]);
    }
    edge.data[i]=177;edge.data[i+1]=207;edge.data[i+2]=207;
    edge.data[i+3]=Math.round((alpha-source[i+3])*Math.min(1,opacity));
  }
  ctx.putImageData(edge,0,0);
  return true;
}
