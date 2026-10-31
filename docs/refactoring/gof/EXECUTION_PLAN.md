# Execução progressiva em todo o repositório

1. Auditoria00/01: fotografia por AST, dependências, contratos candidatos e top30; executada. Manter PENDING para análise semântica não realizada.
2. Lote FLOW-A3D-HISTORY-001: histórico puro do Atelier; implementado e testado. Editor inteiro continua PARTIAL.
3. Próximos lotes independentes: cliente/API do Atelier; edição de peça e FKs; catálogo/imagens; provedores AI; recompensas/listeners. Escolher uma responsabilidade real por lote e confirmar caracterização antes da extração.
4. Cobrir todos os domínios02–22 conforme COVERAGE.csv. Para cada arquivo: manter justificado, refatorar com evidência ou registrar exceção. Não dividir por quantidade arbitrária de linhas.
5. Java: preservar transações, fronteiras de autorização, lazy loading e consultas; não mover método entre beans sem caracterização de proxy. Python: importar somente fixtures seguras, impedir rede/inferências durante testes. React: preservar DOM, efeitos, cleanup, acessibilidade e estados assíncronos.
6. Por lote: teste de referência → alteração → teste equivalente → tipagem/build aplicáveis → métricas combinadas original+extraídos → reconciliação21/22. Qualquer falha permanece reportada.
7. Fechamento global somente quando cada entrada tiver decisão e evidência; não usar este checkpoint como conclusão integral. Publicação em PR autorizada na continuação; sem deploy ou mudanças de produção neste escopo.

Reprodução do inventário: `python scripts/refactoring/inventory_gof.py --output docs/refactoring/gof`; reconciliação: `PYTHONPATH=. python scripts/refactoring/reconcile_gof.py`. Requer Node+TypeScript AST e Java21+JavaParser já provisionados (caminhos configuráveis no script). Não importa serviços da aplicação.

Para outro ambiente, configurar `FAI_AUDIT_JAVA_BIN` (diretório bin do JDK21) e `FAI_AUDIT_JAVAPARSER_JAR` (jar JavaParser). O parser TS usa a dependência existente `typescript-ast`; executar na raiz do checkout com dependências instaladas.


Continuação autorizada: FLOW-A3D-INSPECTOR-002 implementado. Publicação em PR autorizada pelo usuário; deploy, migrations de produção e inferência paga continuam fora do escopo. A matriz global e as prioridades de linhas continuam obrigatórias até avaliar todos os arquivos.
