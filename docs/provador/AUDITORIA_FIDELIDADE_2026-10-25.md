# Auditoria do Provador 3D — fidelidade por marca, categoria e produto (2026-10-25)

Resposta à auditoria "Provador 3D: fidelidade por marca, categoria e produto" (HTML do ChatGPT). As constatações abaixo
foram verificadas executando o código deste branch: sondas nos construtores, a matriz 3D regravada e testes
automatizados. Os renders de todos os SKUs do catálogo **não** foram executados. Os veredictos por produto valem para os
casos citados e para o que os testes exercitam.

Status usados: **Aprovado**, **Parcial**, **Reprovado**, **Sem evidência** e **Corrigido** (reprovado na leitura e
corrigido neste branch, com teste).

## 01 · Diagnóstico (estado após as correções)

| Requisito | Auditoria | Agora | Evidência |
|---|---|---|---|
| Roupa 3D separada da pele | Implementado | Aprovado | `buildGarment` (molde por casca do corpo, com folga por camada) |
| Molde por família | Implementado | Aprovado | `STRATEGIES` em `lib/tryon/garment-asset.ts` |
| Corte específico de cada SKU | Não atende | Reprovado | Não há malha por SKU (`APPROVED_WEARABLES` vazio). O molde é paramétrico por subcategoria, variação e atributos |
| Gola, ombro, manga e cintura específicos | Não comprovado | Parcial / **Corrigido** | Manga, cintura, decote e modelagem são lidos do nome e dos atributos (ver 02). A geometria da gola não é medida do produto |
| Caimento físico pelo tecido real | Não implementado | Reprovado | `motion.simulation: "nenhuma"`: só skinning no esqueleto. O tecido muda só o material (`fabricSurface`) |
| Foto projetada na frente | Parcial | Aprovado (prévia) | Projeção por marcos (ombros, linha de referência, barra), gola alinhada (`collarRow`), mangas da foto quando a manga aparece caída |
| Logos e estampas nas costas | Não atende | **Corrigido** | Foto das costas do catálogo, ou metade traseira de uma foto composta, projetada espelhada nas costas e na gola 3D (ver 05) |
| Fôrma, sola e cadarços | Implementado | Aprovado | `lib/avatar3d/human/shoes.ts` |
| Logos e listras dos tênis | Não atende | Reprovado (sem invenção) | Calçado procedural com as cores da foto. Nenhum logo é aplicado, nem inventado (ver 04) |
| Malha vestível aprovada por produto | Não implementado | Reprovado | O contrato tem o estado `APROVADA`, mas nenhuma peça o recebe |
| Testes geométricos e de colisão | Existem | Aprovado | `fit-matrix.ts`: 4 corpos × 4 poses |
| Homologação por marca e SKU | Não demonstrada | Reprovado | Sem render por SKU. A interface declara "Prévia estimada" em toda peça (ver 09) |

## 02 · Cobertura e produtos reais

Matriz 3D **regravada nesta data** (`MATRIZ3D_WRITE=1 npx vitest run lib/avatar3d/matriz3d`). Os arquivos salvos
estavam desatualizados: registravam o molde `fai-mould-skinwrap-v2` (o atual é v6) e ainda o defeito de manga da Sonny
Polo.

| Componentes | Gráfico de 11/10 | Atual (25/10) |
|---|---:|---:|
| Validados | 694 | 683 |
| Sem validação | 379 | 392 |
| Parciais | 158 | 162 |
| Ausentes | 345 | 339 |
| Não aplicáveis | 723 | 723 |

São 80 subcategorias e 2.299 linhas componente × subcategoria. São contagens de componentes, não de produtos aprovados.
A queda de validados vem de componentes que mudaram de molde depois de 11/10 e ainda não têm teste no molde novo
(detalhes em `docs/avatar3d/matriz-3d/GERADO.md`).

| Produto | Defeito em 11/10 | Agora (molde executado) |
|---|---|---|
| A&F · Detroit Lions Graphic Tee | Molde ok, estampa sem homologação | **Parcial**: molde `tee` correto; a estampa vem da foto da frente, sem verificação visual automatizada |
| AllSaints · Sonny Long Sleeve Polo | Manga curta e gola errada | **Aprovado** (molde): manga 0,96 (até o punho), `POLO_COLLAR`, carcela. Corrigido antes desta auditoria |
| Aramis · Camisa Social Manga Longa Slim | Slim virava regular | **Corrigido**: "Slim" isolado no nome passa a dar caimento justo (folga 6 mm em vez de 8), manga 0,96 |
| A&F · High Rise Bootcut Jean | Cintura padrão | **Aprovado** (molde): cós 0,34 (alto, contra 0,18), boca de sino a partir do joelho. A regra da matriz que ainda acusava divergência foi corrigida |

