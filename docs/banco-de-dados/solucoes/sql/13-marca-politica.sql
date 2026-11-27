-- MATERIAL DIDÁTICO: NÃO EXECUTADO. Não é migration pronta para produção.
-- Leia ../13-marca-politica.md e 00-inspecao-integridade.sql antes de adaptar.
-- DDL apenas em MySQL 8 de teste; verificar objetos/constraints e versão Flyway livre.
-- @owner_id, @piece_id etc. são parâmetros a preencher no laboratório, não autorização.

SELECT id,JSON_EXTRACT(background_config_json,'$.policy.rules') AS rules FROM seals WHERE id=@seal_id;
-- ALTERNATIVA RELACIONAL, somente se for escolhida como fonte validada da referência:
CREATE TABLE seal_policy_brand_requirements (
  seal_id CHAR(36) NOT NULL,rule_index INT NOT NULL,
  brand_id CHAR(36) NULL,brand_profile_id CHAR(36) NULL,
  PRIMARY KEY(seal_id,rule_index),
  CONSTRAINT fk_spbr_seal FOREIGN KEY(seal_id) REFERENCES seals(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_spbr_brand FOREIGN KEY(brand_id) REFERENCES brands(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_spbr_profile FOREIGN KEY(brand_profile_id) REFERENCES brand_profiles(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_spbr_target CHECK((brand_id IS NOT NULL AND brand_profile_id IS NULL)
                             OR (brand_id IS NULL AND brand_profile_id IS NOT NULL)),
  CONSTRAINT ck_spbr_index CHECK(rule_index>=0)
) ENGINE=InnoDB;
