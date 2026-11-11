# Exercício 13 — Política do selo: marca exigida

**Situação na revisão `9f5512a77`:** Parcial: a regra atual guarda brand como texto e compara similaridade; isso não é uma FK de marca.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](../RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Inventário.** O texto `brand` aparece em [SealPolicies.java:54](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SealPolicies.java#L54) e é comparado por similaridade em [SealPolicyEvaluator.java:159](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SealPolicyEvaluator.java#L159). Diferenciar catálogo (`brands`) de perfil emissor (`brand_profiles`); UUID sem tipo de origem é ambíguo.

2. **Contrato.** Acrescentar uma referência tipada `brandReference:{kind:CATALOG|PROFILE,id,nome}` às novas regras. Preservar `brand` textual nas políticas antigas, sem resolver automaticamente por fuzzy match para um ID possivelmente errado. `nome` é snapshot de exibição; não é autorização.

3. **Repositories.** Reutilizar [BrandRepository.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/BrandRepository.java#L19) e [BrandProfileRepository.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/BrandProfileRepository.java#L19) para resolver conforme kind. Se adotar a alternativa relacional do SQL, criar `SealPolicyBrandRequirement`/repository com sealId+ruleIndex e exatamente uma das duas FKs de marca.

4. **Service.** Extrair `SealPolicyBrandResolver`; integrar resolução no writer antes de [SealFormWriter.java:125](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SealFormWriter.java#L125). Atualizar normalização/parser/Rule e o avaliador para comparar IDs de `WardrobeItem.brand` ou `brandProfile`; não misturar IDs com o nome salvo na peça. Escrita da versão e das referências normalizadas deve ser transacional, com diff/remoção das linhas antigas da mesma regra.

5. **Controller.** Criar GET de opções tipadas `GET /api/opcoes/marcas-politica?kind=CATALOG&q=...` e manter a edição de selo no [SealController.java:27](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/SealController.java#L27). Nome/ID inexistente ou kind incompatível deve voltar 400; editar política exige dono/emissor.

6. **UI/detalhe.** Em [seal-policy-editor.tsx:115](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/seal-policy-editor.tsx#L115), usar busca/autocomplete que guarda kind+ID, com loading/retry; texto sem seleção não satisfaz uma nova referência. No detalhe do selo mostrar o nome resolvido/snapshot, sem tratar um nome digitado como marca verificada.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-application/src/main/java/br/com/fashionai/application/service/SealPolicyBrandReference.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/SealPolicyBrandResolver.java`.
- `fai-web/src/main/java/br/com/fashionai/web/controller/SealPolicyReferenceController.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/model/SealPolicyBrandRequirement.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/repository/SealPolicyBrandRequirementRepository.java`.

Se escolher aplicar o DDL faltante, criar na **linha 1** a migration `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V<PROXIMA_VERSAO_LIVRE>__ex13.sql`, substituindo o placeholder por versão realmente livre. O SQL didático não deve ser copiado inteiro sem inspecionar o schema.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](sql/13-marca-politica.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
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
```

## Integridade referencial: restrições e alternativas

Uma referência tipada em JSON continua sem FK no banco; só o service garante existência. A tabela alternativa reforça duas FKs e XOR: não pode apagar marca usada, nem apontar para marca inexistente, nem preencher ambos os tipos. Apagar o selo remove seus requisitos (CASCADE), não as marcas. Alternativas à exclusão de marca: inativar, manter alias ou criar nova versão da política e migrar regras explicitamente. Se permanecer apenas em JSON, implementar detecção de órfãos e não apresentar isso como integridade referencial SQL. Registros textuais legados permanecem identificados como texto.

## Contrato HTTP

Proposto: `{"policy":{"rules":[{"quantifier":"AT_LEAST","count":1,"brandReference":{"kind":"CATALOG","id":"<UUID>","nome":"Marca escolhida"}}]}}`.

Resposta/projeção a conferir: `"brandReference":{"kind":"CATALOG","id":"...","nome":"Marca escolhida"}`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

ID correto/incorreto; kind incorreto; duas marcas de nomes semelhantes; peça com brandName igual mas ID diferente; legado textual; mudança de nome com ID estável; marca vinculada não pode ser apagada se usar a tabela alternativa. Conferir sincronização da revisão JSON e das linhas relacionais.

- **E1 a produzir:** Selecionar uma marca real na política.
- **E2 a produzir:** Detalhe do selo recarregado mostrando a referência correta.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.
