# RF16 (modelo 3D da peça) e RF4 · Estúdio (foto de produto)

Telas em [`docs/telas-rf16-estudio`](../telas-rf16-estudio).

## RF16: geração do modelo 3D da peça

Fluxo: `POST /api/pieces/{id}/model3d` cria um job `THREE_D_GENERATION` e responde `202`. O worker
(`Model3dService.tick`, a cada 5 s) processa a fila e a página acompanha o job por `GET /api/pieces/{id}/model3d`.

```
enfileirado (QUEUED) → processando (PROCESSING) → concluído (COMPLETED)
                                                → falhou (FAILED): motivo legível + 1 reprocessamento grátis
```

| Critério | Como está atendido |
|---|---|
| CA01: job com estados visíveis | `components/model3d-panel.tsx` mostra a linha do tempo dos estados, a barra de progresso, o tempo decorrido e as etapas (Foto → Silhueta → Malha → Textura → Arquivo .glb, ou Envio/Reconstrução quando há provedor externo). A página consulta o job a cada 2,5 s enquanto ele anda, e o usuário recebe a notificação "Modelo 3D pronto" |
| CA02: visualizador 3D com rotação e zoom, 2D mantido | a página da peça tem as abas **Estúdio / Recorte 2D / Modelo 3D**. O visualizador (`piece-model-viewer.tsx`, React Three Fiber) permite girar e dar zoom, sem pan. O mesmo `.glb` aparece no Meu Quarto 3D |
| CA03: falha ou tempo-limite com motivo e 1 reprocessamento grátis | as falhas são gravadas com código e mensagem: `SEM_ARQUIVO`, `PECA_REMOVIDA`, `PROVEDOR_FALHOU`, `TEMPO_LIMITE` (padrão de 10 min) e `ERRO_INTERNO`. O primeiro pedido depois de uma falha é marcado `freeRetry` e não consome cota. Os pedidos seguintes voltam a consumir |
| CA04: estado recuperado do servidor | o estado fica em `wardrobe_items.model3d_status` + `pipeline_jobs`. Recarregar a página ou pedir de novo com o job em andamento devolve o mesmo job, sem duplicar |

Provedores, na ordem da governança de IA (RF24: cota, consentimento e `ai_inference_log`):

1. **Meshy image-to-3D** (`MESHY_API_KEY`): assíncrono, com malha texturizada PBR. O worker envia o recorte, consulta a tarefa e baixa o GLB pelo `WebFetchPort` (https, sem hosts internos, até 40 MB);
2. **Stability Stable Fast 3D** (`STABILITY_API_KEY`): síncrono, devolve o GLB em segundos;
3. **Relevo local** (`ReliefModelGenerator`): sempre disponível. A silhueta do recorte vira uma malha frente/verso com perfil arredondado (distância à borda), contorno suavizado e a própria foto como textura. O arquivo é um glTF 2.0 binário de ~1,4 MB com ~20 mil vértices.

A cota diária é de 3 reconstruções por IA por usuário. Sem chave de provedor, com a cota esgotada ou quando o provedor
passa do tempo-limite, entra o relevo local. `FEATURE_RF16_3D=false` desliga o recurso e `RF16_3D_TIMEOUT_MINUTES`
ajusta o tempo-limite.

## RF4 · Estúdio: foto de produto depois do cadastro

Depois do Flat Lay (remoção de fundo, correção de perspectiva, normalização de cor), `StudioPipeline` leva o recorte
a um acabamento de foto de produto:

| Etapa | Local (sempre) | Com provedor |
|---|---|---|
| NITIDEZ | ampliação bicúbica progressiva até 1400 px + *clarity* (máscara de nitidez de raio grande na luminância) + nitidez fina + vibração + compressão suave dos brancos | Stability Upscale Fast 4× (`STABILITY_API_KEY`) |
| ESTUDIO_IA | — | Photoroom v2 `edit`: fundo, *AI lighting* e *AI soft shadow* (`PHOTOROOM_API_KEY`) |
| VOLUME_LUZ | luz de estúdio calculada a partir de um campo de altura (distância à borda): Lambert, oclusão nas dobras e luz de recorte na borda | |
| FUNDO_ESTUDIO | degradê radial na cor escolhida, com piso mais escuro | |
| SOMBRA | sombra projetada desfocada + sombra de contato | |
| COMPOSICAO / VALIDACAO | 1600 × 1600 px, peça centralizada; mede nitidez (variância do Laplaciano) e contraste antes/depois | |

Fundos: **Azul royal** (assinatura, igual à referência), Grafite, Areia, Rosa pó, Oliva, Terracota e Branco infinito.
No **Automático** fica o royal. A escolha passa para Areia quando mais da metade da peça é escura ou azul saturado,
porque a peça sumiria no fundo.

