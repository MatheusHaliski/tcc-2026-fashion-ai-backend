package br.com.fashionai.application.flair3d.recurso;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.AcaoDestravada;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.Atributo;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.Recurso;
import br.com.fashionai.application.taxonomy.Taxonomy;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * A tabela da regra "peça-recurso" (docs/flair/flair-3d/AUDITORIA_2026-11-25.md, etapa 8): cinco camadas somadas
 * sempre na mesma ordem — vaga, subcategoria, material, família de cor e raridade com o OVR. Determinística: sem
 * sorteio, sem relógio, minúsculas com {@code Locale.ROOT}; a ordem das etiquetas da carta não muda o resultado.
 */
public final class Flair3dRecursoTabela {
    private Flair3dRecursoTabela() {
    }

    /** O que as camadas somam numa peça, antes do fator do OVR e da raridade. */
    static final class Soma {
        final EnumMap<Atributo, Integer> atributos = new EnumMap<>(Atributo.class);
        final EnumSet<AcaoDestravada> acoes = EnumSet.noneOf(AcaoDestravada.class);
        Recurso recurso = Recurso.FOCO;
        int base = 10;
        int extra;

        void mais(Atributo a, int v) {
            atributos.merge(a, v, Integer::sum);
        }

        void uso(Recurso r, int quantidade) {
            recurso = r;
            base = quantidade;
        }
    }

    // ---------------------------------------------------------------- A. vaga
    static void vaga(String vaga, Soma s) {
        switch (vaga == null ? "" : vaga) {
            case "SUP" -> { s.mais(Atributo.CARISMA, 8); s.uso(Recurso.FOCO, 15); }
            case "INF" -> { s.mais(Atributo.AGILIDADE, 6); s.uso(Recurso.ENERGIA, 15); }
            case "CAL" -> { s.mais(Atributo.AGILIDADE, 10); s.uso(Recurso.ENERGIA, 20); }
            case "VES" -> { s.mais(Atributo.CARISMA, 6); s.mais(Atributo.RESISTENCIA, 6); s.uso(Recurso.VIDA, 15); }
            default -> { s.mais(Atributo.FURTIVIDADE, 4); s.uso(Recurso.FOCO, 10); }
        }
    }

    // ---------------------------------------------------------------- B. subcategoria
    static final Set<String> SALTOS = Set.of("heels", "pumps", "stiletto");
    static final Set<String> BOTAS = Set.of("boots", "ankle_boots");
    static final Set<String> LONGOS = Set.of("maxi_dress", "gown");
    static final Set<String> CAMADAS = Set.of("coat", "parka", "windbreaker", "jacket", "blazer");
    static final Set<String> TROCA = Set.of("cardigan", "vest");
    static final Set<String> COBRE_O_ROSTO = Set.of("sunglasses", "hat", "cap", "beanie");
    static final Set<String> BOLSAS = Set.of("handbag", "tote_bag", "backpack", "crossbody_bag", "clutch");
    static final Set<String> JOIAS = Set.of("necklace", "earrings", "ring", "bracelet", "watch");
    static final Set<String> ABREM = Set.of("gloves", "belt");

    static void subcategoria(String sub, Soma s) {
        String x = sub == null ? "" : sub.toLowerCase(Locale.ROOT);
        if (Taxonomy.SNEAKERS.contains(x)) { s.mais(Atributo.AGILIDADE, 20); s.acoes.add(AcaoDestravada.CORRER); }
        if (SALTOS.contains(x)) { s.mais(Atributo.AGILIDADE, -15); s.mais(Atributo.CARISMA, 15); s.acoes.add(AcaoDestravada.CONVENCER); }
        if (BOTAS.contains(x)) { s.mais(Atributo.RESISTENCIA, 10); s.mais(Atributo.AGILIDADE, -5); }
        if (LONGOS.contains(x)) { s.mais(Atributo.CARISMA, 10); s.mais(Atributo.AGILIDADE, -10); }
        if (CAMADAS.contains(x)) { s.mais(Atributo.RESISTENCIA, 15); s.acoes.add(AcaoDestravada.BLOQUEAR); s.uso(Recurso.VIDA, 20); }
        if (TROCA.contains(x)) s.acoes.add(AcaoDestravada.TROCA_RAPIDA);
        if (COBRE_O_ROSTO.contains(x)) { s.mais(Atributo.FURTIVIDADE, 15); s.acoes.add(AcaoDestravada.ESCONDER); }
        if (BOLSAS.contains(x)) { s.acoes.add(AcaoDestravada.CARREGAR); s.uso(Recurso.MOEDAS, 5); }
        if (JOIAS.contains(x)) s.mais(Atributo.CARISMA, 10);
        if (ABREM.contains(x)) s.acoes.add(AcaoDestravada.ABRIR);
    }

