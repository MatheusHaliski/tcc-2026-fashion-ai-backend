# Preflight da foto de catálogo e Total frame

O Total frame exibe somente a peça selecionada pela categoria/subcategoria: sem pessoa, outras roupas, silhuetas externas ou fundo da marca. A peça completa é centralizada num quadro 900 × 1200, com escala uniforme. A maior aresta normalizada ocupa aproximadamente 50% do quadro (`max(largura/900, altura/1200) = 0,5`); as duas arestas só podem ocupar 50% simultaneamente quando suas proporções coincidem com as do quadro.

O gate `CATALOG_SOURCE_PREFLIGHT_V1` acontece antes de limpar alpha, recortar, ampliar, renderizar, gravar arquivos derivados ou enviar ao armazenamento. Ele mede a altura real da peça na fonte orientada por EXIF, e conserva tanto a fração quanto a altura equivalente em pixels da fonte original. Reduzir a imagem de análise para até 2048 pixels não transforma a fração em ocupação do quadro final.

| Resultado da fonte | Consequência |
| --- | --- |
| Peça completa, isolada e com medição explicitamente atestada; altura menor que 25% | `INELIGIBLE`, motivo `SOURCE_GARMENT_BELOW_MIN_HEIGHT`; nenhum derivado/upload |
| Mesma evidência; altura exatamente 25% ou maior | `PASS`; limpeza e renderização podem prosseguir |
| Medição/isolamento não atestados, oclusão, truncamento, categoria divergente, máscara vazia ou extensão ambígua | `REVIEW`; não exclui o produto |
| Modelo/dependência indisponível, timeout ou falha de obtenção/armazenamento | `RETRY`; não exclui o produto |

O preflight não mede o corpo, a tela final ou o bbox de foreground genérico. Uma abertura morfológica estima a extensão sustentada da máscara sem alterar RGB/alpha; detalhes finos não classificados tornam a medição incerta, para que uma alça real nunca desapareça e produza uma falsa certeza de altura menor que 25%. Contornos externos classificados independentemente podem ser excluídos da medição. Nenhum detalhe interno da estampa, marca ou tecido é redesenhado.

Depois de `PASS`, a limpeza remove regiões semanticamente proibidas e pequenas sobras, conserva componentes legítimos (por exemplo, duas pernas ou partes de um conjunto) e recusa linhas finas sem classificação confiável. Não preenche pele, partes escondidas ou buracos de oclusão. `photo_set.py` usa fundo branco; o worker legado `whole_frame.py` usa `#F4F5F7`.

## Evidência revisada

O provedor local `LocalClothProvider` não inventa confiança, completude nem certeza de medição. Mesmo com os dois modelos locais presentes, o resultado continua `REVIEW` enquanto essas propriedades não tiverem evidência explícita. A confiança opcional permanece `null` quando não foi fornecida; números fora de `[0,8; 1]` e valores inválidos não são aceitos.

`--reviewed-masks` permite um manifesto de revisão ligado aos bytes originais, aos pixels RGB efetivamente analisados e aos dois arquivos de máscara. Os workers de conjuntos de fotos, Total frame e dataset aceitam esse argumento. Exemplo de estrutura, com hashes reais a serem calculados pelo processo de revisão:

```json
{
  "version": "CATALOG_REVIEWED_MASKS_V1",
  "images": [{
    "sourceSha256": "<sha256 dos bytes originais>",
    "sourceUrl": "https://marca.example/peca.png",
    "category": "upper_piece",
    "subcategory": "shirt",
    "analysisPixelSha256": "<sha256 de image.convert('RGB').tobytes() após EXIF/thumbnail>",
    "targetMask": "masks/peca.png",
    "targetMaskSha256": "<sha256 do arquivo de máscara da peça>",
    "forbiddenMask": "masks/proibido.png",
    "forbiddenMaskSha256": "<sha256 do arquivo de máscara de pessoa/outras peças/contornos>",
    "reviewedBy": "identificador do revisor",
    "reviewedAt": "2026-10-23T00:00:00Z",
    "semanticVerified": true,
    "measurementVerified": true,
    "isolationVerified": true,
    "humanPresent": false,
    "complete": true,
    "occluded": false
  }]
}
```

