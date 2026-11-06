# Exercício 03 — Instrução de lavagem

**Situação na revisão `9f5512a77`:** Tabela, FK, repository, API de opções e leitura existem; escrita estruturada ainda precisa ser integrada.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](../RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema/modelo.** Reutilizar [V77__wardrobe_conservation_and_wash_references.sql:13](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V77__wardrobe_conservation_and_wash_references.sql#L13) e [WardrobeItem.java:172](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/WardrobeItem.java#L172). A coluna é `tipo_lavagem_id`, não o texto `care_instructions`.

2. **DTO.** Em [WardrobeService.java:337](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/WardrobeService.java#L337), acrescentar `UUID tipoLavagemId` e `Boolean clearTipoLavagem`. Atualizar todos os construtores auxiliares e os pontos `new PieceForm(...)`, inclusive `PieceTaxonomyWriter`, preservando campos omitidos em clientes antigos. `Views` já devolve a referência em [Views.java:118](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/view/Views.java#L118).

3. **Repository/service específico.** Reutilizar [TipoLavagemRepository.java:9](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/TipoLavagemRepository.java#L9); criar `PieceWashService` que resolve `findById`, aplica o ID ou clear e não converte texto livre em opção. Inserção sugerida: **NOVO** `fai-application/src/main/java/br/com/fashionai/application/service/PieceWashService.java`, iniciar na linha 1 (arquivo proposto, ainda não criado). O service não deve validar dono a partir de um ID anterior enviado pelo cliente.

4. **Service orquestrador.** Em [PieceFormWriter.java:77](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/PieceFormWriter.java#L77), delegar também a lavagem depois da autorização existente; manter `careInstructions` independente. Em [PieceTaxonomyWriter.java:89](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/PieceTaxonomyWriter.java#L89), transportar os novos campos nas reconstruções do formulário.

5. **Controller.** Usar `GET /api/tipos-lavagem` em [PieceReferenceController.java:31](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/PieceReferenceController.java#L31) e edição existente em [WardrobeController.java:99](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/WardrobeController.java#L99). Não conceder CRUD das opções ao usuário comum.

6. **Tela/leitura.** Acrescentar os campos de estado e payload em [piece-form.tsx:14](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/piece-form.tsx#L14); extrair um `PieceWashField` com GET de opções. Inicializar o ID ao editar em [expanded-piece.tsx:107](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/expanded-card/expanded-piece.tsx#L107); mostrar `tipoLavagem.nome` no detalhe e manter o texto complementar. Tratar loading, erro/retry e opção salva ausente sem limpá-la.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-application/src/main/java/br/com/fashionai/application/service/PieceWashService.java`.
- `components/piece-wash-field.tsx`.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](sql/03-lavagem.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SHOW CREATE TABLE `TipoLavagem`;
SELECT id,codigo,nome FROM `TipoLavagem` ORDER BY nome;
SELECT w.id,w.tipo_lavagem_id,t.codigo,t.nome,w.care_instructions
FROM wardrobe_items w LEFT JOIN `TipoLavagem` t ON t.id=w.tipo_lavagem_id
WHERE w.id=@piece_id AND w.user_id=@owner_id;
-- Não é necessária outra coluna nem outra FK para concluir a escrita. A V77 já as prevê.
```

## Integridade referencial: restrições e alternativas

ON DELETE SET NULL / ON UPDATE CASCADE na V77: exclusão perde a classificação da lavagem. `TipoLavagem` não tem `ativo` no modelo atual; para retirada segura de novas seleções, criar uma migration aditiva com `ativo`, filtrar a API e preservar referências inalteradas, como conservação. Alternativas: manter a opção antiga e acrescentar uma nova; ou separar instruções históricas por snapshot. Não substituir todos os `care_instructions` por IDs inferidos nem renomear a tabela em ambiente case-sensitive.

## Contrato HTTP

Proposto no PUT existente: `{"tipoLavagemId":"<UUID>","clearTipoLavagem":false}`. ID omitido preserva; clear true remove a escolha. Opções existentes em `GET /api/tipos-lavagem`.

Resposta/projeção a conferir: `"tipoLavagem": {"id":"...","codigo":"<código cadastrado>","nome":"<nome cadastrado>"}`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Escolha válida; UUID inexistente; clear; clientes antigos sem campo; peça de terceiro; conservação e texto livre preservados. Se adicionar ativo, testar nova escolha inativa rejeitada e ID salvo inalterado aceito. Testar ambos os construtores antigos do DTO e serialização.

- **E1 a produzir:** Formulário de peça com opção de lavagem carregada da API.
- **E2 a produzir:** Detalhe recarregado mostrando a opção e cuidados complementares.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.
