# Resolução dos 20 exercícios — Banco de Dados FashionAI

Data: **6/11/2026**. Fontes fixadas na revisão [`9f5512a77`](https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend/tree/9f5512a774b2d6978228735361c228cd42c46b36). A aula original é de outubro; esta resolução usa o código atual inspecionado, sem atualizar artificialmente as contagens históricas daquele mapa.

**Entrega:** roteiro de implementação, arquivos/métodos/linhas, SQL de laboratório, alterações de entidade/DTO/repository/service/controller/UI, contratos e testes para cada exercício. Não foram implementadas 20 funcionalidades novas nem aplicados SQLs ao banco. Recursos já existentes são reaproveitados; tabelas e arquivos propostos são identificados como novos.

Nenhuma conexão de leitura/escrita ao banco real foi feita. Existência de JPA/migration não comprova que a FK tenha sido aplicada no Railway ou em outro ambiente. Confirmar com o SQL00 abaixo antes de qualquer mudança de schema.

## Índice dos exercícios

| Nº | Exercício resolvido | Situação no código | SQL |
|---|---|---|---|
| 1 | [TipoLook no espelho e no detalhe do look](solucoes/01-tipo-look.md) | Base implementada para espelho → look; o builder manual ainda tem contrato distinto. | [SQL 01](solucoes/sql/01-tipo-look.sql) |
| 2 | [Estado de conservação da peça](solucoes/02-conservacao.md) | FK, opções, service e formulário já implementados; reutilizar a estrutura existente. | [SQL 02](solucoes/sql/02-conservacao.sql) |
| 3 | [Instrução de lavagem](solucoes/03-lavagem.md) | Tabela, FK, repository, API de opções e leitura existem; escrita estruturada ainda precisa ser integrada. | [SQL 03](solucoes/sql/03-lavagem.sql) |
| 4 | [Intensidade térmica do look](solucoes/04-nivel-termico.md) | Proposta: não foi localizada entidade NivelTermico; estação não substitui intensidade térmica. | [SQL 04](solucoes/sql/04-nivel-termico.sql) |
| 5 | [Origem adquirida, herdada ou trocada](solucoes/05-origem-peca.md) | A coluna piece_origin existe e é lida pelo quarto; falta uma escolha estruturada no formulário comum. | [SQL 05](solucoes/sql/05-origem-peca.sql) |
| 6 | [Estação preferida do look](solucoes/06-estacao-look.md) | Base implementada com enum Season persistido como texto; não é necessário criar tabela de estações. | [SQL 06](solucoes/sql/06-estacao-look.sql) |
| 7 | [Tipo de iluminação e temperatura do quarto](solucoes/07-iluminacao-quarto.md) | Parcial: kelvin/intensidade/on já são guardados em modules_json; falta a FK TipoIluminacao exigida. | [SQL 07](solucoes/sql/07-iluminacao-quarto.sql) |
| 8 | [Nome do módulo de armazenamento](solucoes/08-nome-modulo.md) | Parcial: gavetas já têm renameDrawer e drawer_labels_json; nomes genéricos de módulos precisam preservar IDs e endereços. | [SQL 08](solucoes/sql/08-nome-modulo.sql) |
| 9 | [Categoria principal da marca](solucoes/09-categoria-marca.md) | Parcial: fashion_category é texto; não há FK CategoriaMarca nesse modelo. | [SQL 09](solucoes/sql/09-categoria-marca.sql) |
| 10 | [Área artística principal da celebridade](solucoes/10-area-artistica.md) | Parcial: areas_json suporta lista; o modelo não distingue área principal por FK. | [SQL 10](solucoes/sql/10-area-artistica.sql) |
| 11 | [Prazo de disponibilidade do selo](solucoes/11-prazo-selo.md) | Base implementada com available_from/available_until e validação de ordem. | [SQL 11](solucoes/sql/11-prazo-selo.sql) |
| 12 | [Política do selo: quantidade mínima por cor](solucoes/12-quantidade-cor.md) | Estrutura rules/count/color já existe e é validada; usar a política estruturada, não texto livre. | [SQL 12](solucoes/sql/12-quantidade-cor.sql) |
| 13 | [Política do selo: marca exigida](solucoes/13-marca-politica.md) | Parcial: a regra atual guarda brand como texto e compara similaridade; isso não é uma FK de marca. | [SQL 13](solucoes/sql/13-marca-politica.sql) |
| 14 | [Canal de utilização do cupom](solucoes/14-canal-cupom.md) | Proposta: há cupons de promoções e de FLAIR; canal precisa cobrir os dois fluxos sem tratar CouponRight como cupom emitido. | [SQL 14](solucoes/sql/14-canal-cupom.sql) |
| 15 | [Valor mínimo de compra do cupom](solucoes/15-minimo-compra.md) | Parcial: FlairCombination.minPurchase existe, mas precisa validação forte e snapshot; promoções possuem outro modelo. | [SQL 15](solucoes/sql/15-minimo-compra.sql) |
| 16 | [CBC: modalidade/cenário preferido](solucoes/16-preferencia-cbc.md) | Parcial: desafios têm scenario e validação própria; preferência individual não deve reescrever o desafio global. | [SQL 16](solucoes/sql/16-preferencia-cbc.sql) |
| 17 | [Tipo de dinâmica da Trend](solucoes/17-dinamica-trend.md) | Base implementada: kind validado contra cinco códigos, com lista filtrável e publicação separada. | [SQL 17](solucoes/sql/17-dinamica-trend.sql) |
| 18 | [Peça Assinatura do perfil e histórico](solucoes/18-peca-assinatura.md) | Proposta: não foi localizada relação de Peça Assinatura pessoal; não confundir com assinatura de marca/estilo. | [SQL 18](solucoes/sql/18-peca-assinatura.sql) |
| 19 | [Modalidade visual da peça na AURA](solucoes/19-modalidade-aura.md) | Parcial: existe aura.format no contrato da Aura comum; explicitar validação/persistência sem criar modalidade paralela. | [SQL 19](solucoes/sql/19-modalidade-aura.sql) |
| 20 | [Variante do catálogo por SKU e cor](solucoes/20-sku-cor.md) | A query por identificador já correlaciona SKU e cor na mesma variante; manter isso e testar seleção/criação. | [SQL 20](solucoes/sql/20-sku-cor.sql) |

