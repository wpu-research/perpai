import re,html,glob,csv,collections,sys
rows={}
for f in glob.glob(sys.argv[1]+'/c*.html'):
    t=open(f,encoding='utf-8').read()
    for m in re.finditer(r'company/view/(\d+)/[^"]*" class="listing-item">(.*?)<!-- Listing Item / End',t,re.S):
        cid,b=m.groups()
        blk=re.search(r'listing-badge[^>]*>([^<]*)<',b); name=re.search(r'<h3>(.*?)</h3>',b,re.S)
        kn=re.search(r'Kat\s*:\s*([^/]*)/\s*No\s*:\s*([^<]*)<',b,re.S)
        rows[cid]=dict(id=cid,blok=(blk.group(1).strip() if blk else ''),ad=html.unescape(name.group(1).strip()) if name else '',
          kat=kn.group(1).strip() if kn else '',no=re.sub(r'\s+',' ',kn.group(2)).strip() if kn else '')
w=csv.DictWriter(open(sys.argv[2],'w',newline=''),fieldnames=['id','blok','ad','kat','no']); w.writeheader(); w.writerows(rows.values())
print('firma',len(rows))
c=collections.Counter(r['blok'] for r in rows.values()); print('blok',c)
kc=collections.Counter(r['kat'] for r in rows.values()); print('kat top',kc.most_common(40))
print('kat bos',sum(1 for r in rows.values() if not r['kat']), 'no bos',sum(1 for r in rows.values() if not r['no']))
multi=sum(1 for r in rows.values() if re.search(r'[-,]',r['kat'])); print('cok katli (dubleks/tripleks)',multi)
# single floor counts
fl=collections.Counter()
for r in rows.values():
    for k in re.findall(r'\d+',r['kat']): fl[int(k)]+=1
print('kat bazinda varlik',sorted(fl.items()))
