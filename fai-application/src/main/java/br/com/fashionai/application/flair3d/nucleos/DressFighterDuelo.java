package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Flair3dAtributos;
import br.com.fashionai.application.flair3d.Flair3dDuelo;
import br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.Lutador;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Dress Fighter por turnos entre duas pessoas: o golpe da oponente deixa de vir da semente e passa a ser a carta que a
 * outra pessoa jogou no mesmo lance (os dois lances são revelados juntos). A tabela de golpes, o dano e o contra-ataque
 * do foco são os da luta solo ({@link DressFighterGolpes}); os atributos de cada lado vêm do deck que a pessoa levou
 * para a sala. Nove lances (3 rounds de 3) ou até o nocaute; vence quem termina com mais vida. Puro.
 */
public final class DressFighterDuelo implements Flair3dDuelo {
    @Override
    public String jogo() {
        return "DRESS_FIGHTER";
    }

    @Override
    public String rodada() {
        return null;
    }

    @Override
    public int turnos() {
        return DressFighterLuta.LANCES;
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

    /** O lutador de um lado: a soma dos atributos do deck, dividida pelo tamanho para os dois lados valerem igual. */
    public static Lutador lutador(Collection<CbcRules.Card> deck) {
        Flair3dAtributos a = Flair3dAtributos.soma(deck);
        int n = Math.max(1, deck.size());
        int escala = 3;
        return new Lutador(a.velocidade() * escala / n, a.ataque() * escala / n, a.defesa() * escala / n);
    }

    @Override
    public Placar julgar(Contexto contexto, Lado ladoDe, Lado ladoPara) {
        List<Map<String, CbcRules.Card>> de = ladoDe.lances();
        List<Map<String, CbcRules.Card>> para = ladoPara.lances();
        Lutador lutDe = lutador(ladoDe.deck());
        Lutador lutPara = lutador(ladoPara.deck());
        int vidaDe = DressFighterLuta.VIDA;
        int vidaPara = DressFighterLuta.VIDA;
        int completos = Math.min(Math.min(de.size(), para.size()), turnos());
        List<Map<String, Object>> turnos = new ArrayList<>();
        for (int i = 0; i < completos && vidaDe > 0 && vidaPara > 0; i++) {
            String golpeDe = DressFighterLuta.golpeDa(de.get(i).get(CARTA), false);
            String golpePara = DressFighterLuta.golpeDa(para.get(i).get(CARTA), false);
            int causaDe = causado(golpeDe, lutDe, golpePara, lutPara);
            int causaPara = causado(golpePara, lutPara, golpeDe, lutDe);
            vidaDe = Math.max(0, Math.min(DressFighterLuta.VIDA, vidaDe + cura(golpeDe)) - causaPara);
            vidaPara = Math.max(0, Math.min(DressFighterLuta.VIDA, vidaPara + cura(golpePara)) - causaDe);
            Map<String, Object> t = new LinkedHashMap<>();
            t.put("turno", i + 1);
            t.put("round", i / DressFighterLuta.LANCES_POR_ROUND + 1);
            t.put("de", lado(golpeDe, causaDe, vidaDe, de.get(i)));
            t.put("para", lado(golpePara, causaPara, vidaPara, para.get(i)));
            t.put("vencedor", causaDe > causaPara ? DE : causaDe < causaPara ? PARA : EMPATE);
            turnos.add(t);
        }
        boolean fim = vidaDe == 0 || vidaPara == 0 || completos == turnos();
        String vencedor = !fim ? null : vidaDe > vidaPara ? DE : vidaDe < vidaPara ? PARA : EMPATE;
        return new Placar(turnos, vidaDe, vidaPara, fim, vencedor);
    }

    /** O dano do golpe contra o golpe do outro lado, com o contra-ataque do foco. */
    static int causado(String golpe, Lutador quem, String outro, Lutador defensor) {
        int dano = DressFighterGolpes.ataca(golpe) ? DressFighterGolpes.dano(golpe, quem, 0, outro, defensor) : 0;
        if (DressFighterGolpes.FOCO.equals(golpe) && DressFighterGolpes.ataca(outro)) {
            dano += DressFighterGolpes.contraAtaque(quem);
        }
        return dano;
    }

    private static int cura(String golpe) {
        return DressFighterGolpes.FOLEGO.equals(golpe) ? DressFighterGolpes.FOLEGO_CURA : 0;
    }

    private static Map<String, Object> lado(String golpe, int dano, int vida, Map<String, CbcRules.Card> lance) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("golpe", golpe);
        m.put("dano", dano);
        m.put("vida", vida);
        CbcRules.Card c = lance.get(CARTA);
        m.put("carta", c == null ? null : c.id());
        return m;
    }
}
