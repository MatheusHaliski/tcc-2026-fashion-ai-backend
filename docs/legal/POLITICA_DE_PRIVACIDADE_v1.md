# Política de Privacidade do FashionAI

**Versão 1.0 — vigente a partir de [DATA]**

> Nota técnica (remover na publicação): o aceite desta Política é registrado junto com o dos Termos de Uso, em `users.terms_version`. A constante atual é `IdentityService.TERMS_VERSION = "2026-09"`. Ao publicar, sugerimos trocar para `"2026-10"`.

Esta Política explica quais dados pessoais o FashionAI coleta, para quê, com quem compartilha e como você controla tudo isso. Ela segue a **Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018)**, o **Marco Civil da Internet (Lei 12.965/2014)** e o **ECA Digital (Lei 15.211/2025)**.

O controlador dos seus dados é **[RAZÃO SOCIAL]**, CNPJ **[CNPJ]**, com sede em **[ENDEREÇO]**. Nosso encarregado (DPO) é **[ENCARREGADO/DPO]**, que você encontra pelo **[E-MAIL DE CONTATO]**.

---

## Resumo em 1 minuto

- **Coletamos o necessário para o app funcionar:** cadastro, peças e looks, fotos que você envia e como você usa o app.
- **Cada uso extra de dados depende de um interruptor seu.** IA de terceiros, histórico para recomendações, anúncios personalizados, parceiros, medidas do corpo, localização e treino de IA ficam **desligados até você ligar**, e você pode desligar quando quiser em Configurações.
- **Não usamos reconhecimento facial.** As fotos do avatar 3D são processadas no seu navegador. O modelo do rosto só é salvo se você autorizar, fica privado e pode ser apagado.
- **Não vendemos seus dados.** Parceiros só recebem dados agregados, sem identificar você, e só se você permitir.
- **Fotos são limpas.** Ao receber uma imagem, removemos metadados como EXIF e localização GPS.
- **Dados sensíveis são cifrados.** Data de nascimento e telefone são guardados criptografados (AES-GCM). Você pode ativar a verificação em duas etapas.
- **Usamos fornecedores no Brasil e no exterior** (hospedagem, e-mail, IA), com contratos e salvaguardas.
- **Adolescentes têm proteção extra:** sem anúncios por perfil, sem compartilhamento com parceiros e configurações mais restritas por padrão.
- **Você pode baixar seus dados** em JSON e **excluir a conta**. A exclusão tem 30 dias de carência e depois os dados são apagados.
- **Por lei, guardamos registros de acesso por 6 meses**, mesmo depois da exclusão.

---

## 1. Quais dados coletamos

**1.1. Dados que você informa**

- **Cadastro:** nome, nome de usuário, e-mail, senha (guardada só como hash Argon2id), data de nascimento, telefone (opcional) e tipo de perfil.
- **Perfil Marca:** razão social, CNPJ, logo e documentos para verificação.
- **Perfil Celebridade:** nome artístico, documento de identificação e foto oficial para verificação.
- **Conteúdo:** fotos de peças e de você, looks, esquemas, comentários, reações e textos que você escreve para a IA.
- **Preferências de estilo:** respostas sobre gosto, ocasiões, cores e o que alimenta seu Estilo DNA.
- **Medidas do corpo** (opcional, só com consentimento): usadas no provador e nas recomendações de caimento.

**1.2. Dados gerados pelo uso**

- peças, looks e quantas vezes você usou cada um; histórico de recomendações e as correções que você faz;
- partidas do FLAIR, desafios, rankings, FAI Points e itens do Meu Quarto;
- seguidores, curtidas, bloqueios e notificações;
- **registros de acesso:** endereço IP, porta, data e hora, exigidos pelo Marco Civil;
- dados técnicos do aparelho e do navegador, para segurança e correção de falhas.

**1.3. Dados do Meu Avatar 3D**

As fotos do rosto são analisadas **no seu navegador** e não são enviadas ao servidor para essa etapa. Se você der o **consentimento expresso**, salvamos o **modelo 3D e a textura do rosto**. Tratamos esses dados como de **natureza biométrica**, ou seja, sensíveis. A textura fica em armazenamento privado e você pode apagar o avatar a qualquer momento. O FashionAI **não** usa esses dados para identificar você nem para reconhecimento facial.

**1.4. Localização**

Só com o consentimento **"Histórico de localização"** usamos sua localização **aproximada** (cidade ou região), para sugerir looks de acordo com o clima. Não usamos GPS preciso.

## 2. Para que usamos e com qual base legal

