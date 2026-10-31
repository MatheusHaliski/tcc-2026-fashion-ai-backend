"""Fixtures for inventory contracts. No application code, network or database is loaded."""
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from scripts.refactoring.inventory_gof import java_endpoints, mappings, python_info, route_path, domain, JAR_DEFAULT, JAVA_DEFAULT


class InventoryContractsTest(unittest.TestCase):
    def test_sparse_or_missing_sources_are_not_silently_excluded(self):
        from scripts.refactoring.inventory_gof import require_present_sources
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            with self.assertRaisesRegex(RuntimeError, '1 source files absent'):
                require_present_sources(root, ['missing.ts'])
            (root/'missing.ts').write_text('export const value = 1;')
            require_present_sources(root, ['missing.ts'])

    def test_line_bands_preserve_exact_prompt_thresholds(self):
        from scripts.refactoring.line_policy import size_band, review_action
        values = {250: 'WITHIN_GENERAL_TARGET', 251: 'REVIEW', 400: 'REVIEW',
                  401: 'PRIORITY', 600: 'PRIORITY', 601: 'HIGH', 1000: 'HIGH', 1001: 'CRITICAL'}
        for lines, expected in values.items():
            with self.subTest(lines=lines):
                self.assertEqual(size_band(lines), expected)
        self.assertEqual(review_action('db/migration/V1.sql', 2000), 'IMMUTABLE_APPLIED_MIGRATION_REVIEW_ONLY')
        self.assertEqual(review_action('components/editor.tsx', 601), 'REVIEW_COHESION_AND_RECORD_REFACTOR_OR_EXCEPTION')

    def test_dependency_cycles_ignore_type_only_edges_and_include_self_cycles(self):
        from scripts.refactoring.reconcile_gof import components
        edges = [
            {'source': 'a', 'target': 'b', 'kind': 'import'},
            {'source': 'b', 'target': 'a', 'kind': 'type_import'},
            {'source': 'c', 'target': 'd', 'kind': 'import'},
            {'source': 'd', 'target': 'c', 'kind': 'import'},
            {'source': 'e', 'target': 'e', 'kind': 'import'},
        ]
        self.assertEqual({tuple(group) for group in components(edges)}, {('c', 'd'), ('e',)})

    def test_next_groups_do_not_become_url_segments(self):
        self.assertEqual(route_path('app/(site)/(app)/pieces/[id]/page.tsx'), '/pieces/[id]')
        self.assertEqual(route_path('app/bff/auth/[action]/route.ts'), '/bff/auth/[action]')
        self.assertEqual(route_path('app/(site)/@modal/(.)pieces/[id]/page.tsx'), '/(.)pieces/[id]')

    def test_composed_spring_mapping_includes_all_path_aliases_and_verbs(self):
        row={'path':'Example.java','types':[{'name':'Example','annotations':{'RestController':{},'RequestMapping':{'path':['/api/a','/api/b']}},'methods':[{
            'name':'read','line':12,'returnType':'Reply','parameters':[], 'calls':['guard.requireOwner'],
            'annotations':{'RequestMapping':{'value':['/{id}','/alias/{id}'],'method':['RequestMethod.GET','RequestMethod.POST']},'ResponseStatus':{'value':'HttpStatus.CREATED'}}}]}]}
        endpoints=java_endpoints(row)
        self.assertEqual(len(endpoints),8)
        self.assertEqual({r['method'] for r in endpoints},{'GET','POST'})
        self.assertIn('/api/b/alias/{id}',{r['route'] for r in endpoints})
        self.assertTrue(all(r['status']=='HttpStatus.CREATED' for r in endpoints))
        self.assertTrue(all('SOURCE_SIGNALS_ONLY' in r['authorization'] for r in endpoints))

    def test_python_ast_does_not_treat_comments_as_routes(self):
        row=python_info('worker.py', '# @app.get("/fake")\n@app.post("/run")\ndef run():\n return None\n')
        self.assertEqual(row['status'],'parsed')
        self.assertEqual([r['route'] for r in row['routes']],['/run'])
        self.assertEqual(python_info('bad.py','def broken(')['status'],'parse_error')

    def test_domain_classification_is_total_but_not_a_semantic_approval(self):
        self.assertEqual(domain('components/atelier3d/editor.tsx'),'06')
        self.assertEqual(domain('scripts/cloud/worker.py'),'18')
        self.assertEqual(domain('lib/utils/misc.ts'),'22')

    def test_typescript_ast_ignores_fake_comments_and_records_unresolved_calls(self):
        script=Path('scripts/refactoring/source-ast.cjs').resolve()
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp);(folder/'fixture.tsx').write_text('// export function Fake() {}\nexport function View() { api.get(url); fetch("/api/ok", {method:"POST"}); return <p/>; }')
            (folder/'files.json').write_text(json.dumps(['fixture.tsx']))
            result=subprocess.run(['node',str(script),str(folder/'files.json')],cwd=folder,check=True,text=True,capture_output=True)
            row=json.loads(result.stdout)
            self.assertEqual([d['name'] for d in row['definitions']],['View'])
            self.assertEqual(row['calls'][0]['route'],'UNRESOLVED_EXPRESSION')
            self.assertEqual(row['calls'][1]['method'],'POST')

    def test_java_ast_handles_records_and_ignores_annotation_text_in_comments(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp);(folder/'Example.java').write_text('''package sample;
// @GetMapping("/fake")
@RestController @RequestMapping(path={"/a","/b"})
class Example {
 @PostMapping("/{id}") public Reply write(@PathVariable String id) { return new Reply(id); }
 record Reply(String id) {}
}''')
            (folder/'files.txt').write_text(str(folder/'Example.java'))
            subprocess.run([JAVA_DEFAULT+'/javac','-cp',JAR_DEFAULT,'-d',tmp,'scripts/refactoring/SourceAst.java'],check=True,capture_output=True)
            result=subprocess.run([JAVA_DEFAULT+'/java','-cp',tmp+':'+JAR_DEFAULT,'SourceAst',str(folder/'files.txt')],check=True,text=True,capture_output=True)
            row=json.loads(result.stdout)
            self.assertEqual(row['status'],'parsed')
            self.assertEqual(len(java_endpoints(row)),2)
            self.assertEqual({e['route'] for e in java_endpoints(row)},{'/a/{id}','/b/{id}'})


if __name__=='__main__':unittest.main()
