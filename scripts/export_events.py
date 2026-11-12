"""Export only public organizer facts. Never copy calendar descriptions."""
import hashlib,json,re,argparse
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

TOWNS={'Kamenice (Praha-východ)':'Kamenice','Mukařov (Praha-východ)':'Mukařov','Ondřejov (Praha-východ)':'Ondřejov','Mirošovice (Praha-východ)':'Mirošovice','Struhařov (Praha-východ)':'Struhařov','Strančice – Všechromy':'Všechromy','Chocerady – Samechov':'Samechov'}
def public_text(value):
 if not isinstance(value,str):return None
 return re.sub(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', '[kontakt na stránce pořadatele]',value).strip()
def category(title):
 t=title.lower()
 if any(x in t for x in ['jarmark','trhy']):return 'trhy'
 if any(x in t for x in ['čert','mikuláš']):return 'mikulas'
 if any(x in t for x in ['rozsv','stromu','stromečku']):return 'strom'
 if any(x in t for x in ['tvoř','tvořen','díln','věnc','věne','šust','vlny','andílci']):return 'tvoreni'
 if any(x in t for x in ['betlé','betlém']):return 'betlem'
 return 'setkani'
def export_events(state,locations,generated_at):
 out=[]
 for key,row in state['events'].items():
  c=row.get('candidate',{});k=row.get('known',{})
  if not c:
   originals={
    'vsestary-2026-11-28':{'title':'Mikulášská nadílka a rozsvícení vánočního stromu','town':'Všestary','date':'2026-11-28','start':'15:00','end':None,'venue':'Náves Všestary, Jaroslava Baťchy','program_cz':'15:00 zahájení, 16:00 Mikuláš, čert a anděl, 17:00 rozsvícení stromu. Dílničky a jarmark. Pořadatel žádá registraci dětí kvůli balíčkům; QR kód je na plakátu.'},
    'klokocna-strom-2026-11-29':{'title':'Rozsvěcení vánočního stromu','town':'Klokočná','date':'2026-11-29','start':None,'venue':None,'program_cz':'Datum potvrzuje obecní roční plán. Pořádají obec a SDH Klokočná; hodina a přesné místo zatím nezveřejněny.'},
    'klokocna-mikulas-2026-12-05':{'title':'Mikulášská','town':'Klokočná','date':'2026-12-05','start':None,'venue':None,'program_cz':'Datum potvrzuje obecní roční plán. Pořádají obec a Klokajda; hodina a přesné místo zatím nezveřejněny.'}}
   c=originals.get(key)
   if c is None:raise ValueError('Unrecognized record without public candidate; export refused')
  title=public_text(c['title']);town=TOWNS.get(c['town'],c['town']);price=c.get('price')
  if isinstance(price,dict):price=price.get('text')
  if isinstance(c.get('registration'),str):registration=public_text(c['registration'])
  elif isinstance(c.get('registration'),dict) and c['registration'].get('required') is True:registration='Nutná rezervace u pořadatele.'
  else:registration=None
  published_time=c.get('start')
  notes=[]
  if k.get('start',{}).get('date'):
   published_time=None
   if c.get('start'):notes.append('Zdroje se rozcházejí v hodině začátku. Datum platí; přesný čas ještě ověřujeme u pořadatele.')
  if c.get('tree_lighting_time'):notes.append('Rozsvícení stromu: '+c['tree_lighting_time']+'.')
  if not published_time and not notes:notes.append('Čas programu zatím nebyl zveřejněn. Nejde o celodenní program.')
  if not c.get('venue'):notes.append('Přesné místo konání zatím nebylo zveřejněno.')
  audience='senioři / omezené zaměření' if any(x in (title+' '+str(c.get('audience',''))).lower() for x in ['senior','senioř','55+','65+','posez','pečující','znevýhodně']) else 'dospělí' if any(x in str(c.get('audience','')).lower() for x in ['adult','dospěl']) else 'všichni'
  venue_text=str(c.get('venue') or '').lower()
  location_key=town
  if 'muzeum říčany' in venue_text:location_key='venue-museum'
  elif 'památník josefa lady' in venue_text:location_key='venue-lada'
  elif town=='Všechromy' and '40' in venue_text:location_key='venue-vsechromy'
  elif town=='Říčany' and 'masarykovo náměstí' in venue_text:location_key='venue-ricanynam'
  elif town=='Mnichovice' and 'mš mnichovice' in venue_text:location_key='venue-msmnich'
  location=locations.get(location_key) or locations.get(town)
  out.append({'id':'e-'+hashlib.sha256(key.encode()).hexdigest()[:16],'title':title,'town':town,'venue':public_text(c.get('venue')),'date':c['date'],'endDate':c.get('end_date'),'startTime':published_time,'endTime':c.get('end') if published_time else None,'category':category(title),'price':public_text(price),'registration':registration,'registrationUrl':c.get('registration_url'),'description':public_text(c.get('program_cz')) or '', 'notes':notes, 'audience':audience,'status':'confirmed' if published_time else 'time-unconfirmed','verifiedAt':row.get('last_verified_at') or '2026-11-12','sourceUrl':c.get('source_url',row.get('source_url')),'location':location})
 return {'schemaVersion':1,'generatedAt':generated_at,'season':2026,'region':'Mnichovice a okolí','events':sorted(out,key=lambda e:(e['date'],e['startTime'] or '99:99',e['title']))}

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--state',required=True);parser.add_argument('--locations',required=True);parser.add_argument('--out',required=True);a=parser.parse_args()
 data=export_events(json.loads(Path(a.state).read_text()),json.loads(Path(a.locations).read_text()),datetime.now(ZoneInfo('Europe/Prague')).isoformat())
 Path(a.out).parent.mkdir(parents=True,exist_ok=True);Path(a.out).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print(f"Public events exported: {len(data['events'])}")
