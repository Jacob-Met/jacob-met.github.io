/** HAMON view: an imagined time of day and weather for the visit (sky extension, see
 * hamon-extensions.mjs; the receiver side is native/hamon-browser/src/sky.rs).
 *
 * Everything chosen here is imagined. "Now at this place" puts the sun where it is at this
 * moment over the place's public location; it is never observed weather or light. "Imagine
 * rain" (Wildside's own toggle, which also sends inhabitants to shelter) and the Rain weather
 * are the same choice and stay in step.
 */
const KEY='wildside.sky.v1';
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)??'null');}catch{return null;}};
const write=v=>{try{localStorage.setItem(KEY,JSON.stringify(v));}catch{}};

export const SKY_TIMES=Object.freeze([
 ['dawn','Dawn'],['morning','Morning'],['noon','Noon'],['afternoon','Afternoon'],
 ['golden-hour','Golden hour'],['dusk','Dusk'],['blue-hour','Blue hour'],['night','Night'],
]);
export const SKY_WEATHERS=Object.freeze([
 ['clear','Clear'],['fair','Fair'],['overcast','Overcast'],['drizzle','Drizzle'],['rain','Rain'],['mist','Mist'],['snow','Snow'],
]);
const TIME_IDS=new Set(SKY_TIMES.map(x=>x[0])),WEATHER_IDS=new Set(SKY_WEATHERS.map(x=>x[0]));

/** Approximate public coordinates of the curated habitat contexts (park scale, not a point). */
const CONTEXT_COORDS={'saguaro-desert-scrub':[32.25,-110.74],'everglades-sawgrass-marsh':[25.29,-80.9]};

/** The place's public location `[lat, lon]` if Wildside knows one (map origin or curated context). */
export function placeLocation(place){
 for(const o of place?.observations??[]){
  const origin=o.mapContext?.origin;
  if(Array.isArray(origin)&&origin.length===2&&origin.every(Number.isFinite))return [origin[0],origin[1]];
  const c=CONTEXT_COORDS[o.geographicContext?.profileId];if(c)return [...c];
 }
 return null;
}

/** Sun elevation (deg) and hour angle (deg, + after local solar noon) for `date` at lat/lon.
 * Low-precision solar ephemeris (about 0.1 deg), plenty to choose an hour of day. */
export function solarPosition(date,lat,lon){
 const rad=Math.PI/180,d=date.getTime()/86400000+2440587.5-2451545;
 const g=(357.529+.98560028*d)*rad,q=280.459+.98564736*d;
 const L=(q+1.915*Math.sin(g)+.02*Math.sin(2*g))*rad,e=(23.439-3.6e-7*d)*rad;
 const ra=Math.atan2(Math.cos(e)*Math.sin(L),Math.cos(L))/rad,dec=Math.asin(Math.sin(e)*Math.sin(L));
 const gmst=(18.697374558+24.06570982441908*d)*15;
 const ha=((gmst+lon-ra)%360+540)%360-180;
 const el=Math.asin(Math.sin(lat*rad)*Math.sin(dec)+Math.cos(lat*rad)*Math.cos(dec)*Math.cos(ha*rad))/rad;
 return {elevation:el,hourAngle:ha};
}

/** The Engine hour that reads like a sun at this elevation, before or after solar noon. */
export function timeForSun({elevation,hourAngle}){
 const later=hourAngle>0;
 if(elevation< -10)return 'night';
 if(elevation< -4)return 'blue-hour';
 if(elevation<0)return later?'dusk':'dawn';
 if(elevation<7)return later?'golden-hour':'dawn';
 if(Math.abs(hourAngle)<25&&elevation>25)return 'noon';
 return later?'afternoon':'morning';
}

/** The hour it is now at the place, or null when Wildside does not know where the place is. */
export function placeTime(place,now=new Date()){
 const at=placeLocation(place);if(!at)return null;
 return timeForSun(solarPosition(now,at[0],at[1]));
}

/** What to send the receiver for a choice: `time` '' (the style's), 'place' or an hour id;
 * `weather` '' or a weather id; `rain` Wildside's Imagine-rain toggle. */
