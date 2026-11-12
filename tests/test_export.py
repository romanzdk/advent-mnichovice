import importlib.util,json,unittest
from pathlib import Path
P=Path(__file__).parents[1]/'scripts/export_events.py'

class PublicExport(unittest.TestCase):
 def test_does_not_publish_private_calendar_metadata(self):
  self.assertTrue(P.exists(),'Public allowlist exporter is not implemented')
  spec=importlib.util.spec_from_file_location('export_events',P);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  row={'candidate':{'title':'Vánoční trhy','town':'Mnichovice','venue':'Náměstí','date':'2026-11-28','start':'15:00','end':None,'source_url':'https://example.org/akce','program_cz':'Veřejný jarmark.'},'known':{'summary':'PRIVATE SUMMARY','start':{'dateTime':'2026-11-28T15:00:00+01:00'},'end':{'dateTime':'2026-11-28T17:00:00+01:00'},'description':'PRIVATE COLLISION owner@example.invalid guest@example.invalid'},'event_id':'SECRET_GOOGLE_EVENT_ID','invitation':{'email':'guest@example.invalid'}}
  data=m.export_events({'events':{'PRIVATE_STATE_KEY':row}}, {}, '2026-11-12T12:00:00+01:00')
  text=json.dumps(data,ensure_ascii=False)
  for secret in ['PRIVATE','SECRET_GOOGLE','owner@example.invalid','guest@example.invalid','invitation','calendar_id']:self.assertNotIn(secret,text)
  e=data['events'][0];self.assertIsNone(e['endTime']);self.assertEqual(e['title'],'Vánoční trhy');self.assertEqual(e['startTime'],'15:00')

 def test_original_organizer_records_are_included_without_calendar_free_text(self):
  spec=importlib.util.spec_from_file_location('export_events',P);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  row={'known':{'summary':'Všestary — Mikulášská nadílka a rozsvícení stromu','start':{'dateTime':'2026-11-28T15:00:00+01:00'},'end':{'dateTime':'2026-11-28T17:30:00+01:00'},'description':'PRIVATE'},'source_url':'https://www.obec-vsestary.cz/event'}
  events=m.export_events({'events':{'vsestary-2026-11-28':row}}, {}, '2026-11-12T12:00:00+01:00')['events']
  self.assertEqual(len(events),1);self.assertEqual(events[0]['startTime'],'15:00');self.assertIsNone(events[0]['endTime']);self.assertEqual(events[0]['town'],'Všestary')

 def test_conflicting_time_is_flagged_and_venue_coordinates_have_provenance(self):
  spec=importlib.util.spec_from_file_location('export_events',P);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  row={'candidate':{'title':'Rozsvícení stromu','town':'Mukařov (Praha-východ)','date':'2026-11-29','start':'16:00','end':None,'source_url':'https://example.org/event'},'known':{'start':{'date':'2026-11-29'}}}
  event=m.export_events({'events':{'abc':row}},{'Mukařov':{'lat':49.99,'lon':14.74,'precision':'town','label':'Mukařov','sourceUrl':'https://www.openstreetmap.org/relation/1'}},'2026-11-12T12:00:00+01:00')['events'][0]
  self.assertIsNone(event['startTime']);self.assertEqual(event['status'],'time-unconfirmed');self.assertTrue(any('rozcházejí' in n for n in event['notes']));self.assertEqual(event['location']['precision'],'town')

 def test_landmark_uses_verified_venue_and_samechov_uses_correct_village(self):
  spec=importlib.util.spec_from_file_location('export_events',P);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  venue={'lat':49.99288,'lon':14.66304,'precision':'venue','label':'Muzeum Říčany','sourceUrl':'https://www.openstreetmap.org/way/1'}
  base={'title':'Věnce','town':'Říčany','venue':'Muzeum Říčany, Rýdlova 271/14','date':'2026-11-26','start':'18:00','end':'20:00','source_url':'https://example.org/event'}
  event=m.export_events({'events':{'a':{'candidate':base}}},{'venue-museum':venue},'2026-11-12T12:00:00+01:00')['events'][0]
  self.assertEqual(event['location'],venue)
  base={**base,'town':'Chocerady – Samechov','venue':'Náves v Samechově'}
  event=m.export_events({'events':{'a':{'candidate':base}}},{'Samechov':venue},'2026-11-12T12:00:00+01:00')['events'][0]
  self.assertEqual(event['town'],'Samechov');self.assertEqual(event['location'],venue)

if __name__=='__main__':unittest.main()
