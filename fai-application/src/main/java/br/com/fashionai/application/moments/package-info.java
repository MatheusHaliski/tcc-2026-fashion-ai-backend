/**
 * FashionAI MOMENTOS — o tempo da moda dentro do FashionAI (docs/momentos/MOMENTOS.md).
 *
 * <p>GUARDA-ROUPA = o que eu tenho · DNA = quem eu sou · HYPE = o que está acontecendo · MOMENTOS = quando e em qual
 * contexto · COPILOT = o que posso fazer · LOOKBOOK = como me expresso · FLAIR = como participo · HISTÓRICO = como mudei.
 * Este pacote cuida só da dimensão temporal e conversa com as outras sem misturá-las numa métrica única: o
 * MomentMatch é separado do Hype e da compatibilidade pessoal; o Hype contextual deriva do global sem sobrescrevê-lo.</p>
 *
 * <p>Regras que valem para tudo aqui: tempo pelo relógio do servidor (MomentTime); FAI Points pelo ledger idempotente
 * (MomentPointsPolicy → FaiPointsService.award); Momentos privados nunca entram em descoberta, ranking global ou perfil
 * público; Momentos terminados nunca somem (viram Memória); notificações informativas, no máximo uma por motivo.</p>
 *
 * <p>{@link br.com.fashionai.application.moments.MomentService} é o único bean (Facade); os colaboradores
 * package-private recebem as dependências por {@code MomentContext} e herdam as regras de acesso de
 * {@code MomentSupport}.</p>
 */
package br.com.fashionai.application.moments;
