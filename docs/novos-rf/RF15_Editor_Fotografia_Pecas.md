# RF15 — Editor de Fotografia da Peça (Tema Futuro): estudo e plano

> 05/10/2026 · RF derivado do RF4. No RF4 atual a peça nasce pela **busca catalogada + formulário** e a fotografia é
> **opcional**, para quem quer um item mais personalizado. Quando a pessoa envia uma foto, no cadastro ou depois ao
> editar a peça ou o esquema, abre-se o caminho do RF15: o editor que transforma a foto amadora numa foto de produto
> fiel e bonita. Este documento é estudo + plano. Nada aqui foi implementado nem alterado no Trello.

## 1. Onde o RF15 fica no fluxo

```
RF4  cadastrar peça ─┬─ busca catalogada (RF47/RF49) ─→ foto oficial canônica (pipeline RF45/CATALOG_IMAGE_PIPELINE_V2)
                     ├─ formulário sem foto ──────────→ foto padrão do FashionAI
                     └─ foto opcional (cadastro ou edição) ──→ RF15 EDITOR ──→ imagem canônica do usuário
                                                                           └──→ versões de apresentação (estúdio, editorial)
RF5/RF9 editar esquema ─→ trocar/editar a foto de uma peça do look ──→ RF15 EDITOR
```

Entradas do editor: foto nova (upload/câmera), foto de "Minhas Fotos", ou a foto já salva da peça. Saídas: a
**imagem canônica da peça** (o que aparece no guarda-roupa, nos looks, no provador e na IA) e, opcionalmente,
**versões de apresentação** rotuladas (estúdio, editorial), que nunca substituem a canônica.

## 2. Ponto de partida no código (já existe)

| Peça | Arquivo | O que faz hoje |
|---|---|---|
| Editor | `components/photo-editor.tsx` | Canvas 2D sem biblioteca: recorte livre, giro 90°, brilho/contraste (`ctx.filter`), remoção de fundo, desfazer/refazer até a original, aviso ao sair sem salvar (RF15.CA01–CA05) |
| Diálogo "Editar imagem" | `components/edit-image.tsx` | original × processada, estúdio, "Ajustar manual", "Corrigir recorte", aprovar/descartar estúdio |
| Antes/depois | `components/before-after.tsx` | slider original × flat lay, exporta lado a lado 4:5 |
| Backend | `PhotoController` (`/api/photos/{id}/edits`, `/background-removal`), `WardrobeController` (`PUT /api/pieces/{id}/image`, `/studio*`), `WardrobeService.replaceImage`, `PhotoService.saveEdit` | grava a edição como nova imagem, a original fica em Minhas Fotos (`PhotoOrigin.EDITOR`, `editedFromPhotoId`) |
| Motores | `ImageOps`, `ImageFilters`, `FlatLayPipeline`, `StudioPipeline`, `FeedFraming` (4:5), `QualityMetrics`, `GhostMannequin` | recorte local, deskew, normalização de cor, enquadramento por landmarks, métricas |
| Versões | `piece_images` (V29: ORIGINAL/CANONICAL/DETAIL…, `derived_from_id`, `superseded`) | tabela pronta, ainda sem uso pelo editor |
| Regra | `docs/visao-computacional/RF04_ADAPTIVE_GARMENT_CAPTURE.md` §3.2 e §7 | estúdio ≠ canônico; proibido inpainting, geração, super-resolução generativa, reiluminação sintética, espelhamento no canônico |

**Lacunas do editor atual:** a edição é destrutiva (gera um PNG achatado, sem receita reeditável); só existe recorte
livre (sem proporção 4:5 nem guia por categoria); a luz é só brilho/contraste (sem balanço de branco, exposição em
EV, realces/sombras, saturação); não há endireitar fino, perspectiva, pincel de refinamento de máscara, comparação
antes/depois dentro do editor, verificação de fidelidade de cor nem métricas de qualidade ao vivo; não grava versões
em `piece_images`; sem atalhos de teclado, gestos de toque e teste em celular.
Também, em `docs/testes/TABELA_ENDPOINTS_POR_RF.md` e nas tags de `WardrobeController`/`DiscoveryController`, o fluxo
"copiar peça pública" está rotulado como RF15 por engano.

## 3. Fundamentos: o que a literatura e o mercado dizem

