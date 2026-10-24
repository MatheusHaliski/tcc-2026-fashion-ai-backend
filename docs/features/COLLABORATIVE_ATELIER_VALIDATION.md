# Validação do Atelier colaborativo

## Suítes específicas

Frontend:

```sh
npx vitest run components/atelier-projects/atelier-projects.test.tsx components/atelier/atelier-panels.test.tsx
```

Os testes de projetos cobrem aba padrão, quatro links legados, aceite de convite, criação privada e direitos, preservação do rascunho após 409, consentimento da publicação, vínculo do voto com a revisão, comando de análise com versão/revisão, arquivo em leitura e ficha imprimível com texto escapado. Os testes existentes de `atelier-panels` cobrem a interface legada. O log da execução específica é `work/atelier-frontend-validation.log`.

Backend (executar junto ao build serial do checkout):

```sh
./mvnw -pl fai-application -am test -Dtest=AtelierProjectServiceTest,AtelierProjectPersistenceTest -Dsurefire.failIfNoSpecifiedTests=false
```

`AtelierProjectServiceTest` contém 17 cenários de autorização, snapshots, versão, idempotência, direitos, revisão, prazo, campos incompletos e autor excluído. Inclui os três casos P2: visibilidade no replay de criação, aprovação histórica após 50 análises mais recentes e medida nula.

`AtelierProjectPersistenceTest` contém oito cenários com Hibernate/JPA e H2 em modo MySQL. Repositórios e transações são reais; contas e `Guard` são isolados por mocks. A suíte cobre convite ainda não aceito, unicidade SQL do voto, edições concorrentes, publicações concorrentes, retry simultâneo de publicação, retry simultâneo do voto, decisões concorrentes de análise e limpeza de dados dependentes/pseudonimização. Os testes concorrentes usam duas conexões e uma barreira de início; as asserções verificam o estado persistido final.

Essa suíte usa geração de esquema pelas entidades. Ela não aplica o arquivo Flyway em um servidor MySQL, e não substitui a validação da migração em MySQL real.

## Limites da verificação

A integração central executou os 17 testes de serviço e os oito testes JPA/H2 com sucesso, junto aos demais módulos. O pacote completo Java 21 também compilou.

O Chromium percorreu 18 checkpoints em 1440 e 390 px: criar, editar, publicar, registrar interesse, revisar, exportar JSON, imprimir/PDF e abrir as quatro áreas legadas. Autenticação e APIs foram fixtures explícitas. A interface real corrigiu dois problemas encontrados na verificação: a largura mínima das abas expandia o mobile para 727 px, e a impressão incluía a navegação sobre a ficha. A execução final não apresentou overflow ou erros JavaScript; PDFs foram inspecionados também por extração de texto.

Essas evidências validam a interface com respostas controladas e os serviços em testes separados, não um ambiente integrado com MySQL de produção. A migração Flyway em MySQL real e a publicação de produção continuam pendentes. Capturas e escopo geral em [validação da integração](INTEGRATION_DELIVERY_2026-10-23.md).
