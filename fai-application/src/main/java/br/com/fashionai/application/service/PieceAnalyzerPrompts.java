package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.BrandRegions;
import br.com.fashionai.application.imaging.SubtypeReferences;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.taxonomy.TaxonomyRegistry;

import java.util.List;

/** Prompts da análise de peça (RF4): sistema do analisador, da moderação e da leitura da marca, e a mensagem montada. */
final class PieceAnalyzerPrompts {
    private PieceAnalyzerPrompts() {
    }

    static final String BRAND_TILES_SYSTEM = """
            Você lê a MARCA de uma peça de roupa. Cada imagem é um recorte ampliado da mesma peça (a legenda diz de onde).
            Procure o nome da marca escrito (logo, etiqueta, bordado, estampa) em qualquer recorte. Responda SOMENTE com JSON:
            {"brand": "nome exato da marca ou null", "image": número da imagem onde leu ou null, "text": "texto que você leu",
             "confidence": 0-1}. Não invente: sem nome legível, brand = null.""";

    static final String ANALYZER_SYSTEM = """
            Você é o Piece Analyzer do Fashion AI. Você recebe fotos de UMA peça (roupa, calçado ou acessório) e responde
            SOMENTE com JSON. A mensagem diz quais imagens vieram e em que ordem:
            - Imagem 1: a peça inteira, recortada do fundo e endireitada.
            - Folha de referências (quando vier): grade numerada com a imagem de referência de cada subtipo do tipo escolhido
              pela pessoa. Compare o FORMATO da peça (silhueta, comprimento, gola, mangas, cano, abertura, bolsos) com cada
              referência e escolha o subtipo mais parecido. Ignore cores, estampas e o selo "FAI" das referências: elas são
              só modelos de formato.
            - Zonas de marca (quando vierem): recortes ampliados dos lugares onde a marca costuma estar. Peça de cima:
              · fundo da gola (etiqueta interna, vista pelo decote);
              · peito esquerdo de quem veste (fica à DIREITA da foto);
              · peito direito de quem veste (fica à ESQUERDA da foto);
              · centro do peito.
              Leia logotipos, bordados, estampas e etiquetas. Só informe a marca se conseguir ler o nome ou reconhecer o
              logotipo com segurança; nunca invente.
            JSON:
            {"name": nome curto da peça em português (ex.: "Camiseta branca lisa"),
             "matchesCategory": boolean (a foto é mesmo do tipo escolhido pela pessoa?),
             "detectedCategory": um de [upper_piece, lower_piece, shoes_piece, accessory_piece, full_body_piece],
             "subcategory": código da lista de subtipos, "subcategoryRanking": [{"code": código, "similarity": 0-1}] (os 3 mais parecidos),
             "color": código da paleta, "material": código da lista de materiais,
             "variation": {"code": código da lista de modelagens do subtipo escolhido (corte/silhueta/construção) ou null
                           se a foto não deixar claro, "confidence": 0-1},
             "attributes": {"DIMENSÃO": {"codes": [códigos dessa dimensão], "confidence": 0-1}} só com as dimensões e os
                           códigos listados na mensagem e só o que dá para VER na foto (omita o resto; nunca invente código),
             "sex": um de [MASCULINO, FEMININO, UNISSEX], "occasion": até 2 códigos da lista de ocasiões,
             "style": até 2 códigos da lista de estilos,
             "brand": nome da marca ou null, "brandZone": id da zona em que a marca foi lida (ou "outra") ou null,
             "brandEvidence": o que foi lido ou visto (ex.: "texto NIKE bordado no peito") ou null,
             "photo": {"fullyVisible": a peça aparece inteira, sem partes cortadas pela borda da foto?,
                       "viewAngle": "frontal_90" (câmera a 90°, de frente/de cima) | "angulo" | "lateral" | "dobrada",
                       "singlePiece": há uma peça só (par de calçados conta como uma)?},
             "confidence": {"category": 0-1, "subcategory": 0-1, "color": 0-1, "material": 0-1, "brand": 0-1, "photo": 0-1},
             "logo": {"visible": boolean, "box": [x0, y0, x1, y1]} caixa do logotipo/etiqueta de marca NA IMAGEM 1, em
                     0–1000 relativos à imagem inteira, ou null. Frases, palavras decorativas e estampas gráficas
                     (ex.: "THE BEST PLAN" no peito) NÃO são logo: devolva null}
            Nunca descreva pessoas. Se não houver peça, devolva matchesCategory false e confidence 0 em tudo.""";

