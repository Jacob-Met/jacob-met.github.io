/** Translate keyboard focus arrows into the existing pointer-drag frame.
 * Focus moves with the arrow, opposite the gesture moving the scene.
 * Each step is 72 CSS pixels, independent of display pixel density.
 */
export function overviewKeyboardDrag(code){
 switch(code){
  case 'ArrowLeft': return [72,0];
  case 'ArrowRight': return [-72,0];
  case 'ArrowUp': return [0,72];
  case 'ArrowDown': return [0,-72];
  default: return null;
 }
}

/** View-only focus offset in the overview's original XZ world coordinates.
 * No persistence, source interpretation or physical-navigation side effects.
 */
export function createOverviewPan(){
 let x=0,z=0;
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const limit=(bounds,zoom)=>{
  const width=Number(bounds?.max?.[0])-Number(bounds?.min?.[0]);
  const depth=Number(bounds?.max?.[2])-Number(bounds?.min?.[2]);
  if(!finite(width)||!finite(depth)||width<0||depth<0||!finite(zoom)||zoom<1)return [0,0];
  const fraction=(1-1/zoom)/2;
  return [width*fraction,depth*fraction];
 };
 const clamp=(value,bound)=>bound===0?0:Math.max(-bound,Math.min(bound,value));
 function position(bounds,zoom){
  const [limitX,limitZ]=limit(bounds,zoom);
  x=clamp(x,limitX);z=clamp(z,limitZ);
  return {x,z,limitX,limitZ};
 }
 function drag(dx,dy,{bounds,zoom,viewportHeight,fovDegrees=48,direction,distance}={}){
  const prev=position(bounds,zoom);
  if(![dx,dy,zoom,viewportHeight,fovDegrees,distance].every(finite)||
     zoom<=1||viewportHeight<=0||distance<=0||fovDegrees<=0||fovDegrees>=170||
     !Array.isArray(direction)||!finite(direction[0])||!finite(direction[2]))return false;
  const d=Math.hypot(direction[0],direction[2]);if(d<1e-8)return false;
  // Shift-drag and two-finger translation move the scene with the fingers.
  // Both gestures use the same world-space scale at the current magnification.
  const metresPerPixel=2*Math.tan(fovDegrees*Math.PI/360)*(distance/zoom)/viewportHeight;
  const rightX=direction[2]/d,rightZ=-direction[0]/d;
  const forwardX=direction[0]/d,forwardZ=direction[2]/d;
  x+=(-rightX*dx+forwardX*dy)*metresPerPixel;
  z+=(-rightZ*dx+forwardZ*dy)*metresPerPixel;
  position(bounds,zoom);
  return Math.abs(prev.x-x)>1e-9||Math.abs(prev.z-z)>1e-9;
 }
 return {position,drag,reset(){x=0;z=0;}};
}
