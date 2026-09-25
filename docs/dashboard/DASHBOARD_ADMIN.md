# Dashboard administrativo e tipo de perfil ADMIN

## Quem vê o quê

| Perfil | Menu lateral | Onde vê os próprios números |
|---|---|---|
| ADMIN (tipo de perfil ou papel `role = ADMIN`) | Grupo "Gestão" com **Dashboard gerencial** (`/admin/dashboard`) | Todas as abas abaixo |
| MARCA / CELEBRIDADE | Nenhum item de gestão | Botão **Painel do emissor** no próprio perfil (`/brands/<slug>`) → `/dashboard` |
| PESSOAL | Nenhum item de gestão | Destaques e Inventory Score |

O backend aplica a mesma regra: `/api/admin/**` exige `ROLE_ADMIN` no JWT e `DashboardService.admin` chama `guard.requireAdmin`. O painel do emissor recusa perfis pessoais.

## Conta de administração

O cadastro público nunca cria um ADMIN (`IdentityService.register` recusa o tipo com `TIPO_INVALIDO`). A primeira conta nasce na subida da aplicação (`AdminBootstrap`), a partir de variáveis de ambiente do servidor:

| Variável | Uso |
|---|---|
| `FAI_ADMIN_EMAIL` | E-mail da conta. Se já existir uma conta com ele, ela é promovida a `role = ADMIN`. |
| `FAI_ADMIN_PASSWORD` | Senha, só usada na criação (mínimo 12 caracteres). Trocar a variável depois não muda a senha. |
| `FAI_ADMIN_USERNAME` | @ da conta (padrão `admin`). |
| `FAI_ADMIN_DISPLAY_NAME` | Nome exibido (padrão "Administração Fashion AI"). |

Sem `FAI_ADMIN_EMAIL` e `FAI_ADMIN_PASSWORD`, nada acontece. As contas seguintes são promovidas na tela Usuários do painel.

## Abas e widgets

| Aba | Widgets | Fonte |
|---|---|---|
| Visão geral | Alertas para decisão · Indicadores do período (com variação sobre o mesmo número de dias anteriores) · Novos usuários por dia · Conteúdo criado por dia · Usuários por tipo de perfil | `sp_admin_kpis`, `sp_timeseries`, `usersByProfile` |
| Usuários | Funil de ativação (cadastro → e-mail → peça → look → publicado → Look do Dia) · Usuários e looks por país (globo) · Usuários mais ativos · Atividade por dia e hora | `activationFunnel`, `vw_country_insights`, `topUsers`, `activityHeatmap` |
| Conteúdo | Peças por categoria · Marcas mais usadas · Looks por faixa de Hype · Moderação (por estado e fila pendente) | `categories`, `vw_brand_usage`, `hypeBands`, `moderation_queue` |
| Engajamento | Curtidas, comentários e compartilhamentos por dia · Vínculos de selo · Desafios · FAI Points por ação · Faixas do Inventory Score | `engagementSeries`, `sealFunnel`, `challengeStats`, `pointsByAction` |
| IA e custos | Custo de IA por dia · Chamadas por capacidade (8 maiores + "Outros") · Custo por país | `sp_timeseries('ai_cost')`, `ai_inference_log`, `sp_ai_cost_by_country` |
| Sistema | Saúde (latência do banco, memória, tempo no ar, IA remota, último backup) · Processamentos de foto e 3D (estado, tempo médio, falhas agrupadas) · Segurança e auditoria (logins falhos, acessos negados e erros por dia, falhas por ação, últimos eventos) | `dbLatencyMs`, JVM, `pipeline_jobs`, `audit_log` |

Filtros em uma linha acima das abas: período (datas ou 7/30/90 dias), país e tipo de perfil. Clicar num país no globo também filtra. **Personalizar** liga e desliga widgets por aba; a escolha e a última aba aberta ficam em `user_preferences.dashboard_layout_json`. **Exportar CSV** baixa os KPIs com o valor do período anterior.

## Alertas

| Regra | Nível |
|---|---|
| IA em fallback em 20 % ou mais das chamadas | atenção |
| Mais de 20 itens na fila de moderação | atenção |
| Marca/celebridade aguardando validação | info |
| Capacidade de IA com maior custo no período | info |
| Conversão de vínculo de selo em resgate | info |
| 20 ou mais logins falhos num único dia | crítico |
| 30 ou mais acessos negados num único dia | atenção |

## Gráficos

`components/charts.tsx` segue o método de dataviz do projeto:

- Paleta categórica validada em ordem fixa, com passos próprios para o tema escuro (tokens `--series-1…8` em `app/globals.css`). Validação: CVD ΔE ≥ 8 e visão normal ΔE ≥ 15 entre vizinhas, nos dois temas.
- Cor por entidade: tipo de perfil tem cor fixa; gráficos de uma série usam uma cor só; a nona categoria vira "Outros".
- Barras de até 24 px com ponta arredondada, linhas de 2 px, área a 10 %, grade sólida de 1 px.
- Texto sempre na tinta do tema; a cor da série fica só no ícone da legenda.
- Tabela de dados sob os gráficos ("Ver os dados em tabela"): alívio para as três cores do tema claro abaixo de 3:1 e para quem não vê o gráfico.
- Mapa de calor numa rampa sequencial de um tom (`--seq-1…7`), com valor em cada célula por título e rótulo acessível.
- Status (bom/atenção/crítico) usa as cores reservadas, sempre com texto ao lado.

## Índices (migração V23)

`audit_log(timestamp)`, `audit_log(resultado, timestamp)`, `reactions(created_at)`, `comments(created_at)`, `shares(created_at)`, `moderation_queue(created_at)`.
