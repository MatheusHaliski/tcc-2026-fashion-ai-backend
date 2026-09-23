# Análise de Divergências: Modelo Conceitual vs Implementação

**Projeto:** FashionAI (SAI-TCC-2026)  
**Data:** 17 de setembro de 2026  
**Documentação:** Baseado em `entidades-clothes-piece-scheme_1.pdf` e análise dos diagramas UML

---

## Resumo Executivo

Este documento consolida as **9 divergências identificadas** entre o modelo de dados conceitual (especificado no PDF) e a implementação atual do projeto FashionAI. Estas divergências abrangem estruturas ausentes, nomeações inconsistentes, campos parcialmente implementados, e limitações de armazenamento.

---

## Divergências Detalhadas

### 1. **Contadores Sociais Não Implementados** (Alto Impacto)

**Entidade Afetada:** `clothes_piece` (WardrobeItem)

**Problema:**
- Especificação define: `num_likes`, `num_shares`, `num_remixes`, `num_throwbacks`
- Implementação atual: Existem tabelas de relacionamento (`piece_likes`, `remixes`) mas **sem coluna denormalizada de contadores**
- Impacto: Queries de listagem exigem JOIN/COUNT em produção; não há cache pré-calculado

**Banco de Dados:**
- **Especificação:** Campos na tabela MySQL `clothes_pieces`
- **Implementação:** Tabelas separadas (`piece_likes`, `remixes`) sem cache em Redis

**Recomendação:**
```sql
-- Adicionar em clothes_pieces:
ALTER TABLE clothes_pieces 
ADD COLUMN num_likes BIGINT DEFAULT 0,
ADD COLUMN num_shares BIGINT DEFAULT 0,
ADD COLUMN num_remixes BIGINT DEFAULT 0,
ADD COLUMN num_throwbacks BIGINT DEFAULT 0;

-- Manter cache Redis: piece_counter:{piece_id}
-- Atualizar via eventos do MySQL (CDC)
```

---

### 2. **Comentários em Outfit Only** (Impacto Médio)

**Entidade Afetada:** `clothes_piece` vs `clothes_scheme`

**Problema:**
- Especificação: Campo `commentary_section` em `clothes_piece` (comentários de peça)
- Implementação: Tabela `outfit_comments` referencia **apenas looks** (`schemes`), **não peças**
- Divergência: Não há suporte para comentários em peças individuais

**Banco de Dados:**
- **Especificação:** Tabela `piece_comments` (tipo similar a `outfit_comments`)
- **Implementação:** Apenas `outfit_comments` (para schemes)

**Recomendação:**
```sql
-- Criar tabela para comentários em peças:
CREATE TABLE piece_comments (
  id UUID PRIMARY KEY,
  piece_id UUID NOT NULL REFERENCES clothes_pieces(id),
  user_id UUID NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### 3. **Tags como Escalares (Não Array)** (Impacto Médio)

**Entidade Afetada:** `clothes_scheme`

**Problema:**
- Especificação: `style_tags` e `occasion_tags` como arrays (permitir múltiplas seleções)
- Implementação: Implementados como **campos escalares (strings únicas)**
- Consequência: Impossível selecionar múltiplas ocasiões ou estilos por peça/schema

**Banco de Dados:**
- **Especificação:** Arrays/JSON `["Urban", "Casual", "Formal"]`
- **Implementação:** String scalar `"Urban"` OU ausente do ENUM

**Recomendação:**
```sql
-- Mudar para JSON array:
ALTER TABLE clothes_schemes 
MODIFY COLUMN style_tags JSON DEFAULT '[]',
MODIFY COLUMN occasion_tags JSON DEFAULT '[]';

