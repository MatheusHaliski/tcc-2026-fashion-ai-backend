package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Andamento.UsoDeRecurso;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;
import br.com.fashionai.application.flair3d.recurso.Flair3dRecursoBonus;
import br.com.fashionai.application.flair3d.recurso.Flair3dRecursoCalculo;
import br.com.fashionai.application.flair3d.recurso.Flair3dRecursoNoMotor;
import br.com.fashionai.application.flair3d.recurso.Flair3dRecursoPerfil;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * A nota de uma rodada da Batalha de Looks, para os dois lados (reauditoria de 25/11/2026: "a Batalha não está no
 * perfil peça-recurso"). A regra peça-recurso entra dentro da comparação de cada rodada, e não por cima da média final
 * (que só somaria para a pessoa):
 *
 * <ul>
 *   <li>regra do desafio: 25 por vaga na regra e −25 pela peça proibida, de 0 a 100;</li>
 *   <li>look: até {@value Flair3dRecursoPerfil#TETO_DOS_ATRIBUTOS} pontos pelo carisma e pela agilidade do look acima
 *       do neutro — vale para a pessoa e para o look da casa, pela mesma conta;</li>
 *   <li>foco: até {@value Flair3dRecursoPerfil#TETO_DO_RECURSO} pontos pelo foco das peças do deck usadas como recurso
 *       nesta rodada ({@value #FOCO_CHEIO} de foco dão o teto). A peça gasta fica cansada: se também estiver vestida
 *       nesta rodada, não conta na regra nem no look. A casa não usa recurso.</li>
 * </ul>
 *
 * A nota da rodada para em 100. Puro.
 */
final class BatalhaLooksPlacar {
    static final int FOCO_CHEIO = 30;
    static final String FOCO = "FOCO";

    private BatalhaLooksPlacar() {
    }

    /** As três parcelas da nota de um lado na rodada. */
    record Nota(int regra, int look, int recurso) {
        int total() {
            return Math.min(100, regra + look + recurso);
        }

        Map<String, Object> paraTela() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("regra", regra);
            m.put("look", look);
            m.put("recurso", recurso);
            return m;
        }
    }

    /** A rodada da pessoa: a nota, as regras (as do desafio e as duas da regra peça-recurso) e as vagas cansadas. */
    record DaPessoa(Nota nota, List<RegraResultado> regras, List<String> cansadas) {
    }

    /** As cartas gastas como recurso nesta rodada (a rodada 1 é a etapa 0 do uso). */
    static Set<UUID> gastas(List<UsoDeRecurso> usos, int rodada) {
        return usos.stream().filter(u -> u.etapa() == rodada - 1).map(UsoDeRecurso::carta).collect(Collectors.toSet());
    }

    static DaPessoa daPessoa(BatalhaLooksRodadas.Desafio desafio, Map<String, CbcRules.Card> look, List<UsoDeRecurso> usos, int rodada) {
        return daPessoa(desafio, look, look, usos, rodada);
    }

    /**
     * A rodada da pessoa quando parte do look já chega cansada por ter desfilado na rodada anterior
     * ({@code descansadas}, de {@link BatalhaLooksRodadas#descansadas}). Não contam a peça que desfilou na rodada anterior
     * nem a gasta como recurso nesta; a peça proibida conta no look inteiro.
     */
    static DaPessoa daPessoa(BatalhaLooksRodadas.Desafio desafio, Map<String, CbcRules.Card> look, Map<String, CbcRules.Card> descansadas,
            List<UsoDeRecurso> usos, int rodada) {
        Set<UUID> gastas = gastas(usos, rodada);
        Map<String, CbcRules.Card> valendo = new LinkedHashMap<>();
        List<String> cansadas = new ArrayList<>();
        look.forEach((vaga, carta) -> {
            if (gastas.contains(carta.id()) || !descansadas.containsKey(vaga)) {
                cansadas.add(vaga);
            } else {
                valendo.put(vaga, carta);
            }
        });
        List<RegraResultado> regras = new ArrayList<>(BatalhaLooksRodadas.regras(desafio, valendo, look));
        int foco = Flair3dRecursoNoMotor.naEtapa(usos, FOCO, rodada - 1);
        Nota nota = new Nota((int) Math.round(BatalhaLooksRodadas.pontos(regras)), peloLook(valendo),
                (int) Math.round(Flair3dRecursoPerfil.TETO_DO_RECURSO * Math.min(1, foco / (double) FOCO_CHEIO)));
        regras.add(RegraResultado.de(Flair3dRecursoBonus.REGRA_LOOK, nota.look() > 0, nota.look()));
        regras.add(RegraResultado.de(Flair3dRecursoBonus.REGRA_RECURSO, nota.recurso() > 0, nota.recurso()));
        return new DaPessoa(nota, regras, cansadas);
    }

    /** O look da casa pela mesma conta, sem recurso. */
    static Nota daCasa(BatalhaLooksRodadas.Desafio desafio, Map<String, CbcRules.Card> look) {
        return new Nota(BatalhaLooksAdversario.nota(desafio, look), peloLook(look), 0);
    }

    private static int peloLook(Map<String, CbcRules.Card> look) {
        return look.isEmpty() ? 0 : Flair3dRecursoBonus.pelosAtributos(Flair3dRecursoPerfil.BATALHA, Flair3dRecursoCalculo.doLook(look));
    }
}
