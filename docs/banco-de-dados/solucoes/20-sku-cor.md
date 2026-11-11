# Exercício 20 — Variante do catálogo por SKU e cor

**Situação na revisão `9f5512a77`:** A query por identificador já correlaciona SKU e cor na mesma variante; manter isso e testar seleção/criação.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](../RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema/modelos.** `CatalogProduct` e `CatalogVariant` são distintos: [CatalogProduct.java:71](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/CatalogProduct.java#L71) e [CatalogVariant.java:34](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/CatalogVariant.java#L34). `wardrobe_items.catalog_product_id` e `catalog_variant_id` preservam a origem. Não criar outra coluna sku no produto/peça se ela já existe.

2. **Repository.** A query correta está em [CatalogProductRepository.java:79](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/CatalogProductRepository.java#L79); seu EXISTS testa identificador e cor no mesmo alias v. Manter o countQuery equivalente. Em [CatalogVariantRepository.java:17](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/CatalogVariantRepository.java#L17), resolver a variante pelo produto e ID; SKU não é necessariamente único no catálogo inteiro.

3. **Service.** Em [CatalogService.java:647](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/catalog/CatalogService.java#L647) / [CatalogService.java:660](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/catalog/CatalogService.java#L660), preservar o filtro que exige variante do produto. Cor declarada no payload não pode contradizer a variante selecionada: validar/rejeitar conflito antes de escolher a cor final, sem deixar `firstValid(a.color(),...)` mascarar a identidade. Não usar fallback para outra cor/foto após escolher variante.

4. **Controller.** [CatalogController.java:34](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/CatalogController.java#L34) aceita `code` separado de q e color. Usar os endpoints atuais de produto/seleção/inclusão do mesmo controller, mantendo productId+variantId na requisição. Não interpretar texto de nome como SKU garantido.

5. **Frontend/projeção.** Em [catalog-search.tsx:60](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/catalog/catalog-search.tsx#L60), preservar selectedVariant e color do resultado; limpar seleção incompatível quando os filtros mudarem. Serializar IDs em [catalog.ts:28](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/lib/api/catalog.ts#L28) e mostrar produto, SKU e cor confirmados na peça criada em [expanded-piece.tsx:63](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/expanded-card/expanded-piece.tsx#L63). Loading/erro não deve deixar uma variante velha ativa sobre um produto novo.

## Arquivos novos propostos e ponto de inserção

Nenhum arquivo de produção novo é obrigatório para a solução base descrita; reutilizar os pontos de edição/revisão numerados acima. Novos testes podem ser adicionados na responsabilidade correspondente.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](sql/20-sku-cor.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SHOW CREATE TABLE catalog_products;
SHOW CREATE TABLE catalog_variants;
SHOW CREATE TABLE wardrobe_items;
-- SKU de variante e cor exigidos no MESMO registro v:
SELECT p.id AS product_id,v.id AS variant_id,v.sku,v.color
FROM catalog_products p JOIN catalog_variants v ON v.product_id=p.id
WHERE LOWER(v.sku)=LOWER(@sku) AND v.color=@color;
-- SKU não é globalmente único; limitar também por produto/marca quando necessário.
SELECT w.id,w.catalog_product_id,w.catalog_variant_id,v.sku,v.color
FROM wardrobe_items w JOIN catalog_variants v ON v.id=w.catalog_variant_id
WHERE w.id=@piece_id AND w.user_id=@owner_id;
SELECT w.id FROM wardrobe_items w JOIN catalog_variants v ON v.id=w.catalog_variant_id
WHERE w.catalog_product_id IS NULL OR w.catalog_product_id<>v.product_id;
```

## Integridade referencial: restrições e alternativas

Na política V34, produto→variantes tem CASCADE; wardrobe_items→produto tem RESTRICT; wardrobe_items→variante tem SET NULL. Assim, produto usado por peça não deve ser apagado, e apagar só a variante pode perder esse vínculo sem apagar a peça. Inativar produto/variante e preservar snapshot é alternativa. Duas FKs separadas não provam que a variante pertence ao produto: isso já é validado no service. Para reforço SQL, considerar UNIQUE(product_id,id) em catalog_variants e FK composta na peça, após limpar inconsistências; escolher RESTRICT e rever a FK simples existente. Não usar SET NULL composto sem avaliar que também apagaria catalog_product_id. Não tornar SKU globalmente UNIQUE: marcas/produtos podem reutilizar códigos e o índice UNIQUE(product_id,variant_key) tem outra semântica.

## Contrato HTTP

Existente: `GET /api/catalog/search?code=SKU-A&color=blue` (com filtros necessários de marca/categoria). Ao adicionar, enviar `productId` e `variantId` retornados pelo resultado, nunca apenas o nome da cor.

Resposta/projeção a conferir: `"productId":"...", "selectedVariant":{"id":"...","sku":"SKU-A","color":"blue"}; peça criada mantém catalogProductId/catalogVariantId`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Produto com SKU-A azul e SKU-B vermelho: SKU-A+vermelho não pode passar pelo ramo de SKU de variante. Cobrir SKU do produto (semântica separada), variante de outro produto, cor do payload conflitante, SKU repetido em outra marca, count/paginação, foto indisponível e reload da peça preservando IDs/SKU/cor.

- **E1 a produzir:** Resultado selecionado com SKU e cor da mesma variante.
- **E2 a produzir:** Peça criada e recarregada com a origem e a variante corretas.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.
