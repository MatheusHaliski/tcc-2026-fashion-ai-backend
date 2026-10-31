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

## Achados da onda 02–20 (preservados; corrigir exige lote próprio e decisão de produto)

| Domínio | Achado | Risco | Próximo passo |
|---|---|---|---|
| 10 selos | `SealService.redeem` garante unicidade do código do cupom consultando `promotions.findByCode` (tabela de promoções), não a de resgates | Código repetido só é barrado se houver constraint no banco | Confirmar constraint em migration; se ausente, corrigir a consulta com teste |
| 10 selos | `brands/[slug]/page.tsx` oferece status `DRAFT/ACTIVE/PAUSED/ENDED`; o enum `PromotionStatus` é `AVAILABLE/REDEEMED/EXPIRED/REVOKED` | `PUT /api/promotions/{id}/status` provavelmente falha pela UI | Teste de contrato UI↔API e alinhar os valores |
| 10 selos | Estoque 1 / limite por pessoa sob requisições simultâneas depende de `PESSIMISTIC_WRITE` em `findForRedeem` | Não verificável sem banco | Teste de integração com banco isolado |
| 07 social | Curtir/salvar concorrente depende da constraint única do banco | Duplicidade sob corrida | Teste de integração com banco isolado |
| 20 admin | `moderate` permite redecidir item já aprovado/rejeitado | Trilha de moderação pode ser sobrescrita | Decidir se a transição deve ser bloqueada (State) |
| 20 admin | Views admin com `Map.of` lançam NPE se campo obrigatório vier nulo | 500 em dado legado incompleto | Caracterizar dados reais anonimizados antes de mudar |
| 17 persistência | SQL de `topUsers`/`hypeLevelsV2` cola filtro sem espaço (`:profile)HAVING`) | Aceito pelo MySQL; frágil a mudança de dialeto | Corrigir junto com teste golden |
| 15 rotas | `app/pages.smoke.test.tsx`: 8 falhas por timeout em `lab/heist*`, também no código original | CI de frontend instável | Investigar tempo de render das páginas lab |
| 08 hype | `CopilotService.purchaseSuggestions` sem teste direto (coberto só pela caracterização de combos) | Regressão silenciosa | Teste direto no lote 13 |
| 19 adapters | `storage-s3` não tem dependência de teste; Redis sem caracterização de chaves/TTL; não há outbox para eventos | Mudanças futuras sem rede de proteção | Adicionar test scope e caracterizar antes de refatorar |
