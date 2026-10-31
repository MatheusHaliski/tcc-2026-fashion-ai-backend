# Módulo 00 — inventário de fontes

Universo: fontes versionadas + novas fontes não ignoradas, extensões explícitas em `inventory_gof.py`; dependências, artefatos de build e diretórios de terceiros excluídos com justificativa em `excluded-files.csv`. `all-repository-files.csv` também enumera os demais arquivos versionados (documentos, assets, configurações e dados), sem classificá-los como refatorados.

A fotografia de `audit-metadata.json` contém os totais exatos. Inclui 93 páginas Next.js, 2 handlers BFF, 647 mapeamentos REST Java, 152 tipos JPA (148 @Entity,2 @MappedSuperclass e2 @Embeddable), 152 repositories, 93 services anotados, 70 controllers e 22 ports. Classes sem anotações, funções, componentes, hooks e pipelines permanecem nos inventários de símbolos/fontes e Python. Contagens são de sintaxe estática, não de objetos ou rotas efetivas em produção.

AST: JavaParser/Java21, TypeScript e `ast` Python. Nenhuma falha de parsing nesta fotografia. Imports, dependências, consumidores HTTP e rotas têm CSVs separados. Arquivos gerados reconhecidos são sinalizados; nenhuma classe é aprovada por ausência de achados.

O ranking top30 está em `../FILE_COMPLEXITY_INVENTORY.md`; sua heurística lexical tem universo menor que este inventário AST. Os dois totais não são intercambiáveis. O snapshot anterior está em `complexity-baseline/`.

Resultado: inventário automatizado executado; análise semântica global pendente.


## Atualização para o PR

Segundo lote: inspetor de propriedades e entradas de valores separados, com14 testes funcionais e13 de auditoria. Limites claros em LINE_LIMITS.md; contagens e resíduos atuais nos CSVs/metadados regenerados. O JSX foi composto em componentes; a comparação byte a byte do arquivo inteiro deixou de se aplicar. O histórico isolado tinha JSX idêntico antes do segundo lote (history-lot-metrics.json).
