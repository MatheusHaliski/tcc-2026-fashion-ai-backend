import unittest

from scripts.refactoring import line_ratchet as r


class LineRatchetTest(unittest.TestCase):
    def test_classifica_testes_e_producao(self):
        for path in ('fai-application/src/test/java/A.java', 'app/x.test.tsx', 'lib/a.spec.ts',
                     'scripts/refactoring/test_x.py', 'tests/e2e/a.ts', 'test-utils/render.tsx'):
            self.assertEqual('test', r.kind(path), path)
        for path in ('fai-application/src/main/java/A.java', 'app/(site)/page.tsx', 'scripts/latest.py'):
            self.assertEqual('production', r.kind(path), path)

    def test_escopo_ignora_docs_migrations_e_nao_codigo(self):
        self.assertTrue(r.governed('lib/a.ts'))
        self.assertFalse(r.governed('docs/x.py'))
        self.assertFalse(r.governed('fai-infrastructure/src/main/resources/db/migration/V1__a.sql'))
        self.assertFalse(r.governed('fai-domain/src/main/java/db/migration/V2__b.java'))
        self.assertFalse(r.governed('pom.xml'))
        self.assertFalse(r.governed('node_modules/a/b.js'))

    def test_arquivo_novo_respeita_limite_por_tipo(self):
        violations, _ = r.check({'lib/a.ts': 250, 'lib/b.ts': 251, 'app/c.test.ts': 400, 'app/d.test.ts': 401}, {})
        self.assertEqual(['app/d.test.ts', 'lib/b.ts'], [v.split(':')[0] for v in violations])

    def test_arquivo_congelado_nao_cresce_mas_pode_diminuir(self):
        baseline = {'lib/big.ts': {'max': 900}}
        self.assertEqual(([], []), r.check({'lib/big.ts': 900}, baseline))
        violations, _ = r.check({'lib/big.ts': 901}, baseline)
        self.assertIn('cresceu para 901', violations[0])
        violations, stale = r.check({'lib/big.ts': 700}, baseline)
        self.assertEqual([], violations)
        self.assertEqual(['lib/big.ts: teto 900 -> 700'], stale)

    def test_update_so_aperta_e_remove_quem_voltou_ao_limite(self):
        baseline = {'lib/a.ts': {'max': 900, 'reason': 'x'}, 'lib/b.ts': {'max': 300}, 'lib/gone.ts': {'max': 500},
                    'lib/c.ts': {'max': 400}}
        out = r.tightened({'lib/a.ts': 700, 'lib/b.ts': 240, 'lib/c.ts': 450}, baseline)
        self.assertEqual({'lib/a.ts': {'max': 700, 'reason': 'x'}, 'lib/c.ts': {'max': 400}}, out)

    def test_baseline_versionado_esta_ordenado_e_acima_do_limite(self):
        files = r.load()
        self.assertEqual(sorted(files), list(files))
        for path, entry in files.items():
            self.assertGreater(entry['max'], r.LIMITS[r.kind(path)], path)


if __name__ == '__main__':
    unittest.main()
