package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.RoomCatalogItem;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.RoomCatalogItemRepository;
import br.com.fashionai.domain.repository.RoomInventoryItemRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.SealRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.text.Normalizer;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Loja do guarda-roupa e "Criar guarda-roupa 3D" (card Trello RF39). A loja vende todos os blocos do móvel FAI Origem
 * em cada material e cor (catálogo de fábrica gerado aqui), e marcas/celebridades criam componentes ou um guarda-roupa
 * inteiro com logo, nome e arte da marca, com selo de identidade e condições: preço em FAI Points, nível mínimo,
 * estoque, limite por pessoa, janela de disponibilidade e exigência de selo da marca/celebridade. FAI Points não são
 * vendidos por dinheiro real (RF35.CA08): a compra é sempre com pontos ganhos usando o app.
 */
@Service
public class WardrobeCreatorService {
    public record Material(String code, String label, double roughness, double metalness, double priceFactor, String minLevel, List<String> colors) {
    }

    public record Block(String slotType, String moldId, int widthCm, String label, int basePrice, String minLevel, List<String> materials) {
    }

    public static final Map<String, String> COLORS = new LinkedHashMap<>();
    public static final Map<String, Material> MATERIALS = new LinkedHashMap<>();
    public static final List<Block> BLOCKS = List.of(
            new Block("DOOR", "PRT-AB60", 60, "Porta 60 cm", 120, "ESTREIA", List.of("FOSCO", "LACA", "MADEIRA", "MARMORE", "GRANITO", "VIDRO", "ESPELHO", "METAL", "OURO", "PRATA", "BRONZE", "COBRE", "ACO", "COURO", "CONCRETO", "RATTAN")),
            new Block("DOOR", "PRT-AB90", 90, "Porta 90 cm (Loft)", 170, "LOFT", List.of("FOSCO", "LACA", "MADEIRA", "MARMORE", "GRANITO", "VIDRO", "ESPELHO", "OURO", "PRATA", "BRONZE")),
            new Block("DRAWER", "GAV-STD", 30, "Frente de gaveta", 60, "ESTREIA", List.of("FOSCO", "LACA", "MADEIRA", "COURO", "LINHO", "RATTAN", "VIDRO", "ACO")),
            new Block("HANDLE", "PUX-CAV", 0, "Puxador cava", 50, "STUDIO", List.of("METAL", "FOSCO", "OURO", "PRATA", "BRONZE", "COBRE")),
            new Block("HANDLE", "PUX-BAR", 0, "Puxador barra", 70, "STUDIO", List.of("METAL", "ACRILICO", "OURO", "PRATA", "BRONZE", "COBRE", "ACO")),
            new Block("HANDLE", "PUX-CRO", 0, "Puxador de couro", 80, "STUDIO", List.of("COURO")),
            new Block("TOP", "MAL-STD", 240, "Maleiro", 90, "ESTREIA", List.of("FOSCO", "LACA", "MADEIRA", "CONCRETO", "RATTAN")),
            new Block("BASE", "BAS-STD", 240, "Base / rodapé", 80, "ESTREIA", List.of("FOSCO", "MADEIRA", "METAL", "MARMORE", "GRANITO", "CONCRETO", "OURO", "BRONZE")),
            new Block("HANGER", "CAB-STD", 0, "Cabides", 40, "ESTREIA", List.of("MADEIRA", "VELUDO", "METAL", "ACRILICO", "OURO", "PRATA")),
            new Block("LOGO", "LOG-PLC", 0, "Placa de logo / monograma", 70, "STUDIO", List.of("METAL", "ACRILICO", "MADEIRA", "OURO", "PRATA", "BRONZE", "COBRE", "VIDRO")),
            new Block("LIGHT", "LUZ-LED", 0, "Iluminação LED", 110, "STUDIO", List.of("LED")),
            new Block("RUG", "TAP-RND", 0, "Tapete redondo", 60, "ESTREIA", List.of("LA", "LINHO", "RATTAN")),
            new Block("SHOE_RACK", "SAP-MOD90", 90, "Sapateira", 240, "CLOSET", List.of("FOSCO", "MADEIRA", "METAL", "ACO", "RATTAN")),
            new Block("BAG_DISPLAY", "VIT-BOL", 60, "Vitrine de bolsas", 300, "CLOSET", List.of("VIDRO", "ESPELHO", "MADEIRA", "OURO")),
            new Block("JEWELRY", "JOI-POR", 30, "Porta-joias", 260, "CLOSET", List.of("VELUDO", "COURO", "MADEIRA", "OURO", "PRATA", "VIDRO")),
            new Block("ISLAND", "ILH-BAN", 120, "Ilha central", 600, "ATELIER", List.of("MARMORE", "GRANITO", "MADEIRA", "LACA", "VIDRO", "CONCRETO")));
    public static final List<String> LEVELS = List.of("ESTREIA", "STUDIO", "LOFT", "CLOSET", "ATELIER", "PENTHOUSE", "MAISON");

