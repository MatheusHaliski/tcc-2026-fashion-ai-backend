# Contrato do bundle GPU

## Estado

O servidor, o loader, o Dockerfile e o publicador estão implementados. **Não há
pesos treinados de roupa/corpo neste repositório.** A criação de endpoints não
produz esses pesos. A publicação é bloqueada sem um bundle válido; não existe
modo de produção com modelos falsos, landmarks por bounding box ou fallback CPU.

O bundle aceita exports TorchScript confiáveis. Baixar um checkpoint de SAM,
DensePose, FLAME ou SMPL-X não satisfaz automaticamente este contrato: é necessário
o adaptador/export correto e a validação do resultado. Os módulos numéricos de
digital twin não equivalem a esses pesos nem aos seus direitos de uso.

## Arquivos

```text
model-bundle/
  manifest.json
  garment.pt
  body.pt
  calibration.json
```

`manifest.json` deve corresponder a `BundleManifest` em `bundle.py`:

| Campo | Conteúdo |
| --- | --- |
| `schema_version` | `1` |
| `model_version` | Versão que também identifica o cache de anotações |
| `input_size` | Lado da entrada quadrada, 128–1024 pixels |
| `calibration_report` / `calibration_sha256` | Caminho relativo e SHA-256 do relatório real de avaliação |
| `garment` / `body` | Cada um contém `file`, `sha256`, `license`, `anchor_names`, `labels`, `supported_categories` |

Os mapas `labels` de ambos os modelos têm as sete chaves, nesta ordem lógica:
`category`, `subcategory`, `neckline_type`, `sleeve_length`, `closure_type`,
`waistline_type`, `fit_type`. Cada valor é a lista ordenada de rótulos usados
no treinamento/export. As listas de nomes de anchors também preservam a ordem
dos tensores. Seus nomes precisam corresponder aos perfis de `profiles.py` e
aos pontos corporais utilizados por `dynamic.py`.

O relatório deve documentar dataset e licenças, divisão de validação, calibração
de confiança, categorias cobertas, erro dos landmarks, máscaras, rejeições e
medições de memória/latência. Verificar SHA-256 comprova integridade dos arquivos,
**não comprova a veracidade do relatório ou a precisão do modelo**.

## Assinatura dos exports

Entrada de imagem: `float32[1,3,S,S]`, RGB, intervalo `[0,1]`, resize bilinear.
O modelo de roupa recebe somente essa imagem. O modelo corporal recebe também
`int64[1,7]`, com os índices dos atributos nas listas de `body.labels`.
Essa segunda entrada permite condicionar regiões vestíveis à categoria e ao caimento.

Saída: `Dict[str, Tensor]`, sem dimensão de batch nas evidências:

| Modelo | Tensores necessários |
| --- | --- |
| Roupa | Sete vetores de probabilidades, um para cada atributo; `anchors[N,3]`; `mask[H,W]` |
| Corpo | `anchors[N,3]`; `body_mask[H,W]`; `foreground_skin_mask[H,W]`; `wearable_region_mask[H,W]` |
| Roupa, quando aplicável | `neckline_curve[K,3]` e `placket[K,3]` |
| Corpo, quando aplicável | `neckline_target[K,3]` e `sagittal_target[K,3]` |

Cada ponto contém `[x_normalizado, y_normalizado, confiança_calibrada]`. A
conversão usa `x*(largura-1)` e `y*(altura-1)`. Confiança abaixo de 0,8, posições
fora de `[0,1]`, máscaras inválidas e atributos incompatíveis são rejeitados.
As curvas necessárias variam por roupa; a ausência delas não gera pontos inventados.

Os outputs corporais são declarados `ANNOTATED_2D`; o loader não os apresenta
como coordenadas DensePose, malha SMPL-X ou geometria 3D medida.

## Verificação e execução

```bash
# Sem GPU: estrutura e integridade, não execução ou acurácia do modelo.
python3 -m services.anatomical_vton.vertex_runtime.preflight /caminho/model-bundle

# Em máquina CUDA compatível: carrega ambos os exports e executa warm-up.
python3 -m services.anatomical_vton.vertex_runtime.preflight /caminho/model-bundle --gpu
```

A prontidão do container só é estabelecida após carregar e aquecer os dois
exports em CUDA. O serviço usa um processo e uma inferência simultânea. A saúde
continua atendida em outra thread; concorrentes recebem HTTP 429 para retry.

O endpoint compartilhado tem teto de payload de 1,5 MB. Cliente e servidor usam
1,4 MB com margem. Imagens grandes são rejeitadas sem resize silencioso que
invalidaria coordenadas; reenquadre/reduza a imagem antes de solicitar anotação.

Referências: [requisitos de container Vertex](https://cloud.google.com/vertex-ai/docs/predictions/custom-container-requirements),
[payload do predict](https://cloud.google.com/sdk/gcloud/reference/ai/endpoints/predict).
