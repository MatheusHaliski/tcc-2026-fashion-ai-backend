/**
 * Validação do catálogo FLAIR 3D MAKE UP (desenho §4, R12, R15): cada erro é uma frase com o número do jogo, e todos
 * são devolvidos de uma vez para o agente de dados corrigir a série inteira numa passada. Nada aqui grava arquivo.
 */
import {
  ACCEPT_KEYS, BANDS, DISTRICT_BY_SERIES, EFFECT_KINDS, FICHA_KEYS, GAMES_PER_SERIES, HEX_RE, MAX_GAME_NUMBER, HYPE_DIMS, LANGS, MAX_SLOTS, MIN_SLOTS,
  MODULE_IDS, PARTIAL_MODES, PLAY_MODES, POSITIONS, PROP_KINDS, REWARD_CODE_RE, REWARD_TYPES, SERIES, SLOT_KEY_RE, SLUG_RE, TAG_FIELDS,
  TIERS, TOTAL_GAMES, TYPES, slugPrefix,
} from "./constants.mjs";

const isInt = (v) => Number.isInteger(v);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Chaves `{` e `}` balanceadas (ICU); apóstrofo solto não é erro porque a ficha usa ''. */
export function icuBalanced(text) {
  let depth = 0;
  for (const ch of String(text)) {
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

/** Texto nos três idiomas, cada um string não vazia, ICU balanceado e sem caracteres que viram escape no SQL. */
function checkText(value, where, add) {
  if (!isObj(value)) return add(`${where}: esperado objeto {pt-BR,en,es}`);
  for (const lang of LANGS) {
    const t = value[lang];
    if (typeof t !== "string" || t.trim() === "") add(`${where}.${lang}: texto obrigatório`);
    else if (!icuBalanced(t)) add(`${where}.${lang}: chaves ICU desbalanceadas`);
    else if (/[\\"\n\r\t]/.test(t)) add(`${where}.${lang}: não pode conter barra invertida, aspas duplas nem quebra de linha`);
  }
}

function checkSlots(g, add) {
  const slots = Array.isArray(g.slots) ? g.slots : [];
  if (!Array.isArray(g.slots) || slots.length < MIN_SLOTS || slots.length > MAX_SLOTS) add(`slots: precisa de ${MIN_SLOTS} a ${MAX_SLOTS} vagas`);
  const keys = new Set();
  let mandatory = 0;
  slots.forEach((s, i) => {
    const where = `slots[${i}]`;
    if (!isObj(s)) return add(`${where}: esperado objeto`);
    if (typeof s.key !== "string" || !SLOT_KEY_RE.test(s.key)) add(`${where}.key: use a-z0-9_`);
    else if (keys.has(s.key)) add(`${where}.key: "${s.key}" repetida`);
    keys.add(s.key);
    if (!POSITIONS.includes(s.position)) add(`${where}.position: inválida (${s.position})`);
    if (s.optional !== undefined && typeof s.optional !== "boolean") add(`${where}.optional: boolean`);
    if (s.optional !== true) mandatory += 1;
    if (s.accepts !== undefined && !isObj(s.accepts)) add(`${where}.accepts: esperado objeto`);
    for (const k of Object.keys(s.accepts ?? {})) if (!ACCEPT_KEYS.includes(k)) add(`${where}.accepts.${k}: filtro desconhecido`);
    checkText(s.label, `${where}.label`, add);
    checkText(s.story, `${where}.story`, add);
    for (const lang of LANGS) if (typeof s.story?.[lang] === "string" && !s.story[lang].includes("{name}")) add(`${where}.story.${lang}: falta {name}`);
    if (!isObj(s.effects)) add(`${where}.effects: esperado {comum,metamorfose,impersonation}`);
    else for (const kind of EFFECT_KINDS) checkText(s.effects[kind], `${where}.effects.${kind}`, add);
    if (!isObj(s.bonus) || !isInt(s.bonus.metamorfose) || !isInt(s.bonus.impersonation)) add(`${where}.bonus: {metamorfose:int, impersonation:int}`);
  });
  const deck = isObj(g.deck) ? g.deck : {};
  if (!isInt(deck.minCards) || !isInt(deck.maxCards)) add("deck: minCards e maxCards inteiros");
  else {
    if (deck.maxCards !== slots.length) add(`deck.maxCards (${deck.maxCards}) ≠ nº de vagas (${slots.length})`);
    if (deck.minCards !== mandatory) add(`deck.minCards (${deck.minCards}) ≠ nº de vagas obrigatórias (${mandatory})`);
    if (deck.minCards < 1 || deck.minCards > deck.maxCards) add("deck.minCards: entre 1 e maxCards");
  }
  if (deck.mala !== null && deck.mala !== undefined && !isInt(deck.mala)) add("deck.mala: null ou inteiro");
  return { keys, maxCards: slots.length };
}

function checkRequirements(g, maxCards, add) {
  if (!Array.isArray(g.requirements)) return add("requirements: esperado lista");
  g.requirements.forEach((r, i) => {
    const where = `requirements[${i}]`;
    if (!isObj(r) || !TYPES.includes(r.type)) return add(`${where}: tipo da DSL inválido (${r?.type})`);
    if (r.count !== undefined && (!isInt(r.count) || r.count < 1 || r.count > maxCards)) add(`${where}.count: inteiro entre 1 e ${maxCards}`);
    if (r.type === "tier") {
      const v = r.only ?? r.max ?? r.min;
      if (!TIERS.includes(v)) add(`${where}: tier only/max/min deve ser ${TIERS.join("|")}`);
    }
    if ((r.type === "tag" || r.type === "distinctTags") && !TAG_FIELDS.includes(r.field)) add(`${where}.field: ${TAG_FIELDS.join("|")}`);
    if ((r.type === "tag" || r.type === "brand") && (!Array.isArray(r.anyOf) || r.anyOf.length === 0)) add(`${where}.anyOf: lista não vazia`);
    if (r.type === "hype" && (!HYPE_DIMS.includes(r.dim) || !isInt(r.min))) add(`${where}: hype precisa de dim válida e min inteiro`);
    if (r.type === "hypeBand" && !BANDS.includes(r.min)) add(`${where}.min: faixa de Hype inválida`);
    if (r.type === "hypeBand" && r.scope !== undefined && r.scope !== "all" && r.scope !== "positions") add(`${where}.scope: all|positions`);
    if (r.type === "position" && !POSITIONS.includes(r.position)) add(`${where}.position: inválida`);
    if (r.type === "cards" && (!isInt(r.min) || r.min < 1 || r.min > maxCards)) add(`${where}.min: inteiro entre 1 e ${maxCards}`);
    if (r.type === "mala" && (!isInt(r.max) || r.max < 1)) add(`${where}.max: inteiro ≥ 1`);
    if ((r.type === "ovrAvg" || r.type === "ovrMin" || r.type === "sintonia") && !isInt(r.min)) add(`${where}.min: inteiro`);
    if ((r.type === "sameBrand" || r.type === "distinctBrands") && !isInt(r.count)) add(`${where}.count: inteiro`);
    if (r.type === "origin" && r.only !== "PIECE") add(`${where}.only: PIECE`);
  });
}

function checkHype(g, add) {
  const h = isObj(g.hype) ? g.hype : {};
  for (const k of ["deckMin", "mandatoryMin", "mandatoryMax"]) if (!BANDS.includes(h[k])) add(`hype.${k}: faixa inválida (${h[k]})`);
  if (!isObj(h.play) || !PLAY_MODES.includes(h.play.mode)) add(`hype.play.mode: ${PLAY_MODES.join("|")}`);
  if (!isObj(h.partial) || !PARTIAL_MODES.includes(h.partial.mode)) add(`hype.partial.mode: ${PARTIAL_MODES.join("|")}`);
}

function checkRewards(g, codes, add) {
  if (!Array.isArray(g.rewards)) return add("rewards: esperado lista");
  g.rewards.forEach((r, i) => {
    const where = `rewards[${i}]`;
    if (!isObj(r) || !REWARD_TYPES.includes(r.type)) return add(`${where}.type: ${REWARD_TYPES.join("|")}`);
    if (typeof r.code !== "string" || !REWARD_CODE_RE.test(r.code)) add(`${where}.code: A-Z0-9- com até 40 caracteres`);
    else if (codes.has(r.code)) add(`${where}.code: "${r.code}" repetido no catálogo`);
    else codes.add(r.code);
    if (r.condition !== undefined && r.condition !== "perfect") add(`${where}.condition: só "perfect"`);
    checkText(r.names, `${where}.names`, add);
  });
}

function checkScene(g, keys, add) {
  const sc = isObj(g.scene) ? g.scene : {};
  if (!isObj(g.scene)) return add("scene: esperado objeto");
  if (!Array.isArray(sc.sky) || sc.sky.length !== 2 || !sc.sky.every((c) => HEX_RE.test(c))) add("scene.sky: duas cores #RRGGBB");
  if (!HEX_RE.test(sc.ground)) add("scene.ground: cor #RRGGBB");
  if (!HEX_RE.test(sc.accent)) add("scene.accent: cor #RRGGBB");
  if (typeof sc.horizon !== "number" || sc.horizon < 0 || sc.horizon > 100) add("scene.horizon: número 0..100");
  if (!Array.isArray(sc.props)) add("scene.props: esperado lista");
  (sc.props ?? []).forEach((p, i) => {
    if (!isObj(p) || !PROP_KINDS.includes(p.k)) add(`scene.props[${i}].k: objeto desconhecido (${p?.k})`);
    if (typeof p?.x !== "number" || typeof p?.y !== "number") add(`scene.props[${i}]: x e y numéricos`);
    if (p?.s !== undefined && (typeof p.s !== "number" || p.s < 0.5 || p.s > 2)) add(`scene.props[${i}].s: 0.5..2`);
  });
  if (!isObj(sc.slots)) return add("scene.slots: esperado objeto por vaga");
  for (const k of keys) if (!sc.slots[k]) add(`scene.slots.${k}: faltam as coordenadas da vaga`);
  for (const [k, v] of Object.entries(sc.slots)) {
    if (!keys.has(k)) add(`scene.slots.${k}: vaga inexistente`);
    if (!Array.isArray(v) || v.length < 2 || v.length > 3 || typeof v[0] !== "number" || typeof v[1] !== "number") add(`scene.slots.${k}: [x%, y%, moduleId?]`);
    else if (v.length === 3 && (g.series !== "A" || !MODULE_IDS.has(v[2]))) add(`scene.slots.${k}: moduleId só na série A e entre os módulos do quarto`);
  }
}

/** Valida um jogo; `ctx` guarda o que é único no catálogo inteiro (slugs, números, códigos de recompensa). */
export function validateGame(g, ctx) {
  const errors = [];
  const label = isObj(g) && isInt(g.number) ? `jogo ${g.number}` : `jogo ? (${ctx.file ?? "?"})`;
  const add = (m) => errors.push(`${label}: ${m}`);
  if (!isObj(g)) return [`${label}: esperado objeto`];
  if (!isInt(g.number) || g.number < 1 || g.number > MAX_GAME_NUMBER) add(`number: inteiro 1..${MAX_GAME_NUMBER}`);
  else if (ctx.numbers.has(g.number)) add("number: repetido no catálogo");
  ctx.numbers.add(g.number);
  if (!SERIES.includes(g.series)) add(`series: ${SERIES.join("|")}`);
  else if (g.district !== DISTRICT_BY_SERIES[g.series]) add(`district: série ${g.series} é ${DISTRICT_BY_SERIES[g.series]}`);
  if (typeof g.slug !== "string" || !SLUG_RE.test(g.slug) || !g.slug.startsWith(slugPrefix(g.series, g.number))) add(`slug: padrão "${slugPrefix(g.series, g.number)}<nome>"`);
  else if (ctx.slugs.has(g.slug)) add(`slug: "${g.slug}" repetido ou reservado pela V56`);
  if (typeof g.slug === "string") ctx.slugs.add(g.slug);
  checkText(g.names, "names", add);
  checkText(g.descriptions, "descriptions", add);
  if (!isInt(g.points) || g.points < 0 || g.points > 200) add("points: inteiro 0..200");
  if (!isInt(g.repeatLimit) || g.repeatLimit < 1) add("repeatLimit: inteiro ≥ 1");
  if (g.adapted !== undefined && typeof g.adapted !== "boolean") add("adapted: boolean");
  if (!Array.isArray(g.themeTags) || g.themeTags.length === 0 || !g.themeTags.every((t) => typeof t === "string" && /^[a-z][a-z0-9-]*$/.test(t))) {
    add("themeTags: lista não vazia de tags minúsculas");
  }
  const { keys, maxCards } = checkSlots(g, add);
  checkRequirements(g, maxCards, add);
  checkHype(g, add);
  checkRewards(g, ctx.rewardCodes, add);
  if (!isObj(g.ficha)) add("ficha: esperado objeto com 7 textos");
  else for (const k of FICHA_KEYS) checkText(g.ficha[k], `ficha.${k}`, add);
  checkScene(g, keys, add);
  return errors;
}

/**
 * Valida o catálogo inteiro. `files` = [{file, series, games}], `reservedSlugs` = os da V56. Sem `allowPartial`
 * exige GAMES_PER_SERIES jogos por série e TOTAL_GAMES no total (hoje 1 e 5).
 */
export function validateCatalog(files, { reservedSlugs = [], allowPartial = false } = {}) {
  const ctx = { numbers: new Set(), slugs: new Set(reservedSlugs), rewardCodes: new Set() };
  const errors = [];
  let total = 0;
  for (const f of files) {
    ctx.file = f.file;
    if (!Array.isArray(f.games)) {
      errors.push(`${f.file}: esperado um array JSON de jogos`);
      continue;
    }
    total += f.games.length;
    if (!allowPartial && f.games.length !== GAMES_PER_SERIES) errors.push(`${f.file}: ${f.games.length} jogos (esperados ${GAMES_PER_SERIES})`);
    for (const g of f.games) {
      if (isObj(g) && f.series && g.series !== f.series) errors.push(`jogo ${g.number}: series ${g.series} no arquivo da série ${f.series}`);
      errors.push(...validateGame(g, ctx));
    }
  }
  if (!allowPartial && total !== TOTAL_GAMES) errors.push(`catálogo: ${total} jogos (esperados ${TOTAL_GAMES}); use --allow-partial para gerar parcial`);
  return errors;
}

/** Slugs já usados pela V56 (16 desafios), lidos do próprio arquivo da migração. */
export function reservedSlugsFrom(sqlText) {
  const block = sqlText.split("INSERT INTO flair_challenges")[1] ?? "";
  return [...block.matchAll(/^\('7c[0-9a-f-]+',\s*'([a-z0-9-]+)'/gm)].map((m) => m[1]);
}
