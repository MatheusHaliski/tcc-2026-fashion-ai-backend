# Auditoria FashionAI: correções e validação — 11/10/2026

Referência: auditoria fornecida pelo usuário (seções 2, 4 e 36 perguntas). A auditoria original descreve uma versão anterior. Este relatório distingue correções desta branch de soluções já existentes no main; presença no código não equivale a teste de todos os fluxos em produção.

## Comportamentos solicitados

- Aparência permanece na criação de looks, identificada como opcional. Detalhes permite ir diretamente à revisão; revisar e salvar não apaga a aparência existente. Dois testes cobrem pular e personalizar.
- Busca catalogada mantém texto/autocomplete e usa a mesma matriz clicável de marcas do Provador. Selecionar novamente desmarca; categoria e paginação do acervo são preservadas.
- Build: TypeScript 7 permanece como compilador; scanner/extrator usam alias fixo de TypeScript 5.9.3 para a API AST ausente no pacote 7.

## Tabela por tela e fluxo

“Base existente” indica implementação encontrada no main; o reteste em produção continua necessário para os cenários sem cobertura de navegador. Não foram alterados dados, permissões, catálogo ou contas em produção.

| ID | Problema da auditoria | Tratamento | Evidência no código |
|---|---|---|---|
| G1 | Títulos de página com 14 px, igual ao corpo | Escala h1 26/32 px; rótulos 12 px; verificador em prebuild. | `components/app-shell.tsx` |
| G2 | Códigos de requisito e jargão técnico na interface | Base existente identificada na revisão de código; não representa certificação em produção. | `components/app-shell.tsx` |
| G3 | Dados de teste E2E na vitrine | Base existente identificada na revisão de código; não representa certificação em produção. | `components/app-shell.tsx` |
| G4 | Salto de layout ao carregar a sessão | Base existente identificada na revisão de código; não representa certificação em produção. | `components/app-shell.tsx` |
| G5 | Navegação plana, ícones iguais e busca escondida no celular | Navegação agrupada e Buscar na barra móvel já existentes; descoberta de pessoas/marcas adicionada ao Feed. | `components/app-shell.tsx` |
| G6 | Seletor de idioma ocupa o cabeçalho do celular | Base existente identificada na revisão de código; não representa certificação em produção. | `components/app-shell.tsx` |
| G7 | Fundo com padrão de moedas atrás de tudo | Base existente identificada na revisão de código; não representa certificação em produção. | `components/app-shell.tsx` |
| T1 | Tema escuro com menu e cards brancos | Perfil usa superfícies e cores semânticas do tema. | `components/profile-header.tsx` |
| F1 | Card de look com hierarquia fraca | Hierarquia do card compartilhado existente; placeholders de selos vazios removidos nesta branch. | `components/fashion-card.tsx; components/expanded-card.tsx; components/hype` |
| F5 | Arte AURA/material tímida | Base existente identificada na revisão de código; não representa certificação em produção. | `components/fashion-card.tsx; components/expanded-card.tsx; components/hype` |
| F2 | HypeScore com precisão sem explicação e cor de erro | Base existente identificada na revisão de código; não representa certificação em produção. | `components/fashion-card.tsx; components/expanded-card.tsx; components/hype` |
| F3 | Detalhe do look com 15+ ações de mesmo peso | Base existente identificada na revisão de código; não representa certificação em produção. | `components/fashion-card.tsx; components/expanded-card.tsx; components/hype` |
| F4 | Card PNG exportado em inglês e em dólar | Base existente identificada na revisão de código; não representa certificação em produção. | `components/fashion-card.tsx; components/expanded-card.tsx; components/hype` |
| C1 | No celular, filtros ocupam a primeira tela e a grade tem 1 coluna | Base existente identificada na revisão de código; não representa certificação em produção. | `components/filter-bar.tsx; components/piece-card.tsx` |
| C2 | Card de peça com microtexto e placeholders | Rótulos mínimos de 12 px e placeholders de selos vazios removidos. | `components/filter-bar.tsx; components/piece-card.tsx` |
| C3 | Filtros truncados no tablet | Base existente identificada na revisão de código; não representa certificação em produção. | `components/filter-bar.tsx; components/piece-card.tsx` |
| L2 | Adicionar peça: fluxo claro, formulário longo | Campos de identificação e cor primeiro; demais campos em Mais detalhes, com abertura automática quando há erro, sem apagar valores. | `components/scheme-builder.tsx; app/(site)/(app)/pieces/new/page.tsx` |
| L1 | Criar look: 5 etapas em chips que quebram linha | Aparência mantida como etapa opcional; revisão direta, título sugerido e entrada pelas peças pré-selecionadas. | `components/scheme-builder.tsx; app/(site)/(app)/pieces/new/page.tsx` |
| S1 | Duas telas para o mesmo perfil; abas cortadas | Base existente identificada na revisão de código; não representa certificação em produção. | `app/(site)/(app)/u/[username]/page.tsx; app/(site)/(app)/notifications/page.tsx` |
| S2 | Perfil de celebridade é um beco sem saída | Base existente identificada na revisão de código; não representa certificação em produção. | `app/(site)/(app)/u/[username]/page.tsx; app/(site)/(app)/notifications/page.tsx` |
| S3 | Marca e desafio falham em silêncio | Base existente identificada na revisão de código; não representa certificação em produção. | `app/(site)/(app)/u/[username]/page.tsx; app/(site)/(app)/notifications/page.tsx` |
| S4 | "Bloquear" com o mesmo peso de "Seguir" | Base existente identificada na revisão de código; não representa certificação em produção. | `app/(site)/(app)/u/[username]/page.tsx; app/(site)/(app)/notifications/page.tsx` |
| S5 | Seguir e curtir só atualizam após o servidor responder | Seguir otimista, prevenção de envio duplicado e rollback; curtidas já possuem atualização otimista. | `app/(site)/(app)/u/[username]/page.tsx; app/(site)/(app)/notifications/page.tsx` |
| S6 | Notificações com categorias em inglês e excesso de conquistas | Base existente identificada na revisão de código; não representa certificação em produção. | `app/(site)/(app)/u/[username]/page.tsx; app/(site)/(app)/notifications/page.tsx` |
| S7 | Textos não traduzidos no perfil | Base existente identificada na revisão de código; não representa certificação em produção. | `app/(site)/(app)/u/[username]/page.tsx; app/(site)/(app)/notifications/page.tsx` |
| B1 | Busca no celular: 5 selects antes do resultado | Base existente identificada na revisão de código; não representa certificação em produção. | `components/filter-bar.tsx; components/showcase/runway-panel.tsx` |
| B2 | Explorador pesado e denso | Base existente identificada na revisão de código; não representa certificação em produção. | `components/filter-bar.tsx; components/showcase/runway-panel.tsx` |
| Q1 | Meu Quarto: controles sobre a cena | Base existente identificada na revisão de código; não representa certificação em produção. | `components/room3d; app/(site)/(app)/mirror/page.tsx` |
| Q2 | Espelho: estouro lateral e vazio grande | Base existente identificada na revisão de código; não representa certificação em produção. | `components/room3d; app/(site)/(app)/mirror/page.tsx` |
| P1 | FAI Points renderiza 391 itens de uma vez | Base existente identificada na revisão de código; não representa certificação em produção. | `components/hub; components/room3d/room-store.tsx; app/(site)/(app)/highlights/page.tsx` |
| P2 | FLAIR com jargão sem legenda | Base existente identificada na revisão de código; não representa certificação em produção. | `components/hub; components/room3d/room-store.tsx; app/(site)/(app)/highlights/page.tsx` |
| P3 | Destaques: bom modelo, com lacunas | Base existente identificada na revisão de código; não representa certificação em produção. | `components/hub; components/room3d/room-store.tsx; app/(site)/(app)/highlights/page.tsx` |
| P4 | Admin estoura no celular | Base existente identificada na revisão de código; não representa certificação em produção. | `components/hub; components/room3d/room-store.tsx; app/(site)/(app)/highlights/page.tsx` |
| R1 | Sem onboarding; destino inicial inconsistente | Base existente identificada na revisão de código; não representa certificação em produção. | `components/onboarding.tsx; app/(site)/(auth)/register/page.tsx; components/ui/index.tsx` |
| R2 | Cadastro longo e fora de ordem | Base existente identificada na revisão de código; não representa certificação em produção. | `components/onboarding.tsx; app/(site)/(auth)/register/page.tsx; components/ui/index.tsx` |
| R3 | Switch sem nome acessível | Base existente identificada na revisão de código; não representa certificação em produção. | `components/onboarding.tsx; app/(site)/(auth)/register/page.tsx; components/ui/index.tsx` |
| A1 | Texto pequeno e contraste baixo | CSS abaixo de 12 px corrigido; monogramas e contraste dos hubs corrigidos. | `components/ui/index.tsx; app/(site)/globals.css` |
| A2 | Alvos de toque pequenos | Base existente identificada na revisão de código; não representa certificação em produção. | `components/ui/index.tsx; app/(site)/globals.css` |
| A3 | Foco em diálogos e no menu lateral | Focus trap compartilhado com pilha de modais, Escape do modal superior e restauração de foco/scroll. | `components/ui/index.tsx; app/(site)/globals.css` |
| A4 | Campos com 14 px | Base existente identificada na revisão de código; não representa certificação em produção. | `components/ui/index.tsx; app/(site)/globals.css` |
| I1 | Imagens sem otimização | Next Image para arte pública confiável; miniaturas existentes mantidas; ZIPs preservados fora de public e do deploy. | `components/media-image.tsx; next.config.ts` |
| I2 | JavaScript por rota | Background Studio carregado sob demanda; 3D já usa importação dinâmica. | `components/media-image.tsx; next.config.ts` |
| FE1 | Valores soltos pelo código | Espaçamento semântico, página /design, stylelint e verificação tipográfica; cores de imagens/arte permanecem dados dinâmicos. | `components/fashion-card.tsx; components/filter-bar.tsx; scripts/ux/check-design.cjs` |
| FE2 | Componentes parecidos implementados de formas diferentes | Grade de marcas única no criador e provador; foco compartilhado nos overlays. | `components/fashion-card.tsx; components/filter-bar.tsx; scripts/ux/check-design.cjs` |

