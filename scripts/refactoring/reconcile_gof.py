#!/usr/bin/env python3
"""Reconcile tracked files, static contracts and review status after each small batch. No production access."""
from __future__ import annotations
import csv
import hashlib
import json
from pathlib import Path
import re
import subprocess
from collections import Counter, defaultdict
from scripts.refactoring.inventory_gof import write_csv, SOURCE
from scripts.refactoring.line_policy import size_band, review_action

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/refactoring/gof'


def read(name):
    return list(csv.DictReader((OUT/name).open()))


def components(edges):
    graph=defaultdict(set)
    for e in edges:
        if 'type_' not in e['kind']:graph[e['source']].add(e['target'])
    indexes={};low={};stack=[];inside=set();groups=[]
    def visit(node):
        indexes[node]=low[node]=len(indexes);stack.append(node);inside.add(node)
        for other in sorted(graph[node]):
            if other not in indexes:visit(other);low[node]=min(low[node],low[other])
            elif other in inside:low[node]=min(low[node],indexes[other])
        if low[node]==indexes[node]:
            group=[]
            while True:
                item=stack.pop();inside.remove(item);group.append(item)
                if item==node:break
            if len(group)>1 or node in graph[node]:groups.append(sorted(group))
    for node in sorted(list(graph)):
        if node not in indexes:visit(node)
    return sorted(groups)


def match_route(client,endpoint):
    if not client.startswith('/api/'):return False
    client=client.split('?')[0];endpoint=endpoint.split('?')[0]
    # Exact lexical candidates only; no claim of type/authorization/response equivalence.
    a=re.sub(r'\{[^}]+\}', '{}',client);b=re.sub(r'\{[^}]+\}', '{}',endpoint)
    return a==b