As máscaras devem ter as dimensões da análise e permanecer dentro do diretório do manifesto. Alteração dos bytes originais, categoria/subcategoria, URL vinculada, pixels de análise ou arquivos de máscara invalida a revisão. Os campos booleanos são atestações da revisão; a simples presença de uma máscara de modelo não os fornece. A origem registrada inclui o SHA-256 do manifesto.

## Exclusão conservadora do produto

`quarantine_unsafe_products.py` só candidata um produto visível quando **todas** as suas imagens candidatas possuem evidência atual de altura estritamente menor que 25%. Cada imagem precisa ter `CATALOG_PHOTO_SET_V2`, motivo de rejeição correto, preflight atual, medição confiável, completude/isolamento atestados, ausência de oclusão e SHA-256 válido igual ao registrado na fonte. Qualquer candidata sem medição, falha de modelo/download, timeout, fonte alterada ou alternativa válida impede a exclusão. Nenhuma imagem do produto também impede a exclusão.

O script não executa `DELETE`. A aplicação altera `ingestion_status` para `REJECTED` e acrescenta `metadata_json.catalogPhotoEligibility`, preservando os demais metadados. Guarda-roupas existentes não são alterados. O relatório contém versão do algoritmo, motivo, estado anterior, provas por imagem, hashes da fonte, identidade/versão das imagens e hashes de integridade da evidência e do relatório.

O ensaio é o padrão e apenas cria o relatório. A aplicação revalida o relatório, bloqueia produto/imagens, verifica versão do produto, lista/versões/URLs/SHA de todas as imagens e recalcula a prova antes do update. Uma nova alternativa válida, edição concorrente ou alteração da fonte faz a entrada ser pulada. `--restore` exige o marcador e o incremento de versão esperados; restaura o estado anterior sem aceitar replays. O worker de fotos também usa CAS de versão/URL/contexto; o de Total frame verifica versão da imagem, URL, SHA e categoria/subcategoria no update.

```bash
# Ensaio offline: não conecta ao banco e não pode ser aplicado.
python3 -m scripts.catalog.quarantine_unsafe_products \
  --snapshot work/catalog-preflight-offline-snapshot.json \
  --report work/catalog-preflight-offline-report.json

# Operação de banco disponível para uma execução posterior autorizada:
# somente leitura; cria relatório obtido de snapshot consistente.
python3 -m scripts.catalog.quarantine_unsafe_products --report work/catalog-quarantine.json

# Revalida CAS e aplica/restaura exatamente o relatório de banco.
python3 -m scripts.catalog.quarantine_unsafe_products --report work/catalog-quarantine.json --apply
python3 -m scripts.catalog.quarantine_unsafe_products --report work/catalog-quarantine.json --restore
```

Um relatório de `--snapshot` sempre tem origem `OFFLINE_SNAPSHOT:<sha256>`; `--apply`/`--restore` recusam esse relatório antes de abrir conexão. Os comandos de banco acima são instruções operacionais; não foram executados nesta entrega.

## Etapa opcional: packshot local com Stable Diffusion (`process_local_sd.py`)

Situação em 2026-10-24: o lote de packshot pela API externa (FASHN) falhou por falta de créditos, e o campo
`catalog_images.processed_image_url` **não é lido pela interface** por decisão do responsável (a exibição por esse campo
foi revertida). O plano do Total frame passa a ter duas trilhas:

