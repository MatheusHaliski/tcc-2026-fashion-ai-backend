@Getter @Setter @NoArgsConstructor
@Entity @Table(name = "colecao")
public class Colecao extends AuditableEntity {
    @Column(nullable = false, unique = true, length = 30) private String codigo;
    @Column(nullable = false, length = 80) private String nome;
}
