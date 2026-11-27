# Exercício 06 — Estação preferida do look

**Situação na revisão `9f5512a77`:** Base implementada com enum Season persistido como texto; não é necessário criar tabela de estações.

As linhas abaixo são da revisão de referência; siga também o nome do método/atributo. Arquivos marcados **NOVO** são propostas de implementação, não entregas já aplicadas. Pré-requisitos e convenções: [guia geral](../RESOLUCAO_20_EXERCICIOS.md).

## Sequência de arquivos e alterações

1. **Schema/modelo.** Conferir [Scheme.java:75](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/Scheme.java#L75) e [Season.java:4](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/model/enums/Season.java#L4). Códigos reais: SPRING, SUMMER, AUTUMN e WINTER. NULL preserva looks sem escolha; não gravar nomes traduzidos no banco.

2. **DTO.** `SchemeForm` já recebe Season em [SchemeService.java:417](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SchemeService.java#L417); `Views.SchemeView` projeta o nome em [Views.java:250](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/view/Views.java#L250). Nenhum campo duplicado `preferredSeason` é necessário para o enunciado.

3. **Repository/service.** Reutilizar [SchemeRepository.java:19](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-domain/src/main/java/br/com/fashionai/domain/repository/SchemeRepository.java#L19). `applyForm` já grava em [SchemeService.java:517](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-application/src/main/java/br/com/fashionai/application/service/SchemeService.java#L517). Adicionar query/filtro por estação somente se o Lookbook precisar buscar no servidor; não carregar tudo e filtrar em memória para grandes listas. Ausência versus clear deve respeitar a semântica atual do PUT completo.

4. **Controller.** Reutilizar criar/editar no [SchemeController.java:29](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/fai-web/src/main/java/br/com/fashionai/web/controller/SchemeController.java#L29). O Jackson deve rejeitar string fora do enum com 400, sem trocar silenciosamente por SUMMER. Uma rota de opções é opcional aqui, porque o enunciado permite enum.

5. **Tela/leitura.** O estado já inclui season em [scheme-builder.tsx:71](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/scheme-builder.tsx#L71); conferir o envio e a tradução de códigos. Em [lookbook-tabs.tsx:52](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/blob/9f5512a774b2d6978228735361c228cd42c46b36/components/lookbook-tabs.tsx#L52), exibir/filtrar a estação devolvida pelo GET, não a estação atual do calendário. Mostrar vazio legível para legado e erro sem perder a escolha quando o save falhar.

## Arquivos novos propostos e ponto de inserção

Nenhum arquivo de produção novo é obrigatório para a solução base descrita; reutilizar os pontos de edição/revisão numerados acima. Novos testes podem ser adicionados na responsabilidade correspondente.

## SQL para inspeção e implementação em laboratório

[Arquivo SQL completo](sql/06-estacao-look.sql). Não execute DDL se a coluna, tabela ou constraint já existir. Não reexecute migrations antigas; copie apenas a alteração faltante para uma nova versão livre.

```sql
SHOW CREATE TABLE schemes;
SELECT season,COUNT(*) AS quantidade FROM schemes GROUP BY season;
SELECT id,title,season FROM schemes WHERE id=@scheme_id;
-- Antes de propor CHECK, revisar todos os valores retornados pela consulta acima.
-- Nenhum ALTER é necessário se o enum já é persistido e validado pelo fluxo atual.
```

## Integridade referencial: restrições e alternativas

Não há FK de estação no modelo: o enum é restrição de aplicação. Um CHECK opcional deve aceitar NULL e exatamente os quatro códigos depois de validar os legados. Remover um valor do enum pode tornar dados antigos ilegíveis mesmo sem erro de FK. Alternativas: manter códigos legados em leitura e bloquear novos usos; ou criar uma tabela de opções com FK aditiva, sem converter textos desconhecidos por heurística. A FK de `scheme_items` continua existindo: não recriar o look para trocar estação.

## Contrato HTTP

Existente: recorte de POST/PUT de look `{"season":"WINTER"}`. Para remover num PUT completo, enviar null de acordo com o contrato do formulário.

Resposta/projeção a conferir: `"season":"WINTER"`. Objetos de leitura têm os nomes abaixo; IDs devem vir das APIs de opções, não de UUIDs inventados. Quando houver PUT com formulário completo, o JSON exibido representa somente o recorte relevante do payload, e não uma requisição parcial garantida.

## Testes e evidências de aceite

Quatro valores, null, valor traduzido/inválido rejeitado, dono alheio, look antigo. Criar com WINTER, recarregar e filtrar o Lookbook por WINTER sem usar a estação do dispositivo.

- **E1 a produzir:** Builder com Inverno escolhido.
- **E2 a produzir:** Lookbook recarregado exibindo o mesmo look no filtro de Inverno.

Os testes e as screenshots acima são o roteiro de implementação/aceite; não foram executados nem fabricados nesta resolução documental. Nenhum SQL deste exercício foi aplicado ao banco.
