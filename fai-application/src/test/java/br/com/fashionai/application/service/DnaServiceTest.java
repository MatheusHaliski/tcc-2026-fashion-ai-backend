package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.DailyLookFeedback;
import br.com.fashionai.domain.model.enums.NarrativeType;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * DNA de Estilo (RF13): a Camada 1 é sintetizada do acervo e dos looks (arquétipo, paleta, silhueta, peça ícone,
 * ousadia), a Identidade de Vida gera a frase, o card PNG sai com marca d'água, e os Esquemas de DNA contam uma história
 * com 2 a 6 looks do próprio usuário — em cada narrativa, com propostas da IA (ou do motor local).
 */
class DnaServiceTest {
    private Kit kit;
    private World world;
    private DnaService dna;
    private CurrentUser ana;
    private List<UUID> looks;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        when(kit.dep(MediaService.class).put(anyString(), any(), anyString()))
                .thenAnswer(i -> new MediaStoragePort.StoredObject(i.getArgument(0), "/media/" + i.getArgument(0), 10, "image/png"));
        when(kit.dep(Guard.class).deny(any(), any(), any())).thenAnswer(i -> new ApiException(403, "NEGADO", "negado"));
        dna = kit.build(DnaService.class);
        ana = Kit.as(world.me);
        looks = world.lookIds(world.me);
        List<Scheme> mine = world.looksOf(world.me);
        mine.get(0).setSeason(Season.SUMMER);
        mine.get(1).setSeason(Season.WINTER);
        for (int i = 0; i < 6; i++) {
            DailyLook dl = new DailyLook();
            dl.setUser(world.me);
            dl.setScheme(mine.get(i));
            dl.setLookDate(LocalDate.now().minusDays(i));
            dl.setFeedback(DailyLookFeedback.ADOREI);
            kit.dep(DailyLookRepository.class).save(dl);
        }
    }

    private DnaService.DnaSchemeForm form(String title, NarrativeType nt, String layout, int cells, boolean milestone) {
        List<DnaService.DnaCellForm> cs = new ArrayList<>();
        for (int i = 0; i < cells; i++) {
            cs.add(new DnaService.DnaCellForm(looks.get(i), "Época " + (i + 1), milestone && i == 1));
        }
        return new DnaService.DnaSchemeForm(title, cs, layout, "DNA_COMPLETO", nt, "casual", "streetwear", null, Visibility.PUBLIC,
                Map.of("color", "#112233", "backgroundVideoUrl", "/media/v.mp4"), true, "AI");
    }

    @Test
    void visaoGeralSintetizaACamadaUmSemPreRequisito() {
        Map<String, Object> o = dna.overview(ana);
        assertThat(map(o.get("prerequisites"))).containsEntry("ready", true);
        assertThat(map(o.get("dna"))).isNotEmpty();
        assertThat((List<?>) o.get("versions")).isNotEmpty();
        // muitas interações novas: a Camada 1 é recalculada (evolução)
        for (int i = 0; i < 12; i++) {
            kit.dep(WardrobeItemRepository.class).save(Kit.piece(world.me, "nova " + i, "upper_piece", "t_shirt", "black"));
        }
        assertThat(dna.overview(ana)).containsKey("dna");
        // quem tem pouco acervo também ganha o DNA, com a nota de precisão
        User nova = kit.dep(UserRepository.class).save(Kit.user("nova"));
        assertThat(dna.overview(Kit.as(nova))).containsKey("precisionNote");
    }

    @Test
    void identidadeDeVidaGeraAFraseECampoPrivadoSaiDoCard() {
        Map<String, List<String>> life = new LinkedHashMap<>();
        life.put("places", List.of("Recife", "Lisboa"));
        life.put("animals", List.of("Pipoca (gata)"));
        life.put("objects", List.of("violão", "café"));
        Map<String, Object> v = dna.generate(ana, new DnaService.LifeForm(life, List.of("animals"), false));
        assertThat(v).isNotEmpty();
        assertThat(dna.generate(ana, new DnaService.LifeForm(null, null, true))).containsKey("notice");
        assertThatThrownBy(() -> dna.generate(ana, new DnaService.LifeForm(Map.of("inventado", List.of("x")), null, false))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> dna.generate(ana, new DnaService.LifeForm(Map.of("animals", List.of("a", "b", "c")), null, false))).isInstanceOf(ApiException.class);
        assertThat(dna.updateLife(ana, new DnaService.LifeForm(Map.of("people", List.of("Vó Lia")), List.of(), false))).isNotEmpty();
        assertThat(dna.setPrivateFields(ana, List.of("people"))).isNotEmpty();
        Map<String, Object> card = dna.shareCard(ana);
        assertThat(String.valueOf(card.get("url"))).endsWith(".png");
        assertThat(card).containsEntry("watermark", "Fashion AI");
        assertThat(dna.setColorSeason(ana, "autumn")).isNotEmpty();
        assertThatThrownBy(() -> dna.setColorSeason(ana, "MONSOON")).isInstanceOf(ApiException.class);
        assertThat(dna.socialProof(ana)).containsEntry("minGroup", DnaService.SOCIAL_PROOF_MIN);
    }

    @Test
    void semDnaGeradoAsEdicoesSaoNegadas() {
        CurrentUser bia = Kit.as(world.rival);
        assertThatThrownBy(() -> dna.updateLife(bia, new DnaService.LifeForm(Map.of(), null, false))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> dna.setPrivateFields(bia, List.of())).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> dna.shareCard(bia)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> dna.setColorSeason(bia, "SPRING")).isInstanceOf(ApiException.class);
        assertThat((List<?>) dna.socialProof(bia).get("items")).isEmpty();
    }

    @Test
    void esquemasDeDnaEmCadaNarrativa() {
        for (NarrativeType nt : NarrativeType.values()) {
            Map<String, Object> d = dna.createDnaScheme(ana, form("DNA " + nt, nt, "GRADE", 4, nt == NarrativeType.MOMENTOS_MARCANTES));
            assertThat(d).containsKey("id");
            Map<String, Object> got = dna.getDnaScheme(Kit.as(world.rival), (UUID) d.get("id"));
            assertThat(got.get("id")).isEqualTo(d.get("id"));
        }
        Map<String, Object> plain = dna.createDnaScheme(ana, form("Só anatomia", null, "LATERAL", 6, false));
        UUID id = (UUID) plain.get("id");
        assertThat(dna.myDnaSchemes(ana)).hasSize(NarrativeType.values().length + 1);
        Map<String, Object> updated = dna.updateDnaScheme(ana, id, new DnaService.DnaSchemeForm("Novo título", null, "HORIZONTAL", "ESQUEMA", null,
                null, null, Season.SPRING, Visibility.FOLLOWERS, null, true, null));
        assertThat(updated).containsKey("id");
        dna.deleteDnaScheme(ana, id);
        assertThat(dna.myDnaSchemes(ana)).hasSize(NarrativeType.values().length);
    }

    @Test
    void regrasDoConstrutorDeDna() {
        assertThatThrownBy(() -> dna.createDnaScheme(ana, form("Uma célula", null, "GRADE", 1, false))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> dna.createDnaScheme(ana, form("Layout", null, "REDONDO", 3, false))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> dna.createDnaScheme(ana, new DnaService.DnaSchemeForm("Alvo", form("x", null, "GRADE", 2, false).cells(), null,
                "NADA", null, null, null, null, null, null, false, null))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> dna.createDnaScheme(ana, new DnaService.DnaSchemeForm("Narrativa sem DNA completo", form("x", null, "GRADE", 2, false).cells(),
                null, "ESQUEMA", NarrativeType.TIMELINE, null, null, null, null, null, false, null))).isInstanceOf(ApiException.class);
        List<DnaService.DnaCellForm> twoMilestones = List.of(new DnaService.DnaCellForm(looks.get(0), null, true), new DnaService.DnaCellForm(looks.get(1), null, true));
        assertThatThrownBy(() -> dna.createDnaScheme(ana, new DnaService.DnaSchemeForm("Dois marcos", twoMilestones, null, null, null, null, null, null, null, null,
                false, null))).isInstanceOf(ApiException.class);
        List<DnaService.DnaCellForm> repeated = List.of(new DnaService.DnaCellForm(looks.get(0), null, false), new DnaService.DnaCellForm(looks.get(0), null, false));
        assertThatThrownBy(() -> dna.createDnaScheme(ana, new DnaService.DnaSchemeForm("Repetido", repeated, null, null, null, null, null, null, null, null,
                false, null))).isInstanceOf(ApiException.class);
        // rascunho de outra pessoa não aparece
        Map<String, Object> draft = dna.createDnaScheme(ana, new DnaService.DnaSchemeForm("Rascunho", form("x", null, "GRADE", 2, false).cells(), null, null, null,
                null, null, null, Visibility.PUBLIC, null, false, null));
        assertThatThrownBy(() -> dna.getDnaScheme(Kit.as(world.rival), (UUID) draft.get("id"))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> dna.getDnaScheme(ana, UUID.randomUUID())).isInstanceOf(ApiException.class);
    }

    @Test
    void construtorPreviaEPropostasDaIa() {
        Map<String, Object> b = dna.builder(ana);
        assertThat(b).containsEntry("status", "PRONTO").containsKeys("layouts", "narratives", "steps");
        assertThat(dna.builder(Kit.as(kit.dep(UserRepository.class).save(Kit.user("vazia"))))).containsEntry("status", "INSUFICIENTE");
        Map<String, Object> preview = dna.preview(ana, form("", NarrativeType.PALETA_DOMINANTE, null, 3, false));
        assertThat(preview).isNotEmpty();

        for (NarrativeType nt : NarrativeType.values()) {
            Map<String, Object> c = dna.compositions(ana, new DnaService.DnaComposeRequest("cores quentes", List.of("casual"), List.of("streetwear"), nt, Season.AUTUMN));
            assertThat((List<?>) c.get("compositions")).isNotEmpty();
        }
        assertThat((List<?>) dna.compositions(ana, null).get("compositions")).isNotEmpty();
        assertThatThrownBy(() -> dna.compositions(Kit.as(world.person("gabi", 1)), null)).isInstanceOf(ApiException.class);
    }

    @Test
    void propostasDaIaLidasDoJson() {
        Map<String, Scheme> byRef = new LinkedHashMap<>();
        List<Scheme> mine = world.looksOf(world.me);
        for (int i = 0; i < mine.size(); i++) {
            byRef.put("s" + (i + 1), mine.get(i));
        }
        String json = """
                {"compositions":[
                  {"title":"Minha história","narrativeType":"MOMENTOS_MARCANTES","cardLayout":"GRADE","refs":["s1","s2","s9"],
                   "eraLabels":{"s1":"2024 · primeiro emprego"},"milestone":null,"occasion":["casual","inventada"],"style":["streetwear"],"rationale":"Porque sim."},
                  {"title":"Cartela","narrativeType":"CARTELA_SAZONAL","cardLayout":"X","refs":["s3","s4"]},
                  {"title":"Inválida","refs":["s1"]},
                  {"refs":["s5","s6"],"narrativeType":"NAO_EXISTE"}
                ]}""";
        List<DnaService.DnaProposal> ps = dna.parseProposals(json, byRef);
        assertThat(ps).hasSize(3);
        assertThat(ps.get(0).cells()).hasSize(2);
        assertThat(ps.get(0).cells().get(0).milestone()).isTrue();
        assertThat(ps.get(1).seasonalTheme()).isEqualTo(Season.AUTUMN);
        assertThat(ps.get(1).cardLayout()).isEqualTo("AMPLIADO");
        assertThat(dna.parseProposals("sem json", byRef)).isNull();
        assertThat(DnaService.harmony(List.of("#ff0000", "#00ff00", "#0000ff"))).isNotBlank();
        assertThat(DnaService.harmony(List.of())).isNotNull();
        assertThat(DnaService.spread(mine, 3)).hasSize(3);
        assertThat(DnaService.enumOr(Season.class, "winter", Season.SPRING)).isEqualTo(Season.WINTER);
        assertThat(DnaService.enumOr(Season.class, 42, Season.SPRING)).isEqualTo(Season.SPRING);
        assertThat(mine.get(0).getStatus()).isEqualTo(SchemeStatus.PUBLISHED);
    }
}
