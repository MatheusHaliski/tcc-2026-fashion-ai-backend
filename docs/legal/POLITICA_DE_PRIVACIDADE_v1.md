# Política de Privacidade do FashionAI

**Versão 1.1 — minuta para publicação em [DATA DE PUBLICAÇÃO]**

> **Minuta não publicada.** Antes de disponibilizar esta Política, preencha os dados do controlador e do encarregado, confirme os fornecedores e operações efetivamente ativos e valide as pendências de privacidade e produto. Este texto não substitui revisão jurídica.

Esta Política explica quais dados pessoais o FashionAI coleta, para quê, com quem compartilha e como você controla tudo isso. Ela segue a **Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018)**, o **Marco Civil da Internet (Lei 12.965/2014)** e o **ECA Digital (Lei 15.211/2025)**.

O controlador dos seus dados é **[RAZÃO SOCIAL]**, CNPJ **[CNPJ]**, com sede em **[ENDEREÇO]**. Nosso encarregado (DPO) é **[ENCARREGADO/DPO]**, que você encontra pelo **[E-MAIL DE CONTATO]**.

---

## Resumo em 1 minuto

- **Coletamos o necessário para o app funcionar:** cadastro, peças e looks, fotos que você envia e como você usa o app.
- **O aceite dos Termos não é consentimento para finalidades opcionais.** Quando uma finalidade depender de consentimento, a escolha será solicitada separadamente e poderá ser revogada.
- **Não usamos reconhecimento facial.** As fotos do avatar 3D são processadas no seu navegador. O modelo do rosto só é salvo se você autorizar, fica privado e pode ser apagado.
- **Não vendemos seus dados.** Compartilhamentos operacionais, com marcas ou autoridades são descritos na seção 4 e dependem da finalidade e da base legal aplicável.
- **Fotos são limpas.** Ao receber uma imagem, removemos metadados como EXIF e localização GPS.
- **Dados sensíveis são cifrados.** Data de nascimento e telefone são guardados criptografados (AES-GCM). Você pode ativar a verificação em duas etapas.
- **Podemos usar fornecedores no Brasil e no exterior.** Os fornecedores efetivamente ativos, os dados envolvidos e as salvaguardas aplicáveis devem ser informados nesta Política antes da publicação.
- **O tratamento de dados de menores exige controles próprios.** A faixa etária permitida e as medidas implementadas devem ser confirmadas antes da publicação.
- **Você pode solicitar acesso, correção e exclusão dos dados.** Prazos de carência, retenção legal e eliminação dependem do tipo de dado e devem ser explicados abaixo.
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

As fotos do rosto são analisadas **no seu navegador** e não são enviadas ao servidor para essa etapa. Se você der o **consentimento expresso**, salvamos o **modelo 3D e a textura do rosto**. Tratamos esses dados como de **natureza biométrica**, ou seja, sensíveis. A textura fica em armazenamento privado e você pode apagar o avatar a qualquer momento. O FashionAI **não** usa esses dados para identificar você nem para reconhecimento facial. A classificação jurídica e os controles de acesso aplicáveis a cada dado do avatar devem ser confirmados antes da publicação.

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

Quando uma finalidade depender de consentimento, a escolha deve ser solicitada de forma específica, destacada e separada do aceite dos Termos. O consentimento poderá ser revogado por um meio acessível, sem afetar a licitude do tratamento anterior. A disponibilidade, o estado inicial e o caminho de cada controle abaixo devem corresponder ao produto efetivamente publicado; não considere esta minuta prova de que todos os controles já estão implementados.

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

**Não vendemos dados pessoais.** Quando necessário para prestar o serviço ou cumprir a lei, podemos compartilhar dados com:

**4.1. Fornecedores (operadores)** que tratam dados em nosso nome, sob contrato e só para o que pedimos:

- **Hospedagem e infraestrutura:** Vercel (site e aplicativo web) e Railway (servidores da API, bancos de dados e armazenamento de arquivos).
- **E-mail transacional:** Resend (códigos de verificação, redefinição de senha e avisos).
- **Inteligência artificial**, conforme o recurso: Anthropic (Claude) e Google (Gemini) para texto e imagem; Replicate para edição de imagem; e possíveis provedores de remoção de fundo (Photoroom, remove.bg), geração 3D (Meshy, Stability AI) e provador virtual (FASHN). Esta lista contém integrações previstas e **não confirma que todas estejam ativas**. Antes da publicação, deve ser substituída por uma lista atualizada dos fornecedores efetivamente utilizados, suas finalidades, categorias de dados e canais para obter informações.
- **Moderação de imagens:** Google Cloud Vision (SafeSearch), para detectar nudez nas fotos enviadas.
- **Clima:** Open-Meteo, que recebe apenas coordenadas aproximadas, sem dados que identifiquem você.

O uso dos seus dados por fornecedores para treinamento próprio não é autorizado por esta Política. Antes de habilitar cada fornecedor, a FashionAI deve confirmar em contrato e nas configurações do serviço as regras de retenção, treinamento, segurança, exclusão e subcontratação; não se deve presumir que essas restrições existam sem confirmação documentada.

