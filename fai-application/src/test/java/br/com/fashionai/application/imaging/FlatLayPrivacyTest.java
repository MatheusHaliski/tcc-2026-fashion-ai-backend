package br.com.fashionai.application.imaging;

import br.com.fashionai.application.imaging.ImageProviderPorts.BackgroundRemovalPort;
import br.com.fashionai.application.imaging.ImageProviderPorts.ProviderImage;
import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Privacidade: a foto enviada pela pessoa só vai a um provedor externo (rembg/remove.bg) quando o recorte local não
 * mostra pele estranha à peça — rosto, pescoço, braços. Com uma pessoa na foto, tudo fica no servidor.
 */
class FlatLayPrivacyTest {
    private final AtomicInteger calls = new AtomicInteger();
    private final BackgroundRemovalPort remover = new BackgroundRemovalPort() {
        @Override
        public boolean available() {
            return true;
        }

        @Override
        public Optional<ProviderImage> removeBackground(byte[] image, String mimeType) {
            calls.incrementAndGet();
            return Optional.empty();                    // o provedor "falha": o pipeline segue com o recorte local
        }
    };
    private final FlatLayPipeline flat = new FlatLayPipeline(List.of(remover), List.of());

    /** Camiseta azul sobre fundo branco; com {@code person}, um rosto e braços em tom de pele presos à gola e às mangas. */
    private static BufferedImage photo(boolean person) {
        BufferedImage img = new BufferedImage(600, 800, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, 600, 800);
        g.setColor(new Color(40, 70, 160));
        g.fillRect(150, 250, 300, 380);                 // tronco
        g.fillRect(90, 250, 60, 160);                   // mangas
        g.fillRect(450, 250, 60, 160);
        if (person) {
            g.setColor(new Color(224, 172, 140));
            g.fillOval(240, 90, 120, 150);              // rosto e pescoço
            g.fillRect(270, 230, 60, 25);
            g.fillRect(95, 410, 50, 170);               // braços
            g.fillRect(455, 410, 50, 170);
        }
        g.dispose();
        return img;
    }

    @Test
    void fotoComPessoaNaoSaiDoServidor() {
        FlatLayPipeline.Result r = flat.run(ImageOps.jpeg(photo(true), 0.95f), true);
        assertThat(calls.get()).isZero();
        assertThat(r.stages()).anyMatch(s -> "PRIVACIDADE".equals(s.name()));
        assertThat(r.stages()).anyMatch(s -> "REMOCAO_FUNDO".equals(s.name()) && s.provider().startsWith("local"));
    }

    @Test
    void fotoSoDaPecaPodeUsarOProvedorExterno() {
        flat.run(ImageOps.jpeg(photo(false), 0.95f), true);
        assertThat(calls.get()).isEqualTo(1);
    }

    @Test
    void semPermissaoExternaNadaEnviaNemMarcaPrivacidade() {
        FlatLayPipeline.Result r = flat.run(ImageOps.jpeg(photo(true), 0.95f), false);
        assertThat(calls.get()).isZero();
        assertThat(r.stages()).noneMatch(s -> "PRIVACIDADE".equals(s.name()));
    }

    @Test
    void peleDaPropriaPecaNaoContaComoPessoa() {
        // casaco caramelo/nude: a cor da peça é "pele", mas é a própria peça (perto da mediana), não uma pessoa
        BufferedImage img = new BufferedImage(400, 500, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(224, 172, 140));
        g.fillRect(100, 100, 200, 300);
        g.dispose();
        assertThat(FlatLayPipeline.mayShowPerson(new ImageOps.Cutout(img, 0.3, 0.9, 0xFFFFFF), img)).isFalse();
    }
}
