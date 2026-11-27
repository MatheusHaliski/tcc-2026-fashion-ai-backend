package br.com.fashionai.application.seal;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.SealRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Arte dos selos ESCOLHIDOS no criador (ainda sem vínculo aprovado): o card guarda só "BRAND:Nome" ou
 * "CELEBRITY:Nome", e aqui a chave vira o medalhão desenhado pelo emissor no editor de selos. Só emissores aprovados
 * e selos ativos e disponíveis; chave sem emissor ou sem selo fica fora da resposta (o card mostra o nome).
 */
@Service
public class SealArtService {
    public static final int MAX_KEYS = 40;

    private final BrandProfileRepository brands;
    private final CelebrityProfileRepository celebrities;
    private final SealRepository seals;

    public SealArtService(BrandProfileRepository brands, CelebrityProfileRepository celebrities, SealRepository seals) {
        this.brands = brands;
        this.celebrities = celebrities;
        this.seals = seals;
    }

    /** @param tier tier preferido (PECA no card da peça, LOOK no do look); sem selo desse tier vale o mais recente. */
    @Transactional(readOnly = true)
    public Map<String, Object> art(List<String> keys, SealTier tier) {
        Map<String, Object> items = new LinkedHashMap<>();
        for (String key : keys.stream().distinct().limit(MAX_KEYS).toList()) {
            issuer(key).flatMap(owner -> seal(owner, tier)).ifPresent(seal -> items.put(key, badge(seal)));
        }
        return Map.of("items", items);
    }

    private Optional<User> issuer(String key) {
        int cut = key == null ? -1 : key.indexOf(':');
        if (cut <= 0 || cut == key.length() - 1) {
            return Optional.empty();
        }
        String name = key.substring(cut + 1).trim();
        return switch (key.substring(0, cut)) {
            case "BRAND" -> brands.findByBrandNameIgnoreCaseAndApprovalStatus(name, ApprovalStatus.APROVADO).stream()
                    .findFirst().map(profile -> profile.getOwner());
            case "CELEBRITY" -> celebrities.findByStageNameIgnoreCaseAndVerificationStatus(name, ApprovalStatus.APROVADO)
                    .stream().findFirst().map(profile -> profile.getOwner());
            default -> Optional.empty();
        };
    }

    private Optional<Seal> seal(User owner, SealTier tier) {
        Instant now = Instant.now();
        List<Seal> active = seals.findByOwnerIdAndStatusOrderByCreatedAtDesc(owner.getId(), SealStatus.ACTIVE).stream()
                .filter(s -> SealViews.available(s, now)).toList();
        return active.stream().filter(s -> s.getTier() == tier).findFirst().or(() -> active.stream().findFirst());
    }

    private static Map<String, Object> badge(Seal seal) {
        boolean premium = seal.getOwner().getProfileType() == ProfileType.CELEBRIDADE;
        Object design = Json.map(seal.getBackgroundConfigJson()).get("design");
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", seal.getName());
        m.put("owner", seal.getOwner().getUsername());
        m.put("premium", premium);
        m.put("tier", seal.getTier().name());
        m.put("iconUrl", seal.getIconUrl());
        m.put("design", design instanceof Map<?, ?> dm ? dm : SealDesigns.defaultDesign(premium, seal.getTier()));
        return m;
    }
}