## Como interpretar as linhas e a sequência

Cada solução tem passos numerados de schema até leitura em outra tela. As referências apontam para o arquivo e a linha reais no commit acima, com permalink: mudar o arquivo mais tarde não desloca a evidência original. Para editar outro checkout, procurar também o nome do método/atributo indicado. O [manifesto de 169 âncoras](solucoes/fontes-e-linhas.json) registra caminho completo, linha e texto de referência.

**NOVO, linha1** significa criar um arquivo naquela responsabilidade; não é uma afirmação de que ele já exista no repositório. Arquivos existentes marcados como reaproveitar não precisam ser alterados apenas para cumprir uma lista de camadas.

Ordem recomendada de implementação: migrations faltantes → entidade/relação → DTO de entrada/saída → repository → service/validação/autorização → controller → cliente/formulário → leitura em outra tela → testes. Relações novas são LAZY e, para opções compartilhadas, não recebem CascadeType.REMOVE. O service autoriza o dono antes de chamar o escritor específico.

Os services/componentes extensos estão sujeitos a `AGENTS.md`: não acrescentar blocos a arquivos congelados; extrair a responsabilidade correspondente e então delegar. Hooks/BFF150 linhas, controllers200, repository/DTO120, demais arquivos de produção250 e testes400. As indicações de helpers novos nas soluções atendem a essa divisão por responsabilidade.