    static {
        String[][] c = {{"Branco", "#F4F2EF"}, {"Off-white", "#EDE6DA"}, {"Areia", "#D8C8B0"}, {"Grafite", "#3A3A3A"}, {"Preto", "#151515"},
                {"Navy", "#1B2A4A"}, {"Verde-oliva", "#6B7045"}, {"Terracota", "#C4674A"}, {"Rosa-blush", "#E8C4C4"}, {"Bordô", "#6D1F2E"},
                {"Carvalho", "#B98E5E"}, {"Nogueira", "#6B4A2F"}, {"Freijó", "#A67C52"}, {"Dourado", "#C9A227"}, {"Prata", "#C0C0C0"},
                {"Bronze", "#8C6239"}, {"Carrara", "#EDEAE4"}, {"Nero Marquina", "#1E1E1E"}, {"Rosa Portugal", "#E3C8BE"}, {"Transparente", "#DDE6EA"},
                {"Fumê", "#6E7479"}, {"Caramelo", "#A0652B"}, {"Cognac", "#8A4B24"}, {"Esmeralda", "#1F5E4B"}, {"Vinho", "#5C1A2B"},
                {"Azul-noite", "#1C2440"}, {"Quente 2700 K", "#FFD9A0"}, {"Neutra 4000 K", "#FFF1D6"}, {"Fria 6000 K", "#E6F0FF"},
                {"Ouro amarelo", "#D4AF37"}, {"Ouro rosé", "#B76E79"}, {"Ouro branco", "#E8E4D8"}, {"Prata polida", "#D9D9D9"}, {"Prata envelhecida", "#9FA3A7"},
                {"Bronze antigo", "#7A5230"}, {"Bronze escovado", "#A97142"}, {"Cobre", "#B87333"}, {"Cobre oxidado", "#6F9E8C"},
                {"São Gabriel", "#1F1F1F"}, {"Branco Itaúnas", "#E6E1D6"}, {"Verde Ubatuba", "#26352C"}, {"Vermelho Brasília", "#7B3B32"},
                {"Espelho prata", "#DDE3E8"}, {"Espelho bronze", "#B08D6E"}, {"Concreto claro", "#B8B4AC"}, {"Concreto escuro", "#6E6A63"},
                {"Rattan natural", "#C9A66B"}, {"Rattan escuro", "#7D5A36"}, {"Aço escovado", "#A8ACAF"}, {"Aço grafite", "#4A4D50"},
                {"Vidro verde", "#9FC7B5"}, {"Vidro âmbar", "#D9A35B"}, {"Holográfico lilás", "#C4A5D6"}};
        for (String[] x : c) {
            COLORS.put(x[0], x[1]);
        }
        List<String> base = List.of("Branco", "Off-white", "Areia", "Grafite", "Preto", "Navy", "Verde-oliva", "Terracota", "Rosa-blush", "Bordô");
        material("FOSCO", "Fosco", 0.8, 0.02, 1.0, "ESTREIA", base);
        material("LACA", "Laca", 0.25, 0.05, 1.4, "STUDIO", base);
        material("MADEIRA", "Madeira", 0.6, 0, 1.5, "STUDIO", List.of("Carvalho", "Nogueira", "Freijó"));
        material("MARMORE", "Mármore", 0.2, 0, 2.2, "LOFT", List.of("Carrara", "Nero Marquina", "Rosa Portugal"));
        material("VIDRO", "Vidro", 0.05, 0, 1.8, "LOFT", List.of("Transparente", "Fumê", "Vidro verde", "Vidro âmbar"));
        material("METAL", "Metal", 0.3, 0.85, 1.3, "STUDIO", List.of("Dourado", "Prata", "Bronze", "Preto"));
        material("COURO", "Couro", 0.55, 0, 1.9, "CLOSET", List.of("Caramelo", "Cognac", "Preto"));
        material("VELUDO", "Veludo", 0.95, 0, 1.7, "CLOSET", List.of("Esmeralda", "Vinho", "Azul-noite"));
        material("LINHO", "Linho", 0.9, 0, 1.2, "STUDIO", List.of("Off-white", "Areia", "Terracota", "Verde-oliva"));
        material("ACRILICO", "Acrílico", 0.15, 0, 1.1, "STUDIO", List.of("Transparente", "Fumê", "Rosa-blush"));
        material("LA", "Lã", 1.0, 0, 1.0, "ESTREIA", List.of("Off-white", "Areia", "Terracota", "Verde-oliva", "Grafite"));
        material("LED", "LED", 0.5, 0, 1.0, "STUDIO", List.of("Quente 2700 K", "Neutra 4000 K", "Fria 6000 K"));
        material("GRANITO", "Granito", 0.25, 0, 2.0, "LOFT", List.of("São Gabriel", "Branco Itaúnas", "Verde Ubatuba", "Vermelho Brasília"));
        material("OURO", "Ouro", 0.22, 1.0, 3.0, "PENTHOUSE", List.of("Ouro amarelo", "Ouro rosé", "Ouro branco"));
        material("PRATA", "Prata", 0.2, 1.0, 2.4, "CLOSET", List.of("Prata polida", "Prata envelhecida"));
        material("BRONZE", "Bronze", 0.35, 0.95, 2.0, "CLOSET", List.of("Bronze antigo", "Bronze escovado"));
        material("COBRE", "Cobre", 0.3, 0.95, 1.9, "CLOSET", List.of("Cobre", "Cobre oxidado"));
        material("ESPELHO", "Espelho", 0.02, 1.0, 2.1, "LOFT", List.of("Espelho prata", "Espelho bronze"));
        material("CONCRETO", "Concreto", 0.95, 0, 1.3, "STUDIO", List.of("Concreto claro", "Concreto escuro"));
        material("RATTAN", "Rattan", 0.85, 0, 1.4, "STUDIO", List.of("Rattan natural", "Rattan escuro"));
        material("ACO", "Aço escovado", 0.4, 0.9, 1.6, "LOFT", List.of("Aço escovado", "Aço grafite"));
        // exclusivo da edição limitada de fábrica (não aparece no criador de marcas)
        material("HOLOGRAFICO", "Holográfico", 0.1, 0.6, 3.0, "PENTHOUSE", List.of("Holográfico lilás"));
    }

