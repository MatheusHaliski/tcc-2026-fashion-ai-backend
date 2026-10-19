# Provador nativo FASHN e validação CUDA

Esta alteração acrescenta uma opção real de **provador generativo 2D**, separada
do warping TPS por evidências anatômicas. Não substitui uma simulação de tecidos
3D nem certifica medidas ou caimento físico.

## O que foi implementado

- FASHN VTON 1.5 nativo, DWPose e parser humano, com revisões imutáveis de código
  e pesos. Os seis arquivos (2.550.962.243 bytes) foram baixados e verificados
  por tamanho e SHA-256 neste ambiente. Pesos ficam fora do Git.
- Inicialização exige CUDA real para PyTorch e CUDAExecutionProvider no DWPose.
  Não há fallback CPU ou resultado simulado no servidor de inferência.
- Uma requisição por vez e uma réplica T4. O dtype segue a implementação nativa:
  T4 usa float32; não se força bfloat16 em hardware incompatível.
- O detector YOLOX é consultado antes do DWPose, evitando que o fallback de
  estimativa no quadro inteiro seja contado como uma pessoa detectada.
  DWPose rejeita ausência/multiplicidade de pessoas e pose insuficiente antes
  da geração. Após geração, pelo menos seis landmarks compartilhados precisam
  ter confiança >= 0,5 e RMSE normalizado <= 0,08. É um filtro inicial de
  consistência de pose; não mede fidelidade da roupa, identidade ou acurácia
  anatômica de golas, costuras, axilas, cós e virilha.
- O modo automático distingue foto de produto isolado e foto com modelo a partir
  da pose detectada; fotos com múltiplos modelos são rejeitadas.
- Fotografias transparentes são compostas sobre branco. Resultado é PNG novo,
  sem substituir a foto do usuário. Espelho é aplicado uma única vez no final.
- Categoria persistida da peça é encaminhada pelo backend autenticado. Peças
  superiores, inferiores e inteiras são aceitas. Calçados e acessórios não são
  silenciosamente tratados como camisetas.
- O worker exige `device=cuda:0` e identificação do motor na resposta. O Java
  mantém as verificações de propriedade, consentimento e validade do PNG.

O pipeline TPS existente continua exigindo as máscaras e ancoragens reais de
`BodyEvidence`; landmarks de pose genéricos não são promovidos a evidências de
costuras. FASHN não preenche esse contrato. FLAME/SMPL-X e precisão 3D universal
continuam sem evidência de execução neste projeto.

## Executar o teste no Cloud Shell autenticado

O script usa a identidade ativa do **seu Cloud Shell**. Esta sessão do agente
não possui ADC nem uma conta autenticada no gcloud. Não cole tokens no chat.

Em um diretório novo do Cloud Shell:

```bash
git clone --depth 1 --filter=blob:none --sparse \
  --branch codex/vton-real-gpu-2026-10-16 \
  https://github.com/MatheusHaliski/tcc-2026-fashion-ai-backend.git fashionai-gpu
cd fashionai-gpu
git sparse-checkout set services/anatomical_vton scripts/cloud docs/provador/fashn-gpu
python3 scripts/cloud/deploy_fashn_vertex.py --apply \
  --person docs/provador/fashn-gpu/inputs/person-demo.png \
  --garment docs/provador/fashn-gpu/inputs/garment-demo.webp \
  --category tops --garment-photo-type flat-lay
```

Sem `--apply`, só imprime o plano. O script verifica autenticação/acesso antes
de alterar recursos; habilita APIs, cria o repositório de contêiner, constrói
via Cloud Build, registra o modelo, cria um endpoint com DNS dedicado, publica
uma T4 e executa inferência real. A imagem Docker baixa os pesos durante o build,
sem consumir vários GB do disco de 5 GB do Cloud Shell. As dependências Python
foram resolvidas e fixadas em `requirements-fashn.lock`; isso não substitui a
validação do contêiner e da execução GPU.

