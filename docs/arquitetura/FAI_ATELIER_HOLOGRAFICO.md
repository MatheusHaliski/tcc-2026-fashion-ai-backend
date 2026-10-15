# FAI Atelier: identidade, memória e recompensas

Incremento sobre a `main` de 15/10/2026, incluindo a versão inicial do Atelier do PR #296. O hub substitui a apresentação anterior sem remover o acervo de fotos ou as ferramentas de edição.

## 1. Rotas e navegação

- `/atelier`: hub autenticado; a sub-aba é preservada em `?tab=metamorphoses|timeline|trends|room`.
- `/photos`: redirecionamento HTTP para `/atelier`, já existente em `next.config.ts` e verificado no navegador.
- `/atelier/galeria`: biblioteca completa, com filtros, seleção, exclusão confirmada, editor, comparação, curadoria e histórico. A mesma biblioteca pode ser aberta dentro de Metamorfoses.
- Sidebar: **FAI Atelier**. O atalho de envio continua abrindo a biblioteca existente.
- Links do histórico encaminham para a linha do tempo do Atelier.

## 2. Dados e concessões

`AtelierRewardGrant` e a migração **V70** persistem direitos por proprietário. Cada concessão contém categoria, código, título/descrição, origem, referência da origem, referência ao recurso, validade e revogação. O histórico auditável vem da entidade base. A exclusão definitiva da conta remove os registros por chave estrangeira com cascade.

| Categoria | Conteúdo representado | Referência esperada da integração |
| --- | --- | --- |
| `auraSignature` | Efeitos/animações desbloqueados | preset ou direito de arte |
| `garmentMemory` | Capítulos da história de uma peça | peça e evento confirmado |
| `habitableTrofeus` | Objetos funcionais do quarto | unidade real do inventário |
| `directorPower` | Permissões de autoria | regra/permissão de cenário |
| `collectiveWork` | Fragmentos de uma instalação | instalação/equipe |
| `seasonPasses` | Convites de temporada | jornada ou temporada |

`AtelierRewardSystem.grant` é uma porta **interna** para serviços confiáveis. Não há endpoint HTTP que aceite uma recompensa escolhida pelo cliente. As origens aceitas são FLAIR, HYPE, ATELIER_PROJECT, SEAL, SEASON e TEAM. O bloqueio do proprietário e a chave única `(owner, category, code, sourceType, sourceReference)` tornam o registro idempotente pela mesma origem. Registrar uma concessão não credita FAI Points.

`GET /api/me/atelier` verifica a sessão e retorna somente as categorias do usuário, ocultando concessões revogadas/expiradas, e a progressão fornecida pelo serviço já existente. Não há nível fictício calculado pela contagem de troféus.

Esta entrega estrutura o registro e a leitura de direitos. Os emissores de partidas, selos, temporadas e projetos ainda precisam chamar a porta com fatos de domínio confirmados. Uma referência cadastrada, por si só, não concede permissões de jogo, gera um móvel ou transfere uma licença de arte: esses sistemas continuam sendo as autoridades dos recursos respectivos.

## 3. As quatro áreas

### Metamorfoses

A bancada consulta fotos do próprio usuário vinculadas a peças. Antes de compor a prévia, relê a peça e verifica o proprietário. A permissão Impersonation vem de `/api/me/aura-permissions`; acesso desconhecido ou abaixo de Loft mantém a ação bloqueada.

A prévia usa `AuraContextEngineService`, fingerprint/cache e a porta de worker já existentes. Marca, estilos e ocasião vêm da peça, sem inferir nacionalidade ou colaboração ausentes. O card reutilizável oferece profundidade, tilt e mídia animada.

**Limite explícito:** o worker atual é `MockFashionMotionWorker`. Ele compõe uma demonstração sobre a foto e apresenta `MOCK_PREVIEW`. Não segmenta a pessoa, não comprova vestimenta, não transfere movimento, não concede raridade e não substitui nem salva a foto/card. Não há transferência da fotografia para um provedor externo neste fluxo. A futura geração real exige worker, consentimento, fila, verificação e persistência do resultado.

