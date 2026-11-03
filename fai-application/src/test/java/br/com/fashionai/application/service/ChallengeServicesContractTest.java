package br.com.fashionai.application.service;

import org.junit.jupiter.api.Test;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionalEventListener;

import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caracterização do contrato de {@link ChallengeService} e {@link FlairChallengeService} (lote R82): o conjunto de
 * métodos públicos, os tipos dos parâmetros e de retorno e as anotações de transação, agendamento e dos ouvintes
 * transacionais (Observer, fase AFTER_COMMIT) ficam idênticos quando o serviço passa a delegar para colaboradores.
 */
class ChallengeServicesContractTest {

    static List<String> contract(Class<?> type) {
        return Arrays.stream(type.getDeclaredMethods()).filter(m -> Modifier.isPublic(m.getModifiers()) && !m.isSynthetic())
                .map(ChallengeServicesContractTest::describe).sorted().toList();
    }

    static String describe(Method m) {
        String params = Arrays.stream(m.getGenericParameterTypes()).map(t -> t.getTypeName()).collect(Collectors.joining(","));
        StringBuilder out = new StringBuilder(m.getGenericReturnType().getTypeName() + " " + m.getName() + "(" + params + ")");
        Transactional tx = m.getAnnotation(Transactional.class);
        if (tx != null) {
            out.append(" @Transactional(readOnly=").append(tx.readOnly()).append(")");
        }
        TransactionalEventListener l = m.getAnnotation(TransactionalEventListener.class);
        if (l != null) {
            out.append(" @TransactionalEventListener(").append(l.phase()).append(",fallback=").append(l.fallbackExecution()).append(")");
        }
        Scheduled s = m.getAnnotation(Scheduled.class);
        if (s != null) {
            out.append(" @Scheduled(").append(s.cron()).append(",").append(s.zone()).append(")");
        }
        return out.toString().replaceAll("\\b[a-z][a-z0-9]*\\.", "");
    }

    @Test
    void challengeServiceMantemMetodosPublicosEAnotacoes() {
        assertThat(String.join("\n", contract(ChallengeService.class))).isEqualTo(String.join("\n", List.of(
                "List<Map<String, Object>> activeSummary(UUID) @Transactional(readOnly=true)",
                "List<Map<String, Object>> decorations(UUID)",
                "List<Map<String, Object>> voteFeed(CurrentUser) @Transactional(readOnly=true)",
                "Map<String, Integer> tick() @Transactional(readOnly=false) @Scheduled(0 */15 * * * *,America/Sao_Paulo)",
                "Map<String, Object> accept(CurrentUser,UUID,Boolean) @Transactional(readOnly=false)",
                "Map<String, Object> cancel(CurrentUser,UUID) @Transactional(readOnly=false)",
                "Map<String, Object> catalog(CurrentUser) @Transactional(readOnly=true)",
                "Map<String, Object> confirmRealMirror(CurrentUser,UUID,UUID,LocalDate) @Transactional(readOnly=false)",
                "Map<String, Object> decline(CurrentUser,UUID) @Transactional(readOnly=false)",
                "Map<String, Object> detail(CurrentUser,UUID) @Transactional(readOnly=false)",
                "Map<String, Object> launchDraft(CurrentUser,UUID,List<UUID>,Map<String, String>) @Transactional(readOnly=false)",
                "Map<String, Object> leave(CurrentUser,UUID) @Transactional(readOnly=false)",
                "Map<String, Object> mine(CurrentUser) @Transactional(readOnly=true)",
                "Map<String, Object> note(CurrentUser,UUID,String,String) @Transactional(readOnly=false)",
                "Map<String, Object> promote(CurrentUser,String) @Transactional(readOnly=false)",
                "Map<String, Object> propose(CurrentUser,ChallengeService$ProposalRequest) @Transactional(readOnly=false)",
                "Map<String, Object> react(CurrentUser,UUID,String) @Transactional(readOnly=false)",
                "Map<String, Object> realMirror(CurrentUser,UUID,byte[]) @Transactional(readOnly=false)",
                "Map<String, Object> resultCard(CurrentUser,UUID) @Transactional(readOnly=true)",
                "Map<String, Object> start(CurrentUser,ChallengeService$StartRequest) @Transactional(readOnly=false)",
                "Map<String, Object> startNow(CurrentUser,UUID) @Transactional(readOnly=false)",
                "Map<String, Object> submitEntry(CurrentUser,UUID,UUID) @Transactional(readOnly=false)",
                "Map<String, Object> vote(CurrentUser,UUID,UUID) @Transactional(readOnly=false)",
                "Optional<MirrorService$PieceRestrictionProvider$Restriction> restriction(UUID)",
                "byte[] mirrorPhoto(CurrentUser,UUID,UUID) @Transactional(readOnly=true)",
                "void conclude(ChallengeInstance,ChallengeTemplate) @Transactional(readOnly=false)",
                "void onDailyLook(DomainEvents$DailyLookRegistered) @TransactionalEventListener(AFTER_COMMIT,fallback=true)",
                "void onMirror(DomainEvents$MirrorAction) @TransactionalEventListener(AFTER_COMMIT,fallback=true)",
                "void onPieceCreated(DomainEvents$PieceCreated) @TransactionalEventListener(AFTER_COMMIT,fallback=true)",
                "void onSchemeSaved(DomainEvents$SchemeSaved) @TransactionalEventListener(AFTER_COMMIT,fallback=true)")));
    }

