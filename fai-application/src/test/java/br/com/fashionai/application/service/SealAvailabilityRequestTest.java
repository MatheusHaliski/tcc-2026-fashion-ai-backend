package br.com.fashionai.application.service;

import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Exercício 11: o prazo do selo é revalidado no servidor na hora do pedido de vínculo, não só escondido na lista. Selo
 * agendado ou encerrado não é sugerido; se o prazo acaba entre a sugestão e o aceite, o aceite é recusado (409); e
 * mudar o prazo depois não desfaz o vínculo já concedido.
 */
class SealAvailabilityRequestTest extends SealPromotionFlowFixture {
    private Seal selo() {
        return seal(brand, "Campanha de dezembro", SealTier.LOOK, policyOf(rule("brand", "Nike")), null);
    }

    @Test
    void seloAgendadoOuEncerradoNaoEhSugerido() {
        Seal selo = selo();
        Scheme look = look("Look", piece(ana, "Dunk", "Nike", "black"));

        selo.setAvailableFrom(Instant.now().plus(Duration.ofDays(1)));
        assertThat(suggestions(look)).as("agendado: o início ainda não chegou").isEmpty();
        selo.setAvailableFrom(null);
        selo.setAvailableUntil(Instant.now().minusSeconds(1));
        assertThat(suggestions(look)).as("encerrado: o fim já passou").isEmpty();
        selo.setAvailableUntil(Instant.now().plus(Duration.ofDays(1)));
        assertThat(suggestions(look)).hasSize(1);
    }

    @Test
    void prazoQueVenceEntreASugestaoEOAceiteRecusaOPedidoNoServidor() {
        Seal selo = selo();
        Scheme look = look("Look", piece(ana, "Dunk", "Nike", "black"));
        UUID sugestao = suggestionFor(look, brand);

        selo.setAvailableUntil(Instant.now().minusSeconds(1));

        assertThatThrownBy(() -> inTx(() -> seals.accept(anaSession, sugestao, null)))
                .isInstanceOf(SealService.SealUnavailable.class).satisfies(e -> assertThat(status(e)).isEqualTo(409));
        assertThat(bond(sugestao).getStatus()).isEqualTo(SealBondStatus.REJECTED);
        assertThat(bond(sugestao).getReviewNote()).isNotBlank();
        assertThat(selo.getUsageCount()).isZero();
    }

    @Test
    void encerrarOPrazoDepoisNaoDesfazOVinculoJaConcedido() {
        Seal selo = selo();
        Scheme look = look("Look", piece(ana, "Dunk", "Nike", "black"));
        UUID vinculo = suggestionFor(look, brand);
        seals.accept(anaSession, vinculo, null);
        Instant validade = bond(vinculo).getExpiresAt();

        selo.setAvailableUntil(Instant.now().minusSeconds(1));

        assertThat(bond(vinculo).getStatus()).isEqualTo(SealBondStatus.APPROVED);
        assertThat(bond(vinculo).getExpiresAt()).as("a validade do vínculo não segue o fim da campanha").isEqualTo(validade);
        assertThat(destaque(brand)).containsExactly(look.getId());
    }
}
