# Replanejamento: todos os jogos no motor Blender

Data: 25/11/2026. Motor: `scripts/blender3d` (objetos modelados por código no Blender, sem API de terceiros nem IA
paga). Este plano substitui a ideia de usar modelos da Meshy nos cenários.

## 1. Onde estamos

Hoje existem cinco famílias de cena 3D, e só a primeira conversa com o motor.

| Família | Onde está | Como desenha o cenário | Usa o motor? |
| --- | --- | --- | --- |
| A. 15 jogos FLAIR 3D (núcleos) | `lib/flair/nucleos/scene`, `components/flair/nucleos` | sala descrita em dados; troca móvel por `.glb` pelo `manifest.json` | **sim, em parte** |
| B. Detetive (a sala jogável) | `components/flair/detetive/sala-3d.tsx` | formas do three.js escritas à mão | não |
| C. Esporte (estádio e campo) | `components/flair/esporte/*-3d.tsx` | formas do three.js escritas à mão | não |
| D. MET Gala Heist | `components/heist/scene` (223 arquivos, ~23 mil linhas) | motor procedural próprio, com texturas pintadas | não |
| E. Cenas de vitrine | `components/three/*-scene.tsx`, `components/flair/afterparty-scene.tsx` | formas do three.js escritas à mão | não |

O espaço do acervo (`components/acervo/espaco`) já carrega `.glb` por um encaixe próprio e fica fora deste plano.

### Família A em números

As 18 salas usam **88 tipos de móvel**. O manifesto cobre **18** (13 do motor e 5 licenciados). Os 70 que faltam se
dividem assim:

- **22 objetos soltos** (viram receita direta): arara, armarioFerramentas, balcao, bancada, bancoEstofado,
  bancoReservas, bastao, bracoClaquete, capaceteNoSuporte, carroDeCorrida, claquete, espelho, espelhoDeParede,
  luminariaDeTeto, lustre, mesaDosJurados, monitorDeVideo, pedestaisComCordao, prateleiraDeBolsas, rolosDeTecido,
  tabelaDeBasquete, trilhoSpots.
- **26 peças de arquitetura**, que mudam de tamanho por sala (largura, altura, número de módulos): cortina, passarela,
  passarelaEmY, tablado, palcoPequeno, cenarioDeTresParedes, fachadaVitrine, predio, paredeDeImprensa, arquibancada,
  ringue, pistaDeSkate, portal, arcoDoBackstage, parapeito, grade, gradeDoFosso, redeProtecao, redeDeJogo, telao,
  painelLed, portaDeEnrolar, folhaPorta, vitrine, vitrineDeAcervo, cabineProvador.
- **22 marcações planas** (linhas de quadra, tapetes, cartazes, neon, marcas no piso): não ganham nada virando malha.
  Continuam procedurais e recebem textura (fase 0, item 5).

| Sala | Tipos | Cobertos | Objetos que faltam | Arquitetura que falta | Planos |
| --- | --- | --- | --- | --- | --- |
| `around-the-world` | 7 | 2 | — | fachadaVitrine | 4 |
| `atelie-base` | 4 | 1 | bancada, rolosDeTecido | tablado | 0 |
| `batalha-looks` | 6 | 1 | mesaDosJurados, trilhoSpots | painelLed, passarelaEmY | 1 |
| `boutique-3d` | 9 | 1 | arara, balcao, espelho, luminariaDeTeto, prateleiraDeBolsas | cabineProvador, vitrine | 1 |
| `clube-coracao` | 1 | 0 | — | arquibancada | 0 |
| `dress-fighter` | 8 | 2 | — | grade, ringue | 4 |
| `dress-the-star` | 8 | 2 | pedestaisComCordao | cortina, paredeDeImprensa, passarela, telao | 1 |
| `fashion-detective-saloes` | 12 | 4 | arara, armarioFerramentas, bancada, bancoEstofado, luminariaDeTeto, lustre, rolosDeTecido | — | 1 |
| `fashion-detective` | 8 | 1 | lustre | folhaPorta, portal, vitrineDeAcervo | 3 |
| `fashion-sports-quadras` | 8 | 2 | bastao, tabelaDeBasquete | pistaDeSkate, redeDeJogo | 2 |
| `fashion-sports` | 8 | 2 | bancoReservas, luminariaDeTeto | arquibancada, painelLed, redeProtecao | 1 |
| `favorite-singer` | 1 | 0 | — | palcoPequeno | 0 |
| `labirinto` | 5 | 0 | espelho, espelhoDeParede | folhaPorta, portal | 1 |
| `passarela` | 7 | 1 | trilhoSpots | arcoDoBackstage, grade, gradeDoFosso, painelLed, passarela | 0 |
| `personagem-filme` | 9 | 3 | bracoClaquete, claquete, monitorDeVideo | cenarioDeTresParedes | 2 |
| `piloto-favorito` | 6 | 1 | armarioFerramentas, capaceteNoSuporte, carroDeCorrida | portaDeEnrolar | 1 |
| `road-to-glory` | 8 | 2 | arara, bancoEstofado, espelho | cortina | 2 |
| `super-heroi` | 4 | 0 | — | parapeito, predio | 2 |