## 03 · Vestimentas (por família)

Respostas pelo código e pelos testes. "Sem evidência" significa que só um render inspecionado responderia.

**A · Camisetas, polos, camisas, regatas e blusas**
- Golas: redonda, V, U, canoa, quadrada, alta e polo distintas (`NECKLINE` ou nome) — **Aprovado**. A polo tem gola de
  ponta e carcela, mas sem pé de gola (`gola.pe` ausente) — **Parcial**.
- Manga longa pelo nome ("Long Sleeve", "manga longa") e manga curta — **Aprovado**. Oversized desce a manga e alarga —
  **Aprovado**.
- Slim — **Corrigido** (antes só "Slim Fit").
- Botões e carcela só com `CLOSURE` de botão; nunca em pulôver ou zíper — **Aprovado**. A matriz ainda registra os botões
  da camisa saindo no molde da polo como "aplicado onde não se aplica" — **Parcial**.
- Estampa e logo do peito: vêm da foto da frente — **Parcial** (sem comparação automatizada).
- Logo na manga: só quando a foto mostra a manga caída — **Parcial**.
- Nuca e costas: **Corrigido** (ver 05).
- Braços levantados: coberto pela matriz de caimento — **Aprovado** (colisão). Material e movimento: sem simulação —
  **Reprovado**.

**B · Calças, shorts e leggings**
- Cós por `RISE` ou nome (baixa, média, alta e altíssima) — **Aprovado**. Skinny, Slim, Straight, Bootcut, Flare, Wide
  Leg, Baggy e Tapered com geometrias distintas — **Aprovado**.
- Gancho, barra e perna em coluna — **Aprovado**. Cargo com bolsos e abas (`construction: cargo`) — **Parcial**.
- Bolsos traseiros, etiqueta do cós e bordados: agora vêm da foto das costas, quando existe — **Corrigido** (com foto);
  **Sem evidência** sem ela.
- Jeans × malha × social: trama de denim e superfície por material — **Parcial**.
- Joelho em agachamento: colisão medida; deformação natural sem simulação — **Parcial**.

**C · Vestidos, saias, macacões e jardineiras**
- Comprimento por `LENGTH` e decote — **Aprovado**. Alças — **Parcial** (achados da matriz).
- Pregas 3D — **Reprovado** (não existem). Jardineira sem peitilho e conjunto tratado como macacão: declarados em
  `KNOWN_LIMITS` e mostrados ao usuário — **Reprovado**, mas informado.

**D · Blazers, jaquetas, casacos, moletons e coletes**
- Lapela — **Reprovado** (`gola.lapela` ausente). Abertura frontal real só com `OPEN_FRONT` — **Parcial**.
- Capuz: existe capuz abaixado estimado (`loweredHood`). A limitação dizia "capuz não modelado", texto falso —
  **Corrigido** para "capuz abaixado com forma estimada".
- Zíper e fivelas — **Sem evidência**. Couro × tecido: só material — **Parcial**.

## 04 · Calçados

O tênis é uma fôrma procedural (cabedal, sola com espessura, cadarço e colarinho) com as cores medidas na foto
(cabedal, bico, calcanhar e sola). Geometria e contato com o chão: **Aprovado** como prévia.

Identidade (três listras, Swoosh, "N" da New Balance, logos laterais, de calcanhar e de língua): **Reprovado**. Nenhum
logo é aplicado. Isso cumpre a regra "nunca inventar", mas não reproduz o produto. Reproduzir exige uma das duas coisas:
- uma malha por SKU (P0, fora do alcance desta correção); ou
- projetar fotos laterais do catálogo no cabedal, o que depende de o catálogo ter vista lateral marcada (`SIDE`) por
  variante.

## 05 · Logos, estampas e verso — corrigido neste branch

| Antes | Agora |
|---|---|
| As costas recebiam só a cor e a trama medidas na frente: logo da nuca, estampa das costas e bolsos traseiros sumiam | **Backend:** `GET /texture-image?view=back` serve só uma foto marcada `BACK` da mesma peça e variante; sem ela, 404. A frente deixou de receber foto de costas no lugar |
| Foto composta (frente e costas no mesmo arquivo) entrava inteira como frente | `splitCompositePhoto` divide duas silhuetas lado a lado no recorte (alfa); a da esquerda é a frente, pela convenção do e-commerce, e a da direita vai para as costas |
| — | **Projeção traseira espelhada** (`backProjection`): o lado esquerdo da foto de costas é o lado esquerdo de quem veste, então o texto fica legível para quem olha por trás, nunca invertido. Só superfícies voltadas para trás e dentro da foto recebem a imagem; o resto continua no tecido |
| A gola 3D cobria a região do logo da nuca | Em peça com gola, o topo da foto traseira vai para o topo da faixa da gola (é ali que fica o "Kappa" da polo enviada) |
| Sem indicação ao usuário | Detalhes da peça mostram "Costas: foto das costas aplicada", "metade traseira da foto composta aplicada" ou "Costas sem evidência … logos de trás não são inventados" |

