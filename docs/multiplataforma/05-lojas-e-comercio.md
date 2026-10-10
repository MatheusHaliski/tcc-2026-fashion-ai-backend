# 05 — Matriz de distribuição por loja e política comercial

> Estado: **planejamento**. Nada aqui foi submetido a nenhuma loja. Nenhuma versão pode ser anunciada como
> disponível antes de aprovação **e** publicação na loja correspondente.
>
> Pesquisa de regras feita em 10/10/2026. Cada linha marcada **[verificar]** precisa ser reconfirmada na fonte oficial
> no dia em que o item for implementado — as regras de comércio mudaram várias vezes em 2025–2026 e diferem por país.

## 1. Decisão sobre o lançamento

| Canal | Plataforma | Entra no lançamento 1? | Motivo |
|---|---|---|---|
| App Store (App Store Connect) | iPhone, iPad | **Sim** | Canal principal de celular iOS; câmera e fotos são o fluxo de entrada do avatar |
| Google Play | Android | **Sim** | Canal principal de celular Android |
| Microsoft Store | Windows | **Sim** | Instalação e atualização gerenciadas, sem taxa para apps não-jogo com comércio próprio [verificar] |
| Mac App Store | macOS | **Sim**, com build próprio | Build macOS separado do iOS; não é publicado automaticamente pelo envio do app de iPhone |
| Steam | Windows (e macOS) | **Não no lançamento 1** — reavaliar no marco 6 | Público é de jogadores; FashionAI é app de moda/social. Vale como canal de descoberta do provador 3D se houver modo "explorar ambientes" forte. Exige regras próprias para compras dentro do app [verificar] |
| Epic Games Store | Windows (e macOS) | **Não no lançamento 1** — reavaliar junto com Steam | Aceita apps não-jogo; 0% de repasse no primeiro US$ 1 mi/ano por app quando usa o pagamento Epic [verificar]; afinidade técnica com Unreal, mas público pequeno para o produto |
| PlayStation Store | PS5 | **Marco próprio** | Depende de contrato com a Sony, acesso ao SDK via Epic, devkits e certificação (TRC) |
| Microsoft Store no Xbox | Xbox Series X\|S | **Marco próprio** | Depende do programa ID@Xbox / acordo de publicação, GDK, devkits e certificação (XR) |

## 2. Matriz por loja

Legenda: **ID** = identificador do produto; **Build** = artefato enviado; **Assinatura** = assinatura de código.

