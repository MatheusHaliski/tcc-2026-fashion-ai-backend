# Resultado da criação e auditoria do FAI Atelier — 5/11/2026

Base: `d0b78b8e`. Quatro agentes atuaram em comandos geométricos, ferramentas de UI, criação de bases e auditoria de capacidades/Blender. As alterações são locais para revisão; nenhuma inferência paga, produção, deploy ou conta real foi utilizada.

## O que foi efetivamente criado e integrado

O editor agora inicia uma **camiseta, saia ou calça** sem exigir um GLB externo. A geração local cria um arquivo GLB e usa o mesmo upload/inspeção do editor. Bases estáticas de exploração de forma/cor; não são moldes de costura, tamanhos certificados ou roupas rigadas para o avatar.

Sete comandos foram integrados ao documento existente: restaurar transformação, centralizar na origem, apoiar no chão, restaurar material, restaurar vértices, suavizar malha e afunilar por eixo. Usam o histórico/desfazer e o pipeline de salvar/exportar existentes. Valores inválidos, limites e malhas com rig/morph/animação são bloqueados. Nova base pede confirmação antes de substituir rascunho; uma mudança de permissão durante a geração também é respeitada.

A auditoria visual levou a duas correções adicionais: comandos passaram para o início do inspetor e nomes longos da árvore passaram a quebrar linha. Visitantes continuam sem criação/edição; exportação mantém a confirmação e a versão salva.

## Screenshots reais do navegador

Renderização WebGL via Chromium/SwiftShader, desktop 1600×1120 e celular 390×844. O cenário usa API em memória, não banco ou servidor de produção.

| Evidência | O que mostra |
|---|---|
| [E1 — editor vazio](auditoria-2026-11-05/E1-editor-vazio-criacao.png) | Entrada da criação de base |
| [E2 — camiseta criada](auditoria-2026-11-05/E2-camiseta-base.png) | Geometria e escolha de cor |
| [E3 — camiseta editada e salva](auditoria-2026-11-05/E3-camiseta-editada-salva.png) | Comandos, afunilamento 0,65, histórico e versão 1 |
| [E3a — viewport](auditoria-2026-11-05/E3a-viewport-camiseta.png) | Detalhe da geometria após edição |
| [E4 — saia](auditoria-2026-11-05/E4-saia-base.png) | Segunda base criada |
| [E5 — calça](auditoria-2026-11-05/E5-calca-base.png) | Terceira base criada |
| [E6 — conflito](auditoria-2026-11-05/E6-conflito-preserva-rascunho.png) | Erro409 preserva alteração local |
| [E7 — visitante](auditoria-2026-11-05/E7-visitante-sem-edicao.png) | Ferramentas bloqueadas |
| [E8 — celular](auditoria-2026-11-05/E8-mobile-visitante.png) | Documento sem overflow horizontal |
| [E9 — GLB exportado e reaberto](auditoria-2026-11-05/E9-export-reaberto-foco-editor.png) | Arquivo exportado importado novamente, com a deformação preservada |

[Resultado dos nove cenários](auditoria-2026-11-05/browser-results.json). [Camiseta GLB](auditoria-2026-11-05/export-tee.glb), [saia GLB](auditoria-2026-11-05/export-skirt.glb) e [calça GLB](auditoria-2026-11-05/export-trousers.glb).

## Ainda precisa melhorar

| Prioridade | Constatação reproduzível | Próximo trabalho necessário |
|---|---|---|
| Alta | Corpo, mangas e gola são superfícies independentes. Em E3/E9, afunilar apenas `Body` deixa a gola visualmente separada. | Modelos canônicos com uniões/painéis e edição vinculada por costura; seleção de regiões e restrições que preservem junções |
| Alta | Calça é composta por volumes de cintura/pernas, sem construção anatômica costurada de gancho. | Topologia de vestuário, junções, avaliação de interseção e proporções físicas |
| Alta | Todos os materiais auditados têm **zero texturas de imagem**. Há UV procedural, mas não tecido fotográfico, logos, bolsos ou linhas de costura. | Material/UV por painel, upload de mapas, seams/unwrap e detalhes de construção; identidade de marca depende de asset autorizado |
| Alta | O documento salva objetos, materiais e posições de vértices existentes, sem novos índices/faces. | Contrato topológico versionado para extrude, inset, bevel, weld, mirror correto e operações de faces/arestas |
| Média | Inspetor longo e edição de vértices por índice são limitados para trabalho de modelagem. | Seleção visual de vértices/arestas/faces, seleção proporcional e seções de ferramentas mais compactas |
| Alta | Não há rig de vestimenta, colisão/cloth ou graduação por tabela real nestas bases. | Pipeline físico/rig e critérios mensuráveis de caimento por tamanho; não inferir ajuste pelo desenho da roupa |

