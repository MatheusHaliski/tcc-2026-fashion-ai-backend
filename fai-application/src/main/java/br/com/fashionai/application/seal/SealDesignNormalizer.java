package br.com.fashionai.application.seal;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.seal.SealDesignFields.HEX;
import static br.com.fashionai.application.seal.SealDesignFields.clamp;
import static br.com.fashionai.application.seal.SealDesignFields.color;
import static br.com.fashionai.application.seal.SealDesignFields.material;
import static br.com.fashionai.application.seal.SealDesignFields.number;
import static br.com.fashionai.application.seal.SealDesignFields.section;
import static br.com.fashionai.application.seal.SealDesignFields.text;
import static br.com.fashionai.application.seal.SealDesignFields.upper;
import static br.com.fashionai.application.seal.SealDesignTemplates.TEMPLATE_IDS;
import static br.com.fashionai.application.seal.SealDesignTemplates.TEMPLATE_PREFIX;
import static br.com.fashionai.application.seal.SealDesignTemplates.kindOfTemplate;
import static br.com.fashionai.application.seal.SealDesigns.CAPTION_MAX;
import static br.com.fashionai.application.seal.SealDesigns.CORE_MODES;
import static br.com.fashionai.application.seal.SealDesigns.CORE_TEXT_MAX;
import static br.com.fashionai.application.seal.SealDesigns.ELEMENT_IDS;
import static br.com.fashionai.application.seal.SealDesigns.FOLHA_TEXT_LIMITS;
import static br.com.fashionai.application.seal.SealDesigns.KINDS;
import static br.com.fashionai.application.seal.SealDesigns.LABEL_MAX;
import static br.com.fashionai.application.seal.SealDesigns.PALETTES;
import static br.com.fashionai.application.seal.SealDesigns.PATTERN_IDS;

/**
 * RF25 — validação e normalização do JSON do desenho do selo vindo do formulário (tipo, modo, modelo, textos da folha,
 * núcleo, paleta, borda, campo, disco central, elemento e upload). Extraído de {@link SealDesigns} (R80).
 */
final class SealDesignNormalizer {
    private SealDesignNormalizer() {
    }

