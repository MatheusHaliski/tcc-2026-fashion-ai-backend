# Separação por responsabilidade · 24/11/2026

| Área | Decisão | Contrato preservado |
| --- | --- | --- |
| Aquisição de fotos | **Decorator** funcional. `polite_fetch` recebe outro `Fetch` e devolve uma função com a mesma assinatura. A extração de `ghost_photo_source.py` separa essa composição do lote. | Intervalo por domínio, retentativas, pausa por host, resolução de imagem e estados de erro. |
| Renderização de fotos | **Strategy** existente. A classe de Stable Diffusion ficou em arquivo próprio, com parâmetros padrão e funções de runtime separados. O lote continua recebendo o renderizador por injeção. | Seleção de dispositivo, ControlNet, carregamento sob demanda e execução pelos dublês de teste. |
| Cadastro e edição | **NENHUM.** O record `PieceForm` tem arquivo e construtor canônico próprios. O serviço chama a regra de taxonomia existente diretamente. | Campos JSON, normalização e conversão das subcategorias antigas. |
| Rankings | **NENHUM.** O componente, o contrato de dados e a função de formatação têm arquivos próprios. | Textos, condições de renderização e ação de participação. |

A análise estática percorreu o código rastreado e os arquivos de código novos. Incluiu Java, TypeScript, JavaScript, Python e outros tipos reconhecidos pelo inventário do projeto. O ranking usa proxies de complexidade, dependências e duplicação. A revisão de segurança, contratos e referências indiretas requer inspeção por domínio. Mantivemos as views de ranking e de peça porque têm consumidores identificados.

Os primeiros candidatos restantes do inventário são Copilot, Challenge, Scheme, FlairChallenge e Lens. Cada extração nesses serviços deve partir de uma responsabilidade identificável e de testes que cubram o comportamento antes da mudança. Os arquivos legados congelados permanecem visíveis no controle de tamanho.
