package br.com.fashionai.application.garmentdelivery;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Contratos do FashionAI Garment Delivery: comandos, cotação congelada e projeções. Nenhum campo de pagamento. */
public final class GarmentDeliveryViews {
    private GarmentDeliveryViews() {
    }

    /** Criação: a chave {@code requestId} torna a repetição idempotente; {@code acceptSimulation} confirma "sem cobrança". */
    public record CreateCmd(String requestId, String size, String cep, String deliveryLabel, String speed, boolean acceptSimulation) {
    }

    public record VersionCmd(long expectedVersion) {
    }

    /** Tipo de peça reconhecido na ficha: subcategoria da taxonomia, linha de produção, material, cor e imagem do tipo. */
    public record Garment(String family, String category, String subcategory, String line, String materialCode,
                          String colorCode, String colorHex, String imageUrl) {
    }

    public record CompositionLine(String fiber, int percent) {
    }

    /** {@code source}: FABRIC_PERCENT, BOM, FABRIC ou UNSPECIFIED. */
    public record Composition(List<CompositionLine> lines, String source) {
    }

    /** Etiqueta de cuidados em códigos (a tela desenha os símbolos e traduz); {@code washCode} é o código de TipoLavagem. */
    public record CareLabel(String profile, String wash, String bleach, String tumble, String iron, String dryClean,
                            String naturalDry, List<String> tips, String washCode) {
    }

    /** Medida-chave no tamanho escolhido; {@code checked} é a medida conferida no controle de qualidade. */
    public record Measure(String point, String protocol, BigDecimal base, BigDecimal value, BigDecimal tolerance, BigDecimal checked) {
    }

    public record SizeChoice(String grid, List<String> labels, String base, String selected) {
    }

    public record Price(BigDecimal base, BigDecimal fabricFactor, String complexity, BigDecimal complexityFactor,
                        BigDecimal garment, BigDecimal shipping, BigDecimal total, String currency) {
    }

    /** Entrega fictícia: CEP mascarado (só 5 dígitos guardados), região, dias úteis de trânsito e apelido opcional. */
    public record Delivery(String cepMasked, String region, int transitDays, String label) {
    }

    public record PlanStep(String stage, Instant at) {
    }

    /** Crédito do desenho: a autoria do projeto, editores com convite aceito e a autoria da revisão. */
    public record Designer(UUID userId, String username, String role) {
    }

    /** O que fica congelado na encomenda (coluna quote_json). */
    public record Frozen(Garment garment, Composition composition, CareLabel care, List<Measure> measurements,
                         SizeChoice sizes, Price price, Delivery delivery, List<Designer> designers) {
    }

    public record Quote(UUID projectId, UUID revisionId, int revisionNumber, String projectTitle, String specDigest,
                        boolean eligible, List<String> missingFields, Garment garment, SizeChoice sizes,
                        Composition composition, CareLabel care, List<Measure> measurements, Price price,
                        Delivery delivery, String speed, List<PlanStep> plan, Instant estimatedDelivery,
                        List<Designer> designers, String factoryCode, String notice) {
    }

    /** {@code state}: DONE, CURRENT, UPCOMING ou SKIPPED (etapas que não acontecem depois de um cancelamento). */
    public record TimelineStep(String stage, Instant plannedAt, Instant occurredAt, String state) {
    }

    public record OrderSummary(UUID id, String status, String speed, String projectTitle, String sizeLabel, String imageUrl,
                               String serialNumber, Instant placedAt, Instant estimatedDelivery, double progress,
                               BigDecimal priceTotal, String currency) {
    }

    public record OrderDetail(UUID id, long version, String status, String speed, Instant now, Instant placedAt,
                              Instant estimatedDelivery, double progress, boolean cancellable, boolean receivable,
                              String serialNumber, String lotCode, String trackingCode, String factoryCode,
                              UUID projectId, UUID revisionId, int revisionNumber, String projectTitle, String specDigest,
                              Garment garment, String sizeLabel, Composition composition, CareLabel care,
                              List<Measure> measurements, Price price, Delivery delivery, List<Designer> designers,
                              List<TimelineStep> timeline, Instant cancelledAt, Instant receivedAt, UUID pieceId, String notice) {
    }
}
