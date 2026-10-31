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

    def test_categorias_de_arquivo(self):
        web = 'fai-web/src/main/java/br/com/fashionai/web/controller/'
        app = 'fai-application/src/main/java/br/com/fashionai/application/'
        cases = {
            'lib/hooks/use-fitting-session.ts': 'hook', 'components/catalog/use-catalog-preview.ts': 'hook',
            'components/useThing.tsx': 'hook', 'app/bff/auth/[action]/route.ts': 'route-handler',
            'middleware.ts': 'route-handler', 'app/(site)/(app)/room/page.tsx': 'pagina',
            'app/(site)/layout.tsx': 'pagina', 'components/globe.tsx': 'componente', 'lib/api/client.ts': 'lib-ts',
            'components/heist/scene/interior-fx.ts': 'lib-ts', 'scripts/i18n/extract.js': 'script-js',
            web + 'HypeController.java': 'java-controller',
            'fai-domain/src/main/java/br/com/fashionai/domain/repository/UserRepository.java': 'java-repositorio',
            'fai-domain/src/main/java/br/com/fashionai/domain/model/WardrobeItem.java': 'java-entidade',
            app + 'service/SealService.java': 'java-service', app + 'service/SealPolicies.java': 'java-outro',
            'fai-infrastructure/storage-s3/src/main/java/x/S3MediaStorageAdapter.java': 'java-adapter',
            app + 'dto/PieceRequest.java': 'java-dto', 'scripts/catalog/ingest.py': 'python',
            'app/(site)/_styles/01-tokens-temas.css': 'css', 'scripts/deploy.sh': 'outro',
            'fai-application/src/test/java/x/FooTest.java': 'teste', 'components/globe-hype.test.tsx': 'teste',
        }
        for path, expected in cases.items():
            self.assertEqual(expected, r.category(path), path)

    def test_limites_maximos_por_categoria(self):
        self.assertEqual(150, r.limit('lib/hooks/use-fitting-session.ts'))
        self.assertEqual(150, r.limit('app/bff/auth/[action]/route.ts'))
        self.assertEqual(200, r.limit('fai-web/src/main/java/br/com/fashionai/web/controller/HypeController.java'))
        self.assertEqual(120, r.limit('fai-domain/src/main/java/br/com/fashionai/domain/repository/UserRepository.java'))
        self.assertEqual(250, r.limit('components/globe.tsx'))
        self.assertEqual(400, r.limit('components/globe-hype.test.tsx'))
        self.assertTrue(all(0 < cap <= 400 for cap in r.CATEGORY_LIMITS.values()))
        violations, _ = r.check({'lib/hooks/use-x.ts': 151, 'lib/hooks/use-y.ts': 150,
                                 'fai-web/src/main/java/a/web/controller/AController.java': 201}, {})
        self.assertEqual(2, len(violations))
        self.assertIn('(hook)', violations[1])

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
            self.assertGreater(entry['max'], r.limit(path), path)


if __name__ == '__main__':
    unittest.main()
