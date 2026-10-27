import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readLive,applyLive} from '../js/realtime.mjs';
import {shouldFetchLive} from '../js/data.mjs';
const now=Date.parse('2026-10-27T06:10:00Z');
const fixture=`<Siri><ResponseTimestamp>2026-10-27T06:10:00Z</ResponseTimestamp><EstimatedVehicleJourney><DataFrameRef>2026-10-27</DataFrameRef><TrainNumberRef>844800</TrainNumberRef><EstimatedCalls><EstimatedCall><StopPointRef>FR:ScheduledStopPoint::87286146</StopPointRef><AimedDepartureTime>2026-10-27T07:13:00+01:00</AimedDepartureTime><ExpectedDepartureTime>2026-10-27T07:20:00+01:00</ExpectedDepartureTime><DeparturePlatformName>2</DeparturePlatformName></EstimatedCall><EstimatedCall><StopPointRef>FR:ScheduledStopPoint::87286005</StopPointRef><ExpectedArrivalTime>2026-10-27T07:35:00+01:00</ExpectedArrivalTime></EstimatedCall></EstimatedCalls></EstimatedVehicleJourney></Siri>`;
const train={number:'844800',direction:'morning',departure:'07:13',arrival:'07:28'};
test('Flux SNCF lu en streaming : retard +7 et voie 2',async()=>{
 const response=new Response(new ReadableStream({start(c){for(let i=0;i<fixture.length;i+=19)c.enqueue(new TextEncoder().encode(fixture.slice(i,i+19)));c.close()}}));
 const live=await readLive(response,now);const [result]=applyLive([train],'2026-10-27',live);
 assert.equal(result.delay,7);assert.equal(result.platform,'2');assert.equal(result.realtime,true);
 assert.equal(applyLive([train],'2026-10-28',live)[0].realtime,undefined);
});
test('Flux périmé, non daté ou HTTP en erreur rejeté',async()=>{
 await assert.rejects(readLive(new Response(fixture),now+601000),/périmé/);
 await assert.rejects(readLive(new Response(fixture.replace('2026-10-27T06:10:00Z','invalid')),now),/périmé/);
 await assert.rejects(readLive(new Response('Error',{status:503}),now),/indisponible/);
});
test('Suppression remontée et absence de temps réel jamais marquée à l’heure',async()=>{
 const live=await readLive(new Response(fixture.replace('<EstimatedCalls>','<Cancellation>true</Cancellation><EstimatedCalls>')),now);
 assert.equal(applyLive([train],'2026-10-27',live)[0].cancelled,true);
 assert.equal(applyLive([train],'2026-10-27',null)[0].realtime,undefined);
});
test('Pas de téléchargement du flux national loin des heures de trajet',()=>{
 assert.equal(shouldFetchLive([train],'2026-10-27',new Date(now)),true);
 assert.equal(shouldFetchLive([train],'2026-10-27',new Date('2026-10-27T11:00:00Z')),false);
 assert.equal(shouldFetchLive([train],'2026-10-28',new Date(now)),false);
});
test('GitHub Pages : chemins relatifs, aucun appel au serveur historique',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const app=await readFile(new URL('../js/app.mjs',import.meta.url),'utf8');
 const data=await readFile(new URL('../js/data.mjs',import.meta.url),'utf8');
 assert.match(html,/src="\.\/js\/app.mjs(?:\?[^\"]*)?"/);assert.ok(!app.includes('/api/trains'));assert.ok(!app.includes('chatgpt.site'));assert.ok(!app.includes('WATCH_LOGIC'));
 assert.match(data,/new URL\('\.\.\/data\/schedule.json',import.meta.url\)/);
 const scriptUrl=new URL('./js/data.mjs','https://richardservoise.github.io/SNCF/');
 assert.equal(new URL('../data/schedule.json',scriptUrl).href,'https://richardservoise.github.io/SNCF/data/schedule.json');
});
