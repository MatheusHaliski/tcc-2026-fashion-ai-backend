# Fotografias de catálogo e texturas do provador

O worker cria uma vez os derivados de cada fotografia autorizada e grava suas URLs em `catalog_images.assets_json.photoSet`. Os originais permanecem intactos. A API reutiliza o conjunto quando versão, URL/hash de origem, categoria, subcategoria e cor continuam iguais. A interface usa a ilustração FAI da categoria/cor durante falhas, sem apresentar a foto de uma pessoa como roupa isolada.

## Instalação e execução

Na raiz do repositório, com Python 3.12:

```bash
python -m venv .venv-catalog
. .venv-catalog/bin/activate
pip install -r services/catalog_photos/requirements.txt
python -m scripts.catalog.process_photo_sets --limit 10 --audit work/photo-sets-audit.jsonl
```

O comando acima consulta o banco e processa em memória, mas não grava no banco/storage. Configure pelas mesmas variáveis do backend: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_SSL_MODE`. Para gravação: `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_ENDPOINT` quando necessário e `STORAGE_PUBLIC_BASE_URL` (ou a configuração existente de entrega pela API). Não versione credenciais.

```bash
python -m scripts.catalog.process_photo_sets --apply --watch --audit work/photo-sets-audit.jsonl
```

Alternativa em serviço separado, com `.env` local autorizado na raiz:

```bash
docker compose -f services/catalog_photos/compose.yml up --build -d
```

O serviço examina o catálogo em páginas e só processa derivados ausentes/desatualizados; a alteração da imagem ou do produto invalida o resultado. Erros transitórios entram em `RETRY`, com nova tentativa após cinco minutos. A gravação compara a versão/contexto e verifica novamente a autorização da fonte, preservando correções concorrentes. `--force` permite reprocessamento explícito. Uma mudança de bytes mantendo exatamente a URL requer atualização do hash de origem ou esse reprocessamento.

## Máscaras e limites

Usa `rembg` com `u2net_cloth_seg`, não a máscara genérica que preserva pessoas. O primeiro uso pode baixar pesos; mantenha cache persistente e provisione os pesos antes de disponibilizar o worker. Opcionalmente `CATALOG_PHOTO_PARSER_WEIGHTS` aponta para os pesos locais do parser FASHN compatível; `CATALOG_PHOTO_DEVICE` seleciona o dispositivo. Verifique a licença dos pesos antes de distribuí-los.

As classes atendidas pelo provedor padrão são parte superior, inferior e corpo inteiro. Calçados/acessórios sem segmentador específico retornam a ilustração padrão, sem fingir isolamento seguro. Outras roupas, pele e regiões proibidas são excluídas; contornos finos externos são removidos sem apagar estampas internas. Máscaras ambíguas não são publicadas como fotografia aprovada.

* `wholeUrl`: PNG 900×1200 branco, proporção preservada e margem.
* `fabricUrl`: PNG 480×640, retângulo integralmente dentro da máscara; sem fundo. Se não houver área segura, retorna `DEFAULT`.
* `defaultAssetUrl`: ilustração FAI recolorida por categoria/subcategoria, com variantes WHOLE/FABRIC; não é foto real da marca.

**Não há reconstrução generativa de áreas escondidas ou remodelagem industrial da peça.** O exemplo FASHN de uma pessoa para uma peça reconstruída requer uma etapa adicional de model-to-product, avaliação e licença. Um recorte semântico não produz essa equivalência. Também não recupera costuras, mangas ou costas invisíveis; a projeção no avatar continua uma aproximação de fotografia, não uma digitalização 3D.

## Dataset assíncrono independente

```bash
python -m scripts.catalog.ingest_image_dataset --input services/catalog_photos/example-products.json --output work/catalog-dataset --concurrency 4
```

Substitua as URLs ilustrativas do exemplo por fotografias autorizadas. HEAD é seguido de GET validado; servidores que não aceitam HEAD usam GET. Há timeout, limite de bytes, retries e bloqueio de endereços privados inclusive no DNS e nos redirects. Dimensões originais menores que 300 em qualquer eixo são rejeitadas. O resultado é PNG 512×512 branco e proporcional, com `metadata_clean.json` e estados `VALID`, `DUPLICATE`, `REJECTED`. pHash mais cor evita colapsar variantes de cores distintas. Uma imagem corrompida não interrompe as demais.

Exemplo de registro (ilustrativo):

```json
{"event":"image_completed","product_id":"bermuda-001","status":"VALID","completed":1,"total":10}
```

Para pré-gerar ilustrações, sem alterar fotos de marcas:

```bash
python -m scripts.catalog.default_assets --subcategory shorts --color blue --color beige --output work/default-assets
```

## Exclusão reversível

```bash
python -m scripts.catalog.quarantine_unsafe_products --report work/unsafe-products.json
```

A auditoria não exclui nada. Só é elegível produto cujas **todas** as imagens tenham rejeição visual confirmada e atual. Download indisponível, pesos ausentes e fonte sem permissão de cópia não justificam exclusão. A opção `--apply` faz rejeição lógica com revalidação; `--restore` restaura conforme o relatório e a versão, preservando relações/histórico. Consulte `--help` para os argumentos. Nenhuma exclusão no banco de produção foi executada nesta implementação.

## Validação

```bash
pip install -r scripts/catalog/requirements-photo-tests.txt
python -m unittest scripts.catalog.tests.test_photo_pipeline -v
```

Os testes usam máscaras sintéticas explícitas: cobrem infraestrutura e regras, mas não certificam qualidade dos pesos em fotografias reais. O worker ainda precisa ser implantado e validado com fotos autorizadas no ambiente conectado ao banco/storage.