    static void material(String code, String label, double r, double m, double f, String lvl, List<String> colors) {
        MATERIALS.put(code, new Material(code, label, r, m, f, lvl, colors));
    }

    private static final SecureRandom RANDOM = new SecureRandom();

    private final RoomCatalogItemRepository catalog;
    private final RoomInventoryItemRepository inventory;
    private final UserRepository users;
    private final BrandProfileRepository brands;
    private final CelebrityProfileRepository celebrities;
    private final SealRepository seals;
    private final SealBondRepository bonds;
    private final MediaService media;
    private final Guard guard;

    public WardrobeCreatorService(RoomCatalogItemRepository catalog, RoomInventoryItemRepository inventory, UserRepository users,
                                  BrandProfileRepository brands, CelebrityProfileRepository celebrities, SealRepository seals,
                                  SealBondRepository bonds, MediaService media, Guard guard) {
        this.catalog = catalog;
        this.inventory = inventory;
        this.users = users;
        this.brands = brands;
        this.celebrities = celebrities;
        this.seals = seals;
        this.bonds = bonds;
        this.media = media;
        this.guard = guard;
    }

    static String higher(String a, String b) {
        return LEVELS.indexOf(a) >= LEVELS.indexOf(b) ? a : b;
    }

    static String slug(String s) {
        String n = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return n.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    }

