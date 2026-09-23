# RF23 — Prompts do Design System "Metal Prata/Platina" (Estúdio de Interface)

**Projeto:** FashionAI — nova interface (repositório novo, base limpa)
**RF de origem:** RF23 — Configurações → Aparência (Estúdio de Interface: cores, modais, menu lateral, botões), conforme `RF23_Configuracoes_Atividades.puml` do repositório principal (`matheushaliski/sai-tcc-2026`).
**Escopo desta pasta:** prompts de texto prontos (briefing de design / entrada para ferramenta de geração de UI com IA) para o acabamento metálico "Prata/Platina" de toda a casca (chrome) da interface — nunca do conteúdo inserido pelo usuário (fotos de peça, arte de fundo Aura, texto de esquema).

## Paleta escolhida

**Prata/Platina** — cinza-aço frio com reflexos brancos-azulados. Escolhida por ser neutra o bastante para nunca competir com as cores reais de peças/looks/arte Aura exibidas dentro do chrome que ela emoldura.

## Regra de ouro (vale para todos os arquivos abaixo)

> O metal marca **hierarquia e território** — o que é casca fixa do app vs. o que é conteúdo do usuário — nunca decoração livre. Quanto mais "de trabalho" for a superfície (formulário, preview de imagem, área de leitura longa), mais o metal deve recuar para bordas finas e ficar restrito a cabeçalho/rodapé/moldura. Nunca cubra uma área grande de conteúdo do usuário com gradiente cheio.

## Índice de arquivos

| Arquivo | Elemento coberto |
|---|---|
| `00_vocabulario_base_gradiente.md` | Vocabulário-base reutilizável — estrutura de paradas, direção, textura, borda, sombra. Leia primeiro; os demais arquivos referenciam este. |
| `01_divs_sections_containers.md` | Containers/sections genéricos de conteúdo |
| `02_forms.md` | Inputs, selects, textareas, botão primário/secundário |
| `03_sidebar.md` | Menu lateral de navegação |
| `04_topbar.md` | Barra superior fixa |
| `05_modal_mensagem.md` | Modal de confirmação/notificação |
| `06_modal_background_studio.md` | Modal de edição de fundo/arte (Aura) |
| `07_modal_edicao_dados.md` | Modal de formulário longo/tabular |
| `08_fontes_interface.md` | Tipografia fixa do chrome (distinta da tipografia de conteúdo/skins de card) |

Cada arquivo (exceto o vocabulário-base) traz duas variantes: **Claro** e **Escuro**.
