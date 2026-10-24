# Hype e ajuste estimado das roupas — 20/10/2026

## Seletor Hype

- Tokens do mesmo `FaiIcon` da navegação: Bronze ACT-26, Prata ACT-39, Ouro ACT-37, Especial SOC-06 (estrelas). Cadeado ACT-04.
- Nomes disponíveis por `aria-label` e tooltip. O nível necessário continua escrito e legível em branco no fundo escuro, inclusive quando desabilitado.
- Resposta de `/api/me/aura-permissions`: Estreia bloqueia Prata/Ouro/Especial; Studio bloqueia Ouro/Especial; Loft libera os quatro. Carregamento e falha nunca liberam acabamentos avançados. Há nova consulta ao reabrir e atualização periódica enquanto aberto.
- Chromium, 1440px e 390px, três níveis simulados: seis cenários, sem erro JavaScript, imagens de tokens carregadas, sem overflow na seleção. JSON e duas capturas nesta pasta. Sessão/API simuladas; não é consulta à conta de produção do usuário.
- Rota temporária de verificação removida antes da publicação.

## Correções do provador

O catálogo já armazena `variationCode` e `catalog_product_attributes`, mas a projeção pública não os enviava. Agora `CatalogService.card` expõe `variation` e `attributes`, e os adaptadores Catálogo → FittingItem → Look3dPiece os preservam, junto com o material. O guarda-roupa também conserva o material.

O molde lê RISE para ajustar a altura do cós. Variação declarada tem prioridade sobre palavras explícitas de modelagem do título. A marca sozinha não determina caimento. Camisas com fecho informado sem botões deixam de receber botões genéricos; mangas e comprimentos continuam usando as dimensões existentes. Macacões também respeitam o decote declarado.

O material declarado ajusta estimativas de roughness/sheen, preservando mapa e cor da foto. Não são propriedades físicas medidas do tecido. Após relaxamento/coluna/dobras, uma restrição final mantém a folga sobre a pele de origem e as camadas inferiores, sem deformar o corpo do avatar. Essa restrição usa normais e vértices de origem em repouso: não é um detector completo de colisão entre triângulos durante movimento.

### Limites que continuam pendentes

Não há malhas aprovadas por produto em `APPROVED_WEARABLES`. O renderizador continua usando molde estimado e projeção da fotografia frontal. Posição exata de bolsos, número de botões, costuras, costas, UV e medidas individuais não são recuperáveis apenas com a marca ou uma fotografia frontal. Não foram inventados assets ou calibragens por marca, nem alterados registros do catálogo de produção.

O laboratório `/lab/human` carregou o outfit casual em desktop/mobile sem erro JavaScript. A inspeção visual ainda mostra roupa estimada, com limites de textura/recorte e acabamento; não demonstra encaixe perfeito nem fidelidade por marca. Os testes numéricos usam a malha real MakeHuman em dois corpos de referência, mas não certificam todas as poses, medidas e peças do catálogo.
