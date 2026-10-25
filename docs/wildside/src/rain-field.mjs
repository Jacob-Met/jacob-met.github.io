/** Bounded, world-anchored imagined rain. Metres, seconds and +Y up.
 * The caller supplies the receiving world's top support and owns rendering.
 * Recreate the field when that world changes; support is cached per column.
 */
export const RAIN_FIELD = Object.freeze({
  cellsAcross:5, columnsPerCell:3, dropsPerColumn:3,
  fallSpeed:4, streakLength:.22, verticalSpacing:3,
  cellSize:Object.freeze({human:1.6,bird:2.4,insect:.35,overview:1.6}),
});

const modulo=(x,n)=>((x%n)+n)%n;
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const now=()=>globalThis.performance?.now?.()??Date.now();
const floatValue=new Float32Array(1),floatBits=new Uint32Array(floatValue.buffer);
function roundUp32(value){
 const rounded=Math.fround(value);
 if(rounded>=value)return rounded;
 floatValue[0]=rounded;floatBits[0]+=rounded>=0?1:-1;
 return floatValue[0];
}
// A column's location/phase depends only on its world cell, never on the camera.
function randomFor(x,z,column,salt){
 let n=Math.imul(x,0x1f123bb5)^Math.imul(z,0x5f356495)^Math.imul(column+1,0x6c8e9cf5)^salt;
 n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);
 return ((n^(n>>>16))>>>0)/4294967296;
}

export function createRainField({supportAt=()=>null,requireSupport=false,budget=240}={}){
 if(typeof supportAt!=='function'||typeof requireSupport!=='boolean'||!Number.isSafeInteger(budget)||budget<225||budget>240)
  throw new TypeError('Rain requires a support query and a 225–240 segment budget');
 let cache=new Map(),columns=[],selection=null;
 const positions=new Float32Array(budget*6);
 return {
  update({time,center,mode='human',cellSize=RAIN_FIELD.cellSize[mode],positions:output=positions}={}){
   if(!Number.isFinite(time)||time<0||!vector(center)||!center.every(v=>Number.isFinite(Math.fround(v)))||!Object.hasOwn(RAIN_FIELD.cellSize,mode)||
      !Number.isFinite(cellSize)||cellSize<.1||cellSize>1000||
      !(output instanceof Float32Array)||output.length<225*6)
    throw new TypeError('Invalid rain field input');
   const cx=Math.floor(center[0]/cellSize),cz=Math.floor(center[2]/cellSize);
   if(!Number.isSafeInteger(cx)||!Number.isSafeInteger(cz))throw new RangeError('Rain center is outside supported world coordinates');
   const nextSelection=`${cellSize}:${cx}:${cz}`;
   let supportQueries=0,supportQueryMs=0,refreshMs=0;
   if(selection!==nextSelection){
    const refreshStarted=now();
    const retained=new Map(),next=[];
    for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++)for(let i=0;i<3;i++){
     const xCell=cx+dx,zCell=cz+dz,key=`${cellSize}:${xCell}:${zCell}:${i}`;
     let column=cache.get(key);
     if(!column){
      // Keep columns inside their own cell so cells can enter/leave at the
      // outer edge without moving any of the shared precipitation.
      const x=Math.fround((xCell+.08+.84*randomFor(xCell,zCell,i,0x123abc))*cellSize);
      const z=Math.fround((zCell+.08+.84*randomFor(xCell,zCell,i,0x456def))*cellSize);
      let support,valid=true;supportQueries++;const queryStarted=now();
      try{support=supportAt(x,z);if(support!==null&&support!==undefined&&(!Number.isFinite(support)||!Number.isFinite(Math.fround(support))))valid=false;}
      catch{valid=false;}
      supportQueryMs+=Math.max(0,now()-queryStarted);
      if(support===null||support===undefined){if(requireSupport)valid=false;support=-Infinity;}
      column={x,z,support,valid,phase:randomFor(xCell,zCell,i,0x78abcd)*RAIN_FIELD.verticalSpacing};
     }
     retained.set(key,column);next.push(column);
    }
    cache=retained;columns=next;selection=nextSelection;
    refreshMs=Math.max(0,now()-refreshStarted);
   }
   let segments=0,rejectedColumns=0;
   const spacing=RAIN_FIELD.verticalSpacing;
   // Modulo before combining with world coordinates avoids an accumulating
   // subtraction of large elapsed times. Three adjacent lattice levels fall
   // continuously; replacement occurs 4.5 m above/below the chosen center.
   const advance=modulo(time,spacing/RAIN_FIELD.fallSpeed)*RAIN_FIELD.fallSpeed;
   for(const column of columns){
    if(!column.valid){rejectedColumns++;continue;}
    // A wide overview follows its actual receiving surfaces at each column.
    // A common map-center elevation would leave valleys/high ground dry.
    const levelCenter=mode==='overview'&&Number.isFinite(column.support)?column.support+1.62:center[1];
    const upper=levelCenter+spacing*1.5;
    const phase=modulo(column.phase-advance,spacing);
    const top=Math.floor((upper-phase)/spacing)*spacing+phase;
    for(let i=0;i<3;i++){
     const tip=top-i*spacing,tail=tip+RAIN_FIELD.streakLength;
     if(tail<=column.support)continue;
     // Evaluate support at the actual Float32 x/z above, then round a clipped
     // tip upward. Packing must not put a supported streak under its surface.
     const bottom=roundUp32(Math.max(tip,column.support)),end=Math.fround(tail);
     if(!Number.isFinite(bottom)||!Number.isFinite(end)||end<=bottom)continue;
     const at=segments*6;
     output[at]=column.x;output[at+1]=bottom;output[at+2]=column.z;
     output[at+3]=column.x;output[at+4]=end;output[at+5]=column.z;segments++;
    }
   }
   return {positions:output,segments,supportQueries,supportQueryMs,refreshMs,cachedColumns:cache.size,rejectedColumns};
  },
 };
}