O instalador cria uma identidade de build própria e concede somente escrita de
logs no projeto, escrita no repositório `fashionai-vton` e leitura no bucket de
fontes do build. Não concede Owner/Editor. A conta executando o instalador precisa
poder criar esses recursos e alterar essas políticas específicas; uma conta sem
essas permissões receberá erro do Google Cloud.

Os dois endpoints compartilhados antigos permanecem vazios. O novo DNS dedicado
é necessário para payload de duas imagens e timeout de inferência de 600 s.
O servidor limita payload/resposta a 9 MB. Cada imagem do teste deve ter até
3 MB e entre 16 e 1536 px por dimensão.

**O build e a alocação inicial podem levar dezenas de minutos.** Cota 1 não
assegura capacidade regional, permissão da conta de avaliação ou disponibilidade
imediata. O script não solicita aumento de cota nem muda de região sozinho.
Erros retornam código sanitizado, sem imprimir fotos ou credenciais.

O teste gera, em `work/fashn-gpu-proof/`:

- `try-on-gpu.png`: imagem realmente produzida pelo modelo.
- `evidence.json`: commit, hashes das entradas/saída e diagnóstico CUDA/pose.
- `deployment.json`: IDs de modelo, endpoint e operação, para acompanhamento.
- `backend-config.json`: configuração **sem segredos** para o worker.

**Por padrão, remove a réplica após o teste, inclusive se a inferência falhar.**
Registro do modelo, bucket de fontes do build, imagem no Artifact Registry e logs do Cloud Build continuam
armazenados e podem gerar custos de armazenamento. `--keep-deployed` mantém uma
T4 ativa e faturável para uso pelo aplicativo. Quando a réplica foi removida,
a configuração exportada só funciona depois de republicar o modelo.

Se o terminal for interrompido durante o deploy, confira o estado no console e
`deployment.json`. Reexecutar com a mesma pasta acompanha a operação gravada.
Para remover manualmente uma réplica, consulte o endpoint e use seu ID real:

```bash
gcloud ai endpoints describe ENDPOINT_ID --region=southamerica-east1 \
  --project=project-14023673-32d6-4bf2-8b7
gcloud ai endpoints undeploy-model ENDPOINT_ID --deployed-model-id=DEPLOYED_MODEL_ID \
  --region=southamerica-east1 --project=project-14023673-32d6-4bf2-8b7
```

As entradas de demonstração vêm do próprio repositório. `person-demo.png` é o
recorte já utilizado no diagnóstico MediaPipe; contém anotações prévias. A
camiseta é a arte FAI de laboratório. Servem para o **smoke de execução** e não
para benchmark independente de acurácia. Para avaliação real, use imagens
consentidas, fotografias de produtos e referências de vestimenta por categoria.
Não publique fotografias pessoais em evidências de PR sem autorização.

## Corrigir o pacote de pesos e criar uma nova versão

O servidor no Vertex abortou com `FASHN_WEIGHT_MISSING_OR_CORRUPTED`, antes de
carregar os modelos em CUDA. Esse erro genérico não distingue ausência, tamanho,
hash ou acesso; não prova que o download foi corrompido. A verificação de build
anterior rodava como root. Os downloads temporários tinham permissão 0600 e o
`chmod a-w` final os deixava 0400, incompatível com outro UID de inferência.

A correção publica os pesos públicos como 0444 e usa o diretório próprio
`/opt/fashionai/weights/fashn`, fora de `/models`. O diretório e o código precisam
ser atravessáveis pelo usuário 10001. O build agora verifica **todos os pesos
depois de USER 10001**, e importa FASHN/parser/ONNX sem GPU antes de publicar a
imagem. HOME aponta para a pasta gravável do usuário. Nenhuma verificação de
SHA-256 foi removida. A inicialização registra caminho/UID e erros específicos
para arquivo ausente, ilegível, tamanho incorreto ou hash divergente.

[Teste real de leitura dos seis pesos por UID 10001](nonroot-weights-proof.txt).
Foi executado em contêiner local sem rede, com montagem somente leitura. O modo
antigo negou leitura; o modo corrigido permitiu verificar SHA-256 dos seis
arquivos reais, totalizando 2.550.962.243 bytes. Isso valida acesso/integridade,
**não executa FASHN em GPU nem reproduz montagens internas do Vertex**. Não foi
confirmado se o Vertex sobrepôs o antigo diretório; a nova localização evita
compartilhar esse caminho e os novos diagnósticos identificam futuras falhas.

