import {parisClock} from './watch.fe53524d1a8a.mjs';
export const STATION={longitude:2.8775,latitude:50.68047};
export const ROAD_MAX_AGE=15*60*1000;
export function roadMorning(day,now=new Date()){const clock=parisClock(now);return day!==clock.date||clock.minute<720}
export function roadAccess(route,parking=10,buffer=5,now=Date.now()){
 if(!route||!Number.isFinite(route.durationSeconds)||route.durationSeconds<0||route.durationSeconds>14400||!Number.isFinite(route.checkedAt)||now-route.checkedAt>ROAD_MAX_AGE||route.checkedAt>now+60000)return null;
 return {route,parking,buffer,totalSeconds:Math.ceil(route.durationSeconds/60)*60+(parking+buffer)*60};
}
export async function fetchRoad(coords,{fetcher=fetch,now=Date.now()}={}){
 const {latitude,longitude,accuracy}=coords;
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180||Number.isFinite(accuracy)&&accuracy>500)throw Error('Position trop imprécise. Réessayez ou saisissez une durée.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const origin=longitude.toFixed(4)+','+latitude.toFixed(4);
  const url='https://router.project-osrm.org/route/v1/driving/'+origin+';'+STATION.longitude+','+STATION.latitude+'?overview=false&steps=false';
  const r=await fetcher(url,{signal:controller.signal,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});if(!r.ok)throw Error();
  const data=await r.json(),route=data.routes?.[0];
  if(data.code!=='Ok'||!Number.isFinite(route?.duration)||route.duration<0||route.duration>14400||!Number.isFinite(route.distance)||route.distance<0||data.waypoints?.some(p=>p.distance>2500))throw Error();
  return {durationSeconds:route.duration,distanceMeters:route.distance,checkedAt:now,source:'OSRM'};
 }catch(e){if(e.message.startsWith('Position'))throw e;throw Error('Calcul routier indisponible. Réessayez ou saisissez votre temps de route.')}finally{clearTimeout(timer)}
}
// Position utilisée sur demande uniquement : aucune coordonnée conservée.
let route=null,enabled=false,busy=false,message='',revision=0,changed=()=>{};
const $=id=>document.getElementById(id);
const minutes=(id,fallback)=>{const raw=$(id).value;if(raw.trim()==='')return fallback;const n=Number(raw);return Number.isFinite(n)?Math.max(0,Math.min(60,n)):fallback};
export function currentRoad(day,now=new Date()){
 const morning=roadMorning(day,now);$('road-panel').hidden=!morning;
 const active=morning&&enabled,parking=minutes('road-parking',10),buffer=minutes('road-buffer',5),access=roadAccess(route,parking,buffer,+now);
 $('road-locate').disabled=busy;$('road-manual-apply').disabled=busy;
 $('road-reset').hidden=!enabled;
 $('road-summary-margins').textContent='+'+buffer+' min prudence · +'+parking+' min parking';
 $('road-margins-label').textContent='Marges : '+buffer+' min prudence + '+parking+' min parking / quai';
 $('road-status').textContent=busy?message:active&&!access?(message||'Estimation expirée : recalculez la route.') :active?Math.ceil(route.durationSeconds/60)+' min de route · +'+(parking+buffer)+' min de marges · sans bouchons en direct':message||'Option voiture · matin uniquement';

 return {active,blocked:active&&!access,...(access||{})};
}
export function initRoad(onChange){
 changed=onChange;
 try{const settings=JSON.parse(localStorage.getItem('mes-trains-road-margins')||'{}');for(const [id,key] of [['road-parking','parking'],['road-buffer','buffer']])if(Number.isFinite(settings[key])&&settings[key]>=0&&settings[key]<=60)$(id).value=settings[key]}catch{}

 $('road-locate').onclick=()=>{
  if(busy)return;const request=++revision;enabled=true;route=null;busy=true;message='Recherche de votre position…';changed();
  const fail=text=>{if(request!==revision)return;busy=false;message=text;changed()};
  if(!navigator.geolocation){fail('Géolocalisation indisponible. Saisissez votre temps de route.');return}
  navigator.geolocation.getCurrentPosition(async position=>{
   if(request!==revision)return;message='Calcul du trajet vers la gare…';changed();
   try{const result=await fetchRoad(position.coords);if(request!==revision)return;route=result;busy=false;message='';$('road-panel').open=false;changed()}catch(e){fail(e.message)}
  },error=>fail(error.code===1?'Localisation refusée. Saisissez une durée ou autorisez la localisation dans Safari.':'Position indisponible. Réessayez ou saisissez une durée.'),{enableHighAccuracy:true,timeout:15000,maximumAge:0});
 };
 $('road-manual-apply').onclick=()=>{
  const raw=$('road-manual').value,n=Number(raw);if(raw.trim()===''||!Number.isFinite(n)||n<0||n>240){message='Saisissez un temps de route entre 0 et 240 minutes.';changed();return}
  revision++;busy=false;enabled=true;route={durationSeconds:n*60,checkedAt:Date.now(),source:'manual'};message='';$('road-panel').open=false;changed();
 };
 $('road-reset').onclick=()=>{revision++;busy=false;enabled=false;route=null;message='';changed()};
 for(const id of ['road-parking','road-buffer'])$(id).onchange=()=>{$(id).value=minutes(id,id==='road-parking'?10:5);try{localStorage.setItem('mes-trains-road-margins',JSON.stringify({parking:minutes('road-parking',10),buffer:minutes('road-buffer',5)}))}catch{}changed()};
}
