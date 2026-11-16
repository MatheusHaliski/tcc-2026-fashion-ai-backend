# Guia único dos 20 exercícios — FashionAI

Atualização de 15/11/2026. Este documento reúne os roteiros didáticos dos 20 exercícios em um só arquivo, com orientações para o ambiente local preparado para a apresentação. Os roteiros individuais foram escritos para a revisão `9f5512a77`: são **propostas de implementação**, não comprovação de que todas as telas, gravações ou testes estão prontos no código atual. Confira os nomes e contratos no código antes de alterar. As correções para os exercícios 4 e 5 aparecem antes dos respectivos roteiros históricos.

## Antes de começar: ambiente seguro

- O MySQL `fashionai-demo-mysql` tem volume persistente local, sem dados reais copiados, e está disponível somente em `127.0.0.1:13316`; o schema é `fashionai_demo`.
- Na preparação anterior, a API foi iniciada na porta `8080` com ambiente limpo, mídia local e sem carregar o `.env` de produção. O Flyway aplicou 104 migrations, até a V105, apenas nesse banco local. O estado atual deve ser verificado novamente: um processo ou JAR mais antigo pode ocupar a porta, e carregar as opções não comprova que a escolha seja gravada.
- O banco de demonstração começa sem as contas e os dados de produção. Não use credenciais reais. Prepare uma conta e registros fictícios e teste as telas antes da apresentação. O JWT de desenvolvimento usa chaves temporárias: sessões podem precisar de novo login após reiniciar a API.
- Não rode nenhum comando SQL deste documento no banco de produção. Não use `flyway clean`, `repair` ou edite migrations existentes. Os SQLs dos roteiros são propostas históricas, não comandos para executar em bloco: podem conter DDL já aplicada, `UPDATE` e variáveis `@...` que exigem adaptação.

### Comandos iniciais no Terminal do macOS

1. Entre na pasta do projeto:

```bash
cd /Users/matheushaliski/fashionai-final-tcc/tcc-2026-fashion-ai-backend
```

2. Confira se a API já está ativa e se as origens carregam:

```bash
curl --noproxy '*' -i http://127.0.0.1:8080/actuator/health
curl --noproxy '*' -i http://127.0.0.1:8080/api/origens
```

3. Somente se o MySQL de demonstração estiver parado, inicie-o. O comando usa o socket local do Docker Desktop e não cria nem remove volumes:

```bash
docker --host "unix://$HOME/.docker/run/docker.sock" start fashionai-demo-mysql
```

4. Se modificar o backend, gere o JAR com ambiente limpo. O `-o` exige que as dependências já estejam no cache; caso falte alguma, peça ajuda antes de trocar para outro ambiente:

```bash
env -i HOME="$HOME" PATH=/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/mvn -o -pl fai-bootstrap -am -DskipTests package
```

5. Se nenhuma API estiver ocupando a porta 8080, informe **a chave de criptografia já utilizada pelo banco de teste** no terminal, sem exibi-la, e inicie a API. Não use a chave de produção. Se não souber qual chave foi usada em dados existentes, não gere outra: recupere a chave correta antes de continuar.

```bash
lsof -nP -iTCP:8080 -sTCP:LISTEN
printf 'Chave Base64 do banco de teste (entrada oculta): '
read -rs DATA_ENCRYPTION_KEY
printf '\n'
export DATA_ENCRYPTION_KEY
bash scripts/demo/start-local-api.sh
```

Se a porta estiver ocupada, **não inicie uma segunda API nem encerre um processo desconhecido**. Confira qual processo está rodando. O script não inicia o container: execute o passo 3 se necessário. Ele aponta explicitamente para `fashionai_demo`, não lê o `.env` e recebe a chave apenas da variável de ambiente informada no terminal. Mantenha essa chave segura e disponível para reinicializações; uma chave diferente não decifra os dados anteriores.

Se o cadastro apresentar `DATA_ENCRYPTION_KEY must be a base64 encoded 32-byte AES key`, confirme que a variável foi exportada no mesmo terminal e repita a inicialização com a chave correta. O script rejeita chave ausente ou em formato inválido sem exibir seu conteúdo. Ajustar o `.env` sozinho não altera um processo já iniciado nem fornece a variável a esse script.

6. Acesse `http://localhost:3000` se o frontend local já estiver em execução e verifique em Rede/Network que ele está chamando `http://localhost:8080`. Reiniciar o frontend com o `.env` existente pode carregar configurações de produção: confira a configuração antes de fazê-lo.

7. Para abrir um cliente MySQL no **container local de demonstração**, sem imprimir a senha:

```bash
MYSQL_PWD="$(cat data/fashionai-demo/config/spring.datasource.password)" docker --host "unix://$HOME/.docker/run/docker.sock" exec -it -e MYSQL_PWD fashionai-demo-mysql mysql -u fashionai_demo fashionai_demo
```

Dentro do prompt `mysql>`, confirme o alvo e inspecione, apenas lendo:

```sql
SELECT DATABASE();
SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 10;
SELECT codigo, nome, ativo FROM origem ORDER BY codigo;
EXIT;
```

O resultado de `DATABASE()` deve ser `fashionai_demo`. `EXIT;` sai do MySQL; não digite esses comandos SQL no terminal comum. Proteja os arquivos locais de senha e não os compartilhe.

### Ciclo de trabalho para cada exercício

1. Leia o enunciado, a seção correspondente e os arquivos citados; prefira os caminhos locais ao número de linha fixado na revisão antiga.
2. Inspecione migrations SQL **e Java** já existentes. Se for preciso alterar o schema, escolha uma versão ainda livre e escreva uma migration **nova**; nunca execute diretamente os exemplos históricos nem reaplique V1–V105. Uma migration bem-sucedida torna-se imutável, inclusive no banco de demonstração.
3. Atualize entidade/repository, DTO/service/controller, cliente e telas, quando a funcionalidade ainda não existir. Preserve autorização, transações, dados legados e os limites de linhas em `docs/refactoring/LINE_RULES.md`.
4. Teste o envio válido, a releitura após recarregar e a segunda tela; teste valor inválido, ausência de login, acesso por outro usuário e dados antigos. Registre duas capturas reais: origem e leitura posterior.
5. Execute os testes específicos criados para a alteração. Comandos gerais a partir da raiz:

```bash
npm run typecheck
npm run test -- <caminho-do-teste-front>
env -i HOME="$HOME" PATH=/opt/homebrew/bin:/usr/bin:/bin /opt/homebrew/bin/mvn -o -pl fai-web,fai-infrastructure/persistence-mysql -am -Dtest=NomeDoTeste -Dsurefire.failIfNoSpecifiedTests=false test
python3 -m scripts.refactoring.line_ratchet
```

Substitua `<caminho-do-teste-front>` e `NomeDoTeste` por testes reais; não digite os marcadores literalmente. A opção Maven permite que módulos sem o teste passem; confira que o relatório indica a execução do teste esperado. Estes comandos não substituem o teste real de persistência no MySQL. Não faça alterações em 20 exercícios ao mesmo tempo: termine e valide um antes de começar o seguinte.

### Como ler os roteiros históricos abaixo

Os exemplos de JSON podem ser apenas recortes, não requisições HTTP completas; IDs devem ser obtidos do próprio ambiente de teste. URLs, tabelas, versões, métodos e testes descritos como propostas não devem ser tratados como já existentes. Alguns exemplos incluem SQL de laboratório sem validação integral no estado atual. A entrega de cada exercício exige adaptar e implementar esses trechos, não apenas copiá-los. Em particular, não substitua a API e a autorização por um `UPDATE` manual para declarar um exercício concluído.

# Exercício 01 — TipoLook no espelho e no detalhe do look

