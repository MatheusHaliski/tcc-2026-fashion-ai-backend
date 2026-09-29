package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.assets.PieceReferenceCatalog;
import br.com.fashionai.application.imaging.FlatLayPipeline;
import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.imaging.LocalVision;
import br.com.fashionai.application.imaging.StudioPipeline;
import br.com.fashionai.application.imaging.SubtypeReferences;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.PipelineJob;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AiCallResult;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.PipelineJobRepository;
import br.com.fashionai.domain.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * RF4 — a análise inteira ({@code WardrobeService.analyze}) com o pipeline de imagem real e a IA simulada: o que vai
 * para o analisador (peça + folha de referências do tipo escolhido + as 4 zonas da marca, nessa ordem), a marca lida
 * no peito esquerdo chegando ao pré-preenchimento, e a recusa quando a IA diz que a foto não é do tipo escolhido.
 */
class WardrobeAnalyzeFlowTest {
    static final File ASSETS = new File("../public/assets_pecas");
    final List<AiEngine.TextCall<?>> analyzerCalls = new ArrayList<>();
    String analyzerAnswer;
    WardrobeService service;
    CurrentUser user;

    @BeforeEach
    @SuppressWarnings({"unchecked", "rawtypes"})
    void setUp() throws Exception {
        File manifest = new File("../fai-web/src/main/resources/catalog/asset-manifest.json");
        assumeTrue(ASSETS.isDirectory() && manifest.isFile(), "assets de peças fora do checkout");
        Map<String, Object> m = new ObjectMapper().readValue(manifest, Map.class);
        Map<String, Map<String, String>> bySub = (Map<String, Map<String, String>>) ((Map<String, Object>) m.get("defaultPieceImages")).get("bySubcategory");
        List<SubtypeReferences.Reference> refs = new ArrayList<>();
        for (var e : bySub.entrySet()) {
            if ("upper_piece".equals(e.getValue().get("category"))) {
                refs.add(SubtypeReferences.reference(e.getKey(), "upper_piece", ImageOps.toArgb(ImageIO.read(new File("../public" + e.getValue().get("url"))))));
            }
        }
        PieceReferenceCatalog catalog = mock(PieceReferenceCatalog.class);
        when(catalog.get()).thenReturn(new SubtypeReferences(refs));

        User owner = new User();
        owner.assignId(UUID.randomUUID());
        user = new CurrentUser(owner.getId(), "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
        UserRepository users = mock(UserRepository.class);
        when(users.findById(owner.getId())).thenReturn(Optional.of(owner));
        PipelineJobRepository jobs = mock(PipelineJobRepository.class);
        when(jobs.save(any())).thenAnswer(inv -> {
            PipelineJob j = inv.getArgument(0);
            j.assignId(UUID.randomUUID());
            return j;
        });
        MediaService media = mock(MediaService.class);
        when(media.put(anyString(), any(), anyString())).thenAnswer(inv ->
                new MediaStoragePort.StoredObject(inv.getArgument(0), "http://media/" + inv.getArgument(0), 1, inv.getArgument(2)));

        AiEngine ai = mock(AiEngine.class);
        // pipeline de imagem e estúdio: sempre o motor local (o de verdade)
        when(ai.execute(any(), any(), any(), any(), any(), any(), any())).thenAnswer(inv ->
                outcome(((Supplier<?>) inv.getArgument(6)).get(), "local"));
        when(ai.text(any())).thenAnswer(inv -> {
            AiEngine.TextCall<?> call = inv.getArgument(0);
            if (call.capability() == AiCapability.CONTENT_MODERATOR) {
                return outcome(new LocalVision.ModerationVerdict(ModerationStatus.APPROVED, 0.95, List.of(), false), "claude");
            }
            analyzerCalls.add(call);
            return outcome(call.parser().apply(analyzerAnswer), "claude");
        });
        service = new WardrobeService(null, users, null, jobs, null, null, null, null, null, null, null, null,
                new FlatLayPipeline(List.of(), List.of()), ai, media, null, null, null, null, null,
                new StudioPipeline(List.of(), List.of()), mock(br.com.fashionai.application.security.Guard.class), null, null, null, null, catalog, null);
    }

    static AiOutcome<Object> outcome(Object value, String provider) {
        return new AiOutcome<>(value, UUID.randomUUID(), AiCallResult.values()[0], false, provider, "m", 1, BigDecimal.ZERO, null, null, null);
    }

    static byte[] teePhoto() throws Exception {
        BufferedImage tee = ImageOps.toArgb(ImageIO.read(new File(ASSETS, "01_Parte_superior/01_camiseta_referencia.png")));
        BufferedImage photo = new BufferedImage(1400, 1400, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = photo.createGraphics();
        g.setColor(new Color(236, 236, 232));
        g.fillRect(0, 0, 1400, 1400);
        double s = 0.7 * 1400 / Math.max(tee.getWidth(), tee.getHeight());
        g.drawImage(tee, (int) (700 - tee.getWidth() * s / 2), (int) (700 - tee.getHeight() * s / 2), (int) (tee.getWidth() * s), (int) (tee.getHeight() * s), null);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(photo, "jpg", out);
        return out.toByteArray();
    }

    @Test
    void marcaLidaNoPeitoEsquerdoChegaAoPreenchimento() throws Exception {
        analyzerAnswer = """
                {"name": "Camiseta azul com selo", "matchesCategory": true, "detectedCategory": "upper_piece",
                 "subcategory": "t_shirt", "subcategoryRanking": [{"code": "t_shirt", "similarity": 0.95}, {"code": "polo_shirt", "similarity": 0.7}],
                 "color": "blue", "material": "COTTON", "sex": "UNISSEX", "occasion": ["casual"], "style": ["basic", "sporty"],
                 "brand": "Fashion AI", "brandZone": "peito_esquerdo", "brandEvidence": "selo FAI bordado",
                 "photo": {"fullyVisible": true, "viewAngle": "frontal_90", "singlePiece": true},
                 "confidence": {"category": 0.97, "subcategory": 0.9, "color": 0.9, "material": 0.6, "brand": 0.9, "photo": 0.9},
                 "logo": null}""";
        WardrobeService.Draft d = service.analyze(user, teePhoto(), "upper_piece");

        AiEngine.TextCall<?> call = analyzerCalls.get(0);
        // 1 peça inteira + 1 folha de referências + 4 zonas da marca, nessa ordem, e o prompt diz isso
        assertThat(call.images()).hasSize(6);
        assertThat(call.images().get(1).mimeType()).isEqualTo("image/png");
        assertThat(call.prompt()).contains("Tipo escolhido pela pessoa: upper_piece")
                .contains("2 = folha de referências (1 = t_shirt").contains("3 = zona de marca \"gola\"")
                .contains("4 = zona de marca \"peito_esquerdo\"").contains("6 = zona de marca \"centro_peito\"");
        assertThat(call.system()).contains("fundo da gola").contains("peito esquerdo de quem veste");

        WardrobeService.Prefill p = d.prefill();
        assertThat(p.brand()).isEqualTo("Fashion AI");
        assertThat(p.brandSearch()).containsEntry("foundIn", "peito_esquerdo").containsEntry("evidence", "selo FAI bordado");
        assertThat((List<?>) p.brandSearch().get("zones")).hasSize(4);
        assertThat(p.category()).isEqualTo("upper_piece");
        assertThat(p.subcategory()).isEqualTo("t_shirt");
        assertThat(p.style()).containsExactly("basic", "sporty");
        assertThat(p.subcategoryCandidates()).extracting(c -> c.get("code")).startsWith("t_shirt");
        assertThat(p.photoChecks()).extracting(c -> c.get("id")).contains("inteira", "frontal", "formato");
        // estúdio no padrão do card: quadrado
        assertThat(((Map<?, ?>) d.studio().get("framing")).get("aspect")).isEqualTo("1:1");
    }

    @Test
    void iaDizendoQueNaoEOTipoEscolhidoRecusaAFoto() throws Exception {
        analyzerAnswer = """
                {"matchesCategory": false, "detectedCategory": "shoes_piece", "subcategory": "t_shirt",
                 "photo": {"fullyVisible": true, "viewAngle": "frontal_90", "singlePiece": true},
                 "confidence": {"category": 0.92, "photo": 0.9}}""";
        assertThatThrownBy(() -> service.analyze(user, teePhoto(), "upper_piece"))
                .isInstanceOf(PhotoRejectedException.class)
                .hasMessageContaining("não parece ser de Parte superior").hasMessageContaining("Calçados");
    }

    @Test
    void iaVendoAPecaCortadaRecusaAFoto() throws Exception {
        analyzerAnswer = """
                {"matchesCategory": true, "detectedCategory": "upper_piece", "subcategory": "t_shirt",
                 "photo": {"fullyVisible": false, "viewAngle": "angulo", "singlePiece": true},
                 "confidence": {"category": 0.95, "photo": 0.85}}""";
        assertThatThrownBy(() -> service.analyze(user, teePhoto(), "upper_piece"))
                .isInstanceOf(PhotoRejectedException.class)
                .satisfies(e -> assertThat(((PhotoRejectedException) e).details().get("failed")).isEqualTo(List.of("inteira_ia", "frontal_ia")));
    }
}
