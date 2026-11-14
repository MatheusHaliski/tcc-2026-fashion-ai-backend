package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Flair3dAtributos;
import br.com.fashionai.application.flair3d.Flair3dCores;
import br.com.fashionai.application.flair3d.Flair3dPecas;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * Um salão do caso jogado com um look: acesso (2 peças ou mais do código de vestimenta, 40), desafio automático (defesa +
 * vida + dano no limite do salão, ou furtividade 40; vale 40) e a pista da carta (a peça da cor pedida no lugar pedido e,
 * se a pista está num móvel, uma peça verde ou a lanterna para abrir; vale 20 e só para quem entrou ou passou no desafio).
 */
final class FashionDetectiveSalao {
    static final int PECAS_DO_CODIGO = 2;
    static final int FURTIVIDADE = 40;
    static final int POR_COR = 20;
    static final int ACESSO = 40;
    static final int DESAFIO = 40;
    static final int PISTA = 20;

    final FashionDetectiveCaso.Salao salao;
    final int numero;
    final Map<String, CbcRules.Card> look;
    final boolean acesso;
    final boolean desafio;
    final boolean pista;
    final boolean movelAbriu;
    final long gavetas;
    private final List<Evento> medidores = new ArrayList<>();

    FashionDetectiveSalao(int numero, Map<String, CbcRules.Card> look, FashionDetectiveMercado bolsa) {
        this.numero = numero;
        this.salao = FashionDetectiveCaso.salao(numero);
        this.look = look;
        Collection<CbcRules.Card> pecas = look.values();
        long codigo = pecas.stream().filter(c -> Flair3dPecas.temOcasiao(c, salao.ocasioes())).count();
        int defesa = Flair3dAtributos.soma(pecas).defesa() + bolsa.defesaExtra();
        long furtividade = POR_COR * cor(pecas, "FURTIVIDADE");
        long vida = POR_COR * cor(pecas, "VIDA");
        long dano = POR_COR * cor(pecas, "DANO");
        gavetas = salao.movel() ? cor(pecas, "ABRIR") : 0;
        acesso = codigo >= PECAS_DO_CODIGO;
        desafio = defesa + vida + dano >= salao.desafio() || furtividade >= FURTIVIDADE;
        movelAbriu = !salao.movel() || gavetas > 0 || bolsa.lanterna();
        boolean peca = temAPeca(look, salao) || (numero == FashionDetectiveCaso.SALAO_DO_MERCADO + 1 && bolsa.pecaDaPista());
        pista = (acesso || desafio) && peca && movelAbriu;
        medidores.addAll(List.of(new Evento("SALAO", Map.of("salao", numero, "codigo", salao.codigo())),
                new Evento("PECAS_DO_CODIGO", codigo), new Evento("DEFESA", defesa), new Evento("FURTIVIDADE", furtividade),
                new Evento("VIDA", vida), new Evento("DANO", dano)));
    }

    static long cor(Collection<CbcRules.Card> pecas, String acao) {
        return Flair3dCores.quantas(Flair3dCores.DETETIVE, pecas, acao);
    }

    /** O look tem a peça que a carta de pista aponta: da família de cor do salão, numa das vagas dele. */
    static boolean temAPeca(Map<String, CbcRules.Card> look, FashionDetectiveCaso.Salao s) {
        return look.entrySet().stream().anyMatch(e -> s.vagas().contains(e.getKey()) && Flair3dPecas.daFamilia(e.getValue(), s.cor()));
    }

    /** O que o salão rende à bolsa do caso. */
    int estalecas() {
        return (acesso ? FashionDetectiveMercado.PELO_ACESSO : 0) + (int) (FashionDetectiveMercado.POR_GAVETA * gavetas)
                + (pista ? FashionDetectiveMercado.PELA_PISTA : 0);
    }

    int pontos() {
        return (acesso ? ACESSO : 0) + (desafio ? DESAFIO : 0) + (pista ? PISTA : 0);
    }

    String resultado() {
        int ok = (acesso ? 1 : 0) + (desafio ? 1 : 0);
        return ok == 2 ? "FAVORAVEL" : ok == 1 ? "PARCIAL" : "DESFAVORAVEL";
    }

    List<RegraResultado> regras() {
        return List.of(RegraResultado.de("ACESSO", acesso, ACESSO), RegraResultado.de("DESAFIO_DEFESA", desafio, DESAFIO),
                RegraResultado.de("PISTA", pista, PISTA));
    }

    /** Medidores do salão (o que as cores do look deram ao detetive). */
    List<Evento> medidores() {
        return medidores;
    }
}
