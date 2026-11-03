package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.Portrait;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.CreationMode;
import br.com.fashionai.domain.model.enums.DisplayMode;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.Mood;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.SchemeServiceCharacterizationFixture.id;
import static br.com.fashionai.application.testkit.Portrait.attempt;

/**
 * Caracterização do {@link SchemeService} sobre um mundo fixo ({@link SchemeServiceCharacterizationFixture}): o retrato
 * de todas as saídas públicas (construtor, composição, criar/editar/publicar/remixar, leitura, Meus looks, diff da IA,
 * PNGs do card por SHA-256), das regras puras usadas pelos testes e de todas as chamadas aos colaboradores mockados
 * (auditoria, notificações, eventos, contadores, projeções, selos, Look do Dia, mídia, guarda) tem de continuar idêntico
 * ao gravado em {@code scheme/scheme-service-portrait.txt}.
 */
class SchemeServiceCharacterizationTest {
    private static final String GOLDEN = "/scheme/scheme-service-portrait.txt";

    private final SchemeServiceCharacterizationFixture w = new SchemeServiceCharacterizationFixture();
    private final SchemeService schemes = w.service;
    private final Portrait p = new Portrait(SchemeServiceCharacterizationFixture.PREFIX);

    private static SchemeService.ItemForm item(WardrobeItem piece, int n) {
        return new SchemeService.ItemForm(piece.getId(), n == 2 ? SchemeSlot.ACCESSORY : null, n == 1 ? 7 : null, n == 0 ? 3 : null,
                n == 0 ? new BigDecimal("0.25") : null, n == 0 ? new BigDecimal("0.4") : null, n == 1 ? new BigDecimal("1.3") : null,
                n == 1 ? new BigDecimal("12") : null, n == 2 ? new BigDecimal("0.6") : null,
                n == 0 ? Map.of("brightness", 1.1, "contrast", 1.0) : n == 1 ? Map.of("blur", 0.0) : null);
    }

    private static List<SchemeService.ItemForm> items(List<WardrobeItem> pieces) {
        List<SchemeService.ItemForm> out = new ArrayList<>();
        for (int i = 0; i < pieces.size(); i++) {
            out.add(item(pieces.get(i), i));
        }
        return out;
    }

    private SchemeService.SchemeForm form(String title, List<WardrobeItem> pieces, Map<String, Object> bg, Boolean publish, Boolean daily) {
        return new SchemeService.SchemeForm(title, "Descrição de " + title, List.of("casual"), List.of("streetwear", "basic"), Season.SUMMER,
                Mood.COMFORTABLE, null, DisplayMode.values()[0], items(pieces), CreationMode.MANUAL, null, null, bg, false, "atelier",
                "LISTA_VERTICAL", List.of("#praia", "verão"), List.of("s1"), publish, daily);
    }

    private SchemeService.SchemeForm bare(String title, Visibility v, List<SchemeService.ItemForm> items, UUID remixOf, Map<String, Object> bg) {
        return new SchemeService.SchemeForm(title, null, List.of("casual"), List.of("streetwear"), null, null, v, null, items, null, null,
                remixOf, bg, null, null, null, null, null, null, null);
    }

