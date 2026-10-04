package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.ReviewableProfile;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Política de verificação de marcas e celebridades (docs/politicas/VERIFICACAO_MARCAS_E_CELEBRIDADES.md, v1.0): os
 * critérios de cada tipo de perfil (obrigatórios e complementares), os motivos padronizados de uma decisão negativa, o
 * código de verificação de cada conta e o que o sistema confere sozinho. O resto o analista confere na checklist.
 * <p>
 * Resultado de cada verificação automática: {@link Auto#OK} (o sistema confirmou), {@link Auto#FALHA} (bloqueia a
 * aprovação se o critério for obrigatório) ou {@link Auto#ANALISTA} (só o analista confirma).
 */
@Component
public class IssuerVerificationPolicy {
    public static final String VERSION = "1.0";
    /** Envios por perfil: o cadastro é o 1º; esgotado, só a administração reabre. */
    public static final int MAX_SUBMISSIONS = 5;
    /** Prazos de referência, em dias úteis: primeira análise (a partir do e-mail confirmado) e reanálise. */
    public static final int SLA_BUSINESS_DAYS = 3;
    public static final int RESUBMIT_SLA_BUSINESS_DAYS = 2;
    static final long NOTORIETY_FOLLOWERS = 10_000;

    public enum Auto { OK, FALHA, ANALISTA }

    public record Criterion(String code, boolean mandatory) {
    }

    /** Um critério aplicado a um perfil: resultado automático e um detalhe curto para o analista (nunca documento). */
    public record Check(String code, boolean mandatory, Auto auto, String detail) {
        public Map<String, Object> toMap() {
            return detail == null ? Map.of("code", code, "mandatory", mandatory, "auto", auto.name())
                    : Map.of("code", code, "mandatory", mandatory, "auto", auto.name(), "detail", detail);
        }
    }

    public static final List<Criterion> BRAND = List.of(
            new Criterion("EMAIL_CONFIRMADO", true), new Criterion("CNPJ_VALIDO", true), new Criterion("CNPJ_ATIVO", true),
            new Criterion("ATIVIDADE_MODA", true), new Criterion("COMPROVANTE_ATIVIDADE", true), new Criterion("PRESENCA_OFICIAL", true),
            new Criterion("REPRESENTACAO", true), new Criterion("SEM_CONFLITO", true), new Criterion("PERFIL_COMPLETO", false));

    public static final List<Criterion> CELEBRITY = List.of(
            new Criterion("EMAIL_CONFIRMADO", true), new Criterion("DOCUMENTO_IDENTIDADE", true), new Criterion("NOME_CONFERE", true),
            new Criterion("MAIOR_DE_IDADE", true), new Criterion("CONTROLE_PERFIL_OFICIAL", true), new Criterion("NOTORIEDADE", true),
            new Criterion("SEM_IMPERSONACAO", true), new Criterion("REPRESENTACAO", false), new Criterion("CONSENTIMENTO_SELOS", false),
            new Criterion("PERFIL_COMPLETO", false));

    /** Motivos padronizados de "pedir ajustes" e "recusar" (o texto mostrado à pessoa fica no i18n do frontend). */
    public static final List<String> REASONS = List.of("DOCUMENTO_ILEGIVEL", "DOCUMENTO_DIVERGENTE", "CNPJ_INVALIDO_OU_INATIVO",
            "ATIVIDADE_FORA_DA_MODA", "PRESENCA_NAO_VERIFICAVEL", "REPRESENTACAO_NAO_COMPROVADA", "CONTROLE_NAO_COMPROVADO",
            "NOTORIEDADE_INSUFICIENTE", "MENOR_DE_IDADE", "POSSIVEL_IMPERSONACAO", "DADOS_INCOMPLETOS", "VIOLACAO_DOS_TERMOS", "OUTRO");

    /** Provedores de e-mail gratuito: o domínio do e-mail não prova que a pessoa é da marca. */
    private static final Set<String> FREE_MAIL = Set.of("gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
            "yahoo.com", "yahoo.com.br", "icloud.com", "me.com", "uol.com.br", "bol.com.br", "terra.com.br", "proton.me", "protonmail.com");

    private final BrandProfileRepository brands;
    private final CelebrityProfileRepository celebrities;

    public IssuerVerificationPolicy(BrandProfileRepository brands, CelebrityProfileRepository celebrities) {
        this.brands = brands;
        this.celebrities = celebrities;
    }

    public static List<Criterion> criteria(ReviewableProfile p) {
        return p instanceof CelebrityProfile ? CELEBRITY : BRAND;
    }

    /** Verificações automáticas de todos os critérios do perfil, na ordem da política. */
    public List<Check> checks(User u, ReviewableProfile p) {
        List<Check> out = new ArrayList<>();
        for (Criterion c : criteria(p)) {
            out.add(p instanceof BrandProfile b ? brandCheck(c, u, b) : celebrityCheck(c, u, (CelebrityProfile) p));
        }
        return out;
    }

    private Check brandCheck(Criterion c, User u, BrandProfile b) {
        return switch (c.code()) {
            case "EMAIL_CONFIRMADO" -> check(c, u.isEmailVerified() ? Auto.OK : Auto.FALHA, null);
            case "CNPJ_VALIDO" -> check(c, validCnpj(b.getCnpj()) ? Auto.OK : Auto.FALHA, null);
            case "ATIVIDADE_MODA" -> check(c, Auto.ANALISTA, blank(b.getFashionCategory()) ? null : b.getFashionCategory());
            case "COMPROVANTE_ATIVIDADE" -> check(c, blank(b.getActivityProofUrl()) ? Auto.FALHA : Auto.ANALISTA, null);
            case "PRESENCA_OFICIAL" -> check(c, webUrl(b.getStoreUrl()) ? Auto.ANALISTA : Auto.FALHA, null);
            case "REPRESENTACAO" -> {
                String mail = domainOf(u.getEmail());
                String site = domainOf(b.getStoreUrl());
                boolean corporate = mail != null && !FREE_MAIL.contains(mail) && site != null && (site.equals(mail) || site.endsWith("." + mail));
                yield check(c, corporate ? Auto.OK : Auto.ANALISTA, corporate ? "e-mail @" + mail : null);
            }
            case "SEM_CONFLITO" -> check(c, !blank(b.getBrandName()) && b.getOwner() != null && brands
                    .existsByBrandNameIgnoreCaseAndApprovalStatusAndOwner_IdNot(b.getBrandName().trim(), ApprovalStatus.APROVADO, b.getOwner().getId())
                    ? Auto.FALHA : Auto.ANALISTA, null);
            case "PERFIL_COMPLETO" -> check(c, !blank(b.getLogoUrl()) && !blank(b.getFashionCategory()) && !blank(b.getCommercialContact())
                    && !blank(b.getOfficialHashtag()) ? Auto.OK : Auto.FALHA, null);
            default -> check(c, Auto.ANALISTA, null);          // CNPJ_ATIVO: consulta pública da Receita
        };
    }

    private Check celebrityCheck(Criterion c, User u, CelebrityProfile p) {
        return switch (c.code()) {
            case "EMAIL_CONFIRMADO" -> check(c, u.isEmailVerified() ? Auto.OK : Auto.FALHA, null);
            case "DOCUMENTO_IDENTIDADE" -> check(c, blank(p.getIdentityProofUrl()) ? Auto.FALHA : Auto.ANALISTA, null);
            case "NOME_CONFERE" -> check(c, blank(p.getRealName()) ? Auto.FALHA : Auto.ANALISTA, null);
            case "MAIOR_DE_IDADE" -> {
                Integer age = age(u.getBirthDate());
                yield check(c, age == null ? Auto.ANALISTA : age >= 18 ? Auto.OK : Auto.FALHA, null);
            }
            case "CONTROLE_PERFIL_OFICIAL" -> check(c, webUrl(p.getVerificationUrl()) ? Auto.ANALISTA : Auto.FALHA, null);
            case "NOTORIEDADE" -> {
                long followers = followers(p.getVerifiableFollowersJson());
                yield check(c, Auto.ANALISTA, followers > 0 ? String.valueOf(followers) : null);
            }
            case "SEM_IMPERSONACAO" -> check(c, !blank(p.getStageName()) && p.getOwner() != null && celebrities
                    .existsByStageNameIgnoreCaseAndVerificationStatusAndOwner_IdNot(p.getStageName().trim(), ApprovalStatus.APROVADO, p.getOwner().getId())
                    ? Auto.FALHA : Auto.ANALISTA, null);
            // pedido da própria pessoa: nada a conferir; por agência, o analista confere a autorização
            case "REPRESENTACAO" -> check(c, blank(p.getRepresentationContact()) ? Auto.OK : Auto.ANALISTA, null);
            case "CONSENTIMENTO_SELOS" -> check(c, p.isSealConsentGranted() ? Auto.OK : Auto.FALHA, null);
            case "PERFIL_COMPLETO" -> check(c, !blank(p.getAvatarUrl()) && !Json.strings(p.getAreasJson()).isEmpty()
                    && !blank(p.getProfessionalHistory()) ? Auto.OK : Auto.FALHA, null);
            default -> check(c, Auto.ANALISTA, null);
        };
    }

    private static Check check(Criterion c, Auto auto, String detail) {
        return new Check(c.code(), c.mandatory(), auto, detail);
    }

    // ------------------------------------------------------------------ utilitários (públicos para testes e para a API)

    /** CNPJ com 14 dígitos (pontuação ignorada), não repetido e com os dois dígitos verificadores corretos. */
    public static boolean validCnpj(String raw) {
        if (raw == null) {
            return false;
        }
        String d = raw.replaceAll("\\D", "");
        if (d.length() != 14 || d.chars().distinct().count() == 1) {
            return false;
        }
        return d.charAt(12) - '0' == cnpjDigit(d, 12) && d.charAt(13) - '0' == cnpjDigit(d, 13);
    }

    private static int cnpjDigit(String d, int len) {
        int[] weights = len == 12 ? new int[]{5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2} : new int[]{6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2};
        int sum = 0;
        for (int i = 0; i < len; i++) {
            sum += (d.charAt(i) - '0') * weights[i];
        }
        int r = sum % 11;
        return r < 2 ? 0 : 11 - r;
    }

    /**
     * Código de verificação da conta (FAI-XXXXXX): a pessoa o publica no perfil oficial ou no site para provar o controle.
     * Deriva do id da conta — só vale para quem o vê na própria Central do emissor.
     */
    public static String verificationCode(UUID userId) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(("fai-verificacao-emissor:" + userId).getBytes(StandardCharsets.UTF_8));
            return "FAI-" + HexFormat.of().withUpperCase().formatHex(h, 0, 3);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Domínio (sem "www.") de um e-mail ou de uma URL http(s); nulo se não der para ler. */
    static String domainOf(String emailOrUrl) {
        if (blank(emailOrUrl)) {
            return null;
        }
        String s = emailOrUrl.trim().toLowerCase(Locale.ROOT);
        String host;
        if (s.contains("@") && !s.contains("/")) {
            host = s.substring(s.lastIndexOf('@') + 1);
        } else {
            try {
                host = URI.create(s.matches("^[a-z][a-z0-9+.-]*://.*") ? s : "https://" + s).getHost();
            } catch (IllegalArgumentException e) {
                return null;
            }
        }
        if (host == null || !host.contains(".")) {
            return null;
        }
        return host.startsWith("www.") ? host.substring(4) : host;
    }

    /** Link aceito como site, loja ou perfil oficial: http(s) com um domínio de verdade. */
    public static boolean webUrl(String url) {
        if (blank(url)) {
            return false;
        }
        String s = url.trim().toLowerCase(Locale.ROOT);
        return (s.startsWith("https://") || s.startsWith("http://")) && domainOf(s) != null;
    }

    static Integer age(String birthDate) {
        if (blank(birthDate)) {
            return null;
        }
        try {
            return Period.between(LocalDate.parse(birthDate.trim().substring(0, Math.min(10, birthDate.trim().length()))),
                    LocalDate.now(ZoneId.of("America/Sao_Paulo"))).getYears();
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** Maior número de seguidores declarado numa rede ({"instagram": 120000, …}); 0 se não houver. */
    static long followers(String json) {
        long max = 0;
        for (Object v : Json.map(json).values()) {
            try {
                max = Math.max(max, v instanceof Number n ? n.longValue() : Long.parseLong(String.valueOf(v).replaceAll("\\D", "")));
            } catch (NumberFormatException ignored) {
                // valor que não é número: não conta
            }
        }
        return max;
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
