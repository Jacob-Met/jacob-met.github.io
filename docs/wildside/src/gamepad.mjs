/** Gamepad input (standard mapping): left stick moves, right stick looks, A up, B down, Start opens Settings.
 * readPad() is pure so it can be tested; createGamepad() polls while a pad is connected. */
export const DEAD=.22,MOVE_ON=.35,LOOK_RATE=2.4;
const dz=v=>Math.abs(v)<DEAD?0:Math.sign(v)*(Math.abs(v)-DEAD)/(1-DEAD);
export function readPad(pad){
 const a=pad?.axes??[],b=i=>!!pad?.buttons?.[i]?.pressed,lx=a[0]??0,ly=a[1]??0;
 return {
  forward:ly<-MOVE_ON,back:ly>MOVE_ON,left:lx<-MOVE_ON,right:lx>MOVE_ON,
  up:b(0),down:b(1),start:b(9),
  lookX:dz(a[2]??0),lookY:dz(a[3]??0),
 };
}
const FLAGS=['forward','back','left','right','up','down'];
/** hooks: {touch (object the app reads for movement), look(dxRad,dyRad), canAct(), onStart(), wake()} */
export function createGamepad({touch,look,canAct=()=>true,onStart=()=>{},wake=()=>{},requestFrame=()=>{},getPads=()=>navigator.getGamepads?.()??[]}){
 let raf=0,last=0,startHeld=false,owned=new Set();
 const release=()=>{for(const k of owned)delete touch[k];owned.clear();};
 function step(now){
  raf=0;const dt=Math.min(.1,(now-(last||now))/1000);last=now;
  const pad=[...getPads()].find(p=>p&&p.connected);if(!pad){release();last=0;return;}
  const s=readPad(pad);
  if(s.start&&!startHeld){startHeld=true;wake();onStart();}else if(!s.start)startHeld=false;
  if(canAct()){
   let active=false;
   for(const k of FLAGS){if(s[k]){touch[k]=true;owned.add(k);active=true;}else if(owned.has(k)){delete touch[k];owned.delete(k);}}
   if(s.lookX||s.lookY){look(s.lookX*LOOK_RATE*dt,s.lookY*LOOK_RATE*dt);active=true;}
   if(active){wake();requestFrame();}
  }else release();
  raf=requestAnimationFrame(step);
 }
 const start=()=>{if(!raf)raf=requestAnimationFrame(step);};
 addEventListener('gamepadconnected',start);
 addEventListener('gamepaddisconnected',release);
 if([...getPads()].some(p=>p?.connected))start();
 return {stop(){if(raf)cancelAnimationFrame(raf);raf=0;release();}};
}
