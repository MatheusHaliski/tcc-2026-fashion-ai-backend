# Plano: modelo 3D de vitrine para todas as peças do catálogo (15/11/2026)

Objetivo: cada produto do catálogo (14.321 hoje) ganha um `.glb` em `catalog_product_models_3d` (V97). Nota BOM vira
PUBLISHED; o resto fica DRAFT para revisão ou volta para a geração. O flat lay aprovado **deixa de ser obrigatório**.

## Entrada: a melhor imagem que o produto tiver

`scripts/catalog/glb_batch_sources.py`, nesta ordem:

| Fonte | O que é | Vistas | Pessoa na foto |
|---|---|---|---|
| `FLAT_LAY` | flat lay aprovado | frente + costas (quando há) | não |
| `WHOLE` | Peça inteira já recortada (`whole_status = 'RENDERED'`) | frente | não |
| `FOTO` | foto do produto (canônica aprovada › principal › do bucket), nunca `usage_status = 'REJECTED'` | frente | removida na GPU pelo recorte FASHN (`hunyuan_glb_cutout.py`) |

## Geração: Hunyuan3D-2mv + Paint 2.0 numa T4 da GCP

- Forma: Hunyuan3D-2mv turbo (5 passos + FlashVDM), 6 GB de VRAM.
- Textura: Hunyuan3D-2 Paint 2.0 turbo, que cabe na T4 de 16 GB (o 2.1 PBR pede 21 GB).
- Cada etapa roda num processo: `hunyuan_glb_runner.py --stage shape`, depois `--stage paint --paint 2.0`.
- VM spot com teto de duração, que se apaga sozinha: `scripts/cloud/hunyuan_t4_vm.py`.
- Gerador gravado: `hunyuan3d-2mv+2.0`, origem `gcp`.

## Etapas e portões

| # | Onde | O quê | Portão para seguir |
|---|---|---|---|
| 0 | Mac | `audit_model3d_import.py` e, com confirmação, o `--apply` do lote do Codex (125 + 11) | auditoria sem chave órfã e sem linha sem objeto |
| 1 | Mac | `export_glb_batch.py --catalogo` (só lê o banco): `lote.csv` com a fonte de cada produto | contagem por fonte conhecida |
| 2 | GCP | **piloto**: `hunyuan_t4_vm.py --pilot 30` (10 por fonte), spot, teto de 3 h | tempo, VRAM e notas medidos; registro em `piloto-e-decisoes.md` |
| 3 | Mac | ensaio do `import_meshy_glbs.py --generator hunyuan3d-2mv+2.0 --origin gcp` e renders de frente, lado e costas | decisão sobre a publicação por fonte e por categoria |
| 4 | GCP | lote em ondas de ~500 produtos (uma VM por onda; mais de uma em paralelo, se a cota deixar) | cada onda: busca, ensaio, confirmação, `--apply`, auditoria |
| 5 | GCP ou RunPod | o que sair RUIM: gerar de novo com outra fonte, ou com o 2.1 PBR numa GPU de 24 GB ou mais | — |

Critério de partida para o portão 3 (ajustar com o piloto):
- `FLAT_LAY` e `WHOLE`: pelo menos 70% BOM ou REVISAR.
- `FOTO`: pelo menos 50%. Até haver revisão por amostragem, a FOTO entra como DRAFT. Se o piloto confirmar essa
  necessidade, o importador ganha a opção `--draft-fontes FOTO`.

## Custo e prazo (estimativa; o piloto mede)

240 a 420 s por produto na T4, mais ~0,75 h de instalação por VM. Preços de lista de southamerica-east1: cerca de
US$ 0,30/h spot e US$ 0,95/h sob demanda.

| Lote | Horas de GPU | Spot | Sob demanda |
|---|---|---|---|
| Piloto (30) | 2,8 a 4,3 | US$ 1 | US$ 3 a 4 |
| Catálogo (14.321) | 955 a 1.670 | US$ 290 a 500 | US$ 900 a 1.590 |

- Os US$ 300 de crédito cobrem o catálogo inteiro só no cenário rápido e em spot. No cenário lento, cobrem de 8.500 a
  9.000 produtos.
- Prioridade dentro do crédito: produtos com `FLAT_LAY`/`WHOLE`, depois `FOTO` das categorias que o piloto aprovar.
- **Prazo:** uma T4 só levaria de 40 a 70 dias. O crédito de teste vence 90 dias depois do cadastro, então são
  necessárias de 3 a 4 VMs em paralelo, o que depende da cota de T4 na região.
- **Armazenamento:** o lote do Codex deu cerca de 11,6 MB por produto (WEB + DESKTOP_HIGH). O catálogo inteiro somaria
  ~165 GB no bucket de produção, e esse custo de armazenamento precisa entrar na decisão.

## Riscos

- **Licenças:** Tencent Hunyuan 3D 2.0 Community (não vale na UE, Reino Unido e Coreia do Sul; acima de 1 milhão de
  MAU pede licença); FASHN parser (Apache-2.0); BiRefNet (MIT).
- **Fotos da loja (`usage_status = 'REFERENCE_ONLY'`):** o `.glb` é um derivado da foto oficial. A mesma regra do
  pipeline da Peça inteira (`usage_status <> 'REJECTED'`) foi seguida, mas a publicação precisa da sua decisão.
- **Spot:** a VM pode ser interrompida. O runner retoma do ponto onde parou; basta subir a mesma onda de novo.
- **Categorias difíceis:** joia, óculos e peças muito finas. O piloto decide se ficam de fora.
- **Textura só da frente:** as costas são inventadas pelo modelo, exceto na forma quando o flat lay tem costas.
