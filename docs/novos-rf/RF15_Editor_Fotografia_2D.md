# RF15: Editor de Fotografia 2D da peça (proposta de estrutura)

**Projeto:** FashionAI (TCC 2026) · **Versão:** 0.2, de 05/10/2026 · **Situação:** proposta para discussão com o time e os orientadores. Esta versão revisa a 0.1 a partir de três pareceres: completude, viabilidade, e fidelidade e aspectos jurídicos.

**Rastreabilidade:** card RF15 na lista "Requisitos Funcionais – TEMAS FUTUROS" do Trello, que depende do RF4. Os critérios de aceite atuais estão em `markdowns/02-rf-reestruturados-e-criterios-aceite.md:305-313`.

**Trello.** Nada foi alterado no Trello. As regras (RN15.xx), os critérios (RF15.CAxx) e as decisões (Dx) deste documento são propostas. Cabe ao time decidir e transcrever o que for aprovado.

**Convenções.** Os rótulos abaixo aparecem ao longo do texto:

- *FATO*: verificado no código (commit `89b3cf2c`) ou na fonte citada.
- *INFERÊNCIA*: deduzido do código, ainda sem teste.
- *PROPOSTA*: decisão de projeto deste plano.
- *Hipótese*: número de partida que o próprio TCC vai calibrar. Não é norma.

Fontes externas aparecem como [n]. Arquivos do repositório aparecem como `caminho:linha`.

**O que mudou da v0.1, em resumo:**

1. **Escopo.** O escopo passa por uma decisão explícita dos orientadores (D0). A recomendação é comprometer F0 e F1, que corrigem código do RF4 já em produção, e deixar o editor enxuto condicionado a um ponto de decisão.
2. **Privacidade.** A original, a prévia e as máscaras passam a ser privadas. A cópia de peça pública deixa de levar a foto de outra pessoa. A foto própria é privada por padrão (RN15.07).
3. **Proveniência do envio.** Os metadados de origem são lidos antes de serem removidos. A foto é comparada por hash perceptual com a foto oficial, e a pessoa declara que a foto é dela. Nenhuma origem não verificada é afirmada.
4. **Backfill.** Há uma migração de dados para as peças com `image_origin` nulo ou com foto oficial sobrescrita.
5. **Arquitetura mais simples.**
   - render síncrono, com semáforo;
   - a entidade editada passa a ser o registro `Photo` que já existe;
   - canvas puro com alças DOM, sem Konva;
   - classe de fidelidade decidida por lista de operações permitidas, em vez da matriz 3×3;
   - portão de cor só cromático;
   - LUT sem `pow` em tempo de execução.
6. **Rascunho.** O rascunho fica no IndexedDB e há tratamento para quando a conexão cai.
7. **Novas seções.** Instrumentação (§10.6), método de avaliação com ética de pesquisa (§10.0), análise de similares (§2.1), operação e custos (§8.11), fotos vestidas, de detalhe e de defeito (§3.6) e regras da Arara (RN15.08).
8. **Correções.** Citações e referências de linha corrigidas, e critérios de aceite reescritos para serem testáveis.

---

## 0. Resumo executivo

**O que é.** O RF15 é o editor da **fotografia própria** de uma peça. Nele, a pessoa:

- enquadra a foto para o card;
- endireita a imagem;
- corrige luz e balanço de branco *sem alterar a peça*;
- tira o fundo;
- oculta áreas privadas;
- compara com a original e guarda versões.

Desde 05/10/2026, o caminho principal do RF4 é o produto do catálogo (foto oficial) ou o formulário (ilustração da categoria). A foto própria é **opcional**: pode ser enviada no cadastro ou depois, no detalhe da peça. É essa foto, e só ela, que o RF15 edita.

**Para quem.** O público principal é o dono da peça: em geral iniciante, usando celular, muitas vezes um Android de entrada. Em segundo lugar vêm quem anuncia na Arara do Desapego (RF32), onde a foto funciona como oferta, e os perfis de marca e de celebridade.

**Por que importa.**

- **A imagem é o primeiro ponto de atenção.** Em testes de usabilidade, 56% das primeiras ações na página de produto foram explorar as imagens [14]. Grades consistentes são mais fáceis de percorrer e comparar [17], [22].
- **Cor errada gera devolução.** Uma pesquisa com 100 varejistas dos EUA estimou que cerca de 16% das devoluções de vestuário se devem à cor [23]. É a visão do varejo, não do consumidor, mas basta para mostrar que mexer na cor de uma peça nunca é neutro.
- **O código atual tem defeitos verificáveis (§1.2):**
  - o editor é destrutivo;
  - os ajustes de luz usam `ctx.filter`, que só funciona no Safari com uma flag experimental [56], [57];
  - a foto própria sobrescreve a oficial;
  - a original fica acessível a qualquer visitante;
  - a cópia de peça pública leva a foto pessoal de outra pessoa;
  - uma edição apaga a marcação de imagem gerada por IA.

**Ideia central (PROPOSTA).**

- A original nunca muda (RN45.01) e é sempre **privada**.
- O navegador edita uma prévia e envia uma **receita** JSON versionada (`fai.edit/1`), de poucos KB.
- O servidor gera a imagem final de forma **síncrona e determinística**, usando tabelas de cor compartilhadas com a prévia.
- A **classe de fidelidade** sai da lista de operações usadas: FIEL, RETOCADA, VITRINE ou CRIATIVA.
- O RF15 nunca gera pixel da peça (RN45.04), nunca edita a foto oficial (RN47.03) e nunca afirma uma origem que não verificou.

**Escopo do TCC × temas futuros (decisão D0, PROPOSTA).**

| Opção | Conteúdo | Esforço | Recomendação |
|---|---|---|---|
| **1. Comprometida** | F0 (correções em produção) + F1 (proveniência, privacidade, escolha da imagem do card, backfill) + *spike* técnico (tabelas compartilhadas + render de um documento no servidor) + este documento como capítulo de trabalhos futuros + avaliação enxuta | ≈ 21–31 dias-pessoa | **Aprovar já**: corrige defeitos do RF4 em produção, com risco jurídico e de LGPD |
| **2. Condicionada** | Opção 1 + editor enxuto (F2–F4): Enquadrar (4:5 e Livre), girar, endireitar, Luz, balanço de branco, Tirar o fundo, Ocultar área, Comparar, Desfazer, Versões + estudo com usuários | +20–28 dias-pessoa (≈ 41–59 no total) | Decidir no ponto de controle ao fim do F1, e só se restarem ≥ 5 semanas para as duas pessoas |
| Futuro | Pincel de máscara, sombra, temperatura/matiz, várias fotos por peça, seleção por toque, retoque, exportação para redes sociais, C2PA, RF44, RF16 | — | Capítulo de trabalhos futuros |

As decisões pendentes estão no §11.3 (D0 a D13). As mais urgentes são estas:

- **D0:** escopo;
- **D2:** imagem do card;
- **D9:** visibilidade da foto própria;
- **D11:** destino das cópias que já existem com foto de outra pessoa.

---

## 1. Contexto e escopo

### 1.1 Do RF4 com foto opcional ao RF15

O texto do RF15 no Trello é: "Editar uma fotografia de uma peça de roupa proveniente da adição de uma peça de roupa ou criação de novo esquema de vestimenta, através de um Editor Canvas Interativo 2D". Com o RF4 de 05/10, essa foto só existe quando a pessoa decide enviá-la. Por isso há três entradas:

- **A, no cadastro:** depois de escolher o produto do catálogo ou preencher o formulário;
- **B, no detalhe da peça;**
- **C, em Minhas Fotos.**

A foto de esquema de vestimenta, que também aparece no título, fica para depois do MVP. A escolha de usar o registro `Photo` como objeto da edição (§9) já cobre esse caso sem polimorfismo.

### 1.2 Situação atual (FATO, salvo indicação)

| Aspecto | Evidência | Consequência |
|---|---|---|
| O editor atende ao texto dos CA01–CA05 atuais: recorte, giro, brilho/contraste, remoção de fundo, desfazer e confirmação ao sair | `components/photo-editor.tsx:38-43, 64-98, 130-150` | Serve de base para a UX, não para a arquitetura |
| Só é não destrutivo durante a sessão. Salvar grava um PNG achatado | `photo-editor.tsx:11-12, 29-36`; `PhotoService.java:380-399` | Não dá para retomar nem auditar uma edição |
| `ctx.filter` não funciona no Safari e no iOS [56], [57]; o canvas usa a resolução nativa, e o iOS limita a área do canvas [58] | `photo-editor.tsx:32` | INFERÊNCIA: no iPhone, os sliders não fazem efeito |
| PNG salvo na resolução nativa, contra um limite de 10 MB (o multipart aceita 15 MB) | `ImageOps.java:34`; `application.yml:28-29` | INFERÊNCIA: fotos de 12 MP falham com `ARQUIVO_GRANDE` |
| "Remover fundo" roda o Flat Lay inteiro: remove o fundo, endireita (PCA), normaliza a cor e recompõe em 1024 px | `WardrobeService.java:1548-1551`; `FlatLayPipeline.java:22-24` | Gasta cota de IA e devolve pixels transformados. O recorte anterior fica desalinhado |
| A foto própria sobrescreve o `imageUrl` da peça de catálogo. `USER_PHOTO` e `user_image_url` nunca são gravados. `image_origin` fica nulo nas peças criadas por `POST /api/pieces`, nas peças antigas e após "Trocar foto" | `WardrobeService.java:1226-1239, 1898`; `WardrobeItem.java:303-310`; `docs/anatomias/anatomias_card_v20.html:242-246` | Viola a RN46.08. Um selo "Foto oficial" apareceria sobre a foto da pessoa |
| `PUT /api/pieces/{id}/image` não passa pela moderação de "é roupa?" que o cadastro aplica, remove o Estúdio sem perguntar e apaga `aiGeneratedImage` quando falta `editedFromPhotoId`. O selo de IA está gravado em camada que o recorte corta | `WardrobeService.java:296-300` × `:1894-1914`; `AiSeal.java:43-45` | Permite trocar a foto por qualquer imagem "segura" que não seja roupa e "lavar" o selo de IA. A moderação de segurança, em si, existe: todo multipart passa pelo `UploadSafetyInterceptor` (`UploadSafetyInterceptor.java:31-40, 97-104`) |
| **A original fica pública:** `Views.piece` envia `originalImageUrl` a qualquer visitante; `/media/**` é `permitAll`, e o proxy só bloqueia `restricted/`, `exports/` e `backups/` | `Views.java:96`; `SecurityConfig.java:43, 82`; `MediaProxyController.java:52-53`; `MediaProxyControllerTest.java:43-65` | A foto sem recorte (rosto, casa, espelho) pode ser baixada por qualquer pessoa |
| **A cópia de peça pública** (`POST /api/pieces/{id}/copy`) copia `imageUrl`, `thumbnailUrl` e o Estúdio do dono. Não copia `aiGeneratedImage`, `imageOrigin` nem `catalogProductId` | `WardrobeService.java:2542-2547` | A foto pessoal de uma pessoa vai parar no guarda-roupa de outra, e a marcação de IA se perde |
| A cópia por IA do MultiPiece é gravada, já com o selo, como a `original` da peça | `MultiPieceService.java:340-351` | Uma imagem sintética viraria "foto da pessoa" |
| Apagar em Minhas Fotos a foto de uma peça põe a ilustração da categoria até em peça de catálogo | `PhotoService.java:216, 242` → `WardrobeService.java:1482-1489` | A foto oficial se perde |
| O card prioriza o Estúdio. Quando a fonte muda, o Estúdio novo entra no ar "aguardando aprovação" | `piece-card.tsx:28-33`; `edit-image.tsx:51, 123`; `piece-art-editor.tsx:186`; `WardrobeService.java:2156-2177` | Uma edição do RF15 não apareceria no card, e o Estúdio entra sem aprovação |
| A recodificação da original (`ImageOps.jpeg`) descarta o perfil ICC. A única dependência TwelveMonkeys é `imageio-webp` | `WardrobeService.java:398`; `MultiPieceService.java:131-132`; `fai-application/pom.xml:50` | INFERÊNCIA: fotos em Display P3 são gravadas com a cor errada |
| `Uploads` aceita HEIC, mas o interceptor recusa a imagem que o servidor não decodifica | `Uploads.java:13`; `UploadSafetyInterceptor.java:99-101` | Regras incoerentes entre camadas |
| Há uma pilha fiel pronta e desligada (`CanonicalPhotographer`, `PhotographySpecs` v1, `PhotographyQualityGate`, `LandmarkDetector` geométrico sobre a máscara) | `CanonicalPhotographer.java:18-25, 59`; `LandmarkDetector.java:12-24` | Pode ser reaproveitada, mas depende de uma máscara |
| Não há testes do editor; o recorte só funciona arrastando | `photo-editor.tsx:113-119` | Fere o critério 2.5.7 da WCAG 2.2 [77] |

### 1.3 Fronteiras com outros requisitos

| Requisito | Fronteira com o RF15 |
|---|---|
| **RF4** Adicionar peça | O RF4 recebe a foto e aplica o aceite: moderação, proveniência, detecção de pessoa e PhotoAcceptance. O RF15 só edita. As duas entradas usam o mesmo aceite (§5.2, §7.4) |
| **RF11** Background Studio | Nunca altera os pixels da foto (`anatomias_card_v19.html:172`). O RF15 só escolhe o *preenchimento* atrás da peça |
| **RF44** Creative Engine (RF46 no repositório) | Toda operação generativa vira um asset criativo separado e com selo (RN46.01, .03, .09). A tabela de equivalência RF44 ↔ RF46 vai para `docs/novos-rf/README.md` (D1) |
| **RF45** Pipeline canônico (arquivado) | O RF15 nunca grava `CANONICAL`. Só as máscaras do servidor podem servir de dica ao `CanonicalPhotographer`; os traços da pessoa, nunca |
| **RF12** Minhas Fotos | A original fica visível *só para o dono*. As versões aparecem agrupadas |
| **RF32** Arara | Peças `forSale` seguem a RN15.08 |
| **RF41 v2 / RF48** FAI Points | `PIECE_IMAGE_REFINED` (`RF41_v2_Concessao_FAI_Points_Todos_RFs.md:170`) é concedido **uma vez por peça**, só na primeira revisão FIEL que aprove pelo menos um item a mthe more do checklist do que a original. Nunca vale para restauração nem para documento identidade. A chave idempotente é (pieceId, evento). `PIECE_USER_PHOTO_APPROVED` (`:87`) passa a depender do aceite RF4/RF15 (PhotoAcceptance + moderação aprovada), não do RF45 arquivado. A mudança será proposta no documento do repositório. Nenhum dos dois eventos existe no código hoje (FATO) |
| **RF16** 3D | Fora do escopo |

### 1.4 Regras herdadas e regras propostas

**Herdadas:**

- **RN45.01:** o original nunca é sobrescrito.
- **RN45.04:** transformações canônicas não geram conteúdo inexistente na peça (`docs/visao-computacional/RF04_ADAPTIVE_GARMENT_CAPTURE.md:325-345`).
- **RN45.06:** o modelo e a versão usados ficam registrados.
- **RN46.01:** o asset criativo nunca substitui o canônico em silêncio.
- **RN46.03:** assets generativos são identificados.
- **RN46.08:** produto real usa o asset canônico.
- **RN46.09:** o que é generativo fica só na camada criativa.
- **RN47.03:** imagem sem licença de guarda fica como `REFERENCE_ONLY` (`docs/catalogo/RF47_ACERVO_BUSCA_CATALOGADA.md:163`). Base legal na Lei 9.610/98: o art. 29 exige autorização para transformar a obra; o art. 79 §1º exige indicar o autor da fotografia; o art. 79 §2º proíbe reproduzi-la em desacordo com o original [44].

**Propostas** (para o time decidir):

- **RN15.01:** só pode ser editada a foto `USER_PHOTO` enviada pela pessoa que edita (`photos.user_id` = usuário atual). As origens `CATALOG`, `DEFAULT`, `AI_GENERATED` e `SHARED_COPY` são só exibidas.
- **RN15.02:** toda edição é uma receita sobre a original, que não muda. A imagem exibida é sempre um derivado gerado no servidor.
- **RN15.03:** o RF15 produz só as classes FIEL e RETOCADA. Uma operação que gere pixel pertence ao RF44.
- **RN15.04:** a classe e a marcação de IA são calculadas no servidor, a partir da lista de operações e da linhagem da imagem. O cliente não declara a classe.
- **RN15.05:** nenhuma edição espelha a peça, altera suas proporções ou esconde defeito. Em peça `forSale`, as ferramentas de retoque ficam desligadas.
- **RN15.06:** a imagem do card é escolha explícita: `OFFICIAL`, `OWN` ou `STUDIO_APPROVED`. O padrão é `OFFICIAL` para peça de catálogo e `OWN` para peça sem imagem oficial.
- **RN15.07 (privacidade):**
  - A original, a prévia e as máscaras são sempre privadas.
  - A imagem renderizada da foto própria só aparece em superfícies públicas (perfil, feed, looks públicos, Arara) quando a pessoa ativa "Mostrar minha foto para quem vê a peça". Isso fica desligado por padrão nas fotos novas e é proibido por padrão em contas de adolescentes.
  - A cópia de peça pública nunca leva a foto própria.
