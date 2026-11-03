"""Uma foto do catálogo pelo pipeline: decide se é preservada, baixa, analisa no Java (com checkpoint), aplica a regra
de enquadramento e guarda os assets; erros viram códigos no relatório, nunca URLs ou credenciais."""
from __future__ import annotations

import json

from catalog_image_download import DownloadFailure, authorize_download, public_image_url

# Falhas do canal Java que valem para o lote inteiro: nunca viram enquadramento geométrico de uma foto.
JAVA_TRANSPORT_ERRORS = {"PROCESS_EXITED", "PIPE_CLOSED", "REQUEST_TIMEOUT", "ANALYZER_CLOSED", "STARTUP_TIMEOUT",
                         "JAVA_START_FAILED", "JAVA_UNAVAILABLE", "CLASSPATH_UNAVAILABLE", "PIPELINE_VERSION_MISMATCH",
                         "PROTOCOL_ERROR", "DUPLICATE_REQUEST_ID", "BAD_REQUEST"}


def update_analysis(record, response):
    """Keep existing source/provenance and attach only the CLI's analysis columns."""
    updated = {**record, **response["columns"]}
    for alias, key in (("crop", "crop_json"), ("metrics", "metrics_json")):
        value = updated.get(key)
        updated[alias] = json.loads(value) if isinstance(value, str) else value
    return updated


def fresh_source_decision(record):
    from db import connect
    from source_persistence import source_decision
    conn = connect()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT s.domain, s.active, s.allows_image_persistence FROM catalog_sources s JOIN catalog_products p ON p.brand_id=s.brand_id WHERE p.id=%s", (record["product_id"],))
            return source_decision(cursor.fetchall(), record["source_url"], record.get("source_domain"))
    finally:
        conn.rollback()
        conn.close()