**Situação na revisão `9f5512a77`:** Base implementada para espelho → look; o builder manual ainda tem contrato distinto.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema.** Reutilizar [V60__tipo_look_no_espelho.sql:3](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V60__tipo_look_no_espelho.sql#L3). Já existem `TipoLook`, `mirror_states.tipo_look_id` e `schemes.tipo_look_id`. Não criar outra tabela `tipos_look`.

2. **Entidades/DTO de leitura.** Conferir [Scheme.java:43](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/Scheme.java#L43) e [Views.java:206](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/view/Views.java#L206). O espelho deve copiar a referência ao salvar, não converter o nome em texto.

3. **Repository.** Reutilizar [TipoLookRepository.java:8](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/TipoLookRepository.java#L8) e `findAllByOrderByNomeAsc`; `findById` resolve o UUID. `SchemeRepository` e o repository do espelho já persistem a relação; nenhuma query nova é necessária para este exercício.

4. **Service.** Em [MirrorService.java:332](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/MirrorService.java#L332), manter resolução do ID e estado do usuário. Em [MirrorService.java:1166](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/MirrorService.java#L1166), manter a cópia para o look salvo. Não inferir gênero da pessoa a partir desse campo. Para ampliar ao cadastro manual, acrescentar `tipoLookId`/clear explícito ao `SchemeForm` em [SchemeService.java:417](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SchemeService.java#L417) e extrair um `SchemeLookTypeWriter`; esse complemento não é requisito para duplicar o fluxo do espelho.

5. **Controller.** Reutilizar [TipoLookController.java:12](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/TipoLookController.java#L12) para opções e [MirrorController.java:30](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/MirrorController.java#L30) para `PUT /api/me/mirror/tipo-look`. O detalhe usa o `SchemeController` existente em [SchemeController.java:29](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/SchemeController.java#L29).

6. **Tela.** Em [mirror-controls.tsx:161](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/mirror/mirror-controls.tsx#L161), manter GET de opções e seleção deliberada; em [scheme-card.tsx:266](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/scheme-card.tsx#L266), mostrar o valor retornado após GET. Desabilitar a seleção durante envio e conservar o valor quando uma gravação falhar. Se estender ao builder, inicializar/serializar o ID em [scheme-builder.tsx:71](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/scheme-builder.tsx#L71) sem substituir referências existentes por null silenciosamente.

## Arquivos novos propostos e ponto de inserção

Nenhum arquivo de produção novo é obrigatório para a solução base descrita; reutilizar os pontos de edição/revisão numerados acima. Novos testes podem ser adicionados na responsabilidade correspondente.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](solucoes/sql/01-tipo-look.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SHOW CREATE TABLE TipoLook;
SELECT id,codigo,nome FROM TipoLook ORDER BY nome;
SELECT s.id,s.tipo_look_id,t.codigo,t.nome
FROM schemes s LEFT JOIN TipoLook t ON t.id=s.tipo_look_id
WHERE s.id=@scheme_id;
SELECT m.user_id,m.tipo_look_id FROM mirror_states m WHERE m.user_id=@owner_id;
```

## Integridade referencial: restrições e alternativas

A V60 não declara ON DELETE/UPDATE: no InnoDB a referência impede apagar ou trocar o ID de uma opção em uso (RESTRICT/NO ACTION). Alterar `nome` não viola a FK; trocar `codigo` pode quebrar contratos mesmo preservando o UUID. Alternativas: manter o UUID, corrigir apenas o nome; acrescentar `ativo` em migration futura e retirar a opção somente de novas seleções; ou migrar referências com decisão explícita. Apagar e recriar a tabela perde a continuidade e não é solução. Registros antigos com NULL continuam sem escolha.

## Contrato HTTP

Existente: `GET /api/tipos-look`; `PUT /api/me/mirror/tipo-look` com `{"tipoLookId":"<id da opção>"}`; salvar o look pela ação já usada no espelho e reler seu detalhe.

Resposta/projeção a conferir: `"tipoLook": {"id":"...","codigo":"UNISEX","nome":"Unisex"}`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Verificar as três opções; UUID inexistente; acesso sem sessão; isolamento entre usuários; look antigo com NULL. Em banco de teste, tentar DELETE de TipoLook referenciado deve falhar com1451. Corrigir o nome deve refletir na leitura sem mudar o ID.

- **E1 a produzir:** Seleção no espelho com a opção da API.
- **E2 a produzir:** Look salvo, página recarregada, TipoLook no detalhe.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.
# Exercício 02 — Estado de conservação da peça

**Situação na revisão `9f5512a77`:** FK, opções, service e formulário já implementados; reutilizar a estrutura existente.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema.** Usar [V77__wardrobe_conservation_and_wash_references.sql:3](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V77__wardrobe_conservation_and_wash_references.sql#L3) e [V83__conservation_options.sql:3](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V83__conservation_options.sql#L3) para `ativo` e opções iniciais; não criar `estados_conservacao` ou `estado_conservacao_id`. Os nomes reais são `EstadoConservacao` e `wardrobe_items.estado_de_conservacao`.

2. **Entidades/DTO.** Reutilizar [EstadoConservacao.java:16](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/EstadoConservacao.java#L16) e [WardrobeItem.java:167](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/WardrobeItem.java#L167). `item_condition` continua legado. No contrato [WardrobeService.java:337](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/WardrobeService.java#L337), manter `estadoConservacaoId` e `clearEstadoConservacao`; limpar é uma ação explícita.

3. **Repository.** Reutilizar [EstadoConservacaoRepository.java:9](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/EstadoConservacaoRepository.java#L9) e a consulta de opções ativas. Não eliminar a possibilidade de carregar por ID uma referência antiga inativa.

4. **Service.** Preservar a semântica em [PieceConservationService.java:21](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/PieceConservationService.java#L21): ID omitido mantém; clear limpa; ID igual ao salvo permanece mesmo inativo; escolha nova exige opção ativa. A chamada está em [PieceFormWriter.java:77](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/PieceFormWriter.java#L77), após autorização do dono no WardrobeService.

5. **Controller.** Já há alias `GET /api/opcoes/estados-conservacao` em [PieceReferenceController.java:24](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/PieceReferenceController.java#L24); a edição passa pelo `PUT /api/pieces/{id}` em [WardrobeController.java:99](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/WardrobeController.java#L99). Sem endpoint novo para editar o catálogo pelo proprietário da peça.

6. **Tela/leitura.** Reutilizar [piece-conservation-field.tsx:9](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/piece-conservation-field.tsx#L9) e [piece-form.tsx:124](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/piece-form.tsx#L124); a edição do modal inicializa o ID em [expanded-piece.tsx:107](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/expanded-card/expanded-piece.tsx#L107). [piece-card-panels.tsx:47](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/piece-card-panels.tsx#L47) mostra a conservação no card. Manter loading, erro/retry, nenhuma seleção e valor salvo indisponível.

## Arquivos novos propostos e ponto de inserção

Nenhum arquivo de produção novo é obrigatório para a solução base descrita; reutilizar os pontos de edição/revisão numerados acima. Novos testes podem ser adicionados na responsabilidade correspondente.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](solucoes/sql/02-conservacao.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SHOW CREATE TABLE `EstadoConservacao`;
SHOW CREATE TABLE wardrobe_items;
SELECT id,codigo,nome,ativo FROM `EstadoConservacao` ORDER BY nome;
SELECT w.id,w.item_condition,w.estado_de_conservacao,e.codigo,e.nome
FROM wardrobe_items w LEFT JOIN `EstadoConservacao` e ON e.id=w.estado_de_conservacao
WHERE w.id=@piece_id AND w.user_id=@owner_id;
-- Alternativa administrativa em laboratório: desativar, sem remover referências.
UPDATE `EstadoConservacao` SET ativo=FALSE,updated_at=CURRENT_TIMESTAMP(6) WHERE id=@option_id;
```

## Integridade referencial: restrições e alternativas

A V77 define ON DELETE SET NULL / ON UPDATE CASCADE. Excluir a opção apaga a referência da peça, embora não apague a peça; mudar o UUID propaga à FK, mas pode invalidar links/caches. Prefira `ativo=FALSE` e IDs estáveis. `codigo` é UNIQUE: não pode duplicar um código. O catálogo pode já ter opções cadastradas manualmente: preservar IDs e nomes, e não preencher todos os legados com BOA, pois GOOD pode ter sido apenas default do código. Reativar uma opção ou mapear referências após análise são alternativas à exclusão.

## Contrato HTTP

Existente: `PUT /api/pieces/{id}`, campos relevantes `{"estadoConservacaoId":"<UUID>","clearEstadoConservacao":false}`; para limpar, ID null e clear true. O GET do detalhe deve devolver a referência.

Resposta/projeção a conferir: `"estadoConservacao": {"id":"...","codigo":"BOA","nome":"Boa"}`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Testar cada opção realmente cadastrada; UUID inexistente; ID inativo novo rejeitado; referência inativa inalterada aceita ao editar nome; limpar; peça alheia; legado sem escolha. Conferir conservação no card e modal, sem expor fallback GOOD como escolha informada.

- **E1 a produzir:** Editar peça escolhendo opção real.
- **E2 a produzir:** Card e modal recarregados com o mesmo ID/nome.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.

# Exercício 03 — Instrução de lavagem

**Situação na revisão `9f5512a77`:** Tabela, FK, repository, API de opções e leitura existem; escrita estruturada ainda precisa ser integrada.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema/modelo.** Reutilizar [V77__wardrobe_conservation_and_wash_references.sql:13](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V77__wardrobe_conservation_and_wash_references.sql#L13) e [WardrobeItem.java:172](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/WardrobeItem.java#L172). A coluna é `tipo_lavagem_id`, não o texto `care_instructions`.

2. **DTO.** Em [WardrobeService.java:337](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/WardrobeService.java#L337), acrescentar `UUID tipoLavagemId` e `Boolean clearTipoLavagem`. Atualizar todos os construtores auxiliares e os pontos `new PieceForm(...)`, inclusive `PieceTaxonomyWriter`, preservando campos omitidos em clientes antigos. `Views` já devolve a referência em [Views.java:118](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/view/Views.java#L118).

3. **Repository/service específico.** Reutilizar [TipoLavagemRepository.java:9](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/TipoLavagemRepository.java#L9); criar `PieceWashService` que resolve `findById`, aplica o ID ou clear e não converte texto livre em opção. Inserção sugerida: **NOVO** `fai-application/src/main/java/br/com/fashionai/application/service/PieceWashService.java`, iniciar na linha 1 (arquivo proposto, ainda não criado). O service não deve validar dono a partir de um ID anterior enviado pelo cliente.

4. **Service orquestrador.** Em [PieceFormWriter.java:77](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/PieceFormWriter.java#L77), delegar também a lavagem depois da autorização existente; manter `careInstructions` independente. Em [PieceTaxonomyWriter.java:89](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/PieceTaxonomyWriter.java#L89), transportar os novos campos nas reconstruções do formulário.

5. **Controller.** Usar `GET /api/tipos-lavagem` em [PieceReferenceController.java:31](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/PieceReferenceController.java#L31) e edição existente em [WardrobeController.java:99](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/WardrobeController.java#L99). Não conceder CRUD das opções ao usuário comum.

6. **Tela/leitura.** Acrescentar os campos de estado e payload em [piece-form.tsx:14](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/piece-form.tsx#L14); extrair um `PieceWashField` com GET de opções. Inicializar o ID ao editar em [expanded-piece.tsx:107](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/expanded-card/expanded-piece.tsx#L107); mostrar `tipoLavagem.nome` no detalhe e manter o texto complementar. Tratar loading, erro/retry e opção salva ausente sem limpá-la.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-application/src/main/java/br/com/fashionai/application/service/PieceWashService.java`.
- `components/piece-wash-field.tsx`.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](solucoes/sql/03-lavagem.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SHOW CREATE TABLE `TipoLavagem`;
SELECT id,codigo,nome FROM `TipoLavagem` ORDER BY nome;
SELECT w.id,w.tipo_lavagem_id,t.codigo,t.nome,w.care_instructions
FROM wardrobe_items w LEFT JOIN `TipoLavagem` t ON t.id=w.tipo_lavagem_id
WHERE w.id=@piece_id AND w.user_id=@owner_id;
-- Não é necessária outra coluna nem outra FK para concluir a escrita. A V77 já as prevê.
```

## Integridade referencial: restrições e alternativas

ON DELETE SET NULL / ON UPDATE CASCADE na V77: exclusão perde a classificação da lavagem. `TipoLavagem` não tem `ativo` no modelo atual; para retirada segura de novas seleções, criar uma migration aditiva com `ativo`, filtrar a API e preservar referências inalteradas, como conservação. Alternativas: manter a opção antiga e acrescentar uma nova; ou separar instruções históricas por snapshot. Não substituir todos os `care_instructions` por IDs inferidos nem renomear a tabela em ambiente case-sensitive.

## Contrato HTTP

Proposto no PUT existente: `{"tipoLavagemId":"<UUID>","clearTipoLavagem":false}`. ID omitido preserva; clear true remove a escolha. Opções existentes em `GET /api/tipos-lavagem`.

Resposta/projeção a conferir: `"tipoLavagem": {"id":"...","codigo":"<código cadastrado>","nome":"<nome cadastrado>"}`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Escolha válida; UUID inexistente; clear; clientes antigos sem campo; peça de terceiro; conservação e texto livre preservados. Se adicionar ativo, testar nova escolha inativa rejeitada e ID salvo inalterado aceito. Testar ambos os construtores antigos do DTO e serialização.

- **E1 a produzir:** Formulário de peça com opção de lavagem carregada da API.
- **E2 a produzir:** Detalhe recarregado mostrando a opção e cuidados complementares.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.


> **Atualização importante do exercício 4:** o código atual já tem `IntensidadeTermica`, `IntensidadeTermicaRepository` e a V100, com `intensidade_termica_id` em `schemes` e `wardrobe_items`. Portanto, **não crie** `NivelTermico`, `niveis_termicos` ou outra FK sugeridos no texto histórico. Confira `SchemeService`, o controller de referências e as telas do espelho; complete apenas o fluxo de seleção, persistência e recomendação que faltar. Não execute o DDL histórico do SQL 04.

```bash
rg -n 'intensidadeTermicaId|IntensidadeTermica' fai-domain/src/main/java fai-application/src/main/java fai-web/src/main/java components
curl --noproxy '*' -i http://127.0.0.1:8080/api/intensidades-termicas
```

# Exercício 04 — Intensidade térmica do look

**Situação na revisão `9f5512a77`:** Proposta: não foi localizada entidade NivelTermico; estação não substitui intensidade térmica.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Migration.** Criar lookup `niveis_termicos` e `schemes.nivel_termico_id NULL` conforme SQL. Reservar uma versão livre, sem editar V60. NULL representa não informado; não inferir intensidade pela estação do look.

2. **Entidade.** **NOVO** `fai-domain/src/main/java/br/com/fashionai/domain/model/NivelTermico.java`, iniciar na linha 1 (arquivo proposto, ainda não criado). Herdar `AuditableEntity`, mapear código/nome/ativo. Em [Scheme.java:75](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/Scheme.java#L75), acrescentar relação LAZY com `@JoinColumn(name="nivel_termico_id")`, preferencialmente extraindo o bloco de metadados opcionais se necessário para respeitar a catraca de linhas.

3. **Repository.** **NOVO** `fai-domain/src/main/java/br/com/fashionai/domain/repository/NivelTermicoRepository.java`, iniciar na linha 1 (arquivo proposto, ainda não criado). Usar `JpaRepository<NivelTermico,UUID>`, `findAllByAtivoTrueOrderByNomeAsc` e `findById`; não criar um repository separado para a própria tabela de schemes.

4. **DTO/service.** Em [SchemeService.java:417](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SchemeService.java#L417), acrescentar ID e clear explícito. Extrair `SchemeThermalWriter` e chamá-lo em [SchemeService.java:503](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SchemeService.java#L503), com rejeição de nova opção inativa e preservação da anterior. Nas recomendações de [MirrorService.java:83](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/MirrorService.java#L83), receber critério térmico opcional e usar o código validado como evidência/compatibilidade; não confundir frio ambiental com certificado de tecido.

5. **Controller.** Criar `LookReferenceController` com `GET /api/opcoes/niveis-termicos`; aproveitar criar/editar em [SchemeController.java:29](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/SchemeController.java#L29). Se a recomendação usar esse filtro, acrescentar o ID ao DTO correspondente do [MirrorController.java:17](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/MirrorController.java#L17) e resolver no service.

6. **UI/leitura.** Acrescentar seleção no builder em [scheme-builder.tsx:71](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/scheme-builder.tsx#L71), tipo de leitura em [types.ts:50](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/lib/api/types.ts#L50) junto do SchemeView e projeção em [Views.java:223](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/view/Views.java#L223). Mostrar a intensidade nas recomendações do espelho em [mirror-controls.tsx:143](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/mirror/mirror-controls.tsx#L143). Loading/retry e opção 'Não informado' devem ser distintos de uma intensidade real.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-domain/src/main/java/br/com/fashionai/domain/model/NivelTermico.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/repository/NivelTermicoRepository.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/SchemeThermalWriter.java`.
- `fai-web/src/main/java/br/com/fashionai/web/controller/LookReferenceController.java`.

Se escolher aplicar o DDL faltante, criar na **linha 1** a migration `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V<PROXIMA_VERSAO_LIVRE>__ex04.sql`, substituindo o placeholder por versão realmente livre. O SQL didático não deve ser copiado inteiro sem inspecionar o schema.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](solucoes/sql/04-nivel-termico.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
CREATE TABLE `niveis_termicos` (
  id CHAR(36) NOT NULL PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(80) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
) ENGINE=InnoDB;
INSERT INTO `niveis_termicos` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'LEVE','Leve',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `niveis_termicos` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'MODERADO','Moderado',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `niveis_termicos` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'INTENSO','Intenso',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));

ALTER TABLE schemes ADD COLUMN nivel_termico_id CHAR(36) NULL;
ALTER TABLE schemes ADD CONSTRAINT fk_schemes_nivel_termico
  FOREIGN KEY (nivel_termico_id) REFERENCES niveis_termicos(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
SELECT s.id,n.codigo,n.nome FROM schemes s
LEFT JOIN niveis_termicos n ON n.id=s.nivel_termico_id WHERE s.id=@scheme_id;
```

## Integridade referencial: restrições e alternativas

FK proposta RESTRICT para evitar perder o significado dos looks. Não apagar opção usada; desativar para novas seleções ou migrar cada vínculo com decisão registrada. SET NULL seria uma alternativa somente se a perda da classificação for aceita e o campo continuar nullable. Não usar CASCADE que excluiria looks ao retirar um nível. A FK garante existência, mas atividade e propriedade do look são regras do service.

## Contrato HTTP

Novo `GET /api/opcoes/niveis-termicos`; recorte do POST/PUT de look `{"nivelTermicoId":"<UUID>","clearNivelTermico":false}`.

Resposta/projeção a conferir: `"nivelTermico": {"id":"...","codigo":"MODERADO","nome":"Moderado"}`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

ID válido/inválido/inativo, omissão versus clear, dono errado, recomendações com e sem filtro e look legado NULL. No laboratório, DELETE do nível referenciado falha; desativar não quebra a leitura antiga.

- **E1 a produzir:** Builder com intensidade explicitamente escolhida.
- **E2 a produzir:** Espelho recarregado mostrando a intensidade da recomendação.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.


> **Atualização importante do exercício 5:** V103 e V105 criam a tabela `origem`, a FK `wardrobe_items.origem_id` e suas opções no banco de demonstração em que foram aplicadas. O formulário envia `origemId`, mas na inspeção anterior não foi encontrada sua resolução em `WardrobeService.PieceForm` nem um mapeamento JPA correspondente em `WardrobeItem`; confira o código atual, pois ele pode ter mudado. Como a API pode ignorar propriedades desconhecidas, receber sucesso ao salvar **não prova** que a origem foi persistida. O roteiro antigo baseado apenas em `piece_origin` não satisfaz automaticamente a FK nova. Não crie outra tabela nem use o `UPDATE` histórico como substituto da gravação pelo serviço.

Passos atuais: (1) mapear a relação nullable com `origem_id` em `WardrobeItem`; (2) incluir `origemId` no DTO de entrada, com semântica clara para não informar e limpar, preservando construtores/chamadas existentes; (3) resolver o ID com `OrigemRepository` no fluxo de criação/edição e rejeitar IDs inexistentes; (4) expor ID e nome na projeção de leitura sem quebrar o contrato legado `piece_origin`; (5) restaurar a seleção na edição e exibi-la no histórico de uso; (6) testar usuário não autorizado, ID inexistente, opção não informada, gravação e releitura após reload. Não são alterações já implementadas.

```bash
rg -n 'origemId|pieceOrigin|origem_id|OrigemRepository' fai-domain/src/main/java fai-application/src/main/java fai-web/src/main/java components
curl --noproxy '*' -i http://127.0.0.1:8080/api/origens
```

## Diagnóstico: campo Origem bloqueado ou erro 401

O campo em `components/piece-origem-field.tsx` só é habilitado quando `GET /api/origens` retorna com sucesso uma lista não vazia. Enquanto carrega, quando a requisição falha ou quando a lista está vazia, ele permanece desabilitado. A seleção usa o **ID da opção**, não o nome exibido.

**Situação observada em 16/11/2026:** a API na porta 8080 respondeu `UP` ao health check, mas o acesso **sem autenticação** a `/api/origens` retornou `401 NAO_AUTENTICADO`. Isso não demonstra, por si só, que a chamada autenticada do navegador também falhe nem identifica qual JAR está rodando. A correção está no código-fonte local, mas ainda precisa ser confirmada na API em execução:

1. No frontend, `components/piece-origem-field.tsx` chama `api.get("/api/origens", ...)` **sem** `anonymous: true`; assim, `lib/api/client.ts` pode incluir o token da sessão e tentar renová-lo. Confira sem imprimir ou compartilhar tokens:

   ```bash
   rg -n 'api.get<ReferenceOption|anonymous' components/piece-origem-field.tsx
   ```

2. No backend, a alteração local em `fai-web/src/main/java/br/com/fashionai/web/config/SecurityConfig.java` inclui `/api/origens` na lista `PUBLIC_GET`, permitindo o **GET** público. Isso não libera outras operações ou dados protegidos. Confira:

   ```bash
   rg -n 'PUBLIC_GET|/api/origens' fai-web/src/main/java/br/com/fashionai/web/config/SecurityConfig.java
   ```

3. Na aba **Rede/Network** do navegador, após entrar com uma conta de teste e recarregar a tela, encontre `GET /api/origens`. Confira a URL, o status e, sem revelar seu conteúdo, se o cabeçalho `Authorization` está presente. Um token inválido também pode causar 401 mesmo em rota pública; saia e entre novamente com a conta de teste. Não copie tokens, cookies ou segredos para o guia, logs ou chat.

4. Compare a API em execução com o código-fonte:

   ```bash
   lsof -nP -iTCP:8080 -sTCP:LISTEN
   curl --noproxy '*' -i http://127.0.0.1:8080/actuator/health
   curl --noproxy '*' -i http://127.0.0.1:8080/api/origens
   ```

   O segundo `curl` não envia token: um `401` significa somente que **essa chamada anônima** não foi autorizada. Se o código local libera o GET, isso pode indicar JAR antigo ou outra configuração/processo; não garante que o navegador esteja usando o mesmo servidor. Identifique o processo e seu ambiente antes de pará-lo; não encerre processo desconhecido ou de produção.

5. Se o processo for a API de demonstração e for seguro reiniciá-la, pare-a no terminal em que foi iniciada com `Ctrl+C`. Gere o JAR e inicie a API conforme os passos 3–5 de **Comandos iniciais**, somente após conferir que o alvo é o banco de teste. O script de demonstração exige o container local e o arquivo de senha já preparados; não usa o `.env` de produção. Compilar não substitui automaticamente o JAR do processo que já está rodando.

6. Repita o `curl` sem token: com a alteração pública efetivamente carregada, espera-se `200` e uma lista JSON de opções. No navegador, use **Tentar de novo** ou recarregue a página. Se retornar `200` com `[]`, confira os dados do banco de teste com o `SELECT` da seção inicial; se retornar `500`, consulte os logs locais sem compartilhar segredos. Se der conexão recusada, a API não está acessível no endereço consultado.

7. Selecione uma opção, salve uma peça fictícia e reabra-a para verificar a persistência; habilitar o campo não prova que o backend salvou `origemId`. Para validar o componente isoladamente:

   ```bash
   npm test -- components/piece-origem-field.test.tsx
   ```

Não aplique migrations manualmente, não use `flyway clean` ou `repair` e não execute comandos de escrita no banco de produção.

# Exercício 05 — Origem adquirida, herdada ou trocada

**Situação na revisão `9f5512a77`:** A coluna piece_origin existe e é lida pelo quarto; falta uma escolha estruturada no formulário comum.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Inventário SQL.** Ler valores reais antes de restringir o domínio; `GARIMPADA` é consumida por regras existentes e `TROCADA` é escrita pelo passaporte. Reutilizar [WardrobeItem.java:321](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/WardrobeItem.java#L321) sem criar outra coluna `origem`.

2. **Enum/DTO.** Criar `PieceOrigin` com os códigos novos e os legados efetivamente usados; não remover códigos históricos. Em [WardrobeService.java:337](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/WardrobeService.java#L337), acrescentar origem opcional; DTO sem campo mantém a anterior. Origem de captura da imagem (`ImageOrigin`) continua separada da aquisição da peça.

3. **Repository.** Reutilizar [WardrobeItemRepository.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/WardrobeItemRepository.java#L19); filtros novos devem receber um código normalizado. Não há FK de opções nesta solução: enum/string validado satisfaz 'opções e origem validada'.

4. **Service.** Extrair `PieceOriginWriter` e delegar em [PieceFormWriter.java:28](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/PieceFormWriter.java#L28). Validar ADQUIRIDA/HERDADA/TROCADA e códigos legados permitidos; desconhecido salvo pode ser preservado sem habilitá-lo como escolha nova. Preservar o fluxo de [ReceivedPassportPiece.java:31](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/passport/ReceivedPassportPiece.java#L31) para transferências reais; seleção manual de TROCADA é declaração, não prova de transferência.

5. **Controller/opções.** Em [PieceReferenceController.java:15](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/PieceReferenceController.java#L15), acrescentar GET de origens (ou controller específico curto). Escrita pelo [WardrobeController.java:99](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/WardrobeController.java#L99); `GET /api/opcoes/origens-peca` deve retornar código/nome, sem IDs se o contrato for enum.

6. **Tela e outra leitura.** Acrescentar escolha e serialização em [piece-form.tsx:14](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/piece-form.tsx#L14). Em [RoomService.java:757](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/RoomService.java#L757), manter a projeção para histórico/tag, e acrescentar ao DTO de detalhe se faltar. Mostrar origem declarada junto ao histórico de uso, com loading/erro e estado não informado.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-domain/src/main/java/br/com/fashionai/domain/model/enums/PieceOrigin.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/PieceOriginWriter.java`.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](solucoes/sql/05-origem-peca.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SELECT piece_origin,COUNT(*) AS quantidade FROM wardrobe_items GROUP BY piece_origin;
SELECT id,user_id,piece_origin FROM wardrobe_items
WHERE id=@piece_id AND user_id=@owner_id;
-- DML didático para banco de teste; a aplicação deve usar o service autorizado.
UPDATE wardrobe_items SET piece_origin='HERDADA',updated_at=CURRENT_TIMESTAMP(6)
WHERE id=@piece_id AND user_id=@owner_id;
-- Não adicionar CHECK de três valores antes de tratar GARIMPADA e todos os legados encontrados.
```

## Integridade referencial: restrições e alternativas

Não foi localizada FK para `piece_origin`: VARCHAR não equivale a integridade referencial. Restrições de proprietário continuam nas relações da peça com users, looks, passaporte e diário. Não excluir/recriar a peça para trocar a origem: há relações com ON DELETE CASCADE que apagariam diário/armazenamento. Alternativa relacional: tabela `OrigensPeca` e FK nullable nova, com migração explícita dos códigos reconhecidos; manter desconhecidos para revisão, sem inventar origem.

## Contrato HTTP

Proposto no PUT existente `{"pieceOrigin":"HERDADA"}`; GET de opções retorna códigos. O histórico mostra a origem declarada separada do histórico verificável do passaporte.

Resposta/projeção a conferir: `"pieceOrigin":"HERDADA"; no histórico/tag existente: "origin":"HERDADA"`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Três escolhas válidas, código inválido, peça alheia, origem omitida em edição antiga, GARIMPADA preservada, TROCADA gerada por transferência mantida. Mudar origem não zera wear_count, diário, selos ou dono.

- **E1 a produzir:** Editar peça selecionando Herdada.
- **E2 a produzir:** Histórico de uso recarregado com origem e eventos anteriores intactos.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.

# Exercício 06 — Estação preferida do look

**Situação na revisão `9f5512a77`:** Base implementada com enum Season persistido como texto; não é necessário criar tabela de estações.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema/modelo.** Conferir [Scheme.java:75](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/Scheme.java#L75) e [Season.java:4](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/enums/Season.java#L4). Códigos reais: SPRING, SUMMER, AUTUMN e WINTER. NULL preserva looks sem escolha; não gravar nomes traduzidos no banco.

2. **DTO.** `SchemeForm` já recebe Season em [SchemeService.java:417](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SchemeService.java#L417); `Views.SchemeView` projeta o nome em [Views.java:250](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/view/Views.java#L250). Nenhum campo duplicado `preferredSeason` é necessário para o enunciado.

3. **Repository/service.** Reutilizar [SchemeRepository.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/SchemeRepository.java#L19). `applyForm` já grava em [SchemeService.java:517](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SchemeService.java#L517). Adicionar query/filtro por estação somente se o Lookbook precisar buscar no servidor; não carregar tudo e filtrar em memória para grandes listas. Ausência versus clear deve respeitar a semântica atual do PUT completo.

4. **Controller.** Reutilizar criar/editar no [SchemeController.java:29](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/SchemeController.java#L29). O Jackson deve rejeitar string fora do enum com 400, sem trocar silenciosamente por SUMMER. Uma rota de opções é opcional aqui, porque o enunciado permite enum.

5. **Tela/leitura.** O estado já inclui season em [scheme-builder.tsx:71](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/scheme-builder.tsx#L71); conferir o envio e a tradução de códigos. Em [lookbook-tabs.tsx:52](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/lookbook-tabs.tsx#L52), exibir/filtrar a estação devolvida pelo GET, não a estação atual do calendário. Mostrar vazio legível para legado e erro sem perder a escolha quando o save falhar.

## Arquivos novos propostos e ponto de inserção

Nenhum arquivo de produção novo é obrigatório para a solução base descrita; reutilizar os pontos de edição/revisão numerados acima. Novos testes podem ser adicionados na responsabilidade correspondente.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](solucoes/sql/06-estacao-look.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SHOW CREATE TABLE schemes;
SELECT season,COUNT(*) AS quantidade FROM schemes GROUP BY season;
SELECT id,title,season FROM schemes WHERE id=@scheme_id;
-- Antes de propor CHECK, revisar todos os valores retornados pela consulta acima.
-- Nenhum ALTER é necessário se o enum já é persistido e validado pelo fluxo atual.
```

## Integridade referencial: restrições e alternativas

Não há FK de estação no modelo: o enum é restrição de aplicação. Um CHECK opcional deve aceitar NULL e exatamente os quatro códigos depois de validar os legados. Remover um valor do enum pode tornar dados antigos ilegíveis mesmo sem erro de FK. Alternativas: manter códigos legados em leitura e bloquear novos usos; ou criar uma tabela de opções com FK aditiva, sem converter textos desconhecidos por heurística. A FK de `scheme_items` continua existindo: não recriar o look para trocar estação.

## Contrato HTTP

Existente: recorte de POST/PUT de look `{"season":"WINTER"}`. Para remover num PUT completo, enviar null de acordo com o contrato do formulário.

Resposta/projeção a conferir: `"season":"WINTER"`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Quatro valores, null, valor traduzido/inválido rejeitado, dono alheio, look antigo. Criar com WINTER, recarregar e filtrar o Lookbook por WINTER sem usar a estação do dispositivo.

- **E1 a produzir:** Builder com Inverno escolhido.
- **E2 a produzir:** Lookbook recarregado exibindo o mesmo look no filtro de Inverno.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.

# Exercício 07 — Tipo de iluminação e temperatura do quarto

**Situação na revisão `9f5512a77`:** Parcial: kelvin/intensidade/on já são guardados em modules_json; falta a FK TipoIluminacao exigida.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema.** Criar `tipos_iluminacao` e referências/temperatura nullable no RoomLayout, conforme SQL. Em [RoomLayout.java:28](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/RoomLayout.java#L28), os módulos JSON já contêm a configuração de luz; não criar outra entidade de quarto nem copiar o usuário.

2. **Entidade/repository.** Criar `TipoIluminacao`/repository com código, nome e ativo. Acrescentar `tipoIluminacao` e `temperaturaKelvin` em RoomLayout; usar [RoomLayoutRepository.java:15](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/RoomLayoutRepository.java#L15) e novo `TipoIluminacaoRepository.findAllByAtivoTrueOrderByNomeAsc`.

3. **Service.** Extrair `RoomLightingWriter` do bloco [RoomService.java:424](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/RoomService.java#L424). Reavaliar nível/permissão existentes, resolver FK ativa e validar 2700–6500K. Definir os campos relacionais como fonte principal e derivar o JSON devolvido para a cena; legado sem FK continua lendo o JSON anterior. Não manter dois valores divergentes após salvar. Preservar o comportamento de clientes antigos com somente kelvin, explicitando qualquer mudança futura da regra de clamp.

4. **Controller.** Acrescentar `tipoIluminacaoId` ao `LightRequest` em [RoomController.java:140](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/RoomController.java#L140); manter `PUT /api/me/room/light`, sem aceitar userId arbitrário no corpo. Novo `GET /api/opcoes/tipos-iluminacao` em controller curto de referências.

5. **UI e leitura.** Em [room-settings-panel.tsx:30](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/room3d/room-settings-panel.tsx#L30), acrescentar seleção e temperatura; carregar opções antes de habilitar a escolha. A cena em [room-scene.tsx:86](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/room3d/room-scene.tsx#L86) deve usar o GET confirmado após reload. Manter erro/retry, permissão por nível e estado legado sem classificação.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-domain/src/main/java/br/com/fashionai/domain/model/TipoIluminacao.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/repository/TipoIluminacaoRepository.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/RoomLightingWriter.java`.
- `fai-web/src/main/java/br/com/fashionai/web/controller/RoomReferenceController.java`.

Se escolher aplicar o DDL faltante, criar na **linha 1** a migration `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V<PROXIMA_VERSAO_LIVRE>__ex07.sql`, substituindo o placeholder por versão realmente livre. O SQL didático não deve ser copiado inteiro sem inspecionar o schema.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](solucoes/sql/07-iluminacao-quarto.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
CREATE TABLE `tipos_iluminacao` (
  id CHAR(36) NOT NULL PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(80) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
) ENGINE=InnoDB;
INSERT INTO `tipos_iluminacao` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'AMBIENTE','Ambiente',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `tipos_iluminacao` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'DIRECIONADA','Direcionada',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `tipos_iluminacao` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'DIFUSA','Difusa',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));

ALTER TABLE room_layouts ADD COLUMN tipo_iluminacao_id CHAR(36) NULL,
  ADD COLUMN temperatura_kelvin INT NULL;
ALTER TABLE room_layouts ADD CONSTRAINT fk_room_layout_tipo_iluminacao
  FOREIGN KEY(tipo_iluminacao_id) REFERENCES tipos_iluminacao(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT ck_room_layout_kelvin
  CHECK(temperatura_kelvin IS NULL OR temperatura_kelvin BETWEEN 2700 AND 6500);
SELECT user_id,tipo_iluminacao_id,temperatura_kelvin,modules_json
FROM room_layouts WHERE user_id=@owner_id;
```

## Integridade referencial: restrições e alternativas

FK proposta RESTRICT: não remover o tipo utilizado por um quarto; desativá-lo mantém o vínculo e permite leitura. A FK de room_layouts.user_id não autoriza editar outro quarto. SET NULL com fallback documentado é alternativa se perder a classificação for aceitável; CASCADE para excluir o quarto não é apropriado. CHECK da temperatura protege somente a faixa, não comprova correspondência física com uma lâmpada. Não aplicar NOT NULL antes de resolver os layouts legados.

## Contrato HTTP

Proposto: `PUT /api/me/room/light`, `{"tipoIluminacaoId":"<UUID>","kelvin":4000,"intensity":0.75,"on":true}`; `GET /api/me/room` retorna a luz confirmada.

Resposta/projeção a conferir: `"light": {"tipoIluminacao":{"id":"...","codigo":"DIFUSA","nome":"Difusa"},"kelvin":4000,"intensity":0.75,"on":true}`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Faixa válida, fora da faixa no novo contrato, FK inexistente/inativa, usuário sem nível, legado JSON sem FK. Recarregar confirma o mesmo tipo/temperatura no painel e na cena; falha de envio não deve parecer salvamento bem-sucedido.

- **E1 a produzir:** Painel com tipo e temperatura selecionados.
- **E2 a produzir:** Cena e painel após reload mantendo os valores.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.

# Exercício 08 — Nome do módulo de armazenamento

**Situação na revisão `9f5512a77`:** Parcial: gavetas já têm renameDrawer e drawer_labels_json; nomes genéricos de módulos precisam preservar IDs e endereços.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Modelo/SQL.** Reutilizar [RoomLayout.java:31](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/RoomLayout.java#L31) e módulos em `modules_json`. Em [RoomStorageEntry.java:27](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/RoomStorageEntry.java#L27), `address` é endereço estável como `drawer:1`, não o nome visível. Não transformar uma troca de rótulo numa mudança de PK.

2. **Repository.** Reutilizar [RoomLayoutRepository.java:15](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/RoomLayoutRepository.java#L15) e [RoomStorageEntryRepository.java:15](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/RoomStorageEntryRepository.java#L15); renomear não requer apagar ou recriar entradas de armazenamento.

3. **Service.** O caso gaveta já está em [RoomService.java:1097](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/RoomService.java#L1097). Para outros módulos, extrair `RoomModuleNamingService`: localizar o módulo pelo ID do layout do usuário, limitar label a 24 caracteres, normalizar texto e permitir limpar para nome padrão. Persistir apenas label, mantendo id/slotType/capacity. Garantir que a reconciliação de módulos por nível preserve rótulos explícitos.

4. **Outra leitura.** Em [RoomService.java:1118](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/RoomService.java#L1118), devolver o nome resolvido junto do endereço. Adaptar RoomAddress/Location para usar o rótulo do módulo sem alterar o endereço; isso evita quebrar referências no detalhe da peça.

5. **Controller.** Reutilizar o rename de gavetas em [RoomController.java:71](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/RoomController.java#L71); para módulos genéricos, adicionar `PUT /api/me/room/modules/{moduleId}/label` e reutilizar `GET /api/pieces/{pieceId}/room-location`. Não receber layout de terceiro como se fosse próprio.

6. **Tela.** Criar editor curto de rótulo no painel do quarto e consumir a localização em [expanded-piece.tsx:54](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/expanded-card/expanded-piece.tsx#L54). Mostrar loading, limite de texto, falha/retry e endereço preservado; evitar atualizar só o título local sem esperar a resposta persistida.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-application/src/main/java/br/com/fashionai/application/service/RoomModuleNamingService.java`.
- `components/room3d/module-label-field.tsx`.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](solucoes/sql/08-nome-modulo.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SHOW CREATE TABLE room_layouts;
SHOW CREATE TABLE room_storage_map;
SELECT user_id,drawer_labels_json,modules_json FROM room_layouts WHERE user_id=@owner_id;
SELECT wardrobe_item_id,address FROM room_storage_map
WHERE user_id=@owner_id AND wardrobe_item_id=@piece_id;
-- Exemplo didático somente para gaveta1; a API deve realizar a validação/autorização.
UPDATE room_layouts
SET drawer_labels_json=JSON_SET(COALESCE(drawer_labels_json,JSON_OBJECT()),'$."1"','Camisas'),
    updated_at=CURRENT_TIMESTAMP(6)
WHERE user_id=@owner_id;
-- Nome genérico: alterar label do módulo localizado pelo id no service; não usar índice fixo do array JSON.
```

## Integridade referencial: restrições e alternativas

Módulos dentro do JSON não têm FK de módulo: o banco não verifica se `drawer:1` existe. RoomStorageEntry contém relações de usuário/peça, e a política V34 prevê CASCADE ao excluir peça. Renomear label não viola essas FKs; trocar o `id` do módulo pode tornar os endereços logicamente órfãos, mesmo com todas as FKs SQL válidas. Alternativas: manter IDs imutáveis; mapear endereços numa transação ao substituir módulo; ou normalizar módulos em tabela futura com FK e migração dos endereços. Não usar DELETE da peça para reorganizar o quarto.

## Contrato HTTP

Existente para gaveta: `PUT /api/me/room/drawers/1`, `{"label":"Camisas"}`. Proposto genérico: `PUT /api/me/room/modules/{moduleId}/label` com o mesmo corpo.

Resposta/projeção a conferir: `"label":"Camisas", "address":"drawer:1", "moduleId":"drawer:1"`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Nome válido, vazio volta ao padrão, excesso de24 caracteres, módulo inexistente, peça/layout alheio e atualização de nível. Comparar endereço antes/depois; contagem de peças/diário não muda.

- **E1 a produzir:** Renomear a gaveta no quarto.
- **E2 a produzir:** Detalhe da peça recarregado mostrando Camisas e endereço original.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.

# Exercício 09 — Categoria principal da marca

**Situação na revisão `9f5512a77`:** Parcial: fashion_category é texto; não há FK CategoriaMarca nesse modelo.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema/entidade.** Criar `categorias_marca` e `brand_profiles.categoria_marca_id NULL`; manter `fashion_category` legado de [BrandProfile.java:67](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/BrandProfile.java#L67). Não confundir `brand_profiles` (perfil institucional) com `brands` (marca do catálogo).

2. **Repository.** Acrescentar `CategoriaMarcaRepository` com opções ativas e resolução por ID; reutilizar [BrandProfileRepository.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/BrandProfileRepository.java#L19). A FK se liga à categoria do perfil, não ao dono do perfil.

3. **Service.** Extrair `BrandCategoryWriter` da edição em [InstitutionalService.java:724](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/InstitutionalService.java#L724). Resolver ID, preservar omitido, permitir clear explícito e manter referência inativa inalterada. A projeção `brandCard` deve devolver `categoriaPrincipal` sem converter automaticamente todo texto legado em categoria conhecida.

4. **Controller.** Manter `PATCH /api/me/brand-profile` em [ProfileController.java:113](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/ProfileController.java#L113); aceitar `categoriaMarcaId` no mapa/DTO validado e criar `GET /api/opcoes/categorias-marca`. A sessão define a marca editável.

5. **Formulário e célula da Busca.** Atualizar [edit-profile.tsx:16](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/edit-profile.tsx#L16) e o contrato de perfil retornado. Em [institutional-profile-card.tsx:36](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/institutional-profile-card.tsx#L36), preferir `categoriaPrincipal.nome`, preservando fallback legado identificado. Ajustar a projeção da busca se ela não devolver o novo objeto. Loading/erro das opções não devem apagar o texto/ID já salvo.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-domain/src/main/java/br/com/fashionai/domain/model/CategoriaMarca.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/repository/CategoriaMarcaRepository.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/BrandCategoryWriter.java`.
- `fai-web/src/main/java/br/com/fashionai/web/controller/InstitutionalReferenceController.java`.

Se escolher aplicar o DDL faltante, criar na **linha 1** a migration `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V<PROXIMA_VERSAO_LIVRE>__ex09.sql`, substituindo o placeholder por versão realmente livre. O SQL didático não deve ser copiado inteiro sem inspecionar o schema.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](solucoes/sql/09-categoria-marca.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
CREATE TABLE `categorias_marca` (
  id CHAR(36) NOT NULL PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(80) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
) ENGINE=InnoDB;
INSERT INTO `categorias_marca` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'CASUAL','Casual',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `categorias_marca` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'ESPORTIVA','Esportiva',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `categorias_marca` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'LUXO','Luxo',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));

ALTER TABLE brand_profiles ADD COLUMN categoria_marca_id CHAR(36) NULL;
ALTER TABLE brand_profiles ADD CONSTRAINT fk_brand_profiles_categoria_marca
  FOREIGN KEY(categoria_marca_id) REFERENCES categorias_marca(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
SELECT b.id,b.fashion_category,c.codigo,c.nome FROM brand_profiles b
LEFT JOIN categorias_marca c ON c.id=b.categoria_marca_id WHERE b.owner_user_id=@owner_id;
```

## Integridade referencial: restrições e alternativas

Nova FK RESTRICT impede apagar categoria usada. Nome pode ser corrigido mantendo ID; código é UNIQUE e deve permanecer estável para filtros. Desativar para novas seleções é preferível a excluir. Alternativa: FK SET NULL preservando `fashion_category` como descrição histórica, se a perda do vínculo for aceita. A FK não prova que uma categoria é apropriada à marca nem autoriza um usuário editar outro perfil; isso continua no service.

## Contrato HTTP

Proposto no PATCH existente: `{"categoriaMarcaId":"<UUID>"}`; clear explícito separado. Novo GET de opções por categoria.

Resposta/projeção a conferir: `"categoriaPrincipal":{"id":"...","codigo":"CASUAL","nome":"Casual"}`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Categoria válida/inexistente/inativa; marca alheia; texto legado não mapeado; limpar; resultado da Busca recarregado com rótulo correto. Não criar perfil novo nem duplicar a marca do catálogo.

- **E1 a produzir:** Editar perfil da marca escolhendo a categoria.
- **E2 a produzir:** Busca de marcas recarregada com categoria na célula.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.

# Exercício 10 — Área artística principal da celebridade

**Situação na revisão `9f5512a77`:** Parcial: areas_json suporta lista; o modelo não distingue área principal por FK.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema/entidade.** Criar `areas_artisticas` e `celebrity_profiles.area_artistica_principal_id NULL`, mantendo a lista de [CelebrityProfile.java:58](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/CelebrityProfile.java#L58). Não selecionar a primeira área antiga como principal sem confirmação.

2. **Repository.** Criar `AreaArtisticaRepository` para opções ativas. Reutilizar [CelebrityProfileRepository.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/CelebrityProfileRepository.java#L19) e consulta por owner; não aceitar um ownerId do formulário para trocar o alvo.

3. **Service.** Em [InstitutionalService.java:750](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/InstitutionalService.java#L750), extrair `CelebrityAreaWriter` para validar/resolver `areaArtisticaId`, clear e preservação de ID inativo inalterado. Expor `areaPrincipal` na projeção `celebrityCard`. Se exigir que a principal também pertença à lista de áreas, validar/incluir de forma explícita sem sobrescrever as demais.

4. **Controller.** Ampliar o mapa/DTO do `PATCH /api/me/celebrity-profile` em [ProfileController.java:119](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/ProfileController.java#L119); criar `GET /api/opcoes/areas-artisticas`. Área principal é dado declarado/moderado, não selo de identidade verificada.

5. **Tela/leitura.** Acrescentar seleção no editor institucional em [edit-profile.tsx:16](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/edit-profile.tsx#L16). Passar `areaPrincipal.nome` à prop category do [profile-header.tsx:18](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/profile-header.tsx#L18), preservando a lista antiga em seção própria. Tratar loading, falha/retry, nenhuma escolha e antiga referência indisponível.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-domain/src/main/java/br/com/fashionai/domain/model/AreaArtistica.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/repository/AreaArtisticaRepository.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/CelebrityAreaWriter.java`.
- `fai-web/src/main/java/br/com/fashionai/web/controller/InstitutionalReferenceController.java`.

Se escolher aplicar o DDL faltante, criar na **linha 1** a migration `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V<PROXIMA_VERSAO_LIVRE>__ex10.sql`, substituindo o placeholder por versão realmente livre. O SQL didático não deve ser copiado inteiro sem inspecionar o schema.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](solucoes/sql/10-area-artistica.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
CREATE TABLE `areas_artisticas` (
  id CHAR(36) NOT NULL PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(80) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
) ENGINE=InnoDB;
INSERT INTO `areas_artisticas` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'MUSICA','Música',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `areas_artisticas` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'CINEMA','Cinema',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `areas_artisticas` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'MODA','Moda',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));

ALTER TABLE celebrity_profiles ADD COLUMN area_artistica_principal_id CHAR(36) NULL;
ALTER TABLE celebrity_profiles ADD CONSTRAINT fk_celebrity_area_principal
  FOREIGN KEY(area_artistica_principal_id) REFERENCES areas_artisticas(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
SELECT c.id,c.areas_json,a.codigo,a.nome FROM celebrity_profiles c
LEFT JOIN areas_artisticas a ON a.id=c.area_artistica_principal_id WHERE c.owner_user_id=@owner_id;
```

## Integridade referencial: restrições e alternativas

RESTRICT preserva os perfis vinculados; desativar categoria evita perda histórica. A lista JSON não adquire integridade referencial automaticamente por existir uma FK de principal. Se a lista completa precisar de FKs, usar tabela de associação celebridade×área, sem duplicar relações nem apagar areas_json antes de migrar os códigos conhecidos. SET NULL é alternativa para principal removível; CASCADE para excluir perfis não é adequado.

## Contrato HTTP

Proposto no PATCH existente: `{"areaArtisticaId":"<UUID>"}`; `GET /api/opcoes/areas-artisticas` para listar.

Resposta/projeção a conferir: `"areaPrincipal":{"id":"...","codigo":"MUSICA","nome":"Música"}`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Área válida/inexistente/inativa; perfil alheio; preservação de múltiplas áreas antigas; nenhuma principal escolhida; header público após reload. Alteração de área não concede automaticamente selo/verificação.

- **E1 a produzir:** Formulário institucional escolhendo Música como principal.
- **E2 a produzir:** Cabeçalho do perfil recarregado exibindo Música.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.

# Exercício 11 — Prazo de disponibilidade do selo

**Situação na revisão `9f5512a77`:** Base implementada com available_from/available_until e validação de ordem.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema/entidade.** Reutilizar [Seal.java:58](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/Seal.java#L58) e `availableUntil`. O prazo para solicitar o selo é diferente de `grantValidityDays`, que trata validade do vínculo concedido. Não criar outra tabela de prazos.

2. **Repository.** Reutilizar [SealRepository.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/SealRepository.java#L19). Filtros novos do mercado devem considerar início/fim com parâmetros de Instant; não armazenar um booleano expirado que fique desatualizado.

3. **Service/DTO.** O formulário e a persistência já passam pelo SealService/SealFormWriter. Conferir [SealFormWriter.java:137](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SealFormWriter.java#L137); aceita limites nulos e rejeita fim anterior ao início. Validar também no instante de solicitação de vínculo, não apenas ocultar o selo na lista. Se mudar a regra para duração estritamente positiva, atualizar service, CHECK e testes em conjunto.

4. **Controller.** Reutilizar as rotas de criar/editar selo em [SealController.java:27](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/SealController.java#L27). A sessão define emissor/dono; usuário comum não pode alterar disponibilidade de selo de outra marca.

5. **UI/leitura.** Em [seal-wizard.tsx:27](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/seal-wizard.tsx#L27), conferir datas locais convertidas para UTC e campos já existentes. Na leitura do mercado, mostrar início/fim e estado agendado/encerrado calculado pelo servidor. Erro de validação mantém datas preenchidas; null não deve aparecer como1970.

## Arquivos novos propostos e ponto de inserção

Nenhum arquivo de produção novo é obrigatório para a solução base descrita; reutilizar os pontos de edição/revisão numerados acima. Novos testes podem ser adicionados na responsabilidade correspondente.

Se escolher aplicar o DDL faltante, criar na **linha 1** a migration `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V<PROXIMA_VERSAO_LIVRE>__ex11.sql`, substituindo o placeholder por versão realmente livre. O SQL didático não deve ser copiado inteiro sem inspecionar o schema.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](solucoes/sql/11-prazo-selo.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SHOW CREATE TABLE seals;
SELECT id,available_from,available_until FROM seals
WHERE available_from IS NOT NULL AND available_until IS NOT NULL
  AND available_until<available_from;
-- Opcional, apenas se ainda não houver CHECK equivalente e a consulta acima vier vazia:
ALTER TABLE seals ADD CONSTRAINT ck_seals_availability_order
  CHECK(available_from IS NULL OR available_until IS NULL OR available_until>=available_from);
SELECT id,name,available_from,available_until,
  CASE WHEN available_from>CURRENT_TIMESTAMP(6) THEN 'AGENDADO'
       WHEN available_until<CURRENT_TIMESTAMP(6) THEN 'ENCERRADO'
       ELSE 'DISPONIVEL_NO_PERIODO' END AS periodo
FROM seals WHERE id=@seal_id;
```

## Integridade referencial: restrições e alternativas

Datas não são FKs. Alterar o prazo não autoriza excluir o selo: vínculos e promoções podem referenciá-lo; as ações reais devem ser consultadas no SQL00. Um CHECK novo falha se houver períodos inválidos legados. Corrigir apenas registros confirmados em uma migration de dados revisada, ou manter o CHECK para uma segunda etapa. Prefira encerrar/pausar a disponibilidade a apagar o registro. Não estender/revogar vínculos anteriores por efeito colateral sem regra explícita.

## Contrato HTTP

Recorte das rotas existentes de selo: `{"availableFrom":"2026-12-01T12:00:00Z","availableUntil":"2026-12-10T12:00:00Z"}`; enviar o restante do formulário exigido.

Resposta/projeção a conferir: `"availableFrom":"2026-12-01T12:00:00Z", "availableUntil":"2026-12-10T12:00:00Z"`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Ordem válida/invertida, null parcial/total, limites de instante e fuso, emissor alheio; tentativa de solicitar selo depois de vencer deve ser revalidada no backend. Testar mudança de disponibilidade sem destruir vínculos antigos.

- **E1 a produzir:** Wizard com o intervalo configurado.
- **E2 a produzir:** Mercado recarregado exibindo o mesmo intervalo e estado correspondente.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.

# Exercício 12 — Política do selo: quantidade mínima por cor

**Situação na revisão `9f5512a77`:** Estrutura rules/count/color já existe e é validada; usar a política estruturada, não texto livre.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Persistência.** A política estruturada é colocada em `background_config_json.policy`, conforme [SealFormWriter.java:125](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SealFormWriter.java#L125); `policy_text` é descrição, não a coluna JSON das regras. Não adicionar uma suposta `policy_json` sem necessidade.

2. **DTO/repository.** Reutilizar o formulário de selo e [SealRepository.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/SealRepository.java#L19). O contrato Rule em [SealPolicies.java:54](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SealPolicies.java#L54) já possui quantifier/count/color. Nenhuma tabela de cor nova é exigida pelo exercício.

3. **Service de validação.** Em [SealPolicyNormalizer.java:51](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SealPolicyNormalizer.java#L51), preservar o limite atual AT_LEAST1–4 e cores da taxonomia. Se o requisito didático exigir count estritamente inteiro, rejeitar número fracionário antes de `intValue()` em vez de truncar2,8 para2. Não ampliar limites só na UI.

4. **Avaliação.** Em [SealPolicyEvaluator.java:100](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SealPolicyEvaluator.java#L100), conferir que a quantidade seja de peças distintas que passam na mesma regra, e não a soma de peças de outras cores. Uma regra2blue não deve ser atendida por1blue+1red.

5. **Controller.** Reutilizar `SealController` em [SealController.java:27](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/SealController.java#L27); prévia de elegibilidade deve chamar o mesmo avaliador do pedido real, com autorização do dono do look/peça. Não liberar edição da política pelo visitante.

6. **Tela/leitura.** [seal-policy-editor.tsx:115](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/seal-policy-editor.tsx#L115) e [manual-seal-policy.tsx:11](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/manual-seal-policy.tsx#L11) devem emitir a regra estruturada. Mostrar na prévia as peças contadas e motivo de falha, tratar loading/erro e preservar rascunho. Não converter toda política antiga sem rules em condição obrigatória.

## Arquivos novos propostos e ponto de inserção

Nenhum arquivo de produção novo é obrigatório para a solução base descrita; reutilizar os pontos de edição/revisão numerados acima. Novos testes podem ser adicionados na responsabilidade correspondente.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](solucoes/sql/12-quantidade-cor.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SELECT id,JSON_EXTRACT(background_config_json,'$.policy') AS policy FROM seals WHERE id=@seal_id;
SELECT s.id,r.quantifier,r.minimum_count,r.color FROM seals s
JOIN JSON_TABLE(COALESCE(JSON_EXTRACT(s.background_config_json,'$.policy.rules'),JSON_ARRAY()),
  '$[*]' COLUMNS(quantifier VARCHAR(20) PATH '$.quantifier',
                minimum_count INT PATH '$.count',color VARCHAR(80) PATH '$.color')) AS r ON TRUE
WHERE s.id=@seal_id;
-- Não há alteração de schema para count/color; validar e salvar via service existente.
```

## Integridade referencial: restrições e alternativas

IDs/códigos dentro de JSON não têm FK SQL. A presença de `Taxonomy.COLORS` é validação de aplicação; desativar ou renomear um código pode afetar políticas antigas. Alternativas: códigos estáveis com alias de leitura; nova versão da política; ou normalizar regras/cor em tabelas com FK se a integridade relacional for requisito. Não tentar criar FOREIGN KEY diretamente para `$.policy.rules[*].color`. Uma alteração nas regras deve respeitar a política de revalidação dos vínculos já concedidos.

## Contrato HTTP

Recorte do formulário existente: `{"policy":{"rules":[{"quantifier":"AT_LEAST","count":2,"color":"blue"}]}}`. Em modo manual, manter os demais campos de geração/referência que o editor atual exige.

Resposta/projeção a conferir: `"policy": {"rules":[{"quantifier":"AT_LEAST","count":2,"color":"blue"}]}`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

2 azuis passam;1 azul+1 vermelha falha; color inválida, count 0/5/2.5 rejeitados conforme contrato inteiro; peça repetida não dobra contagem; visitante não altera. Testar prévia e pedido real com o mesmo conjunto de IDs.

- **E1 a produzir:** Editor da política com mínimo2 azuis.
- **E2 a produzir:** Prévia recarregada mostrando contagem e elegibilidade das peças.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.

# Exercício 13 — Política do selo: marca exigida

**Situação na revisão `9f5512a77`:** Parcial: a regra atual guarda brand como texto e compara similaridade; isso não é uma FK de marca.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Inventário.** O texto `brand` aparece em [SealPolicies.java:54](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SealPolicies.java#L54) e é comparado por similaridade em [SealPolicyEvaluator.java:159](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SealPolicyEvaluator.java#L159). Diferenciar catálogo (`brands`) de perfil emissor (`brand_profiles`); UUID sem tipo de origem é ambíguo.

2. **Contrato.** Acrescentar uma referência tipada `brandReference:{kind:CATALOG|PROFILE,id,nome}` às novas regras. Preservar `brand` textual nas políticas antigas, sem resolver automaticamente por fuzzy match para um ID possivelmente errado. `nome` é snapshot de exibição; não é autorização.

3. **Repositories.** Reutilizar [BrandRepository.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/BrandRepository.java#L19) e [BrandProfileRepository.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/BrandProfileRepository.java#L19) para resolver conforme kind. Se adotar a alternativa relacional do SQL, criar `SealPolicyBrandRequirement`/repository com sealId+ruleIndex e exatamente uma das duas FKs de marca.

4. **Service.** Extrair `SealPolicyBrandResolver`; integrar resolução no writer antes de [SealFormWriter.java:125](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SealFormWriter.java#L125). Atualizar normalização/parser/Rule e o avaliador para comparar IDs de `WardrobeItem.brand` ou `brandProfile`; não misturar IDs com o nome salvo na peça. Escrita da versão e das referências normalizadas deve ser transacional, com diff/remoção das linhas antigas da mesma regra.

5. **Controller.** Criar GET de opções tipadas `GET /api/opcoes/marcas-politica?kind=CATALOG&q=...` e manter a edição de selo no [SealController.java:27](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/SealController.java#L27). Nome/ID inexistente ou kind incompatível deve voltar 400; editar política exige dono/emissor.

6. **UI/detalhe.** Em [seal-policy-editor.tsx:115](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/seal-policy-editor.tsx#L115), usar busca/autocomplete que guarda kind+ID, com loading/retry; texto sem seleção não satisfaz uma nova referência. No detalhe do selo mostrar o nome resolvido/snapshot, sem tratar um nome digitado como marca verificada.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-application/src/main/java/br/com/fashionai/application/service/SealPolicyBrandReference.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/SealPolicyBrandResolver.java`.
- `fai-web/src/main/java/br/com/fashionai/web/controller/SealPolicyReferenceController.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/model/SealPolicyBrandRequirement.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/repository/SealPolicyBrandRequirementRepository.java`.

Se escolher aplicar o DDL faltante, criar na **linha 1** a migration `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V<PROXIMA_VERSAO_LIVRE>__ex13.sql`, substituindo o placeholder por versão realmente livre. O SQL didático não deve ser copiado inteiro sem inspecionar o schema.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](solucoes/sql/13-marca-politica.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SELECT id,JSON_EXTRACT(background_config_json,'$.policy.rules') AS rules FROM seals WHERE id=@seal_id;
-- ALTERNATIVA RELACIONAL, somente se for escolhida como fonte validada da referência:
CREATE TABLE seal_policy_brand_requirements (
  seal_id CHAR(36) NOT NULL,rule_index INT NOT NULL,
  brand_id CHAR(36) NULL,brand_profile_id CHAR(36) NULL,
  PRIMARY KEY(seal_id,rule_index),
  CONSTRAINT fk_spbr_seal FOREIGN KEY(seal_id) REFERENCES seals(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_spbr_brand FOREIGN KEY(brand_id) REFERENCES brands(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_spbr_profile FOREIGN KEY(brand_profile_id) REFERENCES brand_profiles(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_spbr_target CHECK((brand_id IS NOT NULL AND brand_profile_id IS NULL)
                             OR (brand_id IS NULL AND brand_profile_id IS NOT NULL)),
  CONSTRAINT ck_spbr_index CHECK(rule_index>=0)
) ENGINE=InnoDB;
```

## Integridade referencial: restrições e alternativas

Uma referência tipada em JSON continua sem FK no banco; só o service garante existência. A tabela alternativa reforça duas FKs e XOR: não pode apagar marca usada, nem apontar para marca inexistente, nem preencher ambos os tipos. Apagar o selo remove seus requisitos (CASCADE), não as marcas. Alternativas à exclusão de marca: inativar, manter alias ou criar nova versão da política e migrar regras explicitamente. Se permanecer apenas em JSON, implementar detecção de órfãos e não apresentar isso como integridade referencial SQL. Registros textuais legados permanecem identificados como texto.

## Contrato HTTP

Proposto: `{"policy":{"rules":[{"quantifier":"AT_LEAST","count":1,"brandReference":{"kind":"CATALOG","id":"<UUID>","nome":"Marca escolhida"}}]}}`.

Resposta/projeção a conferir: `"brandReference":{"kind":"CATALOG","id":"...","nome":"Marca escolhida"}`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

ID correto/incorreto; kind incorreto; duas marcas de nomes semelhantes; peça com brandName igual mas ID diferente; legado textual; mudança de nome com ID estável; marca vinculada não pode ser apagada se usar a tabela alternativa. Conferir sincronização da revisão JSON e das linhas relacionais.

- **E1 a produzir:** Selecionar uma marca real na política.
- **E2 a produzir:** Detalhe do selo recarregado mostrando a referência correta.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.

# Exercício 14 — Canal de utilização do cupom

**Situação na revisão `9f5512a77`:** Proposta: há cupons de promoções e de FLAIR; canal precisa cobrir os dois fluxos sem tratar CouponRight como cupom emitido.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Modelo/schema.** Criar CanalCupom e FKs em `promotions`, `flair_combinations` e seus resgates. Usar [Promotion.java:27](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/Promotion.java#L27), [FlairCombination.java:24](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/FlairCombination.java#L24), [PromotionRedemption.java:28](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/PromotionRedemption.java#L28) e [FlairRedemption.java:24](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/FlairRedemption.java#L24). Os resgates guardam canal/snapshot de quando foram emitidos; `CouponRight` é direito, não tabela genérica de todos os cupons.

2. **Repositories.** Criar `CanalCupomRepository` com opções ativas e findById. Reutilizar [PromotionRepository.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/PromotionRepository.java#L19) / PromotionRedemptionRepository e [FlairCombinationRepository.java:14](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/FlairCombinationRepository.java#L14) / FlairRedemptionRepository. Não inventar `CouponRepository` para dados que já possuem origem definida.

3. **Services.** Acrescentar `canalCupomId` aos formulários em [SealService.java:407](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SealService.java#L407) e [FlairService.java:801](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/FlairService.java#L801). Extrair um resolver de canal e escritores de resgate; copiar FK+código no momento da emissão em [SealPromotionWriter.java:156](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SealPromotionWriter.java#L156) e [FlairService.java:1010](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/FlairService.java#L1010). Alterar o canal de uma oferta não muda cupons emitidos.

4. **Controllers.** Criar `GET /api/opcoes/canais-cupom`. Manter ofertas de promoções em [SealPromotionController.java:43](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/SealPromotionController.java#L43) e FLAIR em [FlairController.java:165](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/FlairController.java#L165). Validação do resgate exige dono do cupom e contexto autorizado da marca; um cliente declarar canal não comprova uma compra externa.

5. **UI e carteira.** Acrescentar seleção na oferta institucional/ [brand-flair-tab.tsx:27](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/flair/brand-flair-tab.tsx#L27) e devolver o snapshot em SealPromotionReads/FlairService.redemptionView para a carteira. Mostrar LOJA_FISICA/ECOMMERCE/AMBOS traduzidos; legado sem canal fica 'não informado', não inferido de storeUrl. Loading/erro das opções não elimina dados da oferta.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-domain/src/main/java/br/com/fashionai/domain/model/CanalCupom.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/repository/CanalCupomRepository.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/CouponChannelResolver.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/CouponChannelSnapshotWriter.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/FlairCouponWriter.java`.
- `fai-web/src/main/java/br/com/fashionai/web/controller/CouponReferenceController.java`.

Se escolher aplicar o DDL faltante, criar na **linha 1** a migration `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V<PROXIMA_VERSAO_LIVRE>__ex14.sql`, substituindo o placeholder por versão realmente livre. O SQL didático não deve ser copiado inteiro sem inspecionar o schema.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](solucoes/sql/14-canal-cupom.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
CREATE TABLE `canais_cupom` (
  id CHAR(36) NOT NULL PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(80) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
) ENGINE=InnoDB;
INSERT INTO `canais_cupom` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'LOJA_FISICA','Loja física',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `canais_cupom` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'ECOMMERCE','E-commerce',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `canais_cupom` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'AMBOS','Ambos',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));

ALTER TABLE promotions ADD COLUMN canal_cupom_id CHAR(36) NULL;
ALTER TABLE promotions ADD CONSTRAINT fk_promotions_canal_cupom
  FOREIGN KEY(canal_cupom_id) REFERENCES canais_cupom(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE flair_combinations ADD COLUMN canal_cupom_id CHAR(36) NULL;
ALTER TABLE flair_combinations ADD CONSTRAINT fk_flair_combinations_canal_cupom
  FOREIGN KEY(canal_cupom_id) REFERENCES canais_cupom(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE promotion_redemptions ADD COLUMN canal_cupom_id CHAR(36) NULL;
ALTER TABLE promotion_redemptions ADD CONSTRAINT fk_promotion_redemptions_canal_cupom
  FOREIGN KEY(canal_cupom_id) REFERENCES canais_cupom(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE flair_redemptions ADD COLUMN canal_cupom_id CHAR(36) NULL;
ALTER TABLE flair_redemptions ADD CONSTRAINT fk_flair_redemptions_canal_cupom
  FOREIGN KEY(canal_cupom_id) REFERENCES canais_cupom(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE promotion_redemptions ADD COLUMN canal_codigo_snapshot VARCHAR(40) NULL;
ALTER TABLE flair_redemptions ADD COLUMN canal_codigo_snapshot VARCHAR(40) NULL;
-- Sem backfill por URL da loja: ela não prova canal do cupom emitido anteriormente.
```

## Integridade referencial: restrições e alternativas

FKs propostas RESTRICT preservam os cupons já emitidos: não apagar canal referenciado, mas inativar para novas ofertas. O snapshot impede mudança retroativa quando a oferta troca de canal. A política V34 prevê CASCADE entre flair_combinations e flair_redemptions; isso pode apagar a carteira ao excluir a combinação. Preferir `active=false` e, se o histórico tiver de sobreviver a exclusões, uma migration separada que preserve/restrinja essa relação, após inspecionar todas as FKs existentes. Evitar conversão automática entre os dois domínios de cupom.

## Contrato HTTP

Novos campos nos POST/PUT existentes de oferta: `{"canalCupomId":"<UUID>"}`. Leitura: carteira de promoções e `GET /api/flair/vouchers`, por sua origem real.

Resposta/projeção a conferir: `"canalCupom":{"id":"...","codigo":"ECOMMERCE","nome":"E-commerce"}, "canalCodigoSnapshot":"ECOMMERCE"`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Cada canal; UUID inexistente/inativo; emissor alheio; cupom de outro usuário; oferta muda mas resgate conserva snapshot; legado NULL; inativação preserva carteira. Testar ambos os emissores (promoções e FLAIR), sem duplicar emissão em reenvio/concorrência.

- **E1 a produzir:** Emissor cria oferta com canal da API.
- **E2 a produzir:** Carteira recarregada mostrando o canal do cupom emitido.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.

# Exercício 15 — Valor mínimo de compra do cupom

**Situação na revisão `9f5512a77`:** Parcial: FlairCombination.minPurchase existe, mas precisa validação forte e snapshot; promoções possuem outro modelo.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema/entidades.** Reutilizar `flair_combinations.min_purchase` de [FlairCombination.java:69](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/FlairCombination.java#L69); acrescentar mínimo em Promotion e snapshots de mínimo/moeda nos dois tipos de resgate. Não criar outra coluna de mínimo na combinação. A moeda de exibição do usuário não deve alterar a moeda contratada do cupom.

2. **Repositories.** Reutilizar os mesmos quatro repositories do exercício14. Gravar mínimo/moeda no resgate na mesma transação que estoque e emissão. Nenhuma consulta por comparação textual de dinheiro.

3. **DTO/service.** Em [FlairService.java:841](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/FlairService.java#L841), delegar a `CouponMinimumRules`: BigDecimal não negativo, até 2 casas e até99.999.999,99 para DECIMAL(10,2); moeda ISO4217 suportada. Acrescentar o campo no PromotionForm/SealPromotionWriter. Não aceitar silenciosamente arredondamento bancário de 3 casas. Legado sem moeda permanece não confirmado.

4. **Snapshot/leitura.** Em [FlairService.java:1055](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/FlairService.java#L1055), não continuar lendo mínimo atual da combinação para um cupom emitido: usar o snapshot. Repetir em [SealPromotionReads.java:30](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SealPromotionReads.java#L30). Cupom antigo sem snapshot deve ser identificado como condição histórica não disponível; não preencher com regra atual sem evidência.

5. **Controller.** Manter rotas de oferta dos [FlairController.java:26](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/FlairController.java#L26) e [SealPromotionController.java:28](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/SealPromotionController.java#L28); o total de uma compra não deve ser enviado pelo visitante como prova de elegibilidade. Conciliação com checkout externo é integração adicional, não comprovada por gravar o campo.

6. **Tela/detalhe.** Atualizar oferta em [brand-flair-tab.tsx:27](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/flair/brand-flair-tab.tsx#L27) e leitura da carteira; mostrar valor e moeda contratada, distinguir zero de null. Validar entrada como decimal sem calcular dinheiro com floats, preservar rascunho no400 e formatar com locale sem trocar a moeda da oferta.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-application/src/main/java/br/com/fashionai/application/service/CouponMinimumRules.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/CouponTermsSnapshotWriter.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/FlairCouponWriter.java`.

Se escolher aplicar o DDL faltante, criar na **linha 1** a migration `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V<PROXIMA_VERSAO_LIVRE>__ex15.sql`, substituindo o placeholder por versão realmente livre. O SQL didático não deve ser copiado inteiro sem inspecionar o schema.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](solucoes/sql/15-minimo-compra.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SELECT id,min_purchase FROM flair_combinations WHERE min_purchase<0;
ALTER TABLE promotions ADD COLUMN min_purchase DECIMAL(10,2) NULL,
  ADD COLUMN min_purchase_currency CHAR(3) NULL;
ALTER TABLE flair_combinations ADD COLUMN min_purchase_currency CHAR(3) NULL;
ALTER TABLE promotion_redemptions ADD COLUMN min_purchase_snapshot DECIMAL(10,2) NULL,
  ADD COLUMN min_purchase_currency_snapshot CHAR(3) NULL;
ALTER TABLE flair_redemptions ADD COLUMN min_purchase_snapshot DECIMAL(10,2) NULL,
  ADD COLUMN min_purchase_currency_snapshot CHAR(3) NULL;
-- Após revisar negativos legados e conferir CHECKs existentes:
ALTER TABLE flair_combinations ADD CONSTRAINT ck_flair_min_purchase
  CHECK(min_purchase IS NULL OR min_purchase>=0);
ALTER TABLE promotions ADD CONSTRAINT ck_promotion_min_purchase
  CHECK(min_purchase IS NULL OR min_purchase>=0);
ALTER TABLE promotion_redemptions ADD CONSTRAINT ck_pr_min_snapshot
  CHECK(min_purchase_snapshot IS NULL OR min_purchase_snapshot>=0);
ALTER TABLE flair_redemptions ADD CONSTRAINT ck_fr_min_snapshot
  CHECK(min_purchase_snapshot IS NULL OR min_purchase_snapshot>=0);
-- Não preencher snapshots/moedas antigos a partir da oferta atual sem evidência histórica.
```

## Integridade referencial: restrições e alternativas

Dinheiro não é FK neste desenho: DECIMAL/CHECK reforçam faixa, e as FKs ligam o cupom à oferta/usuário. CHECK novo falha com negativos antigos; não normalizar automaticamente para0. Manter NULL e revisar é diferente de conceder compra mínima zero. A oferta não pode ser apagada indiscriminadamente se destruir resgates por CASCADE. Alternativas: inativar oferta, manter snapshots, restringir exclusão ou separar condições em versões imutáveis. Exigir moeda para novas gravações no service sem inventar moeda para registros antigos.

## Contrato HTTP

Proposto no formulário completo da oferta: `{"minPurchase":"50.00","minPurchaseCurrency":"BRL"}`. BigDecimal recebe decimal exato; retorno deve incluir moeda e, no resgate, o snapshot.

Resposta/projeção a conferir: `"minPurchaseSnapshot":"50.00", "minPurchaseCurrencySnapshot":"BRL"`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

0 e50.00 válidos; -1, 3 casas, overflow e moeda inválida rejeitados; null legado; moeda do usuário diferente não muda o cupom; oferta muda após emissão e resgate mantém50.00. Conferir ambos os fluxos de cupom e autorização do emissor.

- **E1 a produzir:** Oferta com mínimo e moeda explícitos.
- **E2 a produzir:** Detalhe do cupom resgatado e recarregado com condições da emissão.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.

# Exercício 16 — CBC: modalidade/cenário preferido

**Situação na revisão `9f5512a77`:** Parcial: desafios têm scenario e validação própria; preferência individual não deve reescrever o desafio global.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Definir o alcance.** Em [FlairChallenge.java:47](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/FlairChallenge.java#L47), scenario é configuração do desafio. Resolver este exercício como preferência por usuário+desafio entre cenários autorizados, sem mudar janela, pontos, dificuldade ou requisitos oficiais.

2. **Schema/entidades.** Criar `CbcScenario`, associação desafio×cenários e `CbcPreference`, com chave usuário+desafio. A FK composta de preferência para a associação prova que o cenário está permitido naquele desafio. Usar nomes e tipos do SQL; não adicionar uma preferência global em FlairChallenge.

3. **Repositories.** Reutilizar [FlairChallengeRepository.java:11](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/FlairChallengeRepository.java#L11); criar `CbcScenarioRepository`, `CbcChallengeScenarioRepository` e `CbcPreferenceRepository.findByUserIdAndChallengeId`. O ID composto pode ser Embeddable/IdClass, mantendo os dois tipos UUID.

4. **Service.** Criar `CbcPreferenceService`: validar desafio visível, opção ativa, associação permitida e cenário suportado pelo renderer. O código atual valida o formato de scenario em [FlairChallengeService.java:905](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/FlairChallengeService.java#L905), mas formato sintático não prova que haja arte/cenário implementado. Preferência não concede pontos nem altera submissões existentes.

5. **Controller.** Em controller específico curto: `GET /api/flair/challenges/{id}/scenarios`, `PUT /api/flair/challenges/{id}/preference`, `GET` da mesma preferência. Integrar à leitura da central existente no [FlairChallengeController.java:24](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/FlairChallengeController.java#L24). Usar CurrentUser; não aceitar userId do corpo.

6. **Tela.** Em [cbc.tsx:149](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/flair/cbc.tsx#L149), escolher apenas alternativas autorizadas e tratar loading/retry/nenhuma preferência; [cbc-scene.tsx:74](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/flair/cbc-scene.tsx#L74) renderiza o cenário conhecido. A central deve recarregar a preferência; um código novo no banco sem implementação visual fica indisponível, não vira rota arbitrária.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-domain/src/main/java/br/com/fashionai/domain/model/CbcScenario.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/model/CbcChallengeScenario.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/model/CbcPreference.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/model/CbcChallengeScenarioId.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/model/CbcPreferenceId.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/repository/CbcScenarioRepository.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/repository/CbcChallengeScenarioRepository.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/repository/CbcPreferenceRepository.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/CbcPreferenceService.java`.
- `fai-web/src/main/java/br/com/fashionai/web/controller/CbcPreferenceController.java`.

Se escolher aplicar o DDL faltante, criar na **linha 1** a migration `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V<PROXIMA_VERSAO_LIVRE>__ex16.sql`, substituindo o placeholder por versão realmente livre. O SQL didático não deve ser copiado inteiro sem inspecionar o schema.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](solucoes/sql/16-preferencia-cbc.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
CREATE TABLE `cbc_scenarios` (
  id CHAR(36) NOT NULL PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(80) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  created_by VARCHAR(80) NULL,
  last_modified_by VARCHAR(80) NULL
) ENGINE=InnoDB;
INSERT INTO `cbc_scenarios` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'ipanema','Ipanema',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `cbc_scenarios` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'gala','Gala',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));
INSERT INTO `cbc_scenarios` (id,codigo,nome,created_at,updated_at)
VALUES (UUID(),'livre','Livre',CURRENT_TIMESTAMP(6),CURRENT_TIMESTAMP(6));

CREATE TABLE cbc_challenge_scenarios (
  challenge_id CHAR(36) NOT NULL,scenario_id CHAR(36) NOT NULL,
  PRIMARY KEY(challenge_id,scenario_id),
  CONSTRAINT fk_ccs_challenge FOREIGN KEY(challenge_id) REFERENCES flair_challenges(id)
    ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_ccs_scenario FOREIGN KEY(scenario_id) REFERENCES cbc_scenarios(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE cbc_preferences (
  user_id CHAR(36) NOT NULL,challenge_id CHAR(36) NOT NULL,scenario_id CHAR(36) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY(user_id,challenge_id),
  CONSTRAINT fk_cbcp_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_cbcp_allowed FOREIGN KEY(challenge_id,scenario_id)
    REFERENCES cbc_challenge_scenarios(challenge_id,scenario_id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;
-- Associar opções a desafios somente depois de conferir compatibilidade com o renderer/regras.
SELECT c.id,c.scenario,c.status FROM flair_challenges c WHERE c.id=@challenge_id;
```

## Integridade referencial: restrições e alternativas

A FK composta impede escolher um cenário cadastrado mas não permitido no desafio. RESTRICT impede retirar uma associação usada; migrar/limpar as preferências antes de removê-la ou apenas desativar a opção para novas escolhas. Embora o desafio tenha CASCADE para a associação, o RESTRICT das preferências pode bloquear a exclusão em cascata: encerrar/arquivar desafio é alternativa segura; se a exclusão for necessária em teste, remover preferências, depois associações e só então o desafio, com política para entregas/histórico. A FK user_id CASCADE remove a preferência quando a conta é excluída.

## Contrato HTTP

Novo `PUT /api/flair/challenges/{id}/preference` com `{"scenarioId":"<UUID permitido>"}`. GET de opções é contextual ao desafio.

Resposta/projeção a conferir: `"challengeId":"...", "scenario":{"id":"...","codigo":"gala","nome":"Gala"}`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Cenário permitido passa; cadastrado mas não associado falha; inativo/desafio privado/encerrado conforme regra; ausência de preferência; alteração em um usuário não muda o outro. Confirmar que nenhum Point, slot ou submissão é modificado. Testar restrição composta no MySQL.

- **E1 a produzir:** Central CBC com cenário permitido selecionado.
- **E2 a produzir:** Central e cena recarregadas preservando somente a preferência do usuário.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.

# Exercício 17 — Tipo de dinâmica da Trend

**Situação na revisão `9f5512a77`:** Base implementada: kind validado contra cinco códigos, com lista filtrável e publicação separada.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema/entidade.** Reutilizar [CommunityTrend.java:14](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/CommunityTrend.java#L14) e [V63__community_trends.sql:2](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V63__community_trends.sql#L2). Campo `kind` é VARCHAR validado; não é FK e não existe uma tabela de dinâmicas obrigatória pelo enunciado.

2. **Repository.** Reutilizar [CommunityTrendRepository.java:13](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/CommunityTrendRepository.java#L13), consultas por status/janela e por kind. Preservar paginação; o filtro não deve incluir rascunhos de outras pessoas.

3. **DTO/service.** Códigos permitidos em [CommunityTrendService.java:22](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/CommunityTrendService.java#L22); `Create` recebe kind e create valida antes de gravar. Reutilizar [CommunityTrendService.java:53](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/CommunityTrendService.java#L53) para publicar e conceder pontos uma vez, sem dar prêmio pela simples criação/seleção.

4. **Controller.** [CommunityTrendController.java:12](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/CommunityTrendController.java#L12) já tem POST, GET com kind e POST `{id}/publish`. Não criar outro `/api/trends` incompatível. Se a atividade exigir edição do rascunho, criar PUT específico com dono/status DRAFT e revalidar kind; não liberar update irrestrito de trend publicada.

5. **UI/leitura.** Reutilizar [community-trends.tsx:14](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/challenges/community-trends.tsx#L14): oferecer somente os códigos reais e traduzir labels, serializar kind e filtrar a lista da comunidade. Loading, erro/retry e confirmação de publicação devem ser distintos do rascunho.

## Arquivos novos propostos e ponto de inserção

Nenhum arquivo de produção novo é obrigatório para a solução base descrita; reutilizar os pontos de edição/revisão numerados acima. Novos testes podem ser adicionados na responsabilidade correspondente.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](solucoes/sql/17-dinamica-trend.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SHOW CREATE TABLE community_trends;
SELECT kind,COUNT(*) AS quantidade FROM community_trends GROUP BY kind;
SELECT id,title,kind,status,published_at,ends_at FROM community_trends
WHERE status='PUBLISHED' AND ends_at>CURRENT_TIMESTAMP(6)
  AND kind='COR_EM_COMUM' ORDER BY published_at DESC;
-- Sem nova tabela/FK: o tipo validado já atende ao exercício.
-- Se for escolhido um CHECK futuro, validar antes todos os kind legados.
```

## Integridade referencial: restrições e alternativas

`kind` não tem FK no modelo; a FK de autor e a política de publicação continuam separadas. Remover um código da allowlist pode tornar rascunhos legados impossíveis de publicar; manter leitura/edição assistida ou criar equivalência explícita é alternativa. Uma tabela de opções é viável em evolução futura, com FK nullable e migração apenas de códigos conhecidos. Não apagar a trend para corrigir kind: eventos/recompensas e referência histórica devem ser preservados, e reenvio não pode duplicar ledger.

## Contrato HTTP

Existente: `POST /api/challenges/trends` com `{"title":"Azul em comum","description":"Uma composição por pessoa","kind":"COR_EM_COMUM","durationDays":7}`; depois `POST /api/challenges/trends/{id}/publish`.

Resposta/projeção a conferir: `"kind":"COR_EM_COMUM", "status":"PUBLISHED"`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Cinco códigos válidos; inválido rejeitado; duração fora da regra; publicar trend de outro usuário; reenvio e concorrência não duplicam pontos. GET filtrado só retorna publicadas na janela; criar rascunho não concede recompensa.

- **E1 a produzir:** Criação da trend com dinâmica explícita.
- **E2 a produzir:** Lista da comunidade recarregada com tipo e publicação persistidos.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.

# Exercício 18 — Peça Assinatura do perfil e histórico

**Situação na revisão `9f5512a77`:** Proposta: não foi localizada relação de Peça Assinatura pessoal; não confundir com assinatura de marca/estilo.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema.** Criar escolha atual e histórico, sem reutilizar `KbBrandSignature` ou o JSON de estilo de celebridade. [WardrobeItem.java:56](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/WardrobeItem.java#L56) é a peça física/digital do guarda-roupa; seu dono precisa coincidir com o perfil.

2. **Entidades.** Criar `UserSignaturePiece` com usuário e peça atual e `SignaturePieceHistory` com usuário, peça nullable, snapshot público mínimo e changedAt. Snapshot não deve copiar notas, localização de compra ou fotos privadas para um perfil público.

3. **Repositories.** Reutilizar [WardrobeItemRepository.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/WardrobeItemRepository.java#L19) para carregar peça e conferir dono. Criar repository da escolha com lock por usuário/expectedVersion e repository do histórico paginado. Se a escolha ainda não existe, serializar pelo lock do usuário ou tratar concorrência de insert único.

4. **Service.** Criar `SignaturePieceService` transacional: autorizar usuário, carregar peça própria não arquivada, substituir escolha e registrar somente uma mudança efetiva. A chave composta do SQL reforça o vínculo com o dono; ainda validar visibilidade ao projetar em [ProfileService.java:104](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/ProfileService.java#L104). Leitura pública não deve vazar peça privada.

5. **Controller.** Novo `PUT /api/me/signature-piece` e `DELETE` para limpar; GET contextual do perfil/histórico por service de visibilidade, integrado ao [ProfileController.java:16](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/ProfileController.java#L16). Não permitir visitante selecionar peça para outro usuário.

6. **UI e álbum.** Criar `SignaturePiecePicker` na edição de perfil em [edit-profile.tsx:16](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/edit-profile.tsx#L16); lista apenas peças próprias elegíveis. No [public-profile-card.tsx:12](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/public-profile-card.tsx#L12)/perfil mostrar seleção autorizada. Criar aba de histórico no álbum com paginação, estado vazio e erro/retry; escolha privada pode aparecer só ao dono ou pedir publicação deliberada.

## Arquivos novos propostos e ponto de inserção

Criar a partir da **linha 1**, se ainda não existirem no lote anterior. São caminhos de implementação propostos; não arquivos já entregues por este gabarito. Helpers compartilhados entre exercícios devem ser criados uma única vez. No exercício13, entidade/repository de requisito são somente para a alternativa relacional.

- `fai-domain/src/main/java/br/com/fashionai/domain/model/UserSignaturePiece.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/model/SignaturePieceHistory.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/repository/UserSignaturePieceRepository.java`.
- `fai-domain/src/main/java/br/com/fashionai/domain/repository/SignaturePieceHistoryRepository.java`.
- `fai-application/src/main/java/br/com/fashionai/application/service/SignaturePieceService.java`.
- `fai-web/src/main/java/br/com/fashionai/web/controller/SignaturePieceController.java`.
- `components/signature-piece-picker.tsx`.
- `components/signature-piece-history.tsx`.

Se escolher aplicar o DDL faltante, criar na **linha 1** a migration `fai-infrastructure/persistence-mysql/src/main/resources/db/migration/V<PROXIMA_VERSAO_LIVRE>__ex18.sql`, substituindo o placeholder por versão realmente livre. O SQL didático não deve ser copiado inteiro sem inspecionar o schema.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](solucoes/sql/18-peca-assinatura.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
-- Índice redundante ao PK global, mas necessário como chave referenciada na ordem owner+piece.
-- Conferir se já existe índice UNIQUE equivalente antes de adicionar.
ALTER TABLE wardrobe_items ADD CONSTRAINT uq_wardrobe_owner_piece UNIQUE(user_id,id);
CREATE TABLE user_signature_pieces (
  user_id CHAR(36) NOT NULL PRIMARY KEY,piece_id CHAR(36) NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,updated_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_usp_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_usp_owned_piece FOREIGN KEY(user_id,piece_id)
    REFERENCES wardrobe_items(user_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE signature_piece_history (
  id CHAR(36) NOT NULL PRIMARY KEY,user_id CHAR(36) NOT NULL,piece_id CHAR(36) NULL,
  snapshot_json JSON NULL,changed_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_sph_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT fk_sph_piece FOREIGN KEY(piece_id) REFERENCES wardrobe_items(id) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE=InnoDB;
SELECT u.user_id,u.piece_id,w.name FROM user_signature_pieces u
JOIN wardrobe_items w ON w.id=u.piece_id AND w.user_id=u.user_id WHERE u.user_id=@owner_id;
```

## Integridade referencial: restrições e alternativas

A FK composta impede selecionar peça de outro dono também no SQL. Enquanto a peça for assinatura atual, exclusão/transferência do dono da peça é RESTRICT; limpar/substituir a escolha antes da transferência na mesma operação autorizada, ou bloquear a transferência com mensagem clara. O histórico usa SET NULL simples e mantém snapshot: evita o erro de tentar SET NULL numa FK composta cujo user_id é NOT NULL. O histórico não garante propriedade sozinho; o service autoriza ao gravar. Na exclusão da conta, remover escolha atual antes de peças; não depender de uma ordem de cascatas que possa encontrar o RESTRICT. Alternativa mais simples: FK simples+checagem de dono no service, assumindo explicitamente a ausência de reforço SQL da propriedade.

## Contrato HTTP

Novo `PUT /api/me/signature-piece` com `{"pieceId":"<UUID próprio>","expectedVersion":0}`; DELETE remove a escolha atual sem apagar o histórico. A leitura pública respeita a visibilidade da peça.

Resposta/projeção a conferir: `"signaturePiece":{"id":"...","name":"..."}, "history":[{"pieceId":"...","changedAt":"..."}]`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Peça própria válida, alheia, arquivada e privada; troca idempotente; concorrência; exclusão da peça/conta; transferência; histórico com pieceId null. Perfil público não recebe notas/fotos privadas. SQL tentando selecionar peça de terceiro deve falhar pela FK composta.

- **E1 a produzir:** Perfil escolhendo peça própria com confirmação de visibilidade.
- **E2 a produzir:** Perfil e álbum recarregados com escolha e histórico autorizados.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.

# Exercício 19 — Modalidade visual da peça na AURA

**Situação na revisão `9f5512a77`:** Parcial: existe aura.format no contrato da Aura comum; explicitar validação/persistência sem criar modalidade paralela.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Definição do exercício.** Usar modalidade visual `aura.format=IMAGEM_UNICA|MOSAICO`, já declarada no [background-studio.tsx:24](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/background-studio.tsx#L24). Isso não é categoria da roupa, enquadramento tecido/total frame ou tier Bronze/Ouro. Não criar outro campo chamado mode para a mesma escolha.

2. **Schema/repository.** Reutilizar `wardrobe_items.background_config_json` e [WardrobeItemRepository.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/WardrobeItemRepository.java#L19). Não há nova tabela exigida: o enunciado permite config validada. Guardar o formato dentro do objeto aura existente, preservando variantId e o restante da arte.

3. **Service.** Na validação pura de [StudioArtworkRules.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/StudioArtworkRules.java#L19), acrescentar/confirmar allowlist do formato e tipo do objeto aura. O endpoint de [BackgroundStudioService.java:620](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/BackgroundStudioService.java#L620) já exige permissão e dono. Não remover `requireAuraAccess` nem a checagem da configuração completa de artes licenciadas ao editar só o formato.

4. **Controller.** Reutilizar [BackgroundController.java:77](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/BackgroundController.java#L77); o corpo é a configuração, não um wrapper background. Validar preset/variantId em catálogo autorizado e rejeitar tipo/formato inválido. Se o endpoint espera config inteira, enviar cópia atual com o formato alterado para não apagar os demais campos.

5. **UI/leitura.** O seletor já está em [background-studio.tsx:181](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/background-studio.tsx#L181); manter blocos acessíveis e conservar rascunho no erro. No render de [card-art.tsx:14](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/card-art.tsx#L14) e [expanded-piece.tsx:63](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/expanded-card/expanded-piece.tsx#L63), derivar do background confirmado pelo GET. Tratar animação carregando/falha e alternativa identificada; não só trocar uma classe local sem persistência.

## Arquivos novos propostos e ponto de inserção

Nenhum arquivo de produção novo é obrigatório para a solução base descrita; reutilizar os pontos de edição/revisão numerados acima. Novos testes podem ser adicionados na responsabilidade correspondente.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](solucoes/sql/19-modalidade-aura.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SELECT id,user_id,
  JSON_EXTRACT(background_config_json,'$.aura.variantId') AS variant_id,
  JSON_EXTRACT(background_config_json,'$.aura.format') AS formato
FROM wardrobe_items WHERE id=@piece_id AND user_id=@owner_id;
SELECT id FROM wardrobe_items
WHERE JSON_EXTRACT(background_config_json,'$.aura.format') IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(background_config_json,'$.aura.format')) NOT IN ('IMAGEM_UNICA','MOSAICO');
-- Sem ALTER; a API deve validar e salvar a configuração inteira necessária. Não escrever artes licenciadas por SQL.
```

## Integridade referencial: restrições e alternativas

JSON é estruturalmente válido como tipo MySQL, mas variantId/entitlement dentro dele não são FKs automáticas. Alternativas: manter validação de catálogo/licença no backend; ou normalizar a seleção/licença em tabela própria se for necessária FK SQL. Preset removido deve ter estado de indisponibilidade/fallback definido; nunca substituir arte comprada por outra silenciosamente. Só adicionar CHECK de formato depois de inspecionar dados legados e o contrato, sem bloquear configs antigas sem aura.

## Contrato HTTP

Existente: `PUT /api/pieces/{id}/background`; recorte `{"aura":{"variantId":"<variante autorizada>","format":"MOSAICO"}}`. Enviar também os demais campos que devam permanecer na configuração.

Resposta/projeção a conferir: `"background":{"aura":{"variantId":"...","format":"MOSAICO"}}`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Dois formatos; formato inválido/tipo errado; peça alheia; preset/licença incompatíveis; edição conserva borda/paleta compradas; escolha sobrevive ao GET e é igual em Feed/detalhe. Distinguir controle de enquadramento de fotografia desta modalidade visual.

- **E1 a produzir:** Editor de Aura comum escolhendo Mosaico.
- **E2 a produzir:** Feed e detalhe recarregados exibindo o mesmo formato.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.

# Exercício 20 — Variante do catálogo por SKU e cor

**Situação na revisão `9f5512a77`:** A query por identificador já correlaciona SKU e cor na mesma variante; manter isso e testar seleção/criação.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema/modelos.** `CatalogProduct` e `CatalogVariant` são distintos: [CatalogProduct.java:71](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/CatalogProduct.java#L71) e [CatalogVariant.java:34](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/CatalogVariant.java#L34). `wardrobe_items.catalog_product_id` e `catalog_variant_id` preservam a origem. Não criar outra coluna sku no produto/peça se ela já existe.

2. **Repository.** A query correta está em [CatalogProductRepository.java:79](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/CatalogProductRepository.java#L79); seu EXISTS testa identificador e cor no mesmo alias v. Manter o countQuery equivalente. Em [CatalogVariantRepository.java:17](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/CatalogVariantRepository.java#L17), resolver a variante pelo produto e ID; SKU não é necessariamente único no catálogo inteiro.

3. **Service.** Em [CatalogService.java:647](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/catalog/CatalogService.java#L647) / [CatalogService.java:660](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/catalog/CatalogService.java#L660), preservar o filtro que exige variante do produto. Cor declarada no payload não pode contradizer a variante selecionada: validar/rejeitar conflito antes de escolher a cor final, sem deixar `firstValid(a.color(),...)` mascarar a identidade. Não usar fallback para outra cor/foto após escolher variante.

4. **Controller.** [CatalogController.java:34](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/CatalogController.java#L34) aceita `code` separado de q e color. Usar os endpoints atuais de produto/seleção/inclusão do mesmo controller, mantendo productId+variantId na requisição. Não interpretar texto de nome como SKU garantido.

5. **Frontend/projeção.** Em [catalog-search.tsx:60](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/catalog/catalog-search.tsx#L60), preservar selectedVariant e color do resultado; limpar seleção incompatível quando os filtros mudarem. Serializar IDs em [catalog.ts:28](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/lib/api/catalog.ts#L28) e mostrar produto, SKU e cor confirmados na peça criada em [expanded-piece.tsx:63](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/expanded-card/expanded-piece.tsx#L63). Loading/erro não deve deixar uma variante velha ativa sobre um produto novo.

## Arquivos novos propostos e ponto de inserção

Nenhum arquivo de produção novo é obrigatório para a solução base descrita; reutilizar os pontos de edição/revisão numerados acima. Novos testes podem ser adicionados na responsabilidade correspondente.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](solucoes/sql/20-sku-cor.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SHOW CREATE TABLE catalog_products;
SHOW CREATE TABLE catalog_variants;
SHOW CREATE TABLE wardrobe_items;
-- SKU de variante e cor exigidos no MESMO registro v:
SELECT p.id AS product_id,v.id AS variant_id,v.sku,v.color
FROM catalog_products p JOIN catalog_variants v ON v.product_id=p.id
WHERE LOWER(v.sku)=LOWER(@sku) AND v.color=@color;
-- SKU não é globalmente único; limitar também por produto/marca quando necessário.
SELECT w.id,w.catalog_product_id,w.catalog_variant_id,v.sku,v.color
FROM wardrobe_items w JOIN catalog_variants v ON v.id=w.catalog_variant_id
WHERE w.id=@piece_id AND w.user_id=@owner_id;
SELECT w.id FROM wardrobe_items w JOIN catalog_variants v ON v.id=w.catalog_variant_id
WHERE w.catalog_product_id IS NULL OR w.catalog_product_id<>v.product_id;
```

## Integridade referencial: restrições e alternativas

Na política V34, produto→variantes tem CASCADE; wardrobe_items→produto tem RESTRICT; wardrobe_items→variante tem SET NULL. Assim, produto usado por peça não deve ser apagado, e apagar só a variante pode perder esse vínculo sem apagar a peça. Inativar produto/variante e preservar snapshot é alternativa. Duas FKs separadas não provam que a variante pertence ao produto: isso já é validado no service. Para reforço SQL, considerar UNIQUE(product_id,id) em catalog_variants e FK composta na peça, após limpar inconsistências; escolher RESTRICT e rever a FK simples existente. Não usar SET NULL composto sem avaliar que também apagaria catalog_product_id. Não tornar SKU globalmente UNIQUE: marcas/produtos podem reutilizar códigos e o índice UNIQUE(product_id,variant_key) tem outra semântica.

## Contrato HTTP

Existente: `GET /api/catalog/search?code=SKU-A&color=blue` (com filtros necessários de marca/categoria). Ao adicionar, enviar `productId` e `variantId` retornados pelo resultado, nunca apenas o nome da cor.

Resposta/projeção a conferir: `"productId":"...", "selectedVariant":{"id":"...","sku":"SKU-A","color":"blue"}; peça criada mantém catalogProductId/catalogVariantId`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Produto com SKU-A azul e SKU-B vermelho: SKU-A+vermelho não pode passar pelo ramo de SKU de variante. Cobrir SKU do produto (semântica separada), variante de outro produto, cor do payload conflitante, SKU repetido em outra marca, count/paginação, foto indisponível e reload da peça preservando IDs/SKU/cor.

- **E1 a produzir:** Resultado selecionado com SKU e cor da mesma variante.
- **E2 a produzir:** Peça criada e recarregada com a origem e a variante corretas.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.
