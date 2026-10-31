# Inventário de complexidade — FashionAI

Base: `7b473d2b3687865624fb25fe2091f9bc8f048436`. 2662 arquivos de código; 352300 linhas físicas.

CSV completo: [file-complexity.csv](file-complexity.csv). Dados e ciclos: [inventory.json](inventory.json).

## Método e limites

Ranking = 20% tamanho + 25% proxy de complexidade + 20% responsabilidades inferidas + 15% imports internos resolvidos + 10% duplicação candidata + 10% dificuldade de teste inferida. Fórmulas em `scripts/refactoring/audit_repository.py`. Não é complexidade ciclomática certificada nem classificação humana de responsabilidades. Python usa AST; Java/JS/TS usam estimativas lexicais. Linhas úteis excluem brancos e linhas iniciadas por comentários, sem parser completo de comentários multilinha. Hooks contam definições próprias, não chamadas. Testes associados são candidatos por nome/referência textual, não prova de cobertura. Duplicação = blocos não sobrepostos de 10 linhas significativas normalizadas, incluindo fixtures; exige revisão humana. Imports Python dinâmicos, aliases não triviais e bytecode não são resolvidos.

Triagem: >250 revisão; >400 prioridade; >600 alta; >1000 crítica. Tamanho não impõe extração. Tests e migrations constam no CSV, mas não no top 30 de produção. Arquivos gerados, dependências, binários e outputs foram excluídos. Não há execução de banco, rede, modelos ou aplicações neste script.

## Top 30 de produção

| Arquivo | Linhas | Funções* | Imports internos | Ramos* | Score | Risco |
|---|---:|---:|---:|---:|---:|---|
| `fai-application/src/main/java/br/com/fashionai/application/service/ChallengeService.java` | 1888 | 47 | 45 | 441 | 69.27 | high |
| `fai-application/src/main/java/br/com/fashionai/application/service/CopilotService.java` | 1419 | 27 | 36 | 318 | 69.06 | high |
| `fai-application/src/main/java/br/com/fashionai/application/service/WardrobeService.java` | 2827 | 101 | 67 | 695 | 66.76 | high |
| `fai-application/src/main/java/br/com/fashionai/application/service/SchemeService.java` | 1311 | 49 | 55 | 321 | 66.1 | high |
| `fai-application/src/main/java/br/com/fashionai/application/service/FlairChallengeService.java` | 1035 | 24 | 31 | 238 | 65.33 | high |
| `fai-application/src/main/java/br/com/fashionai/application/service/DnaService.java` | 1461 | 46 | 47 | 313 | 64.11 | medium |
| `fai-application/src/main/java/br/com/fashionai/application/lens/LensService.java` | 1427 | 40 | 52 | 272 | 64.1 | medium |
| `fai-application/src/main/java/br/com/fashionai/application/service/SealService.java` | 2150 | 90 | 60 | 612 | 64.1 | high |
| `fai-application/src/main/java/br/com/fashionai/application/moments/MomentService.java` | 1902 | 52 | 48 | 458 | 63.12 | low |
| `fai-application/src/main/java/br/com/fashionai/application/service/MirrorService.java` | 1254 | 41 | 34 | 308 | 63.02 | medium |
| `fai-application/src/main/java/br/com/fashionai/application/catalog/image/CatalogImagePipelineService.java` | 1025 | 52 | 17 | 378 | 62.79 | medium |
| `fai-application/src/main/java/br/com/fashionai/application/insights/PersonalInsights.java` | 631 | 7 | 25 | 145 | 62.66 | low |
| `fai-application/src/main/java/br/com/fashionai/application/service/BackgroundStudioService.java` | 812 | 30 | 25 | 247 | 61.95 | medium |
| `fai-application/src/main/java/br/com/fashionai/application/service/RoomService.java` | 1533 | 57 | 45 | 316 | 61.59 | medium |
| `fai-application/src/main/java/br/com/fashionai/application/service/Avatar3dService.java` | 889 | 38 | 20 | 284 | 59.99 | medium |
| `fai-application/src/main/java/br/com/fashionai/application/service/InstitutionalService.java` | 767 | 17 | 47 | 171 | 59.4 | low |
| `scripts/diagramas/v5/gerar.py` | 1430 | 57 | 5 | 637 | 59.1 | medium |
| `components/catalog/catalog-search.tsx` | 567 | 16 | 23 | 362 | 58.95 | low |
| `lib/avatar3d/human/garments.ts` | 1205 | 57 | 8 | 688 | 58.14 | high |
| `fai-application/src/main/java/br/com/fashionai/application/service/FlairService.java` | 1117 | 45 | 45 | 216 | 57.6 | medium |
| `components/room3d/room-scene.tsx` | 1005 | 58 | 13 | 561 | 57.09 | high |
| `fai-application/src/main/java/br/com/fashionai/application/service/FlairModesService.java` | 1643 | 50 | 31 | 272 | 56.38 | low |
| `fai-application/src/main/java/br/com/fashionai/application/service/InventoryScoreService.java` | 1295 | 50 | 36 | 244 | 55.26 | low |
| `components/expanded-card/expanded-piece.tsx` | 256 | 13 | 45 | 171 | 55.16 | low |
| `app/(site)/(app)/room/page.tsx` | 665 | 44 | 27 | 395 | 54.52 | low |
| `fai-application/src/main/java/br/com/fashionai/application/insights/PublicInsights.java` | 513 | 6 | 13 | 128 | 54.26 | low |
| `components/multi-piece-review.tsx` | 682 | 31 | 16 | 351 | 54.17 | low |
| `fai-application/src/main/java/br/com/fashionai/application/hype/HypeQueryService.java` | 1512 | 47 | 30 | 309 | 53.65 | low |
| `fai-application/src/main/java/br/com/fashionai/application/service/IdentityService.java` | 1079 | 53 | 33 | 209 | 53.39 | low |
| `fai-application/src/main/java/br/com/fashionai/application/service/LookbookService.java` | 781 | 26 | 39 | 142 | 53.08 | medium |

## Contagens de triagem

- Mais de 250 linhas: 329 arquivos.
- Mais de 400 linhas: 147 arquivos.
- Mais de 600 linhas: 71 arquivos.
- Mais de 1000 linhas: 28 arquivos.

Ciclos estáticos resolvidos: 10 componentes fortemente conectados. Resultado não prova ausência de ciclos de runtime.
