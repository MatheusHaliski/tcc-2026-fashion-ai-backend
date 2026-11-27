package br.com.fashionai.application.scheme;

import br.com.fashionai.application.service.SchemeService;
import br.com.fashionai.application.service.BackgroundStudioService;
import br.com.fashionai.application.service.AccountService;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.DisplayMode;
import br.com.fashionai.domain.model.enums.Mood;
import br.com.fashionai.domain.model.enums.Season;

/**
 * Etapas 1 e 3 do Criar Look (RF5.CA01/CA02/CA07b): a resposta do compositor, com as listas por parte do corpo espelhando
 * o guarda-roupa real (só peças disponíveis), as opções do formulário e as cinco etapas. Puro; a busca das peças e do
 * dono fica no {@link SchemeService#builder}. Extraído do SchemeService.
 */
final class SchemeBuilderView {
    private SchemeBuilderView() {
    }

    static Map<String, Object> of(List<WardrobeItem> eligible, long total, User u) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalPieces", total);
        out.put("eligiblePieces", eligible.size());
        // Etapa 3 (formulário): as peças exibidas são SEMPRE as cadastradas pelo usuário no RF4 (guarda-roupa próprio);
        // as indisponíveis/reprovadas ficam ocultas e o total informa quantas.
        out.put("source", "RF4");
        out.put("hiddenPieces", Math.max(0, total - eligible.size()));
        if (eligible.size() < 2 && eligible.stream().noneMatch(w -> "full_body_piece".equals(w.getCategory()))) {
            out.put("status", "INSUFICIENTE");
            out.put("message", Msg.t("scheme.voce_precisa_de_ao_menos"));
            out.put("action", Map.of("label", Msg.t("common.adicionar_nova_peca"), "href", "/pieces/new"));
        } else {
            out.put("status", "PRONTO");
        }
        Map<String, List<Views.PieceView>> lists = new LinkedHashMap<>();
        for (String cat : Taxonomy.SUBCATEGORIES.keySet()) {
            lists.put(cat, eligible.stream().filter(w -> cat.equals(w.getCategory()))
                    .map(w -> Views.piece(w, null, null)).toList());
        }
        out.put("lists", lists);
        out.put("defaultVisibility", AccountService.defaultVisibility(u));
        out.put("steps", List.of(Msg.t("scheme.n1_modo_de_geracao"), Msg.t("scheme.n2_prompt_da_ia"), Msg.t("scheme.n3_formulario_manual"), Msg.t("scheme.n4_arte_de_background"),
                Msg.t("scheme.n5_preview_slots_e_salvar")));
        out.put("displayModes", DisplayMode.values());
        out.put("moods", Mood.values());
        out.put("seasons", Season.values());
        out.put("anatomies", BackgroundStudioService.ANATOMIES);
        out.put("sealPlacements", BackgroundStudioService.SEAL_PLACEMENT);
        out.put("pieceSealPlacements", BackgroundStudioService.PIECE_SEAL_PLACEMENT);
        return out;
    }
}
