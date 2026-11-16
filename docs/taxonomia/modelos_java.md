# ☕ Modelos Java Essenciais - FashionAI

## Índice
1. [Padrões de Classe Java](#padroes)
2. [Entidades JPA](#jpa)
3. [Records e Value Objects](#records)
4. [Interfaces e Contratos](#interfaces)
5. [Enums do Projeto](#enums)
6. [Argumentos e Parâmetros](#argumentos)
7. [Anotações Spring](#anotacoes)
8. [Exemplo Prático Completo](#exemplo)

---

## Padrões de Classe Java {#padroes}

### 1. Classe Tradicional (Bean)
```java
public class User {
    // Atributos (campos privados)
    private UUID id;
    private String username;
    private String email;
    
    // Construtor padrão (sem argumentos)
    public User() {
        this.id = UUID.randomUUID();
    }
    
    // Construtor com argumentos
    public User(String username, String email) {
        this.id = UUID.randomUUID();
        this.username = username;
        this.email = email;
    }
    
    // Getters (acessar valor)
    public UUID getId() {
        return id;
    }
    
    public String getUsername() {
        return username;
    }
    
    // Setters (modificar valor)
    public void setUsername(String username) {
        this.username = username;
    }
    
    // toString, equals, hashCode
    @Override
    public String toString() {
        return "User{" +
            "id=" + id +
            ", username='" + username + '\'' +
            ", email='" + email + '\'' +
            '}';
    }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        User user = (User) o;
        return Objects.equals(id, user.id);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
```

### 2. Record (Java 16+) - Imutável
```java
// Record: automático gera getters, toString, equals, hashCode
public record User(UUID id, String username, String email) {
    // Compact constructor: validação antes de atribuir
    public User {
        Objects.requireNonNull(id, "id cannot be null");
        Objects.requireNonNull(username, "username cannot be blank");
        if (username.isBlank()) throw new IllegalArgumentException("username cannot be blank");
    }
}

// Uso:
User user = new User(UUID.randomUUID(), "john_doe", "john@example.com");
System.out.println(user.username()); // Getter é método, não propriedade
System.out.println(user); // toString() automático
```

### 3. Classe Abstrata (Template)
```java
public abstract class AuditableEntity {
    @Id
    protected UUID id;
    
    protected LocalDateTime createdAt;
    protected LocalDateTime updatedAt;
    protected String createdBy;
    protected String updatedBy;
    
    // Construtor protegido (só subclasses acessam)
    protected AuditableEntity() {
        this.id = UUID.randomUUID();
        this.createdAt = LocalDateTime.now();
    }
    
    // Método abstrato (subclass deve implementar)
    public abstract String getDisplayName();
    
    // Método concreto (pode usar em subclasses)
    public final void assignId(UUID id) {
        this.id = id;
    }
}

// Subclass implementa classe abstrata
public class WardrobeItem extends AuditableEntity {
    private String name;
    private String category;
    
    @Override
    public String getDisplayName() {
        return name;
    }
}
```

### 4. Interface (Contrato)
```java
public interface Repository<T, ID> {
    T findById(ID id);
    List<T> findAll();
    void save(T entity);
    void delete(T entity);
}

// Implementação
public class UserRepository implements Repository<User, UUID> {
    @Override
    public User findById(UUID id) {
        // implementação
        return null;
    }
    
    @Override
    public List<User> findAll() {
        // implementação
        return new ArrayList<>();
    }
    
    @Override
    public void save(User entity) {
        // implementação
    }
    
    @Override
    public void delete(User entity) {
        // implementação
    }
}
```

### 5. Enum (Valores Fixos)
```java
public enum ProfileType {
    PESSOAL("Pessoal", "Perfil pessoal"),
    MARCA("Marca", "Perfil de marca"),
    INFLUENCER("Influencer", "Perfil de influenciador");
    
    private final String label;
    private final String description;
    
    ProfileType(String label, String description) {
        this.label = label;
        this.description = description;
    }
    
    public String getLabel() {
        return label;
    }
}

// Uso:
User user = new User();
user.setProfileType(ProfileType.PESSOAL);
```

---

## Entidades JPA {#jpa}

### Estrutura Completa de Entidade

```java
@Entity
@Table(name = "wardrobe_items", indexes = {
    @Index(name = "idx_user_id", columnList = "user_id"),
    @Index(name = "idx_category", columnList = "category")
})
public class WardrobeItem extends AuditableEntity {
    
    // ===== ATRIBUTOS SIMPLES =====
    
    @Id  // Primary Key
    private UUID id;
    
    @Column(name = "name", nullable = false, length = 255)
    private String name;
    
    @Column(name = "category", nullable = false, length = 100)
    private String category;
    
    @Column(name = "subcategory", length = 100)
    private String subcategory;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "visibility")
    private Visibility visibility;
    
    @Column(name = "material", length = 100)
    private String material;
    
    @Column(name = "variation")
    private String variation;  // MOM, WIDE_LEG, etc
    
    @Column(columnDefinition = "DECIMAL(10,2)")
    private BigDecimal price;
    
    @Column(name = "moderation_status")
    @Enumerated(EnumType.STRING)
    private ModerationStatus moderationStatus;
    
    // ===== RELACIONAMENTOS =====
    
    // Many-to-One: muitas peças para um usuário
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    
    // One-to-Many: uma peça pode ter muitas fotos
    @OneToMany(mappedBy = "wardrobeItem", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Photo> photos = new ArrayList<>();
    
    // Many-to-One: origem é opcional
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "origem_id")
    private Origem origem;
    
    // One-to-Many: atributos de taxonomia
    @OneToMany(mappedBy = "wardrobeItem", cascade = CascadeType.ALL)
    private List<TaxonomyAttribute> attributes = new ArrayList<>();
    
    // ===== CONSTRUTORES =====
    
    public WardrobeItem() {
        super();  // Chama construtor da classe pai
    }
    
    public WardrobeItem(User user, String name, String category) {
        super();
        this.user = user;
        this.name = name;
        this.category = category;
    }
    
    // ===== GETTERS E SETTERS =====
    
    public UUID getId() {
        return id;
    }
    
    public String getName() {
        return name;
    }
    
    public void setName(String name) {
        this.name = name;
    }
    
    public User getUser() {
        return user;
    }
    
    public void setUser(User user) {
        this.user = user;
    }
    
    public List<Photo> getPhotos() {
        return photos;
    }
    
    public void addPhoto(Photo photo) {
        this.photos.add(photo);
        photo.setWardrobeItem(this);
    }
    
    public Origem getOrigem() {
        return origem;
    }
    
    public void setOrigem(Origem origem) {
        this.origem = origem;
    }
    
    // ===== MÉTODOS DE NEGÓCIO =====
    
    public boolean hasPhotos() {
        return !photos.isEmpty();
    }
    
    public Photo getMainPhoto() {
        return photos.isEmpty() ? null : photos.get(0);
    }
    
    public boolean canBeDeletedBy(User currentUser) {
        return this.user.equals(currentUser) && 
               this.visibility == Visibility.PRIVATE;
    }
    
    // ===== toString, equals, hashCode =====
    
    @Override
    public String toString() {
        return "WardrobeItem{" +
            "id=" + id +
            ", name='" + name + '\'' +
            ", category='" + category + '\'' +
            ", userId=" + (user != null ? user.getId() : null) +
            '}';
    }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof WardrobeItem)) return false;
        WardrobeItem that = (WardrobeItem) o;
        return Objects.equals(id, that.id);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
```

### Anotações JPA Essenciais

| Anotação | Uso |
|----------|-----|
| `@Entity` | Marca classe como entidade JPA |
| `@Table` | Define nome da tabela no BD |
| `@Id` | Primary Key |
| `@GeneratedValue` | Auto-incremento (quando usável) |
| `@Column` | Define propriedades da coluna |
| `@ManyToOne` | Muitos para um |
| `@OneToMany` | Um para muitos |
| `@ManyToMany` | Muitos para muitos |
| `@JoinColumn` | Define coluna de FK |
| `@Enumerated` | Persiste enum como STRING ou ORDINAL |
| `@Temporal` | Define tipo de data (DATE, TIME, TIMESTAMP) |
| `@Transient` | Campo não persistido |
| `@Lazy` / `@Eager` | Estratégia de carregamento |
| `@CascadeType` | Propaga ações (ALL, PERSIST, MERGE, etc) |

---

## Records e Value Objects {#records}

### Record (Java 16+)
```java
// Simples, imutável, automático getters/toString/equals/hashCode
public record PieceForm(
    UUID draftId,
    String name,
    String category,
    String subcategory,
    String material,
    String variation,
    Map<String, List<String>> attributes
) {
    // Compact constructor: validação
    public PieceForm {
        Objects.requireNonNull(name, "name cannot be null");
        if (name.isBlank()) {
            throw new IllegalArgumentException("name cannot be blank");
        }
    }
    
    // Método adicional (é permitido)
    public boolean hasVariation() {
        return variation != null && !variation.isBlank();
    }
}

// Uso:
PieceForm form = new PieceForm(
    UUID.randomUUID(),
    "Jeans",
    "lower_piece",
    "jeans",
    "DENIM",
    "MOM",
    Map.of("RISE", List.of("HIGH_RISE"))
);

System.out.println(form.name()); // Getter é método com ()
System.out.println(form.hasVariation()); // true
```

### Nested Record (Record dentro de Record)
```java
public record LookWithPieces(
    UUID lookId,
    String lookName,
    List<PieceInfo> pieces
) {
    public record PieceInfo(
        UUID pieceId,
        String pieceName,
        String category
    ) {}
}

// Uso:
LookWithPieces look = new LookWithPieces(
    UUID.randomUUID(),
    "Casual Friday",
    List.of(
        new LookWithPieces.PieceInfo(UUID.randomUUID(), "Jeans", "lower_piece"),
        new LookWithPieces.PieceInfo(UUID.randomUUID(), "Camiseta", "upper_piece")
    )
);
```

### Value Object (Imutável, sem ID)
```java
public final class Money {
    private final BigDecimal amount;
    private final String currency;
    
    public Money(BigDecimal amount, String currency) {
        if (amount.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("amount cannot be negative");
        }
        this.amount = amount;
        this.currency = currency;
    }
    
    public Money add(Money other) {
        return new Money(amount.add(other.amount), currency);
    }
    
    public Money multiply(int factor) {
        return new Money(amount.multiply(new BigDecimal(factor)), currency);
    }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Money)) return false;
        Money money = (Money) o;
        return Objects.equals(amount, money.amount) &&
               Objects.equals(currency, money.currency);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(amount, currency);
    }
    
    @Override
    public String toString() {
        return amount + " " + currency;
    }
}

// Uso:
Money price1 = new Money(new BigDecimal("100.00"), "BRL");
Money price2 = new Money(new BigDecimal("50.00"), "BRL");
Money total = price1.add(price2);  // Retorna novo objeto
```

---

## Interfaces e Contratos {#interfaces}

### Interface Simples
```java
public interface PhotoService {
    Photo uploadPhoto(File file, UUID wardrobeItemId);
    void deletePhoto(UUID photoId);
    List<Photo> getPhotosByPiece(UUID wardrobeItemId);
}

// Implementação
@Service
public class PhotoServiceImpl implements PhotoService {
    @Override
    public Photo uploadPhoto(File file, UUID wardrobeItemId) {
        // implementação
        return null;
    }
    
    @Override
    public void deletePhoto(UUID photoId) {
        // implementação
    }
    
    @Override
    public List<Photo> getPhotosByPiece(UUID wardrobeItemId) {
        // implementação
        return new ArrayList<>();
    }
}
```

### Interface com Genéricos
```java
public interface Repository<T, ID> {
    Optional<T> findById(ID id);
    List<T> findAll();
    T save(T entity);
    void delete(T entity);
}

// Implementação específica
@Repository
public class UserRepository implements Repository<User, UUID> {
    private final EntityManager em;
    
    @Override
    public Optional<User> findById(UUID id) {
        return Optional.ofNullable(em.find(User.class, id));
    }
    
    @Override
    public List<User> findAll() {
        return em.createQuery("SELECT u FROM User u", User.class).getResultList();
    }
    
    @Override
    public User save(User entity) {
        return em.merge(entity);
    }
    
    @Override
    public void delete(User entity) {
        em.remove(em.merge(entity));
    }
}
```

### Interface com Callback (Padrão Observer)
```java
public interface TaxonomyChangeListener {
    void onTaxonomyChanged(WardrobeItem item, String oldCategory, String newCategory);
}

// Implementação
public class AuditLogger implements TaxonomyChangeListener {
    @Override
    public void onTaxonomyChanged(WardrobeItem item, String oldCategory, String newCategory) {
        System.out.println("Categoria mudou de " + oldCategory + " para " + newCategory);
    }
}

// Uso
List<TaxonomyChangeListener> listeners = new ArrayList<>();
listeners.add(new AuditLogger());

void updatePieceCategory(WardrobeItem item, String newCategory) {
    String oldCategory = item.getCategory();
    item.setCategory(newCategory);
    
    // Notifica listeners
    listeners.forEach(l -> l.onTaxonomyChanged(item, oldCategory, newCategory));
}
```

---

## Enums do Projeto {#enums}

### Enum Simples
```java
public enum ProfileType {
    PESSOAL,
    MARCA,
    INFLUENCER
}

// Uso:
user.setProfileType(ProfileType.PESSOAL);
if (user.getProfileType() == ProfileType.MARCA) {
    // is a brand
}
```

### Enum com Propriedades
```java
public enum Visibility {
    PRIVATE("Privado", "Apenas você vê"),
    FRIENDS("Amigos", "Apenas seus amigos veem"),
    PUBLIC("Público", "Todos veem");
    
    private final String label;
    private final String description;
    
    Visibility(String label, String description) {
        this.label = label;
        this.description = description;
    }
    
    public String getLabel() {
        return label;
    }
    
    public String getDescription() {
        return description;
    }
}

// Uso:
System.out.println(Visibility.PRIVATE.getLabel()); // "Privado"
```

### Enum com Métodos
```java
public enum ItemCondition {
    NOVO {
        @Override
        public boolean canBeWorn() {
            return true;
        }
        
        @Override
        public int getDiscountPercent() {
            return 0;
        }
    },
    COMO_NOVO {
        @Override
        public boolean canBeWorn() {
            return true;
        }
        
        @Override
        public int getDiscountPercent() {
            return 10;
        }
    },
    USADO {
        @Override
        public boolean canBeWorn() {
            return true;
        }
        
        @Override
        public int getDiscountPercent() {
            return 30;
        }
    },
    DANIFICADO {
        @Override
        public boolean canBeWorn() {
            return false;
        }
        
        @Override
        public int getDiscountPercent() {
            return 70;
        }
    };
    
    public abstract boolean canBeWorn();
    public abstract int getDiscountPercent();
}

// Uso:
ItemCondition condition = ItemCondition.COMO_NOVO;
if (condition.canBeWorn()) {
    System.out.println("Pode usar! Desconto: " + condition.getDiscountPercent() + "%");
}
```

---

## Argumentos e Parâmetros {#argumentos}

### Argumentos Primitivos
```java
void updatePrice(BigDecimal price) {
    // 'price' é um argumento
}

void setVisibility(Visibility visibility) {
    // 'visibility' é um argumento
}
```

### Argumentos com Anotações Spring
```java
@PostMapping
public PieceView createPiece(
    @RequestBody WardrobeService.PieceForm form,  // Do corpo JSON
    @PathVariable UUID id,                        // Da URL
    @RequestParam String category,                // Query string
    @RequestHeader String authorization,         // Header HTTP
    @CurrentUser User user                        // Custom (Spring Security)
) {
    // implementação
}

// Exemplos de URL:
// POST /api/wardrobe
// URL: POST /api/wardrobe/550e8400-e29b-41d4-a716-446655440000?category=jeans
// Header: Authorization: Bearer token123
```

### Argumentos com Valores Padrão
```java
@PostMapping
public List<PieceView> getPieces(
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "10") int pageSize,
    @RequestParam(required = false) String category  // Opcional
) {
    // implementação
}

// Exemplos:
// GET /api/wardrobe              → page=0, pageSize=10, category=null
// GET /api/wardrobe?page=1       → page=1, pageSize=10, category=null
// GET /api/wardrobe?category=jeans → page=0, pageSize=10, category=jeans
```

### Varargs (Número Variável de Argumentos)
```java
public void tagPiece(UUID pieceId, String... tags) {
    // 'tags' é um array de String
    for (String tag : tags) {
        // processar tag
    }
}

// Uso:
tagPiece(uuid, "casual", "streetwear", "verão");
```

### Argumentos com Builder Pattern
```java
public class PieceBuilder {
    private UUID id;
    private String name;
    private String category;
    private String material;
    
    public PieceBuilder withId(UUID id) {
        this.id = id;
        return this;
    }
    
    public PieceBuilder withName(String name) {
        this.name = name;
        return this;
    }
    
    public PieceBuilder withCategory(String category) {
        this.category = category;
        return this;
    }
    
    public PieceBuilder withMaterial(String material) {
        this.material = material;
        return this;
    }
    
    public WardrobeItem build() {
        WardrobeItem piece = new WardrobeItem();
        piece.setId(id != null ? id : UUID.randomUUID());
        piece.setName(name);
        piece.setCategory(category);
        piece.setMaterial(material);
        return piece;
    }
}

// Uso: fluente e legível
WardrobeItem piece = new PieceBuilder()
    .withName("Jeans Azul")
    .withCategory("lower_piece")
    .withMaterial("DENIM")
    .build();
```

---

## Anotações Spring {#anotacoes}

### Spring Core
| Anotação | Uso |
|----------|-----|
| `@SpringBootApplication` | Entry point da aplicação |
| `@Configuration` | Classe de configuração |
| `@Bean` | Método que produz bean |
| `@Service` | Service (lógica de negócio) |
| `@Repository` | Repositório (acesso dados) |
| `@Component` | Componente genérico |
| `@Autowired` | Injeção de dependência |
| `@Value` | Injeta propriedade |

### Spring MVC
| Anotação | Uso |
|----------|-----|
| `@RestController` | Controller que retorna JSON |
| `@GetMapping` | Método GET |
| `@PostMapping` | Método POST |
| `@PutMapping` | Método PUT |
| `@DeleteMapping` | Método DELETE |
| `@RequestBody` | Corpo JSON → Objeto |
| `@PathVariable` | Variável na URL |
| `@RequestParam` | Query string |
| `@ResponseStatus` | Status HTTP de resposta |

### Spring Data JPA
| Anotação | Uso |
|----------|-----|
| `@Entity` | Entidade JPA |
| `@Table` | Nome da tabela |
| `@Id` | Primary Key |
| `@ManyToOne` | Relacionamento N-1 |
| `@OneToMany` | Relacionamento 1-N |
| `@ManyToMany` | Relacionamento N-N |
| `@Column` | Propriedades da coluna |
| `@JoinColumn` | Coluna de FK |
| `@Transactional` | Transação do BD |

### Spring Security
| Anotação | Uso |
|----------|-----|
| `@EnableWebSecurity` | Ativa segurança web |
| `@PreAuthorize` | Verifica permissão antes |
| `@PostAuthorize` | Verifica permissão depois |
| `@Secured` | Verifica role |
| `@CurrentUser` | Injeta usuário logado (custom) |

---

## Exemplo Prático Completo {#exemplo}

### Scenario: Criar Peça com Origem

#### 1. Entidade (fai-domain)
```java
@Entity
@Table(name = "wardrobe_items")
public class WardrobeItem extends AuditableEntity {
    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;
    
    private String name;
    private String category;
    private String material;
    
    @ManyToOne
    @JoinColumn(name = "origem_id")
    private Origem origem;
    
    // Getters e setters...
}

@Entity
@Table(name = "origens")
public class Origem {
    @Id
    private UUID id;
    
    private String name;  // "Loja", "Presente", etc
    private String description;
    
    // Getters e setters...
}
```

#### 2. Record de Entrada (fai-application)
```java
public record PieceForm(
    String name,
    String category,
    String material,
    UUID origemId  // NOVO CAMPO
) {}
```

#### 3. Service (fai-application)
```java
@Service
public class WardrobeService {
    
    private final WardrobeItemRepository wardrobeRepository;
    private final OrigemRepository origemRepository;
    
    @Autowired
    public WardrobeService(WardrobeItemRepository wardrobeRepository,
                          OrigemRepository origemRepository) {
        this.wardrobeRepository = wardrobeRepository;
        this.origemRepository = origemRepository;
    }
    
    @Transactional
    public void createPiece(PieceForm form, CurrentUser user) {
        WardrobeItem piece = new WardrobeItem();
        piece.setUser(user.getEntity());
        piece.setName(form.name());
        piece.setCategory(form.category());
        piece.setMaterial(form.material());
        
        // Buscar origem se fornecida
        if (form.origemId() != null) {
            Origem origem = origemRepository.findById(form.origemId())
                .orElseThrow(() -> new IllegalArgumentException("Origem not found"));
            piece.setOrigem(origem);
        }
        
        wardrobeRepository.save(piece);
    }
}
```

#### 4. View (fai-application)
```java
public record PieceView(
    UUID id,
    String name,
    String category,
    String material,
    UUID origemId,
    String origemName
) {}

public static PieceView piece(WardrobeItem item) {
    return new PieceView(
        item.getId(),
        item.getName(),
        item.getCategory(),
        item.getMaterial(),
        item.getOrigem() != null ? item.getOrigem().getId() : null,
        item.getOrigem() != null ? item.getOrigem().getName() : null
    );
}
```

#### 5. Controller (fai-web)
```java
@RestController
@RequestMapping("/api/wardrobe")
public class WardrobeController {
    
    private final WardrobeService wardrobeService;
    
    @Autowired
    public WardrobeController(WardrobeService wardrobeService) {
        this.wardrobeService = wardrobeService;
    }
    
    @PostMapping
    public PieceView createPiece(
        @RequestBody PieceForm form,
        @CurrentUser User user
    ) {
        wardrobeService.createPiece(form, new CurrentUser(user));
        // Buscar e retornar piece criada
        return Views.piece(createdPiece);
    }
}
```

#### 6. Request HTTP
```http
POST /api/wardrobe
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "name": "Jeans Azul",
  "category": "lower_piece",
  "material": "DENIM",
  "origemId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### 7. Response HTTP
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440111",
  "name": "Jeans Azul",
  "category": "lower_piece",
  "material": "DENIM",
  "origemId": "550e8400-e29b-41d4-a716-446655440000",
  "origemName": "Loja"
}
```

---

## Dicas de Estudo

### ✅ FAÇA
- Leia código-fonte existente (learn by example)
- Estude um arquivo por vez (não tudo de uma vez)
- Execute testes (`PieceTaxonomyTest.java`)
- Trace request completo (HTTP → Controller → Service → Repository)

### ❌ NÃO FAÇA
- Não memorize sintaxe (use IDE com autocomplete)
- Não copie-cole sem entender
- Não ignore mensagens de erro do compilador
- Não ignore anotações (elas controlam comportamento)

---

**Última atualização:** 2026-11-15
**Status:** ✅ Pronto para uso
