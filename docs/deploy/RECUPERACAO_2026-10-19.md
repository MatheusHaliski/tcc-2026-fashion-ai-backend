# Recuperação de builds — 19/10/2026

Auditadas as 540 execuções GitHub Actions retornadas entre 12 e 19/10. O CSV registra as 175 execuções com falha de CI/VTON, por commit/branch e etapa; uma execução pode falhar em vários jobs. Cancelamentos de backup e de CI por concorrência não são classificados como erros de código. Não se reverteu nem se reaplicou cegamente cada commit histórico: muitos já foram substituídos por correções na main.

## Falhas reproduzidas na main c238a263

1. `quality.ts` usava `detailBlock/detailWarn` não definidos. Foram declarados os dois limiares heurísticos de cobertura de detalhe, correspondendo aos estados de bloqueio/aviso já testados. Isso não comprova realismo nem preservação de identidade.
2. `test_audit_tryon_rendering.py` dependia da ordem de importação dos outros testes. Agora declara explicitamente o diretório do CLI, como os demais testes do catálogo.
3. O componente da frente da peça perdeu o badge de Hype enquanto testes/selos ainda esperavam seus estados. O badge vivo foi integrado ao label Info, com carregamento, valor real, tendência real e indisponibilidade. Removido o score duplicado no botão de virar; o teste de selos verifica a nova posição.
4. A prévia estática Electro usava o GIF animado embora existisse PNG no índice. Agora usa a imagem estática correspondente, preservando a prévia animada em campo separado. A espera do teste Splash foi sincronizada com o carregamento lazy dos seis src; a falha intermitente foi reproduzida antes do ajuste.

5. O CI remoto confirmou incompatibilidade de Playwright 1.55.1 com Ubuntu 26.04 após a mudança de `ubuntu-latest`. O job frontend foi fixado em `ubuntu-24.04`, preservando a auditoria e os demais checks.

## Verificação

- TypeScript aprovado após restaurar os limites ausentes.
- Suíte completa antes dos últimos ajustes: 1713 testes aprovados, 6 falhas reproduzidas, 2 ignorados (218 arquivos). As seis falhas correspondem aos componentes/preview acima.
- Regressões depois dos ajustes: 79 testes aprovados, cobrindo qualidade fotográfica, arte e Hype/selos.
- Catálogo: 225 testes executados, 13 ignorados, sem falhas.
- A segunda execução remota passou nos testes e build e parou apenas na instalação do Chromium no runner incompatível; a correção de runner foi enviada para nova validação.
- Build de produção Next.js aprovado. A primeira tentativa local falhou pelo link externo de node_modules do worktree; dependências locais corrigidas e build repetido, sem alterar configuração de produção.
- Nenhum dado do MySQL, chave de criptografia, migração aplicada ou variável secreta foi alterado.

## Acesso e publicação

Projeto Vercel identificado: `fashion-ai-tcc-2026`, equipe `matheushaliskis-projects`. A conexão desta sessão retorna 403 ao consultar deployments dessa equipe. Railway: integração GitHub identifica o serviço `api` do projeto, mas não há credencial Railway nesta sessão para consultar/republicar diretamente. O push/PR permite observar os resultados das integrações Git existentes; sua conclusão deve ser verificada antes de declarar deploy finalizado.

Não foram transportados tokens nem conteúdo de logs secretos para este relatório. Falhas históricas de gitleaks não foram contornadas ou desabilitadas.
