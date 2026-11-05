# FashionAI — pesquisa técnico-funcional e novas oportunidades

Data:2/11/2026 (São Paulo). Repositório:MatheusHaliski/tcc-2026-fashion-ai-backend. Revisão `6bd645813426978634b7678ac7765ee89f8caea3`; main remoto conferido com a mesma revisão. Cinco agentes: quatro auditorias temáticas e uma pesquisa de referências, com consolidação e validação pelo agente principal.

## Leitura do resultado

São **39 macrofuncionalidades**, não39 endpoints ou todas as microações da UI. Cards de peça e look são uma família de apresentação; criar uma peça e criar um look são funções separadas. Busca unificada difere do feed. Interfaces laboratoriais, cada jogo isolado, cada tela administrativa e rotas de infraestrutura não receberam notas próprias. As93 entradas page.tsx estão inventariadas em paginas.csv para tornar esse limite visível.

As notas são **pareceres preliminares da implementação visível**, não satisfação de clientes nem qualidade comprovada em produção. Não foram executados browser, testes funcionais, inferências, acesso a banco/contas reais ou medições de desempenho nesta pesquisa. Não se assumiu que relatos antigos ainda são bugs. Um teste existente no repositório é evidência de intenção/cobertura descrita, não de execução aprovada agora. Confiança média significa leitura fundamentada de código com verificação dinâmica pendente; não é intervalo estatístico.

## Método e pesos

| Critério | Peso | O que fundamenta a nota |
|---|---:|---|
|Utilidade para moda/varejo|25%|Problema concreto de vestir, criar, comprar, conservar, compartilhar ou vender; utilidade é hipótese de domínio, não retorno financeiro medido.|
|Completude do fluxo|20%|Entrada→validação→persistência→leitura/edição/saída; estados vazio, erro, indisponível e legado; fronteiras ainda desconectadas.|
|Usabilidade e acessibilidade|15%|Hierarquia, nomes/estados, esforço de interação, teclado/foco e responsividade prevista. Código ARIA não comprova WCAG nem boa UX.|
|Confiabilidade e integridade|15%|Idempotência, concorrência, versões, rollback, provenance, recuperação de falhas e ausência de resultados enganosos. Não é disponibilidade/latência medida.|
|Segurança e privacidade|15%|Owner/roles, validação, consentimento, minimização, acesso e revogação observados; não substitui pentest.|
|Integração e continuidade|10%|Conexão entre catálogo, guarda-roupa, avatar, Atelier, social e varejo; dados reutilizados sem perder significado.|

**Nota=0,25U+0,20C+0,15UX+0,15R+0,15S+0,10I**, arredondada a1casa com decimal HALF_UP. Não é fórmula da ISO. Os pesos privilegiam utilidade e execução do fluxo (45%); dimensões de qualidade evitam premiar apenas quantidade de recursos.

Âncoras:0=ausente/inviável confirmado no recorte;1–2=protótipo isolado;3–4=fragmentos ou lacunas centrais;5–6=utilizável com restrições importantes;7–8=estrutura consistente com limitações identificadas;9=fluxo especialmente completo no critério;10=referência sustentada por evidência excepcional. Ausência de inspeção nunca vira zero. Valores fracionários são juízo técnico, não precisão experimental. Nenhuma média geral do app foi produzida, porque as funções não têm igual importância para cada persona.

Referências: ISO/IEC25010:2023 como vocabulário de qualidade; WCAG2.2 e Nielsen para critérios verificáveis de interação; GS1/Google para identidade/variantes; Comissão Europeia para contextualizar rastreabilidade. São inspiração metodológica e contexto, sem certificação ISO/WCAG/ESPR ou obrigação legal universal presumida. Ver fontes.md.

## Quadro de notas

|ID|Funcionalidade|U|C|UX|R|S|I|Nota|
|---|---|---:|---:|---:|---:|---:|---:|---:|
|CC-01|Cadastrar e editar peça do guarda-roupa|9|8|7,5|8|8,5|8,5|**8,3**|
|CC-02|Exibir cards de peça e look com informações, selos e Hype|8,5|8|7|7,5|7,5|8,5|**7,9**|
|CC-03|Organizar e filtrar guarda-roupa pessoal|9|8|8|7,5|8,5|8,5|**8,3**|
|CC-04|Criar, editar, publicar e reutilizar looks|9|7,5|7,5|8|8,5|8,5|**8,2**|
|CC-05|Pesquisar catálogo oficial e adicionar produto ao guarda-roupa|9|8|7,5|7,5|8,5|8|**8,2**|
|CC-06|Busca unificada de peças, looks e perfis|8,5|8|7,5|7|8|8|**7,9**|
|CC-07|Captura orientada e padronização da fotografia da peça|9|7|7|6,5|7,5|8|**7,6**|
|CC-08|Gerar, revisar, aprovar e descartar foto de estúdio|8,5|8,5|7,5|8,5|8,5|8|**8,3**|
|CC-09|Analisar cápsula e versatilidade do guarda-roupa|8|7|7,5|7|7,5|8|**7,5**|
|3D-01|Criar, ajustar e versionar avatar por fotografia|8|8|7|7|8,5|8|**7,8**|
|3D-02|Estimar proporções do corpo por SAM 3D Body|8|7|7|8|9|7|**7,7**|
|3D-03|Provar combinações de lojas e guarda-roupa no avatar|9|8|8|7|7|8|**8,0**|
|3D-04|Escolher tamanho e visualizar folga no molde|8|6|8|5|7|5|**6,7**|
|3D-05|Recomendar tamanho por tabela de produto e feedback|9|7|5|8|8|5|**7,3**|
|3D-06|Gerar modelo GLB de vitrine a partir da fotografia|8|6|6|7|7|6|**6,8**|
|3D-07|Provar roupa na fotografia com IA|8|7|7|7|8|7|**7,4**|
|3D-08|Organizar quarto e experimentar no espelho 3D|6|7|6|7|7|8|**6,7**|
|3D-09|Aprovar assets vestíveis e sincronizar sessão entre plataformas|8|7|6|8|8|6|**7,3**|
|AT-01|Projetos colaborativos de design|9|8|7|8|8,5|7|**8,1**|
|AT-02|Editor interativo de arquivos GLB|8,5|6,5|6,5|7,5|8|7|**7,4**|
|AT-03|Convidados externos no editor|8|7,5|7|8|8,5|7|**7,7**|
|AT-04|Ficha técnica versionada e exportável|8,5|7|7,5|8|8|7,5|**7,8**|
|AT-05|Votação de interesse em criações|7|7|7,5|7,5|8|6|**7,2**|
|AT-06|Copilot de combinações e orientação|8,5|7,5|7,5|7|8|8|**7,8**|
|AT-07|Autopiloto de looks diários e semanais|9|8|7,5|7,5|8|8,5|**8,2**|
|AT-08|DNA de estilo e identidade de moda|7,5|7,5|7|7,5|8|8|**7,6**|
|AT-09|Passaporte digital e compartilhamento privado|9|8|7,5|8,5|9|7,5|**8,4**|
|AT-10|Transferência e apoio à segunda vida da peça|8,5|7|7|8,5|9|7,5|**8,0**|
|SOC01|Feed e interações sociais de moda|8,5|8|7,5|7|8|8,5|**8,0**|
|SOC02|Perfis, conexões e privacidade social|8|8|8|7,5|8|8,5|**8,0**|
|SOC03|HypeScore, tendências e explicabilidade|7,5|8|7,5|7,5|8|8,5|**7,8**|
|SOC04|Auras e personalização licenciada dos cards|7|8|7,5|7,5|8|8,5|**7,7**|
|SOC05|Selos de marcas/celebridades e vínculo com looks|8|8|7|7,5|8,5|8,5|**7,9**|
|SOC06|Desafios de looks e tendências comunitárias|8|8|7|7,5|8|8,5|**7,8**|
|SOC07|FAI Points, progressão e recompensas|7,5|8,5|7,5|8|8|8,5|**8,0**|
|SOC08|FLAIR e jogos de moda|6,5|8|6,5|7|7,5|8,5|**7,2**|
|SOC09|Cupons e benefícios de marcas|8|8|7,5|7,5|8|8|**7,9**|
|SOC10|Loja de produtos físicos com FAI Points|8,5|6,5|7,5|8|8|8,5|**7,8**|
|SOC11|Conta, consentimentos e controle de dados|8,5|8|7|8|8,5|8|**8,1**|

## Síntese crítica

- Recomendação de tamanho, Atelier colaborativo, passaporte e cápsula **já têm implementação**. As oportunidades são ampliar e conectar esses fluxos, não anunciá-los como ausentes.
- Fit por tabela existe no backend; o diálogo auditado e a prévia de tamanho usam grade genérica. Não equivalem a graduação industrial ou caimento comprovado.
- GLB de vitrine, asset vestível aprovado e corpo SAM são contratos distintos. Há base de assets vestíveis e sessões multiplataforma; ainda é necessário integrar a experiência web e a graduação por tamanho.
- Na criação manual de look, TipoLook exibido no card não aparece no payload do builder/form auditados. Correção de continuidade de dado, não novo RF comercial.
- Transferência de peça não-CATALOG recebe imagem default fixa de camiseta no ramo auditado. É risco de representação de outras categorias identificado no código, não reprodução em produção.
- Loja física por pontos já tem pedido/estoque/envio; variantes escolhidas e pós-venda são oportunidades de novos fluxos sobre essa base.

## O que corrigir antes de ampliar escopo

1. Integrar tabela real/medidas/asset ao tamanho selecionado e distinguir estimativa de evidencia técnica.
2. Garantir continuidade de TipoLook na criação/edição e representação correta das imagens transferidas.
3. Expor procedência de foto, recorte, ilustração substituta e 3D estimado de maneira consistente.
4. Validar variantes, concorrência de estoque e pós-venda antes de ampliar o varejo físico.

Esses quatro pontos são hardening/integração do que existe, não quatro novidades de produto. Os novos fluxos candidatos estão em requisitos.md, com prioridade, dependências e aceite.

## Justificativa de cada funcionalidade

### CC-01 — Cadastrar e editar peça do guarda-roupa · 8,3/10

Registrar atributos, origem de imagem, conservação e publicação de uma peça.

Área:Peças, looks e catálogo. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 9/10 (25%)** — Registrar e atualizar peças próprias é a base para composição, revenda e reutilização no FashionAI.
- **Completude do fluxo: 8/10 (20%)** — O contrato abrange taxonomia, condição, cuidados, origem e privacidade, mas tamanho cadastrado continua sendo rótulo sem prova física de caimento.
- **Usabilidade e acessibilidade: 7,5/10 (15%)** — Há campos dirigidos por taxonomia e agrupamento de detalhes, porém a amplitude do formulário indica carga cognitiva ainda não medida com usuários.
- **Confiabilidade e integridade: 8/10 (15%)** — O update valida formulário, usa transação e publica projeção/evento; não executei regressão nem avaliei falhas reais de infraestrutura.
- **Segurança e privacidade: 8,5/10 (15%)** — O caso de uso exige permissão de criação e peça própria; a inspeção não substitui teste de autorização ou auditoria de segurança completa.
- **Integração e continuidade: 8,5/10 (10%)** — O mesmo registro alimenta projeção, evento de domínio, card e guarda-roupa, com boa reutilização dos dados.

Pontos fortes:

- Boa cobertura dos atributos relevantes para moda e revenda.
- Atualização integra projeção e evento de domínio; autorização explícita.

Lacunas/limites:

- O formulário agrega cadastro, sugestões de selos, marca e aparência: carga cognitiva deve ser medida com usuários.
- Não há evidência nesta leitura de validação de medidas físicas por tamanho no cadastro; tamanho é rótulo, não prova de caimento.

Evidências:

- [components/piece-form.tsx:14](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/piece-form.tsx#L14>) — Contrato inclui taxonomia, origem, condição, conservação e visibilidade; payload tipa/converte campos.
- [fai-application/src/main/java/br/com/fashionai/application/service/WardrobeService.java:654](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/WardrobeService.java#L654>) — Update transacional exige criação autorizada e propriedade, valida e projeta a peça.

### CC-02 — Exibir cards de peça e look com informações, selos e Hype · 7,9/10

Representar a peça/look em versão resumida ou ampliada, com dados de moda e sinais sociais.

Área:Peças, looks e catálogo. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 8,5/10 (25%)** — Os cards concentram fotografia e atributos de decisão de moda, reduzindo a necessidade de navegar para detalhes.
- **Completude do fluxo: 8/10 (20%)** — Existem versões resumidas/ampliadas, Info/Hype, selos, conservação e TipoLook salvo, mas nem todo contexto de fallback explicita a origem da imagem.
- **Usabilidade e acessibilidade: 7/10 (15%)** — Tabs têm foco e navegação por setas, mas densidade visual e combinações de layout não foram avaliadas em navegador ou leitor de tela nesta pesquisa.
- **Confiabilidade e integridade: 7,5/10 (15%)** — Componentes reutilizam modelos e estados de carregamento/Hype; não foi medida a estabilidade de todas as combinações de arte e imagem.
- **Segurança e privacidade: 7,5/10 (15%)** — O card distingue dados próprios e visibilidade, porém a proteção efetiva depende dos endpoints e não foi validada integralmente nesta leitura de UI.
- **Integração e continuidade: 8,5/10 (10%)** — Peça e look integram dados do domínio, selos, Hype, arte e modal de detalhe, oferecendo integração funcional visível no código.

Pontos fortes:

- Reuso entre contextos e hierarquia Info/Hype com controle por teclado.
- Informações de peça e sinais Hype aparecem no próprio card, sem exigir tela separada.

Lacunas/limites:

- A variedade de presets e densidade de sinais precisa de testes visuais em mobile, zoom e leitor de tela; esta análise não os executou.
- Fallback de fotografia pode virar ilustração genérica; a anatomia deveria distinguir isso de uma foto real e de imagem gerada em toda exibição.

Evidências:

- [components/piece-card-panels.tsx:54](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/piece-card-panels.tsx#L54>) — Tabs Info/Hype têm navegação por setas, foco e associações ARIA.
- [components/piece-card.tsx:94](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/piece-card.tsx#L94>) — Card exibe conservação; arte, foto, flags e selos são compostos no mesmo componente.
- [components/scheme-card.tsx:266](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/scheme-card.tsx#L266>) — TipoLook salvo é exibido no card de look.

### CC-03 — Organizar e filtrar guarda-roupa pessoal · 8,3/10

Consultar inventário com categorias, disponibilidade, Hype, selos, paginação e ordenação.

Área:Peças, looks e catálogo. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 9/10 (25%)** — Encontrar e reutilizar roupas já possuídas atende diretamente à finalidade central de um guarda-roupa digital.
- **Completude do fluxo: 8/10 (20%)** — Filtros, ordenação, Hype, selos e disponibilidade existem, mas a disponibilidade genérica ainda não representa etapas de lavanderia ou reserva.
- **Usabilidade e acessibilidade: 8/10 (15%)** — A API suporta filtros úteis e paginação, mas facilidade de uso e descoberta dos controles não foram verificadas com usuários.
- **Confiabilidade e integridade: 7,5/10 (15%)** — A consulta aplica políticas de acesso e filtros, porém materializa toda a lista do dono antes de paginar, deixando risco de escala não quantificado.
- **Segurança e privacidade: 8,5/10 (15%)** — Leitura de terceiros passa por visibilidade e moderação, enquanto a própria pessoa tem contexto diferenciado; não houve teste de penetração.
- **Integração e continuidade: 8,5/10 (10%)** — O inventário conecta peças, Hype, vínculos aprovados, visualização e disponibilidade em uma mesma consulta.

Pontos fortes:

- Filtragem útil para reutilizar o que o usuário já possui.
- Consulta a guarda-roupa alheio passa por política de visibilidade e moderação.

Lacunas/limites:

- A consulta materializa a lista do dono antes de filtrar/ordenar/paginar em memória: risco de escala para grandes inventários, sem medição de latência nesta pesquisa.
- Disponibilidade enumera apenas AVAILABLE/UNAVAILABLE/ARCHIVED; não modela por si um ciclo operacional de lavanderia/reserva/reparo.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/service/WardrobeService.java:544](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/WardrobeService.java#L544>) — ClosetFilter contém categoria/cor/estação/ocasião/estilo/estado/consulta/ordenação/página/Hype/selo.
- [fai-application/src/main/java/br/com/fashionai/application/service/WardrobeService.java:557](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/WardrobeService.java#L557>) — Leitura distingue dono, visibilidade e moderação; depois filtra, ordena e pagina.

### CC-04 — Criar, editar, publicar e reutilizar looks · 8,2/10

Combinar peças próprias em um look com atributos, arte, privacidade e referências de remix.

Área:Peças, looks e catálogo. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 9/10 (25%)** — Combinar roupas em looks é um dos casos de uso centrais que dá valor ao cadastro prévio de peças.
- **Completude do fluxo: 7,5/10 (20%)** — O fluxo cobre composição, arte, privacidade, edição e remix, mas TipoLook não aparece no payload do builder manual observado.
- **Usabilidade e acessibilidade: 7,5/10 (15%)** — O wizard permite voltar e condiciona avanço a pré-requisitos, mas o esforço para concluir várias etapas não foi medido empiricamente.
- **Confiabilidade e integridade: 8/10 (15%)** — Criação/edição verificam peças e composição e mantêm atualização transacional, sem execução dos testes nesta pesquisa.
- **Segurança e privacidade: 8,5/10 (15%)** — O serviço verifica permissão de criação, propriedade na edição e visibilidade do remix de origem, com cobertura estática clara.
- **Integração e continuidade: 8,5/10 (10%)** — Looks reaproveitam peças, arte, publicação e origem de remix, mas a integração do campo TipoLook entre todos os criadores ainda é parcial.

Pontos fortes:

- Fluxo conecta criação manual/assistida, preview e composição persistida.
- Protege propriedade e visibilidade da origem do remix.

Lacunas/limites:

- O payload do builder observado não inclui TipoLook e o record SchemeForm não o declara; há lacuna entre criação manual e o tipo que o espelho persiste/exibe.
- Pré-requisitos e número de etapas requerem teste de conclusão com usuários, não realizado nesta avaliação.

Evidências:

- [components/scheme-builder.tsx:95](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/scheme-builder.tsx#L95>) — Wizard condiciona avanço às peças/título; payload inclui itens, ocasião/estilo e background.
- [fai-application/src/main/java/br/com/fashionai/application/service/SchemeService.java:425](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/SchemeService.java#L425>) — Criação exige autorização e ao menos uma peça; remix verifica visibilidade de origem.
- [fai-application/src/main/java/br/com/fashionai/application/service/SchemeService.java:906](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/SchemeService.java#L906>) — Edição verifica propriedade, mantém itens quando ausentes no payload e revalida composição.

### CC-05 — Pesquisar catálogo oficial e adicionar produto ao guarda-roupa · 8,2/10

Encontrar produtos/variantes de marcas oficiais, manter referência de origem e registrar a escolha pessoal.

Área:Peças, looks e catálogo. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 9/10 (25%)** — O catálogo oficial liga descoberta de produtos e variantes à montagem de um guarda-roupa e à intenção de compra.
- **Completude do fluxo: 8/10 (20%)** — Busca, variantes, adição e referência oficial existem, mas não foi identificado neste fluxo um contrato de estoque/preço atual por oferta e tamanho.
- **Usabilidade e acessibilidade: 7,5/10 (15%)** — Filtros combináveis e cancelamento de buscas antigas favorecem interação responsiva, cuja latência real não foi medida.
- **Confiabilidade e integridade: 7,5/10 (15%)** — O cliente protege contra respostas de buscas obsoletas, mas disponibilidade das fontes e fidelidade de imagens externas não foram verificadas em execução.
- **Segurança e privacidade: 8,5/10 (15%)** — O ingest mantém regra explícita HTTPS e persistência somente quando autorizada pela fonte; isso não certifica segurança integral da cadeia.
- **Integração e continuidade: 8/10 (10%)** — Produto oficial e variante entram no registro pessoal mantendo referência de origem, embora a conexão com disponibilidade atual do varejista permaneça incompleta.

Pontos fortes:

- Catálogo e peças pessoais são integrados, com variante e referência oficial.
- Regras explícitas para persistência/licença das imagens reduzem cópia indiscriminada.

Lacunas/limites:

- O fluxo não comprova estoque/tamanho/preço atual do varejista no momento de intenção de compra; essas evidências exigem conectores e timestamps por oferta.
- Cancelamento/ordenação de respostas tem suporte no cliente, mas performance e disponibilidade das fontes não foram medidas nesta pesquisa.

Evidências:

- [components/catalog/catalog-search.tsx:134](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/catalog/catalog-search.tsx#L134>) — Parâmetros incluem categoria, subcategoria, marca, consulta, código, cor e gênero; efeitos cancelam buscas antigas.
- [fai-application/src/main/java/br/com/fashionai/application/catalog/CatalogService.java:692](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/catalog/CatalogService.java#L692>) — Caso de uso de adição ao guarda-roupa existe no serviço de catálogo.
- [fai-application/src/main/java/br/com/fashionai/application/catalog/CatalogIngestService.java:284](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/catalog/CatalogIngestService.java#L284>) — Só aceita imagem HTTPS e mantém REFERENCE_ONLY salvo permissão da fonte para persistir.

### CC-06 — Busca unificada de peças, looks e perfis · 7,9/10

Descobrir conteúdo de moda com filtros combináveis e respeito à visibilidade.

Área:Peças, looks e catálogo. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 8,5/10 (25%)** — Descobrir roupas, looks e perfis com atributos de moda amplia o aproveitamento do conteúdo do sistema.
- **Completude do fluxo: 8/10 (20%)** — A busca contempla cinco abas e filtros combináveis, sem demonstração de avaliação de relevância por intenção ou terminologia de moda.
- **Usabilidade e acessibilidade: 7,5/10 (15%)** — Filtros e abas oferecem organização funcional, mas sucesso de tarefas e encontrabilidade não foram observados em uso real.
- **Confiabilidade e integridade: 7/10 (15%)** — Há fallback de índice para banco, mas o caminho indexado limita200 IDs antes dos filtros finais, com risco de páginas incompletas não quantificado.
- **Segurança e privacidade: 8/10 (15%)** — Os resultados inspecionados passam por visibilidade e bloqueios, sem prova dinâmica de que todos os caminhos de busca respeitam as mesmas regras.
- **Integração e continuidade: 8/10 (10%)** — O serviço reúne catálogo social, Hype público, peças e looks, com integração ampla observável no código.

Pontos fortes:

- A mesma descoberta cobre conteúdo e entidades sociais, com atributos de moda.
- Existe fallback de busca sem índice e filtro explícito de conteúdo visível.

Lacunas/limites:

- Caminho do índice limita a 200 IDs antes dos filtros finais: filtros seletivos podem produzir páginas incompletas; requer teste de recall/paginação.
- Relevância por intenção, sinônimos de moda e equivalência de termos deve ser avaliada por conjunto rotulado, ausente nesta pesquisa.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/service/SearchService.java:92](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/SearchService.java#L92>) — Cinco abas de busca e filtros de estilo, ocasião, cor, marca, categoria e Hype.
- [fai-application/src/main/java/br/com/fashionai/application/service/SearchService.java:803](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/SearchService.java#L803>) — Busca de peças usa índice opcional ou banco; resultados passam por visibilidade e filtros.

### CC-07 — Captura orientada e padronização da fotografia da peça · 7,6/10

Orientar a captura e apresentar enquadramento total/tecido com alternativas e fallback.

Área:Peças, looks e catálogo. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 9/10 (25%)** — Fotografias confiáveis são essenciais para reconhecer roupas e apresentar produtos de moda com precisão.
- **Completude do fluxo: 7/10 (20%)** — Há política de captura, qualidade, modos total/tecido e fallback, mas a fidelidade do produto em casos difíceis não foi comprovada.
- **Usabilidade e acessibilidade: 7/10 (15%)** — A política limita insistência e oferece refazer/retry, embora orientações e substituições por ilustração ainda precisem de validação com usuários.
- **Confiabilidade e integridade: 6,5/10 (15%)** — O fallback evita vazio, mas não comprova remoção humana, preservação de logo ou contorno; nenhum benchmark de fotografias reais foi executado.
- **Segurança e privacidade: 7,5/10 (15%)** — O escopo lido mostra contratos e alternativas controladas, mas não incluiu auditoria integral de upload, armazenamento e privacidade das imagens.
- **Integração e continuidade: 8/10 (10%)** — A política backend e a apresentação de modos/fallback frontend estão conectadas, com lacuna na comunicação uniforme da procedência do resultado.

Pontos fortes:

- Captura tem política explícita de qualidade e limite de insistência.
- Falhas não precisam deixar card vazio; existe ilustração de fallback e ação de retry.

Lacunas/limites:

- Fallback garante presença visual, não fidelidade à fotografia da peça; componente não apresenta por si texto de origem/qualidade ao usuário.
- Não há validação empírica aqui de remoção humana, contorno, logotipos ou cobertura de tecido em amostra de fotos reais; essa capacidade merece benchmark separado.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/vision/capture/AdaptiveCaptureEngine.java:116](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/vision/capture/AdaptiveCaptureEngine.java#L116>) — Política prioriza refazer foto de baixa qualidade/região cortada e limita pedidos complementares.
- [components/catalog/catalog-photo.tsx:62](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/catalog/catalog-photo.tsx#L62>) — WHOLE/FABRIC resolvem recortes, origem, cadeia de alternativas, falha e retry.
- [components/catalog/default-garment-photo.tsx:5](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/catalog/default-garment-photo.tsx#L5>) — Fallback usa ilustração pela categoria/cor, com data-mode=default.

### CC-08 — Gerar, revisar, aprovar e descartar foto de estúdio · 8,3/10

Manter uma foto aprovada publicada enquanto novas versões aguardam revisão do proprietário.

Área:Peças, looks e catálogo. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 8,5/10 (25%)** — Revisar resultados antes de trocar a imagem publicada protege a representação visual de produtos de moda.
- **Completude do fluxo: 8,5/10 (20%)** — O fluxo cobre geração, pendência, aprovação e descarte, com histórico curto que não equivale a retenção/restauração ilimitadas.
- **Usabilidade e acessibilidade: 7,5/10 (15%)** — Ações estão disponíveis no detalhe da peça, mas clareza e esforço do fluxo de revisão não foram observados em navegador.
- **Confiabilidade e integridade: 8,5/10 (15%)** — A lógica mantém foto aprovada enquanto a substituta aguarda decisão e separa política de versões, embora a qualidade visual do provedor não seja certificada.
- **Segurança e privacidade: 8,5/10 (15%)** — Aprovação e descarte exigem peça própria e autorização no serviço, sem afirmar cobertura dinâmica de todas as rotas.
- **Integração e continuidade: 8/10 (10%)** — Metadata, armazenamento, comandos de revisão e interface de detalhe compartilham o fluxo de versões, com limpeza de mídia em melhor esforço.

Pontos fortes:

- Reprocessamento não substitui silenciosamente uma imagem aprovada.
- Política de versões e comandos de decisão estão separadas da interface e protegidas por propriedade.

Lacunas/limites:

- Histórico é curto/metadados e limpeza de mídia é best-effort; não equivale a DAM com retenção/restauração ilimitadas.
- Qualidade visual do resultado do provedor é uma dependência externa; testes estáticos de fluxo não a certificam.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/service/StudioVersionFlow.java:52](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/StudioVersionFlow.java#L52>) — Oferta de mesma origem preserva versão aprovada e insere nova versão pendente.
- [fai-application/src/main/java/br/com/fashionai/application/service/WardrobeService.java:793](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/WardrobeService.java#L793>) — Aprovação/descarte exigem criação autorizada e peça própria antes de delegar fluxo.
- [components/expanded-card/expanded-piece.tsx:100](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/expanded-card/expanded-piece.tsx#L100>) — Editor amplia dados e integra ações de edição da peça/foto.

### CC-09 — Analisar cápsula e versatilidade do guarda-roupa · 7,5/10

Mostrar peças-base, looks existentes e fator de versatilidade.

Área:Peças, looks e catálogo. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 8/10 (25%)** — Analisar versatilidade ajuda a reaproveitar roupas e perceber o valor de combinações já cadastradas.
- **Completude do fluxo: 7/10 (20%)** — A cápsula mostra peças-base, looks e fator, mas a superfície observada não realiza planejamento de agenda ou compras com restrições.
- **Usabilidade e acessibilidade: 7,5/10 (15%)** — Números resumidos, filtro por categoria e links às peças tornam a informação acessível, sem validação empírica de compreensão.
- **Confiabilidade e integridade: 7/10 (15%)** — A UI consome resultados do serviço, mas não foi verificada a estabilidade dos cálculos nem sua validação contra preferências reais.
- **Segurança e privacidade: 7,5/10 (15%)** — A consulta usa contexto pessoal autenticado no caminho /api/me/capsule, mas o backend completo desse recurso não foi auditado nesta amostra.
- **Integração e continuidade: 8/10 (10%)** — A cápsula conecta dados do guarda-roupa e looks existentes, servindo como base concreta para extensão de planejamento.

Pontos fortes:

- Transforma dados já cadastrados em apoio à reutilização.
- Integra composição e guarda-roupa em uma visão resumida compreensível.

Lacunas/limites:

- A superfície observada descreve combinações/uso existentes; não é planejamento de mala ou cobertura de agenda com restrições.
- Não foi demonstrado aqui como o fator é validado contra preferências reais ou se evita recomendar compras desnecessárias.

Evidências:

- [components/lookbook-tabs.tsx:318](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/lookbook-tabs.tsx#L318>) — Cápsula lê /api/me/capsule e permite categoria.
- [components/lookbook-tabs.tsx:325](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/lookbook-tabs.tsx#L325>) — Exibe peças-base, total de looks e fator; cards apontam às peças.

### 3D-01 — Criar, ajustar e versionar avatar por fotografia · 7,8/10

Avatar persistente com ajustes de aparência, qualidade, histórico e aprovação para exibição.

Área:Avatar, prova e caimento. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 8/10 (25%)** — Uma identidade reutilizável no provador atende diretamente apresentação e experimentação de moda; o valor é avaliação técnica, sem pesquisa de adoção.
- **Completude do fluxo: 8/10 (20%)** — Código cobre criação, ajuste, versões, aprovação e exclusão; não se comprovou fidelidade de todas as características pessoais.
- **Usabilidade e acessibilidade: 7/10 (15%)** — A UI possui avisos e ajuste manual, mas não houve teste de tarefas ou acessibilidade no navegador para confirmar facilidade de uso.
- **Confiabilidade e integridade: 7/10 (15%)** — Gates e versões reduzem estados inválidos no desenho do código; estabilidade, precisão e desempenho em execução não foram medidos.
- **Segurança e privacidade: 8,5/10 (15%)** — Consentimento explícito, controle de publicidade e moderação são demonstrados no backend, sem constituir auditoria de segurança completa.
- **Integração e continuidade: 8/10 (10%)** — O avatar é consumido pelo provador e outros fluxos, mas consistência entre todas as plataformas não foi verificada.

Pontos fortes:

- Fluxo inclui criação, ajustes, restauração/exclusão e controle de exposição pública.
- Aprovação de identidade e moderação da textura são controles distintos; não há aprovação remota por omissão.

Lacunas/limites:

- A fidelidade visual de rosto/pele/cabelo não foi medida nesta análise estática.
- Uma foto e métricas de qualidade do pipeline não constituem certificação biométrica nem prova de semelhança validada por usuários.

Evidências:

- [components/avatar3d/my-avatar.tsx:288](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/avatar3d/my-avatar.tsx#L288>) — Salvar exige consentimento, versão construída e verificações de qualidade.
- [fai-application/src/main/java/br/com/fashionai/application/service/Avatar3dService.java:123](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/Avatar3dService.java#L123>) — Backend exige consentimento, sanitiza qualidade e diferencia APPROVED/NEEDS_REFINEMENT.

### 3D-02 — Estimar proporções do corpo por SAM 3D Body · 7,7/10

Envio consentido para medição GPU e retorno restrito de proporções do corpo.

Área:Avatar, prova e caimento. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 8/10 (25%)** — Proporções personalizadas são relevantes para apresentação corporal e futura prova, sem comprovação de precisão clínica ou comercial.
- **Completude do fluxo: 7/10 (20%)** — O fluxo cobre envio, consentimento e resposta validada, mas entrega somente proporções e não uma malha exportável.
- **Usabilidade e acessibilidade: 7/10 (15%)** — Limites e recusas são explícitos, enquanto entendimento das mensagens e fricção do envio não foram testados com pessoas.
- **Confiabilidade e integridade: 8/10 (15%)** — Allowlist, validação de valores e diagnóstico de GPU são controles estáticos fortes; não houve inferência para medir disponibilidade ou erro.
- **Segurança e privacidade: 9/10 (15%)** — O código exige consentimento por envio e minimiza biometria retornada, com rate limit e sem malha/pontos no contrato.
- **Integração e continuidade: 7/10 (10%)** — O contrato é compatível com proporções do avatar, mas não integra automaticamente graduação de roupa ou recomendação oficial por marca.

Pontos fortes:

- Minimização de dado: contrato exclui a malha/pontos e declara limites da medição.
- Recusa razões inválidas e trata GPU indisponível; não simula inferência real.

Lacunas/limites:

- Contrato atual não entrega GLB do corpo ou de vestimenta ao consumidor.
- Disponibilidade, latência e erro antropométrico em operação não foram testados; não se pode pontuar precisão real a partir do código.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/service/AvatarBodyScanService.java:54](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/AvatarBodyScanService.java#L54>) — Guarda autorização/consentimento, indisponibilidade explícita e limite horário por usuário.
- [services/anatomical_vton/api.py:42](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/services/anatomical_vton/api.py#L42>) — Valida engine/device e allowlist de proporções; retorna meshReturned=false e metrologyCertified=false.

### 3D-03 — Provar combinações de lojas e guarda-roupa no avatar · 8,0/10

Sessão de peças de múltiplas marcas com palco, contexto de loja, restauração e provas salvas.

Área:Avatar, prova e caimento. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 9/10 (25%)** — Combinar peças de marcas e guarda-roupa resolve uma tarefa central de descoberta e composição antes da compra, por avaliação de domínio.
- **Completude do fluxo: 8/10 (20%)** — A página compõe seleção, variantes, prova salva e compartilhamento; a coerência visual dos produtos não foi confirmada em execução.
- **Usabilidade e acessibilidade: 8/10 (15%)** — Slots e ações diretas dão clareza estrutural à UI; a nota não pressupõe teste de navegabilidade nem métricas de abandono.
- **Confiabilidade e integridade: 7/10 (15%)** — Restauração e estado de sessão estão explícitos, mas não houve ensaio de falhas, desempenho ou consistência entre dispositivos.
- **Segurança e privacidade: 7/10 (15%)** — As operações de negócio são separadas da apresentação; este recorte não certifica todos os controles de acesso ou persistência local.
- **Integração e continuidade: 8/10 (10%)** — Integra catálogo, guarda-roupa e avatar, embora o fluxo web local e o serviço multiplataforma ainda precisem de reconciliação.

Pontos fortes:

- Combina origem de catálogo/guarda-roupa e preserva referência de variante.
- Separação de sessão e apresentação permite adaptar o ambiente sem mudar o corpo do avatar.

Lacunas/limites:

- Frontend observado usa armazenamento local para esta sessão; há outro serviço multiplataforma cuja adoção neste fluxo precisa ser reconciliada.
- Qualidade de textura/logos/costuras não é comprovada por compor corretamente a UI; requer avaliação visual controlada.

Evidências:

- [components/try-on/fitting-room.tsx:52](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/try-on/fitting-room.tsx#L52>) — Compõe sessão, palco, ambiente contextual, provas salvas e compartilhamento.
- [lib/hooks/use-fitting-session.ts:44](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/lib/hooks/use-fitting-session.ts#L44>) — Commit e restauração em sessionStorage; seleção de catálogo, variantes e troca de tamanho na mesma sessão.

### 3D-04 — Escolher tamanho e visualizar folga no molde · 6,7/10

Grade de referência de letras/números com ajuste visual e indicação regional de caimento.

Área:Avatar, prova e caimento. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 8/10 (25%)** — Escolher um tamanho visualmente tem utilidade alta na comparação de roupa, desde que seus limites sejam comunicados.
- **Completude do fluxo: 6/10 (20%)** — Há grades e feedback regional, mas faltam assets por tamanho e ligação automática à tabela real de cada produto.
- **Usabilidade e acessibilidade: 8/10 (15%)** — Chips em radiogroup e indicação do tamanho natural são evidências de uma interação simples; eficácia acessível não foi testada no navegador.
- **Confiabilidade e integridade: 5/10 (15%)** — As regras usam passos genéricos e aproximação de folga, portanto não sustentam garantia de ajuste físico ou precisão industrial.
- **Segurança e privacidade: 7/10 (15%)** — Esta seleção usa dados de apresentação e não exige uma nova inferência biométrica, mas a nota não substitui revisão completa de privacidade.
- **Integração e continuidade: 5/10 (10%)** — Persistência da escolha chega ao molde, mas não há integração demonstrada com a tabela oficial do produto ou GLB específico.

Pontos fortes:

- Escolha imediata, acessível em radiogroup, com feedback regional e persistência da preferência.
- Regras são explícitas e determinísticas, com limites de ajuste do molde.

Lacunas/limites:

- Visualização não usa automaticamente a tabela específica da marca/produto.
- Converter degraus genéricos em folga e comprimento não garante ajuste físico ou graduação industrial por tamanho.
- Seleção P/M/G/GG não equivale hoje a quatro assets certificados por peça.

Evidências:

- [lib/tryon/sizes.ts:1](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/lib/tryon/sizes.ts#L1>) — Comentário explicita grade padrão, calibrada pelo avatar, sem tabela oficial por produto.
- [lib/avatar3d/human/garment-fit.ts:236](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/lib/avatar3d/human/garment-fit.ts#L236>) — applySize transforma passos da grade em folga radial e comprimentos; não carrega GLB distinto por tamanho.

### 3D-05 — Recomendar tamanho por tabela de produto e feedback · 7,3/10

Backend calcula recomendação com protocolos de medidas, revisões de tabela, preferência e experiências anteriores.

Área:Avatar, prova e caimento. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 9/10 (25%)** — Resolver qual tamanho comprar é uma necessidade decisiva do varejo; o potencial de reduzir trocas ainda não foi medido.
- **Completude do fluxo: 7/10 (20%)** — Backend cobre tabela, protocolos, ambiguidades e feedback, porém famílias limitadas e UI genérica deixam o fluxo incompleto.
- **Usabilidade e acessibilidade: 5/10 (15%)** — O diálogo auditado não expõe o resultado do motor específico do produto, comprometendo acesso do usuário ao valor implementado no backend.
- **Confiabilidade e integridade: 8/10 (15%)** — Protocolos explícitos, validade e estados de insuficiência favorecem comportamento previsível; acurácia real não foi exercitada.
- **Segurança e privacidade: 8/10 (15%)** — Propriedade, permissão de edição, revisão e concorrência estão presentes no código, sem alegação de pentest ou teste de produção.
- **Integração e continuidade: 5/10 (10%)** — A coexistência de motor específico e diálogo de grade genérica demonstra uma lacuna de integração na jornada observada.

Pontos fortes:

- Modelo distingue protocolos de medida, informação ausente e resultado ambíguo.
- Backend confere propriedade, permissão de edição de tabela e concorrência.

Lacunas/limites:

- O fluxo visual auditado ainda não integra esse backend: o diálogo apresenta grade genérica.
- Configuração restringe famílias a TSHIRT/JEANS; expansão para todas as categorias não está comprovada.
- Não há avaliação empírica aqui de redução de trocas ou acurácia da recomendação.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/fit/FitService.java:107](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/fit/FitService.java#L107>) — Recomendação versionada/idempotente combina tabela e perfil; grava revisão e validade.
- [fai-application/src/main/java/br/com/fashionai/application/fit/FitEngine.java:12](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/fit/FitEngine.java#L12>) — Estados NO_CHART, INSUFFICIENT_MEASUREMENTS, AMBIGUOUS e incompatibilidades são explícitos.
- [components/fit/ProductFitDialog.tsx:17](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/fit/ProductFitDialog.tsx#L17>) — O diálogo observado usa GRIDS e SizeReferenceTable genéricas, sem consultar chart do produto.

### 3D-06 — Gerar modelo GLB de vitrine a partir da fotografia · 6,8/10

Job de reconstrução com provedores, estados, retry e alternativa local de relevo.

Área:Avatar, prova e caimento. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 8/10 (25%)** — Um asset da peça é útil para visualização e reaproveitamento, mas o valor depende de preservar sua identidade e geometria.
- **Completude do fluxo: 6/10 (20%)** — Jobs e resultados existem, enquanto assets P/M/G/GG e vestibilidade aprovada não fazem parte do model3dUrl auditado.
- **Usabilidade e acessibilidade: 6/10 (15%)** — Estados, retry e notificação oferecem feedback estrutural; espera percebida e entendimento da distinção relevo/reconstrução não foram testados.
- **Confiabilidade e integridade: 7/10 (15%)** — Validação de GLB, limite de tamanho e estados de falha são evidências de engenharia, sem comprovar qualidade da geometria ou SLA dos provedores.
- **Segurança e privacidade: 7/10 (15%)** — A requisição é documentada como chamada após validação de posse e sujeita ao motor de IA; não foi auditada toda a superfície de geração externa.
- **Integração e continuidade: 6/10 (10%)** — O resultado é persistido e notificado, mas a entidade de vitrine é distinta do asset vestível usado pelo provador certificado.

Pontos fortes:

- Pipeline identifica relevo vs reconstrução e persiste estado, resultado e notificações.
- Limite de bytes e validação de GLB existem no caminho remoto.

Lacunas/limites:

- model3dUrl armazena um único resultado de vitrine; não é contrato de assets P/M/G/GG.
- Reconstrução ou relevo não implicam roupa isolada, rigada, aprovada e geometricamente adequada ao avatar.
- Custo/latência/qualidade real dos provedores não foram exercitados nesta pesquisa.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/service/Model3dService.java:87](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/Model3dService.java#L87>) — Cria jobs, evita duplicação durante processamento e exige foto real.
- [fai-application/src/main/java/br/com/fashionai/application/service/Model3dService.java:257](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/Model3dService.java#L257>) — Alternativa local gera relevo quando não há resultado do provedor.
- [fai-domain/src/main/java/br/com/fashionai/domain/model/GarmentAsset3d.java:16](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-domain/src/main/java/br/com/fashionai/domain/model/GarmentAsset3d.java#L16>) — Entidade diferencia GLB de vitrine de asset rigado/aprovado para vestir.

### 3D-07 — Provar roupa na fotografia com IA · 7,4/10

Renderização 2D de peças elegíveis de catálogo/guarda-roupa na foto consentida da pessoa.

Área:Avatar, prova e caimento. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 8/10 (25%)** — Ver a roupa na própria fotografia pode apoiar decisão de estilo, mas não comprova tamanho e não foi avaliado em estudo de compra.
- **Completude do fluxo: 7/10 (20%)** — O fluxo recebe foto, peças e resposta, porém o modelo GPU exclui calçados e acessórios e não gera roupa 3D reutilizável.
- **Usabilidade e acessibilidade: 7/10 (15%)** — A interface traduz recusas e pede consentimento, sem evidência desta pesquisa sobre compreensão ou taxa de conclusão.
- **Confiabilidade e integridade: 7/10 (15%)** — Validações e códigos de recusa são observáveis no código, mas nenhuma inferência foi executada para medir preservação visual ou disponibilidade.
- **Segurança e privacidade: 8/10 (15%)** — Consentimento, autorização e elegibilidade das imagens são tratados no caminho auditado, sem validação operacional completa de retenção.
- **Integração e continuidade: 7/10 (10%)** — Conecta foto, catálogo e guarda-roupa, mantendo limitação de categorias e separação entre resultado 2D e malha 3D.

Pontos fortes:

- A interface explicita que imagem gerada não certifica tamanho; evita confundir foto convincente com medição.
- Há mapeamento de códigos de recusa para orientações e envio de consentimento explícito.

Lacunas/limites:

- Calçados/acessórios não são vestidos pelo mesmo modelo GPU nesse caminho.
- Resultado fotográfico não supre malha 3D reutilizável ou simulação de tecido.
- Sem teste remoto não há evidência desta auditoria de disponibilidade, latência ou preservação consistente de marcas.

Evidências:

- [components/try-on/gpu-look-dialog.tsx:85](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/try-on/gpu-look-dialog.tsx#L85>) — UI distingue resultado 2D, consentimento e categorias suportadas; não certifica caimento/tamanho.
- [fai-application/src/main/java/br/com/fashionai/application/service/AnatomicalTryOnService.java:32](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/AnatomicalTryOnService.java#L32>) — Render exige permissão, peça e processingConsent; catálogo passa por regras de elegibilidade.

### 3D-08 — Organizar quarto e experimentar no espelho 3D · 6,7/10

Ambiente pessoal com navegação/controle de câmera e estado de aproximação ao espelho.

Área:Avatar, prova e caimento. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 6/10 (25%)** — O quarto acrescenta organização e experiência pessoal, mas sua vantagem sobre seleção direta para tarefas de compra ainda precisa ser demonstrada.
- **Completude do fluxo: 7/10 (20%)** — Fases do espelho, abertura manual e câmera têm implementação; cobertura de todos os corpos, roupas e dispositivos não foi confirmada.
- **Usabilidade e acessibilidade: 6/10 (15%)** — Navegação espacial exige mais decisões e não houve teste de tarefas para confirmar que os controles são claros e eficientes.
- **Confiabilidade e integridade: 7/10 (15%)** — Limites de câmera e cálculo de enquadramento estão explícitos, sem prova visual aqui de ausência universal de clipping.
- **Segurança e privacidade: 7/10 (15%)** — O recorte mostra limites e validação de estado de vista, mas não é auditoria completa de propriedade dos itens e configuração do quarto.
- **Integração e continuidade: 8/10 (10%)** — O ambiente reutiliza roupas e avatar e se integra ao espelho, embora consistência fim a fim não tenha sido exercitada.

Pontos fortes:

- Políticas explícitas para estados do espelho, limites de câmera e evitar atravessar envelope do avatar.
- Integra inventário/roupas à representação pessoal do usuário.

Lacunas/limites:

- Os algoritmos existentes não provam ausência de clipping em todos os corpos, roupas e dispositivos.
- O benefício de navegação espacial sobre seleção direta para concluir uma compra ainda precisa de teste de tarefas.
- Não se presume que os bugs históricos de câmera continuem; não houve validação visual neste estudo.

Evidências:

- [lib/room3d/mirror-session.ts:83](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/lib/room3d/mirror-session.ts#L83>) — Sessão tem fases, abertura manual e trava de reabertura, com atualização por proximidade.
- [lib/scene3d/mirror-camera.ts:3](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/lib/scene3d/mirror-camera.ts#L3>) — Câmera calcula enquadramento angular de cabeça/pés e proteção do envelope do avatar.
- [lib/room3d/room-bounds.ts:96](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/lib/room3d/room-bounds.ts#L96>) — clampCamera confina câmera às paredes.

### 3D-09 — Aprovar assets vestíveis e sincronizar sessão entre plataformas · 7,3/10

Backend distingue assets rigados/aprovados de previews, com revisão de sessão e perfil de qualidade.

Área:Avatar, prova e caimento. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 8/10 (25%)** — Assets realmente vestíveis e continuidade entre aparelhos são relevantes para experimentação consistente em canais de varejo.
- **Completude do fluxo: 7/10 (20%)** — Backend possui aprovação e sessão versionada, mas não demonstra cobertura de clientes nem graduação de asset por tamanho.
- **Usabilidade e acessibilidade: 6/10 (15%)** — PREVIEW_2D e MESH_3D são distinguíveis no contrato, sem comprovação de comunicação e recuperação de conflitos nas interfaces finais.
- **Confiabilidade e integridade: 8/10 (15%)** — If-Match/412, gate e revisão humana sustentam previsibilidade arquitetural; sincronização real e performance não foram testadas.
- **Segurança e privacidade: 8/10 (15%)** — Registro/revisão restritos a admin e validações de renditions estão no código, sem equivaler à verificação operacional de todos os arquivos.
- **Integração e continuidade: 6/10 (10%)** — A sessão web observada usa storage local, logo a ponte com o backend multiplataforma ainda não está demonstrada neste fluxo.

Pontos fortes:

- Separação correta entre GLB de vitrine e vestimenta aprovada evita falsa equivalência.
- Controle de concorrência e fallback de qualidade estão expressos no contrato.

Lacunas/limites:

- Existência do backend não demonstra cobertura pelos clientes Unreal/mobile/web nem operação em produção.
- Contrato observado tem renditions por perfil de qualidade, sem grade oficial por tamanho.
- Integração do fluxo web local com sessão multiplataforma precisa ser concluída e testada.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/multiplatform/GarmentAssetService.java:44](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/multiplatform/GarmentAssetService.java#L44>) — Registro exige admin, origem/rig/renditions e gate; revisão humana é operação separada.
- [fai-application/src/main/java/br/com/fashionai/application/multiplatform/TryOnSessionService.java:28](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/multiplatform/TryOnSessionService.java#L28>) — Contrato usa If-Match/412, quatro slots e modo MESH_3D/PREVIEW_2D.
- [lib/hooks/use-fitting-session.ts:44](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/lib/hooks/use-fitting-session.ts#L44>) — Sessão web auditada ainda grava preferências localmente; não demonstra integração com esse backend.

### AT-01 — Projetos colaborativos de design · 8,1/10

Criar especificação, convidar participantes, comentar, revisar e publicar revisões do projeto.

Área:Design, IA e circularidade. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 9/10 (25%)** — Centraliza especificação, colaboração e decisões, reduzindo perda de contexto entre design e revisão; valor potencial, sem métrica de adoção.
- **Completude do fluxo: 8/10 (20%)** — O serviço implementa criação, edição, revisão, convites e arquivo, mas não modela execução fabril ou tarefas espaciais no produto.
- **Usabilidade e acessibilidade: 7/10 (15%)** — A UI organiza design, histórico e colaboração e apresenta erros/conflitos; esforço de navegação e acessibilidade efetiva não foram testados.
- **Confiabilidade e integridade: 8/10 (15%)** — Versões esperadas, requestId e checks de revisão de origem tratam repetição e concorrência no código; sem execução ponta a ponta nesta pesquisa.
- **Segurança e privacidade: 8,5/10 (15%)** — Papéis, bloqueios de conta e revisão por outra pessoa aparecem no serviço; isso não equivale a uma auditoria de segurança completa.
- **Integração e continuidade: 7/10 (10%)** — Ficha técnica e editor pertencem ao projeto, mas cotação, produção e venda não estão no contrato inspecionado.

Pontos fortes:

- Fluxo atravessa criação, revisão e colaboração; inclui conflitos de versão e chaves idempotentes.
- Papéis EDITOR/REVIEWER/VIEWER e separação do revisor em relação ao autor.

Lacunas/limites:

- Comentários são texto com âncora categórica; o contrato não modela discussão espacial em ponto da peça, anexos ou tarefas resolvidas.
- Rascunho usa versão global do projeto; não equivale a coedição simultânea.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/atelierproject/AtelierProjectService.java:48](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/atelierproject/AtelierProjectService.java#L48>) — Criação idempotente; publicação, convite e revisão com versões/papéis.
- [components/atelier-projects/project-detail.tsx:77](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/atelier-projects/project-detail.tsx#L77>) — UI de comentários ancorados, decisões e gestão de membros.

### AT-02 — Editor interativo de arquivos GLB · 7,4/10

Importar GLB, editar transformações/material/vértices permitidos, manter versões e exportar.

Área:Design, IA e circularidade. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 8,5/10 (25%)** — Importar e ajustar assets é útil à apresentação de design, embora não substitua ferramentas de modelagem industrial.
- **Completude do fluxo: 6,5/10 (20%)** — Há transformações, materiais e vértices, porém operações de vértice são explicitamente vetadas em assets com rig/morph/animação e não há modelagem de tecido no contrato.
- **Usabilidade e acessibilidade: 6,5/10 (15%)** — Controles numéricos, viewport e avisos estão implementados; curva de aprendizagem, precisão e adequação mobile não foram medidas.
- **Confiabilidade e integridade: 7,5/10 (15%)** — Inspeção limitada de GLB e validação server-side reduzem falhas previsíveis; compatibilidade de assets de marcas não foi exercitada nesta análise.
- **Segurança e privacidade: 8/10 (15%)** — Controle de projeto e rejeição de URIs externas delimitam acesso/conteúdo; nenhum pentest ou verificação de ambiente foi feito.
- **Integração e continuidade: 7/10 (10%)** — Assets/versões conectam-se ao Atelier, mas o código lido não transforma automaticamente o GLB em peça graduada e validada para o provador.

Pontos fortes:

- Validação no servidor complementa os controles do cliente.
- Preserva original, edita documento e bloqueia operações incompatíveis com deformação.

Lacunas/limites:

- O escopo implementado é transformação/material/vértice de malha estática, não modelagem completa de moda com costura, retopologia, simulação física e graduação industrial.
- Limite8MiB e allowlist de extensões precisam ser considerados ao prometer importação de acervos profissionais; não são defeitos por si só.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/atelier3d/GlbInspector.java:11](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/atelier3d/GlbInspector.java#L11>) — Limite8MiB e inspeção de contêiner/texturas/URIs.
- [fai-application/src/main/java/br/com/fashionai/application/atelier3d/Atelier3dService.java:95](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/atelier3d/Atelier3dService.java#L95>) — Validação do documento no servidor; proíbe vértices em malhas deformáveis.
- [components/atelier3d/scene-inspector.tsx:139](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/atelier3d/scene-inspector.tsx#L139>) — Aviso e bloqueio de edição de vértices para rig/morph/animação.

### AT-03 — Convidados externos no editor · 7,7/10

Compartilhar acesso temporário de visualização/edição e permissão de exportação por projeto.

Área:Design, IA e circularidade. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 8/10 (25%)** — Convidar designer ou revisor sem exigir uma conta completa favorece colaboração externa; ganho de conversão não foi medido.
- **Completude do fluxo: 7,5/10 (20%)** — Papéis, validade, revogação e exportação estão presentes; coedição simultânea com presença e merge de operações não integra esse fluxo.
- **Usabilidade e acessibilidade: 7/10 (15%)** — Formulário e link com fragmento oferecem um caminho direto; compreensão das permissões por pessoas convidadas precisa de teste.
- **Confiabilidade e integridade: 8/10 (15%)** — Sequência esperada e revogação/expiração são conferidas no backend, mas recuperação de conflitos reais entre convidados não foi simulada nesta pesquisa.
- **Segurança e privacidade: 8,5/10 (15%)** — Token hash, comparação resistente a timing e escopo de projeto constam do serviço; risco de compartilhamento indevido do link continua inerente à capacidade.
- **Integração e continuidade: 7/10 (10%)** — Funciona sobre os mesmos assets/projetos, com pouca integração explícita a tarefas ou revisão técnica estruturada.

Pontos fortes:

- Convite tem validade, revogação e permissão de exportação distinta de edição.
- Capacidade é escopada ao projeto; token persistido como hash.

Lacunas/limites:

- O salvamento concorre por expectedSequence; visitantes não recebem colaboração em tempo real com presença, cursor ou mesclagem de operações.
- Compartilhar um link-capacidade exige UX explícita de revogação e cuidados; eficácia desse entendimento precisa de teste com usuários.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/atelier3d/Atelier3dService.java:57](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/atelier3d/Atelier3dService.java#L57>) — Valida hash, expiração, revogação e papel do guest.
- [components/atelier3d/guest-panel.tsx:36](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/atelier3d/guest-panel.tsx#L36>) — Cria convite com papel/horas/exportação e entrega token em fragmento da URL.

### AT-04 — Ficha técnica versionada e exportável · 7,8/10

Consultar/imprimir/exportar a especificação, medidas e revisão de um projeto.

Área:Design, IA e circularidade. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 8,5/10 (25%)** — Documento versionado reduz ambiguidade ao comunicar uma peça a revisor/fornecedor, sem prometer prontidão para fabricação.
- **Completude do fluxo: 7/10 (20%)** — Exporta campos, medidas, protocolos e pareceres; o contrato marca productionApproved=false e não inclui BOM/graduação/custo.
- **Usabilidade e acessibilidade: 7,5/10 (15%)** — Tela imprimível mostra campos ausentes e revisão, mas legibilidade impressa e uso em produção não foram validados.
- **Confiabilidade e integridade: 8/10 (15%)** — Exportação usa revisão identificável e conteúdo imutável, reduzindo divergência entre versões; não se testou geração real neste estudo.
- **Segurança e privacidade: 8/10 (15%)** — Backend verifica leitura do projeto e React escapa textos; não é certificação de ausência de vulnerabilidades.
- **Integração e continuidade: 7,5/10 (10%)** — Integra o histórico e a revisão do Atelier, faltando um contrato operacional com cotação e fabricação.

Pontos fortes:

- Documento identifica projeto/revisão, protocolos de medidas, lacunas e revisão.
- Distingue aprovação para exposição de aprovação de fabricação.

Lacunas/limites:

- O próprio contrato exclui molde industrial, pedido e aprovação de produção; não deve ser apresentado como prontidão fabril.
- Especificação usa campos textuais e lista simples de pontos de medida; não há na estrutura lida BOM/consumo/custo/graduação por tamanho.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/atelierproject/AtelierProjectService.java:155](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/atelierproject/AtelierProjectService.java#L155>) — Exportação vinculada à revisão e declara productionApproved=false.
- [components/atelier-projects/printable-tech-pack.tsx:18](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/atelier-projects/printable-tech-pack.tsx#L18>) — Tela imprimível, campos faltantes, medidas/protocolos e pareceres.

### AT-05 — Votação de interesse em criações · 7,2/10

Registrar e retirar interesse em uma revisão publicada com prazo.

Área:Design, IA e circularidade. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 7/10 (25%)** — Interesse da comunidade ajuda priorizar propostas, mas sinal booleano tem alcance limitado para estimar demanda comercial.
- **Completude do fluxo: 7/10 (20%)** — O fluxo registra/retira interesse por revisão e prazo; não coleta grade, quantidade ou faixa de preço.
- **Usabilidade e acessibilidade: 7,5/10 (15%)** — Botão com aria-pressed e prazo oferece feedback previsto no código; entendimento e acessibilidade não foram exercitados.
- **Confiabilidade e integridade: 7,5/10 (15%)** — Voto único por usuário/revisão e verificação de prazo são mecanismos visíveis, sem ensaio de concorrência nesta pesquisa.
- **Segurança e privacidade: 8/10 (15%)** — Leitura, revogação e projeto arquivado são considerados; resistência a contas múltiplas ou manipulação de demanda não foi demonstrada.
- **Integração e continuidade: 6/10 (10%)** — O voto aparece na revisão, mas não alimenta diretamente uma cotação ou reserva no fluxo examinado.

Pontos fortes:

- Voto é vinculado à revisão e considera prazo, acesso revogado e projeto arquivado.
- Distingue intenção da comunidade de cobrança/pedido.

Lacunas/limites:

- Interesse é booleano: o contrato não captura tamanho, faixa de preço ou quantidade para orientar viabilidade de lote.
- Não existe neste fluxo conversão de interesse em cotação ou reserva; isso limita seu uso no varejo sob demanda.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/atelierproject/AtelierProjectService.java:145](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/atelierproject/AtelierProjectService.java#L145>) — Voto por usuário/revisão com prazo e verificação de acesso.
- [components/atelier-projects/project-detail.tsx:55](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/atelier-projects/project-detail.tsx#L55>) — UI de contagem, prazo, registrar/retirar interesse.

### AT-06 — Copilot de combinações e orientação · 7,8/10

Assistente com peças do próprio guarda-roupa, descoberta, reuso e ações de criação.

Área:Design, IA e circularidade. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 8,5/10 (25%)** — Conecta a dúvida do usuário a peças possuídas, reutilização e ações concretas; não há nesta avaliação medição de benefício real.
- **Completude do fluxo: 7,5/10 (20%)** — Múltiplas intenções e fallback cobrem orientação e combinação, mas histórico integral da conversa não aparece como persistência no cliente lido.
- **Usabilidade e acessibilidade: 7,5/10 (15%)** — Chat, sugestões e chips oferecem feedback e ações; clareza das respostas e facilidade de seleção demandam teste com usuários.
- **Confiabilidade e integridade: 7/10 (15%)** — Entrada é sanitizada e resposta fornece fallback/quota; qualidade semântica e latência dos provedores não foram medidas.
- **Segurança e privacidade: 8/10 (15%)** — O serviço opera sob usuário/contexto e valida referências no fluxo de recomendações; robustez completa de prompt injection não foi certificada.
- **Integração e continuidade: 8/10 (10%)** — Reusa guarda-roupa, DNA, clima e criação de esquemas, aproximando orientação e execução no produto.

Pontos fortes:

- Respostas podem se referir a peças válidas e alimentar ações concretas; considera reutilização antes de compra.
- Contrato informa fallback/quota e permite distinguir texto gerado de rotas locais.

Lacunas/limites:

- O chat lido mantém mensagens em estado React; persistência observada em localStorage é de looks salvos, não do histórico completo da conversa.
- Qualidade de combinações e explicações ainda demanda avaliação quantitativa por usuários; esta leitura não certifica gosto/adequação.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/service/CopilotService.java:703](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/CopilotService.java#L703>) — Despacho por intenções e limpeza da entrada; resposta inclui ações/contexto.
- [fai-application/src/main/java/br/com/fashionai/application/service/CopilotService.java:1331](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/CopilotService.java#L1331>) — Resposta informa fallback, explicação e quota.
- [app/(site)/(app)/copilot/page.tsx:88](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/app/%28site%29/%28app%29/copilot/page.tsx#L88>) — Conversa em estado local; sugestões salvas separadamente em localStorage.

### AT-07 — Autopiloto de looks diários e semanais · 8,2/10

Sugerir/confirmar combinações, planejar dias e editar o plano usando ocasião, humor e clima.

Área:Design, IA e circularidade. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 9/10 (25%)** — Planejamento diário/semanal atende uma necessidade recorrente de vestir-se com o acervo existente; impacto em retenção é hipótese.
- **Completude do fluxo: 8/10 (20%)** — Oferece alternativas, confirmação, plano e edição; restrições de bagagem/lavanderia não fazem parte do contrato inspecionado.
- **Usabilidade e acessibilidade: 7,5/10 (15%)** — Justificativas, lacunas e edição manual estão expostas; o percurso de completar uma semana não foi validado com usuários.
- **Confiabilidade e integridade: 7,5/10 (15%)** — Candidatas já validadas e fallback reduzem dependência de geração livre; não foram medidos erros, carga ou indisponibilidade.
- **Segurança e privacidade: 8/10 (15%)** — Plano e peças são associados ao usuário e confirmação é explícita; não se executaram testes de autorização neste estudo.
- **Integração e continuidade: 8,5/10 (10%)** — DNA, clima, itens, scores e esquemas salvos se conectam ao plano, com separação de sugestões de compra.

Pontos fortes:

- Fecha ciclo sugestão→confirmação e planejamento→edição; usa itens reais do usuário.
- Preserva justificativas, dias com lacunas e scores para as combinações existentes.

Lacunas/limites:

- O fluxo lido agenda looks, mas não reserva itens por ciclos de lavagem/secagem ou limita peso/volume de mala.
- Para varejo, compra sugerida permanece separada da peça possuída, corretamente; aquisição/estoque/entrega não são resolvidos por esse fluxo.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/service/AutopilotService.java:270](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/AutopilotService.java#L270>) — Escolha de candidatas já validadas com justificação e contexto.
- [fai-application/src/main/java/br/com/fashionai/application/service/AutopilotService.java:581](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/AutopilotService.java#L581>) — Plano semanal persiste dias, lacunas, justificativas e alterações.
- [app/(site)/(app)/autopilot/page.tsx:35](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/app/%28site%29/%28app%29/autopilot/page.tsx#L35>) — Confirmação explícita de look e navegação para o esquema salvo.

### AT-08 — DNA de estilo e identidade de moda · 7,6/10

Sintetizar perfil estilístico, sinais de uso e narrativas de identidade com controles de privacidade.

Área:Design, IA e circularidade. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 7,5/10 (25%)** — Perfil de estilo pode orientar combinações e expressão pessoal, embora validade do retrato de identidade não seja demonstrada só pelo algoritmo.
- **Completude do fluxo: 7,5/10 (20%)** — Síntese, vida opcional, privacidade e histórico estão presentes; explicabilidade das inferências e correções pelo usuário exigem evolução.
- **Usabilidade e acessibilidade: 7/10 (15%)** — Opcionalidade e controles por campo são escolhas de UX observáveis no contrato, sem comprovação de compreensão na prática.
- **Confiabilidade e integridade: 7,5/10 (15%)** — Snapshots e atualização parcial distinguem mudanças de identidade; qualidade das heurísticas não foi avaliada quantitativamente.
- **Segurança e privacidade: 8/10 (15%)** — Privacidade por campo e geração sem identidade de vida mitigam exposição, mas não se testou a propagação de dados em todos os consumidores.
- **Integração e continuidade: 8/10 (10%)** — Sinais de looks/feedback alimentam o DNA e as recomendações; integra expressão pessoal com uso do guarda-roupa.

Pontos fortes:

- Combina preferências e uso observado; identidade de vida não é obrigatória.
- Controle por campo e snapshots permitem preservar privacidade e evolução do perfil.

Lacunas/limites:

- Pesos heurísticos como dobrar looks com feedback positivo precisam de apresentação compreensível; o algoritmo não demonstra por si só validade psicométrica.
- DNA visual não deve ser tratado como medida objetiva de identidade ou substituto de preferências explícitas; validação com públicos diversos permanece necessária.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/service/DnaService.java:267](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/DnaService.java#L267>) — Síntese com opção de pular identidade de vida e atualização separada.
- [fai-application/src/main/java/br/com/fashionai/application/service/DnaService.java:299](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/DnaService.java#L299>) — Privacidade por campos e invalidação de imagem derivada.
- [fai-application/src/main/java/br/com/fashionai/application/service/DnaService.java:311](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/DnaService.java#L311>) — Sinal de feedback positivo tem peso dobrado na síntese.

### AT-09 — Passaporte digital e compartilhamento privado · 8,4/10

Manter declarações de origem/composição/cuidados/histórico e compartilhar apenas campos autorizados.

Área:Design, IA e circularidade. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 9/10 (25%)** — Histórico e cuidado apoiam segunda vida e confiança, sem confundir declaração do dono com prova de autenticidade.
- **Completude do fluxo: 8/10 (20%)** — Criação, declaração, eventos, correções e compartilhamento estão presentes; atestação por marca/oficina não é o nível atual de evidência.
- **Usabilidade e acessibilidade: 7,5/10 (15%)** — Editor tem seções e formulários, mas esforço para registrar histórico e consentir escopos precisa de pesquisa de usabilidade.
- **Confiabilidade e integridade: 8,5/10 (15%)** — Locks, versões, idempotência e expiração são verificáveis no serviço; testes reais de disponibilidade não foram executados.
- **Segurança e privacidade: 9/10 (15%)** — Campos compartilháveis limitados, links revogáveis e narrativas privadas por autor oferecem uma boa base estática de privacidade.
- **Integração e continuidade: 7,5/10 (10%)** — Reaproveita peça, composição/cuidados e transferência; integração com emissores externos de evidência ainda é uma expansão.

Pontos fortes:

- É um fluxo de produto já existente; não precisa ser proposto novamente como novidade.
- Segrega narrativa privada por dono, escopo público, expiração e procedência declarada.

Lacunas/limites:

- Evidência apresentada é marcada PRESENTED_UNVERIFIED; não há nesse contrato uma cadeia de atestação de composição ou autenticidade por marca/oficina.
- Histórico autodeclarado ajuda confiança, mas não comprova impacto ambiental, conformidade regulatória ou fabricação.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/passport/GarmentPassportService.java:156](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/passport/GarmentPassportService.java#L156>) — Declaração e eventos com versão, correções, idempotência e autoria.
- [fai-application/src/main/java/br/com/fashionai/application/passport/GarmentPassportService.java:202](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/passport/GarmentPassportService.java#L202>) — Compartilhamento com escopo/expiração e revogação.
- [fai-application/src/main/java/br/com/fashionai/application/passport/GarmentPassportService.java:247](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/passport/GarmentPassportService.java#L247>) — Saída declara OWNER_DECLARED e NOT_VERIFIED, sem alegar autenticação de marca.

### AT-10 — Transferência e apoio à segunda vida da peça · 8,0/10

Oferecer/aceitar transferência, preservar autoria histórica e reaproveitar informações em revenda/doação.

Área:Design, IA e circularidade. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 8,5/10 (25%)** — Facilita preservar o histórico útil durante troca ou revenda, respeitando a autoria anterior; não é um checkout de varejo.
- **Completude do fluxo: 7/10 (20%)** — Oferta, aceite, cancelamento e projeção de revenda estão implementados, mas a imagem default fixa para casos não CATALOG deixa uma lacuna de representação.
- **Usabilidade e acessibilidade: 7/10 (15%)** — Aceite orienta token e prazo, porém colagem de token e recuperação do fluxo não foram avaliadas com usuários.
- **Confiabilidade e integridade: 8,5/10 (15%)** — Locks, checagens de posse/versão e retry retornando o mesmo resultado tratam integridade de transferência no código.
- **Segurança e privacidade: 9/10 (15%)** — Destinatário específico, hash e segregação de dados/selos limitam exposição; o estudo não comprova segurança operacional.
- **Integração e continuidade: 7,5/10 (10%)** — Transferência integra guarda-roupa/passaporte/revenda, mas pedidos, frete, pagamento e disputa são fluxos distintos ainda ausentes nessa projeção.

Pontos fortes:

- Transação preserva autoria e evita transportar campos pessoais/selos para o novo dono.
- Aceite exige destinatário específico e token; retry devolve mesma transferência.

Lacunas/limites:

- No ramo não CATALOG do aceite, o código fixa default de camiseta independentemente da categoria original: risco concreto de representação errada de calças/casacos transferidos.
- A projeção de revenda é informativa: não representa checkout, pagamento, frete, disputa ou inspeção física.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/passport/GarmentPassportService.java:256](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/passport/GarmentPassportService.java#L256>) — Dados de revenda dependem da peça disponível e marcada para vender/doar.
- [fai-application/src/main/java/br/com/fashionai/application/passport/GarmentPassportService.java:304](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/passport/GarmentPassportService.java#L304>) — Aceite valida destinatário, token, versão, prazo e posse; mantém item histórico.
- [fai-application/src/main/java/br/com/fashionai/application/passport/GarmentPassportService.java:336](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/passport/GarmentPassportService.java#L336>) — Fotos de catálogo são preservadas; outros casos usam imagem default fixa de camiseta.
- [components/passport/passport-transfers.tsx:14](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/passport/passport-transfers.tsx#L14>) — UI de aceite com retries e estado explícito.

### SOC01 — Feed e interações sociais de moda · 8,0/10

Descobrir looks, peças e perfis com filtros de estilo, ocasião, marca e Hype.

Área:Social, gamificação e varejo. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 8,5/10 (25%)** — Filtros de estilo/ocasião e descoberta de peças/perfis atendem diretamente inspiração e busca de moda, segundo SearchService, sem medir adoção real.
- **Completude do fluxo: 8/10 (20%)** — Frontend e backend cobrem busca, feed, estados e visibilidade; as janelas fixas de candidatos400/200 limitam a avaliação de completude em escala.
- **Usabilidade e acessibilidade: 7,5/10 (15%)** — FeedDiscovery possui skeleton, retry, empty e nomes acessíveis; a nota é potencial de usabilidade por inspeção, sem sessão observada.
- **Confiabilidade e integridade: 7/10 (15%)** — Paginação e limites existem, mas a ordenação de conjuntos parciais e a latência precisam de testes de carga que não foram executados.
- **Segurança e privacidade: 8/10 (15%)** — Guardas de visibilidade e bloqueio aparecem no serviço e no painel; não foi feito teste adversarial de vazamento.
- **Integração e continuidade: 8,5/10 (10%)** — Conteúdo social, DNA, marcas, busca e Hype participam da mesma descoberta, com evidência explícita no contrato do feed.

Pontos fortes:

- Há fluxo integrado de descoberta, busca e conteúdo social; filtros alinhados à linguagem de moda.
- Estados de carregamento, erro e vazio estão explícitos no frontend.

Lacunas/limites:

- O feed consultado lê até400 esquemas e200 compartilhamentos antes de montar candidatos: alcance e custo de ordenação precisam ser medidos em bases maiores.
- A observação estática não comprova satisfação, diversidade de exposição ou relevância da ordenação para compras; essas métricas devem orientar evolução.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/service/SearchService.java:430](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/SearchService.java#L430>) — Feed limita tamanho, respeita bloqueios e integra sinais DNA/Hype; lê janelas de candidatos limitadas.
- [components/feed-discovery.tsx:14](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/feed-discovery.tsx#L14>) — Painel reaproveita busca; busca paralela, loading, retry, empty e exclusão de bloqueados.

### SOC02 — Perfis, conexões e privacidade social · 8,0/10

Manter identidade pessoal/institucional, seguir perfis, aceitar solicitações e bloquear relações.

Área:Social, gamificação e varejo. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 8/10 (25%)** — Perfis e relações conectam quem veste/cria a marcas e criadores, um habilitador relevante para social commerce, sem presumir conversão medida.
- **Completude do fluxo: 8/10 (20%)** — ProfileService oferece seguir, deixar de seguir, responder e bloquear; completude de todas as combinações de conta não foi exercitada.
- **Usabilidade e acessibilidade: 8/10 (15%)** — ProfileHeader agrupa identidade, ações e contadores com texto traduzível; densidade visual exige teste com usuários.
- **Confiabilidade e integridade: 7,5/10 (15%)** — Existe serviço central de vínculos e operações específicas; não foi validado comportamento sob corrida, indisponibilidade ou tráfego real.
- **Segurança e privacidade: 8/10 (15%)** — Respond exige proprietário do vínculo e há bloqueio explícito; isso é evidência de controle, não certificação de segurança.
- **Integração e continuidade: 8,5/10 (10%)** — O header aceita Hype e progresso e o perfil expõe peças/looks/conexões, ligando módulos de identidade e moda.

Pontos fortes:

- Relações sociais têm comportamentos distintos de seguir, responder e bloquear, em vez de uma lista sem governança.
- Identidade e contadores aproximam criadores, marcas e usuários; há nomes acessíveis e tradução.

Lacunas/limites:

- Header combina identidade, seguidores, Hype e nível; hierarquia e compreensão dessa densidade devem ser validadas com tarefas reais, sem tratar complexidade visual como defeito já confirmado.
- A leitura do perfil não demonstra qualidade de matching entre comprador e criador nem eficácia contra abuso; avaliação de conversão e denúncias ainda é necessária.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/service/ProfileService.java:197](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/ProfileService.java#L197>) — Fluxos de follow/unfollow/respond e block; resposta exige dono do vínculo.
- [components/profile-header.tsx:18](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/profile-header.tsx#L18>) — Header concentra identidade, contadores, ações e progressão de nível.

### SOC03 — HypeScore, tendências e explicabilidade · 7,8/10

Apresentar relevância social de peças e looks com motivos compreensíveis e respeito à visibilidade.

Área:Social, gamificação e varejo. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 7,5/10 (25%)** — Relevância social ajuda descoberta e comparação de tendências; não substitui qualidade física ou vestibilidade, o que limita sua utilidade para compra.
- **Completude do fluxo: 8/10 (20%)** — Consultas, snapshots, motivos e componente de explicação existem; calibração e eficácia de proteção contra manipulação não foram verificadas.
- **Usabilidade e acessibilidade: 7,5/10 (15%)** — HypeExplanation oferece motivos e disclaimer; compreensão dos sinais e do número não foi observada em uso.
- **Confiabilidade e integridade: 7,5/10 (15%)** — Leitura de estado persistido/cache evita recálculo por GET; frescor, qualidade dos sinais e desempenho não foram medidos.
- **Segurança e privacidade: 8/10 (15%)** — HypeQueryService restringe rankings públicos à elegibilidade e separa dados pessoais; a avaliação não cobre auditoria adversarial.
- **Integração e continuidade: 8,5/10 (10%)** — Hype é consumido por feed, marcas, perfis e políticas de selo, com contratos separados de compatibilidade de estilo.

Pontos fortes:

- A distinção explícita entre relevância, qualidade e compatibilidade reduz interpretação enganosa do score.
- Leitura do estado calculado e cache por geração evita recalcular tudo em cada GET.

Lacunas/limites:

- O score social, por desenho, não responde durabilidade, vestibilidade ou custo-benefício; essas informações não podem ser deduzidas da nota Hype.
- O código e a explicação não certificam calibração estatística, resistência a campanhas coordenadas ou justiça de exposição; exigem avaliação específica.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/hype/HypeQueryService.java:60](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/hype/HypeQueryService.java#L60>) — Consultas separam Hype de compatibilidade de estilo e restringem ranking público à elegibilidade pública.
- [components/hype/hype-explanation.tsx:12](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/hype/hype-explanation.tsx#L12>) — Resumo, razões e aviso de que relevância não equivale a qualidade/estilo.

### SOC04 — Auras e personalização licenciada dos cards · 7,7/10

Escolher acabamento visual, movimento e arte conforme nível e licença do usuário.

Área:Social, gamificação e varejo. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 7/10 (25%)** — Auras oferecem expressão e identidade visual, mas seu efeito na decisão de vestir/comprar é indireto e ainda precisa de validação de valor.
- **Completude do fluxo: 8/10 (20%)** — Picker, permissões no servidor e licença em serviço próprio formam fluxo existente; combinatória visual/licenças não foi exercitada integralmente.
- **Usabilidade e acessibilidade: 7,5/10 (15%)** — Preview identificado como demo, estados de nível e reduced motion favorecem entendimento; não houve validação de contraste/performance no navegador.
- **Confiabilidade e integridade: 7,5/10 (15%)** — Permissões são buscadas com refresh e estados de erro/loading afetam desbloqueio; cache/concorrência entre concessão e seleção não foram testados.
- **Segurança e privacidade: 8/10 (15%)** — AuraPermissionsService exige nível no backend, além do cadeado visual; configuração completa de licença não foi revalidada neste recorte.
- **Integração e continuidade: 8,5/10 (10%)** — Acabamentos estão ligados a cards, nível e licenças de marcas, com catálogo compartilhado de presets.

Pontos fortes:

- Limite de nível existe também no backend; cadeado visual não é a única barreira.
- Amostras são marcadas como demonstração e animação respeita preferência de redução de movimento.

Lacunas/limites:

- A utilidade direta para escolher ou comprar roupa é menor do que a do conteúdo da peça; o recurso deve ser avaliado como expressão/retorno ao app, não prova de melhoria no varejo.
- A matriz de permissões e a licença da arte são conceitos distintos; a jornada precisa explicar a diferença e medir entendimento, sem assumir que testes de shader/preview garantem acessibilidade global.

Evidências:

- [components/hype/aura-hype-picker.tsx:24](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/hype/aura-hype-picker.tsx#L24>) — Permissões vindas do servidor, fallback local, separação de exemplos e respeito a reduced motion.
- [fai-application/src/main/java/br/com/fashionai/application/service/AuraPermissionsService.java:15](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/AuraPermissionsService.java#L15>) — Servidor exige tier para acabamentos; combinação com BackgroundStudioService.requireAuraAccess protege salvamento.

### SOC05 — Selos de marcas/celebridades e vínculo com looks · 7,9/10

Criar políticas de selo e solicitar/aplicar vínculos com consentimento de imagem e autorização.

Área:Social, gamificação e varejo. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 8/10 (25%)** — Selos conectam peças/looks a emissores e campanhas, útil para collab e vínculo de marca; não atestam autenticidade física por si só.
- **Completude do fluxo: 8/10 (20%)** — Wizard, sugestão, aceite, consentimento e políticas aparecem no código; falta comprovar conclusão por emissores reais em tarefas.
- **Usabilidade e acessibilidade: 7/10 (15%)** — O fluxo inclui consentimento e feedback de candidatos, mas regras numerosas podem demandar suporte; essa carga não foi medida.
- **Confiabilidade e integridade: 7,5/10 (15%)** — Validações de vínculo e operações transacionais sustentam o fluxo; não foi medida a estabilidade da cadeia completa de emissor até renderização.
- **Segurança e privacidade: 8,5/10 (15%)** — Exigência de emissor/dono e consentimento explícito é observável em SealService; a nota não comprova licenciamento jurídico nem pentest.
- **Integração e continuidade: 8,5/10 (10%)** — O modelo vincula marcas/celebridades, peças, esquemas, Hype e benefícios, com pontos de integração concretos.

Pontos fortes:

- Vínculo e consentimento são tratados como operações próprias, não apenas uma imagem decorativa.
- Políticas e relações com peças, esquemas e Hype permitem collabs contextualizadas.

Lacunas/limites:

- A criação/validação de políticas é conceitualmente complexa; conclusão de tarefa por marcas deve ser medida, não inferida pela existência do wizard.
- Selo de vínculo/participação não demonstra autenticidade física da peça nem certificação de qualidade; essa distinção deve acompanhar o recurso e futuras integrações.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/service/SealService.java:1372](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/SealService.java#L1372>) — Aceite de vínculo tem contrato explícito de imageRightsConsent; há governança de emissor/dono em criação/edição.
- [components/look-seal-verification.tsx:18](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/look-seal-verification.tsx#L18>) — UI distingue candidatos, consentimento e retry antes de vincular arte ao look.

### SOC06 — Desafios de looks e tendências comunitárias · 7,8/10

Participar em desafios de moda, registrar evidências, votar e receber recompensas.

Área:Social, gamificação e varejo. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 8/10 (25%)** — Desafios estimulam composição e reutilização de looks; benefício de engajamento e impacto ambiental ainda são hipóteses a medir.
- **Completude do fluxo: 8/10 (20%)** — Catálogo, participação, evidência, inscrição, votação e resultado existem em ChallengeService; a experiência por modo não foi executada.
- **Usabilidade e acessibilidade: 7/10 (15%)** — Modos e estados próprios tornam a experiência expressiva, porém aumentam carga de entendimento; a nota é heurística sem tarefas observadas.
- **Confiabilidade e integridade: 7,5/10 (15%)** — Guardas de estado, anti-repetição e integração com pontos são visíveis; qualidade da evidência real e resistência a fraude não foram testadas.
- **Segurança e privacidade: 8/10 (15%)** — Inscrição exige dono do look/peças e participante ativo, o que estabelece proteção de propriedade no caminho examinado.
- **Integração e continuidade: 8,5/10 (10%)** — Looks, eventos do guarda-roupa, tendências e recompensas estão conectados por serviços e componentes existentes.

Pontos fortes:

- Regras verificam propriedade e estado, evitando que inscrição seja apenas um botão sem validação.
- Eventos de criação/uso de looks se conectam às recompensas e à progressão do guarda-roupa.

Lacunas/limites:

- Eventos digitais comprovam ações no app, não necessariamente uso real prolongado, reparo ou impacto ambiental; novas recompensas dessa natureza exigem evidências específicas.
- Modos e condições numerosos aumentam carga cognitiva; retenção saudável, fraude e entendimento precisam de medição por desafio.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/service/ChallengeService.java:1333](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/ChallengeService.java#L1333>) — Inscrição verifica participante ativo, dono do esquema e peças próprias; recusa inscrição repetida em modos single-shot.
- [components/challenges/community-trends.tsx:14](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/challenges/community-trends.tsx#L14>) — Superfície de tendências conectada a desafios e conteúdo comunitário.

### SOC07 — FAI Points, progressão e recompensas · 8,0/10

Ganhar pontos, entender progresso e resgatar benefícios ou itens conforme saldo e nível.

Área:Social, gamificação e varejo. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 7,5/10 (25%)** — Pontos dão retorno às ações e acesso a benefícios, mas valor central de moda depende de o incentivo aumentar uso útil do guarda-roupa.
- **Completude do fluxo: 8,5/10 (20%)** — Extrato/saldo, níveis, concessões e loja estão implementados; há destinos para a moeda interna em vez de pontuação apenas decorativa.
- **Usabilidade e acessibilidade: 7,5/10 (15%)** — O hub mostra saldo, nível e itens acessíveis; entendimento da economia e equivalência de benefícios não foi testado com usuários.
- **Confiabilidade e integridade: 8/10 (15%)** — Ledger, idempotência e tetos diário/semanal reduzem riscos de crédito duplicado no desenho; nenhuma corrida ou carga foi executada aqui.
- **Segurança e privacidade: 8/10 (15%)** — Operações de compra/concessão verificam saldo, estado e limites; fraude e configuração de regras ainda requerem teste específico.
- **Integração e continuidade: 8,5/10 (10%)** — Atividades de criação, jogos, desafios e lojas compartilham progressão, como demonstrado por FaiPointsService e PointsHub.

Pontos fortes:

- Ledger, idempotência e limites de concessão são controles técnicos relevantes para evitar crédito duplicado.
- A progressão tem integração com atividades e loja, em vez de pontuação isolada sem destino.

Lacunas/limites:

- O saldo representa moeda interna; não deve ser interpretado como dinheiro, reputação comercial ou sustentabilidade sem regras explícitas.
- Equilíbrio de concessão/gasto e efeito sobre comportamento de consumo não podem ser comprovados por inspeção estática; exigem indicadores de economia e abuso.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/service/FaiPointsService.java:108](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/FaiPointsService.java#L108>) — Award verifica idempotência e tetos diário/semanal; operações de compra/resgate usam saldo e requisitos de nível.
- [components/points/hub.tsx:18](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/points/hub.tsx#L18>) — Hub integra saldo, nível, itens disponíveis/acessíveis e notificações em modos navegáveis.

### SOC08 — FLAIR e jogos de moda · 7,2/10

Transformar peças e looks em cartas, decks, combinações e experiências de jogo.

Área:Social, gamificação e varejo. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 6,5/10 (25%)** — Cartas e jogos usam o acervo de moda, mas apoio à decisão de vestir/comprar é menos direto; a nota não nega valor de entretenimento.
- **Completude do fluxo: 8/10 (20%)** — Há cartas, decks, quests, arena e combinações; existência de muitos modos não comprova qualidade equivalente de cada jornada.
- **Usabilidade e acessibilidade: 6,5/10 (15%)** — O hub consolida muitos subsistemas e opções, elevando a necessidade de validação de orientação e descoberta por iniciantes.
- **Confiabilidade e integridade: 7/10 (15%)** — Consolidação depende de várias respostas API e disponibilidade por modo; não foi medida tolerância de rede, latência ou equilíbrio do jogo.
- **Segurança e privacidade: 7,5/10 (15%)** — Fluxos são por usuário e operações de jogo possuem serviços próprios; não foram executados testes de exploração da economia.
- **Integração e continuidade: 8,5/10 (10%)** — Peças/looks viram cartas e alimentam desafios, moedas e benefícios, uma conexão temática explícita no código.

Pontos fortes:

- Há ligação funcional com roupas, esquemas e economia do aplicativo; o jogo não é um módulo completamente externo à temática.
- A arquitetura de hubs diferencia disponibilidade e caminhos de jogo.

Lacunas/limites:

- O impacto sobre decisão de vestir/comprar é indireto; jogos devem justificar seu custo de manutenção por retenção e retorno às funções de moda.
- O hub depende de várias respostas para compor estado; a leitura estática não demonstra tempo até interação, tolerância sob rede ruim ou equilíbrio das experiências.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/service/FlairService.java:240](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/FlairService.java#L240>) — Cartas e decks derivam do guarda-roupa, com fluxos próprios de quests, duelo e arena.
- [components/flair/hub.tsx:21](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/flair/hub.tsx#L21>) — Hub consulta múltiplos sistemas de cartas/decks/momentos/missões/moedas e consolida disponibilidade.

### SOC09 — Cupons e benefícios de marcas · 7,9/10

Detectar direitos de cupom, emitir/resgatar e acompanhar utilização e expiração.

Área:Social, gamificação e varejo. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 8/10 (25%)** — Cupons conectam participação e marcas à intenção de compra, com valor comercial plausível que ainda precisa de mensuração incremental.
- **Completude do fluxo: 8/10 (20%)** — O fluxo oferece direito, emissão, resgate, dispensa e expiração; conciliação com checkout externo não está comprovada na análise.
- **Usabilidade e acessibilidade: 7,5/10 (15%)** — MyCoupons traz filtros por estado e confirmação/retry; clareza das regras e aceitação no estabelecimento dependem de pesquisa de uso.
- **Confiabilidade e integridade: 7,5/10 (15%)** — Transações e rejeição de direito já decidido reduzem inconsistência; aceitação/baixa externa não foi testada.
- **Segurança e privacidade: 8/10 (15%)** — ownRight e validações de expiração/estado estabelecem escopo por usuário, sem constituir garantia de integração antifraude ponta a ponta.
- **Integração e continuidade: 8/10 (10%)** — Selos e FLAIR alimentam direitos de cupom numa UI comum, reduzindo fragmentação entre recompensas e varejo.

Pontos fortes:

- Estados de direito e cupom são separados, possibilitando rastreabilidade de concessão e uso.
- Caminhos de marca/celebridade e recompensas já convergem para uma superfície de benefícios.

Lacunas/limites:

- Ter um cupom emitido no app não comprova que o checkout externo da marca aceitou e conciliou o benefício; essa fronteira precisa de validação com o varejista.
- Métricas de retorno incremental e abusos em campanhas não aparecem como resultado validado nesta análise; devem ser avaliadas antes de prometer ganho de vendas.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/service/CouponService.java:213](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/CouponService.java#L213>) — Resgate exige direito do usuário ainda pendente, vincula cupom emitido e muda estado; validação trata expiração.
- [components/coupons/my-coupons.tsx:16](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/coupons/my-coupons.tsx#L16>) — UI oferece filtros por emitido/usado/expirado, loading/erro/retry e fluxo de confirmação.

### SOC10 — Loja de produtos físicos com FAI Points · 7,8/10

Marcas/celebridades aprovadas oferecem produtos físicos, com resgate, estoque, endereço e envio.

Área:Social, gamificação e varejo. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 8,5/10 (25%)** — Resgate de roupa física com envio é ligação direta com varejo; a utilidade depende de selecionar corretamente a variante.
- **Completude do fluxo: 6,5/10 (20%)** — Compra, estoque e envio existem, porém OrderForm recebe somente endereço e não há fluxo de retorno/estorno no serviço consultado.
- **Usabilidade e acessibilidade: 7,5/10 (15%)** — UI apresenta saldo, nível e endereço com estados de erro, mas não oferece seleção de SKU/tamanho no contrato analisado.
- **Confiabilidade e integridade: 8/10 (15%)** — Travas de estoque/donos e chave idempotente são controles claros de concorrência; não houve execução de carga ou pedidos reais.
- **Segurança e privacidade: 8/10 (15%)** — Vendedores devem ser aprovados, dados de estoque são filtrados e o serviço impede compra própria; privacidade logística não foi auditada integralmente.
- **Integração e continuidade: 8,5/10 (10%)** — Catálogo, emissores, saldo, resgate e acompanhamento de envio participam de uma jornada comercial existente.

Pontos fortes:

- Existe fluxo concreto de produto físico, e não apenas vitrine: débito/crédito, estoque e acompanhamento de envio estão presentes.
- Controles de concorrência e idempotência protegem contra repetição de compra e estoque negativo no caminho examinado.

Lacunas/limites:

- ListingForm possui productId e OrderForm somente endereço; esse contrato não permite escolher/reservar SKU de cor/tamanho, lacuna importante para vestuário.
- O serviço examinado cobre envio/entrega, mas não expõe fluxo de troca/devolução/estorno; não é uma comprovação de pós-venda completo.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/service/PhysicalStoreService.java:176](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/PhysicalStoreService.java#L176>) — Compra trava donos e estoque, verifica saldo/nível, rejeita compra própria e reaproveita request idempotente.
- [components/points/physical-store.tsx:49](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/components/points/physical-store.tsx#L49>) — Checkout envia endereço com chave idempotente; mostra disponibilidade, requisito de nível e saldo.

### SOC11 — Conta, consentimentos e controle de dados · 8,1/10

Gerir privacidade, dados sensíveis, consentimentos, exportação e exclusão da conta.

Área:Social, gamificação e varejo. Confiança:média (inspeção estática).

- **Utilidade para moda/varejo: 8,5/10 (25%)** — Controle de fotos, dados e consentimentos sustenta confiança em recursos de corpo/3D e relacionamento comercial, sem equivaler a validação jurídica.
- **Completude do fluxo: 8/10 (20%)** — Consentimento, revogação, exportação e exclusão com carência aparecem no serviço; eliminação em todos os provedores não foi testada.
- **Usabilidade e acessibilidade: 7/10 (15%)** — Finalidades são nomeadas e auditadas, porém compreensão do consentimento e facilidade de exclusão precisam de tarefas observadas.
- **Confiabilidade e integridade: 8/10 (15%)** — Política versionada e auditoria favorecem rastreabilidade; falhas de provedor e consistência da limpeza total não foram exercitadas.
- **Segurança e privacidade: 8,5/10 (15%)** — Cifragem, hash do e-mail e autorização por usuário são evidências concretas; não se alega conformidade LGPD certificada ou pentest.
- **Integração e continuidade: 8/10 (10%)** — Preferências/consentimentos, identidade e limpeza de dados se conectam a vários módulos, algo essencial às fotos e recomendações de moda.

Pontos fortes:

- Há mecanismos concretos de consentimento por finalidade, revogação e controle de acesso ao dado, úteis em um app com fotos e medidas corporais.
- Cifragem e separação do hash do e-mail evitam tratar dado sensível como texto aberto na entidade.

Lacunas/limites:

- Controles declarados não equivalem a certificação LGPD, pentest ou prova de eliminação em todos os provedores externos; essas verificações estão fora deste levantamento.
- O usuário precisa compreender quais dados alimentam recomendação/3D/marketing; usabilidade de consentimento e de exclusão deve ser validada com linguagem e tarefas reais.

Evidências:

- [fai-application/src/main/java/br/com/fashionai/application/service/AccountService.java:385](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-application/src/main/java/br/com/fashionai/application/service/AccountService.java#L385>) — Concessão/revogação por finalidade, versão de política, auditoria; exportação e exclusão possuem operações próprias.
- [fai-domain/src/main/java/br/com/fashionai/domain/model/User.java:35](<https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/6bd645813426978634b7678ac7765ee89f8caea3/fai-domain/src/main/java/br/com/fashionai/domain/model/User.java#L35>) — Campos sensíveis usam conversor de cifragem e e-mail possui hash para unicidade/busca.

## Como transformar parecer em evidência empírica

- Teste com tarefas reais e perfis distintos: comprador, usuário de guarda-roupa, designer, marca e pessoa com necessidade funcional de vestir. Amostra/piloto deve ser dimensionado conforme hipótese; não há amostra validada aqui.
- Medir conclusão de tarefa, erros, desistência, tempo, compreensão de procedência e de confiança do tamanho; comparar variantes de UI de forma controlada.
- Executar teclado/foco/leitor de tela/contraste/zoom e celular; só então avaliar conformidade de critérios WCAG específicos.
- Medir p95 de busca/carregamento/geração e testar concorrência/idempotência/rollback; não confundir especificação de teste com aprovação.
- Validar tamanho e aparência com peças/medidas e fotos autorizadas, sem inferir conforto ou precisão metrológica da aparência do avatar.
- Em pilotos de varejo, acompanhar ruptura, reservas confirmadas, conversão, devolução, custo de retrabalho e satisfação, com consentimento/minimização. Qualquer melhoria causal exige comparação adequada; não há previsão de percentual neste relatório.

## Entrega e limites de autoria

Nenhum código de produto foi alterado e não foram feitos commit, PR, Trello, deploy ou chamadas pagas. Dados brutos estruturados, notas e candidatos estão em pesquisa.json. Os IDs de pesquisa não substituem os RFs oficiais. O snapshot poderá divergir de produção e de commits posteriores; novas evidências podem alterar notas.
