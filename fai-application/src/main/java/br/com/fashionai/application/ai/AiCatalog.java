package br.com.fashionai.application.ai;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Catálogo de provedores por capacidade (RF24): serviço primário, alternativa, fallback local, modalidade
 * de custo (G = gratuito/local, P = pago por uso, H = híbrido/free tier + excedente), custo estimado por
 * chamada, latência típica, cota diária por usuário e status de implementação.
 *
 * Preços de referência (USD, set/2026): Claude Opus 5 US$5/US$25 por MTok (entrada/saída); Claude Haiku 4.5
 * US$1/US$5; Gemini 2.5 Flash US$0,30/US$2,50 (com free tier); FASHN.ai ~US$0,075/imagem; remove.bg
 * ~US$0,20/imagem em créditos; Cloudinary free tier (25 créditos/mês); Replicate FLUX schnell ~US$0,003/imagem.
 * Custos por chamada são estimativas a partir do tamanho típico do prompt — o custo real sai do uso de
 * tokens devolvido pelo provedor e é gravado em ai_inference_log (RF24.CA16).
 */
public final class AiCatalog {
    public static final String CLAUDE_DEFAULT_MODEL = "claude-opus-5";
    public static final String CLAUDE_LIGHT_MODEL = "claude-haiku-4-5";
    public static final String GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

    public enum CostMode { G, P, H }

    public enum Kind { TEXT, VISION, IMAGE_GENERATION, IMAGE_PROCESSING, LOCAL, THREE_D }

    public record ProviderOption(String providerId, String service, String model, CostMode costMode,
                                 BigDecimal costPerCallUsd, String costNote, long typicalLatencyMs, String envKey,
                                 Kind kind) {
    }

    public record CapabilitySpec(AiCapability capability, String whatItDoes, ProviderOption primary,
                                 ProviderOption alternative, ProviderOption local, String fallbackBehavior,
                                 int dailyQuotaPerUser, int timeoutSeconds, String status, List<String> rnfs) {
    }

    private static final Map<AiCapability, CapabilitySpec> SPECS = new EnumMap<>(AiCapability.class);