| Item | App Store (iOS/iPadOS) | Mac App Store | Google Play | Microsoft Store (Windows) | Steam | Epic Games Store | PlayStation | Xbox |
|---|---|---|---|---|---|---|---|---|
| Cadastro | Apple Developer Program (empresa, D-U-N-S) | Mesmo programa Apple | Conta Play Console (organização, verificação de identidade) | Conta Partner Center (empresa) | Steamworks + taxa por app (Steam Direct) | Conta Epic Developer Portal + acordo de distribuição | Contrato com Sony Interactive + acesso ao SDK pela Epic | ID@Xbox ou acordo de publicação + acesso ao GDK pela Epic |
| ID do produto | Bundle ID `br.com.fashionai.app` | Bundle ID `br.com.fashionai.mac` (ou universal purchase com o mesmo ID, decidir no marco 6) | Package name `br.com.fashionai.app` | Product ID do Partner Center + identidade do pacote | App ID Steam | Product/Sandbox ID Epic | Title ID / Concept ID | Title ID / Store ID |
| Build | `.ipa` (UE 5.8, Xcode 26, SDK base iOS 26 — exigido desde 28/04/2026; alvo mínimo iOS 17) | `.app` empacotado em `.pkg` com sandbox | `.aab` com target API 36 (obrigatório para novos apps e atualizações desde 31/08/2026) [verificar versão de NDK/SDK suportada pela UE 5.8] | MSIX (assinado e hospedado pela Microsoft) **ou** EXE/MSI hospedado por nós | depot por plataforma via SteamPipe | build via BuildPatchTool | pacote PS5 (formato do SDK) | pacote GDK (MSIXVC) |
| Assinatura | Certificado de distribuição Apple + provisioning | Certificado Mac App Distribution + sandbox entitlements | Play App Signing (chave de upload nossa) | MSIX: assinado pela Store; EXE/MSI: certificado Authenticode nosso | Sem exigência da loja; recomendado Authenticode | Recomendado Authenticode | Pelo processo da Sony | Pelo processo da Microsoft |
| Página | Nome, subtítulo, capturas iPhone **e** iPad, vídeo, palavras-chave | Capturas Mac próprias | Ficha, capturas telefone/tablet, gráfico de destaque | Capturas Windows, descrição | Página de loja revisada antes do lançamento ("coming soon") | Página revisada pela Epic | Ativos de loja PS | Ativos de loja Xbox |
| Classificação etária | Questionário Apple | Questionário Apple | IARC | IARC | Questionário Steam / descritores de conteúdo | IARC | Classificação regional (ClassInd no Brasil, ESRB, PEGI…) | IARC + regionais |
| Privacidade | "Nutrition label" + Privacy Manifest + motivo de uso de câmera/fotos; deleção de conta dentro do app obrigatória | Idem | Formulário Data Safety + política de privacidade + deleção de conta pelo app **e** pela web | Política de privacidade obrigatória (app usa rede e dados pessoais) | Política de privacidade | Política de privacidade | Requisitos da Sony (incluindo contas de menores) | Requisitos da Microsoft (XR de privacidade, contas de crianças) |
| Biometria (rosto/corpo) | Declarar coleta; Face data com uso restrito | Idem | Declarar como dado pessoal sensível | Declarar | Declarar | Declarar | Sem câmera no fluxo do console (ver `03`) | Idem |
| Atualização | Revisão por versão; TestFlight para beta | Revisão por versão; TestFlight para Mac | Faixas interna/fechada/aberta/produção, lançamento gradual | Flights de pacote; revisão por submissão | Branches beta/default, sem revisão por patch | Revisão de build | Patch passa por certificação | Patch passa por certificação |
| Compras/assinatura | IAP/StoreKit para conteúdo digital; link externo permitido só na vitrine dos EUA [verificar] | IAP/StoreKit | Play Billing para conteúdo digital; programas de cobrança alternativa por país [verificar] | Apps não-jogo podem usar comércio próprio e manter 100% [verificar]; Store commerce 15% | Microtransações via Steam Wallet para itens comprados dentro do app [verificar] | Pagamento Epic (0% até US$ 1 mi/ano por app) ou webshop do desenvolvedor [verificar] | PlayStation Store obrigatória para conteúdo vendido no console | Microsoft Store obrigatória no console |
| Suporte | URL de suporte obrigatória | Idem | E-mail de contato obrigatório | URL/contato de suporte | Fórum/URL | URL | Processo Sony | Processo Microsoft |
| Revisão | App Review (diretrizes 2.x, 3.1, 4.x, 5.1) | App Review + sandbox | Revisão de políticas | Certificação da Store | Revisão de página e de build antes do 1º lançamento | Revisão de produto | Certificação TRC | Certificação XR |

## 3. Política de compra, assinatura e direito de uso entre lojas

Princípios:

1. **A conta FashionAI é dona dos dados** (perfil, avatar, guarda-roupa, peças, looks, posts). Esses dados são gratuitos
   e sincronizam em todas as plataformas. Nada disso é "conteúdo pago".
2. **Direito pago tem origem registrada.** Toda compra gera um `entitlement` com `store` (APPLE, GOOGLE, MICROSOFT,
   STEAM, EPIC, SONY, XBOX, WEB), `sku`, `transaction_id` verificado no servidor da loja e `scope`.
