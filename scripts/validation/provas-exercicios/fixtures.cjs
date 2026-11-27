/* Dados simulados compartilhados pelas provas (formatos de PieceView, SchemeView e taxonomia da API real). */
const ANA = { id: 'u1', username: 'ana', displayName: 'Ana Souza', profileType: 'PESSOAL', verified: true, privateAccount: false, country: 'BR' };

const TAX = {
  subcategories: { upper_piece: ['t_shirt', 'blazer'], lower_piece: ['jeans'], shoes_piece: ['casual_sneakers'], full_body_piece: ['dress'] },
  colors: { black: '#12100F', blue: '#2A5FA8', white: '#FFFFFF', red: '#C62B28', gray: '#8A8D91' },
  colorFamilies: { blue: 'Azul', red: 'Vermelho', black: 'Preto', white: 'Branco', gray: 'Cinza' },
  materials: ['COTTON', 'WOOL'], sizes: ['p', 'm', 'g'], sexes: ['MASCULINO', 'FEMININO', 'UNISSEX'],
  occasions: ['casual', 'work'], styles: ['basic', 'tailoring'], allowedOccasionsByCategory: {}, brands: [],
};

const COUNTERS = { likes: 0, comments: 0, shares: 0, remixes: 0, views: 0, saves: 0, reactions: {} };
const VIEWER = { liked: false, reactions: [], saved: false, canEdit: true, following: false };

function piece(id, name, category, subcategory, color, extra = {}) {
  return {
    id, owner: ANA, name, category, subcategory, sex: 'UNISSEX', brandName: 'Atelier Lumi', color,
    colorHex: TAX.colors[color], material: 'COTTON', size: 'm', style: ['basic'], occasion: ['casual'], seals: [],
    price: 0, imageUrl: null, thumbnailUrl: null, defaultImage: true, visibility: 'PRIVATE', disponivel: true,
    availabilityStatus: 'AVAILABLE', favorite: false, forSale: false, wearCount: 0, tags: [], counters: COUNTERS,
    viewer: VIEWER, createdAt: '2026-11-20T12:00:00Z', updatedAt: '2026-11-20T12:00:00Z', ...extra,
  };
}

function scheme(id, title, items, extra = {}) {
  return {
    id, owner: ANA, title, description: null, creationMode: 'MANUAL', origin: 'CRIAR_LOOK', style: ['basic'],
    occasion: ['casual'], season: null, visibility: 'PRIVATE', status: 'ACTIVE', disponivel: true, lookDoDia: false,
    items: items.map((p, i) => ({ id: `${id}-i${i}`, wardrobeItemId: p.id, slot: p.category, sortOrder: i, piece: p })), totalPrice: null, seals: [],
    sealBadges: [], tags: [], revalidationPending: false, counters: COUNTERS, viewer: VIEWER,
    createdAt: '2026-11-27T12:00:00Z', updatedAt: '2026-11-27T12:00:00Z', ...extra,
  };
}

const page = (items) => ({ items, page: 0, size: 12, total: items.length, hasMore: false });

module.exports = { ANA, TAX, piece, scheme, page };
