# Modelo 3D da peça (RF16): onde o tempo vai e como comprovar qualidade e textura

Situação relatada em 2026-10-24: gerações 3D de calças jeans demoram muito e não havia como comprovar qualidade e
textura do resultado. Este documento registra o que foi medido no código, o que mudou e como verificar.

## Como o job anda (`Model3dService`)

```
pedido (QUEUED) → tick a cada 5 s → FOTO (recorte) → provedor → ARMAZENAMENTO (GLB) → COMPLETED
```

Provedores, nesta ordem (`AiEngine` escolhe o primeiro disponível e cai para o seguinte):

| Provedor | Modo | Tempo típico | Observação |
| --- | --- | --- | --- |
| Meshy `image-to-3d` | assíncrono (`ENVIO` → `follow` a cada 5 s) | 1–3 min; mais sob fila (`preceding_tasks`) | PBR, textura, remesh para 30 k faces |
| Stability Stable Fast 3D | síncrono (`RECONSTRUCAO`) | segundos | textura 1024, sem PBR |
| Relevo local (`ReliefModelGenerator`) | local (`SILHUETA`/`MALHA`/`TEXTURA`) | < 1 s | plano B: a foto é a textura |

Limite: `fashionai.features.rf16-3d-timeout-minutes` (10 min). Estourado, o job cai no relevo local e a interface avisa
"plano B". Uma calça jeans não é mais lenta que outra peça no código — a demora vem de ficar na fila do Meshy ou de o
Meshy gerar formatos que não usamos.

## O que mudou

- **Status do job com tempo**: `GET /api/pieces/{id}/model3d` devolve `totalTimeMs` (job concluído), `elapsedMs`
  (enquanto roda) e `elapsedMs` em cada etapa (`stages[].elapsedMs`, desde a etapa anterior). A área técnica do painel
  mostra "Tempo total" e o tempo de cada etapa — dá para ver se os minutos estão em `ENVIO`/`RECONSTRUCAO` (provedor)
  ou em `FOTO`/`ARMAZENAMENTO` (nosso lado).
- **Meshy só gera GLB**: a chamada passa `target_formats: ["glb"]`. Antes a Meshy gerava GLB, FBX, OBJ, USDZ e STL —
  a documentação dela diz que listar só os formatos usados encurta a tarefa.

Não mudou (decisão de produto, não técnica): a ordem Meshy → Stability → relevo e os parâmetros de qualidade do Meshy
(`enable_pbr`, `should_remesh`, 30 k faces). Trocar a ordem (Stable Fast 3D primeiro, em segundos, e Meshy depois como
melhoria) reduziria a espera percebida, mas troca qualidade por tempo.

## Como comprovar qualidade e textura de um GLB

```bash
OUT=work/glb-jeans node scripts/avatar3d/glb-report.mjs https://…/model-123.glb   # URL do modelUrl da peça ou arquivo local
```

Gera `front/right/back/left/detail.png`, `report.json` e `report.md` com: triângulos, vértices, UV por mesh, tamanho em
metros, materiais (tipo, cor, rugosidade, metalicidade) e **mapas com resolução** (`map`, `normalMap`, `roughnessMap`,
`metalnessMap`…), além de um índice de nitidez (variância do laplaciano) da frente e do detalhe ampliado ×3. Para
comparar motores, rode no mesmo jeans gerado por cada um: PBR completo tem `map` + `normalMap` + rugosidade/metalicidade;
o relevo local tem só `map` (a foto). O índice de nitidez é relativo — serve para comparar versões do mesmo modelo.

Validação desta entrega: o script foi executado num GLB de amostra pública (Khronos *DamagedHelmet*, 3,6 MB) em
Chromium headless (SwiftShader) e produziu as cinco vistas e o relatório. Não houve chamada a provedor pago nem acesso ao
banco de produção; as medições de tempo por etapa ficam visíveis na primeira geração feita em produção depois do deploy.
