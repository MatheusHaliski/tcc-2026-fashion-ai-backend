package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.ChallengeEvent;
import br.com.fashionai.domain.model.ChallengeInstance;
import br.com.fashionai.domain.model.ChallengeNote;
import br.com.fashionai.domain.model.ChallengeParticipant;
import br.com.fashionai.domain.model.ChallengeTemplate;
import br.com.fashionai.domain.model.ChallengeVote;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.repository.ChallengeEventRepository;
import br.com.fashionai.domain.repository.ChallengeInstanceRepository;
import br.com.fashionai.domain.repository.ChallengeNoteRepository;
import br.com.fashionai.domain.repository.ChallengeParticipantRepository;
import br.com.fashionai.domain.repository.ChallengeTemplateRepository;
import br.com.fashionai.domain.repository.ChallengeVoteRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.service.ChallengeRules.SINGLE_SHOT;
import static br.com.fashionai.application.service.ChallengeRules.VOTED;
import static br.com.fashionai.application.service.ChallengeRules.tplName;
import static br.com.fashionai.application.service.ChallengeService.ATIVO;
import static br.com.fashionai.application.service.ChallengeService.NOTE_MAX;
import static br.com.fashionai.application.service.ChallengeService.PRESET_NOTES;
import static br.com.fashionai.application.service.ChallengeService.P_ATIVO;
import static br.com.fashionai.application.service.ChallengeService.P_CONCLUIU;
import static br.com.fashionai.application.service.ChallengeService.REACTIONS;

/**
 * Inscrição de look, feed e voto às cegas (CA08), bilhetes (CA16) e reações. Colaborador do {@link ChallengeService} (R82).
 */
final class ChallengeSocial {
    private final Guard guard;
    private final FaiPointsService points;
    private final ChallengeInstanceRepository instances;
    private final ChallengeTemplateRepository templates;
    private final ChallengeParticipantRepository participants;
    private final ChallengeEventRepository evidence;
    private final ChallengeVoteRepository votes;
    private final ChallengeNoteRepository notes;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final ChallengeStore store;
    private final ChallengeConclusion conclusion;
    private final ChallengeDetailView views;

    ChallengeSocial(Guard guard, FaiPointsService points, ChallengeInstanceRepository instances, ChallengeTemplateRepository templates,
                    ChallengeParticipantRepository participants, ChallengeEventRepository evidence, ChallengeVoteRepository votes,
                    ChallengeNoteRepository notes, SchemeRepository schemes, SchemeItemRepository schemeItems, ChallengeStore store,
                    ChallengeConclusion conclusion, ChallengeDetailView views) {
        this.guard = guard;
        this.points = points;
        this.instances = instances;
        this.templates = templates;
        this.participants = participants;
        this.evidence = evidence;
        this.votes = votes;
        this.notes = notes;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.store = store;
        this.conclusion = conclusion;
        this.views = views;
    }

    Map<String, Object> submitEntry(CurrentUser user, UUID id, UUID schemeId) {
        ChallengeInstance i = store.instance(id);
        ChallengeTemplate t = store.template(i.getTemplateCode());
        ChallengeParticipant me = participants.findByInstanceIdAndUserId(id, user.id()).filter(p -> P_ATIVO.equals(p.getStatus()))
                .orElseThrow(() -> guard.deny(user, "challenge:" + id, Msg.t("challenge.voce_nao_participa_deste_desafio")));
        if (!ATIVO.equals(i.getState())) {
            throw new ApiException(409, "ESTADO_INVALIDO", Msg.t("challenge.o_desafio_nao_esta_ativo"));
        }
        Scheme s = schemes.findById(schemeId).orElseThrow(() -> ApiException.notFound("Esquema"));
        guard.requireOwner(user, s.getUser().getId(), "scheme:" + schemeId);
        List<SchemeItem> items = schemeItems.findBySchemeIdOrderBySortOrder(schemeId);
        if (items.size() < 2 || items.stream().anyMatch(si -> !si.getWardrobeItem().getUser().getId().equals(user.id()))) {
            throw ApiException.badRequest("LOOK_INVALIDO", Msg.t("challenge.o_look_precisa_de_ao"));
        }
        boolean hasEntry = evidence.findByInstanceIdAndUserId(id, user.id()).stream().anyMatch(e -> "LOOK_ENTRY".equals(e.getEvidenceType()));
        if (hasEntry && SINGLE_SHOT.contains(t.getCode())) {
            throw new ApiException(409, "JA_INSCRITO", Msg.t("challenge.voce_ja_inscreveu_um_look"));
        }
        store.record(i, user.id(), "LOOK_ENTRY", schemeId);
        points.game(user.id(), "CHALLENGE", id.toString(), null);   // RF41: inscrever um look é jogar (1× por desafio)
        conclusion.refresh(i, t);
        return views.detail(user, id);
    }

