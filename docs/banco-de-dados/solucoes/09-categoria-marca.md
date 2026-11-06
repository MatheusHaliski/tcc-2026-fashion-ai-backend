# Exercício 09 — Categoria principal da marca

**Situação na revisão `9f5512a77`:** Parcial: fashion_category é texto; não há FK CategoriaMarca nesse modelo.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](../RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema/entidade.** Criar `categorias_marca` e `brand_profiles.categoria_marca_id NULL`; manter `fashion_category` legado de [BrandProfile.java:67](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/BrandProfile.java#L67). Não confundir `brand_profiles` (perfil institucional) com `brands` (marca do catálogo).

2. **Repository.** Acrescentar `CategoriaMarcaRepository` com opções ativas e resolução por ID; reutilizar [BrandProfileRepository.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/BrandProfileRepository.java#L19). A FK se liga à categoria do perfil, não ao dono do perfil.

3. **Service.** Extrair `BrandCategoryWriter` da edição em [InstitutionalService.java:724](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/InstitutionalService.java#L724). Resolver ID, preservar omitido, permitir clear explícito e manter referência inativa inalterada. A projeção `brandCard` deve devolver `categoriaPrincipal` sem converter automaticamente todo texto legado em categoria conhecida.

4. **Controller.** Manter `PATCH /api/me/brand-profile` em [ProfileController.java:113](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/ProfileController.java#L113); aceitar `categoriaMarcaId` no mapa/DTO validado e criar `GET /api/opcoes/categorias-marca`. A sessão define a marca editável.

5. **Formulário e célula da Busca.** Atualizar [edit-profile.tsx:16](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/edit-profile.tsx#L16) e o contrato de perfil retornado. Em [institutional-profile-card.tsx:36](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/institutional-profile-card.tsx#L36), preferir `categoriaPrincipal.nome`, preservando fallback legado identificado. Ajustar a projeção da busca se ela não devolver o novo objeto. Loading/erro das opções não devem apagar o texto/ID já salvo.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-domain/src/main/java/br/com/fashionai/domain/model/CategoriaMarca.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/repository/CategoriaMarcaRepository.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/BrandCategoryWriter.java`.
- `fai-web/src/main/java/br/com/fashionai/web/controller/InstitutionalReferenceController.java`.

Se escolher aplicar o DDL faltante, criar na **linha 1** a migration `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V<PROXIMA_VERSAO_LIVRE>__ex09.sql`, substituindo o placeholder por versão realmente livre. O SQL didático não deve ser copiado inteiro sem inspecionar o schema.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](sql/09-categoria-marca.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
CREATE TABLE `categorias_marca` (
  id CHAR(36) NOT NULL PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(80) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
) ENGINE=InnoDB;
INSERT INTO `categorias_marca` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'CASUAL','Casual',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `categorias_marca` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'ESPORTIVA','Esportiva',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `categorias_marca` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'LUXO','Luxo',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));

ALTER TABLE brand_profiles ADD COLUMN categoria_marca_id CHAR(36) NULL;
ALTER TABLE brand_profiles ADD CONSTRAINT fk_brand_profiles_categoria_marca
  FOREIGN KEY(categoria_marca_id) REFERENCES categorias_marca(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
SELECT b.id,b.fashion_category,c.codigo,c.nome FROM brand_profiles b
LEFT JOIN categorias_marca c ON c.id=b.categoria_marca_id WHERE b.owner_user_id=@owner_id;
```

## Integridade referencial: restrições e alternativas

Nova FK RESTRICT impede apagar categoria usada. Nome pode ser corrigido mantendo ID; código é UNIQUE e deve permanecer estável para filtros. Desativar para novas seleções é preferível a excluir. Alternativa: FK SET NULL preservando `fashion_category` como descrição histórica, se a perda do vínculo for aceita. A FK não prova que uma categoria é apropriada à marca nem autoriza um usuário editar outro perfil; isso continua no service.

## Contrato HTTP

Proposto no PATCH existente: `{"categoriaMarcaId":"<UUID>"}`; clear explícito separado. Novo GET de opções por categoria.

Resposta/projeção a conferir: `"categoriaPrincipal":{"id":"...","codigo":"CASUAL","nome":"Casual"}`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Categoria válida/inexistente/inativa; marca alheia; texto legado não mapeado; limpar; resultado da Busca recarregado com rótulo correto. Não criar perfil novo nem duplicar a marca do catálogo.

- **E1 a produzir:** Editar perfil da marca escolhendo a categoria.
- **E2 a produzir:** Busca de marcas recarregada com categoria na célula.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.
