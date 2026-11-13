// Web-equivalent contained room frame. This is the same 2:1 box used by
// .study-frame, with the full image preserved in the room phase.
export function roomFrameGeometry(width,height,aspect=2){
  if(![width,height,aspect].every(Number.isFinite)||width<=0||height<=0||aspect<=0)
    throw new RangeError('Screen dimensions and room aspect must be positive.');
  const frameWidth=Math.min(width,height*aspect);
  const frameHeight=frameWidth/aspect;
  return {
    screen:{width,height},room:{width:frameWidth,height:frameHeight,
      x:(width-frameWidth)/2,y:(height-frameHeight)/2},
    empty:{left:(width-frameWidth)/2,right:(width-frameWidth)/2,
      top:(height-frameHeight)/2,bottom:(height-frameHeight)/2},
    visibleFraction:1,scaleToScreen:frameWidth/width
  };
}
