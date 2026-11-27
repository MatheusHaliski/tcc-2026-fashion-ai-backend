package br.com.fashionai.application.flair3d.multi;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Flair3dAtributos;
import br.com.fashionai.application.flair3d.Flair3dDuelo;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Fashion Sports por turnos entre duas pessoas: a mão rival deixa de ser os números da semente e passa a ser a carta da
 * outra pessoa. Seis lances; nos ímpares quem convidou ataca e quem foi convidada defende, nos pares o contrário. O
 * ataque soma técnica, velocidade e ataque da carta; a defesa soma defesa, resistência e metade da velocidade; o acaso
 * do lance (0 a 9) sai da semente da sala, igual para os dois. Gol quando o ataque passa a defesa; sem carta, a jogada
 * vale a base do lado ({@value #SEM_CARTA}). Vence quem faz mais gols; empate é empate. Puro.
 */
public final class FashionSportsDuelo implements Flair3dDuelo {
    static final int LANCES = 6;
    static final int SEM_CARTA = 10;

    @Override
    public String jogo() {
        return "FASHION_SPORTS";
    }

    @Override
    public String rodada() {
        return null;
    }

    @Override
    public int turnos() {
        return LANCES;
    }

    @Override
    public List<String> vagas() {
        return List.of(CARTA);
    }

    @Override
    public int minimo() {
        return 0;
    }

    @Override
    public boolean repete() {
        return false;
    }

    static int ataque(CbcRules.Card c) {
        if (c == null) {
            return SEM_CARTA;
        }
        Flair3dAtributos a = Flair3dAtributos.daCarta(c);
        return a.tecnica() + a.velocidade() + a.ataque();
    }

    static int defesa(CbcRules.Card c) {
        if (c == null) {
            return SEM_CARTA;
        }
        Flair3dAtributos a = Flair3dAtributos.daCarta(c);
        return a.defesa() + a.resistencia() + a.velocidade() / 2;
    }

    @Override
    public Placar julgar(Contexto contexto, Lado ladoDe, Lado ladoPara) {
        List<Map<String, CbcRules.Card>> de = ladoDe.lances();
        List<Map<String, CbcRules.Card>> para = ladoPara.lances();
        int completos = Math.min(Math.min(de.size(), para.size()), turnos());
        int golsDe = 0;
        int golsPara = 0;
        List<Map<String, Object>> turnos = new ArrayList<>();
        for (int i = 0; i < completos; i++) {
            boolean deAtaca = i % 2 == 0;
            CbcRules.Card cartaDe = de.get(i).get(CARTA);
            CbcRules.Card cartaPara = para.get(i).get(CARTA);
            int acaso = contexto.sorteio("lance" + i).nextInt(10);
            int atk = (deAtaca ? ataque(cartaDe) : ataque(cartaPara)) + acaso;
            int def = deAtaca ? defesa(cartaPara) : defesa(cartaDe);
            boolean gol = atk > def;
            golsDe += gol && deAtaca ? 1 : 0;
            golsPara += gol && !deAtaca ? 1 : 0;
            Map<String, Object> t = new LinkedHashMap<>();
            t.put("turno", i + 1);
            t.put("atacante", deAtaca ? DE : PARA);
            t.put("de", lado(cartaDe, deAtaca ? atk : def, golsDe));
            t.put("para", lado(cartaPara, deAtaca ? def : atk, golsPara));
            t.put("gol", gol);
            t.put("vencedor", gol ? (deAtaca ? DE : PARA) : (deAtaca ? PARA : DE));
            turnos.add(t);
        }
        boolean fim = completos == turnos();
        String vencedor = !fim ? null : golsDe > golsPara ? DE : golsDe < golsPara ? PARA : EMPATE;
        return new Placar(turnos, golsDe, golsPara, fim, vencedor);
    }

    private static Map<String, Object> lado(CbcRules.Card c, int valor, int gols) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("carta", c == null ? null : c.id());
        m.put("valor", valor);
        m.put("gols", gols);
        return m;
    }
}
