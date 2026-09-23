# Cardinality Linking Symbols (Mermaid ER Diagrams)

This guide explains the **cardinality/link symbols** used in Mermaid `erDiagram` relationship lines, such as:

```text
USERS ||--o{ WARDROBE_ITEMS : owns
```

In Mermaid ER syntax, each side of the connector has two characters:
- **Outer cardinality** (`|` or `o`) for minimum participation.
- **Inner cardinality** (`|` or `{`) for maximum participation.

---

## Symbol Legend

### Minimum participation (outer symbol)
- `|` = **mandatory** (minimum = 1)
- `o` = **optional** (minimum = 0)

### Maximum participation (inner symbol)
- `|` = **one** (maximum = 1)
- `{` = **many** (maximum = N)

---

## Most common combinations

| Side token | Meaning | Cardinality range |
|---|---|---|
| `||` | exactly one | 1..1 |
| `o|` | zero or one | 0..1 |
| `|{` | one or many | 1..N |
| `o{` | zero or many | 0..N |

---

## Reading a full relationship

Given:

```text
USERS ||--o{ WARDROBE_ITEMS : owns
```

Read it as:
- A **WARDROBE_ITEM** is linked to **exactly one USER** (`||` on `USERS` side).
- A **USER** can own **zero or many WARDROBE_ITEMS** (`o{` on `WARDROBE_ITEMS` side).

Another example:

```text
SCHEMES ||--o{ SCHEME_ITEMS : contains
```

- Each **SCHEME_ITEM** belongs to exactly one **SCHEME**.
- A **SCHEME** can contain zero or many **SCHEME_ITEMS**.

---

## Quick mapping to verbal rules

- `||--||` → one-to-one (mandatory both sides)
- `||--o|` → one-to-zero-or-one
- `||--|{` → one-to-many (at least one child)
- `||--o{` → one-to-many (child optional set)
- `o|--o{` → zero-or-one to zero-or-many

---

## Practical note for this repository

In activity ER docs, symbols represent **business/data-contract intent**. Some links are logical (soft references) rather than strict database FKs (for example, `scheme_items.wardrobe_item_id` may contain `suggested:*`). Cardinality still helps communicate expected usage patterns.
