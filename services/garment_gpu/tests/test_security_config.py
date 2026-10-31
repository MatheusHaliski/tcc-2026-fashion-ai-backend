import time

import fakeredis
import pytest

from services.garment_gpu import config, ratelimit
from services.garment_gpu.security import KeyRing, digest, new_key, parse_keys


def test_chaves_por_cliente_com_escopos():
    raw, entry = new_key("fashionai-backend", "submit|read")
    ring = KeyRing(parse_keys(entry))
    client = ring.authenticate(raw)
    assert client.client_id == "fashionai-backend" and client.can("submit") and not client.can("review")
    assert ring.authenticate("x" * 64) is None and ring.authenticate(None) is None
    assert ring.authenticate("a" * 600) is None


def test_chave_legada_vira_cliente_default_admin():
    ring = KeyRing(parse_keys("", "k" * 64))
    client = ring.authenticate("k" * 64)
    assert client.client_id == "default" and client.is_admin and client.can("review")
    with pytest.raises(ValueError):
        parse_keys("", "CHANGE_ME_USE_64_RANDOM_CHARACTERS")
    with pytest.raises(ValueError):
        parse_keys("", "curta")


@pytest.mark.parametrize("spec", [
    "semdigest:submit",
    f"Maiusculo:{digest('x')}:submit",
    f"cli:{digest('x')}:root",
    f"cli:{'z' * 64}:read",
    f"cli:{digest('x')}:read;cli:{digest('y')}:read",
])
def test_entradas_invalidas_derrubam_a_subida(spec):
    with pytest.raises(ValueError):
        parse_keys(spec)


def test_config_valida_limites():
    s = config.load({"RECON_OFFLOAD": "model", "MAX_UPLOAD_MB": "8"})
    assert s.recon_offload == "model" and s.device == "cuda" and s.max_upload_bytes == 8 * 1024 * 1024
    for env in ({"RECON_OFFLOAD": "gpu"}, {"FAI_DEVICE": "mps"}, {"MAX_UPLOAD_MB": "0"}, {"QA_MIN_SCORE": "2"},
                {"FAI_DEVICE": "cpu", "RECON_OFFLOAD": "model"}):
        with pytest.raises(ValueError):
            config.load(env)


def test_rate_limit_janela_por_minuto():
    redis = fakeredis.FakeStrictRedis()
    now = 1_000_000 * 60 + 10.0
    assert ratelimit.check(redis, "a", 2, now) == (True, 0)
    assert ratelimit.check(redis, "a", 2, now) == (True, 0)
    allowed, retry = ratelimit.check(redis, "a", 2, now)
    assert not allowed and retry == 50
    assert ratelimit.check(redis, "b", 2, now)[0]
    assert ratelimit.check(redis, "a", 2, now + 60)[0]
    assert ratelimit.check(redis, "a", 0, time.time()) == (True, 0)
