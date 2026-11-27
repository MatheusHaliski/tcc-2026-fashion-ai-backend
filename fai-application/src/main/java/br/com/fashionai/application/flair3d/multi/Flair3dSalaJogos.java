package br.com.fashionai.application.flair3d.multi;

import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Flair3dDuelo;
import br.com.fashionai.application.flair3d.Flair3dErros;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Flair3dNucleos;
import br.com.fashionai.application.flair3d.makeup.FlairMakeUpBriefs;
import br.com.fashionai.application.flair3d.nucleos.BatalhaLooksDuelo;
import br.com.fashionai.application.flair3d.nucleos.DressFighterDuelo;
import br.com.fashionai.domain.model.Flair3dSala;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Que jogo aceita que modo de sala (PLANO A1): ASSINCRONO (mesma semente e rodada, comparado no servidor) nos 15
 * núcleos e no MAKE UP; TURNOS nos três jogos de confronto (Batalha de Looks, Dress Fighter, Fashion Sports), cada um
 * com o seu {@link Flair3dDuelo}. COOP (Fashion Detective, Super-Herói) ainda não abre: fica como próximo passo
 * (docs/flair/flair-3d/MULTIPLAYER.md). Confere jogo, modo e rodada do convite (404/422).
 */
public final class Flair3dSalaJogos {
    public static final String MAKE_UP = "MAKE_UP";

    private static final Map<String, Flair3dDuelo> DUELOS = new LinkedHashMap<>();

    static {
        for (Flair3dDuelo d : List.of(new BatalhaLooksDuelo(), new DressFighterDuelo(), new FashionSportsDuelo())) {
            DUELOS.put(d.jogo(), d);
        }
    }

    private Flair3dSalaJogos() {
    }

    /** O convite conferido: o jogo, o modo e a rodada que valem para a sala. */
    public record Escolha(String jogo, String modo, String rodada) {
    }

    public static Optional<Flair3dDuelo> duelo(String jogo) {
        return Optional.ofNullable(DUELOS.get(jogo));
    }

    /** Os modos que o jogo aceita, na ordem em que a tela os oferece. */
    public static List<String> modos(String jogo) {
        List<String> out = new ArrayList<>();
        if (DUELOS.containsKey(jogo)) {
            out.add(Flair3dSala.TURNOS);
        }
        out.add(Flair3dSala.ASSINCRONO);
        return out;
    }

    /** Confere jogo (404), modo (422 MODO_INDISPONIVEL) e rodada (422 RODADA_INVALIDA); sem modo, o primeiro do jogo. */
    public static Escolha conferir(String jogoPedido, String modoPedido, String rodadaPedida) {
        String jogo = jogoPedido == null ? "" : jogoPedido.trim().toUpperCase(Locale.ROOT);
        List<String> modos;
        if (MAKE_UP.equals(jogo)) {
            modos = List.of(Flair3dSala.ASSINCRONO);
        } else {
            Flair3dNucleos.porCodigo(jogo).orElseThrow(() -> Flair3dErros.naoEncontrado("NUCLEO_NAO_ENCONTRADO", "nucleo_nao_encontrado"));
            modos = modos(jogo);
        }
        String modo = modoPedido == null || modoPedido.isBlank() ? modos.get(0) : modoPedido.trim().toUpperCase(Locale.ROOT);
        if (!modos.contains(modo)) {
            throw Flair3dErros.invalido("MODO_INDISPONIVEL", "modo_indisponivel", Map.of("modos", modos));
        }
        if (Flair3dSala.TURNOS.equals(modo)) {
            return new Escolha(jogo, modo, DUELOS.get(jogo).rodada());
        }
        return new Escolha(jogo, modo, rodada(jogo, rodadaPedida));
    }

    private static String rodada(String jogo, String pedida) {
        if (pedida == null || pedida.isBlank()) {
            if (MAKE_UP.equals(jogo)) {
                return FlairMakeUpBriefs.TODOS.get(0).codigo();
            }
            return null;
        }
        String r = pedida.trim();
        if (MAKE_UP.equals(jogo)) {
            return FlairMakeUpBriefs.porCodigo(r).map(b -> b.codigo())
                    .orElseThrow(() -> Flair3dErros.invalido("RODADA_INVALIDA", "rodada_invalida"));
        }
        Flair3dNucleo n = Flair3dNucleos.porCodigo(jogo).orElseThrow();
        return n.definicao().rodada(r).map(Definicao.Rodada::codigo)
                .orElseThrow(() -> Flair3dErros.invalido("RODADA_INVALIDA", "rodada_invalida"));
    }
}
