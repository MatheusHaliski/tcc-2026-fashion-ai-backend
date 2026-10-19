package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.service.AtelierRewardSystem.Grant;
import br.com.fashionai.domain.model.AtelierRewardGrant.Category;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

/**
 * Regras do Atelier: qual evento, já validado pelo servidor, vira qual recompensa. Puro (sem I/O); quem persiste é
 * {@link AtelierRewardSystem#grant}, idempotente pela origem. Títulos e descrições são texto adiado ({@link Msg#k}),
 * resolvido no idioma de quem lê.
 * <ul>
 *   <li>Assinatura de Aura — sinergia descoberta numa partida dos modos FLAIR (uma por sinergia).</li>
 *   <li>Memória da peça — carta que volta a participar de um desafio diferente (um capítulo por desafio).</li>
 *   <li>Troféus habitáveis — troféu de temporada dos modos FLAIR ou grupo de desafios concluído.</li>
 *   <li>Poder de direção — missão FLAIR resgatada (vale 7 dias se diária, 30 se semanal).</li>
 *   <li>Obra coletiva — vitória do time numa partida em equipe (um fragmento por partida).</li>
 *   <li>Convites de temporada — jornada de marca ou celebridade concluída (combinação FLAIR; vale 90 dias).</li>
 * </ul>
 */
public final class AtelierGrants {
    static final Duration DAILY_DIRECTION = Duration.ofDays(7);
    static final Duration WEEKLY_DIRECTION = Duration.ofDays(30);
    static final Duration SEASON_PASS = Duration.ofDays(90);
    static final int TITLE_MAX = 140;
    static final int DESCRIPTION_MAX = 1200;

    private AtelierGrants() {
    }

    public static Grant synergy(UUID owner, String synergyCode, String synergyLabel, String modeLabel, UUID matchId) {
        return new Grant(owner, Category.auraSignature, code("SYNERGY_" + synergyCode),
                text(TITLE_MAX, "atelier.premio.aura.titulo", synergyLabel), text(DESCRIPTION_MAX, "atelier.premio.aura.descricao", modeLabel),
                "FLAIR", "synergy:" + code(synergyCode), String.valueOf(matchId), null);
    }

    public static Grant chapter(UUID owner, UUID challengeId, String challengeName, UUID cardId, String cardName, UUID pieceId) {
        return new Grant(owner, Category.garmentMemory, "CHAPTER",
                text(TITLE_MAX, "atelier.premio.memoria.titulo", cardName), text(DESCRIPTION_MAX, "atelier.premio.memoria.descricao", challengeName),
                "FLAIR", "challenge:" + challengeId + ":card:" + cardId, String.valueOf(pieceId == null ? cardId : pieceId), null);
    }

    public static Grant trophy(UUID owner, UUID trophyId, String mode, String title, String season) {
        return new Grant(owner, Category.habitableTrofeus, code("TROPHY_" + mode), fit(TITLE_MAX, title),
                text(DESCRIPTION_MAX, "atelier.premio.trofeu.descricao", season), "SEASON", "trophy:" + trophyId, season, null);
    }

    public static Grant groupCompleted(UUID owner, String groupCode, String groupName) {
        return new Grant(owner, Category.habitableTrofeus, "CBC_GROUP", text(TITLE_MAX, "atelier.premio.grupo.titulo", groupName),
                text(DESCRIPTION_MAX, "atelier.premio.grupo.descricao", groupName), "SEASON", "cbc-group:" + groupCode, groupCode, null);
    }

    public static Grant quest(UUID owner, String questCode, String questLabel, String period, String periodRef, Instant now) {
        Duration valid = "WEEK".equals(period) ? WEEKLY_DIRECTION : DAILY_DIRECTION;
        return new Grant(owner, Category.directorPower, code("QUEST_" + questCode), text(TITLE_MAX, "atelier.premio.direcao.titulo", questLabel),
                text(DESCRIPTION_MAX, "atelier.premio.direcao.descricao"), "FLAIR", "quest:" + code(questCode) + ":" + periodRef, null, now.plus(valid));
    }

    public static Grant teamWin(UUID owner, UUID matchId, UUID teamId, String teamName, String rivalName) {
        return new Grant(owner, Category.collectiveWork, "TEAM_WIN", text(TITLE_MAX, "atelier.premio.coletiva.titulo", teamName),
                text(DESCRIPTION_MAX, "atelier.premio.coletiva.descricao", teamName, rivalName), "TEAM", "team-match:" + matchId, String.valueOf(teamId), null);
    }

    public static Grant brandJourney(UUID owner, UUID combinationId, String combinationName, UUID brandId, String brandName, Instant now) {
        return new Grant(owner, Category.seasonPasses, "BRAND_JOURNEY", text(TITLE_MAX, "atelier.premio.temporada.titulo", brandName),
                text(DESCRIPTION_MAX, "atelier.premio.temporada.descricao", combinationName), "FLAIR", "combination:" + combinationId,
                String.valueOf(brandId), now.plus(SEASON_PASS));
    }

    /** Código aceito pelo {@link AtelierRewardSystem#grant}: maiúsculas, dígitos e {@code _:-}, até 80. */
    static String code(String raw) {
        String c = String.valueOf(raw).toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9_:-]", "_");
        return c.length() > 80 ? c.substring(0, 80) : c;
    }

    /** Texto adiado; se o marcador não couber na coluna, grava o texto já resolvido e cortado. */
    static String text(int max, String key, Object... args) {
        String deferred = Msg.k(key, args);
        return deferred.length() <= max ? deferred : fit(max, Msg.resolve(Msg.t(key, args)));
    }

    static String fit(int max, String s) {
        String v = s == null || s.isBlank() ? "—" : s.strip();
        return v.length() <= max ? v : v.substring(0, max - 1) + "…";
    }
}