3. **O escopo é decidido por SKU e por loja, não por suposição.** Três escopos:
   - `ACCOUNT` — vale em todas as plataformas. Só usamos onde a regra de **todas** as lojas que vão exibir o item
     permite consumir algo comprado em outro lugar (ex.: diretriz Apple 3.1.3(b) "multiplatform services" exige que o
     item também esteja à venda via IAP no app iOS) [verificar cada loja].
   - `STORE` — vale só nas plataformas da loja onde foi comprado (padrão obrigatório nos consoles).
   - `NONE_ON` — lista de lojas em que o direito **não** é exibido (ex.: item comprado com moeda de outra loja que a
     loja atual proíbe honrar).
4. **Moeda virtual (FAI Points)** continua sendo ganha por uso, sem compra com dinheiro no lançamento 1. Vender pontos
   por dinheiro exigiria saldo separado por loja (consoles e Steam proíbem saldo transferido) — fica fora do escopo
   até decisão de produto.
5. **Assinatura premium** (se existir): uma assinatura ativa por conta; a loja de origem gerencia renovação e
   cancelamento; as outras plataformas mostram "assinatura gerenciada em <loja>" sem botão de compra duplicado.
   Exibir os benefícios fora da loja de origem só onde a loja permitir [verificar].
6. **Reembolso/estorno** recebido por notificação servidor-a-servidor da loja revoga o `entitlement` em todas as
   plataformas.
7. **Nenhum comércio é implementado antes da verificação das regras vigentes**, registrada com data e link neste
   arquivo, por loja e por país de lançamento (Brasil primeiro).

Implementação planejada (não iniciada neste marco): tabela `entitlements`, verificador por loja (App Store Server API,
Play Developer API, Microsoft Store collections API, Steam Web API, Epic Ecom API, APIs de console) e
`EntitlementPolicy` que responde "este direito vale nesta plataforma?".

## 4. Licença da Unreal e custos

| Item | Situação conhecida | Ação |
|---|---|---|
| EULA Unreal | Apps que entregam código Unreal a usuários finais seguem o EULA padrão: grátis abaixo de US$ 1 mi de receita bruta; acima disso, royalty de 5% para "jogos" e assinatura por assento (US$ 1.850/ano/assento) para empresas não-jogo **que não distribuem** apps com código Unreal a terceiros [verificar] | FashionAI distribui o runtime a usuários finais: confirmar com a Epic por escrito qual regime se aplica (royalty de 5% ou acordo customizado) antes do lançamento comercial |
| Royalty em loja Epic | Receita via Epic Games Store é isenta de royalty da Unreal [verificar] | Considerar na decisão Steam × Epic |
| Consoles | Sem custo de engine adicional, mas devkits, certificação e contrato com cada plataforma | Orçar no marco 5 |
| Processamento 3D | Meshy (geração), FASHN (try-on 2D), GPU para conversão de malhas e LOD | Ver `07-custos-e-limitacoes.md` |
| Armazenamento/entrega | Assets por peça em várias qualidades + atlas do avatar | CDN com URLs assinadas; ver `07` |

## Fontes consultadas (10/10/2026)

- Apple — requisitos de iOS para Unreal Engine (UE 5.8, Xcode 26, SDK base 26): https://dev.epicgames.com/documentation/unreal-engine/ios-ipados-and-tvos-development-requirements-for-unreal-engine
- Google Play — nível de API alvo (API 36 a partir de 31/08/2026): https://developer.android.com/google/play/requirements/target-sdk e https://support.google.com/googleplay/android-developer/answer/11926878
- Microsoft Store — publicação e apps desktop tradicionais: https://learn.microsoft.com/windows/apps/publish/get-started e https://developer.microsoft.com/microsoft-store/desktop-apps
- Epic Games Store — repasse de receita: https://store.epicgames.com/distribution/revenue-programs/revenue-share
- Unreal — preços: https://www.unrealengine.com/blog/we-are-updating-unreal-engine-twinmotion-and-realitycapture-pricing-in-late-april
- Apple — diretrizes de revisão (seção 3.1): https://developer.apple.com/app-store/review/guidelines/
- Steamworks — documentação de parceiro: https://partner.steamgames.com/doc/home
