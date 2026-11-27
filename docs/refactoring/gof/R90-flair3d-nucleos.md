# R90 — FLAIR 3D: núcleos, briefs do MAKE UP e elencos do CBC (Strategy)

Contrato: `docs/flair/flair-3d/BASE_NUCLEOS.md`.

**Problema concreto.** Três famílias de regras com o mesmo ciclo, escolhidas em tempo de execução pelo código que vem
na rota: os 15 núcleos do FLAIR 3D (definição, efeito de cada carta e pontuação), os briefs do FLAIR 3D MAKE UP (nível
mínimo, regras e nota) e os cinco elencos do FLAIR Card Building Challenge (formação, linhas e requisitos). Cada jogo
derivado novo é "mais uma classe" com as mesmas operações, e o serviço não pode crescer um `switch` por jogo.

**Decisão: Strategy.**

| Papel | Núcleos | MAKE UP | Elencos |
| --- | --- | --- | --- |
| Strategy | `flair3d/Flair3dNucleo` | `flair3d/makeup/FlairMakeUpBrief` | `flair3d/cbc/FlairCbcElenco` |
| Estratégias concretas | `flair3d/nucleos/*Nucleo` (15) | `flair3d/makeup/briefs/*Brief` (3) | `flair3d/cbc/elencos/QuebraCabeca` (dados, 10 elencos) |
| Registro (escolha pelo código) | `Flair3dNucleos` | `FlairMakeUpBriefs` | `FlairCbcElencos` |
| Contexto | `Flair3dNucleoService` | `FlairMakeUpService` | `FlairCbcSquadService` |

O contexto faz o que é comum (sessão, dono da partida, deck, cartas da pessoa via `Flair3dCartas`, forma da entrega em
`Flair3dEntregas`, persistência, edição/Prestígio) e delega só o que varia. As estratégias são puras (sem I/O): recebem
`Entrega` e `Contexto` (cartas no formato `CbcRules.Card`, país da marca, sorteio semeado) e devolvem `Resultado`.
Leituras de carta compartilhadas ficaram em classes de regras puras (`Flair3dPecas`, `Flair3dAtributos`,
`Flair3dZonas`, `Flair3dBeleza`), e a avaliação de links/química dos elencos reaproveita `CbcLinks` e a DSL de
`CbcRules` em `FlairCbcAvaliacao`.

**Alternativas descartadas.** Template Method (uma classe-base abstrata com a pontuação em passos): os núcleos não têm
os mesmos passos (rounds, zonas, resposta, maquiagem), só a mesma interface. Um `switch` no serviço: cresceria a cada
jogo derivado e misturaria I/O com regra. Beans Spring por estratégia: as estratégias não têm dependências, então um
registro estático basta e os testes instanciam sem contexto.

**Partidas em etapas (sem padrão novo).** DRESS_FIGHTER (um round por vez, com a carta Especial), FASHION_SPORTS
(intervalo com troca) e LABIRINTO (várias apresentações) continuam sendo a mesma Strategy: `pontuar(entrega, contexto)`
segue puro e recebe no `Contexto` o `Andamento` (tentativa e acionamentos). O núcleo recalcula a partida inteira a
partir da semente, da entrega e do andamento, e diz no `status` do `Resultado` se a partida fecha, espera um
acionamento (`EM_ACAO`) ou aceita outra entrega (`ABERTA`); o serviço só grava o que o núcleo devolveu. Alternativa
descartada: State com uma classe por etapa e o estado da luta serializado, que duplicaria a regra do round em cada
estado e abriria espaço para o estado gravado divergir da semente. A prévia é um método `default` da Strategy
(`previa`), que só os dois jogos automáticos sobrescrevem para devolver os atributos em vez do desfecho.

**Road to Glory com a jogada de cena (19/11/2026).** Problema concreto: no núcleo 5 a carta só vestia (auditoria dos
jogos, seção 7) e a tabela de cores do jogo já existia em `Flair3dCores`. `RoadToGloryNucleo` passou a compor o mesmo
Decorator (`Flair3dJogadaDeCena`) sobre a estratégia do look (`RoadToGloryLook`, que delega a nota ao brief da rodada) e
acrescenta só o que é dele: o evento `TETO` quando as regras somam mais de 100. Alternativa descartada: copiar a jogada
para dentro do núcleo (duplicaria o sorteio do pedido e a conferência da carta).

**Elencos em quebra-cabeça (26/11/2026).** Os cinco elencos de linhas e química saíram; os dez novos só diferem em
dados (vagas com o que cada peça pede e requisitos do deck), então a Strategy `FlairCbcElenco` passou a ter uma única
estratégia concreta por dados, o record `QuebraCabeca`, registrada em `FlairCbcElencos`. Uma classe por elenco
repetiria o mesmo código dez vezes. A avaliação usa o motor dos desafios (`CbcRules.evaluate`, vaga com `accepts`) em
vez de `CbcLinks`. A forma das peças (quadrantes, encaixes, setores, cacos) é só desenho e mora no front
(`lib/flair/elencos/recortes.ts`).
