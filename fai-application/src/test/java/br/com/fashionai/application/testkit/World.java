package br.com.fashionai.application.testkit;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SchemeService;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;

/**
 * Um mundo pequeno do Fashion AI para os testes de service: pessoas com guarda-roupa completo (partes de cima, de
 * baixo, calçados, acessórios e peça inteira) e looks publicados montados com essas peças, tudo nos repositórios em
 * memória do {@link Kit}. As consultas da vitrine pública ({@code findAllPublic}, escritas à mão) e o
 * {@link SchemeService} (dono e quem pode ver) respondem a partir desses dados.
 */
public final class World {
    /** Guarda-roupa padrão: categoria, subcategoria, cor e estilo de cada peça. */
    private static final String[][] WARDROBE = {
            {"upper_piece", "t_shirt", "white", "basic,streetwear"},
            {"upper_piece", "shirt", "light_blue", "classic,tailored"},
            {"upper_piece", "hoodie", "black", "streetwear"},
            {"upper_piece", "blazer", "navy", "classic,tailored"},
            {"lower_piece", "jeans", "blue", "basic,streetwear"},
            {"lower_piece", "cargo_pants", "olive", "streetwear"},
            {"lower_piece", "tailored_pants", "black", "classic,tailored"},
            {"shoes_piece", "casual_sneakers", "white", "basic,streetwear"},
            {"shoes_piece", "oxford_shoes", "brown", "classic,tailored"},
            {"accessory_piece", "handbag", "black", "classic"},
            {"accessory_piece", "cap", "red", "streetwear"},
            {"full_body_piece", "dress", "red", "glam,romantic"},
    };
    /** Looks padrão: índices das peças do guarda-roupa (cima, baixo, calçado, acessório). */
    private static final int[][] LOOKS = {{0, 4, 7, 10}, {1, 6, 8, 9}, {2, 5, 7, 10}, {3, 6, 8, 9}, {0, 5, 7, 9}, {11, 8, 9}};
    private static final SchemeSlot[] SLOT = {SchemeSlot.TOP, SchemeSlot.BOTTOM, SchemeSlot.SHOES, SchemeSlot.ACCESSORY};

    public final Kit kit;
    public final User me;
    public final User rival;
    public final User friend;

    public World(Kit kit) {
        this.kit = kit;
        UserRepository users = kit.dep(UserRepository.class);
        SchemeRepository schemes = kit.dep(SchemeRepository.class);
        WardrobeItemRepository pieces = kit.dep(WardrobeItemRepository.class);
        lenient().when(schemes.findAllPublic(any())).thenAnswer(i -> MemoryRepository.<Scheme>rows(schemes).stream()
                .filter(s -> s.getVisibility() == Visibility.PUBLIC && s.getStatus() == SchemeStatus.PUBLISHED).toList());
        lenient().when(pieces.findAllPublic(any())).thenAnswer(i -> MemoryRepository.<WardrobeItem>rows(pieces).stream()
                .filter(w -> w.getVisibility() == Visibility.PUBLIC).toList());
        SchemeService schemeService = kit.dep(SchemeService.class);
        if (org.mockito.Mockito.mockingDetails(schemeService).isMock()) {
            lenient().when(schemeService.owned(any(), any())).thenAnswer(i -> {
                CurrentUser u = i.getArgument(0);
                Scheme s = schemes.findById(i.getArgument(1)).orElseThrow(() -> ApiException.notFound("Esquema"));
                if (!s.getUser().getId().equals(u.id())) {
                    throw ApiException.notFound("Esquema");
                }
                return s;
            });
            lenient().when(schemeService.canView(any(), any())).thenReturn(true);
        }
        this.me = person("ana", 6);
        this.rival = person("bia", 6);
        this.friend = person("caio", 4);
        person("duda", 3);
        person("enzo", 3);
    }

    /** Cria uma pessoa com o guarda-roupa padrão e os primeiros {@code looks} looks publicados. */
    public User person(String username, int looks) {
        User u = Kit.user(username);
        kit.dep(UserRepository.class).save(u);
        List<WardrobeItem> ws = new ArrayList<>();
        for (String[] p : WARDROBE) {
            WardrobeItem w = Kit.piece(u, p[1].replace('_', ' ') + " " + username, p[0], p[1], p[2]);
            w.setStyleTags(p[3]);
            w.setWearCount(ws.size() % 4);
            if (ws.size() % 3 == 0) {
                w.setBrandName("Marca" + ws.size());
            }
            ws.add(kit.dep(WardrobeItemRepository.class).save(w));
        }
        for (int i = 0; i < looks && i < LOOKS.length; i++) {
            look(u, "Look " + (i + 1) + " de " + username, java.util.Arrays.stream(LOOKS[i]).mapToObj(ws::get).toArray(WardrobeItem[]::new));
        }
        return u;
    }

    /** Look publicado com as peças dadas, na ordem dos slots (cima, baixo, calçado, acessório). */
    public Scheme look(User owner, String title, WardrobeItem... pieces) {
        Scheme s = kit.dep(SchemeRepository.class).save(Kit.look(owner, title));
        s.setLikeCount(title.length());
        s.setSaveCount(3);
        s.setCommentCount(2);
        for (int i = 0; i < pieces.length; i++) {
            SchemeSlot slot = "full_body_piece".equals(pieces[i].getCategory()) ? SchemeSlot.FULL_BODY : SLOT[Math.min(i, SLOT.length - 1)];
            kit.dep(SchemeItemRepository.class).save(Kit.slot(s, pieces[i], slot, i));
        }
        return s;
    }

    public List<WardrobeItem> piecesOf(User u) {
        return kit.dep(WardrobeItemRepository.class).findByUserIdOrderByCreatedAtDesc(u.getId());
    }

    public List<Scheme> looksOf(User u) {
        return MemoryRepository.<Scheme>rows(kit.dep(SchemeRepository.class)).stream().filter(s -> s.getUser().getId().equals(u.getId())).toList();
    }

    public List<UUID> lookIds(User u) {
        return looksOf(u).stream().map(Scheme::getId).toList();
    }

    public WardrobeItem piece(User u, String subcategory) {
        return piecesOf(u).stream().filter(w -> subcategory.equals(w.getSubcategory())).findFirst().orElseThrow();
    }

    public List<SchemeItem> itemsOf(Scheme s) {
        return kit.dep(SchemeItemRepository.class).findBySchemeIdOrderBySortOrder(s.getId());
    }

    public static Map<String, Object> map(Object o) {
        @SuppressWarnings("unchecked")
        Map<String, Object> m = (Map<String, Object>) o;
        return m;
    }
}
