# Plano — cabelo realista (nível EA FC), avatar nunca careca por engano, e golas/mangas/costuras fiéis à peça

> 29/09/2026 · RF40 (Avatar 3D) e provador (RF18/RF36). Documento de planejamento: diz **o que** fazer, **em que ordem**,
> **como medir** e **o que já foi feito** nesta sessão. Complementa `provador-vestir-plano.md` e `digital-double.md`.

## 0. Resumo executivo

| Objetivo | Definição verificável | Meta |
|---|---|---|
| Cabelo realista | Fios visíveis, volume e brilho de fio como nos jogadores do EA FC; silhueta igual à da foto | IoU da silhueta (render × máscara da foto) ≥ 0,80; nota de realismo ≥ 4/5 num painel de 5 pessoas; 60 fps em celular intermediário |
| Nunca careca por engano | Careca só com **prova** de couro cabeludo; sem prova, cabelo | **0 falsos carecas** no conjunto de teste; ≤ 5% de cabelo desenhado em quem é careca |
| Acabamentos fiéis | Gola, mangas, barras e costuras com o mesmo tipo, largura, cor e posição da foto da peça | tipo correto em 100% do conjunto; largura ±3 mm; cor ΔE2000 ≤ 5; borda sem serrilhado |

A estratégia tem três ideias centrais:

1. **Careca é afirmação, não padrão.** Hoje "não vi cabelo" virava "careca". Passa a ser: sem evidência, supõe-se
   cabelo e pede-se ajuste.
2. **Cabelo de jogo esportivo não é casca: é fio.** A casca deslocada (o "capacete") dá lugar a um **penteado de fios**
   (guias de fio + fios interpolados, agrupados em mechas), escolhido numa biblioteca e ajustado às medidas da foto,
   com o sombreamento de fio usado pela indústria.
3. **Acabamento é construção, não textura.** Gola, punho, barra e costura passam a ser geometria paramétrica que segue
   a superfície do corpo, descrita por uma **especificação de construção** extraída da foto da peça.

---

## Parte A — Cabelo

### A1. Diagnóstico (medido nesta sessão)

Testes com 16 retratos rotulados + 32 variantes com rosto pequeno + 24 variantes degradadas (luz quente, fundo da cor
do cabelo, ruído). Nenhuma foto de teste ou render de pessoa foi versionado.

**Por que o avatar ficava careca** (caso de produção: foto de ambiente, rosto de 208 px, cabelo loiro nos ombros):

| # | Causa | Evidência | Estado |
|---|---|---|---|
| 1 | Segmentadores rodavam na foto inteira (entrada de 512 px e 256 px): com o rosto pequeno, a cabeça vira poucas dezenas de pixels | variantes "h2" de cabelo longo escuro e curto escuro saíam `present=false` | **corrigido** (recorte da cabeça antes de segmentar) |
| 2 | O modelo gravava `present = segmentador fino` e ignorava o perfil de cabelo, que já tinha achado cabelo | mesmos casos: perfil "raspado/curto" com cor, modelo careca | **corrigido** |
| 3 | Loiro claro tem a cromaticidade da pele: no alto da cabeça virava "couro cabeludo" | regra de cor sem textura | **corrigido** (textura: fio tem relevo, pele é lisa) |
| 4 | Quando a máscara "vazava" para o fundo, o cabelo inteiro era descartado | regra `leaked → present=false` | **corrigido** (filtra pela cor do cabelo junto da cabeça) |
| 5 | Sem máscara nenhuma não havia perfil, logo não havia alternativa | caminho nulo | **corrigido** (perfil sempre roda; classe "cabelo" dá segunda opinião) |

**Por que parecia capacete** (renders de frente, 3/4, lado e costas):

| Defeito | Causa | Estado |
|---|---|---|
| "Aba" ao lado do rosto | a calota recebia a largura inteira da silhueta — inclusive o cabelo pendurado | corrigido (teto de espessura por comprimento; o pendurado é da cortina) |
| Testa curta, "cuia" | a linha do cabelo nascia no ponto 10 do MediaPipe, que fica só ~3 cm acima da sobrancelha (a real fica a 5–6 cm) | corrigido |
| Cabelo longo como painel/caixa, com degrau na lateral | cortina cilíndrica começando abaixo da calota | melhorado (nasce sobre a calota, corte em U, caimento sem "prateleira" no ombro) |
| Loiro cor de pêssego | matiz medido podia girar até 25° sob luz quente | corrigido (±10° nos loiros) |
| Brilho de plástico | material de superfície única, sem modelo de fio | **não resolvido** — exige a Parte A3 |
| Fios não aparecem | textura pintada sobre casca | **não resolvido** — exige a Parte A3 |

