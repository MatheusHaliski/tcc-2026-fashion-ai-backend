package br.com.fashionai.application.flair3d.makeup;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dCartas;
import br.com.fashionai.application.flair3d.Flair3dEntregas;
import br.com.fashionai.application.flair3d.Flair3dErros;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.FlairMakeUpLook;
import br.com.fashionai.domain.repository.FlairMakeUpLookRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * FLAIR 3D MAKE UP — carreira, briefs, entrega e Prestígio (BASE_NUCLEOS.md, "FLAIR 3D MAKE UP"). Contexto do Strategy
 * {@link FlairMakeUpBrief}: confere nível (403), cartas da pessoa e paleta (422), delega a nota ao brief e grava o look
 * com o Prestígio das estrelas novas.
 */
@Service
public class FlairMakeUpService {
    private final FlairMakeUpLookRepository looks;
    private final Flair3dCartas cartas;

    public FlairMakeUpService(FlairMakeUpLookRepository looks, Flair3dCartas cartas) {
        this.looks = looks;
        this.cartas = cartas;
    }

    static FlairMakeUpBrief brief(String codigo) {
        return FlairMakeUpBriefs.porCodigo(codigo).orElseThrow(() -> Flair3dErros.naoEncontrado("BRIEF_NAO_ENCONTRADO", "brief_nao_encontrado"));
    }

    /** As vagas e áreas do provador como uma definição de núcleo sem deck (para conferir a entrega). */
    static Definicao provador(FlairMakeUpBrief b) {
        return Definicao.cartas(b.codigo(), 0, new Definicao.Objetivo(b.codigo(), b.regras()),
                List.of(Definicao.CARTAS, Definicao.MAQUIAGEM), Definicao.VAGAS, Definicao.Deck.SEM_DECK, false).comAreas(Definicao.AREAS);
    }

    FlairMakeUpCarreira carreira(UUID userId) {
        return FlairMakeUpCarreira.de(looks.findByUserId(userId).stream().mapToInt(FlairMakeUpLook::getPrestigio).sum());
    }

    int melhoresEstrelas(UUID userId, String brief) {
        return looks.findByUserIdAndBrief(userId, brief).stream().mapToInt(FlairMakeUpLook::getEstrelas).max().orElse(0);
    }

    /** {nivel, prestigio, faltaParaProximo, desbloqueios:[{tipo, codigo, nivel, liberado}]}. */
    @Transactional(readOnly = true)
    public Map<String, Object> carreira(CurrentUser user) {
        return carreiraMap(carreira(user.id()));
    }

    static Map<String, Object> carreiraMap(FlairMakeUpCarreira c) {
        List<Map<String, Object>> desbloqueios = new ArrayList<>();
        for (FlairMakeUpBrief b : FlairMakeUpBriefs.TODOS) {
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("tipo", "BRIEF");
            d.put("codigo", b.codigo());
            d.put("nivel", b.nivelMin());
            d.put("liberado", c.nivel() >= b.nivelMin());
            desbloqueios.add(d);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("nivel", c.nivel());
        out.put("prestigio", c.prestigio());
        out.put("faltaParaProximo", c.faltaParaProximo());
        out.put("desbloqueios", desbloqueios);
        return out;
    }

    /** {briefs:[{codigo, nivelMin, liberado, melhoresEstrelas}]}. */
    @Transactional(readOnly = true)
    public Map<String, Object> briefs(CurrentUser user) {
        int nivel = carreira(user.id()).nivel();
        List<Map<String, Object>> out = new ArrayList<>();
        for (FlairMakeUpBrief b : FlairMakeUpBriefs.TODOS) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("codigo", b.codigo());
            m.put("nivelMin", b.nivelMin());
            m.put("liberado", nivel >= b.nivelMin());
            m.put("melhoresEstrelas", melhoresEstrelas(user.id(), b.codigo()));
            out.add(m);
        }
        return Map.of("briefs", out);
    }

    /** {codigo, nivelMin, regras, vagas, areas, paleta}. */
    public Map<String, Object> detalhe(String codigo) {
        FlairMakeUpBrief b = brief(codigo);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("codigo", b.codigo());
        out.put("nivelMin", b.nivelMin());
        out.put("regras", b.regras());
        out.put("vagas", Definicao.VAGAS);
        out.put("areas", Definicao.AREAS);
        out.put("paleta", FlairMakeUpPaleta.toMap());
        return out;
    }

    /** {pontos, estrelas, regras, prestigioGanho, carreira}: 403 abaixo do nível, 422 com carta alheia ou fora da paleta. */
    @Transactional
    public Map<String, Object> entregar(CurrentUser user, String codigo, Entrega entrega) {
        FlairMakeUpBrief b = brief(codigo);
        if (carreira(user.id()).nivel() < b.nivelMin()) {
            throw new ApiException(403, "NIVEL_INSUFICIENTE", Msg.t("flair3d.erro.nivel_insuficiente", b.nivelMin()), Map.of("nivelMin", b.nivelMin()));
        }
        Entrega e = entrega == null ? new Entrega(null, null, null, null) : new Entrega(entrega.cartas(), null, entrega.maquiagem(), null);
        Map<UUID, CbcRules.Card> minhas = cartas.daPessoa(user.id(), e.cartas().values());
        Flair3dEntregas.conferir(provador(b), e, minhas, List.of());
        List<String> fora = FlairMakeUpPaleta.foraDaPaleta(e);
        if (!fora.isEmpty()) {
            throw Flair3dErros.invalido("ENTREGA_INVALIDA", "entrega_invalida", Map.of("problemas", fora));
        }
        Resultado r = b.pontuar(e, cartas.contexto(minhas, 0));
        int ganho = FlairMakeUpCarreira.ganho(melhoresEstrelas(user.id(), b.codigo()), r.estrelas());
        FlairMakeUpLook look = new FlairMakeUpLook();
        look.setUserId(user.id());
        look.setBrief(b.codigo());
        look.setLookJson(Json.write(e));
        look.setPontos(r.pontos());
        look.setEstrelas(r.estrelas());
        look.setPrestigio(ganho);
        looks.save(look);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("pontos", r.pontos());
        out.put("estrelas", r.estrelas());
        out.put("regras", r.regras());
        out.put("prestigioGanho", ganho);
        out.put("carreira", carreiraMap(carreira(user.id())));
        return out;
    }
}
