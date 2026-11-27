package br.com.fashionai.application.flair3d.multi;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Flair3dCartas;
import br.com.fashionai.application.flair3d.Flair3dDeck;
import br.com.fashionai.application.flair3d.Flair3dDuelo;
import br.com.fashionai.application.flair3d.nucleos.BatalhaLooksDuelo;
import br.com.fashionai.domain.model.Flair3dSala;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * O placar da sala TURNOS: guarda os lances em {@code turnos_json}, refaz o julgamento pelo {@link Flair3dDuelo} do
 * jogo, fecha a sala no fim e monta o que a tela vê. O lance do turno em aberto da outra pessoa nunca aparece (só
 * "ela já lançou"); o de quem lê aparece para a tela mostrar que está selado.
 */
@Component
public class Flair3dSalaPlacar {
    private final Flair3dCartas cartas;

    public Flair3dSalaPlacar(Flair3dCartas cartas) {
        this.cartas = cartas;
    }

    /** Os lances gravados de cada lado (vaga → carta), na ordem dos turnos. */
    public record Turnos(List<Map<String, UUID>> de, List<Map<String, UUID>> para) {
        public List<Map<String, UUID>> lances(boolean doDe) {
            return doDe ? de : para;
        }

        static Turnos ler(String json) {
            Map<String, Object> m = Json.map(json);
            return new Turnos(lista(m.get("de")), lista(m.get("para")));
        }

        private static List<Map<String, UUID>> lista(Object o) {
            List<Map<String, UUID>> out = new ArrayList<>();
            if (o instanceof List<?> l) {
                for (Object item : l) {
                    Map<String, UUID> lance = new LinkedHashMap<>();
                    if (item instanceof Map<?, ?> mapa) {
                        mapa.forEach((k, v) -> lance.put(String.valueOf(k), v == null ? null : UUID.fromString(String.valueOf(v))));
                    }
                    out.add(lance);
                }
            }
            return out;
        }

        String escrever() {
            return Json.write(Map.of("de", de, "para", para));
        }
    }

    /** Refaz o duelo com as cartas dos dois decks. */
    Flair3dDuelo.Placar julgar(Flair3dSala s, Flair3dDuelo duelo, Turnos t) {
        Map<UUID, CbcRules.Card> deckDe = cartas.daPessoa(s.getDeUserId(), Flair3dDeck.ids(s.getDeckDeJson()));
        Map<UUID, CbcRules.Card> deckPara = cartas.daPessoa(s.getParaUserId(), Flair3dDeck.ids(s.getDeckParaJson()));
        return duelo.julgar(Flair3dSalaTurnos.contexto(cartas, s, duelo), lado(deckDe, t.de()), lado(deckPara, t.para()));
    }

    private static Flair3dDuelo.Lado lado(Map<UUID, CbcRules.Card> deck, List<Map<String, UUID>> lances) {
        List<Map<String, CbcRules.Card>> out = new ArrayList<>();
        for (Map<String, UUID> lance : lances) {
            Map<String, CbcRules.Card> m = new LinkedHashMap<>();
            lance.forEach((vaga, id) -> {
                if (id != null && deck.containsKey(id)) {
                    m.put(vaga, deck.get(id));
                }
            });
            out.add(m);
        }
        return new Flair3dDuelo.Lado(deck.values(), out);
    }

    /** Fecha a sala com o placar dos dois lados e quem venceu (nulo no empate). */
    void fechar(Flair3dSala s, Flair3dDuelo.Placar p) {
        s.setEstado(Flair3dSala.FECHADO);
        s.setVencedorUserId(Flair3dDuelo.DE.equals(p.vencedor()) ? s.getDeUserId() : Flair3dDuelo.PARA.equals(p.vencedor()) ? s.getParaUserId() : null);
        s.setResultadoJson(Json.write(Map.of("de", Map.of("pontos", p.de()), "para", Map.of("pontos", p.para()), "motivo", "TURNOS")));
    }

    /** O andamento do duelo para quem lê. */
    public Map<String, Object> andamento(Flair3dSala s, UUID quemLe) {
        Flair3dDuelo duelo = Flair3dSalaJogos.duelo(s.getJogo()).orElseThrow();
        boolean souDe = s.getDeUserId().equals(quemLe);
        Turnos t = Turnos.ler(s.getTurnosJson());
        List<UUID> deckDe = Flair3dDeck.ids(s.getDeckDeJson());
        List<UUID> deckPara = Flair3dDeck.ids(s.getDeckParaJson());
        boolean prontos = !deckDe.isEmpty() && !deckPara.isEmpty();
        Flair3dDuelo.Placar p = prontos ? julgar(s, duelo, t) : new Flair3dDuelo.Placar(List.of(), 0, 0, false, null);
        List<Map<String, UUID>> meus = t.lances(souDe);
        List<Map<String, UUID>> deles = t.lances(!souDe);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("total", duelo.turnos());
        m.put("vagas", duelo.vagas());
        m.put("minimo", duelo.minimo());
        m.put("repete", duelo.repete());
        m.put("vez", meus.size() + 1);
        m.put("esperando", meus.size() > deles.size());
        m.put("outroLancou", deles.size() > meus.size());
        m.put("meuDeck", souDe ? deckDe : deckPara);
        m.put("deckDoOutroPronto", !(souDe ? deckPara : deckDe).isEmpty());
        m.put("meuLance", meus.size() > deles.size() ? meus.get(meus.size() - 1) : null);
        m.put("usadas", meus.stream().flatMap(l -> l.values().stream()).filter(Objects::nonNull).distinct().toList());
        m.put("julgados", p.turnos());
        m.put("pontos", Map.of("de", p.de(), "para", p.para()));
        m.put("encerrado", p.encerrado());
        m.put("vencedor", p.vencedor());
        if (duelo instanceof BatalhaLooksDuelo) {
            List<String> todos = BatalhaLooksDuelo.desafios(Flair3dSalaTurnos.contexto(cartas, s, duelo));
            m.put("desafios", todos.subList(0, Math.min(todos.size(), Math.min(meus.size(), deles.size()) + 1)));
        }
        return Map.of("turnos", m, "estado", s.getEstado());
    }
}
