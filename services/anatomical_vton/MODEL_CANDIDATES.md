# Modelos verificados e lacunas de integração

Verificação em 2026-10-15. A lista separa capacidade nativa de adaptação necessária;
não declara que todos os modelos já foram instalados ou medidos na T4.

| Modelo / fonte primária | Capacidade | Estado neste repositório |
| --- | --- | --- |
| [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/python) | 33 joints de pose e máscara da pessoa | Modelo Full já presente; inferência real CPU executada e diagnóstico privado integrado |
| [DeepFashion2](https://github.com/switchablenorms/DeepFashion2) | Dataset/benchmark de 13 categorias com máscaras e definições de landmarks específicas por categoria | Não instalado; acesso ao dataset exige formulário. Não é um export pronto para o contrato VTON nem cobre todos os acessórios e calçados |
| [SAM 2](https://github.com/facebookresearch/sam2) | Segmentação orientada por prompts em imagens/vídeos; checkpoints e código de inferência disponíveis | Candidato para refinamento de máscaras; não detecta por si só gola, botões, punhos ou seus nomes anatômicos. Integração/CUDA ainda não executadas |
| [Qwen2.5-VL-7B-Instruct](https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct) | Interpretação multimodal e atributos semânticos | Candidato a auxiliar de classificação, não evidência calibrada de seams. Pesos não baixados nem testados; memória/quantização e licença da revisão escolhida precisam ser verificadas |

## Decisão atual

Usar o MediaPipe já disponível como diagnóstico parcial, separado de
`BodyEvidence`. Sua saída não é adaptada artificialmente para fornecer curvas
cervicais, perímetros de braços ou regiões de oclusão que o modelo não mediu.

A ponte de anotação também reaproveita `AiEngine` do backend. Ela exige resposta
verificada e preserva a máscara calculada no servidor; o worker continua
responsável por validar o perfil geométrico completo antes do warping.

O bundle TorchScript do runtime GPU continua sendo um contrato de exportação.
Os modelos listados não devem ser renomeados para `.pt` ou receber confiança
inventada para passar pela validação. A etapa seguinte é adaptar/treinar a
correspondência de seams e a evidência corporal, avaliando erro, cobertura por
categoria e consumo real da única T4 antes de ativar a geração no aplicativo.