def audit_record(record, downloader, analyzer, checkpoint, *, apply):
    from catalog_image_inventory import is_standardized
    from category_frame import VERSION as FRAME_VERSION
    result = dict(record)
    snapshot = (result.get("origin") == "SNAPSHOT" or result.get("source_scope") == "SNAPSHOT_LOCAL"
                or str(result.get("source_scope", "")).startswith("snapshot:"))
    known = not snapshot or bool(result.get("processing_status") or result.get("pipeline_version"))
    before = is_standardized(result) if known or not result.get("source_url") else None
    result.update(standardized_before=before, standardized_after=before)
    if not result.get("source_url"):
        result["status_note"] = "Produto sem imagem cadastrada."
        return result
    if not apply:
        result["status_note"] = "Não verificado no banco atual; snapshot sem metadados." if before is None else "Auditoria dos metadados atuais."
        return result
    if before is True and (not getattr(analyzer, "category_frame", False) or result.get("pipeline_version") == FRAME_VERSION):
        result["status_note"] = "Já aprovado e padronizado nesta versão; preservado."
        return result
    if result.get("review_status") in ("APPROVED", "REJECTED") or result.get("processing_status") == "DOWNLOADING" or result.get("usage_status") == "REJECTED":
        result["status_note"] = "Preservado: revisão humana ou processamento em andamento."
        return result
    category_frame = getattr(analyzer, "category_frame", False)
    if category_frame:
        from category_frame import reverted_marker
        reverted = reverted_marker(result)
        if reverted and reverted.get("fabricFrameVersion") == analyzer.ready.get("fabricFrameVersion") and analyzer.ready.get("fabricFrameVersion"):
            # a mesma regra já recusou esta foto e desfez o quadro antigo: não baixa nem analisa de novo
            result["status_note"] = "Preservado: a regra V4 recusou esta foto e o quadro antigo já foi desfeito (mesma versão da regra)."
            return result
    frame_storage = getattr(analyzer, "frame_storage", None)
    # Decisão explícita do responsável (--force-category-frame): dispensa só a autorização da fonte e a
    # identificação visual confirmada; as proteções técnicas de download continuam valendo.
    force = bool(category_frame) and getattr(analyzer, "force_frame", False) is True
    response = None
    try:
        if category_frame and not force:
            if result.get("category") not in {"upper_piece", "lower_piece", "shoes_piece", "accessory_piece", "full_body_piece"}:
                raise ValueError("CATEGORY_FRAME_UNSUPPORTED:" + str(result.get("category")))
            if frame_storage and not result.get("allows_image_persistence"):
                raise ValueError((result.get("persistence_decision") or {}).get("reason", "SOURCE_RIGHTS_UNCONFIRMED"))
        # Sem fonte cadastrada não há domínio autorizado para redirecionamentos: no modo forçado o download segue
        # só com as proteções técnicas (HTTPS, sem credenciais, host público, tamanho, tipo).
        allowed = None if force else (result["persistence_decision"]["domains"] if frame_storage else None)
        response = checkpoint.get(result, analyzer.ready["pipelineVersion"])
        if response is not None and category_frame and (not isinstance(response.get("fabricFrame"), dict)
                                                         or response["fabricFrame"].get("version") != analyzer.ready.get("fabricFrameVersion")):
            response = None                     # análise guardada antes da regra do produto (V1/V2) ou de outra versão dela: refaz
        if response is None:
            path = downloader.get(result["source_url"], allowed_domains=allowed) if frame_storage else downloader.get(result["source_url"])
            try:
                response = analyzer.analyze(path, result.get("category"), result.get("subcategory"),
                                            result.get("image_type") or "PACKSHOT", image_id=result["image_id"])
                checkpoint.put(result, analyzer.ready["pipelineVersion"], response)
            except Exception as error:
                code = getattr(error, "code", None)
                if not category_frame or not code or code in JAVA_TRANSPORT_ERRORS:
                    raise
                # Java não analisou esta foto (ex.: IMAGE_TOO_SMALL): sem a máscara da peça não há como aplicar a regra — a foto
                # não é reenquadrada
                raise ValueError("FRAME_UNAVAILABLE:JAVA_" + str(code)) from error
        result["java_analysis_completed"] = True
        if category_frame:
            from category_frame import apply_frame, report_fields, FORCED_DECISION
            response = apply_frame(response, result.get("category"), force=force, subcategory=result.get("subcategory"))
            result.update(report_fields(response))
        if frame_storage:
            path = downloader.get(result["source_url"], allowed_domains=allowed)
            if force:
                decision = {"mode": FORCED_DECISION, "sourceState": (result.get("persistence_decision") or {}).get("state"),
                            "sourceReason": (result.get("persistence_decision") or {}).get("reason"),
                            "host": (result.get("persistence_decision") or {}).get("host"), "decidedBy": "PROJECT_OWNER"}
                public_image_url(downloader.final_urls.get(str(path), result["source_url"]))
                response["framed_assets"] = analyzer.frame_storage.store(result, response, path, decision=decision)
            else:
                if not result.get("allows_image_persistence"):
                    raise ValueError((result.get("persistence_decision") or {}).get("reason", "SOURCE_RIGHTS_UNCONFIRMED"))
                fresh = fresh_source_decision(result)
                if fresh['state'] != 'AUTHORIZED':
                    raise ValueError(fresh['reason'])
                from source_persistence import image_hostname, matches
                if not any(matches(image_hostname(result['source_url']), d) for d in fresh['domains']):
                    raise ValueError('SOURCE_AUTHORIZATION_CHANGED')
                authorize_download(downloader.final_urls.get(str(path), result["source_url"]), fresh["domains"])
                response["framed_assets"] = analyzer.frame_storage.store(result, response, path)
            result["frame_render"] = response["framed_assets"].get("render_info")
        result["analysis"] = response
        analyzed = update_analysis(result, response)
        result["analysis_standardized"] = is_standardized(analyzed)
        # Snapshot results are local evidence, never a claim of a production update.
        if snapshot:
            result.update(analyzed)
            result["standardized_after"] = result["analysis_standardized"]
        result["status_note"] = "Pipeline executado; " + ("enquadramento aprovado." if result["analysis_standardized"]
                                                         else "não aprovado para o enquadramento; requer revisão.")
    except Exception as error:
        if isinstance(error, (DownloadFailure, ValueError)):
            result["error"] = str(error)
        elif getattr(error, "code", None):
            result["error"] = "JAVA:" + str(error.code)
        elif isinstance(getattr(error, "response", None), dict):
            # AWS error messages can contain URLs; report codes, never credentials.
            code = str(error.response.get("Error", {}).get("Code", "UNKNOWN"))
            result["error"] = "STORAGE_ERROR:" + code if code.replace("_", "").isalnum() else "STORAGE_ERROR"
        else:
            result["error"] = type(error).__name__
        result["status_note"] = "Pipeline não aplicado: " + result["error"]
        if category_frame and isinstance(error, ValueError) and result["error"].startswith("FRAME_UNAVAILABLE:"):
            # a V3 recusou a foto; se ela ainda mostra um quadro antigo (V1/V2), volta ao estado anterior ao quadro pelo mesmo
            # caminho guardado e auditado da gravação (catalog_image_updates.apply_product), com a análise Java atual quando houve
            from category_frame_storage import revert_plan
            plan = revert_plan(result, result["error"], fabric_frame_version=analyzer.ready.get("fabricFrameVersion"))
            if plan:
                columns = (response or {}).get("columns") if result.get("java_analysis_completed") else None
                result["frame_revert"] = plan
                result["analysis"] = {"frame_revert": plan, "columns": columns}
                result["status_note"] = ("Quadro V4 recusado (" + result["error"].split(":", 1)[1] + "): a imagem enquadrada antiga ("
                                         + str(plan["revertedFrom"]) + ") volta ao estado anterior ao quadro.")
    return result
