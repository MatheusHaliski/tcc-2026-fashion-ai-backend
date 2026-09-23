# Diagramas de Casos de Uso — Interações de Rede Social

Este documento descreve os casos de uso para as funcionalidades de interação social do SAI, cobrindo quatro categorias:

1. **Seguir / Deseguir Usuário**
2. **Curtir, Comentar, Salvar e Compartilhar Esquema de Vestimenta**
3. **Curtir, Comentar, Salvar e Compartilhar Peça de Roupa**

> **Relação Esquema ↔ Peça:** Uma peça de roupa é sempre um elemento do array `lista de peças de roupa` de um `Scheme`. As interações sociais disponíveis para a peça são idênticas às do esquema pai (curtir, comentar, salvar e compartilhar); a diferença está no ponto de acesso — a peça é alcançada a partir do card do esquema ao qual pertence.

---

## Atores

| Ator | Descrição |
|------|-----------|
| **Usuário Autenticado** | Usuário logado que executa as ações sociais |
| **Autor do Conteúdo** | Dono do esquema, da peça ou do perfil-alvo da interação |
| **Sistema de Notificação** | Serviço interno que dispara alertas ao autor quando há nova interação |

---

## 1) Seguir / Deseguir Usuário

Atores:
- **Usuário Autenticado**: inicia o seguimento ou cancela.
- **Autor do Perfil**: destinatário da ação de seguimento.
- **Sistema de Notificação**: envia alerta de novo seguidor.

```plantuml
@startuml
left to right direction
skinparam packageStyle rectangle
skinparam actorStyle awesome

actor "Usuário Autenticado" as User
actor "Autor do Perfil" as ProfileOwner
actor "Sistema de\nNotificação" as NotifSystem

rectangle "SAI Platform — Rede Social: Seguimento" {
  usecase "Visualizar Perfil\ndo Usuário" as UC_ViewProfile
  usecase "Seguir Usuário" as UC_Follow
  usecase "Deseguir Usuário" as UC_Unfollow
  usecase "Verificar Status\nde Seguimento" as UC_CheckStatus
  usecase "Atualizar Contadores\n(followers / following)" as UC_UpdateCounters
  usecase "Enviar Notificação\nde Novo Seguidor" as UC_Notify
  usecase "Listar Seguidores\ne Seguindo" as UC_ListFollows
}

User --> UC_ViewProfile
User --> UC_Follow
User --> UC_Unfollow
User --> UC_ListFollows

UC_Follow  .> UC_CheckStatus     : <<include>>
UC_Follow  .> UC_UpdateCounters  : <<include>>
UC_Follow  .> UC_Notify          : <<include>>
UC_Unfollow .> UC_CheckStatus    : <<include>>
UC_Unfollow .> UC_UpdateCounters : <<include>>

NotifSystem  --> UC_Notify
ProfileOwner --> UC_ViewProfile
ProfileOwner --> UC_ListFollows
@enduml
```

---

## 2) Interações com Esquema de Vestimenta

Aplica-se a qualquer `Scheme` com visibilidade `public`.

Atores:
- **Usuário Autenticado**: realiza curtida, comentário, salvamento ou compartilhamento.
- **Autor do Esquema**: pode remover comentários no próprio conteúdo.
- **Sistema de Notificação**: notifica o autor a cada interação relevante.

```plantuml
@startuml
left to right direction
skinparam packageStyle rectangle
skinparam actorStyle awesome

actor "Usuário Autenticado" as User
actor "Autor do Esquema" as Author
actor "Sistema de\nNotificação" as NotifSystem

rectangle "SAI Platform — Interações com Esquema de Vestimenta" {
  usecase "Visualizar Esquema\nde Vestimenta" as UC_View
  usecase "Curtir Esquema" as UC_Like
  usecase "Descurtir Esquema" as UC_Unlike
  usecase "Comentar em Esquema" as UC_Comment
  usecase "Remover Comentário\ndo Esquema" as UC_DeleteComment
  usecase "Salvar Esquema\nnos Favoritos" as UC_Save
  usecase "Remover Esquema\ndos Favoritos" as UC_Unsave
  usecase "Compartilhar Esquema" as UC_Share
  usecase "Compartilhar no\nFeed Interno" as UC_ShareInternal
  usecase "Exportar para\nPlataforma Externa" as UC_Export
  usecase "Verificar Autenticação\ne Permissão" as UC_Auth
  usecase "Enviar Notificação\nao Autor" as UC_Notify
}

User --> UC_View
User --> UC_Like
User --> UC_Unlike
User --> UC_Comment
User --> UC_DeleteComment
User --> UC_Save
User --> UC_Unsave
User --> UC_Share

UC_Like          .> UC_Auth    : <<include>>
UC_Like          .> UC_Notify  : <<include>>
UC_Unlike        .> UC_Auth    : <<include>>
UC_Comment       .> UC_Auth    : <<include>>
UC_Comment       .> UC_Notify  : <<include>>
UC_DeleteComment .> UC_Auth    : <<include>>
UC_Save          .> UC_Auth    : <<include>>
UC_Unsave        .> UC_Auth    : <<include>>
UC_Share         .> UC_ShareInternal : <<extend>>
UC_Share         .> UC_Export        : <<extend>>

NotifSystem --> UC_Notify
Author      --> UC_View
Author      --> UC_DeleteComment
@enduml
```

