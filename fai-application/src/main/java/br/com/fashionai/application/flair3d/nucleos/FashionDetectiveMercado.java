package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Acionamento;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Flair3dErros;
import br.com.fashionai.application.flair3d.Resultado.Evento;

import java.util.List;
import java.util.Map;

/**
 * A bolsa do detetive e o mercado do FASHION_DETECTIVE (docs/flair/flair-3d/CORES_E_ACOES.md, 2.3). Estaleca é moeda só do
 * caso: começa em zero, some no fim e não é o saldo da carteira. Ganha-se com o acesso ao salão (150), com gaveta aberta
 * por peça verde (50) e com a pista do salão (200). No mercado, a pessoa pode deixar no balcão uma carta do deck que não
 * está vestida, pelo nível dela; a carta sai só do deck desta partida, nunca da coleção. O detetive compra sozinho o que
 * precisa (não há arma à venda): a peça da cor da próxima pista quando o deck não tem uma, o colete quando o desafio não
 * passou e a lanterna quando o móvel do salão não abriu.
 */
final class FashionDetectiveMercado {
    static final Map<String, Integer> VALOR = Map.of("BRONZE", 100, "PRATA", 200, "OURO", 350, "ESPECIAL", 500);
    static final int POR_GAVETA = 50;
    static final int PELO_ACESSO = 150;
    static final int PELA_PISTA = 200;
    static final int PECA_DA_PISTA = 500;
    static final int COLETE = 300;
    static final int LANTERNA = 150;
    static final int DEFESA_DO_COLETE = 20;

    private int estalecas;
    private boolean pecaDaPista;
    private boolean colete;
    private boolean lanterna;

    void ganhar(int valor) {
        estalecas += valor;
    }

    /** A carta deixada no balcão: do deck (conferido pelo serviço) e fora do look; 422 se está vestida. */
    void vender(Acionamento a, Map<String, CbcRules.Card> vestidas, Contexto contexto, List<Evento> eventos) {
        CbcRules.Card carta = a.carta() == null ? null : contexto.cartas().get(a.carta());
        if (carta == null) {
            return;
        }
        if (vestidas.containsValue(carta)) {
            throw Flair3dErros.invalido("CARTA_VESTIDA", "carta_vestida");
        }
        int valor = VALOR.getOrDefault(carta.tier(), 100);
        estalecas += valor;
        eventos.add(new Evento("VENDA", Map.of("carta", carta.id(), "estalecas", valor)));
    }

    /** As compras automáticas, da mais cara à mais barata, uma de cada no máximo. */
    void comprar(boolean faltaACorDaPista, boolean desafioPassou, boolean movelAbriu, List<Evento> eventos) {
        if (faltaACorDaPista && !pecaDaPista && pagar("PECA_DA_PISTA", PECA_DA_PISTA, eventos)) {
            pecaDaPista = true;
        }
        if (!desafioPassou && !colete && pagar("COLETE", COLETE, eventos)) {
            colete = true;
        }
        if (!movelAbriu && !lanterna && pagar("LANTERNA", LANTERNA, eventos)) {
            lanterna = true;
        }
    }

    private boolean pagar(String item, int preco, List<Evento> eventos) {
        if (estalecas < preco) {
            return false;
        }
        estalecas -= preco;
        eventos.add(new Evento("COMPRA", Map.of("item", item, "estalecas", preco)));
        return true;
    }

    int estalecas() {
        return estalecas;
    }

    /** A peça da cor da pista comprada no mercado vale no salão seguinte a ele. */
    boolean pecaDaPista() {
        return pecaDaPista;
    }

    int defesaExtra() {
        return colete ? DEFESA_DO_COLETE : 0;
    }

    boolean lanterna() {
        return lanterna;
    }
}