## Inspecionar integridade antes de mudar

Rodar **somente no ambiente de teste escolhido** o [SQL00 de diagnóstico](solucoes/sql/00-inspecao-integridade.sql). Usar MySQL 8.0.16 ou superior para CHECKs efetivamente aplicados. Ele lista banco/versão, histórico Flyway, FKs de entrada e saída, tipos/collations, índices UNIQUE e CHECKs. Depois usar SHOW CREATE TABLE nas tabelas afetadas.

Consultar duas direções é essencial: `wardrobe_items.brand_id → brands.id` e outras tabelas apontando para `wardrobe_items.id` são dependências diferentes. Uma FK composta deve ser lida na ordem das colunas. UUIDs CHAR(36) novos devem ter tipo/charset/collation compatíveis com o destino; ajustar os DDLs propostos depois de inspecionar os metadados, sem assumir que a collation padrão do banco é a de tabelas antigas.

| Restrição | Efeito no MySQL/InnoDB | Alternativa viável |
|---|---|---|
| FK de filho para pai | Não aceita ID de opção inexistente, mesmo que o cliente envie um UUID válido sintaticamente | Criar/selecionar a opção correta antes; rejeitar referência inválida com400 |
| ON DELETE RESTRICT / NO ACTION | Bloqueia apagar pai referenciado; NO ACTION não é validação adiada no InnoDB | Desativar; manter ID; remapear filhos numa operação revisada; limpar vínculos explicitamente se o domínio permitir |
| ON DELETE SET NULL | Apaga a referência dos filhos, sem apagá-los; exige colunas nullable | Preservar snapshot/legado; desativar pai; usar RESTRICT se a perda de significado for inaceitável |
| ON DELETE CASCADE | Apaga os filhos alcançados, e pode atingir mais níveis | Preferir arquivamento/inativação; revisar histórico; mudar a política em migration separada antes de remover registros |
| ON UPDATE RESTRICT | Impede mudar uma chave referenciada | IDs imutáveis; corrigir nome sem tocar ID; migração com tabela de correspondência quando indispensável |
| ON UPDATE CASCADE | Propaga a alteração da chave aos filhos SQL | Mesmo assim manter IDs estáveis: caches, JSON, arquivos e clientes externos não acompanham automaticamente |
| UNIQUE | Impede repetir codigo/SKU/chave composta no escopo declarado | Inspecionar escopo real; reutilizar cadastro existente; não tornar SKU globalmente único por suposição |
| NOT NULL | Rejeita ausência; conflita com SET NULL | Adicionar nullable primeiro e preencher apenas escolhas históricas comprovadas antes de exigir valor |
| CHECK | Impede gravar valores fora da regra; ADD CHECK pode falhar por dados antigos | Diagnóstico dos legados, correção aprovada e migração por etapas; validar também no service |
| JSON | Garante JSON válido, mas não garante existência de IDs/códigos internos | Validação de aplicação/catálogo; associação relacional se a integridade SQL for obrigatória |

Erros comuns: 1451 ao tentar remover/alterar pai usado; 1452 ao apontar para pai inexistente; 1062 para UNIQUE; 3819 para CHECK; 1215/3780 em FKs com definição incompatível. A API deve traduzir conflitos conhecidos em 400/409 com mensagem de campo, sem expor SQL/nomes internos ao usuário. Não capturar toda exceção e devolver sucesso.

O banco garante existência de referência, não proprietário, visibilidade, atividade da opção, consentimento ou permissão de nível. Essas regras pertencem ao service e precisam de testes de acesso. Para opções inativas, nova seleção deve falhar e referência já salva inalterada deve continuar legível/editável, salvo regra explícita em contrário.

## Restrições reais observadas nas migrations

