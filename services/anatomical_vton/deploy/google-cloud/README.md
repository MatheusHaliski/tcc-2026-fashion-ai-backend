# FashionAI — GPU no Google Cloud

## Estado desta configuração

O worker suporta endpoints **Vertex AI de modelos customizados**, com autenticação
Application Default Credentials (ADC), renovação de token, limites de resposta e
validação dos contratos. O Google Workspace não provisiona GPU. São necessários
um projeto Google Cloud com faturamento, região com cota e modelos publicados.
Nenhum recurso foi criado e nenhum modelo foi executado na nuvem nesta alteração.

## Conexão do worker

1. Instale `pip install -r services/anatomical_vton/requirements-google-cloud.txt`.
2. Preencha os IDs não secretos de `env.example` na configuração do serviço.
3. Use identidade de serviço anexada à execução ou Workload Identity Federation.
   Em desenvolvimento, `gcloud auth application-default login` configura ADC;
   o login comum do gcloud sozinho não configura ADC para o Python.
4. A identidade do worker precisa de `aiplatform.endpoints.predict` nos endpoints
   selecionados; use um papel customizado restrito. A identidade de implantação
   é separada e precisa das permissões de deploy e `iam.serviceAccounts.actAs`.
5. Preserve o backend como origem do catálogo (`VTON_BACKEND_URL`). A seleção
   explícita `VTON_ANNOTATION_PROVIDER=vertex` envia a inferência para a GPU;
   não altera a autorização de mídia, o armazenamento nem a carteira do usuário.

Não existe fallback silencioso para uma anotação sintética. Sem ADC, endpoint ou
resultado válido, a execução é rejeitada e o monitor conserva o ciclo de retry.
Fotos pessoais devem ser processadas somente após consentimento e autorização
de propriedade no backend; os endpoints nunca devem ser chamados diretamente
pelo navegador. Avalie a política de retenção/logs do próprio container de modelo.

## Contratos dos containers de GPU

O Vertex recebe `{"instances": [objeto]}` e deve responder
`{"predictions": [resultado]}`. Os containers precisam implementar os contratos
abaixo; um endpoint Gemini/texto ou um modelo sem esses adaptadores não é compatível.

| tarefa | entrada | resultado validado |
| --- | --- | --- |
| `garment_annotation` | `image_png` base64, `response_schema`, `quality_feedback` | `Annotation`: atributos, keypoints, curva de gola, placket, máscara PNG, provedor e versão |
| `body_evidence` | `person_image` base64, `attributes`, `response_schema` | `BodyEvidence`: anchors, máscaras corporal/pele/região vestível, curvas e proveniência |
| `virtual_try_on` | `person_image`, `garment_image`, `category` | imagem gerada pela FASHN VTON 1.5 + diagnósticos de CUDA e da triagem de pose |
| `body_measurement` | só `person_image` (corpo inteiro) | proporções do Avatar 3D (`ratios`), recusas e avisos; sem imagem, malha nem pontos |

### Medidas do corpo (SAM 3D Body) na mesma T4

`deploy_fashn_vertex.py --with-sam3d` constrói o contêiner da FASHN com o SAM 3D Body
(`VTON_MODEL_ENGINE=fashn+sam3d_body`). A FASHN continua sempre carregada; o SAM 3D Body
sobe no primeiro pedido de medida e sai da GPU se a prova estourar a memória (a prova
é repetida uma vez). O detector de pessoa é o DWPose da própria FASHN: a foto precisa
ter uma pessoa só, da cabeça aos tornozelos, senão volta `FULL_BODY_NOT_VISIBLE`.

Os pesos ficam num repositório fechado do Hugging Face (`facebook/sam-3d-body-dinov3`,
SAM License; backbone sob a DINOv3 License). Antes do build:

1. peça acesso ao repositório com a conta do Hugging Face e espere a aprovação;
2. crie um token de leitura dessa conta e guarde-o no Secret Manager do projeto com o
   nome `fashionai-hf-token` (ou passe outro nome em `--hf-secret`), pelo console ou por
   `gcloud secrets create fashionai-hf-token --replication-policy=automatic --data-file=-`
   colando o token no terminal (nunca em chat, arquivo versionado ou log).

O script dá à conta do build acesso só a esse segredo; o Cloud Build entrega o token ao
BuildKit como segredo de um único `RUN` e ele não fica em nenhuma camada da imagem. O
commit e o SHA-256 de cada peso são impressos no log do build e gravados na imagem; o
servidor confere tudo de novo ao subir. Para fixar a versão, copie o commit e os hashes
impressos para `services/anatomical_vton/sam3d_assets.json`.

A foto de corpo inteiro só existe em memória durante a inferência (nem o worker nem o
Vertex a gravam) e a resposta leva apenas as proporções. O consentimento explícito é
conferido pelo backend Java antes de chamar `/v1/body/measure` do worker.

