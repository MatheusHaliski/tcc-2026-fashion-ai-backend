# Auditoria de ferramentas 3D do FAI Atelier — 5/11/2026

Base inspecionada: `d0b78b8e` (`origin/main` no início deste lote). Esta auditoria diferencia o editor de GLB existente de um modelador completo. O inventário abaixo descreve a base; os comandos acrescentados pelo lote devem ter testes próprios e evidência de persistência/exportação.

## O que o editor representa

O documento salva alterações de objetos (`position`, `rotation`, `scale`, `visible`), parâmetros de materiais por primitiva e coordenadas absolutas de vértices existentes. Não salva índices/faces novos, grupos de seleção, UVs individuais, ossos, pesos, modificadores, grafos ou simulação.

Referências: [document.ts](../../lib/atelier3d/document.ts), [scene-inspector.tsx](../../components/atelier3d/scene-inspector.tsx), [viewport.tsx](../../components/atelier3d/viewport.tsx), [Atelier3dService.java](../../fai-application/src/main/java/br/com/fashionai/application/atelier3d/Atelier3dService.java).

Importar um GLB e modificá-lo é um fluxo existente. Criar uma camisa com modelagem industrial, costurar painéis e simular caimento não é capacidade comprovada desse contrato. A fixture visual de camisa usa três volumes retangulares e serve para verificar ferramentas; não certifica anatomia, costura ou vestibilidade.

## Matriz de capacidades da base

| Família de comandos do Blender | Capacidade real no FAI Atelier | O que falta para equivalência |
|---|---|---|
| Seleção de objetos / Outliner | Seleção de nó pela lista e clique na viewport; contorno de seleção | Multisseleção, coleções, hierarquias editáveis e seleção por critérios |
| Mover / girar / escalar (G/R/S) | Gizmo, campos XYZ, atalhos e snap | Espaços local/global configuráveis, pivôs, orientação customizada e restrições modais por eixo |
| Transformações de precisão | Posição em unidades do arquivo, rotação em graus na UI, escala positiva | Unidade física declarada, conversão m/cm e aplicação de transformação à geometria |
| Visibilidade | `NodeEdit.visible` e controle no inspetor | Isolar seleção, coleções e estados de viewport/render independentes |
| Câmera de inspeção | Perspectiva; frente, costas, laterais e topo ortográficas; enquadrar; órbita/zoom | Navegação equivalente aos modos Blender não é necessária para declarar essas vistas suportadas |
| Wireframe e snap | Exibição wireframe e incrementos de transformação | Snap em vértice/aresta/face e alinhamento à normal |
| Desfazer / refazer | Até 30 snapshots locais do documento; revisões salvas separadas | Histórico de operações persistente e merges concorrentes |
| Edição de vértice | Índice numérico e posição XYZ em malha estática | Seleção direta de vértices, arestas/faces, seleção proporcional e múltiplos elementos |
| Extrude / inset / bevel / loop cut | Ausentes | Documento topológico, índices/faces, validação de manifold e preservação de atributos |
| Delete / dissolve / merge / weld | Ausentes | Mesmo contrato topológico e políticas de vértices compartilhados, normais, UVs e grupos |
| Duplicate / separate / join | Ausentes | Identidades estáveis para novos nós/primitivas e reconstrução/exportação correspondentes |
| Mirror | Não existe operador na base; escala negativa é rejeitada pelo servidor | Refletir apenas coordenadas inverte o winding dos triângulos; exige persistir índices corrigidos, UVs/normais e eventual soldagem antes de disponibilizar Mirror |
| Smooth / proportional edit / deform | Posição individual apenas | Algoritmo limitado, seleção/região, peso e conservação de bordas; não chamar de simulação de tecido |
| Sculpt / remesh / multires | Ausentes | Motor de pincéis, remalha, orçamento de memória e contrato de alterações topológicas |
| UV unwrap / seams / packing | Apenas repetição e rotação das texturas já existentes | Edição de UV por vértice, marcação de costuras, unwrap, packing e preservação de ilhas |
| PBR básico | Cor, rugosidade, metalicidade; texturas existentes clonadas por primitiva | Mapas novos, upload seguro, canal alfa e controles explícitos para os demais parâmetros |
| Shader Editor / Texture Paint / bake | Ausentes | Grafo de materiais, pintura/bake, processamento isolado e conversão consistente para glTF |
| Modifiers (subdivision, solidify, shrinkwrap etc.) | Ausentes | Pilha versionada, parâmetros, dependências de objetos e estratégia bake/export |
| Armature / skinning / weight paint | Asset com rig pode ser inspecionado, mas vértices não podem ser editados | Editor de ossos/pesos e tratamento de bind/rest pose; não usar edição estática para graduar roupa rigada |
| Shape keys / morphs | Detectados; bloqueiam edição de vértices | Edição e validação dos targets e regras de compatibilidade |
| Animation / keyframes / constraints | Animações importadas são fornecidas ao exportador; não há timeline editável | Timeline, canais, curvas, constraints e teste de round-trip |
| Cloth / collision / sewing | Ausentes | Painéis de molde, costuras, parâmetros físicos, colisores e simulação; validar estabilidade e fidelidade |
| Geometry Nodes / drivers | Ausentes | Grafo e runtime próprios; não confundir catálogo de botões com avaliação de grafos |
| Python Console / add-ons / operadores arbitrários | Ausentes | Não executar scripts enviados pelo navegador no backend principal; integração exigiria worker isolado com política própria |
| Importar / exportar GLB | GLB 2.0 autocontido; inspeção no cliente/servidor; exportação binária no cliente | `.blend`, FBX, OBJ e outros formatos não são suportados pelo mesmo fluxo |

