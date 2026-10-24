"""perpa.com.tr haritasından her firmanın kat planı koordinatını çeker.
Çıktı: arastirma/veri/koordinatlar.json  {firma_id: {"f": kat, "x": 0..1, "y": 0..1}}
Kaldığı yerden devam eder; istekler arası 1,2 sn bekler."""
import json, os, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'arastirma/veri/koordinatlar.json')
MAIN = [2, 5, 8, 11, 13]

def entry_floor(k):
    fl = [int(x) for x in k.split('-')]
    return next((f for f in fl if f in MAIN), fl[0])

firms = json.load(open(os.path.join(ROOT, 'web/data/firms.json')))['firms']
done = json.load(open(OUT)) if os.path.exists(OUT) else {}
todo = [f for f in firms if str(f['i']) not in done]
print(f'{len(done)} hazır, {len(todo)} kaldı', flush=True)
for n, f in enumerate(todo):
    fl = entry_floor(f['k'])
    url = f'https://www.perpa.com.tr/map/plan?company_id={f["i"]}&floor={fl}'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'PerpAI-arastirma/0.1'})
        d = json.load(urllib.request.urlopen(req, timeout=20))
        loc = d['levels'][0]['locations'][0]
        done[str(f['i'])] = {'f': fl, 'x': loc['x'], 'y': loc['y']}
    except Exception as e:
        done[str(f['i'])] = {'f': fl, 'err': str(e)[:80]}
    if n % 25 == 0:
        json.dump(done, open(OUT, 'w')); print(n, len(todo), flush=True)
    time.sleep(1.2)
json.dump(done, open(OUT, 'w'))
print('bitti', len(done))
