/** Wildside's own small residents as animals you can watch and become: the ground beetle, the water
 * strider and the orb-weaver. Each is a JS simulation with a steering seam (sim.steer); the driver
 * only steers and reads it back, so every rule of the wild individual still applies and its own art
 * draws it. See embody-creatures.mjs for the adapter contract. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const norm3=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);};
const yawOf=f=>Math.atan2(f[0],f[2]);   // simulation yaw (0 faces +Z) of a 3D forward vector
const present=state=>state&&state!=='unplaced';

/** `read()` returns {position, forward} in world space. `map(input)` turns keys into what sim.steer takes. */
export function steeredDriver({steer,release,read,map=input=>({forward:input.forward,turn:-input.right})}){
  let headYaw=0,headPitch=0,last=read().position.slice();
  return {
    look(dx,dy){headYaw=clamp(headYaw+dx,-2.2,2.2);headPitch=clamp(headPitch+dy,-1.2,1.2);},
    step(input,dt){
      steer(map(input));
      const now=read().position,moved=Math.hypot(now[0]-last[0],now[1]-last[1],now[2]-last[2]);last=now.slice();
      // the head recentres once you move on
      headYaw*=Math.exp(-dt*(Math.abs(input.forward)+Math.abs(input.right)>0?2.2:.3));
      return {ground:moved,air:0};
    },
    body:()=>null,
    gaze(){
      const r=read(),f=norm3(r.forward);
      return {body:r.position.slice(),yaw:Math.atan2(f[0],-f[2])+headYaw,pitch:clamp(Math.asin(clamp(f[1],-1,1))+headPitch,-1.3,1.3),bob:0};
    },
    dispose(){release();},
  };
}

