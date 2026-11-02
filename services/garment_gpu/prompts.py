"""Phase 2 prompts (Qwen-Image-Edit): picture 1 is the cut-out from Phase 1, picture 2 the original photo.

With the Lightning LoRA the pipeline runs at true_cfg_scale 1.0, and at that value diffusers IGNORES the negative
prompt. Everything the model must not do therefore lives in the positive prompt. The RunPod test (02/11/2026) showed
what happens otherwise: invented chest prints, side text on leggings, labels, piping, a short-sleeve T-shirt turned
long-sleeve, and the hole left by a hand painted as a decorative cut-out."""
from __future__ import annotations

NOUNS = {
    "upper_piece": "top garment",
    "lower_piece": "bottom garment",
    "shoes_piece": "pair of shoes",
    "accessory_piece": "fashion accessory",
    "auto": "garment",
}
# Products photographed as objects, never "worn flat": a flat-lay prompt made the model draw clothes for them.
PRODUCT_CATEGORIES = {"shoes_piece", "accessory_piece"}
BACK_VIEW_CATEGORIES = {"upper_piece", "lower_piece", "auto"}

GUARD = ("Preserve the existing colors, patterns, trims, collar, logos, crests, printed text, stitching, fabric "
         "texture and proportions exactly. Do not invent additional brand markings, text or decorations.")
FIDELITY = ("Reproduce only what is visible in the photos. Areas that look plain in the photos stay plain: do not add "
            "any print, graphic, logo, text, label, tag, patch, embroidery, stripe, piping, contrast trim, pocket, "
            "button or hole that is not visible in them.")
GARMENT_SHAPE = ("Keep the garment type, neckline, collar, sleeve length, hem length and fit exactly as shown in "
                 "picture 2. Where the photo cuts a part off, continue it plainly in the same fabric and shape. "
                 "Hands, arms, hair or other clothes covering the garment are not part of it: show continuous fabric "
                 "there, never a hole or cut-out.")
# Used only when true_cfg_scale > 1 (without the Lightning LoRA); kept for that configuration.
NEGATIVE = ("person, human, body, skin, arms, hands, face, neck, mannequin, hanger, extra logos, invented text, "
            "watermark, deformed, blurry, low quality, cluttered background, shadows on background")


def _clean_hint(value: str | None, limit: int = 80) -> str:
    if not value:
        return ""
    return " ".join("".join(ch for ch in value if ch.isprintable()).split())[:limit]


def _subject(category: str, name: str | None, color: str | None) -> str:
    subject = _clean_hint(name) or NOUNS.get(category, "garment")
    tint = _clean_hint(color)
    return f"{subject} in its original {tint} color" if tint else subject


def build_prompt(category: str, name: str | None = None, color: str | None = None, custom: str | None = None) -> str:
    """Front view. A client prompt replaces the description but never the guard sentence (no invented marks)."""
    if custom:
        return f"{_clean_hint(custom, 2000)} {GUARD}"
    subject = _subject(category, name, color)
    if category in PRODUCT_CATEGORIES:
        return (f"Recreate the {subject} shown in picture 1 as a clean product photo: the item alone and complete, "
                "centered, in its natural product orientation, on a pure white seamless background with soft even "
                "lighting, with no person or body part. Use picture 2 only as a reference for hidden parts. "
                f"{FIDELITY} {GUARD}")
    return (
        f"Recreate the {subject} shown in picture 1, which was cut out of the photo in picture 2, as a flat lay: "
        "the garment alone, laid flat and stretched smooth on a surface, seen from directly above, centered, "
        "symmetric, front side up, sleeves and legs extended naturally, on a pure white seamless background with "
        "soft even lighting. There is no body inside it: no person, body part, mannequin, hanger, ghost-mannequin "
        f"hollow or wrinkles from being worn. {GARMENT_SHAPE} {FIDELITY} {GUARD}"
    )


def build_back_prompt(category: str, name: str | None = None, color: str | None = None) -> str:
    """Back of the same garment, for the avatar's back panel (Phase 3). Picture 1 is the front flat lay already
    generated; picture 2 is the original photo. Front-only details must not migrate to the back."""
    subject = _subject(category, name, color)
    return (
        f"Picture 1 is the front of a {subject} laid flat. Create the BACK of exactly the same garment as a flat "
        "lay product photograph: same fabric, exact same color as picture 1, same size, proportions, silhouette, "
        "trims and seams, laid flat and stretched smooth on a surface, seen from directly above, back side up, "
        "centered, on a pure white seamless background. Use picture 2 only for details of the back that are "
        "visible in it; every part of the back that is not visible stays plain fabric. Do not copy front logos, "
        "prints, buttons, plackets or pockets to the back, and do not add prints, logos, text, labels, tags, "
        "patches or embroidery. There is no body inside it: no person, body part, mannequin, hanger or "
        "ghost-mannequin hollow."
    )