    /** Mensagem do analisador: tipo escolhido, vocabulário permitido e o que é cada imagem anexada (na ordem). */
    static String analyzerPrompt(String chosen, List<String> sheetLegend, List<BrandRegions.Zone> zones, List<SubtypeReferences.Match> ranking) {
        StringBuilder p = new StringBuilder();
        String category = chosen == null ? null : chosen;
        if (category != null) {
            p.append("Tipo escolhido pela pessoa: ").append(category).append(".\n");
            p.append("Subtipos possíveis desse tipo: ").append(String.join(", ", Taxonomy.SUBCATEGORIES.get(category))).append(".\n");
        } else {
            p.append("Tipo não informado: descubra pela foto. Subtipos por tipo: ").append(Taxonomy.SUBCATEGORIES).append(".\n");
        }
        p.append("Ocasiões permitidas: ").append(String.join(", ", Taxonomy.allowedOccasions(category))).append(".\n");
        p.append("Materiais: ").append(String.join(", ", Taxonomy.MATERIALS)).append(".\n");
        if (category != null) {
            p.append(analyzerVocabulary(category));
        }
        p.append("Estilos: ").append(String.join(", ", Taxonomy.STYLES)).append(".\n");
        p.append("Cores (códigos): ").append(String.join(", ", Taxonomy.COLORS.keySet())).append(".\n");
        int n = 1;
        p.append("Imagens anexadas: ").append(n++).append(" = peça inteira");
        if (!sheetLegend.isEmpty()) {
            p.append("; ").append(n++).append(" = folha de referências (").append(String.join(", ", sheetLegend)).append(")");
        }
        for (BrandRegions.Zone z : zones) {
            p.append("; ").append(n++).append(" = zona de marca \"").append(z.id()).append("\"");
        }
        p.append(".\n");
        if (!ranking.isEmpty()) {
            p.append("Similaridade de silhueta medida localmente (0–1, só uma pista; decida pela comparação visual): ")
                    .append(String.join(", ", ranking.stream().limit(5).map(m -> m.subcategory() + " " + m.score()).toList())).append(".\n");
        }
        p.append("Analise e responda só com o JSON.");
        return p.toString();
    }

    static final String MODERATION_SYSTEM = """
            Você é o Content Moderator do Fashion AI. Avalie a imagem e responda SOMENTE com JSON:
            {"isClothing": boolean, "safe": boolean, "categories": [strings de violação, ex.: nudity, violence, hate, minor],
             "confidence": 0-1}. Em dúvida, safe=false.""";

    /** Dimensões que a IA pode ler numa foto (docs/taxonomia, C.6); estilo e ocasião têm campos próprios. */
    static final List<String> ANALYZER_DIMENSIONS = List.of("PATTERN", "FINISH", "LENGTH", "SHAFT_HEIGHT", "RISE", "HEM",
            "SLEEVE_LENGTH", "SLEEVE_STYLE", "NECKLINE", "CLOSURE", "HEEL_TYPE", "HEEL_HEIGHT", "TOE_SHAPE", "SOLE_TYPE",
            "CARRY_MODE", "FRAME_RIM");

    /**
     * Vocabulário fechado da variação e dos atributos para o tipo escolhido: modelagens de cada subtipo (código + nome) e,
     * por dimensão que vale para o tipo, os códigos possíveis. A IA só pode responder com esses códigos.
     */
    static String analyzerVocabulary(String category) {
        TaxonomyRegistry reg = TaxonomyRegistry.get();
        StringBuilder p = new StringBuilder("Modelagens por subtipo (código = nome): ");
        List<String> subs = Taxonomy.SUBCATEGORIES.getOrDefault(category, List.of());
        p.append(String.join("; ", subs.stream().map(sub -> sub + ": " + String.join(", ", reg.variationsOf(sub).stream()
                .map(l -> l.code() + " = " + reg.label(l.code(), Msg.PT_BR).orElse(l.code())).toList())).toList())).append(".\n");
        p.append("Características (dimensão: códigos):");
        for (String dim : ANALYZER_DIMENSIONS) {
            java.util.LinkedHashSet<String> codes = new java.util.LinkedHashSet<>();
            subs.forEach(sub -> reg.valuesFor(dim, category, sub).forEach(v -> codes.add(v.code())));
            if (!codes.isEmpty()) {
                p.append(" ").append(dim).append(": ").append(String.join(", ", codes)).append(".");
            }
        }
        return p.append("\n").toString();
    }
}