Como a imagem registrada contém o pacote anterior, repetir o deploy do mesmo
modelo ou usar `--resume-build` com o build antigo não aplica a correção.
Depois de atualizar o código, utilize:

```bash
python3 -u scripts/cloud/deploy_fashn_vertex.py --apply --new-release \
  --person docs/provador/fashn-gpu/inputs/person-demo.png \
  --garment docs/provador/fashn-gpu/inputs/garment-demo.webp \
  --category tops --garment-photo-type flat-lay
```

`--new-release` preserva o estado anterior em `deployment.previous-*.json` e
registra uma nova imagem/modelo. Não apaga modelos, imagens ou endpoints antigos;
não substitui um modelo implantado nem avança enquanto uma operação anterior
estiver pendente. O endpoint vazio pode ser reutilizado. Reexecutar com o mesmo
commit retoma a nova versão em curso, sem criar outro build. Não combine essa
opção com `--resume-build` ou `--retry-failed-deploy` do modelo anterior.

## Diagnosticar falha de deploy do Vertex

`CLOUD_OPERATION_FAILED: 9` corresponde a uma pré-condição, mas o número sozinho
não identifica a causa. Consulte a mensagem real da operação e os logs do
servidor. A conta desta sessão não tem identidade Google Cloud; execute no
Cloud Shell autenticado, depois de atualizar o instalador:

```bash
python3 -u scripts/cloud/deploy_fashn_vertex.py --diagnose
```

Esse modo apenas lê o estado, a operação e o endpoint; não habilita APIs, cria
recursos, inicia build ou repete deploy. Não precisa das imagens de teste. A
mensagem original da falha de operação agora aparece também na exceção, junto
ao nome da operação; o progresso mostra o tipo da operação e o tempo decorrido.

O deploy observado retornou `Model server exited unexpectedly`. Isso significa
que o servidor do modelo encerrou na inicialização, não comprova falta de cota
ou necessidade de usar o web app. Os logs do endpoint precisam identificar a
exceção antes de alterar bibliotecas, hardware ou publicar outro contêiner.

Uma operação já concluída com erro agora interrompe a retomada, sem iniciar outra
tentativa silenciosamente. Somente após corrigir a causa, acrescente
`--retry-failed-deploy` aos argumentos completos do teste para autorizar uma nova
tentativa com o mesmo modelo. O estado preserva a falha anterior. Se o conserto
exigir uma nova imagem de contêiner, é necessário registrar essa nova versão;
a flag de retry do mesmo modelo não atualiza seu contêiner.

## Retomar um Cloud Build após interrupção do terminal

O instalador envia o build com `--async`, grava seu ID em `deployment.json` e
consulta o status separadamente a cada 20 segundos. Uma interrupção durante essa
espera não envia cancelamento pelo `gcloud builds submit`. Reexecutar com a
mesma pasta reutiliza o ID gravado; não submete outro build. Existe uma pequena
janela entre a submissão e a gravação do ID: se a sessão cair exatamente nela,
consulte o console e use `--resume-build ID_REAL`.

Para builds criados pela versão anterior, depois de atualizar a cópia com
`git pull --ff-only`, use os mesmos argumentos de imagens e acrescente:

```text
--resume-build ID_REAL_DO_BUILD
```

O instalador verifica projeto/imagem, aguarda se ainda estiver em execução e
prossegue com registro/deploy se já estiver em `SUCCESS`. Se um build cancelado
já tiver uma tentativa nova criada no console, procura e reutiliza essa tentativa
para a mesma imagem. Mais de uma tentativa ativa impede nova submissão.

