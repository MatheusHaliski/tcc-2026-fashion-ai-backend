# R04 — testes de Momentos e Selos dentro do limite (≤ 400)

Branch `gof/r04-testes`. Escopo: só código de **teste** em `fai-application/src/test/java/br/com/fashionai/application/`.
Nenhuma linha de produção alterada.

## Método

1. **Caracterização antes** (código original): as 8 classes rodadas, relatórios surefire guardados e a lista de testes
   extraída (`testcase@name` + situação, sem a classe, ordenada).
2. **Divisão mecânica por intervalos de linhas**: cada classe original foi copiada para suas novas classes por faixas de
   linhas do arquivo original (seções temáticas já marcadas por `// ----`). Os métodos `@Test`/`@ParameterizedTest`
   foram movidos sem edição; os imports de cada arquivo novo são o subconjunto usado.
3. **Suporte compartilhado**: campos, `@BeforeEach` e helpers de cenário foram para uma classe base abstrata
   `*Fixture` (mesmo pacote). A única mudança textual nessas linhas é retirar `private` (para a subclasse enxergar).
4. **Prova de movimentação**: multiconjunto das linhas não vazias do corpo de cada classe original (ignorando
   `private `) = multiconjunto das linhas dos corpos das classes geradas → **0 linhas faltando, 0 extras** nos 8
   arquivos; anotações de teste 150 → 150.
5. **Prova por execução**: lista de testes (nome sem a classe + situação) **idêntica** antes/depois — 171 = 171,
   `diff` vazio, todos OK.

## Por arquivo

| Arquivo original (linhas) | Depois | Arquivos novos (linhas) | Testes antes → depois |
|---|---|---|---|
| moments/MomentServiceAcoesTest (510) | 293 | MomentServiceComunidadeTest (236); helper `code(Throwable,String)` movido para MomentServiceFixture (210 → 217) | 26 → 13 + 13 |
| moments/MomentServiceConsultasTest (505) | 218 | MomentServiceHistoricoTest (306) | 30 → 13 + 17 |
| moments/MomentServiceGrupoAdminTest (429) | 291 | MomentServiceJobTest (161) | 17 → 11 + 6 |
| moments/MomentServiceRulesTest (468) | 105 | MomentServiceRulesFixture (262), MomentServiceRulesReviewTest (141) | 12 → 5 + 7 |
| service/InstitutionalDisplayPolicyTest (653) | 246 | InstitutionalDisplayPolicyFixture (269), InstitutionalDisplayRankingTest (198) | 26 → 17 + 9 |
| service/SealHypeServiceTest (640) | 236 | SealHypeServiceFixture (311), SealHypeIssuerPiecesTest (155) | 14 → 9 + 5 |
| service/SealPromotionFlowTest (505) | 126 | SealPromotionFlowFixture (326), SealPromotionLifecycleTest (93) | 11 → 6 + 5 |
| service/SealCreatorsCoverageTest (446) | 160 | SealCreatorsCoverageFixture (220), SealDetectionCoverageTest (106) | 35 → 27 + 8 (14 métodos; parametrizados) |

Temas: Ações = salvar/participar/sair/enviar look · Comunidade = voto/feed/ranking/em alta/badge/flair · Consultas =
home/banner/calendário/detalhe · Histórico = Meus Momentos/linha do tempo/Replay/contexto/listas · GrupoAdmin =
grupo FLAIR + administração · Job = tick/encerramento/Memória · Rules = privacidade/voto/job · RulesReview = achados
do review do PR · InstitutionalDisplayPolicy = perfil + looks · InstitutionalDisplayRanking = ordenação das abas,
feeds "Em alta", peças em destaque, catálogo · SealHypeService = copilot/sugestões/Hype do selo · SealHypeIssuerPieces
= métricas do emissor, selos das peças, anti pay-to-win · SealPromotionFlow = marca + celebridade · Lifecycle = teto,
revogação, revalidação, privacidade, duplicidade · SealCreatorsCoverage = criadores manual/IA · SealDetectionCoverage =
detecção automática + seletor manual.

## Padrão GoF

- **Template Method** (legítimo, setup comum de teste): cada `*Fixture` abstrata define o passo fixo
  (`@BeforeEach` herdado que monta repositórios simulados/serviços e relógio) e os helpers de cenário; as subclasses
  só declaram os testes. Já era o desenho de `MomentServiceFixture` (Ações/Consultas/GrupoAdmin e as novas
  Comunidade/Histórico/Job reutilizam-no); criado igual para Rules, InstitutionalDisplayPolicy, SealHypeService,
  SealPromotionFlow e SealCreatorsCoverage. Nenhuma interface nova; nenhum Singleton.
- Nas classes de teste em si: **NENHUM** outro padrão — são listas de casos; inventar estrutura seria artificial.

## Comandos

```
# antes (código original) e depois (classes novas listadas explicitamente)
mvn -B -q -o -pl fai-application -Dtest='MomentServiceAcoesTest,MomentServiceConsultasTest,MomentServiceGrupoAdminTest,MomentServiceRulesTest,InstitutionalDisplayPolicyTest,SealHypeServiceTest,SealPromotionFlowTest,SealCreatorsCoverageTest' -Dsurefire.failIfNoSpecifiedTests=false test
mvn -B -q -o -pl fai-application -Dtest='MomentServiceAcoesTest,MomentServiceComunidadeTest,MomentServiceConsultasTest,MomentServiceHistoricoTest,MomentServiceGrupoAdminTest,MomentServiceJobTest,MomentServiceRulesTest,MomentServiceRulesReviewTest,InstitutionalDisplayPolicyTest,InstitutionalDisplayRankingTest,SealHypeServiceTest,SealHypeIssuerPiecesTest,SealPromotionFlowTest,SealPromotionLifecycleTest,SealCreatorsCoverageTest,SealDetectionCoverageTest' -Dsurefire.failIfNoSpecifiedTests=false test
# lista de nomes: <testcase name> + OK/FAIL/SKIP de target/surefire-reports/TEST-*.xml, ordenada; diff antes/depois vazio
python3 scripts/refactoring/line_ratchet.py            # 0 violações (260 → 252 congelados)
python3 scripts/refactoring/line_ratchet.py --update   # 8 entradas removidas do baseline
```

Resultado: antes 8 classes / 171 testes OK; depois 16 classes / 171 testes OK; nomes idênticos.

## Pendências

Nenhuma: todos os 8 arquivos e os novos suportes estão ≤ 400 linhas.