> Conclusão: os ajustes na casca tiram o "capacete", mas **não chegam ao nível EA FC**. Realismo de fio exige mudar a
> representação do cabelo (A3). A casca atual fica como nível de detalhe mais baixo (LOD) e como reserva.

### A2. Política "nunca careca por engano"

**Regra de decisão** (em ordem; a primeira que se aplica decide):

| Evidência na foto | Decisão | Observação |
|---|---|---|
| Cobertura (lenço, turbante, boné, gorro) no alto da cabeça | cobertura | cor da cobertura |
| Cabelo visto pelo segmentador fino **ou** pela classe "cabelo" do segmentador de classes | cabelo medido | comprimento, volume, textura, cor |
| Alto da cabeça com **≥ 50% de pele lisa** (relevo ≤ 1,6 × o da testa) e < 25% de cabelo | careca | a única via para careca |
| Couro cabeludo com relevo de fio curto ou tom mais escuro que a pele | raspado | |
| Nada conclusivo (escuro, cortado, borrado, cabeça minúscula) | **cabelo suposto** pelo corpo base (médio no feminino, curto no masculino), castanho médio | aviso `HAIR_ESTIMATED` + ajuste de corte e tom na tela |

**Camadas de detecção** (conjunto — cada uma cobre a falha da outra):

1. recorte da cabeça e do cabelo até abaixo dos ombros antes de segmentar (**feito**);
2. segmentador fino de cabelo (MediaPipe hair segmenter);
3. classe "cabelo" do segmentador multiclasse, como segunda opinião de presença e comprimento (**feito**);
4. relevo (textura em ~2,5 mm): separa loiro claro de couro cabeludo (**feito**);
5. cor em CIELAB nos meios-tons (nível 1–10 + família) (**feito**);
6. fallback por corpo base, com aviso e ajuste (**feito**);
7. *(próximo)* consistência entre fotos: se a pessoa refizer o avatar e antes havia cabelo medido, a mudança para
   careca exige confirmação.

**Garantia contínua:** o conjunto de teste roda no CI a cada mudança no pipeline e **bloqueia o merge** se aparecer um
falso careca. O script de laboratório (`/lab/avatar`, `window.__avatarLab`) já expõe tudo o que o teste precisa.

**Conjunto de teste (a ampliar):** ≥ 60 fotos com consentimento ou licença de uso, balanceadas por tom de pele
(escala Monk), cor e tipo de cabelo (liso, ondulado, cacheado, crespo, dreads, tranças), comprimento, sexo, idade,
coberturas, carecas e raspados reais; mais variantes sintéticas (rosto pequeno, luz quente/fria, fundo da cor do
cabelo, desfoque, ruído). Rótulo manual: careca/raspado/curto/médio/longo, textura, volume, cor.

### A3. Realismo nível EA FC — arquitetura alvo

Referência visual: nos jogadores do EA FC o cabelo tem **fios individuais visíveis nas bordas**, **mechas** com
volume, **brilho em faixa** que corre ao redor da cabeça, **raiz mais escura**, **pontas finas e irregulares** e
alguns **fios soltos**. Nada disso sai de uma casca com textura. O caminho recomendado:

#### A3.1 Representação: penteado de fios (groom) em três escalas

| Escala | O que é | Por quê |
|---|---|---|
| Guias | 150–400 curvas por penteado (12–24 pontos cada), da raiz à ponta | definem forma, volume e caimento; são o que se ajusta à foto |
| Fios | 20–60 mil fios interpolados das guias (desktop); 8–15 mil (celular) | dão o "traçado" do fio e a silhueta com fios soltos |
| Mechas | agrupamento dos fios em torno de centros (clumping), com ruído, cacho (hélice) e frizz | é o que o olho lê como "cabelo de verdade" |

Desenho: cada fio vira uma **fita voltada para a câmera** (ribbon) em malha instanciada — um único draw call. Em
aparelhos fracos, as mesmas guias geram **cards** (fitas largas com textura alfa de fios), o padrão da indústria antes
dos fios; a casca atual fica como último nível.

