# Diagramas UML e Modelo de Dados — Caso de Uso Principal

Este documento descreve o caso de uso principal **"Criar e salvar um outfit (scheme)"** no sistema SAI, com três visões complementares:

1. **UML de Caso de Uso** (foco em atores e interações).
2. **Diagrama ER** (foco no modelo relacional e cardinalidades).
3. **Diagrama de Classes** (foco em estruturas de domínio e associações).

---

## 1) Diagrama UML de Caso de Uso (Principal)

Atores principais:
- **Usuário**: monta o outfit e solicita salvamento.
- **IA de Interpretação**: opcional para sugerir combinações a partir de prompt.

```plantuml
@startuml
left to right direction
skinparam packageStyle rectangle

actor "Usuário" as User
actor "IA de Interpretação" as AI

rectangle "Sistema SAI" {
  usecase "Criar Outfit" as UC_Create
  usecase "Selecionar Peças\npor slot" as UC_Select
  usecase "Gerar Descrição\ncom IA" as UC_AI
  usecase "Validar Dados\ndo Outfit" as UC_Validate
  usecase "Salvar Scheme" as UC_SaveScheme
  usecase "Salvar Itens\ndo Scheme" as UC_SaveItems
  usecase "Visualizar Card\ndo Outfit" as UC_View
}

User --> UC_Create
User --> UC_View

UC_Create .> UC_Select : <<include>>
UC_Create .> UC_Validate : <<include>>
UC_Create .> UC_SaveScheme : <<include>>
UC_SaveScheme .> UC_SaveItems : <<include>>
UC_AI .> UC_Create : <<extend>>

AI --> UC_AI
@enduml
```

---

## 2) Diagrama ER (Entidade-Relacionamento)

Entidades centrais para o fluxo de criação/salvamento de outfit:
- `users`
- `schemes`
- `scheme_items`
- `wardrobe_items`
- `brands`
- `markets`

```mermaid
erDiagram
    USERS ||--o{ WARDROBE_ITEMS : possui
    USERS ||--o{ SCHEMES : cria

    SCHEMES ||--o{ SCHEME_ITEMS : contem
    WARDROBE_ITEMS o|--o{ SCHEME_ITEMS : referencia_quando_wardrobe

    BRANDS ||--o{ WARDROBE_ITEMS : classifica
    MARKETS ||--o{ WARDROBE_ITEMS : contextualiza

    USERS {
      string user_id PK
      string name
      string email
      string role
      datetime createdAt
      datetime updatedAt
    }

    BRANDS {
      string brand_id PK
      string name
      string logo_url
      boolean is_active
      datetime createdAt
      datetime updatedAt
    }

    MARKETS {
      string market_id PK
      string season
      string gender
      datetime createdAt
      datetime updatedAt
    }

    WARDROBE_ITEMS {
      string wardrobe_item_id PK
      string user_id FK
      string brand_id FK
      string market_id FK
      string name
      string piece_type
      string image_url
      string model_status
      datetime createdAt
      datetime updatedAt
    }

    SCHEMES {
      string scheme_id PK
      string user_id FK
      string title
      string creation_mode
      string style
      string occasion
      string visibility
      string cover_image_url
      datetime createdAt
      datetime updatedAt
    }

    SCHEME_ITEMS {
      string scheme_item_id PK
      string scheme_id FK
      string wardrobe_item_id // referência lógica: wardrobe_item_id ou suggested:*
      string slot
      int sort_order
      datetime createdAt
    }
```

---

## 3) Diagrama de Classes (Domínio)

Diagrama orientado aos tipos de domínio usados no backend para criação e leitura de outfits.

```mermaid
classDiagram
    class User {
      +string user_id
      +string name
      +string email
      +string role
      +string[] preferred_styles
    }

    class Brand {
      +string brand_id
      +string name
      +string logo_url
      +boolean is_active
    }

    class Market {
      +string market_id
      +string season
      +string gender
    }

    class WardrobeItem {
      +string wardrobe_item_id
      +string user_id
      +string brand_id
      +string market_id
      +string name
      +string piece_type
      +string image_url
      +string model_status
      +boolean is_favorite
    }

    class Scheme {
      +string scheme_id
      +string user_id
      +string title
      +string creation_mode
      +string style
      +string occasion
      +string visibility
      +string cover_image_url
    }

    class SchemeItem {
      +string scheme_item_id
      +string scheme_id
      +string wardrobe_item_id
      +string slot
      +number sort_order
    }

    class SchemePieceSnapshot {
      +string id
      +string slot
      +string sourceType
      +string sourceId
      +string name
      +string brand
      +string pieceType
      +string[] wearstyles
    }

    User "1" --> "0..*" WardrobeItem : possui
    User "1" --> "0..*" Scheme : cria

    Brand "1" --> "0..*" WardrobeItem : classifica
    Market "1" --> "0..*" WardrobeItem : contexto

    Scheme "1" --> "0..*" SchemeItem : itens
    WardrobeItem "1" --> "0..*" SchemeItem : vinculo

    Scheme "1" --> "0..*" SchemePieceSnapshot : snapshot visual
```

---

## Observações de modelagem

- O caso de uso principal foi modelado em torno da jornada **criar + salvar** outfit, incluindo a extensão opcional por IA.
- O ER reflete persistência relacional; já o diagrama de classes mostra a estrutura de domínio consumida pelos serviços/repositórios.
- `SchemeItem` representa a relação entre `Scheme` e peças do guarda-roupa, permitindo ordenação por `slot` e `sort_order`.
- Em `SCHEME_ITEMS`, `wardrobe_item_id` foi modelado como referência lógica (não FK rígida), pois o backend também aceita IDs sintéticos no formato `suggested:*`.
