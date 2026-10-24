"""Perpa firma rehberi verisinden (arastirma/veri) web/data/firms.json üretir."""
import re, html, glob, json, csv, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERI = os.path.join(ROOT, 'arastirma', 'veri')

firms = {}
for r in csv.DictReader(open(os.path.join(VERI, 'firmalar.csv'), encoding='utf-8')):
    no = re.sub(r'\D', '', r['no'])
    if not no or not re.match(r'^\d+(-\d+)*$', r['kat']) or not r['blok']:
        continue
    firms[r['id']] = dict(i=int(r['id']), n=re.sub(r'\s+', ' ', r['ad']).strip(), b=r['blok'][0],
                          k=r['kat'], no=int(no), s=[])

# firma -> sektör (sektöre göre filtrelenmiş liste sayfaları)
for f in glob.glob(os.path.join(VERI, 'ham', 'sektor-listeleri', 's*_*.html')):
    sid = int(re.match(r's(\d+)_', os.path.basename(f)).group(1))
    for cid in set(re.findall(r'company/view/(\d+)/', open(f, encoding='utf-8').read())):
        if cid in firms and sid not in firms[cid]['s']:
            firms[cid]['s'].append(sid)

names = {}
for p in glob.glob(os.path.join(VERI, 'ham', 'sektor-adlari', '*.html')):
    t = open(p, encoding='utf-8').read()
    for sid, x in re.findall(r'company\?sector_id=(\d+)"[^>]*>(.*?)</a>', t, re.S):
        x = html.unescape(re.sub(r'<[^>]+>|\s+', ' ', x)).strip()
        m = re.match(r'(.*?)\s+(\d+)$', x)
        if m:
            names[int(sid)] = m.group(1)

out = dict(sectors=names, firms=sorted(firms.values(), key=lambda f: (f['b'], f['no'])))
json.dump(out, open(os.path.join(ROOT, 'web', 'data', 'firms.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, separators=(',', ':'))
print('firma', len(firms), 'sektorlu', sum(1 for f in firms.values() if f['s']), 'sektor adi', len(names))

# gerçek konumlar ve hat renkleri (koordinatlar varsa; yoksa önce scripts/fetch_coords.py)
if os.path.exists(os.path.join(VERI, 'koordinatlar.json')):
    import fit_coords
    fit_coords.main()
