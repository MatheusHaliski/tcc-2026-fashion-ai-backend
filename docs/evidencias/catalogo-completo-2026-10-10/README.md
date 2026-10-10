# Evidências · catálogo completo no criador de peça e na Busca (10/10/2026)

Capturas do Next.js local (`/pieces/new` e `/search?tab=ACERVO`), desktop 1280×900 e celular 390×844. A API foi
simulada a partir do arquivo do acervo versionado (`data/catalog/acervo/acervo-oficial-2026-10-05.jsonl.gz`:
9 573 produtos, 45 marcas) — nomes, marcas e tipos reais; as fotos oficiais foram trocadas pela imagem padrão FAI de
cada categoria. Roteiro: Playwright com rotas simuladas; nenhum serviço remoto foi chamado.

| Arquivo | O que mostra | Resultado |
|---|---|---|
| `01-criador-resumo-*` | linha "Acervo completo" e "Ver todo o acervo" acima da grade de marcas | 9.573 peças de 45 marcas |
| `02-criador-marca-*` | marca tocada na grade, sem digitar nada | "300 peças de Farm Rio", página 1 de 38 (desktop) / 75 (celular) |
| `03-criador-marca-mais-*` | "Avançar" além das 48 já carregadas | página 7 (desktop) / 13 (celular); "Mostrando 96 de 300"; só 2 páginas pedidas ao servidor |
| `04-busca-acervo-*` | Buscar → aba Acervo | catálogo inteiro, "Acervo completo: 9.573 peças de 45 marcas" |
| `05-busca-acervo-mais-*` | rolagem / "Carregar mais" | "Mostrando 48 de 9.573" e seguintes |

Nenhum erro de página nas quatro execuções.
