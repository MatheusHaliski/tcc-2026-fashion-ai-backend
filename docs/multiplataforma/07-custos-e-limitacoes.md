# 07 — Custos estimados e limitações

> **Estimativas**, não orçamentos. Valores em dólar porque as lojas e provedores cobram em dólar; confirmar cada um na
> data da contratação. Marcados **[verificar]** os que mudam com frequência ou dependem de contrato.

## 1. Custos fixos de distribuição

| Item | Valor | Observação |
|---|---|---|
| Apple Developer Program | US$ 99/ano | cobre iOS, iPadOS e macOS |
| Google Play Console | US$ 25 (uma vez) | — |
| Microsoft Store (Partner Center) | conta de empresa com taxa única [verificar valor atual] | apps não-jogo com comércio próprio sem repasse [verificar] |
| Steam Direct | US$ 100 por app (recuperável após vendas mínimas) | só se entrar no lançamento |
| Epic Games Store | taxa de envio por produto [verificar] | só se entrar no lançamento |
| PlayStation / Xbox | devkits, contratos e certificação sob NDA | orçamento só após aprovação dos programas |
| Certificado Authenticode (se EXE/MSI ou Steam/Epic) | ~US$ 200–600/ano [verificar] | MSIX pela Store dispensa |
| Unreal Engine | grátis até US$ 1 mi de receita bruta; depois depende do enquadramento (royalty de 5% ou acordo) | confirmar com a Epic (ver `05` §4) |
| Máquinas de build | 1 Mac (Apple Silicon) + 1 PC Windows com GPU | builds Apple exigem macOS |
| Aparelhos de teste | 2 celulares Android (entrada/avançado), 2 iPhones (11 e 15 Pro+), 1 iPad, PCs com GPU média/alta, PS5, Xbox Series S e X | Series S é o piso de console |

## 2. Custos variáveis de assets 3D

| Item | Estimativa | Base |
|---|---|---|
| Geração Meshy por peça | US$ 0,40 | configuração atual do `Model3dService`; ainda exige retopologia e rig humanos |
| Retopologia + rig + LODs de peça gerada | 1–3 h de artista por peça | estimativa de mercado [verificar] |
| Peça modelada por artista (catálogo de marca) | 4–12 h por peça | depende de detalhes, estampa e logo |
| Peça por molde paramétrico | custo de engenharia inicial; ~0 por peça depois | só para básicos |
| Armazenamento por peça | ~5 arquivos × 1–12 MB ≈ 20–40 MB | perfis `MOBILE_LOW` → `DESKTOP_HIGH` |
| Entrega (CDN) | ~US$ 0,02–0,09 por GB [verificar provedor] | 1.000 pessoas provando 20 peças no celular (3 MB) ≈ 60 GB |
| Processamento de métricas | minutos de GPU por peça | commandlet de importação |

## 3. Limitações conhecidas (honestas)

1. **Nenhum build instalável foi produzido nesta sessão.** O ambiente é Linux, sem Unreal, Xcode, SDK Android nem
   aparelhos. O esqueleto Unreal não foi compilado.
2. **Nenhuma medição real** de FPS, memória, temperatura, bateria, inicialização ou download existe ainda; os números de
   `04` são metas.
3. **Não há captura nem gravação** de aparelho real.
4. **Não há nenhum asset 3D de roupa que vista de verdade.** Até existir, todo item aparece como prévia 2D nos apps.
5. **Barba e bigode não são parâmetros** no modelo atual; o groom da Unreal depende da confirmação da pessoa.
6. **Acessibilidade da Unreal por plataforma** não foi medida; a decisão de telas nativas para conta/consentimento é
   preventiva.
7. **Bloqueios B1–B5** (exclusão de conta, mídia pública, Origin, portão, textura pública) precisam ser resolvidos antes
   de qualquer submissão.
8. **Consoles** dependem de aprovação da Sony e da Microsoft e de acesso concedido pela Epic; não há data possível
   antes disso.
9. **Regras comerciais** foram pesquisadas, mas nada foi implementado; precisam de verificação no dia da implementação.
10. O provador do **web** ainda grava no `localStorage` e não usa a sessão sincronizada (marco 4).
11. Criação do registro de sessão do provador por duas plataformas **ao mesmo tempo, na primeira vez** cai na
    restrição única do banco e devolve conflito (409) em vez de 412; o cliente trata os dois da mesma forma (reler e
    reaplicar).
