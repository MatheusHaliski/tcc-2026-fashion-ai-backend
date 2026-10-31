#!/usr/bin/env python3
"""Reproducible offline inventory; syntax evidence is not a runtime call graph or an authorization proof."""
from __future__ import annotations
import argparse
import ast
import csv
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from collections import Counter, defaultdict

SOURCE = {'.ts','.tsx','.js','.jsx','.mjs','.cjs','.java','.py','.css','.scss','.sql','.sh','.kt','.xml','.gradle','.groovy','.html'}
EXCLUDED = {'node_modules','.git','.next','target','dist','build','coverage','vendor','vendored','third_party','.venv','venv','__pycache__','work','.tooling'}
ROUTE_FILES = {'page','layout','loading','error','not-found','global-error','default','route'}
JAR_DEFAULT = '/workspace/.tooling/m2/com/github/javaparser/javaparser-core/3.28.2/javaparser-core-3.28.2.jar'
JAVA_DEFAULT = '/workspace/.tooling/jdk21/bin'


def git(root, *args):
    return subprocess.check_output(['git', *args], cwd=root).decode().strip()


def require_present_sources(root, paths):
    missing = [p for p in paths if not (root/p).is_file()]
    if missing:
        raise RuntimeError(f'{len(missing)} source files absent from checkout (including sparse paths); materialize or account for them before claiming complete inventory: {missing[:10]}')


def write_csv(path, rows, columns):
    with path.open('w', newline='', encoding='utf-8') as stream:
        writer=csv.DictWriter(stream, fieldnames=columns, extrasaction='ignore', lineterminator='\n');writer.writeheader()
        for row in rows:
            writer.writerow({k:json.dumps(v,ensure_ascii=False,sort_keys=True) if isinstance(v,(dict,list)) else v for k,v in row.items()})


def domain(path):
    checks=[('20',r'admin|moderation|governance'),('13',r'/ai/|copilot|autopilot|lens|inference|model.registry'),('02',r'auth|identity|login|register|password|verification|security'),
        ('09',r'flair|challenge|community.trend'),('10',r'seal|coupon|promotion|moment|celebrity'),
        ('11',r'room|furniture'),('12',r'avatar|try.?on|fitting|garment|mannequin'),
        ('14',r'aura|background|skin|studio'),('08',r'hype|points|ranking|ledger|achievement'),
        ('05',r'catalog|brand|sku|variant'),('04',r'wardrobe|piece|photo|capture|conservation'),
        ('06',r'atelier|scheme|look|dna|mirror|week.plan'),('07',r'feed|search|social|comment|reaction|share|follow|discover'),
        ('03',r'user|profile|preference|consent|notification|account')]
    if path.endswith('.py') and not path.startswith('scripts/refactoring/'): return '18'
    if '/ports/' in path or path.startswith('fai-infrastructure/'): return '19'
    for code,pattern in checks:
        if re.search(pattern,path,re.I):return code
    if path.startswith('app/'):return '15'
    if path.endswith('.java'):return '17' if '/model/' in path or '/repository/' in path else '16'
    return '21' if re.search(r'test|spec|workflow|vitest',path,re.I) else '22'


def route_path(path):
    segments=Path(path).parts[1:-1]
    return '/'+ '/'.join(s for s in segments if not(s.startswith('(') and s.endswith(')')) and not s.startswith('@'))


def values(value):
    return value if isinstance(value,list) else [value]


def mappings(annotations):
    found=[]
    for name,params in annotations.items():
        if name not in {'RequestMapping','GetMapping','PostMapping','PutMapping','PatchMapping','DeleteMapping','HeadMapping','OptionsMapping'}:continue
        paths=values(params.get('path',params.get('value','')))
        methods=values(params.get('method','ANY')) if name=='RequestMapping' else [name.removesuffix('Mapping').upper()]
        for p in paths:
            for method in methods:
                found.append((str(method).split('.')[-1],str(p),params))
    return found


def java_endpoints(row):
    endpoints=[]
    for t in row.get('types',[]):
        if not any(k in t['annotations'] for k in ['Controller','RestController']):continue
        bases=mappings(t['annotations']) or [('ANY','',{})]
        for m in t.get('methods',[]):
            for method,path,meta in mappings(m['annotations']):
                for base_method,base,base_meta in bases:
                    route='/'+'/'.join(x.strip('/') for x in [base,path] if x.strip('/'))
                    verb=method if method!='ANY' else base_method
                    calls=m['calls']
                    endpoints.append({'path':row['path'],'symbol':t['name']+'.'+m['name'],'method':verb,'route':route,'line':m['line'],
                        'status':m['annotations'].get('ResponseStatus',{}).get('value','DEFAULT_OR_RESPONSE_ENTITY'),
                        'parameters':m['parameters'],'return_type':m['returnType'],'mapping_conditions':{**base_meta,**meta},
                        'authorization':'SOURCE_SIGNALS_ONLY:'+','.join(c for c in calls if re.search(r'require|owned|canView',c)) or 'UNRESOLVED',
                        'annotations':{**t['annotations'],**m['annotations']},'rate_limit':'UNRESOLVED_GLOBAL_FILTERS','calls':calls,
                        'confidence':'unresolved_constant' if ('(' in route or re.search(r'^[A-Z_]+$',path)) else 'syntax_composed'})
    return endpoints


