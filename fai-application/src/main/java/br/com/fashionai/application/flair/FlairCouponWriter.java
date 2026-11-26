package br.com.fashionai.application.flair;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.seal.PromotionRules;
import br.com.fashionai.application.service.CouponChannelResolver;
import br.com.fashionai.application.service.CouponMinimumRules;
import br.com.fashionai.application.service.CouponTermsSnapshotWriter;
import br.com.fashionai.application.service.FlairService.CombinationForm;
import br.com.fashionai.domain.model.FlairCombination;
import br.com.fashionai.domain.model.FlairRedemption;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.repository.FlairRedemptionRepository;

/**
 * FLAIR — o cupom da combinação: os campos de cupom da oferta (título, desconto, compra mínima, validade, canal, loja)
 * e a emissão do cupom de quem completou o jogo, com as condições da hora copiadas para ele. Extraído do FlairService
 * (exercício 14), que continua dono da transação, da autorização e das regras do jogo.
 */
public final class FlairCouponWriter {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private final FlairRedemptionRepository redemptions;
    private CouponChannelResolver channels;

    public FlairCouponWriter(FlairRedemptionRepository redemptions) {
        this.redemptions = redemptions;
    }

    public void useChannels(CouponChannelResolver channels) {
        this.channels = channels;
    }

    /** Campos de cupom da combinação, vindos do formulário da loja. */
    public void applyOffer(FlairCombination c, CombinationForm f) {
        c.setCouponTitle(InputSanitizer.required("couponTitle", InputSanitizer.moderated("couponTitle", f.couponTitle(), 120), 3, 120));
        if (f.discountPercent() == null && f.discountAmount() == null) {
            throw ApiException.badRequest("DESCONTO_OBRIGATORIO", Msg.t("flair.informe_o_desconto_em_ou"));
        }
        c.setDiscountPercent(f.discountPercent() == null ? null : Math.max(1, Math.min(90, f.discountPercent())));
        c.setDiscountAmount(f.discountAmount());
        CouponMinimumRules.Minimum minimum = CouponMinimumRules.resolve(f.minPurchase(), f.minPurchaseCurrency(), c.getMinPurchase(), c.getMinPurchaseCurrency());
        c.setMinPurchase(minimum.amount());
        c.setMinPurchaseCurrency(minimum.currency());
        c.setValidDays(Math.max(7, Math.min(120, f.validDays() == null ? 30 : f.validDays())));
        c.setCanalCupom(CouponChannelResolver.resolve(channels, f.canalCupomId(), c.getCanalCupom()));
        c.setStoreUrl(PromotionRules.storeUrl(f.storeUrl()));
    }

    /** Emite o cupom: código único, validade a partir de agora e o canal da oferta copiado para o cupom. */
    public FlairRedemption issue(FlairCombination c, User user, Scheme deck, Integer deckPower) {
        FlairRedemption r = new FlairRedemption();
        r.setCombination(c);
        r.setUser(user);
        r.setScheme(deck);
        String code;
        do {
            code = "FLR-" + token(4) + "-" + token(4);
        } while (redemptions.existsByCode(code));
        r.setCode(code);
        r.setStatus("EMITIDO");
        r.setDeckPower(deckPower);
        r.setExpiresAt(Instant.now().plus(c.getValidDays(), ChronoUnit.DAYS));
        CouponTermsSnapshotWriter.issue(r, c);
        redemptions.save(r);
        c.setRedeemed(c.getRedeemed() + 1);
        return r;
    }

    private static String token(int n) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < n; i++) {
            b.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return b.toString();
    }
}
