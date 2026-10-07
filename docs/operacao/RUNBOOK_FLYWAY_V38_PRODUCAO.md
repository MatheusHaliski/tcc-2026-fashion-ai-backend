# Runbook — destravar o deploy da API (Flyway: checksum diferente na versão 38)

> 06/10/2026 · Produção (Railway, projeto `fashion-ai-tcc-2026`, serviço `api`, banco `fashionai` no `MySQL`).
> Executar com cuidado: escreve no histórico do Flyway em produção. Nada aqui apaga dados.

## O que aconteceu

| Fato | Evidência |
|---|---|
| O último deploy bom (13:56 UTC de 05/10, commit `816c514`, branch `claude/fashion-ai-interfaces-config-id7naj`) tinha migrations só até a **V38 = `identidade_do_avatar_versionada`** e aplicou essa V38 no banco | `git ls-tree 816c514` |
| Depois, essa migration foi renumerada para **V42** (mesmo conteúdo) porque o `main` já usava V38–V41 | commit `b819a189` |
| Checksum gravado em produção para a versão 38: **−380963270** = checksum da V42 atual (arquivo idêntico) | CRC32 do Flyway calculado nos dois arquivos |
| O código agora tem **V38 = `peca_para_doar`** (checksum −2103482599): o Flyway recusa subir ("checksum mismatch for migration version 38") e o healthcheck falha | logs do deploy `c0b7880e` |
| A API continua no ar com o deploy antigo; todo deploy novo (da branch da outra sessão ou do `main`) falha até corrigir | `list-deployments` |

As V38–V41 do `main` (doação, hype por região, Lens, marcos do hype) só criam tabelas e colunas novas e não dependem da
V42. A V42 tem `UPDATE`/`INSERT` de dados (migração das identidades de avatar) que **já rodou** em produção e **não pode
rodar de novo**. Por isso a correção é renomear o registro no histórico, não apagar.

## Correção recomendada (sem perda de dados)

### Passo 0 — Conferir o estado (só leitura)

Railway → projeto `fashion-ai-tcc-2026` → serviço **MySQL** → aba **Data** (editor de consultas). Rodar:

```sql
SELECT installed_rank, version, description, script, checksum, success
FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 5;
```

Esperado na primeira linha: `version = 38`, `script = V38__identidade_do_avatar_versionada.sql`,
`checksum = -380963270`, `success = 1`, e **nenhuma** linha com versão maior que 38.

```sql
SHOW TABLES LIKE 'avatar_identity_versions';                      -- deve existir (V42 já aplicada)
SHOW COLUMNS FROM wardrobe_items LIKE 'for_donation';             -- deve vir vazio (V38 do main ainda não rodou)
SHOW TABLES LIKE 'lens_scans';                                    -- deve vir vazio (V40 ainda não rodou)
```

**Se qualquer resultado for diferente, pare aqui** e me mande o que apareceu: o plano abaixo vale só para esse estado.

### Passo 1 — Backup

Railway → serviço **MySQL** → volume → **Backups** → criar um backup manual agora. Esperar terminar.

### Passo 2 — Renomear o registro da V38 para V42 no histórico

Na mesma aba **Data**:

```sql
START TRANSACTION;
UPDATE flyway_schema_history
   SET version = '42',
       description = 'identidade do avatar versionada',
       script = 'V42__identidade_do_avatar_versionada.sql'
 WHERE version = '38'
   AND script = 'V38__identidade_do_avatar_versionada.sql'
   AND checksum = -380963270;
-- deve informar 1 linha afetada; se for 0 ou mais de 1: ROLLBACK; e pare.
SELECT installed_rank, version, script, checksum FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 3;
COMMIT;
```

O checksum não muda (o conteúdo da V42 é o mesmo); a descrição segue o padrão do Flyway (nome do arquivo com `_` → espaço).

### Passo 3 — Um deploy com `outOfOrder` ligado

Agora o banco tem V37 e V42, e o código tem V38–V41 "atrás" da V42. Por padrão o Flyway recusa migrations mais antigas
que a última aplicada; liga-se a exceção só para este deploy:

1. Railway → serviço **api** → **Variables** → adicionar `SPRING_FLYWAY_OUT_OF_ORDER` = `true`.
2. Fazer o deploy (o Railway pede para aplicar a mudança; ou **Redeploy** do último commit da branch conectada).
3. Nos logs do deploy, procurar `Migrating schema ... to version "38 - peca para doar"`, depois 39, 40, 41 (e as
   seguintes que o commit tiver, V43+), e `Successfully applied N migrations`. O healthcheck deve passar.

Conferir no **Data**:

```sql
SELECT version, script, success FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 12;
-- 38, 39, 40, 41 (e V43+, se existirem no commit) com success = 1; 42 continua lá
SHOW COLUMNS FROM wardrobe_items LIKE 'for_donation';            -- agora existe
```

### Passo 4 — Desligar o `outOfOrder`

Remover a variável `SPRING_FLYWAY_OUT_OF_ORDER` do serviço **api** e fazer mais um deploy. Com ela desligada, uma
colisão futura de numeração volta a travar o deploy em vez de passar despercebida.

## Se der errado

| Sintoma | O que fazer |
|---|---|
| Passo 2 afetou 0 linhas | `ROLLBACK;` — o estado não é o esperado; mandar o resultado do passo 0 |
| Deploy do passo 3 falha numa migration (erro SQL) | o Flyway marca a falha; não repetir o deploy. Mandar o log: corrige-se a migration ou o registro com falha (`DELETE FROM flyway_schema_history WHERE success = 0`) depois de entender o erro |
| Algo pior | restaurar o backup do passo 1 (Railway → MySQL → Backups → Restore) e voltar ao deploy antigo (`0857a9a6`, botão Rollback) |

## Alternativa descartada

Apagar o registro 38 e deixar tudo rodar de novo: a V42 refaria o `UPDATE`/`INSERT` das identidades de avatar (dados
duplicados ou sobrescritos) e exigiria apagar `avatar_identity_versions`. Mais arriscado, sem ganho.

## Para não acontecer de novo

1. **Nunca renumerar nem editar uma migration que já rodou em algum ambiente publicado.** Colidiu com o `main`? A nova
   migration (a que ainda não rodou em lugar nenhum) é que muda de número.
2. Antes de fazer deploy de uma branch que não é o `main`, trazer o `main` para ela (merge) e resolver colisões ali.
3. Ter uma única branch conectada ao deploy de produção (hoje é a branch da outra sessão, não o `main`).
4. (Proposta) Teste de CI com a lista "versão → checksum" das migrations já aplicadas em produção: renomear ou editar
   uma delas quebra o build antes do deploy.
