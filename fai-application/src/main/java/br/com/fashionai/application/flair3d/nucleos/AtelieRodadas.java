package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Definicao.Rodada;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dZonas;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Predicate;

/**
 * Rodadas de criação do Grupo Ateliê 3D (docs/flair/flair-3d/OBJETIVOS_POR_JOGO.md, modos 8, 9, 11 e 13): cada rodada é
 * uma lista de regras sobre as zonas pintadas (cor e acabamento), 25 pontos cada. Clubes, bandas, equipes e heróis são
 * inventados: só cores, sem escudo, nome ou emblema de ninguém. Aqui ficam as leituras das zonas e a montagem da rodada;
 * as regras de cada modo estão no núcleo dele.
 */
final class AtelieRodadas {
    static final double POR_REGRA = 25;
    static final Set<String> SEM_COR = Set.of("Preto", "Branco", "Cinza");

    /**
     * Uma regra da rodada: o código e o teste sobre as zonas entregues. Regra {@code conjunto} fala da peça inteira (quantas
     * cores, a cor dominante, tudo fosco): só vale com todas as zonas da rodada pintadas.
     */
    record Condicao(String codigo, Predicate<Map<String, Entrega.Zona>> teste, boolean conjunto) {
    }

    /** Uma rodada de zonas: código, zonas que se pintam e as regras. */
    record Criacao(String codigo, List<String> zonas, List<Condicao> condicoes, double valor) {
        Rodada rodada() {
            Regra[] regras = condicoes.stream().map(c -> new Regra(c.codigo(), valor)).toArray(Regra[]::new);
            return Rodada.de(codigo, regras).comZonas(zonas);
        }

        /** Só as zonas da rodada contam (o que vier a mais é ignorado). */
        List<RegraResultado> conferir(Entrega entrega) {
            Map<String, Entrega.Zona> z = new java.util.LinkedHashMap<>();
            zonas.forEach(nome -> {
                if (entrega.zonas().get(nome) != null) {
                    z.put(nome, entrega.zonas().get(nome));
                }
            });
            boolean inteira = pintadas(z, zonas);
            List<RegraResultado> out = new ArrayList<>();
            condicoes.forEach(c -> out.add(RegraResultado.de(c.codigo(), (inteira || !c.conjunto()) && c.teste().test(z), valor)));
            return out;
        }

        Resultado pontuar(Entrega entrega) {
            return Resultado.somando(conferir(entrega), faltas(entrega, zonas));
        }
    }

    private AtelieRodadas() {
    }

    static Criacao criacao(String codigo, List<String> zonas, Condicao... condicoes) {
        return new Criacao(codigo, zonas, List.of(condicoes), POR_REGRA);
    }

    static Condicao regra(String codigo, Predicate<Map<String, Entrega.Zona>> teste) {
        return new Condicao(codigo, teste, false);
    }

    /** Regra da peça inteira: só vale com todas as zonas da rodada pintadas. */
    static Condicao conjunto(String codigo, Predicate<Map<String, Entrega.Zona>> teste) {
        return new Condicao(codigo, teste, true);
    }

    /**
     * A explicação da nota de uma peça incompleta: o evento ZONAS_SEM_PINTAR diz quantas zonas ficaram sem cor (zona só com
     * acabamento conta como sem pintar). Vazio com a peça inteira pintada.
     */
    static List<Evento> faltas(Entrega entrega, List<String> zonas) {
        long faltam = zonas.stream().filter(zona -> Flair3dZonas.hex(entrega.zonas().get(zona)) == null).count();
        if (faltam == 0) {
            return List.of();
        }
        Map<String, Object> valor = new java.util.LinkedHashMap<>();
        valor.put("faltam", faltam);
        valor.put("total", zonas.size());
        return List.of(new Evento("ZONAS_SEM_PINTAR", valor));
    }

    static String familia(Map<String, Entrega.Zona> z, String zona) {
        return Flair3dZonas.familia(z.get(zona));
    }

    static boolean daFamilia(Map<String, Entrega.Zona> z, String zona, String... familias) {
        return Set.of(familias).contains(Objects.toString(familia(z, zona), ""));
    }

    static boolean acabamento(Map<String, Entrega.Zona> z, String zona, String... acabamentos) {
        return List.of(acabamentos).stream().anyMatch(a -> Flair3dZonas.acabamento(z.get(zona), a));
    }

    /** Cores distintas (hex) entre as zonas pintadas. */
    static long cores(Map<String, Entrega.Zona> z) {
        return z.values().stream().map(Flair3dZonas::hex).filter(Objects::nonNull).distinct().count();
    }

    static boolean ateCores(Map<String, Entrega.Zona> z, int max) {
        long n = cores(z);
        return n >= 1 && n <= max;
    }

    /** As duas zonas estão pintadas com a mesma cor. */
    static boolean iguais(Map<String, Entrega.Zona> z, String a, String b) {
        String cor = Flair3dZonas.hex(z.get(a));
        return cor != null && cor.equals(Flair3dZonas.hex(z.get(b)));
    }

    /** As duas zonas estão pintadas com famílias de cor diferentes. */
    static boolean contraste(Map<String, Entrega.Zona> z, String a, String b) {
        String fa = familia(z, a);
        String fb = familia(z, b);
        return fa != null && fb != null && !fa.equals(fb);
    }

    /** A família tem mais zonas que qualquer outra. */
    static boolean dominante(Map<String, Entrega.Zona> z, String familia) {
        Map<String, Integer> conta = new java.util.HashMap<>();
        z.values().stream().map(Flair3dZonas::familia).filter(Objects::nonNull).forEach(f -> conta.merge(f, 1, Integer::sum));
        int minha = conta.getOrDefault(familia, 0);
        return minha > 0 && conta.entrySet().stream().noneMatch(e -> !e.getKey().equals(familia) && e.getValue() >= minha);
    }

    /** Alguma zona tem um dos acabamentos. */
    static boolean algumAcabamento(Map<String, Entrega.Zona> z, String... acabamentos) {
        return z.keySet().stream().anyMatch(zona -> acabamento(z, zona, acabamentos));
    }

    /** Todas as zonas da lista estão pintadas. */
    static boolean pintadas(Map<String, Entrega.Zona> z, List<String> zonas) {
        return zonas.stream().allMatch(zona -> Flair3dZonas.hex(z.get(zona)) != null);
    }
}
