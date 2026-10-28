/** Habitat knowledge only. Neither these sources nor the authored pool are a survey. */
export const INTERTIDAL_PROFILE={id:'redwood-rocky-intertidal',label:'Redwood coast · rocky tidepool',aliases:['redwood coast','redwood tidepool','rocky tidepool','redwood rocky intertidal'],habitat:'rocky-intertidal',region:'Rocky intertidal habitat on the Redwood coast, California',resolution:'regional habitat; no point survey, tide forecast or bathymetry',sources:[
 {id:'nps-redwood-intertidal',publisher:'National Park Service',url:'https://www.nps.gov/articles/000/on-the-edge-the-curious-lives-of-intertidal-organisms-and-how-we-monitor-them.htm',retrieved:'2026-10-26',updated:'2022-11-28',claim:'Redwood coast tidepools support anemones. Their flexible bodies contract when exposed as the tide recedes.'},
 {id:'noaa-intertidal-zones',publisher:'NOAA',url:'https://oceanservice.noaa.gov/facts/intertidal-zone.html',retrieved:'2026-10-26',updated:'2026-09-23',claim:'The intertidal zone lies between high and low tides. Anemones occur in the middle intertidal community.'}
],facts:{vegetation:'not-resolved',water:'intertidal-marine',season:'not-resolved'}};

export function composeIntertidal(feature,wet){
 feature('ground','ground','Illustrative coastal substrate',[0,-.18,0],[9,.18,8],'intertidal-substrate');
 // An authored pool and finite attachment shelves, not inferred real landmarks.
 feature('shelf','rock','Illustrative attachment shelf',[0,.02,0],[1.8,.24,1.6],'intertidal-shelf');
 feature('shelf-east','rock','Illustrative outer shelf',[2.1,0,-1.3],[1.5,.35,1.4],'intertidal-shelf');
 for(let i=0;i<7;i++){const a=i*Math.PI*2/7;feature('rim-'+i,'rock','Illustrative pool rim',[Math.sin(a)*2.45,-.03,Math.cos(a)*2.1],[1.1,.65+(i%3)*.13,.9]);}
 if(wet)feature('water','water','Illustrative seawater in the pool',[0,0,0],[4.4,.48,3.7]);
}