    /** Acabamento (finish) salvo no módulo do quarto quando o item é aplicado. */
    static Map<String, Object> finish(String material, String colorName, String hex, String logoUrl, String artUrl, String label, UUID sealId, String creator) {
        Material m = MATERIALS.getOrDefault(material, MATERIALS.get("FOSCO"));
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("color", hex);
        f.put("colorName", colorName);
        f.put("texture", m.label().toLowerCase(Locale.ROOT));
        f.put("material", m.code());
        f.put("roughness", m.roughness());
        f.put("metalness", m.metalness());
        if ("LED".equals(m.code())) {
            f.put("kelvin", colorName != null && colorName.startsWith("Quente") ? 2700 : colorName != null && colorName.startsWith("Fria") ? 6000 : 4000);
            f.put("guided", true);
        }
        if (logoUrl != null) {
            f.put("logoUrl", logoUrl);
        }
        if (artUrl != null) {
            f.put("artUrl", artUrl);
        }
        if (label != null) {
            f.put("labelText", label);
        }
        if (sealId != null) {
            f.put("sealId", sealId.toString());
        }
        if (creator != null) {
            f.put("creator", creator);
        }
        return f;
    }

    // ================================================================== catálogo de fábrica (todos os blocos × material × cor)

    @EventListener(ContextRefreshedEvent.class)
    public void onStart(ContextRefreshedEvent ev) {
        if (ev.getApplicationContext().getParent() == null) {
            ev.getApplicationContext().getBean(WardrobeCreatorService.class).seedFactory();
        }
    }

    @Transactional
    public int seedFactory() {
        int created = 0;
        for (Block b : BLOCKS) {
            for (String mat : b.materials()) {
                Material m = MATERIALS.get(mat);
                for (String color : m.colors()) {
                    String sku = ("FAI-" + b.moldId() + "-" + mat.substring(0, Math.min(3, mat.length())) + "-" + slug(color));
                    sku = sku.length() > 40 ? sku.substring(0, 40) : sku;
                    if (catalog.existsById(sku)) {
                        continue;
                    }
                    RoomCatalogItem c = new RoomCatalogItem();
                    c.setSku(sku);
                    c.setName(b.label() + " — " + m.label() + " " + color);
                    c.setMoldId(b.moldId());
                    c.setSlotType(b.slotType());
                    c.setWidthCm(b.widthCm());
                    c.setFinishJson(Json.write(finish(mat, color, COLORS.get(color), null, null, null, null, null)));
                    c.setRarity(m.priceFactor() >= 1.8 ? "SIGNATURE" : m.priceFactor() >= 1.3 ? "PREMIUM" : "BASICO");
                    c.setPricePoints((int) Math.round(b.basePrice() * m.priceFactor() / 10.0) * 10);
                    c.setRequiredLevel(higher(b.minLevel(), m.minLevel()));
                    c.setKind("COMPONENT");
                    c.setMaterial(mat);
                    c.setColorName(color);
                    c.setActive(true);
                    c.setCreatedAt(Instant.now());
                    catalog.save(c);
                    created++;
                }
            }
        }
        for (RoomCatalogItem c : catalog.findAll()) {           // itens de fábrica anteriores ao V20: material e cor nomeados
            if (c.getCreatorUserId() != null || c.getColorName() != null || "WARDROBE".equals(c.getKind())) {
                continue;
            }
            Map<String, Object> f = Json.map(c.getFinishJson());
            String hex = String.valueOf(f.getOrDefault("color", "#CCCCCC"));
            String mat = c.getMaterial() == null ? ("LIGHT".equals(c.getSlotType()) ? "LED" : "FOSCO")
                    : c.getMaterial().replace("Ã", "A").replace("É", "E").replace("Í", "I");
            if (!MATERIALS.containsKey(mat)) {
                mat = "FOSCO";
            }
            String color = COLORS.entrySet().stream().filter(e -> e.getValue().equalsIgnoreCase(hex)).map(Map.Entry::getKey)
                    .filter(MATERIALS.get(mat).colors()::contains).findFirst()
                    .orElse(COLORS.entrySet().stream().filter(e -> e.getValue().equalsIgnoreCase(hex)).map(Map.Entry::getKey).findFirst().orElse(hex));
            c.setMaterial(mat);
            c.setColorName(color);
            c.setFinishJson(Json.write(finish(mat, color, hex, null, null, null, null, null)));
            catalog.save(c);
        }
        return created;
    }

