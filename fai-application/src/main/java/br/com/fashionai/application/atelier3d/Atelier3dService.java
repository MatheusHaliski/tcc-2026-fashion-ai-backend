package br.com.fashionai.application.atelier3d;

import br.com.fashionai.application.atelierproject.AtelierProjectService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.*;
import br.com.fashionai.domain.model.atelier3d.*;
import br.com.fashionai.domain.model.atelierproject.DesignProject;
import br.com.fashionai.domain.repository.atelier3d.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import java.security.*;
import java.time.*;
import java.util.*;

@Service @Transactional
public class Atelier3dService {
    public record NodeEdit(List<Double> position,List<Double> rotation,List<Double> scale,boolean visible) {}
    public record MaterialEdit(String color,Double roughness,Double metalness,List<Double> repeat,Double rotation) {}
    public record Document(Map<String,NodeEdit> nodes,Map<String,MaterialEdit> materials,Map<String,Map<String,List<Double>>> vertices) {}
    public record Save(long expectedSequence,UUID assetId,String requestId,Document document,List<UUID> productIds,UUID confirmedTipoLookId,String genderEvidenceHash) {}
    public record Asset(UUID id,String filename,int bytes,String sha256,GlbInspector.Inspection inspection) {}
    public record Version(UUID id,long sequence,UUID assetId,String author,Instant createdAt,Document document,CatalogGenderDecision.Evidence gender,UUID confirmedTipoLookId) {}
    public record VersionSummary(UUID id,long sequence,UUID assetId,String author,Instant createdAt) {}
    public record Scene(String title,boolean edit,boolean export,boolean manageGuests,Asset asset,Version current,List<VersionSummary> history) {}
    public record InviteCommand(String label,DesignGuestInvite.Role role,int hours,boolean allowExport) {}
    public record InviteView(UUID id,String label,DesignGuestInvite.Role role,Instant expiresAt,boolean revoked,boolean allowExport) {}
    public record CreatedInvite(InviteView invite,String token) {}
    private final AtelierProjectService access;
    private final DesignAssetRepository assets;private final DesignSceneVersionRepository versions;
    private final DesignGuestInviteRepository guests;private final CatalogGenderDecision genders;
    private final ObjectMapper json;
    public Atelier3dService(AtelierProjectService access,DesignAssetRepository assets,DesignSceneVersionRepository versions,DesignGuestInviteRepository guests,CatalogGenderDecision genders,ObjectMapper json){this.access=access;this.assets=assets;this.versions=versions;this.guests=guests;this.genders=genders;this.json=json;}
    public Scene get(CurrentUser user,UUID project){var p=access.access3d(user,project,false);boolean edit=access.get(user,project).capabilities().edit();return scene(p,edit,true,access.get(user,project).capabilities().manageMembers());}
    public Asset upload(CurrentUser user,UUID project,String filename,byte[] bytes){access.access3d(user,project,true);return upload(project,filename,bytes);}
    public Version save(CurrentUser user,UUID project,Save cmd){access.access3d(user,project,true);return save(project,"user:"+user.id(),cmd);}
    public Version getVersion(CurrentUser user,UUID project,UUID id){access.access3d(user,project,false);return version(findVersion(project,id));}
    public Asset metadata(CurrentUser user,UUID project,UUID id){access.access3d(user,project,false);return metadata(project,id);}
    public byte[] content(CurrentUser user,UUID project,UUID asset){access.access3d(user,project,false);return content(project,asset);}
    public List<InviteView> invites(CurrentUser user,UUID project){access.manage3dGuests(user,project);return guests.findByProjectIdOrderByCreatedAtDesc(project).stream().map(this::invite).toList();}
    public CreatedInvite invite(CurrentUser user,UUID project,InviteCommand cmd){
        access.manage3dGuests(user,project);
        if(cmd==null||cmd.label()==null||cmd.label().isBlank()||cmd.label().length()>80||cmd.role()==null||cmd.hours()<1||cmd.hours()>168)throw bad("Convite inválido. Validade de 1 a 168 horas.");
        if(guests.findByProjectIdOrderByCreatedAtDesc(project).stream().filter(g->g.getRevokedAt()==null&&g.getExpiresAt().isAfter(Instant.now())).count()>=20)throw bad("Este projeto já possui 20 convites ativos.");
        byte[] random=new byte[32];new SecureRandom().nextBytes(random);String token=Base64.getUrlEncoder().withoutPadding().encodeToString(random);
        var g=new DesignGuestInvite();g.setProjectId(project);g.setLabel(cmd.label().trim());g.setRole(cmd.role());g.setTokenHash(CatalogGenderDecision.hash(token));g.setExpiresAt(Instant.now().plusSeconds(cmd.hours()*3600L));g.setAllowExport(cmd.allowExport());guests.saveAndFlush(g);return new CreatedInvite(invite(g),token);
    }
    public void revoke(CurrentUser user,UUID project,UUID id){access.manage3dGuests(user,project);var g=guests.findById(id).filter(x->x.getProjectId().equals(project)).orElseThrow(()->ApiException.notFound("Convite"));g.setRevokedAt(Instant.now());}
    public Scene guestScene(UUID invite,String token){var g=guest(invite,token,false);return scene(guestProject(g,false),g.getRole()==DesignGuestInvite.Role.EDITOR,g.isAllowExport(),false);}
    public Asset guestUpload(UUID invite,String token,String filename,byte[] bytes){var g=guest(invite,token,true);guestProject(g,true);return upload(g.getProjectId(),filename,bytes);}
    public Version guestSave(UUID invite,String token,Save cmd){var g=guest(invite,token,true);guestProject(g,true);return save(g.getProjectId(),"guest:"+g.getId()+":"+g.getLabel(),cmd);}
    public Version guestVersion(UUID invite,String token,UUID id){var g=guest(invite,token,false);guestProject(g,false);return version(findVersion(g.getProjectId(),id));}
    public Asset guestMetadata(UUID invite,String token,UUID id){var g=guest(invite,token,false);guestProject(g,false);return metadata(g.getProjectId(),id);}
    public byte[] guestContent(UUID invite,String token,UUID asset){var g=guest(invite,token,false);guestProject(g,false);return content(g.getProjectId(),asset);}
    public CatalogGenderDecision.Evidence evidence(CurrentUser user,UUID project,List<UUID> ids){access.access3d(user,project,false);return genders.evidence(ids);}
    public CatalogGenderDecision.Evidence guestEvidence(UUID invite,String token,List<UUID> ids){var g=guest(invite,token,false);guestProject(g,false);return genders.evidence(ids);}
    private DesignGuestInvite guest(UUID id,String token,boolean write){
        if(token==null||token.length()>120)throw ApiException.unauthorized("Convite necessário.");
        if(write){var project=guests.projectIdOf(id).orElseThrow(()->ApiException.unauthorized("Convite indisponível."));access.capability3dProject(project,true);}
        var g=(write?guests.lockById(id):guests.findById(id)).orElseThrow(()->ApiException.unauthorized("Convite indisponível."));
        if(!MessageDigest.isEqual(g.getTokenHash().getBytes(java.nio.charset.StandardCharsets.US_ASCII),CatalogGenderDecision.hash(token).getBytes(java.nio.charset.StandardCharsets.US_ASCII))||g.getRevokedAt()!=null||!g.getExpiresAt().isAfter(Instant.now()))throw ApiException.unauthorized("Convite expirado ou revogado.");
        if(write&&g.getRole()!=DesignGuestInvite.Role.EDITOR)throw ApiException.forbidden("Este convite permite somente visualizar.");return g;
    }
    private DesignProject guestProject(DesignGuestInvite g,boolean write){
        return access.capability3dProject(g.getProjectId(),write);
    }
    private InviteView invite(DesignGuestInvite g){return new InviteView(g.getId(),g.getLabel(),g.getRole(),g.getExpiresAt(),g.getRevokedAt()!=null,g.isAllowExport());}
    private Asset upload(UUID project,String filename,byte[] bytes){
        var inspection=GlbInspector.inspect(bytes,json);String digest=hashBytes(bytes);
        var existing=assets.findFirstByProjectIdAndSha256(project,digest);if(existing.isPresent())return asset(existing.get());
        if(assets.countByProjectId(project)>=20)throw bad("Limite de 20 arquivos originais por projeto nesta versão.");
        String safe=(filename==null?"garment.glb":filename).replaceAll("[^\\p{L}\\p{N}._ -]","_");
        var a=new DesignAsset();a.setProjectId(project);a.setFilename(safe.substring(0,Math.min(safe.length(),160)));a.setBytes(bytes.length);a.setSha256(digest);a.setInspectionJson(encode(inspection));a.setContentBase64(Base64.getEncoder().encodeToString(bytes));assets.saveAndFlush(a);return asset(a);
    }
    private Asset asset(DesignAsset a){return new Asset(a.getId(),a.getFilename(),a.getBytes(),a.getSha256(),decode(a.getInspectionJson(),GlbInspector.Inspection.class));}
    private DesignSceneVersion findVersion(UUID project,UUID id){return versions.findById(id).filter(v->v.getProjectId().equals(project)).orElseThrow(()->ApiException.notFound("Versão"));}
    private Asset metadata(UUID project,UUID id){var a=assets.findProjectedById(id).filter(v->v.getProjectId().equals(project)).orElseThrow(()->ApiException.notFound("Asset"));return new Asset(a.getId(),a.getFilename(),a.getBytes(),a.getSha256(),decode(a.getInspectionJson(),GlbInspector.Inspection.class));}
    private byte[] content(UUID project,UUID id){return Base64.getDecoder().decode(findAsset(project,id).getContentBase64());}
    private DesignAsset findAsset(UUID project,UUID id){return assets.findById(id).filter(a->a.getProjectId().equals(project)).orElseThrow(()->ApiException.notFound("Asset"));}
    private Scene scene(DesignProject p,boolean edit,boolean export,boolean manageGuests){
        var history=versions.findTop30ByProjectIdOrderBySequenceNumberDesc(p.getId());var current=versions.findFirstByProjectIdOrderBySequenceNumberDesc(p.getId()).map(this::version).orElse(null);
        return new Scene(p.getTitle(),edit,export,manageGuests,current==null?null:metadata(p.getId(),current.assetId()),current,history.stream().map(v->new VersionSummary(v.getId(),v.getSequenceNumber(),v.getAssetId(),v.getAuthor(),v.getCreatedAt())).toList());
    }
    private Version save(UUID project,String author,Save cmd){
        if(cmd==null||cmd.assetId()==null||cmd.requestId()==null||cmd.requestId().isBlank()||cmd.requestId().length()>80||cmd.expectedSequence()<0)throw bad("Comando de versão inválido.");
        String digest=CatalogGenderDecision.hash(author+encode(cmd));var prior=versions.findByProjectIdAndRequestId(project,cmd.requestId());
        if(prior.isPresent()){if(!prior.get().getDigest().equals(digest))throw ApiException.conflict("ATELIER_COMMAND_CONFLICT","Este comando já foi usado para outro conteúdo.");return version(prior.get());}
        long current=versions.findFirstByProjectIdOrderBySequenceNumberDesc(project).map(DesignSceneVersion::getSequenceNumber).orElse(0L);
        if(current!=cmd.expectedSequence())throw ApiException.conflict("ATELIER_3D_CONFLICT","Outra pessoa salvou uma versão. Seu trabalho local foi preservado; revise a versão atual.");
        var original=findAsset(project,cmd.assetId());var inspection=decode(original.getInspectionJson(),GlbInspector.Inspection.class);validate(cmd.document(),inspection);
        var evidence=genders.evidence(cmd.productIds());genders.confirm(evidence,cmd.confirmedTipoLookId(),cmd.genderEvidenceHash());
        var v=new DesignSceneVersion();v.setProjectId(project);v.setAssetId(original.getId());v.setSequenceNumber(current+1);v.setAuthor(author);v.setRequestId(cmd.requestId());v.setDigest(digest);v.setDocumentJson(encode(cmd.document()));v.setGenderEvidenceJson(encode(evidence));v.setTipoLookId(cmd.confirmedTipoLookId());versions.saveAndFlush(v);return version(v);
    }
    private Version version(DesignSceneVersion v){return new Version(v.getId(),v.getSequenceNumber(),v.getAssetId(),v.getAuthor(),v.getCreatedAt(),decode(v.getDocumentJson(),Document.class),decode(v.getGenderEvidenceJson(),CatalogGenderDecision.Evidence.class),v.getTipoLookId());}
    static void validate(Document doc,GlbInspector.Inspection asset){
        if(doc==null||doc.nodes()==null||doc.materials()==null||doc.vertices()==null||doc.nodes().size()>asset.nodes()||doc.materials().size()>asset.primitives().size())throw bad("Documento 3D inválido.");
        for(var e:doc.nodes().entrySet()){
            if(!e.getKey().matches("n[0-9]{1,5}")||Integer.parseInt(e.getKey().substring(1))>=asset.nodes()||e.getValue()==null)throw bad("Objeto inválido.");
            var n=e.getValue();vector(n.position(),3,10000);vector(n.rotation(),3,1000);vector(n.scale(),3,1000);if(n.scale().stream().anyMatch(x->x<=0))throw bad("Escala deve ser positiva.");
        }
        for(var e:doc.materials().entrySet()){
            var m=e.getValue();if(!asset.primitives().containsKey(e.getKey())||m==null||m.color()==null||!m.color().matches("#[0-9a-fA-F]{6}"))throw bad("Material inválido.");
            scalar(m.roughness(),0,1);scalar(m.metalness(),0,1);vector(m.repeat(),2,100);if(m.repeat().stream().anyMatch(x->x<=0))throw bad("Repetição inválida.");scalar(m.rotation(),-100,100);
        }
        if(!doc.vertices().isEmpty()&&(asset.skinned()||asset.morphs()||asset.animated()))throw bad("Edição de vértices exige uma malha estática sem rig, morphs ou animações.");
        int count=0;for(var e:doc.vertices().entrySet()){
            Integer limit=asset.primitives().get(e.getKey());if(limit==null||e.getValue()==null)throw bad("Malha inválida.");
            for(var vertex:e.getValue().entrySet()){
                if(++count>20000||!vertex.getKey().matches("[0-9]{1,7}")||Integer.parseInt(vertex.getKey())>=limit)throw bad("Índice de vértice inválido.");vector(vertex.getValue(),3,10000);
            }
        }
    }
    private static void vector(List<Double> values,int n,double bound){if(values==null||values.size()!=n)throw bad("Vetor inválido.");for(var v:values)scalar(v,-bound,bound);}
    private static void scalar(Double value,double low,double high){if(value==null||!Double.isFinite(value)||value<low||value>high)throw bad("Valor numérico fora dos limites.");}
    private String encode(Object value){try{var s=json.writeValueAsString(value);if(s.length()>2_000_000)throw bad("Documento grande demais.");return s;}catch(ApiException e){throw e;}catch(Exception e){throw bad("Dados inválidos.");}}
    private <T>T decode(String value,Class<T> type){try{return json.readValue(value,type);}catch(Exception e){throw new IllegalStateException("Invalid stored Atelier document",e);}}
    private static String hashBytes(byte[] value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value));}catch(Exception e){throw new IllegalStateException(e);}}
    private static ApiException bad(String message){return ApiException.badRequest("ATELIER_3D_INVALID",message);}
}
