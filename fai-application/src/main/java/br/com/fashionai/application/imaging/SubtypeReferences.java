package br.com.fashionai.application.imaging;

import br.com.fashionai.application.taxonomy.Taxonomy;

import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * RF4 — detecção do subtipo por comparação com fotos de referência. A pessoa escolhe o tipo (categoria) da peça; a foto
 * enviada é comparada com a imagem de referência de cada subtipo dessa categoria ({@code /public/assets_pecas}, uma por
 * subcategoria da taxonomia) pela similaridade de silhueta ({@link Silhouette}). O resultado é um ranking (maior
 * similaridade primeiro) que serve de palpite local e de evidência para a IA, que recebe as mesmas referências numa
 * folha de contato numerada ({@link #contactSheet}).
 */
public final class SubtypeReferences {
    /** Referência de um subtipo: silhueta já medida e miniatura para a folha de contato. */
    public record Reference(String subcategory, String category, Silhouette.Descriptor shape, BufferedImage thumb) {
    }

    /** Subtipo candidato com a similaridade da foto com a referência (0–1). */
    public record Match(String subcategory, double score) {
    }

    static final int THUMB = 220;
    private final Map<String, List<Reference>> byCategory = new LinkedHashMap<>();
    private final Map<String, byte[]> sheets = new ConcurrentHashMap<>();

    public SubtypeReferences(List<Reference> references) {
        for (Reference r : references) {
            byCategory.computeIfAbsent(r.category(), k -> new ArrayList<>()).add(r);
        }
    }

    /** Monta a referência a partir da imagem RGBA (fundo transparente) do subtipo. */
    public static Reference reference(String subcategory, String category, BufferedImage rgba) {
        ImageOps.Box box = Silhouette.maskBounds(rgba);
        BufferedImage piece = box.empty() ? rgba : rgba.getSubimage(box.x(), box.y(), box.w(), box.h());
        return new Reference(subcategory, category, Silhouette.of(rgba), ImageOps.composeCentered(piece, THUMB, 0.06, Color.WHITE, false));
    }

    public boolean isEmpty() {
        return byCategory.isEmpty();
    }

    public List<Reference> references(String category) {
        return byCategory.getOrDefault(category, List.of());
    }

    /** Ranking dos subtipos da categoria pela similaridade com a peça (recorte RGBA). Categoria nula = todas. */
    public List<Match> rank(String category, BufferedImage cutout) {
        return rank(category, Silhouette.of(cutout));
    }

    public List<Match> rank(String category, Silhouette.Descriptor shape) {
        // a referência de um código LEGACY (bermuda_shorts, ankle_boots…) conta para a subcategoria que o substitui
        // (shorts, boots); fica a melhor nota de cada subcategoria
        Map<String, Double> best = new LinkedHashMap<>();
        for (Map.Entry<String, List<Reference>> e : byCategory.entrySet()) {
            if (category != null && !category.equals(e.getKey())) {
                continue;
            }
            for (Reference r : e.getValue()) {
                best.merge(Taxonomy.activeSubcategory(r.subcategory()), Silhouette.similarity(shape, r.shape()), Math::max);
            }
        }
        List<Match> out = new ArrayList<>();
        best.forEach((sub, score) -> out.add(new Match(sub, score)));
        out.sort(Comparator.comparingDouble(Match::score).reversed());
        return out;
    }

    /** Melhor similaridade por categoria — a forma "tem cara de" qual tipo de peça. */
    public Map<String, Double> bestByCategory(Silhouette.Descriptor shape) {
        Map<String, Double> out = new LinkedHashMap<>();
        for (String category : byCategory.keySet()) {
            List<Match> r = rank(category, shape);
            out.put(category, r.isEmpty() ? 0 : r.get(0).score());
        }
        return out;
    }

    /**
     * Folha de contato da categoria (PNG): as referências numeradas em grade, com o código do subtipo embaixo — a IA
     * compara a foto com elas e responde com o código. A ordem é a da taxonomia; a mesma folha serve a todos os pedidos.
     */
    public byte[] contactSheet(String category) {
        List<Reference> refs = references(category);
        if (refs.isEmpty()) {
            return null;
        }
        try {
            return sheets.computeIfAbsent(category, c -> ImageOps.png(drawSheet(refs)));
        } catch (RuntimeException | InternalError | LinkageError e) {
            return null;                               // sem fonte no servidor: a IA segue só com a legenda do prompt
        }
    }

    /** Legenda da folha: "1 = jeans, 2 = casual_pants, …" (mesma numeração desenhada nas células). */
    public List<String> sheetLegend(String category) {
        List<String> out = new ArrayList<>();
        List<Reference> refs = references(category);
        for (int i = 0; i < refs.size(); i++) {
            out.add((i + 1) + " = " + refs.get(i).subcategory());
        }
        return out;
    }

    static BufferedImage drawSheet(List<Reference> refs) {
        int cols = refs.size() <= 9 ? 3 : refs.size() <= 16 ? 4 : 5;
        int rows = (refs.size() + cols - 1) / cols;
        int label = 30;
        int cell = THUMB;
        BufferedImage out = new BufferedImage(cols * cell, rows * (cell + label), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        ImageOps.quality(g);
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, out.getWidth(), out.getHeight());
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 17));
        FontMetrics fm = g.getFontMetrics();
        for (int i = 0; i < refs.size(); i++) {
            int x = (i % cols) * cell;
            int y = (i / cols) * (cell + label);
            g.drawImage(refs.get(i).thumb(), x, y, cell, cell, null);
            String text = (i + 1) + " · " + refs.get(i).subcategory();
            g.setColor(Color.BLACK);
            g.drawString(text, x + Math.max(4, (cell - fm.stringWidth(text)) / 2), y + cell + label - 9);
            g.setColor(new Color(0xD0D0D0));
            g.drawRect(x, y, cell - 1, cell + label - 1);
        }
        g.dispose();
        return out;
    }
}
