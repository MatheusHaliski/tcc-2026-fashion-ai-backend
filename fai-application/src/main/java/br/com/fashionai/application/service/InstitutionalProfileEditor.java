package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;

import java.util.Map;

/**
 * Edição dos dados institucionais pelo próprio dono (RF1.CA08 marca · RF22 celebridade), extraída do
 * {@link InstitutionalService}, que continua dono da transação e da resposta (o card público). O perfil editado é sempre
 * o da sessão: nenhum campo do corpo escolhe outro perfil, e quem não tem o perfil recebe 403. Campo omitido fica como
 * está. As escolhas de opção ficam nos writers: categoria principal da marca e área artística principal.
 */
final class InstitutionalProfileEditor {
    private final BrandProfileRepository brands;
    private final CelebrityProfileRepository celebrities;
    private final Guard guard;
    private final BrandCategoryWriter brandCategory;
    private final CelebrityAreaWriter celebrityArea;

    InstitutionalProfileEditor(BrandProfileRepository brands, CelebrityProfileRepository celebrities, Guard guard,
                               BrandCategoryWriter brandCategory, CelebrityAreaWriter celebrityArea) {
        this.brands = brands;
        this.celebrities = celebrities;
        this.guard = guard;
        this.brandCategory = brandCategory;
        this.celebrityArea = celebrityArea;
    }

    /** RF1.CA08 — administrador da marca edita bio, site, logo, capa, categoria em texto e categoria principal. */
    BrandProfile updateBrand(CurrentUser user, Map<String, String> fields) {
        BrandProfile b = brands.findByOwnerId(user.id())
                .orElseThrow(() -> guard.deny(user, "brand-profile", Msg.t("institutional.apenas_o_perfil_da_marca")));
        if (fields.containsKey("bio")) {
            b.setBio(InputSanitizer.clean(fields.get("bio"), 500));
        }
        if (fields.containsKey("storeUrl")) {
            String url = fields.get("storeUrl");
            if (url != null && !url.isBlank() && !url.matches("^https://.+")) {
                throw ApiException.badRequest("URL_INVALIDA", Msg.t("institutional.o_link_da_loja_precisa"));
            }
            b.setStoreUrl(url);
        }
        if (fields.containsKey("logoUrl")) {
            b.setLogoUrl(fields.get("logoUrl"));
        }
        if (fields.containsKey("coverUrl")) {
            b.setCoverUrl(fields.get("coverUrl"));
        }
        if (fields.containsKey("fashionCategory")) {
            b.setFashionCategory(InputSanitizer.clean(fields.get("fashionCategory"), 60));
        }
        brandCategory.apply(b, fields);
        brands.save(b);
        return b;
    }

    CelebrityProfile updateCelebrity(CurrentUser user, Map<String, Object> fields) {
        CelebrityProfile c = celebrities.findByOwnerId(user.id())
                .orElseThrow(() -> guard.deny(user, "celebrity-profile", Msg.t("institutional.apenas_o_perfil_da_celebridade")));
        if (fields.containsKey("bio")) {
            c.setBio(InputSanitizer.clean(String.valueOf(fields.get("bio")), 500));
        }
        if (fields.containsKey("coverUrl")) {
            c.setCoverUrl(String.valueOf(fields.get("coverUrl")));
        }
        if (fields.get("styleSignature") instanceof Map<?, ?> sig) {
            c.setStyleSignatureJson(Json.write(sig));
        }
        if (fields.containsKey("sealConsentGranted")) {
            c.setSealConsentGranted(Boolean.TRUE.equals(fields.get("sealConsentGranted")));
        }
        celebrityArea.apply(c, fields);
        celebrities.save(c);
        return c;
    }
}