export function skyFor({time='',weather=''}={},{place=null,now=new Date(),rain=false}={}){
 const tod=time==='place'?placeTime(place,now):TIME_IDS.has(time)?time:null;
 const w=rain?'rain':WEATHER_IDS.has(weather)?weather:null;
 return tod||w?{tod,weather:w}:null;
}

/** Restore a saved choice; 'place' is the default wherever the place's location is known. */
export function initialChoice(saved,place){
 const known=!!placeLocation(place);
 let time=typeof saved?.time==='string'&&(saved.time===''||saved.time==='place'||TIME_IDS.has(saved.time))?saved.time:(known?'place':'');
 if(time==='place'&&!known)time='';
 return {time,weather:WEATHER_IDS.has(saved?.weather)?saved.weather:''};
}

function option(value,text,title){const o=document.createElement('option');o.value=value;o.textContent=text;if(title)o.title=title;return o;}

export default {
 id:'sky-controls',
 /** `container` is the visit bar; `setSky` sends `{tod, weather}|null` to the receiver. */
 mount({container,setSky,place=()=>null,requestFrame=()=>{}}){
  const doc=container.ownerDocument,wrap=doc.createElement('div');
  wrap.className='sky-picker';wrap.setAttribute('role','group');wrap.setAttribute('aria-label','Imagined time and weather');
  wrap.title='An imagined sky for this visit: time and weather here are not observed conditions.';
  const caption=doc.createElement('span');caption.textContent='Imagined sky';
  const time=doc.createElement('select');time.id='sky-time';time.setAttribute('aria-label','Imagined time of day');
  const weather=doc.createElement('select');weather.id='sky-weather';weather.setAttribute('aria-label','Imagined weather');
  weather.append(option('','Style weather','The rendering style’s own weather'),...SKY_WEATHERS.map(([v,t])=>option(v,t)));
  wrap.append(caption,time,weather);
  const rainButton=doc.getElementById('rain-toggle');
  const beside=container.querySelector('.weather');beside?container.insertBefore(wrap,beside):container.append(wrap);
  let choice=initialChoice(read(),place()),dryWeather=choice.weather==='rain'?'':choice.weather,timer=null;
  const raining=()=>rainButton?.getAttribute('aria-pressed')==='true';
  const fillTimes=()=>{
   const here=placeLocation(place());
   time.replaceChildren(option('','Style hour','The rendering style’s own hour'),
    ...(here?[option('place','Now at this place','Imagined: the sun where it is now over this place’s public location. Not observed weather or light.')]:[]),
    ...SKY_TIMES.map(([v,t])=>option(v,t)));
   if(choice.time==='place'&&!here)choice.time='';
   time.value=choice.time;
  };
  const apply=()=>{
   const rain=raining();weather.value=rain?'rain':choice.weather;
   const sky=skyFor(choice,{place:place(),rain});
   setSky(sky);requestFrame();
   wrap.dataset.tod=sky?.tod??'';wrap.dataset.weather=sky?.weather??'';
  };
  fillTimes();
  // a saved Rain choice resumes as Wildside's own imagined rain (simulation included)
  if(choice.weather==='rain'&&!raining())rainButton?.click();
  apply();
  time.addEventListener('change',()=>{choice={...choice,time:time.value};write(choice);apply();});
  weather.addEventListener('change',()=>{
   const v=weather.value;
   if(v!=='rain')dryWeather=v;
   choice={...choice,weather:v};write(choice);
   // Rain is Wildside's Imagine-rain toggle: flip it so inhabitants and the three.js view follow
   if((v==='rain')!==raining()&&rainButton)rainButton.click();
   apply();
  });
  const watch=rainButton&&new MutationObserver(()=>{
   if(!raining()&&choice.weather==='rain'){choice={...choice,weather:dryWeather};write(choice);}
   apply();
  });
  watch?.observe(rainButton,{attributes:true,attributeFilter:['aria-pressed']});
  // "Now at this place" follows the place's clock
  timer=setInterval(()=>{if(choice.time==='place')apply();},60_000);
  return {
   placeChanged(){fillTimes();apply();},
   dispose(){clearInterval(timer);watch?.disconnect();wrap.remove();},
  };
 },
};
