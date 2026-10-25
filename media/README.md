# media/ — mídia estática pesada, fora do deployment

Auras, materiais, peças padrão, fundos de chrome e demos do FLAIR (~1 GB, a maior parte em MP4) ficam aqui em vez de
`public/` para **não entrar em cada deployment da Vercel**: no plano Hobby o Deployment Storage é limitado a 10 GB e
cada deployment retido carregava a pasta inteira.

As URLs não mudam (`/aura/…`, `/assets_pecas/…`, `/bg_chrome/…`, `/flair/demos/…`). Quem decide de onde elas vêm é
`lib/media/static-media.ts`, usado pelo `next.config.ts` (rewrites):

| Ambiente | Origem |
|---|---|
| Vercel (deploy pelo Git) | CDN jsDelivr lendo este repositório público no commit exato do deploy: `https://cdn.jsdelivr.net/gh/<owner>/<repo>@<sha>/media/…` (imutável, com cache; sem credencial) |
| Qualquer ambiente com `STATIC_MEDIA_ORIGIN` | essa origem (bucket/CDN com a mesma árvore de `media/`) |
| dev, CI, `next start` local | rota `app/dev-media/[...path]/route.ts`, que serve esta pasta do disco |

Regras:

* Arquivo novo entra aqui com `git add`, como antes; só vale no CDN depois do push (o commit precisa existir no GitHub).
* Limite do jsDelivr por arquivo: 20 MB (o maior hoje tem 11 MB). Acima disso, usar `STATIC_MEDIA_ORIGIN`.
* O que precisa ser lido do disco pelo servidor Next (ex.: `public/_derived`, `outputFileTracingIncludes`) **fica em
  `public/`**. Ícones (`public/flair/icons`, `public/points`) e modelos (`public/mediapipe`, `public/models`) também.
* A API Java lê estas pastas pelo disco: o `Dockerfile.backend` copia `media/` por cima de `/app/public`; em dev local
  `fashionai.assets.media-dir` (padrão `media`) é o segundo diretório procurado.
* Os scripts geradores (`scripts/assets/*.py`, `scripts/design/*.py`, `scripts/flair-demos`) já apontam para cá.
