const claims=new WeakSet();

// A motion target is exactly one declared full-object-coordinate child.
export function bindMotionLayer(host,effect) {
  const matches=[...host.children].filter(child=>child.dataset?.effectLayer===effect.layerId);
  if(matches.length!==1)throw new Error('Motion layer missing or ambiguous: '+effect.objectId+'/'+effect.layerId);
  const element=matches[0];
  if(claims.has(element))throw new Error('Motion layer already bound');
  claims.add(element);
  const origin=element.style.transformOrigin,rotate=element.style.rotate,transform=element.style.transform;
  element.style.transformOrigin=((effect.anchor.x+effect.offset.x)*100)+'% '+((effect.anchor.y+effect.offset.y)*100)+'%';
  return {
    connected:()=>element.parentElement===host&&element.isConnected,
    apply({angle=0,tilt}) {
      element.style.rotate=angle+'deg';
      if(Number.isFinite(tilt)){
        // The rear hinge is already supplied by transformOrigin in canonical
        // object coordinates. Pure 3D rotation keeps this pivot stationary;
        // scaling the lid used to stretch the timber and cancel front-edge lift.
        element.style.transform='perspective(700px) rotateX('+tilt+'deg)';
      }
    },
    reset(){element.style.rotate=rotate;element.style.transform=transform;},
    destroy(){element.style.rotate=rotate;element.style.transform=transform;element.style.transformOrigin=origin;claims.delete(element);},
  };
}
