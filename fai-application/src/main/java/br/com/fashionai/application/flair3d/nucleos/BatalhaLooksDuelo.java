package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Flair3dDuelo;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Batalha de Looks por turnos entre duas pessoas (piloto do multiplayer, auditoria de 27/11/2026): a pessoa convidada
 * toma o lugar do look da casa. São os mesmos 3 desafios da semente da sala, as mesmas notas por rodada
 * ({@link BatalhaLooksPlacar}: regra do desafio + look; a peça que desfilou na rodada anterior chega cansada) para os
 * dois lados, a soma das três decide e, no empate, o voto da plateia da semente fica com um dos lados. Puro.
 */
public final class BatalhaLooksDuelo implements Flair3dDuelo {
    @Override
    public String jogo() {
        return "BATALHA_LOOKS";
    }

    @Override
    public String rodada() {
        return BatalhaLooksRodadas.BATALHA;
    }

    @Override
    public int turnos() {
        return BatalhaLooksRodadas.RODADAS;
    }

    @Override
    public List<String> vagas() {
        return BatalhaLooksNucleo.VAGAS;
    }

    @Override
    public int minimo() {
        return 1;
    }

    @Override
    public boolean repete() {
        return true;
    }

    /** Os códigos dos 3 desafios da sala, para a tela mostrar o da vez antes do lance. */
    public static List<String> desafios(Contexto contexto) {
        return BatalhaLooksRodadas.desafios(contexto).stream().map(BatalhaLooksRodadas.Desafio::codigo).toList();
    }

    @Override
    public Placar julgar(Contexto contexto, Lado ladoDe, Lado ladoPara) {
        List<Map<String, CbcRules.Card>> de = ladoDe.lances();
        List<Map<String, CbcRules.Card>> para = ladoPara.lances();
        List<BatalhaLooksRodadas.Desafio> desafios = BatalhaLooksRodadas.desafios(contexto);
        int completos = Math.min(Math.min(de.size(), para.size()), turnos());
        List<Map<String, Object>> turnos = new ArrayList<>();
        int somaDe = 0;
        int somaPara = 0;
        for (int i = 0; i < completos; i++) {
            BatalhaLooksRodadas.Desafio d = desafios.get(i);
            BatalhaLooksPlacar.Nota notaDe = nota(d, de, i);
            BatalhaLooksPlacar.Nota notaPara = nota(d, para, i);
            somaDe += notaDe.total();
            somaPara += notaPara.total();
            Map<String, Object> t = new LinkedHashMap<>();
            t.put("turno", i + 1);
            t.put("desafio", d.codigo());
            t.put("de", lado(notaDe, de.get(i)));
            t.put("para", lado(notaPara, para.get(i)));
            t.put("vencedor", notaDe.total() > notaPara.total() ? DE : notaDe.total() < notaPara.total() ? PARA : EMPATE);
            turnos.add(t);
        }
        boolean fim = completos == turnos();
        String vencedor = fim ? (BatalhaLooksVoto.venceu(somaDe, somaPara, contexto) ? DE : PARA) : null;
        return new Placar(turnos, somaDe, somaPara, fim, vencedor);
    }

    /** A nota do lado na rodada i: a peça que desfilou na rodada anterior (mesmo id) chega cansada e não pontua. */
    private static BatalhaLooksPlacar.Nota nota(BatalhaLooksRodadas.Desafio d, List<Map<String, CbcRules.Card>> lances, int i) {
        Map<String, CbcRules.Card> look = lances.get(i);
        Map<String, CbcRules.Card> descansadas = new LinkedHashMap<>(look);
        if (i > 0) {
            descansadas.values().removeIf(c -> lances.get(i - 1).values().stream().anyMatch(a -> a.id().equals(c.id())));
        }
        return BatalhaLooksPlacar.daPessoa(d, look, descansadas, List.of(), i + 1).nota();
    }

    private static Map<String, Object> lado(BatalhaLooksPlacar.Nota nota, Map<String, CbcRules.Card> look) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("nota", nota.total());
        m.put("conta", nota.paraTela());
        Map<String, Object> cartas = new LinkedHashMap<>();
        look.forEach((vaga, c) -> cartas.put(vaga, c.id()));
        m.put("cartas", cartas);
        return m;
    }
}
