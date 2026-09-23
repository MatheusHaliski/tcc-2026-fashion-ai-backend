# Relational Entity Diagrams for Main Activities

This document provides **activity-oriented ER diagrams** for the three core SAI flows:

1. Create a new wardrobe piece.
2. Create and save an outfit card (scheme).
3. Execute and track the 3D pipeline.

For a quick legend of ER cardinality link symbols (`||`, `o|`, `|{`, `o{`), see [Cardinality Linking Symbols](./cardinality-linking-symbols.md).

---

## 1) Activity: Create a New Wardrobe Piece

```mermaid
erDiagram
    USERS ||--o{ WARDROBE_ITEMS : owns
    BRANDS ||--o{ WARDROBE_ITEMS : labels
    MARKETS ||--o{ WARDROBE_ITEMS : contextualizes
    BRAND_LOGO_CATALOG ||--o{ WARDROBE_ITEMS : enriches_optional
    WARDROBE_ITEMS ||--o{ PIPELINE_JOBS : may_trigger

    USERS {
      string user_id PK
      string name
      string email
      datetime createdAt
      datetime updatedAt
    }

    BRANDS {
      string brand_id PK
      string name
      boolean is_active
    }

    MARKETS {
      string market_id PK
      string season
      string gender
    }

    BRAND_LOGO_CATALOG {
      string brand_logo_catalog_id PK
      string brand_id FK
      string logo_image_url
      boolean is_active
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

    PIPELINE_JOBS {
      string pipeline_job_id PK
      string wardrobe_item_id FK
      string job_type
      string status
      datetime createdAt
      datetime updatedAt
    }
```

---

## 2) Activity: Create and Save an Outfit Card (Scheme)

```mermaid
erDiagram
    USERS ||--o{ SCHEMES : creates
    SCHEMES ||--o{ SCHEME_ITEMS : contains
    WARDROBE_ITEMS o|--o{ SCHEME_ITEMS : references_when_inventory

    USERS {
      string user_id PK
      string name
      string email
    }

    SCHEMES {
      string scheme_id PK
      string user_id FK
      string title
      string style
      string occasion
      string visibility
      string cover_image_url
      string creation_mode
      datetime createdAt
      datetime updatedAt
    }

    SCHEME_ITEMS {
      string scheme_item_id PK
      string scheme_id FK
      string wardrobe_item_id "logical ref: wardrobe item or suggested:*"
      string slot
      int sort_order
      datetime createdAt
    }

    WARDROBE_ITEMS {
      string wardrobe_item_id PK
      string user_id FK
      string brand_id FK
      string market_id FK
      string name
      string piece_type
      string image_url
    }
```

---

## 3) Activity: Execute and Track the 3D Pipeline

```mermaid
erDiagram
    USERS ||--o{ WARDROBE_ITEMS : owns
    WARDROBE_ITEMS ||--o{ PIPELINE_JOBS : submits_jobs_for

    USERS {
      string user_id PK
      string name
      string email
    }

    WARDROBE_ITEMS {
      string wardrobe_item_id PK
      string user_id FK
      string name
      string piece_type
      string image_url
      string model_status
      string model_3d_url
      datetime updatedAt
    }

    PIPELINE_JOBS {
      string pipeline_job_id PK
      string wardrobe_item_id FK
      string cloud_job_id
      string job_type
      string status
      string status_message
      string artifact_model_url
      string artifact_uv_url
      datetime createdAt
      datetime updatedAt
      datetime completed_at
    }
```

---

## Notes

- Cardinalities reflect current service/repository behavior and API payload contracts.
- Some references are intentionally **logical** (not always strict FK), especially `scheme_items.wardrobe_item_id`.
- The 3D pipeline is modeled as a one-to-many relation from `wardrobe_items` to `pipeline_jobs` to preserve job history.
