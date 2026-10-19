# Roteiro de apresentação — 10 minutos (Fashion AI)

Objetivo: mostrar, em 10 minutos, o que está pronto da rubrica (`docs/rubricas/QUARTA_TCC_Rubricas.csv`), começando pelo
que vale mais pontos e se prova com um clique. Cobre os 6 obrigatórios do sistema e cerca de 12 pontos de opcionais.

## Antes de começar (fazer na véspera)

- [ ] Gerar a cobertura do frontend: `npm run test:coverage` (cria `coverage/index.html`)
- [ ] Gerar a cobertura do backend: `mvn verify` (cria `*/target/site/jacoco/index.html`)
- [ ] Subir o sistema (API + frontend) e deixar logado em duas abas: **usuário comum** e **admin**
- [ ] Abrir as abas: dashboard de admin, preferências, `coverage/index.html`,
      `fai-application/target/site/jacoco/index.html`, GitHub Actions/PRs, `/swagger-ui.html`, tela de cadastro de peça
- [ ] Plano B da IA: print ou vídeo curto do cadastro de várias peças funcionando, caso a internet falhe

## Roteiro

| Tempo | O que mostrar | Itens da rubrica | Onde |
|---|---|---|---|
| 0:00–1:00 | Login como usuário comum e como admin; o comum recebe "acesso negado" no admin e o menu muda por perfil | Obrigatório: 2 perfis de acesso (front e back) | App, duas abas |
| 1:00–2:30 | Dashboard de admin: trocar um filtro (período/país) e mostrar os gráficos mudando. Dizer: "as consultas são agrupadas e usam procedures do MySQL" | Obrigatório: dashboard · SQL avançado (1,5) | `/admin/dashboard` |
| 2:30–3:30 | Trocar tema (claro, escuro, alto contraste) e idioma (pt/en/es) na mesma tela; preços e datas mudam junto | Responsivo e customizável (1,5) · Internacionalização (1,5) | Preferências |
| 3:30–4:00 | A mesma tela no modo celular | Responsivo (complemento) | DevTools (F12) → modo dispositivo |
| 4:00–5:00 | Cobertura do frontend: **75,28% das linhas** | Cobertura do frontend (1,0) | `coverage/index.html` |
| 5:00–6:00 | Cobertura do backend: **76,5% das linhas** no total (o `fai-application` sozinho tem 79,9%; o total soma os relatórios dos módulos) | Cobertura do backend (1,0) | `fai-application/target/site/jacoco/index.html` |
| 6:00–7:00 | GitHub Actions: PRs com os 3 checks verdes (backend, frontend, segredos) e o PR #154 que falhou e foi corrigido | CI/CD (0,9) · Processo de qualidade (0,6) | GitHub → Actions / Pull requests |
| 7:00–8:00 | Swagger com os endpoints descritos; executar um e mostrar o JSON de resposta | Documentação da API (1,0) · Obrigatório: REST com JSON | `/swagger-ui.html` |
| 8:00–9:00 | Uma funcionalidade com IA (cadastro de várias peças numa foto) e de onde vem cada serviço: Claude (IA), Resend (e-mail), S3 (imagens), login Google | Serviços cloud (1,5) | Tela de cadastro de peça |
| 9:00–10:00 | Arquitetura: módulos `fai-domain`, `fai-application`, `fai-infrastructure`, `fai-web`, `fai-bootstrap` (hexagonal) e a lista das 53 migrações Flyway | Padrões de projeto (1,0) · Migrações (0,6) | IDE / `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/` |

## Frases curtas para cada parte

- **Perfis:** "Cada perfil vê um menu diferente, e o backend recusa a ação mesmo se alguém chamar a API direto."
- **Dashboard:** "Os números vêm de consultas agrupadas e procedures do MySQL, com filtros salvos por usuário."
- **Cobertura:** "A cobertura é medida automaticamente: Vitest no frontend e JaCoCo no backend, rodando em todo PR."
- **CI:** "Nenhum PR entra na main sem build, testes e varredura de segredos passando."
- **Arquitetura:** "O domínio não depende de nada; banco, IA e e-mail entram por portas e adaptadores."

## Não mostrar (vale pouco ou nada hoje)

Microsserviços, Service Discovery/API Gateway, Figma, NoSQL avançado e acessibilidade.

## Se sobrar tempo

Mostrar o 3D (quarto ou passarela), que sustenta a **técnica livre (1,5)**, se ela tiver sido acordada com os professores.

## Pontos de atenção

- Os 75–76% de cobertura são de **linhas**; ramos e funções ficam abaixo de 75%. Se perguntarem, deixe claro qual métrica é.
- Obrigatórios fora do sistema que precisam estar prontos: **processo ágil documentado por sprint (TDE)** e
  **participação de todos no Git**. Sem eles o trabalho não pode ser entregue.
