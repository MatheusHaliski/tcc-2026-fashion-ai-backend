package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.imaging.SchemeCardRenderer;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.TipoLook;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.TipoLookRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Caracterização do {@link MirrorService} (lote R90): com ids, datas e cores fixos, o retrato de todas as saídas
 * públicas — estado, montagem manual, lista do espelho, sugestão por slot, escolha do guarda-roupa, Vista-me (motor
 * local e respostas de IA roteirizadas, inclusive as descartadas pela validação anti-alucinação), "Tira uma coisa",
 * salvar, usar como Look do Dia, rascunho para o RF5 e o roteiro do Arrume-se Comigo — e das regras puras tem de
 * continuar idêntico ao gravado em {@code mirror/mirror-service-retrato.txt} (gravado no código original).
 */
class MirrorServiceCharacterizationTest {
    private static final Path GOLDEN = Path.of("src/test/resources/mirror/mirror-service-retrato.txt");
    private static final Instant T0 = Instant.parse("2025-03-01T12:00:00Z");
    private static final String[][] WARDROBE = {
            {"upper_piece", "t_shirt", "white", "basic,streetwear", "casual"},
            {"upper_piece", "shirt", "light_blue", "classic,tailored", "work,business"},
            {"upper_piece", "hoodie", "black", "streetwear", "casual,home"},
            {"upper_piece", "blazer", "navy", "classic,tailored", "work,formal"},
            {"lower_piece", "jeans", "blue", "basic,streetwear", "casual"},
            {"lower_piece", "cargo_pants", "olive", "streetwear", "casual,outdoor"},
            {"lower_piece", "tailored_pants", "black", "classic,tailored", "work,business"},
            {"shoes_piece", "casual_sneakers", "white", "basic,streetwear", "casual"},
            {"shoes_piece", "oxford_shoes", "brown", "classic,tailored", "work,formal"},
            {"accessory_piece", "handbag", "black", "classic", "work"},
            {"accessory_piece", "cap", "red", "streetwear", "casual"},
            {"full_body_piece", "dress", "red", "glam,romantic", "party,date"},
            {"accessory_piece", "scarf", "print", "boho", "casual"},
            {"accessory_piece", "belt", "brown", "classic", "work"},
            {"accessory_piece", "earrings", "gold", "glam", "party"},
            {"accessory_piece", "necklace", "silver", "glam", "party"},
            {"upper_piece", "coat", "camel", "classic", "work,outdoor"},
            {"upper_piece", "crop_top", "yellow", "glam", "party"},
    };
    private static final int[][] LOOKS = {{0, 4, 7, 10}, {1, 6, 8, 9}, {11, 8, 14}};

    private final Kit kit = new Kit();
    private final List<WardrobeItem> anaPieces = new ArrayList<>();
    private User ana;
    private User bia;

    private static UUID id(int n) {
        return new UUID(0x3A1AL, n);
    }

    private User person(String name, int base, int pieces) {
        User u = Kit.user(name);
        u.assignId(id(base));
        u.markCreatedAt(T0);
        kit.dep(UserRepository.class).save(u);
        List<WardrobeItem> ws = new ArrayList<>();
        for (int i = 0; i < pieces; i++) {
            String[] p = WARDROBE[i];
            WardrobeItem w = Kit.piece(u, p[1].replace('_', ' ') + " " + name, p[0], p[1], p[2]);
            w.assignId(id(base + 100 + i));
            w.markCreatedAt(T0.plusSeconds(60L * i));
            w.setStyleTags(p[3]);
            w.setOccasionTags(p[4]);
            ws.add(kit.dep(WardrobeItemRepository.class).save(w));
        }
        for (int i = 0; i < LOOKS.length && pieces == WARDROBE.length; i++) {
            Scheme s = Kit.look(u, "Look " + (i + 1) + " de " + name);
            s.assignId(id(base + 200 + i));
            s.markCreatedAt(T0.plusSeconds(86_400L * i));
            kit.dep(SchemeRepository.class).save(s);
            for (int j = 0; j < LOOKS[i].length; j++) {
                var si = Kit.slot(s, ws.get(LOOKS[i][j]), SchemeSlot.values()[j % 4], j);
                si.assignId(id(base + 300 + i * 10 + j));
                kit.dep(SchemeItemRepository.class).save(si);
            }
        }
        if (name.equals("ana")) {
            anaPieces.addAll(ws);
        }
        return u;
    }

