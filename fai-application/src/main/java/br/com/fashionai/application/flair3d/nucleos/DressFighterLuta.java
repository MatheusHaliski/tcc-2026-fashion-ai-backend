package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Acionamento;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Flair3dCores;
import br.com.fashionai.application.flair3d.Flair3dErros;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.Lutador;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.ESPECIAL;
import static br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.ESQUIVA;
import static br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.FOCO;
import static br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.FOLEGO;
import static br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.GOLPE_BASICO;
import static br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.GUARDA_BASICA;
import static br.com.fashionai.application.flair3d.nucleos.DressFighterGolpes.ataca;

/**
 * A luta do Dress Fighter lance a lance: as duas começam com 100 de vida; em cada lance a pessoa joga uma carta da mão
 * (a cor é o golpe, {@link DressFighterGolpes}) e a oponente faz o golpe que a semente tirou, já anunciado no lance
 * anterior (a "leitura"). Três lances fazem um round; vence o round quem tirou mais vida nele. Vida a zero é nocaute
 * e acaba a luta; sem nocaute, vence quem ganhou mais rounds ({@link #venceu}). A mesma carta não entra em dois lances seguidos, e a Especial só uma vez.
 * Tudo sai dos acionamentos guardados e da semente: a retomada e a revisão refazem a mesma luta.
 */
public final class DressFighterLuta {
    public static final int VIDA = 100;
    public static final int LANCES_POR_ROUND = 3;
    public static final int LANCES = LANCES_POR_ROUND * DressFighterNucleo.ROUNDS;

    final List<Evento> eventos = new ArrayList<>();
    int vidaVoce = VIDA;
    int vidaOponente = VIDA;
    int vitorias;
    int derrotas;
    int lances;
    String nocaute;

    private final Contexto contexto;
    private final Lutador voce;
    private final Lutador oponente;
    private final List<String> golpes = new ArrayList<>();
    private int danoDoRoundVoce;
    private int danoDoRoundOponente;

    DressFighterLuta(Contexto contexto, Lutador voce, Lutador oponente) {
        this.contexto = contexto;
        this.voce = voce;
        this.oponente = oponente;
    }

    /** Joga os lances dos acionamentos guardados (recusa com 422 a carta repetida e a segunda Especial). */
    DressFighterLuta jogar(List<Acionamento> acionamentos) {
        UUID anterior = null;
        boolean especialUsada = false;
        for (int i = 0; i < acionamentos.size() && !encerrada(); i++) {
            UUID id = acionamentos.get(i).carta();
            CbcRules.Card carta = id == null ? null : contexto.cartas().get(id);
            if (id != null && id.equals(anterior)) {
                throw Flair3dErros.invalido("CARTA_CANSADA", "carta_cansada");
            }
            boolean especial = carta != null && DressFighterNucleo.ESPECIAL.equals(carta.tier());
            if (especial && especialUsada) {
                throw Flair3dErros.invalido("ESPECIAL_JA_USADA", "especial_ja_usada");
            }
            especialUsada |= especial;
            lance(carta, especial);
            anterior = id;
        }
        eventos.add(new Evento("LUTA", estado()));
        return this;
    }

    /**
     * Quem venceu a luta: o nocaute decide; sem ele, quem ganhou mais rounds (round empatado não conta para ninguém) e,
     * nos rounds empatados, quem terminou com mais vida.
     */
    boolean venceu() {
        if (nocaute != null) {
            return "OPONENTE".equals(nocaute);
        }
        return vitorias != derrotas ? vitorias > derrotas : vidaVoce > vidaOponente;
    }

    boolean encerrada() {
        return nocaute != null || lances >= LANCES;
    }

    /** O golpe da carta: a Especial, o da cor dela ou, sem cor de golpe, o golpe básico; sem carta, a guarda básica. */
    static String golpeDa(CbcRules.Card carta, boolean especial) {
        if (carta == null) {
            return GUARDA_BASICA;
        }
        if (especial) {
            return ESPECIAL;
        }
        String acao = Flair3dCores.acao(Flair3dCores.DE_CENA.get("DRESS_FIGHTER"), carta);
        return acao == null ? GOLPE_BASICO : acao;
    }

