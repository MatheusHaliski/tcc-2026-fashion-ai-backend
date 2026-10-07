"""Amostra das Regras de Enquadramento (§9.1): fotos oficiais do acervo por parte da regra (semente 11, 1 produto por marca por parte)."""
import sys, json, random, collections, gzip, glob
S = sys.argv[1]
MULT = int(sys.argv[2]) if len(sys.argv) > 2 else 1
PARTS = [  # (parte da regra, categoria, subcategorias, quantidade)
    ('1-2 parte de cima', 'upper_piece', ['t_shirt', 'shirt', 'polo_shirt', 'hoodie', 'sweatshirt'], 6),
    ('3 parte de baixo', 'lower_piece', ['jeans', 'casual_pants', 'shorts', 'chino_pants', 'skirt'], 6),
    ('4 calçado', 'shoes_piece', ['casual_sneakers', 'running_shoes', 'training_shoes', 'sandals', 'loafers'], 5),
    ('5a óculos', 'accessory_piece', ['sunglasses', 'eyeglasses'], 3),
    ('5b relógio', 'accessory_piece', ['watch'], 3),
    ('5c joias', 'accessory_piece', ['bracelet', 'earrings', 'ring', 'necklace'], 8),
    ('5d gorro', 'accessory_piece', ['beanie'], 3),
    ('5e cachecol', 'accessory_piece', ['scarf'], 3),
    ('5f cinto', 'accessory_piece', ['belt'], 3),
]
rows = [json.loads(l) for f in glob.glob('data/catalog/acervo/*.jsonl.gz') for l in gzip.open(f, 'rt')]
random.seed(11)
random.shuffle(rows)
sample = []
for part, cat, subs, n in PARTS:
    brands, per_sub = collections.Counter(), collections.Counter()
    n *= MULT
    cap = max(1, -(-n // len(subs)))
    for d in rows:
        s = d.get('subcategory')
        if s not in subs or not d.get('images') or brands[d["brand"]] >= MULT or per_sub[s] >= cap:
            continue
        brands[d['brand']] += 1; per_sub[s] += 1
        sample.append({'id': len(sample), 'part': part, 'brand': d['brand'], 'name': d['product_name'], 'category': cat,
                       'subcategory': s, 'url': d['images'][0]['url'], 'type': d['images'][0].get('type')})
        if sum(1 for x in sample if x['part'] == part) >= n:
            break
json.dump(sample, open(f'{S}/sample.json', 'w'), ensure_ascii=False, indent=1)
print(len(sample), dict(collections.Counter(s['part'] for s in sample)))
