# Backup Git do repositório

## Objetivo e escopo

O workflow [`Repository Backup`](../../.github/workflows/repository-backup.yml) mantém uma cópia do histórico Git para recuperação após perda ou indisponibilidade do repositório principal.

- **Repositório principal:** `MatheusHaliski/tcc-2026-fashion-ai-backend`
- **Repositório de backup:** `MatheusHaliski/tcc-2026-fashion-ai-backend-backup001`

Este processo protege o Git: commits, branches, tags e código-fonte. Não é um backup dos dados ou serviços em execução. MySQL/Railway, Firebase/Auth, uploads, imagens, modelos 3D, assets de usuários, storage externo, secrets e variáveis de ambiente precisam de estratégias próprias. Não armazene dumps ou credenciais neste repositório.

## Configuração inicial

1. Gere uma chave SSH exclusiva para o backup e guarde sua chave privada de forma segura fora do repositório.
2. Cadastre a chave privada como secret `BACKUP_SSH_KEY` no repositório principal em **Settings → Secrets and variables → Actions → Repository secrets**.
3. Cadastre a chave pública correspondente em **Settings → Deploy keys** do repositório de backup `MatheusHaliski/tcc-2026-fashion-ai-backend-backup001` e habilite **Allow write access**. Essa Deploy Key concede escrita somente no repositório de backup.
4. Deixe o repositório de backup vazio ou sem commits independentes antes da primeira execução. O workflow não força atualizações divergentes nem apaga branches/tags de destino; divergências falham para intervenção segura.

O workflow usa `contents: read` no repositório principal. O token de checkout serve apenas para buscar o histórico de origem e é removido da configuração Git antes do acesso SSH ao destino. A chave de backup não deve ser cadastrada no repositório principal como Deploy Key com acesso de escrita.

## Execução e agendamento

O backup é executado:

- manualmente em **GitHub → Actions → Repository Backup → Run workflow**;
- após pushes na branch `main`;
- diariamente às 03:00 UTC. Os horários de `cron` do GitHub Actions são sempre em UTC.

Execuções compartilham um grupo de concorrência e não são canceladas; cada execução tem timeout de 15 minutos. O workflow envia branches e tags sem excluir refs antigas no backup. Se uma atualização não puder ser feita sem sobrescrever histórico divergente, a execução falha e deve ser investigada.

Após a conclusão, consulte o resumo do job para verificar contagens e o resultado da validação de branches e tags remotas. O workflow não pode ser considerado validado até que `BACKUP_SSH_KEY` e a Deploy Key estejam configurados e uma execução real termine com sucesso.

## Recuperação

Para restaurar uma cópia de trabalho:

```bash
git clone git@github.com:MatheusHaliski/tcc-2026-fashion-ai-backend-backup001.git
```

O clone contém as branches e tags que chegaram ao backup. Para reconstruir o repositório principal em um destino vazio:

```bash
git remote rename origin backup
git remote add origin git@github.com:MatheusHaliski/tcc-2026-fashion-ai-backend.git
git push origin --all
git push origin --tags
```

Revise o repositório de destino e os refs restaurados antes de direcionar serviços ou usuários para ele. As credenciais SSH de recuperação devem ser provisionadas separadamente; não reutilize o secret da automação sem necessidade.

## Evolução de disaster recovery

Uma cópia adicional via `git bundle` pode permitir restauração independente (`git clone fashion-ai-backend.bundle`). Ainda não há armazenamento de artifacts externo com retenção adequada definido para este projeto, portanto essa camada não é criada aqui. O workflow atual não protege bancos, arquivos de mídia, storage, secrets ou variáveis de ambiente.