-- Exemplo: style_tags = '["Urban", "Casual"]'
```

---

### 4. **Atributos Ausentes em Peça** (Impacto Médio)

**Entidade Afetada:** `clothes_piece`

**Problema:**
- Especificação define: `visibility` (private/followers/public) e `creation_mode` (manual/IA)
- Implementação: **Atributos não existem** em `clothes_pieces` table
- Nota: Formulário não pergunta e IA não registra metadata de forma estruturada

**Banco de Dados:**
- **Especificação:** Colunas em `clothes_pieces`
- **Implementação:** Ausentes; regressão de análise para formulário

**Recomendação:**
```sql
ALTER TABLE clothes_pieces 
ADD COLUMN visibility ENUM('private', 'followers', 'public') DEFAULT 'private',
ADD COLUMN creation_mode ENUM('manual', 'ai_assisted') DEFAULT 'manual';
```

---

### 5. **Price Parcialmente Implementado** (Impacto Baixo)

**Entidade Afetada:** `clothes_piece`

**Problema:**
- Especificação: Campo `price` (preço de venda)
- Implementação: Lido pela interface (`listing_price` + `for_sale`), **mas nunca gravado** no schema
- Status: Apenas leitura; sem persistência

**Banco de Dados:**
- **Especificação:** Coluna `price` em `clothes_pieces`
- **Implementação:** Colunas `for_sale` (booleano) e `listing_price` (decimal) mas sem persistência

**Recomendação:**
```javascript
// App-side: remover logica de leitura sem persistência
// DB-side: confirmar se listing_price persiste de fato
// Se sim, renomear para 'price' e documentar
```

---

### 6. **Nomenclatura Divergente em Camadas** (Impacto Baixo)

**Entidade Afetada:** Múltiplas (User, Schemes)

**Problema:**
- Especificação: `owner_id` para referência de usuário em `clothes_piece` e `clothes_scheme`
- Implementação: Nomeado como `user_id` (camada aplicação) e registrado como `userId` (Firestore)
- Inconsistência: Três nomes diferentes para o mesmo conceito

**Banco de Dados:**
- **Especificação:** `owner_id` (MySQL conventions)
- **Implementação:** `user_id` (código) e `userId` (Firestore)

**Recomendação:**
```javascript
// Padronizar em toda a stack:
// MySQL: user_id (não owner_id)
// Firestore: userId (camelCase)
// App: userId ou ownerId (escolher um)
```

---

### 7. **ENUM Visibility Incompleto** (Impacto Médio)

**Entidade Afetada:** `clothes_scheme`

**Problema:**
- Especificação: Visibility = {private, followers, public}
- Implementação: ENUM em `db/schema.sql` **não inclui 'followers'**
- Valor usado na aplicação é rejeitado pelo banco relacional

**Banco de Dados:**
```sql
-- Especificação (atual ERRADO):
ENUM('private', 'public')

