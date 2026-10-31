# Modelos 3D gerados no Meshy para o cenário

O usuário autorizou (31/10/2026) usar os créditos da conta dele no Meshy, pela API, para acelerar o cenário. A ideia:
**a arquitetura continua procedural** (pisos, paredes, tetos, portas, lustres e tudo o que repete ou precisa casar com a
planta e a colisão) e **os móveis ornamentados, vistos de perto, vêm de modelos gerados** (text-to-3D com textura PBR):
cadeiras, poltronas, mesas postas, bolos, vasos, bancos, cabine do DJ, cozinha, carrinhos, lixo do beco. É onde o desenho
procedural gasta mais tempo e ainda sai "simples".

## Como funciona

| Etapa | Onde | O quê |
| --- | --- | --- |
| Briefs | `scripts/heist/meshy/briefs.json` | Um registro por móvel próprio da planta (`model` de um `fixture` em `lib/heist/level.ts`): prompt, prompt de textura, altura real ou encaixe na pegada, polycount, nível de prioridade |
| Geração | `scripts/heist/meshy/run.mjs` | Pede a geometria (`preview`), depois a textura PBR (`refine`), espera, baixa o GLB para `scripts/heist/meshy/raw/` (fora do git) |
| Compressão | `gltf-transform optimize` (via `npx`) | meshopt + texturas WebP de 1024 px → `public/heist/models/<model>.glb` (meta: 0,5–3 MB por modelo) |
| Manifesto | `lib/heist/models.ts` (gerado) | `MODELS[model] = { file, height, fit, yaw?, lift? }` |
| Cena | `components/heist/scene/models.tsx` | `HeistModels` carrega cada GLB uma vez, clona por ocorrência, encaixa na pegada do móvel (altura real ou largura × profundidade), põe a base no chão com o giro da planta e entrega ao grupo da sala; `buildProp` pula o desenho procedural de quem tem modelo |
| Proteção | `components/heist/scene/models.test.ts` | Manifesto só com móveis da planta e arquivos existentes; o encaixe (altura, chão, centro, giro) testado sem GPU |

A colisão não muda: é a da planta (`baseProps()`), não a do modelo. Se um modelo sair maior que a pegada, o encaixe
por pegada o reduz; se a frente sair virada, `yaw` no brief corrige.

## Para rodar (precisa da chave)

1. Cadastre a chave da API do Meshy como `MESHY_API_KEY` nas configurações do ambiente da sessão na nuvem (menu do
   ambiente na barra de título → Editar → Network secrets, ou como variável de ambiente). **Nunca cole a chave no
   chat.** Uma sessão nova passa a enxergá-la.
2. `node scripts/heist/meshy/run.mjs --tier 1 --dry-run` mostra o que seria gerado e a estimativa de créditos.
3. `node scripts/heist/meshy/run.mjs --tier 1` gera o nível 1; depois `--tier 2` e `--tier 3`. É retomável: o andamento
   fica em `scripts/heist/meshy/state.json`.
4. Olhe cada modelo nos laboratórios (`/lab/heist-salas`, `/lab/heist-rua`), ajuste `yaw`/`lift`/`fit` no brief se
   preciso e rode `--manifest` para regenerar o manifesto.
5. Teste: `node_modules/.bin/vitest run components/heist/scene/models.test.ts`.

## Custo (tabela da API em 2026-10)

| Tarefa | Créditos |
| --- | --- |
| Geometria (`preview`) com `latest` (Meshy 7.1) / `meshy-6` | 20 |
| Geometria com `meshy-6-lite` | 5 |
| Textura (`refine`, 2k/4k) | 10 |
| Remesh (se precisar reduzir polígonos de novo) | 5 |

Estimativa dos briefs atuais (66 móveis): **nível 1** (22 móveis, `latest`) ≈ 660; **nível 2** (24, `latest`) ≈ 720;
**nível 3** (20, quase todos `meshy-6-lite`) ≈ 330. Total ≈ **1 710 créditos**, mais o que repetir (tarefa que falha é
reembolsada; peça refeita por qualidade, não). `--dry-run` recalcula com o que ainda falta.

## Licença e conteúdo

- Nos planos pagos do Meshy os modelos gerados pertencem ao cliente (uso comercial liberado); no plano gratuito a
  licença é CC BY 4.0 (exige crédito ao Meshy). Confirmar o plano da conta antes de publicar o jogo.
- Prompts sem marca, logotipo ou pessoa real; o evento e o museu são ficcionais.
- Modelos gerados não entram em `public/lab-audit` nem no catálogo: ficam em `public/heist/models/` e são parte do jogo.

## O que fica procedural mesmo com o Meshy

Pisos, paredes, tetos e cúpulas, portas (precisam abrir e casar com os vãos), escadarias (colisão), lustres e
castiçais (as chamas e as âncoras de luz são deles), vitrines com vidro da simulação (lasers, furto), cordões e totens,
o ponto de ônibus (montado em partes), a treliça e os globos da pista (animam), painéis e telas (texturas animadas).

## Estado

| Item | Estado |
| --- | --- |
| Pipeline, manifesto, carregador, teste | IMPLEMENTADO (sem GLB ainda: a chave não está neste ambiente) |
| Briefs nível 1 / 2 / 3 | PLANEJADO (66 móveis) |
| Carregador ligado ao interior | IMPLEMENTADO (`interior.tsx`) |
| Carregador ligado à rua e ao beco | PLANEJADO (entra quando o agente da rua terminar `exterior.tsx`) |
| Barra de carregamento contando os modelos | PLANEJADO |
