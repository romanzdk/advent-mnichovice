import importlib.util,unittest
from pathlib import Path
P=Path(__file__).parents[1]/'scripts/validate_public.py'
class Validation(unittest.TestCase):
 def test_rejects_private_metadata_and_bad_source(self):
  self.assertTrue(P.exists(),'Public publication validator is not implemented')
  spec=importlib.util.spec_from_file_location('validate_public',P);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  doc={'schemaVersion':1,'generatedAt':'2026-11-12T12:00:00+01:00','season':2026,'region':'Mnichovice a okolí','events':[]}
  m.validate(doc)
  with self.assertRaises(ValueError):m.validate({**doc,'calendar_id':'secret'})
  event={'id':'e-123','title':'Test','town':'Mnichovice','venue':None,'date':'2026-11-29','endDate':None,'startTime':None,'endTime':None,'category':'strom','price':None,'registration':None,'registrationUrl':None,'description':'','notes':[],'audience':'všichni','status':'time-unconfirmed','verifiedAt':'2026-11-12','sourceUrl':'https://example.org','location':None}
  m.validate({**doc,'events':[event]})
  for change in [{'attendees':[]},{'sourceUrl':'http://localhost:8888'},{'description':'guest@example.invalid'},{'description':'/home/owner/.hermes/private'},{'date':'2026-02-30'},{'startTime':'25:00'},{'location':{'lat':0,'lon':0,'precision':'town','label':'Mnichovice','sourceUrl':'https://example.org'}}]:
   with self.assertRaises(ValueError,msg=str(change)):m.validate({**doc,'events':[{**event,**change}]})
if __name__=='__main__':unittest.main()
