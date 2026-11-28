-- Os registros de perfil histórico e os vínculos de conteúdo são preservados.
UPDATE users SET profile_type = 'PESSOAL' WHERE profile_type = 'CELEBRIDADE';
