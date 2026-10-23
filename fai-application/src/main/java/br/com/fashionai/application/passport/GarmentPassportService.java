package br.com.fashionai.application.passport;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.*;
import br.com.fashionai.domain.model.passport.*;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import br.com.fashionai.domain.repository.passport.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.*;
import java.util.*;

/** Physical ownership is independent of catalogue identity, Hype and earlier look authorship. */
@Service
@Transactional
public class GarmentPassportService {
    private static final Set<String> SHARE_FIELDS = Set.of("NAME", "ORIGIN", "COMPOSITION", "CARE", "HISTORY");
    private static final Set<String> EVENT_KINDS = Set.of("PURCHASE", "CARE", "REPAIR", "ALTERATION", "CORRECTION");
    private static final Set<String> ORIGINS = Set.of("UNKNOWN", "COMPRADA", "GARIMPADA", "HERDADA", "PRESENTE", "FEITA_A_MAO", "TROCADA");
    private final GarmentPassportRepository passports;
    private final PassportHoldingRepository holdings;
    private final PassportEventRepository events;
    private final PassportShareRepository shares;
    private final PassportEvidenceRepository evidence;
    private final PassportTransferRepository transfers;
    private final WardrobeItemRepository pieces;
    private final UserRepository users;
    private final Guard guard;
    private final boolean enabled;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public GarmentPassportService(GarmentPassportRepository passports, PassportHoldingRepository holdings,
            PassportEventRepository events, PassportShareRepository shares, PassportEvidenceRepository evidence,
            PassportTransferRepository transfers, WardrobeItemRepository pieces, UserRepository users, Guard guard,
            @Value("${fashionai.passport.enabled:true}") boolean enabled) {
        this(passports, holdings, events, shares, evidence, transfers, pieces, users, guard, enabled, Clock.systemUTC());
    }
    GarmentPassportService(GarmentPassportRepository passports, PassportHoldingRepository holdings,
            PassportEventRepository events, PassportShareRepository shares, PassportEvidenceRepository evidence,
            PassportTransferRepository transfers, WardrobeItemRepository pieces, UserRepository users, Guard guard,
            boolean enabled, Clock clock) {
        this.passports=passports; this.holdings=holdings; this.events=events; this.shares=shares;
        this.evidence=evidence; this.transfers=transfers; this.pieces=pieces; this.users=users; this.guard=guard;
        this.enabled=enabled; this.clock=clock;
    }
    private Instant now() { return clock.instant(); }
    private void feature() { if (!enabled) throw new ApiException(404,"PASSPORT_DISABLED","Passaporte indisponível neste ambiente."); }
    private void authenticated(CurrentUser user) {
        feature();
        if (user==null) throw ApiException.unauthorized("Entre para acessar o passaporte.");
        if (user.status()!=AccountStatus.ACTIVE) throw ApiException.forbidden("A conta precisa estar ativa.");
    }
    private void writable(CurrentUser user) { authenticated(user); guard.requireCanCreate(user); }
    private void owner(CurrentUser user, GarmentPassport p) {
        authenticated(user);
        if (!p.getOwnerId().equals(user.id())) throw ApiException.forbidden("Somente o proprietário atual pode acessar este passaporte.");
    }
    private WardrobeItem ownPiece(CurrentUser user, UUID pieceId) {
        authenticated(user);
        WardrobeItem item=pieces.findById(pieceId).orElseThrow(()->ApiException.notFound("Peça"));
        if (!item.getUser().getId().equals(user.id())) throw ApiException.forbidden("Peça de outro proprietário.");
        return item;
    }
    private GarmentPassport locked(CurrentUser user, UUID id) {
        GarmentPassport p=passports.lockById(id).orElseThrow(()->ApiException.notFound("Passaporte"));
        owner(user,p); return p;
    }
    private void version(GarmentPassport p, long expected) {
        if (p.getVersion()!=expected) throw ApiException.conflict("PASSPORT_VERSION_CONFLICT","O passaporte mudou. Atualize a página.");
    }
    private void touch(GarmentPassport p) { p.setStateUpdatedAt(now()); passports.saveAndFlush(p); }
    private static String text(String value, int max) {
        if (value==null) return null;
        value=value.trim();
        if (value.length()>max || value.codePoints().anyMatch(c -> Character.isISOControl(c)&&c!='\n'&&c!='\t'))
            throw ApiException.badRequest("PASSPORT_INVALID_TEXT","Texto inválido ou muito longo.");
        return value.isEmpty()?null:value;
    }
    private static String key(String key) {
        if (key==null||!key.matches("[a-zA-Z0-9_-]{8,80}")) throw ApiException.badRequest("IDEMPOTENCY_KEY_REQUIRED","Envie uma chave de idempotência válida.");
        return key;
    }
    static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }
    private static String token() { byte[] bytes=new byte[32]; new SecureRandom().nextBytes(bytes); return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes); }
    private void tokenMatches(String raw, String hash) {
        if (raw==null || !raw.matches("[A-Za-z0-9_-]{43}") || !MessageDigest.isEqual(hash(raw).getBytes(java.nio.charset.StandardCharsets.US_ASCII),hash.getBytes(java.nio.charset.StandardCharsets.US_ASCII)))
            throw ApiException.forbidden("Token inválido.");
    }
    private Instant expires(Integer hours, int maximum) {
        if (hours==null||hours<1||hours>maximum) throw ApiException.badRequest("PASSPORT_INVALID_EXPIRY","Prazo inválido.");
        return now().plus(Duration.ofHours(hours));
    }

    public record Declaration(long version, String origin, String composition, String care) {}
    public record EventCommand(long version, String kind, LocalDate occurredOn, String notes, UUID correctsEventId) {}
    public record ShareCommand(long version, Set<String> fields, Integer expiresInHours) {}
    public record TransferCommand(long version, String recipientUsername, Integer expiresInHours) {}
    public record AcceptCommand(long version, String token) {}
    public record EventView(UUID id, String kind, LocalDate occurredOn, String notes, String provenance, UUID correctsEventId) {}
    public record EvidenceView(UUID id, String kind, String status, Instant expiresAt, long version) {}
    public record ShareView(UUID id, Set<String> fields, Instant expiresAt, boolean revoked, long version) {}
    public record TransferView(UUID id, UUID passportId, String status, Instant expiresAt, long version, UUID recipientPieceId) {}
    public record PrivateView(UUID id, UUID pieceId, long version, String pieceName, String origin, String composition,
            String care, String provenance, List<EventView> events, List<EvidenceView> evidence,
            List<ShareView> shares, List<TransferView> transfers) {}
    public record ShareCreated(ShareView share, String token, String path) {}
    public record TransferCreated(TransferView transfer, String token) {}

    public PrivateView get(CurrentUser user, UUID pieceId) {
        ownPiece(user,pieceId);
        GarmentPassport p=passports.findByPieceId(pieceId).orElseThrow(()->new ApiException(404,"PASSPORT_NOT_CREATED","Esta peça ainda não tem passaporte."));
        owner(user,p); return view(user,p);
    }
    public PrivateView create(CurrentUser user, UUID pieceId, String commandKey) {
        writable(user); key(commandKey);
        // Existing row lock serializes creation and ordinary piece updates; unique piece_id remains the backstop.
        WardrobeItem item=pieces.findForSealRequest(pieceId).orElseThrow(()->ApiException.notFound("Peça"));
        if (!item.getUser().getId().equals(user.id())) throw ApiException.forbidden("Peça de outro proprietário.");
        if (item.getAvailabilityStatus()==AvailabilityStatus.ARCHIVED) throw ApiException.conflict("PIECE_ARCHIVED","Peça arquivada.");
        Optional<GarmentPassport> found=passports.findByPieceId(pieceId);
        if(found.isPresent()) { owner(user,found.get()); return view(user,found.get()); }
        GarmentPassport p=new GarmentPassport(); p.setPieceId(pieceId); p.setOwnerId(user.id());
        p.setOrigin(item.getPieceOrigin()!=null&&ORIGINS.contains(item.getPieceOrigin())?item.getPieceOrigin():"UNKNOWN");
        p.setComposition(text(item.getMaterial(),1000)); p.setCare(text(item.getCareInstructions(),1000)); p.setStateUpdatedAt(now());
        passports.saveAndFlush(p);
        PassportHolding holding=new PassportHolding(); holding.setPassportId(p.getId()); holding.setActivePassportId(p.getId());
        holding.setOwnerId(user.id()); holding.setPieceId(pieceId); holding.setStartedAt(now()); holdings.save(holding);
        return view(user,p);
    }
    public PrivateView update(CurrentUser user, UUID id, Declaration command) {
        writable(user); GarmentPassport p=locked(user,id); version(p,command.version());
        if(!ORIGINS.contains(command.origin()==null?"":command.origin())) throw ApiException.badRequest("PASSPORT_INVALID_ORIGIN","Origem inválida.");
        p.setOrigin(command.origin()); p.setComposition(text(command.composition(),1000)); p.setCare(text(command.care(),1000));
        PassportEvent declaration=new PassportEvent(); declaration.setPassportId(id); declaration.setAuthorId(user.id());
        declaration.setKind("DECLARATION"); declaration.setOccurredOn(LocalDate.now(clock));
        Map<String,Object> snapshot=new LinkedHashMap<>(); snapshot.put("origin",p.getOrigin()); snapshot.put("composition",p.getComposition()); snapshot.put("care",p.getCare());
        declaration.setNotes(br.com.fashionai.application.common.Json.write(snapshot)); declaration.setCommandKey("declaration_"+UUID.randomUUID());
        events.save(declaration);
        touch(p); return view(user,p);
    }
    public EventView addEvent(CurrentUser user, UUID id, EventCommand command, String commandKey) {
        writable(user); GarmentPassport p=locked(user,id); key(commandKey);
        var old=events.findByPassportIdAndAuthorIdAndCommandKey(id,user.id(),commandKey);
        if(old.isPresent()) return eventView(old.get(),user.id());
        version(p,command.version());
        if(command.kind()==null||!EVENT_KINDS.contains(command.kind())||command.occurredOn()==null||command.occurredOn().isAfter(LocalDate.now(clock)))
            throw ApiException.badRequest("PASSPORT_INVALID_EVENT","Informe tipo e data válidos.");
        if(command.correctsEventId()!=null) {
            PassportEvent corrected=events.findById(command.correctsEventId()).orElseThrow(()->ApiException.notFound("Evento"));
            if(!corrected.getPassportId().equals(id)||!corrected.getAuthorId().equals(user.id())||!"CORRECTION".equals(command.kind()))
                throw ApiException.forbidden("A correção precisa apontar para um evento próprio deste passaporte.");
        } else if("CORRECTION".equals(command.kind())) throw ApiException.badRequest("PASSPORT_CORRECTION_TARGET","Escolha o evento a corrigir.");
        PassportEvent e=new PassportEvent(); e.setPassportId(id); e.setAuthorId(user.id()); e.setKind(command.kind());
        e.setOccurredOn(command.occurredOn()); e.setNotes(text(command.notes(),2000)); e.setCorrectsEventId(command.correctsEventId()); e.setCommandKey(commandKey);
        events.saveAndFlush(e); touch(p); return eventView(e,user.id());
    }
    private EventView eventView(PassportEvent e, UUID viewerId) {
        // Previous owners' private narrative never follows the physical piece.
        return new EventView(e.getId(),e.getKind(),e.getOccurredOn(),e.getAuthorId().equals(viewerId)?e.getNotes():null,
                "OWNER_DECLARED",e.getCorrectsEventId());
    }
    private ShareView shareView(PassportShare s) { return new ShareView(s.getId(),Set.of(s.getFields().split(",")),s.getExpiresAt(),s.getRevokedAt()!=null,s.getVersion()); }
    private TransferView transferView(PassportTransfer t) {
        String state="PENDING".equals(t.getStatus())&&!t.getExpiresAt().isAfter(now())?"EXPIRED":t.getStatus();
        return new TransferView(t.getId(),t.getPassportId(),state,t.getExpiresAt(),t.getVersion(),t.getRecipientPieceId());
    }
    private EvidenceView evidenceView(PassportEvidence e) { return new EvidenceView(e.getId(),e.getKind(),e.getExpiresAt().isAfter(now())?"PRESENTED_UNVERIFIED":"EXPIRED",e.getExpiresAt(),e.getVersion()); }
    private PrivateView view(CurrentUser user, GarmentPassport p) {
        WardrobeItem item=pieces.findById(p.getPieceId()).orElseThrow(()->ApiException.notFound("Peça"));
        return new PrivateView(p.getId(),p.getPieceId(),p.getVersion(),item.getName(),p.getOrigin(),p.getComposition(),p.getCare(),"OWNER_DECLARED",
                events.findByPassportIdOrderByCreatedAtAsc(p.getId()).stream().map(e->eventView(e,user.id())).toList(),
                evidence.findByPassportIdAndControllerId(p.getId(),user.id()).stream().filter(e->e.getDeletedAt()==null).map(this::evidenceView).toList(),
                shares.findByPassportId(p.getId()).stream().filter(s->s.getOwnerId().equals(user.id())).map(this::shareView).toList(),
                transfers.findByPassportIdOrderByCreatedAtDesc(p.getId()).stream().map(this::transferView).toList());
    }
    public ShareCreated share(CurrentUser user, UUID id, ShareCommand command) {
        writable(user); GarmentPassport p=locked(user,id); version(p,command.version());
        if(command.fields()==null||command.fields().isEmpty()||!SHARE_FIELDS.containsAll(command.fields()))
            throw ApiException.badRequest("PASSPORT_INVALID_SCOPE","Escolha campos públicos permitidos.");
        String token=token(); PassportShare share=new PassportShare(); share.setPassportId(id); share.setOwnerId(user.id());
        share.setTokenHash(hash(token)); share.setFields(String.join(",",new TreeSet<>(command.fields()))); share.setExpiresAt(expires(command.expiresInHours(),720));
        shares.saveAndFlush(share); touch(p); return new ShareCreated(shareView(share),token,"/passport/"+token);
    }
    public void revoke(CurrentUser user, UUID id, UUID shareId) {
        writable(user); GarmentPassport p=locked(user,id);
        PassportShare s=shares.findById(shareId).orElseThrow(()->ApiException.notFound("Link"));
        if(!s.getPassportId().equals(id)) throw ApiException.notFound("Link");
        if(s.getRevokedAt()==null) { s.setRevokedAt(now()); shares.save(s); touch(p); }
    }
    /** Archiving permanently closes existing capabilities, even if the item is restored later. */
    @org.springframework.context.event.EventListener
    public void onPieceDeleted(DomainEvents.PieceDeleted event) {
        passports.findByPieceId(event.pieceId()).flatMap(p -> passports.lockById(p.getId())).ifPresent(p -> {
            // A historical item can be archived after the physical passport has moved to its next owner.
            if(!p.getPieceId().equals(event.pieceId())||!p.getOwnerId().equals(event.userId())) return;
            for(PassportShare share:shares.findByPassportId(p.getId())) {
                if(share.getRevokedAt()==null) { share.setRevokedAt(now()); shares.save(share); }
            }
            if(p.getPendingTransferId()!=null) {
                transfers.lockById(p.getPendingTransferId()).ifPresent(transfer -> {
                    if("PENDING".equals(transfer.getStatus())) { transfer.setStatus("CANCELLED"); transfers.save(transfer); }
                });
                p.setPendingTransferId(null);
            }
            touch(p);
        });
    }
    public Map<String,Object> publicView(String rawToken) {
        feature();
        if(rawToken==null||!rawToken.matches("[A-Za-z0-9_-]{43}")) throw ApiException.notFound("Link");
        PassportShare share=shares.findByTokenHash(hash(rawToken)).orElseThrow(()->ApiException.notFound("Link"));
        if(share.getRevokedAt()!=null||!share.getExpiresAt().isAfter(now())) throw ApiException.notFound("Link");
        GarmentPassport p=passports.findById(share.getPassportId()).orElseThrow(()->ApiException.notFound("Passaporte"));
        if(!p.getOwnerId().equals(share.getOwnerId())) throw ApiException.notFound("Link");
        User owner=users.findById(p.getOwnerId()).orElseThrow(()->ApiException.notFound("Link"));
        if(owner.getStatus()!=AccountStatus.ACTIVE) throw ApiException.notFound("Link");
        WardrobeItem item=pieces.findById(p.getPieceId()).orElseThrow(()->ApiException.notFound("Peça"));
        if(item.getAvailabilityStatus()==AvailabilityStatus.ARCHIVED) throw ApiException.notFound("Link");
        Set<String> scope=Set.of(share.getFields().split(",")); Map<String,Object> out=new LinkedHashMap<>();
        out.put("provenance","OWNER_DECLARED"); out.put("authentication","NOT_VERIFIED"); out.put("expiresAt",share.getExpiresAt());
        if(scope.contains("NAME")) out.put("pieceName",item.getName());
        if(scope.contains("ORIGIN")) out.put("origin",p.getOrigin());
        if(scope.contains("COMPOSITION")) out.put("composition",p.getComposition());
        if(scope.contains("CARE")) out.put("care",p.getCare());
        if(scope.contains("HISTORY")) out.put("events",events.findByPassportIdOrderByCreatedAtAsc(p.getId()).stream()
                .map(e->Map.of("kind",e.getKind(),"occurredOn",e.getOccurredOn(),"provenance","OWNER_DECLARED")).toList());
        return out;
    }
    public Map<String,Object> resale(CurrentUser user, UUID id) {
        GarmentPassport p=locked(user,id); WardrobeItem item=ownPiece(user,p.getPieceId());
        if(!item.isDisponivel()||item.getAvailabilityStatus()!=AvailabilityStatus.AVAILABLE||(!item.isForSale()&&!item.isForDonation()))
            throw ApiException.conflict("PIECE_NOT_LISTED","Marque a peça disponível e à venda ou para doar no cadastro existente.");
        Map<String,Object> out=new LinkedHashMap<>(); out.put("pieceId",item.getId()); out.put("title",item.getName());
        out.put("forSale",item.isForSale()); out.put("forDonation",item.isForDonation()); out.put("price",item.getPrice()); out.put("currency",item.getPriceCurrency());
        out.put("condition",item.getCondition()); out.put("composition",p.getComposition()); out.put("care",p.getCare()); out.put("origin",p.getOrigin());
        out.put("provenance","OWNER_DECLARED"); out.put("authentication","NOT_VERIFIED");
        out.put("history",events.findByPassportIdOrderByCreatedAtAsc(id).stream().map(e->Map.of("kind",e.getKind(),"occurredOn",e.getOccurredOn())).toList());
        return out;
    }

    public TransferCreated offerTransfer(CurrentUser user, UUID id, TransferCommand command, String commandKey) {
        writable(user); GarmentPassport p=locked(user,id); key(commandKey);
        var prior=transfers.findByPassportIdAndFromOwnerIdAndCommandKey(id,user.id(),commandKey);
        // Tokens are never persisted in plaintext and therefore are revealed only once.
        if(prior.isPresent()) return new TransferCreated(transferView(prior.get()),null);
        version(p,command.version());
        String username=text(command.recipientUsername(),60);
        if(username==null) throw ApiException.badRequest("PASSPORT_RECIPIENT_REQUIRED","Informe o usuário destinatário.");
        if(username.startsWith("@")) username=username.substring(1);
        User recipient=users.findByUsernameIgnoreCase(username).orElseThrow(()->ApiException.notFound("Destinatário"));
        if(recipient.getStatus()!=AccountStatus.ACTIVE||!recipient.isEmailVerified()||recipient.getId().equals(user.id())||guard.blocked(user.id(),recipient.getId()))
            throw ApiException.badRequest("PASSPORT_INVALID_RECIPIENT","Escolha outra conta ativa e elegível.");
        if(p.getPendingTransferId()!=null) {
            PassportTransfer previous=transfers.lockById(p.getPendingTransferId()).orElseThrow(()->ApiException.notFound("Transferência"));
            if("PENDING".equals(previous.getStatus())) { previous.setStatus("CANCELLED"); transfers.save(previous); }
        }
        PassportTransfer t=new PassportTransfer(); t.setPassportId(id); t.setFromOwnerId(user.id()); t.setRecipientId(recipient.getId());
        t.setSourcePieceId(p.getPieceId()); t.setStatus("PENDING"); t.setCommandKey(commandKey); t.setExpiresAt(expires(command.expiresInHours(),168));
        String token=token(); t.setTokenHash(hash(token)); transfers.saveAndFlush(t);
        p.setPendingTransferId(t.getId()); touch(p); return new TransferCreated(transferView(t),token);
    }
    public List<TransferView> incoming(CurrentUser user) {
        authenticated(user); return transfers.findByRecipientIdAndStatusOrderByCreatedAtDesc(user.id(),"PENDING").stream().map(this::transferView).toList();
    }
    public TransferView cancelTransfer(CurrentUser user, UUID id, UUID transferId) {
        writable(user); GarmentPassport p=locked(user,id);
        PassportTransfer t=transfers.lockById(transferId).orElseThrow(()->ApiException.notFound("Transferência"));
        if(!t.getPassportId().equals(id)||!t.getFromOwnerId().equals(user.id())) throw ApiException.forbidden("Transferência de outro proprietário.");
        if("ACCEPTED".equals(t.getStatus())) throw ApiException.conflict("TRANSFER_ALREADY_ACCEPTED","A transferência já foi aceita.");
        if("PENDING".equals(t.getStatus())) {
            t.setStatus("CANCELLED"); transfers.save(t);
            if(t.getId().equals(p.getPendingTransferId())) p.setPendingTransferId(null);
            touch(p);
        }
        return transferView(t);
    }
    public TransferView accept(CurrentUser user, UUID transferId, AcceptCommand command, String commandKey) {
        writable(user); key(commandKey);
        UUID passportId=transfers.passportIdOf(transferId).orElseThrow(()->ApiException.notFound("Transferência"));
        GarmentPassport p=passports.lockById(passportId).orElseThrow(()->ApiException.notFound("Passaporte"));
        PassportTransfer t=transfers.lockById(transferId).orElseThrow(()->ApiException.notFound("Transferência"));
        if(!user.id().equals(t.getRecipientId())) throw ApiException.forbidden("Somente o destinatário pode aceitar.");
        tokenMatches(command.token(),t.getTokenHash());
        // A retry returns the same recipient item, even if that item has subsequently moved again.
        if("ACCEPTED".equals(t.getStatus())) return transferView(t);
        if(t.getVersion()!=command.version()) throw ApiException.conflict("TRANSFER_VERSION_CONFLICT","A transferência mudou.");
        if(!"PENDING".equals(t.getStatus())||!t.getExpiresAt().isAfter(now()))
            throw ApiException.conflict("TRANSFER_UNAVAILABLE","Transferência cancelada ou expirada.");
        if(!t.getId().equals(p.getPendingTransferId())||!t.getFromOwnerId().equals(p.getOwnerId())||!t.getSourcePieceId().equals(p.getPieceId()))
            throw ApiException.conflict("TRANSFER_OWNERSHIP_CONFLICT","A posse da peça mudou.");
        User sender=users.findById(t.getFromOwnerId()).orElseThrow(()->ApiException.notFound("Proprietário"));
        User recipient=users.findById(user.id()).orElseThrow(()->ApiException.notFound("Destinatário"));
        if(sender.getStatus()!=AccountStatus.ACTIVE||recipient.getStatus()!=AccountStatus.ACTIVE||!recipient.isEmailVerified()||guard.blocked(sender.getId(),recipient.getId()))
            throw ApiException.forbidden("As contas precisam estar ativas e elegíveis.");
        WardrobeItem original=pieces.findForSealRequest(p.getPieceId()).orElseThrow(()->ApiException.notFound("Peça"));
        if(!original.getUser().getId().equals(sender.getId())||original.getAvailabilityStatus()==AvailabilityStatus.ARCHIVED)
            throw ApiException.conflict("TRANSFER_PIECE_UNAVAILABLE","A peça não está disponível para transferência.");
        PassportHolding old=holdings.findByActivePassportId(p.getId()).orElseThrow(()->ApiException.conflict("PASSPORT_HOLDING_MISSING","Posse inconsistente."));
        old.setEndedAt(now()); old.setActivePassportId(null); holdings.saveAndFlush(old);
        // Keep the old item and all looks/photos with their historical author. No personal fields or seals follow.
        original.markAvailable(false); original.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);
        original.setForSale(false); original.setForDonation(false); pieces.save(original);
        WardrobeItem next=new WardrobeItem(); next.setUser(recipient); next.setName(original.getName()); next.setCategory(original.getCategory());
        next.setSubcategory(original.getSubcategory()); next.setColor(original.getColor()); next.setMaterial(original.getMaterial());
        next.setBrandName(original.getBrandName()); next.setSizeLabel(original.getSizeLabel()); next.setVisibility(Visibility.PRIVATE);
        next.setCatalogProductId(original.getCatalogProductId()); next.setCatalogVariantId(original.getCatalogVariantId());
        next.setCondition(original.getCondition()); next.setCareInstructions(p.getCare()==null?null:p.getCare().substring(0,Math.min(p.getCare().length(),512))); next.setPieceOrigin("TROCADA");
        next.setRemixedFromPieceId(original.getId()); next.setModerationStatus(ModerationStatus.PENDING);
        if(original.getImageOrigin()==ImageOrigin.CATALOG) {
            next.setImageUrl(original.getImageUrl()); next.setImageOrigin(ImageOrigin.CATALOG);
        } else {
            next.setImageUrl("/_derived/pecas_default/01_parte_superior_01_camiseta_referencia_preview.webp");
            next.setImageOrigin(ImageOrigin.DEFAULT); next.setDefaultImage(true);
        }
        pieces.saveAndFlush(next);
        PassportHolding current=new PassportHolding(); current.setPassportId(p.getId()); current.setActivePassportId(p.getId());
        current.setOwnerId(recipient.getId()); current.setPieceId(next.getId()); current.setStartedAt(now()); holdings.save(current);
        for(PassportShare share:shares.findByPassportId(p.getId())) if(share.getRevokedAt()==null) { share.setRevokedAt(now()); shares.save(share); }
        p.setOwnerId(recipient.getId()); p.setPieceId(next.getId()); p.setPendingTransferId(null); touch(p);
        t.setStatus("ACCEPTED"); t.setAcceptedAt(now()); t.setRecipientPieceId(next.getId()); transfers.saveAndFlush(t);
        PassportEvent e=new PassportEvent(); e.setPassportId(p.getId()); e.setAuthorId(user.id()); e.setKind("TRANSFER");
        e.setOccurredOn(LocalDate.now(clock)); e.setCommandKey("transfer_"+t.getId()); events.save(e);
        return transferView(t);
    }

    public EvidenceView uploadEvidence(CurrentUser user, UUID id, String kind, byte[] bytes, String commandKey) {
        writable(user); GarmentPassport p=locked(user,id); key(commandKey);
        if(kind==null||!Set.of("PURCHASE_RECEIPT","REPAIR_RECEIPT","CARE_LABEL").contains(kind)) throw ApiException.badRequest("PASSPORT_EVIDENCE_KIND","Tipo de comprovante inválido.");
        var existing=evidence.findByPassportIdAndControllerIdAndCommandKey(id,user.id(),commandKey);
        if(existing.isPresent()) {
            if(existing.get().getDeletedAt()!=null) throw ApiException.conflict("EVIDENCE_DELETED","Comprovante removido. Use uma nova chave para reenviar.");
            return evidenceView(existing.get());
        }
        // Decode signatures and dimensions before allocation, re-encode pixels, discard metadata and filenames.
        byte[] png=safeImage(bytes);
        PassportEvidence document=new PassportEvidence(); document.setPassportId(id); document.setControllerId(user.id()); document.setKind(kind);
        document.setContentBase64(Base64.getEncoder().encodeToString(png)); document.setContentHash(hash(Base64.getEncoder().encodeToString(png)));
        document.setCommandKey(commandKey); document.setExpiresAt(now().plus(Duration.ofDays(365)));
        evidence.saveAndFlush(document); touch(p); return evidenceView(document);
    }
    static byte[] safeImage(byte[] bytes) {
        if(bytes==null||bytes.length<8||bytes.length>2*1024*1024) throw ApiException.badRequest("PASSPORT_IMAGE_SIZE","Envie uma imagem PNG ou JPEG de até 2 MB.");
        boolean png=bytes[0]==(byte)137&&bytes[1]==80&&bytes[2]==78&&bytes[3]==71&&bytes[4]==13&&bytes[5]==10&&bytes[6]==26&&bytes[7]==10;
        boolean jpeg=bytes[0]==(byte)255&&bytes[1]==(byte)216&&bytes[2]==(byte)255;
        if(!png&&!jpeg) throw ApiException.badRequest("PASSPORT_IMAGE_TYPE","Somente fotos PNG e JPEG são aceitas.");
        try(ImageInputStream in=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers=ImageIO.getImageReaders(in);
            if(!readers.hasNext()) throw new IllegalArgumentException();
            ImageReader reader=readers.next();
            try {
                reader.setInput(in,true,true); int width=reader.getWidth(0),height=reader.getHeight(0);
                if(width<1||height<1||width>6000||height>6000||(long)width*height>12_000_000) throw new IllegalArgumentException();
                BufferedImage image=reader.read(0);
                ByteArrayOutputStream output=new ByteArrayOutputStream(); ImageIO.write(image,"png",output);
                if(output.size()>8*1024*1024) throw new IllegalArgumentException();
                return output.toByteArray();
            } finally { reader.dispose(); }
        } catch(Exception ex) { throw ApiException.badRequest("PASSPORT_INVALID_IMAGE","Imagem inválida ou dimensões muito grandes."); }
    }
    public List<EvidenceView> myEvidence(CurrentUser user, UUID id) {
        authenticated(user);
        return evidence.findByPassportIdAndControllerId(id,user.id()).stream().filter(e->e.getDeletedAt()==null).map(this::evidenceView).toList();
    }
    public byte[] downloadEvidence(CurrentUser user, UUID evidenceId) {
        authenticated(user); PassportEvidence e=evidence.findById(evidenceId).orElseThrow(()->ApiException.notFound("Comprovante"));
        if(!e.getControllerId().equals(user.id())) throw ApiException.forbidden("Documento privado de outro usuário.");
        if(e.getDeletedAt()!=null||!e.getExpiresAt().isAfter(now())) throw ApiException.notFound("Comprovante");
        return Base64.getDecoder().decode(e.getContentBase64());
    }
    public void deleteEvidence(CurrentUser user, UUID evidenceId) {
        writable(user); PassportEvidence e=evidence.findById(evidenceId).orElseThrow(()->ApiException.notFound("Comprovante"));
        if(!e.getControllerId().equals(user.id())) throw ApiException.forbidden("Documento privado de outro usuário.");
        e.setContentBase64(null); e.setContentHash(null); e.setDeletedAt(now()); evidence.save(e);
    }
    /** Daily job removes expired payloads; request-time expiry is enforced independently of scheduling. */
    @org.springframework.scheduling.annotation.Scheduled(cron="0 25 3 * * *")
    public void purgeExpiredEvidence() {
        for(PassportEvidence e:evidence.findByExpiresAtBeforeAndDeletedAtIsNull(now())) {
            e.setContentBase64(null); e.setContentHash(null); e.setDeletedAt(now()); evidence.save(e);
        }
    }
}