    @Test
    void flairChallengeServiceMantemMetodosPublicosEAnotacoes() {
        assertThat(String.join("\n", contract(FlairChallengeService.class))).isEqualTo(String.join("\n", List.of(
                "List<Map<String, Object>> adminList(CurrentUser) @Transactional(readOnly=true)",
                "Map<String, Object> addToPrivateMoment(CurrentUser,UUID,FlairChallengeService$PrivateChallengeRequest) @Transactional(readOnly=false)",
                "Map<String, Object> adminSave(CurrentUser,UUID,FlairChallengeService$AdminChallengeRequest) @Transactional(readOnly=false)",
                "Map<String, Object> check(CurrentUser,String,FlairChallengeService$BuildRequest) @Transactional(readOnly=true)",
                "Map<String, Object> detail(CurrentUser,String) @Transactional(readOnly=true)",
                "Map<String, Object> list(CurrentUser,String) @Transactional(readOnly=true)",
                "Map<String, Object> submit(CurrentUser,String,FlairChallengeService$BuildRequest) @Transactional(readOnly=false)",
                "void useClock(Clock)")));
    }

    static String surface(Class<?> type) {
        String fields = Arrays.stream(type.getDeclaredFields()).filter(f -> Modifier.isPublic(f.getModifiers()))
                .map(f -> f.getName()).sorted().collect(Collectors.joining(","));
        String nested = Arrays.stream(type.getDeclaredClasses()).map(c -> Modifier.toString(c.getModifiers()) + " " + c.getSimpleName())
                .sorted().collect(Collectors.joining(","));
        String parents = Arrays.stream(type.getInterfaces()).map(Class::getSimpleName).sorted().collect(Collectors.joining(","));
        return fields + " | " + nested + " | " + parents;
    }

    @Test
    void constantesRecordsEInterfacesPublicasContinuamNoServico() {
        assertThat(surface(ChallengeService.class)).isEqualTo("ACCEPT_WINDOW,AGUARDANDO,ATIVO,CONCLUIDO,EXPIRADO,MAX_ACTIVE,MODES,NOTE_MAX,PRESET_NOTES,P_ATIVO,P_CANCELADO,P_CONCLUIU,"
                + "P_CONVIDADO,P_RECUSOU,P_SAIU,RASCUNHO,REACTIONS | public static final Progress,public static final ProposalRequest,"
                + "public static final StartRequest,static final MirrorUpload | DecorationsProvider,PieceRestrictionProvider");
        assertThat(surface(FlairChallengeService.class)).isEqualTo("COMMUNITY_MAX,ENDED,OPEN,PRIVATE_MAX_PER_MOMENT,PRIVATE_MAX_POINTS,RARE_READING,REDISCOVERY_BONUS,UPCOMING | "
                + "public static final AdminChallengeRequest,public static final BuildRequest,public static final Line,"
                + "public static final PrivateChallengeRequest,public static final Window,static final Build | ");
        assertThat(ChallengeService.class.isAnnotationPresent(org.springframework.stereotype.Service.class)).isTrue();
        assertThat(FlairChallengeService.class.isAnnotationPresent(org.springframework.stereotype.Service.class)).isTrue();
    }
}
