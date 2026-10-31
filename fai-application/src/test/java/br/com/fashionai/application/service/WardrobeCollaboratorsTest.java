package br.com.fashionai.application.service;

import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.imaging.FlatLayPipeline;
import br.com.fashionai.application.imaging.StudioPipeline;
import br.com.fashionai.application.taxonomy.TaxonomyRegistry;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ItemCondition;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.PhotoProcessingStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import org.junit.jupiter.api.Test;

import java.awt.image.BufferedImage;
import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Colaboradores extraídos do {@link WardrobeService} no lote R02 que não tinham teste direto: a cópia de peça
 * (Prototype), o adapter do Flat Lay remoto, as regras puras do estúdio, o Hype do closet e a conversão de subcategoria
 * legada (que reescreve o formulário inteiro e não pode perder nenhum campo).
 */
class WardrobeCollaboratorsTest {

    @Test
    void copiaDePecaPublicaLevaCatalogoImagemEEstudioENaoLevaUsoNemEstado() {
        User dona = new User();
        dona.assignId(UUID.randomUUID());
        User quemCopia = new User();
        quemCopia.assignId(UUID.randomUUID());
        quemCopia.setProfileVisibility(Visibility.FOLLOWERS);
        WardrobeItem src = new WardrobeItem();
        src.assignId(UUID.randomUUID());
        src.setUser(dona);
        src.setName("Jaqueta jeans");
        src.setCategory("upper_piece");
        src.setSubcategory("jacket");
        src.setSex("UNISSEX");
        src.setBrandName("Levi's");
        src.setColor("blue");
        src.setMaterial("DENIM");
        src.setSizeLabel("m");
        src.setMarket("SS26");
        src.setOccasionTags("casual");
        src.setStyleTags("basic");
        src.setPrice(new BigDecimal("199"));
        src.setImageUrl("/m/a.png");
        src.setThumbnailUrl("/m/a-thumb.png");
        src.setStudioImageUrl("/m/studio.jpg");
        src.setStudioBackdrop("white");
        src.setStudioDetailUrl("/m/detail.jpg");
        src.setDefaultImage(false);
        src.setModerationStatus(ModerationStatus.APPROVED);
        src.setPhotoProcessingStatus(PhotoProcessingStatus.PROCESSING);
        src.setVisibility(Visibility.PUBLIC);
        src.setWearCount(7);
        src.setFavorite(true);
        src.setForSale(true);

        WardrobeItem copy = PieceCopy.of(src, quemCopia);

        assertThat(copy).isNotSameAs(src);
        assertThat(copy.getUser()).isSameAs(quemCopia);
        assertThat(copy.getId()).isNull();
        assertThat(copy.getRemixedFromPieceId()).isEqualTo(src.getId());
        assertThat(List.of(copy.getName(), copy.getCategory(), copy.getSubcategory(), copy.getSex(), copy.getBrandName(),
                copy.getColor(), copy.getMaterial(), copy.getSizeLabel(), copy.getMarket(), copy.getOccasionTags(),
                copy.getStyleTags(), copy.getImageUrl(), copy.getThumbnailUrl(), copy.getStudioImageUrl(),
                copy.getStudioBackdrop(), copy.getStudioDetailUrl()))
                .containsExactly("Jaqueta jeans", "upper_piece", "jacket", "UNISSEX", "Levi's", "blue", "DENIM", "m", "SS26",
                        "casual", "basic", "/m/a.png", "/m/a-thumb.png", "/m/studio.jpg", "white", "/m/detail.jpg");
        assertThat(copy.getPrice()).isEqualByComparingTo("199");
        assertThat(copy.getModerationStatus()).isEqualTo(ModerationStatus.APPROVED);
        // a cópia nasce pronta e com a visibilidade padrão de quem copia, não a da origem
        assertThat(copy.getPhotoProcessingStatus()).isEqualTo(PhotoProcessingStatus.COMPLETED);
        assertThat(copy.getVisibility()).isEqualTo(Visibility.FOLLOWERS);
        assertThat(copy.getWearCount()).isZero();
        assertThat(copy.isFavorite()).isFalse();
        assertThat(copy.isForSale()).isFalse();
    }

    @Test
    void flatLayRemotoAdaptaOPipelineAoMotorDeIa() {
        FlatLayPipeline flatLay = mock(FlatLayPipeline.class);
        when(flatLay.externalAvailable()).thenReturn(true, false);
        FlatLayRemoteStep step = new FlatLayRemoteStep(flatLay, new byte[]{1, 2, 3});

        assertThat(step.provider()).isEqualTo("rembg/remove.bg+cloudinary");
        assertThat(step.model()).isEqualTo("flat-lay-hybrid");
        assertThat(step.available()).isTrue();
        assertThat(step.available()).isFalse();
    }