    @Test
    void retratoDasSaidasPublicasDasRegrasEDosEfeitos() throws Exception {
        CurrentUser ana = Kit.as(w.ana);
        CurrentUser bia = Kit.as(w.bia);
        List<WardrobeItem> mine = w.anaPieces;
        p.add("builder", schemes.builder(ana));
        p.add("builder.empty", schemes.builder(Kit.as(w.empty)));
        compose(ana);
        UUID first = created("create.publishDaily", schemes.create(ana, form("Look de sábado", List.of(mine.get(0), mine.get(3), mine.get(7)),
                Map.of("color", "#F4F2EF"), true, true)));
        UUID second = created("create.dailyWarning", schemes.create(ana, form("Look de domingo", List.of(mine.get(1), mine.get(4)), null, false, true)));
        Map<String, Object> up = schemes.uploadLookPhoto(ana, SchemeServiceCharacterizationFixture.jpeg(SchemeServiceCharacterizationFixture.swatch(
                java.awt.Color.PINK, 800, 1000)));
        p.add("uploadLookPhoto", up);
        p.add("uploadLookPhoto.small", attempt(() -> schemes.uploadLookPhoto(ana, SchemeServiceCharacterizationFixture.jpeg(
                SchemeServiceCharacterizationFixture.swatch(java.awt.Color.PINK, 300, 300)))));
        p.add("uploadLookPhoto.ratio", attempt(() -> schemes.uploadLookPhoto(ana, SchemeServiceCharacterizationFixture.jpeg(
                SchemeServiceCharacterizationFixture.swatch(java.awt.Color.PINK, 1200, 450)))));
        UUID withPhoto = created("create.photo", schemes.create(ana, bare("Com foto", Visibility.FOLLOWERS, items(List.of(mine.get(8), mine.get(6))), null,
                Map.of("scheme", Map.of("photo", Map.of("url", String.valueOf(up.get("url"))))))));
        p.add("create.photo.cover", w.kit.dep(SchemeRepository.class).findById(withPhoto).orElseThrow().getCoverImageUrl());
        p.add("create.noPhoto", schemes.create(ana, bare("Sem foto", null, items(List.of(mine.get(2))), null, Map.of("photo", Map.of("url", " ")))));
        UUID remixed = created("create.remix", schemes.create(ana, bare("Meu remix", null, items(List.of(mine.get(0), mine.get(4))),
                w.biaLooks.get(0).getId(), null)));
        p.add("remix.sourceCount", w.biaLooks.get(0).getRemixCount());
        createErrors(ana, mine);
        p.add("suggest.ok", schemes.suggestSealsAfterSave(ana, first));
        p.add("suggest.fail", schemes.suggestSealsAfterSave(ana, id(1203)));
        p.add("publish", schemes.publish(ana, second, Visibility.PUBLIC));
        p.add("publish.notOwner", attempt(() -> schemes.publish(bia, second, null)));
        reads(ana, bia, first, withPhoto);
        mineVariants(ana);
        p.add("update.pieces", schemes.update(ana, first, form("Look de sábado editado", List.of(mine.get(1), mine.get(3), mine.get(5)),
                Map.of("color", "#101820"), null, null)));
        p.add("update.private", schemes.update(ana, first, bare("Look privado", Visibility.PRIVATE, null, null, null)));
        p.add("update.publish", schemes.update(ana, withPhoto, form("Com foto publicada", List.of(mine.get(8)), null, true, null)));
        p.add("update.empty", attempt(() -> schemes.update(ana, first, form("Vazio", List.of(), null, false, null))));
        p.add("update.recommended", schemes.update(ana, remixed, new SchemeService.SchemeForm("Direção recomendada", null, List.of("casual"),
                List.of("streetwear"), null, null, null, null, null, null, null, null, null, true, null, null, null, null, null, null)));
        aiDiff(ana);
        p.add("toggles", schemes.toggles(ana, second, true, false));
        p.add("toggles.none", schemes.toggles(ana, second, null, null));
        p.add("remix.other", schemes.remix(ana, w.biaLooks.get(1).getId()));
        p.add("remix.own", schemes.remix(ana, w.anaLooks.get(0).getId()));
        p.add("remix.unavailable", attempt(() -> schemes.remix(ana, w.biaLooks.get(3).getId())));
        p.add("remix.hidden", attempt(() -> schemes.remix(bia, w.anaLooks.get(2).getId())));
        cards(ana, bia, first);
        p.add("archive", schemes.archive(ana, second));
        p.add("archive.photo", schemes.archive(ana, withPhoto));
        p.add("mine.afterArchive", schemes.mine(ana, null, "arquivados", 0, 20).items().stream().map(Views.SchemeView::title).toList());
        p.add("owned.other", attempt(() -> schemes.owned(bia, first)));
        pureRules(mine);
        int i = 0;
        for (Object mock : w.sideEffects()) {
            p.invocations("mock" + (i++), mock);
        }
        p.verify(SchemeServiceCharacterizationTest.class, GOLDEN);
    }

    private UUID created(String label, Map<String, Object> out) {
        p.add(label, out);
        return ((Views.SchemeView) out.get("scheme")).id();
    }

    private void compose(CurrentUser ana) {
        SchemeService.ComposeResult r = schemes.compose(ana, new SchemeService.ComposeRequest(List.of("casual"), List.of("streetwear"),
                "COMFORTABLE", "SUMMER", "algo leve com tênis branco", List.of()), AiCapability.SCHEME_COMPOSER);
        p.add("compose", r);
        String key = SchemeService.combinationKey(r.compositions().get(0).items().stream().map(x -> x.wardrobeItemId()).toList());
        p.add("compose.exclude", schemes.compose(ana, new SchemeService.ComposeRequest(null, null, null, "WINTER", null, List.of(key)),
                AiCapability.SCHEME_COMPOSER));
        p.add("compose.withScores", r.withScores(List.of(Map.of("a", 1))).withOrientation(Map.of("background", "x")));
        p.add("compose.few", attempt(() -> schemes.compose(Kit.as(w.empty), new SchemeService.ComposeRequest(null, null, null, null, null, null),
                AiCapability.SCHEME_COMPOSER)));
    }

