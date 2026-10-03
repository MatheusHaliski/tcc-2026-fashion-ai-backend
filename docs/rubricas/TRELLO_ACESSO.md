# Configurar acesso ao Trello para a análise das rubricas

O link de convite permite que uma pessoa entre no board, mas os scripts precisam
de credenciais da API. Configure três variáveis **no ambiente do agente**, não em
arquivos versionados:

| Variável | Conteúdo |
|---|---|
| `TRELLO_API_KEY` | chave da integração Trello da conta que aceitou o convite |
| `TRELLO_TOKEN` | token dessa mesma conta, com acesso ao board |
| `TRELLO_BOARD_ID` | ID do board; no convite fornecido, é o trecho de 24 caracteres depois de `/b/` |

## Opção recomendada: painel de variáveis do ambiente

Na interface que iniciou este ambiente/Codex, abra **Environment variables** ou
**Secrets**, adicione as três chaves e reinicie a sessão para que os processos as
recebam. Marque `TRELLO_TOKEN` e, se disponível, `TRELLO_API_KEY` como secretos.
Não envie os valores no chat nem em issue/PR.

Depois, confirme apenas os nomes — sem imprimir valores:

```bash
for var in TRELLO_API_KEY TRELLO_TOKEN TRELLO_BOARD_ID; do
  test -n "${!var:-}" && echo "$var=CONFIGURADA" || echo "$var=AUSENTE"
done
```

## Opção local: `.env`

O repositório ignora `.env`. Copie o modelo e preencha **somente na sua máquina**:

```bash
cp .env.example .env
# edite as três variáveis no final do arquivo
set -a
. ./.env
set +a
```

Não use `export $(cat .env | xargs)`: valores com espaços ou caracteres especiais
podem ser interpretados incorretamente pelo shell.

## Validar o acesso

O verificador faz somente um `GET` dos metadados do board; não lista nem altera
cards e nunca imprime chave ou token:

```bash
python scripts/rubricas/verificar_trello.py
```

Resultado esperado:

```text
Acesso somente leitura confirmado: TCC 2026 (Fashion AI) - Bryan,Matheus
Board: https://trello.com/b/... · fechado=False
```

Se aparecer HTTP 401/403, confirme se a conta do token aceitou o convite e tem
acesso ao board. Se aparecer erro de rede/proxy, as credenciais podem estar
corretas, mas o ambiente ainda não consegue alcançar `api.trello.com`.

## Princípios de segurança

- Não coloque valores reais em `.env.example`.
- Não faça commit de `.env`; ele já está no `.gitignore`.
- Não use o token contido no link de convite como `TRELLO_TOKEN`.
- Comece com leitura e `--dry-run`; habilite escrita apenas após revisar o diff.
- Revogue e gere outro token se ele for exibido em terminal compartilhado, chat,
  log, commit ou pull request.

## Ambiente em nuvem do Claude Code (29/09/2026)

Estado verificado: `TRELLO_API_KEY`, `TRELLO_TOKEN` e `TRELLO_BOARD_ID` ausentes, e a política de rede do ambiente
recusa a conexão com `api.trello.com` (até o `GET`). Duas vias:

1. **Conector do Trello** (recomendado): reconectar em https://claude.ai/customize/connectors e abrir uma nova
   sessão. A escrita passa pelo conector, sem depender da rede ou das variáveis do ambiente.
2. **Scripts**: nas configurações do ambiente, incluir `api.trello.com` nos domínios permitidos (*Network access*) e
   cadastrar as três variáveis como segredos; depois `verificar_trello.py` e os scripts de lote em simulação.

Lotes pendentes: `TRELLO_RF25_RF39_DIFF_PROPOSTO.md` (autorizado) e `TRELLO_RF40_LOTE_PROPOSTO.md` (a revisar).