export const RESIDENT_CREATURES=[
  {
    id:'beetle',name:'Ground beetle',article:'the beetle',kind:'insect',
    camera:{
      outside:{distance:.085,min:.035,max:.7,pitch:.3,height:.006,near:.002},
      shoulder:{back:.04,height:.018,side:.004,fov:62,near:.001},
      eyes:{ahead:.009,height:.006,fov:100,near:.0007},
    },
    controls:'W / S crawl · A / D turn · drag to look · V change view · Esc leave',
    locate({crawler}){
      const c=crawler?.snapshot().crawler;if(!c||!present(c.state))return null;
      return {position:c.position.slice(),yaw:yawOf(c.basis.forward),activity:c.state==='turning'?'avoiding an edge':c.state==='resting'?'resting':'walking',state:c.state};
    },
    canBecome:true,
    become({crawler}){
      if(!crawler)return null;
      return steeredDriver({steer:v=>crawler.steer(v),release:()=>crawler.steer(null),read:()=>{const c=crawler.snapshot().crawler;return {position:c.position,forward:c.basis.forward};}});
    },
  },
  {
    id:'skater',name:'Water strider',article:'the water strider',kind:'surface',
    camera:{
      outside:{distance:.2,min:.07,max:1.6,pitch:.35,height:.012,near:.003},
      shoulder:{back:.09,height:.04,side:.01,fov:62,near:.002},
      eyes:{ahead:.014,height:.014,fov:96,near:.001},
    },
    controls:'W skate · A / D turn · release to glide · drag to look · V change view · Esc leave',
    locate({pondSkater}){
      const k=pondSkater?.snapshot().skater;if(!k||!present(k.state))return null;
      return {position:k.position.slice(),yaw:k.yaw,activity:k.state==='rowing'?'skating':k.state,state:k.state};
    },
    canBecome:true,
    become({pondSkater}){
      if(!pondSkater)return null;
      const read=()=>{const k=pondSkater.snapshot().skater;return {position:k.position,forward:[Math.sin(k.yaw),0,Math.cos(k.yaw)]};};
      return steeredDriver({steer:v=>pondSkater.steer(v),release:()=>pondSkater.steer(null),read});
    },
  },
  {
    id:'spider',name:'Orb-weaver',article:'the orb-weaver',kind:'web',
    camera:{
      outside:{distance:.22,min:.07,max:1.6,pitch:.2,height:.01,near:.003},
      shoulder:{back:.1,height:.035,side:.01,fov:62,near:.002},
      eyes:{ahead:.014,height:.012,fov:96,near:.001},
    },
    controls:'W / S along the silk · A / D to a neighbouring strand · drag to look · V change view · Esc leave',
    locate({orbWeaver}){
      const w=orbWeaver?.snapshot(),sp=w?.spider;if(!w?.web||!sp||!present(sp.state))return null;
      return {position:sp.position.slice(),yaw:yawOf(sp.basis.forward),activity:sp.state.replaceAll('-',' '),state:sp.state};
    },
    canBecome:true,
    become({orbWeaver}){
      const web=orbWeaver?.getWeb();if(!web)return null;
      const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
      const read=()=>{const sp=orbWeaver.snapshot().spider;return {position:sp.position,forward:sp.basis.forward,side:sp.basis.right};};
      // W/S go the way it faces, A/D across it, in the plane of the web.
      const map=input=>{
        const r=read(),v=[0,1,2].map(i=>r.forward[i]*input.forward+r.side[i]*input.right);
        return [dot(v,web.right),dot(v,web.up)];
      };
      return steeredDriver({steer:d=>orbWeaver.steer(d),release:()=>orbWeaver.steer(null),read,map});
    },
  },
  {
    id:'flea',name:'Water flea',article:'the water flea',kind:'swimmer',
    camera:{
      outside:{distance:.022,min:.008,max:.25,pitch:.2,height:.0015,near:.0005},
      shoulder:{back:.011,height:.004,side:.002,fov:62,near:.0004},
      eyes:{ahead:.0022,height:.0008,fov:104,near:.0002},
    },
    controls:'W swim \u00b7 A / D turn \u00b7 E / Space rise \u00b7 Q sink \u00b7 drag to look \u00b7 V change view \u00b7 Esc leave',
    locate({submergedLife}){
      const w=submergedLife?.snapshot().swimmers[0];if(!w)return null;
      return {position:w.position.slice(),yaw:w.yaw,activity:w.state.replaceAll('-',' '),state:w.state};
    },
    canBecome:true,
    become({submergedLife}){
      if(!submergedLife?.snapshot().swimmers.length)return null;
      const read=()=>{const w=submergedLife.snapshot().swimmers[0];return {position:w.position,forward:[Math.sin(w.yaw),0,Math.cos(w.yaw)]};};
      return steeredDriver({steer:v=>submergedLife.steer(v),release:()=>submergedLife.steer(null),read,map:input=>({forward:input.forward,turn:-input.right,up:input.up})});
    },
  },
  {
    id:'salamander',name:'Salamander',article:'the salamander',kind:'crawler',
    camera:{
      outside:{distance:1.7,min:.6,max:9,pitch:.3,height:.1,near:.03},
      shoulder:{back:.9,height:.36,side:.05,fov:60,near:.02},
      eyes:{ahead:.44,height:.11,fov:96,near:.01},
    },
    controls:'W crawl \u00b7 A / D turn \u00b7 drag to look \u00b7 V change view \u00b7 Esc leave',
    locate({salamander}){
      const c=salamander?.snapshot().salamander;if(!c||!present(c.state))return null;
      return {position:c.position.slice(),yaw:c.yaw,activity:c.state==='turning'?'avoiding an edge':c.state,state:c.state};
    },
    canBecome:true,
    become({salamander}){
      if(!salamander)return null;
      const read=()=>{const c=salamander.snapshot().salamander;return {position:c.position,forward:[Math.sin(c.yaw),0,Math.cos(c.yaw)]};};
      return steeredDriver({steer:v=>salamander.steer(v),release:()=>salamander.steer(null),read});
    },
  },
];
