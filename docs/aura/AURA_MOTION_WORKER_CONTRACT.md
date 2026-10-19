# Worker privado de Aura Impersonation

A integração Java está desativada quando `AURA_MOTION_WORKER_URL` ou `AURA_MOTION_WORKER_TOKEN` estiverem ausentes. Essas variáveis pertencem ao backend, nunca ao bundle web. Configurá-las não cria GPU, não instala modelo e não certifica saúde do endpoint.

Não use a URL do worker FASHN de imagem como se fosse um gerador de vídeo. O serviço abaixo precisa ser implementado por um worker que realmente execute segmentação, validação da peça, image-to-video e VFX/QA. O repositório não contém esse modelo em operação. A demonstração do Atelier continua separada, rotulada como demonstração e sem persistir um render real.

## Contrato HTTP

Todas as chamadas exigem `Authorization: Bearer <token>` sobre a conexão privada/TLS apropriada; nunca registre o token, imagens base64 ou o corpo integral da requisição. Timeout Java por chamada: 30s. O trabalho GPU é assíncrono.

`POST /v1/impersonation/jobs` recebe:

```json
{
  "idempotencyKey": "UUID-do-job-persistido",
  "personImage": "base64-da-foto-autorizada",
  "garmentImage": "base64-da-referencia-da-peca",
  "motionTemplateId": "STREET_IMPACT",
  "durationSeconds": 5,
  "fps": 24,
  "context": {"ruleVersion": 2, "brand": "…", "category": "…", "styleCategory": "…", "occasion": "…", "color": "…", "auraPresetId": "aura-v2-hash", "garmentHash": "sha256"}
}
```

Retorna `{"jobId":"id-interno-do-worker"}`. IDs aceitos: 1–200 caracteres alfanuméricos, `_`, `:`, `-`. Caminhos longos de operações Vertex devem permanecer no worker, associados ao seu ID interno. Repetir a chave deve reutilizar o mesmo trabalho; não cobrar/processar outra geração.

O preset reutilizável contém contexto visual e controles, não foto/rosto/render de outro usuário. Quando há produto/variante catalogada, a receita usa seus IDs; sem eles, usa também a assinatura da referência. O render pessoal permanece isolado por job/dono.

`POST /v1/impersonation/jobs/status`, corpo `{"jobId":"…"}`:

```json
{
  "status": "READY",
  "mp4Base64": "…",
  "durationSeconds": 5,
  "fps": 24,
  "personDetected": true,
  "garmentMatched": true,
  "temporalQualityPassed": true
}
```

Outros estados: QUEUED, PROCESSING, FAILED. READY exige MP4 até 14 MB (resposta JSON limitada a 20 MB), aproximadamente 5s/24fps. Não retorne flags verdadeiras apenas por ter gerado algum arquivo: valide corpo/roupa, decodificação, movimento e costura do loop com as entradas autorizadas. O script `validate_impersonation_video.py` é QA técnico parcial e deliberadamente não verifica identidade ou correspondência da roupa.

`POST /v1/impersonation/jobs/cancel`, corpo `{"jobId":"…"}`, deve confirmar `{"status":"CANCELLED"}` somente após aceitar efetivamente o cancelamento do trabalho remoto. A ausência dessa confirmação não deve ser apresentada como GPU cancelada.

## Operação e privacidade

Limite a concorrência conforme a GPU disponível; uma T4 não implica suporte aos modelos 14B/5B sem benchmark/offload. Não confunda duração de 5s com SLA de latência. Faça pesquisa/licença e benchmark conforme os relatórios desta pasta. Retenção e exclusão devem cobrir entradas/temporários do worker e mídia derivada no storage; a fila Java só preserva referências e estado.

Prévia e arquivo pessoal são servidos por endpoints autenticados do dono. A aplicação associa uma rota que verifica a visibilidade atual da peça/perfil, sem produzir cópia pública no storage. O backend não publica o original como fallback para geração falha. Seu registro e sua imagem canônica continuam preservados. Só a ação explícita de aplicar associa o resultado ao card. Nenhum seed, cena genérica ou mock pode ser devolvido como vídeo pessoal aprovado.
