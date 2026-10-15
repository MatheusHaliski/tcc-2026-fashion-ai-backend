# AURA — divisão funcional acordada

- **Comum, Electro e Splash:** composições MP4 em loop na área artística do card.
- **Hype:** tratamento tecnológico da fotografia da peça e seu score global, sem /100 e sem tabela de atributos FLAIR. Há 40 presets visuais (oito tratamentos × cinco direções de moda); não são 40 medições físicas do tecido.
- **Metamorfose:** bordas dinâmicas e artes exclusivas associadas a objetivos, selos, cupons, FLAIR, loja e FAI Points.

## Vídeos

O script `scripts/design/build_aura_video_variations.py` gerou 120 MP4s distintos: 40 por família. Somados aos 12 iniciais, o manifesto local contém 48 comuns, 42 Electro e 42 Splash, todos com MP4. O relatório contém hashes de cada novo vídeo. Resolução: 432×648; H264/yuv420p; seis segundos; 24 fps; sem áudio; início rápido.

São variações de composição, cor, motivos procedurais e movimento periódico sobre texturas originais criadas para o projeto. Não são 120 cenas geradas individualmente por IA nem vídeos de terceiros. Miniaturas continuam WebP. A reprodução deve pausar fora da tela e respeitar movimento reduzido.

## Metamorfose inicial — 20 propostas

`metamorfose-initial-20.json` contém 20 designs: Prisma, Constelação, Fio Vivo e Holografia, em cinco paletas. São **rascunhos**, não recompensas já concedidas.

O Background Studio também oferece três direções visuais sugeridas por marca e cor da peça: Nike/laranja (Prisma âmbar), Adidas/azul (Fio Vivo azul) e ASICS/branca (Holografia perolada com acento azul-gelo). Elas não verificam marca/cor, não usam logotipos, não alteram a fotografia nem concedem direitos. A execução do script em 15/10/2026 retornou `URLError` nas três buscas e verificações (zero candidatos encontrados); as paletas são, portanto, propostas iniciais e não referências externas validadas. Os resultados e fontes tentadas ficam em `aura-metamorfose-marcas-research/`.

Marcas e celebridades poderão comprar uma licença de preset com FAI Points; ela deverá aparecer em Minhas Artes como licença do emissor. A licença permite configurar uma recompensa na promoção de selo/cupom, sem liberar a arte globalmente.

O participante deverá receber um direito vinculado ao card elegível após cumprir a política. Remover a arte não apaga o direito. Reaplicar exige o mesmo card elegível. Recompensas condicionadas ao nível Hype devem ser retiradas de Minhas Artes e desaplicadas quando o nível cair; manter histórico não conserva a elegibilidade.

**Pendentes:** loja/cadastro administrativo com esses direitos, compra debitada no ledger, concessão por selo/cupom/FLAIR, revogação por queda de Hype e integração completa de Minhas Artes. Os quatro modos básicos do Studio são personalização, não comprovam resgate de exclusividades.

## Enquadramento obrigatório

Novas imagens já entram no worker do backend. A fila passa a incluir imagens antigas sem versão de pipeline, preservando revisão manual e fotos finais do lote. A seleção é travada para evitar dois workers processarem a mesma linha.

A resposta pública não oferece foto crua se não houver enquadramento aprovado. A falha deve aparecer como mensagem com nova tentativa; uma fonte inacessível ou imagem inválida não pode ser declarada enquadrada. Falhas não viram sucesso artificial.
