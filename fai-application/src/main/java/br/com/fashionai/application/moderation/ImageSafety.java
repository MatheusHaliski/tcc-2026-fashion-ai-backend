package br.com.fashionai.application.moderation;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.imaging.ImageOps;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Moderação de imagens enviadas (docs/seguranca/moderacao-de-imagens.md): decide, antes de a imagem ser gravada, se ela
 * pode seguir (ALLOW), se fica retida para revisão humana (REVIEW) ou se é recusada (BLOCK).
 * <ol>
 *   <li>Classificador remoto (SafeSearch), quando configurado: é a decisão de nudez propriamente dita.</li>
 *   <li>Senão, segmentação de pessoa local: pele do corpo em grande parte da pessoa leva à revisão humana. Nunca
 *       recusa sozinha (roupa de praia, fitness e lingerie também mostram pele).</li>
 *   <li>Sem nenhum dos dois funcionando: revisão humana (falha segura).</li>
 * </ol>
 */
@Service
public class ImageSafety {
    private static final Logger log = LoggerFactory.getLogger(ImageSafety.class);

    public enum Decision { ALLOW, REVIEW, BLOCK }

    public record Verdict(Decision decision, String engine, List<String> reasons, Map<String, Object> signals) {
        public boolean held() {
            return decision == Decision.REVIEW;
        }
    }

    /** Pessoa ocupando ao menos esta fração da imagem para a medida de pele valer. */
    static final double MIN_PERSON = 0.10;
    /** Pele do corpo (sem o rosto) nesta fração da pessoa ou mais: revisão humana. Máximo medido em fotos vestidas: 0,31. */
    static final double BODY_SKIN_REVIEW = 0.40;

    private final List<ImageSafetyPorts.RemoteClassifierPort> remotes;
    private final List<ImageSafetyPorts.PersonSegmentationPort> segmenters;
    private final boolean remoteEnabled;

    public ImageSafety(List<ImageSafetyPorts.RemoteClassifierPort> remotes, List<ImageSafetyPorts.PersonSegmentationPort> segmenters,
                       @Value("${fashionai.ai.remote-enabled:true}") boolean remoteEnabled) {
        this.remotes = remotes;
        this.segmenters = segmenters;
        this.remoteEnabled = remoteEnabled;
    }

    public Verdict check(byte[] bytes) {
        BufferedImage img;
        try {
            img = ImageOps.decode(bytes);
        } catch (ApiException ex) {
            if (ImageOps.TOO_LARGE.equals(ex.code())) {
                throw ex;                                     // dimensões acima do teto: recusa já aqui, sem decodificar
            }
            return new Verdict(Decision.ALLOW, "nenhum", List.of(), Map.of("decodable", false));
        } catch (RuntimeException ex) {
            // imagem ilegível: a validação de formato do próprio fluxo recusa; aqui não há o que avaliar
            return new Verdict(Decision.ALLOW, "nenhum", List.of(), Map.of("decodable", false));
        }
        BufferedImage small = ImageOps.scaleToFit(img, 1024, 1024);
        if (remoteEnabled) {
            for (ImageSafetyPorts.RemoteClassifierPort port : remotes) {
                if (!port.available()) {
                    continue;
                }
                try {
                    Optional<ImageSafetyPorts.Likelihoods> l = port.classify(ImageOps.jpeg(small, 0.85f));
                    if (l.isPresent()) {
                        return fromLikelihoods(port.name(), l.get());
                    }
                } catch (RuntimeException ex) {
                    log.warn("Classificador remoto {} falhou: {}", port.name(), ex.getMessage());
                }
            }
        }
        for (ImageSafetyPorts.PersonSegmentationPort seg : segmenters) {
            if (!seg.available()) {
                continue;
            }
            try {
                Optional<ImageSafetyPorts.PersonParts> p = seg.segment(small);
                if (p.isPresent()) {
                    return fromParts(p.get());
                }
            } catch (RuntimeException ex) {
                log.warn("Segmentação de pessoa falhou: {}", ex.getMessage());
            }
        }
        return new Verdict(Decision.REVIEW, "indisponivel", List.of(Msg.t("imageSafety.sem_classificador")), Map.of());
    }

    public static Verdict fromLikelihoods(String engine, ImageSafetyPorts.Likelihoods l) {
        Map<String, Object> signals = new LinkedHashMap<>();
        signals.put("adult", l.adult());
        signals.put("racy", l.racy());
        signals.put("violence", l.violence());
        List<String> reasons = new ArrayList<>();
        if (l.adult() >= 4) {
            reasons.add(Msg.t("imageSafety.nudez_provavel"));
            return new Verdict(Decision.BLOCK, engine, reasons, signals);
        }
        if (l.adult() == 3 || l.racy() >= 5 || l.violence() >= 5) {
            reasons.add(Msg.t("imageSafety.conteudo_sensivel_possivel"));
            return new Verdict(Decision.REVIEW, engine, reasons, signals);
        }
        return new Verdict(Decision.ALLOW, engine, reasons, signals);
    }

    public static Verdict fromParts(ImageSafetyPorts.PersonParts p) {
        Map<String, Object> signals = new LinkedHashMap<>();
        signals.put("person", round(p.person()));
        signals.put("bodySkin", round(p.bodySkin()));
        signals.put("faceSkin", round(p.faceSkin()));
        signals.put("clothes", round(p.clothes()));
        if (p.person() >= MIN_PERSON && p.bodySkin() >= BODY_SKIN_REVIEW) {
            return new Verdict(Decision.REVIEW, "segmentacao-local", List.of(Msg.t("imageSafety.muita_pele_exposta")), signals);
        }
        return new Verdict(Decision.ALLOW, "segmentacao-local", List.of(), signals);
    }

    private static double round(double v) {
        return Math.round(v * 1000) / 1000.0;
    }
}
