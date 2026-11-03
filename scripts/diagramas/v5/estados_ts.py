"""Estados que o frontend deriva sem useState com literais — lidos do TypeScript.

- classificador: função citada no título que devolve um rótulo por regra (ex.: resolveEnvironment → neutral, brand,
  multibrand);
- pipeline: função que encadeia as funções que o diagrama do time cita (ex.: dress() da roupa no avatar:
  garmentGeometry → relaxGarment → foldGarment …), um estado por etapa, na ordem das chamadas;
- elemento de mídia: componente com <video>/<audio> (ex.: ArtVideo), estados pelas operações no elemento
  (src, play, pause, removeAttribute("src")) e pelo aviso de bloqueio passado por prop.

O código fica nos módulos estados_ts_* (apoio, classificador, pipeline e elemento de mídia), reexportados aqui.
"""
from __future__ import annotations

from estados_ts_apoio import _balanced, _cited, _func, _rf_prefix  # noqa: F401
from estados_ts_classificador import _returns, classifier_states  # noqa: F401
from estados_ts_pipeline import _calls, _team_word, pipeline_states  # noqa: F401
from estados_ts_midia import _handler_of, media_states  # noqa: F401


TS_DERIVED = (media_states, classifier_states, pipeline_states)
