# Bancada de tela do FLAIR 3D

Para ver uma partida inteira pela tela do jogo (`/flair/3d/[nucleo]`) com as regras de verdade, sem banco, sem rede e
sem conta real. É um teste JUnit desligado por padrão (`Flair3dBancadaDeTela`, em
`fai-application/src/test/java/br/com/fashionai/application/flair3d/bancada/`) que monta os services do FLAIR 3D com
os repositórios em memória do `Kit` e os serve por HTTP local. As cartas são um guarda-roupa fictício
(`Flair3dBancadaGuardaRoupa`): uma pessoa de exemplo, peças nas quatro vagas, sem dado real.

## Subir

```bash
mvn -o -pl fai-application -am -Dtest=Flair3dBancadaDeTela -Dflair3d.bancada.porta=8131 \
    -Dsurefire.failIfNoSpecifiedTests=false test
```

Fica de pé até o processo ser encerrado (ou `-Dflair3d.bancada.minutos`, padrão 120). Sem a propriedade da porta o
teste é pulado, então a suíte normal não o executa. Não usa variáveis de banco nem perfil de produção.

## Tela

1. `DEV_GATE_ENABLED=false npx next dev -p 3131`.
2. No Playwright (Chromium com WebGL por software: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader
   --ignore-gpu-blocklist`), o cookie `fai_rt_h=1`, `page.route('**/bff/auth/refresh')` com um token fictício e
   `page.route('**/api/**')` que responde `/api/me` com uma pessoa fictícia e repassa `/api/flair/3d/**` e
   `/api/me/flair/cards` para `http://127.0.0.1:8131`.
3. Abrir `http://localhost:3131/flair/3d/<CODIGO>` e jogar pela tela.

Contratos servidos: progresso, partida em andamento, efeitos, abrir partida, prévia, entrega, acionar, rascunho,
recursos e usar recurso. O resto de `/api/**` responde 404 (a tela segue sem ele).

## Limites

- Uma pessoa só e um guarda-roupa fixo; Hype das cartas é o do exemplo.
- Não substitui o teste de integração: serve para ver a tela com a regra do servidor, não para provar persistência.
