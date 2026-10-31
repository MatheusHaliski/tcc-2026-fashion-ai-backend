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