A troca/edição real da foto continua disponível pela biblioteca original. As URLs de mídia relativa no card agora são resolvidas pelo cliente de API, preservando a separação entre a origem do frontend e a do backend.

### Linha do Tempo

Consulta `/api/me/photos/timeline`, deduplica e ordena as fotos por data, permite filtrar por peça/look e selecionar capítulos. O capítulo selecionado é trazido à frente com transformação de profundidade; a mudança de posição usa FLIP via Web Animations, com identidade estável por card. Capítulos de recompensas registrados aparecem separadamente das fotografias: uma foto não é apresentada como partida ou colaboração que não ocorreu.

### Tendências

Consulta `/api/hype/trending?type=PIECE&window=7&limit=18`, com atualização a cada 30 segundos enquanto a página está visível e atualização manual. O cálculo/cache do backend determina a atualidade final; não há promessa de streaming em tempo real.

As matrizes contam estilos/cores nas peças públicas da amostra. A variação média usa apenas `deltaPoints` medidos de Hype disponível; ausências não são convertidas em zero e dados pendentes não simulam crescimento. As cartas encaminham para as peças; explorar uma peça não concede sua aura.

### Conquistas & Quarto

Mostra concessões reais das categorias de quarto, direção, equipe e temporadas. Lista também os objetos já adquiridos retornados pela loja existente, distinguindo inventário de recompensa.

**Instalar** abre confirmação e seleção de módulo compatível. Só então chama `/api/me/room-inventory/{inventoryId}/apply`, que valida proprietário e encaixe e atualiza o layout real. Não há nova compra nem débito de FAI Points. O link abre `/room` para visualizar o resultado.

O painel reutiliza os objetos/módulos suportados pelo Quarto atual. Ainda não cria novos GLBs de troféus, projeções de cartas em móveis ou instalações coletivas 3D; isso exige ampliar o catálogo e o renderizador do Quarto.

## 4. Motor holográfico

`components/atelier/holographic-fx.tsx` expõe:

- `HologramCircleStream`: arcos vetoriais em Canvas 2D, resolução limitada e atualização de até 30 FPS. Interrompe o loop fora da tela ou com a página oculta.
- `DataTunnelPipes`: tubos SVG translúcidos e fluxo animado, sem dependência de WebGL.
- `NeonArrowFlow`: setas vetoriais pulsantes decorativas.
- `ShiftingCardsGrid`: entrada, reordenação FLIP e profundidade CSS; não instala Framer Motion nem cria um contexto WebGL por card.
- `HolographicFxEngine`: composição dos fundos decorativos.

Todos os fundos são ignorados por leitores de tela e não capturam cliques. A navegação funciona por teclado; há estados de carregamento, erro, vazio e bloqueio. `prefers-reduced-motion`, a preferência do app e o botão **Pausar efeitos** interrompem animações/depth do hub. O card de mídia mantém seu próprio controle de reprodução e respeita as preferências globais.

## 5. Verificação e publicação

Os testes cobrem concessões por proprietário, validade/revogação, idempotência, ausência de crédito financeiro, gates antes do processamento, prévia sem escrita no card, filtro da linha do tempo, instalação somente após confirmação e agregação de tendências sem inventar sinais. Capturas desktop/mobile estão em `docs/testes/atelier-holografico-2026-10-15`.

As capturas usam a interface real com **API autenticada simulada**. Não comprovam concessões em contas de produção, implantação no Railway, aplicação da V70 ou geração de movimento por IA. Migrações e implantação em produção não foram executadas nesta alteração.

## 6. Compatibilidade da base

A `main` trazia imports/campos duplicados de FashionCard, contratos antigos e novos incompatíveis, uma chamada ao editor de borda removido e duas fontes menores que o mínimo do Stylelint. Este incremento preserva os contratos legados como união tipada, amplia o mapa de VFX, remove a chamada/picker duplicados e ajusta as duas fontes para 12 px. Os testes do componente legado foram executados para preservar seu comportamento.
