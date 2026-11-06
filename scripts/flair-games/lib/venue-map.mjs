// Ambiente fotográfico de cada jogo (nº → id em venues.mjs). A foto vira o cenário do jogo e a miniatura do catálogo.
export const VENUE_BY_GAME = {
  1: "suite-espelho", 2: "closet-luxo", 3: "closet-luxo", 4: "closet-luxo", 5: "lavanderia", 6: "quarto-noite", 7: "corredor-hotel",
  8: "quarto-noite", 9: "quarto-noite", 10: "atelier", 11: "feira", 12: "vitrine", 13: "closet-luxo", 14: "closet-luxo", 15: "quarto-noite",
  16: "corredor-hotel", 17: "redacao", 18: "atelier", 19: "torre-vidro", 20: "corredor-hotel",
  21: "passarela", 22: "parede-imprensa", 23: "auditorio", 24: "backstage", 25: "estudio-foto", 26: "rua-neon", 27: "passarela",
  28: "estudio-foto", 29: "auditorio", 30: "tapete-vermelho", 31: "camarim", 32: "camarim", 33: "passarela", 34: "estudio-foto",
  35: "passarela", 36: "showroom", 37: "showroom", 38: "passarela", 39: "showroom", 40: "backstage",
  41: "metro", 42: "feira", 43: "rooftop", 44: "rua-neon", 45: "serra", 46: "praia", 47: "festival", 48: "rua-neon", 49: "feira",
  50: "aeroporto", 51: "festival", 52: "festival", 53: "serra", 54: "praia", 55: "cinema-ar-livre", 56: "serra", 57: "cidade-historica",
  58: "cidade-historica", 59: "praia", 60: "rua-neon",
  61: "atelier", 62: "atelier", 63: "loja-boutique", 64: "leilao", 65: "cofre", 66: "rua-neon", 67: "showroom", 68: "estudio-foto",
  69: "atelier", 70: "loja-boutique", 71: "showroom", 72: "atelier", 73: "galeria-arte", 74: "loja-boutique", 75: "galeria-arte",
  76: "backstage", 77: "galeria-arte", 78: "redacao", 79: "lavanderia", 80: "showroom",
  81: "suite-espelho", 82: "palco-show", 83: "vitrine", 84: "palco-show", 85: "camarote", 86: "estudio-foto", 87: "galeria-arte",
  88: "palco-show", 89: "salao-gala", 90: "passarela", 91: "camarim", 92: "restaurante", 93: "boate", 94: "loja-boutique",
  95: "closet-luxo", 96: "showroom", 97: "festival", 98: "tapete-vermelho", 99: "torre-vidro", 100: "cofre",
};
export const venueOf = (number) => VENUE_BY_GAME[number] ?? null;
export const photoOf = (number) => (VENUE_BY_GAME[number] ? `/flair/games/scenes/${VENUE_BY_GAME[number]}.webp` : null);
/**
 * Cena com a fotografia do ambiente (venue/photo/credit) sobre o kit 2D, que continua como reserva. Só usa a foto quando
 * ela existe com crédito em `credits` (public/flair/games/scenes/credits.json); senão a cena fica no desenho 2D.
 */
export function withPhoto(game, credits = {}) {
  if (game.scene?.photo) return game.scene;   // já veio com palco (foto e âncoras por jogo)
  const venue = venueOf(game.number);
  const c = venue ? credits[venue] : null;
  if (!c) return { ...game.scene, venue };
  return { ...game.scene, venue, photo: photoOf(game.number), credit: { title: c.title ?? null, creator: c.creator ?? null, license: c.license, source: c.source ?? null } };
}