    static {
        ProviderOption none = null;
        put(AiCapability.PIECE_ANALYZER,
                "Detecta e classifica a peça pela foto: categoria, subcategoria, cor dominante, material, marca e confiança.",
                gemini(Kind.VISION, "0.0012", "≈1,3 mil tokens de entrada (imagem) + 300 de saída", 1500),
                claude(CLAUDE_LIGHT_MODEL, Kind.VISION, "0.0031", "Claude Haiku 4.5 com visão — alternativa da planilha RF24", 2200),
                local("Análise local (k-means de cor + proporção da silhueta)", 120),
                "Pré-preenche só o que tiver confiança; abaixo de 0,55 o formulário fica vazio com aviso, sem bloquear (RF4.CA03).",
                60, "Implementado — Gemini Vision/Claude + fallback local");
        put(AiCapability.CONTENT_MODERATOR,
                "Modera a foto contra a política de conteúdo e confirma que é uma peça de roupa.",
                gemini(Kind.VISION, "0.0010", "classificação de segurança + 'é peça de roupa?'", 1200),
                claude(CLAUDE_LIGHT_MODEL, Kind.VISION, "0.0028", "Claude Haiku 4.5 com visão", 2000),
                local("Heurística local (resolução, cobertura do objeto, proporção de tons de pele)", 60),
                "Nunca aprova por omissão: dúvida vai para a fila humana (moderation_queue) com status PENDING.",
                200, "Implementado — remoto + heurística local + fila humana");
        put(AiCapability.SCHEME_COMPOSER,
                "Compõe 3 esquemas a partir de ocasião/estilo/orientações livres usando SÓ peças do acervo do usuário; lê todos os atributos das peças (material, cor, padrão, tamanho, estado, preço, uso), as fotos e o DNA de estilo.",
                claude(CLAUDE_DEFAULT_MODEL, Kind.TEXT, "0.0500", "≈4–12 mil tokens (acervo + até 12 fotos) + 1,2 mil de saída", 8000),
                gemini(Kind.TEXT, "0.0042", "mesma entrada no Gemini Flash", 2500),
                local("Composição por regras (ocasião, estilo, harmonia de cor, estação)", 40),
                "Composição por regras locais + aviso ao usuário (RF5.CA04 continua atendido).",
                30, "Implementado — Claude + Gemini + regras locais");
        put(AiCapability.DNA_SYNTHESIZER,
                "Sintetiza arquétipo (Kibbe), índice de ousadia, frase de identidade e paleta do DNA de Estilo.",
                claude(CLAUDE_DEFAULT_MODEL, Kind.TEXT, "0.0300", "≈3 mil tokens + 600 de saída; paleta sempre local (k-means)", 6000),
                gemini(Kind.TEXT, "0.0025", "planilha original citava GPT-4o mini; implementado Gemini Flash", 2000),
                local("Arquétipo por mapeamento estilo→Kibbe + paleta k-means local", 30),
                "Card exibido sem a frase de identidade, com aviso; paleta local sempre disponível.",
                10, "Implementado — Claude + Gemini + síntese local");
        put(AiCapability.BACKGROUND_GENERATOR,
                "Gera a arte de fundo (Arte com AI) a partir de prompt, direção recomendada ou preset AURA/material.",
                option("firefly", "Adobe Firefly Services", "firefly-image-4", CostMode.H, "0.0400",
                        "assinatura com cota; excedente estimado por imagem", 6000, "FIREFLY_CLIENT_ID", Kind.IMAGE_GENERATION),
                option("replicate", "Replicate (FLUX schnell / SDXL)", "black-forest-labs/flux-schnell", CostMode.P, "0.0030",
                        "por imagem 1024px; Gemini Image (~US$0,039) é a 2ª alternativa", 4000, "REPLICATE_API_TOKEN", Kind.IMAGE_GENERATION),
                local("Galeria pré-gerada: presets AURA, materiais, mosaicos e gradientes do /public", 20),
                "Oferece a galeria de fundos pré-gerados (AURA/material/mosaico) e o modo Cor & Gradiente.",
                20, "Implementado — Firefly/Replicate + galeria local");
        put(AiCapability.SEALBOND_MATCHER,
                "Sugere até 3 vínculos de selo (marca/celebridade) com confiança e justificativa.",
                local("Similaridade de embeddings local (marca da peça + assinatura de estilo)", 50),
                claude(CLAUDE_DEFAULT_MODEL, Kind.TEXT, "0.0300", "catálogo de marcas/celebridades em contexto", 6000),
                local("Regra de marca exata", 5),
                "Vínculo manual pelo usuário (RF20.CA03).",
                50, "Implementado — local (primário) + Claude opcional");
        put(AiCapability.STYLE_ADVISOR,
                "Gera dica de estilo acionável a partir da métrica mais fraca (L/C/S/R) do painel Look do Dia.",
                claude(CLAUDE_DEFAULT_MODEL, Kind.TEXT, "0.0080", "≈800 tokens + 150 de saída", 3000),
                gemini(Kind.TEXT, "0.0006", "Gemini Flash", 1200),
                local("Dica por regra da métrica mais fraca", 5),
                "Dica local pela métrica mais fraca.",
                20, "Implementado — Claude + Gemini + regra local");
        put(AiCapability.INSIGHT_GENERATOR,
                "Leitura textual curta dos rankings agregados do Explorador Global.",
                claude(CLAUDE_DEFAULT_MODEL, Kind.TEXT, "0.0150", "≈1,5 mil tokens de agregados + 300 de saída", 4000),
                gemini(Kind.TEXT, "0.0012", "Gemini Flash", 1500),
                local("Texto por template a partir dos rankings", 5),
                "Rankings exibidos com leitura por template.",
                20, "Implementado — Claude + Gemini + template local");
        put(AiCapability.BRAND_RESOLVER,
                "Audita texto candidato a marca; só cadastra Brand quando validada como real e inédita.",
                local("Fuzzy match (Jaro-Winkler) contra a tabela brands", 10),
                claude(CLAUDE_DEFAULT_MODEL, Kind.TEXT, "0.0063", "validação 'marca real?' ≈500 tokens + 150", 3000),
                local("Normalização + match exato", 2),
                "Nunca cria Brand por omissão: sem validação o texto fica como brandName livre.",
                30, "Implementado — local + validação Claude");
        put(AiCapability.COPILOT,
                "Recomendações de peças/esquemas a partir do acervo, preferências, histórico e clima (Open-Meteo).",
                claude(CLAUDE_DEFAULT_MODEL, Kind.TEXT, "0.0375", "≈3,5 mil tokens + 800; justificativa ≤ 2 frases", 7000),
                gemini(Kind.TEXT, "0.0031", "Gemini Flash", 2500),
                local("Recomendação por regras + clima", 30),
                "Recomendação por regras locais (RF10.CA05); sem clima, avisa.",
                30, "Implementado — Claude + Gemini + regras locais");
        put(AiCapability.STYLE_INSIGHT,
                "Detecta padrões no histórico (cores, tipos de peça, ocasiões) para a Cronologia de Estilo.",
                local("Estatística local sobre o histórico de fotos/peças", 30),
                claude(CLAUDE_DEFAULT_MODEL, Kind.TEXT, "0.0100", "narrativa opcional dos padrões", 4000),
                local("Estatística local", 30),
                "Cronologia sem narrativa textual.",
                20, "Implementado — local + narrativa Claude opcional");
        put(AiCapability.EDIT_ASSISTANT,
                "\"Melhorar com IA\": propõe um diff estruturado (JSON validado) aceito ou recusado item a item.",
                claude(CLAUDE_DEFAULT_MODEL, Kind.TEXT, "0.0225", "≈2 mil tokens + 500; saída JSON validada", 5000),
                gemini(Kind.TEXT, "0.0019", "Gemini Flash", 2000),
                local("Parser de intenções por palavras-chave", 5),
                "Edição manual, sem sugestão; nunca aplica sem revisão campo a campo.",
                30, "Implementado — Claude + Gemini + parser local");
        put(AiCapability.ACERVO_GROUPING,
                "Agrupa peças/esquemas do próprio acervo por semelhança (embeddings + k-means), restrito ao dono.",
                local("Embeddings de atributos + k-means local", 60),
                option("vertex", "Vertex AI Matching Engine", "—", CostMode.P, "0.0000",
                        "alternativa da planilha — não implementada", 0, "—", Kind.TEXT),
                local("Sem agrupamento", 1),
                "Exibe o acervo sem agrupamento sugerido; nunca bloqueia a exibição.",
                100, "Implementado — local");
        put(AiCapability.AFFINITY,
                "Ordena o feed de Marcas/Celebridades por afinidade de embeddings com o acervo do usuário (RF8).",
                local("Cosseno entre centróide do usuário e do perfil", 20),
                none,
                local("Ordena por mais recentes", 1),
                "Sem embeddings suficientes, ordena por mais recentes.",
                200, "Implementado — local");
        put(AiCapability.THREE_D_GENERATOR,
                "Gera modelo 3D da peça a partir da foto processada (opt-in, feature flag).",
                option("meshy", "Meshy image-to-3D", "meshy-5", CostMode.P, "0.3000",
                        "estimativa por modelo em créditos", 60000, "MESHY_API_KEY", Kind.THREE_D),
                option("blender", "Blender headless auto-hospedado", "—", CostMode.G, "0.0000",
                        "infra própria", 120000, "—", Kind.THREE_D),
                local("Mantém a peça em 2D", 1),
                "Mantém a peça em 2D com nova tentativa (RF16.CA03).",
                3, "Tema futuro — atrás de feature flag (FEATURE_RF16_3D=false)");
        put(AiCapability.TRY_ON,
                "Sobrepõe os slots TOP/BOTTOM/OUTER no manequim virtual (masculino/feminino).",
                option("fashn", "FASHN.ai", "tryon-v1.6", CostMode.P, "0.0750",
                        "por geração; RFC estima US$0,09–0,15 por look completo", 5000, "FASHN_API_KEY", Kind.IMAGE_PROCESSING),
                option("replicate", "IDM-VTON via Replicate", "cuuupid/idm-vton", CostMode.P, "0.0300",
                        "por geração em GPU A40", 9000, "REPLICATE_API_TOKEN", Kind.IMAGE_PROCESSING),
                local("Sobreposição aproximada por camadas e âncoras do manequim", 150),
                "Sobreposição aproximada, com aviso (RF18.CA05); estados PENDING→COMPLETED/FAILED.",
                15, "Implementado — FASHN.ai + compositor local");
        put(AiCapability.TRY_ON_POLISH,
                "Corrige costuras, bordas e cor/luz da saída bruta do try-on (estágio ENHANCING).",
                option("cleanup", "Cleanup.pictures API", "cleanup-hd", CostMode.P, "0.0200",
                        "por imagem", 1500, "CLEANUP_API_KEY", Kind.IMAGE_PROCESSING),
                option("replicate", "Real-ESRGAN via Replicate", "nightmareai/real-esrgan", CostMode.P, "0.0020",
                        "por imagem", 3000, "REPLICATE_API_TOKEN", Kind.IMAGE_PROCESSING),
                local("Suavização de borda (feather) + casamento de luminância local", 60),
                "Mantém a saída bruta, só pula o polimento (degradação graciosa).",
                15, "Implementado — Cleanup + polimento local");
        put(AiCapability.CATEGORY_FALLBACK_COMPOSITOR,
                "Posiciona calçados e acessórios rígidos sobre landmarks do manequim (compositing determinístico).",
                local("Tabela de landmarks pé/perna e mão/rosto do manequim (equivalente MediaPipe)", 40),
                none,
                local("Slot sem overlay", 1),
                "Slot fica sem overlay; o card mantém a foto 2D da peça isolada.",
                500, "Implementado — local");
        put(AiCapability.PHOTO_CURATOR,
                "Aba 'Para Você': 4 carrosséis (Em destaque, Não vê há um tempo, Combina agora, Sugestões de uso) com motivo.",
                local("Heurística local + embeddings do acervo", 40),
                none,
                local("Grade cronológica", 1),
                "Cai no modo Grade padrão (cronológico), nunca bloqueia o acesso às fotos.",
                100, "Implementado — local");
        put(AiCapability.FLAT_LAY_STANDARDIZER,
                "Pipeline híbrido Flat Lay: remoção de fundo → correção de perspectiva → normalização de cor → composição 1024px → validação de qualidade.",
                option("rembg", "rembg (auto-hospedado, ONNX u2net) via HTTP", "u2net", CostMode.G, "0.0000",
                        "self-hosted; RFC: US$0,01–0,02 por imagem no pipeline completo", 600, "REMBG_URL", Kind.IMAGE_PROCESSING),
                option("removebg", "remove.bg API", "remove.bg", CostMode.P, "0.2000",
                        "por imagem em créditos (alternativa)", 1500, "REMOVE_BG_API_KEY", Kind.IMAGE_PROCESSING),
                local("Java2D: flood fill de borda + PCA de orientação + gray-world + composição 1024px", 450),
                "Salva com a foto original e enfileira reprocessamento (RF4.CA06).",
                60, "Implementado — rembg/remove.bg + Cloudinary + pipeline local");
        put(AiCapability.BRAND_LOGO_FINDER,
                "Procura na internet o logo oficial da marca: Wikidata/Wikimedia Commons (logo P154 e site P856) → busca na web "
                        + "pela IA (Claude + web_search) → ícone do site oficial; baixa, valida e guarda no storage próprio.",
                claude(CLAUDE_DEFAULT_MODEL, Kind.TEXT, "0.0350", "até 3 buscas na web (US$ 10 / mil buscas) + ≈3 mil tokens", 15000),
                null,
                local("Monograma SVG com as iniciais e uma cor estável por marca", 5),
                "Sem logo confiável, a interface mostra o monograma e uma nova busca é feita depois de 3 dias.",
                200, "Implementado — Wikidata + Claude com busca na web + ícone do site + monograma");
    }