## 2. O que o motor ainda não sabe fazer

O motor atual gera objeto solto, de cor fixa, apoiado no piso. Para servir a todos os jogos faltam seis capacidades.
Elas vêm **antes** das receitas novas, porque mudam o formato do arquivo: fazer 60 receitas e depois mudar o formato é
refazer as 60.

| # | Capacidade | Por que precisa | Como |
| --- | --- | --- | --- |
| 1 | **Paleta da sala** | hoje a penteadeira magenta do Road to Glory vira branca | a receita nomeia os materiais por papel (`principal`, `secundario`, `metal`, `luz`); o carregador (`glb-prop.tsx`) pinta cada papel com a cor que o móvel procedural usava. Um arquivo serve a todas as salas |
| 2 | **Apoio no teto e na parede** | lustre, luminária de teto, trilho de spots, espelho de parede | campo `apoio: "piso" \| "teto" \| "parede"` no manifesto; o carregador alinha pelo topo ou pelo fundo, não pela base |
| 3 | **Receitas com medidas** | arquitetura muda de largura e altura por sala | a receita recebe parâmetros e o slug leva as medidas (como `pilha-de-pneus-4`); o móvel aponta o slug com `comGlb`. Para o que repete (arquibancada, grade, passarela), a receita gera **um módulo** e a sala repete |
| 4 | **Partes que se movem** | porta, claquete e bola são animadas pelas sequências do jogo | a receita nomeia os nós móveis (`folha`, `braco`); o carregador entrega esses nós ao diretor em vez de um bloco só |
| 5 | **Texturas** | cor chapada é o que ainda dá cara de "gráfico simplificado" | o motor gera no Blender (bake) mapas pequenos de cor e relevo: madeira, tecido, metal escovado, concreto. As marcações planas e a casca da sala (piso e paredes) usam os mesmos mapas |
| 6 | **Níveis de detalhe** | o jogo tem três qualidades e orçamento de triângulos por cena | cada objeto sai em duas versões (`slug.glb` e `slug-leve.glb`, com o modificador Decimate); a qualidade baixa carrega a leve |

Duas garantias de processo entram junto:

- **Arquivo sempre igual à receita.** O manifesto guarda um resumo (hash) da receita; um teste falha se a receita
  mudou e o `.glb` não foi gerado de novo.
- **Conferência visual por sala.** Um comando abre `/lab/salas` para cada jogo e salva a captura com e sem os objetos
  do motor, lado a lado. É o critério de aceite de cada fase.

## 3. Fases

Cada fase termina com as capturas de antes e depois das salas tocadas, o teste do manifesto e o orçamento de
triângulos passando.

### Fase 0: fundação do motor

Capacidades 1 a 6 e as duas garantias. Os 15 objetos que já existem são regerados no formato novo (papéis de
material e versão leve). Nenhum jogo muda de aparência nesta fase, fora a volta das cores de cada sala.

Aceite: a penteadeira do Road to Glory volta a ser magenta com o mesmo arquivo que é branco no camarim.

**Estado: entregue.** O que entrou e onde ficou diferente do planejado:

| # | Entregue | Diferença em relação ao plano |
| --- | --- | --- |
| 1 | material `sala:<papel>` na receita, `Movel.papeis` nas 13 fábricas, pintura em `glb-prop.tsx` | — |
| 2 | o objeto é encaixado na caixa exata do móvel procedural (base, topo ou parede saem dela) | não há campo `apoio` no manifesto: a caixa do móvel já diz onde ele fica |
| 3 | `variantes()` em `receitas/__init__.py` (slug com a medida) | ainda sem receita de módulo de arquitetura: entra no lote 2 da fase 1 |
| 4 | móvel animado pelo diretor usa o objeto do motor inteiro | os nós internos (`folha`, `braco`) ainda não são entregues separados: entra com as portas da fase 2 |
| 5 | mapas de cor gerados por código (`texturas.py`: madeira, tecido, escovado, borracha) e mapeamento em metros | só cor, sem relevo; concreto e a casca da sala ficam para o lote 3 da fase 1 |
| 6 | `slug-leve.glb` (Decimate) para objeto de 800 triângulos ou mais | a versão leve é escolhida quando o navegador desenha por software, não pela qualidade do jogo |

Garantias: o manifesto guarda o resumo do motor e `assets.test.ts` falha se uma receita mudou sem gerar de novo;
`glb-proporcao.test.ts` falha se o objeto não tem a proporção do móvel que substitui (foi ele que apontou a luminária,
a cadeira de camarim, o canhão de luz e o poste, refeitos nesta fase). A conferência visual é manual:
`/lab/salas?jogo=<id>` e `/lab/salas?jogo=<id>&glb=0`; ainda não há comando que salve as duas capturas lado a lado.

### Fase 1: os 15 jogos FLAIR 3D

Em três lotes, do que mais aparece para o que menos aparece.

