"""Extract the four metro legs and their dated services from official Ilévia GTFS."""
import csv,io,json,zipfile,urllib.request,pathlib,datetime,collections
ROOT=pathlib.Path(__file__).resolve().parents[1]
URL='https://media.ilevia.fr/opendata/gtfs.zip'
STOPS={'LIG098','LIG099','LIG398','LIG399','MSA098','MSA099','PDB098','PDB099'}
def extract(blob):
 z=zipfile.ZipFile(io.BytesIO(blob))
 def rows(f):return csv.DictReader(io.TextIOWrapper(z.open(f),encoding='utf-8-sig'))
 trips={r['trip_id']:r for r in rows('trips.txt') if r['route_id'] in ('ME1','ME2')}
 calls=collections.defaultdict(list)
 for r in rows('stop_times.txt'):
  if r['trip_id'] in trips and r['stop_id'] in STOPS:calls[r['trip_id']].append(r)
 services=collections.defaultdict(list)
 ids={r['service_id'] for r in trips.values()}
 for r in rows('calendar_dates.txt'):
  if r['service_id'] in ids and r['exception_type']=='1':services[r['service_id']].append(r['date'])
 groups={k:[] for k in ['richard-out','richard-back','son-out','son-back']}
 seconds=lambda t:sum(int(v)*m for v,m in zip(t.split(':'),(3600,60,1)))
 for tid,st in calls.items():
  if len(st)!=2:continue
  dep,arr=sorted(st,key=lambda r:int(r['stop_sequence']));t=trips[tid]
  profile='richard' if t['route_id']=='ME2' else 'son'
  out=dep['stop_id'].startswith('LIG');key=profile+('-out' if out else '-back')
  if not services[t['service_id']]:continue
  groups[key].append([tid,t['service_id'],seconds(dep['departure_time']),seconds(arr['arrival_time']),t['trip_headsign']])
 for g in groups.values():g.sort(key=lambda r:r[2])
 if any(not g for g in groups.values()):raise ValueError('Missing metro leg')
 dates=[d for ds in services.values() for d in ds];iso=lambda d:f'{d[:4]}-{d[4:6]}-{d[6:]}'
 return dict(generatedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),source=URL,**{'from':iso(min(dates)),'to':iso(max(dates))},services=dict(services),groups=groups)
def main():
 req=urllib.request.Request(URL,headers={'User-Agent':'MesTrainsMetro/2.0'})
 with urllib.request.urlopen(req,timeout=90) as r:data=extract(r.read())
 p=ROOT/'data/metro.json';temp=p.with_suffix('.tmp');temp.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8');temp.replace(p)
 print('Ilévia:',{k:len(v) for k,v in data['groups'].items()},data['from'],data['to'])
if __name__=='__main__':main()
