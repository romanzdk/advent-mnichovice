"""Fail-closed public projection validation; no source credentials are needed."""
import json,re,sys
from datetime import date,datetime,time
from urllib.parse import urlsplit
from pathlib import Path

FIELDS={'id','title','town','venue','date','endDate','startTime','endTime','category','price','registration','registrationUrl','description','notes','audience','status','verifiedAt','sourceUrl','location'}
def validate(data):
 def require(ok,message):
  if not ok:raise ValueError(message)
 def https(value):
  try:
   u=urlsplit(value);return u.scheme=='https' and bool(u.hostname) and not u.username and not u.password and u.hostname not in ['localhost','127.0.0.1']
  except (ValueError,TypeError):return False
 require(set(data)=={'schemaVersion','generatedAt','season','region','events'},'Unexpected public root fields')
 require(data['schemaVersion']==1 and data['season']==2026,'Unsupported schema or season')
 datetime.fromisoformat(data['generatedAt']);require(isinstance(data['events'],list),'Events must be a list')
 text=json.dumps(data,ensure_ascii=False)
 require(not re.search(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|/home/|calendar_id|event_id|responseStatus|sendUpdates|attendees|\.hermes/',text),'Private metadata detected')
 ids=set()
 for e in data['events']:
  require(set(e)==FIELDS,'Unexpected or missing public event fields')
  require(re.fullmatch(r'e-[a-zA-Z0-9_-]+',e['id']) is not None and e['id'] not in ids,'Invalid or duplicate public ID');ids.add(e['id'])
  require(isinstance(e['title'],str) and bool(e['title']) and isinstance(e['town'],str),'Title/town missing')
  start=date.fromisoformat(e['date']);require(start.year==2026,'Event outside season')
  if e['endDate']:require(date.fromisoformat(e['endDate'])>=start,'End date precedes start')
  for f in ['startTime','endTime']:
   if e[f]:require(re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d',e[f]) is not None,'Invalid published time');time.fromisoformat(e[f])
  require(e['category'] in ['strom','mikulas','trhy','tvoreni','setkani','betlem'],'Bad category')
  require(e['audience'] in ['všichni','dospělí','senioři / omezené zaměření'],'Bad audience')
  require(e['status'] in ['confirmed','time-unconfirmed','cancelled'],'Bad status')
  require(https(e['sourceUrl']),'Invalid source URL')
  require(e['registrationUrl'] is None or https(e['registrationUrl']),'Invalid reservation URL')
  require(isinstance(e['notes'],list) and all(isinstance(n,str) for n in e['notes']),'Bad notes')
  datetime.fromisoformat(e['verifiedAt'])
  loc=e['location']
  if loc is not None:
   require(set(loc)=={'lat','lon','precision','label','sourceUrl'},'Bad location fields')
   require(isinstance(loc['lat'],(int,float)) and isinstance(loc['lon'],(int,float)) and 49.7<loc['lat']<50.2 and 14.3<loc['lon']<15.1,'Location outside region')
   require(loc['precision'] in ['town','venue'] and https(loc['sourceUrl']),'Location provenance missing')
 return True
if __name__=='__main__':
 data=json.loads(Path(sys.argv[1]).read_text());validate(data);print(f"Public data validated: {len(data['events'])} events")
