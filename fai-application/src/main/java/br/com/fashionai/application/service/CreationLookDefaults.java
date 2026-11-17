package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.PipelineJob;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.SchemeOrigin;

import java.util.Map;

/** Inicialização das entidades novas; edição e registros existentes conservam o tipo escolhido. */
final class CreationLookDefaults {
    private CreationLookDefaults() { }

    static Scheme scheme(User owner, SchemeService.SchemeForm form, LookTypePreferencesService preferences) {
        Scheme scheme = new Scheme();
        scheme.setUser(owner);
        scheme.setCreationMode(form.creationMode() == null ? CreationMode.MANUAL : form.creationMode());
        scheme.setOrigin(form.origin() == null ? SchemeOrigin.CRIAR_LOOK : form.origin());
        scheme.setVisibility(form.visibility() != null ? form.visibility() : AccountService.defaultVisibility(owner));
        if (preferences != null) scheme.setTipoLook(preferences.defaultType(owner.getId()));
        return scheme;
    }

    static WardrobeItem piece(User owner, WardrobeService.PieceForm form, PipelineJob draft,
                              PieceFormWriter writer, LookTypePreferencesService preferences) {
        WardrobeItem piece = new WardrobeItem();
        piece.setUser(owner);
        // A origem da variação vem do rascunho de análise, nunca da declaração do cliente.
        Map<?, ?> aiPrefill = draft != null && Json.map(draft.getResultJson()).get("prefill") instanceof Map<?, ?> prefill
                ? prefill : null;
        writer.apply(piece, form, true, aiPrefill);
        if (preferences != null) {
            var type = preferences.defaultType(owner.getId());
            if (type != null) {
                // O formulário/taxonomia das peças usa UNISSEX; o catálogo TipoLook usa UNISEX.
                piece.setSex("UNISEX".equals(type.getCodigo()) ? "UNISSEX" : type.getCodigo());
            }
        }
        return piece;
    }
}