def python_info(path,text):
    result={'path':path,'status':'parsed','imports':[],'definitions':[],'routes':[],'branches':0}
    try:tree=ast.parse(text)
    except SyntaxError as e:return {**result,'status':'parse_error','diagnostics':[f'{e.lineno}:{e.msg}']}
    for n in ast.walk(tree):
        if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef)):
            result['definitions'].append({'name':n.name,'line':n.lineno,'kind':'class' if isinstance(n,ast.ClassDef) else 'function'})
            for d in n.decorator_list:
                if isinstance(d,ast.Call) and isinstance(d.func,ast.Attribute) and d.func.attr in ['get','post','put','patch','delete','route'] and d.args and isinstance(d.args[0],ast.Constant):
                    result['routes'].append({'method':d.func.attr.upper(),'route':d.args[0].value,'symbol':n.name,'line':d.lineno,'prefix':'UNRESOLVED_ROUTER_PREFIX'})
        if isinstance(n,ast.Import):result['imports'] += [a.name for a in n.names]
        if isinstance(n,ast.ImportFrom):result['imports'].append('.'*n.level+(n.module or ''))
        if isinstance(n,(ast.If,ast.IfExp,ast.For,ast.AsyncFor,ast.While,ast.ExceptHandler,ast.comprehension)):result['branches']+=1
        if isinstance(n,ast.BoolOp):result['branches']+=len(n.values)-1
    return result