    private AiCatalog() {
    }

    public static CapabilitySpec spec(AiCapability capability) {
        return SPECS.get(capability);
    }

    public static Collection<CapabilitySpec> all() {
        return SPECS.values();
    }

    private static void put(AiCapability cap, String what, ProviderOption primary, ProviderOption alternative,
                            ProviderOption local, String fallback, int quota, String status) {
        SPECS.put(cap, new CapabilitySpec(cap, what, primary, alternative, local, fallback, quota, 30, status,
                List.of("RNF5 (registro da inferência)", "RNF6 (consentimento/transparência)", "RNF8 (timeout 30 s + fallback)")));
    }

    static ProviderOption claude(String model, Kind kind, String cost, String note, long latency) {
        return new ProviderOption("anthropic", "Claude (Anthropic API)", model, CostMode.P, new BigDecimal(cost), note,
                latency, "ANTHROPIC_API_KEY", kind);
    }

    static ProviderOption gemini(Kind kind, String cost, String note, long latency) {
        return new ProviderOption("gemini", "Google Gemini Flash", GEMINI_DEFAULT_MODEL, CostMode.H, new BigDecimal(cost),
                note + " (free tier cobre a demonstração)", latency, "GEMINI_API_KEY", kind);
    }

    static ProviderOption local(String description, long latency) {
        return new ProviderOption("local", description, "local", CostMode.G, BigDecimal.ZERO, "processado no backend",
                latency, "—", Kind.LOCAL);
    }

    static ProviderOption option(String id, String service, String model, CostMode mode, String cost, String note,
                                 long latency, String env, Kind kind) {
        return new ProviderOption(id, service, model, mode, new BigDecimal(cost), note, latency, env, kind);
    }

    /** Custo estimado pelo uso real de tokens (preço por MTok do modelo). */
    public static BigDecimal tokenCost(String model, long inputTokens, long outputTokens) {
        double in;
        double out;
        String m = model == null ? "" : model;
        if (m.startsWith("claude-haiku")) {
            in = 1.0;
            out = 5.0;
        } else if (m.startsWith("claude-sonnet")) {
            in = 2.0;
            out = 10.0;
        } else if (m.startsWith("claude-opus-5-5")) {
            in = 4.0;
            out = 20.0;
        } else if (m.startsWith("claude")) {
            in = 5.0;
            out = 25.0;
        } else if (m.startsWith("gemini")) {
            in = 0.30;
            out = 2.50;
        } else {
            return BigDecimal.ZERO;
        }
        double usd = inputTokens / 1_000_000.0 * in + outputTokens / 1_000_000.0 * out;
        return BigDecimal.valueOf(usd).setScale(6, java.math.RoundingMode.HALF_UP);
    }
}