Onde o estúdio roda:
- **no rascunho do RF4**, logo depois da análise. A prévia alterna Estúdio / Flat Lay / Original, os fundos podem ser trocados e as etapas e o antes/depois aparecem. "Usar a foto de estúdio como capa da peça" vem marcado;
- **na página da peça**: "Levar ao estúdio" ou "Refazer estúdio", com os mesmos fundos;
- **no closet**: "Levar peças ao estúdio" processa as peças que ainda não têm foto de estúdio (até 40 por vez);
- **automaticamente** quando a imagem muda. Trocar ou editar a foto, refazer a remoção de fundo ou o reprocessamento do RF4.CA06 refazem o estúdio com o mesmo fundo. Excluir a foto remove o estúdio.

Os cards usam a miniatura de 640 px (`studio-….thumb.jpg`) e a página usa a foto de 1600 px. O recorte original e o Flat
Lay continuam guardados. API: `GET /api/studio/backdrops`, `POST /api/pieces/analysis/{draftId}/studio?backdrop=&force=`,
`POST /api/pieces/{id}/studio?backdrop=`, `POST /api/me/pieces/studio`. A migração V14 cria `studio_image_url` e
`studio_backdrop` e adiciona índices de `pipeline_jobs` por tipo e estado.

### Estúdio v2: enquadramento, manequim invisível e foco no logo

Folhas: [`estudio_v2_entradas_e_saidas.jpg`](../telas-rf16-estudio/estudio_v2_entradas_e_saidas.jpg),
[`estudio_v2_detalhe_vs_referencia.jpg`](../telas-rf16-estudio/estudio_v2_detalhe_vs_referencia.jpg),
[`estudio_v2_telas.jpg`](../telas-rf16-estudio/estudio_v2_telas.jpg) e
[`estudio_v2_tela_cheia.jpg`](../telas-rf16-estudio/estudio_v2_tela_cheia.jpg).

| Pedido | Como está resolvido |
|---|---|
| Qualidade de imagem | **A fonte é o recorte em alta**, não o Flat Lay de 1024 px: a máscara do recorte é aplicada à foto original, com até 2400 px (`FlatLayPipeline.hiResCutout`). O arquivo fica guardado (`studio_source_url`) para refazer o estúdio depois. Em seguida, `StudioQuality` faz o acabamento. **Ruído**: é medido (Immerkær) e, quando existe, um filtro bilateral tira o grão sem amolecer costuras. **Contorno**: o alfa é suavizado e recortado de novo, o que tira os degraus da ampliação, e as bordas recebem a cor de dentro da peça (some a franja da parede). **Nitidez com limiar**: só onde há borda de verdade, com raio proporcional à ampliação. |
| Peça inteira ocupando a tela | `StudioFraming`: margens de 4–6,5% e quadro escolhido pela peça (9:16, 2:3, 4:5, 1:1 ou 5:4). O 9:16 é a tela inteira do celular, para vestidos e calças. A miniatura dos cards é sempre quadrada. Na página e na prévia, a foto aparece no formato dela, sem faixas. A **tela cheia** desenha atrás da foto o mesmo degradê radial do estúdio, alinhado à foto, e o fundo continua sem emenda. |
| Sem vazio em mangas e barra cortadas | O Flat Lay registra os lados em que a peça encosta na borda da foto (`truncated_sides`). Esses lados **sangram**: passam da borda do quadro, sem sombra no chão, e na tela cheia a foto encosta naquele lado da tela. Um corte reto também é detectado pela forma, mesmo inclinado até 6°, e a peça é **nivelada** pelo corte (celular torto). Uma barra reta que a foto não cortou fica **rente** à borda, sem perder nenhum pixel. Um corte lateral só vale no mesmo ângulo da câmera, então a lateral reta de uma manga não conta. |
| Pescoço e gola sem vazio (sem manequim) | `GhostMannequin`, só para peças com gola (parte de cima, casaco, peça inteira). **Cabide**: o gancho é removido, inclusive a haste dentro do decote. **Manequim**: é removido quando uma coluna central sobe acima dos ombros com cor de manequim diferente do corpo e superfície lisa; gola alta e capuz, com a mesma malha, ficam. **Decote aberto**: entre as pontas da gola entra o interior das costas, feito da cor da própria peça mais escura, com a borda da gola de trás e a trama espelhada. **Abertura fechada da gola**: o mesmo preenchimento. **Furinhos do recorte**: são reparados. O espaço legítimo entre manga e corpo continua vazio, e tecidos vazados (renda) são preservados. |
| Foco no logo | O Piece Analyzer (IA de visão) passa a devolver a caixa do logo, convertida para coordenadas da peça. Sem IA, `LogoFinder` procura uma mancha compacta com cor bem diferente do tecido em volta e descarta zíper, costuras, blocos de cor e bordas. Com logo, o logo ganha nitidez extra na foto principal e é gerada a **foto de detalhe** 1200×1500, centrada nele, com foco seletivo (o resto desfoca aos poucos). Ela aparece como aba "Detalhe do logo" e na tela cheia (V15: `studio_detail_url`). |