---

## 3) Interações com Peça de Roupa

> **Contexto de acesso:** a peça de roupa (`WardrobeItem`) é sempre um elemento do array `lista de peças de roupa` de um `Scheme`. O usuário acessa a peça a partir do card do esquema ao qual ela pertence, via `UC_AcessarPecaViaEsquema`. A partir desse ponto, as funcionalidades de interação são idênticas às do esquema pai.

Atores:
- **Usuário Autenticado**: realiza curtida, comentário, salvamento ou compartilhamento na peça.
- **Autor da Peça**: pode remover comentários na própria peça.
- **Sistema de Notificação**: notifica o autor a cada interação relevante.

```plantuml
@startuml
left to right direction
skinparam packageStyle rectangle
skinparam actorStyle awesome

actor "Usuário Autenticado" as User
actor "Autor da Peça" as Author
actor "Sistema de\nNotificação" as NotifSystem

rectangle "SAI Platform — Interações com Peça de Roupa" {
  usecase "Acessar Peça via\nLista do Esquema" as UC_AccessPiece
  usecase "Visualizar Detalhes\nda Peça" as UC_View
  usecase "Curtir Peça" as UC_Like
  usecase "Descurtir Peça" as UC_Unlike
  usecase "Comentar em Peça" as UC_Comment
  usecase "Remover Comentário\nda Peça" as UC_DeleteComment
  usecase "Salvar Peça\nnos Favoritos" as UC_Save
  usecase "Remover Peça\ndos Favoritos" as UC_Unsave
  usecase "Compartilhar Peça" as UC_Share
  usecase "Compartilhar no\nFeed Interno" as UC_ShareInternal
  usecase "Exportar para\nPlataforma Externa" as UC_Export
  usecase "Verificar Autenticação\ne Permissão" as UC_Auth
  usecase "Enviar Notificação\nao Autor" as UC_Notify
}

User --> UC_AccessPiece
User --> UC_Like
User --> UC_Unlike
User --> UC_Comment
User --> UC_DeleteComment
User --> UC_Save
User --> UC_Unsave
User --> UC_Share

UC_AccessPiece   .> UC_View    : <<include>>
UC_Like          .> UC_Auth    : <<include>>
UC_Like          .> UC_Notify  : <<include>>
UC_Unlike        .> UC_Auth    : <<include>>
UC_Comment       .> UC_Auth    : <<include>>
UC_Comment       .> UC_Notify  : <<include>>
UC_DeleteComment .> UC_Auth    : <<include>>
UC_Save          .> UC_Auth    : <<include>>
UC_Unsave        .> UC_Auth    : <<include>>
UC_Share         .> UC_ShareInternal : <<extend>>
UC_Share         .> UC_Export        : <<extend>>

NotifSystem --> UC_Notify
Author      --> UC_View
Author      --> UC_DeleteComment
@enduml
```

---

## Observações de Modelagem

- **Simetria Esquema ↔ Peça:** os casos de uso de interação social são intencionalmente simétricos entre `Scheme` e `WardrobeItem`. A diferença arquitetural está nas coleções Firestore: `saiOutfitLikes` / `saiOutfitComments` / `saiUserSavedSchemes` para esquemas; `saiPieceLikes` / `saiPieceStats` para peças.

- **Acesso via lista do esquema:** `UC_AcessarPecaViaEsquema` (Diagrama 3) reflete a restrição de domínio — uma `WardrobeItem` não possui página própria no feed; ela é sempre exibida dentro do card do `Scheme` que a contém (`SchemePieceSnapshot[]`).

- **Compartilhar vs. Exportar:** `UC_CompartilharNoFeedInterno` cria uma postagem na timeline do SAI (`saiUserPosts`). `UC_ExportarParaPlataformaExterna` gera um artefato de exportação (`saiOutfitExports`) para plataformas como Instagram, Facebook ou X.

- **Remoção de comentário:** tanto o autor do conteúdo quanto o autor do próprio comentário podem excluí-lo. Administradores possuem permissão de moderação (não detalhada neste diagrama).

- **`<<extend>>` em Compartilhar:** o tipo de compartilhamento (interno ou externo) é uma escolha do usuário em tempo de execução; por isso é modelado como `<<extend>>` e não `<<include>>`.

- **Contadores:** `UC_AtualizarContadores` no Diagrama 1 atualiza os campos `following_count` e `follower_count` da entidade `User` de forma atômica.
