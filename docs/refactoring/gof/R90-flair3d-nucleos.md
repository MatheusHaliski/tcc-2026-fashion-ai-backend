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
| Estratégias concretas | `flair3d/nucleos/*Nucleo` (15) | `flair3d/makeup/briefs/*Brief` (3) | `flair3d/cbc/elencos/*Elenco` (5) |
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
