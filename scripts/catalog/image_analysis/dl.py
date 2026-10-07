import json,sys,urllib.request,concurrent.futures as cf
S=sys.argv[1]; sample=json.load(open(f'{S}/sample.json'))
def get(s):
    try:
        req=urllib.request.Request(s['url'],headers={'User-Agent':'Mozilla/5.0 FashionAI-analysis'})
        with urllib.request.urlopen(req,timeout=30) as r:
            b=r.read(12*1024*1024)
        open(f"{S}/img/{s['id']:03d}.bin",'wb').write(b); return s['id'],len(b),None
    except Exception as e: return s['id'],0,str(e)[:80]
with cf.ThreadPoolExecutor(12) as ex:
    res=list(ex.map(get,sample))
ok=[r for r in res if r[1]>0]; bad=[r for r in res if not r[1]]
print('ok',len(ok),'falhas',len(bad)); [print(b) for b in bad[:10]]
json.dump({r[0]:r[2] for r in bad},open(f'{S}/dl_fail.json','w'))