Teste: `lib/avatar3d/human/back-photo.test.ts`, com polo, camiseta, moletom e jeans na malha real. Cobre:
- espelhamento;
- frente e costas nunca no mesmo vértice;
- gola recebendo o topo da foto;
- peso zero fora da foto;
- detecção da composta (Kappa, peça única, calça e três vistas).

Pela regra de homologação da auditoria:
- "Foto traseira disponível, porém ignorada": antes **Reprovado**, agora **Aprovado** (a foto é usada).
- "Sem referência da região": **Sem evidência**, declarado na interface.
- Laterais e mangas sem foto própria: continuam **Sem evidência**.
- Comparação automática entre foto e render, e "logo deformado bloqueia homologação": **Reprovado**, ainda não
  implementados (P1).

Limitações:
- A divisão da composta exige recorte com alfa. Uma foto opaca de peça branca sobre fundo branco só se divide depois
  do recorte do backend.
- Quantos produtos do catálogo têm foto `BACK` cadastrada não foi medido (exige o banco).

## 06 · Corpos e poses

| Corpo | Pose | Coberto |
|---|---|---|
| Referência F e M | Parado (exibição) | Sim (`fit-matrix.ts`) |
| Referência F e M | Caminhada | Sim |
| Referência F e M | Braços levantados | Sim |
| Referência F e M | Agachamento | Sim |
| Referência | Sentado | **Não**: a pose não existe em `TestPose` |
| Proporções diferentes (F-plus, M-slim) | Parado e caminhada | Sim |
| Tamanhos comerciais | Parado e movimento | **Parcial**: `applySize` é testado em `garment-fit.test.ts`, mas não na matriz de poses |

Métricas existentes: penetração, folga, silhueta e cobertura. Faltam: estiramento de textura, distorção de logo e
continuidade de estampa entre painéis.

## 07–09 · Protocolo, prioridades e gate

- **Interface honesta:** toda peça mostra "Prévia estimada" com o motivo ("molde estimado do corpo com a foto da
  frente; não é prova de caimento nem de tamanho"), mais as limitações da subcategoria e, agora, a evidência das costas.
  Nenhuma peça é declarada homologada (`APPROVED_WEARABLES` vazio) — **Aprovado**.
- **Matriz gerada do banco** (marca → SKU → variante → render): não existe. A matriz atual é por subcategoria e usa o
  acervo local.
- **Prioridades P0:**
  - Feito: interpretação de manga, cintura, gola e Slim; foto das costas.
  - Pendente: asset por SKU e identidade dos tênis.
- **Prioridades P1 pendentes:** lapelas, pé de gola, pregas, simulação de tecido e comparação automática entre foto e
  render.

## Regressões de merge encontradas e corrigidas

Os 7 arquivos de teste do provador que falhavam na main não eram instáveis: o produto estava quebrado.

| Problema | Efeito para o usuário | Correção |
|---|---|---|
| Um merge descartou 125 chaves de tradução: caimento (`fit.*`), medidas (`medidas.*`), tamanhos (`size.*`), câmera de detalhe (`tryOn.detalhe.*`) e modificadores do heist (`afterparty.mods.*`) | Textos crus como "fit.verdict.tight" e "medidas.estimado" na tela | Restauradas do histórico do git nos três idiomas; só chaves usadas pelo código ou famílias que sumiram por inteiro |
| O seletor de tamanho foi removido do JSX de `fitting-items.tsx` (o cálculo ficou, a renderização não) | O provador **não mostrava o seletor de tamanho** por peça | Seletor recolocado com o retorno por região |
| `scenes-lab.test.tsx` renderizava sem o provedor de idioma | Só no teste | Teste envolvido no `I18nProvider` |
| `CatalogImagePipelineService` perdeu o `viewRank` (frente antes das costas) | A textura podia sair da foto de costas | Corrigido no commit anterior deste branch |

Testes:
- Suíte do frontend completa: 3.068 passam. As duas falhas que sobraram vieram da mudança do selo para a lista Info e
  tiveram os testes atualizados. `classic-modes.test.tsx` passa isolado com e sem estas mudanças (instabilidade de tempo
  sob carga).
- Typecheck, lint de estilos, design e i18n: limpos.
