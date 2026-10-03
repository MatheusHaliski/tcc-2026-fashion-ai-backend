package br.com.fashionai.application.vision;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.Polygon;
import java.awt.image.BufferedImage;

/** Recortes sintéticos (fundo transparente) para testar a geometria sem fotos reais. */
final class Shapes {
    private Shapes() {
    }

    static BufferedImage canvas(int w, int h) {
        return new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
    }

    /** Calça: cós (faixa larga) + duas pernas separadas a partir de 35% da altura. */
    static BufferedImage pants(Color c) {
        BufferedImage img = canvas(400, 800);
        Graphics2D g = img.createGraphics();
        g.setColor(c);
        g.fillRect(80, 40, 240, 260);
        g.fillRect(80, 300, 105, 460);
        g.fillRect(215, 300, 105, 460);
        g.dispose();
        return img;
    }

    /** Camiseta: mangas largas em cima, tronco mais estreito, decote em V no topo central. */
    static BufferedImage tshirt(Color c) {
        BufferedImage img = canvas(600, 600);
        Graphics2D g = img.createGraphics();
        g.setColor(c);
        g.fillRect(40, 80, 520, 160);
        g.fillRect(150, 80, 300, 480);
        g.setComposite(java.awt.AlphaComposite.Clear);
        g.fillPolygon(new Polygon(new int[]{250, 350, 300}, new int[]{80, 80, 140}, 3));
        g.dispose();
        return img;
    }

    /** Tênis de perfil: calcanhar (alto) à direita, bico (baixo) à esquerda. */
    static BufferedImage sneakerToeLeft(Color c) {
        BufferedImage img = canvas(800, 400);
        Graphics2D g = img.createGraphics();
        g.setColor(c);
        g.fillPolygon(new Polygon(new int[]{60, 740, 740, 520, 300, 60}, new int[]{330, 330, 80, 90, 200, 260}, 6));
        g.dispose();
        return img;
    }

    static BufferedImage stripes(boolean vertical, boolean horizontal) {
        BufferedImage img = canvas(400, 400);
        for (int y = 0; y < 400; y++) {
            for (int x = 0; x < 400; x++) {
                boolean dark = (vertical && (x / 20) % 2 == 0) || (horizontal && (y / 20) % 2 == 0);
                img.setRGB(x, y, dark ? 0xFF202040 : 0xFFF0F0F0);
            }
        }
        return img;
    }
}