### 3.1 Fotografia de produto de moda (padrão de e-commerce)
- **Fundo neutro e uniforme** (branco puro ou cinza muito claro), sem sombras duras: é o padrão dos grandes varejistas
  porque elimina ruído e permite comparar produtos lado a lado. Sombra de contato suave é permitida e aumenta a
  percepção de volume.
- **Enquadramento consistente**: mesma proporção (4:5 é a proporção dominante em moda mobile e já é a do FashionAI),
  peça ocupando ~80–90% do maior lado, margem de segurança de 4–8%, centro visual (não o centro geométrico) no
  centro do quadro. Consistência entre itens pesa mais que a perfeição de cada foto.
- **Vistas canônicas**: frente (principal), costas, lateral, detalhe (etiqueta, textura, logo, fecho). Calçado:
  perfil lateral externo a ~3/4. Bolsa: frente levemente de cima. Óculos e relógio: frente.
- **Estilos de apresentação**: *flat lay* (peça plana vista de cima), *ghost mannequin* (volume sem corpo), *on-model*
  e *lifestyle*. Para catálogo pessoal, flat lay e cabide/arara são os mais viáveis com celular; ghost mannequin
  verdadeiro exige composição de duas fotos, e a versão sintética é proibida no canônico.
- **Preparação vale mais que pós-produção**: passar a peça, alinhar costuras, abotoar, luz difusa de janela. O editor
  deve **orientar antes de corrigir** (já existe a orientação animada do HU-RF45.02).

### 3.2 Cor (o que mais gera devolução e frustração em moda)
- **Fidelidade acima de beleza**: a cor exibida precisa ser a cor da peça. Balanço de branco por amostra neutra
  (conta-gotas num ponto branco/cinza do fundo) é a correção mais eficaz em fotos de celular.
- **Medir, não achar**: diferença de cor em ΔE (CIEDE2000; ΔE < 2 é praticamente imperceptível, > 5 é outra cor). O
  editor pode mostrar ΔE entre a cor média da peça antes e depois das edições e avisar quando a pessoa "mudou a cor".
- **sRGB como espaço de saída** (é o que navegador e celular exibem), com o perfil ICC da foto respeitado na leitura.
- Saturação e vibrance com limite; filtros criativos ficam só nas versões de apresentação.

### 3.3 Composição e percepção
- Lei da figura-fundo (Gestalt): contraste peça × fundo define a leitura instantânea do card.
- Escala relativa: no guarda-roupa, uma meia não pode parecer do tamanho de um casaco. Perfis de escala por categoria
  (já existem no `semantic-regions.json` do pipeline do catálogo) dão consistência de grade.
- Hierarquia: o detalhe-assinatura (gola, logo, cós, cadarço, fivela) deve estar legível no thumbnail.

### 3.4 Marketing e ética da imagem
- Fotos consistentes aumentam a confiança e a percepção de qualidade da coleção (efeito de "vitrine organizada").
- **Honestidade**: a peça pode ser revendida (campo "à venda"). Pelo CDC (arts. 30–31 e 37), a apresentação deve ser
  verdadeira; ocultar defeito ou alterar cor configura publicidade enganosa. Daí a separação: **canônica = fiel**;
  **apresentação = criativa e rotulada** ("imagem editada"/"gerada por IA").
- Selo de autenticidade: a canônica guarda a cadeia de derivação até a foto original (proveniência), no espírito do
  padrão C2PA de credenciais de conteúdo.

### 3.5 Design de interação de editores
- **Edição não destrutiva** (paradigma Lightroom): a original nunca muda; o editor grava uma **receita** de operações
  reaplicável, reeditável e versionada. Desfazer infinito é consequência natural.
- **Manipulação direta** (Shneiderman): arrastar o recorte, girar pela régua, pintar a máscara, com resposta imediata.
- **Revelação progressiva**: "Automático" resolve 80% dos casos com um toque; ferramentas finas ficam um nível abaixo.
- **Heurísticas de Nielsen**: estado sempre visível (qualidade ao vivo), controle e liberdade (desfazer, voltar à
  original), prevenção de erro (avisar antes de cortar a peça), consistência com o resto do app.
- **Mobile first**: alvos de toque ≥ 44 px, gestos de pinça/rotação com dois dedos, barra de ferramentas na base
  (alcance do polegar), comparação antes/depois por toque e segurar.
