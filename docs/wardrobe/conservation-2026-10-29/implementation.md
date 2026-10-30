# Estado de conservação da peça — 29/10/2026

Implementado no checkout `/workspace/fashionai-vton-gpu`, branch de publicação `feat/piece-conservation-field`. Alterações anteriores do provador e catálogo foram preservadas e não fazem parte desta entrega.

## Comportamento

- O formulário Editar dados do card ampliado passa a oferecer estado de conservação por UUID, carregado da API. O mesmo campo compartilhado aparece nos dados do criador de peças, dentro de Mais detalhes quando compacto.
- Opções padrão: NOVA, EXCELENTE, BOA, DESGASTADA, DANIFICADA. Opções já cadastradas são preservadas; somente as ativas aparecem no seletor.
- Nenhuma opção é selecionada automaticamente. Ausência de referência e enum legado GOOD aparecem como “Não informado”. Outros enums legados continuam legíveis sem criar uma FK por inferência.
- A referência salva tem precedência sobre o enum legado nos cards do guarda-roupa, painéis Info e card ampliado.
- O PUT retorna a referência; ExpandedPiece atualiza o detalhe e emite o evento `fai:piece-updated`, já consumido pela grade de `/closet`. O GET após recarregar retorna a mesma referência.
- UUID inexistente, nova escolha de opção inativa ou combinação ID + limpeza explícita retornam erro 400 com campo `estadoConservacaoId`. A verificação existente de proprietário acontece antes de qualquer alteração. Visitantes não podem editar; a política existente de administração foi mantida.
- Campo omitido/null preserva uma referência existente. Para remover deliberadamente a escolha, a UI envia `clearEstadoConservacao: true`; essa ação também limpa o enum antigo para que ele não reapareça como condição atual.

## Esquema real e migração

A V77 e o mapeamento JPA já utilizam `EstadoConservacao` e `wardrobe_items.estado_de_conservacao`, com FK nullable. Foram aproveitados esses nomes, em vez de criar `estados_conservacao` e `estado_conservacao_id` como uma segunda relação para o mesmo conceito. A entidade WardrobeItem e essa FK já existiam e não foram recriadas.

A nova V83 adiciona `ativo` e insere apenas os códigos padrão ainda ausentes. Não modifica escolhas ou nomes existentes e não faz backfill de `item_condition`. A V77 publicada não foi alterada. `item_condition` continua disponível para compatibilidade.

**A V83 não foi executada em produção.** A entrega exige aplicar a migração antes de disponibilizar o backend atualizado, pois o JPA passa a consultar `ativo`.

## API e DTO

- `GET /api/opcoes/estados-conservacao`: lista pública, somente leitura, de `{id,codigo,nome}` ativos. O caminho anterior `/api/estados-conservacao` continua válido.
- `PUT /api/pieces/{id}`: recebe `estadoConservacaoId` UUID opcional e `clearEstadoConservacao` boolean opcional.
- GET/PUT da peça: `estadoConservacao: {id,codigo,nome}` ou null. Este DTO já existia; agora a escrita também o alimenta.
- Os construtores antigos de PieceForm continuam disponíveis. A normalização de subcategorias legadas preserva os novos campos.

## Arquivos e entidades

| Arquivo | Mudança |
| --- | --- |
| `fai-domain/.../model/EstadoConservacao.java` | Campo ativo com default true para novos objetos. |
| `fai-domain/.../repository/EstadoConservacaoRepository.java` | Consulta somente de opções ativas. |
| `fai-application/.../service/PieceConservationService.java` | Novo validador/aplicador da referência, sem inferência pelo enum. |
| `fai-application/.../service/WardrobeService.java` | PieceForm, normalização e gravação autorizada na criação/edição. |
| `fai-web/.../controller/PieceReferenceController.java` | Novo caminho de opções e filtro ativo. |
| `fai-web/.../config/SecurityConfig.java` | Leitura pública apenas do caminho exato; mutações seguem protegidas. Arquivo tinha alterações prévias, preservadas. |
| `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V83__conservation_options.sql` | Ativação e cinco códigos iniciais sem backfill. |
| `components/piece-conservation-field.tsx` | Novo seletor compartilhado com carga, falha e nova tentativa. |
| `components/piece-form.tsx` | Campo, payload, erro por campo e bloqueio durante envio. |
| `components/expanded-card.tsx` | Preenchimento da referência atual e conservação dos campos legados na edição. A exibição usa o componente PieceDetailFacts já presente nesse arquivo. |
| `lib/api/piece-references.ts` | Rótulo comum, priorizando FK e evitando declarar GOOD como escolha do usuário. |
| `lib/i18n/messages/{pt-BR,en,es}.json` | Textos de interface novos, preservando alterações anteriores. |
| `fai-application/src/main/resources/i18n/messages{,_en,_es}.properties` | Mensagem de validação do backend. |

