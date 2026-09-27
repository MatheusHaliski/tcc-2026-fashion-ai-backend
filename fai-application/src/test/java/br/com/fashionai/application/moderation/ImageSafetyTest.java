package br.com.fashionai.application.moderation;

import br.com.fashionai.application.imaging.ImageOps;
import br.com.fashionai.application.moderation.ImageSafety.Decision;
import br.com.fashionai.application.moderation.ImageSafetyPorts.Likelihoods;
import br.com.fashionai.application.moderation.ImageSafetyPorts.PersonParts;
import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Regras de decisão da moderação de fotos enviadas (docs/seguranca/moderacao-de-imagens.md §4). */
class ImageSafetyTest {

    private static byte[] photo() {
        BufferedImage img = new BufferedImage(320, 480, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(0x3355AA));
        g.fillRect(0, 0, 320, 480);
        g.dispose();
        return ImageOps.jpeg(img, 0.9f);
    }

    private static ImageSafetyPorts.RemoteClassifierPort remote(Optional<Likelihoods> answer, AtomicInteger calls) {
        return new ImageSafetyPorts.RemoteClassifierPort() {
            public String name() {
                return "remoto-falso";
            }

            public boolean available() {
                return true;
            }

            public Optional<Likelihoods> classify(byte[] jpeg) {
                calls.incrementAndGet();
                return answer;
            }
        };
    }

    private static ImageSafetyPorts.PersonSegmentationPort local(PersonParts parts) {
        return new ImageSafetyPorts.PersonSegmentationPort() {
            public boolean available() {
                return true;
            }

            public Optional<PersonParts> segment(BufferedImage image) {
                return Optional.of(parts);
            }
        };
    }

    @Test
    void safeSearchDecideBloqueioRevisaoELiberacao() {
        assertEquals(Decision.BLOCK, ImageSafety.fromLikelihoods("g", new Likelihoods(4, 2, 1)).decision());
        assertEquals(Decision.BLOCK, ImageSafety.fromLikelihoods("g", new Likelihoods(5, 5, 1)).decision());
        assertEquals(Decision.REVIEW, ImageSafety.fromLikelihoods("g", new Likelihoods(3, 2, 1)).decision());
        assertEquals(Decision.REVIEW, ImageSafety.fromLikelihoods("g", new Likelihoods(2, 5, 1)).decision());
        assertEquals(Decision.REVIEW, ImageSafety.fromLikelihoods("g", new Likelihoods(1, 1, 5)).decision());
        // roupa de praia costuma vir "racy provável": não é retida só por isso
        assertEquals(Decision.ALLOW, ImageSafety.fromLikelihoods("g", new Likelihoods(2, 4, 1)).decision());
        assertEquals(Decision.ALLOW, ImageSafety.fromLikelihoods("g", new Likelihoods(1, 1, 1)).decision());
    }

    @Test
    void segmentacaoLocalSoRetemNuncaRecusa() {
        // pessoa grande com mais de 40% de pele do corpo: revisão humana
        assertEquals(Decision.REVIEW, ImageSafety.fromParts(new PersonParts(0.35, 0.55, 0.05, 0.10)).decision());
        // foto vestida (máximo medido nas fotos vestidas: 0,31)
        assertEquals(Decision.ALLOW, ImageSafety.fromParts(new PersonParts(0.40, 0.31, 0.08, 0.50)).decision());
        // pessoa pequena na foto: a medida não vale (ex.: peça em cima da cama com alguém ao fundo)
        assertEquals(Decision.ALLOW, ImageSafety.fromParts(new PersonParts(0.06, 0.60, 0.02, 0.10)).decision());
        for (double skin = 0; skin <= 1; skin += 0.05) {
            assertTrue(ImageSafety.fromParts(new PersonParts(0.5, skin, 0, 0)).decision() != Decision.BLOCK);
        }
    }

    @Test
    void classificadorRemotoVemPrimeiroQuandoLigado() {
        AtomicInteger calls = new AtomicInteger();
        ImageSafety s = new ImageSafety(List.of(remote(Optional.of(new Likelihoods(5, 5, 1)), calls)),
                List.of(local(new PersonParts(0.3, 0.1, 0.1, 0.6))), true);
        ImageSafety.Verdict v = s.check(photo());
        assertEquals(Decision.BLOCK, v.decision());
        assertEquals("remoto-falso", v.engine());
        assertEquals(1, calls.get());
    }

    @Test
    void semIaRemotaUsaASegmentacaoLocal() {
        AtomicInteger calls = new AtomicInteger();
        ImageSafety s = new ImageSafety(List.of(remote(Optional.of(new Likelihoods(5, 5, 1)), calls)),
                List.of(local(new PersonParts(0.3, 0.6, 0.1, 0.1))), false);
        ImageSafety.Verdict v = s.check(photo());
        assertEquals(Decision.REVIEW, v.decision());
        assertEquals("segmentacao-local", v.engine());
        assertEquals(0, calls.get(), "AI_REMOTE_ENABLED=false: a foto não sai do servidor");
    }

    @Test
    void remotoSemRespostaCaiNaSegmentacaoLocal() {
        ImageSafety s = new ImageSafety(List.of(remote(Optional.empty(), new AtomicInteger())),
                List.of(local(new PersonParts(0.3, 0.2, 0.1, 0.6))), true);
        assertEquals(Decision.ALLOW, s.check(photo()).decision());
    }

    @Test
    void semNenhumClassificadorFicaEmRevisao() {
        ImageSafety s = new ImageSafety(List.of(), List.of(), true);
        ImageSafety.Verdict v = s.check(photo());
        assertEquals(Decision.REVIEW, v.decision());
        assertTrue(v.held());
    }

    @Test
    void arquivoQueNaoEImagemNaoEAvaliado() {
        ImageSafety s = new ImageSafety(List.of(), List.of(), true);
        ImageSafety.Verdict v = s.check("não é imagem".getBytes());
        assertEquals(Decision.ALLOW, v.decision());
        assertFalse(v.held());
    }
}