**4.2. Outros usuários.** O que você torna público, como perfil, looks públicos, comentários, posição em rankings e o avatar na Passarela (se você permitir), fica visível para outras pessoas. Você pode deixar de aparecer na Passarela 3D e nos rankings públicos em Configurações.

**4.3. Marcas e celebridades.** Quando você resgata um cupom ou participa de uma combinação de loja, a marca recebe o mínimo necessário para validar o cupom. Fora isso, só dados agregados e só com o seu consentimento.

**4.4. Autoridades.** Quando houver ordem judicial ou obrigação legal, por exemplo a entrega de registros de acesso prevista no Marco Civil.

**4.5. Operações societárias.** Em caso de fusão, aquisição ou venda de ativos, os dados podem ser transferidos ao sucessor, que continuará obrigado por esta Política.

## 5. Transferência internacional

Alguns fornecedores podem processar dados fora do Brasil. Antes de cada transferência internacional, a FashionAI deve identificar o país de destino, os dados e destinatários envolvidos e o mecanismo de transferência aplicável segundo a LGPD e a regulamentação da ANPD, além de informar as salvaguardas relevantes. Não se presume que uma transferência esteja autorizada apenas porque um fornecedor é citado nesta Política.

## 6. Por quanto tempo guardamos

| Dado | Prazo |
|---|---|
| Dados da conta e conteúdo | enquanto a conta existir; após pedido de exclusão, durante a carência informada no fluxo e depois eliminados ou anonimizados, salvo exceção legal |
| Registros de acesso (IP, data e hora) | **6 meses**, conforme o art. 15 do Marco Civil, ou mais se houver ordem judicial |
| Notificações | cerca de 90 dias |
| Arquivo de exportação dos seus dados | 7 dias, depois o arquivo é apagado |
| Registro dos consentimentos e aceites | pelo prazo estritamente necessário para comprovar a escolha e cumprir obrigações legais ou defender direitos; prazo e categorias retidas devem ser definidos e informados antes da publicação |
| Dados ligados a fraude, disputas ou obrigações legais | pelo prazo legal ou prescricional aplicável |
| Cópias de segurança | apagadas no ciclo normal de rotação dos backups |

Dados efetivamente anonimizados, que não permitem identificar você por meios razoáveis, podem ser mantidos para estatística, conforme a legislação aplicável. A simples remoção de identificadores não torna automaticamente um dado anônimo.

## 7. Como protegemos seus dados

- conexões cifradas (HTTPS/TLS) nos trechos do serviço que efetivamente as suportam;
- **data de nascimento e telefone cifrados com AES-256-GCM**; senhas com hash Argon2id; e-mail também guardado como hash para buscas;
- documentos de verificação, exportações e a textura do avatar em **armazenamento privado**, acessível só pela sua conta;
- fotos **recodificadas ao serem recebidas, com remoção de metadados EXIF e de localização GPS**;
- **verificação em duas etapas (2FA)** disponível para a sua conta;
- limites de uso, registros de auditoria e acesso interno restrito a quem precisa.

Nenhum sistema é 100% seguro. Em caso de incidente de segurança, avaliaremos os riscos e adotaremos as providências e comunicações exigidas pela LGPD e pela regulamentação aplicável.

## 8. Crianças e adolescentes

- O FashionAI **não é destinado a menores de 13 anos** e o cadastro recusa essas idades. Se descobrirmos dados de uma criança, vamos apagá-los.
- Tratamos dados de crianças e adolescentes de acordo com a LGPD e demais normas aplicáveis, observando o melhor interesse.
- Antes de admitir menores de idade, a FashionAI deve confirmar a faixa etária permitida, quando é necessária autorização de responsável, como ela será verificada e quais recursos, compartilhamentos e configurações estarão disponíveis para cada faixa etária.
- Pais e responsáveis podem exercer direitos relativos aos dados de crianças e adolescentes pelo **[E-MAIL DE CONTATO]**, mediante verificação adequada de autoridade e identidade.

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

A disponibilidade dos controles no app deve ser confirmada antes da publicação. Para exercer seus direitos, escreva para **[E-MAIL DE CONTATO]**; responderemos nos prazos previstos pela legislação aplicável e poderemos solicitar informações razoáveis para confirmar sua identidade e proteger seus dados.

## 10. Cookies e armazenamento local

Os cookies e recursos de armazenamento local efetivamente utilizados, sua finalidade, duração e possibilidade de recusa devem ser descritos antes da publicação. Cookies não essenciais não devem ser ativados antes da escolha do usuário quando a lei exigir consentimento. A implementação atual deve ser auditada para confirmar se há cookies analíticos, de terceiros ou de publicidade.

## 11. Mudanças nesta Política

Podemos atualizar esta Política. Cada versão terá número e data e ficará acessível para consulta. Comunicaremos mudanças relevantes e solicitaremos novo consentimento quando a lei exigir. O aceite geral dos Termos não substitui esse consentimento. A forma de comunicar e registrar novas versões deve ser compatível com os recursos efetivamente implementados no produto.

## 12. Contato

- **[RAZÃO SOCIAL]** — CNPJ **[CNPJ]**
- Endereço: **[ENDEREÇO]**
- Encarregado (DPO): **[ENCARREGADO/DPO]**
- E-mail: **[E-MAIL DE CONTATO]**
