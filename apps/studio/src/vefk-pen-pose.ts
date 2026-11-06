/** Studio-only visualization of the canonical player's virtual quill.
 * It never changes the S1 geometry, S4 timing or site publication contract. */
type Point={x:number;y:number};
type Pen={position:Point;penDown:boolean;phase:string};
export type StudioPenPose={
  angleDeg:number;lift:number;contact:boolean;phase:string;
};
export function studioPenPose(pen:Pen,before:Point,after:Point):StudioPenPose{
  for(const point of [pen.position,before,after])if(
    !Number.isFinite(point.x)||!Number.isFinite(point.y)
  )throw new TypeError("Divit pozisyonu sonlu koordinatlar içermeli.");
  if(!["drawing","travel","ready","hold"].includes(pen.phase))
    throw new Error("Divit animasyon durumu geçersiz.");
  const dx=after.x-before.x,dy=after.y-before.y;
  const moving=Math.hypot(dx,dy)>.05;
  // The shaft leans behind motion; a stationary nib returns to a neutral pose.
  const angleDeg=moving
    ?Number((Math.atan2(dy,dx)*180/Math.PI+90).toFixed(2)):0;
  const contact=pen.penDown&&pen.phase==="drawing";
  return {
    angleDeg,lift:contact?0:pen.phase==="travel"?11:16,
    contact,phase:pen.phase,
  };
}
