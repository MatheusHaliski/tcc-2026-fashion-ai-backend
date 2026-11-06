# Exercício 08 — Nome do módulo de armazenamento

**Situação na revisão `9f5512a77`:** Parcial: gavetas já têm renameDrawer e drawer_labels_json; nomes genéricos de módulos precisam preservar IDs e endereços.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](../RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Modelo/SQL.** Reutilizar [RoomLayout.java:31](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/RoomLayout.java#L31) e módulos em `modules_json`. Em [RoomStorageEntry.java:27](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/RoomStorageEntry.java#L27), `address` é endereço estável como `drawer:1`, não o nome visível. Não transformar uma troca de rótulo numa mudança de PK.

2. **Repository.** Reutilizar [RoomLayoutRepository.java:15](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/RoomLayoutRepository.java#L15) e [RoomStorageEntryRepository.java:15](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/RoomStorageEntryRepository.java#L15); renomear não requer apagar ou recriar entradas de armazenamento.

3. **Service.** O caso gaveta já está em [RoomService.java:1097](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/RoomService.java#L1097). Para outros módulos, extrair `RoomModuleNamingService`: localizar o módulo pelo ID do layout do usuário, limitar label a 24 caracteres, normalizar texto e permitir limpar para nome padrão. Persistir apenas label, mantendo id/slotType/capacity. Garantir que a reconciliação de módulos por nível preserve rótulos explícitos.

4. **Outra leitura.** Em [RoomService.java:1118](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/RoomService.java#L1118), devolver o nome resolvido junto do endereço. Adaptar RoomAddress/Location para usar o rótulo do módulo sem alterar o endereço; isso evita quebrar referências no detalhe da peça.

5. **Controller.** Reutilizar o rename de gavetas em [RoomController.java:71](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/RoomController.java#L71); para módulos genéricos, adicionar `PUT /api/me/room/modules/{moduleId}/label` e reutilizar `GET /api/pieces/{pieceId}/room-location`. Não receber layout de terceiro como se fosse próprio.

6. **Tela.** Criar editor curto de rótulo no painel do quarto e consumir a localização em [expanded-piece.tsx:54](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/expanded-card/expanded-piece.tsx#L54). Mostrar loading, limite de texto, falha/retry e endereço preservado; evitar atualizar só o título local sem esperar a resposta persistida.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-application/src/main/java/br/com/fashionai/application/service/RoomModuleNamingService.java`.
- `components/room3d/module-label-field.tsx`.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](sql/08-nome-modulo.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SHOW CREATE TABLE room_layouts;
SHOW CREATE TABLE room_storage_map;
SELECT user_id,drawer_labels_json,modules_json FROM room_layouts WHERE user_id=@owner_id;
SELECT wardrobe_item_id,address FROM room_storage_map
WHERE user_id=@owner_id AND wardrobe_item_id=@piece_id;
-- Exemplo didático somente para gaveta1; a API deve realizar a validação/autorização.
UPDATE room_layouts
SET drawer_labels_json=JSON_SET(COALESCE(drawer_labels_json,JSON_OBJECT()),'$."1"','Camisas'),
    updated_at=CURRENT_TIMESTAMP(6)
WHERE user_id=@owner_id;
-- Nome genérico: alterar label do módulo localizado pelo id no service; não usar índice fixo do array JSON.
```

## Integridade referencial: restrições e alternativas

Módulos dentro do JSON não têm FK de módulo: o banco não verifica se `drawer:1` existe. RoomStorageEntry contém relações de usuário/peça, e a política V34 prevê CASCADE ao excluir peça. Renomear label não viola essas FKs; trocar o `id` do módulo pode tornar os endereços logicamente órfãos, mesmo com todas as FKs SQL válidas. Alternativas: manter IDs imutáveis; mapear endereços numa transação ao substituir módulo; ou normalizar módulos em tabela futura com FK e migração dos endereços. Não usar DELETE da peça para reorganizar o quarto.

## Contrato HTTP

Existente para gaveta: `PUT /api/me/room/drawers/1`, `{"label":"Camisas"}`. Proposto genérico: `PUT /api/me/room/modules/{moduleId}/label` com o mesmo corpo.

Resposta/projeção a conferir: `"label":"Camisas", "address":"drawer:1", "moduleId":"drawer:1"`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Nome válido, vazio volta ao padrão, excesso de24 caracteres, módulo inexistente, peça/layout alheio e atualização de nível. Comparar endereço antes/depois; contagem de peças/diário não muda.

- **E1 a produzir:** Renomear a gaveta no quarto.
- **E2 a produzir:** Detalhe da peça recarregado mostrando Camisas e endereço original.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.
