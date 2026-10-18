# Studio de Eras — evidência de interface

Estas capturas usam o app real em Next.js com **API simulada**, perfil de teste e composições originais do FashionAI. Não são contas reais de celebridades nem comprovam publicação no banco, geração remota da IA ou vendas.

- [Página editorial](era-editorial.png): capa, direção artística, símbolos, timeline e mural.
- [Editor manual](era-editor-manual.png): presets, campos e prévia.
- [Resultado do navegador](browser-result.json): sem erros de JavaScript nesta execução.

Vitest: `components/showcase/era-editorial.test.tsx` verifica ordem dos marcos, redução de movimento, seleção de temas/símbolos e retorno local do Copilot. O backend valida fotos próprias, datas, limites e persistência do contrato editorial nos agrupamentos. A migração V66 ainda exige comprovação integrada em MySQL.