Um build confirmado como `CANCELLED` só é substituído automaticamente quando
`--restart-cancelled-build` também é informado e não há tentativa ativa ou
concluída para reutilizar. `FAILURE`, `TIMEOUT` e outros erros não iniciam um
novo build automaticamente: precisam de análise do log. O instalador preserva
qualquer modelo registrado/operação de deploy. O diagnóstico de inferência
registra separadamente o commit do instalador e a imagem/prefixo de commit do
contêiner efetivamente utilizado.

## Retomar após erro de conta de serviço IAM

`Service account ... does not exist` pode ocorrer enquanto a identidade criada
se propaga no IAM. A mensagem genérica de lint de condições não é motivo para
alterar a política de condições. O instalador agora descreve a conta, aguarda
sua disponibilidade e repete somente erros transitórios de identidade/política
(até oito tentativas, com esperas de 5 a 20 segundos). Erros de permissão não
são repetidos nem contornados; uma conta desabilitada também é rejeitada.

Na cópia existente do Cloud Shell, execute `git pull --ff-only` e repita o
comando Python acima. Não clone novamente nem apague `deployment.json`. Se o
modelo ainda não foi registrado, a mesma pasta de estado e o endpoint vazio
podem ser retomados com a versão corrigida. Se já houver um modelo ou operação
de deploy de outra versão, o instalador preserva os recursos e interrompe a
atualização para não substituir uma implantação ativa.

## Conectar o worker ao aplicativo

Instale `requirements-google-cloud.txt` no worker CPU privado, configure as
variáveis de `backend-config.json` nele e forneça ADC de uma identidade com
`aiplatform.endpoints.predict` no endpoint. O Java precisa de `VTON_WORKER_URL`
e `VTON_WORKER_TOKEN`; `VTON_WORKER_TIMEOUT_SECONDS=650` permite a inferência longa.
A identidade do backend não é criada nem recebe papéis amplos automaticamente.
Chamadas síncronas precisam de timeout compatível no proxy; uma fila assíncrona
é necessária antes de liberar esse fluxo a alto volume de usuários.

O endpoint Java é `POST /api/try-on/anatomical-renders`, com `pieceId`,
`personMediaUrl` próprio e `processingConsent=true`. O worker privado seleciona
`vertex_fashn` por configuração, sem depender de anotações customizadas prontas
para produzir a imagem generativa 2D. O pipeline de auditoria/anotações pode
continuar separadamente; este modo não declara suas anotações como concluídas.

## Situação de validação

Validação local: 71 testes Python (63 VTON e 8 de geometria digital twin) e
26 testes Java direcionados. A suíte de CI usa pytest para incluir também os
novos testes funcionais de contrato. Não foi executada a suíte inteira do
monorepositório. As dependências GPU foram resolvidas, mas o build do contêiner
GPU não foi executado localmente.

A execução CUDA, a imagem final e o comportamento em T4 **ainda precisam do
smoke autenticado acima**. Testes unitários/contratos não são evidência de
inferência GPU. Não há imagem de resultado GPU inventada neste documento.

Referências primárias:

- [Código oficial FASHN VTON 1.5](https://github.com/fashn-AI/fashn-vton-1.5)
- [Pesos oficiais](https://huggingface.co/fashn-ai/fashn-vton-1.5)
- [Endpoint dedicado e timeout](https://docs.cloud.google.com/vertex-ai/docs/predictions/create-public-endpoint)

### Construir a imagem corrigida sem implantar GPU

No Cloud Shell autenticado, este comando publica uma imagem nova do commit atual no Artifact Registry em São Paulo. Não precisa de fotos e não registra modelo nem cria endpoint/réplica T4:

```bash
cd ~/fashionai-gpu && git pull --ff-only && python3 -u scripts/cloud/deploy_fashn_vertex.py --apply --build-only
```

O build usa o Dockerfile corrigido: pesos em `/opt/fashionai/weights/fashn`, permissões de leitura e verificação SHA-256 dos seis arquivos após `USER 10001`. Uma falha nesse preflight impede a publicação. O ID é salvo em `work/fashn-gpu-proof/images/<commit>/build.json`; repetir o mesmo comando retoma a espera, sem outro build. O resultado só declara `IMAGE_BUILD_SUCCEEDED` depois de Cloud Build retornar sucesso. Isso não comprova inferência CUDA.

A execução completa com `--new-release` no mesmo commit/diretório de saída reaproveita esse build, preservando o estado da tentativa antiga. Não use o ID `6f7f214f-c009-4f5c-8426-618ab51bde64`: ele contém a imagem anterior à correção.

Esta sessão do Codex não tem identidade Google Cloud; a publicação deve ser executada no Cloud Shell autenticado. O modo de planejamento local (`--build-only` sem `--apply`) não acessa o GCP.

### Servidor inicia e recebe shutdown durante o deploy

Nos logs fornecidos pelo usuário em 17/10, os pesos passaram no preflight como UID 10001, FASHN carregou em `cuda:0` e o Uvicorn anunciou startup completo, seguido de shutdown controlado em uma das tentativas. O trecho não mostra traceback, OOM ou uma inferência concluída. Isso comprova carregamento/inicialização na GPU, não sucesso do teste de vestimenta.

A configuração anterior omitia `failureThreshold` e `initialDelaySeconds` na startup probe. A API Vertex usa três falhas por padrão. Importar CUDA, verificar 2,55 GB e carregar os modelos antes de Uvicorn escutar pode exceder essa janela. O shutdown próximo ao startup é compatível com esse problema; a causa única ainda não foi confirmada por um evento de probe do GCP.

A nova configuração registra startup probe com atraso de 30 s, 60 falhas permitidas e período de 10 s. A leitura de `/health` tem timeout interno de 5 s; a probe tem timeout de 15 s. A readiness continua exigindo `/health` saudável e o deploy tem prazo de 1.800 s. O erro de importação/pesos não é ignorado e não há fallback simulado.

Como `ModelContainerSpec.startupProbe` é imutável, repetir deploy do modelo antigo não aplica a correção. Use `--reregister-model` **uma vez** para arquivar o registro anterior e registrar a mesma imagem com as sondas corrigidas. Não reconstrói a imagem nem apaga o modelo antigo; bloqueia se houver modelo implantado ou operação pendente.

Para o clone antigo do Cloud Shell, atualize apenas o instalador:

```bash
cd ~/fashionai-gpu && git fetch origin codex/vertex-startup-probes-2026-10-17 && git restore --source=FETCH_HEAD -- scripts/cloud/deploy_fashn_vertex.py
```

Depois execute:

```bash
python3 -u scripts/cloud/deploy_fashn_vertex.py --apply --reregister-model --person docs/provador/fashn-gpu/inputs/person-demo.png --garment docs/provador/fashn-gpu/inputs/garment-demo.webp --category tops --garment-photo-type flat-lay
```

Se interromper a espera depois que o novo registro/operação for salvo, retome o mesmo comando **sem** `--reregister-model`. O modo de planejamento sem `--apply` lê a imagem salva em deployment.json; não usa a imagem do HEAD novo.

Validação local: testes de contrato das probes, preservação de estado, bloqueio de operação pendente e percurso do CLI até a submissão de deploy (simulada), comprovando que não envia outro Cloud Build. A nova implantação real e o teste CUDA seguem pendentes do Cloud Shell autenticado.

Referência consultada: [ModelContainerSpec](https://cloud.google.com/vertex-ai/docs/reference/rest/v1/ModelContainerSpec) e [Probe](https://cloud.google.com/vertex-ai/docs/reference/rest/v1/Probe), também conferidos no discovery REST v1 em 17/10/2026.

## `GOOGLE_CLOUD_HTTP_422` no `:predict` (17/10/2026)

O deploy terminou e a réplica T4 respondeu: o 422 vem do **servidor da GPU**, que recusou a entrada ou o resultado
(`vertex_runtime/server.py` devolve 422 para `INVALID_PREDICTION_INPUT`, foto ilegível ou acima de 1536 px —
`INVALID_VTON_IMAGE` —, pose da pessoa insuficiente e `GENERATED_POSE_DRIFT_REJECTED`). Até aqui o instalador
descartava o corpo do erro, então o motivo não aparecia, e removia a réplica a cada falha (novo cold start de 15–20 min).

Agora o instalador:

- mostra o **código curto do servidor** e o que fazer (`servidor: EXACTLY_ONE_PERSON_WITH_POSE_REQUIRED — …`). Só
  códigos conhecidos são impressos; o corpo bruto (que pode ecoar as imagens) continua oculto;
- confere as fotos **antes** de qualquer deploy: JPG, PNG ou WebP, e reduz para 1536 px no maior lado (com Pillow) em
  vez de mandar uma foto que o servidor recusaria;
- com `--keep-deployed`, **mantém a réplica mesmo quando o smoke falha**, para testar outra foto sem esperar o cold
  start; `--apply --undeploy` remove só a réplica do modelo salvo em `deployment.json`.

Para o clone do Cloud Shell, atualize só o instalador e rode de novo mantendo a réplica:

```bash
cd ~/fashionai-gpu && git fetch origin claude/vertex-predict-diagnostics \
  && git restore --source=FETCH_HEAD -- scripts/cloud/deploy_fashn_vertex.py
python3 -u scripts/cloud/deploy_fashn_vertex.py --apply --keep-deployed \
  --person FOTO_DA_PESSOA.jpg --garment FOTO_DA_PECA.jpg --category tops --garment-photo-type flat-lay
# terminou os testes:
python3 -u scripts/cloud/deploy_fashn_vertex.py --apply --undeploy
```

Foto da pessoa que passa na triagem de pose: uma pessoa só, de frente, em pé, braços ao lado do corpo, corpo inteiro
ou da cintura para cima com ombros, cotovelos, punhos e quadril visíveis, fundo simples, sem anotações desenhadas.
`person-demo.png` (pose de ioga de lado, com o esqueleto do diagnóstico desenhado por cima) serve para o smoke de
execução, mas é candidata natural a `GENERATED_POSE_DRIFT_REJECTED`.

## Cota de GPU esgotada: subir em outra região (17/10/2026)

A cota `CustomModelServingT4GPUsPerProjectPerRegion` é **por região**. Quando o `deployModel` falha com
`The following quotas are exceeded` mesmo sem réplicas ativas, suba a mesma imagem em outra região, sem novo
Cloud Build:

1. Ver o limite de cada região (T4 e L4):

```bash
for Q in CustomModelServingT4GPUsPerProjectPerRegion CustomModelServingL4GPUsPerProjectPerRegion; do
  echo "== $Q"
  gcloud beta quotas info describe "$Q" --service=aiplatform.googleapis.com \
    --project=project-14023673-32d6-4bf2-8b7 --format=json 2>/dev/null | python3 -c '
import json,sys
info=json.load(sys.stdin)
for d in info.get("dimensionsInfos",[]):
    region=d.get("dimensions",{}).get("region","demais regiões")
    print("  "+region+":",d.get("details",{}).get("value","?"))'
done
```

2. Subir a réplica na região escolhida, reaproveitando a imagem já construída (`deployment.json` da região antiga).
   Use um `--output` novo por região; `--accelerator NVIDIA_L4` usa `g2-standard-8`:

```bash
IMAGE=$(python3 -c "import json;print(json.load(open('work/fashn-gpu-proof/deployment.json'))['image'])")
python3 -u scripts/cloud/deploy_fashn_vertex.py --apply --deploy-only --region us-central1 \
  --source-image "$IMAGE" --accelerator NVIDIA_TESLA_T4 --output work/fashn-gpu-us-central1
```

   O script registra o modelo na nova região, cria o endpoint dedicado, sobe 1 réplica, grava
   `backend-config.json` (com `GOOGLE_CLOUD_LOCATION` da nova região) e imprime `GPU_DEPLOYED`. A réplica fica
   ativa e faturável até o `--undeploy`:

```bash
python3 -u scripts/cloud/deploy_fashn_vertex.py --apply --undeploy --region us-central1 --output work/fashn-gpu-us-central1
```

Se o Vertex não conseguir baixar a imagem de outra região, construa uma cópia na região nova com
`--build-only --region <região> --output <pasta>` e passe a imagem dela em `--source-image`.
