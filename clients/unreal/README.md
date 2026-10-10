# Cliente Unreal do FashionAI (esqueleto — marco 3)

> **Estado: não compilado.** Este diretório foi criado num ambiente Linux sem Unreal Engine, Xcode ou SDK Android.
> Antes de qualquer outra coisa, abrir `FashionAI/FashionAI.uproject` na UE 5.8, gerar os arquivos de projeto e
> compilar. Erros de compilação aqui são esperados e devem ser corrigidos no primeiro build.

O que já existe:

- `FashionAI.uproject` (UE 5.8; CommonUI, Enhanced Input, Hair Strands, Chaos Cloth; alvos iOS, Android, Windows, Mac).
- Módulo `FashionAI` com `UFaiApiSubsystem`: cabeçalhos de plataforma/qualidade, `GET /api/client/config`,
  `GET /api/me/avatar3d/canonical`, sessão do provador (`GET/PUT/DELETE /api/try-on/session/**`) com `If-Match`, e
  tratamento de 412 (adota o estado do outro aparelho e reaplica a ação uma vez).

O que falta para o vertical slice (entrar → escolher peça → provador → vestir → voltar com o mesmo estado):

1. Plugin `FaiPlatform` (Objective-C++/Kotlin/C++): login com autofill, armazenamento seguro do refresh token,
   seletor de fotos/câmera, distinção iPhone × iPad.
2. Import do corpo `FAI_BODY_V1` (de `public/avatar3d/body/fai-body-v1.*`, MPFB2 CC0) como Skeletal Mesh + morph targets;
   porte para C++ da deformação de corpo/rosto de `lib/avatar3d/human/*`.
3. Carregamento de roupa em tempo de execução (avaliar o formato final: glTF com plugin de runtime ou `.pak` de conteúdo
   cozido por plataforma) e conferência do `sha256`.
4. Telas CommonUI por família (celular, computador, console) — ver `docs/multiplataforma/01` §3.
5. Teste automatizado do cliente (`ParseTryOnSession`) com os JSONs de exemplo do contrato.

Módulos de console (PS5/Xbox) **não** entram neste repositório: o código e as ferramentas dos SDKs são confidenciais e
ficam num repositório privado com acesso restrito, quando houver acesso autorizado.