- V60: `TipoLook → mirror_states/schemes` sem ações declaradas; comportamento restritivo padrão. Manter UUIDs das opções.
- V77: conservação/lavagem em `wardrobe_items` usam `ON DELETE SET NULL ON UPDATE CASCADE`. Não criar tabelas/colunas alternativas com nomes quase iguais.
- V34: política proposta no código prevê, entre outras, `wardrobe_items.catalog_product_id → catalog_products` RESTRICT; `catalog_variant_id → catalog_variants` SET NULL; `flair_redemptions.combination_id → flair_combinations` CASCADE. **A V34 pode adiar criação/alteração quando encontra incompatibilidades/órfãos**: sucesso no Flyway não prova que toda política foi instalada. O metadado do ambiente é a fonte para a ação efetivamente ativa.
- As ações indicadas nos SQLs de novos exercícios são **propostas**, não constraints já existentes no servidor.

## Padrões de alteração sem perder dados

1. Preservar UUID da opção e alterar somente nome quando for mera correção de rótulo. Se o significado mudou, criar outra opção e manter a anterior para histórico.
2. Inativar opção usada em vez de apagá-la. Não remover a opção atual do formulário e enviar null como efeito colateral de um GET que filtra apenas opções ativas.
3. Para remapeamento, definir correspondência antiga→nova validada, fazer prévia de contagens/IDs e atualizar só os registros aprovados em transação. Não preencher BOA, gênero, origem ou moeda por default sem evidência.
4. Para mudar uma FK, consultar seu nome e ações reais no SQL00; verificar tipos, nullability, índices e órfãos. Preparar uma migration específica. Não remover a FK apenas para uma alteração de dados passar.
5. Para adicionar NOT NULL ou nova regra, usar expandir/migrar/contrair: coluna nullable e código compatível; tratamento explícito do legado; só depois retirar o campo antigo ou exigir novo valor.
6. Na aposentadoria de dados referenciados, preferir status/ativo. Se o domínio realmente exigir exclusão, registrar o efeito em cada dependência e decidir a ordem de limpeza/restrição com histórico e privacidade em mente.

**Não usar `SET FOREIGN_KEY_CHECKS=0` para contornar as relações.** Reativar a checagem não revalida todos os órfãos produzidos. Não usar DROP/TRUNCATE/recriar banco para resolver FK. DDL MySQL pode fazer commit implícito: ROLLBACK não desfaz ALTER TABLE; ensaiar migrações num banco descartável e manter plano de recuperação.

## SQL, Flyway e dados de laboratório

Os 21 arquivos SQL incluem 20 exercícios e um diagnóstico. Alguns exercícios já atendidos têm apenas SELECT: não há motivo para gerar ALTER redundante. Os INSERT/ALTER/UPDATE restantes são propostas a adaptar; **não são um pacote idempotente para executar inteiro**. Começar pelo SQL00, conferir existência/nome/collation e só então incorporar a alteração faltante em uma migration nova.

Na revisão de referência foram localizados 96 arquivos de migration SQL/Java, com maior número 97. **Não reservar V98 por este documento:** procurar versões em todas as branches que serão integradas e no histórico do banco quando a implementação for feita. Usar provisoriamente `V<PROXIMA_VERSAO_LIVRE>__exNN_descricao.sql` fora do diretório de migrations até definir a versão final. Não editar V60/V77 ou qualquer migration já aplicada.

Variáveis SQL como `@owner_id`, `@piece_id` e `@option_id` são parâmetros do laboratório, não mecanismos de autorização. Preenchê-las com registros sintéticos criados para os testes. DML direto não executa guard, auditoria, @Version, eventos ou invalidação de cache da aplicação: o fluxo funcional deve ser testado pela API; os SQLs servem à inspeção e à evolução controlada do schema. Não publicar credenciais, chaves ou dados reais nas evidências.

## Modelo Java de referência para uma opção nova

Exemplo do exercício4, após criar entidade e FK. Não substituir os services/controllers existentes indiscriminadamente por este trecho:

