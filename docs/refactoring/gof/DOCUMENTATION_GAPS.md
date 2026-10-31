# Reconciliação dos documentos arquiteturais

Correção do checkpoint anterior: os cinco documentos citados como ausentes existem no Git. Estavam fora do checkout esparso. Foram lidos a partir da revisão7b473d2b, sem modificar seus conteúdos. O registro anterior não deve ser interpretado como ausência no GitHub.

- docs/entidades/TAXONOMIA_ENTIDADES.md declara auditoria de04/10 com99 entidades e migrations V1–V30. Esse recorte não representa mais a fonte atual.
- docs/taxonomia/taxonomia-de-entidades.md declara107 entidades em05/10. O inventário atual distingue148 classes @Entity,2 @MappedSuperclass e2 @Embeddable. Comparar107 com152 misturaria categorias; a comparação de entidades é107 vs148, sujeita ao escopo do documento gerado.
- docs/aulas/mapa-telas-api.md oferece jornadas e ligações frontend/controller/service; não substitui inventário de todas as rotas. O Atelier GLB e suas rotas de guest devem ser reconciliados com647 mapeamentos REST atuais, sem inferir autorização da URL.
- docs/diagramas/fashionai-componentes-v5.puml é visão de componentes; não prova todas as dependências de imports ou invocações. O grafo estático atual tem limitações de DI/reflection explícitas.
- docs/banco-de-dados/AULA_BANCO_DE_DADOS.md é material didático de modelo, transações e migrations. Não equivale à validação do schema efetivo de produção, que não foi acessado.

As duas taxonomias precisam de atualização coordenada pelo gerador e revisão humana, preservando RFs/Trello e sem inventar migrations ou relações. Este PR não altera números de RF nem documentos históricos para simular atualização completa.
