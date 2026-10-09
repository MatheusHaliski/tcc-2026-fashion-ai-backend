# Selos de Hype e conversa do Copilot

O criador de selos possui duas modalidades: política em conversa com o Copilot e metas de Hype definidas pelo emissor. Marcas e celebridades aprovadas podem criar campanhas de Hype para uma peça ou um look. A disponibilidade depende dos critérios, do estado do item, do período e da cota da campanha. O servidor usa as métricas atuais para conferir a compatibilidade e registra a avaliação pelo motor de IA local governado.

Os medalhões automáticos FashionAI continuam separados das campanhas dos emissores. Na análise lateral, **Resumo**, **Selos e metas** e **Evolução** organizam a leitura. As metas estruturadas retornadas pelo backend mostram nota atual, meta, pontos faltantes e critérios de movimento ou dimensão. Não se interpreta a frase traduzida da política para descobrir limiares.

A explicação inicial abre no primeiro acesso à análise de Hype da conta nesta sessão do navegador. **Não mostrar novamente** guarda a preferência por conta e versão. **Entenda o Hype** permite reabrir o diálogo; a ajuda e o painel não prendem o foco simultaneamente.

## Contratos

| Ação | Endpoint | Comportamento |
| --- | --- | --- |
| Criar/editar selo do emissor | rotas existentes de selos | `policy.mode: "HYPE"`, nível `LOOK` ou `PECA`, metas em `policy.hype` |
| Consultar ofertas para um item | `GET /api/hype/{PIECE\|SCHEME}/{id}/seal-offers?page=0&size=12` | Política, elegibilidade, motivo, permissão para solicitar e vínculo existente |
| Solicitar uma campanha específica | `POST /api/hype/{PIECE\|SCHEME}/{id}/seal-offers/{sealId}/request` | Revalida tudo; o corpo contém `imageRightsConsent: true` quando exigido |
| Rascunho de política em conversa | `POST /api/seals/draft` | Pedido, nível, política anterior e até 20 turnos de conversa; não publica o selo |
| Alias do Copilot | `POST /api/copilot/seal-policy` | Mesmo contrato; usado pela interface somente se a rota estável retornar 404 |

Exemplo de critérios do emissor:

```json
{
  "mode": "HYPE",
  "match": "ALL",
  "rules": [],
  "occasions": [],
  "styles": [],
  "hype": {
    "minScore": 90,
    "momentum": ["RISING"],
    "dimensionMins": { "ENGAGEMENT": 60 }
  }
}
```

Todos os critérios preenchidos precisam ser atendidos. Métricas insuficientes ou antigas não liberam a solicitação. O retorno da API determina se o vínculo foi aprovado ou aguarda revisão; a interface não converte um pedido em selo aprovado. Os vínculos de peça aparecem na fila do emissor com o nome e endereço da peça.

A migração `V58__selos_hype_de_peca.sql` permite vínculos de peça e conserva os vínculos de look, com exatamente um alvo por registro. Ela precisa ser aplicada pelo Flyway junto do backend atualizado.

## Conversa

O chat cumprimenta o emissor pelo nome, oferece exemplos clicáveis e continua a conversa com perguntas. O usuário precisa clicar em **Aplicar política ao criador** para substituir a política pelos dados do rascunho. O histórico fica disponível ao voltar para ajustar a política. Uma falha de inferência não dispara uma segunda chamada pelo alias.

O erro de produção informado pelo usuário tinha um identificador de correlação, mas seus logs não estavam disponíveis nesta validação. As correções testadas garantem a rota estável, o alias compatível e o transporte do histórico, nível e política anterior no backend atual; não determinam a causa daquele erro histórico.

## Evidência de interface

Os testes de Chromium usam respostas de API explicitamente simuladas e contas fictícias, nas larguras 375 e 1280. Verificam dois turnos do Copilot, aplicação explícita, ajuda automática e persistência da preferência, progresso 72/100 → 90/100 (18 pontos restantes), consentimento e retorno `PENDING_REVIEW`, ausência de erros JavaScript e ausência de rolagem horizontal no painel.

- [Relatório das duas larguras](evidencias/hype-selos-2026-10-09/browser.json)
- [Ajuda no celular](evidencias/hype-selos-2026-10-09/ajuda-mobile.png)
- [Metas no celular](evidencias/hype-selos-2026-10-09/metas-mobile.png)
- [Conversa no desktop](evidencias/hype-selos-2026-10-09/chat-desktop.png)

Os testes de componentes cobrem a preferência por conta, estado indisponível, consentimento, métrica desatualizada, fila de revisão para peça, troca das modalidades e o fallback somente em 404. Os testes de backend cobrem autorização, contrato de conversa, regras de Hype, vínculos e rotas; os resultados constam na descrição do PR.
