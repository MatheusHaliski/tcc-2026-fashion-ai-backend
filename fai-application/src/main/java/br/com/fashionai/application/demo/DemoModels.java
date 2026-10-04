package br.com.fashionai.application.demo;

import java.util.List;
import java.util.Map;

/** Respostas do Demo/Test Data Pipeline (o CLI em scripts/demo imprime as linhas como vieram). */
public final class DemoModels {
    private DemoModels() {
    }

    /** Log no formato do pedido: [CREATED] [FOUND] [UPDATED] [SKIP] [CONFLICT] [DELETE] [CASCADE] [KEEP]. */
    public record DemoReport(String operation, String profile, List<String> lines, Map<String, Long> totals) {
    }

    public record ResetPlan(int testAccounts, long realAccountsAffected, Map<String, Long> counts,
                            Map<String, Long> keep, String planHash, List<String> lines) {
    }

    public record VerifyReport(boolean ok, List<String> problems, Map<String, Long> totals) {
    }
}