A segmentação e os landmarks devem vir de modelos reais. A validação geométrica
do worker continua obrigatória após a inferência. Uma resposta do VLM não prova
precisão anatômica. O resultado do warping atual é **PROJECTED_2D**, sem certificação
de ajuste físico ou precisão milimétrica.

Reconstrução FLAME/SMPL-X, textura UV, identificação de cabelo e transferência de
movimento requerem seus próprios adaptadores e pesos licenciados. As interfaces
numéricas em `services/digital_twin` não instalam esses modelos. Não os publique
sob um endpoint de anotação fingindo que produzem um avatar ou vídeo completo.

### Retrato estilizado do Avatar (SDXL + InstantID) na mesma T4

`deploy_fashn_vertex.py --with-portrait` acrescenta ao contêiner da FASHN o retrato estilizado do Meu Avatar
(`VTON_MODEL_ENGINE=fashn+portrait`, ou `fashn+sam3d_body+portrait` junto com `--with-sam3d`). A partir de uma foto do
rosto, o SDXL desenha um personagem 3D semirrealista; o InstantID mantém a identidade com o vetor do ArcFace
(antelopev2) e com os 5 pontos do rosto levados a um enquadramento de busto. O próprio ArcFace mede a semelhança entre a
foto e o retrato (cosseno), que volta junto para o app; o valor orienta, não certifica identidade.

- **Pesos e licenças** (todos públicos, sem token): SDXL base 1.0 (CreativeML Open RAIL++-M), VAE fp16-fix (MIT),
  InstantID (Apache-2.0) e o código do InstantID num commit fixo. O antelopev2 da InsightFace vem do release oficial
  e é **só para pesquisa não comercial**: serve ao TCC, mas num uso comercial precisa ser trocado. Tudo é conferido por
  SHA-256 no build (`portrait_assets.json`); a subida confere tamanho e o primeiro retrato confere os hashes.
- **Memória:** o retrato é exclusivo na T4. Enquanto ele gera, o modelo da prova vai para a RAM, o SAM 3D Body sai da
  GPU e o SDXL usa offload por partes; a FASHN volta no próximo pedido de prova. O primeiro retrato carrega o modelo
  (cerca de 2 a 3 minutos); os seguintes levam cerca de um minuto.
- **Privacidade:** a foto só existe em memória; o retrato não é guardado (volta para a tela, que deixa baixar).

Para montar só a imagem (sem ligar a T4):

```bash
python3 -u scripts/cloud/deploy_fashn_vertex.py --apply --build-only --with-portrait --region us-central1 --output work/fashn-portrait-build
```

## Plano de capacidade GPU

O comando abaixo apenas gera comandos revisáveis para **um modelo e endpoint já
existentes**. Não cria recursos, não executa deploy e não substitui tráfego sozinho.
Com a cota atual de uma T4, use um único container multi-tarefa e um único deployment. Os dois adaptadores podem apontar para o mesmo endpoint, distinguindo `garment_annotation` e `body_evidence` pelo campo `task`. Essa configuração depende de um container que implemente ambos os contratos; dois endpoints com uma T4 cada excederiam a cota informada.

```bash
python3 scripts/cloud/plan_vton_gpu.py \
  --project SEU_PROJECT_ID --region SUA_REGIAO \
  --endpoint ID_NUMERICO --model ID_NUMERICO \
  --service-account vton-runtime@SEU_PROJECT_ID.iam.gserviceaccount.com
```

O plano inicial usa uma T4/16 GB e `n1-standard-8`, com uma réplica. Isso é uma
referência para modelos pequenos de segmentação/pose, não uma garantia de memória
para modelos de vídeo ou reconstrução. Confirme a disponibilidade regional e
ajuste a classe de GPU pelo perfil real do modelo. O comando de deploy produzido
direciona 100% do tráfego ao novo modelo: revise antes de executá-lo.

Para milhões de itens, mantenha ingestão incremental, fila MySQL e artefatos
privados; não use SQLite para múltiplos workers. A capacidade deve ser medida com
latência, VRAM, taxa de retry, custo por imagem e qualidade em avatares de validação.
Uma réplica permanente gera cobrança mesmo sem requisições.

## Validação antes da ativação

```bash
python3 -m unittest services.anatomical_vton.tests.test_google_cloud -v
python3 -m services.anatomical_vton.monitor --once --batch 1
```

Os testes de transporte usam respostas simuladas e não comprovam GPU/modelos
reais. Para comprovação real, ainda faltam ADC no worker, modelos publicados,
pesos licenciados e um teste de inferência autorizado com a identidade do serviço.

## Projeto informado e pendências de conexão

Projeto: `project-14023673-32d6-4bf2-8b7`. Região: São Paulo (`southamerica-east1`). A disponibilidade e a cota GPU ainda precisam ser verificadas no projeto.
A CLI gcloud está instalada no terminal desta sessão, mas não há identidade Google Cloud nem ADC configurados nela.
O link do Console e o login do navegador do usuário não autenticam este worker.

