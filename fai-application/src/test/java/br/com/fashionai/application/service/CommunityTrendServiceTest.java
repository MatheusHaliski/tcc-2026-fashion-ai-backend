package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.CommunityTrend;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.CommunityTrendRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class CommunityTrendServiceTest {
    CommunityTrendRepository repository; UserRepository users; FaiPointsService points; CommunityTrendService service; CurrentUser user;
    @BeforeEach void setup() {
        repository = mock(CommunityTrendRepository.class); users = mock(UserRepository.class); points = mock(FaiPointsService.class);
        service = new CommunityTrendService(repository, users, mock(Guard.class), points);
        user = new CurrentUser(UUID.randomUUID(), "teste", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, "127.0.0.1", "test");
        User author = new User(); author.assignId(user.id()); author.setUsername("teste"); author.setDisplayName("Teste");
        when(users.lockById(user.id())).thenReturn(Optional.of(author)); when(users.findById(user.id())).thenReturn(Optional.of(author));
        when(repository.save(any())).thenAnswer(i -> { CommunityTrend t = i.getArgument(0); if(t.getId() == null) t.assignId(UUID.randomUUID()); return t; });
    }
    CommunityTrend draft() { CommunityTrend t = new CommunityTrend(); t.assignId(UUID.randomUUID()); t.setAuthorId(user.id()); t.setTitle("Outono"); t.setDescription("Reinterprete o look"); t.setKind("PASSA_O_LOOK"); t.setDurationDays(7); when(repository.lockById(t.getId())).thenReturn(Optional.of(t)); return t; }
    @Test void aceitaTodosOsTiposSemConcederPontosNoRascunho() {
        for(String kind : CommunityTrendService.KINDS) {
            var result = service.create(user, new CommunityTrendService.Create("Minha trend", "Uma combinação", kind, 7));
            assertThat(result.get("kind")).isEqualTo(kind); assertThat(result.get("status")).isEqualTo("DRAFT");
        }
        verifyNoInteractions(points);
    }
    @Test void rejeitaTipoPrazoENomeInvalidos() {
        assertThatThrownBy(() -> service.create(user,new CommunityTrendService.Create("Trend", "Regra", "OUTRO",7))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.create(user,new CommunityTrendService.Create("Trend", "Regra", "PASSA_O_LOOK",31))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.create(user,new CommunityTrendService.Create(" ", "Regra", "PASSA_O_LOOK",7))).isInstanceOf(ApiException.class);
        verify(repository,never()).save(any());
    }
    @Test void publicaUmaVezComJanelaEPontos() {
        CommunityTrend t = draft(); when(points.award(user.id(),"TREND_PUBLISHED","TREND",t.getId().toString(),null)).thenReturn(new FaiPointsService.Award(true,20,false,"20 Points",FaiPointsService.Level.ESTREIA,false));
        assertThat(service.publish(user,t.getId()).get("awardedPoints")).isEqualTo(20);
        assertThat(t.getStatus()).isEqualTo("PUBLISHED"); assertThat(t.getEndsAt()).isEqualTo(t.getPublishedAt().plusSeconds(7*86400));
        assertThat(service.publish(user,t.getId()).get("awardedPoints")).isEqualTo(0);
        verify(points,times(1)).award(any(),anyString(),anyString(),anyString(),any());
    }
    @Test void limiteDePontosNaoImpedePublicar() {
        CommunityTrend t = draft(); when(points.award(any(),anyString(),anyString(),anyString(),any())).thenReturn(new FaiPointsService.Award(false,0,true,"Limite",FaiPointsService.Level.ESTREIA,false));
        assertThat(service.publish(user,t.getId()).get("capReached")).isEqualTo(true); assertThat(t.getStatus()).isEqualTo("PUBLISHED");
    }
    @Test void naoPublicaTrendAlheia() {
        CommunityTrend t = draft(); t.setAuthorId(UUID.randomUUID());
        assertThatThrownBy(() -> service.publish(user,t.getId())).isInstanceOf(ApiException.class); verifyNoInteractions(points);
    }
    @Test void listaApenasPublicadasVigentesComFiltroEPaginacao() {
        when(repository.findByStatusAndKindAndEndsAtAfter(eq("PUBLISHED"),eq("COR_EM_COMUM"),any(Instant.class),any())).thenReturn(new PageImpl<>(List.of()));
        var result=service.list("COR_EM_COMUM",-1,100); assertThat(result.get("page")).isEqualTo(0); assertThat(result.get("size")).isEqualTo(48); assertThat(result.get("items")).isEqualTo(List.of());
        assertThatThrownBy(() -> service.list("OUTRO",0,12)).isInstanceOf(ApiException.class);
    }
}
