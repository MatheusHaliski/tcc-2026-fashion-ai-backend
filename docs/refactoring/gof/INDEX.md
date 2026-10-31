# Refatoração progressiva — auditoria e editor3D

Checkout: /workspace/fashionai-refactoring. Branch: refactor/atelier-history-inspector, criada sobre main7b473d2b. O PR anterior414 já integrou as extrações anteriores de cards/taxonomia/fotos; este lote não as reivindica como novas. O checkout original com WIP foi preservado.

## Alterações efetivas

1. Histórico local puro em lib/atelier3d/history.ts: Memento existente, janela30, undo/redo, reset e descarte do ramo redo após edição.
2. SceneInspector: resolve o objeto/material selecionado, restrições de malha e patches do documento. SceneFields: entradas controladas para vetores e materiais, com validação numérica/conversões existentes. Editor continua dono da sessão, acesso, dirty flags, autosave e persistência.
3. Auditoria AST/offline para todo o repositório, reconciliação de cobertura e política de linhas. Checkout esparso incompleto agora acusa erro em vez de omitir fontes.

Editor915 →632 linhas (-30,93%). Runtime combinado915 →981 (+66): editor632, histórico38, inspetor200 e campos111. Ramos sintáticos combinados135 →135. A melhoria comprovada é coesão/testabilidade, não redução global de complexidade. Métricas e contagens exatas em audit-metadata.json e evidence/metrics.json.

## Evidências

- [Política de limites](LINE_LIMITS.md) e [fila de todos os fontes](LINE_LIMITS.csv)
- [Entradas](INPUTS.md), [inventário00](00-RESULTADO.md), [arquitetura01](01-RESULTADO.md)
- [23 padrões](PATTERN_DECISIONS.md), [fluxos](full-call-graph.md)
- [Reconciliação documental](DOCUMENTATION_GAPS.md)
- [Plano](EXECUTION_PLAN.md), [riscos](RISK_REGISTER.md), [verificações](QUALITY_SCORECARD.md)
- [Cobertura21](21-RESULTADO.md), [reconciliação22](22-RESULTADO.md), [pendências](RESIDUAL_FINDINGS.md)

A revisão/refatoração integral continua em andamento. COVERAGE_FINAL significa fechamento deste lote; o editor continua PARTIAL, e arquivos não avaliados continuam PENDING. Não houve deploy, mudança de banco ou inferência paga.

## Terceiro lote:23 padrões executáveis

[GOF_EXECUTION.md](GOF_EXECUTION.md) e [PATTERN_COVERAGE.csv](PATTERN_COVERAGE.csv) documentam as implementações das famílias5/7/11 integradas ao relatório de limites.32 testes da auditoria passaram; o contrato CSV anterior é preservado. O escopo desse lote é a ferramenta offline, não uma refatoração integral já concluída.

Publicação do PR autorizada na continuação. A matriz mantém pendências explícitas; não há certificação de edição/refatoração completa de todos os arquivos.

## Continuação Java

Lote FLOW-WARDROBE-STUDIO-004 implementado, com98 testes Java passando. Ver WARDROBE_STUDIO.md, CI_FOLLOWUP.md e evidence/wardrobe-studio-metrics.json. WardrobeService continua CRITICAL/PARTIAL; refatoração integral e falhas amplas de frontend/catálogo continuam pendentes.
