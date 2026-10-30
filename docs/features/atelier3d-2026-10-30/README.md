# RF45 — editor 3D colaborativo: primeira entrega

O projeto do FAI Atelier abre um editor GLB em `/atelier/projects/{id}/editor`. O criador importa o original, edita a cena e salva versões. Participantes autorizados usam a sessão existente; convidados recebem uma capacidade temporária limitada ao projeto.

## TipoLook e catálogo

- `CatalogProduct.gender`, da entidade `catalog_products`, é lido novamente no servidor ao salvar. Não há alteração nessa tabela nem migração do seu gênero.
- Masculino com unissex sugere masculino; feminino com unissex sugere feminino; somente unissex sugere unissex. Masculino e feminino juntos geram conflito. Dados ausentes ou não reconhecidos ficam pendentes.
- A sugestão nunca seleciona a decisão final. O criador escolhe um ID real de `TipoLook`, inclusive podendo discordar da sugestão. Um rascunho pode ficar sem decisão; a exportação final exige confirmação e versão salva.
- As evidências e seu hash são versionados. Mudanças de produtos ou de `gender` exigem nova confirmação; uma evidência desatualizada é recusada pelo backend.

## Entrega funcional

- Importação de GLB 2.0 autocontido, seleção de objetos, mover/rotacionar/escalar com gizmo e campos numéricos, visibilidade, vistas ortográficas/perspectiva, órbita, zoom e enquadramento.
- Material PBR: cor, roughness, metalness e transformação das texturas existentes. Não cria automaticamente tecido, logos ou UVs novos.
- Vértices de malhas estáticas por índice/posição; desfazer/refazer local até 30 passos.
- Autosave, versões, restauração como novo rascunho e exportação GLB. O original é imutável, deduplicado por SHA-256 no projeto, separado do documento de alterações.
- Convites VIEWER/EDITOR com validade de 1–168 horas, revogação e opção de exportação. O token é retornado uma vez, trafega no fragmento do link e depois no header `X-Atelier-Guest`; no banco fica somente seu hash. O link é compartilhado manualmente.
- Concorrência por versão esperada, lock do projeto, comandos idempotentes e HTTP 409 sem descarte do rascunho. A interface consulta novas versões a cada 15 segundos; não implementa presença/WebSocket ou edição simultânea de vértices.

## Arquivos e dados

| Área | Implementação |
|---|---|
| Tela e estados de loading/erro/conflito/dirty/readonly | `components/atelier3d/editor.tsx` |
| Canvas, câmera, gizmos, seleção | `components/atelier3d/viewport.tsx` |
| Composição e confirmação | `components/atelier3d/gender-panel.tsx` |
| Convidados e compartilhamento | `guest-panel.tsx`, `guest-editor.tsx`, `scene-api.ts` |
| GLB, materiais, posições e exportação | `lib/atelier3d/document.ts` |
| Serviços Java | `Atelier3dService`, `GlbInspector`, `CatalogGenderDecision`; acesso reutilizado de `AtelierProjectService` |
| API e segurança | `Atelier3dController`, `SecurityConfig` |
| Entidades | `DesignAsset`, `DesignSceneVersion`, `DesignGuestInvite` |
| Migração | `V84__atelier_3d_editor.sql`: `atelier_3d_assets`, `atelier_3d_versions`, `atelier_3d_guests` |

Os originais são armazenados em LONGTEXT criptografado pelo conversor existente, sem URL pública, e entregues somente após autorização. As consultas de metadados não carregam/decriptam o binário. Esta primeira implementação limita cada GLB a 8 MiB, 500 mil vértices, 2 mil objetos, uma cena e 20 originais por projeto. Texturas PNG/JPEG incorporadas: até 4096 px por lado e 32 milhões de pixels no total. Extensões não suportadas e recursos externos são recusados.

## Validação e evidências

- 41 testes Java passaram: inspeção GLB, decisão pelo catálogo, autorização e idempotência, persistência Hibernate/H2 com criptografia/projeções, segurança HTTP e regressões de colaboração.
- 19 testes frontend passaram: round-trip GLB com transformação/material/vértices, preservação de skeleton/morph/animação, escolha explícita de TipoLook, invalidação da confirmação após alteração do catálogo e regressões do Atelier existente.
- TypeScript e `npm run lint` passaram; i18n sem erros e sem textos embutidos. Os dez avisos de tradução restantes estão fora das novas chaves.
- `scripts/atelier3d/verify-editor.cjs` executa upload, renderização WebGL, confirmação, save/reload, exportação binária, conflito, VIEWER e revogação com uma API em memória e uma geometria sintética. **As capturas não são dados de produção nem prova de caimento de uma marca.**
- [E1: importação com confirmação pendente](E1-importacao-confirmacao-pendente.png).
- [E2: edição salva com TipoLook confirmado](E2-versao-salva-tipo-look-confirmado.png).

O navegador local usa as dependências já instaladas no ambiente (Next 16.4.2); o lockfile da main determina as versões do CI. A migração não foi aplicada ao banco de produção e esta entrega não foi implantada em produção.

## Limites da entrega

Isto é o núcleo inicial do editor, não paridade com Blender. Retopologia, subdivisão, extrusão, costura de moldes, edição visual avançada de UV, pintura de textura, simulação física, workers Blender/GPU, presença em tempo real e integração da cena com o avatar/provador permanecem etapas posteriores do RF45. Rig/morph/animação são preservados na importação/exportação testada; a edição de seus vértices é bloqueada. Desligar o botão de exportação não é DRM: a renderização exige entregar os bytes ao navegador autorizado.
