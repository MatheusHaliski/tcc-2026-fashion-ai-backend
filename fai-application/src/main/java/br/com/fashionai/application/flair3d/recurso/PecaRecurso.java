package br.com.fashionai.application.flair3d.recurso;

import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;
import java.util.Set;

/**
 * O que uma peça de roupa faz no jogo (a regra comum "peça-recurso" dos jogos FLAIR 3D): atributos passivos enquanto
 * está vestida, um recurso entregue quando é usada e ações que ela destrava. Só o servidor calcula
 * ({@link Flair3dRecursoTabela}); o cliente recebe códigos e números.
 */
public final class PecaRecurso {
    private PecaRecurso() {
    }

    /** Atributos do avatar, de 0 a 100 no look (50 = neutro); cada peça soma um delta de -50 a +50. */
    public enum Atributo { AGILIDADE, FURTIVIDADE, CARISMA, RESISTENCIA, FORCA }

    /** Recursos da partida: vida, energia e foco de 0 a 100; moedas sem teto. */
    public enum Recurso { VIDA, ENERGIA, FOCO, MOEDAS }

    /** Ações que a peça destrava no cenário (correr com tênis, esconder-se de óculos e boné, abrir com luvas...). */
    public enum AcaoDestravada { CORRER, ESCONDER, CONVENCER, BLOQUEAR, REFLETIR, CARREGAR, TROCA_RAPIDA, ABRIR }

    public static final int DELTA_MAXIMO = 50;
    public static final int NEUTRO = 50;

    /**
     * O perfil de uma peça. {@code atributos} só traz os deltas diferentes de zero, na ordem do enum;
     * {@code dominante} é o atributo de maior delta em módulo (no empate, o primeiro do enum), ou nulo sem atributo.
     */
    public record PerfilDaPeca(String vaga, Map<Atributo, Integer> atributos, Recurso recurso, int quantidade, int usos,
                               Set<AcaoDestravada> acoes, Atributo dominante) {
        public PerfilDaPeca {
            EnumMap<Atributo, Integer> ordenados = new EnumMap<>(Atributo.class);
            ordenados.putAll(atributos);
            atributos = Collections.unmodifiableMap(ordenados);
            acoes = Set.copyOf(acoes);
        }

        public int delta(Atributo a) {
            return atributos.getOrDefault(a, 0);
        }
    }

    /** O look vestido: cada atributo de 0 a 100 (neutro mais a média dos deltas) e as ações de todas as peças. */
    public record PerfilDoLook(EnumMap<Atributo, Integer> atributos, Set<AcaoDestravada> acoes) {
        public PerfilDoLook {
            atributos = new EnumMap<>(atributos);
            acoes = Set.copyOf(acoes);
        }

        public int valor(Atributo a) {
            return atributos.getOrDefault(a, NEUTRO);
        }
    }
}
