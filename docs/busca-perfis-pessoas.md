# Perfis completos em Buscar → Pessoas

A aba Pessoas usa a mesma composição visual do feed Marcas: capa, foto de perfil, nome e @, verificação, visibilidade, peças, looks, seguidores, seguindo, bio, pronomes, país, links públicos e Hype agregado do criador. O botão **Ver perfil** abre `/u/{username}`. Uma conta com publicações restritas mostra a restrição no próprio cartão.

## Contrato da API

`GET /api/search?tab=PESSOAS&q=ana&size=24` continua aceitando acesso anônimo. Uma sessão permite informar o vínculo existente e se as publicações estão acessíveis ao visitante. `nextCursor` segue o contrato atual de paginação da busca.

Cada resultado mantém os campos de `Views.UserCard` e acrescenta `coverUrl`, `bio`, `pronouns`, `links`, `visibility`, `contentVisible`, `relation` e `counters` (`pieces`, `schemes`, `followers`, `following`). Não são devolvidas entidades JPA nem e-mail, telefone, data de nascimento, senhas, documentos ou publicações privadas. Os totais são os mesmos agregados já exibidos no cabeçalho do perfil; não expõem títulos, fotos ou IDs do conteúdo restrito.

A busca permanece restrita a contas pessoais ativas. Bloqueios nos dois sentidos, origem de teste/demo e tipo/status da conta são filtrados antes do limite da consulta. A ordenação por username e ID mantém uma sequência estável na paginação. O termo pesquisa username: o nome é cifrado no banco e não é pesquisado com `LIKE`.

As quatro contagens usam consultas agrupadas para os IDs da página. A relação do visitante usa uma consulta em lote. Não se abre o endpoint de cada perfil para montar os cartões. O Hype usa o mecanismo existente de lotes de `/api/hype/groups`, com sua regra de dados públicos elegíveis.

## Arquivos

| Responsabilidade | Arquivo |
| --- | --- |
| Aba Pessoas da busca | `app/(site)/(app)/search/page.tsx` |
| Cartão público completo | `components/public-profile-card.tsx` |
| Tipo frontend e links seguros | `lib/api/public-profiles.ts` |
| DTO e montagem em lote | `fai-application/.../service/SearchService.java` |
| Filtro de contas e ordenação | `fai-domain/.../repository/UserRepository.java` |
| Contagens e vínculo | `FollowRepository.java`, `SchemeRepository.java`, `WardrobeItemRepository.java` |

Os links externos aceitam apenas HTTP(S), rejeitam credenciais embutidas e abrem com `noopener noreferrer`. Estatísticas ausentes aparecem como **—**, enquanto zeros reais permanecem **0**. Fotos indisponíveis usam o monograma do nome.

## Validação

- `SearchPeopleProfilesTest`: campos públicos, exclusão de segredos de conta, restrição de conteúdo, relação aceita/pendente, paginação, bloqueios nos dois sentidos, origem de teste e número constante de consultas por página.
- `public-profile-card.test.tsx`: integração com a aba Pessoas, dados completos, links acessíveis, restrição, estatísticas desconhecidas e URLs executáveis/credenciais.
- Regressão: `SearchHypeV2Test` e `institutional-profile-feed.test.tsx`.
- QA Chromium em 375 e 1280 pixels usa respostas de API simuladas e fotos SVG sintéticas, sem afirmar validação de dados de produção. Evidências para revisão: [relatório do navegador](evidencias/busca-perfis-pessoas/browser.json), [desktop 1280 px](evidencias/busca-perfis-pessoas/desktop-1280.png) e [mobile 375 px](evidencias/busca-perfis-pessoas/mobile-375.png).