**Não considero o editor equivalente ao Blender nem pronto para modelagem profissional de vestuário.** O lote entrega criação inicial e edições verificáveis; as lacunas acima permanecem explícitas.

## Cobertura do Blender real

Blender **4.3.2** executado localmente em background, com autoexec desabilitado. Foram catalogados **2.313 operadores registrados**, apenas metadados: isso **não** significa 2.313 comandos integrados. A interface deste lote acrescenta sete comandos determinísticos sobre o contrato atual; os demais recursos estão classificados na [matriz de 25 famílias](auditoria-comandos-2026-11-05.md).

Os seis GLBs foram importados no Blender sem alterar seus hashes. Todos são estáticos, têm UVs e normais de faces finitas. Camiseta/calça: quatro partes de malha, 576 triângulos; saia: duas partes, 288 triângulos. Bordas abertas também representam gola, mangas e bainhas e, isoladamente, não comprovam defeito. A ausência de união costurada é verificável na construção por superfícies independentes e nas screenshots.

[Inventário de operadores](auditoria-2026-11-05/blender-operators.json), [inspeção geométrica](auditoria-2026-11-05/glb-audit.json) e [relatório Blender](auditoria-2026-11-05/blender-report.md). Para executar operadores Blender pela aplicação, ainda é necessário um worker com versão fixa, comandos tipados/allowlist, isolamento, autorização e artefatos validados. Não foram expostas execução de Python ou operações arbitrárias de arquivo/rede.

## Verificação

- **42 testes frontend** passaram em nove arquivos: criação, permissões e corrida assíncrona, comandos, documento, histórico, gênero, inspetor e editor.
- **19 testes Java** passaram em quatro classes, incluindo seis casos com os GLBs gerados/exportados pelo navegador aceitos pelo inspetor real de upload. As fixtures de teste repetem os binários publicados para manter o teste independente dos documentos.
- **Nove cenários de navegador** passaram. Salvar/recarregar/conflito/permissões usam API simulada; não se afirma persistência real de ponta a ponta.
- TypeScript, estilos, design, i18n e line ratchet passaram. Não foi executado build Next de produção ou teste com banco real.
- Houve uma falha de chunk JavaScript durante a sessão de desenvolvimento (`Unexpected end of input`); a instância/cache local foi recriada e a execução final passou sem page errors. Não foi classificada como falha preexistente do produto.
- O editor original reduziu de **632 para 604 linhas** por extração da barra de arquivos. Os auxiliares adicionam comportamento e aumentam o total; não se declara redução global de código.

```sh
npx vitest run lib/atelier3d components/atelier3d
npm run typecheck
npm run lint:styles
node scripts/ux/check-design.cjs
node scripts/i18n/check.js --fail
node scripts/i18n/scan.js --fail
python -m scripts.refactoring.line_ratchet
# Com um frontend local pronto e Playwright/Chromium disponíveis:
PLAYWRIGHT_MODULE=/caminho/playwright CHROMIUM_PATH=/caminho/chrome EDITOR_BASE=http://127.0.0.1:3127 node scripts/atelier3d/audit-editor.cjs /tmp/atelier-audit
blender --background --factory-startup --disable-autoexec --python scripts/atelier3d/audit-blender.py -- --input-dir /tmp/atelier-audit --output-dir /tmp/atelier-blender-audit
mvn -pl fai-application -am -Dtest=Atelier3dServiceTest,GlbInspectorTest,CatalogGenderDecisionTest,GeneratedGarmentCompatibilityTest -Dsurefire.failIfNoSpecifiedTests=false test
```

Maven executado com Java21 e o agente Mockito do ambiente de testes. Nenhum segredo é necessário nas fixtures de navegador/Blender.