A matriz cobre famílias relevantes, não é enumeração de todos os operadores e versões do Blender. “Todos os comandos” não deve aparecer como recurso entregue sem um catálogo de operadores, versão alvo, testes e fronteira de execução definidos.

## Persistência, permissões e limites que os novos comandos devem respeitar

- O servidor aceita no máximo **20.000 vértices alterados** por documento e rejeita coordenadas não finitas/fora dos limites. Importar uma malha de até 500.000 vértices não significa poder reescrevê-la inteira nesse documento.
- Edição de vértices é bloqueada se o asset tiver skin, morphs ou animação. Operadores novos precisam da mesma restrição no cliente e no servidor.
- `scale` de objeto deve ser positiva. Um botão de espelhar que apenas põe escala `-1` não salva pelo contrato atual.
- GLB: até 8 MiB, cena única, recursos embutidos e extensões autorizadas. Até 20 assets originais por projeto; dados do documento até 2 MB. Upload repetido com mesmo hash reutiliza asset.
- Cada save usa `expectedSequence` e `requestId`. Conflito não pode descartar o rascunho nem ser contornado sobrescrevendo o trabalho de outro autor.
- Convidado `VIEWER` não pode upload/save. `EDITOR` depende de convite válido, não revogado, projeto elegível e regras de acesso. Permissão para gerenciar convidados é separada.
- `allowExport` controla a ação de download do editor. O GLB original precisa ser enviado ao navegador para renderizar e não deve ser apresentado como proteção DRM contra extração por um destinatário autorizado a visualizar.
- Os tokens de convite ficam no fragmento do link e são enviados no cabeçalho `X-Atelier-Guest`; não devem aparecer em logs, screenshots ou documentos de evidência.

Referências: [scene-api.ts](../../components/atelier3d/scene-api.ts), [guest-editor.tsx](../../components/atelier3d/guest-editor.tsx), [Atelier3dService.java](../../fai-application/src/main/java/br/com/fashionai/application/atelier3d/Atelier3dService.java), [GlbInspector.java](../../fai-application/src/main/java/br/com/fashionai/application/atelier3d/GlbInspector.java), [history.ts](../../lib/atelier3d/history.ts).

## Roteiro de auditoria visual reproduzível

