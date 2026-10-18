# Studio, AURAs e selos Hype — implementação de 17–18/10/2026

Este documento descreve o estado final desta edição, incluindo a fila persistida adicionada em 18/10.

## Correções desta edição

- `AuraMaterialPanel` reúne escolhas nas cartelas correspondentes: comum, Electro, Splash, Hype e Metamorfose. O acesso Impersonation encaminha à bancada existente do Atelier, que continua identificada como demonstração.
- A cartela Hype abre diretamente os 40 tratamentos de `HYPE_PRESETS`. Não depende do download de um catálogo de fundos nem força SCANNER ao selecionar outro tratamento. O seletor Hype independente reaproveita o mesmo conteúdo.
- Presets legados permanecem em sua família; escolher um tratamento novo substitui a configuração Hype legada correspondente. Explorar não altera a peça; a persistência continua pertencendo ao editor que hospeda o Studio.
- Estados de loading/erro/vazio do catálogo são explícitos, com nova tentativa. Previews de composição não iniciam todos os vídeos simultaneamente; o hover inicia e a saída pausa.
- Acabamento Material possui explicação e não muda o tecido cadastrado.
- Ajuda de selos está disponível na análise e nas ofertas; datas existentes no payload são exibidas com o formatador de idioma.
- A receita contextual Impersonation agora considera a cor da peça no fingerprint (versão 2). Respostas de worker sem status final válido, sem job ou com job mock marcado READY são rejeitadas.

## Como os selos funcionam

Há cinco marcadores automáticos derivados do Hype disponível e público: VIRAL, TRENDING, EMERGING, CLASSIC e RARE. Suas condições são as de `HypeSeals.java`. Não exigem solicitação e não possuem TTL fixo: deixam de aparecer quando os critérios deixam de valer. Não são os quatro níveis visuais de carta nem os níveis de usuário.

Ofertas institucionais de política HYPE são outro mecanismo. Usuário proprietário solicita, atende critérios/consentimento e aguarda revisão quando exigida. Só APPROVED significa concedido. Na implementação atual, `SealService.issue` usa `availableUntil` da campanha como vencimento do vínculo quando definido; sem essa data, usa emissão +365 dias. Atualidade das métricas não é validade do selo. Promoção, coupon e direito artístico têm regras próprias.

Não foi alterada a regra de aprovação nem implementada revogação automática de todo selo institucional quando o Hype cai. Também não se modificou, sem decisão de negócio, o bloqueio de vínculos por emissor: múltiplas ofertas/stacking e vínculos expirados continuam exigindo revisão específica.

## Mapa de aplicação e progressão

| Área | Integração existente / limite |
| --- | --- |
| Settings | Preferências globais e bloqueio Loft para ativar Impersonation; não significa worker de vídeo configurado |
| Peça/look, foto e arte | Studio compartilhado; hosts existentes persistem o background |
| Closet, feed, busca, perfis | Renderizam cards e Hype; acesso e direitos não se concedem por visualização |
| Atelier | Metamorfoses (mock explícito), Linha do Tempo, Tendências, Conquistas & Quarto; galeria mantém acervo |
| Minhas Artes / loja | Licenças institucionais Hype/Metamorfose não equivalem a todos os direitos de participante |
| Promoções/selos/coupons | Políticas, solicitação, concessão e validade; produtores de entitlement artístico ainda incompletos |
| Copilot/Autopilot | Recomendação/planejamento não concedem XP ou arte automaticamente |
| FLAIR | Efeito da partida não equivale a concessão artística persistente |
| Try-on | Worker FASHN é VTON de imagem; não gera vídeo Impersonation |
| Quarto/Espelho | Inventário/visualização básicos distintos das AURAs avançadas |

Progressão atual: ESTREIA 0, STUDIO 300, LOFT 900, CLOSET 2000, ATELIER 4000, PENTHOUSE 7500 e MAISON 12000. O total elegível acumulado define nível; o saldo é gastável. BASIC começa em ESTREIA, DYNAMIC em STUDIO, METAMORPHOSE/IMPERSONATION em LOFT. Nível, licença, propriedade e direito equipado são verificações separadas.

Referências de RF: Studio RF11, foto/Atelier evolução RF12, catálogo RF4–9, preferências RF23, selos RF25, Points RF30/RF41, Eras RF34, Coleções RF35, FLAIR RF37, coupons RF38, loja de objetos RF39 e Try-on RF18. Há numerações históricas divergentes; Trello não foi alterado.

## Pesquisa e QA executáveis

```bash
python3 scripts/research/research_impersonation_video.py --output work/impersonation-research
python3 -m unittest discover -s scripts/research -p 'test_*.py'
python3 scripts/research/validate_impersonation_video.py CAMINHO_DO_VIDEO.mp4 --output work/impersonation-qa.json
```

O primeiro consulta somente documentação pública, sem fotos. Registra falhas, hash e licença declarada; não inventa VRAM/latência. O terceiro decodifica vídeo local e verifica duração aproximada de 5s, 24fps, resolução, codec, ausência de áudio, frames, movimento e salto no loop. Retorna código 2 para revisão (inclusive clip estático). Essas verificações não certificam identidade, correspondência de roupa ou encaixe anatômico; esses indicadores continuam falsos no relatório até avaliação independente.

