# Correções integradas: esquema, catálogo, Hype e provador

## Fluxos corrigidos

| Problema | Alteração | Verificação |
| --- | --- | --- |
| Melhorar com IA não permite selecionar/aplicar | Checkboxes por sugestão, alternativa única por campo; envia somente `{campo: valorProposto}`. Erro preserva seleção; instrução descreve os metadados realmente suportados. | Quatro testes e página real do esquema em desktop/mobile com API simulada. |
| Tente novamente devolve o mesmo arquivo quebrado | `preview-image?force=true` refaz a verificação do produto e pode escolher outra imagem dele, preservando o último resultado válido se falhar. | Testes Java de recuperação e conservação do crop; teste de navegador com 404 seguido de recuperação. |
| Fotos antigas congestionam novas páginas | Fila limitada a duas operações, pula cards desmontados, deduplica consumidores e prioriza tentativa explícita. Download HTTP tem limite de bytes e prazo de oito segundos incluindo corpo/redirecionamentos. | Testes de fila, deduplicação, timeout/cancelamento e limite de bytes. |
| Reprocessar ao abrir ou alternar enquadramento | Uma análise fornece Tecido e Total frame; metadados/URLs persistidos e versionados no banco. Total frame pronto não recebe uma segunda margem/crop no navegador. | Testes Java retiram a fonte da rede e verificam reuso dos mesmos arquivos; navegador alterna/recarrega com zero solicitações adicionais de preview. |
| Acabamentos Hype sem ícone/cadeado legível | Medalhas bronze/prata/ouro e estrelas no Especial em SVG no estilo FAI, nomes visíveis, cadeado independente de PNG, check de seleção. Prévia sticky mobile menor para não cobrir os controles. | Matriz desktop/mobile com 3/2/0 cadeados em Estreia/Studio/Loft; testes do picker e das permissões de persistência Java. |
| Cores vazam entre metades superiores | Separação usa o centro de neckline/hem detectados; peças superiores mantêm inset de 25%. Só pernas usam 10%, explicitamente. | Raster assimétrico, manga estendida e punhos contrastantes nos testes. |
| Rachadura diagonal no ombro | Todos os vértices do triângulo mantêm UV da foto no mesmo painel; `fabricUv` permanece separado. Vértices de manga com peso fotográfico zero já não cruzam o divisor do atlas. | Camisa, casaco, jaqueta e moletom nos dois corpos e em duas poses; capturas inspecionadas. |
| Gola aparenta camada grossa | Gola de malha usa folga cervical de até 4 mm, mantém folga de camadas reais e reduz a seção para 3 mm. Pesos suavizados evitam pontas ao mover o pescoço. Molde v6. | Testes de espessura, independente da folga do peito, pesos e continuidade da gola. |
| Foto da camisa parece um recorte dentro do molde | A largura do torso usa a faixa opaca central, excluindo mangas desconectadas da linha de referência. | Foto sintética com mangas compridas e contorno central conhecido. |
| Calçado/outra vista vira estampa de bermuda | O 3D não escolhe qualquer foto processada nem o crop Tecido como foto da roupa inteira. `texture-image` entrega a original canônica aprovada do produto por transporte autenticado, evitando CORS; sem coordenadas da parte de um modelo humano, a foto é recusada como textura. | Contrato do adaptador, recusa de imagem sem evidência da parte e teste Java de transporte somente da original aprovada, sem renderizar/persistir novamente. |

## Persistência das duas versões

Reutiliza as colunas existentes de `CatalogImage` (`assets_json`, `whole_url`, `whole_json`, `whole_status`, `whole_pipeline_version`), sem migration nova. O bloco `assets_json.previewFrames` registra versão `CATALOG_PREVIEW_FRAMES_V1`, URL e hash da fonte, hash do contexto, data, status, `fabricUrl` e metadados/URL de `whole` quando disponível. A API expõe `catalogImage.previewCache`, `catalogImage.url` e `catalogImage.whole.url` com `rendered: true` para arquivos já enquadrados.

Em aberturas posteriores, o backend e o cliente reutilizam esse marcador. Registros antigos fazem uma migração sob demanda; a foto antiga utilizável continua visível durante essa etapa. Troca de fonte/categoria/subcategoria/versão invalida o resultado; mudanças de conteúdo na mesma URL podem ser recuperadas com Tente novamente. O GET de listagem não baixa nem analisa fotos.

