package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Flair3dZonas;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Núcleo 13 — arquétipo "armadura", 25 por regra: peito metálico; até 2 cores (hex distintos, com o traje inteiro
 * pintado); capa presente; emblema próprio (a resposta é um dos emblemas da lista: sem emblema, ou com um emblema que
 * imita herói existente, a regra não pontua). O emblema é escolhido nas três rodadas.
 */
public class SuperHeroiNucleo implements Flair3dNucleo {
    public static final double POR_REGRA = 25;
    public static final List<String> ZONAS = List.of("PEITO", "CAPA", "BRACOS", "PERNAS");
    /** Só emblemas próprios: os que imitavam heróis existentes saíram da lista que a tela oferece. */
    public static final List<String> OPCOES = List.of("EMBLEMA_ESTRELA", "EMBLEMA_RAIO", "EMBLEMA_ASA");
    /** Emblemas que imitam marcas registradas de heróis existentes: o servidor continua recusando os códigos antigos. */
    public static final Set<String> PROTEGIDOS = Set.of("EMBLEMA_MORCEGO", "EMBLEMA_ESCUDO_S");
    /** Os outros arquétipos: o traje colante (tecido, sem metal) e o vigilante da noite (capa escura, uma cor de alerta). */
    static final List<AtelieRodadas.Criacao> RODADAS = List.of(
            AtelieRodadas.criacao("TRAJE_COLANTE", ZONAS,
                    AtelieRodadas.regra("BRACOS_E_PERNAS_IGUAIS", z -> AtelieRodadas.iguais(z, "BRACOS", "PERNAS")),
                    AtelieRodadas.regra("PEITO_EM_DESTAQUE", z -> AtelieRodadas.contraste(z, "PEITO", "BRACOS")),
                    AtelieRodadas.conjunto("SEM_METAL", z -> !AtelieRodadas.algumAcabamento(z, "METALICO", "ESPELHADO")),
                    AtelieRodadas.conjunto("ATE_3_CORES", z -> AtelieRodadas.ateCores(z, 3))),
            AtelieRodadas.criacao("VIGILANTE_DA_NOITE", ZONAS,
                    AtelieRodadas.regra("CAPA_ESCURA", z -> AtelieRodadas.daFamilia(z, "CAPA", "Preto")),
                    AtelieRodadas.regra("PEITO_FOSCO", z -> AtelieRodadas.familia(z, "PEITO") != null
                            && !AtelieRodadas.acabamento(z, "PEITO", "BRILHANTE", "METALICO", "ESPELHADO")),
                    AtelieRodadas.conjunto("UMA_COR_DE_ALERTA", z -> ZONAS.stream().filter(zona -> AtelieRodadas.daFamilia(z, zona, "Amarelo", "Vermelho", "Laranja")).count() == 1),
                    AtelieRodadas.conjunto("ATE_2_CORES", z -> AtelieRodadas.ateCores(z, 2))));

    @Override
    public String codigo() {
        return "SUPER_HEROI";
    }

    @Override
    public int numero() {
        return 13;
    }

    @Override
    public Definicao definicao() {
        return Definicao.zonas(codigo(), numero(), Definicao.objetivo("ARMADURA", new Regra("PEITO_METALICO", POR_REGRA),
                new Regra("ATE_2_CORES", POR_REGRA), new Regra("CAPA", POR_REGRA), new Regra("SEM_EMBLEMA_PROTEGIDO", POR_REGRA)),
                ZONAS, OPCOES).comRodadas(RODADAS.get(0).rodada().comOpcoes(OPCOES), RODADAS.get(1).rodada().comOpcoes(OPCOES));
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        for (AtelieRodadas.Criacao c : RODADAS) {
            if (c.codigo().equals(contexto.rodada())) {
                return c.pontuar(entrega);
            }
        }
        List<Entrega.Zona> zonas = ZONAS.stream().map(entrega.zonas()::get).filter(Objects::nonNull).toList();
        long cores = zonas.stream().map(Flair3dZonas::hex).filter(Objects::nonNull).distinct().count();
        boolean inteira = zonas.stream().map(Flair3dZonas::hex).filter(Objects::nonNull).count() == ZONAS.size();
        return Resultado.somando(List.of(
                RegraResultado.de("PEITO_METALICO", Flair3dZonas.acabamento(entrega.zonas().get("PEITO"), Flair3dZonas.METALICO), POR_REGRA),
                RegraResultado.de("ATE_2_CORES", inteira && cores <= 2, POR_REGRA),
                RegraResultado.de("CAPA", Flair3dZonas.hex(entrega.zonas().get("CAPA")) != null, POR_REGRA),
                RegraResultado.de("SEM_EMBLEMA_PROTEGIDO", entrega.resposta() != null && OPCOES.contains(entrega.resposta()), POR_REGRA)), AtelieRodadas.faltas(entrega, ZONAS));
    }
}