1. **Objetos soltos (22 receitas).** Primeiro os que estão em mais salas: arara, luminariaDeTeto, espelho,
   armarioFerramentas, bancada, bancoEstofado, lustre, rolosDeTecido, trilhoSpots. Depois os de uma sala só.
2. **Arquitetura em módulos (26 receitas).** Primeiro o que define o palco de cada jogo: passarela e passarelaEmY,
   ringue, arquibancada, palcoPequeno, cenarioDeTresParedes, fachadaVitrine e predio. Depois portas, grades e redes.
3. **Casca e planos.** Piso e paredes de cada sala com os mapas de textura da fase 0; marcações, tapetes e cartazes com
   textura em vez de cor chapada.

Aceite: nenhuma das 18 salas tem móvel de objeto ou de arquitetura desenhado só com caixas e cilindros.

**Estado do lote 1: 19 de 22 tipos entregues.** Os 9 que aparecem em mais salas (arara, espelho, bancoEstofado,
armarioFerramentas, lustre, luminariaDeTeto, trilhoSpots, bancada, rolosDeTecido) e 10 de uma sala só (mesaDosJurados,
balcao, prateleiraDeBolsas, carroDeCorrida, capaceteNoSuporte, espelhoDeParede, pedestaisComCordao, monitorDeVideo,
bancoReservas, tabelaDeBasquete). Faltam bastao, claquete e bracoClaquete (pequenos e animados pelo diretor).

### Fase 2: Detetive e Esporte

Estas duas telas têm código próprio. O trabalho é trocar esse código pelo mesmo caminho da família A, não escrever um
segundo carregador.

- **Detetive.** `sala-3d.tsx` passa a montar a sala com os móveis de `lib/flair/nucleos/scene` (armário, gaveteiro,
  coluna, arara, estante, pilha de caixas, porta). Receitas novas: armário de pistas, gaveteiro, estante de arquivo,
  coluna. As portas usam a capacidade 4 (trancada, aberta, barrada).
- **Esporte.** `estadio-3d.tsx` e `campo-3d.tsx`: módulo de arquibancada, refletor de estádio, banco de reservas,
  placar, bandeira de escanteio; a trave já existe. O gramado e as linhas continuam planos, com textura.

Aceite: as duas telas carregam objetos do manifesto e os testes que já existem (`detetive.test.tsx`,
`estadio.test.tsx`, `esporte.test.tsx`) continuam passando.

### Fase 3: cenas de vitrine

`runway-scene`, `stage-scene`, `store-street-scene`, `fitting-room-scene` e `afterparty-scene`. Quase tudo o que elas
precisam já terá receita das fases 1 e 2 (passarela, palco, fachada, cabine, cortina, refletor). O trabalho é ligar.

### Fase 4: MET Gala Heist

É a maior e a de maior risco: 223 arquivos, texturas pintadas à mão e retratos de cena travados em testes. O plano
**não** reescreve o Heist.

- Só os objetos soltos (mesas, cadeiras, vasos, vitrines de joias, carrinhos, luminárias) passam a vir do motor, por
  um adaptador único na camada de adereços.
- A arquitetura das salas, a rua e as pessoas ficam como estão.
- Os retratos de cena dos testes são atualizados sala por sala, com captura antes e depois.

Aceite: os adereços soltos do Heist vêm do manifesto, e o tempo de carga e o orçamento por sala não pioram.

## 4. O que fica fora

- **Personagens.** Avatar, figurantes, guardas e jogadores têm esqueleto e roupa próprios; o motor de cenário não os
  substitui.
- **Jogabilidade.** Mover o personagem, combate com guardas, rodas de atributos e de recursos, e os braços por
  interação: são outra frente, independente deste plano. Só a fase 2 toca os mesmos arquivos (Detetive e Esporte), então
  convém fazer a jogabilidade dessas duas telas **depois** da fase 2, para não mexer duas vezes na mesma sala.
- **Peças de roupa em 3D.** Seguem pelo caminho que já existe (`outfit-glb`).

## 5. Riscos

| Risco | Efeito | Como o plano trata |
| --- | --- | --- |
| Peso da página | cada `.glb` é um arquivo a mais para baixar | versão leve, teto de 3 mil triângulos, carga sob demanda por sala (já é assim) e reaproveitamento de módulos |
| Orçamento de triângulos por cena | sala com muitos objetos passa do teto na qualidade baixa | a versão leve entra no orçamento; o teste de orçamento roda com o manifesto real |
| Objeto virado ou fora de escala na sala | só aparece olhando a sala | a conferência visual por sala é critério de aceite, não opcional |
| Arquivo desatualizado em relação à receita | o jogo mostra um objeto antigo | hash da receita no manifesto, conferido em teste |
| Heist | regressão visual numa cena grande e já ajustada | fase por último, só adereços, retratos atualizados sala a sala |

## 6. Ordem recomendada

Fase 0 → Fase 1 (lote 1) → Fase 2 → Fase 1 (lotes 2 e 3) → Fase 3 → Fase 4.

A fase 2 sobe na fila porque Detetive e Esporte são as telas onde os gráficos simplificados mais aparecem, e porque
destrava a frente de jogabilidade dessas duas telas.