Não é necessário inventar um ID Vertex AI: o serviço gera o ID de modelo e o
ID de endpoint durante o registro/publicação. A ordem de configuração é:

1. Conectar uma identidade autorizada ao projeto no ambiente de execução.
2. Confirmar região, faturamento e cota GPU; habilitar a API Vertex AI.
3. Selecionar pesos licenciados e construir containers que implementem os
   contratos de anotação e evidência corporal descritos acima.
4. Registrar os modelos, criar endpoints e revisar o plano de capacidade.
5. Publicar os modelos e inserir os IDs gerados na configuração do worker.
6. Executar inferência de validação e só então habilitar o fluxo do aplicativo.

O usuário executou o preparo no Cloud Shell com uma conta autorizada e informou:

| Recurso | ID | Estado informado no Cloud Shell |
| --- | --- | --- |
| API Vertex AI | `aiplatform.googleapis.com` | Habilitada |
| Anotação de roupas | `481863169896087552` | Endpoint criado |
| Evidência corporal | `5093549188323475456` | Endpoint criado |
| Modelos | — | Listagem vazia |

Projeto numérico retornado pelo Vertex: `796635131232`. Esses resultados foram
fornecidos pelo usuário; não foram consultados novamente pelo terminal do agente.

Os IDs já constam em `env.example`. A seleção dos providers permanece
`backend`/`http`; mude para `vertex` somente depois de publicar os modelos,
configurar ADC no worker e comprovar uma inferência. Isso não desativa outros
serviços já existentes do backend.

O login realizado no Cloud Shell não autentica esta sessão nem o backend em
produção. Endpoints vazios não provisionam automaticamente GPUs ou modelos.
A disponibilidade regional, o faturamento e a cota Vertex AI ainda precisam ser
verificados antes do deploy; a cota de GPU Compute Engine não comprova cota Vertex.

## Cota T4 confirmada pelo usuário

A consulta específica retornou `effectiveLimit: "1"`, `defaultLimit: "1"` e
`dimensions.region: "southamerica-east1"` para
`aiplatform.googleapis.com/custom_model_serving_nvidia_t4_gpus`.
O bucket global vazio não substitui esse bucket regional.

Isso confirma o limite regional de uma T4; não confirma consumo atual, estoque
físico de GPU, conclusão do upgrade da conta ou modelo implantado. O plano deve
compartilhar uma GPU entre tarefas, com réplica máxima igual a um. A adequação
de memória/latência precisa ser medida com os modelos reais.

Os dois endpoints já criados podem continuar vazios. Para ativar um único modelo
multi-tarefa, configure os dois IDs de inferência com o endpoint que receber esse
modelo, somente depois do deploy e do teste dos dois contratos.

## Publicação pelo Cloud Shell

A publicação usa `scripts/cloud/publish_vton_gpu.py`. O script valida o bundle
antes de executar comandos cloud e copia somente os pesos declarados, o relatório,
o manifesto e os fontes necessários. Arquivos não declarados, como credenciais,
não são copiados do diretório de modelos.

```bash
# Gere primeiro o plano. Exige um bundle REAL no caminho indicado.
python3 scripts/cloud/publish_vton_gpu.py \
  --bundle /caminho/model-bundle \
  --tag anatomy-v1-COMMIT

# --apply habilita APIs de build/registry, constrói e registra a imagem/modelo.
# Não inicia a réplica GPU. Build e armazenamento podem gerar cobrança.
python3 scripts/cloud/publish_vton_gpu.py \
  --bundle /caminho/model-bundle \
  --tag anatomy-v1-COMMIT --apply
```

A tag deve identificar uma versão nova e revisada. O script apresenta o model ID
real e os comandos para revisão do deploy; não usa um ID inventado. A implantação
GPU exige a conta `fashionai-vton-runtime@project-14023673-32d6-4bf2-8b7.iam.gserviceaccount.com`
e permissão `iam.serviceAccounts.actAs` do operador. Como os pesos estão na imagem,
a conta do modelo não precisa receber privilégios de administrador ou acesso
amplo ao banco/S3. A identidade do worker chamador precisa separadamente de
`aiplatform.endpoints.predict`.

Para compartilhar uma única réplica, ambos os adaptadores devem apontar ao endpoint
`481863169896087552` depois do deploy validado. O endpoint corporal já criado pode
permanecer vazio. O payload `task` seleciona o modelo dentro do mesmo processo.

### Bloqueios reais antes de executar --apply

- Bundle com dois exports treinados e compatíveis: **ainda ausente**.
- Relatório de avaliação/calibração e licenças dos pesos: **ainda ausentes**.
- Acesso IAM de build/registry e identidade do runtime: **não verificados**.
- Teste dos modelos em CUDA e em fotografias autorizadas: **não executado**.

O container foi preparado, mas não foi construído neste terminal: o acesso ao
socket Docker local foi negado. Os testes HTTP e numéricos passaram com doubles
explícitos; não substituem o build da imagem ou a validação do modelo real.