    private MirrorService setUp(AiEngine ai) {
        if (ai != null) {
            kit.with(ai);
        }
        when(kit.dep(MediaService.class).put(anyString(), any(), anyString()))
                .thenAnswer(i -> new MediaStoragePort.StoredObject(i.getArgument(0), "/media/" + i.getArgument(0), 10, "image/png"));
        when(kit.dep(Guard.class).canView(any(), any(), any())).thenReturn(true);
        kit.real(WardrobeService.class);
        kit.real(BackgroundStudioService.class);
        kit.real(SchemeCardRenderer.class);
        kit.real(RoomService.class);
        kit.real(SchemeService.class);
        ana = person("ana", 1000, WARDROBE.length);
        bia = person("bia", 2000, 6);
        anaPieces.get(2).setDisponivel(false);
        anaPieces.get(5).setForSale(true);
        return kit.build(MirrorService.class);
    }

    private UUID piece(String subcategory) {
        return anaPieces.stream().filter(w -> subcategory.equals(w.getSubcategory())).findFirst().orElseThrow().getId();
    }

    @Test
    void retratoComOMotorLocal() throws Exception {
        MirrorService mirror = setUp(null);
        CurrentUser me = Kit.as(ana);
        CopilotRetrato r = new CopilotRetrato();
        r.step("state.vazio", () -> mirror.state(me));
        TipoLook tipo = new TipoLook();
        tipo.setCodigo("FEMININO");
        tipo.setNome("Feminino");
        kit.save(TipoLookRepository.class, tipo);
        r.step("tipoLook.ok", () -> mirror.updateTipoLook(me, tipo.getId()));
        r.step("tipoLook.nulo", () -> mirror.updateTipoLook(me, null));
        r.step("tipoLook.inexistente", () -> mirror.updateTipoLook(me, id(9)));
        r.step("place.nulo", () -> mirror.place(me, null));
        r.step("place.terceiro", () -> mirror.place(me, id(2100)));
        for (String sub : List.of("t_shirt", "shirt", "jeans", "dress", "crop_top", "casual_sneakers", "coat", "hoodie")) {
            r.step("place." + sub, () -> mirror.place(me, piece(sub)));
        }
        for (String sub : List.of("handbag", "cap", "scarf", "belt", "earrings", "necklace")) {
            r.step("place.acc." + sub, () -> mirror.place(me, piece(sub)));
        }
        r.step("bring.nulo", () -> mirror.bring(me, null));
        r.step("bring.oxford", () -> mirror.bring(me, piece("oxford_shoes")));
        r.step("bring.repetido", () -> mirror.bring(me, piece("oxford_shoes")));
        r.step("unbring.coat", () -> mirror.unbring(me, piece("coat")));
        r.step("remove.hoodie", () -> mirror.remove(me, piece("hoodie")));
        r.step("eligible", () -> mirror.eligible(ana.getId()).stream().map(WardrobeItem::getId).toList());
        for (String slot : List.of("upper", "lower", "dress", "shoes", "outer_layer", "accessory", "chapeu")) {
            r.step("suggest." + slot, () -> mirror.suggest(me, slot));
            r.step("wardrobe." + slot, () -> mirror.wardrobe(me, slot));
        }
        r.step("swap.lower", () -> mirror.swap(me, "lower"));
        r.step("place.jeans.de.volta", () -> mirror.place(me, piece("jeans")));
        r.step("place.tshirt.de.volta", () -> mirror.place(me, piece("t_shirt")));
        r.step("takeOneOff.local", () -> mirror.takeOneOff(me));
        r.step("takeOneOff", () -> mirror.takeOneOff(me));
        r.step("draft", () -> mirror.draft(me, null));
        r.step("draft.override", () -> mirror.draft(me, "vista_me"));
        r.step("grwm", () -> mirror.grwmStoryboard(me));
        r.step("save", () -> mirror.save(me, "Look do espelho", true));
        r.step("save.de.novo", () -> mirror.save(me, "Outro título", false));
        r.step("useLook", () -> mirror.useLook(me));
        r.step("clear", () -> mirror.clear(me));
        r.step("takeOneOff.incompleto", () -> mirror.takeOneOff(me));
        r.step("useLook.incompleto", () -> mirror.useLook(me));
        r.step("save.vazio", () -> mirror.save(me, null, false));
        r.step("grwm.vazio", () -> mirror.grwmStoryboard(me));
        r.step("vistaMe.casual", () -> mirror.vistaMe(me, "um look casual para o fim de semana com tênis", List.of(), null, false));
        r.step("another.1", () -> mirror.another(me));
        r.step("another.2", () -> mirror.another(me));
        r.step("vistaMe.foco", () -> mirror.vistaMe(me, "quero usar esta peça numa noite elegante", List.of(piece("blazer"), id(2101)),
                piece("oxford_shoes"), true));
        r.step("vistaMe.trabalho", () -> mirror.vistaMe(me, "trabalho no frio", null, null, true));
        r.step("draft.vistaMe", () -> mirror.draft(me, null));
        r.step("save.vistaMe", () -> new java.util.TreeSet<>(mirror.save(me, null, false).keySet()));
        r.step("place.depoisVistaMe", () -> mirror.place(me, piece("cap")));
        r.step("place.tshirt.depoisVistaMe", () -> mirror.place(me, piece("t_shirt")));
        r.step("takeOneOff.cap", () -> mirror.takeOneOff(me));
        r.step("vistaMe.semSuperior", () -> mirror.vistaMe(Kit.as(kit.dep(UserRepository.class).save(Kit.user("zeca"))), "praia", null, null, false));
        pureRules(r);
        assertThat(r.text()).isEqualTo(CopilotRetrato.golden(r.text(), Path.of(GOLDEN.toString().replace(".txt", "-local.txt"))));
    }

