# Verificações reais — lote arquitetural inicial

Todos os comandos foram executados no checkout `/workspace/fashionai-refactoring`, usando fontes da main `a4c9e5d1`. Não houve banco, storage real, inferência ou GPU. As APIs do navegador e os repositórios dos testes são simulados somente em testes.

## Baseline e regressão

| Verificação | Antes | Depois |
|---|---|---|
| Vitest: expanded-card, expanded-card-opcoes e piece-references | 46 passaram | Os mesmos 46 passaram. |
| PieceCardPanels: dois contratos adicionados antes da extração | 2 passaram | 2 passaram; total frontend 48. |
| Java: WardrobeServiceParsersTest + PieceConservationServiceTest | 43 passaram (32 + 11) | 43 passaram. |
| Python: test_photo_set_lot + test_whole_frame_variant_context | 2 falharam, 4 passaram, 5 subtests passaram | Mesmos resultados e mesmos casos de falha. |
| Novos testes de artefatos | Não existiam | 4 passaram. |
| TypeScript `tsc --noEmit` | Passou | Passou. |
| Cobertura agregada | N/D — não executada | N/D — não executada. |

## Comandos

```sh
node_modules/.bin/vitest run components/expanded-card.test.tsx components/expanded-card-opcoes.test.tsx components/piece-card-panels.test.tsx components/piece-references.test.tsx
node_modules/.bin/tsc --noEmit
JAVA_HOME=/workspace/.tooling/jdk21 /workspace/.tooling/maven/bin/mvn -o -Dmaven.repo.local=/workspace/.tooling/m2 '-DargLine=-javaagent:/workspace/.tooling/m2/org/mockito/mockito-core/5.23.0/mockito-core-5.23.0.jar' -pl fai-application -am -Dtest=WardrobeServiceParsersTest,PieceConservationServiceTest -Dsurefire.failIfNoSpecifiedTests=false test
PYTHONPATH=/workspace/.tooling/catalog-python python -m pytest scripts/catalog/tests/test_photo_set_lot.py scripts/catalog/tests/test_whole_frame_variant_context.py -q
PYTHONPATH=/workspace/.tooling/catalog-python python -m pytest scripts/catalog/tests/test_photo_set_artifacts.py -q
python -m unittest scripts.refactoring.test_audit_repository
```

Os testes novos de artefatos validam bytes sem reencodificação, PNGs whole/fabric, dimensões, rejeição de traversal, corrupção, tamanho excedido e symlink; conferem chave por versão/hash, leitura de volta e fechamento do stream. O worker ainda exporta ready_files/upload.

As duas falhas Python foram reproduzidas antes de qualquer refatoração de produção:

- `ExportRowsTest.test_exporta_so_fotos_sem_photo_set_atual`: esperava 2 linhas; recebeu 3.
- `ImportLotTest.test_ensaio_conta_sem_gravar_e_apply_sobe_e_grava_com_cas`: a contagem obtida diverge da fixture (READY/REVIEW).

As fixtures não fornecem a evidência de qualidade exigida pelo gate atual. Isso é um achado para investigação separada, não prova de que a política deva ser afrouxada. Os testes foram mantidos sem alterações.

## Navegador e preservação de UI

Script: `scripts/refactoring/browser-regression.cjs before|after`, servidor Next local na porta 3120, `DEV_GATE_ENABLED=false` somente no processo de teste. Respostas fictícias explicitamente confinadas ao script Playwright. Nenhum mock foi adicionado ao runtime de produção.

- Antes: 9 capturas; execução completa, sem pageerror.
- Depois: 6 capturas utilizáveis — modal Info, modal Hype e diálogo Editar dados em desktop/mobile. Primeira execução interrompida por queda do Chromium ao entrar em cenário de erro; segunda interrompida por timeout ao abrir a grade. O script não concluiu o conjunto posterior.
- [Comparação estruturada](evidence/comparison.json): três imagens mobile idênticas pixel a pixel. Desktop tem diferenças localizadas de ícone da navegação e estado visual da aba; dimensões das capturas iguais. Não se declara equivalência pixel a pixel global.
- Loading/erro/vazio posteriores: não capturados. Os cenários antigos continuam cobertos pelos testes de componentes, mas falta evidência visual posterior.
- Teclado: teste unitário comprova seleção e foco juntos; initial acompanha a prop até a primeira seleção manual; IDs/associações ARIA permanecem estáveis após rerender.
- Corpos de seis funções React comparados via AST com a versão original: idênticos byte a byte. PieceCardPanels não foi modificado. Nenhum wrapper DOM adicional foi introduzido pela facade.

## Lint, tradução e build

- `npm run lint:styles`: passou.
- `node scripts/ux/check-design.cjs`: passou.
- `node scripts/i18n/check.js --fail`: 0 erros, 10 avisos.
- `node scripts/i18n/scan.js --fail`: 0 textos embutidos.
- ESLint: o projeto não declara script nem dependência de ESLint; não foi inventado um comando ou instalada outra ferramenta.
- `node_modules/.bin/next build --webpack`: compilou com avisos e iniciou geração de páginas; falhou com `ENOSPC: no space left on device` ao criar diretórios em `.next/server/app`. Build completo NÃO passou. O cache gerado neste checkout foi removido depois; o log do erro foi preservado em excerto.
- Dependências reutilizadas do ambiente: Next 16.4.2 instalado, enquanto esta revisão declara ^16.4.3. Não foi executado npm ci por restrição de disco. Resultados não certificam o lockfile exato.
- Maven usa Java 21 e cache local. Não foi iniciado Spring contra o banco de produção.

O scanner/inventário usa apenas Git e stdlib, sem importar módulos da aplicação. Os comandos CLI Python por módulo e arquivo com `--help` terminaram com saídas idênticas. Não foram executadas operações --apply ou --watch.