A pesquisa de oito fontes foi executada com sucesso. Nenhum modelo pesado foi baixado, nenhuma foto pessoal enviada e nenhum benchmark GPU executado. Consulte `IMPERSONATION_VIDEO_RESEARCH.md` e os registros JSON/CSV ao lado.

## O que continua pendente

A geração individual em GPU continua pendente. A fila persistida, o upload autorizado e a aplicação de resultados estão implementados nesta edição, mas não há worker real de segmentação + validação da roupa + transferência de movimento em operação. É necessário selecionar, implementar e configurar esse provedor antes de habilitar produção. A demonstração mock continua separada e identificada na bancada.

O ambiente desta sessão não apresenta identidade Google Cloud vinculada nem gcloud. O sucesso de Cloud Build e os logs de CUDA anteriores não comprovam inferência final nem geração de vídeo. Por isso, não foi feito outro deploy nem declarado resultado GPU validado.

Concessão de direitos artísticos por todos os produtores de evento, stacking editorial de perfil, repasse de toda venda e reconciliação completa dos protótipos também não foram implementados nesta edição. Consulte os documentos de estado existentes; estas correções não tornam essas propostas prontas.

## Continuação: fila persistida e conexão do app

Esta edição implementa a orquestração no backend, sem declarar um modelo GPU em funcionamento:

- V73 cria `aura_motion_jobs`, com dono, peça/revisão, chave idempotente, hash de entrada, consentimento, estado, resultado e índice de fila.
- `/api/me/aura-impersonation/capabilities`, `/jobs`, `/jobs/{id}`, `/jobs/{id}/cancel` e `/jobs/{id}/apply` são endpoints autenticados e retornam `Cache-Control: no-store`.
- Geração exige Loft, propriedade da peça/mídia, consentimento e preferência global ou ativação individual. Transações serializam a criação por dono; cada dono possui no máximo dois jobs ativos. Não há débito de FAI Points nesta implementação.
- Runner com scheduler dedicado consulta lote limitado; retries de transporte são limitados e usam o mesmo ID no worker. Timeout total de 20 minutos. Cancelamento remoto exige confirmação do worker quando já foi despachado.
- Worker recebe somente bytes das duas imagens e contexto do servidor, com hashes. Não recebe URL arbitrária do cliente para buscar na rede. Referências originais são preservadas; revisão/hash alterados impedem resultado obsoleto.
- Um resultado só é armazenado como READY quando o worker autenticado declara pessoa detectada, roupa correspondida e QA temporal aprovado, e o backend valida limites/formato básico MP4, duração e FPS. O backend não possui decoder próprio: o worker deve executar decodificação/QA real. Essas declarações não certificam fidelidade anatômica universal.
- O vídeo permanece em armazenamento restrito. Aplicar em peça visível a terceiros exige consentimento separado e revisão ainda válida. Edição comum não pode fabricar/substituir `impersonationData` emitido pelo servidor.
- Atelier possui controles de geração/histórico independentes da demonstração, bloqueados quando não há worker configurado. Editor de foto/arte encaminha ao Atelier com a peça selecionada. Minhas Artes lista renders pessoais separadamente das licenças institucionais. O card da peça reconhece mídia READY vinculada ao dono.

A migração está escrita, mas não foi aplicada ao banco compartilhado. Nenhum vídeo pessoal foi gerado nesta sessão. Ainda é necessário configurar/operar o worker de visão e vídeo descrito em `AURA_MOTION_WORKER_CONTRACT.md`, validar o fluxo em GPU, ampliar integração para looks e resolver os demais direitos de recompensa documentados anteriormente.

Também foi corrigida a atualização recente do provador da main: seus rótulos `tryOn.ia_*` estavam ausentes dos catálogos. Os textos foram completados em português/inglês/espanhol. A mensagem para `VTON_NOT_CONFIGURED` informa indisponibilidade do serviço, sem deduzir o estado físico da GPU.

A rota de upload chamada por esse diálogo, `POST /api/try-on/person-photos`, também estava ausente. Agora aceita foto autenticada do próprio usuário, valida conteúdo/dimensões/limite, preserva original em caminho privado e produz JPEG de até 1536 px. Upload não aciona IA nem concede XP. A bancada Impersonation pode usar esse upload para escolher a fotografia da pessoa separadamente da referência da peça.

A mídia pessoal não é publicada como arquivo aberto: fotos de entrada usam `restricted/users/<dono>/tryon/person/` e renders usam `restricted/users/<dono>/aura-impersonation/`. O preview do dono é carregado por requisição autenticada e object URL transitória. Depois de aplicar, `/api/pieces/{pieceId}/aura-media/{jobId}` revalida a visibilidade da peça/perfil, moderação e o job atualmente equipado a cada solicitação. Não há cópia em diretório público. A entrada pessoal não é registrada como resultado de provador nem gera recompensa. Retenção/exclusão de temporários de entrada e derivados ainda precisa de política operacional antes de habilitar o worker em produção.