    /** Feed de votação às cegas (The Runway — Batalha na Passarela). */
    List<Map<String, Object>> voteFeed(CurrentUser user) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (ChallengeInstance i : instances.findByStateIn(List.of(ATIVO))) {
            ChallengeTemplate t = templates.findById(i.getTemplateCode()).orElse(null);
            if (t == null || !VOTED.contains(t.getCode()) || !"DUELO".equals(i.getMode())) {
                continue;
            }
            List<Map<String, Object>> entries = views.entries(user, i, t, true).stream().filter(e -> !Boolean.TRUE.equals(e.get("mine"))).toList();
            if (!entries.isEmpty()) {
                out.add(Map.of("challengeId", i.getId(), "name", tplName(t), "theme", String.valueOf(Json.map(i.getParamsJson()).get("theme")),
                        "entries", entries, "endsAt", String.valueOf(i.getEndsAt())));
            }
        }
        return out;
    }

    /**
     * Voto às cegas (RF36.CA08): a batalha é votada pela comunidade (03-desafios-e-games §1), então não precisa ser
     * participante — mas precisa de conta verificada e ativa. Um voto por pessoa em cada batalha, garantido no banco
     * (uq_ch_vote_voter): dois cliques simultâneos não viram dois votos.
     */
    Map<String, Object> vote(CurrentUser user, UUID id, UUID entrySchemeId) {
        guard.requireCanCreate(user);
        ChallengeInstance i = store.instance(id);
        ChallengeTemplate t = store.template(i.getTemplateCode());
        if (!ATIVO.equals(i.getState()) || !VOTED.contains(t.getCode())) {
            throw new ApiException(409, "VOTACAO_FECHADA", Msg.t("challenge.a_votacao_deste_desafio_nao"));
        }
        ChallengeEvent entry = evidence.findByInstanceId(id).stream().filter(e -> "LOOK_ENTRY".equals(e.getEvidenceType()) && e.getRefId().equals(entrySchemeId))
                .findFirst().orElseThrow(() -> ApiException.notFound(Msg.t("challenge.look_inscrito")));
        if (entry.getUserId().equals(user.id())) {
            throw ApiException.badRequest("VOTO_PROPRIO", Msg.t("challenge.voce_nao_pode_votar_no"));
        }
        if (votes.existsByInstanceIdAndVoterUserId(id, user.id())) {
            throw new ApiException(409, "JA_VOTOU", Msg.t("challenge.voce_ja_votou_nesta_batalha"));
        }
        ChallengeVote v = new ChallengeVote();
        v.setId(UUID.randomUUID());
        v.setInstanceId(id);
        v.setVoterUserId(user.id());
        v.setEntrySchemeId(entrySchemeId);
        try {
            votes.saveAndFlush(v);
        } catch (DataIntegrityViolationException race) {
            throw new ApiException(409, "JA_VOTOU", Msg.t("challenge.voce_ja_votou_nesta_batalha"));
        }
        return Map.of("voted", true, "note", Msg.t("challenge.marca_preco_e_autor_aparecem"));
    }

    /** CA16 — bilhete: frase pronta ou texto livre de até 80 caracteres, moderado. Não existe chat livre. */
    Map<String, Object> note(CurrentUser user, UUID id, String preset, String free) {
        ChallengeInstance i = requireSocial(user, id);
        String content;
        String kind;
        if (preset != null && !preset.isBlank()) {
            if (PRESET_NOTES.stream().noneMatch(p -> Msg.matchesAnyLocale(p, preset))) {
                throw ApiException.badRequest("FRASE_INVALIDA", Msg.t("challenge.escolha_uma_das_frases_prontas"));
            }
            content = preset;
            kind = "PRESET";
        } else {
            content = InputSanitizer.moderated("bilhete", free == null ? "" : free, NOTE_MAX);
            if (content.isBlank()) {
                throw ApiException.badRequest("BILHETE_VAZIO", Msg.t("challenge.escreva_um_bilhete_de_ate"));
            }
            kind = "FREE";
        }
        ChallengeNote n = new ChallengeNote();
        n.setId(UUID.randomUUID());
        n.setInstanceId(i.getId());
        n.setUserId(user.id());
        n.setKind(kind);
        n.setContent(content);
        notes.save(n);
        return Map.of("kind", kind, "content", content);
    }

    Map<String, Object> react(CurrentUser user, UUID id, String emoji) {
        ChallengeInstance i = requireSocial(user, id);
        if (!REACTIONS.contains(emoji)) {
            throw ApiException.badRequest("REACAO_INVALIDA", Msg.t("challenge.reacoes_disponiveis", String.join(" ", REACTIONS)));
        }
        ChallengeNote n = new ChallengeNote();
        n.setId(UUID.randomUUID());
        n.setInstanceId(i.getId());
        n.setUserId(user.id());
        n.setKind("REACTION");
        n.setContent(emoji);
        notes.save(n);
        return Map.of("reaction", emoji);
    }

    ChallengeInstance requireSocial(CurrentUser user, UUID id) {
        ChallengeInstance i = store.instance(id);
        if (!"EQUIPE".equals(i.getMode()) && !"DUELO".equals(i.getMode())) {
            throw ApiException.badRequest("SEM_INTERACAO", Msg.t("challenge.reacoes_e_bilhetes_existem_so"));
        }
        participants.findByInstanceIdAndUserId(id, user.id()).filter(p -> P_ATIVO.equals(p.getStatus()) || P_CONCLUIU.equals(p.getStatus()))
                .orElseThrow(() -> guard.deny(user, "challenge:" + id, Msg.t("challenge.voce_nao_participa_deste_desafio")));
        return i;
    }
}
