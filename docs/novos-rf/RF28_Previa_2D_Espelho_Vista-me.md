# RF28 · Prévia 2D no Espelho e no Vista-me (PROV-2D)

> 05/10/2026 · Código:
> - `components/three/avatar-still.tsx` (a foto parada);
> - `lib/avatar3d/still.ts` (chave, cache, critério de "pronto") e `lib/avatar3d/still.test.ts`;
> - `components/mirror/mirror-stage.tsx` (modos do espelho e `useMirrorAvatar`);
> - `app/(site)/(app)/mirror/page.tsx`, `app/(site)/(app)/room/page.tsx`, `components/room3d/room-scene.tsx`;
> - sinais de "pronto" em `components/three/human-avatar.tsx` e `components/three/human-outfit.tsx`.

## Por que mudou

A prévia 2D antiga do provador desenhava um **boneco genérico** (rosa, sem rosto) com as fotos das peças por cima.
O pedido foi: *"Prévia 2D deve exibir o mesmo manequim do avatar 3D só que na perspectiva estática 2D"*.

Depois o provador antigo virou o **Provador virtual de lojas** (RF18, busca no catálogo e loja da marca em 3D). A prévia
estática passou a ser a do **Espelho + Vista-me** (RF28). Este documento cobre essa prévia.

## O que é a Prévia 2D

É a **mesma cena** do Reflexo 3D, fotografada uma vez:

- o mesmo `HumanAvatar` com corpo medido, pele, rosto e cabelo do Avatar 3D;
- as mesmas peças, vestidas pelo mesmo `HumanOutfit` (com as peças padrão do FashionAI onde o look não cobre);
- de frente, parada na pose de repouso, com a luz do espelho;
- mostrada como imagem. O `Canvas` é desmontado depois da foto e o contexto WebGL é liberado.

Não existe mais um segundo personagem: se o avatar muda (ajuste fino, corte ou tom do cabelo), a prévia muda junto.
Sem Avatar 3D, aparece o manequim de referência, como no Reflexo 3D, com o convite para criar o seu.

## Onde aparece

| Tela | O que mostra |
|---|---|
| **Espelho** (`/mirror`) | Seletor **Reflexo 3D \| Prévia 2D** acima do vidro. `?vista=2d` abre direto na prévia. |
| **Meu Quarto 3D** (`/room`) | O vidro do espelho 3D reflete o avatar vestindo as peças do espelho (antes: fotos das peças penduradas). Sem avatar e sem peças, continua a capa do Look do Dia. |
| **Vista-me** no quarto | O diálogo mostra o look sugerido vestido no avatar, ao lado da sequência de portas e gavetas. |

## Quando a foto é tirada

A cena só é fotografada (`stillReady`) quando:

1. o corpo está **vestido** (as três zonas cobertas; nunca sem roupa);
2. as fotos das peças **do look atual** chegaram (`outfitReady`; as do look anterior não contam);
3. os olhos têm textura;
4. a pele já tem o rosto da foto, quando o avatar tem foto (`skin = "baked"`).

Depois espera 3 quadros seguidos prontos (a textura nova sobe para a GPU no quadro seguinte).

**Para não ficar presa:**

- corpo vestido, mas uma foto de peça fora do ar: fotografa após 20 s;
- corpo que nunca carregou: fotografa o manequim de reserva após 25 s.

**Enquadramento:** em telas estreitas (celular, vidro do espelho) a câmera recua até caber a largura do corpo com os
braços. Isso vale também para o Reflexo 3D (`fitWidth` em `avatar-viewer.tsx`).

## Privacidade

A foto tem o rosto da pessoa:

- fica **só em memória**, nas últimas 12 fotos (LRU);
- não vai para `localStorage`, servidor nem log;
- a chave é um hash curto que não carrega forma do rosto, cor de pele nem URL;
- no quarto, a textura do reflexo é descartada quando chega a próxima, sem o cache global de texturas.

## Critérios de aceitação

| CA | Critério | Como foi verificado |
|---|---|---|
| CA17 | A Prévia 2D mostra o **mesmo** avatar do Reflexo 3D (corpo, pele, rosto, cabelo) com as **mesmas** peças, de frente e parado | Laboratório `/lab/human` (botão "prévia 2D") com dois retratos de teste autorizados: cena viva e foto lado a lado. Os renders ficaram no ambiente de trabalho e não foram publicados. |
| CA18 | Depois da foto não sobra `Canvas` no vidro (a prévia é uma imagem) | E2E: `.mirror-glass canvas` = 0 com a Prévia 2D ativa |
| CA19 | Voltar à Prévia 2D com o mesmo look não renderiza de novo | E2E: nenhum `[data-still-key]` montado na segunda vez (foto do cache) |
| CA20 | Nunca fotografa o corpo sem roupa nem com as fotos do look anterior | `lib/avatar3d/still.test.ts` |
| CA21 | No Meu Quarto 3D, o vidro reflete o avatar com as peças do espelho, e o Vista-me mostra o look sugerido vestido | E2E com a API simulada e os dados reais de um quarto novo (backend local isolado) |
| CA22 | A foto não sai do aparelho nem fica salva no navegador | Revisão de código: só `StillCache` em memória, sem storage e sem upload |

## Testes

- `lib/avatar3d/still.test.ts` (7 testes):
  - chave estável e independente da ordem das peças;
  - a chave muda com peça, foto, luz, pele, ajuste e sexo;
  - a chave não contém dado em claro;
  - LRU;
  - critérios de "pronto" e limites de tempo.
- `npx tsc --noEmit`, `npm run i18n:check` e `npm run i18n:scan` limpos.

**Tempos no ambiente de teste** (renderização por software, sem GPU):

- primeira foto: 12–13 s sem rosto e 30–40 s com o rosto de uma foto (inclui montar o corpo);
- com o mesmo look: nenhuma nova renderização.

## O que não muda

- O Reflexo 3D continua o padrão do espelho, com a pose natural (MIRROR-1).
- O caimento das roupas é o do pipeline atual. A Prévia 2D herda as melhorias das fases F0–F6 da
  [auditoria de roupas](../avatar3d/auditoria-roupas-3d/README.md) sem mudar de API.
