# Comandos estáticos de edição do Atelier

Problema: operações como centralizar, apoiar e deformar vértices não devem ficar misturadas ao componente React nem mutar a geometria do renderer antes de existir um documento editado válido.

`SceneCommand` representa solicitações tipadas; `executeSceneCommand` valida/altera um documento de modo imutável. O painel é o invocador; o histórico existente guarda snapshots locais e o servidor continua autorizado a aceitar ou rejeitar a versão.

Decisão: representação simples de **Command**, com union discriminada e executor; sem uma classe por botão. O histórico de snapshots já existente oferece o comportamento de Memento local. Não é um log distribuído de operações nem um protocolo de merge colaborativo. O backend e o formato público do documento foram preservados.

Transformações/bounds, deformação estática e UI são responsabilidades distintas. Não se adicionou uma abstrata hierarquia de plugins ou um motor Blender disfarçado. Mirror/topologia não foram simulados por escala negativa ou reflexão de vértices com winding incorreto.
