# Exercício 15 — Valor mínimo de compra do cupom

**Situação na revisão `9f5512a77`:** Parcial: FlairCombination.minPurchase existe, mas precisa validação forte e snapshot; promoções possuem outro modelo.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](../RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema/entidades.** Reutilizar `flair_combinations.min_purchase` de [FlairCombination.java:69](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/FlairCombination.java#L69); acrescentar mínimo em Promotion e snapshots de mínimo/moeda nos dois tipos de resgate. Não criar outra coluna de mínimo na combinação. A moeda de exibição do usuário não deve alterar a moeda contratada do cupom.

2. **Repositories.** Reutilizar os mesmos quatro repositories do exercício14. Gravar mínimo/moeda no resgate na mesma transação que estoque e emissão. Nenhuma consulta por comparação textual de dinheiro.

3. **DTO/service.** Em [FlairService.java:841](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/FlairService.java#L841), delegar a `CouponMinimumRules`: BigDecimal não negativo, até 2 casas e até99.999.999,99 para DECIMAL(10,2); moeda ISO4217 suportada. Acrescentar o campo no PromotionForm/SealPromotionWriter. Não aceitar silenciosamente arredondamento bancário de 3 casas. Legado sem moeda permanece não confirmado.

4. **Snapshot/leitura.** Em [FlairService.java:1055](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/FlairService.java#L1055), não continuar lendo mínimo atual da combinação para um cupom emitido: usar o snapshot. Repetir em [SealPromotionReads.java:30](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SealPromotionReads.java#L30). Cupom antigo sem snapshot deve ser identificado como condição histórica não disponível; não preencher com regra atual sem evidência.

5. **Controller.** Manter rotas de oferta dos [FlairController.java:26](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/FlairController.java#L26) e [SealPromotionController.java:28](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/SealPromotionController.java#L28); o total de uma compra não deve ser enviado pelo visitante como prova de elegibilidade. Conciliação com checkout externo é integração adicional, não comprovada por gravar o campo.

6. **Tela/detalhe.** Atualizar oferta em [brand-flair-tab.tsx:27](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/flair/brand-flair-tab.tsx#L27) e leitura da carteira; mostrar valor e moeda contratada, distinguir zero de null. Validar entrada como decimal sem calcular dinheiro com floats, preservar rascunho no400 e formatar com locale sem trocar a moeda da oferta.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-application/src/main/java/br/com/fashionai/application/service/CouponMinimumRules.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/CouponTermsSnapshotWriter.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/FlairCouponWriter.java`.

Se escolher aplicar o DDL faltante, criar na **linha 1** a migration `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V<PROXIMA_VERSAO_LIVRE>__ex15.sql`, substituindo o placeholder por versão realmente livre. O SQL didático não deve ser copiado inteiro sem inspecionar o schema.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](sql/15-minimo-compra.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SELECT id,min_purchase FROM flair_combinations WHERE min_purchase<0;
ALTER TABLE promotions ADD COLUMN min_purchase DECIMAL(10,2) NULL,
  ADD COLUMN min_purchase_currency CHAR(3) NULL;
ALTER TABLE flair_combinations ADD COLUMN min_purchase_currency CHAR(3) NULL;
ALTER TABLE promotion_redemptions ADD COLUMN min_purchase_snapshot DECIMAL(10,2) NULL,
  ADD COLUMN min_purchase_currency_snapshot CHAR(3) NULL;
ALTER TABLE flair_redemptions ADD COLUMN min_purchase_snapshot DECIMAL(10,2) NULL,
  ADD COLUMN min_purchase_currency_snapshot CHAR(3) NULL;
-- Após revisar negativos legados e conferir CHECKs existentes:
ALTER TABLE flair_combinations ADD CONSTRAINT ck_flair_min_purchase
  CHECK(min_purchase IS NULL OR min_purchase>=0);
ALTER TABLE promotions ADD CONSTRAINT ck_promotion_min_purchase
  CHECK(min_purchase IS NULL OR min_purchase>=0);
ALTER TABLE promotion_redemptions ADD CONSTRAINT ck_pr_min_snapshot
  CHECK(min_purchase_snapshot IS NULL OR min_purchase_snapshot>=0);
ALTER TABLE flair_redemptions ADD CONSTRAINT ck_fr_min_snapshot
  CHECK(min_purchase_snapshot IS NULL OR min_purchase_snapshot>=0);
-- Não preencher snapshots/moedas antigos a partir da oferta atual sem evidência histórica.
```

## Integridade referencial: restrições e alternativas

Dinheiro não é FK neste desenho: DECIMAL/CHECK reforçam faixa, e as FKs ligam o cupom à oferta/usuário. CHECK novo falha com negativos antigos; não normalizar automaticamente para0. Manter NULL e revisar é diferente de conceder compra mínima zero. A oferta não pode ser apagada indiscriminadamente se destruir resgates por CASCADE. Alternativas: inativar oferta, manter snapshots, restringir exclusão ou separar condições em versões imutáveis. Exigir moeda para novas gravações no service sem inventar moeda para registros antigos.

## Contrato HTTP

Proposto no formulário completo da oferta: `{"minPurchase":"50.00","minPurchaseCurrency":"BRL"}`. BigDecimal recebe decimal exato; retorno deve incluir moeda e, no resgate, o snapshot.

Resposta/projeção a conferir: `"minPurchaseSnapshot":"50.00", "minPurchaseCurrencySnapshot":"BRL"`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

0 e50.00 válidos; -1, 3 casas, overflow e moeda inválida rejeitados; null legado; moeda do usuário diferente não muda o cupom; oferta muda após emissão e resgate mantém50.00. Conferir ambos os fluxos de cupom e autorização do emissor.

- **E1 a produzir:** Oferta com mínimo e moeda explícitos.
- **E2 a produzir:** Detalhe do cupom resgatado e recarregado com condições da emissão.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.