    private void createErrors(CurrentUser ana, List<WardrobeItem> mine) {
        p.add("create.noItems", attempt(() -> schemes.create(ana, form("Sem peças", List.of(), null, false, false))));
        p.add("create.shortTitle", attempt(() -> schemes.create(ana, form("x", List.of(mine.get(0)), null, false, false))));
        p.add("create.foreign", attempt(() -> schemes.create(ana, form("Alheia", List.of(w.biaPieces.get(0)), null, false, false))));
        p.add("create.badTags", attempt(() -> schemes.create(ana, new SchemeService.SchemeForm("Tags erradas", null, List.of("inventada"),
                List.of("streetwear"), null, null, null, null, items(List.of(mine.get(1))), null, null, null, null, null, null, null, null,
                List.of("a", "b", "c", "d", "e"), null, null))));
        p.add("create.noId", attempt(() -> schemes.create(ana, bare("Sem id", null, List.of(new SchemeService.ItemForm(null, SchemeSlot.TOP,
                null, null, null, null, null, null, null, null)), null, null))));
        p.add("create.foreignPhoto", attempt(() -> schemes.create(ana, bare("Foto alheia", null, items(List.of(mine.get(0))), null,
                Map.of("photo", Map.of("url", "/media/users/outra/looks/x.jpg"))))));
        mine.get(9).setDisponivel(false);
        p.add("create.unavailable", attempt(() -> schemes.create(ana, form("Indisponível", List.of(mine.get(9)), null, false, false))));
        mine.get(9).setDisponivel(true);
        p.add("create.remixUnavailable", attempt(() -> schemes.create(ana, bare("Remix", null, items(List.of(mine.get(0))),
                w.biaLooks.get(3).getId(), null))));
        p.add("create.remixHidden", attempt(() -> schemes.create(Kit.as(w.bia), bare("Remix", null, items(List.of(w.biaPieces.get(0))),
                w.anaLooks.get(2).getId(), null))));
    }

    private void reads(CurrentUser ana, CurrentUser bia, UUID first, UUID withPhoto) {
        p.add("get.other", schemes.get(bia, first));
        p.add("get.owner", schemes.get(ana, first));
        p.add("get.anonymous", schemes.get(null, w.anaLooks.get(0).getId()));
        p.add("get.remixed", schemes.get(ana, w.anaLooks.get(1).getId()));
        p.add("get.draft.other", attempt(() -> schemes.get(bia, w.anaLooks.get(2).getId())));
        p.add("get.followers.other", attempt(() -> schemes.get(bia, withPhoto)));
        p.add("get.missing", attempt(() -> schemes.get(ana, id(9999))));
        for (Scheme s : w.anaLooks) {
            p.add("canView." + s.getTitle(), List.of(schemes.canView(bia, s), schemes.canView(ana, s), schemes.canView(null, s)));
        }
        p.add("requireView.draft", attempt(() -> {
            schemes.requireView(bia, w.anaLooks.get(2));
            return "ok";
        }));
        p.add("view.anonymous", schemes.view(null, w.anaLooks.get(0), List.of()));
    }

    private void mineVariants(CurrentUser ana) {
        p.add("mine.default", schemes.mine(ana, null, null, 0, 20));
        p.add("mine.page", schemes.mine(ana, "casual", "publicados", "manual", 1, 2));
        for (String st : List.of("arquivados", "favoritos", "disponivel", "indisponivel", "rascunhos", "outro", " Publicados ")) {
            p.add("mine.state." + st, schemes.mine(ana, null, st, null, 0, 0).items().stream().map(Views.SchemeView::title).toList());
        }
        for (String kind : List.of("ia", "manual", "remix", "todos")) {
            p.add("mine.kind." + kind, schemes.mine(ana, null, null, kind, 0, 99).items().stream().map(Views.SchemeView::title).toList());
        }
        for (String sort : List.of("hype", "menor_hype", "crescimento", "recent", "x")) {
            for (String level : new String[]{null, "HOT", "LOW_SIGNAL", "relevant", "viral", "nada"}) {
                p.add("mine.sort." + sort + "." + level, schemes.mine(ana, null, "todos", null, sort, level, 0, 20).items().stream()
                        .map(Views.SchemeView::title).toList());
            }
        }
    }

