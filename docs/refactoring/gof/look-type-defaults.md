# Tipo de look padrão na criação

Padrão GoF: NENHUM. `CreationLookDefaults` concentra a inicialização das novas entidades
antes feita por `SchemeService` e `WardrobeService`, preservando autorização, transação,
validação, auditoria e persistência nos serviços originais. Não há estratégias intercambiáveis.

A preferência referencia `TipoLook` e pode ser desativada com valor nulo. Novos esquemas
recebem a entidade do catálogo; peças usam seu campo de taxonomia `sex`, normalizando
`UNISEX` do catálogo para `UNISSEX`. Edições não reaplicam o padrão. Ao salvar no Mirror,
um tipo explicitamente escolhido prevalece; ausência de tipo preserva o padrão do perfil.

A verificação de regressão cobre o estado sem preferência, configuração/desativação,
isolamento entre usuários e novos registros após a mudança do padrão.

Linhas físicas antes → depois nas responsabilidades extraídas:

- `fai-application/src/main/java/br/com/fashionai/application/service/SchemeService.java`: 1260 → 1258.
- `fai-application/src/main/java/br/com/fashionai/application/service/WardrobeService.java`: 990 → 988.
- `components/mirror/mirror-controls.tsx`: 306 → 304.
- `app/(site)/(app)/pieces/new/page.tsx`: 316 → 300.

Validação antes da integração na main: 37 testes Java (preferência, inicialização, cadastro e esquemas), 58 testes
de interface/fluxo de criação; TypeScript, i18n e catraca de linhas aprovados.
Migration V107 preparada, sem execução em banco.

Integração na main atual: build Java aprovado com os mesmos 37 testes; TypeScript,
i18n e catraca aprovados. Frontend: 55 testes passam e quatro falhas preexistentes
foram reproduzidas também sem este commit (photo-flow: dois casos; settings-info
e mirror-tipo-look: um caso cada). Migration renumerada para V107 para evitar
colisão com as migrations incorporadas à main.
