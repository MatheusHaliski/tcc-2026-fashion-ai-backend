# Exercício 10 — Área artística principal da celebridade

**Situação na revisão `9f5512a77`:** Parcial: areas_json suporta lista; o modelo não distingue área principal por FK.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](../RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema/entidade.** Criar `areas_artisticas` e `celebrity_profiles.area_artistica_principal_id NULL`, mantendo a lista de [CelebrityProfile.java:58](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/CelebrityProfile.java#L58). Não selecionar a primeira área antiga como principal sem confirmação.

2. **Repository.** Criar `AreaArtisticaRepository` para opções ativas. Reutilizar [CelebrityProfileRepository.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/CelebrityProfileRepository.java#L19) e consulta por owner; não aceitar um ownerId do formulário para trocar o alvo.

3. **Service.** Em [InstitutionalService.java:750](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/InstitutionalService.java#L750), extrair `CelebrityAreaWriter` para validar/resolver `areaArtisticaId`, clear e preservação de ID inativo inalterado. Expor `areaPrincipal` na projeção `celebrityCard`. Se exigir que a principal também pertença à lista de áreas, validar/incluir de forma explícita sem sobrescrever as demais.

4. **Controller.** Ampliar o mapa/DTO do `PATCH /api/me/celebrity-profile` em [ProfileController.java:119](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/ProfileController.java#L119); criar `GET /api/opcoes/areas-artisticas`. Área principal é dado declarado/moderado, não selo de identidade verificada.

5. **Tela/leitura.** Acrescentar seleção no editor institucional em [edit-profile.tsx:16](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/edit-profile.tsx#L16). Passar `areaPrincipal.nome` à prop category do [profile-header.tsx:18](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/profile-header.tsx#L18), preservando a lista antiga em seção própria. Tratar loading, falha/retry, nenhuma escolha e antiga referência indisponível.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-domain/src/main/java/br/com/fashionai/domain/model/AreaArtistica.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/repository/AreaArtisticaRepository.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/CelebrityAreaWriter.java`.
- `fai-web/src/main/java/br/com/fashionai/web/controller/InstitutionalReferenceController.java`.

Se escolher aplicar o DDL faltante, criar na **linha 1** a migration `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V<PROXIMA_VERSAO_LIVRE>__ex10.sql`, substituindo o placeholder por versão realmente livre. O SQL didático não deve ser copiado inteiro sem inspecionar o schema.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](sql/10-area-artistica.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
CREATE TABLE `areas_artisticas` (
  id CHAR(36) NOT NULL PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(80) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
) ENGINE=InnoDB;
INSERT INTO `areas_artisticas` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'MUSICA','Música',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `areas_artisticas` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'CINEMA','Cinema',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `areas_artisticas` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'MODA','Moda',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));

ALTER TABLE celebrity_profiles ADD COLUMN area_artistica_principal_id CHAR(36) NULL;
ALTER TABLE celebrity_profiles ADD CONSTRAINT fk_celebrity_area_principal
  FOREIGN KEY(area_artistica_principal_id) REFERENCES areas_artisticas(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
SELECT c.id,c.areas_json,a.codigo,a.nome FROM celebrity_profiles c
LEFT JOIN areas_artisticas a ON a.id=c.area_artistica_principal_id WHERE c.owner_user_id=@owner_id;
```

## Integridade referencial: restrições e alternativas

RESTRICT preserva os perfis vinculados; desativar categoria evita perda histórica. A lista JSON não adquire integridade referencial automaticamente por existir uma FK de principal. Se a lista completa precisar de FKs, usar tabela de associação celebridade×área, sem duplicar relações nem apagar areas_json antes de migrar os códigos conhecidos. SET NULL é alternativa para principal removível; CASCADE para excluir perfis não é adequado.

## Contrato HTTP

Proposto no PATCH existente: `{"areaArtisticaId":"<UUID>"}`; `GET /api/opcoes/areas-artisticas` para listar.

Resposta/projeção a conferir: `"areaPrincipal":{"id":"...","codigo":"MUSICA","nome":"Música"}`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Área válida/inexistente/inativa; perfil alheio; preservação de múltiplas áreas antigas; nenhuma principal escolhida; header público após reload. Alteração de área não concede automaticamente selo/verificação.

- **E1 a produzir:** Formulário institucional escolhendo Música como principal.
- **E2 a produzir:** Cabeçalho do perfil recarregado exibindo Música.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.
