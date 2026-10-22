package br.com.fashionai.application.catalog.image;

import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CatalogPreviewRendererTest {
    private final CatalogImagePipeline pipeline = new CatalogImagePipeline(SemanticRegionRegistry.get(), null);

    @Test
    void oneAnalysisProducesFabricAndWholeFromTheSameMaskWithoutInventingPixels() {
        BufferedImage source = CatalogPhotos.tee(200, 200, 1);
        var analysis = pipeline.run(new CatalogImagePipeline.Request(CatalogPhotos.png(source), "upper_piece", "t_shirt", "PACKSHOT", true));
        var frames = analysis.previewFrames();
        assertThat(frames).isNotNull();
        assertThat(frames.fabric()).isNotNull(); assertThat(frames.whole()).isNotNull();
        assertThat(frames.fabric().getWidth() * 4).isEqualTo(frames.fabric().getHeight() * 3);
        assertThat(frames.whole().getWidth() * 4).isEqualTo(frames.whole().getHeight() * 3);
        assertThat(frames.whole().getWidth()).isLessThanOrEqualTo(900);
        assertThat(frames.wholeMetadata()).containsEntry("box", Map.of("x", 0.0, "y", 0.0, "w", 1.0, "h", 1.0));
        assertThat(frames.wholeMetadata()).containsKey("productBox");
        assertThat(frames.wholeUnavailableReason()).isNull();
        int center = frames.whole().getRGB(frames.whole().getWidth() / 2, frames.whole().getHeight() / 2) & 0xffffff;
        assertThat(center).isEqualTo(CatalogPhotos.NAVY.getRGB() & 0xffffff);
        assertThat(frames.whole().getRGB(0, 0) & 0xffffff).isEqualTo(BackgroundNormalizer.NEUTRAL.getRGB() & 0xffffff);
        assertThat(analysis.stages().stream().filter(s -> s.name().equals("SEGMENTATION"))).hasSize(1);
    }

    @Test
    void referenceOnlyAnalysisDoesNotGeneratePersistentDerivatives() {
        var analysis = pipeline.run(new CatalogImagePipeline.Request(CatalogPhotos.png(CatalogPhotos.tee(200, 200, 1)),
                "upper_piece", "t_shirt", "PACKSHOT", false));
        assertThat(analysis.previewFrames()).isNull();
    }

    @Test
    void personEvidenceNeverProducesAWholeImageAndReasonCanBeCached() {
        BufferedImage source = CatalogPhotos.tee(200, 200, 1);
        var seg = new ProductSegmenter().segment(source, PieceType.UPPER_PIECE);
        var frame = ProductRuleFrame.find(seg, PieceType.UPPER_PIECE, "t_shirt", SemanticRegionRegistry.get());
        assertThat(frame.ok()).isTrue();
        var frames = CatalogPreviewRenderer.render(source, seg, seg.productOnly(), frame, .1, false);
        assertThat(frames.fabric()).isNotNull();
        assertThat(frames.whole()).isNull();
        assertThat(frames.wholeUnavailableReason()).isEqualTo("PERSON_IN_SOURCE");
    }

    @Test
    void unverifiedEarlyCropCannotMasqueradeAsFabric() {
        BufferedImage source=CatalogPhotos.studio(300,400,240);
        assertThat(CatalogPreviewRenderer.fabricFrom(CatalogPhotos.png(source),Map.of("ok",true,"crop",Map.of("x",0,"y",0,"w",1,"h",1)))).isNull();
    }
    @Test
    void fabricIsEntirelyInsideMaskEvenWhenCategoryCropIncludesBackground() {
        BufferedImage source=new BufferedImage(300,400,BufferedImage.TYPE_INT_RGB),mask=new BufferedImage(300,400,BufferedImage.TYPE_INT_ARGB);
        for(int y=0;y<400;y++)for(int x=0;x<300;x++) {source.setRGB(x,y,Color.WHITE.getRGB());if(x>60&&x<240&&y>70&&y<330) {source.setRGB(x,y,Color.BLUE.getRGB());mask.setRGB(x,y,Color.BLUE.getRGB());}}
        BufferedImage out=CatalogPreviewRenderer.maskedFabric(source,mask,new NRect(0,0,1,1));assertThat(out).isNotNull();
        for(int y=0;y<out.getHeight();y++)for(int x=0;x<out.getWidth();x++)assertThat(out.getRGB(x,y)&0xffffff).isEqualTo(Color.BLUE.getRGB()&0xffffff);
    }
}
