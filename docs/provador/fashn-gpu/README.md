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

Validação local: 59 testes Python (51 VTON e 8 de geometria digital twin) e
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