- **Acessibilidade (WCAG 2.2)**: todos os controles por teclado, sliders com valor anunciado, alternativa textual às
  métricas visuais, respeito a `data-reduce-motion`.

## 4. Princípios do editor do FashionAI

1. **A original é imutável.** Toda edição é uma receita aplicada a ela.
2. **Duas saídas, duas regras.** *Canônica* só aceita operações fiéis (lista branca abaixo). *Apresentação* pode usar
   estúdio, fundos artísticos e IA generativa, sempre rotulada, nunca usada pela IA de análise nem pelo provador.
3. **Automático primeiro, controle depois.** Um toque produz a canônica; a pessoa refina se quiser.
4. **O sistema mede e avisa.** Fidelidade de cor (ΔE), peça cortada, nitidez, ocupação: indicadores ao vivo.
5. **Mesmo padrão do catálogo oficial.** A foto do usuário sai no mesmo quadro 4:5, escala e foco por categoria que
   as fotos oficiais do pipeline de imagens, e a grade do guarda-roupa fica homogênea.

### Operações permitidas na canônica (lista branca)
Recorte e reenquadramento (4:5 fixo), endireitar (±15°), perspectiva moderada (±10°), giro 90°/180°, remoção de
fundo e refinamento manual da máscara, fundo neutro (branco/cinza claro), sombra de contato suave sintética
(rotulada), balanço de branco, exposição, realces/sombras, contraste, saturação limitada (±15%), redução de ruído
leve, nitidez leve (sem halo), remoção de poeira/fiapo pontual (clonagem local de até ~1% da área, registrada).

### Proibidas na canônica (permitidas só na apresentação, rotuladas)
Inpainting/preenchimento generativo, troca de cor da peça, apagar defeito, mudar caimento ou silhueta,
super-resolução generativa, reiluminação sintética, ghost mannequin sintético, espelhamento, filtros criativos.

## 5. Estrutura do editor

### 5.1 Fluxo (5 passos, com atalho "Automático")
```
[Foto] → 1 Enquadrar → 2 Fundo → 3 Luz & Cor → 4 Detalhes → 5 Revisar → Salvar canônica
           └───────────── botão "Automático" aplica 1–3 e vai direto para Revisar ─────────────┘
                                                  └─ opcional: "Criar versão de apresentação" (Estúdio / Editorial)
```

### 5.2 Ferramentas por passo
| Passo | Ferramentas | Técnica | Motor |
|---|---|---|---|
| 1 Enquadrar | recorte 4:5 com guia da categoria (gola no terço superior, cós no topo, sola na linha de base), endireitar por régua ou automático (PCA da máscara), perspectiva de 4 pontos, giro 90° | o recorte proposto vem do `SemanticCropper` com o perfil do `semantic-regions.json`; nunca estica | `ImageOps.deskewAngle`, `FeedFraming`, `SemanticCropper` |
| 2 Fundo | remover fundo (automático), pincel adicionar/remover com borda suave, varinha por cor, fundo branco/cinza neutro/transparente, sombra de contato on/off | máscara com refinamento de borda (feather 1–2 px); avisa quando a máscara cortou a peça (componentes, área) | `FlatLayPipeline` (rembg → remove.bg → local), `ProductSegmenter` |
| 3 Luz & Cor | conta-gotas de branco, temperatura/tint, exposição (EV), realces, sombras, contraste, saturação (limitada), "Auto" | ajustes em espaço linear; indicador ΔE (CIEDE2000) da cor média da peça antes/depois; histograma com aviso de recorte de altas luzes/sombras | `ImageFilters.normalize`, novo `ColorFidelity` |
| 4 Detalhes | remover fiapo/poeira (clonagem local, raio pequeno), nitidez leve, redução de ruído; marcar foto de detalhe (etiqueta, logo, textura) | retoque limitado por área total; cada retoque é registrado na receita | novo `SpotHealer` determinístico (não generativo) |
| 5 Revisar | antes/depois (toque e segure / divisor), prévia no card 4:5, na grade do guarda-roupa e no thumbnail; painel de qualidade | métricas: nitidez, exposição, ocupação, margem, peça inteira, fidelidade de cor | `QualityMetrics`, `ImageQualityAnalyzer` |