| Trilha | Onde roda | Grava em | Estado |
| --- | --- | --- | --- |
| Peça inteira verificada (`process_whole_frames.py` / `process_photo_sets.py`) | lote local, sem IA generativa | `whole_url`/`whole_json`, `assets_json.photoSet` | é o que a interface mostra hoje |
| Packshot local *ghost mannequin* (`process_local_sd.py`) | lote local com Stable Diffusion Inpainting (CUDA/MPS/CPU) | `processed_image_url` + `./output_images/` | gera e grava; a interface só passará a usar quando o responsável liberar |
| Packshot pelo pipeline aberto da FASHN (`process_local_sd.py --engine fashn-open`) | parser humano da FASHN (rótulos por categoria do fashn-vton-1.5) + BiRefNet (alfa fino) + LaMa na região fantasma, `--sd` opcional; GPU via `scripts/cloud/packshot_gpu_vm.py` | os mesmos do engine `sd` | pronto na branch; o `packshot` da API da FASHN é fechado, então este é o equivalente mais próximo sem créditos |

Regras comuns às duas trilhas: isolar a peça (sem pessoa, outras peças, linhas/silhuetas fora do perímetro), centralizar
com a maior aresta em 50% do quadro 3:4, remover o fundo, e nunca gerar packshot de peça cuja altura na foto seja menor
que 25% — essa foto vai para `ineligible.json`/`INELIGIBLE` e a exclusão do produto continua sendo o passo auditado de
`quarantine_unsafe_products.py` (nada é apagado pelos lotes). Diferença da trilha SD: a IA preenche SOMENTE a região
fantasma (corpo visível por dentro da peça); o tecido fotografado é restaurado pixel a pixel na composição, então estampa,
logo e costura nunca são redesenhados. Ordem recomendada: `--measure-only` (quarentena) → `--dry-run` (revisão visual em
`output_images/`) → execução com gravação.

## Leitura do catálogo e compatibilidade

Produtos legados sem `catalogPhotoEligibility` continuam visíveis. `REVIEW`, `RETRY` e medições ausentes não esvaziam o catálogo. O estado `INELIGIBLE` do produto auditado e a ingestão `REJECTED` são respeitados pelas consultas visíveis, detalhe e inclusão no guarda-roupa.

Uma imagem `READY` alternativa com preflight válido tem preferência sobre a canônica pequena ou pendente. Fontes `REVIEW`/`INELIGIBLE`/`RETRY` usam o asset padrão enquanto aguardam tratamento e não entram na renderização legada nem no transporte de textura. O Total frame legado baseado só em fundo de estúdio/pele/bbox não é exposto como peça isolada. Derivados de Total frame exigem a versão atual, SHA/URL atuais, preflight válido, peça completa e caixa centralizada de 50%. O enquadramento de tecido legado continua disponível conforme as regras existentes.

## Verificação realizada

- 33 testes Python passaram (`work/catalog-preflight-python-tests.log`): cobrem 24,9%, 25% exatos, redimensionamento de análise, recusa antes de cleanup/render/upload, pessoas/outras roupas/contornos, proporção/centralização, oclusão/truncamento, conjuntos, modelo sem confiança inventada, hashes do manifesto e timeout do provedor.
- A quarentena é exercitada com updates SQL numa base SQLite em memória: aplicar/restaurar, preservar metadados, bloquear replay, fonte alterada e nova alternativa válida. O CLI offline é testado com `db.connect` interceptado.
- O relatório offline em `work/catalog-preflight-offline-report.json` é uma demonstração com fixtures sintéticas; não representa contagem de produtos reais. O registro `work/catalog-preflight-offline-cas.json` demonstra aplicação, replay bloqueado e restauração somente em memória.
- Classes Java relevantes: `CatalogPhotoEligibilityTest`, `CatalogServiceTest` e `CatalogImagePipelineServiceTest`. A validação Java é executada pelo build serial coordenado da entrega; o log anterior `work/catalog-preflight-java-tests.log` parava na compilação de classes Atelier antes de executar testes de catálogo.

Não houve acesso ao banco real, upload de derivados ou exclusão de produto em produção nesta verificação. A qualidade de segmentação no catálogo real ainda depende da revisão das fontes; os testes sintéticos não calibram a precisão dos modelos.
