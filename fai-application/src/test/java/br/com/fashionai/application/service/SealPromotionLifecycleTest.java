package br.com.fashionai.application.service;

import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.model.enums.Visibility;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Caminho de volta da promoção por política: teto de emissões, revogação, revalidação após edição, look tornado privado e vínculo duplicado. */
class SealPromotionLifecycleTest extends SealPromotionFlowFixture {
    // ------------------------------------------------------------------ teto de emissões, revogação, revalidação, privacidade

    @Test
    void tetoDeEmissoesPromoveSoOPrimeiroAceite() {
        Seal selo = seal(brand, "Edição limitada", SealTier.LOOK, policyOf(rule("brand", "Nike")), 1);
        Scheme a = look("Primeiro", piece(ana, "Dunk", "Nike", "black"));
        Scheme b = look("Segundo", piece(ana, "Air Max", "Nike", "white"));
        UUID first = suggestionFor(a, brand);
        UUID second = suggestionFor(b, brand);
        seals.accept(anaSession, first, null);
        assertThatThrownBy(() -> inTx(() -> seals.accept(anaSession, second, null)))
                .isInstanceOf(SealService.SealUnavailable.class).satisfies(e -> assertThat(status(e)).isEqualTo(409));
        assertThat(bond(second).getStatus()).as("a recusa por teto fica registrada (noRollbackFor)").isEqualTo(SealBondStatus.REJECTED);
        assertThat(bond(second).getReviewNote()).isNotBlank();
        assertThat(selo.getUsageCount()).isEqualTo(1);
        assertThat(destaque(brand)).containsExactly(a.getId());
    }

    @Test
    void revogacaoPeloEmissorTiraOLookDoPerfil() {
        seal(brand, "Maison Street", SealTier.LOOK, policyOf(rule("brand", "Nike")), null);
        Scheme s = look("Revogado", piece(ana, "Dunk", "Nike", "black"));
        UUID bondId = suggestionFor(s, brand);
        seals.accept(anaSession, bondId, null);
        assertThat(destaque(brand)).containsExactly(s.getId());
        seals.revoke(brandSession, bondId, "uso indevido");
        assertThat(bond(bondId).getStatus()).isEqualTo(SealBondStatus.REVOKED);
        assertThat(destaque(brand)).isEmpty();
        assertThat(consagrados(brand)).isEmpty();
    }

    @Test
    void editarAsPecasPedeRevalidacaoQueTiraDoDestaqueAteOEmissorRevalidar() {
        seal(brand, "Maison Street", SealTier.LOOK, policyOf(rule("brand", "Nike")), null);
        Scheme s = look("Editado", piece(ana, "Dunk", "Nike", "black"));
        UUID bondId = suggestionFor(s, brand);
        seals.accept(anaSession, bondId, null);

        seals.flagRevalidation(s);
        assertThat(s.isRevalidationPending()).isTrue();
        assertThat(destaque(brand)).isEmpty();
        List<Map<String, Object>> hall = profiles.consecrated(visitor, brand, null, null, false);
        assertThat(hall).hasSize(1);
        assertThat(hall.get(0).get("promotion")).asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP).containsEntry("revalidationPending", true);

        seals.review(brandSession, bondId, true, null);
        assertThat(s.isRevalidationPending()).isFalse();
        assertThat(destaque(brand)).containsExactly(s.getId());
    }

    @Test
    void lookTornadoPrivadoRevogaOSeloESomeDoPerfil() {
        seal(brand, "Maison Street", SealTier.LOOK, policyOf(rule("brand", "Nike")), null);
        Scheme s = look("Privado depois", piece(ana, "Dunk", "Nike", "black"));
        UUID bondId = suggestionFor(s, brand);
        seals.accept(anaSession, bondId, null);
        s.setVisibility(Visibility.PRIVATE);
        assertThat(destaque(brand)).as("a visibilidade já esconde antes da revogação").isEmpty();
        seals.revokeForScheme(s.getId(), "look privado");
        assertThat(bond(bondId).getStatus()).isEqualTo(SealBondStatus.REVOKED);
        s.setVisibility(Visibility.PUBLIC);
        assertThat(destaque(brand)).as("voltar a público não devolve o selo revogado").isEmpty();
    }

    @Test
    void mesmoLookNaoGanhaDoisVinculosDoMesmoEmissor() {
        seal(brand, "Maison Street", SealTier.LOOK, policyOf(rule("brand", "Nike")), null);
        Scheme s = look("Único", piece(ana, "Dunk", "Nike", "black"));
        seals.accept(anaSession, suggestionFor(s, brand), null);
        assertThat(suggestions(s)).noneMatch(m -> ((Views.UserCard) m.get("target")).id().equals(brand.getId()));
        assertThatThrownBy(() -> inTx(() -> seals.linkManually(anaSession, s.getId(), brand.getId(), null))).satisfies(e -> assertThat(status(e)).isEqualTo(409));
        assertThat(destaque(brand)).containsExactly(s.getId());
    }
}
