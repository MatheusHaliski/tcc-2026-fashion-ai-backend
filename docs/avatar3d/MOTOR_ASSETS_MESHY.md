# Motor de assets Meshy e biblioteca de moldes

## Gerar, revisar e vender

O administrador abre `/admin/room-assets`, envia uma fotografia e escolhe um bloco funcional, preço em FAI Points e nível mínimo. A API grava um job durável; o worker envia a geração ao Meshy e acompanha a tarefa. O arquivo GLB fica no armazenamento configurado da aplicação. Uma revisão aprovada é necessária antes de publicar na loja. As compras reutilizam o mesmo modelo e seguem a transação de pontos existente.

Esta primeira integração aceita tapete, cabide, ilha, expositor de bolsas e porta-joias. Os demais blocos continuam usando seus modelos atuais. A geometria gerada é ajustada com escala uniforme ao espaço do bloco. O administrador deve conferir proporções e compatibilidade com os pontos de interação antes de publicar; a geração não identifica automaticamente prateleiras ou encaixes.

Configure `MESHY_API_KEY` no serviço Java, além do armazenamento S3 já usado pela aplicação. Créditos de API do Meshy podem ser distintos da assinatura do site. Somente a geração consome a API; comprar com pontos não inicia geração. Nenhuma chamada paga foi usada na validação deste PR.

Um `requestId` identifica a solicitação. Repetir o mesmo conteúdo não inicia outra geração. Alterar a foto ou parâmetros com o mesmo identificador retorna conflito. Se o envio ao provedor tiver resultado incerto, a tarefa falha e não é reenviada automaticamente: confira o painel Meshy antes de criar uma nova solicitação. O worker usa bloqueio no banco e lease para evitar envio simultâneo da mesma tarefa por instâncias diferentes.

O download verifica tamanho, estrutura GLB e referências externas. Essa verificação não substitui a revisão visual. Modelos sem aprovação não aparecem na loja. Durante o carregamento ou em caso de erro, o quarto mantém a representação funcional existente.

## Moldes reutilizáveis

`/lab/moulds` (somente ambiente de laboratório) apresenta as 57 referências de roupas e calçados nos corpos feminino e masculino, usando o mesmo renderizador do provador. As fotos originais são preservadas. Regatas e vestidos passaram a cobrir os ombros; a polo tem manga curta e abertura curta de três botões; blusas deixam de receber botões de camisa. A biblioteca usa identificadores únicos mesmo quando duas referências compartilham uma fotografia.

A matriz de 80 subcategorias foi incorporada do commit `0cfedfb5b45d194c51f6a61808eb737fbe40804e` da branch `claude/fashion-ai-interfaces-config-id7naj`. Os relatórios em `docs/avatar3d/matriz-3d` registram componentes implementados, parciais e ausentes. As imagens são projeções de geometria para auditoria, não capturas WebGL com materiais finais. Acessórios, detalhes de calçados e vários acabamentos ainda precisam de modelos próprios. Esta entrega não certifica simulação física de tecido nem ajuste perfeito de todo produto do catálogo.

Para regenerar os relatórios:

```sh
MATRIZ3D_WRITE=1 npx vitest run lib/avatar3d/matriz3d
python3 scripts/avatar3d/matriz3d_xlsx.py
npx vitest run lib/avatar3d/human/mould-library.test.ts lib/avatar3d/human/fit-matrix.test.ts
```

## Diagnóstico do catálogo publicado

O backend precisa disponibilizar `GET /api/catalog/products?page=0&size=24` e `GET /api/catalog/summary`. `total` indica todos os resultados dos filtros; `items.length` indica apenas a página. Na Vercel, `NEXT_PUBLIC_API_BASE_URL` deve apontar para a URL HTTPS do serviço Java, sem `/api` no final. Essa variável é incorporada no build, portanto mudanças exigem novo deploy do frontend.

Um 404 na rota paginada exige verificar a URL requisitada e a versão implantada no Railway. Um 403 com código `DEV_GATE` exige a sessão válida do gate. Não desative a proteção nem envie tokens em mensagens para diagnosticar.

O coletor escreve arquivos; a importação leva as peças ao banco. Depois de configurar as variáveis MySQL no terminal, compare o banco de destino com a interface:

```sh
source .venv/bin/activate
python3 scripts/catalog/audit_catalog_counts.py --output data/catalog/auditoria-contagens.json
```

Essa auditoria é somente leitura. Ela separa marcas cadastradas, marcas com produtos disponíveis e estados de ingestão. Não presume que toda marca cadastrada já tem peças visíveis.
