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


## Continuação: todos os23 implementados em uma colaboração executável

O checkpoint anterior avaliava os23 e implementava Memento no editor. A exigência posterior de todos os padrões gerou FLOW-AUDIT-GOF-003: motor offline integrado à CLI/CI, com32 testes de auditoria e CSV legado preservado. A tabela inicial permanece como decisão histórica do fluxo do editor; a adoção atual por padrão está em PATTERN_COVERAGE.csv e GOF_EXECUTION.md. Todos os23 têm implementação no motor, sem afirmar aplicação em todos os módulos de negócio.

## Aplicações nos lotes de redução

| Lote | Família | Padrão | Arquivo | Motivo |
|---|---|---|---|---|
| R76-heist-exterior-rua | Estrutural | Facade | `components/heist/scene/exterior-alley-tex.ts` | Interface única (reexports) sobre os sete módulos de texturas do beco (ruído, canvas/PBR, chão e paredes, traços e folhas, decalques, placas, texturas pequenas); os consumidores não mudaram de import. |
| R80-seal | Estrutural | Facade | `fai-application/.../service/SealService.java` | O bean público (controllers e outros serviços não mudaram) mantém transações, construtor, records e assinaturas e delega a 15 colaboradores package-private por caso de uso (emissores, Hype, views, formulário, Copilot, candidatos, sugestões, vitrine, medalhões, roteamento, respostas, revisão, promoções). |
| R81-moments | Estrutural | Facade | `fai-application/.../moments/MomentService.java` | O bean público (controllers, `FlairChallengeService`, `CopilotService`, `AdminService` e `ServiceFakes` não mudaram) mantém construtor, constantes, records, `@Transactional`/`@Scheduled` e as 33 assinaturas públicas, e delega a 15 colaboradores package-private por caso de uso (consultas, detalhe, histórico, contexto, participação, envio, avaliação, comunidade, ranking, FLAIR, job, administração), com dependências em `MomentContext` e regras de acesso em `MomentSupport`. |
| R85-dna | Estrutural | Facade | `fai-application/.../service/DnaService.java` | O bean público (`DnaController`, `ServiceFakes`) mantém as 15 transações, o construtor de 16 argumentos, os records e as assinaturas e delega a 8 colaboradores package-private por caso de uso (síntese da Camada 1, frase, visão geral, Identidade de Vida, card PNG, escrita e leitura dos Esquemas de DNA, construtor RF5, propostas da IA) e a 4 classes de regras puras (motor local, narrativas, logos, views). |
| R83-flair-modes | Estrutural | Facade | `fai-application/.../service/FlairModesService.java` | O bean público (`FlairModesController`, `FlairCardModesController`, `FlairService`) mantém construtor, records, constantes e as 30 transações e delega a um colaborador por modo (duelos, liga, runway, world tour, territórios, draft, deck, boss, wardrobe wars, chess, ultimate) sobre looks/cartas e registro de partidas compartilhados. Strategy/Template Method avaliados e descartados: os modos não têm o mesmo ciclo nem são escolhidos em tempo de execução. |
| R90-flair-3d-motor | — | nenhum | `fai-application/.../flair/CbcRules.java` | O `switch` de requisitos (14 tipos + 5 do FLAIR 3D MAKE UP) saiu para `CbcRequirements` (despacho e validação de forma), `CbcRequirementsBoard` (mesa) e `CbcRequirementsTags` (tags da carta); `CbcRules.requirement` delega em uma linha, helpers compartilhados ficaram em `CbcRules` por `import static`. Strategy (uma classe por tipo) e Chain of Responsibility avaliados e descartados: conjunto fechado de tipos escolhidos pelo JSON, dois `switch` estáticos bastam. `Flair3dHype`/`Flair3dEffects` são regras puras novas, não extrações. |
| R90-flair-3d-servico | — | nenhum | `fai-application/.../service/FlairChallengeService.java` | `models()` (carta FLAIR → carta do motor, 33 linhas) saiu para `flair/CbcCardMapper` (estático, recebe o repositório de peças e a função de tags; construtor do serviço intacto, R13) e o serviço delega em uma linha; `FLAIR_3D` e a exclusão dos jogos do `list()` são trocas de linha. Os novos `Flair3dAccess`, `Flair3dRewards`, `FlairGameService`/`FlairGameViews`/`FlairGame3dScore` e `FlairGameController` são composição comum (sequência fixa por rota), sem família de algoritmos nem subsistema a esconder: Strategy e Facade avaliados e descartados. |
| R90-flair-3d-quarto | — | nenhum | `app/(site)/(app)/room/page.tsx` | A tela do Meu Quarto (665 linhas) virou redirecionamento (24) dos links antigos (`/flair/jogos?district=SUITE`, `/mirror`, `/closet`); o espelho 2D que era um branch dela passou a `components/mirror/mirror-page.tsx` (componente) + `use-mirror-page.ts` (hook: `/api/me/mirror`, pins, WebGL, `?vestir=` uma vez por link), hospedados em `/mirror` com item próprio no menu. `MirrorControls` já tinha o `host` opcional para as ações do quarto; sem anfitrião usa o padrão, por isso Strategy/Adapter não foram necessários. |
| R90-flair-3d-flair-card | — | nenhum | `components/flair/flair-game-card.tsx` | A carta FLAIR da peça passou a compor a anatomia do card comum (camadas `.pc-art` + `.pc-frame`, janela Info \| Hype, `FashionCard`/`HypeCardBack`); a arte/cabeçalho/verso simples saíram para `flair-piece-card-art.tsx` e a janela (mesmo DOM de `PieceCardPanels`, com `flairHypeSummary` do snapshot) para `flair-piece-card-panels.tsx`. Decorator/Strategy avaliados e descartados: só o metal varia, por classe CSS. |
