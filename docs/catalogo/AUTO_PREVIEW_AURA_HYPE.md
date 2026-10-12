## Catálogo e AURA Hype

O item 9 (deploy e catálogo paginado) foi confirmado como resolvido pelo usuário. Este PR não executa reparos no MySQL de produção.

Ao entrar na tela, os cards visíveis solicitam `POST /api/catalog/products/{id}/preview-image`. São duas análises simultâneas por instância do backend, com cache de metadados de enquadramento e deduplicação das solicitações. Nenhum script Python é necessário. A regra é o quadro 3:4 preenchido: gola para superiores, zíper para inferiores, centro para acessórios e logo para calçados. O serviço reutiliza o FabricFrame existente, sem substituir arquivos originais nem copiar fotos externas. Se a análise não conseguir um recorte seguro, o card informa a indisponibilidade em vez de exibir uma pessoa como fotografia padronizada. A confirmação “É esta” mantém a verificação explícita.

AURA Hype é ativado em Configurações do perfil e no Background Studio, com scanner, raio-x visual, pontos tech, estrelas e micro métricas. O score global vem do resumo Hype do backend e fica numa caixa LED no canto superior direito. Sem cálculo, informa indisponibilidade: não usa compatibilidade pessoal, nem inventa zero ou medições do tecido. Efeitos são CSS/SVG em tempo real, sem um GIF pesado por peça, e respeitam reduzir movimento. A preferência global é persistida pelo backend; a escolha por card é guardada no Background Studio.

