-- RF41 · FAI Points em todos os jogos e criações. Até aqui o FLAIR pagava só FLAIR Coins, e os desafios só pagavam
-- ao concluir. Agora qualquer partida (duelo, arena, os 15 modos, times, desafios) lança FAI Points pela mesma
-- ponte (FaiPointsService.game): jogar pontua, vencer pontua de novo, e as quests do FLAIR também. Referência
-- jogo:partida = 1× por partida; o teto diário segura o farm sem impedir de jogar (RF35.CA02).
-- Teto diário somado dos jogos: 6×5 + 4×10 + 3×10 = 100 pts, na mesma ordem de grandeza de criar esquemas (5×40).
INSERT INTO fai_points_rules (action_code, points, daily_cap, weekly_cap, once_per_ref, description) VALUES
('GAME_PLAYED',5,6,NULL,TRUE,'Jogar uma partida (FLAIR, arena, times, modos, desafio)'),
('GAME_WON',10,4,NULL,TRUE,'Vencer uma partida'),
('FLAIR_QUEST',10,3,NULL,TRUE,'Concluir uma quest do FLAIR');

-- O texto antigo citava o nome interno da métrica; a tela de pontos mostra a descrição quando não há tradução.
UPDATE fai_points_rules SET description = 'Cadastrar peça com foto real e dados básicos (completude >= 60%)'
 WHERE action_code = 'PIECE_CATALOGED';
