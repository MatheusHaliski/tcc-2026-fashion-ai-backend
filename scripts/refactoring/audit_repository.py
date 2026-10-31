#!/usr/bin/env python3
"""Offline, read-only source audit. Writes reports only; never imports application modules.

Python definitions/branches use AST. JS/TS/Java counts are lexical estimates,
not certified cyclomatic complexity. Ranking is triage, not a quality verdict.
"""
from __future__ import annotations
import argparse
import ast
import csv
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import re
import subprocess

EXTENSIONS = {'.tsx':'TSX','.ts':'TypeScript','.jsx':'JSX','.js':'JavaScript','.mjs':'JavaScript','.cjs':'JavaScript','.java':'Java','.py':'Python','.css':'CSS','.sql':'SQL','.sh':'Shell'}
EXCLUDE = {'.git','node_modules','.next','target','dist','build','out','coverage','vendor','vendored','third_party','__pycache__','.venv','venv','work','data','media','assets','public','attachments','.tooling','.m2cache'}
SIGNALS = {
 'HTTP/API': r'\b(fetch|axios|RestController|RequestMapping|httpx|aiohttp|urlopen|HttpClient)\b|api\.(get|post|put|patch|delete)',
 'persistência': r'\b(Repository|EntityManager|Transactional|pymysql|sqlite3|sqlalchemy)\b|\b\w+Repository\b',
 'estado/efeitos React': r'\b(useState|useEffect|useReducer|createContext)\b',
 'UI/JSX': r'<[A-Za-z][\w.]*[\s/>]|className=',
 '3D/geometria': r'\b(THREE|Mesh|BufferGeometry|Vector3|bpy|trimesh|GLTFLoader)\b',
 'imagem': r'\b(sharp|PIL|cv2|ImageOps|BufferedImage|ImageIO)\b',
 'autorização': r'\b(requireOwner|requireCanCreate|requireAdmin|SecurityFilterChain|hasRole|authorizeHttpRequests)\b',
 'CLI': r'\b(argparse|ArgumentParser|process.argv)\b|public static void main',
 'arquivos/storage': r'\b(readFile|writeFile|Files\.|FileInputStream|boto3|S3Client|upload_file|put_object)\b',
 'serialização': r'\b(JSON\.(parse|stringify)|Json\.(read|write)|json\.(loads|dumps)|ObjectMapper)\b',
 'IA/provedor': r'\b(AiEngine|AiRequest|vertexai|torch|transformers|openai)\b',
 'transações/eventos': r'\b(publishEvent|EventListener|TransactionalEventListener|dispatchEvent)\b',
}

def test_path(path):
 return bool(re.search(r'(^|/)(test|tests|test-utils)(/|_)|/src/test/|\.(test|spec)\.',path))

def is_generated(text):
 return bool(re.search(r'@generated\b|DO NOT EDIT\b|auto-generated file|automatically generated file', text[:500], re.I))

