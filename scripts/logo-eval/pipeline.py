"""
Pipeline de logo e marca da peça (RF4), versão local de referência.

Por que existe: a análise atual manda à IA a peça inteira reduzida a 768 px. Um logo pequeno (jacaré da Lacoste,
swoosh de 3 cm no peito, etiqueta) vira poucos pixels e some. Aqui a foto é olhada em pedaços ampliados, por dois
reconhecedores diferentes, e o resultado nunca é um silêncio: sempre termina num destes estados.

  CONFIRMADA      marca lida no texto da peça (OCR) ou símbolo reconhecido com folga
  POSSIVEL        símbolo parecido com o de uma marca, sem folga: a tela pergunta "Possível marca: X — confirmar?"
  LOGO_SEM_MARCA  há texto ou símbolo na peça, mas não é de uma marca conhecida: a tela pede para digitar a marca
  SEM_LOGO        nada que pareça logo

Reconhecedores locais (sem custo por imagem e sem enviar a foto para fora):
  - OCR (RapidOCR, modelos PaddleOCR em ONNX, Apache-2.0) na foto inteira e em recortes ampliados;
  - CLIP ViT-B/32 (OpenAI, MIT) em ONNX, comparando cada recorte com frases "o logo da marca X".

Em produção, o mesmo contrato recebe reconhecedores remotos opcionais (IA de visão com os recortes, Google Cloud
Vision LOGO_DETECTION); ver docs/avatar3d/proposta-profissional-2026-09-27.md.
"""
from __future__ import annotations

import os
import re
import unicodedata
from dataclasses import dataclass, field

import numpy as np
from PIL import Image

# Marcas que aparecem em roupas, calçados e acessórios. `aliases` são textos que a própria marca imprime na peça.
BRANDS: dict[str, list[str]] = {
    "Nike": ["NIKE", "JUST DO IT", "NIKE AIR"], "adidas": ["ADIDAS"], "Puma": ["PUMA"], "Lacoste": ["LACOSTE"],
    "Ralph Lauren": ["RALPH LAUREN", "POLO RALPH LAUREN"], "Tommy Hilfiger": ["TOMMY HILFIGER", "TOMMY"],
    "Under Armour": ["UNDER ARMOUR"], "Reebok": ["REEBOK"], "New Balance": ["NEW BALANCE"], "Converse": ["CONVERSE", "ALL STAR"],
    "Vans": ["VANS", "OFF THE WALL"], "Fila": ["FILA"], "Champion": ["CHAMPION"], "Jordan": ["JORDAN", "JUMPMAN"],
    "The North Face": ["THE NORTH FACE", "NORTH FACE"], "Columbia": ["COLUMBIA"], "Levi's": ["LEVIS", "LEVI S", "LEVI STRAUSS"],
    "Hummel": ["HUMMEL"], "Umbro": ["UMBRO"], "Kappa": ["KAPPA"], "Asics": ["ASICS"], "Mizuno": ["MIZUNO"],
    "Olympikus": ["OLYMPIKUS"], "DC Shoes": ["DC SHOES"], "Quiksilver": ["QUIKSILVER"], "Billabong": ["BILLABONG"],
    "Oakley": ["OAKLEY"], "Lotto": ["LOTTO"], "Diadora": ["DIADORA"], "Le Coq Sportif": ["LE COQ SPORTIF"],
    "Calvin Klein": ["CALVIN KLEIN"], "Gucci": ["GUCCI"], "Louis Vuitton": ["LOUIS VUITTON"], "Chanel": ["CHANEL"],
    "Victorinox": ["VICTORINOX"], "Fred Perry": ["FRED PERRY"], "Ben Sherman": ["BEN SHERMAN"], "FUBU": ["FUBU"],
    "Supreme": ["SUPREME"], "Hollister": ["HOLLISTER"], "Abercrombie & Fitch": ["ABERCROMBIE"], "Guess": ["GUESS"],
    "Diesel": ["DIESEL"], "Hering": ["HERING"], "Reserva": ["RESERVA"], "Osklen": ["OSKLEN"], "Havaianas": ["HAVAIANAS"],
    "Wm. J. Mills & Co.": ["WM J MILLS", "J MILLS"], "Yamaha": ["YAMAHA"], "Timberland": ["TIMBERLAND"], "Carhartt": ["CARHARTT"],
    "Stüssy": ["STUSSY"], "Gap": ["GAP"], "Zara": ["ZARA"], "Uniqlo": ["UNIQLO"], "Hugo Boss": ["HUGO BOSS", "BOSS"],
    "Armani": ["ARMANI"], "Versace": ["VERSACE"], "Burberry": ["BURBERRY"], "Prada": ["PRADA"], "Dior": ["DIOR"],
}
# Marcas com símbolo próprio que o CLIP conhece o bastante para comparar (texto puro fica com o OCR).
SYMBOL_BRANDS = ["Nike", "adidas", "Puma", "Lacoste", "Ralph Lauren", "Tommy Hilfiger", "Under Armour", "Reebok",
                 "New Balance", "Converse", "Vans", "Fila", "Champion", "Jordan", "The North Face", "Hummel", "Umbro",
                 "Kappa", "Asics", "Mizuno", "DC Shoes", "Quiksilver", "Billabong", "Oakley", "Le Coq Sportif",
                 "Levi's", "Fred Perry", "Victorinox", "Olympikus", "Chanel", "Gucci", "Louis Vuitton"]
