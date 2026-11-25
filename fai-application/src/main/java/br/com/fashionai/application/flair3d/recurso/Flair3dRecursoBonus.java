package br.com.fashionai.application.flair3d.recurso;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Andamento.UsoDeRecurso;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;
import br.com.fashionai.application.flair3d.recurso.Flair3dRecursoPerfil.PerfilDoJogo;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.Atributo;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.PerfilDoLook;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.Recurso;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * O look e os recursos entram na nota (Decorator sobre o resultado de cada jogo): até {@value
 * Flair3dRecursoPerfil#TETO_DOS_ATRIBUTOS} pontos pelos atributos que o jogo pede acima do neutro e até {@value
 * Flair3dRecursoPerfil#TETO_DO_RECURSO} pelo recurso-vida do jogo acima da reserva inicial. Vale onde já há nota (a
 * prévia, a etapa com pontos, o resultado que fecha); no meio da ação e na tentativa sem ponto não mexe. As estrelas e o APROVADO acompanham a
 * nota nova. Puro.
 */
public final class Flair3dRecursoBonus {
    private Flair3dRecursoBonus() {
    }

    public static final String REGRA_LOOK = "LOOK_ATRIBUTOS";
    public static final String REGRA_RECURSO = "RECURSO_DO_JOGO";

    /** O resultado de uma entrega ou acionamento. */
    public static Resultado aplicar(String jogo, Resultado r, Map<String, CbcRules.Card> vestidas, List<UsoDeRecurso> usos) {
        return aplicar(jogo, r, vestidas, usos, false);
    }

    /** A prévia (POST .../previa): o bônus soma na nota e vai como evento, sem mudar as regras do pedido. */
    public static Resultado naPrevia(String jogo, Resultado r, Map<String, CbcRules.Card> vestidas, List<UsoDeRecurso> usos) {
        return aplicar(jogo, r, vestidas, usos, true);
    }

    private static Resultado aplicar(String jogo, Resultado r, Map<String, CbcRules.Card> vestidas, List<UsoDeRecurso> usos, boolean previa) {
        PerfilDoJogo perfil = Flair3dRecursoPerfil.doJogo(jogo).orElse(null);
        // vale na prévia e no resultado que fecha a partida; nota zero do jogo (a penalidade do Labirinto, o look que
        // não cumpriu nada) fica zero, e o meio da ação e a etapa que segue aberta ainda não têm nota
        boolean comNota = r.pontos() > 0 && (previa || (r.fecha() && !Resultado.ABERTA.equals(r.status())));
        if (perfil == null || !comNota || vestidas.isEmpty()) {
            return r;
        }
        int look = pelosAtributos(perfil, Flair3dRecursoCalculo.doLook(vestidas));
        int recurso = peloRecurso(perfil.vida(), Flair3dRecursoEstado.de(usos));
        List<RegraResultado> regras = new ArrayList<>(r.regras());
        List<Evento> eventos = new ArrayList<>(r.eventos());
        if (previa) {
            // na prévia as regras são as do pedido (iguais às da entrega da etapa); o bônus vai como evento
            eventos.add(new Evento(REGRA_LOOK, look));
            eventos.add(new Evento(REGRA_RECURSO, recurso));
        } else {
            regras.add(RegraResultado.de(REGRA_LOOK, look > 0, look));
            regras.add(RegraResultado.de(REGRA_RECURSO, recurso > 0, recurso));
        }
        int pontos = Math.min(100, r.pontos() + look + recurso);
        String codigo = switch (r.resultado()) {
            case "APROVADO", "REPROVADO" -> pontos >= 60 ? "APROVADO" : "REPROVADO";
            default -> r.resultado();
        };
        return new Resultado(pontos, Resultado.estrelas(pontos), codigo, regras, eventos, r.cartas(), r.status());
    }

    /** O quanto os atributos pedidos passam do neutro (média ponderada), em até TETO_DOS_ATRIBUTOS pontos. */
    static int pelosAtributos(PerfilDoJogo perfil, PerfilDoLook look) {
        double soma = 0;
        int pesos = 0;
        for (Map.Entry<Atributo, Integer> e : perfil.pesos().entrySet()) {
            soma += e.getValue() * Math.max(0, look.valor(e.getKey()) - PecaRecurso.NEUTRO) / (double) PecaRecurso.NEUTRO;
            pesos += e.getValue();
        }
        return pesos == 0 ? 0 : (int) Math.round(Flair3dRecursoPerfil.TETO_DOS_ATRIBUTOS * soma / pesos);
    }

    /** O recurso-vida acima da reserva com que a partida começou, em até TETO_DO_RECURSO pontos (moedas: uma a cada 2). */
    static int peloRecurso(Recurso vida, EnumMap<Recurso, Integer> estado) {
        int inicial = Flair3dRecursoEstado.INICIAL.get(vida);
        int agora = estado.get(vida);
        if (vida == Recurso.MOEDAS) {
            return Math.min(Flair3dRecursoPerfil.TETO_DO_RECURSO, (agora - inicial) / 2);
        }
        double parte = Math.max(0, agora - inicial) / (double) (Flair3dRecursoEstado.MAXIMO - inicial);
        return (int) Math.round(Flair3dRecursoPerfil.TETO_DO_RECURSO * parte);
    }
}
