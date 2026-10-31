package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.service.WardrobeService.PieceForm;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ItemCondition;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.BrandRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.service.PieceTaxonomyWriter.applyTaxonomy;

/**
 * Formulário da peça (RF4 cadastro, RF9.CA07 edição) → entidade: validação com todos os campos a corrigir de uma vez,
 * cópia dos campos saneados, estado de conservação, taxonomia e marca (cadastrada, perfil aprovado, buscador web ou texto
 * livre). Sem transação nem autorização: o {@link WardrobeService} chama dentro dos métodos transacionais dele.
 */
final class PieceFormWriter {
    private final PieceConservationService conservation;
    private final BrandRepository brands;
    private final BrandProfileRepository brandProfiles;
    private final OwnMedia ownMedia;
    private final MediaService media;
    private final BrandLogoService brandLogos;

    PieceFormWriter(PieceConservationService conservation, BrandRepository brands, BrandProfileRepository brandProfiles,
                    OwnMedia ownMedia, MediaService media, BrandLogoService brandLogos) {
        this.conservation = conservation;
        this.brands = brands;
        this.brandProfiles = brandProfiles;
        this.ownMedia = ownMedia;
        this.media = media;
        this.brandLogos = brandLogos;
    }

    static void validate(PieceForm f) {
        BackgroundStudioService.validateArtwork(f.background());
        // uma resposta com TODOS os campos a corrigir (antes: primeiro a taxonomia, depois nome e preço, em duas rodadas)
        Map<String, Object> errors = new LinkedHashMap<>(Taxonomy.pieceErrors(f.category(), f.subcategory(), f.sex(), f.color(),
                f.material(), f.size(), f.occasion(), f.style()));
        if (!errors.containsKey("category") && !errors.containsKey("subcategory")) {
            errors.putAll(Taxonomy.variationErrors(f.category(), f.subcategory(), f.variation(), f.attributes()));
        }
        if (f.name() == null || f.name().isBlank()) {
            errors.put("name", Msg.t("wardrobe.informe_o_nome_da_peca"));
        }
        if (f.price() == null || f.price().signum() < 0) {
            errors.put("price", Msg.t("wardrobe.informe_o_preco_usd"));
        }
        if (f.seals() != null && f.seals().size() > 2) {
            errors.put("seals", Msg.t("wardrobe.maximo_de_2_selos_sugeridos"));
        }
        if (!Taxonomy.isValidMarket(f.market())) {
            errors.put("market", Msg.t("wardrobe.mercado_invalido_estacao_genero_ex"));
        }
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("FORMULARIO_INVALIDO", Msg.t("common.corrija_os_campos_destacados"), errors);
        }
    }

    void apply(WardrobeItem w, PieceForm f, boolean creating) {
        apply(w, f, creating, null);
    }

    void apply(WardrobeItem w, PieceForm f, boolean creating, Map<?, ?> aiPrefill) {
        if (f.estadoConservacaoId() != null || Boolean.TRUE.equals(f.clearEstadoConservacao())) {
            conservation.apply(w, f.estadoConservacaoId(), Boolean.TRUE.equals(f.clearEstadoConservacao()));
        }
        BackgroundStudioService.validateMotionWrite(w.getBackgroundConfigJson(), f.background());
        w.setName(InputSanitizer.moderated("name", f.name(), 120));
        w.setCategory(f.category());
        w.setSubcategory(f.subcategory());
        applyTaxonomy(w, f, aiPrefill);
        w.setSex(f.sex());
        w.setColor(f.color());
        w.setMaterial(f.material());
        w.setSizeLabel(f.size());
        w.setMarket(f.market());
        w.setOccasionTags(Json.csv(Taxonomy.canonicalTags(f.occasion())));
        w.setStyleTags(Json.csv(Taxonomy.canonicalTags(f.style())));
        w.setSealIdsJson(Json.write(f.seals() == null ? List.of() : f.seals()));
        w.setPrice(f.price());
        w.setTags(Json.csv(f.tags()));
        w.setNotes(InputSanitizer.clean(f.notes(), 1000));
        if (!Boolean.TRUE.equals(f.clearEstadoConservacao())) {
            w.setCondition(f.condition() == null ? (creating ? ItemCondition.GOOD : w.getCondition()) : f.condition());
        }
        w.setPurchaseDate(f.purchaseDate());
        w.setPurchaseLocation(InputSanitizer.clean(f.purchaseLocation(), 160));
        w.setSku(InputSanitizer.clean(f.sku(), 80));
        w.setCareInstructions(InputSanitizer.clean(f.careInstructions(), 500));
        // arte de fundo da peça (RF4 · etapa "Arte de fundo": aura, material, skin, anatomia) — mesmo formato do look
        if (f.background() != null) {
            w.setBackgroundConfigJson(f.background().isEmpty() ? null : Json.write(f.background()));
        }
        if (f.forSale() != null) {
            w.setForSale(f.forSale());
        }
        String previousBrand = w.getBrandName();
        resolveBrand(w, f.brandId(), f.brandName());
        brandFromWebSearch(w, f, previousBrand);
    }

    /**
     * Marca da peça (RF4): {@code brandId} só quando o cliente aponta uma marca já ligada; fora isso, o nome vem do
     * buscador web (ou texto livre) e <b>não depende de catálogo pré-cadastrado</b>. Se o nome for de uma marca com
     * perfil aprovado na plataforma (conta MARCA), a peça é ligada a esse perfil (selos, cupons, página da marca).
     */
    private void resolveBrand(WardrobeItem w, UUID brandId, String brandName) {
        if (brandId != null) {
            Brand b = brands.findById(brandId).orElseThrow(() -> ApiException.badRequest("MARCA_INVALIDA", Msg.t("wardrobe.marca_nao_encontrada")));
            w.setBrand(b);
            w.setBrandName(b.getName());
            w.setBrandProfile(b.getBrandProfile());
            return;
        }
        w.setBrand(null);
        if (brandName == null || brandName.isBlank() || PieceAnalysisParser.isNoBrandPlaceholder(brandName)) {
            w.setBrandName(null);
            w.setBrandProfile(null);
            return;
        }
        String name = InputSanitizer.clean(brandName, 80);
        w.setBrandName(name);
        String key = BrandLogoService.keyOf(name);
        w.setBrandProfile(brandProfiles.findByApprovalStatus(br.com.fashionai.domain.model.enums.ApprovalStatus.APROVADO).stream()
                .filter(bp -> key.equals(BrandLogoService.keyOf(bp.getNomeFantasia())) || key.equals(BrandLogoService.keyOf(bp.getBrandName())))
                .findFirst().orElse(null));
    }

    private static final java.util.Set<String> WEB_BRAND_SOURCES = java.util.Set.of("WIKIDATA", "SIMPLE_ICONS", "IA_BUSCA_WEB");

    /**
     * RF4 — marca escolhida no buscador web: a peça guarda o logo já filtrado (fundo branco, letras pretas) e a fonte.
     * Só aceita logo que esteja no storage próprio (a URL vem do próprio buscador, nunca de terceiros) e seja do catálogo
     * de logos ou um arquivo do próprio dono. O logo vale para esta peça; o logo global da marca só muda se o arquivo for
     * o que o próprio servidor buscou em catálogo aberto (ver {@link BrandLogoService#acceptWebLogo}). Sem logo da web, a
     * marca fica como texto livre (monograma) ou ligada à marca cadastrada na plataforma.
     */
    private void brandFromWebSearch(WardrobeItem w, PieceForm f, String previousBrand) {
        if (w.getBrandName() == null) {
            w.setBrandLogoUrl(null);
            w.setBrandSource(null);
            w.setBrandRef(null);
            return;
        }
        String logo = f.brandLogoUrl() == null ? null : f.brandLogoUrl().trim();
        if (f.brandSource() == null && w.getBrandName().equals(previousBrand)
                && (logo == null || logo.isEmpty() || logo.equals(w.getBrandLogoUrl()))) {
            return;                                   // edição sem mexer na marca: mantém logo e fonte
        }
        String source = f.brandSource() == null ? null : f.brandSource().trim().toUpperCase(Locale.ROOT);
        if (logo != null && !logo.isEmpty() && ownMedia.accepts(w.getUser().getId(), logo, true) && media.read(logo).isPresent()) {
            w.setBrandLogoUrl(logo);
            w.setBrandSource(source != null && WEB_BRAND_SOURCES.contains(source) ? source : "WEB");
            w.setBrandRef(f.brandRef() == null ? null : InputSanitizer.clean(f.brandRef(), 255));
            brandLogos.acceptWebLogo(w.getBrandName(), logo, w.getBrandSource(), null, w.getBrandRef());
        } else if (w.getBrandProfile() != null || w.getBrand() != null) {
            w.setBrandLogoUrl(null);
            w.setBrandSource("PLATAFORMA");
            w.setBrandRef(w.getBrandProfile() != null ? w.getBrandProfile().getSlug() : w.getBrand().getId().toString());
        } else {
            w.setBrandLogoUrl(null);
            w.setBrandSource("TEXTO_LIVRE");
            w.setBrandRef(null);
        }
    }

    /** "À venda" e "para doar" são exclusivos: marcar um desmarca o outro; desmarcar não mexe no outro. */
    static void applyListing(WardrobeItem w, Boolean forSale, Boolean forDonation) {
        if (forSale != null) {
            w.setForSale(forSale);
            if (forSale) {
                w.setForDonation(false);
            }
        }
        if (forDonation != null) {
            w.setForDonation(forDonation);
            if (forDonation) {
                w.setForSale(false);
            }
        }
    }
}