    private void pureRules(CopilotRetrato r) {
        for (String prompt : List.of("trabalho formal no inverno sem salto", "Work, comfortable, cold", "Trabajo, cómodo, calor", "photo shoot",
                "festa chique e ousada", "algo sofisticado preto", "treino energético no sol", "", "jantar")) {
            r.step("localInterpretation." + prompt, () -> MirrorService.localInterpretation(prompt, List.of(id(1))));
        }
        r.step("localInterpretation.nulo", () -> MirrorService.localInterpretation(null, List.of()));
        r.step("keywords", () -> MirrorService.KEYWORDS.size());
        r.step("hasWord", () -> List.of(MirrorService.hasWord("so hot today", "hot"), MirrorService.hasWord("photo", "hot")));
        for (WardrobeItem w : anaPieces) {
            r.step("slotOf." + w.getSubcategory(), () -> MirrorService.slotOf(w) + "/" + MirrorService.schemeSlot(MirrorService.slotOf(w)));
        }
        List<WardrobeItem> all = anaPieces;
        MirrorService.Interpretation work = MirrorService.localInterpretation("trabalho no frio", List.of(piece("blazer")));
        r.step("localCompose.trabalho", () -> MirrorService.localCompose(work, all, Set.of()).stream().map(WardrobeItem::getId).toList());
        MirrorService.Interpretation party = MirrorService.localInterpretation("festa", List.of(piece("dress")));
        r.step("localCompose.festa", () -> MirrorService.localCompose(party, all, Set.of()).stream().map(WardrobeItem::getId).toList());
        r.step("localCompose.semNada", () -> MirrorService.localCompose(party, all.subList(9, 12), Set.of()).stream().map(WardrobeItem::getId).toList());
        List<WardrobeItem> shoes = all.stream().filter(w -> MirrorService.slotOf(w).equals("shoes")).toList();
        r.step("localAlternatives", () -> MirrorService.localAlternatives(shoes, all.subList(0, 2)));
        r.step("localAlternatives.semContexto", () -> MirrorService.localAlternatives(all.subList(0, 5), List.of()));
        r.step("localTakeOneOff.estampa", () -> MirrorService.localTakeOneOff(all.subList(9, 14), all.subList(0, 14)));
        r.step("localTakeOneOff.cor", () -> MirrorService.localTakeOneOff(List.of(all.get(9), all.get(13)), all.subList(0, 10)));
        for (int[] look : new int[][]{{0, 4}, {3, 6}, {11}, {0, 13}, {17, 5}, {16, 6}}) {
            List<WardrobeItem> l = java.util.Arrays.stream(look).mapToObj(all::get).toList();
            r.step("silhouette." + java.util.Arrays.toString(look), () -> MirrorService.silhouette(l));
        }
        Map<String, Object> slots = new LinkedHashMap<>();
        r.step("missing.vazio", () -> MirrorService.missing(slots));
        slots.put("dress", id(1).toString());
        r.step("missing.vestido", () -> List.of(MirrorService.missing(slots), MirrorService.complete(slots)));
        slots.put("shoes", id(2).toString());
        slots.put("accessory", List.of(id(3).toString(), "lixo", id(4).toString()));
        slots.put("rack", List.of(id(5).toString(), id(5).toString(), "x"));
        r.step("complete", () -> MirrorService.complete(slots) + "/" + MirrorService.allIds(slots) + "/" + MirrorService.rack(slots));
        for (int i = 0; i < 26; i++) {
            MirrorService.addToRack(slots, id(500 + i % 25));
        }
        r.step("rack.teto", () -> MirrorService.rack(slots));
        r.step("single.invalido", () -> String.valueOf(MirrorService.single(Map.of("upper", "nada"), "upper")));
        r.step("key", () -> MirrorService.key(List.of(id(2), id(1))));
        r.step("constantes", () -> List.of(MirrorService.SLOTS, MirrorService.MAX_ACCESSORIES, MirrorService.MAX_SHOWN, MirrorService.MAX_RACK));
    }

