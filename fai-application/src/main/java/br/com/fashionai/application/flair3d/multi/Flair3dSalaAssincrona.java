package br.com.fashionai.application.flair3d.multi;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair3d.Flair3dErros;
import br.com.fashionai.application.flair3d.Flair3dNucleoService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Flair3dMatch;
import br.com.fashionai.domain.model.Flair3dSala;
import br.com.fashionai.domain.model.FlairMakeUpLook;
import br.com.fashionai.domain.repository.Flair3dMatchRepository;
import br.com.fashionai.domain.repository.Flair3dSalaRepository;
import br.com.fashionai.domain.repository.FlairMakeUpLookRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Sala ASSINCRONO (mesma semente): cada pessoa abre a própria partida pela sala, com a semente e a rodada dela, e joga
 * quando puder, com o mesmo sorteio da outra (o motor do FLAIR 3D é determinístico pela semente). Uma partida por
 * lado (409 na segunda). No MAKE UP, a pessoa registra o look que entregou no brief da sala. Quando as duas partidas
 * fecham, a sala fecha: mais pontos vence, depois mais estrelas, senão empate. A nota da outra pessoa só aparece no
 * fechamento (ninguém joga sabendo o alvo).
 */
@Service
public class Flair3dSalaAssincrona {
    private final Flair3dSalaRepository salas;
    private final Flair3dMatchRepository matches;
    private final FlairMakeUpLookRepository looks;
    private final Flair3dNucleoService nucleos;
    private final Flair3dSalaAcesso acesso;
    private final Flair3dSalaAvisos avisos;

    public Flair3dSalaAssincrona(Flair3dSalaRepository salas, Flair3dMatchRepository matches, FlairMakeUpLookRepository looks,
                                 Flair3dNucleoService nucleos, Flair3dSalaAcesso acesso, Flair3dSalaAvisos avisos) {
        this.salas = salas;
        this.matches = matches;
        this.looks = looks;
        this.nucleos = nucleos;
        this.acesso = acesso;
        this.avisos = avisos;
    }

    /** Abre a partida do lado de quem pede, com a semente e a rodada da sala (o deck e o avatar seguem as regras do jogo). */
    @Transactional
    public Map<String, Object> abrir(CurrentUser user, UUID salaId, Flair3dNucleoService.AbrirPartida pedido) {
        Flair3dSala s = emJogo(user, salaId);
        if (Flair3dSalaJogos.MAKE_UP.equals(s.getJogo())) {
            throw Flair3dErros.invalido("SALA_MODO_ERRADO", "sala_modo_errado");
        }
        exigirSemPartida(s, user.id());
        Flair3dNucleoService.AbrirPartida comRodada = new Flair3dNucleoService.AbrirPartida(pedido == null ? null : pedido.deck(),
                pedido == null ? null : pedido.avatar(), s.getRodada());
        Map<String, Object> aberta = new LinkedHashMap<>(nucleos.abrirComSemente(user, s.getJogo(), comRodada, s.getSemente()));
        gravarPartida(s, user.id(), (UUID) aberta.get("id"));
        aberta.put("sala", s.getId());
        return aberta;
    }

    /** MAKE UP: registra o look entregue no brief da sala, depois do convite (422 fora disso). */
    @Transactional
    public Map<String, Object> registrarLook(CurrentUser user, UUID salaId, UUID lookId) {
        Flair3dSala s = emJogo(user, salaId);
        exigirSemPartida(s, user.id());
        FlairMakeUpLook look = lookId == null ? null : looks.findById(lookId).orElse(null);
        boolean vale = look != null && look.getUserId().equals(user.id()) && Objects.equals(look.getBrief(), s.getRodada())
                && !look.getCreatedAt().isBefore(s.getCreatedAt());
        if (!Flair3dSalaJogos.MAKE_UP.equals(s.getJogo()) || !vale) {
            throw Flair3dErros.invalido("LOOK_FORA_DA_SALA", "look_fora_da_sala");
        }
        gravarPartida(s, user.id(), lookId);
        return andamento(salas.findById(salaId).orElse(s), user.id());
    }

    private Flair3dSala emJogo(CurrentUser user, UUID salaId) {
        Flair3dSala s = acesso.travada(user.id(), salaId);
        Flair3dSalaAcesso.exigirModo(s, Flair3dSala.ASSINCRONO);
        Flair3dSalaAcesso.exigirEstado(s, Flair3dSala.JOGANDO);
        return s;
    }

