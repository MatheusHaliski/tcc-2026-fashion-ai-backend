package br.com.fashionai.bootstrap;

import org.springframework.boot.actuate.info.Info;
import org.springframework.boot.actuate.info.InfoContributor;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import java.util.Map;

/** Explicit non-secret deployment metadata, so a healthy stale image can be distinguished from the current API. */
@Component
public class DeploymentInfo implements InfoContributor {
    private final Environment environment;
    public DeploymentInfo(Environment environment) { this.environment = environment; }
    @Override public void contribute(Info.Builder builder) {
        builder.withDetail("deployment", Map.of("commit", environment.getProperty("RAILWAY_GIT_COMMIT_SHA", "unknown"),
                "branch", environment.getProperty("RAILWAY_GIT_BRANCH", "unknown")));
        builder.withDetail("catalog", Map.of("pagedProducts", true, "summary", true));
    }
}
