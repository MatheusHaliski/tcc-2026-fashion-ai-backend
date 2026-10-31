# Decisões dos 23 padrões — escopo do primeiro lote

Candidato significa hipótese de lote futuro, não recomendação aprovada nem aplicação concluída. A decisão por arquivo permanece UNDECIDED até revisão.

| Família | Padrão | Decisão neste fluxo | Justificativa |
|---|---|---|---|
| Criacionais | Factory Method | Candidato | Construção de provedores somente se existir variação de criação; não necessário para snapshots. |
| Criacionais | Abstract Factory | Não aplicado | Nenhuma família de produtos acoplados demonstrada no fluxo. |
| Criacionais | Builder | Não aplicado | Objeto SceneHistory pequeno; funções e literais bastam. |
| Criacionais | Prototype | Não aplicado | structuredClone existente mantido nos mesmos limites; não introduzido protocolo de clones. |
| Criacionais | Singleton | Não aplicado | Nenhum estado global novo; lifecycle Spring/React preservado. |
| Estruturais | Adapter | Candidato | Fronteiras HTTP/ports merecem revisão por contrato; não modificadas neste lote. |
| Estruturais | Bridge | Não aplicado | Dois eixos independentes não demonstrados no histórico. |
| Estruturais | Composite | Não aplicado | Grafo de cena existente não é reestruturado. |
| Estruturais | Decorator | Não aplicado | Sem necessidade comprovada de composição de comportamentos. |
| Estruturais | Facade | Candidato | Coordenadores extensos devem expor casos de uso coesos; não mascarar god service. |
| Estruturais | Flyweight | Não aplicado | Nenhuma medição de memória justifica compartilhamento novo. |
| Estruturais | Proxy | Não aplicado | Nenhum acesso lazy/remoto novo. |
| Comportamentais | Strategy | Candidato | AiEngine recebe List<AiProviderPort>; revisar seleção e contratos antes de alterar. |
| Comportamentais | State | Candidato | Estados de processamento exigem tabela de transições antes de substituir condicionais. |
| Comportamentais | Template Method | Não aplicado | Herança não necessária para o histórico ou auditoria. |
| Comportamentais | Observer | Candidato | Listeners transacionais existentes em ChallengeService; preservar fase after-commit. |
| Comportamentais | Mediator | Não aplicado | Não introduzir coordenador global de eventos para editor local. |
| Comportamentais | Memento | Aplicado neste lote | SceneHistory guarda documentos; commit, undo/redo e reset isolados com janela existente de30. |
| Comportamentais | Command | Não aplicado | Snapshots já resolvem desfazer; comandos serializáveis não requeridos. |
| Comportamentais | Chain of Responsibility | Candidato | Validações de pipeline precisam ordem e semântica de falhas caracterizadas. |
| Comportamentais | Iterator | Não aplicado | Coleções nativas suficientes; paginação HTTP não alterada. |
| Comportamentais | Visitor | Não aplicado | Auditoria usa visitantes AST de bibliotecas; não adicionada hierarquia de domínio. |
| Comportamentais | Interpreter | Não aplicado | Nenhuma DSL de domínio exigida pelo fluxo. |


Segundo lote: composição React por responsabilidade (inspetor e campos), sem novo padrão GoF. Não se introduziram classes de UI, hook genérico, mediator ou command bus para reduzir linhas.


## Cobertura completa das três famílias

O catálogo de acompanhamento contém exatamente5 criacionais,7 estruturais e11 comportamentais, sem omissões ou duplicações. PATTERN_COVERAGE.csv distingue uso existente inspecionado, implementação deste PR e pendência. Cada arquivo continua precisando de decisão na matriz de cobertura; reconhecer um padrão em um módulo não o aplica automaticamente ao projeto inteiro.

As três famílias têm exemplos reais identificados: Builder na construção de ShoePart; Adapter no rembg; Strategy no enquadramento por categoria; Observer nos eventos transacionais; Memento no histórico isolado deste PR. Os quatro primeiros são implementações existentes e não foram introduzidos por este lote.

Os outros18 padrões permanecem com análise/aplicação global pendente. Não há alegação de que todos os23 foram implementados neste PR. Singleton gerenciado pelo Spring, árvore Three.js e nomes como Interpreter não são contados automaticamente como aplicações GoF sem verificar sua colaboração real. O critério original continua sendo utilidade arquitetural comprovada, sem implementar classes artificiais apenas para completar catálogo.