-- Implementação esperada (CORRETO):
ENUM('private', 'followers', 'public')
```

**Recomendação:**
```sql
ALTER TABLE clothes_schemes 
MODIFY COLUMN visibility ENUM('private', 'followers', 'public') DEFAULT 'private';
```

---

### 8. **Model Status Ausente do ENUM** (Impacto Médio)

**Entidade Afetada:** `clothes_piece`

**Problema:**
- Especificação: Campo `model_status` acompanhando `model_3d_url` (queued_segmentation)
- Implementação: Coluna não existe em schema; valor registrado apenas em Firestore como subdocumento
- Inconsistência: Relacional e NoSQL desalinhados

**Banco de Dados:**
- **Especificação:** Coluna `model_status` com ENUM
- **Implementação:** Ausente de schema MySQL; presente em Firestore

**Recomendação:**
```sql
ALTER TABLE clothes_pieces 
ADD COLUMN model_status ENUM('pending', 'processing', 'ready', 'failed') DEFAULT 'pending';
```

---

### 9. **Validação Frouxa de Relacionamentos** (Impacto Médio)

**Entidade Afetada:** `clothes_scheme` → `scheme_items` → `wardrobe_item`

**Problema:**
- Especificação: `scheme_items.wardrobe_item_id` deve referenciar `clothes_piece` via FK
- Implementação: Validação apenas para valores 'suggested:' (prefixo), **sem FK real**
- Risco: Snapshots desnormalizados podem ficar órfãos se peça é deletada

**Banco de Dados:**
- **Especificação:** Foreign key `wardrobe_item_id` → `clothes_pieces(id)`
- **Implementação:** String com validação de prefixo em código aplicativo

**Recomendação:**
```sql
-- Adicionar constraint (se aplicável ao NoSQL):
-- Firestore: validação via regras de segurança
-- MySQL: caso haja tabela scheme_items espelho
ALTER TABLE scheme_items 
ADD CONSTRAINT fk_wardrobe_item 
FOREIGN KEY (wardrobe_item_id) 
REFERENCES clothes_pieces(id);
```

---

## Matriz de Severidade

| # | Divergência | Severidade | Tipo | Banco | Ação |
|---|---|---|---|---|---|
| 1 | Contadores não implementados | Alto | Estrutura | MySQL+Redis | Adicionar colunas + evento CDC |
| 2 | Comentários apenas em outfit | Médio | Estrutura | MySQL | Criar tabela `piece_comments` |
| 3 | Tags como escalares | Médio | Estrutura | MySQL/Firestore | Mudar para JSON array |
| 4 | Visibility e creation_mode ausentes | Médio | Estrutura | MySQL | Adicionar colunas + ENUM |
| 5 | Price parcialmente implementado | Baixo | Código | Ambos | Confirmar e documentar |
| 6 | Nomenclatura divergente | Baixo | Código | Ambos | Padronizar em 3 camadas |
| 7 | ENUM visibility incompleto | Médio | Estrutura | MySQL | Adicionar 'followers' |
| 8 | Model status ausente | Médio | Estrutura | MySQL | Adicionar coluna + ENUM |
| 9 | Validação frouxa de FK | Médio | Estrutura | Ambos | Adicionar constraint + regras |

---

## Arquitetura Poliglota - Mapeamento Corrigido

### MySQL (Relacional - Fonte da Verdade)

**Tabelas Principais:**
- `users` - Perfis, autenticação
- `brands` - Marcas (mestre)
- `markets` - Segmentação (estação × gênero)
- `clothes_pieces` - Peças (com contadores, visibility, creation_mode, model_status)
- `piece_likes` - Curtidas em peças (COUNT → `num_likes`)
- `piece_comments` - Comentários em peças (NOVO)
- `remixes` - Remixagens (COUNT → `num_remixes`)
- `clothes_schemes` - Looks/Outfits (com visibility ENUM correto)
- `outfit_likes` - Curtidas em looks
- `outfit_comments` - Comentários em looks
- `audit_logs` - Rastreamento

### Firestore (NoSQL - Documentos Flexíveis)

**Coleções:**
- `wardrobe_items` (clothes_piece) - Armazenamento principal com flexibilidade para IA
  - Subdocumentos: metadados, AI inferences, pipeline jobs
- `schemes` (clothes_scheme) - Looks com composição visual
  - Subcoleção: `scheme_items` (com snapshot desnormalizado)
  - Subdocumento: `background_config`

### Redis (Cache)

**Chaves:**
- `piece_counter:{piece_id}` - Contadores agregados (likes, remixes, shares, throwbacks)
- `user_timeline:{user_id}` - Timeline em cache (feed)

### DynamoDB (Série Temporal)

**Tabelas:**
- `timelines` - Timeline do usuário (partition: user_id, sort: timestamp)

### OpenSearch (Full-Text)

**Índices:**
- `looks_index` - Busca de looks (título, tag, autor)
- `pieces_index` - Busca de peças (nome, tag, marca)

### S3 / Vercel Blob (Storage)

**Estrutura:**
- `fashion-ai-assets/{user_id}/{asset_type}/{asset_id}.{ext}`

---

## Próximos Passos

1. **Validar** divergências com equipe de desenvolvimento
2. **Priorizar** correções por severidade (Alto > Médio > Baixo)
3. **Implementar** migrações de schema para divergências estruturais
4. **Testar** compatibilidade com código aplicativo existente
5. **Documentar** mudanças em CHANGELOG e atualizar diagramas UML

---

## Referências

- **Especificação Base:** `entidades-clothes-piece-scheme_1.pdf`
- **Diagramas Corrigidos:** 
  - `RF4_clothes_piece_corrected.puml` (Adicionar Peça)
  - `RF5_clothes_scheme_corrected.puml` (Criar Look)
- **Documento de Arquitetura:** `_t.html` (Persistência Poliglota)

