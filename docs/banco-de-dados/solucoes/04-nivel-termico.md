# Exercício 04 — Intensidade térmica do look

**Situação na revisão `9f5512a77`:** Proposta: não foi localizada entidade NivelTermico; estação não substitui intensidade térmica.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](../RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Migration.** Criar lookup `niveis_termicos` e `schemes.nivel_termico_id NULL` conforme SQL. Reservar uma versão livre, sem editar V60. NULL representa não informado; não inferir intensidade pela estação do look.

2. **Entidade.** **NOVO** `fai-domain/src/main/java/br/com/fashionai/domain/model/NivelTermico.java`, iniciar na linha 1 (arquivo proposto, ainda não criado). Herdar `AuditableEntity`, mapear código/nome/ativo. Em [Scheme.java:75](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/Scheme.java#L75), acrescentar relação LAZY com `@JoinColumn(name="nivel_termico_id")`, preferencialmente extraindo o bloco de metadados opcionais se necessário para respeitar a catraca de linhas.

3. **Repository.** **NOVO** `fai-domain/src/main/java/br/com/fashionai/domain/repository/NivelTermicoRepository.java`, iniciar na linha 1 (arquivo proposto, ainda não criado). Usar `JpaRepository<NivelTermico,UUID>`, `findAllByAtivoTrueOrderByNomeAsc` e `findById`; não criar um repository separado para a própria tabela de schemes.

4. **DTO/service.** Em [SchemeService.java:417](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SchemeService.java#L417), acrescentar ID e clear explícito. Extrair `SchemeThermalWriter` e chamá-lo em [SchemeService.java:503](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SchemeService.java#L503), com rejeição de nova opção inativa e preservação da anterior. Nas recomendações de [MirrorService.java:83](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/MirrorService.java#L83), receber critério térmico opcional e usar o código validado como evidência/compatibilidade; não confundir frio ambiental com certificado de tecido.

5. **Controller.** Criar `LookReferenceController` com `GET /api/opcoes/niveis-termicos`; aproveitar criar/editar em [SchemeController.java:29](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/SchemeController.java#L29). Se a recomendação usar esse filtro, acrescentar o ID ao DTO correspondente do [MirrorController.java:17](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/MirrorController.java#L17) e resolver no service.

6. **UI/leitura.** Acrescentar seleção no builder em [scheme-builder.tsx:71](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/scheme-builder.tsx#L71), tipo de leitura em [types.ts:50](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/lib/api/types.ts#L50) junto do SchemeView e projeção em [Views.java:223](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/view/Views.java#L223). Mostrar a intensidade nas recomendações do espelho em [mirror-controls.tsx:143](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/mirror/mirror-controls.tsx#L143). Loading/retry e opção 'Não informado' devem ser distintos de uma intensidade real.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-domain/src/main/java/br/com/fashionai/domain/model/NivelTermico.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/repository/NivelTermicoRepository.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/SchemeThermalWriter.java`.
- `fai-web/src/main/java/br/com/fashionai/web/controller/LookReferenceController.java`.

Se escolher aplicar o DDL faltante, criar na **linha 1** a migration `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V<PROXIMA_VERSAO_LIVRE>__ex04.sql`, substituindo o placeholder por versão realmente livre. O SQL didático não deve ser copiado inteiro sem inspecionar o schema.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](sql/04-nivel-termico.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
CREATE TABLE `niveis_termicos` (
  id CHAR(36) NOT NULL PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(80) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
) ENGINE=InnoDB;
INSERT INTO `niveis_termicos` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'LEVE','Leve',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `niveis_termicos` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'MODERADO','Moderado',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `niveis_termicos` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'INTENSO','Intenso',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));

ALTER TABLE schemes ADD COLUMN nivel_termico_id CHAR(36) NULL;
ALTER TABLE schemes ADD CONSTRAINT fk_schemes_nivel_termico
  FOREIGN KEY (nivel_termico_id) REFERENCES niveis_termicos(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
SELECT s.id,n.codigo,n.nome FROM schemes s
LEFT JOIN niveis_termicos n ON n.id=s.nivel_termico_id WHERE s.id=@scheme_id;
```

## Integridade referencial: restrições e alternativas

FK proposta RESTRICT para evitar perder o significado dos looks. Não apagar opção usada; desativar para novas seleções ou migrar cada vínculo com decisão registrada. SET NULL seria uma alternativa somente se a perda da classificação for aceita e o campo continuar nullable. Não usar CASCADE que excluiria looks ao retirar um nível. A FK garante existência, mas atividade e propriedade do look são regras do service.

## Contrato HTTP

Novo `GET /api/opcoes/niveis-termicos`; recorte do POST/PUT de look `{"nivelTermicoId":"<UUID>","clearNivelTermico":false}`.

Resposta/projeção a conferir: `"nivelTermico": {"id":"...","codigo":"MODERADO","nome":"Moderado"}`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

ID válido/inválido/inativo, omissão versus clear, dono errado, recomendações com e sem filtro e look legado NULL. No laboratório, DELETE do nível referenciado falha; desativar não quebra a leitura antiga.

- **E1 a produzir:** Builder com intensidade explicitamente escolhida.
- **E2 a produzir:** Espelho recarregado mostrando a intensidade da recomendação.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.