### 5.3 Versões de apresentação (opcional, separadas da canônica)
- **Estúdio**: fundos do `StudioPipeline` (já existe), sombra e luz de estúdio, rotulado.
- **Editorial**: composição criativa da peça ou do look para compartilhar (liga com HU-RF46.06/46.07 do Creative Engine).
- **Arte de fundo do card** continua no RF11 (não mexe na foto).

### 5.4 Layout da tela
- Desktop: canvas central, ferramentas do passo à direita, linha do tempo de passos no topo, histórico recolhível.
- Celular: canvas em tela cheia, abas dos passos na base, sliders numa folha inferior (`Sheet`), gestos de pinça e
  rotação, botão de comparar flutuante.
- Página própria (`/pieces/{id}/photo`), não modal, coerente com o CA "página e não modal" do RF4.

## 6. Arquitetura proposta

### 6.1 Receita não destrutiva
```json
{
  "version": 1, "sourceImageId": "…", "target": "CANONICAL",
  "ops": [
    {"op": "rotate90", "turns": 1},
    {"op": "straighten", "deg": -2.4},
    {"op": "perspective", "quad": [[0.02,0.01],[0.97,0.0],[0.99,0.98],[0.01,0.99]]},
    {"op": "crop", "rect": {"x":0.12,"y":0.05,"w":0.76,"h":0.95}, "aspect": "4:5"},
    {"op": "mask", "source": "rembg", "strokes": [{"mode":"add","r":0.01,"pts":[[0.4,0.2],[0.41,0.22]]}]},
    {"op": "background", "kind": "NEUTRAL", "shadow": "SOFT"},
    {"op": "whiteBalance", "sample": [0.05,0.04]},
    {"op": "tone", "exposureEv": 0.3, "highlights": -20, "shadows": 15, "contrast": 5, "saturation": 0},
    {"op": "heal", "spots": [{"x":0.52,"y":0.61,"r":0.008}]},
    {"op": "sharpen", "amount": 0.2}
  ]
}
```
- O front renderiza a receita no canvas para a prévia (rápido, em tamanho de tela).
- O backend reaplica a mesma receita na original em resolução cheia (determinístico, testável), valida contra a lista
  branca do alvo (CANONICAL × PRESENTATION) e grava o resultado.
- Desfazer/refazer = pilha de receitas; "voltar à original" = receita vazia.

### 6.2 Backend
- `POST /api/pieces/{id}/photo-edits` `{recipe, target}` → valida, renderiza, mede, grava; resposta com métricas.
- `GET /api/pieces/{id}/photo-edits` → versões (canônica atual, anteriores, apresentações).
- `POST /api/pieces/{id}/photo-edits/{versionId}/restore`.
- `POST /api/photo-edits/preview` (opcional) → render em baixa resolução no servidor para operações pesadas (máscara).
- Serviço `PhotoRecipeRenderer` (aplica ops com `ImageOps`/`ImageFilters`), `RecipePolicy` (lista branca por alvo),
  `ColorFidelity` (ΔE CIEDE2000), `SpotHealer` (clonagem local limitada).
- Persistência: `piece_images` (V29) já tem `derived_from_id` e `superseded`. Proposta de migration aditiva:
  `edit_recipe_json`, `edit_target` (CANONICAL/PRESENTATION), `generative` (bool), `color_delta_e`,
  `quality_json`. `WardrobeItem.imageUrl` passa a apontar para a canônica vigente.
- Reaproveita a cota de IA (`governedFlatLay`) só para remoção de fundo externa e versões de apresentação com IA.

### 6.3 Frontend
- Evoluir `photo-editor.tsx` para a receita (estado = `Recipe`, render = função pura `renderRecipe(img, recipe,
  canvas)`), quebrar por passo (`EditorFrame`, `EditorBackground`, `EditorLight`, `EditorDetails`, `EditorReview`).
- Biblioteca: manter Canvas 2D puro (o app já evita dependências pesadas). WebGL só se a prévia de tom ficar lenta em
  celulares (medir antes). Máscara em `OffscreenCanvas`/worker para não travar a interface.
- Tokens do design system (`--surface`, `--accent`, `.editor-*`), `components/ui` (`Sheet`, `SegmentPicker`, `Tabs`),
  i18n pt-BR/en/es no namespace `photoEditor.*` com `i18n:check`.

## 7. Integrações