#### A3.2 Biblioteca de penteados + ajuste à foto (a foto escolhe e deforma; não "inventa" fios)

1. **Biblioteca**: 24–30 penteados com guias, autorados em Blender (sistema de partículas de cabelo → curvas
   exportadas), licença própria ou CC0: raspado, degradê, social, topete, crespo curto, black power, cacheado curto,
   joãozinho, chanel liso/ondulado, médio liso/ondulado/cacheado, longo liso/ondulado/cacheado, dreads, tranças,
   coque, rabo de cavalo, risca ao meio/lateral, com e sem franja.
2. **Escolha automática** por distância de atributos medidos: comprimento, volume (classe e fator — **feito**),
   textura, franja, risca, direção dominante dos fios (tensor de estrutura — já medido), sexo do corpo base apenas
   como desempate, nunca como regra.
3. **Ajuste** (deformação por RBF/malha de controle): encaixar as raízes no couro cabeludo do avatar; escalar e
   deformar as guias para a **silhueta medida por altura** (HAIR_LEVELS) e para o alto medido; cortar ou alongar as
   pontas para o comprimento medido; aplicar o volume medido como "lift" na raiz.
4. **Colisão**: campo de distância do corpo e das peças vestidas (não mais raio por anel), para os fios caírem por
   cima dos ombros e da roupa, sem atravessar.
5. **Escolha da pessoa**: a lista de cortes (feita: 7 cortes) passa a listar os penteados da biblioteca; o "Da foto"
   continua sendo o padrão.

#### A3.3 Sombreamento de fio

| Técnica | Efeito |
|---|---|
| Modelo de fio (Kajiya-Kay com dois lóbulos, ou Marschner simplificado R/TT/TRT) sobre a tangente do fio | brilho primário branco e secundário colorido em faixa, que corre ao longo da cabeça |
| Cor por melanina (eumelanina/feomelanina) derivada do tom medido em CIELAB | preto, castanhos, loiros e ruivos com a absorção certa; grisalho por fração de fios sem pigmento |
| Variação por fio (±5% de tom), raiz mais escura, pontas mais claras | profundidade |
| Oclusão por densidade (auto-sombra) | volume: o interior das mechas escurece |
| Transparência: alpha-to-coverage com MSAA 4× (ou OIT ponderada) | bordas com fio fino, sem serrilhado nem ordem errada |
| Fios soltos (3–5%) na borda da silhueta | a assinatura visual dos jogos atuais |

#### A3.4 Orçamento e níveis de detalhe

| Nível | Aparelho | Representação | Tempo de GPU do cabelo |
|---|---|---|---|
| 0 | desktop / WebGPU | fios (40–60 mil) + fios soltos | ≤ 4 ms |
| 1 | celular intermediário | fios (8–15 mil) ou cards densos | ≤ 3 ms |
| 2 | celular fraco / sem WebGL2 | cards (≤ 8 mil triângulos) | ≤ 2 ms |
| 3 | reserva | casca atual | — |

A escolha é automática (capacidade do dispositivo + tempo de quadro medido) e o GLB exportado leva o nível 2.

#### A3.5 Critérios de aceite do cabelo

- Silhueta renderizada de frente × máscara de cabelo da foto: **IoU ≥ 0,80**.
- Cor: ΔE2000 ≤ 8 entre o meio-tom renderizado e o medido.
- Comprimento: acerto ≥ 90%; volume: no máximo uma classe de erro.
- Linha do cabelo: testa visível quando a franja medida é 0; contorno da orelha e costeleta nos cortes curtos.
- Sem emendas visíveis, sem cabelo atravessando roupa ou ombro, em frente/3/4/lado/costas e em movimento.
- Painel humano (5 pessoas, fotos lado a lado com o render): "parece cabelo de verdade?" média ≥ 4/5.

---

## Parte B — Golas, mangas, costuras e acabamentos fiéis à peça

### B1. Diagnóstico