    // ================================================================== "Criar guarda-roupa 3D" (marca / celebridade)

    User creator(CurrentUser user) {
        guard.requireCanCreate(user);
        User u = users.findById(user.id()).orElseThrow();
        if (u.getProfileType() != ProfileType.MARCA && u.getProfileType() != ProfileType.CELEBRIDADE) {
            throw guard.deny(user, "room-creator", "Só marcas e celebridades criam componentes e guarda-roupas para a loja.");
        }
        return u;
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

    @Transactional(readOnly = true)
    public Map<String, Object> options(CurrentUser user) {
        User u = creator(user);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("blocks", BLOCKS);
        out.put("materials", MATERIALS.values());
        out.put("colors", COLORS);
        out.put("levels", LEVELS);
        out.put("identity", identity(u));
        out.put("seals", seals.findByOwnerIdAndStatusOrderByCreatedAtDesc(u.getId(), SealStatus.ACTIVE).stream()
                .map(s -> Map.of("id", s.getId(), "name", s.getName(), "availableFrom", String.valueOf(s.getAvailableFrom()), "availableUntil", String.valueOf(s.getAvailableUntil()))).toList());
        out.put("currency", "FAI Points (não são vendidos por dinheiro real — RF35.CA08)");
        return out;
    }

    public record BundlePart(String slotType, String moldId, String material, String colorName, String color) {
    }

    public record ItemForm(String kind, String name, String description, String slotType, String moldId, String material, String colorName, String color,
                           String logoUrl, String artUrl, String labelText, UUID sealId, Integer pricePoints, String requiredLevel, Integer stock,
                           Integer perUserLimit, Instant availableFrom, Instant availableUntil, Boolean requiresSeal, Boolean active, List<BundlePart> bundle) {
    }

    @Transactional
    public Map<String, Object> save(CurrentUser user, String sku, ItemForm f) {
        User u = creator(user);
        RoomCatalogItem c;
        if (sku == null) {
            c = new RoomCatalogItem();
            String id;
            do {
                id = "BRD-" + slug(String.valueOf(identity(u).get("name"))).substring(0, Math.min(8, slug(String.valueOf(identity(u).get("name"))).length())) + "-" + token(6);
            } while (catalog.existsById(id));
            c.setSku(id);
            c.setCreatorUserId(u.getId());
            c.setCreatedAt(Instant.now());
        } else {
            c = catalog.findById(sku).orElseThrow(() -> ApiException.notFound("Item"));
            if (!u.getId().equals(c.getCreatorUserId())) {
                throw guard.deny(user, "room-creator:" + sku, "Item de outra marca.");
            }
        }
        String kind = "WARDROBE".equalsIgnoreCase(f.kind()) ? "WARDROBE" : "COMPONENT";
        c.setKind(kind);
        c.setName(InputSanitizer.required("name", InputSanitizer.moderated("name", f.name(), 120), 3, 120));
        c.setDescription(f.description() == null ? null : InputSanitizer.clean(f.description(), 400));
        c.setLabelText(f.labelText() == null || f.labelText().isBlank() ? null : InputSanitizer.moderated("labelText", f.labelText(), 60));
        c.setLogoUrl(url(f.logoUrl()));
        c.setArtUrl(url(f.artUrl()));
        UUID sealId = null;
        if (f.sealId() != null) {
            Seal s = seals.findById(f.sealId()).orElseThrow(() -> ApiException.notFound("Selo"));
            if (!s.getOwner().getId().equals(u.getId())) {
                throw guard.deny(user, "seal:" + f.sealId(), "Selo de outro perfil.");
            }
            sealId = s.getId();
        }
        c.setSealId(sealId);
        String creatorName = String.valueOf(identity(u).get("name"));
        String logo = c.getLogoUrl() != null ? c.getLogoUrl() : (String) identity(u).get("logoUrl");
        if ("COMPONENT".equals(kind)) {
            Block b = block(f.slotType(), f.moldId());
            Material m = material(b, f.material());
            String hex = hex(f.color(), f.colorName(), m);
            c.setSlotType(b.slotType());
            c.setMoldId(b.moldId());
            c.setWidthCm(b.widthCm());
            c.setMaterial(m.code());
            c.setColorName(f.colorName() == null || f.colorName().isBlank() ? hex : InputSanitizer.clean(f.colorName(), 40));
            c.setFinishJson(Json.write(finish(m.code(), c.getColorName(), hex, logo, c.getArtUrl(), c.getLabelText(), sealId, creatorName)));
            c.setBundleJson(null);
            c.setRequiredLevel(higher(level(f.requiredLevel()), higher(b.minLevel(), m.minLevel())));
        } else {
            if (f.bundle() == null || f.bundle().isEmpty()) {
                throw ApiException.badRequest("SEM_BLOCOS", "Monte o guarda-roupa com ao menos um bloco (porta, gaveta, puxador…).");
            }
            List<Map<String, Object>> parts = new ArrayList<>();
            String lvl = level(f.requiredLevel());
            Set<String> seen = new java.util.HashSet<>();
            for (BundlePart p : f.bundle()) {
                Block b = block(p.slotType(), p.moldId());
                if (!seen.add(b.slotType())) {
                    continue;                                          // um acabamento por tipo de bloco
                }
                Material m = material(b, p.material());
                String hex = hex(p.color(), p.colorName(), m);
                String cn = p.colorName() == null || p.colorName().isBlank() ? hex : InputSanitizer.clean(p.colorName(), 40);
                parts.add(Map.of("slotType", b.slotType(), "moldId", b.moldId(), "material", m.code(), "colorName", cn,
                        "finish", finish(m.code(), cn, hex, "LOGO".equals(b.slotType()) || "DOOR".equals(b.slotType()) ? logo : null,
                                "DOOR".equals(b.slotType()) ? c.getArtUrl() : null, c.getLabelText(), sealId, creatorName)));
                lvl = higher(lvl, higher(b.minLevel(), m.minLevel()));
            }
            c.setSlotType("WARDROBE");
            c.setMoldId("FAI-ORIGEM");
            c.setWidthCm(240);
            c.setMaterial(String.valueOf(parts.get(0).get("material")));
            c.setColorName(String.valueOf(parts.get(0).get("colorName")));
            c.setBundleJson(Json.write(parts));
            c.setFinishJson(Json.write(((Map<?, ?>) parts.get(0).get("finish"))));
            c.setRequiredLevel(lvl);
        }
        c.setRarity(u.getProfileType() == ProfileType.CELEBRIDADE ? "CELEBRIDADE" : "MARCA");
        int price = f.pricePoints() == null ? 200 : f.pricePoints();
        if (price < 0 || price > 20000) {
            throw ApiException.badRequest("PRECO_INVALIDO", "Preço entre 0 e 20.000 FAI Points.");
        }
        c.setPricePoints(price);
        c.setStockLimit(f.stock() == null ? null : Math.max(1, f.stock()));
        c.setPerUserLimit(f.perUserLimit() == null ? null : Math.max(1, f.perUserLimit()));
        if (f.availableFrom() != null && f.availableUntil() != null && f.availableUntil().isBefore(f.availableFrom())) {
            throw ApiException.badRequest("PERIODO_INVALIDO", "A disponibilidade termina antes de começar.");
        }
        c.setAvailableFrom(f.availableFrom());
        c.setAvailableUntil(f.availableUntil());
        c.setRequiresSeal(Boolean.TRUE.equals(f.requiresSeal()));
        c.setActive(f.active() == null || f.active());
        c.setMaisonBrandUserId(u.getId());
        catalog.save(c);
        return view(c, null);
    }

    @Transactional
    public void delete(CurrentUser user, String sku) {
        User u = creator(user);
        RoomCatalogItem c = catalog.findById(sku).orElseThrow(() -> ApiException.notFound("Item"));
        if (!u.getId().equals(c.getCreatorUserId())) {
            throw guard.deny(user, "room-creator:" + sku, "Item de outra marca.");
        }
        if (c.getSoldCount() > 0 || !inventory.findBySku(sku).isEmpty()) {
            c.setActive(false);                              // quem comprou continua com o item no quarto
        } else {
            catalog.delete(c);
        }
    }

    @Transactional(readOnly = true)
    public Map<String, Object> mine(CurrentUser user) {
        User u = creator(user);
        List<Map<String, Object>> items = catalog.findByCreatorUserIdOrderByCreatedAtDesc(u.getId()).stream().map(c -> view(c, null)).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("identity", identity(u));
        out.put("items", items);
        out.put("stats", Map.of("items", items.size(), "sold", items.stream().mapToInt(i -> ((Number) i.get("sold")).intValue()).sum(),
                "points", items.stream().mapToLong(i -> ((Number) i.get("sold")).longValue() * ((Number) i.get("pricePoints")).longValue()).sum()));
        return out;
    }

    @Transactional
    public Map<String, Object> uploadArt(CurrentUser user, byte[] bytes, String kind) {
        User u = creator(user);
        ImageOps.requireAcceptedImage(bytes);
        java.awt.image.BufferedImage img = ImageOps.scaleToFit(ImageOps.decode(bytes), 1600, 1600);
        byte[] out = "logo".equalsIgnoreCase(kind) ? ImageOps.png(img) : ImageOps.jpeg(img, 0.9f);
        String ext = "logo".equalsIgnoreCase(kind) ? "png" : "jpg";
        String url = media.put("users/" + u.getId() + "/room-creator/" + kind + "-" + System.currentTimeMillis() + "." + ext, out, "logo".equalsIgnoreCase(kind) ? "image/png" : "image/jpeg").url();
        return Map.of("url", url, "kind", kind);
    }

    // ================================================================== visão na loja e condições de compra

    /** Estado de disponibilidade: DISPONIVEL, EM_BREVE, EXPIRADO, ESGOTADO ou INATIVO. */
    public static String availability(RoomCatalogItem c, Instant now) {
        if (!c.isActive()) {
            return "INATIVO";
        }
        if (c.getAvailableFrom() != null && now.isBefore(c.getAvailableFrom())) {
            return "EM_BREVE";
        }
        if (c.getAvailableUntil() != null && now.isAfter(c.getAvailableUntil())) {
            return "EXPIRADO";
        }
        if (c.getStockLimit() != null && c.getSoldCount() >= c.getStockLimit()) {
            return "ESGOTADO";
        }
        return "DISPONIVEL";
    }

    /** O comprador tem um selo aprovado e válido desta marca/celebridade (e do selo exigido, se houver)? */
    public boolean hasSeal(UUID buyer, RoomCatalogItem c) {
        if (c.getCreatorUserId() == null) {
            return true;
        }
        Instant now = Instant.now();
        return bonds.findByRequestedByIdAndStatusOrderByCreatedAtDesc(buyer, SealBondStatus.APPROVED).stream()
                .filter(b -> b.getTargetOwner().getId().equals(c.getCreatorUserId()))
                .filter(b -> b.getExpiresAt() == null || b.getExpiresAt().isAfter(now))
                .anyMatch(b -> c.getSealId() == null || b.getSeal() != null && c.getSealId().equals(b.getSeal().getId()));
    }

    /** Motivo que impede a compra (nulo = pode comprar). */
    public String blocker(UUID buyer, RoomCatalogItem c) {
        String a = availability(c, Instant.now());
        if (!"DISPONIVEL".equals(a)) {
            return switch (a) {
                case "EM_BREVE" -> "Disponível a partir de " + c.getAvailableFrom() + ".";
                case "EXPIRADO" -> "A venda deste item terminou.";
                case "ESGOTADO" -> "Esgotado.";
                default -> "Item fora da loja.";
            };
        }
        if (c.getPerUserLimit() != null && inventory.countByUserIdAndSku(buyer, c.getSku()) >= c.getPerUserLimit()) {
            return "Limite de " + c.getPerUserLimit() + " por pessoa.";
        }
        if (c.isRequiresSeal() && !hasSeal(buyer, c)) {
            return "Exige um selo válido de " + creatorName(c) + " num look seu.";
        }
        return null;
    }

    String creatorName(RoomCatalogItem c) {
        return c.getCreatorUserId() == null ? "FAI" : users.findById(c.getCreatorUserId()).map(u -> String.valueOf(identity(u).get("name"))).orElse("marca");
    }

    public Map<String, Object> view(RoomCatalogItem c, UUID buyer) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("sku", c.getSku());
        m.put("name", c.getName());
        m.put("kind", c.getKind());
        m.put("description", c.getDescription());
        m.put("moldId", c.getMoldId());
        m.put("slotType", c.getSlotType());
        m.put("blockLabel", BLOCKS.stream().filter(b -> b.moldId().equals(c.getMoldId())).map(Block::label).findFirst().orElse("WARDROBE".equals(c.getKind()) ? "Guarda-roupa inteiro" : c.getSlotType()));
        m.put("widthCm", c.getWidthCm());
        m.put("material", c.getMaterial());
        m.put("materialLabel", c.getMaterial() == null ? null : MATERIALS.containsKey(c.getMaterial()) ? MATERIALS.get(c.getMaterial()).label() : c.getMaterial());
        m.put("colorName", c.getColorName());
        m.put("finish", Json.map(c.getFinishJson()));
        m.put("bundle", c.getBundleJson() == null ? List.of() : Json.list(c.getBundleJson()));
        m.put("rarity", c.getRarity());
        m.put("pricePoints", c.getPricePoints());
        m.put("requiredLevel", c.getRequiredLevel());
        m.put("stock", c.getStockLimit());
        m.put("stockLeft", c.getStockLimit() == null ? null : Math.max(0, c.getStockLimit() - c.getSoldCount()));
        m.put("sold", c.getSoldCount());
        m.put("perUserLimit", c.getPerUserLimit());
        m.put("availableFrom", c.getAvailableFrom());
        m.put("availableUntil", c.getAvailableUntil());
        m.put("availability", availability(c, Instant.now()));
        m.put("requiresSeal", c.isRequiresSeal());
        m.put("active", c.isActive());
        m.put("labelText", c.getLabelText());
        m.put("logoUrl", c.getLogoUrl());
        m.put("artUrl", c.getArtUrl());
        m.put("seal", c.getSealId() == null ? null : seals.findById(c.getSealId()).map(s -> Map.of("id", s.getId(), "name", s.getName())).orElse(null));
        m.put("creator", c.getCreatorUserId() == null ? null : users.findById(c.getCreatorUserId()).map(this::identity).orElse(null));
        if (buyer != null) {
            m.put("ownedCount", inventory.countByUserIdAndSku(buyer, c.getSku()));
            m.put("blocker", blocker(buyer, c));
        }
        return m;
    }

