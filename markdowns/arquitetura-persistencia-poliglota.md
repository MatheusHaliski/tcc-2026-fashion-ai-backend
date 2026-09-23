# Arquitetura de persistência poliglota — SAI / Fashion AI (TCC 2026)

> Status: **proposta de arquitetura** para escalabilidade horizontal (big data)
> de uma rede social de moda. Complementa `docs/migracao-firestore-mysql.md`:
> primeiro consolida-se o MySQL como fonte da verdade; depois adicionam-se,
> por fase, stores especializados por padrão de acesso.

Diagramas visuais (UML — Componentes, Implantação e Sequência):
**[artifact "Persistência Poliglota"](https://claude.ai/code/artifact/d7583e45-f165-489d-88f8-cc49b92a723a)**.

---

## 1. Motivação

Uma rede social (curtidas, feed, seguidores, busca, mídia) tem **padrões de
acesso incompatíveis entre si**. Um único banco relacional atende bem
integridade e transações, mas vira gargalo em:

- **feed/timeline**: escrita massiva, ordenada por tempo, sem `JOIN`;
- **contadores** (likes, ratings): milhares de escritas concorrentes no mesmo registro;
- **busca**: full-text com filtros e facetas;
- **mídia**: binários grandes (imagens, GLB) que não pertencem a uma linha de tabela.

A resposta usada por Facebook, Instagram e afins é **persistência poliglota**:
o dado canônico vive num store forte (relacional) e **projeções especializadas**
atendem cada padrão de acesso, alimentadas por eventos.

## 2. Princípio central — escolher o padrão de acesso, não o banco

Antes de citar tecnologias, classifica-se cada dado por **como é acessado**.
Só então o padrão "puxa" o store certo.

| Dado no SAI (tabelas atuais) | Padrão de acesso | Store |
|---|---|---|
| `users`, `brands`, `markets`, `piece_items`, `wardrobe_items`, `schemes`, `scheme_items` | Integridade forte, FKs, transações | **MySQL — fonte da verdade** |
| `follows` (grafo social) | N:N; em escala pequena/média fica relacional + cache | **MySQL** (+ Redis); grafo dedicado é trabalho futuro |
| Timeline / feed dos seguidores | Escrita massiva, append-only, ordenada por tempo, sem `JOIN` | **DynamoDB** (wide-column) |
| `piece_stats` (likes, avg_rating), sessão, rate-limit da IA | Latência sub-ms, contadores atômicos, efêmero | **Redis** |
| Busca de peças, usuários e looks públicos | Full-text, filtros por marca/cor/estilo, facetas | **OpenSearch** |
| Imagens, PNGs segmentados, GLB / assets 3D | Binários grandes; no banco fica só a URL | **Object Storage** (Vercel Blob / S3) |
| `pipeline_jobs` (geração 3D) | Jobs assíncronos, máquina de estados | **Fila** (Redis Streams → SQS) |

**Regra de ouro:** um único *source of truth* (o relacional). Os demais stores
são **projeções derivadas** dele, nunca donos independentes do mesmo dado.

## 3. Papel de cada store

### 3.1 MySQL — fonte da verdade
Mantém o que já foi modelado em `db/schema.sql` (25 tabelas, FKs, transações).
Toda escrita canônica passa por aqui, dentro de transação
(`app/lib/db/pool.ts` → `withTransaction`). Para escala de escrita futura:
particionamento por `user_id` ou **Vitess** (MySQL sharded, usado por
YouTube/Slack) — trabalho futuro.

### 3.2 Redis — contadores, cache e efêmeros
`piece_stats.like_count`, `avg_rating`, `owner_count` viram contadores atômicos
(`INCR`/`HINCRBY`) com *write-behind* periódico para o MySQL. Também: cache de
perfil e de feed montado, sessão, "online agora" e **rate-limit** das rotas de
IA (que são caras). Porta: `CounterStorePort`.

### 3.3 DynamoDB — feed / timeline (fan-out on write)
Ao publicar um look, grava-se uma entrada na timeline de **cada seguidor**.
Modelagem wide-column: `partition key = ownerUserId`, `sort key = createdAt DESC`.
Paginação por **cursor** (chave), nunca `OFFSET`. Porta: `FeedTimelinePort`.
DynamoDB (serverless, casa com Vercel) vs **Cassandra/ScyllaDB** (self-hosted,
multi-datacenter): mesma categoria — ver §7.

### 3.4 OpenSearch — busca
Índices `pieces`, `users`, `schemes`. O sinal para indexar um look já existe no
modelo: `schemes.community_indexed`. Porta: `SearchIndexPort`.

### 3.5 Object Storage — mídia
Já implementado corretamente com **Vercel Blob**: no banco fica só a URL. Em dev,
o mesmo papel roda em **MinIO** (S3-compatível). Porta: `ObjectStorePort`.

### 3.6 Fila — pipeline 3D
O estado canônico dos `pipeline_jobs` fica no MySQL; o *disparo* vai para uma
fila (Redis Streams no começo; SQS/RabbitMQ em prod).

## 4. Padrão de projeto — Ports & Adapters + eventos

Implementado em `app/lib/datasources/`:

- `ports.ts` — os Services dependem de **interfaces** (`EventBusPort`,
  `FeedTimelinePort`, `CounterStorePort`, `SearchIndexPort`, `ObjectStorePort`),
  nunca de um driver.
- `config.ts` — lê o ambiente e devolve a config de cada store (sem importar
  driver algum → compila sem instalar nada).
- adaptadores — um por store, adicionados **junto com sua dependência** para
  não quebrar o build (ver `app/lib/datasources/README.md`).

**Fan-out on write** (fluxo de "publicar um look"):

1. `SchemesRepository` grava no MySQL **em transação** (fonte da verdade).
2. Service publica `LookPublished` no `EventBusPort`.
3. Projetores assíncronos consomem o evento: contadores (Redis), timeline dos
   seguidores (DynamoDB), índice de busca (OpenSearch).
4. O usuário recebe `201 Created` após o passo 1 — **nunca espera o fan-out**.

Consequência: consistência **forte** só na fonte da verdade; projeções são
**eventualmente consistentes** (o feed dos seguidores chega alguns instantes
depois). É um trade-off consciente (teorema CAP) e adequado a rede social.

## 5. Ambientes — dev vs. produção (paridade)

Mesmo desenho lógico, nós diferentes. A porta é a mesma; muda só o endpoint.

| Papel | Dev (`docker-compose.dev.yml`) | Produção |
|---|---|---|
| App | `next dev` no host | Vercel (Next.js serverless) |
| Fonte da verdade | `mysql:8.4` | PlanetScale / RDS |
| Contadores/cache | `redis:7` | Upstash / ElastiCache |
| Feed | `amazon/dynamodb-local` | DynamoDB (AWS) |
| Busca | `opensearchproject/opensearch` | OpenSearch Service |
| Mídia | `minio` (S3-compatível) | Vercel Blob / S3 |

Subir o ambiente de dev:

```bash
cp .env.example .env          # ajuste as senhas de dev se quiser
docker compose -f docker-compose.dev.yml up -d
npm run dev                   # app no host, aponta para 127.0.0.1
```

O MySQL carrega `db/schema.sql` + `db/seed.sql` automaticamente na primeira
subida. Encerrar: `docker compose -f docker-compose.dev.yml down`
(`-v` para zerar os volumes).

## 6. Fases de migração (incremental, sem big bang)

0. **Consolidar o relacional** — MySQL como fonte da verdade única; rotas
   passando pela camada de repositório (ver `docs/migracao-firestore-mysql.md`).
   *Pré-requisito de tudo abaixo.*
1. **Redis** — contadores (`piece_stats`) + cache. Risco baixo, ganho imediato;
   ensina o padrão "projeção derivada".
2. **OpenSearch** — indexar peças e looks públicos por evento; desacopla a
   busca do banco transacional.
3. **DynamoDB** — feed por fan-out on write. É aqui que a escala horizontal /
   big data aparece de fato no TCC.
4. **Sharding / particionamento do relacional** (Vitess / Postgres particionado)
   — só se for necessário provar escala de escrita. Provável **trabalho futuro**.

## 7. Decisões e trade-offs (para a monografia)

- **DynamoDB _ou_ Cassandra** (não os dois — mesma categoria wide-column).
  DynamoDB: serverless, zero operação, casa com Vercel — **escolhido**.
  Cassandra/ScyllaDB: self-hosted, multi-datacenter, sem lock-in de nuvem, mas
  muito mais operação. Citar ambos e justificar a escolha rende pontos de banca.
- **Consistência eventual**: projeções podem atrasar; aceitável para feed e
  contadores, inaceitável para "quem é dono do quê" (fica no MySQL).
- **Dupla escrita**: mitigada com eventos/outbox — o dado só é projetado depois
  de confirmado na fonte da verdade.
- **Grafo social**: `follows` fica relacional + cache até consultas de 2º/3º grau
  (sugestões de quem seguir) virarem gargalo; só então um banco de grafo (Neo4j)
  ou serviço dedicado se justifica.

## 8. Recorte honesto para o TCC ⚠️

Não é preciso rodar em escala real do Facebook para defender bem — tentar isso
costuma consumir todo o tempo em operação. O que sustenta uma boa defesa:

1. O **diagrama de arquitetura poliglota com justificativa por padrão de acesso**
   (§2 e o artifact).
2. Implementar **2–3 stores de verdade**: MySQL (fonte da verdade) + Redis
   (contadores/cache) + um wide-column para o feed.
3. Cassandra, banco de grafo e sharding entram como **"arquitetura de referência
   / trabalho futuro"**, documentados mas não implementados.

Defensável, entregável no prazo e academicamente forte.
