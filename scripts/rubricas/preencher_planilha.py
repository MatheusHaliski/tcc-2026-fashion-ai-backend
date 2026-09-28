"""Preenche a planilha oficial de rubricas com a avaliacao do repositorio.

O CSV fornecido pela faculdade usa Windows-1252. Manter essa codificacao evita
que acentos sejam corrompidos ao abrir o arquivo no Excel.
"""

import csv
from decimal import Decimal
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PLANILHA = ROOT / "docs" / "rubricas" / "QUARTA_TCC_Rubricas.csv"

STACK_FRONTEND = "Next.js 15, React 19, TypeScript, Tailwind CSS, Three.js / React Three Fiber"
STACK_BACKEND = "Java 21, Spring Boot 3, Maven, MySQL, Flyway, Redis, Cassandra, OpenSearch e S3/MinIO"

# Linhas da tabela oficial (a primeira linha do arquivo e a linha 1).
OBRIGATORIOS = {
    9: "Sim",   # escopo
    10: "Não",  # documentação das sprints depende do TDE da equipe
    11: "Sim",  # acabamento e tratamento de erros
    12: "Sim",  # REST/JSON
    13: "Sim",  # persistência
    14: "Sim",  # perfis e autorização
    15: "Sim",  # dashboard
    16: "Não",  # não há evidência de commits de todos os alunos
}

# Percentual comprovável hoje. A nota segue exatamente as faixas da rubrica:
# 100% do valor, 60% do valor, 30% do valor ou zero.
OPCIONAIS = {
    22: 100,  # engenharia de requisitos
    23: 60,   # processo de qualidade
    24: 30,   # prototipação
    25: 60,   # cobertura backend: 74,4% de linhas no E2E
    26: 100,  # documentação dos serviços
    27: 30,   # Flyway presente; histórico ainda não cobre 30% das sprints
    28: 100,  # SQL avançado
    29: 30,   # NoSQL parcial
    30: 0,    # microsserviços não se aplicam ao monólito modular
    31: 0,    # service discovery/gateway não se aplicam
    32: 60,   # serviços cloud implementados, mas sem prova de quatro ativos
    33: 100,  # padrões e arquitetura limpa no backend
    34: 0,    # sem relatório de cobertura automatizada do frontend
    35: 100,  # responsividade e customização
    36: 100,  # internacionalização
    37: 60,   # arquitetura do frontend parcialmente documentada
    38: 30,   # recursos acessíveis, sem teste registrado com o público
    39: 30,   # deploy automático, sem pipeline completa por ambiente
    40: 0,    # Docker Compose não provisiona infraestrutura em nuvem
    41: 60,   # métricas/logs, sem painel externo e alerta comprovados
    42: 0,    # depende de acordo com os professores até a terceira sprint
}


def nota(valor: str, percentual: int) -> str:
    resultado = Decimal(valor) * Decimal(percentual) / Decimal(100)
    return format(resultado.quantize(Decimal("0.01")), "f")


def preencher() -> None:
    with PLANILHA.open(encoding="cp1252", newline="") as arquivo:
        linhas = list(csv.reader(arquivo))

    linhas[1][4] = STACK_FRONTEND
    linhas[2][4] = STACK_BACKEND

    for numero_linha, entregue in OBRIGATORIOS.items():
        linhas[numero_linha - 1][4] = entregue

    for numero_linha, percentual in OPCIONAIS.items():
        linha = linhas[numero_linha - 1]
        linha[8] = f"{percentual}%"
        linha[9] = nota(linha[4], percentual)

    # Os obrigatórios valem tudo ou nada. Como dois ainda dependem da equipe,
    # a nota final permanece zero, mesmo havendo pontos opcionais comprováveis.
    linhas[0][5] = "0"

    with PLANILHA.open("w", encoding="cp1252", newline="") as arquivo:
        csv.writer(arquivo, lineterminator="\r\n").writerows(linhas)


if __name__ == "__main__":
    preencher()
    print(f"Planilha preenchida: {PLANILHA.relative_to(ROOT)}")
