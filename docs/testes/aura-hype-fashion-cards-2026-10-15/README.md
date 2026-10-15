# Fashion Cards, progressão e FLAIR Afterparty — 15/10/2026

Este incremento sucede o PR #291. Não representa a conclusão do checklist geral do FashionAI.

## Comportamento implementado

- AURA Hype usa quatro níveis: COMMON, RARE, LEGENDARY e COLLAB_DROP. O servidor determina a classificação; selecionar um preset visual não concede raridade.
- A versão 1 reaproveita os sinais existentes de HypeSeals: RARE + CLASSIC gera LEGENDARY; RARE ou TRENDING gera RARE; os demais elegíveis geram COMMON. É uma regra inicial explícita, não um cálculo de raridade física ou de valor comercial.
- COLLAB_DROP depende de uma concessão administrativa confirmada. Série/tiragem são imutáveis e o número só aparece com confirmação válida. A API administrativa é `/api/admin/aura-hype/drops`.
- O card tem cabeçalho com raridade e score global sem denominador, fotografia, nome, estilos e longevidade. Versatilidade desconhecida permanece sem valor. Há camadas de brilho e tilt, com giroscópio opcional após gesto/permissão e respeito à redução de movimento.
- O header do perfil apresenta nível e porcentagem até o próximo patamar, calculados por pontos acumulados, separados do saldo disponível para gastar.
- Auras básicas exigem Estreia; dinâmicas, Studio; Impersonation, Loft. `/api/me/aura-permissions` fornece a autorização. O toggle de Impersonation fica em Configurações → Aparência; seu botão Mais informações mostra nível atual, nível necessário e aviso de bloqueio. A preferência é persistida e a API rejeita ativação abaixo de Loft, permitindo desligar em qualquer nível.
- `/flair/aventura` oferece uma missão adicional: cenário 3D acima do deck, deslocamento por teclado/toque/clique, troca de look, energia, cooldown e suspeita. O servidor mantém a sessão e valida ações sob bloqueio da linha. O jogador comum usa a entrada de serviço/crachá; convidados distraem guardas; VIPs têm acesso temporário. Energia não debita FAI Points e a missão ainda não paga recompensas.

## Impersonation: estrutura disponível e limites

`lib/fashion-card/` contém tipos, regras contextuais, fingerprint SHA-256, cache de presets, repositório de cards pessoais com revisão e serviço de pipeline com porta de worker. O cache compartilhado contém apenas configuração visual; a identidade do usuário fica na projeção pessoal. A autorização ocorre antes da consulta do card e do processamento.

O worker fornecido é **mock**: retorna textura animada existente com status `MOCK_PREVIEW`. O componente mantém a fotografia e identifica a demonstração. Não produz um vídeo real do usuário. Os repositórios dessa estrutura são em memória; não há persistência SQL do vídeo pessoal nem integração desse componente no editor de fotos. O toggle persistido prepara a preferência, mas não conecta por si só um gerador de vídeo.

Continuam pendentes a integração do worker real, segmentação da pessoa, validação de que veste a peça, consentimento/retencão de mídia, fila durável, armazenamento do resultado e integração sequencial no editor. Nenhuma promessa de geração em 5–10 segundos é feita.

## Verificações

- 22 testes de interface/serviços TypeScript: configurações, permissões antes do worker, isolamento de proprietário, cache contextual, falha sem salvar mídia inválida, classificações e componentes Hype.
- Backend: testes de preferências, progressão, edições verificadas, níveis Hype, privacidade e motor Afterparty. A contagem final está no PR.
- TypeScript, Stylelint e verificação de traduções.
- As capturas deste diretório usam a interface real com **API simulada**, inclusive classificações, saldo/nível e ações da missão. Não comprovam contas ou compras reais, classificação em produção, aplicação de migrações nem transferência de movimento por IA.

As migrações V67–V69 adicionam edições verificadas, sessões de aventura e a preferência Impersonation. Sua aplicação em Railway/produção não foi executada nesta entrega.

## Evidências visuais

- [Comum](common.png), [Rara](rare.png), [Lendária](legendary.png), [Collab / Drop](collab_drop.png), [celular](collab-mobile.png).
- `browser-result.json`: score dentro do card, tiragem apenas em drop confirmado, redução de movimento e erros do navegador.
- Capturas adicionais de configurações e aventura, quando presentes, estão descritas em `additions-browser-result.json`.