| Finalidade | Exemplos | Base legal (LGPD) |
|---|---|---|
| Criar e manter sua conta e oferecer os recursos | cadastro, guarda-roupa, looks, jogos, quarto 3D, FAI Points | execução de contrato (art. 7º, V) |
| Verificar marcas e celebridades | análise de CNPJ e documentos, concessão de selos | execução de contrato e legítimo interesse (art. 7º, V e IX) |
| Segurança e prevenção de fraude | login, 2FA, limites de uso, detecção de contas múltiplas e "farm" de pontos | legítimo interesse (art. 7º, IX) e prevenção à fraude (art. 11, II, "g") |
| Moderação | filtro de comentários ofensivos, verificação de nudez em fotos | legítimo interesse e cumprimento de obrigação legal (art. 7º, II e IX) |
| Cumprir a lei | guardar registros de acesso, atender autoridades | obrigação legal (art. 7º, II) |
| Comunicações do serviço | códigos de verificação, redefinição de senha, avisos da conta | execução de contrato |
| Recursos opcionais | ver a seção 3 | consentimento (art. 7º, I, e art. 11, I) |

O legítimo interesse nunca é usado para tratar dados sensíveis, nem quando se sobrepõe aos seus direitos.

## 3. Seus consentimentos

Cada finalidade abaixo tem um **interruptor próprio** em **Configurações → Privacidade**. Todos começam **desligados**, não existe botão "aceitar tudo", e você pode revogar quando quiser, sem perder o acesso às funções básicas. A revogação vale dali em diante e não desfaz o que já foi feito de forma legítima antes dela.

| Interruptor | O que permite |
|---|---|
| **Recomendações por IA** (`AI_RECOMMENDATION`) | usar IA para sugerir looks, analisar combinações e interpretar seus pedidos em texto |
| **Processamento de fotos por IA externa** (`AI_EXTERNAL_PHOTO_PROCESSING`) | enviar suas fotos a provedores de IA de terceiros, para remover fundo, reconhecer a peça, gerar a cópia da peça ou modelo 3D |
| **Histórico para recomendações** (`HISTORY_FOR_RECOMMENDATION`) | usar seu histórico de uso para personalizar sugestões |
| **Anúncios personalizados** (`PERSONALIZED_ADS`) | mostrar ofertas com base nos seus interesses. **Indisponível para menores de 18 anos** |
| **Compartilhamento com parceiros** (`PARTNER_SHARING`) | compartilhar com marcas parceiras **apenas dados agregados**, como tendências de estilo, sem identificar você. **Indisponível para menores de 18 anos** |
| **Medidas do corpo** (`BODY_MEASUREMENTS`) | guardar e usar suas medidas no provador e nas recomendações. Tratamos como dado sensível (art. 11) |
| **Histórico de localização** (`LOCATION_HISTORY`) | usar sua localização aproximada para sugestões ligadas ao clima |
| **Treinamento de modelos de IA** (`AI_MODEL_TRAINING`) | usar suas fotos de peças e as correções que você faz para treinar e avaliar nossos modelos de visão computacional |

O avatar 3D tem consentimento próprio, pedido na hora de salvar (seção 1.3). **O FashionAI não faz reconhecimento facial.**

Sem os consentimentos de IA, o app continua funcionando com motores locais, mas alguns recursos ficam limitados.

## 4. Com quem compartilhamos

**Não vendemos dados pessoais.** Compartilhamos apenas o necessário com:

**4.1. Fornecedores (operadores)** que tratam dados em nosso nome, sob contrato e só para o que pedimos:

- **Hospedagem e infraestrutura:** Vercel (site e aplicativo web) e Railway (servidores da API, bancos de dados e armazenamento de arquivos).
- **E-mail transacional:** Resend (códigos de verificação, redefinição de senha e avisos).
- **Inteligência artificial**, conforme o recurso e só com o consentimento aplicável: Anthropic (Claude) e Google (Gemini) para texto e imagem; Replicate para edição de imagem. Também podem ser usados provedores de remoção de fundo (Photoroom, remove.bg), de geração 3D (Meshy, Stability AI) e de provador virtual (FASHN). A lista exata em uso fica disponível mediante pedido. [validar com jurídico]
- **Moderação de imagens:** Google Cloud Vision (SafeSearch), para detectar nudez nas fotos enviadas.
- **Clima:** Open-Meteo, que recebe apenas coordenadas aproximadas, sem dados que identifiquem você.

Exigimos dos provedores de IA que não usem seus dados para treinar os modelos deles, conforme as condições comerciais de cada um. [validar com jurídico]

**4.2. Outros usuários.** O que você torna público, como perfil, looks públicos, comentários, posição em rankings e o avatar na Passarela (se você permitir), fica visível para outras pessoas. Você pode deixar de aparecer na Passarela 3D e nos rankings públicos em Configurações.

**4.3. Marcas e celebridades.** Quando você resgata um cupom ou participa de uma combinação de loja, a marca recebe o mínimo necessário para validar o cupom. Fora isso, só dados agregados e só com o seu consentimento.

**4.4. Autoridades.** Quando houver ordem judicial ou obrigação legal, por exemplo a entrega de registros de acesso prevista no Marco Civil.

**4.5. Operações societárias.** Em caso de fusão, aquisição ou venda de ativos, os dados podem ser transferidos ao sucessor, que continuará obrigado por esta Política.

## 5. Transferência internacional