| Elemento | Hoje | Problema |
|---|---|---|
| Corpo da peça | casca a partir da pele + foto projetada de frente; costas na cor do tecido | adequado como base |
| Gola | anel vertical de raio mediano em volta do pescoço, cor amostrada na foto | não segue a inclinação do trapézio e do peito: vira aba nas costas e "V" largo na frente; borda de baixo serrilhada |
| Borda do tecido | alfa por vértice + alphaTest | escada de triângulos visível no decote, nas mangas e na barra |
| Mangas | termina por alfa | sem barra dobrada, sem punho de ribana (a camiseta padrão tem punho laranja) |
| Costuras e pespontos | inexistentes | a peça parece "pintada" |
| Botões, zíper, bolsos, colarinho, capuz | inexistentes | camisa, polo e moletom perdem a identidade |

### B2. "100% fiel" — o que é verificável

- **O que a foto mostra** é reproduzido: tipo de gola e de punho, larguras, cores, posição de logo/estampa/bolso,
  número e posição de botões, pespontos visíveis.
- **O que a foto não mostra** (costas, interior) segue a **construção padrão do tipo de peça**, nunca inventada:
  nuca da gola igual à frente, costura de ombro, barra igual à da frente. Uma foto opcional das costas substitui o
  padrão quando enviada.

### B3. Especificação de construção da peça (ECP)

Estrutura gravada com a peça (JSON validado no app e no backend):

```text
gola:    tipo (careca | V | polo | colarinho social | capuz | gola alta | canoa | quadrada | sem gola)
         largura_cm · profundidade_frente_cm · profundidade_costas_cm · cor · material (ribana | mesmo tecido)
         pesponto (nenhum | simples | duplo, distância_mm)
mangas:  comprimento (cava | curta | ¾ | longa) · tipo (encaixada | raglã | caída)
         boca (barra dobrada | punho de ribana | punho abotoado) · altura_cm · cor
barra:   tipo (dobrada | ribana | reta com fenda | arredondada) · altura_cm · cor
costuras: ombro · lateral · cava · centro das costas → visível?, cor da linha, pesponto
fechos:  botões (n, diâmetro_mm, espaçamento_cm) · zíper (comprimento, cor)
bolsos, logo/estampa: posição e caixa na foto
```

**Extração** (três fontes, com conferência cruzada):

1. **Visão computacional determinística** sobre a foto de estúdio (a base já existe: `photoInfo.collarRow`):
   perfis de cor ao longo da borda da gola, das bocas das mangas e da barra detectam faixas de outra cor (ribana) e
   medem a altura em pixels → cm pela largura do tronco; linhas paralelas à borda (gradiente/Hough) detectam pespontos;
   círculos pequenos detectam botões.
2. **IA de visão do backend** (a mesma da análise da peça) com saída estruturada no esquema da ECP; valores fora do
   esquema são descartados.
3. **Confirmação da pessoa** na etapa "Mais detalhes" do formulário (tipo de gola, punho, barra) — preenchida
   automaticamente, nunca obrigatória.

### B4. Construção 3D paramétrica

| Peça | Construção |
|---|---|
| **Linha do decote** | curva 3D sobre o corpo definida por pontos anatômicos — ponto alto do ombro (HPS), centro da frente na profundidade medida, centro das costas — e projetada na superfície |
| **Gola** | varredura (sweep) de uma seção arredondada ao longo da curva, com a largura medida, orientada pela **normal da superfície** (segue o trapézio e o peito); careca, V (junção em ângulo), polo (pé + gola caída + carcela com botões), colarinho social (pé + gola com pontas), capuz (malha própria), gola alta (tubo) |
| **Bocas das mangas** | curva perpendicular ao eixo do osso do braço; barra dobrada (2 cm, borda arredondada) ou punho de ribana (4–6 cm, levemente mais justo) ou punho abotoado |
| **Barra** | mesma varredura ao longo da barra |
| **Borda do tecido** | **recorte da malha na curva** (triângulos cortados, borda limpa) em vez de alfa por vértice: fim do serrilhado; a faixa cobre a costura |
| **Costuras e pespontos** | curvas-padrão do molde (ombro, lateral, cava, centro das costas); o pesponto é um tracejado procedural na textura, com UV por comprimento de arco, e um leve relevo no mapa de normais |
| **Materiais** | normal map por material: ribana canelada 2×1, malha jersey, sarja, jeans, tecido plano; brilho por fibra |

### B5. Textura em painéis (moldes), não projeção

