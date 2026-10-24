# Fotografias, denim e provador fixo — 22/10/2026

## Alterações

* Pipeline assíncrono de dataset e worker de conjunto fotográfico, documentados em [services/catalog_photos](../../../services/catalog_photos/README.md). Total frame e Tecido são armazenados e invalidados pelo contexto/origem. Não utiliza foto de calçado como alternativa de uma calça.
* A API oferece `texture-image?isolated=true`: só entrega a fotografia isolada atual, autorizada e persistida. Recusa fonte bruta, contexto antigo e ilustração padrão. O avatar tenta esse transporte antes do recorte local, evitando descartar detalhes já isolados pelo servidor quando o segmentador do navegador falha.
* Denim recebe relevo fino de sarja aproximada, antialias e dependente de iluminação, sem alterar o albedo da fotografia. A subcategoria jeans/shorts jeans com material ausente, algodão ou denim ativa a trama; outros materiais não a recebem por engano. Bolsos, lavagem, logos e costuras particulares continuam sendo informação da foto, não decoração inventada.
* Casacos são segmentados como superiores, não corpo inteiro. Amostras maiores permitem reconhecer xadrez largo sem reduzi-lo a degradês, mantendo logos únicos fora da repetição.
* Ilustrações FAI por cor, categoria e subcategoria, com PNGs próprios para Tecido/Total frame. Tecido ocupa o quadro; a ilustração é identificada separadamente de fotografia real. Falhas do catálogo recebem essa alternativa e botão de nova tentativa.
* Removidos efeitos de hover dos componentes compartilhados de cards, inclinação por ponteiro e destaque de raízes de cards em busca/exploração. Cliques, foco e animações de Aura permanecem independentes.
* Provador sem espelho, caminhada, joystick de movimento ou prévia/modal de espelho. Avatar fixo; somente quatro comandos de câmera: esquerda, direita, aproximar, afastar. Meu Quarto permanece independente.

## Evidência e limites

O build Next de produção, TypeScript e as verificações de estilos/i18n passaram. A suíte Python de catálogo executou 233 testes (13 ignorados); os testes novos usam máscaras sintéticas, sem certificar a segmentação de fotos reais. Java: 34 testes do serviço/renderização passaram e `fai-web` compilou. Frontend: 106 testes de fotografia, enquadramento e malha passaram; a correção adicional do tamanho do PNG passou em três testes. Provador fixo: 26 testes passaram.

Os JSONs registram o escopo dos testes de navegador. Criação de peça foi verificada em 1440 e 390 pixels, com PNGs reais da rota Sharp, autenticação/taxonomia simuladas, alternância Tecido/Total frame e card estável sob hover. O provador foi verificado em desktop/mobile com API simulada, quatro botões acessíveis, ausência de espelho e avatar imóvel sob WASD. O WebGL compilou o shader denim e manteve a foto do jeans FAI com tint branco (sem recoloração indevida). Seis superiores foram testados com fotografias sintéticas assimétricas; isso não equivale a testar todas as marcas.

**Pendências reais:** provisionar pesos e implantar o worker no ambiente com MySQL/storage; executar avaliação de segmentação com imagens autorizadas; verificar os jeans reais mostrados pelo usuário e sua qualidade de bolsos/costuras. Nenhuma exclusão lógica foi aplicada no banco de produção. Não foi adicionada reconstrução generativa de áreas ocultas, molde industrial por SKU ou geometria exata dos bolsos de cada marca. O método FASHN de reconstrução model-to-product não é equivalente ao recorte implementado. Não há garantia de encaixe anatômico ou identidade visual de 100%.
