# Entrega integrada — 23/10/2026

## Matriz de requisitos

| Pedido | Implementação e evidência | Limite concreto |
| --- | --- | --- |
| Transformar FAI Atelier | `/atelier` abre Projetos; versões imutáveis, equipe, comentários, interesse, análise por revisão e ficha JSON/impressão. Hub legado preservado em abas. | Fabricação, pagamentos e pré-vendas ficam para a etapa comercial posterior. |
| Tamanho por produto | Botão Meu tamanho no catálogo/provador e `/fit`: tabela com fonte/validade, medidas privadas consentidas, protocolos distintos, preferência de caimento e feedback. | Piloto de camiseta e jeans. Sem tabela real compatível, não recomenda; não existem tabelas inventadas ou probabilidade artificial. |
| Passaporte e segunda vida | Link no detalhe da própria peça; origem/composição/cuidado/histórico, comprovante fotográfico privado, QR/link seletivo revogável, transferência por código e resumo privado para anúncio. | Declarações e documentos apresentados não equivalem a origem verificada. A publicação do anúncio exige ação posterior. |
| FKs existentes | Mapeamento exato de EstadoConservacao/TipoLavagem, nome da conservação no card e lavagem no detalhe. Legados preservados sem inferir IDs. | Migração idempotente preparada; sem execução no banco remoto nesta entrega. |
| Cards compactos e grids | Compacto tem modo próprio; somente grids sociais recebem dimensões de post; resumo acessível de selos não repete os três primeiros. | Componentes e CSS verificados; não altera grids de catálogo/DNA/desafios. |
| Tipo de look no catálogo | Filtro fica no navegador do provador; troca aplica gênero/pagina1 sem perder texto/cor. Limpar filtros preserva apresentação do avatar. | UNISEX do TipoLook é traduzido explicitamente para UNISSEX do catálogo. |
| Qualidade fotográfica | Preflight antes da limpeza: altura confiável abaixo de 25% é inelegível; dúvida/oclusão vai para revisão. Total frame centralizado com proporção preservada, máscaras por conjunto/categoria e CAS. | Não reconstrói pixels ocultos nem elimina humanos com rembg sozinho. Depende de máscara semântica/revisada. Nenhuma peça real foi removida nesta entrega. |

## Verificações

- TypeScript, lint de estilos, design e traduções PT/EN/ES passaram.
- Backend: 128 testes de aplicação passaram, incluindo persistência real H2/concorrência; três testes WebMvc de leitura pública e bloqueio de rotas privadas passaram. Pacote completo Java 21 passou.
- Pipeline: 33 testes Python passaram; relatório offline de sete fixtures, uma candidata; quarentena/restauração demonstradas somente em SQLite de memória. SHA e controle de concorrência impedem aplicar relatório obsoleto.
- Chromium desktop/mobile: Atelier 18 checkpoints; passaporte 18 estados; tamanho com medidas, tabela, recomendação, feedback, falta de tabela e entrada lazy no catálogo. Sem overflow ou erros de página nas execuções finais. APIs e autenticação eram fixtures explícitas; a acessibilidade examinada é parcial (nomes, foco, Tab/Escape), não certificação WCAG.
- O teste antigo de reparo de atlas excedeu 5 s ao comparar 640 mil propriedades da imagem. A asserção agora compara todos os bytes com Buffer.compare; os 21 testes de íris passaram em 2,51 s, sem aumentar timeout ou mudar código de produção.
- V79 herdou charset/collation da baseline para evitar FK MySQL incompatível com users.id; H2 não comprova essa migração no MySQL real.

A exportação global da conta ainda não inclui os três novos módulos. A limpeza na exclusão da conta foi integrada e testada. Ficha técnica do Atelier e download dos comprovantes próprios são operações separadas.

## Capturas com dados de teste

Todas as contas, produtos, medidas e documentos destas capturas são fixtures locais.

- [Atelier mobile](validation-2026-10-23/atelier-projects-mobile.png)
- [Ficha para impressão](validation-2026-10-23/atelier-tech-pack-print.png)
- [Meu tamanho no catálogo mobile](validation-2026-10-23/fit-catalog-mobile.png)
- [Projeção pública do passaporte mobile](validation-2026-10-23/passport-public-mobile.png)

## Publicação

Código preparado em branch de funcionalidade para revisão. Esta entrega não afirma migração ou limpeza do catálogo de produção, execução GPU, nem deploy Railway. O PR e os checks remotos devem ser conferidos no commit publicado.
