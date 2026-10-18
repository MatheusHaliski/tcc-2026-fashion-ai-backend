# Verificação da edição de AURAs — 18/10/2026

## Resultados locais

- 156 testes de frontend aprovados: suíte focada de 156 testes em 27 arquivos, incluindo 3 testes do player privado. Cobrem cartelas, 40 tratamentos Hype, consentimento/bloqueio, upload e requisição de job, catálogo contextual e carregamento autenticado de vídeo.
- 61 testes Java aprovados: AuraMotionService (17), upload pessoal (3), escopo privado (1), provador anatômico (11), Background Studio (11), ofertas de selos Hype (18). Compilação dos módulos application, ai-providers e web aprovada com Java 21.
- 4 testes Python aprovados para pesquisa e QA técnico de vídeo.
- `npm run lint` aprovado, incluindo TypeScript, estilos, design e verificações i18n. Há avisos preexistentes de nomes próprios iguais entre idiomas.
- `npm run build` aprovado: compilação Next.js, TypeScript e geração das 75 páginas.
- `git diff origin/main --check` aprovado.
- Build e 156 testes repetidos após integrar a main `e909079f`, preservando as atualizações de Quarto/Provador e resolvendo os catálogos de tradução.

Os testes Java usam repositórios/worker simulados. Não equivalem a aplicar a migração V73 nem a executar um teste de concorrência contra MySQL. O mock nunca comprova geração de vídeo pessoal.

## Evidência visual

[Capturas e descrição dos testes de navegador](../testes/aura-studio-2026-10-18/README.md). Os três PNGs estão versionados no Git e identificados como teste local com APIs simuladas. Não retratam inferência GPU nem contas reais em produção.

## Gates para habilitação em produção

1. Implementar e operar o worker privado de segmentação, validação de roupa, transferência de movimento, VFX e QA conforme [contrato](AURA_MOTION_WORKER_CONTRACT.md). A integração permanece indisponível sem as variáveis do servidor.
2. Aplicar e verificar V73 no ambiente de banco correspondente; testar transações e concorrência com o banco real.
3. Definir retenção/exclusão de originais, derivados e temporários do worker/storage.
4. Validar identidade, preservação da peça, loop e recursos/latência reais na GPU escolhida. A pesquisa de oito fontes não é um benchmark.
5. Ampliar para looks e demais produtores de direitos artísticos quando implementados. Esta edição não completa todos os requisitos históricos de loja, jogos e promoções.

Nenhuma GPU foi provisionada nem vídeo pessoal foi gerado nesta sessão. Fotos de entrada e resultados permanecem no storage restrito; a rota do card verifica visibilidade e aplicação atual antes de servir bytes. Não há cópia pública nem concessão automática de XP por upload/visualização.
