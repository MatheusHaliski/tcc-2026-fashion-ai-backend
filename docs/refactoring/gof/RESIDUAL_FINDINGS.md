# Cobertura residual após a onda 02–20

4003 entradas de cobertura: 3937 PENDING, 22 PARTIAL, 44 DONE/COMPLETED. Inventário por sintaxe não equivale a decisão arquitetural de todos os itens.

- Domínio 02: 96 entradas pendentes/parciais.
- Domínio 03: 103 entradas pendentes/parciais.
- Domínio 04: 228 entradas pendentes/parciais.
- Domínio 05: 185 entradas pendentes/parciais.
- Domínio 06: 379 entradas pendentes/parciais.
- Domínio 07: 78 entradas pendentes/parciais.
- Domínio 08: 196 entradas pendentes/parciais.
- Domínio 09: 314 entradas pendentes/parciais.
- Domínio 10: 231 entradas pendentes/parciais.
- Domínio 11: 107 entradas pendentes/parciais.
- Domínio 12: 333 entradas pendentes/parciais.
- Domínio 13: 126 entradas pendentes/parciais.
- Domínio 14: 127 entradas pendentes/parciais.
- Domínio 15: 90 entradas pendentes/parciais.
- Domínio 16: 281 entradas pendentes/parciais.
- Domínio 17: 175 entradas pendentes/parciais.
- Domínio 18: 249 entradas pendentes/parciais.
- Domínio 19: 220 entradas pendentes/parciais.
- Domínio 20: 106 entradas pendentes/parciais.
- Domínio 21: 83 entradas pendentes/parciais.
- Domínio 22: 252 entradas pendentes/parciais.

Cada domínio 02–20 recebeu um lote (ver ONDA-DOMINIOS-02-20.md); os arquivos originais tocados estão PARTIAL e cada `NN-RESULTADO.md` indica o próximo candidato.
Tamanho: 260 arquivos de código acima do limite continuam congelados em `scripts/refactoring/line_baseline.json` (não podem crescer).
Achados que mudariam comportamento estão em RISK_REGISTER.md e não foram corrigidos.

Pendências estruturais herdadas: segurança efetiva de cada endpoint, body/response de cada consumidor, herança/metaanotações Spring, montagem de routers Python, imports wildcard/nested e revisão semântica dos itens PENDING. Nenhuma alegação de 100% refatorado ou revisado.