    @Test
    void transparenciaSoContaNaBordaDeImagemComAlfa() {
        BufferedImage opaca = new BufferedImage(20, 20, BufferedImage.TYPE_INT_RGB);
        assertThat(PieceStudioHints.hasTransparency(opaca)).isFalse();

        BufferedImage cheia = new BufferedImage(20, 20, BufferedImage.TYPE_INT_ARGB);
        for (int y = 0; y < 20; y++) {
            for (int x = 0; x < 20; x++) {
                cheia.setRGB(x, y, 0xFF336699);
            }
        }
        assertThat(PieceStudioHints.hasTransparency(cheia)).isFalse();

        cheia.setRGB(0, 8, 0x00000000);                      // borda esquerda transparente (linha amostrada a cada 4)
        assertThat(PieceStudioHints.hasTransparency(cheia)).isTrue();
    }

    @Test
    void fundosDoEstudioComecamPeloAutomatico() {
        List<Map<String, Object>> fundos = PieceStudioHints.backdrops();

        assertThat(fundos).hasSize(StudioPipeline.BACKDROPS.size() + 1);
        assertThat(fundos.get(0)).containsEntry("id", "auto").containsKey("label");
        assertThat(fundos.get(1)).containsKeys("id", "label", "hex", "edge");
        assertThat((String) fundos.get(1).get("edge")).matches("#[0-9A-F]{6}");
    }

    @Test
    void faixaMinimaDeHypeUsaOsLimiaresDaConfiguracao() {
        HypeScoreConfig config = mock(HypeScoreConfig.class);
        when(config.levelThresholds()).thenReturn(new int[]{10, 30, 50, 70, 90});
        ClosetHype hype = new ClosetHype(mock(HypeScoreCurrentRepository.class), config);

        assertThat(List.of("niche", "RELEVANT", "Hot", "TRENDING", "viral", "outro").stream().map(hype::minimum).toList())
                .containsExactly(10, 30, 50, 70, 90, 0);
    }

    @Test
    void semConfiguracaoOuSemPecasNaoConsultaHype() {
        HypeScoreCurrentRepository repo = mock(HypeScoreCurrentRepository.class);
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());

        assertThat(new ClosetHype(repo, null).scores(List.of(w), true)).isEmpty();
        assertThat(new ClosetHype(repo, mock(HypeScoreConfig.class)).scores(List.of(), true)).isEmpty();
        verifyNoInteractions(repo);
    }

    @Test
    void subcategoriaLegadaPreservaTodosOsOutrosCamposDoFormulario() throws Exception {
        TaxonomyRegistry reg = TaxonomyRegistry.get();
        var legacy = reg.legacySubcategories().stream().filter(l -> reg.resolve(l.code()) != null).findFirst().orElseThrow();
        WardrobeService.PieceForm f = new WardrobeService.PieceForm(UUID.randomUUID(), true, "Peça", legacy.category(), legacy.code(),
                "UNISSEX", UUID.randomUUID(), "Marca", "white", "COTTON", "m", "SS26", List.of("casual"), List.of("basic"),
                List.of("selo"), new BigDecimal("10"), Visibility.PUBLIC, List.of("tag"), "nota", ItemCondition.GOOD,
                LocalDate.of(2026, 1, 2), "Loja", "SKU1", "Lavar à mão", true, false, "/logo.png", "WEB", "ref",
                Map.of("aura", "x"), UUID.randomUUID(), null, Map.of(), List.of("name"), UUID.randomUUID(), true);

        WardrobeService.PieceForm r = PieceTaxonomyWriter.resolveLegacy(f);

        assertThat(r).isNotSameAs(f);
        assertThat(r.subcategory()).isEqualTo(reg.resolve(legacy.code()).subcategory());
        Set<String> derivados = Set.of("subcategory", "material", "variation", "attributes");
        for (RecordComponent c : WardrobeService.PieceForm.class.getRecordComponents()) {
            if (!derivados.contains(c.getName())) {
                assertThat(c.getAccessor().invoke(r)).as(c.getName()).isEqualTo(c.getAccessor().invoke(f));
            }
        }
        assertThat(f.resolveTaxonomy()).isEqualTo(r);
    }
}
