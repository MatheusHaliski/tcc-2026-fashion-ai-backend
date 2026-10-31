# FLOW-AUDIT-GOF-003 — implementações executáveis dos23 padrões

Escopo: motor offline de auditoria de fontes. A CLI existente line_policy.report agora usa AuditFacade; o workflow architecture.yml executa os contratos novos. Nenhuma aplicação Spring/React, schema ou integração produtiva foi alterada por este lote. Essa adoção não significa que todos os arquivos do projeto foram refatorados.

O usuário exigiu os23 padrões no próximo commit. A implementação os concentra em uma colaboração local verificável, preservando a saída CSV anterior. É uma expansão deliberada da ferramenta, não uma alegação de simplificação: runtime da CLI e motor passou de58 para611 linhas (+553). Módulos novos:119,158,40,85,86 e71 linhas. A meta geral de250 permanece respeitada.

## Fluxo real

CLI descobre fontes versionadas → Facade obtém família local → fábrica cria leitor com proxy e decorator → bridge/validações/template/strategy produzem registros imutáveis → Interpreter seleciona somente se query explícita → Mediator coordena estados, eventos, comandos e checkpoint → Builder produz relatório → árvore Composite, Visitor e Iterator geram/conferem resumo → Adapter grava CSV atomicamente.

Por padrão todos os fontes continuam incluídos. `--query "lines > 1000"` é triagem explicitamente filtrada, nunca substitui a matriz global. A saída anterior é preservada byte a byte no teste de contrato. O reader nunca carrega módulos da aplicação nem acessa rede/banco.

|Família|Padrão|Implementação|Colaboração|
|---|---|---|---|
|Criacionais|Factory Method|`creation.py:63` · `ReaderCreator`|Creator.read delega a criação substituível de leitores, usada no scan real.|
|Criacionais|Abstract Factory|`creation.py:100` · `AuditFamily`|Família de leitores e writers substituível; implementação local e família em memória no contrato.|
|Criacionais|Builder|`model.py:47` · `ReportBuilder`|Constrói relatório imutável por observações ordenadas.|
|Criacionais|Prototype|`model.py:22` · `SourceRecord`|clone preserva o fonte imutável e aplica digest/política em novas visões.|
|Criacionais|Singleton|`creation.py:11` · `AuditDefaults`|Única configuração imutável por processo, sem dados de sessão ou recursos produtivos.|
|Estruturais|Adapter|`creation.py:81` · `CsvReportAdapter`|Adapta AuditReport ao write_csv existente, mantendo bytes e colunas.|
|Estruturais|Bridge|`execution.py:33` · `SourceScan`|Abstração de scan varia separadamente da implementação/fábrica do leitor.|
|Estruturais|Composite|`tree.py:15` · `SourceGroup`|Grupos e folhas formam árvore de fontes por tipo, usada no resumo.|
|Estruturais|Decorator|`creation.py:53` · `DigestReader`|Envolve leitura com digest de proveniência sem duplicar leitura/classificação.|
|Estruturais|Facade|`facade.py:11` · `AuditFacade`|Ponto de entrada integrado ao report da CLI de limites.|
|Estruturais|Flyweight|`model.py:10` · `FileKinds`|Compartilha descritor imutável de extensão entre registros do inventário.|
|Estruturais|Proxy|`creation.py:42` · `ScopedReader`|Confere escopo real antes da leitura, incluindo escape por symlink.|
|Comportamentais|Strategy|`execution.py:52` · `LineStrategy`|Reutiliza callbacks da política de linhas existente sem replicar limiares.|
|Comportamentais|State|`execution.py:97` · `ScanState`|Ready/Running/Complete/Failed controlam operações e repetição após falha.|
|Comportamentais|Template Method|`execution.py:61` · `FilePipeline`|Algoritmo scan→classify fixo com hook de classificação.|
|Comportamentais|Observer|`execution.py:83` · `Events`|Eventos de lifecycle alimentam telemetria; unsubscribe evita reter observers.|
|Comportamentais|Mediator|`execution.py:127` · `AuditCoordinator`|Coordena pipeline, seleção, montagem, rollback, estados e eventos.|
|Comportamentais|Memento|`model.py:37` · `ReportSnapshot`|Checkpoint da montagem restaurado se o scan falha; não é backup de banco.|
|Comportamentais|Command|`model.py:70` · `AddRecord`|Operação de montagem executável e reversível; rollback em ordem inversa.|
|Comportamentais|Chain of Responsibility|`execution.py:7` · `ValidationStep`|Cadeia relativa/presente falha antes de ler o fonte.|
|Comportamentais|Iterator|`tree.py:28` · `SourceIterator`|Percorre folhas sem expor armazenamento, conferindo cardinalidade do relatório.|
|Comportamentais|Visitor|`tree.py:58` · `BandSummary`|Agrega faixas/tipos sem alterar as classes da árvore ou o leitor.|
|Comportamentais|Interpreter|`query.py:38` · `QueryParser`|Gramática limitada de lines/band com and/or e parênteses; sem eval ou execução de código.|

## Verificação

32 testes locais de auditoria passaram (incluindo18 testes novos das colaborações); teste de CSV byte a byte, valores e ordenação, inventário vazio, família alternativa de I/O, fontes imutáveis, parsing seguro, falha antes de I/O, symlink fora da raiz, rollback, estados inválidos, falha de observer sem perder causa original e falha de writer sem substituir artefato anterior.

Comando: `python -m unittest scripts.refactoring.test_audit_repository scripts.refactoring.test_inventory_gof scripts.refactoring.test_line_policy scripts.refactoring.test_gof_model scripts.refactoring.test_gof_query scripts.refactoring.test_gof_execution scripts.refactoring.test_gof_creation`.

Matriz por padrão: PATTERN_COVERAGE.csv. Cada evidência aponta classe e teste existentes; o escopo IMPLEMENTED_OFFLINE_AUDIT não certifica adoção global em regras de negócio. A auditoria semântica dos demais arquivos permanece pendente.