    private void aiDiff(CurrentUser ana) {
        UUID id = w.anaLooks.get(0).getId();
        p.add("improve", schemes.improve(ana, id, "deixe mais elegante para a noite"));
        p.add("improve.null", schemes.improve(ana, id, null));
        Map<String, Object> current = Map.of("title", "A", "occasion", List.of("casual"), "season", "SUMMER", "visibility", "PUBLIC");
        p.add("parseDiff", schemes.parseDiff("antes {\"changes\":[{\"field\":\"title\",\"proposed\":\"Noite\",\"reason\":\"r\"},"
                + "{\"field\":\"occasion\",\"proposed\":[\"party\"]},{\"field\":\"season\",\"proposed\":\"MONSOON\"},"
                + "{\"field\":\"visibility\",\"proposed\":\"FOLLOWERS\"},{\"field\":\"inexistente\",\"proposed\":1}]} depois", current));
        p.add("parseDiff.none", String.valueOf(schemes.parseDiff("nada", current)));
        Map<String, Object> accepted = new LinkedHashMap<>();
        accepted.put("title", "Noite elegante");
        accepted.put("description", "Para jantar");
        accepted.put("occasion", List.of("party"));
        accepted.put("style", List.of("classic"));
        accepted.put("season", "WINTER");
        accepted.put("mood", "ELEGANT");
        accepted.put("visibility", "FOLLOWERS");
        p.add("applyDiff", schemes.applyDiff(ana, id, accepted));
        p.add("applyDiff.invalid", attempt(() -> schemes.applyDiff(ana, id, Map.of("mood", "BRAVO"))));
        p.add("applyDiff.tooMany", attempt(() -> schemes.applyDiff(ana, id, Map.of("style", List.of("classic", "glam", "basic", "chic")))));
    }

    private void cards(CurrentUser ana, CurrentUser bia, UUID first) {
        UUID published = w.anaLooks.get(1).getId();
        p.add("renderCard.owner.expanded", schemes.renderCard(ana, published, true));
        p.add("renderCard.other.compact", schemes.renderCard(bia, published, false));
        p.add("renderCard.private.owner", schemes.renderCard(ana, w.anaLooks.get(0).getId(), false));
        p.add("renderCard.studio", schemes.renderCard(bia, w.biaLooks.get(1).getId(), true));
        p.add("renderCard.hidden", attempt(() -> schemes.renderCard(bia, first, true)));
        p.add("preview", schemes.preview(ana, form("Prévia", List.of(w.anaPieces.get(0), w.anaPieces.get(3), w.anaPieces.get(5)),
                Map.of("color", "#223344", "gradient", Map.of("stops", List.of("#112233", "#AABBCC"))), false, false)));
        p.add("preview.bare", schemes.preview(ana, new SchemeService.SchemeForm(null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, "noir", null, null, null, null, null)));
        p.add("preview.foreign", attempt(() -> schemes.preview(ana, form("Prévia", List.of(w.biaPieces.get(0)), null, false, false))));
        Scheme look = w.anaLooks.get(3);
        List<SchemeService.ItemForm> layout = List.of(
                new SchemeService.ItemForm(w.anaPieces.get(1).getId(), null, 4, 5, new BigDecimal("0.3"), new BigDecimal("0.4"),
                        new BigDecimal("1.2"), new BigDecimal("-8"), new BigDecimal("0.9"), null),
                new SchemeService.ItemForm(w.anaPieces.get(3).getId(), null, null, 1, null, null, null, null, null, null),
                new SchemeService.ItemForm(null, null, null, 2, null, null, null, null, null, null),
                new SchemeService.ItemForm(id(7777), null, null, 9, BigDecimal.ONE, BigDecimal.ONE, null, null, null, null));
        List<SchemeService.ItemForm> loose = List.of(new SchemeService.ItemForm(w.anaPieces.get(5).getId(), null, null, null,
                new BigDecimal("1.7"), new BigDecimal("-0.2"), new BigDecimal("9"), new BigDecimal("400"), new BigDecimal("0.01"), null));
        p.add("layoutPreview.loose", schemes.layoutPreview(ana, look.getId(), loose));
        p.add("layoutPreview.null", schemes.layoutPreview(ana, look.getId(), null));
        p.add("updateLayout", schemes.updateLayout(ana, look.getId(), layout));
        p.add("updateLayout.strict", attempt(() -> schemes.updateLayout(ana, look.getId(), loose)));
        p.add("layoutPreview", schemes.layoutPreview(ana, look.getId(), layout));
        p.add("layoutPreview.other", attempt(() -> schemes.layoutPreview(bia, look.getId(), layout)));
    }