def analyse(path, text):
 lines=text.splitlines();language=EXTENSIONS[path.suffix]
 useful=[s.strip() for s in lines if s.strip() and not re.match(r'^\s*(//|#|/\*|\*|<!--)',s)]
 functions=classes=components=hooks=0;imports=[];branches=0;method='lexical estimate'
 if language=='Python':
  try:
   tree=ast.parse(text);nodes=list(ast.walk(tree))
   functions=sum(isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) for n in nodes)
   classes=sum(isinstance(n,ast.ClassDef) for n in nodes)
   branches=sum(isinstance(n,(ast.If,ast.For,ast.AsyncFor,ast.While,ast.ExceptHandler,ast.IfExp,ast.comprehension)) for n in nodes)+sum(len(n.values)-1 for n in nodes if isinstance(n,ast.BoolOp))
   for n in nodes:
    if isinstance(n,ast.Import):imports.extend(a.name for a in n.names)
    elif isinstance(n,ast.ImportFrom):imports.append('.'*n.level+(n.module or ''))
   method='Python AST; branch points, not per-function cyclomatic complexity'
  except SyntaxError:method='parse failed; lexical fallback'
 if method.startswith('lexical') or method.startswith('parse failed'):
  functions=len(re.findall(r'\bfunction\s+[\w$]+\s*\(|(?:public|private|protected|static|final|synchronized)\s+(?:[\w<>\[\],?]+\s+)+\w+\s*\(|\b(?:const|let)\s+\w+\s*=\s*(?:async\s*)?(?:\([^;{}]*\)|\w+)\s*=>',text))
  classes=len(re.findall(r'\b(?:class|record)\s+\w+',text))
  branches=len(re.findall(r'\b(?:if|else if|case|catch|for|while)\b|&&|\|\||\?[^?.]',text))
  imports=re.findall(r'''(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\(\s*|\bimport\s*)["']([^"']+)["']''',text)
  if language=='Java':imports=re.findall(r'^import\s+(?:static\s+)?([\w.*]+);',text,re.M)
 if language in {'TSX','JSX','TypeScript','JavaScript'}:
  components=len(re.findall(r'\bfunction\s+[A-Z]\w*\s*\(|\bconst\s+[A-Z]\w*\s*=\s*(?:\([^;{}]*\)|\w+)\s*=>',text))
  hooks=len(re.findall(r'\bfunction\s+use[A-Z]\w*\s*\(|\bconst\s+use[A-Z]\w*\s*=',text))
 responsibilities=[k for k,v in SIGNALS.items() if re.search(v,text)]
 return {'path':path.as_posix(),'language':language,'physical_lines':len(lines),'useful_lines_estimate':len(useful),'functions':functions,'components':components,'custom_hook_definitions':hooks,'classes':classes,'imports':len(imports),'branch_points':branches,'measurement':method,'responsibilities':responsibilities,'import_names':imports}

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2]);parser.add_argument('--output',type=Path,default=Path('docs/refactoring'));parser.add_argument('--revision',help='Audit a Git revision instead of the working tree');args=parser.parse_args()
 root=args.root.resolve();out=args.output if args.output.is_absolute() else root/args.output;out.mkdir(parents=True,exist_ok=True)
 tracked=subprocess.check_output(['git','ls-tree','-r','--name-only','-z',args.revision] if args.revision else ['git','ls-files','-z'],cwd=root).decode().split('\0')
 changed=set(subprocess.check_output(['git','diff','--name-only','-z',args.revision],cwd=root).decode().split('\0')) if args.revision else set()
 paths={p for p in tracked if p and not (set(Path(p).parts)&EXCLUDE) and Path(p).suffix in EXTENSIONS and not p.endswith('.d.ts')}
 # Also inventory newly extracted source files in this batch, excluding ignored artifacts.
 for p in ([] if args.revision else subprocess.check_output(['git','ls-files','--others','--exclude-standard','-z'],cwd=root).decode().split('\0')):
  if p and not(set(Path(p).parts)&EXCLUDE) and Path(p).suffix in EXTENSIONS and not p.endswith('.d.ts'):paths.add(p)
 rows=[];texts={};skipped=[];chunks=defaultdict(list)
 for name in sorted(paths):
  file=root/name
  if (args.revision and name in changed) or not file.is_file():
   try:text=subprocess.check_output(['git','show',f'{args.revision or "HEAD"}:{name}'],cwd=root,stderr=subprocess.DEVNULL).decode('utf-8',errors='replace')
   except subprocess.CalledProcessError:skipped.append({'path':name,'reason':'not readable in worktree or Git revision'});continue
  else:text=file.read_text(encoding='utf-8',errors='replace')
  if is_generated(text):skipped.append({'path':name,'reason':'generated marker'});continue
  row=analyse(Path(name),text);row['is_test']=test_path(name);rows.append(row);texts[name]=text
  meaningful=[re.sub(r'\s+',' ',s.strip()) for s in text.splitlines() if len(s.strip())>8 and not re.match(r'^\s*(//|#|/\*|\*|import\b|from\b)',s)]
  for offset in range(0,len(meaningful)-9,10):
   chunk='\n'.join(meaningful[offset:offset+10])
   if len(chunk)>200:chunks[hashlib.sha256(chunk.encode()).hexdigest()].append(name)
 duplicate_groups=defaultdict(list)
 for group in chunks.values():
  if len(group)>1:
   for name in set(group):duplicate_groups[name].append(group)
 by_name={r['path']:r for r in rows};java={Path(n).stem:n for n in paths if n.endswith('.java')};tests=[r for r in rows if r['is_test']]
 for row in rows:
  name=row['path'];internal=set()
  for imp in row.pop('import_names'):
   if row['language']=='Java':
    target=java.get(imp.split('.')[-1]);
    if target:internal.add(target)
   elif imp.startswith(('@/','.')):
    target=imp[2:] if imp.startswith('@/') else (Path(name).parent/imp).as_posix()
    target=str(Path(__import__('os').path.normpath(target)))
    for candidate in [target,*[target+e for e in ['.ts','.tsx','.js','.py']],target+'/index.ts',target+'/index.tsx']:
     if candidate in by_name:internal.add(candidate);break
   elif row['language']=='Python':
    for candidate in [imp.replace('.','/')+'.py',(Path(name).parent/(imp.replace('.','/')+'.py')).as_posix()]:
     if candidate in by_name:internal.add(candidate)
  row['internal_dependencies']=sorted(internal)
  stem=Path(name).stem
  row['associated_tests']=[t['path'] for t in tests if t['path']!=name and (stem in Path(t['path']).stem or (len(stem)>4 and stem in texts[t['path']]))][:30]
  matching=duplicate_groups[name]
  row['duplicate_chunks_estimate']=len(matching);row['duplication_candidates']=sorted({other for group in matching for other in group if other!=name})[:20]
  size=min(100,max(0,(row['physical_lines']-250)/750*100))
  complexity=min(100,row['branch_points']/max(1,row['functions'])*8)
  responsibility=min(100,max(0,len(row['responsibilities'])-1)*12.5)
  coupling=min(100,len(internal)*5)
  duplication=min(100,len(matching)*10)
  difficulty=100 if not row['associated_tests'] and not row['is_test'] else 30
  row['score_components']={'size':round(size,2),'complexity_proxy':round(complexity,2),'responsibility_proxy':round(responsibility,2),'coupling':coupling,'duplication_proxy':duplication,'test_difficulty_proxy':difficulty}
  row['priority_score']=round(.20*size+.25*complexity+.20*responsibility+.15*coupling+.10*duplication+.10*difficulty,2)
  row['risk']='high' if re.search(r'avatar3d|/three/|room3d|Security|AccountService|FaiPoints|SealService|WardrobeService|ChallengeService|CopilotService|SchemeService|scripts/cloud/',name) else 'medium' if len(row['responsibilities'])>=5 else 'low'
  row['strategy']='Preserve applied migration; inventory only' if '/migration/' in name else 'Preserve test coverage; do not split solely by length' if row['is_test'] else 'Review cohesive responsibilities and characterize behavior before extraction'
 fields=['path','language','physical_lines','useful_lines_estimate','functions','components','custom_hook_definitions','classes','imports','internal_dependencies','responsibilities','branch_points','measurement','duplicate_chunks_estimate','duplication_candidates','associated_tests','risk','priority_score','score_components','strategy']
 with (out/'file-complexity.csv').open('w',newline='',encoding='utf-8') as stream:
  writer=csv.DictWriter(stream,fieldnames=fields,lineterminator="\n");writer.writeheader()
  for row in sorted(rows,key=lambda r:-r['priority_score']):writer.writerow({k:json.dumps(row[k],ensure_ascii=False) if isinstance(row[k],(list,dict)) else row[k] for k in fields})
 # Cycles reported as SCCs over resolved static imports; dynamic/framework edges may be missing.
 graph={r['path']:r['internal_dependencies'] for r in rows};index={};low={};stack=[];on=set();cycles=[]
 def visit(v):
  index[v]=low[v]=len(index);stack.append(v);on.add(v)
  for w in graph.get(v,[]):
   if w not in index:visit(w);low[v]=min(low[v],low[w])
   elif w in on:low[v]=min(low[v],index[w])
  if low[v]==index[v]:
   group=[]
   while True:
    w=stack.pop();on.remove(w);group.append(w)
    if w==v:break
   if len(group)>1:cycles.append(sorted(group))
 for v in graph:
  if v not in index:visit(v)
 summary={'mode':args.revision or 'working_tree','head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'files':len(rows),'source_lines':sum(r['physical_lines'] for r in rows),'thresholds':{str(n):sum(r['physical_lines']>n for r in rows) for n in [250,400,600,1000]},'skipped':skipped,'resolved_import_cycles':cycles,'rows':rows}
 (out/'inventory.json').write_text(json.dumps(summary,ensure_ascii=False,separators=(',',':')))
 ranked=sorted((r for r in rows if not r['is_test'] and '/migration/' not in r['path'] and not r['path'].startswith('scripts/refactoring/')),key=lambda r:-r['priority_score'])[:30]
 md=['# Inventário de complexidade — FashionAI','',f"Base: `{summary['head']}`. {len(rows)} arquivos de código; {summary['source_lines']} linhas físicas.",'', 'CSV completo: [file-complexity.csv](file-complexity.csv). Dados e ciclos: [inventory.json](inventory.json).','', '## Método e limites','', 'Ranking = 20% tamanho + 25% proxy de complexidade + 20% responsabilidades inferidas + 15% imports internos resolvidos + 10% duplicação candidata + 10% dificuldade de teste inferida. Fórmulas em `scripts/refactoring/audit_repository.py`. Não é complexidade ciclomática certificada nem classificação humana de responsabilidades. Python usa AST; Java/JS/TS usam estimativas lexicais. Linhas úteis excluem brancos e linhas iniciadas por comentários, sem parser completo de comentários multilinha. Hooks contam definições próprias, não chamadas. Testes associados são candidatos por nome/referência textual, não prova de cobertura. Duplicação = blocos não sobrepostos de 10 linhas significativas normalizadas, incluindo fixtures; exige revisão humana. Imports Python dinâmicos, aliases não triviais e bytecode não são resolvidos.','', 'Triagem: >250 revisão; >400 prioridade; >600 alta; >1000 crítica. Tamanho não impõe extração. Tests e migrations constam no CSV, mas não no top 30 de produção. Arquivos gerados, dependências, binários e outputs foram excluídos. Não há execução de banco, rede, modelos ou aplicações neste script.','', '## Top 30 de produção','', '| Arquivo | Linhas | Funções* | Imports internos | Ramos* | Score | Risco |','|---|---:|---:|---:|---:|---:|---|']
 md.extend(f"| `{r['path']}` | {r['physical_lines']} | {r['functions']} | {len(r['internal_dependencies'])} | {r['branch_points']} | {r['priority_score']} | {r['risk']} |" for r in ranked)
 md+=['','## Contagens de triagem','',*[f'- Mais de {n} linhas: {count} arquivos.' for n,count in summary['thresholds'].items()],'',f"Ciclos estáticos resolvidos: {len(cycles)} componentes fortemente conectados. Resultado não prova ausência de ciclos de runtime."]
 (out/'FILE_COMPLEXITY_INVENTORY.md').write_text('\n'.join(md)+'\n')
 print(json.dumps({'files':len(rows),'lines':summary['source_lines'],'thresholds':summary['thresholds'],'top':[(r['path'],r['priority_score']) for r in ranked[:5]],'cycles':len(cycles)},ensure_ascii=False))

if __name__=='__main__':main()
