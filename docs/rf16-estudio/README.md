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
- As "fotos de celular" da folha comparativa foram **simuladas** a partir da imagem de referência (reduzida, com ruído, parede cinza ou bege), porque não havia foto real de celular da peça.

## Verificação

- `StudioAndReliefTest` (6 testes): estúdio 1600² no royal, recorte creme sobre bege, autocrítica do recorte (peça partida × par de sapatos), escolha automática de fundo, deskew só com eixo dominante e GLB válido (cabeçalho, JSON e buffers).
- `Model3dServiceTest` (2 testes): enfileirado → concluído com GLB, pedido repetido sem duplicar, falha legível, reprocessamento grátis só uma vez e fora da cota.
- Teste de ponta a ponta pela API: rascunho com estúdio, recorte incerto (422 legível e depois `force`), cadastro, miniatura, troca de fundo, job 3D concluído com `glTF` válido, notificação e falha seguida de reprocessamento grátis.
- Suíte do backend: 60 testes, 0 falhas. Frontend: `tsc` e `next build` sem erros. As capturas não registraram nenhum erro de console ou HTTP.
