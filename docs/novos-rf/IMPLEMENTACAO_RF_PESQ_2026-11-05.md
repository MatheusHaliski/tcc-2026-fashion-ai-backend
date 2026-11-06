# Implementação dos RF-PESQ-01 a 10 e melhorias nos RF de passaporte, editor 3D e tamanho

Data: 05/11/2026. Branch `claude/ecstatic-fermat-f4lq69`. Origem das propostas: `docs/novas_propostas_RF.md`.
Cada RF tem migração Flyway própria (V86–V96), entidades em `fai-domain`, serviço com `@Transactional` e autorização em
`fai-application`, controller em `fai-web`, teste de serviço (kit `MemoryRepository`) e tela/teste Vitest no frontend.
Benefício esperado continua hipótese a validar; nada aqui promete pré-venda, produção, autenticidade ou previsão de demanda.

| RF | Backend (migração · serviço · rotas) | Frontend | Critérios cobertos por teste |
|---|---|---|---|
| RF-PESQ-01 variante SKU/cor/tamanho | V86 · `PhysicalStoreVariantService`, `PhysicalStoreVariantStock` (débito travado) · `/api/physical-store/listings/{id}/checkout`, `/variants` | `VariantPicker`, `SellerVariantManager`, `StoreOrders` | CA1 (checkout só com variantes da oferta; esgotado ≠ informação ausente), CA2 (rejeita variante de outra oferta/inexistente/esgotada antes do débito), CA3 (último SKU vende uma vez; chave repetida devolve o mesmo pedido), CA4 (pedido/admin exibem o SKU; retrato imutável) |
| RF-PESQ-02 troca/devolução | V87 · `PhysicalStoreReturnService` + `Policy`/`Settlement`/`Access`/`Views` · `/api/me/physical-store/orders/{id}/returns`, `/api/physical-store/returns/*` | `ReturnRequest`, `ReturnsInbox` | CA1 (política congelada no pedido), CA2 (só comprador, vendedor e equipe; comprovante cifrado sem URL pública), CA3 (estorno único após inspeção), CA4 (reposição só por decisão; divergência com motivo e trilha), CA5 (caimento só com consentimento) |
| RF-PESQ-03 lavanderia | V88 · `LaundryService`, `LaundryRules`, `LaundryConflicts` · `/api/me/laundry/*` | `LaundryBoard` em `/closet/laundry` | CA1 (limpa→usada→lavagem→limpa separado de condição/arquivo), CA2 (sugestão só com instrução/composição; confirmação obrigatória; dado ausente sinalizado), CA3 (peça de outro usuário rejeitada; log datado), CA4 (retira da disponibilidade e restaura após confirmação; aviso de looks planejados) |
| RF-PESQ-04 BOM e cotação | V89 · `AtelierSourcingService` · `/api/atelier/projects/{id}/bom`, `/quote-requests`, `/quotes/{id}/accept`, `/api/me/atelier/quote-requests` | aba "Materiais e cotação", `/atelier/quotes` | CA1 (revisão imutável, quantidades por tamanho, moeda, preço unitário, amostra, validade, prazo), CA2 (fornecedor vê só revisão/BOM/quantidades; preço só autoria e fornecedor), CA3 (revisão nova → desatualizada; aceite grava autor/versão), CA4 (`commitment = NONE`) |
| RF-PESQ-05 ordem de reparo | V90 · `RepairOrderService` · `/api/passports/{id}/repair-orders`, `/api/repair-orders/*`, `/api/me/repair-orders` | `/pieces/[id]/passport/repairs`, `/repair-orders` | CA1 (estados; só o dono autoriza), CA2 (comprovante com prestador/data/serviço/escopo; recibo fora do QR), CA3 (correção preserva histórico; revogação bloqueia prestador), CA4 (`attestation = PROVIDER_DECLARED`, `authenticity = NOT_CERTIFIED`) |
| RF-PESQ-06 amostra/lote | V91 · `AtelierProductionService` · `/api/atelier/projects/{id}/production`, `/api/atelier/production/*` | aba "Amostra e produção", `/atelier/production` | CA1 (revisão imutável + BOM/tolerâncias congeladas), CA2 (nova revisão invalida aprovação), CA3 (desvio aceito só com justificativa ou devolvido), CA4 (voto ignorado; sem cobrança) |
| RF-PESQ-07 prova física | V92 · `FittingAppointmentService` · `/api/me/fitting-appointments`, `/api/fitting-appointments/*`, `/api/physical-store/fitting-appointments` | `/try-on/appointments`, caixa da loja na aba da marca | CA1 (confirmação só pela loja, com horário), CA2 (expiração/cancelamento idempotentes; loja não recebe medidas/fotos), CA3 (sem estoque/integração = pendente), CA4 (resultado conciliado libera reserva; nada publicado) |
| RF-PESQ-08 acessibilidade | V93 · `AccessibilityService`, `AccessibilityRules` · `/api/catalog/accessibility/search`, `/api/catalog/products/{id}/accessibility` | `/search/accessibility`, declarações na aba da marca | CA1 (marca declara com origem; nada inferido), CA2 (filtros por requisição; sem diagnóstico; nada no perfil), CA3 (declarado × revisado × sem informação), CA4 (linguagem concreta; `clinicalClaim = NONE`), CA5 (`validatedWithUsers = false` até tarefas com o público-alvo) |
| RF-PESQ-09 plano de compras | V94 · `ShoppingPlanService`, `ShoppingPlanRules` · `/api/me/shopping-plan`, `/dismissals` | `/lookbook/shopping-plan` | CA1 (peças que cada candidato complementa e ocasiões cobertas), CA2 (preço/fonte/moeda/data; só confirmados no somatório), CA3 (já possuo/não preciso persistidos; recálculo não repete), CA4 (nenhuma compra; só guarda-roupa próprio) |
| RF-PESQ-10 demanda agregada | V95 · `RetailDemandService`, `DemandAggregation`; consentimento `RETAIL_DEMAND_ANALYTICS` em `ConsentPurposes` · `/api/me/retail-demand/*`, `/api/physical-store/demand` | painel na aba da marca; "eu queria" no checkout; revogação apaga contribuições | CA1 (opt-in, finalidade explícita, revogável), CA2 (sem identificadores; limiar), CA3 (supressão complementar contra reconstrução por diferença), CA4 (só o próprio catálogo), CA5 (período, amostra, atraso, semântica interesse ≠ intenção ≠ venda) |

