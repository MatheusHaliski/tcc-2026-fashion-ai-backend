# Insumos externos

Os HTMLs de artefato guardados aqui são a **casca do visualizador** do Claude — o conteúdo real
carrega num `<iframe>`. Para ler o conteúdo, use a URL do artefato na tabela abaixo.

## Recebidos

| Insumo | Arquivo local | Artefato | O que gerou |
|---|---|---|---|
| ✅ **Padrões de interface LGPD** (anexo do RNF6) | `lgpd/padroes-interface-lgpd.html` | *(HTML autocontido)* | RF3.CA19–CA24, mapa direito→controle de UI, tabela de anti-padrões, spec do artefato #6 |
| ✅ **Vinte pranchas** (Firefly/Illustrator) | `pranchas/vinte-pranchas-firefly.html` | [bb3132be](https://claude.ai/code/artifact/bb3132be-c756-4e95-bef1-022e3b5faf66) | Catálogo das 20 pranchas em 5 famílias, Coleções D/E/F, delta de RF20/RF21 (tiers de selo) |
| ✅ **Aula — Perfil Lookbook** | `aulas/perfil-lookbook.html` | [f23e3514](https://claude.ai/code/artifact/f23e3514-1db3-4bbb-8c9b-b99cae674c4f) | ⏳ pendente de confronto com os CAs de RF6 |
| ✅ **Aula — DNA de Estilo (Mosaico de Eras)** | `aulas/dna-de-estilo-mosaico-de-eras.html` | [1449ec78](https://claude.ai/code/artifact/1449ec78-f56b-4025-b3d3-64e6cc050ff0) | ⏳ pendente — **conflita com a HU20**, ver aviso abaixo |
| ✅ **Aula — Closet Inteligente** | `aulas/closet-inteligente.html` | [720ca125](https://claude.ai/code/artifact/720ca125-eea2-4719-8372-d874f94de46f) | ⏳ pendente de confronto com os CAs de RF6 |

| ✅ **Modelagem UML & mapa de estado** (inclui a **Parte 3** dimensional dos cards) | `uml/modelagem-fashion-ai.html` | [8c050ab5](https://claude.ai/code/artifact/8c050ab5-8faf-4073-a077-dd8e492db661) | Spec do artefato #7 com cotas em mm; 7 CAs novos (doc `02`, §4.1); entidades do ER |

## Todos os insumos foram recebidos

Não falta mais nenhum anexo externo.

### ⚠️ Correção do time sobre a Parte 3

Os quatro desenhos de card **não incluem** a faixa de toggles do **topo** do card:
⭐ **favoritar** (estrelinha pequena, padrão Spotify) · **disponível** · **indisponível** (pequeno, só a letra).

Consequências, já aplicadas nos documentos `02`, `04` e `05`:
- os toggles do RF31 ficam **no topo**, não no rodapé — o rodapé é do RF19 (curtir, comentar, compartilhar, remixar, retornar, editar);
- **"todos" não é toggle de card** — é o filtro da lista, no header, ao lado do filtro de ocasião;
- a **altura dessa faixa não está cotada**. Proposta a validar: 8–10 mm, o que levaria Vestimenta compacto de 164 para ~172–174 mm e o ampliado de 216 para ~224–226 mm. **Confirmar com quem desenhou.**

## ⚠️ Conflito aberto: qual é o DNA de Estilo?

Há duas definições incompatíveis do RF13 circulando, e o time precisa escolher **uma**:

| Fonte | Definição |
|---|---|
| **HU20** (`markdowns/HU20.md`, versionada) | Cartão de identidade gerado por IA: arquétipo, paleta cromática, padrão de silhueta, índice de ousadia, peça ícone + Identidade de Vida declarada + Frase de Identidade |
| **Aula "DNA de Estilo — Mosaico de Eras"** + artefato das pranchas | Nova **tipologia de publicação**: 2 a 6 esquemas já criados se fundem num card-retrato, com flag `isDNAdeEstilo`, campo `mosaicLayout` e rótulo de era por célula |

Os CAs de RF13 no documento `02` foram escritos **a partir da HU20**. Se a definição de mosaico
prevalecer, RF13.CA01–CA09 precisam ser reescritos. As duas podem coexistir (o mosaico como
*formato de apresentação* do card gerado pela HU20), mas isso é decisão do time, não inferência.

Nada aqui deve conter dados reais de usuário.
