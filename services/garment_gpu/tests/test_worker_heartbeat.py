"""Batimento do worker no Redis (o sinal que a API usa para rotear à Fase 2): a GPU é lida uma vez na subida, nunca a
cada batida, e a chave dura 2 min — um worker ocupado gerando não pode sumir da fila."""
import json
import threading

import fakeredis

from services.garment_gpu import config, worker


class OneBeat(threading.Event):
    """Para depois da primeira batida, sem dormir no teste."""

    def wait(self, timeout=None):
        self.set()
        return True


def test_batimento_nao_consulta_a_gpu_e_vale_dois_minutos(monkeypatch):
    redis = fakeredis.FakeStrictRedis()
    monkeypatch.setattr(worker, "gpu_info", lambda settings: (_ for _ in ()).throw(AssertionError("GPU lida na batida")))
    monkeypatch.setattr(worker, "vram_used_mb", lambda: 58000)
    seen = {}
    original_set = redis.set

    def capture(key, value, ex=None):
        seen.update(key=key, payload=json.loads(value), ttl=ex)
        return original_set(key, value, ex=ex)

    monkeypatch.setattr(redis, "set", capture)
    static = {"device": "cuda", "gpu": "NVIDIA A100 80GB PCIe", "vram_total_mb": 81152}
    worker.heartbeat(redis, "reconstruct-1", "reconstruct", config.load({}), OneBeat(), static=static)
    assert seen["key"] == "fai:worker:reconstruct-1" and seen["ttl"] == worker.HEARTBEAT_TTL == 120
    assert seen["payload"]["stage"] == "reconstruct" and seen["payload"]["gpu"] == "NVIDIA A100 80GB PCIe"
    assert seen["payload"]["vram_used_mb"] == 58000
    assert redis.get("fai:worker:reconstruct-1") is None   # ao parar, o worker sai da lista


def test_sem_gpu_o_batimento_segue_com_o_dispositivo():
    info = worker.gpu_info(config.load({"FAI_DEVICE": "cpu"}))
    assert info == {"device": "cpu"}
    assert worker.vram_used_mb() in (None, 0)
