import re, glob, json, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
BYFILE={}   # (arquivo, record) -> params
ANY={}
for f in glob.glob(ROOT+'/fai-*/src/main/java/**/*.java', recursive=True):
    src=open(f,encoding='utf-8').read(); base=os.path.basename(f)[:-5]
    for m in re.finditer(r'record\s+(\w+)\s*\(((?:[^()]|\([^()]*\))*)\)', src):
        name, params = m.group(1), re.sub(r'\s+',' ',re.sub(r'@\w+(\((?:[^()]|\([^()]*\))*\))?\s*', '', m.group(2)).strip())
        BYFILE[(base,name)]=params; ANY.setdefault(name,[]).append((base,params))
def fields(ctrl, body):
    if not body: return None
    parts=body.split('.')
    if len(parts)>=2 and (parts[-2],parts[-1]) in BYFILE: return BYFILE[(parts[-2],parts[-1])]
    if (ctrl,parts[-1]) in BYFILE: return BYFILE[(ctrl,parts[-1])]
    c=ANY.get(parts[-1])
    return c[0][1]+ (f'  [de {c[0][0]}]' if c else '') if c else '?'
if __name__=='__main__':
    inv=json.load(open('inventory.json'))
    for e in inv:
        if e['verb']=='GET': continue
        print(f"{e['rf']:<9}{e['controller'][:-10]:<12}{e['verb']:<6}{e['path']:<58} {(e['body'] or '').split('.')[-1]}({fields(e['controller'],e['body']) or ''}) q={e['query']}{' MULTIPART' if e['multipart'] else ''}")