    // ------------------------------------------------------------------ validações

    static Block block(String slotType, String moldId) {
        return BLOCKS.stream().filter(b -> moldId != null && b.moldId().equalsIgnoreCase(moldId)).findFirst()
                .or(() -> BLOCKS.stream().filter(b -> b.slotType().equalsIgnoreCase(String.valueOf(slotType))).findFirst())
                .orElseThrow(() -> ApiException.badRequest("BLOCO_INVALIDO", "Bloco desconhecido: " + slotType));
    }

    static Material material(Block b, String code) {
        String c = code == null ? b.materials().get(0) : code.toUpperCase(Locale.ROOT);
        if (!b.materials().contains(c)) {
            throw ApiException.badRequest("MATERIAL_INVALIDO", b.label() + " aceita: " + b.materials());
        }
        return MATERIALS.get(c);
    }

    static String hex(String color, String colorName, Material m) {
        if (color != null && color.matches("#[0-9A-Fa-f]{6}")) {
            return color.toUpperCase(Locale.ROOT);
        }
        if (colorName != null && COLORS.containsKey(colorName)) {
            return COLORS.get(colorName);
        }
        return COLORS.get(m.colors().get(0));
    }

    static String level(String l) {
        return l != null && LEVELS.contains(l.toUpperCase(Locale.ROOT)) ? l.toUpperCase(Locale.ROOT) : "ESTREIA";
    }

    static String url(String u) {
        if (u == null || u.isBlank()) {
            return null;
        }
        String v = u.trim();
        if (!(v.startsWith("http://") || v.startsWith("https://") || v.startsWith("/media/"))) {
            throw ApiException.badRequest("URL_INVALIDA", "Use o upload de imagem ou um link https://");
        }
        return v.length() > 1024 ? v.substring(0, 1024) : v;
    }

    static String token(int n) {
        String a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < n; i++) {
            b.append(a.charAt(RANDOM.nextInt(a.length())));
        }
        return b.toString();
    }

    static boolean same(Object a, Object b) {
        return Objects.equals(a, b);
    }
}