    private static void exigirSemPartida(Flair3dSala s, UUID userId) {
        UUID minha = s.getDeUserId().equals(userId) ? s.getPartidaDe() : s.getPartidaPara();
        if (minha != null) {
            throw new ApiException(409, "SALA_PARTIDA_JA_ABERTA", Msg.t("flair3d.erro.sala_partida_ja_aberta"), Map.of("partida", minha));
        }
    }

    private void gravarPartida(Flair3dSala s, UUID userId, UUID partida) {
        if (s.getDeUserId().equals(userId)) {
            s.setPartidaDe(partida);
        } else {
            s.setPartidaPara(partida);
        }
        salas.save(s);
    }

    /** {pontos, estrelas, terminou} do lado; nulo sem partida. */
    private Map<String, Object> lado(Flair3dSala s, UUID partida) {
        if (partida == null) {
            return null;
        }
        Map<String, Object> m = new LinkedHashMap<>();
        if (Flair3dSalaJogos.MAKE_UP.equals(s.getJogo())) {
            looks.findById(partida).ifPresent(l -> {
                m.put("pontos", l.getPontos());
                m.put("estrelas", l.getEstrelas());
            });
            m.put("terminou", !m.isEmpty());
            return m;
        }
        Flair3dMatch match = matches.findById(partida).orElse(null);
        boolean terminou = match != null && Flair3dMatch.ENTREGUE.equals(match.getStatus());
        m.put("terminou", terminou);
        m.put("pontos", terminou ? match.getPontos() : null);
        m.put("estrelas", terminou ? match.getEstrelas() : null);
        return m;
    }

    /**
     * O andamento para quem lê: a própria partida (id, para continuar), se a outra pessoa já terminou e, com as duas
     * terminadas, o fechamento da sala (resultado e aviso para os dois). Chamado na leitura da sala.
     */
    @Transactional
    public Map<String, Object> andamento(Flair3dSala s, UUID quemLe) {
        Map<String, Object> de = lado(s, s.getPartidaDe());
        Map<String, Object> para = lado(s, s.getPartidaPara());
        boolean souDe = s.getDeUserId().equals(quemLe);
        if (Flair3dSala.JOGANDO.equals(s.getEstado()) && terminou(de) && terminou(para)) {
            s = fechar(s, de, para);
        } else if (Flair3dSala.JOGANDO.equals(s.getEstado()) && terminou(de) != terminou(para)) {
            avisarUmaVez(s, terminou(de) ? s.getParaUserId() : s.getDeUserId());
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("minhaPartida", souDe ? s.getPartidaDe() : s.getPartidaPara());
        out.put("eu", souDe ? de : para);
        Map<String, Object> outro = souDe ? para : de;
        boolean aberta = Flair3dSala.FECHADO.equals(s.getEstado());
        out.put("outro", outro == null ? null : aberta ? outro : Map.of("terminou", outro.get("terminou")));
        return Map.of("assincrono", out, "estado", s.getEstado());
    }

    /** A outra pessoa terminou: quem falta é avisado uma vez só (a marca fica em turnos_json, que o modo não usa). */
    private void avisarUmaVez(Flair3dSala s, UUID falta) {
        if (s.getTurnosJson() != null) {
            return;
        }
        s.setTurnosJson(Json.write(Map.of("avisado", falta)));
        salas.save(s);
        avisos.vez(s, falta);
    }

    private static boolean terminou(Map<String, Object> lado) {
        return lado != null && Boolean.TRUE.equals(lado.get("terminou"));
    }

    private Flair3dSala fechar(Flair3dSala s, Map<String, Object> de, Map<String, Object> para) {
        Flair3dSala travada = salas.findForUpdateById(s.getId()).orElse(s);
        if (!Flair3dSala.JOGANDO.equals(travada.getEstado())) {
            return travada;
        }
        int cmp = compara(de, para);
        travada.setVencedorUserId(cmp > 0 ? travada.getDeUserId() : cmp < 0 ? travada.getParaUserId() : null);
        travada.setResultadoJson(Json.write(Map.of("de", de, "para", para, "motivo", "PONTOS")));
        travada.setEstado(Flair3dSala.FECHADO);
        travada = salas.save(travada);
        avisos.resultado(travada);
        return travada;
    }

    static int compara(Map<String, Object> de, Map<String, Object> para) {
        for (String campo : List.of("pontos", "estrelas")) {
            int c = Integer.compare(numero(de.get(campo)), numero(para.get(campo)));
            if (c != 0) {
                return c;
            }
        }
        return 0;
    }

    private static int numero(Object o) {
        return o instanceof Number n ? n.intValue() : 0;
    }
}