O Photoroom também recebe o quadro escolhido, margem pequena e
`ignorePaddingAndSnapOnCroppedSides=true`: a peça encosta nos lados cortados. Nos lados inteiros, o PNG enviado leva margem
transparente, para o provedor não confundir recorte com corte.

Limites desta versão:
- **Manequim ou pessoa da mesma cor da peça** (camiseta cinza-clara num manequim branco, ΔE ≈ 6) não é removido. O critério é conservador para não apagar golas altas. Um manequim preto, de pele ou de madeira sai. Quando a remoção de fundo já apagou o manequim, pode sobrar uma faixa escura atrás da gola.
- **Peça vestida por uma pessoa** exige segmentação de roupa por IA (a de fundo não separa corpo e roupa).
- O detector local de logo acha estampas e etiquetas contrastantes, mas não logos tom sobre tom. A jaqueta de referência não tem logo claro, e o detector local não inventou um (a primeira versão marcava uma junção de costuras e foi corrigida).
- O detalhe depende da resolução da foto: numa foto de celular de 12 MP, o estúdio trabalha com até 2400 px.

### Autocrítica do recorte local

Sem remoção de fundo por IA (rembg/remove.bg), o recorte local (k-means dos tons da borda + crescimento com barreira de
contorno) falha quando o fundo tem a cor da peça, como uma jaqueta creme numa parede bege. Por isso o recorte agora
**mede a própria forma**: solidez (área ÷ fecho convexo), pedaços grandes separados e miolo removido. Se a peça parece
"partida", a confiança cai abaixo de 0,45. Nesse caso:
- o rascunho mantém a **foto original**, não gera estúdio sobre uma peça mutilada e mostra o motivo, com dicas de como fotografar;
- a remoção de fundo fica na fila do RF4.CA06, para quando houver um provedor;
- "Conferi o recorte — usar mesmo assim" libera o estúdio. Isso resolve os falsos positivos, como um par de sapatos muito afastado.

A correção de perspectiva passou a girar só peças com eixo dominante (alongamento ≥ 1,35: calça, cachecol). Numa
jaqueta com mangas o eixo da PCA é ruído, e antes ela saía inclinada.

### Limites (honestidade)

- O estúdio local chega a uma foto de produto limpa: fundo de estúdio, luz, sombra, nitidez e 1600 px. A referência enviada, porém, tem volume de manequim invisível e luz real de estúdio. Esse nível pede um provedor generativo (**Photoroom** com AI lighting/shadow) e remoção de fundo por IA. Os dois estão integrados e entram só com a chave configurada.
- Não houve teste contra os provedores reais (Meshy, Stability, Photoroom), porque este ambiente de desenvolvimento bloqueia a saída de rede para eles. Os adaptadores seguem a documentação pública de cada API. Tudo o que está nas telas saiu do caminho local.
- As "fotos de celular" das folhas foram **simuladas**. As da jaqueta vieram da imagem de referência (máscara limpa, parede cinza, ruído e JPEG), e as camisetas foram desenhadas com logo, cabide e manequim. Não havia foto real de celular dessas peças.

## Verificação

- `StudioAndReliefTest` (6 testes): estúdio no royal com quadro adaptado e miniatura quadrada, recorte creme sobre bege, autocrítica do recorte (peça partida × par de sapatos), escolha automática de fundo, deskew só com eixo dominante e GLB válido (cabeçalho, JSON e buffers).
- `StudioFramingGhostLogoTest` (5 testes): decote preenchido com o interior da peça (e o vão entre manga e corpo continua vazio), gancho e manequim removidos com gola alta preservada, sangria × rente × quadro retrato, corte inclinado com ângulo, e logo estampado encontrado com foto de detalhe (camiseta lisa não ganha logo inventado).
- `Model3dServiceTest` (2 testes): enfileirado → concluído com GLB, pedido repetido sem duplicar, falha legível, reprocessamento grátis só uma vez e fora da cota.
- Teste de ponta a ponta pela API: rascunho com estúdio, recorte incerto (422 legível e depois `force`), cadastro, miniatura, troca de fundo, job 3D concluído com `glTF` válido, notificação e falha seguida de reprocessamento grátis.
- Ponta a ponta do estúdio v2 pela API: a jaqueta cortada pela foto sai em 5:4 sangrando na base; a camiseta no cabide sai em 1:1 com o gancho removido, o decote preenchido, o logo encontrado e a foto de detalhe; a fonte em alta fica guardada e é reutilizada ao refazer com outro fundo; miniatura e detalhe são servidos (200).
- Suíte do backend: 65 testes, 0 falhas. Frontend: `tsc` e `next build` sem erros. As capturas não registraram nenhum erro de console ou HTTP.
