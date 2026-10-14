# Studio de Eras & Coleções — estado e referências

## Implementado nesta edição

- Contrato editorial compartilhado entre formulário manual e Copilot: seis temas, treze símbolos, frase editorial, até quarenta marcos datados e até vinte e quatro fotos com texto alternativo.
- Persistência JSON em `scheme_groupings`, via V66; APIs existentes de criação/edição e respostas da vitrine incluem `editorial`.
- Prévia de palco com luzes CSS originais; timeline ordenada por data; mural; vínculo existente com catálogo de peças e looks da Era.
- Upload de fotos e capa antes de salvar a Era em `/api/era-studio/uploads`, com verificação do emissor e normalização de imagem. Campos de foto só aceitam mídia própria ou catálogo autorizado.
- Copilot governado pelo motor existente: `/api/era-studio/draft`; retorno local explicitamente identificado. Não inventa fotos nem cronologia. Fotos não são enviadas ao provedor nesse fluxo.
- Compra de itens da loja do quarto credita o criador em FAI Points dentro da mesma transação do débito e da entrega, com taxa zero. Compra própria rejeitada; vendas não pontuam nível vitalício. Painel de criações usa crédito registrado, em vez de multiplicar vendas antigas pelo preço atual.

## Pesquisa executada

`scripts/design/research_celebrity_eras.py` pesquisou treze artistas de EUA, Brasil, Espanha, Canadá, Reino Unido, Coreia do Sul, Colômbia e Porto Rico. Resultado filtrado: 37 referências, sem erros de consulta. Os dados estão em `era-research.json`; consulta é referência editorial, não autorização para reutilizar fotos ou GIFs.

| Referência informada pelo usuário | Direção editorial | Elementos |
|---|---|---|
| Taylor Swift — Lover / Midnights | Pastéis luminosos; azul/roxo noturno | Borboletas, corações, lua, relógios e velas |
| Beyoncé — Renaissance / Cowboy Carter | Prata disco; western futurista | Cavalo, coroa, globo espelhado, holofotes |
| Lady Gaga — Chromatica / Born This Way | Rosa cyberpunk; industrial | Metal, símbolos, neon e motos |
| Anitta — Funk Generation | Baile 2000s e streetwear carioca | Microfone, alto-falantes, graffiti, faíscas |
| Rosalía — Motomami | Vermelho/preto; motociclismo industrial | Borboleta, moto, tinta e formas minimalistas |

Os presets do app são temas genéricos originais e editáveis; não são capas oficiais desses álbuns nem endosso dos artistas. O pipeline filtra o nome do artista no título/resumo, mas a relevância de cada fonte ainda exige curadoria. Artistas sem referências filtradas não recebem fontes inventadas.

## Pendências explícitas

- Comprovação integrada MySQL das migrações, concorrência de compras e rollback de débito/crédito/entrega.
- Capturas com contas reais e publicação real, além da evidência de UI com API simulada.
- Biblioteca curada e licenciada de GIFs/elementos animados, preservação de GIF no upload e paralaxe controlável. O upload atual normaliza fotos para JPEG; as luzes são animações CSS, não GIFs importados.
- Venda de roupas e acessórios exclusivos vinculados à Era em todas as categorias da loja. O repasse implementado cobre os itens do catálogo de quarto que possuem criador; não comprova uma loja genérica de roupas ainda.
- Hierarquia principal/secundária de destaque e holofotes vinculados à política de perfil; modalidades FLAIR novas permanecem propostas, com contrato em `FLAIR_METAMORFOSE_CENARIOS.md`.