As fontes configuradas como `REFERENCE_ONLY` conservam URL original e metadados de enquadramento em cache, sem copiar seus bytes para o storage. Nas fontes que permitem persistência, as duas versões são gravadas em chaves estáveis. Se a fonte não comprova uma peça inteira isolada, `wholeStatus: UNAVAILABLE` fica registrado: não se gera uma versão com pessoa/calçado nem se tenta infinitamente ao abrir a página. O transporte autenticado da foto original para o 3D não aceita URL enviada pelo cliente e não altera essa política.

`GET /api/catalog/products/{id}/texture-image` fornece ao 3D o Total frame completo já persistido, quando disponível, inclusive com a origem fora do ar. Caso contrário, busca somente a original canônica aprovada, com verificação de URL pública, tipo e limite de bytes. Não usa o crop Tecido como se fosse a peça inteira. A durabilidade dos arquivos depende do `MediaStoragePort` configurado no backend; este lote não altera a infraestrutura de armazenamento.

## Evidências e limites

- 143 testes frontend aprovados em 13 arquivos; build de produção Next.js/TypeScript e verificações de estilos/traduções aprovados.
- 52 testes Java aprovados: render das duas versões, persistência/reuso/invalidação, retry, transporte da original, deadlines e permissões Hype. Compilação dos módulos web/platform/application aprovada.
- JSONs e capturas neste diretório registram escopo e resultados. IA e Hype foram conferidos em viewport de 1440 e 390 pixels. Catálogo foi conferido na página real do provador, com API/auth/mídia simuladas. Persistência foi validada com repositórios de teste, sem alterar o banco de produção.
- As capturas 3D usam fotos sintéticas nas referências locais. Mostram a correção da junção dos painéis e a redução da gola; não certificam os produtos AllSaints/Aramis das capturas do usuário.

O provador continua sendo um molde paramétrico com projeção da frente e tecido estimado nas regiões sem imagem. Não há neste lote reconstrução dos bolsos, costuras, matelassê, corte industrial, gola social completa ou UVs de todas as mangas/costas. A correção impede fontes e regiões indevidas, mas não transforma uma única fotografia em um asset completo de cada marca. Onde a foto não é verificável, continua o fallback de cor indicado pela interface. Não houve inferência GPU, certificação de todos os SKUs nem teste em aparelho móvel físico.

O serviço atual de melhoria do esquema altera título, descrição, ocasião, estilo, estação, humor e visibilidade; não substitui as peças vestidas. O diálogo agora reflete esse contrato.

## Complementos: seletor Hype e busca de Pessoas

Em `/pieces/new`, o seletor AURA Hype não oferece mais o botão Desligar. Bronze, Prata, Ouro e Especial ficam abaixo de seus ícones, com os cadeados e os requisitos de nível preservados. As seis combinações de viewport desktop/mobile e nível Estreia/Studio/Loft foram conferidas novamente; os relatórios incluem a posição do rótulo abaixo do ícone.

A busca de Pessoas agora usa uma projeção JPA dos campos públicos. A consulta anterior carregava o `User` completo e tentava descriptografar também e-mail, telefone e nascimento, embora esses dados não façam parte da resposta. O teste de integração Hibernate/H2 grava uma linha com e-mail cifrado ilegível: carregar a entidade inteira falha com `Unable to decrypt sensitive attribute`, enquanto a busca pública devolve o nome/bio corretamente e seu SQL não seleciona os campos privados. Não houve alteração da chave, do banco ou dos dados de produção.

Pessoas sem resultados mantém a resposta vazia e as alternativas, sem consultar looks e seus donos como conteúdo substituto. Paginação, contas de teste, bloqueios, contadores e restrições de conteúdo permanecem; uma visibilidade ausente assume PRIVATE.

Validação adicional: sete testes Java de Pessoas, incluindo a consulta JPA real, e 15 testes frontend de Hype, busca e matriz 3D aprovados (um teste de geração de artefatos desativado por padrão). Duas referências antigas da matriz 3D foram atualizadas para os símbolos atuais após falharem no check remoto; o teste de rastreabilidade permanece ativo. O servidor de produção exige Google/PIN, portanto a exceção exata relatada pelo usuário não foi consultada nos logs de produção.

O fluxo de Pessoas conferido foi: `/search` → clique em Pessoas → `GET /api/search?tab=PESSOAS` → resposta pública → card com link `/u/bia`; alternar para Marcas e voltar mantém a navegação funcional. Desktop (1440 px) e mobile (390 px) passaram sem exceções JavaScript nem overflow, com autenticação/API simuladas. Isso valida a integração de formato do cliente; a consulta ao banco foi validada separadamente pelo teste JPA, sem afirmar teste integrado contra Railway/produção. O script aguarda a restauração da sessão/hidratação antes do clique.