- **RN15.08 (Arara):**
  - (a) Publicar um anúncio exige pelo menos uma foto própria renderizada como identidade ou FIEL.
  - (b) A imagem principal usa preenchimento neutro (#FFFFFF, #F3F3F3 ou o fundo real), sem fundo colorido do Estúdio.
  - (c) A peça aparece inteira: na imagem principal, `requiredVisibleRegions` **bloqueia** em vez de só avisar.
  - (d) A foto oficial só aparece como secundária, com o rótulo "Foto do produto novo · referência da marca · {domínio}" e link para a fonte, e apenas quando a licença do catálogo permite exibir. Sem licença, só o link.
  - (e) VITRINE, RETOCADA e CRIATIVA nunca são a imagem principal.
  - (f) O campo "Defeitos e sinais de uso" é obrigatório. Se houver defeito declarado, é obrigatória uma foto de detalhe (§3.6).
- **RN15.09 (proveniência do envio):** toda foto própria passa pela leitura dos metadados de origem antes de eles serem removidos, pela comparação perceptual com a foto oficial vinculada e pela declaração "Esta foto é minha e mostra a minha peça" (§7.4).

---

## 2. Princípios de design

| # | Princípio | Como verificar |
|---|---|---|
| P1 | **Fidelidade do produto.** Correções globais de captura, sim; alterar a peça, não. A AP admite ajustes "minimally necessary for clear and accurate reproduction" [38], e a Zalando não usa "filters, saturation or lighting changes" [3] | 100% das revisões FIEL contêm só operações permitidas (teste de propriedade, §10.2) |
| P2 | **Não destrutivo.** A original não muda e "Voltar à original" sempre funciona, como no darktable/XMP [67], [68] e no Mercado Livre [8] | O `source_sha256` é igual em todas as revisões |
| P3 | **Mobile-first.** Um controle por vez, a foto nunca fica coberta e os alvos de toque têm 44 px. O mínimo AA do critério 2.5.8 é 24 px [79]; os 44 px vêm do 2.5.5 (AAA) [125] e do HIG da Apple [126] | Teste em iPhone e em Android de entrada (§10.3) |
| P4 | **Orientado por categoria.** Ocupação, regiões obrigatórias e alinhamento vêm da `PhotographySpec`. A proporção de saída é sempre a do card (§3.5) | Os presets são lidos de `PhotographySpecs.java:40-104` |
| P5 | **Acessível.** Tudo o que se faz por gesto também tem botão e teclado (WCAG 2.2 AA) [76] | Auditoria com axe, teclado, VoiceOver e TalkBack |
| P6 | **Transparente com IA.** A IA sugere e a pessoa decide. O rótulo é preciso e diferencia "editada" de "gerada" [52], [53] | Rótulo e DigitalSourceType coerentes com a classe (§7.3) |
| P7 | **Consistente com o card.** A área da peça é 4:5, e "nada da arte passa por cima dela" (`anatomias_card_v19.html:105`) | Prévia do `PieceCard` dentro do editor |
| P8 | **Privado por padrão.** Coletar o mínimo, guardar só para o dono, publicar só por escolha (LGPD, art. 6º III e VII, e art. 46 §2º [45]) | CAs 18 a 22 |

### 2.1 Análise de similares (PROPOSTA de protocolo + quadro preliminar)

**Protocolo.**

- Observar cada produto em 10/2026, num iPhone e num Android, anotando a versão do app.
- Guardar as capturas de tela em `docs/rf15/similares/AAAA-MM-DD_produto_*.png`.
- Preencher o quadro de forma cega por cada integrante e depois conciliar.

As células marcadas "?" ainda serão observadas. As demais vêm de documentação pública citada ou de uso corrente e precisam ser confirmadas na observação.

| Produto | Não destrutivo | Proporções | Fundo | Guia de captura | Rótulo de IA | Comparar | Decisão do §6 que inspira |
|---|---|---|---|---|---|---|---|
| Apple Fotos (iOS) | Sim ("Reverter") | Presets + livre | "Isolar objeto" | Nível na câmera | ? | Tocar mostra a original | "Voltar à original"; comparar por toque |
| Snapseed / Google Fotos [96] | Sim (pilha de edições) | Presets | Google Fotos: edição generativa | — | ? | Botão; comparar dentro da ferramenta | Comparar com o estado antes da ferramenta |
| Lightroom Mobile [97] | Sim | Presets | Máscara por seleção de objeto | — | ? | Tocar e segurar | Toque duplo redefine o slider |
| Photoroom | ? | Formatos de marketplace | Núcleo do produto | ? | ? | ? | Preenchimentos lisos |
| Editor do Mercado Livre [7], [8] | "Recuperar fotos originais" | ? | Fundo branco | Regras por categoria | — | ? | Fundo neutro; recuperar a original |
| Shopify [9], [10] | ? | Proporção uniforme recomendada | ? | Guia de fotografia | ? | ? | 4:5 uniforme na grade |
| Vinted | ? | ? | ? | ? | ? | ? | Foto real na revenda (RN15.08) |
| Enjoei | ? | ? | ? | ? | ? | ? | Foto real na revenda (contexto BR) |
| Zalando (diretrizes, não é editor) [3]–[6] | — | — | Fundo neutro | Diretrizes por categoria | — | — | Sem filtro nem saturação; ocupação ~80% |

---

## 3. Fundamentos de fotografia de produto e de moda aplicados

### 3.1 Luz e captura → **guia** antes do envio e quando o portão falha

Mesmo com iPhone em RAW e perfil de cor feito com ColorChecker, o erro médio de cor ficou entre 2,12 e 3,45 ΔE00, e controlar a luz melhorou o resultado em mais de 1 ΔE00 [27]. Por isso o FashionAI **não promete "cor exata"**: orienta a captura e impede que a edição piore a cor.

Painel **"Como fotografar melhor"** (reaproveita `lib/capture/capture-guides.ts`):

1. Fique a 1–1,5 m e use a lente principal ou a de 2×. A perspectiva depende da distância: muito de perto, a peça deforma. Nada de zoom digital nem modo Retrato [102].
2. Use luz difusa de janela, sem sol direto e sem flash [2], [10].
3. Toque e segure na peça para travar foco e exposição. Em peças brancas, baixe a exposição [103].
4. No flat lay, deixe o celular paralelo ao chão, usando o nível da câmera.
5. Use um fundo fosco e neutro. Sulfite não serve de referência de branco, por causa dos branqueadores ópticos [30].
6. Prepare a peça: passada, sem fiapos, fechada, com os bolsos vazios [2], [10].
7. Não deixe pessoas, rostos, espelho ou cômodos aparecerem no quadro. Para mostrar o caimento, use a opção "Vestida" (§3.6).

Cada falha do `PhotographyQualityGate` (blur, lighting, clipping, rotation, perspective, foreignObjects, personPresence) aponta para a dica correspondente.

### 3.2 Cor → **ferramentas** com limite e **medição**

**Balanço de branco por referência neutra.** Aplica ganhos diagonais (von Kries) em RGB linear. Corrigir o balanço sobre um sRGB já processado é sempre uma aproximação [35]. Trabalhar em luz linear reduz o erro. O conta-gotas tem três regras:

- Só aceita amostra **fora da máscara da peça**.
- A correção só é tratada como "correção de captura" quando a amostra é neutra na original (C\*ab ≤ 8 e 20 ≤ L\* ≤ 95) e os ganhos ficam em [0,80; 1,25].
- Fora dessas condições, a mudança entra no portão cromático (§10.2).

**Gestão de cor.**

- Uma imagem sem perfil é tratada como sRGB [31]. O iPhone fotografa em Display P3, e o canvas usa `srgb` por padrão [32], [33].
- PROPOSTA para o F0:
  - adicionar `com.twelvemonkeys.imageio:imageio-jpeg` [34], [122];
  - converter para sRGB com `ColorConvertOp` **antes** da recodificação que hoje descarta o perfil (`WardrobeService.java:398`; `MultiPieceService.java:131-132`);
  - testar com um JPEG em P3.

**Contraste simultâneo.**

- O entorno muda a cor *percebida* [112], [113], e o fundo também influencia como o consumidor avalia o produto [29].
- O Estúdio escolhe de propósito fundos que contrastam com a peça (`StudioPipeline.java:20-35`). Por isso, na Arara, a imagem principal usa preenchimento neutro (RN15.08).
- O "gêmeo neutro" da v0.1 sai, porque partia de uma premissa falsa. O `colorHex` vem do *nome* da cor (`Views.java:94`), e os embeddings são vetores de atributos (`ProjectionService.java:141`, `local-attributes-v1`). Nenhum dos dois depende de pixels.

**Medida.**

- A diferença de cor é medida em CIEDE2000 [111], com a implementação e os dados de teste de Sharma et al. [24].
- Os limiares adotados são **heurísticos, transpostos de outros contextos**:
  - as faixas "<1 imperceptível, 2–3,5 percebida por leigo, >5 cores diferentes" foram propostas para ΔE\*ab (CIE76) [25];
  - os níveis da FADGI variam por tipo de material e medem a acurácia na captura de um alvo de referência, não a mudança causada por uma edição [26];
  - a literatura sobre CIEDE2000 situa a diferença mínima perceptível perto de 1 ΔE00 [111].
- Calibrar esses limiares é uma **contribuição empírica do TCC** (D6). A versão dos limiares (`fidelity.thresholds.v1`) fica gravada no `quality_json` de cada revisão.

### 3.3 Condições de visualização dentro do editor

O julgamento de cor acontece na tela do celular. Tema da interface, cores da marca, True Tone, Night Shift e brilho automático alteram a percepção. PROPOSTA:

- Com a ferramenta **Cor** aberta, o entorno da foto fica cinza neutro (≈ L\* 50), sem o matiz da marca, como pedem as condições de visualização da ISO 3664 [28] e da ISO 12646 [114].
- Dica única: "Para julgar a cor, desligue Night Shift/True Tone e compare com a peça sob luz do dia".
- Na calibração do D6, aparelho e brilho são fixados e registrados.

### 3.4 Composição → **padrões** e **auto-enquadrar**

- **Ocupação.**
  - Referências: Google, 75–90% [1]; Amazon, ≥ 85% [2]; Zalando, ≈ 80% [3].
  - PROPOSTA: 0,80–0,90 conforme a `coverage` da spec, com 4% de margem.
- **Resolução efetiva.**
  - Referências: Amazon, > 1.000 px [2]; Google, ≈ 1.500 px [1]. Zoom insuficiente faz o cliente desistir do produto [14], e em moda o uso de zoom foi associado a menos devoluções [19].
  - O que importa é o recorte, não a original. O checklist mede **pixels da original por pixel de saída**, numa referência de 1600×2000:
    - ≥ 0,8: ok;
    - 0,5–0,8: aviso "zoom fraco";
    - < 0,5: aviso forte.
- **Posição pela anatomia.**
  - O `FeedFraming` posiciona a peça sem inventar nada: gola em y = 0,08, cós em 6% e chão do calçado em 72% (`FeedFraming.java:11-39`).
  - O `LandmarkDetector` v1 trabalha sobre o alfa do recorte. Por isso, auto-enquadrar e zebra só ficam disponíveis **depois de "Tirar o fundo"** ou com a máscara de análise local (§8.5).
  - Não se usa mapa de saliência, que tem viés documentado [55].

### 3.5 Apresentação por categoria → **presets** ligados às `PhotographySpecs`

As specs têm proporções próprias: TSHIRT, POLO e KNITWEAR em 1:1, DRESS em 2:3, SNEAKER em 4:3 e GLASSES em 16:9 (`PhotographySpecs.java:40-104`). O card é sempre 4:5. Por isso a spec entra **só** com cobertura, regiões obrigatórias e alinhamento. O editor oferece dois recortes: **"4:5 Card"** (padrão) e **"Livre"**. O Livre é encaixado com `contain` no 4:5, e as faixas recebem preenchimento neutro.

| Categoria | Cobertura (spec) | Regras de apresentação |
|---|---|---|
| Camiseta, polo, tricô, camisa, jaqueta | 0,88 | Mangas abertas e simétricas, gola alinhada, botões e zíper fechados [4] |
| Calça, saia | 0,88–0,90 | Cós reto, pernas paralelas, barras visíveis |
| Vestido, macacão | 0,90 | Sem cabide aparente [7]; alças visíveis |
| Calçado | 0,86 | Alinhado pela sola, cadarço amarrado, **nunca espelhar**; sugerir o pé esquerdo com o bico para a esquerda [5] |
| Bolsa | 0,86 | Cheia, alças curtas para cima [6] |
| Relógio | 0,92 | Ponteiros em 10:10 quando possível. Num estudo com n = 46, essa posição só reduziu a relutância de compra [101]: é convenção, não regra |
| Joia, óculos, boné | 0,80–0,90 | Fecho visível; lente sem reflexo; boné mostrando a aba [6] |

### 3.6 Fotos vestidas, de detalhe e de defeito

Na revenda, a peça vestida mostra o caimento, e as fotos de detalhe e de defeito mostram o estado real da peça. O Código Civil (arts. 422 e 441 a 446) e a RN15.05 tornam essa transparência relevante. No envio, a pessoa escolhe a **intenção** da foto, gravada em `photos.view_type`:

| `view_type` | Uso | Regras |
|---|---|---|
| `PIECE` (padrão) | "Peça sozinha": pode ir para o card | Fluxo normal |
| `WORN` | "Vestida": secundária, mostra o caimento | Ocultação de rosto sugerida (ligada por padrão em contas de adolescentes); nunca canônica; nunca principal na Arara |
| `DETAIL` | "Detalhe/defeito": secundária | Recorte livre, sem preenchimento e sem ajuste de cor além de exposição; ligada a "Defeitos e sinais de uso" |

O MVP aceita **uma** foto `PIECE` por peça. O MVP-2 aceita até 6 fotos próprias, com uma principal.

### 3.7 Ética do retoque e base legal por ator

**Normas profissionais.**

- A AP admite recorte e ajustes "minimamente necessários" [38].
- A NPPA exige preservar conteúdo e contexto [39].
- A Zalando reposiciona e troca o fundo, mas não aplica filtro, saturação nem mudança de luz [3].
- A ASA britânica condenou leggings alongadas digitalmente (NEXT, 2025) [40].

| Classe | Operações | No RF15 |
|---|---|---|
| Permitido (FIEL) | Recorte, giro, endireitar, escala uniforme, exposição e balanço de branco globais (com limites), contraste limitado, remoção de fundo (só o alfa), preenchimento liso, ocultação por retângulo sólido de área fora da peça | Ferramentas do MVP |
| Limitado (RETOCADA) | Mudança de cor acima do limiar e confirmada; máscara editada além dos limites (§10.2); limpeza local clássica (futuro) | Rótulo visível para todos; nunca principal na Arara |
| Proibido no RF15 | Liquify, alongar, espelhar, recolorir, saturação/vibração, filtros, esconder mancha ou furo, inpainting aprendido, fundo gerado, reiluminação, ampliação generativa, correção livre de perspectiva | Vai para o RF44 ou não existe |

**Quem responde e por quê:**

| Ator | Regime | Consequência no produto |
|---|---|---|
| Particular que vende de vez em quando na Arara | Código Civil, arts. 422 (boa-fé) e 441 a 446 (vícios redibitórios) [46], mais os Termos | RN15.08: foto real, defeitos declarados, retoque desligado |
| Vendedor habitual ou Perfil Marca (fornecedor, CDC art. 3º) | CDC, arts. 6º III, 31 e 37 §1º e §3º [41]; Decreto 7.962/2013, art. 2º [42]; CONAR, art. 27 [43] | "Imagem ilustrativa" obrigatória em VITRINE e CRIATIVA |
| Celebridade ou influenciador em post comercial | CONAR, Guia de Publicidade por Influenciadores [118] | Identificação de publicidade + "Imagem ilustrativa" |
| Plataforma (FashionAI) | CDC, pelos próprios rótulos e pela intermediação; LGPD, como controladora [45] | Rótulos corretos, canal de denúncia, remoção de anúncio |

Os Termos não têm cláusula sobre venda: o 8.3 trata só de itens do Meu Quarto (`docs/legal/TERMOS_DE_USO_v1.md:111`). PROPOSTA de uma seção nova, "Arara do Desapego". Nela, o vendedor garante que a foto é do item real, que os defeitos aparecem e que a imagem principal não é foto de estoque nem imagem de IA. A plataforma pode remover o anúncio, e haverá um canal de denúncia.

---

## 4. Perspectiva de marketing e merchandising visual

1. **Consistência da grade.** Imagens consistentes são "easily scannable and comparable" [17], e a fluência de processamento explica a preferência por contraste entre figura e fundo e por repetição [22]. A consistência vem do **enquadramento e do fundo**, nunca de retoque na peça: a foto da pessoa vale por ser autêntica [16].
2. **Qualidade vende.** Mais imagens, e de melhor qualidade, aumentam as vendas em marketplace [20]. Composição, cor e contraste entre figura e fundo explicam parte do desempenho em fotos de imóveis do Airbnb [21]; a transferência para moda é uma hipótese. Mostrar o produto em movimento reduz o risco percebido [18].
3. **Formatos.**
   - O card da peça é 4:5 (`.pc-media`).
   - O card de catálogo e o `.fai-card .c-photo` são 1:1 (`anatomias_card_v20.html:170`; `globals.css:299`). Um corte central 4:5 → 1:1 cortaria a gola do template TOP.
   - Nas redes: Instagram aceita de 4:5 a 1,91:1 em sRGB [12]; Pinterest usa 2:3 [13].
4. **Procedência.**
   - Os usuários confiam mais em fotos reais, mas querem saber de onde elas vêm [16].
   - Rótulos vagos de "IA" reduzem a confiança [52], e "gerado" e "manipulado" são entendidos de formas diferentes [53].
   - A Meta trocou "Made with AI" por "AI info" depois de rotular retoques leves [51].

**Requisitos derivados (PROPOSTA):**

| ID | Requisito | Nível |
|---|---|---|
| RQ-M1 | Preset "Card 4:5". A imagem renderizada tem altura = min(2000, 2 × altura nativa do recorte) e é sempre JPEG opaco, com feed em 800×1000 e miniatura em 640×800. Guias do template e contorno da área 1:1 em fantasma | MVP |
| RQ-M2 | Superfícies 1:1 usam `contain` sobre o preenchimento, nunca corte central | MVP |
| RQ-M3 | Checklist "Vitrine consistente" no formato `PhotoAcceptance.Check{id, ok, value, threshold, message}` (`PhotoAcceptance.java:54-57`): proporção, ocupação, fundo uniforme, resolução efetiva ≥ 0,8, nitidez, exposição, inclinação ≤ `MAX_TILT` e `missing[]` vazio. Só avisa e oferece correção automática, exceto na imagem principal da Arara (RN15.08c) | MVP |
| RQ-M4 | Rótulos: "Foto oficial · {Marca} · {domínio}" (com link à fonte, art. 79 §1º [44]); "Enviada por você"; "Editada"; "Cor ajustada"; "Retocada"; "Estúdio · luz e fundo simulados" ou "Estúdio com IA · luz e fundo gerados"; "Recriada com IA"/"Gerada com IA"; "Arte criativa" | MVP |
| RQ-M5 | Regras da Arara: ver RN15.08. Principal sem texto nem sobreposição [1], [11] | MVP (proposta ao RF32) |
| RQ-M6 | Exportação para redes (1080×1350, 1080×1440, 1080×1920 com zonas seguras, 1000×1500, 1080×1080) **só de imagens renderizadas de foto própria**. Se o card usa a foto oficial, exporta um cartão com nome, marca e link, sem a foto (RN47.03; Termos 6.1, `TERMOS_DE_USO_v1.md:91`) | Futuro |

---

## 5. Arquitetura de informação e fluxos de UX

### 5.1 Modelo mental e estrutura

Iniciantes pensam em objetivos e, quando editam, tendem a aplicar uma única operação global [86]. Há indícios de que muitos sliders na tela atrapalham. O estudo [87] trata de sliders de espaço latente de GAN, então a transferência para este caso é uma hipótese. PROPOSTA de **revelação progressiva**:

- **Nível 0:** "Auto" e até três ações nomeadas pelo objetivo: "Enquadrar para o card", "Clarear", "Tirar o fundo".
- **Nível 1:** barra com **Enquadrar · Luz · Cor · Fundo · Privacidade · Revisar**, cada uma com ícone e rótulo.
- **Nível 2:** chips de subferramenta e **um slider por vez**, com valor, campo numérico e "Redefinir".
- **Nível 3:** "Avançado", recolhido, com valores técnicos (EV) e, no MVP-2, temperatura e matiz.

### 5.2 Entradas, conforme a origem da imagem

| Entrada | Condição | Comportamento |
|---|---|---|
| **A, cadastro** (`app/(site)/(app)/pieces/new/page.tsx`, etapa 1) | Sempre opcional | 1. "Sua foto (opcional)": câmera ou galeria, com intenção (§3.6) e a declaração "Esta foto é minha e mostra a minha peça" (obrigatória). 2. Envio como **rascunho** (`POST /api/pieces/own-photo/drafts`), com o aceite do §7.4 e barra de progresso, nova tentativa e cancelar. 3. Editor em **modo rápido** (Enquadrar ativo, preset 4:5, "Auto" sugerido sem aplicar). 4. "Usar esta foto" leva à **etapa obrigatória** "Imagem do card: Foto oficial \| Sua foto" (quando há produto do catálogo) e "Quem vê sua foto: Só eu \| Quem pode ver a peça". "Pular" está sempre disponível. A `Photo` só é registrada quando a peça é criada. Rascunho não usado expira em 24 h |
| **B, detalhe** (só o dono) | `USER_PHOTO` própria | "Editar sua foto" abre o editor completo com a receita atual |
| | `CATALOG`, `DEFAULT` | "Adicionar sua foto" (fluxo A). Nunca abre o editor sobre a imagem oficial ou padrão |
| | `AI_GENERATED` | Mostra "Recriada com IA" e "Adicionar sua foto". Nunca edita a imagem sintética, o que também evita selo duplicado (`MultiPieceService.java:340-351`) |
| | `SHARED_COPY` | Somente leitura, com "Adicionar sua foto" |
| **C, Minhas Fotos** (`photos/page.tsx:234`) | Foto própria | Mesmo editor. Se a fonte é restrita (ex.: Espelho de Verdade), a imagem renderizada herda o escopo `restricted/` |

A `EditImageDialog` (`components/edit-image.tsx:29-144`) continua cuidando da revisão do Estúdio e ganha o botão "Ajustar manualmente".

### 5.3 Layout

No celular, o editor ocupa a tela inteira (`100dvh`). Hoje ele é um modal com `max-height: calc(100vh − 170px)` (`globals.css:936-939`).

```
+----------------------------------------------+
| [Fechar]  Editar foto  [Desf.][Ref.][Salvar] |  alvos de 44 px
|           foto (canvas, role="img")          |  60-65% da altura
|     alças DOM do recorte (8 <button>)        |
| [Comparar] [Ver no card]  [-] [+] [Ajustar]  |
| (Auto) Enquadrar Luz Cor Fundo Privac. Rev.  |  role="toolbar", rolável
+----------------------------------------------+
  ferramenta aberta = painel role="region" dentro do editor, sem véu
```

O **elemento raiz do editor é o único diálogo**, com um único `useFocusTrap` (`components/ui/index.tsx:423`). Os painéis de ferramenta são `role="region"` ou `role="toolbar"`, não `Sheet`. O `Sheet` (`:484-492`) cria fundo escurecido e `aria-modal` próprio, o que daria duas armadilhas de foco. Do `Sheet`, reaproveita-se só o CSS de posicionamento. O Escape fecha primeiro a ferramenta e depois o editor. A partir do breakpoint `md`, os painéis viram coluna lateral. Com a ferramenta Cor aberta, o entorno fica cinza neutro (§3.3).

### 5.4 Fluxo, estados, rascunho e conexão

| Estado | Interface | Próximo |
|---|---|---|
| `LOADING` | Placeholder na proporção da foto | `READY_CLEAN`, `RESUME_PROMPT` ou `LOAD_FAILED` |
| `RESUME_PROMPT` | "Retomar edição não salva?" (Retomar / Descartar) | `EDITING_DIRTY` ou `READY_CLEAN` |
| `READY_CLEAN` | "Salvar" desabilitado, com "Faça um ajuste para salvar" | `EDITING_DIRTY` |
| `TOOL_ACTIVE` | Painel com "Cancelar" e "Concluir" | Estado anterior |
| `PROCESSING_BG` | "Tirando o fundo…": indicador de 2 a 10 s; acima de 10 s, barra e "Cancelar" [84]. As outras ferramentas continuam funcionando | `EDITING_DIRTY` ou `BG_FAILED` (mensagem no próprio editor) |
| `SAVING` | O render é síncrono (§9.4) | `SAVED`, `BUSY` (503: nova tentativa automática após `Retry-After`) ou `SAVE_FAILED` (edições mantidas) |
| `SAVED` | "Foto atualizada. A original continua só para você em Minhas Fotos." A prévia é trocada pela imagem renderizada | Fecha |
| `CONFLICT` | "Esta foto mudou em outra janela" → "Recarregar e reaplicar" | `EDITING_DIRTY` |
| `OFFLINE` | Faixa "Sem conexão: suas edições continuam aqui". Geometria, luz e cor seguem funcionando sobre a prévia já carregada; "Tirar o fundo" fica desabilitado, com o motivo. Ao reconectar: "Salvar agora" | `EDITING_DIRTY` |

**Rascunho (PROPOSTA).** O `sessionStorage` é apagado quando a aba fecha [130], então não serve.

- O rascunho vai para o **IndexedDB** [131], com a chave `fai.edit.draft:{photoId}:{sourceSha256}` e o conteúdo `{doc, baseRevision, savedAt}`.
- A gravação é feita com *debounce* de 1 s a cada mudança do reducer. Todo acesso fica em try/catch, e o editor funciona sem o rascunho.
- O TTL é de 7 dias, prazo que coincide com a limpeza do WebKit para sites sem interação [95].
- Ao abrir, se a `baseRevision` do rascunho for a mesma, o editor mostra `RESUME_PROMPT`. Se divergir, segue o fluxo `CONFLICT`, com a opção "Reaplicar o rascunho sobre a versão atual".
- **Conexão:** o editor escuta os eventos `online` e `offline` e as falhas de `fetch`. Uma nova tentativa reenvia o mesmo documento com a mesma `baseRevision`, e a idempotência natural (§9.5) impede revisão duplicada.

Sair só pede confirmação quando há alterações [81]. No resto, vale "prefira desfazer a avisar" [92], [93], e não há aviso com prazo: o desfazer é permanente, pelo painel **Versões**. No histórico, ajustes seguidos no mesmo controle viram uma única entrada, nomeada pelo objetivo [91].

### 5.5 Comparar antes × depois

1. **Segurar** sobre a foto troca na hora para a original, com o rótulo "Original" e sem esmaecimento, por causa da cegueira à mudança [90]. O canvas recebe `-webkit-touch-callout: none` e `user-select: none`.
2. Botão **"Comparar"** (`aria-pressed`, atalho `\`), porque um gesto nunca pode ser o único caminho [82].
3. **Divisor** na revisão final (`components/before-after.tsx`), com alternativa em texto: "Antes: original. Depois: recorte 4:5, luz +40".

Com uma ferramenta aberta, compara-se com o estado anterior àquela ferramenta, como no Snapseed [96].

### 5.6 Textos, números e i18n

| Hoje | Proposta | Motivo |
|---|---|---|
| "Editor Canvas 2D{value}" (`pt-BR.json:2367`) | "Editar foto" | Linguagem de objetivo |
| "As {Math} edição(ões)…" (`pt-BR.json:2361`; `en.json:2361`; `es.json:2361`) | `{n, plural, one {# alteração será descartada} other {# alterações serão descartadas}}`, corrigindo o placeholder `{Math}` nas três línguas | O `{Math}` é um defeito do extrator; ele também aparece em outras chaves (ex.: `pt-BR.json:712, 730, 2204`) |
| "Fundo removido (remove.bg)" | "Fundo removido." O provedor aparece no painel "Como esta foto foi editada" (LGPD, art. 9º) | Não poluir avisos sem esconder a informação |
| "Exposição +0,4 EV", "ΔE", "zebra" | "Luz +40" (EV só no Avançado); "Mudança de cor: pequena / perceptível / grande"; "Áreas estouradas" | Linguagem leiga |
| "✂ Recortar" | "Recortar" + `FaiIcon` decorativo | Leitores de tela leem o símbolo |

Todos os valores numéricos passam por `Intl.NumberFormat(locale, {signDisplay: 'exceptZero', maximumFractionDigits: 1})`, o que dá vírgula em pt-BR e es e ponto em en. Textos traduzidos crescem de 200% a 300% [94]. Por isso os rótulos não têm largura fixa, e a barra é testada em pt-BR e em es com 320 px.

### 5.7 Acessibilidade (WCAG 2.2 AA, com metas AAA onde é barato)

- **2.5.7, arrastar** [77]: as alças do recorte são 8 `<button>` numa camada DOM sobre o canvas, com área de 44 px. As setas movem o recorte e Shift+setas o redimensionam. Há campos numéricos para x, y, largura e altura, e um campo de texto ao lado de cada slider.
- **2.5.1, gestos de ponteiro** [78]: a pinça tem alternativa nos botões −, + e "Ajustar".
- **2.5.8 e 2.5.5, tamanho de alvo** [79], [125]: 24 px atendem o AA; o projeto adota 44 px.
- **Sliders** no padrão APG [80]: Home e End vão aos extremos, e `aria-valuetext` é lido como "Luz: mais 40". Tocar duas vezes no controle redefine o valor, como no Lightroom [97].
- **1.1.1, conteúdo não textual:** o canvas tem `role="img"` e `aria-label` dinâmico ("Foto da peça, recorte 4:5, luz mais 40, fundo cinza-claro").
- **1.4.1, uso de cor:** "Áreas estouradas" usa hachura diagonal além da cor, e o aviso de cor tem texto.
- **1.4.11, contraste de componentes:** alças em dois tons, com contraste de 3:1 sobre qualquer foto.
- **2.4.11, foco visível:** o painel nunca encobre o elemento com foco.
- **2.1.2, armadilha de teclado:** o Tab sai do canvas.
- **2.2.1, tempo ajustável:** não há avisos com prazo.
- **1.4.10, reflow:** o layout funciona com 320 px de largura.
- **1.4.4, zoom:** `touch-action: none` só no canvas.
- **Conta-gotas:**
  - retícula que se move com as setas (1 px; com Shift, 10 px);
  - Enter faz a amostra;
  - a opção automática **"Usar o fundo"** amostra a moldura de 8% fora da máscara.
- **Anúncios e animação:** `aria-live="polite"` anuncia resultados ("Recorte 4:5 aplicado"), e `prefers-reduced-motion` é respeitado.
- **Dicas:** aparecem uma única vez e ficam guardadas em `localStorage`, dentro de try/catch. Não há tutorial em sequência de telas [85].

---

## 6. Catálogo de ferramentas por nível

Níveis:

- **MVP-1:** editor enxuto da Opção 2.
- **MVP-2:** entra se o cronograma permitir.
- **Próxima:** tema futuro priorizado.
- **Futuro.**

A coluna de proveniência usa o vocabulário IPTC DigitalSourceType [47].

| Grupo | Ferramenta | Nível | Padrões e limites (PROPOSTA; hipóteses indicadas) | IPTC |
|---|---|---|---|---|
| Enquadrar | **4:5 Card** (padrão) e **Livre** | MVP-1 | Livre é encaixado (`contain`) no 4:5, com faixas no preenchimento neutro #F3F3F3, listadas em "Como foi editada". Altura de saída = min(2000, 2 × altura nativa do recorte) | humanEdits |
| | Alças DOM, teclado, zoom, deslocamento | MVP-1 | Recorte mínimo: 10% do lado (o atual é 3%, `photo-editor.tsx:78`), com aviso de resolução efetiva (§3.4) | — |
| | **Auto-enquadrar** (`CanonicalPhotographer` + `FeedFraming`) | MVP-1 | Exige máscara. Cobertura de 0,80 a 0,90 pela spec, margem de 4%, ampliação máxima de 2×. `missing[]` vira aviso | algorithmicallyEnhanced |
| | Trava "não cortar a peça" | MVP-1 | Avisa quando a máscara toca a borda numa `requiredVisibleRegions`. Bloqueia na imagem principal da Arara | — |
| | Guias | MVP-1 | Terços só durante o recorte; contorno 1:1 em fantasma; "Ver no card" | — |
| Geometria | Girar 90° | MVP-1 | `rotate90 ∈ {0, 1, 2, 3}` | humanEdits |
| | **Endireitar** | MVP-1 | ±15°, em passos de 0,1°. O recorte fica preso ao **maior retângulo inscrito** na imagem girada, para não sobrar canto vazio. Automático pela PCA da máscara | humanEdits |
| | Espelhar | **Nunca** | Inverte logos e texto | — |
| | Perspectiva | **Retirada** | A escala não uniforme altera proporções (RN15.05; caso NEXT/ASA [40]). Se voltar, só automática por 4 pontos do plano do flat lay, com limite, sempre RETOCADA | — |
| Luz | **Luz** (exposição) | MVP-1 | Slider de −100 a +100, em passos de 5 (0,05 EV); ±1 EV no padrão e ±2 EV no Avançado. Substitui o brilho CSS de 40–180% | humanEdits |
| | **Contraste** | MVP-1 | `c` de −100 a +100 → k = 1 + c/400, entre 0,75 e 1,25, em torno do ponto médio [60] | humanEdits |
| | **Áreas estouradas** | MVP-1 (com máscara) | Pixels da peça com algum canal ≥ 254 ou ≤ 1, com hachura. Aviso acima de 0,5% da área da peça | — |
| | Realces e sombras | Próxima | Exige WebGL2 e uma versão equivalente em Java | humanEdits |
| Cor | **Balanço de branco por conta-gotas** | MVP-1 | Amostra de 5×5 px fora da máscara. Ganhos de R e B entre [0,70; 1,45], em passos de 0,005. A exceção "correção de captura" segue as regras do §3.2 | humanEdits |
| | **Auto** (moldura) | MVP-1 | Gray-world calculado em **luz linear** sobre a borda de 8% (só reaproveita a ideia de `ImageFilters.java:130-205`, que trabalha em gama e com esticamento de 1–99%). Ganho limitado a ±12%. Indisponível quando a moldura tem croma médio acima de 12 C\*ab | algorithmicallyEnhanced |
| | Temperatura e matiz | MVP-2 | Ganhos diagonais equivalentes a ±1.500 K e ±30 de matiz; sempre passam pelo portão cromático | humanEdits |
| | Saturação, vibração, HSL, filtros | **Nunca** no RF15 | — | — |
| Fundo | **Tirar o fundo** | MVP-1 | Só o **canal alfa** do provedor (remove.bg: `channels=alpha` [119]; rembg: alfa do PNG), aplicado sobre os pixels da original. Antes de endireitar, na resolução da segmentação, ampliado no render até 2.400 px (padrão de `FlatLayPipeline.java:250-262`) | algorithmicallyEnhanced |
| | **Preenchimento** | MVP-1 | Branco #FFFFFF; cinza-claro #F3F3F3 (padrão para peça branca); fundo do Estúdio (`BackdropChips`, `components/studio.tsx:65`), proibido como principal na Arara; ou manter o fundo real. O card é sempre JPEG opaco. A versão transparente (PNG ou WebP sem perdas, até 2.048 px) só é gerada sob demanda | algorithmicallyEnhanced |
| | Pincel manter/apagar | MVP-2 | Raio de 0,1% a 10% do lado, com checagem da máscara (§10.2) | humanEdits |
| | Tocar para selecionar (MediaPipe [64]) | Próxima | No aparelho | algorithmicallyEnhanced |
| | Sombra de contato | MVP-2 | Derivada da máscara; opacidade ≤ 0,35; só abaixo da peça [75] | algorithmicallyEnhanced |
| Privacidade | **Ocultar área** | MVP-1 | Retângulo de **preenchimento sólido** (`redact[]`). Pixelização e desfoque podem ser revertidos [54]. Sugerido quando há pessoa na foto (§7.5). Cobrir mais de 1% da peça torna a revisão RETOCADA | humanEdits |
| | Detecção de rosto por caixa (BlazeFace [132]) | Próxima | Só caixa, sem pontos do rosto | — |
| Retoque | Limpar fiapo e poeira (Telea [74]) | Futuro | Contador na receita; desligado em `forSale` (RN15.05) | humanEdits → RETOCADA |
| Presets | Por categoria | MVP-1 | Cobertura, regiões e alinhamento das specs | — |
| | Por estética | Próxima | Galeria que **move os sliders visíveis** [88], [89] | — |
| Revisar | Comparar; checklist de qualidade e fidelidade; Versões | MVP-1 | §5.5, RQ-M3, §10.2 | — |
| Exportar | Imagens do card | MVP-1 | JPEG sRGB, qualidade 0,9 | — |
| | Redes sociais | Futuro | RQ-M6 | — |

---

## 7. IA assistida com guarda-corpos

### 7.1 O que a IA pode fazer no RF15

- segmentar a peça (só o alfa);
- detectar a presença de pessoa para **sugerir ocultação** e restringir envios externos;
- sugerir enquadramento e balanço de branco;
- apontar problemas técnicos.

Tudo entra como sugestão global e auditável: a receita guarda os parâmetros, não o "julgamento" do modelo. Notas estéticas sem referência (NIMA, MUSIQ, BRISQUE) não aparecem nem servem de critério, porque ganhos de "realismo" custam distorção [37].

### 7.2 O que a IA não pode fazer no RF15

Inpainting aprendido, outpainting, fundo gerado, reiluminação, ampliação generativa, recolorir, manequim sintético, alongar e espelhar.

**Estúdio (VITRINE).** O Estúdio atual vai além de "luz simulada":

- aplica contraste local e **vibração só na peça**;
- reilumina por normais;
- com Photoroom ou Stability, gera fundo, luz e ampliação por IA (`StudioPipeline.java:20-35`; [73]);
- o `GhostMannequin` inventa o interior da gola com textura espelhada e apaga cabide e pescoço (`GhostMannequin.java:13-24`).

PROPOSTA para o F0:

1. **O rótulo é derivado das etapas registradas em `studio.stages`:**
   - com provedor generativo: "Estúdio com IA · luz e fundo gerados" + AiSeal + `compositeWithTrainedAlgorithmicMedia`;
   - com GhostMannequin: acrescenta "· interior simulado";
   - só local: "Estúdio · luz e fundo simulados" + `compositeSynthetic`.
2. Tirar a vibração da peça ou acrescentar "cores realçadas".
3. **Nenhuma versão do Estúdio vai ao card sem aprovação explícita.** O `offerStudio` deixa de aplicar sozinho quando a fonte muda (`WardrobeService.java:2156-2177`).
4. **D7:** nas peças `forSale`, ampliação não generativa (bicúbica progressiva, `ImageOps.scale`, ou `ResampleOp` com `FILTER_LANCZOS` do TwelveMonkeys [122]; o Java2D não tem Lanczos) **e** rótulo sempre.

### 7.3 Classes, selo e proveniência

| Classe | Quando | DigitalSourceType [47] | Rótulo visível |
|---|---|---|---|
| ORIGINAL | Envio aceito | O que veio no arquivo (§7.4); **nunca afirmado** pelo FashionAI | "Enviada por você" (discreto) |
| FIEL | Só operações permitidas, dentro dos limites, e portão cromático aprovado | `algorithmicallyEnhanced` (se houve operação automática) ou `humanEdits` | "Editada" |
| RETOCADA | Mudança cromática acima de `confirm`, confirmada pela pessoa; máscara alterada além dos limites; ocultação > 1% da peça; retoque (futuro) | `humanEdits` | "Cor ajustada" ou "Retocada", **visível a todos**. Nunca principal na Arara; nunca dica canônica |
| VITRINE | Estúdio | Derivado de `studio.stages` (§7.2) | Derivado de `studio.stages` |
| CRIATIVA / `AI_GENERATED` | Pixel gerado (RF44), recriação do MultiPiece ou envio com sinal de IA | `trainedAlgorithmicMedia` / `compositeWithTrainedAlgorithmicMedia` | "Gerada com IA" ou "Recriada com IA" + AiSeal |

Regras (MVP):

1. A classe é **calculada no servidor** (RN15.04). As ações C2PA (`c2pa.cropped`, `c2pa.color_adjustments`) [48], [49] também são derivadas pelo servidor; um campo `actions` enviado pelo cliente é ignorado.
2. O `aiGeneratedImage` é herdado da linhagem e copiado na cópia de peça pública. A origem `AI_GENERATED` não é editável no RF15.
3. O AiSeal é aplicado no render e na exportação, nunca numa camada que o recorte possa cortar.
4. Base dos rótulos: CDC, arts. 6º III, 31 e 37 [41], RN46.03 e os Termos.

**Referências legais (só como contexto):**

- O art. 50(2) do AI Act europeu se dirige a *provedores* [50]. O Digital Omnibus (Regulamento (UE) 2026/1744) deu prazo de transição até 02/12/2026 para essa obrigação [120].
- A definição de *deep fake* do AI Act (art. 3º, 60) inclui objetos [121]. Uma imagem realista gerada a partir de uma peça real pede aviso mesmo quando é "estética". O FashionAI aplica o AiSeal a toda imagem realista da peça com pixel gerado, haja ou não obrigação legal.
- No Brasil, o PL 2338/2023 foi aprovado no Senado em 10/12/2024 e segue em tramitação na Câmara. Não é lei [116].

### 7.4 Verificação da proveniência do envio (RN15.09)

No aceite, **antes** da recodificação que remove EXIF e GPS:

1. **Ler os metadados** com `metadata-extractor` [134]: XMP/IPTC `DigitalSourceType`, presença de manifesto C2PA (com `claim_generator` e `actions` quando legíveis; a validação criptográfica fica para o futuro) e EXIF `Software` e `Make`. Grava-se um resumo em `photos.provenance_json`, **sem dados pessoais**: nome do autor, número de série, modelo exato e GPS são descartados.
2. **Sinal de IA** (DST `trainedAlgorithmicMedia`, `compositeSynthetic` ou ação de IA no C2PA): a origem vira `AI_GENERATED`, com `aiGenerated = true`, classe CRIATIVA e AiSeal. O rótulo "Enviada por você" não é usado.
3. **Hash perceptual** de 64 bits (dHash/pHash [123], [124]) comparado com as imagens do produto e da variante de catálogo vinculados. Os hashes são calculados na coleta do catálogo, sem guardar a imagem. Também se compara com as imagens geradas por IA da própria pessoa.
   - Distância de Hamming ≤ 10 com a foto oficial (hipótese, a calibrar com pares do catálogo): recusa com 422 `FOTO_OFICIAL_DETECTADA` e a mensagem "Esta parece ser a foto oficial: escolha 'Foto oficial' como imagem do card".
   - Coincidência com uma imagem de IA: o selo é herdado.
4. **`screenCapture`** declarado no arquivo: aviso "Parece uma captura de tela; envie a foto original" (não bloqueia).
5. **Declaração** obrigatória, gravada em `photos.owner_declared_at`.
6. **Recodificação no aparelho.** Quando o celular reduz a foto antes do envio (§8.9), os metadados se perdem. O resumo registra `reducedOnDevice: true` e `incomingDst: null`, e nada é afirmado.

### 7.5 Consentimento, LGPD e menores

**Rostos e casa.**

- Ao aceitar a foto, o servidor roda o `OnnxPersonSegmenter` local (`ImageSafetyPorts.PersonSegmentationPort`/`PersonParts`, `ImageSafetyPorts.java:26-41`) quando `available()`. Ele mede a fração de pessoa e de pele do rosto.
- O tratamento identifica *presença*, não *quem* é. Isso é coerente com a política ("não usamos reconhecimento facial", `POLITICA_DE_PRIVACIDADE_v1.md:17`), desde que a política passe a declarar a detecção de pessoa, com finalidade e base legal.
- O `face_landmarker` (478 pontos) **não** é usado: é um tratamento maior do que o necessário.
- O tratamento entra no RIPD (art. 38).

**Envio externo.**

- Os provedores (remove.bg, Photoroom, Stability) dependem de `AI_EXTERNAL_PHOTO_PROCESSING`. Sem esse consentimento, o processamento é local (`AiCapability.java:9-10`). Nesse caso, a segmentação devolve a máscara local com a dica "Para um recorte melhor, permita o processamento externo", e **nunca** um 403.
- O pedido no momento do uso informa provedor e país e dá o mesmo peso a "Usar só o servidor do FashionAI".
- Com pessoa na foto, a imagem inteira nunca é enviada: segmenta-se localmente, ou envia-se só a caixa da peça, com a pele pintada de cor sólida.
- A retenção declarada por cada provedor fica documentada.

**Adolescentes** (LGPD, art. 14 [45]; ECA Digital, Lei 15.211/2025, em vigor desde 17/03/2026 [115]; `POLITICA_DE_PRIVACIDADE_v1.md:22, 139-145`):

- nenhum processamento externo;
- ocultação sugerida e ligada por padrão nas fotos com pessoa;
- foto própria nunca pública por padrão;
- de 13 a 15 anos, valem as configurações do responsável.

**Privacidade de armazenamento.** Ocultar uma área protege **só a imagem renderizada**. Por isso a original é sempre privada (RN15.07, §8.7).

**Quarentena e exclusão.**

- A quarentena guarda os bytes crus, com EXIF e GPS (`UploadQuarantine.java:66-72`). PROPOSTA: recodificar sem metadados no `hold`, ou apagar na decisão, com prazo máximo de 30 dias.
- Receitas, máscaras e imagens renderizadas são dados pessoais: entram na portabilidade e na exclusão (art. 18) e nunca vão para os logs.

### 7.6 Onde cada operação roda, e licenças

| Operação | MVP | Futuro |
|---|---|---|
| Geometria, luz e cor (prévia) | Navegador (tabelas, §8.3) | WebGL2 |
| Render final | Servidor (Java2D) | — |
| Máscara de análise (métricas) | Servidor, local (`ImageOps.removeBackgroundLocal`, `FlatLayPipeline.java:94`), sem custo | — |
| Tirar o fundo | Cadeia `BackgroundRemovalPort` (rembg → remove.bg com consentimento → local), **só o alfa**, sem Flat Lay | MediaPipe no aparelho [63] |
| Detecção de pessoa | Servidor, `OnnxPersonSegmenter` local | Caixa de rosto no aparelho [132] |

O README do rembg indica `bria-rmbg` (RMBG-2.0, CC BY-NC) como modelo padrão [65], [66]. O `RembgAdapter` **não envia** o parâmetro de modelo e só *rotula* o resultado como `u2net` (`RembgAdapter.java:40-44`), e o compose usa `danielgatis/rembg:latest` (`docker-compose.dev.yml:78-82`). PROPOSTA para o F0:

- enviar `model=isnet-general-use` (ou `u2net`) explicitamente;
- fixar a tag da imagem;
- registrar o modelo efetivo;
- não usar `@imgly/background-removal` (AGPL) nem o RMBG.

---

## 8. Arquitetura técnica

### 8.1 Visão geral

```
Navegador                                  API (container único)                      Bucket (via /media e endpoints do dono)
GET /api/photos/{id}/editor-session  ----> sessão + proxy <= 2048 px sRGB  ---------->  restricted/users/{uid}/photos/{pid}/...
editor (canvas + DOM) + reducer
tabelas compartilhadas no Worker
POST /api/photos/{id}/revisions {doc} ---> valida -> Semaphore(2) -> EditRenderer
                                           (original + doc) -> métricas -> classe
<---- 201 {revision, urls, quality} <----- grava arquivos e linha photo_edits  ---->  .../renditions/{docSha}-{rv}.jpg
```

### 8.2 Biblioteca de canvas: **nenhuma no MVP**

Comparação feita com `npm pack` em 05/10/2026:

- Konva 10.7: 57 KB gz;
- Fabric 7.4: 92 KB gz;
- PixiJS 8.22: 237 KB gz.

O Konva só ajudaria na geometria e na interação, mas desenha as alças do `Transformer` dentro do canvas. Lá, elas não recebem foco nem aparecem na árvore de acessibilidade. Além disso, cada camada aloca dois canvases no iOS [61]. Como o critério 2.5.7 e o CA14 exigem controles DOM de qualquer forma, e o editor atual já usa um recorte em DOM (`photo-editor.tsx:113-119`), a decisão (D4) é:

- um `<canvas>` com a saída das tabelas;
- uma caixa de recorte em DOM/SVG com 8 `<button>`;
- *pointer events* para arrastar;
- `transform` CSS na prévia do endireitar.

Se o Konva voltar a ser considerado, é preciso subir `react` e `react-dom` para `^19.3.0`. Hoje o `package.json:27-28` declara `^19.1.0`, e o lockfile tem 19.3.0.

Também foram descartados:

- Filerobot (beta, fixa o Konva 9);
- tui-image-editor e glfx (parados);
- OpenCV.js (14,7 MB);
- wasm-vips, que exige COOP+COEP e quebraria o hotlink das imagens do catálogo [62].

### 8.3 Tom e cor por tabelas: paridade exata, sem `pow` em tempo de execução

Exposição, ganhos de balanço de branco e contraste são operações **por canal**. Para que TypeScript e Java produzam bytes idênticos, nenhum dos dois calcula `pow`. As constantes vêm de um arquivo compartilhado, `test-utils/editor-fixtures/tables.json`, com decimais de 17 algarismos:

```
LIN[v8]  = srgbToLinear(v8/255)                 256 valores (IEC 61966-2-1)
T[k]     = srgbToLinear((k + 0,5)/255)          255 limiares para voltar a 8 bits
E[step]  = 2^(step · 0,05)                      81 fatores, de −2 a +2 EV
L'       = min(1, (LIN[v8] · E[step]) · G_ch)   G_ch = ganho/1000, em passos de 0,005
s8       = quantidade de T[k] ≤ L'              busca binária
c'       = (s8 − 127,5) · (1 + c/400) + 127,5   contraste no domínio de 8 bits
OUT_ch[v8] = clamp(floor(c' + 0,5), 0, 255)
```

O que sobra são multiplicações IEEE 754 em ordem fixa, comparações e `floor`, operações determinísticas na JVM e nos motores JS. As 3 × 256 entradas são geradas a cada mudança de parâmetro e aplicadas no Worker. TS (Vitest, em node) e Java (JUnit) são testados contra o mesmo `lut-cases.json`. A única diferença entre prévia e resultado final vem da reamostragem geométrica.

Operações que não são por canal (realces e sombras, nitidez) ficam para a fase seguinte, com shader WebGL2 e uma versão equivalente em Java.

### 8.4 Documento de edição `fai.edit/1`

O recorte é normalizado de 0 a 1 **no quadro depois de `rotate90` e do endireitar, já reduzido ao maior retângulo inscrito**, a mesma convenção do `rotateRect` em `photo-editor.tsx:16`. Os parâmetros são inteiros quantizados.

Ordem fixa dos módulos [67]: geometria → máscara → tom e cor → fundo → ocultação → saída.

```json
{
  "schema": "fai.edit/1",
  "photoId": "a2b9…",
  "sourceSha256": "9d4e…",
  "specId": "PANTS_FRONT_V1",
  "geometry": { "rotate90": 0, "straightenDeci": -23, "crop": { "x": 0.24, "y": 0.05, "w": 0.525, "h": 0.875 }, "aspect": "4:5" },
  "mask": { "base": { "sha256": "c01a…", "provider": "rembg", "model": "isnet-general-use" }, "strokes": [], "featherPermil": 2 },
  "tone": { "lightStep": 8, "contrast": 32 },
  "color": { "wb": { "source": "eyedropper", "sample": { "x": 0.91, "y": 0.10 }, "gainsPermil": [1060, 1000, 930] } },
  "background": { "kind": "solid", "color": "#F3F3F3" },
  "redact": [],
  "output": { "preset": "PIECE_CARD_4x5_V1" }
}
```

O servidor acrescenta:

- `fidelityClass`, `digitalSourceType`, `rendererVersion` e `c2paActions`;
- `quality`, com `thresholdsVersion`, `chromaDeltaE00`, `wbException {applied, sampleC, sampleL}`, `effectiveResolution` e `checklist[]`.

### 8.5 Render síncrono e determinístico (`imaging/EditDocument` + `imaging/EditRenderer`)

**Passos do render:**

1. `ImageOps.decode`, com `setSourceSubsampling` quando a original passa do dobro do lado de saída. A original já está em sRGB, convertida no aceite.
2. Geometria com `AffineTransform` e interpolação bicúbica fixa.
3. Máscara: alfa da segmentação ampliado até o tamanho de trabalho, mais traços e suavização da borda.
4. Tabelas de tom (§8.3).
5. Preenchimento e faixas.
6. Ocultação (retângulos sólidos) e AiSeal, quando a linhagem exige.
7. `ImageOps.jpeg(0.9)`, mais feed e miniatura. A recodificação sai sem EXIF e sem GPS.

**Máscara de análise.** Na criação da sessão, o servidor calcula uma máscara local e gratuita, usada só por métricas, conta-gotas e portão. Ela nunca é enviada para fora.

**Concorrência e memória.** Decodificar 40 MP ocupa cerca de 280 MB (`ImageOps.java:54-60`; teto em `application.yml:151-152`). O container usa `-XX:+ExitOnOutOfMemoryError` (`Dockerfile.backend:34`). PROPOSTA, no padrão do `AuthRateLimitFilter.java:93-108, 163`:

- `Semaphore(2, fair)`;
- `tryAcquire` com espera de 3 s, senão 503 `RENDER_OCUPADO` com `Retry-After: 5`;
- render com limite de 30 s;
- **só revisões completas são gravadas**: sem estados de job, sem polling e sem linhas "presas" depois de um redeploy.

### 8.6 Paridade entre prévia e resultado final

1. Tabelas idênticas byte a byte, testadas nos dois lados.
2. As mesmas coordenadas normalizadas.
3. Depois de salvar, a prévia é **trocada pela imagem renderizada**.
4. Verificação manual em aparelhos reais (§10.3).

O job de paridade no navegador da v0.1 sai: exigiria `@vitest/browser`, Playwright e WebKit no CI, e hoje o `ci.yml:47` só roda `npm test` em node.

### 8.7 Armazenamento, visibilidade e versões

| Objeto | Chave | Quem acessa |
|---|---|---|
| Original (imutável, sRGB) | `restricted/users/{uid}/photos/{photoId}/original/{sha256}.jpg` | Só o dono, por endpoint autenticado (padrão de `GET /api/photos/{id}/file`, `PhotoController.java:60`), `no-store` |
| Prévia (proxy) de até 2.048 px | `restricted/.../proxy/{sha256}.jpg` | Só o dono |
| Máscaras | `restricted/.../masks/{sha256}.png` | Só o dono; nunca no `PieceView` |
| Imagens renderizadas privadas | `restricted/.../renditions/{docSha}-{rv}.jpg` (+ `.feed`, `.thumb`) | Dono, pelo endpoint |
| Imagens renderizadas públicas | `users/{uid}/photos/{photoId}/public/{docSha}-{rv}.*` | Cópia criada quando a pessoa torna a foto pública e apagada quando volta a privada. Fonte restrita nunca gera cópia pública |
| Rascunho do cadastro | `restricted/users/{uid}/drafts/{jobId}/` | Dono; TTL de 24 h. Os rascunhos de análise atuais ficam em `users/{uid}/drafts/` (`WardrobeService.java:397`) e também deveriam migrar |

Regras:

- O `Views.piece` só envia `originalImageUrl` quando quem vê é o dono (hoje vai para todos, `Views.java:96`).
- As imagens renderizadas são endereçadas pelo conteúdo e podem ser **compartilhadas entre revisões**: restaurar uma revisão reaproveita a chave. Um arquivo só é apagado quando **nenhuma** revisão viva o referencia.
- Cada foto mantém imagens renderizadas para as 20 revisões mais recentes. As mais antigas guardam só o documento e são renderizadas de novo se forem restauradas, o que funciona porque o render é determinístico.

### 8.8 Limites e segurança

**Validação do documento por lista de permitidos:**

- até 64 KB, até 50 operações e até 20.000 pontos de traço (simplificados por Ramer–Douglas–Peucker no cliente);
- só inteiros e decimais finitos dentro das faixas do §6;
- cores em `#RRGGBB`;
- **nenhuma URL**: os assets são referenciados por sha256 de objetos do próprio dono, o que impede SSRF;
- nenhum parâmetro passado como texto a uma biblioteca nativa (lição da CVE-2026-66066 no libvips [72]).

**Moderação.** A premissa da v0.1 estava errada: todo multipart passa pelo `UploadSafetyInterceptor`. Em REVIEW, o arquivo vai para a quarentena com 422 `IMAGEM_EM_REVISAO`; em BLOCK, recebe 422. A lacuna real é outra: o envio de foto própria e o "Trocar foto" precisam passar também pela moderação **de peça** do cadastro (`LocalVision.moderate` + `CONTENT_MODERATOR`, `WardrobeService.java:296-300, 948-962`). O `POST` da receita é JSON e não traz bytes de imagem. A v0.1 propunha registrar edições como `PENDING`; isso sai, porque deixaria linhas sem fila de revisão.

**Também valem:**

- os controles atuais de magic bytes e bomba de descompressão (`ImageOps.java:91-98`) e as recomendações do OWASP [71];
- HEIC: o input de arquivo usa `accept="image/jpeg,image/png,image/webp"`, o que faz o iOS converter para JPEG, e `Uploads.java:13` deixa de listar `heic`/`heif`;
- **não** ativar COEP [62].

### 8.9 Desempenho no celular (metas, hipóteses)

- **Durante o arraste:** tabelas aplicadas a um buffer do tamanho da tela (≤ 1 MP), a ≥ 30 fps, dentro do orçamento de quadro do modelo RAIL [129]. O limite de 100 ms [83] é o de resposta, não o de manipulação direta.
- **Ao soltar:** refino sobre a prévia (≤ 2.048 px, ≈ 4,2 MP) no Worker, em ≤ 150 ms num aparelho de referência. Os buffers vão para o Worker como `Transferable` ou via `OffscreenCanvas` [127], [128].
- **Abertura:** o chunk do editor tem ≤ 150 KB gz (`next/dynamic`, `ssr:false`), e o editor abre em ≤ 2 s com perfil 4G num **Android de referência com 4 GB de RAM** (linha Galaxy A ou Moto G).
- **Memória no iOS:** além do limite de área [58], o WebKit tem teto de memória total de canvas. O editor usa no máximo 3 canvases e os libera (`width = height = 0`) ao fechar. A imagem é decodificada uma vez, com `createImageBitmap(..., {imageOrientation: 'from-image'})` (`lib/avatar3d/pipeline.ts:23`).
- **Envio:**
  - progresso, nova tentativa e cancelar;
  - o tamanho do arquivo é exibido;
  - acima de 10 MB ou 12 MP, a foto é reduzida no aparelho para 12 MP (≥ 1.500 px), em JPEG 0,92, e a redução fica registrada na proveniência (§7.4);
  - a opção "Economizar dados" reduz para 4 MP.
- **Histórico:** até 100 documentos, com compartilhamento estrutural.

### 8.10 Compatibilidade com o código existente

| Artefato | Destino |
|---|---|
| `components/photo-editor.tsx` | F0: trocar `ctx.filter` pelas tabelas, limitar a 2.048 px, salvar em JPEG. Opção 2: substituir por `components/photo-editor/` (`Editor.tsx`, `reducer.ts`, `tables.ts`, `tools/*`) |
| `pieceCardImage` (`piece-card.tsx:28-33`), `PieceGallery` (`expanded-card.tsx:110`), `StudioLightbox` (`studio.tsx:124`), `edit-image.tsx:51, 123`, `piece-art-editor.tsx:186` | Passam a usar **um único resolvedor** de imagem (§9.6) |
| `WardrobeService.replaceImage` / `PUT /api/pieces/{id}/image` | Vira "trocar foto": nova `USER_PHOTO` pelo aceite completo; não sobrescreve a imagem oficial nem remove o Estúdio |
| `WardrobeService.addToWardrobe` | Copia `catalogProductId` + foto oficial, ou o `DEFAULT`, e copia `aiGeneratedImage`. Nunca copia a foto própria nem o Estúdio do outro |
| `useDefaultImageAfterPhotoDeletion` | Volta para a foto oficial quando a peça tem produto de catálogo |
| `offerStudio`, `StudioPipeline`, `GhostMannequin` | Aprovação explícita; rótulo pelas etapas (§7.2) |
| `RembgAdapter` | Envia o parâmetro de modelo |
| `MultiPieceService` (cópia por IA) | Grava a origem `AI_GENERATED` |
| `PhotoService.saveEdit`, `POST /api/photos/{id}/edits` (multipart), `POST /api/photos/background-removal` | Deixam de ser usados (mantidos durante a transição) |
| `CanonicalPhotographer`, `PhotographySpecs`, `PhotographyQualityGate`, `LandmarkDetector` | Ligados ao auto-enquadrar e ao checklist |
| `QualityMetrics.exposure` | Mede só dentro da máscara (`QualityMetrics.java:97-111`) |
| `piece_images` (V29) | Fica para o RF45 futuro; não é usada no MVP |

### 8.11 Operação, custos e observabilidade

- **Custo de IA externa.**
  - Nova capacidade `PIECE_SEGMENTER` (RF15, `AI_EXTERNAL_PHOTO_PROCESSING`), com cota de 10 por dia (hipótese).
  - Teto diário em dólar, global e por usuário, pelo `AiBudget` (`AiBudget.java:16-27`), que soma o custo já registrado em `ai_inference_log`. Estourado o teto, o sistema cai para o processamento local sem expor o provedor.
  - O custo por chamada vem da tabela de preços vigente de cada provedor e é registrado; o plano não fixa valores.
- **Armazenamento (hipótese):**

  | Item | Tamanho estimado |
  |---|---|
  | Original de 12 MP | 3–6 MB |
  | Prévia (proxy) | 0,4–0,8 MB |
  | Máscara | 30–120 KB |
  | Por revisão (imagem de 1600×2000 + feed + miniatura) | ≈ 0,8–1,4 MB |

  Com 5 revisões, uma foto ocupa ≈ 8–14 MB. Propõe-se uma cota de 500 MB de fotos próprias por usuário e no máximo 20 revisões com arquivos por foto.
- **Métricas.**
  - Micrometer, via Actuator, que já é dependência: `fai.edit.render` (tempo), `fai.edit.render.rejected` (503), `fai.edit.segmentation{provider, ok}`, permissões livres do semáforo e heap.
  - Hoje `MANAGEMENT_EXPOSURE=health,info` (`Dockerfile.backend:36`). A proposta é expor `metrics` só para ADMIN.
  - A memória é acompanhada pelo painel da Railway.
- **Teste de carga:** k6 [133] com 10 usuários virtuais salvando documentos de 12 MP, para calibrar o `Semaphore(2)` e a espera de 3 s.

---

## 9. Modelo de dados e API

### 9.1 Entidades (migration de esquema `V47__rf15_editor_fotografia.sql`; o número é definido no merge, a última hoje é a V46)

**`photos`** (já existe; passa a ser o objeto da edição, porque já tem `origin`, `sourceEntityId`, `contentHash`, `editedFromPhotoId` e `metadataJson`):

| Nova coluna | Tipo | Observação |
|---|---|---|
| `view_type` | VARCHAR(12) NULL | `PIECE`, `WORN`, `DETAIL` |
| `stored_sha256` | CHAR(64) | Hash dos bytes **gravados**. O `contentHash` atual é do envio cru |
| `phash` | BIGINT | §7.4 |
| `provenance_json` | JSON | Resumo sem dados pessoais |
| `owner_declared_at` | DATETIME(6) | Declaração da RN15.09 |
| `storage_scope` | VARCHAR(12) | `RESTRICTED` ou `PUBLIC` |

**`photo_edits`** (nova):

| Coluna | Tipo | Observação |
|---|---|---|
| `id`, `photo_id` (FK), `user_id` | CHAR(36) | — |
| `revision` / `parent_revision` | INT / INT NULL | Só recebe inserções; UNIQUE(`photo_id`, `revision`) |
| `schema_version`, `renderer_version` | VARCHAR(20) | `fai.edit/1`, `r1` |
| `doc_json` / `doc_sha256` | JSON (até 64 KB) / CHAR(64) | Hash da reserialização feita pelo servidor (§9.5) |
| `rendition_key`, `feed_key`, `thumb_key`, `mask_key` | VARCHAR(512) NULL | NULL quando a revisão saiu da janela de 20 |
| `fidelity_class`, `digital_source_type` | VARCHAR(20) / VARCHAR(60) | Calculados no servidor |
| `ai_generated` | BOOLEAN | Herdado |
| `quality_json` | JSON | Inclui `thresholdsVersion` |
| `created_at`, `version` | | `VersionedAuditableEntity` |

**`wardrobe_items`:**

- `user_photo_id` (FK `photos`, NULL);
- `card_image_source` (`OFFICIAL` \| `OWN` \| `STUDIO_APPROVED`, NOT NULL);
- `own_photo_public` (BOOLEAN, padrão FALSE);
- `sale_defects_text` (VARCHAR(500), proposta ao RF32);
- o enum `image_origin` ganha `AI_GENERATED` e `SHARED_COPY`;
- `user_image_url` passa a guardar a URL da imagem renderizada pública atual (NULL se privada).

**`editor_events`** (nova, §10.6): `id`, `user_ref` CHAR(64) (HMAC), `session_ref`, `name` VARCHAR(40), `props_json` JSON, `created_at`, com retenção de 90 dias.

### 9.2 Backfill (`V48__rf15_backfill_origem.sql` + executor Java idempotente, dentro do F1)

Para cada `wardrobe_items` com `image_origin` nulo ou incoerente, aplica-se a primeira regra que casar:

1. `ai_generated_image = 1` → `AI_GENERATED`.
2. `remixed_from_piece_id` preenchido e `image_url` sob `users/{outro uid}/` → `SHARED_COPY`. Somente leitura; o destino da imagem é decidido em D11.
3. `catalog_product_id` preenchido e `image_url` sob `/media/users/{dono}/` (foto própria sobre a oficial):
   - a `Photo` correspondente vira `user_photo_id`;
   - `image_url` e `thumbnail_url` voltam à URL oficial do catálogo;
   - origem `CATALOG`, `card_image_source = OWN` (preserva o que a pessoa via);
   - `own_photo_public` conforme D9.
4. `catalog_product_id` preenchido com URL oficial → `CATALOG`, `OFFICIAL`; com `default_image = 1` → `DEFAULT`.
5. Sem catálogo, `default_image = 1` → `DEFAULT`.
6. Sem catálogo, `image_url` sob `users/{dono}/` → `USER_PHOTO`, `user_photo_id` pela `Photo` (origem `WARDROBE_ITEM` ou `EDITOR`, por `public_url` ou `original_url`), `OWN`.
7. Outros casos → ficam nulos, entram no relatório, e o código deriva a origem em tempo de leitura.

Procedimento:

- *dry-run* numa cópia do banco de produção;
- relatório de contagens por regra, antes e depois;
- teste de migração com fixture.

Indicador de sucesso: zero peças com origem incoerente e nenhuma foto própria com o selo "Foto oficial".

### 9.3 Endpoints

| Método e caminho | Entrada | Resposta | Erros |
|---|---|---|---|
| `POST /api/pieces/own-photo/drafts` | multipart + `viewType` + `declared=true` | 201 `{draftId, proxyUrl, w, h, sha256, acceptance[], person{present, face}, provenance{…}}` | 413 `ARQUIVO_GRANDE`, 415 `FORMATO_INVALIDO`, 422 `FOTO_RECUSADA` / `FOTO_OFICIAL_DETECTADA` / `IMAGEM_EM_REVISAO` |
| `POST /api/pieces` e `POST /api/pieces/from-catalog` (`CatalogController.java:70`), já existentes | Acrescentam `ownPhotoDraftId`, `editDoc?`, `cardImageSource`, `ownPhotoPublic` | 201 `PieceView` | — |
| `POST /api/pieces/{id}/own-photo` | `{draftId}` | 201 | 403 `ACESSO_NEGADO` |
| `DELETE /api/pieces/{id}/own-photo` | — | 204; exclusão em cascata (§9.7) | — |
| `PATCH /api/pieces/{id}/card-image` | `{source, ownPhotoPublic?}` | 200 `PieceView` | 409 sem foto própria ou sem Estúdio aprovado |
| `GET /api/photos/{id}/editor-session` | — | `{proxyUrl, w, h, sourceSha256, doc, revision, spec, imageOrigin, viewType, capabilities, person}` | 403 `FOTO_NAO_EDITAVEL` (RN15.01) |
| `GET /api/photos/{id}/proxy` · `/original` | — | Bytes, `no-store`, só para o dono | 404 para outros usuários |
| `POST /api/photos/{id}/segmentation` | — | 200 `{maskSha256, provider, model, local, hint?}` | 503 `REMOCAO_FUNDO_INDISPONIVEL` |
| `POST /api/photos/{id}/masks` (MVP-2) | PNG de 1 canal, até 2.048 px | 201 `{sha256}` | 422 |
| `POST /api/photos/{id}/revisions` | `{doc, baseRevision}` | **201** `{revision, urls, quality, fidelityClass, labels}`; **200** na repetição idêntica | 409 `EDICAO_CONFLITANTE`, 422 `DOCUMENTO_EDICAO_INVALIDO`, 503 `RENDER_OCUPADO` + `Retry-After` |
| `GET /api/photos/{id}/revisions?limit=20` · `/{rev}` · `/{rev}/image?size=card\|feed\|thumb` | — | Lista, detalhe e bytes (com checagem de visibilidade) | 404 |
| `POST /api/photos/{id}/revisions/{rev}/restore` | `{baseRevision}` | 201, com nova revisão | 409 |

O caminho `/revisions` evita colidir com o `POST /api/photos/{id}/edits` multipart que já existe (`PhotoController.java:72`). O rótulo "RF15" sai das operações de cópia de peça pública (D1).

### 9.4 Semântica do render

O render é **síncrono**: só existe revisão gravada depois que os arquivos foram armazenados e a linha foi inserida. Não há `RenderStatus` nem polling. Arquivos que sobrarem de uma falha não são referenciados e são removidos por uma varredura de chaves sem referência.

Meta (hipótese): p95 ≤ 4 s para uma original de 12 MP no plano atual da Railway. A medição é a questão aberta 3.

### 9.5 Idempotência e concorrência

- **Idempotência natural.** Se a última revisão tem `parent_revision = baseRevision` e o mesmo `doc_sha256`, o servidor devolve 200 com essa revisão. Isso dispensa o cabeçalho `Idempotency-Key` [69] e a canonicalização JCS [70].
- **Hash do documento.** O `doc_sha256` é o SHA-256 da reserialização do registro tipado validado, com Jackson e chaves ordenadas.
- **Concorrência.** Se `baseRevision` não for a revisão atual, o servidor responde 409, no padrão `baseRev` do RF11 (`piece-art-editor.tsx:227-242`). O `@Version` serve de reforço.

### 9.6 `PieceView` e resolvedor único de imagem

**Campos novos:**

- `imageOrigin`;
- `official {url, brand, sourceDomain, sourceUrl}`;
- `ownPhoto {photoId, url, feedUrl, thumbUrl, revision, fidelityClass, labels[], public}`, só com URLs de imagem renderizada, e para quem não é o dono só quando `public`;
- `cardImageSource`;
- `cardImage {src, cover, badge}`;
- `studio {stale}`.

O campo `originalImageUrl` só vai para o dono.

**Resolvedor** (backend, consumido por `pieceCardImage`, `PieceGallery` e `StudioLightbox`):

1. Peça `forSale` vista por terceiros: aplica a RN15.08.
2. `STUDIO_APPROVED`, com Estúdio aprovado e derivado da revisão atual: usa o Estúdio.
3. `OWN`, visível para quem vê: usa a imagem renderizada atual.
4. Nos demais casos: a foto oficial (com o selo de atribuição) ou o `DEFAULT`.

Quando uma revisão do RF15 é salva, o Estúdio derivado de outra fonte é marcado `stale`, e o `ApprovalPanel` (`edit-image.tsx:119`) oferece "Gerar estúdio a partir da foto editada". Nada é trocado sem aprovação.

### 9.7 Exclusão (LGPD, art. 18)

O `DELETE /own-photo`, e a exclusão da foto em Minhas Fotos, apagam **na mesma requisição**:

- original, prévia, máscaras e imagens renderizadas de todas as revisões, incluindo as cópias públicas;
- as linhas de `photo_edits`;
- as `Photo` de origem `EDITOR`;
- o Estúdio, o 3D e o provador derivados da foto;
- as cópias `SHARED_COPY`.

A peça volta à foto oficial, ou ao `DEFAULT` se não houver oficial. Isso corrige `WardrobeService.java:1482-1489`.

---

## 10. Qualidade e testes

### 10.0 Método de avaliação (Design Science Research)

O trabalho segue o ciclo de construção e avaliação de artefatos da *Design Science Research* [109], [110].

**Questões de pesquisa e hipóteses:**

| QP | Hipótese | Indicador |
|---|---|---|
| QP1: o editor melhora a consistência da grade? | H1: com o editor novo, mais fotos passam no checklist RQ-M3 do que com o editor atual, nas mesmas fotos | Índice de Consistência; coeficiente de variação da ocupação ≤ 0,10 |
| QP2: o editor preserva a fidelidade de cor medida? | H2: o ΔE00 cromático mediano das revisões FIEL fica ≤ `info` (2), e nenhuma revisão FIEL altera pixel da peça fora das tabelas | `quality_json`; teste de propriedade |
| QP3: iniciantes conseguem usá-lo no celular? | H3: sucesso em T2–T6 ≥ editor atual, com tempo menor | Sucesso, tempo, erros, SUS |

**Desenho.**

- **Intra-sujeitos, contrabalançado (AB/BA).** O editor atual, já corrigido no F0 para funcionar no iPhone, é comparado ao novo nas tarefas T2, T3, T4 e T6, por trás de uma *feature flag*.
- **Participantes:** n = 6 a 8, número par, metade com iPhone e metade com Android.
- **Medidas e análise:**
  - SUS com média e IC95% (t) [106]. A média de 68 [104], [105] é **referência**, não critério de aprovação; a escala é de Brooke [100].
  - Sucesso com intervalo de Wald ajustado, adequado a amostras pequenas [107].
  - Tempos com estatística descritiva e Wilcoxon pareado (exploratório).
  - Carga de trabalho com **NASA-TLX raw** [108] no lugar do CSI [98], que foi feito para ferramentas de exploração criativa, e não para um editor de fidelidade.
  - Auditoria WCAG 2.2 AA e revisão heurística pela ISO 9241-110 [99].

**Ética.**

- TCLE para todos os participantes.
- Consulta ao CEP ou à coordenação sobre o enquadramento nas hipóteses do art. 1º, parágrafo único, da Resolução CNS 510/2016 [117].
- Autorização específica de uso das imagens.
- **Kit de peças do time** para quem não quiser usar as próprias; nenhuma foto com rosto.
- Dados anonimizados e apagados ao fim do TCC.

**Ameaças à validade:**

- n pequeno;
- efeito de novidade;
- aprendizado entre as condições (mitigado pelo contrabalanceamento);
- integrantes do time como facilitadores;
- variação de aparelho e de luz;
- amostra de conveniência.

O estudo de percepção com 15 a 30 participantes fica para o futuro. Na Opção 1, a avaliação é enxuta: 5 usuários fazem T1, "Adicionar sua foto" e T8, mais o SUS.

### 10.1 Métricas de qualidade de imagem

O editor reaproveita, **só como orientação**:

- `QualityMetrics` (nitidez por Laplaciano, exposição, cobertura, centralização);
- a estimativa de ruído de Immerkær (`StudioQuality.java:15`);
- o `PhotographyQualityGate` (ACCEPT 75 / GUIDE 50).

Nenhuma dessas métricas dispara realce automático. O SSIM [36] fica como diagnóstico, não como critério.

### 10.2 Fidelidade (servidor)

1. **Classe pela lista de operações permitidas.** O servidor é o único renderizador e só executa operações dessa lista. O documento só admite operações por canal (ganhos diagonais e tabelas), então misturar canais é impossível por construção. Há um teste de propriedade sobre o `EditRenderer`: pixels com α ≥ 0,98 são iguais a `OUT(original reamostrada)`. A matriz 3×3 da v0.1 sai, porque marcaria edições legítimas: o contraste é uma curva, e há recorte de valores.
2. **Portão cromático.**
   - Roda **só quando há operação de cor** (balanço de branco manual, Auto, temperatura ou matiz). Luz e contraste dentro dos limites ficam de fora, porque também mudam C\* (o croma CIELAB escala com a luminância).
   - Métrica: CIEDE2000 sem o termo ΔL′ (só ΔC′ e ΔH′, com o termo de rotação). Compara a cor média da peça dentro da máscara (L\* de 5 a 97), entre `render(doc sem as operações de cor)` e `render(doc)`.
   - Faixas em `fidelity.thresholds.v1` (hipóteses): `info` > 2, `warn` > 3,5, `confirm` > 5. Acima de `confirm`, a pessoa precisa confirmar, e a revisão vira RETOCADA com o rótulo "Cor ajustada".
   - A exceção de balanço de branco por referência neutra segue as condições do §3.2, e o resultado fica registrado.
   - O link "Discordo da classificação" abre um pedido na fila de moderação existente (`ModerationQueueItem`), em linha com o art. 20 da LGPD.
3. **Checagem de máscara** (com `redact[]` no MVP-1 e pincel no MVP-2). A revisão vira RETOCADA quando:
   - (a) a área apagada dentro da peça passa de 0,5% da peça;
   - (b) surge um buraco interno novo (mudança no número de Euler);
   - (c) há interseção com regiões do `LogoFinder` ou de etiqueta;
   - (d) a ocultação cobre mais de 1% da peça.

O portão mede a fidelidade **à foto original**, não à peça real. Por isso a interface não promete "cor exata".

### 10.3 Testes automatizados e manuais

- **Java (JUnit):**
  - golden images comparadas por métrica;
  - propriedades com testes parametrizados (jqwik e fast-check **não** são dependências; propõe-se adicioná-los em escopo de teste): documento identidade = fonte, quatro `rotate90` = identidade, recorte dentro do retângulo inscrito, `render(doc)` repetido gera o mesmo SHA;
  - o validador recusa NaN, valores fora de faixa, documento de 1 MB e 10⁶ pontos;
  - CIEDE2000 conferido com os dados de Sharma [24];
  - JPEG em P3 → sRGB;
  - leitura de proveniência (JPEG com IPTC `trainedAlgorithmicMedia`) e dHash.
- **TS (Vitest, node):** reducer (desfazer, limite do histórico, normalização idempotente), tabelas iguais às do Java pelo `lut-cases.json` e rascunho no IndexedDB (com `fake-indexeddb`).
- **Teste de migração:** fixture com os sete casos do §9.2.
- **E2E (`scripts/e2e`):**
  - salvar uma foto de 12 MP;
  - 403 ao editar peça de catálogo;
  - 404 ao pedir a original de outra pessoa;
  - cópia de peça pública sem foto própria;
  - 409 com duas abas;
  - repetição idêntica devolvendo 200;
  - DELETE seguido de 404 em todas as chaves.
- **Manual:** iPhone real (Safari) e Android de referência com 4 GB, incluindo a paridade visual entre prévia e resultado.

### 10.4 Indicadores e fontes

| Indicador (hipótese) | Fonte |
|---|---|
| Índice de Consistência ≥ 80%, comparado à linha de base do acervo atual | `quality_json.checklist` |
| CV da ocupação por categoria ≤ 0,10 | `quality_json` |
| ΔE00 cromático mediano das revisões FIEL ≤ 2 | `quality_json` |
| Conclusão (salvou / abriu) ≥ 70% | `editor_opened`, `render_finished` |
| p95 do render ≤ 4 s; taxa de 503 < 2% | `render_finished`, Micrometer |
| 100% das peças com origem coerente | Relatório do backfill |

### 10.5 Critérios de aceite propostos para o card RF15

| ID | DADO QUE | QUANDO | ENTÃO |
|---|---|---|---|
| CA01 | a peça tem origem CATALOG, DEFAULT, AI_GENERATED ou SHARED_COPY | o dono abre o menu da imagem ou chama `editor-session` | vê "Adicionar sua foto", e a API responde 403 `FOTO_NAO_EDITAVEL` |
| CA02 | cadastro pelo catálogo com foto própria enviada | salvo a peça | `image_url` = URL oficial, origem CATALOG, `user_photo_id` preenchido e `card_image_source` = a opção escolhida (OFFICIAL se nenhuma) |
| CA03a | foto própria aberta | escolho "4:5 Card" e salvo | `geometry.aspect = "4:5"`, e a imagem final tem proporção 4:5 (±1 px) |
| CA03b | foto própria aberta | endireito −2,3° e salvo | `straightenDeci = −23`; a imagem final mostra a rotação com erro de até ±0,1° e não tem canto vazio nem preenchido |
| CA03c | fixture cinza 18% | aplico Luz +40 | `OUT[118]` é igual ao valor de referência do `lut-cases.json`, em TS e em Java |
| CA03d | fixture com cor dominante e fundo neutro | uso o conta-gotas no fundo | os ganhos ficam gravados, o fundo final tem C\*ab ≤ 3 e `wbException.applied = true` |
| CA03e | conta-gotas sobre a peça | tento amostrar | a amostra é recusada com o aviso "Escolha um ponto do fundo" |
| CA03f | foto própria com fundo | toco "Tirar o fundo" e escolho #FFFFFF | os pixels com α ≥ 0,98 são iguais à original reamostrada (com as tabelas) e o fundo é #FFFFFF |
| CA04 | salvei edições | reabro em outro aparelho | os controles voltam com os valores salvos, o `stored_sha256` é igual e "Voltar à original" gera o documento identidade |
| CA05 | apliquei N passos | desfaço N vezes (botão ou Ctrl+Z) | volto ao estado de abertura; ajustes seguidos no mesmo controle contam como um passo |
| CA06 | a remoção de fundo falha | toco "Tirar o fundo" | vejo uma mensagem sem o nome do provedor, e as outras ferramentas funcionam (RNF8) |
| CA07 | tenho alterações não salvas | tento sair | o editor pede confirmação; sem alterações, fecha direto |
| CA08 | os documentos de `test-utils/editor-fixtures` (≥ 20) | gero as tabelas em TS e em Java | as tabelas são idênticas byte a byte |
| CA09 | iPhone real com Safari e original de 12 MP | ajusto a Luz em +50 e salvo | a luminância média da prévia muda pelo menos 5%, e o salvamento retorna 201 sem `ARQUIVO_GRANDE` |
| CA10 | um documento com operação de cor ultrapassa `confirm` de `fidelity.thresholds.v1` | salvo | preciso confirmar; a revisão vira RETOCADA, e visitantes veem "Cor ajustada". Documento só com luz e contraste nunca dispara o portão |
| CA11 | o documento tem operação fora da lista ou valor fora da faixa | salvo | 422 `DOCUMENTO_EDICAO_INVALIDO`, sem revisão gravada |
| CA12 | peça criada pelo MultiPiece com `aiImage` | abro o detalhe | vejo "Recriada com IA" e AiSeal, e o editor não abre (CA01) |
| CA13 | duas abas editam a mesma foto | a segunda salva | recebe 409; reenviar o mesmo documento com a mesma `baseRevision` devolve 200 com a mesma revisão |
| CA14 | uso só o teclado ou um único ponteiro | recorto, ajusto, uso o conta-gotas e comparo | consigo fazer tudo; o canvas tem `role="img"` com descrição; as áreas estouradas têm hachura; não há armadilha de teclado; o layout funciona a 320 px; o axe não aponta violação séria |
| CA15 | peça de catálogo com foto própria | escolho a imagem do card | o card reflete a escolha, e "Foto oficial · Marca · domínio" (com link) só aparece sobre a imagem oficial |
| CA16 | salvei uma revisão | inspeciono os arquivos | não há EXIF nem GPS, e o `quality_json` registra o provedor e o modelo de cada operação automática (RN45.06) |
| CA17 | tenho edições não salvas | fecho a aba e reabro em até 7 dias no mesmo aparelho | o editor oferece "Retomar" e restaura exatamente a mesma receita |
| CA18 | outra pessoa vê minha peça pública | pede o `PieceView` e a URL da original | o `PieceView` vem sem `originalImageUrl`, a original responde 403 ou 404, e a foto própria só aparece se `ownPhotoPublic = true` |
| CA19 | outra pessoa copia minha peça pública | a cópia é criada | ela leva o `catalogProductId` com a foto oficial (ou o DEFAULT) e o `aiGenerated`, e nunca minha foto própria |
| CA20 | envio a foto oficial (ou uma captura dela) como "minha" | o aceite roda | recebo 422 `FOTO_OFICIAL_DETECTADA` com a orientação; um JPEG com IPTC `trainedAlgorithmicMedia` vira `AI_GENERATED`, sem o rótulo "Enviada por você" |
| CA21 | tenho foto própria com revisões | aciono DELETE own-photo | todas as chaves do §9.7 respondem 404, as linhas são removidas e a peça volta à oficial ou ao DEFAULT |
| CA22 | a foto tem pessoa e minha conta é de adolescente | envio a foto | nada é enviado a provedor externo, a ocultação vem ligada e a foto fica privada |
| CA23 | não dei consentimento externo | toco "Tirar o fundo" | recebo a máscara local com uma dica (sem 403); ao pedir consentimento, o editor mostra provedor e país e a opção "Usar só o servidor do FashionAI" com o mesmo peso |
| CA24 | peça `forSale` sem foto própria FIEL | tento publicar o anúncio | recebo 422 `FOTO_PROPRIA_OBRIGATORIA_VENDA`; a principal nunca é VITRINE, RETOCADA ou CRIATIVA |
| CA25 | Android de referência (4 GB) com perfil 4G | abro o editor e arrasto a Luz | o editor abre em ≤ 2 s e a prévia atualiza a ≥ 30 fps; o render tem p95 ≤ 4 s (metas em configuração) |
| CA26 | escolho uma foto HEIC no iPhone | envio | o arquivo chega como JPEG e é aceito |
| CA27 | idioma en ou es, tela de 320 px | abro o editor | os números seguem o idioma ("+0.4" ou "+0,4") e a barra não transborda |
| CA28 | restauro a revisão r3 | confirmo | é criada a revisão r(n+1), com documento igual ao da r3 |
| CA29 | primeira revisão FIEL que aprova mais um item do checklist | salvo | `PIECE_IMAGE_REFINED` é concedido uma única vez por peça, e nunca por restauração |

### 10.6 Instrumentação

O repositório não tem serviço de eventos de produto (FATO), e o enum `ConsentPurpose` não tem finalidade de métricas. Proposta:

**Eventos**, sem dados pessoais, sem imagem e sem texto livre:

- `editor_opened{entry, imageOrigin, viewType}`
- `tool_applied{tool, auto}`
- `compare_used{mode}`
- `bg_removal{provider, ok, ms}`
- `save_requested{opsCount, colorOps}`
- `render_finished{status, ms, fidelityClass}`
- `editor_abandoned{dirty, msOpen}`
- `draft_resumed` e `draft_discarded`
- `revision_restored`
- `card_image_source_changed{from, to}`
- `own_photo_visibility_changed{public}`
- `upload_refused{reason}`

**Métricas derivadas:**

- conclusão;
- abandono com alterações;
- tempo até salvar;
- porcentagem de uso do Auto;
- porcentagem de revisões reclassificadas;
- taxa de restauração (indicador de arrependimento);
- p95 do render;
- falha por provedor.

**Armazenamento e base legal:**

- tabela `editor_events`, com `user_ref` = HMAC-SHA256(userId, segredo) e retenção de 90 dias;
- base legal: legítimo interesse (LGPD, arts. 7º IX e 10), com teste de balanceamento documentado e opção de desligar em Configurações (D13);
- no estudo com usuários, o TCLE cobre a coleta.

---

## 11. Riscos, questões em aberto e decisões

### 11.1 Riscos

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Escopo grande para 2 pessoas | Alta | Alto | D0; ponto de decisão ao fim do F1 |
| Original e foto pessoal expostas (situação de hoje) | Alta | Alto (LGPD) | F0: `originalImageUrl` só para o dono; cópia sem foto; F1: `restricted/` |
| Foto oficial ou imagem de IA passando por "foto própria" | Média | Alto (Lei 9.610; CDC) | §7.4 |
| Erro no backfill | Média | Alto | *Dry-run*, relatório, fixture, derivação em tempo de leitura |
| OOM no container único | Média | Alto | Semáforo, subamostragem, k6 |
| Falhas silenciosas no iOS | Alta hoje | Alto | Tabelas no F0; teste em aparelho |
| Cor P3 gravada como sRGB | Média | Médio | ICC no F0 |
| Rótulo do Estúdio escondendo IA | Alta hoje | Médio | Rótulo pelas etapas; aprovação explícita |
| Licença do modelo de fundo | Média | Médio | Parâmetro de modelo explícito e tag fixada |
| Rótulos de IA reduzindo a confiança [52] | Média | Médio | Separar "editada" de "gerada"; testar os textos |
| Privado por padrão esvaziando o feed | Média | Médio | Pergunta clara no fluxo; backfill preserva o que já era público (D9) |
| Pesquisa com pessoas sem trâmite ético | Média | Médio | TCLE e consulta ao CEP antes do F5 |

### 11.2 Questões em aberto

1. O rembg está implantado na Railway, ou a produção depende do remove.bg?
2. O modelo ONNX do `OnnxPersonSegmenter` está no container de produção (`available()`)?
3. Quanto tempo leva, de fato, um render de 12 MP no plano atual, e quantas permissões o semáforo deve ter?
4. A RN47.09 ("o criador não tem envio de foto", `RF47_ACERVO_BUSCA_CATALOGADA.md:169`) precisa ser atualizada para o RF4 de 05/10.
5. O estudo exige submissão ao CEP?
6. A licença do catálogo permite exibir a foto oficial como imagem secundária de um anúncio (RN15.08d)?

### 11.3 Decisões para o time

| # | Decisão | Recomendação |
|---|---|---|
| D0 | O RF15 entra no TCC? | Opção 1 comprometida; Opção 2 decidida no ponto de controle após o F1 (§0) |
| D1 | O rótulo "RF15" também marca a cópia e a descoberta de peças públicas (`WardrobeController.java:20` (`@Tag`), `:230`; `DiscoveryController.java:56`; `PhotoController.java:73, 79`; `TABELA_ENDPOINTS_POR_RF.md:250-256`; `suite_2.py:84, 101, 119`) | Renomear para o RF dono da descoberta; registrar a equivalência RF44 ↔ RF46 em `docs/novos-rf/README.md` |
| D2 | Imagem do card | `OFFICIAL` \| `OWN` \| `STUDIO_APPROVED`, sempre por escolha explícita; sem `AUTO` |
| D3 | Onde fazer o render | No servidor, de forma síncrona |
| D4 | Biblioteca de canvas | Nenhuma no MVP |
| D5 | Remoção de fundo | Cadeia atual, só o alfa; local sem consentimento |
| D6 | Limiares de cor | `fidelity.thresholds.v1` como hipótese; calibrar com 30 a 50 peças, com aparelho e brilho controlados |
| D7 | Estúdio | Ampliação não generativa em `forSale` **e** rótulo sempre; aprovação explícita |
| D8 | Pincel, sombra, temperatura e várias fotos | MVP-2 |
| D9 | Visibilidade da foto própria | Fotos novas privadas por padrão. No backfill, preservar como pública a foto própria que já aparecia em peça pública de adulto e avisar a pessoa uma vez; adolescentes sempre privado |
| D10 | Regras da Arara (RN15.08) | Propor ao RF32 e aos Termos |
| D11 | Cópias existentes com foto de outra pessoa | Depois de 30 dias de aviso, trocar pela foto oficial ou pelo DEFAULT, salvo se o dono da foto permitir a cópia |
| D12 | Foto de esquema (`SCHEME`) | Depois do MVP; o modelo baseado em `Photo` já cobre |
| D13 | Base legal das métricas | Legítimo interesse com teste de balanceamento e opção de desligar, ou nova finalidade `PRODUCT_ANALYTICS` |

---

## 12. Plano incremental

Esforço em dias-pessoa (hipótese): **P** ≤ 3; **M** de 4 a 8; **G** de 9 a 15.

| Fase | Entregáveis | Esforço | Depende de |
|---|---|---|---|
| **F0, correções em produção** | (a) Privacidade: `originalImageUrl` só para o dono; `addToWardrobe` sem foto própria e sem Estúdio do outro, copiando `aiGenerated` e o catálogo; `useDefaultImageAfterPhotoDeletion` voltando à oficial. (b) Editor atual: bloqueado para CATALOG, DEFAULT e AI; tabelas no lugar de `ctx.filter`; canvas de até 2.048 px; JPEG quando a imagem é opaca; `replaceImage` sem sobrescrever a imagem oficial, herdando `aiGenerated` e com moderação de peça. (c) Estúdio aprovado explicitamente, com rótulo pelas etapas. (d) ICC → sRGB; HEIC alinhado; parâmetro de modelo do rembg; renomear o rótulo RF15 (D1) | M–G (8–12) | — |
| **F1, proveniência e dados** | V47 + backfill V48; `AI_GENERATED` e `SHARED_COPY`; envio de foto própria como rascunho (aceite §7.4, detecção de pessoa, declaração, `view_type`); `from-catalog` aceitando `draftId`; etapa "Imagem do card" + visibilidade; resolvedor único; `restricted/`; exclusão em cascata; TTL de rascunhos; quarentena; testes de migração e E2E de privacidade; proposta de mudança no RF41 v2 | M–G (8–12) | F0 |
| **Spike S** | `tables.json` + `lut-cases.json` + JUnit/Vitest; render de um documento no servidor | P (2–3) | F1 em paralelo |
| *Ponto de controle* | Decidir a Opção 2 com os orientadores | — | F1 |
| **F2, receita e render** | `EditDocument` + validador; `EditRenderer`; `photo_edits`; endpoints `/revisions`; idempotência natural; 409; restauração; semáforo; Micrometer | M (6–8) | S |
| **F3, editor enxuto** | Canvas + alças DOM; layout 100dvh; Enquadrar (4:5 e Livre, retângulo inscrito, teclado); girar; endireitar; Luz; Cor (conta-gotas e Auto); Comparar; Versões; estados; rascunho no IndexedDB; conexão; i18n; acessibilidade; eventos | G (9–12) | F2 (pode começar com documentos locais) |
| **F4, fundo e fidelidade** | Segmentação só do alfa; máscara de análise; preenchimentos; Ocultar área; áreas estouradas; checklist; portão cromático; rótulos; AiSeal no render; Estúdio `stale` | M (5–8) | F2, F3 |
| **F5, avaliação e texto** | §10.0 (TCLE, estudo, análise), indicadores, calibração do D6, capítulo de resultados. Atualizar `docs/diagramas/RF15/*.puml` (hoje descrevem `PUT /image` e "moderação herdada como APPROVED"), `TABELA_ENDPOINTS_POR_RF.md`, `suite_2.py`, e as propostas para os Termos e a Política | M (5–8); P–M na Opção 1 | F3, F4 |
| **MVP-2** | Pincel com checagem de máscara; sombra; temperatura e matiz; várias fotos e fotos de detalhe/defeito | M | F4 |

**Totais:**

- **Opção 1:** F0 + F1 + S + F5 enxuta ≈ 21–31 dias-pessoa.
- **Opção 2:** ≈ 41–59 dias-pessoa.

**Mínimo defensável na banca (Opção 1):** proveniência correta, privacidade da original, escolha explícita da imagem do card, backfill auditado, o *spike* demonstrando paridade exata das tabelas entre TS e Java, e este documento como desenho do tema futuro. Esse conjunto já sustenta a tese: a foto da pessoa é tratada de forma fiel, privada e auditável.

**Temas futuros:**

- *Próxima:* seleção por toque e caixa de rosto no aparelho; realces e sombras (WebGL2); galeria de sugestões; várias vistas por peça; nitidez de saída; exportação para redes sociais com IPTC/XMP; fotos de esquema.
- *Futuro:* manifesto C2PA assinado; perfil de cor por ColorChecker; vista em escala [15]; limpeza de fiapos (RETOCADA); segmentação com BiRefNet ou SAM via WebGPU; camada criativa (RF44); 3D (RF16); estudo de percepção da grade [18].

---

## Referências

**Plataformas e marketplaces**

- [1] Google Merchant Center. Image requirements. https://support.google.com/merchants/answer/6324350
- [2] Amazon. Product photography guide. https://sell.amazon.com/blog/product-photos
- [3] Zalando Partner University. Zalando image guidelines. https://partner.zalando.com/university/article/zalando-image-guidelines
- [4] Zalando Partner University. Apparel image guide. https://partner.zalando.com/university/article/apparel-image-guide
- [5] Zalando Partner University. Shoes image guide. https://partner.zalando.com/university/article/shoes-image-guide
- [6] Zalando Partner University. Accessories image guide. https://partner.zalando.com/university/article/accessories-image-guide
- [7] Mercado Livre. Requisitos de fotos para roupa íntima e de praia. https://vendedores.mercadolivre.com.br/nota/requisitos-de-fotos-para-roupa-intima-e-de-praia
- [8] Mercado Livre. Editor de fotos. https://vendedores.mercadolivre.com.br/nota/editor-de-fotos-uma-ferramenta-para-melhorar-seus-anuncios
- [9] Shopify Help. Product media types. https://help.shopify.com/en/manual/products/product-media/product-media-types
- [10] Shopify. Clothing photography. https://www.shopify.com/blog/clothing-photography
- [11] eBay. Picture policy. https://www.ebay.com/help/policies/listing-policies/picture-policy?id=4370
- [12] Meta. Instagram Graph API, ig-user/media. https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media
- [13] Pinterest. Product specs. https://help.pinterest.com/en/business/article/pinterest-product-specs

**Comércio eletrônico, marketing e comportamento**

- [14] Baymard Institute. Ensure sufficient image resolution and zoom. https://baymard.com/blog/ensure-sufficient-image-resolution-and-zoom
- [15] Baymard Institute. In-scale product images. https://baymard.com/blog/in-scale-product-images
- [16] Baymard Institute. Apparel: 5 best practices. https://baymard.com/research-articles/apparel-5-best-practices
- [17] Moran, K. Product photos on listing pages. Nielsen Norman Group, 2022. https://www.nngroup.com/articles/product-photos-listing-pages/
- [18] Park, J.; Lennon, S.; Stoel, L. On-line product presentation. Psychology & Marketing, 2005. https://doi.org/10.1002/mar.20080
- [19] De, P.; Hu, Y.; Rahman, M. Product-oriented web technologies and product returns. ISR, 2013. https://pubsonline.informs.org/doi/10.1287/isre.2013.0487
- [20] Di, W. et al. Is a picture really worth a thousand words? WSDM, 2014. https://doi.org/10.1145/2556195.2556226
- [21] Zhang, S. et al. What makes a good image? Management Science, 2022 (fotos de imóveis do Airbnb; transferência para moda é hipótese). https://doi.org/10.1287/mnsc.2021.4175
- [22] Reber, R.; Schwarz, N.; Winkielman, P. Processing fluency and aesthetic pleasure. PSPR, 2004. https://doi.org/10.1207/s15327957pspr0804_3
- [23] Coresight Research. The true cost of apparel returns, 2023 (pesquisa com 100 varejistas dos EUA). https://coresight.com/research/the-true-cost-of-apparel-returns-alarming-return-rates-require-loss-minimization-solutions/

**Cor, qualidade de imagem e fidelidade**

- [24] Sharma, G.; Wu, W.; Dalal, E. The CIEDE2000 color-difference formula: implementation notes. CR&A, 2005. https://hajim.rochester.edu/ece/sites/gsharma/papers/CIEDE2000CRNAFeb05.pdf
- [25] Mokrzycki, W.; Tatol, M. Color difference ΔE: a survey. MG&V, 2011 (faixas em ΔE\*ab/CIE76). https://dl.acm.org/doi/abs/10.5555/3166160.3166161
- [26] FADGI. Technical Guidelines for Digitizing Cultural Heritage Materials, 3ª ed., 2023 (níveis por tipo de material; acurácia de captura de alvo). https://www.digitizationguidelines.gov/guidelines/FADGI%20Technical%20Guidelines%20for%20Digitizing%20Cultural%20Heritage%20Materials_3rd%20Edition_05092023.pdf
- [27] Gaiani, M. et al. Evaluating smartphones color fidelity. ISPRS Archives, 2019. https://isprs-archives.copernicus.org/articles/XLII-2-W11/539/2019/isprs-archives-XLII-2-W11-539-2019.pdf
- [28] ISO 3664:2009. Graphic technology and photography — Viewing conditions. https://cdn.standards.iteh.ai/samples/43234/d3de25012f6b433e886679d3a450499f/ISO-3664-2009.pdf
- [29] Peng et al. Frontiers in Neuroscience, 2022 (efeito do fundo sobre a avaliação do produto pelo consumidor). https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2022.942901/full
- [30] X-Rite. M-factor white paper. https://www.xrite.com/-/media/xrite/files/whitepaper_pdfs/l7-510-mfactorwhitepaper/l7-510-mfactorwhitepaper-en.pdf
- [31] WebKit. Improving color on the web. https://webkit.org/blog/6682/improving-color-on-the-web/
- [32] WHATWG. HTML Standard, the canvas element. https://html.spec.whatwg.org/multipage/canvas.html
- [33] MDN. HTMLCanvasElement.getContext() (colorSpace). https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext
- [34] TwelveMonkeys ImageIO. JPEG plugin. https://github.com/haraldk/TwelveMonkeys/wiki/JPEG-Plugin
- [35] Afifi, M. et al. When color constancy goes wrong. CVPR, 2019. https://openaccess.thecvf.com/content_CVPR_2019/html/Afifi_When_Color_Constancy_Goes_Wrong_Correcting_Improperly_White-Balanced_Images_CVPR_2019_paper.html
- [36] Wang, Z. et al. Image quality assessment: from error visibility to structural similarity. IEEE TIP, 2004. https://doi.org/10.1109/TIP.2003.819861
- [37] Blau, Y.; Michaeli, T. The perception-distortion tradeoff. CVPR, 2018. https://openaccess.thecvf.com/content_cvpr_2018/papers/Blau_The_Perception-Distortion_Tradeoff_CVPR_2018_paper.pdf

**Ética, direito e proveniência**

- [38] Associated Press. News Values and Principles (seção sobre imagens). https://www.ap.org/about/news-values-and-principles/ (texto reproduzido em https://accountablejournalism.org/ethics-codes/news-values-and-principles)
- [39] NPPA. Code of ethics. https://nppa.org/resources/code-ethics
- [40] ASA. Ruling on Next Retail Ltd, 2025. https://www.asa.org.uk/rulings/next-retail-ltd-a24-1261164-next-retail-ltd.html
- [41] Brasil. Lei 8.078/1990 (CDC). https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm
- [42] Brasil. Decreto 7.962/2013. https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm
- [43] CONAR. Código Brasileiro de Autorregulamentação Publicitária. https://www.gov.br/secom/pt-br/acesso-a-informacao/legislacao/ca2digobrasdeautoregulanovo.pdf
- [44] Brasil. Lei 9.610/1998 (Direitos Autorais). https://www.planalto.gov.br/ccivil_03/leis/l9610.htm
- [45] Brasil. Lei 13.709/2018 (LGPD). https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- [46] Brasil. Lei 10.406/2002 (Código Civil). https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm
- [47] IPTC. Digital Source Type vocabulary. https://cv.iptc.org/newscodes/digitalsourcetype/
- [48] C2PA. Technical Specification 2.2. https://spec.c2pa.org/specifications/specifications/2.2/specs/C2PA_Specification.html
- [49] Content Authenticity Initiative. Actions assertions. https://opensource.contentauthenticity.org/docs/manifest/writing/assertions-actions/
- [50] União Europeia. AI Act, art. 50 (o 50(2) se dirige a provedores). https://artificialintelligenceact.eu/article/50/
- [51] Meta. Labeling AI-generated content and manipulated media, 2024. https://about.fb.com/news/2024/04/metas-approach-to-labeling-ai-generated-content-and-manipulated-media/
- [52] Altay, S.; Gilardi, F. People are skeptical of headlines labeled as AI-generated, 2023. https://doi.org/10.31234/osf.io/83k9r_v1
- [53] Epstein, Z. et al. What label should be applied to content produced by generative AI?, 2023. https://doi.org/10.31234/osf.io/v4mfz
- [54] McPherson, R.; Shokri, R.; Shmatikov, V. Defeating image obfuscation with deep learning, 2016. https://arxiv.org/abs/1609.00408v2
- [55] Yee, K. et al. Image cropping on Twitter. CSCW, 2021. https://arxiv.org/abs/2105.08667

**Plataforma web e técnica**

- [56] MDN. CanvasRenderingContext2D.filter. https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter
- [57] Can I use. CanvasRenderingContext2D.filter. https://caniuse.com/mdn-api_canvasrenderingcontext2d_filter
- [58] MDN. The canvas element, maximum canvas size. https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas
- [59] MDN. CSP: connect-src. https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src
- [60] W3C. Filter Effects Module Level 1. https://drafts.csswg.org/filter-effects-1/
- [61] Konva. Performance tips. https://konvajs.org/docs/performance/All_Performance_Tips.html
- [62] web.dev. COOP and COEP. https://web.dev/articles/coop-coep
- [63] Google. MediaPipe Image Segmenter. https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter
- [64] Google. MediaPipe Interactive Segmenter. https://ai.google.dev/edge/mediapipe/solutions/vision/interactive_segmenter
- [65] Gatis, D. rembg README. https://raw.githubusercontent.com/danielgatis/rembg/main/README.md
- [66] BRIA AI. RMBG-2.0 (CC BY-NC 4.0). https://huggingface.co/briaai/RMBG-2.0
- [67] darktable. Sidecar files and history stack. https://docs.darktable.org/usermanual/development/en/overview/sidecar-files/sidecar/
- [68] ISO 16684-1:2019. XMP. https://www.iso.org/standard/75163.html
- [69] IETF. The Idempotency-Key HTTP header field (draft; considerado e dispensado). https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/
- [70] IETF. RFC 8785, JSON Canonicalization Scheme (considerado e dispensado). https://www.rfc-editor.org/rfc/rfc8785
- [71] OWASP. File upload cheat sheet. https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- [72] Rapid7. CVE-2026-66066. https://www.rapid7.com/blog/post/etr-kindarails2shell-cve-2026-66066-critical-arbitrary-file-read-and-possible-remote-code-execution-in-ruby-on-rails/
- [73] Stability AI. API reference (upscale). https://platform.stability.ai/docs/api-reference
- [74] Telea, A. An image inpainting technique based on the fast marching method, 2004. https://research.tue.nl/en/publications/an-image-inpainting-technique-based-on-the-fast-marching-method/
- [75] Sheng, Y. et al. SSN: Soft shadow network for image compositing. CVPR, 2021. https://openaccess.thecvf.com/content/CVPR2021/html/Sheng_SSN_Soft_Shadow_Network_for_Image_Compositing_CVPR_2021_paper.html

**Interação humano-computador e acessibilidade**

- [76] W3C. WCAG 2.2. https://www.w3.org/TR/WCAG22/
- [77] W3C. Understanding SC 2.5.7 Dragging Movements. https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
- [78] W3C. Understanding SC 2.5.1 Pointer Gestures. https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html
- [79] W3C. Understanding SC 2.5.8 Target Size (Minimum). https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- [80] W3C WAI-ARIA APG. Slider pattern. https://www.w3.org/WAI/ARIA/apg/patterns/slider/
- [81] Apple. HIG, Photo editing. https://developer.apple.com/design/human-interface-guidelines/photo-editing
- [82] Apple. HIG, Gestures. https://developer.apple.com/design/human-interface-guidelines/gestures
- [83] Nielsen, J. Response times: the 3 important limits. https://www.nngroup.com/articles/response-times-3-important-limits/
- [84] NN/g. Progress indicators. https://www.nngroup.com/articles/progress-indicators/
- [85] NN/g. Onboarding tutorials vs. contextual help. https://www.nngroup.com/articles/onboarding-tutorials/
- [86] Fried, O. Photo manipulation, the easy way. Tese (PhD), Princeton, 2017. https://www.cs.princeton.edu/research/techreps/1024
- [87] Dang, H.; Mecke, L.; Buschek, D. GANSlider. CHI, 2022 (sliders de espaço latente; transferência é hipótese). https://doi.org/10.1145/3491102.3502141
- [88] Koyama, Y. et al. Sequential Gallery. ACM TOG, 2020. https://doi.org/10.1145/3386569.3392444
- [89] Bychkovsky, V. et al. Learning photographic global tonal adjustment. CVPR, 2011. https://people.csail.mit.edu/sparis/publi/2011/cvpr_auto/Bychkovsky_11_Learning_Photo_Adjustment.pdf
- [90] Rensink, R. et al. To see or not to see. Psychological Science, 1997. https://www2.psych.ubc.ca/~rensink/publications/download/PsychSci97-RR.pdf
- [91] Chen, H.-T. et al. Data-driven adaptive history for image editing. I3D, 2016. https://doi.org/10.1145/2856400.2856417
- [92] Shneiderman, B. The eight golden rules of interface design. https://www.cs.umd.edu/users/ben/goldenrules.html
- [93] Raskin, A. Never use a warning when you mean undo. A List Apart, 2007. https://alistapart.com/article/neveruseawarning/
- [94] W3C. Text size in translation. https://www.w3.org/International/articles/article-text-size
- [95] WebKit. Full third-party cookie blocking and more (limite de 7 dias para armazenamento gravado por script). https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
- [96] Google. Snapseed help. https://support.google.com/snapseed/answer/6157802?hl=en
- [97] Adobe. Gesture controls in Lightroom for mobile. https://helpx.adobe.com/lightroom/mobile/get-started/gesture-controls-in-lightroom-for-mobile.html
- [98] Cherry, E.; Latulipe, C. Creativity Support Index. ACM TOCHI, 2014. https://doi.org/10.1145/2617588
- [99] ISO 9241-110:2020. Interaction principles. https://www.iso.org/standard/75258.html
- [100] Brooke, J. SUS: a "quick and dirty" usability scale. In: Usability Evaluation in Industry. Taylor & Francis, 1996.

**Fotografia e captura**

- [101] Karim, A. et al. Why is 10 past 10 the default setting for clocks and watches in advertisements? Frontiers in Psychology, 2017 (n = 46; efeito: menor relutância de compra). https://www.researchgate.net/publication/319154420
- [102] Cambridge in Colour. Understanding camera lenses: focal length & perspective. https://www.cambridgeincolour.com/tutorials/camera-lenses.htm
- [103] Apple. iPhone User Guide, Set up your shot (AE/AF Lock). https://support.apple.com/guide/iphone/set-up-your-shot-iph3dc593597/ios

**Avaliação, método e estatística**

- [104] Bangor, A.; Kortum, P.; Miller, J. An empirical evaluation of the System Usability Scale. IJHCI, 24(6), 2008. https://doi.org/10.1080/10447310802205776
- [105] Sauro, J. A Practical Guide to the System Usability Scale. Measuring Usability, 2011. https://measuringu.com/sus/
- [106] Sauro, J.; Lewis, J. Quantifying the User Experience, 2ª ed. Morgan Kaufmann, 2016.
- [107] Sauro, J.; Lewis, J. Estimating completion rates from small samples using binomial confidence intervals. HFES, 2005. https://doi.org/10.1177/154193120504902407
- [108] Hart, S. NASA-Task Load Index (NASA-TLX); 20 years later. HFES, 2006. https://doi.org/10.1177/154193120605000909
- [109] Hevner, A. et al. Design science in information systems research. MIS Quarterly, 28(1), 2004. https://doi.org/10.2307/25148625
- [110] Peffers, K. et al. A design science research methodology for information systems research. JMIS, 24(3), 2007. https://doi.org/10.2753/MIS0742-1222240302

**Cor e percepção (complementares)**

- [111] Luo, M. R.; Cui, G.; Rigg, B. The development of the CIE 2000 colour-difference formula: CIEDE2000. CR&A, 26(5), 2001. https://doi.org/10.1002/col.1049
- [112] Albers, J. Interaction of Color. Yale University Press, 1963 (ed. de 50 anos, 2013).
- [113] Fairchild, M. Color Appearance Models, 3ª ed. Wiley, 2013. https://doi.org/10.1002/9781118653128
- [114] ISO 12646:2015. Graphic technology — Displays for colour proofing — Characteristics.

**Direito e regulação (complementares)**

- [115] Brasil. Lei 15.211/2025 (ECA Digital). https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm
- [116] Brasil. Senado Federal. PL 2338/2023 (aprovado no Senado em 10/12/2024; em tramitação na Câmara). https://www25.senado.leg.br/web/atividade/materias/-/materia/157233
- [117] Conselho Nacional de Saúde. Resolução 510/2016. https://conselho.saude.gov.br/resolucoes/2016/Reso510.pdf
- [118] CONAR. Guia de Publicidade por Influenciadores Digitais, 2021. http://conar.org.br/pdf/CONAR_Guia-de-Publicidade-Influenciadores_2021-03-11.pdf
- [119] remove.bg. API documentation (parâmetro `channels`: `rgba` ou `alpha`). https://www.remove.bg/api
- [120] AI Act. Transparency rules (art. 50) e Digital Omnibus, Regulamento (UE) 2026/1744. https://artificialintelligenceact.eu/transparency-rules-article-50/
- [121] União Europeia. AI Act, art. 3 (definição 60, deep fake). https://artificialintelligenceact.eu/article/3/

**Técnica (complementares)**

- [122] TwelveMonkeys. README (imageio-jpeg; common-image `ResampleOp`). https://github.com/haraldk/TwelveMonkeys
- [123] Krawetz, N. Kind of like that (dHash). Hacker Factor, 2013. https://www.hackerfactor.com/blog/index.php?/archives/529-Kind-of-Like-That.html
- [124] Zauner, C. Implementation and benchmarking of perceptual image hash functions. Dissertação, 2010. https://www.phash.org/docs/pubs/thesis_zauner.pdf
- [125] W3C. Understanding SC 2.5.5 Target Size (Enhanced). https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
- [126] Apple. HIG, Accessibility (alvos de 44×44 pt). https://developer.apple.com/design/human-interface-guidelines/accessibility
- [127] MDN. Transferable objects. https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
- [128] MDN. OffscreenCanvas. https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas
- [129] web.dev. Measure performance with the RAIL model. https://web.dev/articles/rail
- [130] MDN. Window.sessionStorage. https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage
- [131] MDN. IndexedDB API. https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- [132] Bazarevsky, V. et al. BlazeFace: sub-millisecond neural face detection on mobile GPUs, 2019. https://arxiv.org/abs/1907.05047
- [133] Grafana. k6 documentation. https://grafana.com/docs/k6/latest/
- [134] Noakes, D. metadata-extractor. https://github.com/drewnoakes/metadata-extractor