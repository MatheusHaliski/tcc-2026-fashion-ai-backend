package br.com.fashionai.application.accessibility;

import br.com.fashionai.domain.model.CatalogAccessibilityAttributes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Regras puras do RF-PESQ-08: vocabulários, filtro tri-estado (atributo confirmado ≠ desconhecido) e descrição concreta
 * do produto, sem promessa clínica. Ausência de dado nunca classifica o produto como inadequado.
 */
public final class AccessibilityRules {
    private AccessibilityRules() {
    }

    public static final Set<String> TRI = Set.of("TRUE", "FALSE", "UNKNOWN");
    public static final Set<String> CLOSURES = Set.of("NONE", "ZIPPER", "BUTTONS", "MAGNETIC", "VELCRO", "ELASTIC", "HOOKS", "UNKNOWN");
    public static final Set<String> OPENINGS = Set.of("FRONT", "BACK", "SIDE", "SHOULDER", "NONE", "UNKNOWN");
    public static final Set<String> CONTACTS = Set.of("SOFT", "NEUTRAL", "TEXTURED", "UNKNOWN");
    public static final Set<String> SOURCES = Set.of("BRAND_SPEC", "PHYSICAL_SAMPLE", "SUPPLIER_SHEET");
    /** Fechamentos que a pessoa consegue abrir sem pinça fina. */
    private static final Set<String> EASY_CLOSURES = Set.of("NONE", "MAGNETIC", "VELCRO", "ELASTIC");

    public record Filters(boolean easyClosure, boolean frontOpening, boolean magneticClosure, boolean taglessLabel, boolean flatSeams, boolean softFabric, boolean oneHandDressing) {
        public boolean any() {
            return easyClosure || frontOpening || magneticClosure || taglessLabel || flatSeams || softFabric || oneHandDressing;
        }
    }

    /** Verdadeiro só com atributo declarado/revisado que satisfaz cada filtro ativo; UNKNOWN nunca satisfaz nem reprova. */
    public static boolean matches(CatalogAccessibilityAttributes a, Filters f) {
        if (f.easyClosure() && !EASY_CLOSURES.contains(a.getClosureType())) return false;
        if (f.frontOpening() && !"FRONT".equals(a.getOpeningPosition())) return false;
        if (f.magneticClosure() && !"TRUE".equals(a.getMagneticClosure())) return false;
        if (f.taglessLabel() && !"TRUE".equals(a.getTaglessLabel())) return false;
        if (f.flatSeams() && !"TRUE".equals(a.getFlatSeams())) return false;
        if (f.softFabric() && !"SOFT".equals(a.getFabricContact())) return false;
        return !f.oneHandDressing() || "TRUE".equals(a.getOneHandDressing());
    }

    /** Filtros cujo valor é UNKNOWN no produto: o resultado diz "sem informação", não "não atende". */
    public static List<String> unknownFor(CatalogAccessibilityAttributes a, Filters f) {
        List<String> out = new ArrayList<>();
        if (f.easyClosure() && "UNKNOWN".equals(a.getClosureType())) out.add("easyClosure");
        if (f.frontOpening() && "UNKNOWN".equals(a.getOpeningPosition())) out.add("frontOpening");
        if (f.magneticClosure() && "UNKNOWN".equals(a.getMagneticClosure())) out.add("magneticClosure");
        if (f.taglessLabel() && "UNKNOWN".equals(a.getTaglessLabel())) out.add("taglessLabel");
        if (f.flatSeams() && "UNKNOWN".equals(a.getFlatSeams())) out.add("flatSeams");
        if (f.softFabric() && "UNKNOWN".equals(a.getFabricContact())) out.add("softFabric");
        if (f.oneHandDressing() && "UNKNOWN".equals(a.getOneHandDressing())) out.add("oneHandDressing");
        return out;
    }

    /** Chaves de texto concreto (ex.: "abertura frontal", "fechamento magnético") para a ficha; nada clínico. */
    public static List<String> descriptionKeys(CatalogAccessibilityAttributes a) {
        List<String> out = new ArrayList<>();
        if (!"UNKNOWN".equals(a.getOpeningPosition())) out.add("opening." + a.getOpeningPosition());
        if (!"UNKNOWN".equals(a.getClosureType())) out.add("closure." + a.getClosureType());
        if ("TRUE".equals(a.getMagneticClosure())) out.add("magnetic");
        if ("TRUE".equals(a.getTaglessLabel())) out.add("tagless");
        if ("TRUE".equals(a.getFlatSeams())) out.add("flatSeams");
        if (!"UNKNOWN".equals(a.getFabricContact())) out.add("contact." + a.getFabricContact());
        if ("TRUE".equals(a.getOneHandDressing())) out.add("oneHand");
        return out;
    }

    public static Map<String, String> values(CatalogAccessibilityAttributes a) {
        return Map.of("closureType", a.getClosureType(), "openingPosition", a.getOpeningPosition(), "magneticClosure", a.getMagneticClosure(),
                "taglessLabel", a.getTaglessLabel(), "flatSeams", a.getFlatSeams(), "fabricContact", a.getFabricContact(), "oneHandDressing", a.getOneHandDressing());
    }
}