| RF | Como conversa com o RF15 |
|---|---|
| RF4 | foto opcional no cadastro → botão "Personalizar com foto" abre o editor; sem foto, segue a imagem do catálogo ou a padrão |
| RF5/RF9 | editar esquema → editar a foto de uma peça do look |
| RF45 (pipeline) | o "Automático" usa o mesmo segmentador, registro de regiões e recorte semântico das fotos oficiais |
| RF11 | arte de fundo do card continua separada (não altera a foto) |
| RF18 provador / RF16 3D / IA de análise | usam **só a canônica** (nunca a de apresentação) |
| RF41 v2 | evento `PIECE_IMAGE_REFINED` (5 pts, máx. 3/dia, só foto própria) já previsto |
| RF46.06/46.07 | versões de apresentação/editoriais saem pelo Creative Engine |

## 8. Critérios de aceite propostos (evolução de RF15.CA01–CA05)

| ID | Dado que | Quando | Então |
|---|---|---|---|
| CA01 | peça com foto enviada (cadastro ou edição) | abre o editor | vê os passos Enquadrar, Fundo, Luz & Cor, Detalhes, Revisar e o botão Automático |
| CA02 | qualquer edição | salva | a original permanece intacta; a canônica nova é uma versão derivada com receita reeditável |
| CA03 | recorte | ajusta | o quadro é sempre 4:5, sem esticar, com guia da categoria; avisa antes de cortar a peça |
| CA04 | ajuste de cor | a cor média da peça muda mais que ΔE 5 | o editor avisa "a cor está diferente da peça real" e oferece desfazer |
| CA05 | alvo canônico | uma operação proibida é pedida | o backend recusa com motivo; a operação só existe na versão de apresentação |
| CA06 | versão de apresentação | é salva | fica rotulada, não substitui a canônica e não alimenta provador, 3D nem IA |
| CA07 | histórico | desfaz repetidamente | volta até a original; pode restaurar qualquer versão salva |
| CA08 | remoção de fundo externa indisponível | aciona | usa o recorte local e as demais ferramentas seguem (RNF8) |
| CA09 | celular | edita | gestos de pinça/rotação, alvos ≥ 44 px, sem travar em fotos de 12 MP |
| CA10 | revisão | abre o passo 5 | vê antes/depois, prévia no card, na grade e no thumbnail, e o painel de qualidade |

## 9. Métricas de sucesso
- % de peças com foto própria que passam no painel de qualidade na primeira tentativa.
- Tempo mediano até salvar (meta: < 60 s com Automático).
- Taxa de uso do Automático × ajuste manual; ferramentas mais usadas.
- ΔE médio canônica × original (meta: < 2).
- Consistência de grade: desvio da ocupação entre peças da mesma categoria.

## 10. Testes
- Unitários do renderer com fixtures sintéticas (mesma receita → mesmos pixels; receita vazia → original).
- `RecipePolicy`: cada operação proibida recusada no alvo canônico.
- `ColorFidelity`: ΔE conhecido em pares de cores de referência.
- Paridade front × back: render da prévia e do servidor com diferença média < 2 níveis.
- Vitest dos passos e do histórico; Playwright em viewport de celular (gestos, foto grande).
- Regressão visual com fixtures determinísticas (padrão do `CatalogPhotos`).

## 11. Plano incremental
1. **Receita e histórico**: migrar o editor atual para receita não destrutiva + versões em `piece_images` (sem mudar a interface).
2. **Enquadrar**: recorte 4:5 com guia da categoria, endireitar, perspectiva; Automático = pipeline do catálogo.
3. **Fundo**: refinamento da máscara por pincel, fundo neutro, sombra suave.
4. **Luz & Cor**: balanço de branco, tom, indicador ΔE.
5. **Revisar**: antes/depois, prévias e painel de qualidade.
6. **Detalhes**: retoque pontual limitado, foto de detalhe.
7. **Apresentação**: estúdio e editorial rotulados (Creative Engine).
8. Celular, acessibilidade, testes de carga com fotos grandes.

## 12. Riscos e decisões em aberto
1. Sombra de contato sintética na canônica: permitir (rotulada) ou só na apresentação?
2. Retoque de fiapo/poeira na canônica: limite de área aceitável, ou só na apresentação?
3. Prévia no cliente × no servidor para a máscara em celulares fracos.
4. Peça à venda: exigir a canônica (fiel) como foto do anúncio?
5. Corrigir o rótulo "RF15" do fluxo "copiar peça pública" na tabela de endpoints e nos controllers.
