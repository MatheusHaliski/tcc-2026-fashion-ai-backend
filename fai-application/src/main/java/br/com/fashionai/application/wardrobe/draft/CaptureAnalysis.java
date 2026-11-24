package br.com.fashionai.application.wardrobe.draft;

import java.awt.image.BufferedImage;
import java.util.List;
import java.util.Set;

import br.com.fashionai.application.imaging.BrandReader;
import br.com.fashionai.application.imaging.LocalVision;
import br.com.fashionai.application.imaging.PhotoAcceptance;
import br.com.fashionai.application.service.WardrobeService.Draft;

/**
 * Resultado completo da análise para a sessão de captura.
 *
 * @param studioSource  peça endireitada e recortada em alta resolução (fonte do canônico e das zonas)
 * @param logoBox       caixa do logo relativa a {@code studioSource} (x0, y0, x1, y1 em 0–1) ou null
 * @param failedChecks  critérios de foto reprovados (só no modo lenient)
 * @param allChecks     todos os critérios avaliados (aprovados e reprovados)
 */
public record CaptureAnalysis(Draft draft, BufferedImage studioSource, Set<String> truncated,
                              double[] logoBox, String logoSource, LocalVision.PieceGuess guess,
                              BrandReader.Found ocr,
                              List<PhotoAcceptance.Check> failedChecks, List<PhotoAcceptance.Check> allChecks,
                              double rotationDeg, double backgroundConfidence, int originalWidth, int originalHeight,
                              boolean aiRan) {
}
