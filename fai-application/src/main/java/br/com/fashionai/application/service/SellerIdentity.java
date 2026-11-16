package br.com.fashionai.application.service;

import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Identidade pública de quem vende (marca ou celebridade): nome, logo, slug, tipo de perfil e o usuário. Usada pela loja
 * física. Morava no WardrobeCreatorService (criador de guarda-roupas do Meu Quarto, retirado em 15/11/2026).
 */
@Component
public class SellerIdentity {
    private final BrandProfileRepository brands;
    private final CelebrityProfileRepository celebrities;

    public SellerIdentity(BrandProfileRepository brands, CelebrityProfileRepository celebrities) {
        this.brands = brands;
        this.celebrities = celebrities;
    }

    public Map<String, Object> identity(User u) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (u.getProfileType() == ProfileType.CELEBRIDADE) {
            CelebrityProfile c = celebrities.findByOwnerId(u.getId()).orElse(null);
            m.put("name", c == null ? u.getDisplayName() : c.getStageName());
            m.put("logoUrl", c == null ? u.getAvatarUrl() : c.getAvatarUrl() != null ? c.getAvatarUrl() : u.getAvatarUrl());
            m.put("slug", c == null ? null : c.getSlug());
        } else {
            BrandProfile b = brands.findByOwnerId(u.getId()).orElse(null);
            m.put("name", b == null ? u.getDisplayName() : b.getBrandName());
            m.put("logoUrl", b == null ? u.getAvatarUrl() : b.getLogoUrl() != null ? b.getLogoUrl() : u.getAvatarUrl());
            m.put("slug", b == null ? null : b.getSlug());
        }
        m.put("kind", u.getProfileType());
        m.put("user", Views.user(u));
        return m;
    }
}
