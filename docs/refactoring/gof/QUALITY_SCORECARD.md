# Verificação dos lotes de histórico e inspetor

| Verificação | Resultado | Evidência |
|---|---|---|
| Baseline histórico e caracterização antes da extração |6 testes passaram |evidence/gof-baseline-tests.log; gof-characterization.log |
| Caracterização de transform/material/vertex antes do inspetor |5 testes passaram |evidence/gof-inspector-before.log |
| Regressão final Vitest |14 testes /5 arquivos passaram |evidence/gof-inspector-after.log |
| Auditoria AST, SCC, limites e checkout esparso |14 unittest passaram |evidence/gof-audit-tests-final.log |
| Tipagem sem incremental | passou |evidence/gof-types-final.log |
| Prebuild (styles, design, i18n) e build webpack | passou por completo |evidence/gof-build-final.log |
| Navegador no build de produção | passou: undo/redo, transform/material/vertex e payload; sem pageerror |evidence/browser/result.json |
| Capturas desktop/mobile | geradas com API simulada e GLB sintético |evidence/browser/desktop.png; mobile.png |
| Markup do aside extraído | idêntico, normalizando indentação e alias inspection |evidence/inspector-markup.json |
| Novos ciclos no grafo resolvido |0 |evidence/cycles.json |

Vitest: `npx vitest run components/atelier3d lib/atelier3d`. Python: `python -m unittest scripts.refactoring.test_audit_repository scripts.refactoring.test_inventory_gof scripts.refactoring.test_line_policy`. Tipagem: `npx tsc --noEmit --incremental false`. Build: `NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack`.

A política de linhas tem relatório somente de triagem no CI (.github/workflows/architecture.yml), com testes leves e artefato CSV. Não aprova arquitetura automaticamente pelo tamanho.

História verificada: editar documento no inspetor → política de histórico → cliente HTTP → resposta simulada de versão → estado salvo na UI. A conferência segue a skill Verification. As fronteiras reais Java/banco não foram testadas neste lote; os contratos foram inspecionados e não modificados. Sem deploy ou acesso a serviços pagos.

React revisado segundo react-best-practices: setters funcionais mantidos, sem listener/efeito novo, componentes estáveis fora do render, import de tipo para histórico, permissões e labels mantidos. O JSX do editor inteiro mudou pela composição; não há alegação de pixel parity com a versão anterior.

Ambiente: dependências existentes reutilizadas por symlink temporário; Next16.4.2 instalado vs ^16.4.3 declarado. O build final é local e não valida instalação limpa do lockfile. Tentativas anteriores falharam com disco cheio e depois resolução de módulos ao colocar toda a saída em /tmp. O build final mantém .next no checkout e somente cache em /tmp; passou. Logs anteriores foram preservados para rastreabilidade.

Não executados: JUnit da aplicação, DB/HTTP de backend reais, suíte Vitest inteira, pipeline Python produtivo ou inferência. JavaParser foi compilado/executado apenas como ferramenta sintática.

Runtime combinado915 →981 (+66 linhas), ramos sintáticos135 →135. Melhoria demonstrada: isolamento/testabilidade. Não alegada redução global de complexidade ou melhoria medida de performance.

As capturas contêm ícones estáticos ausentes no checkout esparso. Não foram usadas para aprovar a fidelidade visual global; o fluxo e o payload foram verificados. Nenhum arquivo de identidade visual foi alterado.

## Verificação do motor GoF

32 testes de auditoria passaram após implementar as23 colaborações. Logs em evidence/gof-pattern-tests.log; relatório executado em evidence/gof-pattern-report.log. Este lote altera apenas Python/CI/documentação; os14 testes React, build e browser acima são do lote anterior, cujos arquivos produtivos permaneceram iguais. Nenhum build/reteste de frontend é reivindicado como novo neste lote.

## Continuação Java

Lote FLOW-WARDROBE-STUDIO-004 implementado, com98 testes Java passando. Ver WARDROBE_STUDIO.md, CI_FOLLOWUP.md e evidence/wardrobe-studio-metrics.json. WardrobeService continua CRITICAL/PARTIAL; refatoração integral e falhas amplas de frontend/catálogo continuam pendentes.

## Onda temática 02–20 (19 lotes, um por domínio)

Comandos realmente executados na branch integrada `claude/serene-thompson-yetcg5` após o último lote:

| Verificação | Comando | Resultado | Evidência |
|---|---|---|---|
| Suíte Java completa (14 módulos) | `mvn -B test` | BUILD SUCCESS em 263 s: fai-application 2012, infraestrutura 197 (58+13+18+8+100), fai-web 790, fai-bootstrap 13 = **3012 testes, 0 falhas, 0 erros**, 33 skipped preexistentes | evidence/onda-02-20-suite-java-final.log |
| Suíte Java intermediária (lotes 02–17) | `mvn -B test` | BUILD SUCCESS, 2984 testes, 0 falhas | evidence/integracao-suite-java-completa.log |
| Tipagem TypeScript (após lote 15) | `npx tsc --noEmit -p .` | exit 0 | execução local |
| Vitest do lote 15 | `npx vitest run components/explorer lib/explorer components/explorer-hype.test.tsx` | 14/14 | evidence/15-explorer-insights-after.log |
| Python do lote 18 | `python3 -m unittest scripts.catalog.tests.test_canonical_frame_fixture scripts.catalog.tests.test_canonical_glb` | OK (10 skipped preexistentes sem bundle canônico) | evidence/18-*.log |
| Auditoria + catraca de linhas | `python -m unittest scripts.refactoring.test_audit_repository scripts.refactoring.test_line_policy scripts.refactoring.test_line_ratchet` e `discover -p 'test_gof_*.py'` | OK | — |
| Catraca estrita | `python scripts/refactoring/line_ratchet.py --strict` | 0 violações, baseline apertado | scripts/refactoring/line_baseline.json |

Antes/depois por lote (caracterização no código original → regressão do domínio): ver ONDA-DOMINIOS-02-20.md.

Não executados: suíte Vitest inteira (8 falhas preexistentes conhecidas em `app/pages.smoke.test.tsx`, `lab/heist*`,
reproduzidas no código original pelo lote 15), build Next de produção, navegador, banco/HTTP reais, testes Python que
exigem `scipy`/`pytest`, inferência. Cobertura de linhas (JaCoCo/V8) não foi medida nesta onda.
