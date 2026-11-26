package br.com.fashionai.application.aura;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import br.com.fashionai.application.aura.AuraUnlocks.Family;
import br.com.fashionai.application.aura.AuraUnlocks.Item;
import br.com.fashionai.application.aura.AuraUnlocks.Kind;
import br.com.fashionai.application.aura.AuraUnlocks.State;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.Flair3dHype;
import br.com.fashionai.domain.model.enums.HypeLevel;

/**
 * Circuito Aura — de onde vêm os itens de "O que este card destrava" que dependem só do Hype do card: a faixa em que a
 * carta joga no FLAIR e as campanhas de selo Hype dos emissores. Puro: recebe dados já lidos e devolve itens.
 */
public final class AuraUnlockSources {
    /** Onde a carta joga com a faixa de Hype. */
    public static final String FLAIR_HREF = "/flair/3d";
    /** Campanhas "quase lá" listadas em "a seguir": o painel aponta o próximo passo, não o catálogo inteiro. */
    static final int MAX_NEXT_CAMPAIGNS = 4;

    private AuraUnlockSources() {
    }

    /** Nome da faixa no idioma de quem lê. */
    public static String levelName(HypeLevel level) {
        return Msg.t("aura.faixa." + level.name());
    }

    /** Faixa atual da carta no FLAIR (sempre há uma: sem Hype público a carta joga como Sinal baixo) e a próxima. */
    public static List<Item> flairBand(State state) {
        HypeLevel current = state.effectiveLevel() == null ? HypeLevel.LOW_SIGNAL : state.effectiveLevel();
        Flair3dHype.Band band = Flair3dHype.parse(current.name(), Flair3dHype.Band.LOW_SIGNAL);
        List<Item> out = new ArrayList<>();
        String now = levelName(HypeLevel.valueOf(band.name()));
        out.add(new Item(Kind.FLAIR_BAND, Family.HYPE, Msg.t("aura.unlocks.flair_atual", now),
                Msg.t(state.counts() ? "aura.unlocks.flair_atual_detalhe" : "aura.unlocks.flair_sem_hype_detalhe"), FLAIR_HREF, null, true));
        if (band.ordinal() + 1 < Flair3dHype.Band.values().length) {
            HypeLevel next = HypeLevel.values()[band.ordinal() + 1];
            out.add(new Item(Kind.FLAIR_BAND, Family.HYPE, Msg.t("aura.unlocks.flair_proxima", levelName(next)),
                    Msg.t("aura.unlocks.flair_proxima_detalhe"), FLAIR_HREF, next, false));
        }
        return out;
    }

    /**
     * Campanhas de selo Hype avaliadas pelo SealHypeOffersService ({@code offers}: itens da resposta dele). A que o card
     * já atende entra como destravada; das que ainda não atende entram as mais próximas (até a faixa seguinte).
     */
    public static List<Item> sealCampaigns(List<Map<String, Object>> offers, State state) {
        List<Item> out = new ArrayList<>();
        int pending = 0;
        HypeLevel current = state.effectiveLevel();
        for (Map<String, Object> offer : offers) {
            Map<?, ?> seal = offer.get("seal") instanceof Map<?, ?> m ? m : Map.of();
            String name = String.valueOf(seal.get("name"));
            String href = offer.get("issuerProfileUrl") instanceof String s ? s : null;
            HypeLevel required = requiredLevel(seal);
            if (Boolean.TRUE.equals(offer.get("eligible"))) {
                out.add(new Item(Kind.SEAL_CAMPAIGN, Family.HYPE, name, Msg.t("aura.unlocks.selo_atende"), href, required, true));
                continue;
            }
            boolean near = required == null || current == null || required.ordinal() <= current.ordinal() + 1;
            if (near && pending < MAX_NEXT_CAMPAIGNS) {
                pending++;
                out.add(new Item(Kind.SEAL_CAMPAIGN, Family.HYPE, name, Msg.t("aura.unlocks.selo_falta"), href, required, false));
            }
        }
        return out;
    }

    /** Faixa mínima declarada na política da campanha ({@code policy.hype.minLevel}); nula quando a política usa outro critério. */
    static HypeLevel requiredLevel(Map<?, ?> seal) {
        Object hype = seal.get("policy") instanceof Map<?, ?> policy ? policy.get("hype") : null;
        Object min = hype instanceof Map<?, ?> h ? h.get("minLevel") : null;
        if (min == null) {
            return null;
        }
        try {
            return HypeLevel.valueOf(String.valueOf(min));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
