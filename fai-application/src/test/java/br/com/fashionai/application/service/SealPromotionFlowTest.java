package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Esquemas promovidos no perfil de marca/celebridade por POLÍTICA ACEITA: selo com política padronizada (RF25/RF50) →
 * sugestão no look (RF20/RF21) → aceite → revisão do emissor quando exigida (celebridade sempre) → emissão →
 * "Esquemas em destaque", "Peças em destaque" e "Looks consagrados" (RF14/RF22); recusa e rejeição.
 */
class SealPromotionFlowTest extends SealPromotionFlowFixture {
    // ------------------------------------------------------------------ marca: política atendida → aceite → emissão → perfil

    @Test
    void marcaComPoliticaAtendidaSugereEAoAceitarPromoveOLookNoPerfil() {
        Seal selo = seal(brand, "Maison Street", SealTier.LOOK, policyOf(rule("brand", "Nike")), null);
        WardrobeItem tenis = piece(ana, "Dunk", "Nike", "black");
        WardrobeItem jeans = piece(ana, "501", "Levi's", "blue");
        Scheme s = look("Clube", tenis, jeans);

        UUID bondId = suggestionFor(s, brand);
        SealBond b = bond(bondId);
        assertThat(b.getStatus()).isEqualTo(SealBondStatus.SUGGESTED);
        assertThat(b.getSeal()).isEqualTo(selo);
        assertThat(b.getJustification()).contains("Maison Street");
        assertThat(destaque(brand)).as("sugestão ainda não promove").isEmpty();

        seals.accept(anaSession, bondId, null);
        assertThat(b.getStatus()).isEqualTo(SealBondStatus.APPROVED);
        assertThat(b.getSealCode()).startsWith("BRD");
        assertThat(b.getIssuedAt()).isNotNull();
        assertThat(b.getExpiresAt()).isAfter(b.getIssuedAt());
        assertThat(selo.getUsageCount()).isEqualTo(1);
        assertThat(Json.strings(s.getSealIdsJson())).contains(bondId.toString());

        assertThat(destaque(brand)).containsExactly(s.getId());
        assertThat(consagrados(brand)).containsExactly(s.getId());
        assertThat(pecasEmDestaque(brand)).containsExactlyInAnyOrder(tenis.getId(), jeans.getId());
        assertThat(destaque(celeb)).isEmpty();
    }

    @Test
    void politicaNaoAtendidaNaoSugereENadaApareceNoPerfil() {
        seal(brand, "Só Gucci", SealTier.LOOK, policyOf(rule("brand", "Gucci")), null);
        Scheme s = look("Sem Gucci", piece(ana, "Dunk", "Nike", "black"));
        assertThat(suggestions(s)).noneMatch(m -> ((Views.UserCard) m.get("target")).id().equals(brand.getId()));
        assertThat(destaque(brand)).isEmpty();
    }

    @Test
    void recusarASugestaoNaoPromove() {
        seal(brand, "Maison Street", SealTier.LOOK, policyOf(rule("brand", "Nike")), null);
        Scheme s = look("Recusado", piece(ana, "Dunk", "Nike", "black"));
        UUID bondId = suggestionFor(s, brand);
        seals.refuse(anaSession, bondId);
        assertThat(bond(bondId).getStatus()).isEqualTo(SealBondStatus.REFUSED);
        assertThat(destaque(brand)).isEmpty();
        assertThat(consagrados(brand)).isEmpty();
    }

    @Test
    void marcaQueExigeRevisaoSoPromoveDepoisDaAprovacao() {
        brandByOwner.get(brand.getId()).setRequiresSealReview(true);
        seal(brand, "Maison Street", SealTier.LOOK, policyOf(rule("brand", "Nike")), null);
        Scheme s = look("Na fila", piece(ana, "Dunk", "Nike", "black"));
        UUID bondId = suggestionFor(s, brand);
        seals.accept(anaSession, bondId, null);
        assertThat(bond(bondId).getStatus()).isEqualTo(SealBondStatus.PENDING_REVIEW);
        assertThat(destaque(brand)).isEmpty();
        seals.review(brandSession, bondId, true, null);
        assertThat(bond(bondId).getStatus()).isEqualTo(SealBondStatus.APPROVED);
        assertThat(destaque(brand)).containsExactly(s.getId());
    }

    // ------------------------------------------------------------------ celebridade: consentimento + revisão sempre

    @Test
    void celebridadeComSeloDePecaExigeConsentimentoERevisaoEDestacaSoAPecaQueAtende() {
        seal(celeb, "Preto Estrela", SealTier.PECA, policyOf(rule("color", "black")), null);
        WardrobeItem preta = piece(ana, "Jaqueta preta", "Zara", "black");
        WardrobeItem azul = piece(ana, "Calça azul", "Zara", "blue");
        Scheme s = look("Noite", preta, azul);

        UUID bondId = suggestionFor(s, celeb);
        SealBond b = bond(bondId);
        assertThat(b.getTier()).isEqualTo(SealTier.PECA);
        assertThat(Json.strings(b.getLinkedPieceIdsJson())).containsExactly(preta.getId().toString());

        assertThatThrownBy(() -> inTx(() -> seals.accept(anaSession, bondId, null))).satisfies(e -> assertThat(status(e)).isEqualTo(400));
        assertThat(b.getStatus()).as("sem consentimento o aceite é desfeito").isEqualTo(SealBondStatus.SUGGESTED);
        seals.accept(anaSession, bondId, true);
        assertThat(b.getStatus()).isEqualTo(SealBondStatus.PENDING_REVIEW);
        assertThat(destaque(celeb)).as("celebridade sempre revisa").isEmpty();

        seals.review(celebSession, bondId, true, null);
        assertThat(b.getStatus()).isEqualTo(SealBondStatus.APPROVED);
        assertThat(b.getSealCode()).startsWith("PRM");
        assertThat(destaque(celeb)).containsExactly(s.getId());
        assertThat(pecasEmDestaque(celeb)).containsExactly(preta.getId());
    }

    @Test
    void celebridadeQueRejeitaNuncaPromove() {
        seal(celeb, "Preto Estrela", SealTier.PECA, policyOf(rule("color", "black")), null);
        Scheme s = look("Rejeitado", piece(ana, "Jaqueta preta", "Zara", "black"));
        UUID bondId = suggestionFor(s, celeb);
        seals.accept(anaSession, bondId, true);
        assertThatThrownBy(() -> inTx(() -> seals.review(celebSession, bondId, false, " "))).satisfies(e -> assertThat(status(e)).isEqualTo(400));
        seals.review(celebSession, bondId, false, "não combina com a era");
        assertThat(bond(bondId).getStatus()).isEqualTo(SealBondStatus.REJECTED);
        assertThat(destaque(celeb)).isEmpty();
        assertThat(consagrados(celeb)).isEmpty();
    }
}
