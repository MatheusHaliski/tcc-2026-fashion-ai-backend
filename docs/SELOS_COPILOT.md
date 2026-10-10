# Criador de selos com Copilot

A política de um selo novo é criada pelo Copilot especializado `#createsealpolicy`. O emissor escolhe o nível e descreve as condições; o modelo usa a taxonomia, as marcas, os fundos e os selos cadastrados. Se faltar informação, o Copilot faz perguntas e mantém o pedido original. A geração não cadastra uma peça ou look real.

- **PECA**: define os critérios para conquistar o selo em uma peça.
- **LOOK**: define os critérios para conquistar o selo em um look, incluindo quantidades e combinações de peças.
- **PERFIL**: define quais peças e looks aparecem nos destaques do perfil da marca ou celebridade. Não emite outro selo ao item. O modelo especifica `target: PECA | LOOK | BOTH`.

O modelo de referência fica em `backgroundConfigJson.policy.referenceModel`, com versão, descrição, componentes, quantificadores (`AT_LEAST`, `EXACTLY`, `ALL`, `NONE`), mínimo/máximo de peças, atributos e filtros de fundo. `match: ALL | ANY` combina os componentes. Campos não exigidos ficam livres. Critérios desconhecidos são recusados; atributos exigidos e ausentes não aprovam o item.

`earnedSeals` permite exigir selos já conquistados no próprio item:

```json
{
  "match": "ALL",
  "rules": [
    {"sealId": "uuid-do-selo", "name": "Selo cadastrado", "scope": "PIECES", "minCount": 1},
    {"sealId": "uuid-do-outro-selo", "name": "Outro selo", "scope": "LOOK", "minCount": 1}
  ]
}
```

`PIECES` conta peças distintas cobertas pelo selo; `LOOK` exige um selo no próprio look; `ANY` aceita ambos. `ALL` exige todas as regras e `ANY` exige ao menos uma. Só vínculos aprovados, vigentes e sem revalidação pendente contam. Um selo conquistado em outro look não satisfaz um requisito `LOOK` do item atual. Políticas PERFIL não servem como selos conquistados, evitando dependências circulares.

Os destaques são calculados ao consultar o perfil. Com uma política PERFIL ativa, apenas os itens elegíveis aparecem nos destaques; a privacidade, bloqueios, moderação e estado da conta continuam sendo verificados. Sem essa política, os destaques existentes por vínculos de selos são preservados. O histórico de looks consagrados mantém os vínculos anteriores, inclusive expirados, identificados como histórico.

`POST /api/copilot/seal-policy` recebe `tier`, `message` iniciada pela hashtag e `previousPolicy` opcional. Retorna `VALID` com o modelo e a inferência, ou `INCOMPLETE` com perguntas. A mesma hashtag é reconhecida no Copilot geral. Não há sugestão local substituindo uma geração indisponível: a API retorna erro e o cliente preserva o último modelo.

Publicar uma política nova ou alterada exige `policy.aiInferenceId`, pertencente ao emissor, com inferência remota bem-sucedida e digest da política idêntico ao registrado. O comprovante não é armazenado como critério do selo. Nome, arte e disponibilidade podem ser ajustados sem alterar o modelo. O resgate e a aprovação do vínculo reavaliam o modelo, impedindo que alterações posteriores liberem um selo indevido.

O nível PERFIL é persistido como um valor próprio; não é convertido em LOOK. As colunas existentes são VARCHAR e não precisam de migração para esse valor.
