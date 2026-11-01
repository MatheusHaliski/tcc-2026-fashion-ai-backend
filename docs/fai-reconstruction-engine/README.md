# FAI Reconstruction Engine

Motor próprio do FashionAI que transforma a foto de uma peça de roupa — muitas vezes vestida por uma modelo — num
**produto final padronizado: a peça sozinha, centralizada, esticada sobre uma superfície, sem semblante de corpo**,
pronta para o catálogo e para o provador 3D. Roda em GPUs NVIDIA da própria equipe, com modelos de pesos abertos,
sem chamar API de imagem de terceiros.

Este diretório registra o processo inteiro (desenho, decisões, infraestrutura, resultados medidos e o que falta)
para revisão posterior e estudo. Ele descreve o estado de **01/11/2026**; onde algo não foi validado, está dito.

| Documento | Conteúdo |
|---|---|
| [arquitetura-e-fases.md](arquitetura-e-fases.md) | Componentes, as três fases, critérios de entrada na Fase 2, QA, API |
| [infraestrutura-e-operacao.md](infraestrutura-e-operacao.md) | Google Cloud, Tailscale, Docker, segurança, custos, como operar |
| [piloto-e-decisoes.md](piloto-e-decisoes.md) | Piloto com 200 produtos reais, erros encontrados, decisões e seus porquês |
| [fase3-provador.md](fase3-provador.md) | Estudo do provador/avatar e o plano para vestir a peça no avatar |

Código: `services/garment_gpu/` (serviço Python) e os adaptadores Java `GarmentGpu*Adapter` em
`fai-infrastructure/ai-providers`. Guia operacional curto: `services/garment_gpu/README.md` e
`services/garment_gpu/deploy/PHASE2_GCP.md`.

## Em uma frase por fase

1. **Fase 1 — Segmentação (GPU L4):** Grounding DINO localiza a peça e o SAM 2.1 recorta os pixels reais dela.
   Para foto de produto, isso já é o produto final (centralizado em fundo branco ou transparente).
2. **Fase 2 — Reconstrução (GPU A100):** quando a peça estava vestida, coberta por mão/braço ou cortada pela foto,
   o Qwen-Image-Edit-2511 gera a peça em *flat lay* a partir do recorte e da foto original. Um QA automático compara
   o resultado com os pixels fotografados; a aprovação final é humana.
3. **Fase 3 — Avatar:** o flat lay vira a textura dos moldes que já vestem o avatar 3D do provador (planejado; ver
   [fase3-provador.md](fase3-provador.md)).

## Por que a Fase 2 é obrigatória para peças vestidas

A Fase 1 só preserva pixels reais. Ela consegue tirar o fundo e o corpo, mas a peça continua com a **forma de quem a
vestia**: volume dos ombros, vincos, mangas dobradas, costas inexistentes, buraco onde estava a mão. Nenhum ajuste
de máscara resolve isso. Só uma etapa generativa redesenha a peça esticada — por isso toda foto com pessoa vai para
a Fase 2 (decisão tomada após o piloto, ver [piloto-e-decisoes.md](piloto-e-decisoes.md)).

## Linha do tempo

| Data | Marco | PR |
|---|---|---|
| 31/10 | Serviço criado a partir do protótipo (ZIP), com as três fases em código e integração Java | #418 |
| 31/10 | Fase 1 instalada e testada na GPU L4 (`fai-gpu-1`, GCP) | — |
| 31/10 | API publicada em HTTPS sem IP público (Tailscale Funnel); backend Java ligado | #421, #422, #423 |
| 01/11 | Lote do catálogo e piloto com 200 produtos reais | #427, #428 |
| 01/11 | Roteamento automático Fase 1 → Fase 2 e correções de máscara do piloto | #429 |
| 01/11 | Instalação da Fase 2 (VM A100 + LoRA Lightning) preparada | #430 |
