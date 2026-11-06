# Exercício 05 — Origem adquirida, herdada ou trocada

**Situação na revisão `9f5512a77`:** A coluna piece_origin existe e é lida pelo quarto; falta uma escolha estruturada no formulário comum.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](../RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Inventário SQL.** Ler valores reais antes de restringir o domínio; `GARIMPADA` é consumida por regras existentes e `TROCADA` é escrita pelo passaporte. Reutilizar [WardrobeItem.java:321](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/WardrobeItem.java#L321) sem criar outra coluna `origem`.

2. **Enum/DTO.** Criar `PieceOrigin` com os códigos novos e os legados efetivamente usados; não remover códigos históricos. Em [WardrobeService.java:337](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/WardrobeService.java#L337), acrescentar origem opcional; DTO sem campo mantém a anterior. Origem de captura da imagem (`ImageOrigin`) continua separada da aquisição da peça.

3. **Repository.** Reutilizar [WardrobeItemRepository.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/WardrobeItemRepository.java#L19); filtros novos devem receber um código normalizado. Não há FK de opções nesta solução: enum/string validado satisfaz 'opções e origem validada'.

4. **Service.** Extrair `PieceOriginWriter` e delegar em [PieceFormWriter.java:28](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/PieceFormWriter.java#L28). Validar ADQUIRIDA/HERDADA/TROCADA e códigos legados permitidos; desconhecido salvo pode ser preservado sem habilitá-lo como escolha nova. Preservar o fluxo de [ReceivedPassportPiece.java:31](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/passport/ReceivedPassportPiece.java#L31) para transferências reais; seleção manual de TROCADA é declaração, não prova de transferência.

5. **Controller/opções.** Em [PieceReferenceController.java:15](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/PieceReferenceController.java#L15), acrescentar GET de origens (ou controller específico curto). Escrita pelo [WardrobeController.java:99](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/WardrobeController.java#L99); `GET /api/opcoes/origens-peca` deve retornar código/nome, sem IDs se o contrato for enum.

6. **Tela e outra leitura.** Acrescentar escolha e serialização em [piece-form.tsx:14](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/piece-form.tsx#L14). Em [RoomService.java:757](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/RoomService.java#L757), manter a projeção para histórico/tag, e acrescentar ao DTO de detalhe se faltar. Mostrar origem declarada junto ao histórico de uso, com loading/erro e estado não informado.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-domain/src/main/java/br/com/fashionai/domain/model/enums/PieceOrigin.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/PieceOriginWriter.java`.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](sql/05-origem-peca.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SELECT piece_origin,COUNT(*) AS quantidade FROM wardrobe_items GROUP BY piece_origin;
SELECT id,user_id,piece_origin FROM wardrobe_items
WHERE id=@piece_id AND user_id=@owner_id;
-- DML didático para banco de teste; a aplicação deve usar o service autorizado.
UPDATE wardrobe_items SET piece_origin='HERDADA',updated_at=CURRENT_TIMESTAMP(6)
WHERE id=@piece_id AND user_id=@owner_id;
-- Não adicionar CHECK de três valores antes de tratar GARIMPADA e todos os legados encontrados.
```

## Integridade referencial: restrições e alternativas

Não foi localizada FK para `piece_origin`: VARCHAR não equivale a integridade referencial. Restrições de proprietário continuam nas relações da peça com users, looks, passaporte e diário. Não excluir/recriar a peça para trocar a origem: há relações com ON DELETE CASCADE que apagariam diário/armazenamento. Alternativa relacional: tabela `OrigensPeca` e FK nullable nova, com migração explícita dos códigos reconhecidos; manter desconhecidos para revisão, sem inventar origem.

## Contrato HTTP

Proposto no PUT existente `{"pieceOrigin":"HERDADA"}`; GET de opções retorna códigos. O histórico mostra a origem declarada separada do histórico verificável do passaporte.

Resposta/projeção a conferir: `"pieceOrigin":"HERDADA"; no histórico/tag existente: "origin":"HERDADA"`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Três escolhas válidas, código inválido, peça alheia, origem omitida em edição antiga, GARIMPADA preservada, TROCADA gerada por transferência mantida. Mudar origem não zera wear_count, diário, selos ou dono.

- **E1 a produzir:** Editar peça selecionando Herdada.
- **E2 a produzir:** Histórico de uso recarregado com origem e eventos anteriores intactos.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.
