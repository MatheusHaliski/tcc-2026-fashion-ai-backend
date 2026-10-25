# Fotografias de catálogo e texturas do provador

O worker cria uma vez os derivados de cada fotografia autorizada e grava suas URLs em `catalog_images.assets_json.photoSet`. Os originais permanecem intactos. A API reutiliza o conjunto quando versão, URL/hash de origem, categoria, subcategoria, variante e cor efetiva continuam iguais. A cor é `catalog_variants.color` quando não nula, ou a cor do produto; a variante deve pertencer ao mesmo produto. A interface usa a ilustração FAI da categoria/cor durante falhas, sem apresentar a foto de uma pessoa como roupa isolada.

## Instalação e execução

Na raiz do repositório, com Python 3.12:

```bash
python -m venv .venv-catalog
. .venv-catalog/bin/activate
pip install --index-url https://download.pytorch.org/whl/cpu torch==2.7.1
pip install -r services/catalog_photos/requirements.txt
python -m scripts.catalog.prepare_photo_models --cache-dir work/catalog-model-cache --download \
  --exec python -m scripts.catalog.process_photo_sets --limit 10 --audit work/photo-sets-audit.jsonl
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

O provedor automático usa os logits locais do FASHN e uma máscara independente `u2net_cloth_seg`. Exige IoU de máscaras ≥0,90, percentil 10 do softmax do interior comum ≥0,80 e extensão/completude consistentes. O softmax é a saída real do modelo, não uma probabilidade calibrada de acerto. Oclusão, extensão incerta e discordância retornam `REVIEW`; dependência/pesos ausentes retornam `RETRY`. O preflight mede a altura na fonte antes de limpar alpha, ampliar, renderizar ou enviar arquivos. Só uma medição confiável estritamente abaixo de 25% pode produzir `INELIGIBLE`.

`prepare_photo_models` baixa apenas pesos públicos, usando revisão FASHN imutável e tamanho/SHA-256 fixos dos quatro arquivos. Um cache inválido sem `--download` encerra a execução; com `--download`, somente bytes verificados substituem o arquivo. O `--exec` define `CATALOG_PHOTO_PARSER_WEIGHTS` e `U2NET_HOME` antes de iniciar o worker. O contêiner verifica o cache em cada inicialização e mantém os pesos no volume `models`; nenhuma foto é enviada aos modelos. Para pré-provisionar ou verificar sem acessar banco/storage:

```bash
python -m scripts.catalog.prepare_photo_models --cache-dir work/catalog-model-cache --download
python -m scripts.catalog.prepare_photo_models --cache-dir work/catalog-model-cache
```

O Docker instala a roda CPU do Torch, verifica dependências/imports e inclui `libgl1`, necessário ao OpenCV usado pelo FASHN. `Dockerfile.dockerignore` exclui fotografias, pesos, relatórios locais e credenciais do contexto. Em ambiente com proxy/CA, passe o bundle combinado sem incorporá-lo à imagem: `docker build --secret id=proxy_ca,src=/etc/ssl/certs/ca-certificates.crt -f services/catalog_photos/Dockerfile .`. Na inicialização, monte o bundle somente leitura e configure `SSL_CERT_FILE` para o download inicial, se o proxy exigir esse CA.

As classes atendidas pelo provedor padrão são parte superior, inferior e corpo inteiro. Calçados/acessórios sem segmentador específico retornam a ilustração padrão. Pele, outras classes e contornos externos classificados são excluídos sem redesenhar estampas internas. Detalhes finos não classificados exigem revisão. Os dois modelos segmentam classes, sem identificar instâncias: roupas sobrepostas ou encostadas da mesma classe ainda podem compartilhar uma máscara. A concordância entre modelos não certifica esse caso, nem garante ausência de todos os halos em fontes de baixa resolução. Esses casos precisam de fonte alternativa segura ou revisão das máscaras.

* `wholeUrl`: PNG RGBA 900×1200 transparente, proporção preservada, peça centralizada com maior aresta normalizada em 50% do quadro.
* `fabricUrl`: PNG com retângulo 3:4 integralmente dentro da máscara, preenchimento de tecido 100%, sem padding. Mantém resolução original até o limite 900×1200; nenhuma parte escondida é inventada. Se não houver área segura, retorna `REVIEW`.
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
python -m unittest discover -s scripts/catalog/tests -v
```

Passaram 265 testes Python. Também foi executado o provedor real CPU com os quatro arquivos de pesos verificados: cinco originais de três produtos produziram dois `READY` (hoodie Nike Celtics e camisa Aramis frontal) e três `REVIEW` (duas vistas Hokkaido floral e Aramis lateral). A alternativa Hokkaido da posição 6 da galeria oficial, um flat lay, passou separadamente com IoU 0,985772 e altura na fonte 50,8604%; as vistas incertas permaneceram `REVIEW`. Nenhum produto foi confirmado abaixo de 25% e não houve conexão ao banco ou upload. Isso demonstra o caminho real, sem calibrar a precisão para o catálogo inteiro. O worker ainda precisa ser implantado e validado no ambiente conectado ao banco/storage; o build Docker não foi executado nesta verificação por indisponibilidade do socket local.
