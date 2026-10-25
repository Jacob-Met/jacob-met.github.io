const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const source=process.argv[2]||require('node:path').join(__dirname,'lobby-journey.js');
const raw=fs.readFileSync(source,'utf8');const make=vm.runInNewContext(raw+';createLobbyJourney');
const routes=['engine','hackathons','projects'];let count=0;const failures=[];
function setup(){let progress,reduce=false;const clips=[],arrivals=[],states=[];const h=make({routes,readProgress:()=>progress,reduceMotion:()=>reduce,play(c,done,failed){clips.push({...c,done,failed})},onState:s=>states.push(s),onArrive:id=>arrivals.push(id)});return{h,clips,arrivals,states,progress:p=>progress=p,reduce:v=>reduce=v}}
function check(name,fn){try{fn();count++}catch(e){failures.push({name,error:e.message})}}
for(const route of routes){
 check(route+' direct anchor has still/content without autoplay',()=>{const x=setup();x.h.jump(route);assert.equal(x.clips.length,0);assert.equal(x.h.getState().route,route);assert.deepEqual(x.arrivals,[route])});
 check(route+' repeated click does not duplicate playback',()=>{const x=setup();x.h.navigate(route);x.h.navigate(route);assert.equal(x.clips.length,1);x.clips[0].done();x.h.navigate(route);assert.deepEqual(x.arrivals,[route])});
 check(route+' reduced motion and skip stay at intended destination',()=>{const x=setup();x.h.navigate(route);const stale=x.clips[0];x.reduce(true);x.h.jump(route);stale.done();stale.failed();assert.deepEqual(x.arrivals,[route]);assert.equal(x.h.getState().target,route)});
 for(const other of routes.filter(r=>r!==route)){
  check(route+' to '+other+' transfers through entrance without false arrival',()=>{const x=setup();x.h.jump(route);x.h.navigate(other);assert.equal(x.clips[0].route,route);assert.equal(x.clips[0].direction,'reverse');x.clips[0].done();assert.equal(x.clips[1].route,other);assert.equal(x.clips[1].direction,'forward');assert.equal(x.clips[1].progress,0);assert.deepEqual(x.arrivals,[route]);x.clips[1].done();assert.deepEqual(x.arrivals,[route,other])});
  check(route+' to '+other+' failed reverse reaches target fallback',()=>{const x=setup();x.h.jump(route);x.h.navigate(other);const old=x.clips[0];old.failed();old.done();assert.equal(x.h.getState().route,other);assert.deepEqual(x.arrivals,[route,other])});
  for(const p of [0,.05,.35,.9,1]){
   check(route+' interrupted at '+p+' for '+other,()=>{const x=setup();x.h.navigate(route);const obsolete=x.clips[0];x.progress(p);x.h.navigate(other);const last=x.clips.at(-1);assert.equal(last.route,p===0?other:route);assert.equal(last.direction,p===0?'forward':'reverse');if(p>0){assert.equal(last.progress,p);last.done();assert.equal(x.clips.at(-1).route,other)}obsolete.done();obsolete.failed();assert.deepEqual(x.arrivals,[]);x.clips.at(-1).done();assert.deepEqual(x.arrivals,[other]);assert.equal(x.h.getState().route,other)});
  }
  const third=routes.find(r=>r!==route&&r!==other);
  check(route+' transfer from '+other+' superseded by '+third,()=>{const x=setup();x.h.jump(route);x.h.navigate(other);const old=x.clips.at(-1);x.progress(.4);x.h.navigate(third);const reverse=x.clips.at(-1);assert.equal(reverse.route,route);assert.equal(reverse.direction,'reverse');assert.equal(reverse.progress,.4);old.done();old.failed();assert.deepEqual(x.arrivals,[route]);reverse.done();assert.equal(x.clips.at(-1).route,third);x.clips.at(-1).done();assert.deepEqual(x.arrivals,[route,third]);assert.ok(!x.arrivals.includes(other))});
  check(route+' return transfer resumes original route continuously',()=>{const x=setup();x.h.jump(route);x.h.navigate(other);const old=x.clips.at(-1);x.progress(.3);x.h.navigate(route);const resumed=x.clips.at(-1);assert.equal(resumed.route,route);assert.equal(resumed.direction,'forward');assert.equal(resumed.progress,.3);old.done();old.failed();resumed.done();assert.deepEqual(x.arrivals,[route,route])});
 }
}
console.log(JSON.stringify({source,sourceSha256:crypto.createHash('sha256').update(raw).digest('hex'),passed:count,failures,scope:'Independent three-route coordinator oracle, not adapter, browser, rendered-path or camera-collision qualification'},null,2));if(failures.length)process.exitCode=1;
