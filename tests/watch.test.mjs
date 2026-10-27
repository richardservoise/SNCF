import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {selectWatch,parisClock} from '../js/watch.mjs';
const schedule=JSON.parse(await readFile(new URL('../tests/schedule-fixture.json',import.meta.url),'utf8'));
const day='2026-10-27';
const trains=schedule.filter(t=>t.dates.includes('20261027'));
const at=clock=>new Date(`${day}T${clock}:00+01:00`);
test('À 7h10 le suivi sélectionne le train de 7h13',()=>{
 const selected=selectWatch(trains,day,at('07:10'));
 assert.equal(selected.train.number,'844800'); assert.equal(selected.train.departure,'07:13'); assert.equal(selected.minutes,3);
});
test('Bascule automatique après le départ, sans recharger les données',()=>{
 assert.equal(selectWatch(trains,day,at('07:13')).train.departure,'07:13');
 assert.equal(selectWatch(trains,day,at('07:14')).train.departure,'07:22');
});
test('Retards pris en compte et ordre réel des départs',()=>{
 const modified=trains.map(t=>t.departure==='07:05'?{...t,realtime:true,expectedDeparture:`${day}T07:12:00+01:00`}:t);
 assert.equal(selectWatch(modified,day,at('07:10')).train.departure,'07:05');
 const later=modified.map(t=>t.departure==='07:05'?{...t,expectedDeparture:`${day}T07:20:00+01:00`}:t);
 assert.equal(selectWatch(later,day,at('07:10')).train.departure,'07:13');
});
test('Train supprimé ignoré et départ avancé considéré passé',()=>{
 assert.equal(selectWatch(trains.map(t=>t.departure==='07:13'?{...t,cancelled:true}:t),day,at('07:10')).train.departure,'07:22');
 assert.equal(selectWatch(trains.map(t=>t.departure==='07:13'?{...t,expectedDeparture:`${day}T07:09:00+01:00`}:t),day,at('07:10')).train.departure,'07:22');
});
test('Après le matin, surveillance du retour ; fin de journée et date future',()=>{
 assert.equal(selectWatch(trains,day,at('08:00')).train.departure,'17:13');
 assert.equal(selectWatch(trains,day,at('17:20')).train.departure,'17:32');
 assert.equal(selectWatch(trains,day,at('18:30')),null);
 assert.equal(selectWatch(trains,'2026-10-28',at('07:10')),null);
 assert.equal(selectWatch([],day,at('07:10')),null);
});
test('Fuseau Paris explicite en hiver, été et changement de date',()=>{
 assert.deepEqual(parisClock(new Date('2026-10-27T06:10:00Z')),{date:day,minute:430});
 assert.deepEqual(parisClock(new Date('2026-07-27T05:10:00Z')),{date:'2026-07-27',minute:430});
 assert.deepEqual(parisClock(new Date('2026-10-27T23:10:00Z')),{date:'2026-10-28',minute:10});
});
