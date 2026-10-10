package br.com.fashionai.application.lens;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * RF54 · Retenção do FashionAI Lens: uma vez por dia, os scans não salvos como inspiração e já vencidos ({@code
 * expires_at}, 30 dias) somem com a imagem, a miniatura, as peças detectadas e as correções.
 */
@Component
public class LensRetentionJob {
    private static final Logger log = LoggerFactory.getLogger(LensRetentionJob.class);

    private final LensService lens;

    public LensRetentionJob(LensService lens) {
        this.lens = lens;
    }

    @Scheduled(cron = "${fashionai.lens.retention-cron:0 40 4 * * *}", zone = "America/Sao_Paulo")
    public void purgeExpired() {
        try {
            int n = lens.purgeExpired(Instant.now());
            if (n > 0) {
                log.info("Lens: {} scans vencidos apagados (imagem e linhas)", n);
            }
        } catch (RuntimeException ex) {
            log.warn("Lens: limpeza de scans vencidos falhou ({}); tenta de novo amanhã", ex.toString());
        }
    }
}
