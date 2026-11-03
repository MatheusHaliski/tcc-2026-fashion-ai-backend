package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.local.ColorMath;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.domain.model.PieceUsageDiaryEntry;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.ChallengeRules.dateOf;

/**
 * Avaliação dos blocos de regra sobre um look (Desafio do Dia e desafios da comunidade), cartela da Minha Estação e dias
 * sem uso de uma peça. Colaborador do {@link ChallengeService} (R82).
 */
final class ChallengeRuleEvaluator {
    private final StyleDnaRepository dnas;
    private final PieceUsageDiaryEntryRepository diary;

    ChallengeRuleEvaluator(StyleDnaRepository dnas, PieceUsageDiaryEntryRepository diary) {
        this.dnas = dnas;
        this.diary = diary;
    }

    Set<String> paletteFamilies(UUID userId) {
        return dnas.findByUserId(userId).map(d -> {
            Set<String> out = Json.csv(d.getColorPalette()).stream().map(InventoryScoreService::family).filter(Objects::nonNull).collect(Collectors.toSet());
            if (out.isEmpty() && d.getColorSeason() != null) {
                out.addAll(switch (d.getColorSeason().toUpperCase(Locale.ROOT)) {
                    case "PRIMAVERA", "SPRING" -> Set.of("Amarelo", "Laranja", "Verde", "Rosa", "Branco");
                    case "VERAO", "VERÃO", "SUMMER" -> Set.of("Azul", "Rosa", "Roxo", "Cinza", "Branco");
                    case "OUTONO", "AUTUMN" -> Set.of("Marrom", "Laranja", "Verde", "Amarelo", "Vermelho");
                    default -> Set.of("Preto", "Branco", "Azul", "Vermelho", "Roxo");
                });
            }
            return out;
        }).orElse(Set.of());
    }

    /** Avalia blocos de regra sobre um look (Desafio do Dia e desafios da comunidade). */
    List<Boolean> evaluate(UUID userId, List<WardrobeItem> look, List<Map<String, Object>> blocks, LocalDate day) {
        List<Boolean> out = new ArrayList<>();
        for (Map<String, Object> b : blocks) {
            String type = String.valueOf(b.get("type"));
            Object v = b.get("value");
            boolean all = "all".equalsIgnoreCase(String.valueOf(b.getOrDefault("quantifier", "any")));
            java.util.function.Predicate<WardrobeItem> pred = switch (type) {
                case "color_family" -> w -> String.valueOf(v).equalsIgnoreCase(InventoryScoreService.family(w.getColor()));
                case "category" -> w -> String.valueOf(v).equals(w.getCategory());
                case "origin" -> w -> w.getPieceOrigin() != null && List.of(String.valueOf(v).split("\\|")).contains(w.getPieceOrigin().toUpperCase(Locale.ROOT));
                case "state" -> w -> switch (String.valueOf(v)) {
                    case "forgotten" -> daysUnused(w, day) >= RoomService.FORGOTTEN_DAYS;
                    case "favorite" -> w.isFavorite();
                    default -> w.isDisponivel();
                };
                case "unused_days" -> w -> daysUnused(w, day) >= (v instanceof Number n ? n.intValue() : 30);
                case "slot" -> w -> String.valueOf(v).equals(MirrorService.slotOf(w));
                default -> null;
            };
            boolean ok;
            if (pred != null) {
                ok = all ? !look.isEmpty() && look.stream().allMatch(pred) : look.stream().anyMatch(pred);
            } else {
                Set<String> fams = look.stream().map(w -> InventoryScoreService.family(w.getColor())).filter(Objects::nonNull).collect(Collectors.toSet());
                ok = switch (type) {
                    case "monochrome" -> look.size() >= 2 && fams.size() == 1;
                    case "neutral_only" -> !look.isEmpty() && look.stream().allMatch(w -> ColorMath.isNeutral(w.getColor()));
                    case "distinct_colors" -> fams.size() >= (v instanceof Number n ? n.intValue() : 3);
                    case "piece_count" -> look.size() <= (v instanceof Number n ? n.intValue() : 5);
                    default -> false;
                };
            }
            out.add(ok);
        }
        return out;
    }

    /** Dias sem uso antes do dia avaliado (ignora o uso do próprio dia, que já pode estar no diário). */
    long daysUnused(WardrobeItem w, LocalDate day) {
        LocalDate last = diary.findByWardrobeItemIdOrderByUsedOnDesc(w.getId()).stream().map(PieceUsageDiaryEntry::getUsedOn)
                .filter(d -> d.isBefore(day)).findFirst().orElse(null);
        LocalDate worn = w.getLastWornDate() != null && w.getLastWornDate().isBefore(day) ? w.getLastWornDate() : null;
        LocalDate ref = last == null ? worn : worn == null || last.isAfter(worn) ? last : worn;
        if (ref == null) {
            ref = w.getCreatedAt() == null ? day : dateOf(w.getCreatedAt());
        }
        return ChronoUnit.DAYS.between(ref, day);
    }
}
