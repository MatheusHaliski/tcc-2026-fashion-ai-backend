package br.com.fashionai.application.testkit;

import java.awt.Font;
import java.awt.FontFormatException;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Map;

/**
 * Fontes fixas para os cards PNG nos testes. As fontes lógicas da JVM ("Serif", "SansSerif") viram as fontes
 * instaladas no host (fontconfig no Linux): o mesmo card sai com pixels diferentes em cada máquina, e um hash de PNG
 * gravado num ambiente falha em outro (o runner do CI, por exemplo). Carregadas de src/test/resources/fonts (DejaVu
 * 2.37, licença em LICENSE-DejaVu.txt), as fontes são as mesmas em qualquer máquina.
 */
public final class FixedFonts {
    private static Map<String, Font> byLogicalFamily;

    private FixedFonts() {
    }

    /** Família lógica → fonte carregada de arquivo; estilo e tamanho são derivados por quem desenha. */
    public static synchronized Map<String, Font> byLogicalFamily() {
        if (byLogicalFamily == null) {
            byLogicalFamily = Map.of(
                    "Serif", load("/fonts/DejaVuSerif.ttf"),
                    "SansSerif", load("/fonts/DejaVuSans.ttf"));
        }
        return byLogicalFamily;
    }

    private static Font load(String resource) {
        try (InputStream in = FixedFonts.class.getResourceAsStream(resource)) {
            if (in == null) {
                throw new IllegalStateException("fonte de teste ausente: " + resource);
            }
            return Font.createFont(Font.TRUETYPE_FONT, in);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } catch (FontFormatException e) {
            throw new IllegalStateException("fonte de teste inválida: " + resource, e);
        }
    }
}