# Frases "sem marca" que competem com as marcas (o CLIP escolhe entre todas; sem elas, toda foto teria alguma marca).
NEGATIVES = ["a photo of plain clothing with no logo", "a photo of a t-shirt with text printed on it",
             "a photo of a sports team logo", "a photo of a company logo printed on clothing",
             "a photo of a cartoon illustration printed on clothing", "a photo of a shoe with no logo"]

# Nomes de marca que também são palavra comum, nome de pessoa ou de lugar: lidos no texto, só sugerem.
WEAK = {"JORDAN", "TOMMY", "BOSS", "GUESS", "RESERVA", "COLUMBIA", "CHAMPION", "SUPREME", "DIESEL", "LOTTO", "ALL STAR"}

CONFIRM = 0.80   # só usado com clip_confirms=True (desligado: o símbolo sozinho nunca confirma)
POSSIBLE = 0.60  # abaixo disso não se sugere marca (calibrado em dataset.json; ver a planilha, aba Calibração)


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Z0-9 ]+", " ", s.upper()).strip()


@dataclass
class Result:
    estado: str
    marca: str | None = None
    fonte: str | None = None
    confianca: float = 0.0
    textos: list[str] = field(default_factory=list)
    clip: list[tuple[str, float]] = field(default_factory=list)


