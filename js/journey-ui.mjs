import {planJourney,PROFILES,hhmm,trainSeconds} from './journeys.mjs';
import {fetchTraffic,TRAFFIC_OFFICIAL} from './traffic.mjs';
import {parisClock} from './watch.mjs';
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatLocalDate=s=>new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(s));
const localDate=s=>Number.isFinite(Date.parse(s))?formatLocalDate(s):'date non précisée';
let profile='richard',mode='auto',trainId='auto',walk=5,safety=5,access=0,latest=null,metro=null,metroPromise,traffic=null,metroError=false;
try{const settings=JSON.parse(localStorage.getItem('mes-trains-metro')||'{}');if(PROFILES[settings.profile])profile=settings.profile;for(const [key,assign] of [['walk',v=>walk=v],['safety',v=>safety=v],['access',v=>access=v]])if(Number.isFinite(settings[key])&&settings[key]>=0&&settings[key]<=30)assign(settings[key]);}catch{}
const save=()=>{try{localStorage.setItem('mes-trains-metro',JSON.stringify({profile,walk,safety,access}))}catch{}};
function updateControls(){
 document.querySelectorAll('[data-profile]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.profile===profile)));
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
 for(const [id,v] of [['walk-margin',walk],['safety-margin',safety],['station-access',access]])$(id).value=v;
}
function drawTraffic(){
 for(const line of ['M1','M2']){const state=traffic?.[line];const label=!state?'Trafic non confirmé':({interrupted:'Interruption signalée',alert:'Information trafic',old:'Message ancien · à confirmer',none:'Aucune alerte récente reçue'})[state.state];
  $('traffic-'+line).className='traffic-card '+(state?.state==='interrupted'?'traffic-red':state?.state==='alert'?'traffic-orange':'');
  $('traffic-'+line).innerHTML='<div class="traffic-head"><span class="line-badge '+line+'">'+line+'</span><strong>'+label+'</strong></div><div class="traffic-note">'+(traffic?'Consulté le '+escape(localDate(traffic.checkedAt)):'Impossible de confirmer l’état de la ligne.')+'</div>'+(state?.messages.length?'<details><summary>Voir le message Ilévia</summary>'+state.messages.map(m=>'<p>'+escape(m.text)+'</p><span class="traffic-note">Publié le '+escape(localDate(m.modified))+(m.recent?'':' · ne confirme pas la situation actuelle')+'</span>').join('')+'</details>':'<div class="traffic-note">L’absence d’alerte ne garantit pas un trafic normal.</div>')+'<a href="'+TRAFFIC_OFFICIAL+'" target="_blank" rel="noopener">Vérifier sur Ilévia ↗</a>';
 }
}
const step=(time,title,detail,kind='')=>'<li class="journey-step"><span class="step-time">'+escape(time)+'</span><div class="step-copy"><strong>'+escape(title)+'</strong><span>'+escape(detail)+'</span>'+(kind?'<em>'+escape(kind)+'</em>':'')+'</div></li>';
function errorTitle(code){return ({'train-cancelled':'Ce train est supprimé.','train-missing':'Ce train n’est pas disponible à cette date.','metro-date':'Pas d’horaires métro pour cette date.','no-metro':'Plus de métro prévu pour ce trajet aujourd’hui.','missed-connection':'Ce train n’est plus atteignable avec vos marges.','no-train':'Plus de correspondance dans vos créneaux de train.'})[code]||'Correspondance indisponible.'}
function render(){
 if(!latest)return;
 const {data,day}=latest;updateControls();
 if(!metro){$('journey-result').innerHTML='<p>'+(metroError?'Impossible de charger les horaires Ilévia. Utilisez Actualiser pour réessayer.':'Chargement des horaires métro officiels…')+'</p>';return}
 const now=new Date(),p=PROFILES[profile];
 const result=planJourney({trains:data.trains,metro,profile,mode,day,now,walk,safety,access,trainId});
 $('journey-mode-label').textContent=(mode==='auto'?'Auto · ':'')+(result.leg==='out'?'Aller du matin':'Retour vers Armentières')+' · '+new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}).format(now)+' Paris';
 const options='<option value="auto">Automatique selon l’heure</option>'+result.trains.map(t=>'<option value="'+escape(t.number+'-'+t.departure)+'">'+t.departure+' → '+t.arrival+' · TER '+escape(t.number)+(t.cancelled?' · supprimé':'')+'</option>').join('');
 if($('journey-train').innerHTML!==options)$('journey-train').innerHTML=options;
 $('journey-train').value=trainId;
 $('journey-train-label').textContent=result.leg==='out'?'Train pris (à choisir si vous êtes déjà à bord)':'Train visé pour le retour';
 const blocked=traffic?.[p.line]?.state==='interrupted';
 let html='<div class="journey-heading"><div><span class="journey-kicker">'+escape(p.name)+' · '+(result.current?'TRAJET DU JOUR':'PRÉVISION À LA DATE CHOISIE')+'</span><h2>'+(result.leg==='out'?'Vers '+p.station:p.station+' → Armentières')+'</h2></div><span class="line-badge '+p.line+'">'+p.line+'</span></div>';
 html+='<p class="journey-direction">Métro '+p.line+' · direction '+escape(result.metro?.direction||(result.leg==='out'?p.out:p.back))+'</p>';
 if(blocked)html+='<div class="connection-alert" role="alert">Une interruption récente est signalée sur '+p.line+'. Cette correspondance théorique n’est pas confirmée : consultez Ilévia avant de partir.</div>';
 if(result.error){html+='<div class="connection-alert">'+errorTitle(result.error)+'</div>';if(result.error==='no-train')html+='<p class="journey-description">Les trains recherchés sont limités à 06:45–07:45 à l’aller et 17:00–18:30 au retour.</p>';html+='<a class="journey-link" href="'+TRAFFIC_OFFICIAL+'" target="_blank" rel="noopener">Horaires et trafic Ilévia ↗</a>';
 }else{
  const t=result.train,m=result.metro;const steps=[];
  if(result.leg==='out'){
   if(t){steps.push(step(hhmm(trainSeconds(t,'departure',day)),'Train au départ d’Armentières','TER '+t.number,t.realtime?'Départ SNCF actualisé':'Départ prévu'));steps.push(step(hhmm(trainSeconds(t,'arrival',day)),'Arrivée à Lille-Flandres',t.expectedArrival?'Arrivée SNCF actualisée':'Arrivée prévue · à confirmer'))}
   else steps.push(step(result.current?hhmm(parisClock(now).minute*60):'—','Depuis Lille-Flandres','Plus de train proposé dans le créneau du matin : calcul depuis la gare, si vous y êtes déjà.'));
   steps.push(step(hhmm(result.ready),'Prêt sur le quai du métro',walk+' min pour rejoindre le métro'));
   steps.push(step(hhmm(m.departure),'Métro '+p.line+' conseillé','Direction '+m.direction,'Passage prévu Ilévia'));
   steps.push(step(hhmm(m.arrival),'Arrivée à '+p.station,'Durée issue des horaires Ilévia','Arrivée prévue'));
  }else{
   steps.push(step(hhmm(m.departure),'Métro '+p.line+' depuis '+p.station,(result.latest?'Dernier passage compatible avec ce train':result.leaveLater?'Départ conseillé pour éviter une longue attente en gare':'Prochain métro compatible')+' · '+(access?access+' min d’accès à la station':'Calcul depuis le quai de la station'),'Passage prévu Ilévia'));
   steps.push(step(hhmm(m.arrival),'Arrivée du métro à Lille-Flandres','Puis '+walk+' min de marche vers le quai du train'));
   steps.push(step(hhmm(m.arrival+walk*60),'Prêt au quai du train','Marge restante : '+Math.floor(result.slack)+' min · minimum demandé : '+safety+' min'));
   steps.push(step(hhmm(trainSeconds(t,'departure',day)),'Train vers Armentières','TER '+t.number,t.realtime?'Départ SNCF actualisé':'Départ prévu'));
   steps.push(step(hhmm(trainSeconds(t,'arrival',day)),'Arrivée à Armentières',t.expectedArrival?'Arrivée SNCF actualisée':'Arrivée prévue'));
  }
  html+='<ol class="journey-timeline">'+steps.join('')+'</ol>';
  const currentSeconds=parisClock(now).minute*60+now.getUTCSeconds();const departure=result.leg==='out'&&t&&trainSeconds(t,'departure',day)>=currentSeconds?trainSeconds(t,'departure',day):m.departure;const delta=Math.ceil((departure-currentSeconds)/60);
  html+='<div class="journey-summary">'+(blocked?'Trajet théorique à revalider':result.current?(delta>0?'Prochain départ dans '+(delta>=60?Math.floor(delta/60)+' h '+String(delta%60).padStart(2,'0'):delta+' min'):'Départ imminent ou déjà effectué · vérifiez le passage'):'Prévision pour le '+escape(day.split('-').reverse().join('/')))+'<span>'+ (result.leg==='out'?'La correspondance se recalcule si l’arrivée du train change.':'Métro et train calculés avec vos marges de marche et de sécurité.')+'</span></div>';
 }
 html+='<p class="journey-description">Métro : horaires prévus, pas de position de rame en direct. Aucun passage temps réel fiable n’a été identifié pour ces stations. Trafic à vérifier avant de partir.</p>';
 $('journey-result').innerHTML=html;
 $('metro-source').textContent='Horaires Ilévia téléchargés le '+localDate(metro.generatedAt)+' · du '+metro.from.split('-').reverse().join('/')+' au '+metro.to.split('-').reverse().join('/')+'.';
}
async function loadMetro(){
 if(!metroPromise)metroPromise=fetch(new URL('../data/metro.json',import.meta.url),{cache:'no-cache'}).then(async r=>{if(!r.ok)throw Error();const d=await r.json();if(!d.groups||!d.services)throw Error();metro=d;metroError=false;render();return d}).catch(()=>{metroError=true;metroPromise=null;render()});
 return metroPromise;
}
export function updateJourney(data,day){latest={data,day};if(!metro)loadMetro();render();}
async function refreshTraffic(){try{traffic=await fetchTraffic()}catch{traffic=null}drawTraffic();render();}
export function initJourney(){
 document.querySelectorAll('[data-profile]').forEach(b=>b.onclick=()=>{profile=b.dataset.profile;trainId='auto';save();render()});
 document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;trainId='auto';render()});
 $('journey-train').onchange=()=>{trainId=$('journey-train').value;render()};
 for(const [id,set] of [['walk-margin',v=>walk=v],['safety-margin',v=>safety=v],['station-access',v=>access=v]])$(id).onchange=()=>{let v=Number($(id).value);if(!Number.isFinite(v))v=5;set(Math.max(0,Math.min(30,v)));save();render()};
 $('refresh').addEventListener('click',()=>{loadMetro();refreshTraffic()});
 updateControls();drawTraffic();loadMetro();refreshTraffic();setInterval(()=>{if(!document.hidden)refreshTraffic()},120000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshTraffic()});
}