```java
public interface NivelTermicoRepository extends JpaRepository<NivelTermico, UUID> {
    List<NivelTermico> findAllByAtivoTrueOrderByNomeAsc();
}

// Dentro de um escritor chamado somente depois de autorizar o dono do look:
public void apply(Scheme scheme, UUID id, boolean clear) {
    if (clear && id != null) throw invalid();
    if (clear) {
        scheme.setNivelTermico(null);
    } else if (id != null) {
        if (scheme.getNivelTermico() != null
                && id.equals(scheme.getNivelTermico().getId())) return;
        var option = niveis.findById(id).filter(NivelTermico::isAtivo)
                .orElseThrow(this::invalid);
        scheme.setNivelTermico(option);
    }
}
```

`invalid()` devolve ApiException 400 com erro do campo. O caller transacional faz guard.requireOwner antes da chamada e mantém a entidade gerenciada; FK/constraint permanece como última defesa. Para retirar uma opção concorrentemente com novas seleções, definir serialização/lock e não supor que FK valide `ativo`.

Controller de opções proposto, em arquivo novo a partir da linha1:

```java
@GetMapping("/api/opcoes/niveis-termicos")
@Transactional(readOnly = true)
public List<Views.ReferenceOptionView> niveisTermicos() {
    return niveis.findAllByAtivoTrueOrderByNomeAsc().stream()
            .map(n -> new Views.ReferenceOptionView(n.getId(), n.getCodigo(), n.getNome()))
            .toList();
}
```

Adicionar imports, injeção do repository e annotations de classe; aplicar a política de acesso das rotas de referências do projeto. A rota de escrita usa CurrentUser e service, não grava a FK diretamente no controller. O JSON de leitura é objeto com id/codigo/nome; a escrita usa o ID e clear explícito. PUTs de formulários completos exigem os demais campos; PATCHs devem distinguir ausência, null e remoção.

## Testes e evidências por exercício

Cada solução especifica seus casos particulares. Em todos: criação/edição válida; GET após recarregar; projeção na outra tela; inválidos e ID inexistente; usuário alheio; registro legado; preservação de referência antiga; falha de gravação sem falso sucesso. Para FKs novas: schema vazio e upgrade; tentativa de gravar órfão; tentativa de excluir pai usado; UNIQUE/CHECK; efeitos de CASCADE/SET NULL em base descartável. Para emissão/recompensa: idempotência e concorrência, não somente botão desabilitado.

E1 e E2 são **evidências a produzir ao implementar**, com dados sintéticos. E1 mostra a origem da seleção; E2 mostra outra tela depois de novo GET/reload. Nenhuma screenshot foi inventada para funcionalidades não implementadas. O roteiro documental não deve ser apresentado como testes de persistência já passados.

Comandos de verificação a executar no lote de código correspondente:

```sh
npm run typecheck
npx vitest run components/piece-conservation-field.test.tsx components/piece-references.test.tsx
mvn -pl fai-application -am -Dtest=PieceConservationServiceTest,PieceReferenceViewsTest,CommunityTrendServiceTest -Dsurefire.failIfNoSpecifiedTests=false test
# MigrationVersionsTest pertence ao módulo persistence-mysql: usar o pom desse módulo com -am.
python -m scripts.refactoring.line_ratchet
```

Adaptar a seleção aos arquivos realmente alterados; adicionar os testes novos indicados em cada exercício. Maven deve rodar na raiz do repositório com Java 21 e configuração de teste, nunca em diretório pessoal. Não iniciar backend apontado ao banco real só para demonstrar DDL.

## Validação desta entrega documental

Foram conferidos os 20 enunciados, 21 SQLs, referências de arquivos/linhas e links locais. Não foram rodadas migrations, consultas no banco, aplicação ou testes funcionais nesta entrega. As verificações de estrutura/rastreabilidade estão registradas no manifesto e podem ser refeitas no commit de referência.