    /** Respostas de IA roteirizadas: o parser de cada chamada roda sobre um texto fixo (válido ou que deve ser descartado). */
    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void retratoComRespostasDeIa() throws Exception {
        AiEngine ai = mock(AiEngine.class);
        List<String> script = new ArrayList<>(List.of(
                "{\"alternatives\":[{\"ref\":\"c2\",\"why\":\"combina\"},{\"ref\":\"c99\",\"why\":\"inventada\"},{\"ref\":\"c2\"},{\"ref\":\"c1\"}]}",
                "texto sem json",
                "{\"occasion\":[\"work\",\"inventada\"],\"mood\":\"ELEGANT\",\"anchor_refs\":[\"p2\",\"p99\"],\"constraints\":[\"cold\"],\"season\":\"WINTER\"}",
                "{\"refs\":[\"p1\",\"p99\"]}",
                "{\"occasion\":[],\"mood\":\"TRISTE\",\"season\":\"MONSOON\"}",
                "{\"refs\":[\"p1\",\"p3\",\"p5\"],\"title\":\"x\"}",
                "{}",
                "{\"refs\":[\"p1\",\"p2\",\"p3\",\"p2\"]}",
                "{\"remove_ref\":\"r1\",\"why\":\"o primeiro sai\"}",
                "{\"remove_ref\":\"r9\"}"));
        List<String> calls = new ArrayList<>();
        when(ai.text(any())).thenAnswer(i -> {
            AiEngine.TextCall call = i.getArgument(0);
            String text = script.isEmpty() ? "{}" : script.remove(0);
            Object value = call.parser().apply(text);
            calls.add(call.capability() + ":" + call.system().substring(0, Math.min(30, call.system().length())) + " max=" + call.maxTokens()
                    + " inputs=" + call.inputsUsed() + " parsed=" + (value != null));
            return new AiOutcome<>(value, null, null, value == null, "fake", "m", 1, null, value == null ? "local" : null, null, null);
        });
        MirrorService mirror = setUp(ai);
        CurrentUser me = Kit.as(ana);
        CopilotRetrato r = new CopilotRetrato();
        mirror.place(me, piece("t_shirt"));
        mirror.place(me, piece("jeans"));
        r.step("suggest.shoes.ia", () -> mirror.suggest(me, "shoes"));
        r.step("suggest.accessory.semJson", () -> mirror.suggest(me, "accessory"));
        r.step("vistaMe.ia.descartada", () -> mirror.vistaMe(me, "trabalho", List.of(piece("shirt")), null, false));
        r.step("vistaMe.ia.ok", () -> mirror.vistaMe(me, "algo diferente", List.of(), null, true));
        r.step("vistaMe.ia.ancoraAusente", () -> mirror.vistaMe(me, "outro", List.of(piece("cap")), null, false));
        mirror.place(me, piece("casual_sneakers"));
        mirror.place(me, piece("handbag"));
        r.step("takeOneOff.ia", () -> mirror.takeOneOff(me));
        mirror.place(me, piece("handbag"));
        r.step("takeOneOff.ia.refInvalida", () -> mirror.takeOneOff(me));
        r.step("calls", () -> calls);
        r.calls("audit", kit.dep(Audit.class));
        assertThat(r.text()).isEqualTo(CopilotRetrato.golden(r.text(), Path.of(GOLDEN.toString().replace(".txt", "-ia.txt"))));
    }
}
