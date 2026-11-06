# Exercício 18 — Peça Assinatura do perfil e histórico

**Situação na revisão `9f5512a77`:** Proposta: não foi localizada relação de Peça Assinatura pessoal; não confundir com assinatura de marca/estilo.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](../RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema.** Criar escolha atual e histórico, sem reutilizar `KbBrandSignature` ou o JSON de estilo de celebridade. [WardrobeItem.java:56](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/WardrobeItem.java#L56) é a peça física/digital do guarda-roupa; seu dono precisa coincidir com o perfil.

2. **Entidades.** Criar `UserSignaturePiece` com usuário e peça atual e `SignaturePieceHistory` com usuário, peça nullable, snapshot público mínimo e changedAt. Snapshot não deve copiar notas, localização de compra ou fotos privadas para um perfil público.

3. **Repositories.** Reutilizar [WardrobeItemRepository.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/WardrobeItemRepository.java#L19) para carregar peça e conferir dono. Criar repository da escolha com lock por usuário/expectedVersion e repository do histórico paginado. Se a escolha ainda não existe, serializar pelo lock do usuário ou tratar concorrência de insert único.

4. **Service.** Criar `SignaturePieceService` transacional: autorizar usuário, carregar peça própria não arquivada, substituir escolha e registrar somente uma mudança efetiva. A chave composta do SQL reforça o vínculo com o dono; ainda validar visibilidade ao projetar em [ProfileService.java:104](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/ProfileService.java#L104). Leitura pública não deve vazar peça privada.

5. **Controller.** Novo `PUT /api/me/signature-piece` e `DELETE` para limpar; GET contextual do perfil/histórico por service de visibilidade, integrado ao [ProfileController.java:16](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/ProfileController.java#L16). Não permitir visitante selecionar peça para outro usuário.

6. **UI e álbum.** Criar `SignaturePiecePicker` na edição de perfil em [edit-profile.tsx:16](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/edit-profile.tsx#L16); lista apenas peças próprias elegíveis. No [public-profile-card.tsx:12](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/public-profile-card.tsx#L12)/perfil mostrar seleção autorizada. Criar aba de histórico no álbum com paginação, estado vazio e erro/retry; escolha privada pode aparecer só ao dono ou pedir publicação deliberada.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-domain/src/main/java/br/com/fashionai/domain/model/UserSignaturePiece.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/model/SignaturePieceHistory.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/repository/UserSignaturePieceRepository.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/repository/SignaturePieceHistoryRepository.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/SignaturePieceService.java`.
- `fai-web/src/main/java/br/com/fashionai/web/controller/SignaturePieceController.java`.
- `components/signature-piece-picker.tsx`.
- `components/signature-piece-history.tsx`.

Se escolher aplicar o DDL faltante, criar na **linha 1** a migration `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V<PROXIMA_VERSAO_LIVRE>__ex18.sql`, substituindo o placeholder por versão realmente livre. O SQL didático não deve ser copiado inteiro sem inspecionar o schema.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](sql/18-peca-assinatura.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
-- Índice redundante ao PK global, mas necessário como chave referenciada na ordem owner+piece.
-- Conferir se já existe índice UNIQUE equivalente antes de adicionar.
ALTER TABLE wardrobe_items ADD CONSTRAINT uq_wardrobe_owner_piece UNIQUE(user_id,id);
CREATE TABLE user_signature_pieces (
  user_id CHAR(36) NOT NULL PRIMARY KEY,piece_id CHAR(36) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,updated_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_usp_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_usp_owned_piece FOREIGN KEY(user_id,piece_id)
    REFERENCES wardrobe_items(user_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE signature_piece_history (
  id CHAR(36) NOT NULL PRIMARY KEY,user_id CHAR(36) NOT NULL,piece_id CHAR(36) NULL,
  snapshot_json JSON NULL,changed_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_sph_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_sph_piece FOREIGN KEY(piece_id) REFERENCES wardrobe_items(id) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB;
SELECT u.user_id,u.piece_id,w.name FROM user_signature_pieces u
JOIN wardrobe_items w ON w.id=u.piece_id AND w.user_id=u.user_id WHERE u.user_id=@owner_id;
```

## Integridade referencial: restrições e alternativas

A FK composta impede selecionar peça de outro dono também no SQL. Enquanto a peça for assinatura atual, exclusão/transferência do dono da peça é RESTRICT; limpar/substituir a escolha antes da transferência na mesma operação autorizada, ou bloquear a transferência com mensagem clara. O histórico usa SET NULL simples e mantém snapshot: evita o erro de tentar SET NULL numa FK composta cujo user_id é NOT NULL. O histórico não garante propriedade sozinho; o service autoriza ao gravar. Na exclusão da conta, remover escolha atual antes de peças; não depender de uma ordem de cascatas que possa encontrar o RESTRICT. Alternativa mais simples: FK simples+checagem de dono no service, assumindo explicitamente a ausência de reforço SQL da propriedade.

## Contrato HTTP

Novo `PUT /api/me/signature-piece` com `{"pieceId":"<UUID próprio>","expectedVersion":0}`; DELETE remove a escolha atual sem apagar o histórico. A leitura pública respeita a visibilidade da peça.

Resposta/projeção a conferir: `"signaturePiece":{"id":"...","name":"..."}, "history":[{"pieceId":"...","changedAt":"..."}]`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Peça própria válida, alheia, arquivada e privada; troca idempotente; concorrência; exclusão da peça/conta; transferência; histórico com pieceId null. Perfil público não recebe notas/fotos privadas. SQL tentando selecionar peça de terceiro deve falhar pela FK composta.

- **E1 a produzir:** Perfil escolhendo peça própria com confirmação de visibilidade.
- **E2 a produzir:** Perfil e álbum recarregados com escolha e histórico autorizados.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.