Os caminhos abreviados `...` correspondem ao pacote `src/main/java/br/com/fashionai` do módulo indicado. Views, PieceView, WardrobeItem, PieceCardPanels, PieceDetailFacts e o listener do closet já suportavam a referência e foram reutilizados.

## DOM e estados da interface

- Contêiner novo: `div[data-conservation-state="loading|ready|error"]`, com `aria-busy`; ocupa as duas colunas da grade (`sm:col-span-2`).
- Campo: `Field` gera label “Estado de conservação” e div de agrupamento. `Select` usa o Dropdown padrão FAI, com trigger `#estadoConservacaoId`, lista `role=listbox` e itens `role=option`. Valores são UUIDs.
- Carregando: seletor bloqueado, spinner do componente e mensagem `role=status`.
- Lista vazia: seletor bloqueado e mensagem `role=status`, sem inventar opções.
- Falha: seleção atual preservada; bloco `role=alert` com botão `type=button` para nova tentativa.
- Erro de validação: mensagem associada ao campo e estado inválido no Dropdown. A seção compacta abre quando esse campo tem erro.
- Salvando: `form[aria-busy=true]`, `fieldset[disabled]` e botão Salvar com loading; a trava síncrona existente evita envio repetido.
- Leitura no card ampliado: `.c-facts > div > dt` contém “Estado de conservação”; `dd` contém o nome retornado pelo banco ou o rótulo de ausência. O mesmo helper alimenta a janela Info do card.
- Não houve alteração global de CSS ou de dimensões dos cards.

## Verificações

- Java: 26 testes passaram, incluindo cinco escolhas, UUID ausente, opção inativa, preservação de legado, limpeza explícita, autorização de outra pessoa, PUT do proprietário, serialização, schema e segurança dos endpoints.
- Na branch de publicação, o conjunto de 26 testes Java foi executado novamente, incluindo o módulo web, e passou.
- Frontend: 48 testes passaram, incluindo carregamento/erro/nova tentativa/lista vazia, envio por UUID, renderização de referências no card e fluxo de edição + GET ao recarregar.
- TypeScript sem erros; verificações de localização sem erros; scanner sem textos embutidos novos. O verificador de localização reporta dez avisos de localização no conjunto atual de mensagens.
- Não houve teste contra MySQL de produção nem execução da migração. Os testes Java de serviço usam repositórios de teste; os testes de interface simulam a API.

E1/E2, quando capturadas, representam o frontend real local com API simulada e não comprovam implantação ou persistência no banco remoto.


## Publicação para revisão

Branch isolada `feat/piece-conservation-field`, criada da main após a integração da PR #410. A V83 foi escolhida porque V81 e V82 já pertencem a outras migrações. O diff não inclui mudanças do catálogo, provador ou a correção dos selos já integrada.

As capturas E1/E2 foram obtidas anteriormente com a implementação local e API simulada; a transposição para esta branch foi validada novamente com testes Java, interface, TypeScript e localização. Não houve implantação ou migração do banco remoto.

- [E1 — Editar peça](E1-editar-peca.png)
- [E2 — Card recarregado](E2-card-recarregado.png)
- [Resultado do navegador](browser-evidence.json)


## Correção: referência salva que ficou inativa

Editar nome ou outro dado da peça preserva o estado de conservação atual mesmo se a opção tiver sido desativada depois da escolha. A validação compara o UUID recebido com a referência já vinculada à peça no servidor, após a autorização de propriedade. Não aceita um ID anterior declarado pelo cliente.

Uma referência diferente precisa continuar ativa. Limpar a escolha mantém o comportamento explícito anterior; voltar a selecionar a opção inativa após limpar ou trocar é rejeitado. O endpoint de opções continua listando somente as ativas.

Regressão reproduzida antes do ajuste: erro 400 no update do proprietário que mantém a FK inativa. Testes também cobrem rejeição de outra opção inativa, troca para ativa e rejeição de reescolha inativa após trocar/limpar.