    private void pureRules(List<WardrobeItem> mine) {
        p.add("combinationKey", SchemeService.combinationKey(List.of(id(3), id(1), id(2))));
        Visibility[] vs = {null, Visibility.PRIVATE, Visibility.FOLLOWERS, Visibility.PUBLIC};
        for (Visibility a : vs) {
            for (Visibility b : vs) {
                p.add("moreRestrictive." + a + "." + b, String.valueOf(SchemeService.moreRestrictive(a, b)));
            }
        }
        for (Scheme s : w.anaLooks) {
            p.add("kindOf." + s.getTitle(), SchemeService.kindOf(s));
            for (String st : List.of("", "todos", "favorites", "available", "unavailable", "published", "drafts", "archived", "x")) {
                p.add("stateMatches." + s.getTitle() + "." + st, SchemeService.stateMatches(s, st));
            }
        }
        p.add("stateMatches.null", SchemeService.stateMatches(w.anaLooks.get(0), null));
        for (String raw : new String[]{null, " HYPE ", "hype_desc", "maior_hype", "hype_asc", "menor_hype", "growth", "em_crescimento", "x"}) {
            p.add("lookSort." + raw, SchemeService.lookSort(raw));
        }
        int[] t = HypeScoreConfig.defaults().levelThresholds();
        for (String level : new String[]{null, " ", "low_signal", "NICHE", "relevant", "HOT", "trending", "VIRAL", "x"}) {
            p.add("hypeMinimum." + level, List.of(String.valueOf(SchemeService.hypeMinimum(level, t)),
                    String.valueOf(SchemeService.hypeMinimum(level, new int[]{1, 2}))));
        }
        Map<UUID, HypeScoreCurrent> hype = w.kit.dep(HypeScoreCurrentRepository.class).findAll().stream()
                .filter(h -> h.getEntityType() == HypeEntityType.SCHEME).collect(Collectors.toMap(HypeScoreCurrent::getEntityId, h -> h));
        for (String order : new String[]{null, "hype", "hype_desc", "hype_asc", "growth", "recent"}) {
            for (Integer min : new Integer[]{null, 0, 40, 60, 92}) {
                p.add("byHype." + order + "." + min, SchemeService.byHype(w.anaLooks, order, min, hype).stream().map(Scheme::getTitle).toList());
            }
        }
        for (HypeLevel level : new HypeLevel[]{null, HypeLevel.values()[0], HypeLevel.VIRAL}) {
            p.add("cardHypeLabel." + level, List.of(String.valueOf(SchemeService.cardHypeLabel(BigDecimal.valueOf(89.6), level, true)),
                    String.valueOf(SchemeService.cardHypeLabel(BigDecimal.valueOf(89.6), level, false)),
                    String.valueOf(SchemeService.cardHypeLabel(null, level, true))));
        }
        for (HypeScoreCurrent h : hype.values().stream().sorted(java.util.Comparator.comparing(HypeScoreCurrent::getEntityId)).toList()) {
            p.add("cardHypeLabel.row." + h.getEntityId(), List.of(String.valueOf(schemes.cardHypeLabel(h, true)),
                    String.valueOf(schemes.cardHypeLabel(h, false))));
        }
        p.add("cardHypeLabel.null", String.valueOf(schemes.cardHypeLabel(null, true)));
        for (WardrobeItem piece : List.of(mine.get(0), mine.get(2), mine.get(8))) {
            p.add("placeholder." + piece.getSubcategory(), SchemeService.placeholder(piece));
        }
        WardrobeItem unnamed = Kit.piece(w.ana, "x", "upper_piece", null, "beige");
        unnamed.setName(" ");
        p.add("placeholder.unnamed", SchemeService.placeholder(unnamed));
        WardrobeItem longName = Kit.piece(w.ana, "Camiseta de algodão orgânico listrada", "upper_piece", "t_shirt", "white");
        p.add("placeholder.long", SchemeService.placeholder(longName));
        p.add("pieceAnalysis", List.of(String.valueOf(SchemeService.pieceAnalysis(mine.get(0))), String.valueOf(SchemeService.pieceAnalysis(mine.get(1)))));
    }
}