    /** Valida e normaliza o JSON do desenho vindo do formulário; ids inválidos viram 400 com o campo apontado. */
    static Map<String, Object> normalize(Map<String, Object> raw) {
        if (raw == null || raw.isEmpty()) {
            return null;
        }
        Map<String, String> errors = new LinkedHashMap<>();
        Map<String, Object> out = new LinkedHashMap<>();
        String template = raw.get("template") == null || String.valueOf(raw.get("template")).isBlank() ? null : String.valueOf(raw.get("template")).trim().toLowerCase(Locale.ROOT);
        String mode = upper(raw.get("mode"), template == null ? "GENERATED" : "TEMPLATE");
        if (!mode.equals("GENERATED") && !mode.equals("UPLOAD") && !mode.equals("TEMPLATE")) {
            errors.put("mode", Msg.t("sealDesigns.use_generated_ou_upload"));
            mode = "GENERATED";
        }
        String kind = upper(raw.get("kind"), template == null ? "CIRCULAR" : kindOfTemplate(template));
        if (!KINDS.contains(kind)) {
            errors.put("kind", Msg.t("sealDesigns.tipo_desconhecido"));
            kind = "CIRCULAR";
        }
        if (!kind.equals("CIRCULAR")) {
            mode = "TEMPLATE";                                    // folha e padrão FashionAI são sempre um modelo
        }
        if (mode.equals("TEMPLATE")) {
            Set<String> known = TEMPLATE_IDS.getOrDefault(TEMPLATE_PREFIX.get(kind), Set.of());
            if (template == null || !template.startsWith(TEMPLATE_PREFIX.get(kind) + "/") || !known.contains(template)) {
                errors.put("template", Msg.t("sealDesigns.modelo_desconhecido"));
            }
        } else {
            template = null;
        }
        out.put("kind", kind);
        out.put("mode", mode);
        out.put("template", template);
        if (kind.equals("FOLHA")) {
            out.put("label", text(raw.get("label"), LABEL_MAX, "label", errors));
            out.put("caption", text(raw.get("caption"), CAPTION_MAX, "caption", errors));
            Map<String, Object> texts = section(raw, "texts");
            Map<String, Object> tx = new LinkedHashMap<>();
            for (String k : List.of("series", "subtitle", "style", "year", "emblem")) {
                String v = text(texts.get(k), FOLHA_TEXT_LIMITS.get(k), "texts." + k, errors);
                if (v != null) {
                    tx.put(k, v);
                }
            }
            out.put("texts", tx);
        }
        if (!kind.equals("FASHIONAI") && !mode.equals("UPLOAD")) {
            out.put("core", core(section(raw, "core"), errors));           // núcleo do circular / emblema da folha
        }
        String palette = raw.get("palette") == null ? null : upper(raw.get("palette"), null);
        if (palette != null && !PALETTES.containsKey(palette)) {
            errors.put("palette", Msg.t("sealDesigns.paleta_desconhecida"));
        }
        out.put("palette", palette);

        Map<String, Object> border = section(raw, "border");
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("material", material(border.get("material"), "FOSCO", "border.material", errors));
        b.put("color", color(border.get("color"), "#2B2622", "border.color", errors));
        b.put("width", clamp(number(border.get("width"), 0.06), 0.03, 0.12));
        out.put("border", b);

        Map<String, Object> field = section(raw, "field");
        Map<String, Object> f = new LinkedHashMap<>();
        String pattern = upper(field.get("pattern"), "MALHA");
        if (!PATTERN_IDS.contains(pattern)) {
            errors.put("field.pattern", Msg.t("sealDesigns.padrao_desconhecido"));
        }
        f.put("pattern", pattern);
        f.put("material", material(field.get("material"), "FOSCO", "field.material", errors));
        f.put("color", color(field.get("color"), "#F58220", "field.color", errors));
        f.put("lineColor", color(field.get("lineColor"), "#F6E8CF", "field.lineColor", errors));
        List<String> nodes = new ArrayList<>();
        if (field.get("nodeColors") instanceof List<?> l) {
            for (Object o : l) {
                if (nodes.size() >= 6) {
                    break;
                }
                String c = String.valueOf(o);
                if (HEX.matcher(c).matches()) {
                    nodes.add(c.toUpperCase(Locale.ROOT));
                }
            }
        }
        if (nodes.isEmpty()) {
            nodes.addAll(List.of("#F9B21C", "#2E86C1", "#6DB33F", "#7A4E2D"));
        }
        f.put("nodeColors", nodes);
        f.put("density", (int) clamp(number(field.get("density"), 2), 1, 3));
        f.put("seed", (int) clamp(number(field.get("seed"), 1), 1, 9999));
        out.put("field", f);

        Map<String, Object> center = section(raw, "center");
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("material", material(center.get("material"), "FOSCO", "center.material", errors));
        c.put("color", color(center.get("color"), "#F6E8CF", "center.color", errors));
        c.put("radius", clamp(number(center.get("radius"), 0.45), 0.3, 0.6));
        out.put("center", c);

        Map<String, Object> element = section(raw, "element");
        Map<String, Object> e = new LinkedHashMap<>();
        String id = upper(element.get("id"), "BAG");
        if (!ELEMENT_IDS.contains(id)) {
            errors.put("element.id", Msg.t("sealDesigns.elemento_central_desconhecido"));
        }
        e.put("id", id);
        e.put("material", material(element.get("material"), "FOSCO", "element.material", errors));
        e.put("color", color(element.get("color"), "#2B2622", "element.color", errors));
        String text = element.get("text") == null ? "FAI" : String.valueOf(element.get("text")).trim().toUpperCase(Locale.ROOT);
        text = text.replaceAll("[^A-Z0-9&+]", "");
        if (text.isEmpty()) {
            text = "FAI";
        }
        if (text.length() > 3) {
            errors.put("element.text", Msg.t("sealDesigns.no_maximo_3_caracteres"));
            text = text.substring(0, 3);
        }
        e.put("text", text);
        out.put("element", e);

        Object upload = raw.get("uploadUrl");
        String uploadUrl = upload == null || String.valueOf(upload).isBlank() ? null : String.valueOf(upload).trim();
        if (mode.equals("UPLOAD")) {
            if (uploadUrl == null) {
                errors.put("uploadUrl", Msg.t("sealDesigns.envie_a_imagem_do_selo"));
            } else if (!(uploadUrl.startsWith("/media/") || uploadUrl.startsWith("http://") || uploadUrl.startsWith("https://"))) {
                errors.put("uploadUrl", Msg.t("sealDesigns.url_de_upload_invalida"));
            }
        }
        out.put("uploadUrl", uploadUrl);
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("SELO_DESIGN_INVALIDO", Msg.t("sealDesigns.revise_o_desenho_do_selo"), Map.of("fields", errors));
        }
        return out;
    }

    /** Núcleo editável: elemento da arte, imagem enviada pelo emissor (recortada no disco/emblema) ou texto livre. */
    static Map<String, Object> core(Map<String, Object> raw, Map<String, String> errors) {
        Map<String, Object> c = new LinkedHashMap<>();
        String mode = upper(raw.get("mode"), "ELEMENT");
        if (!CORE_MODES.contains(mode)) {
            errors.put("core.mode", Msg.t("sealDesigns.nucleo_modo"));
            mode = "ELEMENT";
        }
        c.put("mode", mode);
        Object img = raw.get("imageUrl");
        String imageUrl = img == null || String.valueOf(img).isBlank() ? null : String.valueOf(img).trim();
        if (imageUrl != null && !(imageUrl.startsWith("/media/") || imageUrl.startsWith("http://") || imageUrl.startsWith("https://"))) {
            errors.put("core.imageUrl", Msg.t("sealDesigns.url_de_upload_invalida"));
        }
        if (mode.equals("IMAGE") && imageUrl == null) {
            errors.put("core.imageUrl", Msg.t("sealDesigns.nucleo_sem_imagem"));
        }
        String text = text(raw.get("text"), CORE_TEXT_MAX, "core.text", errors);
        if (mode.equals("TEXT") && text == null) {
            errors.put("core.text", Msg.t("sealDesigns.nucleo_sem_texto"));
        }
        c.put("imageUrl", imageUrl);
        c.put("text", text);
        c.put("textColor", raw.get("textColor") == null ? null : color(raw.get("textColor"), null, "core.textColor", errors));
        c.put("zoom", clamp(number(raw.get("zoom"), 1), 1, 3));
        return c;
    }
}
