# Exercício 14 — Canal de utilização do cupom

**Situação na revisão `9f5512a77`:** Proposta: há cupons de promoções e de FLAIR; canal precisa cobrir os dois fluxos sem tratar CouponRight como cupom emitido.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](../RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Modelo/schema.** Criar CanalCupom e FKs em `promotions`, `flair_combinations` e seus resgates. Usar [Promotion.java:27](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/Promotion.java#L27), [FlairCombination.java:24](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/FlairCombination.java#L24), [PromotionRedemption.java:28](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/PromotionRedemption.java#L28) e [FlairRedemption.java:24](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/FlairRedemption.java#L24). Os resgates guardam canal/snapshot de quando foram emitidos; `CouponRight` é direito, não tabela genérica de todos os cupons.

2. **Repositories.** Criar `CanalCupomRepository` com opções ativas e findById. Reutilizar [PromotionRepository.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/PromotionRepository.java#L19) / PromotionRedemptionRepository e [FlairCombinationRepository.java:14](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/FlairCombinationRepository.java#L14) / FlairRedemptionRepository. Não inventar `CouponRepository` para dados que já possuem origem definida.

3. **Services.** Acrescentar `canalCupomId` aos formulários em [SealService.java:407](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SealService.java#L407) e [FlairService.java:801](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/FlairService.java#L801). Extrair um resolver de canal e escritores de resgate; copiar FK+código no momento da emissão em [SealPromotionWriter.java:156](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SealPromotionWriter.java#L156) e [FlairService.java:1010](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/FlairService.java#L1010). Alterar o canal de uma oferta não muda cupons emitidos.

4. **Controllers.** Criar `GET /api/opcoes/canais-cupom`. Manter ofertas de promoções em [SealPromotionController.java:43](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/SealPromotionController.java#L43) e FLAIR em [FlairController.java:165](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/FlairController.java#L165). Validação do resgate exige dono do cupom e contexto autorizado da marca; um cliente declarar canal não comprova uma compra externa.

5. **UI e carteira.** Acrescentar seleção na oferta institucional/ [brand-flair-tab.tsx:27](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/flair/brand-flair-tab.tsx#L27) e devolver o snapshot em SealPromotionReads/FlairService.redemptionView para a carteira. Mostrar LOJA_FISICA/ECOMMERCE/AMBOS traduzidos; legado sem canal fica 'não informado', não inferido de storeUrl. Loading/erro das opções não elimina dados da oferta.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-domain/src/main/java/br/com/fashionai/domain/model/CanalCupom.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/repository/CanalCupomRepository.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/CouponChannelResolver.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/CouponChannelSnapshotWriter.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/FlairCouponWriter.java`.
- `fai-web/src/main/java/br/com/fashionai/web/controller/CouponReferenceController.java`.

Se escolher aplicar o DDL faltante, criar na **linha 1** a migration `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V<PROXIMA_VERSAO_LIVRE>__ex14.sql`, substituindo o placeholder por versão realmente livre. O SQL didático não deve ser copiado inteiro sem inspecionar o schema.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](sql/14-canal-cupom.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
CREATE TABLE `canais_cupom` (
  id CHAR(36) NOT NULL PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(80) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
) ENGINE=InnoDB;
INSERT INTO `canais_cupom` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'LOJA_FISICA','Loja física',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `canais_cupom` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'ECOMMERCE','E-commerce',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `canais_cupom` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'AMBOS','Ambos',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));

ALTER TABLE promotions ADD COLUMN canal_cupom_id CHAR(36) NULL;
ALTER TABLE promotions ADD CONSTRAINT fk_promotions_canal_cupom
  FOREIGN KEY(canal_cupom_id) REFERENCES canais_cupom(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE flair_combinations ADD COLUMN canal_cupom_id CHAR(36) NULL;
ALTER TABLE flair_combinations ADD CONSTRAINT fk_flair_combinations_canal_cupom
  FOREIGN KEY(canal_cupom_id) REFERENCES canais_cupom(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE promotion_redemptions ADD COLUMN canal_cupom_id CHAR(36) NULL;
ALTER TABLE promotion_redemptions ADD CONSTRAINT fk_promotion_redemptions_canal_cupom
  FOREIGN KEY(canal_cupom_id) REFERENCES canais_cupom(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE flair_redemptions ADD COLUMN canal_cupom_id CHAR(36) NULL;
ALTER TABLE flair_redemptions ADD CONSTRAINT fk_flair_redemptions_canal_cupom
  FOREIGN KEY(canal_cupom_id) REFERENCES canais_cupom(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE promotion_redemptions ADD COLUMN canal_codigo_snapshot VARCHAR(40) NULL;
ALTER TABLE flair_redemptions ADD COLUMN canal_codigo_snapshot VARCHAR(40) NULL;
-- Sem backfill por URL da loja: ela não prova canal do cupom emitido anteriormente.
```

## Integridade referencial: restrições e alternativas

FKs propostas RESTRICT preservam os cupons já emitidos: não apagar canal referenciado, mas inativar para novas ofertas. O snapshot impede mudança retroativa quando a oferta troca de canal. A política V34 prevê CASCADE entre flair_combinations e flair_redemptions; isso pode apagar a carteira ao excluir a combinação. Preferir `active=false` e, se o histórico tiver de sobreviver a exclusões, uma migration separada que preserve/restrinja essa relação, após inspecionar todas as FKs existentes. Evitar conversão automática entre os dois domínios de cupom.

## Contrato HTTP

Novos campos nos POST/PUT existentes de oferta: `{"canalCupomId":"<UUID>"}`. Leitura: carteira de promoções e `GET /api/flair/vouchers`, por sua origem real.

Resposta/projeção a conferir: `"canalCupom":{"id":"...","codigo":"ECOMMERCE","nome":"E-commerce"}, "canalCodigoSnapshot":"ECOMMERCE"`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Cada canal; UUID inexistente/inativo; emissor alheio; cupom de outro usuário; oferta muda mas resgate conserva snapshot; legado NULL; inativação preserva carteira. Testar ambos os emissores (promoções e FLAIR), sem duplicar emissão em reenvio/concorrência.

- **E1 a produzir:** Emissor cria oferta com canal da API.
- **E2 a produzir:** Carteira recarregada mostrando o canal do cupom emitido.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.