def run(root,out):
    out.mkdir(parents=True,exist_ok=True)
    tracked=git(root,'ls-files','-z').split('\0')
    new=git(root,'ls-files','--others','--exclude-standard','-z').split('\0')
    paths=sorted(set(p for p in tracked+new if p and Path(p).suffix in SOURCE))
    require_present_sources(root, paths)
    excluded=[];source=[];texts={}
    for p in paths:
        if set(Path(p).parts)&EXCLUDED:
            excluded.append({'path':p,'reason':'generated_or_vendor_directory'});continue
        text=(root/p).read_text(encoding='utf-8',errors='replace');texts[p]=text
        source.append({'path':p,'language':Path(p).suffix,'lines':len(text.splitlines()),'sha256':hashlib.sha256(text.encode()).hexdigest(),
            'origin':'tracked' if p in tracked else 'untracked','domain':domain(p),'responsibility':'SYNTAX_INVENTORY_PENDING_SEMANTIC_REVIEW',
            'is_test':bool(re.search(r'/src/test/|(^|/)(tests|test-utils)/|\.(test|spec)\.|(^|/)test_',p)),
            'generated_marker':bool(re.search(r'@generated|DO NOT EDIT',text[:500]))})
    # Require parser dependencies to be explicitly present; never install or download tools.
    js=[r['path'] for r in source if r['language'] in {'.ts','.tsx','.js','.jsx','.cjs','.mjs'}]
    java=[r['path'] for r in source if r['language']=='.java']
    parser_dir=Path(__file__).resolve().parent
    with tempfile.TemporaryDirectory(prefix='fai-gof-') as tmp:
        temporary=Path(tmp);(temporary/'js.json').write_text(json.dumps(js));(temporary/'java.txt').write_text('\n'.join(java))
        result=subprocess.run(['node',str(parser_dir/'source-ast.cjs'),str(temporary/'js.json')],cwd=root,capture_output=True,text=True,check=True)
        jsrows=[json.loads(line) for line in result.stdout.splitlines()]
        jar=os.getenv('FAI_AUDIT_JAVAPARSER_JAR',JAR_DEFAULT);jdk=os.getenv('FAI_AUDIT_JAVA_BIN',JAVA_DEFAULT)
        subprocess.run([str(Path(jdk)/'javac'),'-cp',jar,'-d',tmp,str(parser_dir/'SourceAst.java')],cwd=root,check=True,capture_output=True)
        result=subprocess.run([str(Path(jdk)/'java'),'-cp',tmp+os.pathsep+jar,'SourceAst',str(temporary/'java.txt')],cwd=root,capture_output=True,text=True,check=True)
        jrows=[json.loads(line) for line in result.stdout.splitlines()]
    prows=[python_info(r['path'],texts[r['path']]) for r in source if r['language']=='.py']
    for name,rows in [('typescript-ast.json',jsrows),('java-ast.json',jrows),('python-ast.json',prows)]:
        (out/name).write_text(json.dumps(rows,ensure_ascii=False,sort_keys=True))
    bypath={r['path']:r for r in source};edges=[];unresolved=[];symbols=[];types={};entities=[];services=[];repositories=[];ports=[];controllers=[];backend=[];routes=[];consumers=[]
    for r in jrows:
        for t in r.get('types',[]):types[r.get('package','')+'.'+t['name']]=r['path']
    for r in jrows:
        for imp in r.get('imports',[]):
            target=types.get(imp)
            if target:edges.append({'source':r['path'],'target':target,'kind':'java_import','confidence':'exact_qualified_name'})
            elif imp.startswith('br.com.fashionai.'):unresolved.append({'path':r['path'],'specifier':imp,'reason':'wildcard_or_nested_type_or_unresolved'})
        backend+=java_endpoints(r)
        for t in r.get('types',[]):
            item={'path':r['path'],'symbol':t['name'],'line':t['line'],'domain':domain(r['path']),'annotations':t['annotations'],'fields':t['fields']}
            if set(t['annotations']) & {'Entity','Embeddable','MappedSuperclass'}:entities.append(item)
            if 'Service' in t['annotations']:services.append(item)
            if 'Controller' in t['annotations'] or 'RestController' in t['annotations']:controllers.append(item)
            if '/repository/' in r['path'] and not '/src/test/' in r['path']:repositories.append({**item,'extends':t.get('extends',[])})
            if '/ports/' in r['path'] and t.get('interface'):ports.append(item)
            for m in t['methods']:symbols.append({'path':r['path'],'symbol':t['name']+'.'+m['name'],'line':m['line'],'kind':'java_method','domain':domain(r['path'])})
    for r in jsrows:
        for imp in r['imports']:
            if imp['target'] in bypath:edges.append({'source':r['path'],'target':imp['target'],'kind':'typescript_'+('type_' if imp['typeOnly'] else '')+imp['kind'],'confidence':'typescript_module_resolver'})
            elif imp['specifier'].startswith(('@/','.')):unresolved.append({'path':r['path'],'specifier':imp['specifier'],'reason':'module_not_in_source_inventory_or_unresolved'})
        symbols += [{'path':r['path'],'symbol':d['name'],'line':d['line'],'kind':d['kind'],'domain':domain(r['path'])} for d in r['definitions']]
        consumers += [{'path':r['path'],**c} for c in r['calls']]
    for r in prows:
        symbols += [{'path':r['path'],'symbol':d['name'],'line':d['line'],'kind':'python_'+d['kind'],'domain':domain(r['path'])} for d in r['definitions']]
        for imp in r['imports']:
            candidates=[imp.replace('.','/')+'.py',str(Path(r['path']).parent/(imp.lstrip('.').replace('.','/')+'.py'))]
            target=next((p for p in candidates if p in bypath),None)
            if target:edges.append({'source':r['path'],'target':target,'kind':'python_import','confidence':'static_candidate'})
    # Physical route entry points; role/auth is not inferred from URL names.
    for r in source:
        p=Path(r['path'])
        if r['path'].startswith('app/') and p.stem in ROUTE_FILES:
            routes.append({'path':r['path'],'route':route_path(r['path']),'kind':p.stem,'bff':r['path'].startswith('app/bff/'),
                'domain':r['domain'],'authorization':'UNRESOLVED_LAYOUT_AND_SERVER_POLICY','lines':r['lines']})
    incoming=defaultdict(set);outgoing=defaultdict(set)
    for e in edges:incoming[e['target']].add(e['source']);outgoing[e['source']].add(e['target'])
    for r in source:
        r.update(fan_in=len(incoming[r['path']]),fan_out=len(outgoing[r['path']]),dependencies=sorted(outgoing[r['path']]),consumers=sorted(incoming[r['path']]))
        tests=sorted(p for p in incoming[r['path']] if bypath[p]['is_test'])
        r.update(tests=tests,risk='HIGH' if r['domain'] in {'02','08','10','13','20'} else 'REVIEW_REQUIRED',status='PENDING',pattern='UNDECIDED',decision='Inventory complete; semantic/pattern decision pending')
    endpoint_tests=[r for r in source if r['is_test']]
    for r in backend:
        r['domain']=domain(r['path']);r['tests']=[t['path'] for t in endpoint_tests if Path(r['path']).stem in texts[t['path']]][:30]
    coverage=[{'kind':'source',**r,'symbol':'','route':'','evidence':'sha256:'+r['sha256']} for r in source]
    coverage += [{'kind':'next_route',**r,'symbol':'','lines':bypath[r['path']]['lines'],'pattern':'UNDECIDED','decision':'Route inventoried; authorization/runtime contract pending','tests':bypath[r['path']]['tests'],'status':'PENDING','evidence':'filesystem route convention'} for r in routes]
    coverage += [{'kind':'rest_endpoint',**r,'lines':bypath[r['path']]['lines'],'pattern':'UNDECIDED','decision':'Composed annotation; filter/security/transaction semantics require review','status':'PENDING','evidence':f"JavaParser:{r['line']}"} for r in backend]
    for kind,rows in [('jpa_type',entities),('service',services),('repository',repositories),('port',ports),('controller',controllers)]:
        coverage += [{'kind':kind,**r,'route':'','lines':bypath[r['path']]['lines'],'pattern':'UNDECIDED','decision':'AST declaration inventoried; semantic review pending','tests':bypath[r['path']]['tests'],'status':'PENDING','evidence':f"JavaParser:{r['line']}"} for r in rows]
    write_csv(out/'all-source-files.csv',source,['path','language','lines','sha256','origin','domain','responsibility','is_test','generated_marker','fan_in','fan_out','dependencies','consumers','tests','risk','pattern','decision','status'])
    for name,rows,columns in [
        ('all-frontend-routes.csv',routes,['path','route','kind','bff','domain','lines','authorization']),
        ('all-backend-routes.csv',backend,['path','symbol','line','method','route','status','parameters','return_type','mapping_conditions','annotations','authorization','rate_limit','calls','tests','confidence','domain']),
        ('all-entities.csv',entities,['path','symbol','line','domain','annotations','fields']),
        ('all-services.csv',services,['path','symbol','line','domain','annotations','fields']),
        ('all-repositories.csv',repositories,['path','symbol','line','domain','extends','annotations']),
        ('all-ports.csv',ports,['path','symbol','line','domain','annotations']),
        ('all-symbols.csv',symbols,['path','symbol','line','kind','domain']),
        ('dependencies.csv',edges,['source','target','kind','confidence']),
        ('http-consumers.csv',consumers,['path','method','route','line','callee']),
        ('unresolved-imports.csv',unresolved,['path','specifier','reason']),
        ('excluded-files.csv',excluded,['path','reason']),
        ('COVERAGE.csv',coverage,['kind','path','symbol','route','domain','lines','pattern','decision','tests','status','evidence'])]:write_csv(out/name,rows,columns)
    failures=[{'path':r['path'],'status':r['status'],'diagnostics':r.get('diagnostics',[])} for r in jsrows+jrows+prows if r['status']!='parsed']
    meta={'revision':git(root,'rev-parse','HEAD'),'branch':git(root,'branch','--show-current'),'scope':'tracked source plus nonignored untracked source; generated/vendor excluded explicitly; source tree, not production',
        'source_files':len(source),'tracked_source_files':sum(r['origin']=='tracked' for r in source),'source_lines':sum(r['lines'] for r in source),
        'tests':sum(r['is_test'] for r in source),'next_entries':len(routes),'pages':sum(r['kind']=='page' for r in routes),'bff_handlers':sum(r['bff'] and r['kind']=='route' for r in routes),
        'rest_mappings':len(backend),'jpa_types':len(entities),'entities':sum('Entity' in r['annotations'] for r in entities),
        'mapped_superclasses':sum('MappedSuperclass' in r['annotations'] for r in entities),'embeddables':sum('Embeddable' in r['annotations'] for r in entities),
        'services':len(services),'repositories':len(repositories),'ports':len(ports),'controllers':len(controllers),
        'dependency_edges':len(edges),'parser_failures':failures,'domains':dict(sorted(Counter(r['domain'] for r in source).items())),'unresolved_imports':len(unresolved),
        'limitations':['AST syntax inventory, not dynamic call graph','Security filter chains, inherited mappings, SpEL/constants and reflection need manual review','Frontend consumer association and direct-import test association are incomplete; absence does not prove orphan/untested','Python router prefixes and runtime provider selection are not fully composed','Generated source markers are recorded, not silently removed','No application module imported; no database, cloud or paid inference accessed']}
    (out/'audit-metadata.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in meta.items() if k not in ['limitations','domains']},ensure_ascii=False))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--root',type=Path,default=Path.cwd());parser.add_argument('--output',type=Path,default=Path('docs/refactoring/gof'))
    args=parser.parse_args();run(args.root.resolve(),args.output.resolve())