O script existente [verify-editor.cjs](../../scripts/atelier3d/verify-editor.cjs) gera uma camisa sintética, intercepta a API em memória e abre a rota de convidado local. Não depende de credenciais de produção, GPU ou fotos pessoais.

```sh
EDITOR_BASE=http://127.0.0.1:3120 \
PLAYWRIGHT_MODULE=/caminho/para/playwright \
CHROMIUM_PATH=/caminho/para/chromium \
node scripts/atelier3d/verify-editor.cjs
```

Os caminhos acima são seletores do ambiente, não instalação adicional obrigatória. O servidor local deve estar disponível antes de executar o script.

O script da base verifica: importação e renderização; confirmação deliberada de TipoLook; alteração de posição/cor; save; reload com edição preservada; exportação com assinatura GLB; erro409 com rascunho preservado; viewer bloqueado e convite revogado. Salva E1/E2 e relatório JSON em `docs/features/atelier3d-2026-10-30/`. Isso comprova comportamento de frontend com uma API simulada. A confirmação por banco/servidor real exige outra execução controlada.

Para os comandos deste lote, acrescentar evidências separadas, sem sobrescrever a identificação da fixture: estado inicial, comando aplicado, undo/redo, save/reload, arquivo exportado e viewer sem ação de edição. Auditar desktop e celular com cabeçalhos dos painéis e peça completa visíveis. Não chamar screenshot de resultado de roupa industrial quando a amostra for um GLB de verificação.

## Integração progressiva proposta

1. **Operações seguras no contrato existente:** transformação, reset, operações determinísticas de coordenadas estáticas e material. Uma execução gera um documento imutável e um passo de undo; rejeitar antes da aplicação quando exceder limites. Não alterar topologia silenciosamente.
2. **Criar peças a partir de modelos canônicos:** templates próprios de camiseta, camisa, moletom, casaco e calça com UVs, painéis e landmarks. O usuário deve iniciar sem precisar encontrar um GLB fora do app. Esse fluxo exige procedência/licença, unidade, versão e testes por template.
3. **Contrato topológico versionado:** selecionar vértices/arestas/faces, extrude, inset, bevel, merge e separar/juntar. Projetar IDs, compatibilidade com snapshots antigos, UV/normais, validação e exportação antes de adicionar botões.
4. **Ferramentas de vestuário:** moldes/painéis, costura, simetria, bolsos/golas/punhos, UV e graduação por tabela real. Definir medidas e tolerâncias verificáveis; deformação visual não certifica tamanho.
5. **Runtime Blender opcional:** se o objetivo for executar operadores do Blender de fato, usar worker separado com versão fixada, comandos tipados/allowlist, cotas/timeout, sem rede por padrão, sem execução de Python arbitrário do usuário e artefatos inspecionados antes de retornar. O backend principal autentica/autoriza e agenda; não executa `.blend` ou add-ons diretamente. Blender 4.3.2 foi executado localmente nesta auditoria; isso não demonstra que exista worker Blender integrado à aplicação ou instalado em produção.
6. **Rig, simulação e colaboração:** bindings de rig, colisão/cloth e avaliação contra referência; presença e conflitos por operação com permissão reavaliada. O controle de sequência atual continua obrigatório até existir protocolo de merge testado.

Aceite de cada fase: demonstrar criação/edição, salvar/reabrir, undo/redo, exportar/reimportar sem perda dos atributos suportados, negar edição ao viewer e respeitar limites do servidor. Comandos ausentes devem permanecer identificados como pendentes, sem controles decorativos que prometam comportamento não implementado.

## Implementação efetiva deste lote

Foram integrados sete comandos ao documento/histórico existente: restaurar transformação, centralizar na origem, apoiar no chão, restaurar material, restaurar vértices, suavizar e afunilar por eixo. As novas bases de camiseta, saia e calça são superfícies procedurais estáticas, com partes independentes; não substituem modelos canônicos costurados.

