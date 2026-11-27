package br.com.fashionai.application.flair3d.multi;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Flair3dCartas;
import br.com.fashionai.application.flair3d.Flair3dDeck;
import br.com.fashionai.application.flair3d.Flair3dDuelo;
import br.com.fashionai.application.flair3d.Flair3dErros;
import br.com.fashionai.application.flair3d.Flair3dNucleos;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.Flair3dSala;
import br.com.fashionai.domain.repository.Flair3dSalaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Sala TURNOS: cada pessoa leva um deck (as regras do deck do jogo, 422) e faz um lance por turno. O lance fica
 * selado até a outra pessoa lançar o mesmo turno; aí o servidor julga ({@link Flair3dDuelo} do jogo) e o turno
 * aparece para os dois. Ninguém lança dois turnos à frente (409 ESPERE_A_VEZ) nem repete um turno (409
 * TURNO_FORA_DE_ORDEM: o segundo clique, ou dois pedidos ao mesmo tempo, não grava nada). A sala é lida travada, então
 * os dois lances de um turno são gravados um depois do outro. No fim do duelo a sala fecha e os dois são avisados.
 */
@Service
public class Flair3dSalaTurnos {
    /** {@code turno}: o turno que a tela acha que é o da vez (1, 2...); {@code cartas}: vaga → carta do deck. */
    public record Lance(int turno, Map<String, UUID> cartas) {
    }

    private final Flair3dSalaRepository salas;
    private final Flair3dCartas cartas;
    private final Flair3dSalaAcesso acesso;
    private final Flair3dSalaAvisos avisos;
    private final Flair3dSalaPlacar placar;
    private final Flair3dSalaVista vista;

    public Flair3dSalaTurnos(Flair3dSalaRepository salas, Flair3dCartas cartas, Flair3dSalaAcesso acesso, Flair3dSalaAvisos avisos,
                             Flair3dSalaPlacar placar, Flair3dSalaVista vista) {
        this.salas = salas;
        this.cartas = cartas;
        this.acesso = acesso;
        this.avisos = avisos;
        this.placar = placar;
        this.vista = vista;
    }

    /** O deck do lado de quem pede, conferido pelas regras do jogo; só antes do primeiro lance (409 depois). */
    @Transactional
    public Map<String, Object> escolherDeck(CurrentUser user, UUID salaId, List<UUID> deck) {
        Flair3dSala s = emJogo(user, salaId);
        Flair3dSalaPlacar.Turnos t = Flair3dSalaPlacar.Turnos.ler(s.getTurnosJson());
        if (!t.lances(s.getDeUserId().equals(user.id())).isEmpty()) {
            throw ApiException.conflict("DECK_TRAVADO", Msg.t("flair3d.erro.deck_travado"));
        }
        List<UUID> ids = deck == null ? List.of() : deck.stream().filter(Objects::nonNull).distinct().toList();
        Definicao d = Flair3dNucleos.porCodigo(s.getJogo()).orElseThrow().definicao();
        Definicao naRodada = s.getRodada() == null ? d : d.naRodada(s.getRodada());
        Flair3dDeck.validar(naRodada.deck(), ids, cartas.daPessoa(user.id(), ids));
        if (s.getDeUserId().equals(user.id())) {
            s.setDeckDeJson(Json.write(ids));
        } else {
            s.setDeckParaJson(Json.write(ids));
        }
        return completa(salas.save(s), user.id());
    }

