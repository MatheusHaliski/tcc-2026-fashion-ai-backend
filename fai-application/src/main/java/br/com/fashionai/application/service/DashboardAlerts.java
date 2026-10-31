package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Regras puras do dashboard gerencial que transformam números em decisão (extraídas do {@link DashboardService},
 * lote 16): limiares de fallback de IA, fila de moderação, aprovações pendentes, maior custo de IA, conversão
 * selo → resgate e picos diários de segurança. Sem Spring, porta ou relógio: recebe as linhas já consultadas.
 * A ordem dos alertas é observável (a UI os lista nessa ordem).
 */
final class DashboardAlerts {
    private DashboardAlerts() {
    }

    /** Alertas de negócio a partir dos KPIs do período e do uso de IA por capacidade/provedor. */
    static List<Map<String, Object>> alerts(Map<String, Object> kpis, List<Map<String, Object>> aiUsage) {
        List<Map<String, Object>> out = new ArrayList<>();
        double fallback = num(kpis.get("ai_fallback_pct"));
        if (fallback >= 20) {
            out.add(alert("warning", Msg.t("dashboard.ia_em_fallback_em_das", String.format(Msg.locale(), "%.1f", fallback)), Msg.t("dashboard.verifique_chaves_cota_do_provedor")));
        }
        long moderation = (long) num(kpis.get("moderation_pending"));
        if (moderation > 20) {
            out.add(alert("warning", Msg.t("dashboard.itens_na_fila_de_moderacao", (moderation)), Msg.t("dashboard.reforce_a_revisao_manual_ou")));
        }
        long approvals = (long) num(kpis.get("approvals_pending"));
        if (approvals > 0) {
            out.add(alert("info", Msg.t("dashboard.marca_s_celebridade_s_aguardando", (approvals)), Msg.t("dashboard.abra_a_fila_de_aprovacoes")));
        }
        aiUsage.stream().filter(r -> num(r.get("cost_usd")) > 0).max((a, b) -> Double.compare(num(a.get("cost_usd")), num(b.get("cost_usd"))))
                .ifPresent(r -> out.add(alert("info", Msg.t("dashboard.maior_custo_de_ia_us", r.get("capability"), r.get("provider"), String.format(Msg.locale(), "%.2f", num(r.get("cost_usd")))),
                        Msg.t("dashboard.avalie_usar_o_modelo_leve"))));
        long bonds = (long) num(kpis.get("bonds_approved"));
        long redemptions = (long) num(kpis.get("redemptions"));
        if (bonds > 0) {
            out.add(alert("info", Msg.t("dashboard.conversao_selo_resgate", Math.round(100.0 * redemptions / bonds)), Msg.t("dashboard.campanhas_com_conversao_baixa_pedem")));
        }
        return out;
    }

    /** Pico de logins falhos ou de acessos negados num único dia vira alerta de segurança. */
    static List<Map<String, Object>> securityAlerts(List<Map<String, Object>> series) {
        List<Map<String, Object>> out = new ArrayList<>();
        double maxLogin = series.stream().mapToDouble(r -> num(r.get("login_failures"))).max().orElse(0);
        double maxDenied = series.stream().mapToDouble(r -> num(r.get("denied"))).max().orElse(0);
        if (maxLogin >= 20) {
            out.add(alert("critical", Msg.t("dashboard.pico_de_logins_falhos", (long) maxLogin), Msg.t("dashboard.verifique_ips_no_audit_log")));
        }
        if (maxDenied >= 30) {
            out.add(alert("warning", Msg.t("dashboard.pico_de_acessos_negados", (long) maxDenied), Msg.t("dashboard.revise_permissoes_e_tentativas")));
        }
        return out;
    }

    static Map<String, Object> alert(String level, String title, String action) {
        return Map.of("level", level, "title", title, "action", action);
    }

    /** Número de uma célula de consulta agregada (Number, BigDecimal ou texto); ausente ou ilegível vale 0. */
    static double num(Object o) {
        if (o instanceof Number n) {
            return n.doubleValue();
        }
        if (o instanceof BigDecimal b) {
            return b.doubleValue();
        }
        try {
            return o == null ? 0 : Double.parseDouble(String.valueOf(o));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }
}