O motor Blender disponível é inspecionado separadamente pelo script `scripts/atelier3d/audit-blender.py`. Enumerar operadores não significa integrá-los à UI. Operadores de arquivo, execução de código e contexto de desktop não são expostos como comandos arbitrários pela aplicação. A integração completa de Blender permanece pendente; a fase de worker exige contrato próprio, isolamento, autorização e round-trip de artefatos.

## Inspeção efetiva com Blender 4.3.2 neste lote

O script [audit-blender.py](../../scripts/atelier3d/audit-blender.py) importa arquivos GLB locais e inspeciona cópias em memória. Ele também enumera metadados de `bpy.ops`; não recebe nem executa comandos de operadores arbitrários. Foi executado com `--background --factory-startup --disable-autoexec`, sem rede, GPU, produção ou alteração dos arquivos originais.

```sh
blender --background --factory-startup --disable-autoexec \
  --python scripts/atelier3d/audit-blender.py -- \
  --input-dir /tmp/fai-atelier-audit \
  --output-dir /tmp/fai-atelier-blender-audit
```

**Resultado observado:** 2.313 operadores registrados descobertos, zero falhas de leitura de metadados; seis GLBs importados, seis hashes de origem preservados, sem falhas de inspeção. O inventário descreve o processo Blender 4.3.2 com sua configuração local; não promete que toda versão/instalação tenha o mesmo conjunto de operadores.

| Protótipo / exportação | Malhas separadas | Triângulos | Bordas abertas após soldagem temporária | Texturas de imagem |
|---|---:|---:|---:|---:|
| Camiseta / camiseta exportada | 4 / 4 | 576 / 576 | 384 / 384 | 0 / 0 |
| Saia / saia exportada | 2 / 2 | 288 / 288 | 192 / 192 | 0 / 0 |
| Calça / calça exportada | 4 / 4 | 576 / 576 | 384 / 384 | 0 / 0 |

Todas as malhas inspecionadas têm UVs e normais de polígonos finitas; nenhuma face tem área inferior a `1e-12` nas coordenadas do arquivo. Os assets são estáticos, sem rig/morphs. A inspeção de soldagem usa tolerância `1e-6` somente em uma cópia BMesh; não altera o GLB ou os IDs dos vértices salvos pelo editor.

**Melhorias ainda necessárias:** camiseta mantém torso, mangas e gola como superfícies separadas, sem recorte de cava e união costurada; calça mantém cintura/pernas/cós separados e não resolve modelagem do gancho. Cor sólida e UV presente não equivalem a tecido, estampa, logo, bolsos ou costura fotográficos. Bordas de gola/manga/cintura/barra podem ser intencionais, portanto os números de borda não são, isoladamente, diagnóstico de rachadura. Também não há espessura/material físico ou graduação certificada por tabela de tamanho.

O lote implementa **sete comandos no contrato existente**: restaurar transformação, centralizar, apoiar no chão, restaurar material, restaurar vértices, suavizar e afunilar por eixo. Acrescenta três templates procedurais (camiseta, saia e calça), identificados como protótipos. Os 2.313 operadores Blender foram **inventariados**, não integrados como ferramentas da UI. Topologia, sculpt, UV individual, modificadores, rig, cloth e animação continuam pendentes conforme a matriz.

Os relatórios produzidos pelo script são `blender-operators.json`, `glb-audit.json` e `report.md` no diretório de saída. A auditoria visual/salvar/reabrir do navegador é evidência separada e não substitui o teste integrado de persistência real.

Artefatos desta execução: [inventário real dos operadores](auditoria-2026-11-05/blender-operators.json), [inspeção detalhada dos seis GLBs](auditoria-2026-11-05/glb-audit.json) e [resumo Blender](auditoria-2026-11-05/blender-report.md). Os hashes dos seis arquivos foram comparados com os GLBs copiados para o diretório das screenshots. As três entradas `fai-*-prototype.glb` são protótipos gerados localmente; as entradas `export-*.glb` são os resultados baixados do editor. A cópia de protótipos também usada nas fixtures Java é intencional: os recursos de teste verificam compatibilidade de inspeção, enquanto esta pasta mantém evidência reprodutível da auditoria visual/Blender.
