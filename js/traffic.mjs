export const TRAFFIC_URL='https://data.lillemetropole.fr/geoserver/ogc/features/v1/collections/dsp_ilevia:perturbations/items?f=application%2Fjson&limit=1000';
export const TRAFFIC_OFFICIAL='https://www.ilevia.fr/infos-trafic';
const plain=s=>String(s||'').replace(/<br\s*\/?>/gi,' · ').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim();
export function normalizeTraffic(payload,now=Date.now()){
 const stamp=Date.parse(payload.timeStamp);
 if(!Array.isArray(payload.features)||!Number.isFinite(stamp)||Math.abs(now-stamp)>600000)throw Error('Flux trafic périmé ou invalide');
 const lines={M1:[],M2:[]};
 for(const f of payload.features){const p=f.properties||{},target=String(p.cible||'');
  const line=/(?:LineRef|Line)::(?:ME)?1:/.test(target)?'M1':/(?:LineRef|Line)::(?:ME)?2:/.test(target)?'M2':null;
  if(!line)continue;
  const modified=Date.parse(p.date_modification),end=Date.parse(p.heure_fin_prevue);
  if(Number.isFinite(end)&&end<now)continue;
  const recent=Number.isFinite(modified)&&now-modified<=7200000&&modified<=now+300000;
  const text=plain(p.message);if(!text)continue;
  lines[line].push({text,modified:p.date_modification,end:p.heure_fin_prevue,recent,interrupted:recent&&/interrompu|interruption|ne circule/i.test(text),type:p.type_perturbation});
 }
 const result={checkedAt:new Date(now).toISOString()};
 for(const line of ['M1','M2']){const messages=lines[line].sort((a,b)=>Date.parse(b.modified)-Date.parse(a.modified));const recent=messages.filter(m=>m.recent);result[line]={state:recent.some(m=>m.interrupted)?'interrupted':recent.length?'alert':messages.length?'old':'none',messages:(recent.length?recent:messages).slice(0,2)};}
 return result;
}
let cached;
export async function fetchTraffic(){
 if(cached&&Date.now()-cached.fetched<60000)return cached.data;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{const r=await fetch(TRAFFIC_URL,{signal:controller.signal,cache:'no-store',credentials:'omit'});if(!r.ok)throw Error('Source trafic indisponible');const data=normalizeTraffic(await r.json());cached={fetched:Date.now(),data};return data;}finally{clearTimeout(timer)}
}
