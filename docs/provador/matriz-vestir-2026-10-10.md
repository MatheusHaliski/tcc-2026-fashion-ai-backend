# Matriz de vestir — acervo × corpos × poses (2026-10-10)

Gerada por `scripts/tryon/matrix-report.py` a partir de `metricas/vestir-antes-2026-10-10.json` e `metricas/vestir-depois-2026-10-10.json` (harness `lib/avatar3d/human/fit-matrix.ts`, o mesmo caminho de montagem do provador). Asset: molde estimado (casca do corpo + foto da frente) — nenhuma peça tem malha de vestimenta aprovada. Tamanho: o do corpo (sem grade de tamanhos). Cenário: corpo isolado (métrica); as capturas em loja estão em `img/2026-10-10/vestir/`. Tolerâncias de penetração por pose: exibição 3%, braços 1,5%, caminhada 3,5%, agachamento 6% (§8 da auditoria).

| ID do acervo | molde | corpo | pose | resultado | defeito | correção (antes→depois) | evidência |
|---|---|---|---|---|---|---|---|
| `01_parte_superior_01_camiseta_referencia` | tee | F-ref | exibicao | ok · penetração 1.6% | — | cintura/busto 0.98→0.99 (corpo 0.94) | vestir/camiseta-jeans |
| `01_parte_superior_01_camiseta_referencia` | tee | F-ref | bracos | ok · penetração 0.4% | — | — | vestir/camiseta-jeans |
| `01_parte_superior_01_camiseta_referencia` | tee | F-ref | caminhada | ok · penetração 1.8% | — | — | vestir/camiseta-jeans |
| `01_parte_superior_01_camiseta_referencia` | tee | F-ref | agachamento | ok · penetração 4.4% | — | — | vestir/camiseta-jeans |
| `01_parte_superior_02_shirt_camisa` | shirt | F-ref | exibicao | ok · penetração 0.5% | — | cintura/busto 0.98→1 (corpo 0.94) | vestir/camisa-chino |
| `01_parte_superior_02_shirt_camisa` | shirt | F-ref | bracos | ok · penetração 0.4% | — | — | vestir/camisa-chino |
| `01_parte_superior_02_shirt_camisa` | shirt | F-ref | caminhada | ok · penetração 0.7% | — | — | vestir/camisa-chino |
| `01_parte_superior_02_shirt_camisa` | shirt | F-ref | agachamento | ok · penetração 3.3% | — | — | vestir/camisa-chino |
| `01_parte_superior_03_blouse_blusa` | shirt | F-ref | exibicao | ok · penetração 0.5% | — | cintura/busto 0.98→1 (corpo 0.94) | métricas JSON |
| `01_parte_superior_03_blouse_blusa` | shirt | F-ref | bracos | ok · penetração 0.4% | — | — | métricas JSON |
| `01_parte_superior_03_blouse_blusa` | shirt | F-ref | caminhada | ok · penetração 0.7% | — | — | métricas JSON |
| `01_parte_superior_03_blouse_blusa` | shirt | F-ref | agachamento | ok · penetração 3.3% | — | — | métricas JSON |
| `01_parte_superior_04_tank_top_regata` | tank | F-ref | exibicao | ok · penetração 0.2% | — | cintura/busto 0.96→0.94 (corpo 0.94) | métricas JSON |
| `01_parte_superior_04_tank_top_regata` | tank | F-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `01_parte_superior_04_tank_top_regata` | tank | F-ref | caminhada | ok · penetração 0.2% | — | — | métricas JSON |
| `01_parte_superior_04_tank_top_regata` | tank | F-ref | agachamento | ok · penetração 4.0% | — | — | métricas JSON |
| `01_parte_superior_05_crop_top_cropped` | crop | F-ref | exibicao | ok · penetração 1.1% | — | — | métricas JSON |
| `01_parte_superior_05_crop_top_cropped` | crop | F-ref | bracos | ok · penetração 0.6% | — | — | métricas JSON |
| `01_parte_superior_05_crop_top_cropped` | crop | F-ref | caminhada | ok · penetração 1.0% | — | — | métricas JSON |
| `01_parte_superior_05_crop_top_cropped` | crop | F-ref | agachamento | ok · penetração 1.1% | — | — | métricas JSON |
| `01_parte_superior_06_polo_shirt_camisa_polo` | tee | F-ref | exibicao | ok · penetração 1.6% | — | cintura/busto 0.98→0.99 (corpo 0.94) | métricas JSON |
| `01_parte_superior_06_polo_shirt_camisa_polo` | tee | F-ref | bracos | ok · penetração 0.4% | — | — | métricas JSON |
| `01_parte_superior_06_polo_shirt_camisa_polo` | tee | F-ref | caminhada | ok · penetração 1.8% | — | — | métricas JSON |
| `01_parte_superior_06_polo_shirt_camisa_polo` | tee | F-ref | agachamento | ok · penetração 4.4% | — | — | métricas JSON |
| `01_parte_superior_07_bodysuit_body` | tank | F-ref | exibicao | ok · penetração 0.2% | — | cintura/busto 0.96→0.94 (corpo 0.94) | métricas JSON |
| `01_parte_superior_07_bodysuit_body` | tank | F-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `01_parte_superior_07_bodysuit_body` | tank | F-ref | caminhada | ok · penetração 0.2% | — | — | métricas JSON |
| `01_parte_superior_07_bodysuit_body` | tank | F-ref | agachamento | ok · penetração 4.0% | — | — | métricas JSON |
| `01_parte_superior_08_sweater_sueter` | sweater | F-ref | exibicao | ok · penetração 0.8% | — | cintura/busto 0.97→0.98 (corpo 0.94) | métricas JSON |
| `01_parte_superior_08_sweater_sueter` | sweater | F-ref | bracos | ok · penetração 0.5% | — | — | métricas JSON |
| `01_parte_superior_08_sweater_sueter` | sweater | F-ref | caminhada | ok · penetração 1.0% | — | — | métricas JSON |
| `01_parte_superior_08_sweater_sueter` | sweater | F-ref | agachamento | ok · penetração 3.4% | — | — | métricas JSON |
| `01_parte_superior_09_sweatshirt_moletom_sem_capuz` | sweater | F-ref | exibicao | ok · penetração 2.2% | — | cintura/busto 0.97→1.05 (corpo 0.93) | métricas JSON |
| `01_parte_superior_09_sweatshirt_moletom_sem_capuz` | sweater | F-ref | bracos | ok · penetração 0.9% | — | — | métricas JSON |
| `01_parte_superior_09_sweatshirt_moletom_sem_capuz` | sweater | F-ref | caminhada | ok · penetração 1.6% | — | — | métricas JSON |
| `01_parte_superior_09_sweatshirt_moletom_sem_capuz` | sweater | F-ref | agachamento | ok · penetração 4.3% | — | — | métricas JSON |
| `01_parte_superior_10_hoodie_moletom_com_capuz` | hoodie | F-ref | exibicao | ok · penetração 2.4% | — | cintura/busto 0.97→1.05 (corpo 0.93) | vestir/moletom-saia |
| `01_parte_superior_10_hoodie_moletom_com_capuz` | hoodie | F-ref | bracos | ok · penetração 0.9% | — | — | vestir/moletom-saia |
| `01_parte_superior_10_hoodie_moletom_com_capuz` | hoodie | F-ref | caminhada | ok · penetração 1.9% | — | — | vestir/moletom-saia |
| `01_parte_superior_10_hoodie_moletom_com_capuz` | hoodie | F-ref | agachamento | ok · penetração 4.2% | — | — | vestir/moletom-saia |
| `01_parte_superior_11_cardigan` | jacket | F-ref | exibicao | ok · penetração 2.5% | — | cintura/busto 1.02→1.04 (corpo 0.92) | métricas JSON |
| `01_parte_superior_11_cardigan` | jacket | F-ref | bracos | ok · penetração 0.7% | — | — | métricas JSON |
| `01_parte_superior_11_cardigan` | jacket | F-ref | caminhada | ok · penetração 2.3% | — | — | métricas JSON |
| `01_parte_superior_11_cardigan` | jacket | F-ref | agachamento | ok · penetração 4.1% | — | — | métricas JSON |
| `01_parte_superior_12_vest_colete` | vest | F-ref | exibicao | ok · penetração 1.6% | — | cintura/busto 1→1.02 (corpo 0.92) | métricas JSON |
| `01_parte_superior_12_vest_colete` | vest | F-ref | bracos | ok · penetração 0.2% | — | — | métricas JSON |
| `01_parte_superior_12_vest_colete` | vest | F-ref | caminhada | ok · penetração 1.5% | — | — | métricas JSON |
| `01_parte_superior_12_vest_colete` | vest | F-ref | agachamento | ok · penetração 5.0% | — | — | métricas JSON |
| `01_parte_superior_13_blazer` | jacket | F-ref | exibicao | ok · penetração 2.7% | — | cintura/busto 1.02→1.01 (corpo 0.93) | métricas JSON |
| `01_parte_superior_13_blazer` | jacket | F-ref | bracos | ok · penetração 1.0% | — | — | métricas JSON |
| `01_parte_superior_13_blazer` | jacket | F-ref | caminhada | ok · penetração 2.5% | — | — | métricas JSON |
| `01_parte_superior_13_blazer` | jacket | F-ref | agachamento | ok · penetração 4.2% | — | — | métricas JSON |
| `01_parte_superior_14_jacket_jaqueta` | jacket | F-ref | exibicao | ok · penetração 2.5% | — | cintura/busto 1.02→1.04 (corpo 0.92) | vestir/jaqueta-shorts |
| `01_parte_superior_14_jacket_jaqueta` | jacket | F-ref | bracos | ok · penetração 0.7% | — | — | vestir/jaqueta-shorts |
| `01_parte_superior_14_jacket_jaqueta` | jacket | F-ref | caminhada | ok · penetração 2.3% | — | — | vestir/jaqueta-shorts |
| `01_parte_superior_14_jacket_jaqueta` | jacket | F-ref | agachamento | ok · penetração 4.1% | — | — | vestir/jaqueta-shorts |
| `01_parte_superior_15_coat_casaco` | coat | F-ref | exibicao | ok · penetração 1.4% | — | cintura/busto 1.03→1.04 (corpo 0.92); folga coxa 4.87→5.09 cm | métricas JSON |
| `01_parte_superior_15_coat_casaco` | coat | F-ref | bracos | ok · penetração 0.4% | — | — | métricas JSON |
| `01_parte_superior_15_coat_casaco` | coat | F-ref | caminhada | ok · penetração 1.3% | — | — | métricas JSON |
| `01_parte_superior_15_coat_casaco` | coat | F-ref | agachamento | ok · penetração 3.9% | — | — | métricas JSON |
| `01_parte_superior_16_parka` | coat | F-ref | exibicao | ok · penetração 1.4% | — | cintura/busto 1.03→1.04 (corpo 0.92); folga coxa 4.87→5.09 cm | métricas JSON |
| `01_parte_superior_16_parka` | coat | F-ref | bracos | ok · penetração 0.4% | — | — | métricas JSON |
| `01_parte_superior_16_parka` | coat | F-ref | caminhada | ok · penetração 1.3% | — | — | métricas JSON |
| `01_parte_superior_16_parka` | coat | F-ref | agachamento | ok · penetração 3.9% | — | — | métricas JSON |
| `01_parte_superior_17_windbreaker_corta_vento` | jacket | F-ref | exibicao | ok · penetração 2.5% | — | cintura/busto 1.02→1.07 (corpo 0.92) | métricas JSON |
| `01_parte_superior_17_windbreaker_corta_vento` | jacket | F-ref | bracos | ok · penetração 0.6% | — | — | métricas JSON |
| `01_parte_superior_17_windbreaker_corta_vento` | jacket | F-ref | caminhada | ok · penetração 2.3% | — | — | métricas JSON |
| `01_parte_superior_17_windbreaker_corta_vento` | jacket | F-ref | agachamento | ok · penetração 3.9% | — | — | métricas JSON |
| `01_parte_superior_18_kimono_quimono` | jacket | F-ref | exibicao | ok · penetração 2.5% | — · limitação: quimono sem manga ampla | cintura/busto 1.02→1.04 (corpo 0.92) | métricas JSON |
| `01_parte_superior_18_kimono_quimono` | jacket | F-ref | bracos | ok · penetração 0.7% | — · limitação: quimono sem manga ampla | — | métricas JSON |
| `01_parte_superior_18_kimono_quimono` | jacket | F-ref | caminhada | ok · penetração 2.3% | — · limitação: quimono sem manga ampla | — | métricas JSON |
| `01_parte_superior_18_kimono_quimono` | jacket | F-ref | agachamento | ok · penetração 4.1% | — · limitação: quimono sem manga ampla | — | métricas JSON |
| `02_parte_inferior_01_jeans` | pants | F-ref | exibicao | ok · penetração 0.0% | — | barra/joelho 0.84→0.93; folga coxa 0.49→1.26 cm; folga joelho 0.62→1.79 cm; folga panturrilha 1.07→2.25 cm | vestir/camiseta-jeans |
| `02_parte_inferior_01_jeans` | pants | F-ref | bracos | ok · penetração 0.0% | — | — | vestir/camiseta-jeans |
| `02_parte_inferior_01_jeans` | pants | F-ref | caminhada | ok · penetração 0.0% | — | — | vestir/camiseta-jeans |
| `02_parte_inferior_01_jeans` | pants | F-ref | agachamento | ok · penetração 3.1% | — | — | vestir/camiseta-jeans |
| `02_parte_inferior_02_calca_casual` | pants | F-ref | exibicao | ok · penetração 0.0% | — | barra/joelho 0.84→0.93; folga coxa 0.49→1.26 cm; folga joelho 0.62→1.79 cm; folga panturrilha 1.07→2.25 cm | métricas JSON |
| `02_parte_inferior_02_calca_casual` | pants | F-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_02_calca_casual` | pants | F-ref | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_02_calca_casual` | pants | F-ref | agachamento | ok · penetração 3.1% | — | — | métricas JSON |
| `02_parte_inferior_03_calca_alfaiataria` | pants | F-ref | exibicao | ok · penetração 0.0% | — | barra/joelho 0.84→0.94; folga coxa 0.49→1.17 cm; folga joelho 0.62→1.68 cm; folga panturrilha 1.07→2.15 cm | métricas JSON |
| `02_parte_inferior_03_calca_alfaiataria` | pants | F-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_03_calca_alfaiataria` | pants | F-ref | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_03_calca_alfaiataria` | pants | F-ref | agachamento | ok · penetração 2.9% | — | — | métricas JSON |
| `02_parte_inferior_04_calca_cargo` | pants | F-ref | exibicao | ok · penetração 0.0% | — | barra/joelho 0.84→1.03; folga coxa 0.49→3.46 cm; folga joelho 0.62→5.03 cm; folga panturrilha 1.07→4.61 cm | métricas JSON |
| `02_parte_inferior_04_calca_cargo` | pants | F-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_04_calca_cargo` | pants | F-ref | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_04_calca_cargo` | pants | F-ref | agachamento | ok · penetração 5.2% | — | — | métricas JSON |
| `02_parte_inferior_05_calca_chino` | pants | F-ref | exibicao | ok · penetração 0.0% | — | barra/joelho 0.84→0.93; folga coxa 0.49→1.26 cm; folga joelho 0.62→1.79 cm; folga panturrilha 1.07→2.25 cm | vestir/camisa-chino |
| `02_parte_inferior_05_calca_chino` | pants | F-ref | bracos | ok · penetração 0.0% | — | — | vestir/camisa-chino |
| `02_parte_inferior_05_calca_chino` | pants | F-ref | caminhada | ok · penetração 0.0% | — | — | vestir/camisa-chino |
| `02_parte_inferior_05_calca_chino` | pants | F-ref | agachamento | ok · penetração 3.1% | — | — | vestir/camisa-chino |
| `02_parte_inferior_06_calca_moletom` | pants | F-ref | exibicao | ok · penetração 0.0% | — | barra/joelho 0.84→0.74; folga coxa 0.49→1.16 cm; folga joelho 0.62→1.02 cm; folga panturrilha 1.07→1.27 cm | métricas JSON |
| `02_parte_inferior_06_calca_moletom` | pants | F-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_06_calca_moletom` | pants | F-ref | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_06_calca_moletom` | pants | F-ref | agachamento | ok · penetração 2.4% | — | — | métricas JSON |
| `02_parte_inferior_07_calca_jogger` | pants | F-ref | exibicao | ok · penetração 0.0% | — | barra/joelho 0.84→0.74; folga coxa 0.49→1.16 cm; folga joelho 0.62→1.02 cm; folga panturrilha 1.07→1.27 cm | métricas JSON |
| `02_parte_inferior_07_calca_jogger` | pants | F-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_07_calca_jogger` | pants | F-ref | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_07_calca_jogger` | pants | F-ref | agachamento | ok · penetração 2.4% | — | — | métricas JSON |
| `02_parte_inferior_08_legging` | leggings | F-ref | exibicao | ok · penetração 0.1% | — | barra/joelho 0.56→0.56; folga coxa 0.17→0.13 cm; folga joelho 0.18→0.14 cm; folga panturrilha 0.16→0.12 cm | métricas JSON |
| `02_parte_inferior_08_legging` | leggings | F-ref | bracos | ok · penetração 0.1% | — | — | métricas JSON |
| `02_parte_inferior_08_legging` | leggings | F-ref | caminhada | ok · penetração 0.1% | — | — | métricas JSON |
| `02_parte_inferior_08_legging` | leggings | F-ref | agachamento | ok · penetração 0.4% | — | — | métricas JSON |
| `02_parte_inferior_09_pantacourt` | culottes | F-ref | exibicao | ok · penetração 0.0% | — | folga coxa 0.66→1.66 cm; folga joelho 1.21→2.86 cm; folga panturrilha 2.57→4.08 cm | métricas JSON |
| `02_parte_inferior_09_pantacourt` | culottes | F-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_09_pantacourt` | culottes | F-ref | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_09_pantacourt` | culottes | F-ref | agachamento | ok · penetração 5.1% | — | — | métricas JSON |
| `02_parte_inferior_10_bermuda` | bermuda | F-ref | exibicao | ok · penetração 0.0% | — | folga coxa 0.49→1.26 cm; folga joelho 0.56→1.83 cm | métricas JSON |
| `02_parte_inferior_10_bermuda` | bermuda | F-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_10_bermuda` | bermuda | F-ref | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_10_bermuda` | bermuda | F-ref | agachamento | ok · penetração 4.4% | — | — | métricas JSON |
| `02_parte_inferior_11_shorts_jeans` | shorts | F-ref | exibicao | ok · penetração 0.0% | — | folga coxa 0.38→0.48 cm | métricas JSON |
| `02_parte_inferior_11_shorts_jeans` | shorts | F-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_11_shorts_jeans` | shorts | F-ref | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_11_shorts_jeans` | shorts | F-ref | agachamento | ok · penetração 2.2% | — | — | métricas JSON |
| `02_parte_inferior_12_saia` | skirt | F-ref | exibicao | ok · penetração 0.0% | — | folga coxa 5.28→5.85 cm | vestir/moletom-saia |
| `02_parte_inferior_12_saia` | skirt | F-ref | bracos | ok · penetração 0.0% | — | — | vestir/moletom-saia |
| `02_parte_inferior_12_saia` | skirt | F-ref | caminhada | ok · penetração 0.0% | — | — | vestir/moletom-saia |
| `02_parte_inferior_12_saia` | skirt | F-ref | agachamento | ok · penetração 5.4% | — | — | vestir/moletom-saia |
| `02_parte_inferior_13_shorts` | shorts | F-ref | exibicao | ok · penetração 0.0% | — | folga coxa 0.38→0.48 cm | vestir/jaqueta-shorts |
| `02_parte_inferior_13_shorts` | shorts | F-ref | bracos | ok · penetração 0.0% | — | — | vestir/jaqueta-shorts |
| `02_parte_inferior_13_shorts` | shorts | F-ref | caminhada | ok · penetração 0.0% | — | — | vestir/jaqueta-shorts |
| `02_parte_inferior_13_shorts` | shorts | F-ref | agachamento | ok · penetração 2.2% | — | — | vestir/jaqueta-shorts |
| `02_parte_inferior_14_short_saia` | skirt | F-ref | exibicao | ok · penetração 0.0% | — · limitação: saia-short como saia | folga coxa 5.28→5.85 cm | métricas JSON |
| `02_parte_inferior_14_short_saia` | skirt | F-ref | bracos | ok · penetração 0.0% | — · limitação: saia-short como saia | — | métricas JSON |
| `02_parte_inferior_14_short_saia` | skirt | F-ref | caminhada | ok · penetração 0.0% | — · limitação: saia-short como saia | — | métricas JSON |
| `02_parte_inferior_14_short_saia` | skirt | F-ref | agachamento | ok · penetração 5.4% | — · limitação: saia-short como saia | — | métricas JSON |
| `05_corpo_inteiro_01_vestido` | dress | F-ref | exibicao | ok · penetração 0.3% | — | cintura/busto 0.95→1.01 (corpo 0.93) | vestir/vestido-bota |
| `05_corpo_inteiro_01_vestido` | dress | F-ref | bracos | ok · penetração 0.0% | — | — | vestir/vestido-bota |
| `05_corpo_inteiro_01_vestido` | dress | F-ref | caminhada | ok · penetração 0.4% | — | — | vestir/vestido-bota |
| `05_corpo_inteiro_01_vestido` | dress | F-ref | agachamento | ok · penetração 0.9% | — | — | vestir/vestido-bota |
| `05_corpo_inteiro_02_macacao` | jumpsuit | F-ref | exibicao | ok · penetração 0.7% | — | barra/joelho –→0.94; cintura/busto 0.96→1 (corpo 0.94); folga coxa 3.44→1.24 cm | métricas JSON |
| `05_corpo_inteiro_02_macacao` | jumpsuit | F-ref | bracos | ok · penetração 0.1% | — | — | métricas JSON |
| `05_corpo_inteiro_02_macacao` | jumpsuit | F-ref | caminhada | ok · penetração 0.5% | — | — | métricas JSON |
| `05_corpo_inteiro_02_macacao` | jumpsuit | F-ref | agachamento | ok · penetração 2.2% | — | — | métricas JSON |
| `05_corpo_inteiro_03_macaquinho` | romper | F-ref | exibicao | ok · penetração 0.9% | — | cintura/busto 0.96→1 (corpo 0.94); folga coxa 3.53→0.75 cm | métricas JSON |
| `05_corpo_inteiro_03_macaquinho` | romper | F-ref | bracos | ok · penetração 0.2% | — | — | métricas JSON |
| `05_corpo_inteiro_03_macaquinho` | romper | F-ref | caminhada | ok · penetração 0.7% | — | — | métricas JSON |
| `05_corpo_inteiro_03_macaquinho` | romper | F-ref | agachamento | ok · penetração 1.6% | — | — | métricas JSON |
| `05_corpo_inteiro_04_conjunto_coordenado` | jumpsuit | F-ref | exibicao | ok · penetração 0.7% | — · limitação: conjunto como peça única | barra/joelho –→0.94; cintura/busto 0.96→1 (corpo 0.94); folga coxa 3.44→1.24 cm | métricas JSON |
| `05_corpo_inteiro_04_conjunto_coordenado` | jumpsuit | F-ref | bracos | ok · penetração 0.1% | — · limitação: conjunto como peça única | — | métricas JSON |
| `05_corpo_inteiro_04_conjunto_coordenado` | jumpsuit | F-ref | caminhada | ok · penetração 0.5% | — · limitação: conjunto como peça única | — | métricas JSON |
| `05_corpo_inteiro_04_conjunto_coordenado` | jumpsuit | F-ref | agachamento | ok · penetração 2.2% | — · limitação: conjunto como peça única | — | métricas JSON |
| `05_corpo_inteiro_05_jardineira` | jumpsuit | F-ref | exibicao | ok · penetração 0.7% | — · limitação: jardineira sem peitilho | barra/joelho –→0.94; cintura/busto 0.96→1 (corpo 0.94); folga coxa 3.44→1.24 cm | métricas JSON |
| `05_corpo_inteiro_05_jardineira` | jumpsuit | F-ref | bracos | ok · penetração 0.1% | — · limitação: jardineira sem peitilho | — | métricas JSON |
| `05_corpo_inteiro_05_jardineira` | jumpsuit | F-ref | caminhada | ok · penetração 0.5% | — · limitação: jardineira sem peitilho | — | métricas JSON |
| `05_corpo_inteiro_05_jardineira` | jumpsuit | F-ref | agachamento | ok · penetração 2.2% | — · limitação: jardineira sem peitilho | — | métricas JSON |
| `03_calcados_01_tenis_casual` | shoes | F-ref | exibicao | forma do calçado (molde do pé oculto) | — | — | vestir/camiseta-jeans |
| `03_calcados_01_tenis_casual` | shoes | F-ref | bracos | forma do calçado (molde do pé oculto) | — | — | vestir/camiseta-jeans |
| `03_calcados_01_tenis_casual` | shoes | F-ref | caminhada | forma do calçado (molde do pé oculto) | — | — | vestir/camiseta-jeans |
| `03_calcados_01_tenis_casual` | shoes | F-ref | agachamento | forma do calçado (molde do pé oculto) | — | — | vestir/camiseta-jeans |
| `03_calcados_02_tenis_corrida` | shoes | F-ref | exibicao | forma do calçado (molde do pé oculto) | — | — | vestir/jaqueta-shorts |
| `03_calcados_02_tenis_corrida` | shoes | F-ref | bracos | forma do calçado (molde do pé oculto) | — | — | vestir/jaqueta-shorts |
| `03_calcados_02_tenis_corrida` | shoes | F-ref | caminhada | forma do calçado (molde do pé oculto) | — | — | vestir/jaqueta-shorts |
| `03_calcados_02_tenis_corrida` | shoes | F-ref | agachamento | forma do calçado (molde do pé oculto) | — | — | vestir/jaqueta-shorts |
| `03_calcados_05_loafer` | shoes | F-ref | exibicao | forma do calçado (molde do pé oculto) | — | — | métricas JSON |
| `03_calcados_05_loafer` | shoes | F-ref | bracos | forma do calçado (molde do pé oculto) | — | — | métricas JSON |
| `03_calcados_05_loafer` | shoes | F-ref | caminhada | forma do calçado (molde do pé oculto) | — | — | métricas JSON |
| `03_calcados_05_loafer` | shoes | F-ref | agachamento | forma do calçado (molde do pé oculto) | — | — | métricas JSON |
| `03_calcados_09_oxford` | shoes | F-ref | exibicao | forma do calçado (molde do pé oculto) | — | — | vestir/camisa-chino |
| `03_calcados_09_oxford` | shoes | F-ref | bracos | forma do calçado (molde do pé oculto) | — | — | vestir/camisa-chino |
| `03_calcados_09_oxford` | shoes | F-ref | caminhada | forma do calçado (molde do pé oculto) | — | — | vestir/camisa-chino |
| `03_calcados_09_oxford` | shoes | F-ref | agachamento | forma do calçado (molde do pé oculto) | — | — | vestir/camisa-chino |
| `03_calcados_11_bota_cano_curto` | boots | F-ref | exibicao | ok · penetração 0.0% | — | — | vestir/vestido-bota |
| `03_calcados_11_bota_cano_curto` | boots | F-ref | bracos | ok · penetração 0.0% | — | — | vestir/vestido-bota |
| `03_calcados_11_bota_cano_curto` | boots | F-ref | caminhada | ok · penetração 0.0% | — | — | vestir/vestido-bota |
| `03_calcados_11_bota_cano_curto` | boots | F-ref | agachamento | ok · penetração 0.0% | — | — | vestir/vestido-bota |
| `03_calcados_12_bota_cano_longo` | boots | F-ref | exibicao | ok · penetração 0.0% | — | folga panturrilha 0.56→0.49 cm | métricas JSON |
| `03_calcados_12_bota_cano_longo` | boots | F-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_12_bota_cano_longo` | boots | F-ref | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_12_bota_cano_longo` | boots | F-ref | agachamento | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_14_coturno` | boots | F-ref | exibicao | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_14_coturno` | boots | F-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_14_coturno` | boots | F-ref | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_14_coturno` | boots | F-ref | agachamento | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_13_sandalia` | shoes | F-ref | exibicao | forma do calçado (molde do pé oculto) | — · limitação: sandália como sapato fechado | — | métricas JSON |
| `03_calcados_13_sandalia` | shoes | F-ref | bracos | forma do calçado (molde do pé oculto) | — · limitação: sandália como sapato fechado | — | métricas JSON |
| `03_calcados_13_sandalia` | shoes | F-ref | caminhada | forma do calçado (molde do pé oculto) | — · limitação: sandália como sapato fechado | — | métricas JSON |
| `03_calcados_13_sandalia` | shoes | F-ref | agachamento | forma do calçado (molde do pé oculto) | — · limitação: sandália como sapato fechado | — | métricas JSON |
| `03_calcados_16_salto_alto` | shoes | F-ref | exibicao | forma do calçado (molde do pé oculto) | — · limitação: salto sem salto modelado | — | métricas JSON |
| `03_calcados_16_salto_alto` | shoes | F-ref | bracos | forma do calçado (molde do pé oculto) | — · limitação: salto sem salto modelado | — | métricas JSON |
| `03_calcados_16_salto_alto` | shoes | F-ref | caminhada | forma do calçado (molde do pé oculto) | — · limitação: salto sem salto modelado | — | métricas JSON |
| `03_calcados_16_salto_alto` | shoes | F-ref | agachamento | forma do calçado (molde do pé oculto) | — · limitação: salto sem salto modelado | — | métricas JSON |
| `01_parte_superior_01_camiseta_referencia` | tee | M-ref | exibicao | ok · penetração 1.5% | — | cintura/busto 1.01→1.03 (corpo 1.02) | vestir/camiseta-jeans |
| `01_parte_superior_01_camiseta_referencia` | tee | M-ref | bracos | ok · penetração 0.4% | — | — | vestir/camiseta-jeans |
| `01_parte_superior_01_camiseta_referencia` | tee | M-ref | caminhada | ok · penetração 1.3% | — | — | vestir/camiseta-jeans |
| `01_parte_superior_01_camiseta_referencia` | tee | M-ref | agachamento | ok · penetração 3.8% | — | — | vestir/camiseta-jeans |
| `01_parte_superior_02_shirt_camisa` | shirt | M-ref | exibicao | ok · penetração 0.6% | — | cintura/busto 1.02→1.03 (corpo 1.02) | vestir/camisa-chino |
| `01_parte_superior_02_shirt_camisa` | shirt | M-ref | bracos | ok · penetração 0.2% | — | — | vestir/camisa-chino |
| `01_parte_superior_02_shirt_camisa` | shirt | M-ref | caminhada | ok · penetração 0.6% | — | — | vestir/camisa-chino |
| `01_parte_superior_02_shirt_camisa` | shirt | M-ref | agachamento | ok · penetração 3.2% | — | — | vestir/camisa-chino |
| `01_parte_superior_03_blouse_blusa` | shirt | M-ref | exibicao | ok · penetração 0.6% | — | cintura/busto 1.02→1.03 (corpo 1.02) | métricas JSON |
| `01_parte_superior_03_blouse_blusa` | shirt | M-ref | bracos | ok · penetração 0.2% | — | — | métricas JSON |
| `01_parte_superior_03_blouse_blusa` | shirt | M-ref | caminhada | ok · penetração 0.6% | — | — | métricas JSON |
| `01_parte_superior_03_blouse_blusa` | shirt | M-ref | agachamento | ok · penetração 3.2% | — | — | métricas JSON |
| `01_parte_superior_04_tank_top_regata` | tank | M-ref | exibicao | ok · penetração 0.1% | — | cintura/busto 1.01→1 (corpo 1.02) | métricas JSON |
| `01_parte_superior_04_tank_top_regata` | tank | M-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `01_parte_superior_04_tank_top_regata` | tank | M-ref | caminhada | ok · penetração 0.2% | — | — | métricas JSON |
| `01_parte_superior_04_tank_top_regata` | tank | M-ref | agachamento | ok · penetração 3.7% | — | — | métricas JSON |
| `01_parte_superior_05_crop_top_cropped` | crop | M-ref | exibicao | ok · penetração 1.6% | — | — | métricas JSON |
| `01_parte_superior_05_crop_top_cropped` | crop | M-ref | bracos | ok · penetração 0.4% | — | — | métricas JSON |
| `01_parte_superior_05_crop_top_cropped` | crop | M-ref | caminhada | ok · penetração 1.4% | — | — | métricas JSON |
| `01_parte_superior_05_crop_top_cropped` | crop | M-ref | agachamento | ok · penetração 0.7% | — | — | métricas JSON |
| `01_parte_superior_06_polo_shirt_camisa_polo` | tee | M-ref | exibicao | ok · penetração 1.5% | — | cintura/busto 1.01→1.03 (corpo 1.02) | métricas JSON |
| `01_parte_superior_06_polo_shirt_camisa_polo` | tee | M-ref | bracos | ok · penetração 0.4% | — | — | métricas JSON |
| `01_parte_superior_06_polo_shirt_camisa_polo` | tee | M-ref | caminhada | ok · penetração 1.3% | — | — | métricas JSON |
| `01_parte_superior_06_polo_shirt_camisa_polo` | tee | M-ref | agachamento | ok · penetração 3.8% | — | — | métricas JSON |
| `01_parte_superior_07_bodysuit_body` | tank | M-ref | exibicao | ok · penetração 0.1% | — | cintura/busto 1.01→1 (corpo 1.02) | métricas JSON |
| `01_parte_superior_07_bodysuit_body` | tank | M-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `01_parte_superior_07_bodysuit_body` | tank | M-ref | caminhada | ok · penetração 0.2% | — | — | métricas JSON |
| `01_parte_superior_07_bodysuit_body` | tank | M-ref | agachamento | ok · penetração 3.7% | — | — | métricas JSON |
| `01_parte_superior_08_sweater_sueter` | sweater | M-ref | exibicao | ok · penetração 0.9% | — | cintura/busto 1.02→1.03 (corpo 1.02) | métricas JSON |
| `01_parte_superior_08_sweater_sueter` | sweater | M-ref | bracos | ok · penetração 0.3% | — | — | métricas JSON |
| `01_parte_superior_08_sweater_sueter` | sweater | M-ref | caminhada | ok · penetração 0.7% | — | — | métricas JSON |
| `01_parte_superior_08_sweater_sueter` | sweater | M-ref | agachamento | ok · penetração 3.2% | — | — | métricas JSON |
| `01_parte_superior_09_sweatshirt_moletom_sem_capuz` | sweater | M-ref | exibicao | ok · penetração 1.6% | — | cintura/busto 1.02→1.1 (corpo 1.01) | métricas JSON |
| `01_parte_superior_09_sweatshirt_moletom_sem_capuz` | sweater | M-ref | bracos | ok · penetração 0.6% | — | — | métricas JSON |
| `01_parte_superior_09_sweatshirt_moletom_sem_capuz` | sweater | M-ref | caminhada | ok · penetração 1.2% | — | — | métricas JSON |
| `01_parte_superior_09_sweatshirt_moletom_sem_capuz` | sweater | M-ref | agachamento | ok · penetração 4.2% | — | — | métricas JSON |
| `01_parte_superior_10_hoodie_moletom_com_capuz` | hoodie | M-ref | exibicao | ok · penetração 1.4% | — | cintura/busto 1.02→1.11 (corpo 1.01) | vestir/moletom-saia |
| `01_parte_superior_10_hoodie_moletom_com_capuz` | hoodie | M-ref | bracos | ok · penetração 0.8% | — | — | vestir/moletom-saia |
| `01_parte_superior_10_hoodie_moletom_com_capuz` | hoodie | M-ref | caminhada | ok · penetração 1.2% | — | — | vestir/moletom-saia |
| `01_parte_superior_10_hoodie_moletom_com_capuz` | hoodie | M-ref | agachamento | ok · penetração 4.2% | — | — | vestir/moletom-saia |
| `01_parte_superior_11_cardigan` | jacket | M-ref | exibicao | ok · penetração 1.5% | — | cintura/busto 1.11→1.13 (corpo 1.01) | métricas JSON |
| `01_parte_superior_11_cardigan` | jacket | M-ref | bracos | ok · penetração 0.6% | — | — | métricas JSON |
| `01_parte_superior_11_cardigan` | jacket | M-ref | caminhada | ok · penetração 1.5% | — | — | métricas JSON |
| `01_parte_superior_11_cardigan` | jacket | M-ref | agachamento | ok · penetração 4.0% | — | — | métricas JSON |
| `01_parte_superior_12_vest_colete` | vest | M-ref | exibicao | ok · penetração 0.5% | — | cintura/busto 1.1→1.12 (corpo 1.01) | métricas JSON |
| `01_parte_superior_12_vest_colete` | vest | M-ref | bracos | ok · penetração 0.1% | — | — | métricas JSON |
| `01_parte_superior_12_vest_colete` | vest | M-ref | caminhada | ok · penetração 0.5% | — | — | métricas JSON |
| `01_parte_superior_12_vest_colete` | vest | M-ref | agachamento | ok · penetração 5.0% | — | — | métricas JSON |
| `01_parte_superior_13_blazer` | jacket | M-ref | exibicao | ok · penetração 1.9% | — | cintura/busto 1.11→1.08 (corpo 1.01) | métricas JSON |
| `01_parte_superior_13_blazer` | jacket | M-ref | bracos | ok · penetração 0.7% | — | — | métricas JSON |
| `01_parte_superior_13_blazer` | jacket | M-ref | caminhada | ok · penetração 1.7% | — | — | métricas JSON |
| `01_parte_superior_13_blazer` | jacket | M-ref | agachamento | ok · penetração 3.7% | — | — | métricas JSON |
| `01_parte_superior_14_jacket_jaqueta` | jacket | M-ref | exibicao | ok · penetração 1.5% | — | cintura/busto 1.11→1.13 (corpo 1.01) | vestir/jaqueta-shorts |
| `01_parte_superior_14_jacket_jaqueta` | jacket | M-ref | bracos | ok · penetração 0.6% | — | — | vestir/jaqueta-shorts |
| `01_parte_superior_14_jacket_jaqueta` | jacket | M-ref | caminhada | ok · penetração 1.5% | — | — | vestir/jaqueta-shorts |
| `01_parte_superior_14_jacket_jaqueta` | jacket | M-ref | agachamento | ok · penetração 4.0% | — | — | vestir/jaqueta-shorts |
| `01_parte_superior_15_coat_casaco` | coat | M-ref | exibicao | ok · penetração 0.8% | — | cintura/busto 1.12→1.14 (corpo 1.01); folga coxa 5.17→5.33 cm | métricas JSON |
| `01_parte_superior_15_coat_casaco` | coat | M-ref | bracos | ok · penetração 0.3% | — | — | métricas JSON |
| `01_parte_superior_15_coat_casaco` | coat | M-ref | caminhada | ok · penetração 0.7% | — | — | métricas JSON |
| `01_parte_superior_15_coat_casaco` | coat | M-ref | agachamento | ok · penetração 3.3% | — | — | métricas JSON |
| `01_parte_superior_16_parka` | coat | M-ref | exibicao | ok · penetração 0.8% | — | cintura/busto 1.12→1.14 (corpo 1.01); folga coxa 5.17→5.33 cm | métricas JSON |
| `01_parte_superior_16_parka` | coat | M-ref | bracos | ok · penetração 0.3% | — | — | métricas JSON |
| `01_parte_superior_16_parka` | coat | M-ref | caminhada | ok · penetração 0.7% | — | — | métricas JSON |
| `01_parte_superior_16_parka` | coat | M-ref | agachamento | ok · penetração 3.3% | — | — | métricas JSON |
| `01_parte_superior_17_windbreaker_corta_vento` | jacket | M-ref | exibicao | ok · penetração 1.4% | — | cintura/busto 1.11→1.2 (corpo 1.01) | métricas JSON |
| `01_parte_superior_17_windbreaker_corta_vento` | jacket | M-ref | bracos | ok · penetração 0.4% | — | — | métricas JSON |
| `01_parte_superior_17_windbreaker_corta_vento` | jacket | M-ref | caminhada | ok · penetração 1.4% | — | — | métricas JSON |
| `01_parte_superior_17_windbreaker_corta_vento` | jacket | M-ref | agachamento | ok · penetração 3.9% | — | — | métricas JSON |
| `01_parte_superior_18_kimono_quimono` | jacket | M-ref | exibicao | ok · penetração 1.5% | — · limitação: quimono sem manga ampla | cintura/busto 1.11→1.14 (corpo 1.01) | métricas JSON |
| `01_parte_superior_18_kimono_quimono` | jacket | M-ref | bracos | ok · penetração 0.6% | — · limitação: quimono sem manga ampla | — | métricas JSON |
| `01_parte_superior_18_kimono_quimono` | jacket | M-ref | caminhada | ok · penetração 1.5% | — · limitação: quimono sem manga ampla | — | métricas JSON |
| `01_parte_superior_18_kimono_quimono` | jacket | M-ref | agachamento | ok · penetração 3.9% | — · limitação: quimono sem manga ampla | — | métricas JSON |
| `02_parte_inferior_01_jeans` | pants | M-ref | exibicao | ok · penetração 0.0% | — | barra/joelho 0.88→0.92; folga coxa 0.49→1.21 cm; folga joelho 0.62→1.76 cm; folga panturrilha 0.91→1.87 cm | vestir/camiseta-jeans |
| `02_parte_inferior_01_jeans` | pants | M-ref | bracos | ok · penetração 0.0% | — | — | vestir/camiseta-jeans |
| `02_parte_inferior_01_jeans` | pants | M-ref | caminhada | ok · penetração 0.0% | — | — | vestir/camiseta-jeans |
| `02_parte_inferior_01_jeans` | pants | M-ref | agachamento | ok · penetração 4.2% | — | — | vestir/camiseta-jeans |
| `02_parte_inferior_02_calca_casual` | pants | M-ref | exibicao | ok · penetração 0.0% | — | barra/joelho 0.88→0.92; folga coxa 0.49→1.21 cm; folga joelho 0.62→1.76 cm; folga panturrilha 0.91→1.87 cm | métricas JSON |
| `02_parte_inferior_02_calca_casual` | pants | M-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_02_calca_casual` | pants | M-ref | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_02_calca_casual` | pants | M-ref | agachamento | ok · penetração 4.2% | — | — | métricas JSON |
| `02_parte_inferior_03_calca_alfaiataria` | pants | M-ref | exibicao | ok · penetração 0.0% | — | barra/joelho 0.88→0.92; folga coxa 0.49→1.12 cm; folga joelho 0.62→1.66 cm; folga panturrilha 0.91→1.77 cm | métricas JSON |
| `02_parte_inferior_03_calca_alfaiataria` | pants | M-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_03_calca_alfaiataria` | pants | M-ref | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_03_calca_alfaiataria` | pants | M-ref | agachamento | ok · penetração 4.1% | — | — | métricas JSON |
| `02_parte_inferior_04_calca_cargo` | pants | M-ref | exibicao | ok · penetração 0.3% | — | barra/joelho 0.88→1.03; folga coxa 0.49→3.42 cm; folga joelho 0.62→5.12 cm; folga panturrilha 0.91→4.69 cm | métricas JSON |
| `02_parte_inferior_04_calca_cargo` | pants | M-ref | bracos | ok · penetração 0.3% | — | — | métricas JSON |
| `02_parte_inferior_04_calca_cargo` | pants | M-ref | caminhada | ok · penetração 0.2% | — | — | métricas JSON |
| `02_parte_inferior_04_calca_cargo` | pants | M-ref | agachamento | ok · penetração 5.6% | — | — | métricas JSON |
| `02_parte_inferior_05_calca_chino` | pants | M-ref | exibicao | ok · penetração 0.0% | — | barra/joelho 0.88→0.92; folga coxa 0.49→1.21 cm; folga joelho 0.62→1.76 cm; folga panturrilha 0.91→1.87 cm | vestir/camisa-chino |
| `02_parte_inferior_05_calca_chino` | pants | M-ref | bracos | ok · penetração 0.0% | — | — | vestir/camisa-chino |
| `02_parte_inferior_05_calca_chino` | pants | M-ref | caminhada | ok · penetração 0.0% | — | — | vestir/camisa-chino |
| `02_parte_inferior_05_calca_chino` | pants | M-ref | agachamento | ok · penetração 4.2% | — | — | vestir/camisa-chino |
| `02_parte_inferior_06_calca_moletom` | pants | M-ref | exibicao | ok · penetração 0.0% | — | barra/joelho 0.88→0.74; folga coxa 0.49→1.11 cm; folga joelho 0.62→1.01 cm; folga panturrilha 0.91→1 cm | métricas JSON |
| `02_parte_inferior_06_calca_moletom` | pants | M-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_06_calca_moletom` | pants | M-ref | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_06_calca_moletom` | pants | M-ref | agachamento | ok · penetração 3.9% | — | — | métricas JSON |
| `02_parte_inferior_07_calca_jogger` | pants | M-ref | exibicao | ok · penetração 0.0% | — | barra/joelho 0.88→0.74; folga coxa 0.49→1.11 cm; folga joelho 0.62→1.01 cm; folga panturrilha 0.91→1 cm | métricas JSON |
| `02_parte_inferior_07_calca_jogger` | pants | M-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_07_calca_jogger` | pants | M-ref | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_07_calca_jogger` | pants | M-ref | agachamento | ok · penetração 3.9% | — | — | métricas JSON |
| `02_parte_inferior_08_legging` | leggings | M-ref | exibicao | ok · penetração 0.0% | — | barra/joelho 0.64→0.63; folga coxa 0.17→0.13 cm; folga joelho 0.19→0.15 cm; folga panturrilha 0.14→0.1 cm | métricas JSON |
| `02_parte_inferior_08_legging` | leggings | M-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_08_legging` | leggings | M-ref | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_08_legging` | leggings | M-ref | agachamento | ok · penetração 0.4% | — | — | métricas JSON |
| `02_parte_inferior_09_pantacourt` | culottes | M-ref | exibicao | ok · penetração 0.0% | — | folga coxa 0.66→1.61 cm; folga joelho 1.26→2.89 cm; folga panturrilha 2.43→3.79 cm | métricas JSON |
| `02_parte_inferior_09_pantacourt` | culottes | M-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_09_pantacourt` | culottes | M-ref | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_09_pantacourt` | culottes | M-ref | agachamento | ok · penetração 5.6% | — | — | métricas JSON |
| `02_parte_inferior_10_bermuda` | bermuda | M-ref | exibicao | ok · penetração 0.0% | — | folga coxa 0.49→1.21 cm; folga joelho 0.6→1.93 cm | métricas JSON |
| `02_parte_inferior_10_bermuda` | bermuda | M-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_10_bermuda` | bermuda | M-ref | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_10_bermuda` | bermuda | M-ref | agachamento | acima da tolerância · penetração 6.2% | interseção (tronco 1.6%, perna 4.6%) | — | métricas JSON |
| `02_parte_inferior_11_shorts_jeans` | shorts | M-ref | exibicao | ok · penetração 0.0% | — | folga coxa 0.38→0.48 cm | métricas JSON |
| `02_parte_inferior_11_shorts_jeans` | shorts | M-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_11_shorts_jeans` | shorts | M-ref | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_11_shorts_jeans` | shorts | M-ref | agachamento | ok · penetração 3.2% | — | — | métricas JSON |
| `02_parte_inferior_12_saia` | skirt | M-ref | exibicao | ok · penetração 0.0% | — | folga coxa 5.73→6.21 cm | vestir/moletom-saia |
| `02_parte_inferior_12_saia` | skirt | M-ref | bracos | ok · penetração 0.0% | — | — | vestir/moletom-saia |
| `02_parte_inferior_12_saia` | skirt | M-ref | caminhada | ok · penetração 0.1% | — | — | vestir/moletom-saia |
| `02_parte_inferior_12_saia` | skirt | M-ref | agachamento | acima da tolerância · penetração 6.6% | interseção (perna 3.6%, tronco 3.0%) | — | vestir/moletom-saia |
| `02_parte_inferior_13_shorts` | shorts | M-ref | exibicao | ok · penetração 0.0% | — | folga coxa 0.38→0.48 cm | vestir/jaqueta-shorts |
| `02_parte_inferior_13_shorts` | shorts | M-ref | bracos | ok · penetração 0.0% | — | — | vestir/jaqueta-shorts |
| `02_parte_inferior_13_shorts` | shorts | M-ref | caminhada | ok · penetração 0.0% | — | — | vestir/jaqueta-shorts |
| `02_parte_inferior_13_shorts` | shorts | M-ref | agachamento | ok · penetração 3.2% | — | — | vestir/jaqueta-shorts |
| `02_parte_inferior_14_short_saia` | skirt | M-ref | exibicao | ok · penetração 0.0% | — · limitação: saia-short como saia | folga coxa 5.73→6.21 cm | métricas JSON |
| `02_parte_inferior_14_short_saia` | skirt | M-ref | bracos | ok · penetração 0.0% | — · limitação: saia-short como saia | — | métricas JSON |
| `02_parte_inferior_14_short_saia` | skirt | M-ref | caminhada | ok · penetração 0.1% | — · limitação: saia-short como saia | — | métricas JSON |
| `02_parte_inferior_14_short_saia` | skirt | M-ref | agachamento | acima da tolerância · penetração 6.6% | interseção (perna 3.6%, tronco 3.0%) · limitação: saia-short como saia | — | métricas JSON |
| `05_corpo_inteiro_01_vestido` | dress | M-ref | exibicao | ok · penetração 0.2% | — | cintura/busto 1.01→1.07 (corpo 1.01) | vestir/vestido-bota |
| `05_corpo_inteiro_01_vestido` | dress | M-ref | bracos | ok · penetração 0.0% | — | — | vestir/vestido-bota |
| `05_corpo_inteiro_01_vestido` | dress | M-ref | caminhada | ok · penetração 0.2% | — | — | vestir/vestido-bota |
| `05_corpo_inteiro_01_vestido` | dress | M-ref | agachamento | ok · penetração 1.7% | — | — | vestir/vestido-bota |
| `05_corpo_inteiro_02_macacao` | jumpsuit | M-ref | exibicao | ok · penetração 0.3% | — | barra/joelho –→0.92; cintura/busto 1.02→1.06 (corpo 1.02); folga coxa 3.6→1.35 cm | métricas JSON |
| `05_corpo_inteiro_02_macacao` | jumpsuit | M-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `05_corpo_inteiro_02_macacao` | jumpsuit | M-ref | caminhada | ok · penetração 0.2% | — | — | métricas JSON |
| `05_corpo_inteiro_02_macacao` | jumpsuit | M-ref | agachamento | ok · penetração 3.1% | — | — | métricas JSON |
| `05_corpo_inteiro_03_macaquinho` | romper | M-ref | exibicao | ok · penetração 0.4% | — | cintura/busto 1.02→1.06 (corpo 1.02); folga coxa 3.71→0.9 cm | métricas JSON |
| `05_corpo_inteiro_03_macaquinho` | romper | M-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `05_corpo_inteiro_03_macaquinho` | romper | M-ref | caminhada | ok · penetração 0.2% | — | — | métricas JSON |
| `05_corpo_inteiro_03_macaquinho` | romper | M-ref | agachamento | ok · penetração 2.8% | — | — | métricas JSON |
| `05_corpo_inteiro_04_conjunto_coordenado` | jumpsuit | M-ref | exibicao | ok · penetração 0.3% | — · limitação: conjunto como peça única | barra/joelho –→0.92; cintura/busto 1.02→1.06 (corpo 1.02); folga coxa 3.6→1.35 cm | métricas JSON |
| `05_corpo_inteiro_04_conjunto_coordenado` | jumpsuit | M-ref | bracos | ok · penetração 0.0% | — · limitação: conjunto como peça única | — | métricas JSON |
| `05_corpo_inteiro_04_conjunto_coordenado` | jumpsuit | M-ref | caminhada | ok · penetração 0.2% | — · limitação: conjunto como peça única | — | métricas JSON |
| `05_corpo_inteiro_04_conjunto_coordenado` | jumpsuit | M-ref | agachamento | ok · penetração 3.1% | — · limitação: conjunto como peça única | — | métricas JSON |
| `05_corpo_inteiro_05_jardineira` | jumpsuit | M-ref | exibicao | ok · penetração 0.3% | — · limitação: jardineira sem peitilho | barra/joelho –→0.92; cintura/busto 1.02→1.06 (corpo 1.02); folga coxa 3.6→1.35 cm | métricas JSON |
| `05_corpo_inteiro_05_jardineira` | jumpsuit | M-ref | bracos | ok · penetração 0.0% | — · limitação: jardineira sem peitilho | — | métricas JSON |
| `05_corpo_inteiro_05_jardineira` | jumpsuit | M-ref | caminhada | ok · penetração 0.2% | — · limitação: jardineira sem peitilho | — | métricas JSON |
| `05_corpo_inteiro_05_jardineira` | jumpsuit | M-ref | agachamento | ok · penetração 3.1% | — · limitação: jardineira sem peitilho | — | métricas JSON |
| `03_calcados_01_tenis_casual` | shoes | M-ref | exibicao | forma do calçado (molde do pé oculto) | — | — | vestir/camiseta-jeans |
| `03_calcados_01_tenis_casual` | shoes | M-ref | bracos | forma do calçado (molde do pé oculto) | — | — | vestir/camiseta-jeans |
| `03_calcados_01_tenis_casual` | shoes | M-ref | caminhada | forma do calçado (molde do pé oculto) | — | — | vestir/camiseta-jeans |
| `03_calcados_01_tenis_casual` | shoes | M-ref | agachamento | forma do calçado (molde do pé oculto) | — | — | vestir/camiseta-jeans |
| `03_calcados_02_tenis_corrida` | shoes | M-ref | exibicao | forma do calçado (molde do pé oculto) | — | — | vestir/jaqueta-shorts |
| `03_calcados_02_tenis_corrida` | shoes | M-ref | bracos | forma do calçado (molde do pé oculto) | — | — | vestir/jaqueta-shorts |
| `03_calcados_02_tenis_corrida` | shoes | M-ref | caminhada | forma do calçado (molde do pé oculto) | — | — | vestir/jaqueta-shorts |
| `03_calcados_02_tenis_corrida` | shoes | M-ref | agachamento | forma do calçado (molde do pé oculto) | — | — | vestir/jaqueta-shorts |
| `03_calcados_05_loafer` | shoes | M-ref | exibicao | forma do calçado (molde do pé oculto) | — | — | métricas JSON |
| `03_calcados_05_loafer` | shoes | M-ref | bracos | forma do calçado (molde do pé oculto) | — | — | métricas JSON |
| `03_calcados_05_loafer` | shoes | M-ref | caminhada | forma do calçado (molde do pé oculto) | — | — | métricas JSON |
| `03_calcados_05_loafer` | shoes | M-ref | agachamento | forma do calçado (molde do pé oculto) | — | — | métricas JSON |
| `03_calcados_09_oxford` | shoes | M-ref | exibicao | forma do calçado (molde do pé oculto) | — | — | vestir/camisa-chino |
| `03_calcados_09_oxford` | shoes | M-ref | bracos | forma do calçado (molde do pé oculto) | — | — | vestir/camisa-chino |
| `03_calcados_09_oxford` | shoes | M-ref | caminhada | forma do calçado (molde do pé oculto) | — | — | vestir/camisa-chino |
| `03_calcados_09_oxford` | shoes | M-ref | agachamento | forma do calçado (molde do pé oculto) | — | — | vestir/camisa-chino |
| `03_calcados_11_bota_cano_curto` | boots | M-ref | exibicao | ok · penetração 0.0% | — | — | vestir/vestido-bota |
| `03_calcados_11_bota_cano_curto` | boots | M-ref | bracos | ok · penetração 0.0% | — | — | vestir/vestido-bota |
| `03_calcados_11_bota_cano_curto` | boots | M-ref | caminhada | ok · penetração 0.0% | — | — | vestir/vestido-bota |
| `03_calcados_11_bota_cano_curto` | boots | M-ref | agachamento | ok · penetração 0.4% | — | — | vestir/vestido-bota |
| `03_calcados_12_bota_cano_longo` | boots | M-ref | exibicao | ok · penetração 0.0% | — | folga panturrilha 0.58→0.49 cm | métricas JSON |
| `03_calcados_12_bota_cano_longo` | boots | M-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_12_bota_cano_longo` | boots | M-ref | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_12_bota_cano_longo` | boots | M-ref | agachamento | ok · penetração 0.2% | — | — | métricas JSON |
| `03_calcados_14_coturno` | boots | M-ref | exibicao | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_14_coturno` | boots | M-ref | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_14_coturno` | boots | M-ref | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_14_coturno` | boots | M-ref | agachamento | ok · penetração 0.3% | — | — | métricas JSON |
| `03_calcados_13_sandalia` | shoes | M-ref | exibicao | forma do calçado (molde do pé oculto) | — · limitação: sandália como sapato fechado | — | métricas JSON |
| `03_calcados_13_sandalia` | shoes | M-ref | bracos | forma do calçado (molde do pé oculto) | — · limitação: sandália como sapato fechado | — | métricas JSON |
| `03_calcados_13_sandalia` | shoes | M-ref | caminhada | forma do calçado (molde do pé oculto) | — · limitação: sandália como sapato fechado | — | métricas JSON |
| `03_calcados_13_sandalia` | shoes | M-ref | agachamento | forma do calçado (molde do pé oculto) | — · limitação: sandália como sapato fechado | — | métricas JSON |
| `03_calcados_16_salto_alto` | shoes | M-ref | exibicao | forma do calçado (molde do pé oculto) | — · limitação: salto sem salto modelado | — | métricas JSON |
| `03_calcados_16_salto_alto` | shoes | M-ref | bracos | forma do calçado (molde do pé oculto) | — · limitação: salto sem salto modelado | — | métricas JSON |
| `03_calcados_16_salto_alto` | shoes | M-ref | caminhada | forma do calçado (molde do pé oculto) | — · limitação: salto sem salto modelado | — | métricas JSON |
| `03_calcados_16_salto_alto` | shoes | M-ref | agachamento | forma do calçado (molde do pé oculto) | — · limitação: salto sem salto modelado | — | métricas JSON |
| `01_parte_superior_01_camiseta_referencia` | tee | F-plus | exibicao | ok · penetração 1.3% | — | cintura/busto 0.98→1 (corpo 0.94) | vestir/camiseta-jeans |
| `01_parte_superior_01_camiseta_referencia` | tee | F-plus | bracos | ok · penetração 0.7% | — | — | vestir/camiseta-jeans |
| `01_parte_superior_01_camiseta_referencia` | tee | F-plus | caminhada | ok · penetração 1.6% | — | — | vestir/camiseta-jeans |
| `01_parte_superior_01_camiseta_referencia` | tee | F-plus | agachamento | ok · penetração 4.5% | — | — | vestir/camiseta-jeans |
| `01_parte_superior_02_shirt_camisa` | shirt | F-plus | exibicao | ok · penetração 0.5% | — | cintura/busto 0.99→1 (corpo 0.94) | vestir/camisa-chino |
| `01_parte_superior_02_shirt_camisa` | shirt | F-plus | bracos | ok · penetração 0.4% | — | — | vestir/camisa-chino |
| `01_parte_superior_02_shirt_camisa` | shirt | F-plus | caminhada | ok · penetração 0.8% | — | — | vestir/camisa-chino |
| `01_parte_superior_02_shirt_camisa` | shirt | F-plus | agachamento | ok · penetração 3.7% | — | — | vestir/camisa-chino |
| `01_parte_superior_03_blouse_blusa` | shirt | F-plus | exibicao | ok · penetração 0.5% | — | cintura/busto 0.99→1 (corpo 0.94) | métricas JSON |
| `01_parte_superior_03_blouse_blusa` | shirt | F-plus | bracos | ok · penetração 0.4% | — | — | métricas JSON |
| `01_parte_superior_03_blouse_blusa` | shirt | F-plus | caminhada | ok · penetração 0.8% | — | — | métricas JSON |
| `01_parte_superior_03_blouse_blusa` | shirt | F-plus | agachamento | ok · penetração 3.7% | — | — | métricas JSON |
| `01_parte_superior_04_tank_top_regata` | tank | F-plus | exibicao | ok · penetração 0.1% | — | cintura/busto 0.96→0.94 (corpo 0.94) | métricas JSON |
| `01_parte_superior_04_tank_top_regata` | tank | F-plus | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `01_parte_superior_04_tank_top_regata` | tank | F-plus | caminhada | ok · penetração 0.1% | — | — | métricas JSON |
| `01_parte_superior_04_tank_top_regata` | tank | F-plus | agachamento | ok · penetração 4.7% | — | — | métricas JSON |
| `01_parte_superior_05_crop_top_cropped` | crop | F-plus | exibicao | ok · penetração 0.7% | — | — | métricas JSON |
| `01_parte_superior_05_crop_top_cropped` | crop | F-plus | bracos | ok · penetração 0.8% | — | — | métricas JSON |
| `01_parte_superior_05_crop_top_cropped` | crop | F-plus | caminhada | ok · penetração 1.2% | — | — | métricas JSON |
| `01_parte_superior_05_crop_top_cropped` | crop | F-plus | agachamento | ok · penetração 0.9% | — | — | métricas JSON |
| `01_parte_superior_06_polo_shirt_camisa_polo` | tee | F-plus | exibicao | ok · penetração 1.3% | — | cintura/busto 0.98→1 (corpo 0.94) | métricas JSON |
| `01_parte_superior_06_polo_shirt_camisa_polo` | tee | F-plus | bracos | ok · penetração 0.7% | — | — | métricas JSON |
| `01_parte_superior_06_polo_shirt_camisa_polo` | tee | F-plus | caminhada | ok · penetração 1.6% | — | — | métricas JSON |
| `01_parte_superior_06_polo_shirt_camisa_polo` | tee | F-plus | agachamento | ok · penetração 4.5% | — | — | métricas JSON |
| `01_parte_superior_07_bodysuit_body` | tank | F-plus | exibicao | ok · penetração 0.1% | — | cintura/busto 0.96→0.94 (corpo 0.94) | métricas JSON |
| `01_parte_superior_07_bodysuit_body` | tank | F-plus | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `01_parte_superior_07_bodysuit_body` | tank | F-plus | caminhada | ok · penetração 0.1% | — | — | métricas JSON |
| `01_parte_superior_07_bodysuit_body` | tank | F-plus | agachamento | ok · penetração 4.7% | — | — | métricas JSON |
| `01_parte_superior_08_sweater_sueter` | sweater | F-plus | exibicao | ok · penetração 0.7% | — | cintura/busto 0.95→0.97 (corpo 0.94) | métricas JSON |
| `01_parte_superior_08_sweater_sueter` | sweater | F-plus | bracos | ok · penetração 0.5% | — | — | métricas JSON |
| `01_parte_superior_08_sweater_sueter` | sweater | F-plus | caminhada | ok · penetração 0.9% | — | — | métricas JSON |
| `01_parte_superior_08_sweater_sueter` | sweater | F-plus | agachamento | ok · penetração 3.8% | — | — | métricas JSON |
| `01_parte_superior_09_sweatshirt_moletom_sem_capuz` | sweater | F-plus | exibicao | ok · penetração 1.9% | — | cintura/busto 0.95→1.06 (corpo 0.93) | métricas JSON |
| `01_parte_superior_09_sweatshirt_moletom_sem_capuz` | sweater | F-plus | bracos | ok · penetração 0.8% | — | — | métricas JSON |
| `01_parte_superior_09_sweatshirt_moletom_sem_capuz` | sweater | F-plus | caminhada | ok · penetração 1.7% | — | — | métricas JSON |
| `01_parte_superior_09_sweatshirt_moletom_sem_capuz` | sweater | F-plus | agachamento | ok · penetração 4.6% | — | — | métricas JSON |
| `01_parte_superior_10_hoodie_moletom_com_capuz` | hoodie | F-plus | exibicao | ok · penetração 2.3% | — | cintura/busto 0.96→1.06 (corpo 0.93) | vestir/moletom-saia |
| `01_parte_superior_10_hoodie_moletom_com_capuz` | hoodie | F-plus | bracos | ok · penetração 0.9% | — | — | vestir/moletom-saia |
| `01_parte_superior_10_hoodie_moletom_com_capuz` | hoodie | F-plus | caminhada | ok · penetração 1.9% | — | — | vestir/moletom-saia |
| `01_parte_superior_10_hoodie_moletom_com_capuz` | hoodie | F-plus | agachamento | ok · penetração 4.8% | — | — | vestir/moletom-saia |
| `01_parte_superior_11_cardigan` | jacket | F-plus | exibicao | ok · penetração 2.7% | — | cintura/busto 1.02→1.05 (corpo 0.93) | métricas JSON |
| `01_parte_superior_11_cardigan` | jacket | F-plus | bracos | ok · penetração 0.9% | — | — | métricas JSON |
| `01_parte_superior_11_cardigan` | jacket | F-plus | caminhada | ok · penetração 2.4% | — | — | métricas JSON |
| `01_parte_superior_11_cardigan` | jacket | F-plus | agachamento | ok · penetração 4.6% | — | — | métricas JSON |
| `01_parte_superior_12_vest_colete` | vest | F-plus | exibicao | ok · penetração 1.8% | — | cintura/busto 1.01→1.03 (corpo 0.93) | métricas JSON |
| `01_parte_superior_12_vest_colete` | vest | F-plus | bracos | ok · penetração 0.3% | — | — | métricas JSON |
| `01_parte_superior_12_vest_colete` | vest | F-plus | caminhada | ok · penetração 1.6% | — | — | métricas JSON |
| `01_parte_superior_12_vest_colete` | vest | F-plus | agachamento | ok · penetração 5.2% | — | — | métricas JSON |
| `01_parte_superior_13_blazer` | jacket | F-plus | exibicao | ok · penetração 2.7% | — | cintura/busto 1.02→1.02 (corpo 0.93) | métricas JSON |
| `01_parte_superior_13_blazer` | jacket | F-plus | bracos | ok · penetração 1.1% | — | — | métricas JSON |
| `01_parte_superior_13_blazer` | jacket | F-plus | caminhada | ok · penetração 2.5% | — | — | métricas JSON |
| `01_parte_superior_13_blazer` | jacket | F-plus | agachamento | ok · penetração 4.2% | — | — | métricas JSON |
| `01_parte_superior_14_jacket_jaqueta` | jacket | F-plus | exibicao | ok · penetração 2.7% | — | cintura/busto 1.02→1.05 (corpo 0.93) | vestir/jaqueta-shorts |
| `01_parte_superior_14_jacket_jaqueta` | jacket | F-plus | bracos | ok · penetração 0.9% | — | — | vestir/jaqueta-shorts |
| `01_parte_superior_14_jacket_jaqueta` | jacket | F-plus | caminhada | ok · penetração 2.4% | — | — | vestir/jaqueta-shorts |
| `01_parte_superior_14_jacket_jaqueta` | jacket | F-plus | agachamento | ok · penetração 4.6% | — | — | vestir/jaqueta-shorts |
| `01_parte_superior_15_coat_casaco` | coat | F-plus | exibicao | ok · penetração 1.5% | — | cintura/busto 1.04→1.06 (corpo 0.92); folga coxa 4.86→5.02 cm | métricas JSON |
| `01_parte_superior_15_coat_casaco` | coat | F-plus | bracos | ok · penetração 0.4% | — | — | métricas JSON |
| `01_parte_superior_15_coat_casaco` | coat | F-plus | caminhada | ok · penetração 1.4% | — | — | métricas JSON |
| `01_parte_superior_15_coat_casaco` | coat | F-plus | agachamento | ok · penetração 4.2% | — | — | métricas JSON |
| `01_parte_superior_16_parka` | coat | F-plus | exibicao | ok · penetração 1.5% | — | cintura/busto 1.04→1.06 (corpo 0.92); folga coxa 4.86→5.02 cm | métricas JSON |
| `01_parte_superior_16_parka` | coat | F-plus | bracos | ok · penetração 0.4% | — | — | métricas JSON |
| `01_parte_superior_16_parka` | coat | F-plus | caminhada | ok · penetração 1.4% | — | — | métricas JSON |
| `01_parte_superior_16_parka` | coat | F-plus | agachamento | ok · penetração 4.2% | — | — | métricas JSON |
| `01_parte_superior_17_windbreaker_corta_vento` | jacket | F-plus | exibicao | ok · penetração 2.6% | — | cintura/busto 1.02→1.09 (corpo 0.92) | métricas JSON |
| `01_parte_superior_17_windbreaker_corta_vento` | jacket | F-plus | bracos | ok · penetração 0.6% | — | — | métricas JSON |
| `01_parte_superior_17_windbreaker_corta_vento` | jacket | F-plus | caminhada | ok · penetração 2.2% | — | — | métricas JSON |
| `01_parte_superior_17_windbreaker_corta_vento` | jacket | F-plus | agachamento | ok · penetração 4.6% | — | — | métricas JSON |
| `01_parte_superior_18_kimono_quimono` | jacket | F-plus | exibicao | ok · penetração 2.7% | — · limitação: quimono sem manga ampla | cintura/busto 1.02→1.06 (corpo 0.92) | métricas JSON |
| `01_parte_superior_18_kimono_quimono` | jacket | F-plus | bracos | ok · penetração 0.9% | — · limitação: quimono sem manga ampla | — | métricas JSON |
| `01_parte_superior_18_kimono_quimono` | jacket | F-plus | caminhada | ok · penetração 2.4% | — · limitação: quimono sem manga ampla | — | métricas JSON |
| `01_parte_superior_18_kimono_quimono` | jacket | F-plus | agachamento | ok · penetração 4.5% | — · limitação: quimono sem manga ampla | — | métricas JSON |
| `02_parte_inferior_01_jeans` | pants | F-plus | exibicao | ok · penetração 0.0% | — | barra/joelho 0.84→0.94; folga coxa 0.49→1.24 cm; folga joelho 0.63→1.72 cm; folga panturrilha 1→2.02 cm | vestir/camiseta-jeans |
| `02_parte_inferior_01_jeans` | pants | F-plus | bracos | ok · penetração 0.0% | — | — | vestir/camiseta-jeans |
| `02_parte_inferior_01_jeans` | pants | F-plus | caminhada | ok · penetração 0.0% | — | — | vestir/camiseta-jeans |
| `02_parte_inferior_01_jeans` | pants | F-plus | agachamento | ok · penetração 3.2% | — | — | vestir/camiseta-jeans |
| `02_parte_inferior_02_calca_casual` | pants | F-plus | exibicao | ok · penetração 0.0% | — | barra/joelho 0.84→0.94; folga coxa 0.49→1.24 cm; folga joelho 0.63→1.72 cm; folga panturrilha 1→2.02 cm | métricas JSON |
| `02_parte_inferior_02_calca_casual` | pants | F-plus | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_02_calca_casual` | pants | F-plus | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_02_calca_casual` | pants | F-plus | agachamento | ok · penetração 3.2% | — | — | métricas JSON |
| `02_parte_inferior_03_calca_alfaiataria` | pants | F-plus | exibicao | ok · penetração 0.0% | — | barra/joelho 0.84→0.96; folga coxa 0.49→1.16 cm; folga joelho 0.63→1.62 cm; folga panturrilha 1→1.92 cm | métricas JSON |
| `02_parte_inferior_03_calca_alfaiataria` | pants | F-plus | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_03_calca_alfaiataria` | pants | F-plus | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_03_calca_alfaiataria` | pants | F-plus | agachamento | ok · penetração 3.2% | — | — | métricas JSON |
| `02_parte_inferior_04_calca_cargo` | pants | F-plus | exibicao | ok · penetração 0.8% | — | barra/joelho 0.84→1.03; folga coxa 0.49→3.24 cm; folga joelho 0.63→5.06 cm; folga panturrilha 1→4.9 cm | métricas JSON |
| `02_parte_inferior_04_calca_cargo` | pants | F-plus | bracos | ok · penetração 0.8% | — | — | métricas JSON |
| `02_parte_inferior_04_calca_cargo` | pants | F-plus | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_04_calca_cargo` | pants | F-plus | agachamento | acima da tolerância · penetração 6.4% | interseção (tronco 1.6%, perna 4.7%) | — | métricas JSON |
| `02_parte_inferior_05_calca_chino` | pants | F-plus | exibicao | ok · penetração 0.0% | — | barra/joelho 0.84→0.94; folga coxa 0.49→1.24 cm; folga joelho 0.63→1.72 cm; folga panturrilha 1→2.02 cm | vestir/camisa-chino |
| `02_parte_inferior_05_calca_chino` | pants | F-plus | bracos | ok · penetração 0.0% | — | — | vestir/camisa-chino |
| `02_parte_inferior_05_calca_chino` | pants | F-plus | caminhada | ok · penetração 0.0% | — | — | vestir/camisa-chino |
| `02_parte_inferior_05_calca_chino` | pants | F-plus | agachamento | ok · penetração 3.2% | — | — | vestir/camisa-chino |
| `02_parte_inferior_06_calca_moletom` | pants | F-plus | exibicao | ok · penetração 0.0% | — | barra/joelho 0.84→0.75; folga coxa 0.49→1.15 cm; folga joelho 0.63→0.95 cm; folga panturrilha 1→1.13 cm | métricas JSON |
| `02_parte_inferior_06_calca_moletom` | pants | F-plus | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_06_calca_moletom` | pants | F-plus | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_06_calca_moletom` | pants | F-plus | agachamento | ok · penetração 2.8% | — | — | métricas JSON |
| `02_parte_inferior_07_calca_jogger` | pants | F-plus | exibicao | ok · penetração 0.0% | — | barra/joelho 0.84→0.75; folga coxa 0.49→1.15 cm; folga joelho 0.63→0.95 cm; folga panturrilha 1→1.13 cm | métricas JSON |
| `02_parte_inferior_07_calca_jogger` | pants | F-plus | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_07_calca_jogger` | pants | F-plus | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_07_calca_jogger` | pants | F-plus | agachamento | ok · penetração 2.8% | — | — | métricas JSON |
| `02_parte_inferior_08_legging` | leggings | F-plus | exibicao | ok · penetração 0.1% | — | barra/joelho 0.57→0.57; folga coxa 0.17→0.13 cm; folga joelho 0.18→0.14 cm; folga panturrilha 0.16→0.12 cm | métricas JSON |
| `02_parte_inferior_08_legging` | leggings | F-plus | bracos | ok · penetração 0.1% | — | — | métricas JSON |
| `02_parte_inferior_08_legging` | leggings | F-plus | caminhada | ok · penetração 0.1% | — | — | métricas JSON |
| `02_parte_inferior_08_legging` | leggings | F-plus | agachamento | ok · penetração 0.4% | — | — | métricas JSON |
| `02_parte_inferior_09_pantacourt` | culottes | F-plus | exibicao | ok · penetração 0.0% | — | folga coxa 0.66→1.62 cm; folga joelho 1.23→2.79 cm; folga panturrilha 2.5→4.12 cm | métricas JSON |
| `02_parte_inferior_09_pantacourt` | culottes | F-plus | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_09_pantacourt` | culottes | F-plus | caminhada | ok · penetração 0.1% | — | — | métricas JSON |
| `02_parte_inferior_09_pantacourt` | culottes | F-plus | agachamento | ok · penetração 5.2% | — | — | métricas JSON |
| `02_parte_inferior_10_bermuda` | bermuda | F-plus | exibicao | ok · penetração 0.0% | — | folga coxa 0.49→1.24 cm; folga joelho 0.56→1.71 cm | métricas JSON |
| `02_parte_inferior_10_bermuda` | bermuda | F-plus | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_10_bermuda` | bermuda | F-plus | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_10_bermuda` | bermuda | F-plus | agachamento | ok · penetração 4.0% | — | — | métricas JSON |
| `02_parte_inferior_11_shorts_jeans` | shorts | F-plus | exibicao | ok · penetração 0.0% | — | folga coxa 0.38→0.48 cm | métricas JSON |
| `02_parte_inferior_11_shorts_jeans` | shorts | F-plus | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_11_shorts_jeans` | shorts | F-plus | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_11_shorts_jeans` | shorts | F-plus | agachamento | ok · penetração 1.6% | — | — | métricas JSON |
| `02_parte_inferior_12_saia` | skirt | F-plus | exibicao | ok · penetração 0.0% | — | — | vestir/moletom-saia |
| `02_parte_inferior_12_saia` | skirt | F-plus | bracos | ok · penetração 0.0% | — | — | vestir/moletom-saia |
| `02_parte_inferior_12_saia` | skirt | F-plus | caminhada | ok · penetração 0.0% | — | — | vestir/moletom-saia |
| `02_parte_inferior_12_saia` | skirt | F-plus | agachamento | ok · penetração 5.9% | — | — | vestir/moletom-saia |
| `02_parte_inferior_13_shorts` | shorts | F-plus | exibicao | ok · penetração 0.0% | — | folga coxa 0.38→0.48 cm | vestir/jaqueta-shorts |
| `02_parte_inferior_13_shorts` | shorts | F-plus | bracos | ok · penetração 0.0% | — | — | vestir/jaqueta-shorts |
| `02_parte_inferior_13_shorts` | shorts | F-plus | caminhada | ok · penetração 0.0% | — | — | vestir/jaqueta-shorts |
| `02_parte_inferior_13_shorts` | shorts | F-plus | agachamento | ok · penetração 1.6% | — | — | vestir/jaqueta-shorts |
| `02_parte_inferior_14_short_saia` | skirt | F-plus | exibicao | ok · penetração 0.0% | — · limitação: saia-short como saia | — | métricas JSON |
| `02_parte_inferior_14_short_saia` | skirt | F-plus | bracos | ok · penetração 0.0% | — · limitação: saia-short como saia | — | métricas JSON |
| `02_parte_inferior_14_short_saia` | skirt | F-plus | caminhada | ok · penetração 0.0% | — · limitação: saia-short como saia | — | métricas JSON |
| `02_parte_inferior_14_short_saia` | skirt | F-plus | agachamento | ok · penetração 5.9% | — · limitação: saia-short como saia | — | métricas JSON |
| `05_corpo_inteiro_01_vestido` | dress | F-plus | exibicao | ok · penetração 0.3% | — | cintura/busto 0.94→1.01 (corpo 0.93) | vestir/vestido-bota |
| `05_corpo_inteiro_01_vestido` | dress | F-plus | bracos | ok · penetração 0.1% | — | — | vestir/vestido-bota |
| `05_corpo_inteiro_01_vestido` | dress | F-plus | caminhada | ok · penetração 0.4% | — | — | vestir/vestido-bota |
| `05_corpo_inteiro_01_vestido` | dress | F-plus | agachamento | ok · penetração 1.6% | — | — | vestir/vestido-bota |
| `05_corpo_inteiro_02_macacao` | jumpsuit | F-plus | exibicao | ok · penetração 0.6% | — | barra/joelho –→0.95; cintura/busto 0.96→1.01 (corpo 0.94); folga coxa 3.45→1.28 cm | métricas JSON |
| `05_corpo_inteiro_02_macacao` | jumpsuit | F-plus | bracos | ok · penetração 0.1% | — | — | métricas JSON |
| `05_corpo_inteiro_02_macacao` | jumpsuit | F-plus | caminhada | ok · penetração 0.5% | — | — | métricas JSON |
| `05_corpo_inteiro_02_macacao` | jumpsuit | F-plus | agachamento | ok · penetração 2.5% | — | — | métricas JSON |
| `05_corpo_inteiro_03_macaquinho` | romper | F-plus | exibicao | ok · penetração 0.8% | — | cintura/busto 0.96→1.01 (corpo 0.94); folga coxa 3.58→0.8 cm | métricas JSON |
| `05_corpo_inteiro_03_macaquinho` | romper | F-plus | bracos | ok · penetração 0.2% | — | — | métricas JSON |
| `05_corpo_inteiro_03_macaquinho` | romper | F-plus | caminhada | ok · penetração 0.7% | — | — | métricas JSON |
| `05_corpo_inteiro_03_macaquinho` | romper | F-plus | agachamento | ok · penetração 1.8% | — | — | métricas JSON |
| `05_corpo_inteiro_04_conjunto_coordenado` | jumpsuit | F-plus | exibicao | ok · penetração 0.6% | — · limitação: conjunto como peça única | barra/joelho –→0.95; cintura/busto 0.96→1.01 (corpo 0.94); folga coxa 3.45→1.28 cm | métricas JSON |
| `05_corpo_inteiro_04_conjunto_coordenado` | jumpsuit | F-plus | bracos | ok · penetração 0.1% | — · limitação: conjunto como peça única | — | métricas JSON |
| `05_corpo_inteiro_04_conjunto_coordenado` | jumpsuit | F-plus | caminhada | ok · penetração 0.5% | — · limitação: conjunto como peça única | — | métricas JSON |
| `05_corpo_inteiro_04_conjunto_coordenado` | jumpsuit | F-plus | agachamento | ok · penetração 2.5% | — · limitação: conjunto como peça única | — | métricas JSON |
| `05_corpo_inteiro_05_jardineira` | jumpsuit | F-plus | exibicao | ok · penetração 0.6% | — · limitação: jardineira sem peitilho | barra/joelho –→0.95; cintura/busto 0.96→1.01 (corpo 0.94); folga coxa 3.45→1.28 cm | métricas JSON |
| `05_corpo_inteiro_05_jardineira` | jumpsuit | F-plus | bracos | ok · penetração 0.1% | — · limitação: jardineira sem peitilho | — | métricas JSON |
| `05_corpo_inteiro_05_jardineira` | jumpsuit | F-plus | caminhada | ok · penetração 0.5% | — · limitação: jardineira sem peitilho | — | métricas JSON |
| `05_corpo_inteiro_05_jardineira` | jumpsuit | F-plus | agachamento | ok · penetração 2.5% | — · limitação: jardineira sem peitilho | — | métricas JSON |
| `03_calcados_01_tenis_casual` | shoes | F-plus | exibicao | forma do calçado (molde do pé oculto) | — | — | vestir/camiseta-jeans |
| `03_calcados_01_tenis_casual` | shoes | F-plus | bracos | forma do calçado (molde do pé oculto) | — | — | vestir/camiseta-jeans |
| `03_calcados_01_tenis_casual` | shoes | F-plus | caminhada | forma do calçado (molde do pé oculto) | — | — | vestir/camiseta-jeans |
| `03_calcados_01_tenis_casual` | shoes | F-plus | agachamento | forma do calçado (molde do pé oculto) | — | — | vestir/camiseta-jeans |
| `03_calcados_02_tenis_corrida` | shoes | F-plus | exibicao | forma do calçado (molde do pé oculto) | — | — | vestir/jaqueta-shorts |
| `03_calcados_02_tenis_corrida` | shoes | F-plus | bracos | forma do calçado (molde do pé oculto) | — | — | vestir/jaqueta-shorts |
| `03_calcados_02_tenis_corrida` | shoes | F-plus | caminhada | forma do calçado (molde do pé oculto) | — | — | vestir/jaqueta-shorts |
| `03_calcados_02_tenis_corrida` | shoes | F-plus | agachamento | forma do calçado (molde do pé oculto) | — | — | vestir/jaqueta-shorts |
| `03_calcados_05_loafer` | shoes | F-plus | exibicao | forma do calçado (molde do pé oculto) | — | — | métricas JSON |
| `03_calcados_05_loafer` | shoes | F-plus | bracos | forma do calçado (molde do pé oculto) | — | — | métricas JSON |
| `03_calcados_05_loafer` | shoes | F-plus | caminhada | forma do calçado (molde do pé oculto) | — | — | métricas JSON |
| `03_calcados_05_loafer` | shoes | F-plus | agachamento | forma do calçado (molde do pé oculto) | — | — | métricas JSON |
| `03_calcados_09_oxford` | shoes | F-plus | exibicao | forma do calçado (molde do pé oculto) | — | — | vestir/camisa-chino |
| `03_calcados_09_oxford` | shoes | F-plus | bracos | forma do calçado (molde do pé oculto) | — | — | vestir/camisa-chino |
| `03_calcados_09_oxford` | shoes | F-plus | caminhada | forma do calçado (molde do pé oculto) | — | — | vestir/camisa-chino |
| `03_calcados_09_oxford` | shoes | F-plus | agachamento | forma do calçado (molde do pé oculto) | — | — | vestir/camisa-chino |
| `03_calcados_11_bota_cano_curto` | boots | F-plus | exibicao | ok · penetração 0.0% | — | — | vestir/vestido-bota |
| `03_calcados_11_bota_cano_curto` | boots | F-plus | bracos | ok · penetração 0.0% | — | — | vestir/vestido-bota |
| `03_calcados_11_bota_cano_curto` | boots | F-plus | caminhada | ok · penetração 0.0% | — | — | vestir/vestido-bota |
| `03_calcados_11_bota_cano_curto` | boots | F-plus | agachamento | ok · penetração 0.0% | — | — | vestir/vestido-bota |
| `03_calcados_12_bota_cano_longo` | boots | F-plus | exibicao | ok · penetração 0.0% | — | folga panturrilha 0.57→0.49 cm | métricas JSON |
| `03_calcados_12_bota_cano_longo` | boots | F-plus | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_12_bota_cano_longo` | boots | F-plus | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_12_bota_cano_longo` | boots | F-plus | agachamento | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_14_coturno` | boots | F-plus | exibicao | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_14_coturno` | boots | F-plus | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_14_coturno` | boots | F-plus | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_14_coturno` | boots | F-plus | agachamento | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_13_sandalia` | shoes | F-plus | exibicao | forma do calçado (molde do pé oculto) | — · limitação: sandália como sapato fechado | — | métricas JSON |
| `03_calcados_13_sandalia` | shoes | F-plus | bracos | forma do calçado (molde do pé oculto) | — · limitação: sandália como sapato fechado | — | métricas JSON |
| `03_calcados_13_sandalia` | shoes | F-plus | caminhada | forma do calçado (molde do pé oculto) | — · limitação: sandália como sapato fechado | — | métricas JSON |
| `03_calcados_13_sandalia` | shoes | F-plus | agachamento | forma do calçado (molde do pé oculto) | — · limitação: sandália como sapato fechado | — | métricas JSON |
| `03_calcados_16_salto_alto` | shoes | F-plus | exibicao | forma do calçado (molde do pé oculto) | — · limitação: salto sem salto modelado | — | métricas JSON |
| `03_calcados_16_salto_alto` | shoes | F-plus | bracos | forma do calçado (molde do pé oculto) | — · limitação: salto sem salto modelado | — | métricas JSON |
| `03_calcados_16_salto_alto` | shoes | F-plus | caminhada | forma do calçado (molde do pé oculto) | — · limitação: salto sem salto modelado | — | métricas JSON |
| `03_calcados_16_salto_alto` | shoes | F-plus | agachamento | forma do calçado (molde do pé oculto) | — · limitação: salto sem salto modelado | — | métricas JSON |
| `01_parte_superior_01_camiseta_referencia` | tee | M-slim | exibicao | ok · penetração 1.5% | — | cintura/busto 1.03→1.05 (corpo 1.03) | vestir/camiseta-jeans |
| `01_parte_superior_01_camiseta_referencia` | tee | M-slim | bracos | ok · penetração 0.4% | — | — | vestir/camiseta-jeans |
| `01_parte_superior_01_camiseta_referencia` | tee | M-slim | caminhada | ok · penetração 1.1% | — | — | vestir/camiseta-jeans |
| `01_parte_superior_01_camiseta_referencia` | tee | M-slim | agachamento | ok · penetração 3.7% | — | — | vestir/camiseta-jeans |
| `01_parte_superior_02_shirt_camisa` | shirt | M-slim | exibicao | ok · penetração 0.5% | — | cintura/busto 1.03→1.05 (corpo 1.03) | vestir/camisa-chino |
| `01_parte_superior_02_shirt_camisa` | shirt | M-slim | bracos | ok · penetração 0.3% | — | — | vestir/camisa-chino |
| `01_parte_superior_02_shirt_camisa` | shirt | M-slim | caminhada | ok · penetração 0.5% | — | — | vestir/camisa-chino |
| `01_parte_superior_02_shirt_camisa` | shirt | M-slim | agachamento | ok · penetração 3.2% | — | — | vestir/camisa-chino |
| `01_parte_superior_03_blouse_blusa` | shirt | M-slim | exibicao | ok · penetração 0.5% | — | cintura/busto 1.03→1.05 (corpo 1.03) | métricas JSON |
| `01_parte_superior_03_blouse_blusa` | shirt | M-slim | bracos | ok · penetração 0.3% | — | — | métricas JSON |
| `01_parte_superior_03_blouse_blusa` | shirt | M-slim | caminhada | ok · penetração 0.5% | — | — | métricas JSON |
| `01_parte_superior_03_blouse_blusa` | shirt | M-slim | agachamento | ok · penetração 3.2% | — | — | métricas JSON |
| `01_parte_superior_04_tank_top_regata` | tank | M-slim | exibicao | ok · penetração 0.0% | — | cintura/busto 1.02→1.01 (corpo 1.03) | métricas JSON |
| `01_parte_superior_04_tank_top_regata` | tank | M-slim | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `01_parte_superior_04_tank_top_regata` | tank | M-slim | caminhada | ok · penetração 0.1% | — | — | métricas JSON |
| `01_parte_superior_04_tank_top_regata` | tank | M-slim | agachamento | ok · penetração 3.7% | — | — | métricas JSON |
| `01_parte_superior_05_crop_top_cropped` | crop | M-slim | exibicao | ok · penetração 1.5% | — | — | métricas JSON |
| `01_parte_superior_05_crop_top_cropped` | crop | M-slim | bracos | ok · penetração 0.5% | — | — | métricas JSON |
| `01_parte_superior_05_crop_top_cropped` | crop | M-slim | caminhada | ok · penetração 1.2% | — | — | métricas JSON |
| `01_parte_superior_05_crop_top_cropped` | crop | M-slim | agachamento | ok · penetração 0.7% | — | — | métricas JSON |
| `01_parte_superior_06_polo_shirt_camisa_polo` | tee | M-slim | exibicao | ok · penetração 1.5% | — | cintura/busto 1.03→1.05 (corpo 1.03) | métricas JSON |
| `01_parte_superior_06_polo_shirt_camisa_polo` | tee | M-slim | bracos | ok · penetração 0.4% | — | — | métricas JSON |
| `01_parte_superior_06_polo_shirt_camisa_polo` | tee | M-slim | caminhada | ok · penetração 1.1% | — | — | métricas JSON |
| `01_parte_superior_06_polo_shirt_camisa_polo` | tee | M-slim | agachamento | ok · penetração 3.7% | — | — | métricas JSON |
| `01_parte_superior_07_bodysuit_body` | tank | M-slim | exibicao | ok · penetração 0.0% | — | cintura/busto 1.02→1.01 (corpo 1.03) | métricas JSON |
| `01_parte_superior_07_bodysuit_body` | tank | M-slim | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `01_parte_superior_07_bodysuit_body` | tank | M-slim | caminhada | ok · penetração 0.1% | — | — | métricas JSON |
| `01_parte_superior_07_bodysuit_body` | tank | M-slim | agachamento | ok · penetração 3.7% | — | — | métricas JSON |
| `01_parte_superior_08_sweater_sueter` | sweater | M-slim | exibicao | ok · penetração 0.9% | — | cintura/busto 1.02→1.03 (corpo 1.03) | métricas JSON |
| `01_parte_superior_08_sweater_sueter` | sweater | M-slim | bracos | ok · penetração 0.2% | — | — | métricas JSON |
| `01_parte_superior_08_sweater_sueter` | sweater | M-slim | caminhada | ok · penetração 0.6% | — | — | métricas JSON |
| `01_parte_superior_08_sweater_sueter` | sweater | M-slim | agachamento | ok · penetração 3.3% | — | — | métricas JSON |
| `01_parte_superior_09_sweatshirt_moletom_sem_capuz` | sweater | M-slim | exibicao | ok · penetração 1.3% | — | cintura/busto 1.02→1.1 (corpo 1.03) | métricas JSON |
| `01_parte_superior_09_sweatshirt_moletom_sem_capuz` | sweater | M-slim | bracos | ok · penetração 0.6% | — | — | métricas JSON |
| `01_parte_superior_09_sweatshirt_moletom_sem_capuz` | sweater | M-slim | caminhada | ok · penetração 1.1% | — | — | métricas JSON |
| `01_parte_superior_09_sweatshirt_moletom_sem_capuz` | sweater | M-slim | agachamento | ok · penetração 4.0% | — | — | métricas JSON |
| `01_parte_superior_10_hoodie_moletom_com_capuz` | hoodie | M-slim | exibicao | ok · penetração 1.2% | — | cintura/busto 1.02→1.11 (corpo 1.03) | vestir/moletom-saia |
| `01_parte_superior_10_hoodie_moletom_com_capuz` | hoodie | M-slim | bracos | ok · penetração 0.7% | — | — | vestir/moletom-saia |
| `01_parte_superior_10_hoodie_moletom_com_capuz` | hoodie | M-slim | caminhada | ok · penetração 1.0% | — | — | vestir/moletom-saia |
| `01_parte_superior_10_hoodie_moletom_com_capuz` | hoodie | M-slim | agachamento | ok · penetração 4.1% | — | — | vestir/moletom-saia |
| `01_parte_superior_11_cardigan` | jacket | M-slim | exibicao | ok · penetração 1.3% | — | cintura/busto 1.1→1.13 (corpo 1.03) | métricas JSON |
| `01_parte_superior_11_cardigan` | jacket | M-slim | bracos | ok · penetração 0.4% | — | — | métricas JSON |
| `01_parte_superior_11_cardigan` | jacket | M-slim | caminhada | ok · penetração 1.3% | — | — | métricas JSON |
| `01_parte_superior_11_cardigan` | jacket | M-slim | agachamento | ok · penetração 3.8% | — | — | métricas JSON |
| `01_parte_superior_12_vest_colete` | vest | M-slim | exibicao | ok · penetração 0.3% | — | cintura/busto 1.1→1.12 (corpo 1.03) | métricas JSON |
| `01_parte_superior_12_vest_colete` | vest | M-slim | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `01_parte_superior_12_vest_colete` | vest | M-slim | caminhada | ok · penetração 0.3% | — | — | métricas JSON |
| `01_parte_superior_12_vest_colete` | vest | M-slim | agachamento | ok · penetração 4.8% | — | — | métricas JSON |
| `01_parte_superior_13_blazer` | jacket | M-slim | exibicao | ok · penetração 1.6% | — | cintura/busto 1.1→1.09 (corpo 1.03) | métricas JSON |
| `01_parte_superior_13_blazer` | jacket | M-slim | bracos | ok · penetração 0.4% | — | — | métricas JSON |
| `01_parte_superior_13_blazer` | jacket | M-slim | caminhada | ok · penetração 1.5% | — | — | métricas JSON |
| `01_parte_superior_13_blazer` | jacket | M-slim | agachamento | ok · penetração 3.5% | — | — | métricas JSON |
| `01_parte_superior_14_jacket_jaqueta` | jacket | M-slim | exibicao | ok · penetração 1.3% | — | cintura/busto 1.1→1.13 (corpo 1.03) | vestir/jaqueta-shorts |
| `01_parte_superior_14_jacket_jaqueta` | jacket | M-slim | bracos | ok · penetração 0.4% | — | — | vestir/jaqueta-shorts |
| `01_parte_superior_14_jacket_jaqueta` | jacket | M-slim | caminhada | ok · penetração 1.3% | — | — | vestir/jaqueta-shorts |
| `01_parte_superior_14_jacket_jaqueta` | jacket | M-slim | agachamento | ok · penetração 3.8% | — | — | vestir/jaqueta-shorts |
| `01_parte_superior_15_coat_casaco` | coat | M-slim | exibicao | ok · penetração 0.7% | — | cintura/busto 1.12→1.14 (corpo 1.03); folga coxa 5.14→5.35 cm | métricas JSON |
| `01_parte_superior_15_coat_casaco` | coat | M-slim | bracos | ok · penetração 0.2% | — | — | métricas JSON |
| `01_parte_superior_15_coat_casaco` | coat | M-slim | caminhada | ok · penetração 0.6% | — | — | métricas JSON |
| `01_parte_superior_15_coat_casaco` | coat | M-slim | agachamento | ok · penetração 3.5% | — | — | métricas JSON |
| `01_parte_superior_16_parka` | coat | M-slim | exibicao | ok · penetração 0.7% | — | cintura/busto 1.12→1.14 (corpo 1.03); folga coxa 5.14→5.35 cm | métricas JSON |
| `01_parte_superior_16_parka` | coat | M-slim | bracos | ok · penetração 0.2% | — | — | métricas JSON |
| `01_parte_superior_16_parka` | coat | M-slim | caminhada | ok · penetração 0.6% | — | — | métricas JSON |
| `01_parte_superior_16_parka` | coat | M-slim | agachamento | ok · penetração 3.5% | — | — | métricas JSON |
| `01_parte_superior_17_windbreaker_corta_vento` | jacket | M-slim | exibicao | ok · penetração 1.3% | — | cintura/busto 1.1→1.19 (corpo 1.03) | métricas JSON |
| `01_parte_superior_17_windbreaker_corta_vento` | jacket | M-slim | bracos | ok · penetração 0.3% | — | — | métricas JSON |
| `01_parte_superior_17_windbreaker_corta_vento` | jacket | M-slim | caminhada | ok · penetração 1.1% | — | — | métricas JSON |
| `01_parte_superior_17_windbreaker_corta_vento` | jacket | M-slim | agachamento | ok · penetração 3.8% | — | — | métricas JSON |
| `01_parte_superior_18_kimono_quimono` | jacket | M-slim | exibicao | ok · penetração 1.3% | — · limitação: quimono sem manga ampla | cintura/busto 1.1→1.14 (corpo 1.03) | métricas JSON |
| `01_parte_superior_18_kimono_quimono` | jacket | M-slim | bracos | ok · penetração 0.4% | — · limitação: quimono sem manga ampla | — | métricas JSON |
| `01_parte_superior_18_kimono_quimono` | jacket | M-slim | caminhada | ok · penetração 1.2% | — · limitação: quimono sem manga ampla | — | métricas JSON |
| `01_parte_superior_18_kimono_quimono` | jacket | M-slim | agachamento | ok · penetração 3.8% | — · limitação: quimono sem manga ampla | — | métricas JSON |
| `02_parte_inferior_01_jeans` | pants | M-slim | exibicao | ok · penetração 0.0% | — | barra/joelho 0.88→0.92; folga coxa 0.49→1.24 cm; folga joelho 0.61→1.75 cm; folga panturrilha 0.91→1.9 cm | vestir/camiseta-jeans |
| `02_parte_inferior_01_jeans` | pants | M-slim | bracos | ok · penetração 0.0% | — | — | vestir/camiseta-jeans |
| `02_parte_inferior_01_jeans` | pants | M-slim | caminhada | ok · penetração 0.0% | — | — | vestir/camiseta-jeans |
| `02_parte_inferior_01_jeans` | pants | M-slim | agachamento | ok · penetração 4.1% | — | — | vestir/camiseta-jeans |
| `02_parte_inferior_02_calca_casual` | pants | M-slim | exibicao | ok · penetração 0.0% | — | barra/joelho 0.88→0.92; folga coxa 0.49→1.24 cm; folga joelho 0.61→1.75 cm; folga panturrilha 0.91→1.9 cm | métricas JSON |
| `02_parte_inferior_02_calca_casual` | pants | M-slim | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_02_calca_casual` | pants | M-slim | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_02_calca_casual` | pants | M-slim | agachamento | ok · penetração 4.1% | — | — | métricas JSON |
| `02_parte_inferior_03_calca_alfaiataria` | pants | M-slim | exibicao | ok · penetração 0.0% | — | barra/joelho 0.88→0.92; folga coxa 0.49→1.15 cm; folga joelho 0.61→1.65 cm; folga panturrilha 0.91→1.83 cm | métricas JSON |
| `02_parte_inferior_03_calca_alfaiataria` | pants | M-slim | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_03_calca_alfaiataria` | pants | M-slim | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_03_calca_alfaiataria` | pants | M-slim | agachamento | ok · penetração 4.0% | — | — | métricas JSON |
| `02_parte_inferior_04_calca_cargo` | pants | M-slim | exibicao | ok · penetração 0.0% | — | barra/joelho 0.88→1.04; folga coxa 0.49→3.67 cm; folga joelho 0.61→4.91 cm; folga panturrilha 0.91→4.7 cm | métricas JSON |
| `02_parte_inferior_04_calca_cargo` | pants | M-slim | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_04_calca_cargo` | pants | M-slim | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_04_calca_cargo` | pants | M-slim | agachamento | ok · penetração 5.6% | — | — | métricas JSON |
| `02_parte_inferior_05_calca_chino` | pants | M-slim | exibicao | ok · penetração 0.0% | — | barra/joelho 0.88→0.92; folga coxa 0.49→1.24 cm; folga joelho 0.61→1.75 cm; folga panturrilha 0.91→1.9 cm | vestir/camisa-chino |
| `02_parte_inferior_05_calca_chino` | pants | M-slim | bracos | ok · penetração 0.0% | — | — | vestir/camisa-chino |
| `02_parte_inferior_05_calca_chino` | pants | M-slim | caminhada | ok · penetração 0.0% | — | — | vestir/camisa-chino |
| `02_parte_inferior_05_calca_chino` | pants | M-slim | agachamento | ok · penetração 4.1% | — | — | vestir/camisa-chino |
| `02_parte_inferior_06_calca_moletom` | pants | M-slim | exibicao | ok · penetração 0.0% | — | barra/joelho 0.88→0.75; folga coxa 0.49→1.13 cm; folga joelho 0.61→1 cm; folga panturrilha 0.91→1.04 cm | métricas JSON |
| `02_parte_inferior_06_calca_moletom` | pants | M-slim | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_06_calca_moletom` | pants | M-slim | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_06_calca_moletom` | pants | M-slim | agachamento | ok · penetração 3.9% | — | — | métricas JSON |
| `02_parte_inferior_07_calca_jogger` | pants | M-slim | exibicao | ok · penetração 0.0% | — | barra/joelho 0.88→0.75; folga coxa 0.49→1.13 cm; folga joelho 0.61→1 cm; folga panturrilha 0.91→1.04 cm | métricas JSON |
| `02_parte_inferior_07_calca_jogger` | pants | M-slim | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_07_calca_jogger` | pants | M-slim | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_07_calca_jogger` | pants | M-slim | agachamento | ok · penetração 3.9% | — | — | métricas JSON |
| `02_parte_inferior_08_legging` | leggings | M-slim | exibicao | ok · penetração 0.0% | — | barra/joelho 0.64→0.64; folga coxa 0.17→0.13 cm; folga joelho 0.19→0.15 cm; folga panturrilha 0.14→0.1 cm | métricas JSON |
| `02_parte_inferior_08_legging` | leggings | M-slim | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_08_legging` | leggings | M-slim | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_08_legging` | leggings | M-slim | agachamento | ok · penetração 0.4% | — | — | métricas JSON |
| `02_parte_inferior_09_pantacourt` | culottes | M-slim | exibicao | ok · penetração 0.0% | — | folga coxa 0.65→1.63 cm; folga joelho 1.23→2.89 cm; folga panturrilha 2.4→3.84 cm | métricas JSON |
| `02_parte_inferior_09_pantacourt` | culottes | M-slim | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_09_pantacourt` | culottes | M-slim | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_09_pantacourt` | culottes | M-slim | agachamento | ok · penetração 5.3% | — | — | métricas JSON |
| `02_parte_inferior_10_bermuda` | bermuda | M-slim | exibicao | ok · penetração 0.0% | — | folga coxa 0.49→1.24 cm; folga joelho 0.6→1.94 cm | métricas JSON |
| `02_parte_inferior_10_bermuda` | bermuda | M-slim | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_10_bermuda` | bermuda | M-slim | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_10_bermuda` | bermuda | M-slim | agachamento | ok · penetração 6.0% | — | — | métricas JSON |
| `02_parte_inferior_11_shorts_jeans` | shorts | M-slim | exibicao | ok · penetração 0.0% | — | folga coxa 0.38→0.48 cm | métricas JSON |
| `02_parte_inferior_11_shorts_jeans` | shorts | M-slim | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_11_shorts_jeans` | shorts | M-slim | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `02_parte_inferior_11_shorts_jeans` | shorts | M-slim | agachamento | ok · penetração 3.2% | — | — | métricas JSON |
| `02_parte_inferior_12_saia` | skirt | M-slim | exibicao | ok · penetração 0.0% | — | folga coxa 5.72→6.73 cm | vestir/moletom-saia |
| `02_parte_inferior_12_saia` | skirt | M-slim | bracos | ok · penetração 0.0% | — | — | vestir/moletom-saia |
| `02_parte_inferior_12_saia` | skirt | M-slim | caminhada | ok · penetração 0.1% | — | — | vestir/moletom-saia |
| `02_parte_inferior_12_saia` | skirt | M-slim | agachamento | acima da tolerância · penetração 6.6% | interseção (perna 3.4%, tronco 3.3%) | — | vestir/moletom-saia |
| `02_parte_inferior_13_shorts` | shorts | M-slim | exibicao | ok · penetração 0.0% | — | folga coxa 0.38→0.48 cm | vestir/jaqueta-shorts |
| `02_parte_inferior_13_shorts` | shorts | M-slim | bracos | ok · penetração 0.0% | — | — | vestir/jaqueta-shorts |
| `02_parte_inferior_13_shorts` | shorts | M-slim | caminhada | ok · penetração 0.0% | — | — | vestir/jaqueta-shorts |
| `02_parte_inferior_13_shorts` | shorts | M-slim | agachamento | ok · penetração 3.2% | — | — | vestir/jaqueta-shorts |
| `02_parte_inferior_14_short_saia` | skirt | M-slim | exibicao | ok · penetração 0.0% | — · limitação: saia-short como saia | folga coxa 5.72→6.73 cm | métricas JSON |
| `02_parte_inferior_14_short_saia` | skirt | M-slim | bracos | ok · penetração 0.0% | — · limitação: saia-short como saia | — | métricas JSON |
| `02_parte_inferior_14_short_saia` | skirt | M-slim | caminhada | ok · penetração 0.1% | — · limitação: saia-short como saia | — | métricas JSON |
| `02_parte_inferior_14_short_saia` | skirt | M-slim | agachamento | acima da tolerância · penetração 6.6% | interseção (perna 3.4%, tronco 3.3%) · limitação: saia-short como saia | — | métricas JSON |
| `05_corpo_inteiro_01_vestido` | dress | M-slim | exibicao | ok · penetração 0.1% | — | cintura/busto 1.01→1.07 (corpo 1.03) | vestir/vestido-bota |
| `05_corpo_inteiro_01_vestido` | dress | M-slim | bracos | ok · penetração 0.0% | — | — | vestir/vestido-bota |
| `05_corpo_inteiro_01_vestido` | dress | M-slim | caminhada | ok · penetração 0.2% | — | — | vestir/vestido-bota |
| `05_corpo_inteiro_01_vestido` | dress | M-slim | agachamento | ok · penetração 1.6% | — | — | vestir/vestido-bota |
| `05_corpo_inteiro_02_macacao` | jumpsuit | M-slim | exibicao | ok · penetração 0.1% | — | barra/joelho –→0.92; cintura/busto 1.03→1.07 (corpo 1.03); folga coxa 3.81→1.34 cm | métricas JSON |
| `05_corpo_inteiro_02_macacao` | jumpsuit | M-slim | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `05_corpo_inteiro_02_macacao` | jumpsuit | M-slim | caminhada | ok · penetração 0.1% | — | — | métricas JSON |
| `05_corpo_inteiro_02_macacao` | jumpsuit | M-slim | agachamento | ok · penetração 3.1% | — | — | métricas JSON |
| `05_corpo_inteiro_03_macaquinho` | romper | M-slim | exibicao | ok · penetração 0.1% | — | cintura/busto 1.03→1.07 (corpo 1.03); folga coxa 3.93→0.85 cm | métricas JSON |
| `05_corpo_inteiro_03_macaquinho` | romper | M-slim | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `05_corpo_inteiro_03_macaquinho` | romper | M-slim | caminhada | ok · penetração 0.2% | — | — | métricas JSON |
| `05_corpo_inteiro_03_macaquinho` | romper | M-slim | agachamento | ok · penetração 2.6% | — | — | métricas JSON |
| `05_corpo_inteiro_04_conjunto_coordenado` | jumpsuit | M-slim | exibicao | ok · penetração 0.1% | — · limitação: conjunto como peça única | barra/joelho –→0.92; cintura/busto 1.03→1.07 (corpo 1.03); folga coxa 3.81→1.34 cm | métricas JSON |
| `05_corpo_inteiro_04_conjunto_coordenado` | jumpsuit | M-slim | bracos | ok · penetração 0.0% | — · limitação: conjunto como peça única | — | métricas JSON |
| `05_corpo_inteiro_04_conjunto_coordenado` | jumpsuit | M-slim | caminhada | ok · penetração 0.1% | — · limitação: conjunto como peça única | — | métricas JSON |
| `05_corpo_inteiro_04_conjunto_coordenado` | jumpsuit | M-slim | agachamento | ok · penetração 3.1% | — · limitação: conjunto como peça única | — | métricas JSON |
| `05_corpo_inteiro_05_jardineira` | jumpsuit | M-slim | exibicao | ok · penetração 0.1% | — · limitação: jardineira sem peitilho | barra/joelho –→0.92; cintura/busto 1.03→1.07 (corpo 1.03); folga coxa 3.81→1.34 cm | métricas JSON |
| `05_corpo_inteiro_05_jardineira` | jumpsuit | M-slim | bracos | ok · penetração 0.0% | — · limitação: jardineira sem peitilho | — | métricas JSON |
| `05_corpo_inteiro_05_jardineira` | jumpsuit | M-slim | caminhada | ok · penetração 0.1% | — · limitação: jardineira sem peitilho | — | métricas JSON |
| `05_corpo_inteiro_05_jardineira` | jumpsuit | M-slim | agachamento | ok · penetração 3.1% | — · limitação: jardineira sem peitilho | — | métricas JSON |
| `03_calcados_01_tenis_casual` | shoes | M-slim | exibicao | forma do calçado (molde do pé oculto) | — | — | vestir/camiseta-jeans |
| `03_calcados_01_tenis_casual` | shoes | M-slim | bracos | forma do calçado (molde do pé oculto) | — | — | vestir/camiseta-jeans |
| `03_calcados_01_tenis_casual` | shoes | M-slim | caminhada | forma do calçado (molde do pé oculto) | — | — | vestir/camiseta-jeans |
| `03_calcados_01_tenis_casual` | shoes | M-slim | agachamento | forma do calçado (molde do pé oculto) | — | — | vestir/camiseta-jeans |
| `03_calcados_02_tenis_corrida` | shoes | M-slim | exibicao | forma do calçado (molde do pé oculto) | — | — | vestir/jaqueta-shorts |
| `03_calcados_02_tenis_corrida` | shoes | M-slim | bracos | forma do calçado (molde do pé oculto) | — | — | vestir/jaqueta-shorts |
| `03_calcados_02_tenis_corrida` | shoes | M-slim | caminhada | forma do calçado (molde do pé oculto) | — | — | vestir/jaqueta-shorts |
| `03_calcados_02_tenis_corrida` | shoes | M-slim | agachamento | forma do calçado (molde do pé oculto) | — | — | vestir/jaqueta-shorts |
| `03_calcados_05_loafer` | shoes | M-slim | exibicao | forma do calçado (molde do pé oculto) | — | — | métricas JSON |
| `03_calcados_05_loafer` | shoes | M-slim | bracos | forma do calçado (molde do pé oculto) | — | — | métricas JSON |
| `03_calcados_05_loafer` | shoes | M-slim | caminhada | forma do calçado (molde do pé oculto) | — | — | métricas JSON |
| `03_calcados_05_loafer` | shoes | M-slim | agachamento | forma do calçado (molde do pé oculto) | — | — | métricas JSON |
| `03_calcados_09_oxford` | shoes | M-slim | exibicao | forma do calçado (molde do pé oculto) | — | — | vestir/camisa-chino |
| `03_calcados_09_oxford` | shoes | M-slim | bracos | forma do calçado (molde do pé oculto) | — | — | vestir/camisa-chino |
| `03_calcados_09_oxford` | shoes | M-slim | caminhada | forma do calçado (molde do pé oculto) | — | — | vestir/camisa-chino |
| `03_calcados_09_oxford` | shoes | M-slim | agachamento | forma do calçado (molde do pé oculto) | — | — | vestir/camisa-chino |
| `03_calcados_11_bota_cano_curto` | boots | M-slim | exibicao | ok · penetração 0.0% | — | — | vestir/vestido-bota |
| `03_calcados_11_bota_cano_curto` | boots | M-slim | bracos | ok · penetração 0.0% | — | — | vestir/vestido-bota |
| `03_calcados_11_bota_cano_curto` | boots | M-slim | caminhada | ok · penetração 0.0% | — | — | vestir/vestido-bota |
| `03_calcados_11_bota_cano_curto` | boots | M-slim | agachamento | ok · penetração 0.0% | — | — | vestir/vestido-bota |
| `03_calcados_12_bota_cano_longo` | boots | M-slim | exibicao | ok · penetração 0.0% | — | folga panturrilha 0.57→0.49 cm | métricas JSON |
| `03_calcados_12_bota_cano_longo` | boots | M-slim | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_12_bota_cano_longo` | boots | M-slim | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_12_bota_cano_longo` | boots | M-slim | agachamento | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_14_coturno` | boots | M-slim | exibicao | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_14_coturno` | boots | M-slim | bracos | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_14_coturno` | boots | M-slim | caminhada | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_14_coturno` | boots | M-slim | agachamento | ok · penetração 0.0% | — | — | métricas JSON |
| `03_calcados_13_sandalia` | shoes | M-slim | exibicao | forma do calçado (molde do pé oculto) | — · limitação: sandália como sapato fechado | — | métricas JSON |
| `03_calcados_13_sandalia` | shoes | M-slim | bracos | forma do calçado (molde do pé oculto) | — · limitação: sandália como sapato fechado | — | métricas JSON |
| `03_calcados_13_sandalia` | shoes | M-slim | caminhada | forma do calçado (molde do pé oculto) | — · limitação: sandália como sapato fechado | — | métricas JSON |
| `03_calcados_13_sandalia` | shoes | M-slim | agachamento | forma do calçado (molde do pé oculto) | — · limitação: sandália como sapato fechado | — | métricas JSON |
| `03_calcados_16_salto_alto` | shoes | M-slim | exibicao | forma do calçado (molde do pé oculto) | — · limitação: salto sem salto modelado | — | métricas JSON |
| `03_calcados_16_salto_alto` | shoes | M-slim | bracos | forma do calçado (molde do pé oculto) | — · limitação: salto sem salto modelado | — | métricas JSON |
| `03_calcados_16_salto_alto` | shoes | M-slim | caminhada | forma do calçado (molde do pé oculto) | — · limitação: salto sem salto modelado | — | métricas JSON |
| `03_calcados_16_salto_alto` | shoes | M-slim | agachamento | forma do calçado (molde do pé oculto) | — · limitação: salto sem salto modelado | — | métricas JSON |
