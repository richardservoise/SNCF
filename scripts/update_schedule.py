"""Download official SNCF GTFS; retain the two direct rail commuter windows."""
import csv, io, json, zipfile, urllib.request, datetime, pathlib, collections
ROOT=pathlib.Path(__file__).resolve().parents[1]
URL='https://eu.ftp.opendatasoft.com/sncf/plandata/Export_OpenData_SNCF_GTFS_NewTripId.zip'
def extract(blob):
    z=zipfile.ZipFile(io.BytesIO(blob))
    def rows(name):return csv.DictReader(io.TextIOWrapper(z.open(name),encoding='utf-8-sig'))
    stop_times=collections.defaultdict(dict)
    for row in rows('stop_times.txt'):
        if row['stop_id'] in ('StopPoint:OCETrain TER-87286146','StopPoint:OCETrain TER-87286005'):
            stop_times[row['trip_id']][row['stop_id'][-8:]]=row
    trips={r['trip_id']:r for r in rows('trips.txt') if r['trip_id'] in stop_times}
    services=collections.defaultdict(set)
    for r in rows('calendar_dates.txt'):
        if r['exception_type']=='1':services[r['service_id']].add(r['date'])
    result=[]
    for tid,stops in stop_times.items():
        if len(stops)!=2:continue
        dep,arr=sorted(stops.values(),key=lambda r:int(r['stop_sequence']))
        direction='morning' if dep['stop_id'].endswith('87286146') else 'evening'
        low,high=('06:45:00','07:45:00') if direction=='morning' else ('17:00:00','18:30:00')
        if not low<=dep['departure_time']<=high:continue
        trip=trips[tid];dates=sorted(services[trip['service_id']])
        if dates:result.append(dict(number=trip['trip_headsign'],direction=direction,departure=dep['departure_time'][:5],arrival=arr['arrival_time'][:5],dates=dates))
    if not result:raise ValueError('No matching direct trains found; refusing to replace timetable')
    dates=[d for r in result for d in r['dates']]
    iso=lambda d:f'{d[:4]}-{d[4:6]}-{d[6:]}'
    return dict(generatedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),source=URL,fromDate=min(dates),**{'from':iso(min(dates)),'to':iso(max(dates))},trains=sorted(result,key=lambda r:(r['direction'],r['departure'],r['number'])))
def main():
    request=urllib.request.Request(URL,headers={'User-Agent':'MesTrains-GitHubPages/1.0'})
    with urllib.request.urlopen(request,timeout=90) as response:blob=response.read()
    data=extract(blob); target=ROOT/'data/schedule.json';target.parent.mkdir(exist_ok=True)
    tmp=target.with_suffix('.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8');tmp.replace(target)
    print(f"SNCF: {len(data['trains'])} train variants; {data['from']} → {data['to']}")
if __name__=='__main__':main()