def main():
    sources=read('all-source-files.csv');by_path={r['path']:r for r in sources};coverage=read('COVERAGE.csv')
    for row in coverage:
        if row['kind']=='source' and row['path']=='components/atelier3d/editor.tsx':
            row.update(pattern='Memento + component composition',decision='History and property inspector extracted; session, permissions, autosave and transport orchestration remain pending',status='PARTIAL',evidence='FLOW-A3D-HISTORY-001; FLOW-A3D-INSPECTOR-002; component regression')
        elif row['kind']=='source' and row['path']=='lib/atelier3d/history.ts':
            row.update(pattern='Memento',decision='Keep local past/present/future snapshots in pure transitions; no new command bus',status='COMPLETED',evidence='history.test.ts + editor.test.tsx')
        elif row['kind']=='source' and row['path'] in {'components/atelier3d/scene-inspector.tsx', 'components/atelier3d/scene-fields.tsx'}:
            row.update(pattern='Component composition (no additional GoF hierarchy)',decision='Keep property selection/document patches separate from controlled value inputs and session orchestration',status='COMPLETED',evidence='FLOW-A3D-INSPECTOR-002; scene-inspector.test.tsx + editor.test.tsx')
        elif row['kind']=='source' and (row['path'].startswith('scripts/refactoring/gof/') or row['path']=='scripts/refactoring/line_policy.py' or row['path'].startswith('scripts/refactoring/test_gof_')):
            row.update(pattern='23 GoF patterns in offline audit flow; see PATTERN_COVERAGE.csv',decision='Reviewed local audit collaboration; legacy CSV contract preserved; no application or production integration changed',status='COMPLETED',evidence='FLOW-AUDIT-GOF-003; evidence/gof-pattern-tests.log; GOF_EXECUTION.md')
    coverage = [row for row in coverage if row.get('kind') != 'flow']
    coverage.append({'kind':'flow','path':'components/atelier3d/editor.tsx','symbol':'FLOW-A3D-HISTORY-001','route':'/atelier/projects/[id]/editor','domain':'06','lines':by_path['components/atelier3d/editor.tsx']['lines'],'pattern':'Memento','decision':'Preserved 30-edit cap, reset, branching, undo/redo, dirty/busy/owner guards and save payload','tests':['lib/atelier3d/history.test.ts','components/atelier3d/editor.test.tsx'],'status':'COMPLETED','evidence':'evidence/metrics.json; QUALITY_SCORECARD.md'})
    coverage.append({'kind':'flow','path':'components/atelier3d/scene-inspector.tsx','symbol':'FLOW-A3D-INSPECTOR-002','route':'/atelier/projects/[id]/editor','domain':'06','lines':by_path['components/atelier3d/scene-inspector.tsx']['lines'],'pattern':'Component composition','decision':'Preserved transforms, radians/degrees, material edits, vertex restrictions and read-only fieldset','tests':['components/atelier3d/scene-inspector.test.tsx','components/atelier3d/editor.test.tsx'],'status':'COMPLETED','evidence':'evidence/gof-inspector-after.log'})
    coverage.append({'kind':'flow','path':'scripts/refactoring/line_policy.py','symbol':'FLOW-AUDIT-GOF-003','route':'offline CLI','domain':'22','lines':by_path['scripts/refactoring/line_policy.py']['lines'],'pattern':'All 23 GoF patterns in 3 families','decision':'Executable offline inventory with legacy CSV byte contract, immutable records, validation, rollback and explicit queries','tests':['scripts/refactoring/test_gof_model.py','scripts/refactoring/test_gof_query.py','scripts/refactoring/test_gof_execution.py','scripts/refactoring/test_gof_creation.py'],'status':'COMPLETED','evidence':'GOF_EXECUTION.md; evidence/gof-pattern-tests.log'})
    columns=['kind','path','symbol','route','domain','lines','pattern','decision','tests','status','evidence']
    for name in ['COVERAGE.csv','COVERAGE_FINAL.csv']:write_csv(OUT/name,coverage,columns)
    line_rows = [{'path':r['path'], 'physical_lines':int(r['lines']), 'band':size_band(int(r['lines'])),
                  'action':review_action(r['path'], int(r['lines']))} for r in sources]
    write_csv(OUT/'LINE_LIMITS.csv', sorted(line_rows,key=lambda r:(-r['physical_lines'],r['path'])),
              ['path','physical_lines','band','action'])
    files=subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode().split('\0')
    universe=[]
    for name in sorted(p for p in files if p):
        ext=Path(name).suffix.lower()
        kind='source' if name in by_path else 'configuration_or_dataset' if ext in {'.json','.yaml','.yml','.toml','.ini','.properties'} else 'documentation' if ext in {'.md','.txt','.puml','.pdf','.csv'} else 'asset_or_other'
        universe.append({'path':name,'kind':kind,'source_inventory':name in by_path,'bytes':(ROOT/name).stat().st_size if (ROOT/name).is_file() else None,'decision':'PENDING_SEMANTIC_REVIEW' if kind in {'source','configuration_or_dataset'} else 'NON_SOURCE_REVIEW_IF_RELEVANT'})
    write_csv(OUT/'all-repository-files.csv',universe,['path','kind','source_inventory','bytes','decision'])
    endpoints=read('all-backend-routes.csv');clients=read('http-consumers.csv');contracts=[]
    for client in clients:
        hits=[e for e in endpoints if (client['method']==e['method']) and match_route(client['route'],e['route'])]
        contracts.append({**client,'candidates':[e['symbol']+' '+e['path'] for e in hits],'status':'LEXICAL_CANDIDATE_NOT_VERIFIED' if hits else 'UNRESOLVED_OR_EXTERNAL','body_response_auth':'PENDING_MANUAL_CONTRACT_REVIEW'})
    write_csv(OUT/'HTTP_CONTRACTS.csv',contracts,['path','line','callee','method','route','candidates','status','body_response_auth'])
    edges=read('dependencies.csv');before=list(csv.DictReader((OUT/'evidence/dependencies-before.csv').open()));old=components(before);new=components(edges)
    cycles={'before':old,'after':new,'new_groups':[g for g in new if g not in old],'scope':'Syntax import graph excluding pure type-only imports; mixed imports/DI/runtime may differ.'}
    (OUT/'evidence/cycles.json').write_text(json.dumps(cycles,indent=2))
    baseline=json.loads((OUT/'evidence/history-baseline.json').read_text());ts=json.loads((OUT/'typescript-ast.json').read_text());ts={r['path']:r for r in ts}
    editor=by_path['components/atelier3d/editor.tsx'];helper=by_path['lib/atelier3d/history.ts']
    baseline_revision=baseline['revision']
    before_text=subprocess.check_output(['git','show',baseline_revision+':components/atelier3d/editor.tsx'],cwd=ROOT).decode();after_text=(ROOT/editor['path']).read_text()
    # All JSX after the outer viewport component return stays byte-identical.
    start=before_text.index('  return (\n    <');start_after=after_text.index('  return (\n    <')
    metrics={'flow':'FLOW-A3D-HISTORY-001','editor_lines_before':int(baseline['file']['lines']),'editor_lines_after':int(editor['lines']),
        'new_runtime_module_lines':int(helper['lines']),'runtime_total_before':int(baseline['file']['lines']),'runtime_total_after':int(editor['lines'])+int(helper['lines']),
        'editor_reduction_percent':round((int(baseline['file']['lines'])-int(editor['lines']))/int(baseline['file']['lines'])*100,2),
        'branch_syntax_before_editor':baseline['branches'],'branch_syntax_after_editor':ts[editor['path']]['branches'],'branch_syntax_new_helper':ts[helper['path']]['branches'],
        'functions_before_editor':baseline['functions'],'functions_after_editor':len(ts[editor['path']]['definitions']),'functions_new_helper':len(ts[helper['path']]['definitions']),
        'imports_before_editor':baseline['imports'],'imports_after_editor':len(ts[editor['path']]['imports']),
        'jsx_byte_identical':before_text[start:]==after_text[start_after:],'new_import_cycles':len(cycles['new_groups']),
        'new_history_tests_lines':len((ROOT/'lib/atelier3d/history.test.ts').read_text().splitlines()),
        'notes':['Branch syntax counts are not per-function cyclomatic complexity','No global branch/duplication reduction claimed','Runtime helper + editor counted together; audit/test/docs overhead reported separately']}
    extracted=['lib/atelier3d/history.ts','components/atelier3d/scene-inspector.tsx','components/atelier3d/scene-fields.tsx']
    metrics.update(baseline_revision=baseline_revision,flows=['FLOW-A3D-HISTORY-001','FLOW-A3D-INSPECTOR-002'],
                   extracted_modules={p:int(by_path[p]['lines']) for p in extracted},
                   runtime_total_after=int(editor['lines'])+sum(int(by_path[p]['lines']) for p in extracted),
                   branch_syntax_combined_after=ts[editor['path']]['branches']+sum(ts[p]['branches'] for p in extracted))
    (OUT/'evidence/metrics.json').write_text(json.dumps(metrics,indent=2))
    # Supplemental runtime symbol inventories use already-parsed syntax only.
    py=json.loads((OUT/'python-ast.json').read_text());j=json.loads((OUT/'java-ast.json').read_text())
    write_csv(OUT/'all-python-pipelines.csv',[{'path':r['path'],'parser':r['status'],'definitions':r['definitions'],'decorator_routes':r['routes']} for r in py],['path','parser','definitions','decorator_routes'])
    integrations=[{'path':r['path'],'types':[{'name':t['name'],'implements':t.get('implements',[])} for t in r.get('types',[])],'review':'PENDING_INTERFACE_AND_CONFIGURATION_REVIEW'} for r in j if r['path'].startswith('fai-infrastructure/')]
    write_csv(OUT/'all-integrations.csv',integrations,['path','types','review'])
    pending=[r for r in coverage if r['status'] not in {'COMPLETED'}]
    (OUT/'RESIDUAL_FINDINGS.md').write_text('# Cobertura residual após os lotes concluídos\n\n'+
        f"{len(coverage)} entradas de cobertura; {len(pending)} ainda pendentes/parciais. Inventário por sintaxe não equivale a decisão arquitetural de todos os itens.\n\n"+
        '\n'.join(f"- Domínio {d}: {n} entradas pendentes/parciais." for d,n in sorted(Counter(r['domain'] for r in pending).items()))+
        f"\n\nImports sem associação inequívoca: {len(read('unresolved-imports.csv'))}. Candidatos de contratos HTTP não verificados: {len(contracts)}.\n\n"+
        'Arquivos não classificados por linguagem, configurações, dados, documentação e assets continuam em all-repository-files.csv. Entidade sem controller direto não é declarada órfã; eventos/jobs e injeção precisam de leitura.\n\n'+
        'Pendências principais: segurança efetiva de cada endpoint, body/response de cada consumidor, herança/metaanotações Spring, montagem de routers Python, resolução dos imports wildcard/nested e revisão semântica de todos os domínios.\n\n'+
        'Todos os itens possuem domínio de triagem 02–22. A decisão de padrão permanece UNDECIDED quando não houve leitura suficiente. Nenhuma alegação de 100% refatorado ou 100% revisado.\n')
    print(json.dumps({'source_files':len(sources),'tracked_files':len(universe),'coverage_rows':len(coverage),'pending':len(pending),'metrics':metrics},ensure_ascii=False))

if __name__=='__main__':main()