    // ---------------------------------------------------------------- C. material (cada grupo conta uma vez)
    static final Set<String> RESISTENTES = Set.of("leather", "denim", "wool");
    static final Set<String> METAIS = Set.of("metal", "gold", "silver", "plated");
    static final Set<String> CONFORTO = Set.of("cotton", "linen", "knit", "jersey", "fleece", "modal", "viscose");
    static final Set<String> FLUIDOS = Set.of("silk", "satin");
    static final Set<String> CHAMATIVOS = Set.of("sequin", "pvc", "latex", "vinyl");
    static final Set<String> ESPORTIVOS = Set.of("nylon", "polyester", "mesh");

    static void material(Set<String> materiais, Soma s) {
        if (tem(materiais, RESISTENTES)) s.mais(Atributo.RESISTENCIA, 12);
        if (tem(materiais, METAIS)) { s.mais(Atributo.FORCA, 10); s.mais(Atributo.CARISMA, 5); s.acoes.add(AcaoDestravada.REFLETIR); }
        if (tem(materiais, CONFORTO)) { s.mais(Atributo.RESISTENCIA, 6); if (s.recurso == Recurso.ENERGIA) s.extra += 5; }
        if (tem(materiais, FLUIDOS)) { s.mais(Atributo.CARISMA, 8); s.mais(Atributo.AGILIDADE, 4); }
        if (tem(materiais, CHAMATIVOS)) { s.mais(Atributo.CARISMA, 10); s.mais(Atributo.FURTIVIDADE, -15); }
        if (tem(materiais, ESPORTIVOS)) s.mais(Atributo.AGILIDADE, 6);
    }

    // ---------------------------------------------------------------- D. família de cor (cada família conta uma vez)
    static final Map<String, Map<Atributo, Integer>> CORES = Map.of(
            "Preto", Map.of(Atributo.FURTIVIDADE, 10),
            "Cinza", Map.of(Atributo.FURTIVIDADE, 10),
            "Branco", Map.of(Atributo.FURTIVIDADE, -5, Atributo.CARISMA, 5),
            "Amarelo", Map.of(Atributo.FURTIVIDADE, -5, Atributo.CARISMA, 5),
            "Vermelho", Map.of(Atributo.FORCA, 5),
            "Verde", Map.of(Atributo.AGILIDADE, 3),
            "Azul", Map.of(Atributo.AGILIDADE, 3));

    static void cor(Set<String> cores, Soma s) {
        TreeSet<String> familias = new TreeSet<>();
        for (String c : cores) {
            String f = Taxonomy.COLOR_FAMILY.get(c.toLowerCase(Locale.ROOT));
            if (f != null && CORES.containsKey(f)) familias.add(f);
        }
        for (String f : familias) CORES.get(f).forEach(s::mais);
    }

    // ---------------------------------------------------------------- E. raridade e OVR
    /** Quanto a quantidade do uso cresce com a raridade. */
    static double multiplicador(String tier) {
        return switch (tier == null ? "" : tier.toUpperCase(Locale.ROOT)) {
            case "PRATA" -> 1.25;
            case "OURO" -> 1.5;
            case "ESPECIAL" -> 2.0;
            default -> 1.0;
        };
    }

    static int usos(String tier) {
        String t = tier == null ? "" : tier.toUpperCase(Locale.ROOT);
        return t.equals("OURO") || t.equals("ESPECIAL") ? 2 : 1;
    }

    /** O OVR mexe no máximo 10% nos atributos, para cima ou para baixo (carta forte não decide o jogo sozinha). */
    static double fatorDoOvr(int ovr) {
        return Math.max(0.9, Math.min(1.1, 0.9 + 0.2 * (ovr - 45) / 47.0));
    }

    /** As camadas A a D de uma carta na vaga dada (sem vaga, a posição da carta). */
    static Soma somar(CbcRules.Card c, String vaga) {
        Soma s = new Soma();
        vaga(vaga != null ? vaga : c.position(), s);
        subcategoria(c.subcategory(), s);
        material(c.materials(), s);
        cor(c.colors(), s);
        return s;
    }

    private static boolean tem(Set<String> etiquetas, Set<String> grupo) {
        for (String e : etiquetas) if (grupo.contains(e.toLowerCase(Locale.ROOT))) return true;
        return false;
    }
}
