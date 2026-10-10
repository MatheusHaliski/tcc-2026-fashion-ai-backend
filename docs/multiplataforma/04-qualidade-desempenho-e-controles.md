# 04 — Perfis de qualidade, medições e controles por plataforma

> Estado: **especificação**. Nenhum número abaixo é medição — são **metas** a confirmar em aparelho real no marco 7.
> O relatório de medição terá o formato de `docs/multiplataforma/medicoes/TEMPLATE.json` e só aceita valores medidos.

## 1. Perfis de qualidade

O perfil é escolhido pelo cliente na inicialização (benchmark curto + lista de aparelhos conhecidos) e confirmado pelo
backend em `GET /api/client/config` (campo `qualityProfile`). A pessoa pode baixar o perfil manualmente; nunca subir
acima do recomendado em celular sem aviso de bateria/temperatura.

| Perfil | Aparelhos de referência (a fechar com a lista real de teste) | Meta FPS no provador | Memória máx. do app | Avatar | Cabelo/barba | Pele | Roupa |
|---|---|---|---|---|---|---|---|
| `MOBILE_LOW` | Android de entrada (~4 GB RAM, GPU Mali-G57/Adreno 6xx); iPhone 11 | 30 | 1,2 GB | LOD2 (~15 k tri), morph targets de identidade completos | Cards de cabelo (strip mesh) com textura de fio e alpha-to-coverage; barba por textura + cards curtos | Mobile shading com mapa de cavidade e SSS pré-integrado | LOD2, simulação de pano desligada, pose com skinning + correções |
| `MOBILE_HIGH` | iPhone 15 Pro+, Pixel 9, Galaxy S24+ | 60 (30 com bateria < 20 %) | 2 GB | LOD1 (~40 k tri) | Cards densos + sombra própria | SSS mobile | LOD1, Chaos Cloth com poucas iterações em peças soltas |
| `DESKTOP_MID` | GTX 1660 / RX 6600 / Apple M1 | 60 | 4 GB | LOD0 (~80 k tri) | Groom (Strands) com LOD para cards | Substrate/Subsurface Profile | LOD0 + Chaos Cloth |
| `DESKTOP_HIGH` | RTX 3070+ / RX 7800+ / M3 Pro+ | 60 (ou refresh do monitor) | 6 GB | LOD0 + rugas | Groom Strands completo | Subsurface Profile + Lumen | LOD0 + cloth completo |
| `CONSOLE` | PS5, Xbox Series X; **Series S** como piso | 60 em modo desempenho / 30 em modo qualidade | orçamento da plataforma | LOD0 | Groom com LOD por distância de câmera | Subsurface Profile | LOD0 + cloth |

**Regra de identidade (obrigatória em todos os perfis):** o que muda entre perfis é geometria e custo de shading,
**nunca** os parâmetros de identidade (`AvatarIdentityManifest`, ver `02`). O teste de aceitação compara renders
de frente/perfil de cada perfil com o render de referência:

- distância de identidade facial (mesmo embedding usado no gate do AVATAR-ID: SFace) entre perfis ≤ limiar do gate;
- erro de cor da pele (ΔE2000 na bochecha/testa) ≤ 2,0 entre perfis;
- silhueta do cabelo e da barba (IoU da máscara) ≥ 0,85 entre perfis;
- cor média do cabelo ΔE ≤ 3,0.

Falhar em qualquer um bloqueia o perfil, não a identidade.

## 2. O que medir (por aparelho e por perfil)

| Métrica | Como | Meta inicial |
|---|---|---|
| FPS médio e p1 (1 % mais lento) | `stat unit` / Unreal Insights, cena fixa "provador com 4 slots" por 60 s | ver tabela acima; p1 ≥ 70 % da meta |
| Tempo de quadro CPU/GPU | Unreal Insights | — (diagnóstico) |
| Memória pico | `memreport`, Xcode Instruments, Android Studio Profiler, PIX | ver tabela acima |
| Inicialização a frio até primeira tela interativa | cronômetro instrumentado no app (`AppStart → FirstInteractive`) | ≤ 4 s celular avançado, ≤ 6 s entrada |
| Tempo para abrir o provador (toque → avatar vestido visível) | instrumentado (`TryOnRequested → AvatarDressedVisible`) | ≤ 2,5 s com assets em cache; ≤ 8 s baixando |
| Temperatura (celular) | estado térmico do SO (iOS `ProcessInfo.thermalState`, Android `PowerManager.getCurrentThermalStatus`) após 10 min de provador | sem passar de "serious"/`THERMAL_STATUS_SEVERE` |
| Bateria (celular) | % consumida em 10 min de provador com brilho fixo 50 % | ≤ 4 % celular avançado, ≤ 6 % entrada |
| Tamanho do download | tamanho do pacote na loja + download inicial de conteúdo | iOS/Android ≤ 200 MB no pacote; resto sob demanda |
| Download por peça 3D | soma dos arquivos do LOD do perfil | ≤ 3 MB celular, ≤ 12 MB desktop |

## 3. Controles — matriz de navegação

| Ação | Toque | Mouse/teclado | Controle (PS/Xbox) |
|---|---|---|---|
| Mover foco | — | Tab/Shift+Tab, setas | D-pad / analógico esquerdo, foco **sempre visível** (contorno 4 px + escala) |
| Confirmar | toque | clique / Enter / Espaço | Cruz (PS) / A (Xbox) — respeitar troca de botão regional quando o SO pedir |
| Voltar | gesto/botão voltar | Esc / botão voltar do mouse | Círculo / B — sempre volta um nível, nunca sai do app sem confirmação |
| Girar avatar | arrastar 1 dedo | arrastar com botão esquerdo / A,D | analógico direito horizontal |
| Zoom | pinça | roda do mouse / +,− | gatilhos L2/R2 (LT/RT) |
| Trocar slot (cima/baixo/calçado/acessório) | abas na base | 1–4 / clique na aba | L1/R1 (LB/RB) |
| Escolher peça | toque no card | clique / Enter | D-pad na grade + Cruz/A |
| Remover peça do slot | botão "tirar" | Delete | Quadrado / X |
| Busca | campo + teclado do SO | Ctrl+F | Triângulo / Y abre busca por filtros (categoria, cor, marca) sem digitar; teclado virtual só opcional |

Critérios de aceitação no console (marco 5): completar **entrar → escolher peça → provador → vestir 4 slots → girar/zoom → voltar**
sem teclado e sem mouse, com foco visível em 100 % das telas, texto mínimo 28 px a 1080p (leitura a ~3 m), áreas
seguras de TV (margem de 5 %).

Critérios no computador: janela redimensionável de 1024×640 até 4K; escalas de interface 100 %, 125 %, 150 %, 200 %
sem corte de texto; layout muda de 1 para 2 colunas (grade + provador lado a lado) a partir de 1280 px de largura.

## 4. Fluxos que o console não faz

Foto de corpo/rosto, recorte de foto de peça, edição longa de texto e formulários de cadastro/pagamento web **não são
feitos no console**. O console mostra um **código de continuação** (QR + código de 8 caracteres, validade 10 min, uso
único) que abre o fluxo no celular ou computador já logado na mesma conta. Ao terminar lá, o console recebe o
resultado pela sincronização normal (ver `03`, seção "Continuação em outro aparelho").
