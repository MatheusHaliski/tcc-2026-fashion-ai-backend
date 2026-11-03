package br.com.fashionai.application.flair;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairLooks.Clash;
import br.com.fashionai.application.flair.FlairLooks.Wardrobe;

import java.util.ArrayList;
import java.util.List;

import static br.com.fashionai.application.flair.FlairLooks.NEUTRAL_HYPE;
import static br.com.fashionai.application.flair.FlairLooks.winner;

/**
 * Wardrobe Wars no {@link FlairLooks}: as sete categorias do guarda-roupa, com relevância (Hype v2 público) neutra sem dados.
 */
final class FlairWardrobeRules {
    private FlairWardrobeRules() {
    }

    // ------------------------------------------------------------------ Wardrobe Wars

    public static List<Clash> wardrobeWars(Wardrobe a, Wardrobe b) {
        List<Clash> out = new ArrayList<>();
        // "relevância média (HypeScore)": descreve alcance/momento, não qualidade; sem Hype público = 50 (neutro), com nota
        List<String> neutral = new ArrayList<>();
        if (a.relevance() == null) {
            neutral.add(Msg.t("hypeFlair.sem_hype_publico_neutro", "A"));
        }
        if (b.relevance() == null) {
            neutral.add(Msg.t("hypeFlair.sem_hype_publico_neutro", "B"));
        }
        double ra = a.relevance() == null ? NEUTRAL_HYPE : a.relevance(), rb = b.relevance() == null ? NEUTRAL_HYPE : b.relevance();
        out.add(new Clash(Msg.t("hypeFlair.relevancia_media_hypescore"), "", "", Math.round(ra * 10) / 10.0, Math.round(rb * 10) / 10.0,
                winner(ra, rb), neutral, List.of()));
        out.add(cat(Msg.t("flairLooks.diversidade_estilos"), a.styles(), b.styles()));
        out.add(cat(Msg.t("flairLooks.versatilidade_ocasioes_atendidas"), a.occasions(), b.occasions()));
        out.add(cat(Msg.t("flairLooks.originalidade_combinacoes_por_peca"), a.originality(), b.originality()));
        out.add(cat(Msg.t("flairLooks.collection_quantidade_raridade"), a.collection(), b.collection()));
        out.add(cat(Msg.t("flairLooks.sustainability_reutilizacao"), a.sustainability(), b.sustainability()));
        out.add(cat(Msg.t("flairLooks.community_engajamento"), a.community(), b.community()));
        return out;
    }

    static Clash cat(String label, double a, double b) {
        return new Clash(label, "", "", Math.round(a * 10) / 10.0, Math.round(b * 10) / 10.0, winner(a, b), List.of(), List.of());
    }
}
