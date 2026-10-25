/** A bounded view-only magnification, never saved as a place, source, or visit. */
export function createOverviewZoom({maximum=8}={}) {
  if(!Number.isFinite(maximum)||maximum<=1)throw new TypeError('Invalid overview zoom limit');
  let factor=1;
  const set=value=>{
    if(Number.isFinite(value)&&value>0)factor=Math.max(1,Math.min(maximum,value));
    return factor;
  };
  return Object.freeze({
    value:()=>factor,
    reset:()=>set(1),
    step:direction=>Number.isFinite(direction)?set(factor*Math.pow(1.25,Math.sign(direction))):factor,
    wheel:(deltaY,mode=0)=>{
      if(!Number.isFinite(deltaY)||![0,1,2].includes(mode))return factor;
      const pixels=deltaY*(mode===1?16:mode===2?400:1);
      return set(factor*Math.exp(-Math.max(-500,Math.min(500,pixels))*.0015));
    },
    pinch:(previous,next)=>{
      if(!Number.isFinite(previous)||!Number.isFinite(next)||previous<=0||next<=0)return factor;
      return set(factor*(next/previous));
    },
  });
}