    @Transactional
    public Map<String, Object> lancar(CurrentUser user, UUID salaId, Lance lance) {
        Flair3dSala s = emJogo(user, salaId);
        Flair3dDuelo duelo = Flair3dSalaJogos.duelo(s.getJogo()).orElseThrow();
        boolean souDe = s.getDeUserId().equals(user.id());
        List<UUID> deck = Flair3dDeck.ids(souDe ? s.getDeckDeJson() : s.getDeckParaJson());
        if (deck.isEmpty()) {
            throw Flair3dErros.invalido("SEM_DECK_NA_SALA", "sem_deck_na_sala");
        }
        Flair3dSalaPlacar.Turnos t = Flair3dSalaPlacar.Turnos.ler(s.getTurnosJson());
        List<Map<String, UUID>> meus = t.lances(souDe);
        int vez = meus.size() + 1;
        if (lance == null || lance.turno() != vez || vez > duelo.turnos()) {
            throw new ApiException(409, "TURNO_FORA_DE_ORDEM", Msg.t("flair3d.erro.turno_fora_de_ordem"), Map.of("vez", vez));
        }
        if (meus.size() > t.lances(!souDe).size()) {
            throw ApiException.conflict("ESPERE_A_VEZ", Msg.t("flair3d.erro.espere_a_vez"));
        }
        Map<String, UUID> pedido = lance.cartas() == null ? Map.of() : lance.cartas();
        conferir(duelo, pedido, deck, meus, cartas.daPessoa(user.id(), deck));
        Map<String, UUID> gravado = new java.util.LinkedHashMap<>();
        pedido.forEach((vaga, id) -> {
            if (id != null) {
                gravado.put(vaga, id);
            }
        });
        t.lances(souDe).add(gravado);
        s.setTurnosJson(t.escrever());
        Flair3dDuelo.Placar p = placar.julgar(s, duelo, t);
        if (p.encerrado()) {
            placar.fechar(s, p);
            avisos.resultado(s);
        } else if (t.lances(!souDe).size() < vez) {
            avisos.vez(s, s.outro(user.id()));
        }
        return completa(salas.save(s), user.id());
    }

    /** A sala inteira depois do lance ou do deck: a tela troca a sala de uma vez, sem esperar o próximo polling. */
    private Map<String, Object> completa(Flair3dSala s, UUID quem) {
        return vista.completa(s, quem, placar.andamento(s, quem));
    }

    private Flair3dSala emJogo(CurrentUser user, UUID salaId) {
        Flair3dSala s = acesso.travada(user.id(), salaId);
        Flair3dSalaAcesso.exigirModo(s, Flair3dSala.TURNOS);
        Flair3dSalaAcesso.exigirEstado(s, Flair3dSala.JOGANDO);
        return s;
    }

    /** Vagas do jogo, cartas do deck da pessoa na vaga certa, o mínimo do lance e, quando não repete, carta nova (422). */
    static void conferir(Flair3dDuelo duelo, Map<String, UUID> pedido, List<UUID> deck, List<Map<String, UUID>> anteriores,
                         Map<UUID, CbcRules.Card> doDeck) {
        long postas = pedido.values().stream().filter(Objects::nonNull).count();
        if (postas < duelo.minimo()) {
            throw Flair3dErros.invalido("LANCE_VAZIO", "lance_vazio");
        }
        for (Map.Entry<String, UUID> e : pedido.entrySet()) {
            if (e.getValue() == null) {
                continue;
            }
            CbcRules.Card c = doDeck.get(e.getValue());
            if (!duelo.vagas().contains(e.getKey()) || !deck.contains(e.getValue()) || c == null) {
                throw Flair3dErros.invalido("CARTA_FORA_DO_DECK", "carta_fora_do_deck");
            }
            boolean vagaCerta = Flair3dDuelo.CARTA.equals(e.getKey()) || e.getKey().equals(c.position())
                    || ("SUP".equals(e.getKey()) && "VES".equals(c.position()));
            if (!vagaCerta) {
                throw Flair3dErros.invalido("CARTA_NA_VAGA_ERRADA", "carta_na_vaga_errada");
            }
            boolean usada = anteriores.stream().anyMatch(a -> a.containsValue(e.getValue()));
            if (!duelo.repete() && usada) {
                throw Flair3dErros.invalido("CARTA_JA_JOGADA", "carta_ja_jogada");
            }
        }
    }

    /** O contexto semeado da sala (os desafios da Batalha e o acaso do Sports saem dele). */
    static Contexto contexto(Flair3dCartas cartas, Flair3dSala s, Flair3dDuelo duelo) {
        return cartas.contexto(Map.of(), s.getSemente()).naRodada(duelo.rodada());
    }
}
