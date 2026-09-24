# Teste ponta a ponta da API (E2E)

Chama a API real e, para cada chamada, registra o status HTTP, o que a aplicação leu e gravou no MySQL (lido do
`general_log`, filtrado pelo usuário `fashionai`) e os arquivos novos no storage de mídia.

## Rodar

```bash
# MySQL com general_log em tabela
mysql -uroot -e "SET GLOBAL log_output='TABLE'; SET GLOBAL general_log='ON';"
# backend (8080) e frontend (3000) no ar; contas de demonstração criadas pelo seed
export FAI_E2E_WORKDIR=$PWD/work            # onde ficam ctx.json, results_*.json e a mídia
export FAI_BACKEND_LOG_GLOB='/caminho/do/log/app*.log'   # códigos de e-mail (provider=log)
python3 inventory.py && python3 frontend_map.py           # inventário dos endpoints e telas que os chamam
python3 run.py suite_1,suite_2,suite_3,suite_4            # 452 passos
python3 coverage.py                                       # endpoints cobertos x inventário
python3 table.py work/results_suite_1_suite_2_suite_3_suite_4.json ../../docs/testes
python3 evidence.py work/results_all.json ../../docs/testes/tabela.json work/cartoes
node shoot_cards.js work/cartoes work/fotos               # 1 foto por passo (até 5 por endpoint)
node shoot21.js e2e_<run>b@example.com                   # fluxo do buscador de marcas (RF4/RF5/RF13)
node shoot22.js work/ctx.json                             # telas que comprovam os endpoints de criação
python3 pack_evidence.py work/cartoes work/fotos b22 b21 ../../docs/testes/tabela.json work/evidencias
```

`suite_1` identidade, conta e peças · `suite_2` looks, social, busca, fotos, DNA, IA, provador, marcas, selos, admin ·
`suite_3` RF25 e RF27–RF39 · `suite_4` exclusões, sessões, aprovação de marca, moderação, cupons e logout.