A foto hoje é projetada de frente. Passa a ser mapeada em **painéis de molde** (frente, costas, mangas, gola) com UV
próprio; a frente da foto encaixa no painel da frente por pontos-chave (HPS, cava, barra, centro); a foto opcional das
costas encaixa no painel das costas. Assim estampa e logo não esticam nas laterais e a gola da foto não "desce" para o
peito.

Para peças de marcas parceiras (RF39), aceitar GLB/glTF com UV de molde vindo de software de modelagem de roupa
(padrão da indústria), no esqueleto padrão do FashionAI.

### B6. Medição de fidelidade (automática)

1. Render do avatar vestido **na mesma pose e enquadramento da foto de estúdio**.
2. Comparação: silhueta da peça (IoU ≥ 0,90); largura de cada faixa (±3 mm); cor de cada faixa (ΔE2000 ≤ 5);
   posição do logo (≤ 1 cm); tipo de gola/punho/barra (100%).
3. Detector de serrilhado na borda (cantos por cm de borda) = 0.
4. Relatório lado a lado (foto × render) com as diferenças marcadas, anexado ao PR.
5. Checklist humano por peça do catálogo de testes (camiseta, polo, camisa social, moletom com capuz, jaqueta, vestido,
   calça, bermuda, saia).

---

## Parte C — Execução

### C1. O que já está pronto (nesta branch, ainda **não commitado** — aguardando revisão)

| Item | Resultado medido |
|---|---|
| Sexo do corpo base estimado pelo rosto, no aparelho (`@vladmandic/face-api`, MIT, 430 KB), com escolha da pessoa | 56/56 acertos (16 retratos + 40 variantes), certeza 84–100%; abaixo de 70% vale o cadastro |
| Fim do "careca por engano" (5 causas acima) | todos os casos difíceis com cabelo passam a ter cabelo; carecas reais continuam carecas |
| Volume do cabelo (rente / normal / volumoso / muito volumoso) pela silhueta contra o crânio | classes coerentes nos retratos; aplicado na geometria e mostrado no ajuste "Volume do cabelo" |
| 7 cortes (raspado, curto, topete, joãozinho, chanel, médio, longo) | ajuste "Corte" |
| Linha do cabelo anatômica, laterais batidas no curto, contorno da orelha | fim da "cuia" nos cortes curtos |
| Loiro sem virar cor de pele | teste automático |
| Testes | +16 testes unitários (sexo, volume, corte, tom); backend 11/11 no serviço do avatar |

### C2. Fases

| Fase | Entrega | Esforço |
|---|---|---|
| 1 | Commit do item C1; conjunto de teste ≥ 60 fotos; teste "falso careca = 0" no CI; cabelo longo por cima da roupa | 1 semana |
| 2 | Formato de penteado (guias + fios), renderizador de fios com sombreamento de fio, níveis de detalhe | 2 semanas |
| 3 | Biblioteca de 24–30 penteados + escolha automática + ajuste à silhueta + colisão | 2–3 semanas |
| 4 | ECP: extração (visão + IA estruturada) + confirmação no formulário | 2 semanas |
| 5 | Construção paramétrica: decote, gola, mangas, barra, recorte de borda, costuras, materiais | 3 semanas |
| 6 | Painéis de molde + foto opcional das costas + relatório automático de fidelidade | 2 semanas |

### C3. Riscos

| Risco | Mitigação |
|---|---|
| Desempenho no celular | níveis de detalhe automáticos; orçamento por nível; medição de tempo de quadro |
| Autoria dos penteados (trabalho de arte) | começar com 12 penteados que cobrem ~80% dos casos; CC0 onde houver; guias simples geradas por script para os básicos |
| Viés da detecção (sexo, cabelo, tom de pele) | medir acerto por grupo no conjunto balanceado; a pessoa sempre pode trocar; sexo nunca decide o penteado sozinho |
| Privacidade | foto do rosto não sai do aparelho; IA de visão do backend só recebe fotos de **peças** |
| Licenças | MediaPipe (Apache-2.0), face-api (MIT), corpo MakeHuman/Anny (CC0); penteados com licença registrada |

### C4. Decisões pedidas à equipe

1. Autorizar o commit do item C1 nesta branch.
2. Quem autora os penteados da biblioteca (equipe em Blender, ou compra/CC0).
3. Foto opcional das costas da peça no formulário (sim/não).
4. Uso da IA de visão do backend para extrair a ECP (consome créditos por peça).
