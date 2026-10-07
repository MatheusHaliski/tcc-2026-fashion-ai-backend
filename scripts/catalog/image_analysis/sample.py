import sys,json,random,collections,gzip,glob
S=sys.argv[1]
norm=json.load(open('fai-application/src/main/resources/catalog/normalization.json'))['taxonomy']['subcategories']
cat={s:c for c,subs in norm.items() for s in subs}
rows=[json.loads(l) for f in glob.glob('data/catalog/acervo/*.jsonl.gz') for l in gzip.open(f,'rt')]
random.seed(7)
by=collections.defaultdict(list)
for d in rows:
    if d.get('images') and d['subcategory'] in cat: by[cat[d['subcategory']]].append(d)
want={'upper_piece':24,'lower_piece':20,'shoes_piece':16,'accessory_piece':12,'full_body_piece':8}
sample=[]
for c,n in want.items():
    pool=by[c]; random.shuffle(pool); seenb=collections.Counter()
    for d in pool:
        if seenb[d['brand']]>=2: continue
        seenb[d['brand']]+=1
        sample.append({'id':len(sample),'brand':d['brand'],'name':d['product_name'],'category':c,'subcategory':d['subcategory'],'url':d['images'][0]['url'],'type':d['images'][0].get('type')})
        if sum(1 for s in sample if s['category']==c)>=n: break
json.dump(sample,open(f'{S}/sample.json','w'),ensure_ascii=False,indent=1)
print(len(sample), dict(collections.Counter(s['category'] for s in sample)), len({s['brand'] for s in sample}))
