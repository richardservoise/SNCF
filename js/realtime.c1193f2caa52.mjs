export const LIVE_URL = 'https://proxy.transport.data.gouv.fr/resource/sncf-siri-lite-estimated-timetable';
const value = (xml, name) => xml.match(new RegExp('<'+name+'(?: [^>]*)?>([^<]*)</'+name+'>'))?.[1]?.trim() ?? null;
export function parseJourney(xml) {
  if (!xml.includes('87286146') || !xml.includes('87286005')) return null;
  const number = value(xml, 'TrainNumberRef');
  if (!number) return null;
  const header = xml.split(/<(?:RecordedCalls|EstimatedCalls)>/)[0];
  const calls = [...xml.matchAll(/<(?:EstimatedCall|RecordedCall)>([\s\S]*?)<\/(?:EstimatedCall|RecordedCall)>/g)].map(m => m[1]);
  return {number, date: value(xml,'DataFrameRef'), cancelled:value(header,'Cancellation')==='true',
    calls: calls.filter(c => /87286146|87286005/.test(value(c,'StopPointRef') || '')).map(c => ({
      station:value(c,'StopPointRef').match(/87286146|87286005/)[0],
      aimed:value(c,'AimedDepartureTime'), expected:value(c,'ExpectedDepartureTime'), arrival:value(c,'ExpectedArrivalTime'),
      platform:value(c,'DeparturePlatformName'),
      cancelled:value(c,'Cancellation')==='true'||value(c,'DepartureStatus')==='cancelled',
      inaccurate:value(c,'PredictionInaccurate')==='true',
    }))};
}
export async function readLive(response, now=Date.now()) {
  if (!response.ok || !response.body) throw Error('Flux SNCF indisponible');
  const reader=response.body.getReader(), decoder=new TextDecoder();
  const endTag='</EstimatedVehicleJourney>';
  let buffer='',stamp=null; const journeys=[];
  try {
    while(true) {
      const {done,value:chunk}=await reader.read(); if(done) break;
      buffer+=decoder.decode(chunk,{stream:true});
      if(!stamp) stamp=value(buffer,'ResponseTimestamp');
      let end;
      while((end=buffer.indexOf(endTag))>=0) {
        const start=buffer.indexOf('<EstimatedVehicleJourney>');
        if(start>=0) {const journey=parseJourney(buffer.slice(start,end));if(journey) journeys.push(journey);}
        buffer=buffer.slice(end+endTag.length);
      }
      if(buffer.length>2000000) throw Error('Format du flux SNCF inattendu');
    }
    if(!stamp||!Number.isFinite(Date.parse(stamp))||Math.abs(now-Date.parse(stamp))>600000) throw Error('Flux SNCF périmé');
    return {stamp,journeys};
  } catch(error) {await reader.cancel().catch(()=>{});throw error;} finally {reader.releaseLock();}
}
let cached;
export async function fetchLive(signal) {
  if(cached && Date.now()-cached.fetched<90000) return cached;
  const abort=new AbortController();
  const cancel=()=>abort.abort(signal?.reason);
  if(signal?.aborted) cancel(); else signal?.addEventListener('abort',cancel,{once:true});
  const timeout=setTimeout(()=>abort.abort(),35000);
  try {
    const response=await fetch(LIVE_URL,{signal:abort.signal,cache:'no-store',credentials:'omit'});
    const live=await readLive(response);
    cached={...live,fetched:Date.now()};return cached;
  } finally {clearTimeout(timeout);signal?.removeEventListener('abort',cancel);}
}
export function applyLive(trains, date, live) {
  return trains.map(train=>{
    const out={...train};
    if(!live) return out;
    const station=train.direction==='morning'?'87286146':'87286005';
    const journey=live.journeys.find(j=>j.number===train.number&&j.date===date&&j.calls.some(c=>c.station===station&&c.aimed?.slice(11,16)===train.departure));
    if(!journey) return out;
    const dep=journey.calls.find(c=>c.station===station), arr=journey.calls.find(c=>c.station!==station);
    out.cancelled=journey.cancelled||dep.cancelled;out.platform=dep.platform;
    out.realtime=!!dep.expected&&!dep.inaccurate&&Number.isFinite(Date.parse(dep.expected));
    if(out.realtime){out.expectedDeparture=dep.expected;out.delay=Math.round((Date.parse(dep.expected)-Date.parse(dep.aimed))/60000);}
    if(arr?.arrival&&!arr.inaccurate) out.expectedArrival=arr.arrival;
    return out;
  });
}
