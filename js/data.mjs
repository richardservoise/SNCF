import {fetchLive,applyLive} from './realtime.mjs?v=04f431f3fb21';
import {parisClock,departureMinute} from './watch.mjs?v=04f431f3fb21';
let schedulePromise;
export async function loadSchedule(){
  if(!schedulePromise) schedulePromise=fetch(new URL('../data/schedule.json',import.meta.url),{cache:'no-cache'}).then(async r=>{
    if(!r.ok)throw Error('Horaires indisponibles');const data=await r.json();
    if(!Array.isArray(data.trains)||!data.generatedAt||!data.from||!data.to)throw Error('Format des horaires invalide');
    return data;
  }).catch(e=>{schedulePromise=null;throw e});
  return schedulePromise;
}
export function shouldFetchLive(trains,date,now=new Date()){
  const clock=parisClock(now);
  return date===clock.date&&trains.some(t=>{const delta=departureMinute(t,date)-clock.minute;return delta>=-60&&delta<=60});
}
const pretty=date=>date.split('-').reverse().join('/');
export async function getTrainData(date,{live=false,signal}={}){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('Date invalide');
  const schedule=await loadSchedule();signal?.throwIfAborted?.();
  const trains=schedule.trains.filter(t=>t.dates.includes(date.replaceAll('-',''))).map(({dates,...train})=>train).sort((a,b)=>a.departure.localeCompare(b.departure));
  const liveWindow=shouldFetchLive(trains,date);
  let updates=null;
  if(live&&liveWindow)try{updates=await fetchLive(signal)}catch(error){if(signal?.aborted)throw error;console.warn('Temps réel SNCF indisponible :',error.message)}
  return {trains:applyLive(trains,date,updates),liveAvailable:!!updates,liveWindow,updatedAt:updates?.stamp,generatedAt:schedule.generatedAt,from:pretty(schedule.from),to:pretty(schedule.to),outOfRange:date<schedule.from||date>schedule.to};
}
