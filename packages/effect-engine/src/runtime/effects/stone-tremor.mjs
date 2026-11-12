// The photographed copper tray never moves. Its separate jade foreground
// only trembles after the canonical droplet reaches the rock surface.
export function createStoneTremor({params}) {
  let elapsed=0,disposed=false;
  const duration=params.duration;
  const impact=duration*.52;
  const angle=()=>{
    if(disposed||elapsed<=impact||elapsed>=duration)return 0;
    const t=elapsed-impact;
    const remaining=Math.max(0,(duration-elapsed)/(duration-impact));
    // Quick, shallow oscillation: no exaggerated swinging or looping.
    const envelope=Math.pow(remaining,2)*Math.exp(-params.damping*t);
    return params.amplitude*envelope*Math.sin(2*Math.PI*params.frequency*t);
  };
  return {
    update(dt){if(!disposed)elapsed=Math.min(duration,elapsed+Math.max(0,dt)*params.speed);},
    motion:()=>({angle:angle()}),
    isComplete:()=>disposed||elapsed>=duration,
    inspect:()=>({type:'stone-tremor',elapsed,angle:angle(),disposed}),
    destroy(){disposed=true;},
  };
}
