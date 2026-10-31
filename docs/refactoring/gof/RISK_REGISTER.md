# Registro de riscos

| Área | Risco de regressão | Antes de refatorar |
|---|---|---|
| WardrobeService | Propriedade, conservação/FKs, imagem e alterações parciais | Contratos de edição e rollback, ausência de escolha vs default |
| ChallengeService | Recompensas duplicadas e listeners after-commit | Caracterizar idempotência e fase transacional |
| CopilotService | Seleção de provedores e efeitos remotos | Fixtures sem chamada paga e contratos de fallback |
| SchemeService | Permissões, combinação de peças e atualização de estado | Caracterizar usuário/visitante e transações |
| SealService | Entitlements e configuração visual licenciada | Comparar configuração completa e usuários sem licença |

Esses cinco são revisão humana inicial de risco, não os cinco primeiros do score automático. Ranking é triagem; tamanho não prova responsabilidade incorreta.

Build final aprovado, conforme QUALITY_SCORECARD.md. Tentativas anteriores falharam durante restrição de disco/resolução de módulos na saída externa; foram corrigidas no ambiente local, mantendo .next no checkout e apenas cache fora. Nenhuma configuração produtiva foi alterada.

Dependências reutilizadas: Next instalado16.4.2 vs declarado^16.4.3. O CI ainda precisa validar instalação limpa. Browser com API simulada e geometria sintética passou; não comprova contratos/backend/banco reais ou fidelidade visual de roupas.

Editor permanece632 linhas (HIGH), com coordenação assíncrona não extraída neste lote. Exceção temporária documentada em LINE_LIMITS.md; não declarar refatoração integral concluída.