## As 36 perguntas: solução e vínculo com a implementação

As perguntas são critérios de avaliação, não 36 defeitos independentes. O vínculo abaixo evita tratá-las como concluídas apenas por alterar uma única tela. IA real, relevância de busca, retenção e desempenho em aparelhos físicos precisam de validação própria.

| Pergunta | Critério | Itens que materializam a solução |
|---|---|---|
| 1 | Parece um produto de moda atual e profissional? | G1 G2 G3 G7 |
| 2 | Telas simples, incompletas ou defasadas? | S2 S3 Q2 P3 |
| 3 | Há consistência? | FE1 FE2 |
| 4 | Tem personalidade própria? | G5 G7 F5 |
| 5 | Os cards têm hierarquia clara? | F1 C2 |
| 6 | Imagens têm qualidade adequada? | I1 |
| 7 | Gradientes, bordas ou efeitos ajudariam? | F5 |
| 8 | Vazios ou excesso? | P1 F3 Q2 |
| 9 | As cinco mudanças visuais de maior impacto | G1 G2 G3 F1 G5 G7 I1 |
| 10 | Um usuário novo entende a página inicial? | R1 |
| 11 | É fácil encontrar as funções principais? | G5 |
| 12 | Quantos passos para adicionar peça e criar look? | L1 L2 |
| 13 | Botões e ícones deixam claro o resultado? | G5 F3 S4 |
| 14 | Há retorno de carregando, sucesso, erro, vazio e desabilitado? | S3 |
| 15 | Os formulários explicam campos e preservam dados? | R2 |
| 16 | Manual × IA é claro, com revisão antes de confirmar? | L1 |
| 17 | A diferença entre salvar, publicar, favoritar, compartilhar, remixar e editar é clara? | F3 |
| 18 | O feed ajuda a descobrir looks, peças, marcas e pessoas? | G3 G5 |
| 19 | Os cards informam o suficiente para agir? | F1 |
| 20 | Curtir, comentar e seguir têm estados claros e atualizam? | S5 |
| 21 | Perfis públicos e privados comunicam o que se vê? | S1 |
| 22 | Busca e filtros ajudam? | B1 |
| 23 | Rankings e HypeScore explicam o que medem? | F2 |
| 24 | "Destaques do meu inventário" é útil? | P3 |
| 25 | O Copilot usa o guarda-roupa e o Meu Quarto? | Q1 |
| 26 | O que quebra em cada tamanho? | Q2 P4 S1 C3 |
| 27 | Texto e controles são legíveis em tela pequena? | A1 A2 |
| 28 | Contraste, foco, alt e rótulos? | A1 A3 R3 |
| 29 | Animações prejudicam? | B2 Q1 I2 |
| 30 | O carregamento é eficiente? | G4 I1 I2 |
| 31 | Quais testes foram executados? | A1 A3 |
| 32 | O CSS é reutilizável? | FE1 |
| 33 | Existe um design system? | FE1 G1 |
| 34 | Componentes parecidos implementados de formas diferentes? | FE2 |
| 35 | Improvisos, z-index, cortes, medidas fixas? | FE1 G4 |
| 36 | Dá para atualizar o visual sem mexer em cada tela? | FE1 G1 |

