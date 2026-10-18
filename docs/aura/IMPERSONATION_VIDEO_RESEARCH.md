# Pesquisa de vídeo Aura Impersonation

Consulta de fontes primárias. Nenhum peso foi baixado, nenhuma foto foi enviada e nenhuma inferência GPU foi executada.

| Fonte | Abordagem | Consulta | Licença declarada |
| --- | --- | --- | --- |
| [Wan2.1 I2V](https://huggingface.co/Wan-AI/Wan2.1-I2V-14B-480P/raw/main/README.md) | IMAGE_TO_VIDEO | FETCHED | apache-2.0 |
| [LTX Video](https://huggingface.co/Lightricks/LTX-Video/raw/main/README.md) | IMAGE_TO_VIDEO | FETCHED | other |
| [HunyuanVideo I2V](https://huggingface.co/tencent/HunyuanVideo-I2V/raw/main/README.md) | IMAGE_TO_VIDEO | FETCHED | other |
| [CogVideoX I2V](https://huggingface.co/THUDM/CogVideoX-5b-I2V/raw/main/README.md) | IMAGE_TO_VIDEO | FETCHED | other |
| [AnimateDiff](https://raw.githubusercontent.com/guoyww/AnimateDiff/main/README.md) | MOTION_CONTROL | FETCHED | Revisar fonte |
| [LivePortrait](https://raw.githubusercontent.com/KwaiVGI/LivePortrait/main/readme.md) | PORTRAIT_ONLY | FETCHED | Revisar fonte |
| [Veo on Vertex](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation) | MANAGED_VIDEO | FETCHED | Revisar fonte |
| [FASHN VTON](https://huggingface.co/fashn-ai/fashn-vton-1.5/raw/main/README.md) | VIRTUAL_TRY_ON_STILL | FETCHED | apache-2.0 |

## Decisão de implementação

Preservar VTON como etapa de imagem vestida. Avaliar image-to-video controlado por referência para o corpo inteiro; LivePortrait isoladamente não atende a roupa e pose de corpo inteiro.
VFX 2.5D é uma opção determinística distinta, que deve ser identificada como tal. Não declarar motion transfer onde só há fundo animado.
Não selecionar modelo 14B/5B para a T4 apenas pelo nome: medir VRAM, offload, identidade, fidelidade da peça e qualidade temporal antes de habilitar produção.
Confirmar disponibilidade e licença comercial da revisão exata, região/provedor, política de dados e custo. Linhas extraídas dos documentos não substituem essa avaliação.

## Benchmark pendente

Medir duração de aproximadamente 5s, 24fps, resolução, latência, VRAM e custo. Verificar identidade, cor/estampa/forma da roupa, oclusão, flicker e transição último→primeiro frame em dados autorizados.
