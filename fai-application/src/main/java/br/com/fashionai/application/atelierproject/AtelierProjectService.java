package br.com.fashionai.application.atelierproject;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.*;
import br.com.fashionai.domain.model.atelierproject.*;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.atelierproject.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import static br.com.fashionai.application.atelierproject.AtelierProjectViews.*;
import static br.com.fashionai.domain.model.atelierproject.DesignProjectMember.Role.*;
import static br.com.fashionai.domain.model.atelierproject.DesignProjectMember.Status.*;

@Service @Transactional
public class AtelierProjectService {
    private final DesignProjectRepository projects;
    private final DesignProjectMemberRepository members;
    private final DesignRevisionRepository revisions;
    private final DesignCommentRepository comments;
    private final DesignReviewRepository reviews;
    private final DesignVoteRepository votes;
    private final UserRepository users;
    private final Guard guard;
    private final ObjectMapper json;
    private final boolean enabled;
    public AtelierProjectService(DesignProjectRepository projects, DesignProjectMemberRepository members,
        DesignRevisionRepository revisions, DesignCommentRepository comments, DesignReviewRepository reviews,
        DesignVoteRepository votes, UserRepository users, Guard guard, ObjectMapper json,
        @Value("${fashion.atelier-projects.enabled:true}") boolean enabled) {
        this.projects=projects;this.members=members;this.revisions=revisions;this.comments=comments;
        this.reviews=reviews;this.votes=votes;this.users=users;this.guard=guard;this.json=json;this.enabled=enabled;
    }
    @Transactional(readOnly=true)
    public Page<Summary> list(CurrentUser user,int page,int size) {
        authenticated(user);
        var result=projects.findAccessible(user.id(),ACCEPTED,PageRequest.of(Math.max(0,page),Math.min(50,Math.max(1,size)),Sort.by("activityAt").descending()));
        return new Page<>(result.getContent().stream().filter(this::ownerAvailable).filter(p->!guard.blocked(user.id(),p.getOwnerId())).map(this::summary).toList(),result.getNumber(),result.getSize(),result.hasNext());
    }
    public Detail create(CurrentUser user,Create cmd) {
        write(user); rights(cmd.rightsAccepted());
        var prior=projects.findByOwnerIdAndCreationKey(user.id(),cmd.requestId());
        if(prior.isPresent()) {
            var p=prior.get();
            if(!p.getTitle().equals(cmd.title().trim())||!p.getBrief().equals(cmd.brief())||p.getVisibility()!=cmd.visibility()||!p.getSpecificationJson().equals(encode(cmd.specification()))) conflict("A chave de criação já foi utilizada para outro conteúdo.");
            return detail(user,p);
        }
        var p=new DesignProject();p.setOwnerId(user.id());p.setTitle(cmd.title().trim());p.setBrief(cmd.brief());
        p.setVisibility(cmd.visibility());p.setState(DesignProject.State.DRAFT);p.setSpecificationJson(encode(cmd.specification()));
        p.setCreationKey(cmd.requestId());p.setActivityAt(Instant.now());projects.saveAndFlush(p);
        return detail(user,p);
    }
    @Transactional(readOnly=true)
    public Detail get(CurrentUser user,UUID id) {authenticated(user);var p=find(id,false);read(user,p);return detail(user,p);}
    public Detail update(CurrentUser user,UUID id,Update cmd) {
        write(user);var p=find(id,true);edit(user,p);version(p,cmd.expectedVersion());rights(cmd.rightsAccepted());notArchived(p);
        p.setTitle(cmd.title().trim());p.setBrief(cmd.brief());p.setVisibility(cmd.visibility());p.setSpecificationJson(encode(cmd.specification()));
        p.setState(DesignProject.State.DRAFT);touch(p);return detail(user,p);
    }
    public Detail archive(CurrentUser user,UUID id,Version cmd) {
        write(user);var p=find(id,true);owner(user,p);version(p,cmd.expectedVersion());p.setState(DesignProject.State.ARCHIVED);touch(p);return detail(user,p);
    }
    public Detail publish(CurrentUser user,UUID id,Publish cmd) {
        write(user);var p=find(id,true);edit(user,p);notArchived(p);rights(cmd.licenseAccepted());
        String digest=hash(encode(cmd));
        var prior=revisions.findByProjectIdAndRequestId(id,cmd.requestId());
        if(prior.isPresent()) {
            if(!prior.get().getAuthorId().equals(user.id())||!prior.get().getRequestDigest().equals(digest)) conflict("Chave de revisão reutilizada com outro conteúdo.");
            return detail(user,p);
        }
        version(p,cmd.expectedVersion());
        if(!Objects.equals(p.getLatestRevisionId(),cmd.parentRevisionId())) conflict("A revisão de origem mudou. Atualize o projeto e preserve seu rascunho.");
        if(cmd.votingEndsAt()!=null && (!cmd.votingEndsAt().isAfter(Instant.now())||cmd.votingEndsAt().isAfter(Instant.now().plus(Duration.ofDays(90)))))
            throw ApiException.badRequest("ATELIER_VOTING_DEADLINE","O prazo de interesse deve estar entre agora e 90 dias.");
        if(cmd.sourceRevisionId()!=null) revisionFor(p,cmd.sourceRevisionId());
        var revision=new DesignRevision(id,p.getLatestRevisionId(),cmd.sourceRevisionId(),user.id(),p.getRevisionNumber()+1,p.getTitle(),p.getBrief(),p.getSpecificationJson(),cmd.requestId(),digest,cmd.votingEndsAt());
        revisions.saveAndFlush(revision);p.setLatestRevisionId(revision.getId());p.setRevisionNumber(revision.getNumber());p.setState(DesignProject.State.IN_REVIEW);touch(p);return detail(user,p);
    }
    @Transactional(readOnly=true)
    public Page<Revision> revisions(CurrentUser user,UUID id,int page,int size) {
        authenticated(user);var p=find(id,false);read(user,p);
        var result=revisions.findByProjectIdOrderByNumberDesc(id,PageRequest.of(Math.max(0,page),Math.min(50,Math.max(1,size))));
        return new Page<>(result.map(r->revision(user,r)).toList(),result.getNumber(),result.getSize(),result.hasNext());
    }
    public Detail invite(CurrentUser user,UUID id,Invite cmd) {
        write(user);var p=find(id,true);owner(user,p);version(p,cmd.expectedVersion());notArchived(p);
        if(cmd.role()==OWNER) throw ApiException.badRequest("ATELIER_MEMBER_ROLE","A autoria principal não pode ser transferida por convite.");
        var target=users.findByUsernameIgnoreCase(cmd.username().replaceFirst("^@","").trim()).orElseThrow(()->ApiException.notFound("Usuário"));
        if(target.getId().equals(p.getOwnerId())||!target.isEmailVerified()||target.getStatus()==AccountStatus.SUSPENDED||target.getStatus()==AccountStatus.DELETION_SCHEDULED)
            throw ApiException.badRequest("ATELIER_MEMBER_UNAVAILABLE","Esta conta não pode receber o convite.");
        if(guard.blocked(target.getId(),p.getOwnerId())) throw guard.deny(user,"atelier:"+id,"Não é possível colaborar entre contas bloqueadas.");
        var m=members.findByProjectIdAndUserId(id,target.getId()).orElseGet(DesignProjectMember::new);
        if(m.getStatus()==ACCEPTED) conflict("O participante já aceitou um convite; revogue o acesso antes de alterar o papel.");
        m.setProjectId(id);m.setUserId(target.getId());m.setRole(cmd.role());m.setStatus(INVITED);m.setAcceptedAt(null);m.setExpiresAt(Instant.now().plus(Duration.ofDays(7)));members.saveAndFlush(m);touch(p);return detail(user,p);
    }
    @Transactional(readOnly=true)
    public List<Invitation> invitations(CurrentUser user) {
        authenticated(user);
        return members.findByUserIdAndStatusOrderByCreatedAtDesc(user.id(),INVITED).stream().filter(m->m.getExpiresAt().isAfter(Instant.now()))
            .flatMap(m->projects.findById(m.getProjectId()).filter(this::ownerAvailable).filter(p->p.getState()!=DesignProject.State.ARCHIVED&&!guard.blocked(user.id(),p.getOwnerId())).map(p->new Invitation(m.getId(),p.getId(),p.getTitle(),m.getRole(),m.getExpiresAt())).stream()).toList();
    }
    public Detail accept(CurrentUser user,UUID id,UUID memberId) {
        write(user);var p=find(id,true);unblocked(user,p);notArchived(p);
        var m=members.findById(memberId).filter(x->x.getProjectId().equals(id)&&x.getUserId().equals(user.id())).orElseThrow(()->ApiException.notFound("Convite"));
        if(m.getStatus()==ACCEPTED)return detail(user,p);
        if(m.getStatus()!=INVITED||!m.getExpiresAt().isAfter(Instant.now())) throw ApiException.conflict("ATELIER_INVITE_EXPIRED","O convite expirou ou foi revogado.");
        m.setStatus(ACCEPTED);m.setAcceptedAt(Instant.now());members.saveAndFlush(m);touch(p);return detail(user,p);
    }
    public Detail revoke(CurrentUser user,UUID id,UUID memberId,Version cmd) {
        write(user);var p=find(id,true);owner(user,p);version(p,cmd.expectedVersion());
        var m=members.findById(memberId).filter(x->x.getProjectId().equals(id)).orElseThrow(()->ApiException.notFound("Participante"));
        m.setStatus(REVOKED);members.saveAndFlush(m);touch(p);return detail(user,p);
    }
    public Detail comment(CurrentUser user,UUID id,Comment cmd) {
        write(user);var p=find(id,true);participant(user,p);notArchived(p);revisionFor(p,cmd.revisionId());
        var prior=comments.findByProjectIdAndAuthorIdAndRequestId(id,user.id(),cmd.requestId());
        if(prior.isPresent()) {
            var c=prior.get();if(!c.getRevisionId().equals(cmd.revisionId())||!c.getBody().equals(cmd.body())||!c.getAnchor().equals(cmd.anchor())) conflict("Chave de comentário reutilizada.");return detail(user,p);
        }
        version(p,cmd.expectedVersion());comments.saveAndFlush(new DesignComment(id,cmd.revisionId(),user.id(),cmd.anchor(),cmd.body(),cmd.requestId()));touch(p);return detail(user,p);
    }
    public Detail review(CurrentUser user,UUID id,Review cmd) {
        write(user);var p=find(id,true);var role=participant(user,p);notArchived(p);
        if(role!=REVIEWER) throw guard.deny(user,"atelier:"+id,"A revisão exige um participante com papel de revisor.");
        var r=revisionFor(p,cmd.revisionId());
        if(r.getAuthorId().equals(user.id())) throw guard.deny(user,"atelier:"+id,"A revisão deve ser feita por outro participante.");
        var prior=reviews.findByProjectIdAndAuthorIdAndRequestId(id,user.id(),cmd.requestId());
        if(prior.isPresent()) {
            var old=prior.get();if(!old.getRevisionId().equals(cmd.revisionId())||old.getDecision()!=cmd.decision()||!old.getNotes().equals(cmd.notes()))conflict("Chave de revisão reutilizada.");return detail(user,p);
        }
        version(p,cmd.expectedVersion());
        if(!r.getId().equals(p.getLatestRevisionId())||p.getState()!=DesignProject.State.IN_REVIEW) conflict("Somente a revisão atual enviada para análise pode receber uma decisão.");
        if(cmd.decision()==DesignReview.Decision.APPROVE_SHOWCASE&&!missing(decode(r.getSpecificationJson())).isEmpty()) throw ApiException.badRequest("ATELIER_INCOMPLETE_TECH_PACK","Preencha família, modelagem, tecido e medidas com protocolo antes de aprovar a exposição.");
        reviews.saveAndFlush(new DesignReview(id,r.getId(),user.id(),cmd.decision(),cmd.notes(),cmd.requestId()));
        p.setState(cmd.decision()==DesignReview.Decision.APPROVE_SHOWCASE?DesignProject.State.APPROVED_FOR_SHOWCASE:DesignProject.State.CHANGES_REQUESTED);touch(p);return detail(user,p);
    }
    public VoteResult vote(CurrentUser user,UUID id,Vote cmd) {
        write(user);var p=find(id,true);read(user,p);notArchived(p);
        if(members.findByProjectIdAndUserId(id,user.id()).filter(m->m.getStatus()==REVOKED).isPresent()) throw guard.deny(user,"atelier:"+id,"O acesso de colaboração foi revogado.");
        var r=revisionFor(p,cmd.revisionId());
        if(r.getVotingEndsAt()==null||!r.getVotingEndsAt().isAfter(Instant.now())) throw ApiException.conflict("ATELIER_VOTING_CLOSED","O registro de interesse desta revisão está encerrado.");
        var v=votes.findByRevisionIdAndUserId(r.getId(),user.id()).orElseGet(DesignVote::new);
        v.setProjectId(id);v.setRevisionId(r.getId());v.setUserId(user.id());v.setInterested(cmd.interested());votes.saveAndFlush(v);
        return new VoteResult(r.getId(),v.isInterested(),votes.countByRevisionIdAndInterestedTrue(r.getId()));
    }
    @Transactional(readOnly=true)
    public TechPack techPack(CurrentUser user,UUID id,UUID revisionId) {
        authenticated(user);var p=find(id,false);read(user,p);var r=revisionFor(p,revisionId);
        var decisions=reviews.findByProjectIdAndRevisionIdOrderByCreatedAtDesc(id,revisionId).stream().map(this::reviewView).toList();
        boolean approved=!decisions.isEmpty()&&decisions.getFirst().decision()==DesignReview.Decision.APPROVE_SHOWCASE;
        return new TechPack("FAI_TECH_PACK_V1",id,revision(user,r),decisions,missing(decode(r.getSpecificationJson())),approved?"REVIEWED_FOR_SHOWCASE":"DRAFT",false,
            "Especificação colaborativa. Não é molde industrial, aprovação de produção, pedido ou promessa de entrega. Interesse não gera cobrança.");
    }
    private Detail detail(CurrentUser user,DesignProject p) {
        var role=role(user,p);boolean active=p.getState()!=DesignProject.State.ARCHIVED;
        boolean managing=user.id().equals(p.getOwnerId())||user.admin();
        var latest=p.getLatestRevisionId()==null?null:revision(user,revisionFor(p,p.getLatestRevisionId()));
        return new Detail(summary(p),decode(p.getSpecificationJson()),new Capabilities(active&&(managing||role==EDITOR),managing,active&&role==REVIEWER,active&&latest!=null&&latest.votingEndsAt()!=null&&latest.votingEndsAt().isAfter(Instant.now())),
            members.findByProjectIdOrderByCreatedAtAsc(p.getId()).stream().map(m->new Member(m.getId(),m.getUserId(),name(m.getUserId()),m.getRole(),m.getStatus(),m.getExpiresAt())).toList(),
            comments.findTop50ByProjectIdOrderByCreatedAtDesc(p.getId()).stream().map(c->new CommentView(c.getId(),c.getRevisionId(),c.getAuthorId(),name(c.getAuthorId()),c.getAnchor(),c.getBody(),c.getCreatedAt())).toList(),
            reviews.findTop50ByProjectIdOrderByCreatedAtDesc(p.getId()).stream().map(this::reviewView).toList(),latest);
    }
    private Summary summary(DesignProject p){return new Summary(p.getId(),p.getOwnerId(),p.getTitle(),p.getBrief(),p.getVisibility(),p.getState(),p.getVersion(),p.getRevisionNumber(),p.getLatestRevisionId(),p.getUpdatedAt());}
    private ReviewView reviewView(DesignReview r){return new ReviewView(r.getId(),r.getRevisionId(),r.getAuthorId(),name(r.getAuthorId()),r.getDecision(),r.getNotes(),r.getCreatedAt());}
    private Revision revision(CurrentUser user,DesignRevision r){return new Revision(r.getId(),r.getParentRevisionId(),r.getSourceRevisionId(),r.getAuthorId(),name(r.getAuthorId()),r.getNumber(),r.getTitle(),r.getBrief(),decode(r.getSpecificationJson()),r.getContributionLicense(),r.getCreatedAt(),r.getVotingEndsAt(),votes.countByRevisionIdAndInterestedTrue(r.getId()),votes.findByRevisionIdAndUserId(r.getId(),user.id()).map(DesignVote::isInterested).orElse(null));}
    private boolean ownerAvailable(DesignProject p){return users.findById(p.getOwnerId()).map(u->u.getStatus()!=AccountStatus.DELETED).orElse(true);}
    private DesignProject find(UUID id,boolean locked){var p=(locked?projects.lockById(id):projects.findById(id)).orElseThrow(()->ApiException.notFound("Projeto"));if(!ownerAvailable(p))throw ApiException.notFound("Projeto");return p;}
    private DesignRevision revisionFor(DesignProject p,UUID id){return revisions.findById(id).filter(r->r.getProjectId().equals(p.getId())).orElseThrow(()->ApiException.notFound("Revisão"));}
    private void authenticated(CurrentUser user){if(!enabled)throw new ApiException(503,"ATELIER_PROJECTS_DISABLED","Os projetos do Atelier estão temporariamente indisponíveis.");if(user==null)throw ApiException.unauthorized("Entre na sua conta para acessar o Atelier.");if(user.status()==AccountStatus.DELETED)throw ApiException.forbidden("Esta conta foi excluída.");}
    private void write(CurrentUser user){authenticated(user);guard.requireCanCreate(user);}
    private void unblocked(CurrentUser user,DesignProject p){if(guard.blocked(user.id(),p.getOwnerId()))throw guard.deny(user,"atelier:"+p.getId(),"Este projeto não está disponível.");}
    private DesignProjectMember.Role role(CurrentUser user,DesignProject p){if(user.id().equals(p.getOwnerId()))return OWNER;return members.findByProjectIdAndUserId(p.getId(),user.id()).filter(m->m.getStatus()==ACCEPTED).map(DesignProjectMember::getRole).orElse(null);}
    private void read(CurrentUser user,DesignProject p){unblocked(user,p);if(role(user,p)==null&&!user.admin())guard.requireView(user,p.getOwnerId(),p.getVisibility(),"atelier:"+p.getId());}
    private DesignProjectMember.Role participant(CurrentUser user,DesignProject p){unblocked(user,p);var role=role(user,p);if(role==null&&!user.admin())throw guard.deny(user,"atelier:"+p.getId(),"Aceite um convite para colaborar neste projeto.");return role;}
    private void edit(CurrentUser user,DesignProject p){var role=participant(user,p);if(role!=OWNER&&role!=EDITOR&&!user.admin())throw guard.deny(user,"atelier:"+p.getId(),"Somente o autor e editores podem alterar o projeto.");}
    private void owner(CurrentUser user,DesignProject p){unblocked(user,p);guard.requireOwner(user,p.getOwnerId(),"atelier:"+p.getId());}
    private void version(DesignProject p,long expected){if(p.getVersion()!=expected)conflict("O projeto mudou em outra sessão. Seu rascunho foi preservado; consulte a versão atual antes de salvar.");}
    private void touch(DesignProject p){p.setActivityAt(Instant.now());projects.saveAndFlush(p);}
    private void notArchived(DesignProject p){if(p.getState()==DesignProject.State.ARCHIVED)conflict("Este projeto está arquivado.");}
    private static void conflict(String message){throw ApiException.conflict("ATELIER_VERSION_CONFLICT",message);}
    private void rights(boolean accepted){if(!accepted)throw ApiException.badRequest("ATELIER_RIGHTS_REQUIRED","Confirme os direitos sobre suas contribuições e referências.");}
    private String name(UUID id){if(AtelierAccountDataCleanup.ANONYMOUS_AUTHOR.equals(id))return br.com.fashionai.application.common.Msg.t("account.conta_excluida");return users.findById(id).map(u->u.getUsername()).orElse("—");}
    private String encode(Object value){try{return json.writeValueAsString(value);}catch(Exception e){throw ApiException.badRequest("ATELIER_SPEC_INVALID","A especificação não pôde ser processada.");}}
    private Specification decode(String value){try{return json.readValue(value,Specification.class);}catch(Exception e){throw new IllegalStateException("Stored Atelier specification is invalid",e);}}
    private static String hash(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
    private List<String> missing(Specification s){var out=new ArrayList<String>();if(s.family()==null||s.family().isBlank())out.add("family");if(s.modeling()==null||s.modeling().isBlank())out.add("modeling");if(s.fabric()==null||s.fabric().isBlank())out.add("fabric");if(s.measurements()==null||s.measurements().isEmpty()||s.measurements().stream().anyMatch(m->m==null||m.point()==null||m.point().isBlank()||m.protocol()==null||m.protocol().isBlank()||m.centimeters()==null||m.centimeters().signum()<=0))out.add("measurements");return List.copyOf(out);}
}
