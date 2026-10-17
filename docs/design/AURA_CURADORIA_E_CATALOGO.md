# AURA — curadoria e catálogo

Seis composições originais foram geradas para o FashionAI, inspiradas na pesquisa editorial: cetim e cromo líquido (AURA comum), fios ciano e rosé (Electro), tinta violeta e coral (Splash). Arquivos WebP: `public/aura/fashion-curated/`.

Foram excluídas referências de cartas esportivas, personagens, logos e imagens comerciais sem licença verificada. Os arquivos de terceiros da pesquisa não foram incorporados ao produto.

Cada família abre um modal no Background Studio. Ao abrir, consulta o catálogo sem cache e mostra as variações publicadas. A seleção `compositionPreset` é persistida; a foto mantém seu pipeline. A borda automática acompanha a paleta. O guia aos iniciantes explica as famílias e a diferença entre personalização e recompensas, aparece uma vez por usuário e pode ser reaberto.

## Atualização dos modelos

```bash
python3 -m pip install -r scripts/design/requirements-aura.txt
python3 scripts/design/update_aura_models.py --max-seconds 120
python3 scripts/design/update_aura_models.py --apply --per-family 2 --max-seconds 120
```

O script consulta Wikimedia Commons para comum, Electro, Splash, Hype e Metamorfose. Aceita apenas raster CC0/domínio público, títulos de composições abstratas e dimensões adequadas. Rejeita logos, esportes, cartazes e diagramas. Publica WebP local e atualiza o manifesto atomicamente, preservando entradas e evitando duplicatas. URLs externas e SVG não entram no renderer.

O filtro é textual e técnico: não equivale a revisão estética por visão computacional. A execução desta edição retornou **zero candidatos elegíveis**; somente as seis composições originais foram adicionadas. O script pode ser agendado no ambiente publicador, mas **este PR não configura um agendador de produção**. Em hospedagem estática, novos assets precisam ser publicados para aparecer.

As bordas dinâmicas foram atribuídas ao Metamorfose na revisão final: o pulso de ganho/perda exige um modo Metamorfose e Hype ativos. AURA Hype apresenta a foto e seu score global.

As recompensas exclusivas de FLAIR/Atelier, concessão e revogação por nível Hype e Minhas Artes continuam pendentes. Presets básicos não concedem conquistas nem FAI Points.

## Numeração

Diretriz: RF46 é o último RF; evoluções posteriores devem virar CA dos RFs correspondentes. O Trello não está instalado/conectado nesta sessão, portanto não foi editado. Caminhos históricos RF47–RF54 permanecem para evitar quebrar links antes da reconciliação de rastreabilidade.

## Próxima etapa — criadores de selos e looks

- Clareza nos segmentos e modais de selo perfil/peça/look/Hype.
- Selo de perfil: exigir ou dispensar selo prévio; selecionar o selo da marca/celebridade e detalhar peças/looks participantes.
- Copilot de políticas: progresso, cancelamento/timeout e interpretação local de quantidade, cor e marca, inclusive “duas peças marrom” e “uma peça Adidas”.
- Geração de looks em janela Copilot com progresso e término garantido do loading.
- Equivalência entre as opções do Copilot e o formulário manual, com maior variedade de condições.

Esses itens **não estão implementados neste PR**.

## Carregamento e orientação

Foi acrescentado pré-carregamento limitado a 24 imagens, três requisições simultâneas, retenção temporária de cinco minutos e respeito à economia de dados. O navegador aproveita o cache HTTP existente. Não garante fotos instantâneas na primeira visita, nem baixa todo o acervo.

O guia do criador de peças agora tem cinco etapas segmentadas e ilustrações: foto, revisão, dados, arte e publicação. Expandir guias específicos para todas as abas/subabas continua pendente.

Também pendentes: segmentação e resgate dos selos Hype nos Insights, aplicação de selos em esquema e provas completas com perfis reais; novo selo automático condicionado à marca ou evidência da celebridade.
