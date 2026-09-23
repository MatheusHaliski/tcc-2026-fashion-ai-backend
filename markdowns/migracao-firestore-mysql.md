# Migração Firestore → MySQL + novo projeto Firebase (somente Auth)

> Status: **em andamento**. Este documento descreve a arquitetura-alvo, o que já
> foi implementado e os próximos passos.

## Motivação

1. **Segurança.** O projeto Firebase legado (`FuncionariosListaApp2025`) foi
   compartilhado por vários projetos e teve credenciais expostas (o `.env` real
   chegou a ser versionado em repositório público). Decisão: **novo projeto
   Firebase** usado **apenas** para autenticação / controle de acesso.
2. **Escalabilidade e integridade.** Os dados saem do Firestore (NoSQL, sem
   integridade referencial) para **MySQL** relacional, com chaves estrangeiras,
   transações e índices.

## Arquitetura-alvo

| Camada | Antes | Depois |
|---|---|---|
| Autenticação / acesso | Firebase Auth (projeto legado) | **Firebase Auth (projeto novo)** |
| Banco de dados | Firestore `newsaidb` | **MySQL** (`fai_tcc_2026`) |
| Vínculo de identidade | `firebase uid` espalhado nos docs | `users.firebase_uid` (UNIQUE) → `users.user_id` |

O Firebase continua responsável por *quem é* o usuário (login, tokens). O MySQL
guarda *todos os dados*. A ponte é `users.firebase_uid`.

## O que já foi feito

### Fase 0 — Contenção de segurança
- `.env` e `.env.local` removidos do controle de versão (`git rm --cached`).
  Os arquivos continuam no disco local; o `.gitignore` já os bloqueia.
- `.env.example` reescrito com **todas** as variáveis (sem valores), incluindo
  o novo bloco MySQL.
- **Ação obrigatória do responsável:** rotacionar TODAS as credenciais que
  estiveram no `.env` versionado (service account, API keys de Resend, Meshy,
  FASHN, Remove.bg, Vercel Blob, tokens de worker, `PIN_HASH`,
  `PIN_COOKIE_SECRET`). Enquanto o histórico público existir, considere-as
  comprometidas.

### Fase 2 — Camada MySQL
- Driver `mysql2` adicionado.
- `app/lib/db/pool.ts`: pool de conexões + helpers `query`, `execute` e
  `withTransaction`. Toda query usa parâmetros (`?`) — nunca interpolação.
- `db/schema.sql` consolidado (24 tabelas) cobrindo todas as coleções
  Firestore, com `firebase_uid` em `users`, FKs, índices e tipos `ENUM`/`JSON`.

## Próximos passos

### Fase 1 — Novo projeto Firebase (console)
- Criar projeto novo, habilitar Auth (Email/Senha + Google).
- Gerar nova service account; preencher as variáveis `NEXT_PUBLIC_FIREBASE_*`
  e `NEXT_FIREBASE_ADMIN_*` no `.env` local / secrets da Vercel.

### Fase 3 — Repositórios
- Reescrever `app/backend/repositories/BaseRepository.ts` e derivados para usar
  `query`/`execute` em vez do Firestore Admin.

### Fase 4 — Rotas e libs (37 arquivos)
- Migrar, incrementalmente, cada rota em `app/api/**` e libs que hoje usam
  `getAdminFirestore()` / `firebase/firestore` para SQL. O Firebase Admin passa
  a ser usado só para `verifyIdToken` (resolver `firebase_uid` → `user_id`).

### Fase 5 — Migração de dados
- Script de export Firestore → import MySQL (resolver `firebase_uid → user_id`,
  validar contagem por tabela). Base já esboçada em `migrate.js` e
  `projects-migrados/FAI-TCC-2026/database/`.

### Fase 6 — Limpeza
- Remover `firebase/firestore`, `firestore.rules`, `firestore.indexes.json`;
  manter apenas `firebase-admin/auth` e o client de Auth.

## Como aplicar o schema localmente

```bash
mysql -u root -p -e "CREATE DATABASE fai_tcc_2026 CHARACTER SET utf8mb4;"
mysql -u root -p fai_tcc_2026 < db/schema.sql
# opcional: dados de exemplo
mysql -u root -p fai_tcc_2026 < db/seed.sql
```

Criação dos usuários de aplicação com permissão mínima (sem root):
ver `projects-migrados/FAI-TCC-2026/database/scripts/setup-users.sh` e
`projects-migrados/FAI-TCC-2026/SECURITY.md`.