## RF de passaporte digital, editor 3D e tamanho (análise e melhorias)

**Situação encontrada.** O passaporte existente (`GarmentPassportService`) é o documento privado do proprietário (origem,
cuidados, histórico, transferência) e não uma ficha agregada; o editor 3D existente (`components/atelier3d`) opera sobre
projetos do Atelier, não sobre a peça; a seleção de tamanho do provador (`lib/tryon/sizes.ts`, `SizePicker`) aplica uma
grade de referência ao modelo sem distinguir disponibilidade, medidas cadastradas e representação 3D.

**Melhorias entregues.**

- Passaporte digital da peça: `DigitalPassportService` agrega identificação, imagens/fonte, composição/conservação,
  tamanhos/medidas e modelo 3D com procedência por campo (`VERIFIED`, `SOURCE_DECLARED`, `OWNER_DECLARED`, `ESTIMATED`,
  `NOT_INFORMED`), identificador estável `FAI-PIECE-<id>`, `lastUpdated` e projeção por visibilidade
  (`/api/pieces/{id}/digital-passport`; tela `/pieces/[id]/sheet`). Quarentena do asset nunca aparece como aprovado.
- Editor 3D da peça: V96 `piece_3d_customizations`; `PieceCustomizationService` (só o dono salva; original intacto;
  documento validado; escala identificada como visual; `fitClaim = NONE`); tela `/pieces/[id]/editor-3d` reutilizando o
  viewport/inspetor do Atelier com câmera, ferramentas, desfazer/refazer, restaurar com confirmação e salvar.
- Peças base por subcategoria (editor 3D e Atelier): toda subcategoria ativa da taxonomia (e os códigos legados ainda
  em uso) tem uma peça base — GLB publicado pela equipe em `public/garment-templates/<subcategoria>.glb` ou, na falta
  dele, base procedural com partes nomeadas (`lib/atelier3d/base-pieces*.ts`: 19 partes de cima, 14 de baixo, 5 peças
  inteiras, 19 calçados, 23 acessórios). O editor da peça abre sempre sobre uma base (`lib/piece3d/base-source.ts`):
  a peça base da subcategoria ou o GLB próprio da peça; a pessoa modela por cima e a base nunca muda. A chave da base
  (`template:<sub>@<versão>` ou URL do GLB) é gravada com a personalização (`PieceCustomizationService.SaveCmd.baseKey`,
  validada contra `BasePieceCatalog`), o editor reabre na mesma base e trocar de base com alterações pendentes pede
  confirmação. O painel de criação do Atelier ganhou o modo "Peça base da taxonomia" (categoria + subcategoria).
  Peças base são volumes de exploração: sem rig, sem tamanho certificado, nunca aprovadas para o provador por si.
- Tamanho: `SizeOptionsService` (`/api/catalog/products/{id}/size-options`) distingue tamanho comercial com disponibilidade
  da loja, medidas da tabela por produto (unidade, protocolo, origem oficial × outro método) e variação visual estimada;
  `SizePicker` bloqueia tamanhos indisponíveis, informa ausência de 3D sem equivalência e marca aproximações; provas salvas
  recuperam o tamanho e avisam quando a opção deixou de estar disponível (`validateSavedSizes`).

## Verificação

`mvn test` em `fai-application` (2.079 testes) verde; novos testes de serviço: 39. Frontend: `tsc --noEmit`, `i18n:check`,
`i18n:scan` e `line_ratchet` sem violações; os testes Vitest novos passam. Falhas pré-existentes e não relacionadas
(`app/pages.smoke.test.tsx` das páginas `lab/heist*` e `lib/avatar3d/human/*`) também falham no commit-base `6b370d9`.

## Fora de escopo / próximos passos

Limpeza de dados pessoais (`AccountDataCleanup`) foi adicionada para demanda; os demais módulos novos guardam só ids e
textos operacionais e devem receber cleanup próprio antes do piloto. Integração real de agenda/estoque de loja, política de
devolução por vendedor e revisão de privacidade dos limiares do painel seguem como decisões de produto.
