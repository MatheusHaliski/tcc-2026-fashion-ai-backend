package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair.Flair3dHype;
import br.com.fashionai.application.flair3d.aura.Flair3dAuraRegras;
import br.com.fashionai.application.flair3d.recurso.Flair3dRecursoCalculo;
import br.com.fashionai.application.flair3d.recurso.PecaRecurso.PerfilDaPeca;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * O que a tela recebe de cada carta em POST .../efeitos: os itens do jogo (o selo, com o efeito da cor no fim) e o
 * perfil da regra peça-recurso — atributos, o recurso do uso, os usos e as ações que a peça destrava. Tudo calculado
 * aqui; o cliente só mostra.
 */
final class Flair3dEfeitosDaCarta {
    private Flair3dEfeitosDaCarta() {
    }

    static Map<String, Object> daCarta(Flair3dNucleo n, UUID id, CbcRules.Card carta, Contexto ctx, boolean deCartas) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("cardId", id);
        List<Efeito> itens = n.efeitos(carta, ctx);
        m.put("itens", comEfeitoDaCor(n.codigo(), carta, itens.isEmpty() && deCartas ? List.of(Efeito.motivo(Efeito.SEM_BONUS)) : itens));
        m.put("perfil", perfil(Flair3dRecursoCalculo.daCarta(carta, null)));
        if (Flair3dAuraRegras.noJogo(n.codigo())) {
            m.put("aura", aura(carta, ctx));
        }
        return m;
    }

    /** A Aura da carta neste jogo (rodada 8g): {familia, faixa, trunfo (o bônus se chamada), metamorfose}. Só leitura. */
    static Map<String, Object> aura(CbcRules.Card carta, Contexto ctx) {
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("familia", ctx.aura(carta));
        a.put("faixa", Flair3dHype.bandOf(carta).name());
        a.put("trunfo", Flair3dAuraRegras.podeSerTrunfo(carta) ? Flair3dAuraRegras.trunfo(carta) : 0);
        a.put("metamorfose", Flair3dAuraRegras.metamorfose(carta, ctx));
        return a;
    }

    /** O perfil como a tela lê: {vaga, atributos:{AGILIDADE: 20}, recurso, quantidade, usos, acoes:[], dominante}. */
    static Map<String, Object> perfil(PerfilDaPeca p) {
        Map<String, Object> m = new LinkedHashMap<>();
        Map<String, Integer> atributos = new LinkedHashMap<>();
        p.atributos().forEach((a, d) -> atributos.put(a.name(), d));
        m.put("vaga", p.vaga());
        m.put("atributos", atributos);
        m.put("recurso", p.recurso().name());
        m.put("quantidade", p.quantidade());
        m.put("usos", p.usos());
        m.put("acoes", p.acoes().stream().map(Enum::name).sorted().toList());
        m.put("dominante", p.dominante() == null ? null : p.dominante().name());
        return m;
    }

    /** Os itens da carta com o efeito da cor dela no jogo no fim (Flair3dCores), quando há um e o núcleo não o mandou. */
    static List<Efeito> comEfeitoDaCor(String nucleo, CbcRules.Card carta, List<Efeito> itens) {
        Efeito cor = Flair3dCores.efeitoDaCor(nucleo, carta);
        if (cor == null) {
            return itens;
        }
        List<Efeito> out = new ArrayList<>(itens);
        out.removeIf(e -> e.codigo().equals(cor.codigo()));
        out.add(cor);
        return out;
    }
}
