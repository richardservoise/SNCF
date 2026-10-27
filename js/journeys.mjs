import {parisClock} from './watch.mjs?v=04f431f3fb21';
export const PROFILES={richard:{name:'Richard',line:'M1',station:'Pont de Bois',out:'4 Cantons – Stade Pierre Mauroy',back:'CHU – Eurasanté'},louis:{name:'Louis',line:'M2',station:'Mons Sarts',out:'CH Dron',back:'Saint-Philibert'}};
export const hhmm=seconds=>{const n=Math.floor(seconds/60);return String(Math.floor(n/60)%24).padStart(2,'0')+':'+String(n%60).padStart(2,'0')};
const secs=time=>{const [h,m,s=0]=time.split(':').map(Number);return h*3600+m*60+s};
export function trainSeconds(train,kind,day){
 const expected=kind==='departure'?train.expectedDeparture:train.expectedArrival;
 if(expected&&Number.isFinite(Date.parse(expected))){const d=new Date(expected),p=parisClock(d);if(p.date===day)return p.minute*60+d.getUTCSeconds();}
 return secs(train[kind]);
}
export function metroTrips(data,profile,leg,day){
 const dateKey=day.replaceAll('-','');const prev=new Date(day+'T12:00:00Z');prev.setUTCDate(prev.getUTCDate()-1);const previous=prev.toISOString().slice(0,10).replaceAll('-','');
 const currentServices=new Set(Object.keys(data.services).filter(s=>data.services[s].includes(dateKey)));
 const previousServices=new Set(Object.keys(data.services).filter(s=>data.services[s].includes(previous)));
 const result=[];
 const line=PROFILES[profile]?.line;if(!line)return [];
 const legacy=line==='M1'?'son':'richard';
 for(const [id,service,departure,arrival,direction] of data.groups[line+'-'+leg]||data.groups[legacy+'-'+leg]||[]){
  if(currentServices.has(service)&&departure<86400)result.push({id,departure,arrival,direction});
  if(previousServices.has(service)&&departure>=86400)result.push({id,departure:departure-86400,arrival:arrival-86400,direction});
 }
 return result.sort((a,b)=>a.departure-b.departure);
}
export function planJourney({trains,metro,profile='richard',mode='auto',day,now=new Date(),walk=5,safety=5,access=0,trainId='auto'}){
 const clock=parisClock(now),current=day===clock.date,nowSeconds=current?clock.minute*60+now.getUTCSeconds():0;
 const leg=mode==='auto'?(current&&clock.minute>=12*60?'back':'out'):mode;
 const options={profile,leg,day,walk,safety,access,current};
 const allTrains=trains.filter(t=>t.direction===(leg==='out'?'morning':'evening'));
 const selected=trainId!=='auto'?allTrains.find(t=>t.number+'-'+t.departure===trainId):null;
 if(selected?.cancelled)return {...options,error:'train-cancelled',trains:allTrains};
 if(trainId!=='auto'&&!selected)return {...options,error:'train-missing',trains:allTrains};
 const available=allTrains.filter(t=>!t.cancelled&&trainSeconds(t,'departure',day)>=nowSeconds).sort((a,b)=>trainSeconds(a,'departure',day)-trainSeconds(b,'departure',day));
 if(day<metro.from||day>metro.to)return {...options,error:'metro-date',trains:allTrains};
 const metros=metroTrips(metro,profile,leg,day);
 if(leg==='out'){
  const train=selected||available[0];
  const start=train?Math.max(nowSeconds,trainSeconds(train,'arrival',day)):nowSeconds;
  const ready=start+walk*60;
  const next=metros.find(m=>m.departure>=ready);
  return {...options,train,metro:next,ready,metroOnly:!train,error:next?null:'no-metro',nextMetros:metros.filter(m=>m.departure>=ready).slice(0,3),trains:allTrains};
 }
 const ready=nowSeconds+access*60;
 const eligible=metros.filter(m=>m.departure>=ready);
 if(selected){
  const departure=trainSeconds(selected,'departure',day);
  const feasible=eligible.filter(m=>m.arrival+(walk+safety)*60<=departure);
  const next=feasible.at(-1);
  return {...options,train:selected,metro:next,ready,error:next?null:'missed-connection',latest:true,slack:next?(departure-next.arrival-walk*60)/60:null,trains:allTrains};
 }
 if(available[0]&&trainSeconds(available[0],'departure',day)-nowSeconds>3600){
  const train=available[0],departure=trainSeconds(train,'departure',day);
  const next=eligible.filter(m=>m.arrival+(walk+safety)*60<=departure).at(-1);
  if(next)return {...options,train,metro:next,ready,error:null,leaveLater:true,slack:(departure-next.arrival-walk*60)/60,nextMetros:eligible.slice(0,3),trains:allTrains};
 }
 for(const next of eligible){
  const train=available.find(t=>trainSeconds(t,'departure',day)>=next.arrival+(walk+safety)*60);
  if(train)return {...options,train,metro:next,ready,error:null,slack:(trainSeconds(train,'departure',day)-next.arrival-walk*60)/60,nextMetros:eligible.slice(0,3),trains:allTrains};
 }
 return {...options,metro:eligible[0],ready,error:eligible.length?'no-train':'no-metro',trains:allTrains};
}
