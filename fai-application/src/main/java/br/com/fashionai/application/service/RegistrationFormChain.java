package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.enums.ProfileType;
import java.time.LocalDate;
import java.time.Period;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Validação dos campos do formulário de cadastro ({@code POST /api/auth/register}) como cadeia ordenada de regras
 * (Chain of Responsibility, variante pipeline: todos os elos rodam e acumulam erros por campo).
 *
 * <p>A ordem dos elos é contrato: o mapa de erros é um {@link LinkedHashMap} serializado em {@code details} na
 * resposta 400 {@code FORMULARIO_INVALIDO}, e o formulário destaca os campos nessa ordem. Cada elo decide sozinho se
 * se aplica ao tipo de perfil (marca, celebridade). Funções puras: sem repositório, armazenamento ou relógio global;
 * a verificação dos arquivos pendentes do cadastro continua no {@link IdentityService}, que precisa do storage.
 */
final class RegistrationFormChain {

    /** Entrada imutável de um elo: o comando, o tipo efetivo, o e-mail já normalizado e a data de referência. */
    record Input(IdentityService.RegisterCommand cmd, ProfileType type, String mail, LocalDate today) {
    }

    /** Elo da cadeia: registra em {@code errors} os problemas do seu campo, ou nada. */
    @FunctionalInterface
    interface Rule {
        void check(Input in, Map<String, Object> errors);
    }

    static final int MIN_AGE = 13;

    /** Ordem do formulário: dados comuns, dados do emissor (marca/celebridade), manequim e @. */
    static final List<Rule> RULES = List.of(
            RegistrationFormChain::fullName,
            RegistrationFormChain::email,
            (in, errors) -> IdentityService.validatePassword(in.cmd().password(), errors),
            RegistrationFormChain::confirmPassword,
            RegistrationFormChain::terms,
            RegistrationFormChain::birthDate,
            RegistrationFormChain::brand,
            RegistrationFormChain::celebrity,
            RegistrationFormChain::mannequin,
            RegistrationFormChain::username);

    private RegistrationFormChain() {
    }

    /** Percorre todos os elos e devolve o mapa mutável de erros (vazio quando o formulário é válido). */
    static Map<String, Object> validate(Input in) {
        Map<String, Object> errors = new LinkedHashMap<>();
        for (Rule rule : RULES) {
            rule.check(in, errors);
        }
        return errors;
    }

    static void fullName(Input in, Map<String, Object> errors) {
        if (in.cmd().fullName() == null || in.cmd().fullName().trim().length() < 3) {
            errors.put("fullName", Msg.t("identity.informe_seu_nome_completo"));
        }
    }

    static void email(Input in, Map<String, Object> errors) {
        if (!IdentityService.EMAIL.matcher(in.mail()).matches()) {
            errors.put("email", Msg.t("common.formato_de_e_mail_invalido"));
        }
    }

    static void confirmPassword(Input in, Map<String, Object> errors) {
        if (in.cmd().password() != null && !in.cmd().password().equals(in.cmd().confirmPassword())) {
            errors.put("confirmPassword", Msg.t("identity.as_senhas_nao_coincidem"));
        }
    }

    static void terms(Input in, Map<String, Object> errors) {
        if (!in.cmd().acceptTerms()) {
            errors.put("acceptTerms", Msg.t("identity.e_preciso_aceitar_os_termos"));
        }
    }

    static void birthDate(Input in, Map<String, Object> errors) {
        String raw = in.cmd().birthDate();
        if (raw == null || raw.isBlank()) {
            return;
        }
        try {
            if (Period.between(LocalDate.parse(raw), in.today()).getYears() < MIN_AGE) {
                errors.put("birthDate", Msg.t("identity.o_fashion_ai_e_destinado"));
            }
        } catch (DateTimeParseException ex) {
            errors.put("birthDate", Msg.t("identity.data_invalida_use_aaaa_mm"));
        }
    }

    static void brand(Input in, Map<String, Object> errors) {
        if (in.type() != ProfileType.MARCA) {
            return;
        }
        IdentityService.BrandData b = in.cmd().brand();
        if (b == null || blank(b.razaoSocial())) {
            errors.put("brand.razaoSocial", Msg.t("identity.razao_social_e_obrigatoria"));
        }
        if (b == null || !IdentityService.validCnpj(b.cnpj())) {
            errors.put("brand.cnpj", Msg.t("identity.cnpj_invalido"));
        }
        if (b == null || blank(b.logoUrl())) {
            errors.put("brand.logoUrl", Msg.t("identity.envie_o_logo_da_marca"));
        }
        // critério obrigatório da verificação (PRESENCA_OFICIAL): sem o site o perfil nunca poderia ser aprovado
        officialLink(b == null ? null : b.storeUrl(), "brand.storeUrl", "identity.informe_o_site_oficial", errors);
    }

    static void celebrity(Input in, Map<String, Object> errors) {
        if (in.type() != ProfileType.CELEBRIDADE) {
            return;
        }
        IdentityService.CelebrityData c = in.cmd().celebrity();
        if (c == null || blank(c.stageName())) {
            errors.put("celebrity.stageName", Msg.t("identity.nome_artistico_e_obrigatorio"));
        }
        if (c == null || blank(c.realName())) {
            // critério obrigatório da verificação (NOME_CONFERE): sem ele o perfil nunca poderia ser aprovado
            errors.put("celebrity.realName", Msg.t("identity.nome_civil_e_obrigatorio"));
        }
        if (c == null || blank(c.identityProofUrl())) {
            errors.put("celebrity.identityProofUrl", Msg.t("identity.envie_o_documento_de_identificacao"));
        }
        if (c == null || blank(c.officialPhotoUrl())) {
            errors.put("celebrity.officialPhotoUrl", Msg.t("identity.envie_a_foto_oficial"));
        }
        // critério obrigatório da verificação (CONTROLE_PERFIL_OFICIAL): é nesse perfil que o analista procura o código
        officialLink(c == null ? null : c.verificationUrl(), "celebrity.verificationUrl", "identity.informe_o_perfil_oficial",
                errors);
    }

    static void mannequin(Input in, Map<String, Object> errors) {
        if (in.type() != ProfileType.MARCA && in.cmd().sex() == null) {
            errors.put("sex", Msg.t("identity.escolha_o_manequim_feminino_ou"));
        }
    }

    static void username(Input in, Map<String, Object> errors) {
        String raw = in.cmd().username();
        if (raw == null || raw.isBlank()) {
            return;                                        // sem @ informado o serviço sugere um livre
        }
        String problem = IdentityService.usernameProblem(IdentityService.normalizeUsername(raw));
        if (problem != null) {
            errors.put("username", problem);
        }
    }

    private static void officialLink(String url, String field, String missingKey, Map<String, Object> errors) {
        if (blank(url)) {
            errors.put(field, Msg.t(missingKey));
        } else if (!IssuerVerificationPolicy.webUrl(IssuerVerificationPolicy.normalizeUrl(url))) {
            errors.put(field, Msg.t("issuerReview.link_invalido"));
        }
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
