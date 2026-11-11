public interface ColecaoRepository extends JpaRepository<Colecao, UUID> {
    List<Colecao> findAllByOrderByNomeAsc();
}
