# Módulo 01 — limites arquiteturais

Camadas identificadas pelas dependências de fonte: Next/React → cliente HTTP → Spring web → application → domain/ports → infrastructure. As dependências de arquivos resolvidas estão em `dependencies.csv`; anotações JPA, injeção de construtor, interfaces e integrações constam nos inventários próprios. Essa descrição não certifica conformidade Clean Architecture de cada classe.

Primeiro fluxo lido: edição de documento do Atelier, histórico local e fronteira de persistência. A extração deixa política de histórico testável sem React, rede, Three.js ou banco. A política de autorização permanece no editor e no backend; o helper não decide acesso. Não se moveu código transacional.

Documentos históricos encontrados no Git e recuperados do checkout esparso. As taxonomias registram99 e107 entidades em datas anteriores; hoje há148 @Entity. Ver DOCUMENTATION_GAPS.md. O checkpoint anterior confundiu ausência no checkout com ausência no repositório; essa conclusão foi corrigida.

Pendências: autorização efetiva global, resposta/body de todos os contratos, entidades sem consumidor direto, integração por eventos/jobs, regras em componentes extensos, símbolos Java wildcard e routers Python. Anotações locais de segurança não provam permissões efetivas.


## Atualização para o PR

Segundo lote: inspetor de propriedades e entradas de valores separados, com14 testes funcionais e13 de auditoria. Limites claros em LINE_LIMITS.md; contagens e resíduos atuais nos CSVs/metadados regenerados. O JSX foi composto em componentes; a comparação byte a byte do arquivo inteiro deixou de se aplicar. O histórico isolado tinha JSX idêntico antes do segundo lote (history-lot-metrics.json).