Alguns fornecedores processam dados fora do Brasil, principalmente nos Estados Unidos. Essas transferências seguem o **art. 33 da LGPD**, com base em cláusulas contratuais padrão e nas demais salvaguardas aprovadas pela ANPD, ou no seu consentimento específico quando for o caso. [validar com jurídico]

## 6. Por quanto tempo guardamos

| Dado | Prazo |
|---|---|
| Dados da conta e conteúdo | enquanto a conta existir; depois da exclusão, 30 dias de carência e então apagamos |
| Registros de acesso (IP, data e hora) | **6 meses**, conforme o art. 15 do Marco Civil, ou mais se houver ordem judicial |
| Notificações | cerca de 90 dias |
| Arquivo de exportação dos seus dados | 7 dias, depois o arquivo é apagado |
| Registro dos consentimentos e aceites | pelo tempo necessário para comprovar que foram dados, inclusive após a exclusão [validar com jurídico] |
| Dados ligados a fraude, disputas ou obrigações legais | pelo prazo legal ou prescricional aplicável |
| Cópias de segurança | apagadas no ciclo normal de rotação dos backups |

Dados anonimizados, que não permitem identificar você, podem ser mantidos para estatística (art. 12 da LGPD).

## 7. Como protegemos seus dados

- conexões cifradas (HTTPS/TLS) do navegador até a API e da API até os bancos de dados;
- **data de nascimento e telefone cifrados com AES-256-GCM**; senhas com hash Argon2id; e-mail também guardado como hash para buscas;
- documentos de verificação, exportações e a textura do avatar em **armazenamento privado**, acessível só pela sua conta;
- fotos **recodificadas ao serem recebidas, com remoção de metadados EXIF e de localização GPS**;
- **verificação em duas etapas (2FA)** disponível para a sua conta;
- limites de uso, registros de auditoria e acesso interno restrito a quem precisa.

Nenhum sistema é 100% seguro. Se houver um incidente que possa causar risco ou dano relevante, avisaremos você e a ANPD, como manda o art. 48 da LGPD.

## 8. Crianças e adolescentes

- O FashionAI **não é destinado a menores de 13 anos** e o cadastro recusa essas idades. Se descobrirmos dados de uma criança, vamos apagá-los.
- Tratamos dados de adolescentes **no seu melhor interesse** (art. 14 da LGPD, Enunciado CD/ANPD nº 1/2023) e seguimos o **ECA Digital (Lei 15.211/2025)**, em vigor desde 17/03/2026.
- **De 13 a 15 anos**, a conta deve ser vinculada à conta de um responsável legal, que pode ver e ajustar as configurações de privacidade. [validar com jurídico]
- **Até os 18 anos:** configurações de privacidade mais protetivas por padrão; nada de publicidade direcionada por perfil comportamental; nada de compartilhamento com parceiros; nenhum recurso com dinheiro ou transferência de pontos.
- Pais e responsáveis podem pedir acesso, correção ou exclusão dos dados do adolescente pelo **[E-MAIL DE CONTATO]**.

## 9. Seus direitos

Pela LGPD (art. 18), você pode:

- **confirmar** se tratamos seus dados e **acessá-los**;
- **baixar seus dados** em formato JSON (portabilidade), pelas Configurações da conta;
- **corrigir** dados incompletos ou desatualizados;
- pedir **anonimização, bloqueio ou eliminação** de dados desnecessários ou tratados em desconformidade;
- **revogar consentimentos** a qualquer momento, nos interruptores das Configurações;
- saber **com quem** compartilhamos seus dados;
- **opor-se** a tratamentos baseados em legítimo interesse;
- pedir **revisão de decisões automatizadas** que afetem seus interesses (art. 20);
- **excluir a conta**: são 30 dias de carência, em que você pode desistir, e depois apagamos os dados, salvo o que a lei manda guardar;
- reclamar à **Autoridade Nacional de Proteção de Dados (ANPD)**.

A maioria dessas opções está no próprio app. Para o resto, escreva para **[E-MAIL DE CONTATO]**. Respondemos em até 15 dias e podemos pedir uma confirmação de identidade para proteger você.

## 10. Cookies e armazenamento local

Usamos cookies e armazenamento local do navegador **essenciais** para manter você conectado, lembrar idioma e tema e proteger contra ataques. Hoje não usamos cookies de publicidade de terceiros. Se isso mudar, pediremos seu consentimento antes. [validar com jurídico]

## 11. Mudanças nesta Política

Podemos atualizar esta Política. Cada versão tem número e data. Se a mudança for relevante, como uma nova finalidade ou um novo tipo de dado, avisaremos no app ou por e-mail e pediremos **novo aceite** ou novo consentimento, quando necessário.

## 12. Contato

- **[RAZÃO SOCIAL]** — CNPJ **[CNPJ]**
- Endereço: **[ENDEREÇO]**
- Encarregado (DPO): **[ENCARREGADO/DPO]**
- E-mail: **[E-MAIL DE CONTATO]**