## Plano priorizado e critérios de conclusão

1. Tipografia, textos, contraste e formulários: tokens e verificador no prebuild; scanner de i18n e testes de componentes.
2. Fluxos e consistência: Aparência opcional, grade compartilhada, seguir otimista, foco compartilhado e página /design.
3. Imagens e carga: otimização de arte pública, ZIPs fora da publicação, Background Studio sob demanda; 3D permanece sob demanda.
4. Descoberta: pessoas e marcas consultadas pelo endpoint existente, respeitando visibilidade; resultados vazios não inventam recomendações.
5. Monitoramento: RUM opt-in (`NEXT_PUBLIC_RUM_ENABLED=true`) envia apenas métrica, valor, rota anonimizada e faixa de dispositivo. Endpoint valida origem e limita 1 KB; não envia nomes, IDs, tokens nem query strings. Logs estruturados precisam ser agregados pela plataforma para p75; não há histórico de produção nesta execução.

## Limites das notas finais

Não atribuir 10 apenas porque o código compila. As notas finais exigem reteste abrangente das telas, teclado, temas, privacidade e erros, além de evidências de desempenho. Capturas usam frontend em build de produção com respostas de API simuladas, sem acesso ao banco de produção. A geração de IA real, retina/Safari em dispositivo físico, p75 de RUM e qualidade de recomendações permanecem fora dessa medição.

