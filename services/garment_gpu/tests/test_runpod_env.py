"""runpod_env: configuração do pod do RunPod (sem Docker) validada antes de subir Redis, RustFS, API e workers."""
import os
import shlex
import stat
import subprocess

import pytest

from services.garment_gpu import config
from services.garment_gpu.scripts import runpod_env
from services.garment_gpu.security import digest

KEYS = f"backend:{digest('k' * 64)}:submit|read;ops:{digest('a' * 64)}:admin"


def pod_env(**extra):
    env = {"FAI_API_KEYS": KEYS, "REDIS_PASSWORD": "r" * 64, "S3_ACCESS_KEY": "fai-s3", "S3_SECRET_KEY": "s" * 64,
           "RUNPOD_POD_ID": "abc123", "PATH": "/usr/bin", "JUPYTER_PASSWORD": "nao-repassar"}
    env.update(extra)
    return env


def test_padroes_da_a100_com_lightning_e_topologia_local():
    values = runpod_env.build(pod_env(), workspace="/workspace")
    assert values["RECON_QUANTIZE"] == "none" and values["RECON_OFFLOAD"] == "none"
    assert values["RECON_LORA_PATH"] == "lightx2v/Qwen-Image-Edit-2511-Lightning"
    assert values["RECON_LORA_WEIGHT_NAME"].endswith("8steps-V1.0-bf16.safetensors")
    assert values["RECON_STEPS"] == "8" and values["RECON_TRUE_CFG"] == "1.0" and values["RECON_MAX_ATTEMPTS"] == "1"
    assert values["METRICS_PUBLIC"] == "false" and values["HF_HOME"] == "/workspace/hf"
    assert values["REDIS_URL"] == f"redis://:{'r' * 64}@127.0.0.1:6379/0"
    assert values["S3_ENDPOINT"] == "http://127.0.0.1:9000"
    settings = config.load(values)
    assert settings.recon_steps == 8 and settings.recon_max_attempts == 1 and not settings.metrics_public


def test_variavel_do_pod_vence_o_padrao_e_lixo_do_ambiente_fica_fora():
    values = runpod_env.build(pod_env(RECON_MAX_ATTEMPTS="2", RECON_BACK_VIEW="false", RECON_MAX_SIDE="768",
                                      REDIS_URL="redis://outro:6379/0", S3_ENDPOINT="http://externo:9000"))
    assert values["RECON_MAX_ATTEMPTS"] == "2" and values["RECON_BACK_VIEW"] == "false"
    assert values["RECON_MAX_SIDE"] == "768"
    assert "127.0.0.1" in values["REDIS_URL"] and values["S3_ENDPOINT"] == "http://127.0.0.1:9000"
    assert "JUPYTER_PASSWORD" not in values and "PATH" not in values and "RUNPOD_POD_ID" not in values


def test_senha_do_redis_entra_codificada_na_url():
    values = runpod_env.build(pod_env(REDIS_PASSWORD="abc/def@ghi:jkl+mn"))
    assert values["REDIS_URL"] == "redis://:abc%2Fdef%40ghi%3Ajkl%2Bmn@127.0.0.1:6379/0"


@pytest.mark.parametrize("change, expected", [
    ({"REDIS_PASSWORD": ""}, "REDIS_PASSWORD: obrigatória"),
    ({"S3_SECRET_KEY": "CHANGE_ME_LONG_S3_PASSWORD"}, "S3_SECRET_KEY: ainda tem o valor de exemplo"),
    ({"S3_SECRET_KEY": "curta"}, "o RustFS exige"),
    ({"REDIS_PASSWORD": "tem espaco no meio"}, "REDIS_PASSWORD: use só caracteres visíveis"),
    ({"REDIS_PASSWORD": 'aspas"dentro'}, "REDIS_PASSWORD: use só caracteres visíveis"),
    ({"S3_ACCESS_KEY": "{{ RUNPOD_SECRET_s3_access }}"}, "o RunPod não resolveu o segredo"),
    ({"FAI_API_KEYS": ""}, "FAI_API_KEYS: obrigatória"),
])
def test_configuracao_incompleta_cita_o_nome_e_nunca_o_valor(change, expected):
    with pytest.raises(runpod_env.PodConfigError) as error:
        runpod_env.build(pod_env(**change))
    assert expected in str(error.value)
    for value in change.values():
        if value and len(value) > 6:
            assert value not in str(error.value)


@pytest.mark.parametrize("change", [{"RECON_OFFLOAD": "gpu"}, {"RECON_STEPS": "1"},
                                    {"FAI_API_KEYS": "semdigest:submit"}])
def test_configuracao_invalida_derruba_antes_de_subir(change):
    with pytest.raises(runpod_env.PodConfigError):
        runpod_env.build(pod_env(**change))


def test_modo_l4_nf4_continua_aceito():
    values = runpod_env.build(pod_env(RECON_QUANTIZE="nf4", RECON_OFFLOAD="model"))
    assert config.load(values).recon_quantize == "nf4"


def test_arquivos_gerados_sao_privados_e_o_bash_le_os_valores(tmp_path):
    env = pod_env(S3_SECRET_KEY="s3cr3t$com&simbolos|x", REDIS_PASSWORD="p#ss!word-123456")
    out, conf = tmp_path / "run" / "fai.env", tmp_path / "run" / "redis.conf"
    proc = subprocess.run(
        ["python3", "-m", "services.garment_gpu.scripts.runpod_env", "--out", str(out), "--redis-conf", str(conf),
         "--workspace", str(tmp_path)], env={**env, "PYTHONPATH": os.getcwd()}, capture_output=True, text=True)
    assert proc.returncode == 0, proc.stderr
    assert "configuração do pod ok" in proc.stdout and "RECON_STEPS=8" in proc.stdout
    assert env["S3_SECRET_KEY"] not in proc.stdout and env["REDIS_PASSWORD"] not in proc.stdout
    for path in (out, conf):
        assert stat.S_IMODE(path.stat().st_mode) == 0o600
    read = subprocess.run(["bash", "-c", f"set -a; . {shlex.quote(str(out))}; printf '%s' \"$S3_SECRET_KEY\""],
                          capture_output=True, text=True, env={"PATH": "/usr/bin:/bin"})
    assert read.stdout == env["S3_SECRET_KEY"]
    text = conf.read_text()
    assert "bind 127.0.0.1" in text and f'requirepass "{env["REDIS_PASSWORD"]}"' in text
    assert f"dir {tmp_path}/redis" in text and "appendonly yes" in text


def test_falha_de_configuracao_sai_com_codigo_2_sem_gravar(tmp_path):
    out = tmp_path / "fai.env"
    proc = subprocess.run(
        ["python3", "-m", "services.garment_gpu.scripts.runpod_env", "--out", str(out),
         "--redis-conf", str(tmp_path / "redis.conf")],
        env={"PYTHONPATH": os.getcwd(), "PATH": "/usr/bin:/bin"}, capture_output=True, text=True)
    assert proc.returncode == 2 and "REDIS_PASSWORD" in proc.stderr and not out.exists()