class LogoPipeline:
    def __init__(self, clip_dir: str):
        import onnxruntime as ort
        from rapidocr_onnxruntime import RapidOCR
        from onnx_clip.tokenizer import Tokenizer
        self.ocr = RapidOCR()
        opt = ort.SessionOptions(); opt.intra_op_num_threads = max(1, (os.cpu_count() or 2) - 1)
        self.vis = ort.InferenceSession(os.path.join(clip_dir, "visual.onnx"), opt)
        txt = ort.InferenceSession(os.path.join(clip_dir, "textual.onnx"), opt)
        self.labels = [f"the {b} logo" for b in SYMBOL_BRANDS] + NEGATIVES
        self.label_brand = SYMBOL_BRANDS + [None] * len(NEGATIVES)
        prompts = [f"a photo of a product with {lbl}" if i < len(SYMBOL_BRANDS) else lbl for i, lbl in enumerate(self.labels)]
        ids = Tokenizer().encode_text(prompts).astype(np.int64)
        t = txt.run(None, {"input": ids})[0]
        self.text = t / np.linalg.norm(t, axis=1, keepdims=True)

    # ---------- regiões: a foto inteira e recortes ampliados (logo pequeno vira logo grande) ----------
    @staticmethod
    def crops(img: Image.Image) -> list[Image.Image]:
        w, h = img.size
        out = [img]
        for frac, n in ((0.6, 2), (0.4, 3)):
            cw, ch = int(w * frac), int(h * frac)
            for i in range(n):
                for j in range(n):
                    x = int((w - cw) * (i / (n - 1))); y = int((h - ch) * (j / (n - 1)))
                    out.append(img.crop((x, y, x + cw, y + ch)))
        return out

    # ---------- OCR: marcas escritas (texto, etiquetas) ----------
    def read_text(self, img: Image.Image) -> list[tuple[str, float]]:
        found: list[tuple[str, float]] = []
        views = [img]
        w, h = img.size
        if max(w, h) < 1600:  # etiquetas e bordados pequenos: uma leitura ampliada 2x
            views.append(img.resize((w * 2, h * 2), Image.LANCZOS))
        for v in views:
            res, _ = self.ocr(np.asarray(v.convert("RGB")))
            for _, text, conf in res or []:
                if float(conf) >= 0.6:
                    found.append((text, float(conf)))
        return found

    @staticmethod
    def brand_from_text(texts: list[tuple[str, float]]) -> tuple[str | None, float, bool]:
        """
        Marca escrita na peça. O nome precisa começar no início de uma palavra ("ENGINEERING" não contém a marca
        Hering) e nomes curtos só valem como palavra inteira. Devolve (marca, pontuação, forte); "forte" é falso quando
        o nome também é palavra comum ou nome de pessoa (JORDAN nas costas de uma camisa é o jogador, não a marca).
        """
        from rapidfuzz import fuzz
        best, score, strong = None, 0.0, False
        for text, conf in texts:
            words = norm(text).split()
            if not words:
                continue
            compact = "".join(words)
            starts, pos = set(), 0
            for w in words:
                starts.add(pos); pos += len(w)
            for brand, aliases in BRANDS.items():
                for a in aliases:
                    aw = norm(a).split(); ac = "".join(aw)
                    if len(ac) <= 4:  # nomes curtos só como palavra exata (evita "GAP" dentro de "SINGAPORE")
                        hit = 100 if any(words[i:i + len(aw)] == aw for i in range(len(words))) else 0
                    elif len(compact) >= len(ac) - 1:
                        al = fuzz.partial_ratio_alignment(ac, compact)
                        hit = al.score if any(abs(al.dest_start - st) <= 1 for st in starts) else 0
                    else:
                        hit = 0
                    s_ = hit / 100 * conf
                    if hit >= 90 and s_ > score:
                        best, score, strong = brand, s_, a not in WEAK
        return best, score, strong

    # ---------- CLIP: símbolos (swoosh, trevo, puma, jacaré) ----------
    @staticmethod
    def _prep(img: Image.Image) -> np.ndarray:
        img = img.convert("RGB"); w, h = img.size; s = max(w, h)
        sq = Image.new("RGB", (s, s), (255, 255, 255)); sq.paste(img, ((s - w) // 2, (s - h) // 2))
        a = np.asarray(sq.resize((224, 224), Image.BICUBIC), dtype=np.float32) / 255.0
        a = (a - np.array([0.48145466, 0.4578275, 0.40821073])) / np.array([0.26862954, 0.26130258, 0.27577711])
        return a.transpose(2, 0, 1).astype(np.float32)

    def symbol_probs(self, crops: list[Image.Image]) -> np.ndarray:
        """Probabilidade de cada frase (marcas + "sem marca") em cada recorte; linha 0 = foto inteira."""
        x = np.stack([self._prep(c) for c in crops])
        e = self.vis.run(None, {"input": x})[0]
        e = e / np.linalg.norm(e, axis=1, keepdims=True)
        logits = 100.0 * e @ self.text.T
        p = np.exp(logits - logits.max(axis=1, keepdims=True))
        return p / p.sum(axis=1, keepdims=True)

    # ---------- fusão: um estado sempre ----------
    def run(self, img: Image.Image) -> tuple[Result, np.ndarray]:
        img = img.convert("RGB")
        texts = self.read_text(img)
        probs = self.symbol_probs(self.crops(img))
        return decide(texts, probs), probs


def symbol_evidence(probs: np.ndarray) -> list[tuple[str, float, int, bool]]:
    """Por marca: maior probabilidade, em quantos recortes ela vence e se vence na foto inteira."""
    n_brand = len(SYMBOL_BRANDS)
    top = probs.argmax(axis=1)
    out = []
    for b in range(n_brand):
        wins = int(((top == b) & (probs[:, b] >= 0.3)).sum())
        out.append((SYMBOL_BRANDS[b], float(probs[:, b].max()), wins, bool(top[0] == b)))
    return sorted(out, key=lambda r: -r[1])


def decide(texts: list[tuple[str, float]], probs: np.ndarray, confirm: float = CONFIRM, possible: float = POSSIBLE,
           margin: float = 0.25, clip_confirms: bool = False) -> Result:
    """
    Regra de fusão. O texto lido (OCR) confirma a marca. O símbolo (CLIP) só sugere — "Possível marca: X — confirmar"
    — e precisa vencer na foto inteira ou em pelo menos dois recortes, com folga sobre a segunda marca.
    """
    brand, s, strong = LogoPipeline.brand_from_text(texts)
    ev = symbol_evidence(probs)
    r = Result("SEM_LOGO", textos=[t for t, _ in texts], clip=[(b, round(p, 3)) for b, p, _, _ in ev[:3]])
    if brand:
        r.estado, r.marca, r.fonte, r.confianca = ("CONFIRMADA" if strong else "POSSIVEL"), brand, "texto (OCR)", round(s, 2)
        return r
    ok = [e for e in ev if e[3] or e[2] >= 2]
    if ok:
        b, p, _, _ = ok[0]
        rival = max((q for bb, q, _, _ in ev if bb != b), default=0.0)
        if p >= possible and p - rival >= margin:
            strong = clip_confirms and p >= confirm
            r.estado, r.marca, r.fonte, r.confianca = ("CONFIRMADA" if strong else "POSSIVEL"), b, "símbolo (CLIP)", round(p, 2)
            return r
    if texts:
        r.estado, r.fonte = "LOGO_SEM_MARCA", "texto sem marca conhecida"
    return r
