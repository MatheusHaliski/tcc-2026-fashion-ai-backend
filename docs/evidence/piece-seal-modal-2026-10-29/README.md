# Selos aprovados no modal da peça — E1/E2

## Falha e correção

O card da grade já carregava os vínculos aprovados via `GET /api/pieces/seals?ids=...`, mas `ExpandedPiece`, usado tanto na página de detalhe quanto em `DetailModalProvider`, não consultava nem renderizava esses selos. Por isso, um selo visível na grade desaparecia ao abrir a mesma peça no modal.

`components/expanded-card.tsx` agora reutiliza `usePieceSeals` e `CardSealSummary`, exibindo o mesmo medalhão oficial na identificação do card ampliado. Apenas os badges retornados pelo endpoint autorizado são usados. Tags `piece.seals`, sugestões e selos Hype não são convertidos em vínculos aprovados.

Não há mudança em critérios de concessão, aprovação, consentimentos, expiração ou permissões. O filtro e a autorização continuam no backend; o hook mantém o escopo de sessão/visitante existente. A falha de leitura não inventa um selo.

## Evidências PNG

- [E1 — peça azul com selo na grade do guarda-roupa](E1-peca-azul-selo-na-grade.png).
- [E2 — mesma peça e selo no modal de visualização](E2-peca-azul-selo-no-modal.png).
- [E2 — recorte completo do modal](E2-modal-completo.png).

A evidência é de **exibição de um vínculo aprovado de teste**, não de emissão real. O teste usa o frontend real da branch isolada, Chromium e API interceptada pelo Playwright. O banco configurado recusou a conexão (`OperationalError 2003`); não foi possível localizar nem confirmar a peça/selo que o solicitante informou existir em produção. Nenhum banco remoto foi alterado.

A fixture representa uma camisa azul (`color=blue`, `#3268a4`), com o asset padrão local e um selo PECA de marca de teste (`premium=false`). Os nomes incluem explicitamente “teste”. O medalhão FAI na fotografia é parte do asset ilustrativo; o **selo concedido** é o medalhão separado abaixo do título do card. O tipo de desenho do selo não altera sua origem: o badge vem do vínculo da marca, não do Hype.

E1 mostra a grade já recebendo esse vínculo aprovado simulado. E2 abre o modal a partir do link desse card e comprova o mesmo selo no detalhe. O script também recarrega a grade e reabre o modal, conferindo a permanência do badge na resposta simulada. Não houve clique de emissão de selo nem comprovação de persistência em MySQL.

## Reprodução e verificações

- [Script Playwright](browser-check.cjs), com respostas sintéticas, sem credenciais.
- [Resultado estruturado](browser-evidence.json): título do medalhão, endpoint consultado, reabertura após reload e lista de erros de execução da página.
- Servidor de teste: `DEV_GATE_ENABLED=false npm run dev -- --webpack --hostname 127.0.0.1 --port 3118`. Gate desativado somente nesse processo local; produção não foi alterada.
- `vitest run components/expanded-card.test.tsx components/card-seals-lists.test.tsx lib/pieces/use-piece-seals.test.tsx`: **37 testes passaram**. Incluem selo de marca e de celebridade no modal, fechamento/reabertura e exclusão de tags não aprovadas.
- `tsc --noEmit`: passou na branch isolada.
- Maven em Java 21 na mesma branch: `SealCreatorsCoverageTest` + `ClosetSealFilterTest`, **37 testes passaram** (35 + 2), incluindo critérios de peças azuis e aprovação/rejeição de vínculos.
- Chromium: imagem azul carregada, selo presente na grade e modal, reabertura após recarregar e nenhum `pageerror`.

A aprovação e correspondência de políticas para peças azuis são cobertas separadamente pelos testes Java existentes em `SealCreatorsCoverageTest` (inclusive azul compatível e vermelho incompatível). Esses testes usam repositórios de teste; não substituem uma execução autenticada na produção.
