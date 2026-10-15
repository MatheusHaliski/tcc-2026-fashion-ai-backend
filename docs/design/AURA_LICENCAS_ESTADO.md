# Licenças Metamorfose — estado de implementação

Implementado nesta branch:
- `/api/admin/aura-store` (GET/POST) e página `/admin/aura-store`: administra ofertas Hype e Metamorfose.
- Migração V65: 20 ofertas Metamorfose inicialmente **inativas**, para revisão/publicação administrativa; licenças únicas por emissor/preset.
- `/api/aura-store`, `/arts-store` e compra: apenas marca/celebridade aprovada; saldo e oferta conferidos sob trava; débito no ledger sem crédito de progressão; repetir a compra não debita novamente.
- `/api/me/arts` e subaba Minhas Artes no próprio perfil: licenças adquiridas, explicitamente distintas do direito de um card participante.
- `/api/admin/coupons`: cria cupom para um emissor institucional aprovado, preservando políticas, estoque e limites do serviço existente.

Ainda pendente:
- Associar a licença à promoção de selo/cupom e conceder o direito ao card participante após elegibilidade.
- Aplicar/remover/reaplicar artes exclusivas só no card contemplado e revogar condição Hype quando perdida.
- Integração das recompensas com FLAIR, compra por participante e demais fontes.
- Formulário administrativo completo de cupons com arte e provas reais dos fluxos no navegador.

Os testes de unidade da compra passaram (cinco cenários) e o backend compilou. A migração e as compras ainda não foram verificadas em MySQL nesta edição. Nenhuma compra ou publicação ocorreu em produção.