## Reprodução

```sh
npm ci
npm run typecheck
npm test -- --maxWorkers=2
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080 DEV_GATE_ENABLED=false npm run build
DEV_GATE_ENABLED=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8080 npm start
```

Em outro terminal, instale Playwright 1.55.1 e @axe-core/playwright 4.10.2 em diretório de ferramentas e execute `scripts/ux/browser-audit.cjs` com `NODE_PATH` apontando para esse node_modules. O script intercepta a API configurada e gera screenshots e audit.json; falha em erro JS, overflow, texto abaixo de 12 px, violações WCAG ou CLS > 0,1. A seleção de telas é configurável por `UI_AUDIT_PATHS`; fixtures faltantes não representam falha do backend real.

## Resultados desta rodada

- Build de produção e typecheck aprovados; stylelint, checagem e scanner de i18n aprovados (sem texto embutido detectado).
- Suíte completa: 1.316 testes aprovados, 1 ignorado. Testes focados posteriores cobrem descoberta social e reserva da grade de marcas.
- Navegador: 9 telas em mobile/tablet/desktop, com API de teste; cobertura adicional de Feed, Closet, Perfil, Points e Design nos temas escuro/alto contraste. Nenhuma violação WCAG automatizada, erro JS, overflow ou texto visível menor que 12 px no escopo retestado. 57 visitas no total; máximo CLS observado de 0.0262. Detecção de CLS identificou e motivou reservas de layout nos tutoriais e marcas.
- Lighthouse móvel local, login: desempenho 69 → 83 após adiar detalhes e demos; acessibilidade 100, boas práticas 100 e SEO 100. Uma execução por medição, sem representar a distribuição de produção. A meta de desempenho 90 no CI permanece como aviso; acessibilidade e CLS têm bloqueio.
- Capturas da sessão ficam fora do repositório, em `/workspace/fashion-ux-screenshots/index.html`; o CI gera e anexa as próprias capturas. Não foram incluídos dados ou imagens privadas do acervo.

## Notas heurísticas da revisão de implementação

Estas notas são uma avaliação técnica desta rodada, distinta dos índices Lighthouse e de uma auditoria completa em produção. Não há evidência suficiente para declarar todas as notas 10. O reteste de produção e aparelhos físicos permanece necessário.

| Critério | Antes (artefato) | Revisão local | Limite para certificação 10 |
|---|---:|---:|---|
| Identidade visual | 5 | 9 | Avaliação visual com conteúdo real, em todas as telas |
| Consistência | 4 | 8,5 | Revisão das exceções de arte dinâmica e estilos legados |
| Usabilidade | 4 | 9 | Testes de tarefa com novos usuários e IA real |
| Acessibilidade | 4 | 9 | Leitor de tela e Safari em aparelhos físicos |
| Responsividade | 5 | 9 | Conteúdo extremo e todas as rotas em dispositivos reais |
| Qualidade do frontend | 5 | 8,5 | Desempenho móvel de produção e RUM p75 |
