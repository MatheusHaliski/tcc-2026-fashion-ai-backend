package br.com.fashionai.application.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Divisão da recompensa na conclusão de um desafio (CA12), uma estratégia por modo — Strategy em enum.
 *
 * <p>Puro: não lê repositório, relógio nem i18n e não concede pontos. Recebe os membros na ordem em que o
 * {@link ChallengeService} os lê e devolve, na mesma ordem, os pontos de cada um; o serviço continua dono da transação,
 * de marcar {@code CONCLUIU}, de chamar {@code FaiPointsService.award} (idempotente por desafio) e de montar o resultado.
 * Regras preservadas: piso de 25 % (equipe e solo/comunidade), pote da equipe dividido em partes inteiras iguais,
 * vencedor do duelo (ou time vencedor, sem time conta como A) leva o prêmio cheio e os demais um quarto.
 */
enum ChallengeRewardSplit {
    /** Equipe: o pote é a média das frações × prêmio (zero abaixo de 25 %), dividido igualmente. */
    TEAM {
        @Override
        Outcome split(List<Member> members, Map<UUID, Double> scores, int reward) {
            double teamFraction = members.stream().mapToDouble(Member::fraction).average().orElse(0);
            int pool = teamFraction < FLOOR ? 0 : (int) Math.round(reward * teamFraction);
            int each = members.isEmpty() ? 0 : pool / members.size();
            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("teamFraction", ChallengeService.round2(teamFraction));
            summary.put("rewardEach", each);
            return new Outcome(summary, members.stream().map(m -> each).toList(), List.of());
        }
    },
    /** Duelo: maior pontuação (individual ou média do time) vence; empate dá vitória a todos os empatados. */
    DUEL {
        @Override
        Outcome split(List<Member> members, Map<UUID, Double> scores, int reward) {
            Map<String, Object> summary = new LinkedHashMap<>();
            List<Integer> points = new ArrayList<>();
            List<UUID> winners = new ArrayList<>();
            boolean teams = members.stream().anyMatch(m -> "B".equals(m.team()));
            if (teams) {
                Map<String, Double> byTeam = members.stream().collect(Collectors.groupingBy(Member::side,
                        Collectors.averagingDouble(m -> scores.getOrDefault(m.userId(), 0.0))));
                double top = byTeam.values().stream().mapToDouble(Double::doubleValue).max().orElse(0);
                Set<String> win = byTeam.entrySet().stream().filter(e -> e.getValue() == top && top > 0).map(Map.Entry::getKey)
                        .collect(Collectors.toSet());
                summary.put("teams", byTeam);
                for (Member m : members) {
                    award(m, win.contains(m.side()), reward, points, winners);
                }
            } else {
                double best = scores.values().stream().mapToDouble(Double::doubleValue).max().orElse(0);
                for (Member m : members) {
                    award(m, best > 0 && scores.getOrDefault(m.userId(), 0.0) == best, reward, points, winners);
                }
            }
            return new Outcome(summary, points, winners);
        }

        private void award(Member m, boolean won, int reward, List<Integer> points, List<UUID> winners) {
            if (won) {
                winners.add(m.userId());
            }
            points.add(won ? reward : reward / 4);
        }
    },
    /** Solo e comunidade: prêmio proporcional à própria fração (teto 100 %, zero abaixo de 25 %). */
    INDIVIDUAL {
        @Override
        Outcome split(List<Member> members, Map<UUID, Double> scores, int reward) {
            List<Integer> points = members.stream().map(m -> {
                double f = m.fraction();
                return f < FLOOR ? 0 : (int) Math.round(reward * Math.min(1, f));
            }).toList();
            Map<String, Object> summary = new LinkedHashMap<>();
            if (!members.isEmpty()) {
                summary.put("fraction", ChallengeService.round2(members.get(0).fraction()));
            }
            return new Outcome(summary, points, List.of());
        }
    };

    /** Fração mínima para receber pontos na equipe e no solo/comunidade. */
    static final double FLOOR = 0.25;

    /** Membro que recebe recompensa: o progresso é lido só pelos modos que o usam (como antes da extração). */
    record Member(UUID userId, String team, BigDecimal progress) {
        double fraction() {
            return progress.doubleValue();
        }

        String side() {
            return team == null ? "A" : team;
        }
    }

    /**
     * Resultado da divisão: {@code summary} entra no resultJson na ordem dada; {@code points} tem um valor por membro,
     * na ordem recebida; {@code winners} só é preenchido no duelo.
     */
    record Outcome(Map<String, Object> summary, List<Integer> points, List<UUID> winners) {
    }

    /** EQUIPE → {@link #TEAM}; DUELO → {@link #DUEL}; qualquer outro modo (SOLO, COMUNIDADE) → {@link #INDIVIDUAL}. */
    static ChallengeRewardSplit forMode(String mode) {
        return switch (mode) {
            case "EQUIPE" -> TEAM;
            case "DUELO" -> DUEL;
            default -> INDIVIDUAL;
        };
    }

    /** {@code scores} só é usado no duelo (votos às cegas ou recorde pessoal, calculados pelo serviço). */
    abstract Outcome split(List<Member> members, Map<UUID, Double> scores, int reward);
}
