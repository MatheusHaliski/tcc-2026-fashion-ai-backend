"""Configuração padrão do Stable Diffusion para fotos de catálogo."""

DEFAULT_MODEL = "stable-diffusion-v1-5/stable-diffusion-inpainting"
SDXL_MODEL = "diffusers/stable-diffusion-xl-1.0-inpainting-0.1"
CONTROLNET_MODEL = "lllyasviel/control_v11p_sd15_inpaint"
PROMPT = ("professional studio product photo, ghost mannequin effect, 3d hollow form, smooth fabric, "
          "clean white background, soft drop shadow, high catalog quality")
NEGATIVE = ("person, human, model, mannequin head, face, skin, hands, arms, legs, hair, text, watermark, logo, "
            "blurry, deformed, extra garment, duplicate")