    /** O golpe que a oponente faz no lance n (0 a 8), da semente e da arena. */
    String daOponente(int n) {
        return DressFighterGolpes.daOponente(String.valueOf(contexto.rodada()), contexto.sorteio("lance" + n).nextInt(100));
    }

    private void lance(CbcRules.Card carta, boolean especial) {
        String meu = golpeDa(carta, especial);
        String dela = daOponente(lances);
        golpes.add(meu);
        String combo = DressFighterCombos.fechado(golpes);
        int poder = especial ? DressFighterNucleo.poder(carta) : 0;
        // o forte do Relâmpago atravessa a guarda (a esquiva ainda evita)
        String defesaDela = DressFighterCombos.RELAMPAGO.equals(combo) && !ESQUIVA.equals(dela) ? "NENHUMA" : dela;
        int causado = ataca(meu) ? DressFighterGolpes.dano(meu, voce, poder, defesaDela, oponente) : 0;
        if (causado > 0) {
            causado += DressFighterCombos.bonus(combo);
        }
        int sofrido = ataca(dela) ? DressFighterGolpes.dano(dela, oponente, 0, meu, voce) : 0;
        if (FOCO.equals(meu) && ataca(dela)) {
            causado += DressFighterGolpes.contraAtaque(voce) * (DressFighterCombos.MURALHA.equals(combo) ? 2 : 1);
        }
        int cura = FOLEGO.equals(meu) ? Math.min(DressFighterGolpes.FOLEGO_CURA, VIDA - vidaVoce) : 0;
        vidaOponente = Math.max(0, vidaOponente - causado);
        vidaVoce = Math.max(0, Math.min(VIDA, vidaVoce + cura) - sofrido);
        danoDoRoundVoce += causado;
        danoDoRoundOponente += sofrido;
        lances++;
        eventos.add(new Evento("LANCE_DA_LUTA", lanceEvento(carta, meu, dela, causado, sofrido, cura, combo)));
        if (vidaOponente == 0 || vidaVoce == 0) {
            nocaute = vidaOponente == 0 ? "OPONENTE" : "VOCE";
            eventos.add(new Evento("NOCAUTE", nocaute));
        }
        if (lances % LANCES_POR_ROUND == 0 || nocaute != null) {
            fecharRound();
        }
    }

    private void fecharRound() {
        int round = (lances - 1) / LANCES_POR_ROUND;
        boolean venceu = "OPONENTE".equals(nocaute) || (nocaute == null && danoDoRoundVoce > danoDoRoundOponente);
        boolean perdeu = "VOCE".equals(nocaute) || (nocaute == null && danoDoRoundVoce < danoDoRoundOponente);
        vitorias += venceu ? 1 : 0;
        derrotas += perdeu ? 1 : 0;
        Map<String, Object> r = DressFighterNucleo.round(round, danoDoRoundVoce, danoDoRoundOponente);
        r.put("atributo", "DANO");
        r.put("venceu", venceu);
        eventos.add(new Evento("ROUND", r));
        danoDoRoundVoce = 0;
        danoDoRoundOponente = 0;
    }

    private Map<String, Object> lanceEvento(CbcRules.Card carta, String meu, String dela, int causado, int sofrido, int cura, String combo) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("lance", lances);
        m.put("round", (lances - 1) / LANCES_POR_ROUND + 1);
        m.put("carta", carta == null ? null : carta.id());
        m.put("golpe", meu);
        m.put("golpeOponente", dela);
        m.put("dano", causado);
        m.put("sofrido", sofrido);
        m.put("cura", cura);
        m.put("combo", combo);
        m.put("vidaVoce", vidaVoce);
        m.put("vidaOponente", vidaOponente);
        return m;
    }

    /** O placar da luta para a tela: as duas vidas, o lance, o round e a leitura do próximo golpe da oponente. */
    Map<String, Object> estado() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("vidaVoce", vidaVoce);
        m.put("vidaOponente", vidaOponente);
        m.put("vida", VIDA);
        m.put("lance", lances);
        m.put("lances", LANCES);
        m.put("round", Math.min(DressFighterNucleo.ROUNDS, lances / LANCES_POR_ROUND + 1));
        m.put("proximo", encerrada() ? null : daOponente(lances));
        m.put("ultimoGolpe", golpes.isEmpty() ? null : golpes.get(golpes.size() - 1));
        return m;
    }

}
