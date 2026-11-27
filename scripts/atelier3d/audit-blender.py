"""CPU-only GLB inspection and operator metadata inventory; run with Blender 4.3+.

blender --background --factory-startup --disable-autoexec --python \
  scripts/atelier3d/audit-blender.py -- --input-dir INPUT --output-dir OUTPUT
No operator supplied by a user is executed; only fixed GLB import/mesh analysis runs.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

import bmesh
import bpy


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:])


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def operator_inventory():
    operators = []
    failures = []
    for namespace in sorted(n for n in dir(bpy.ops) if not n.startswith("_")):
        module = getattr(bpy.ops, namespace)
        for name in sorted(n for n in dir(module) if not n.startswith("_")):
            try:
                rna = getattr(module, name).get_rna_type()
                operators.append({"id": f"{namespace}.{name}",
                                  "label": rna.name,
                                  "description": rna.description})
            except (AttributeError, KeyError, RuntimeError) as error:
                failures.append({"id": f"{namespace}.{name}", "error": str(error)})
    return {"blender": bpy.app.version_string,
            "scope": "Registered operators in this factory-startup process, metadata only",
            "count": len(operators), "operators": operators, "metadata_failures": failures}


def components(mesh):
    visited = set()
    count = 0
    for vertex in mesh.verts:
        if vertex in visited:
            continue
        count += 1
        queue = [vertex]
        visited.add(vertex)
        while queue:
            current = queue.pop()
            for edge in current.link_edges:
                neighbor = edge.other_vert(current)
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
    return count


def topology(mesh):
    return {"vertices": len(mesh.verts), "edges": len(mesh.edges), "faces": len(mesh.faces),
            "components": components(mesh),
            "boundary_edges": sum(edge.is_boundary for edge in mesh.edges),
            "nonmanifold_edges_including_boundaries": sum(not edge.is_manifold for edge in mesh.edges),
            "wire_edges": sum(edge.is_wire for edge in mesh.edges),
            "zero_area_faces": sum(face.calc_area() < 1e-12 for face in mesh.faces)}


def material_info(material):
    if material is None:
        return None
    nodes = list(material.node_tree.nodes) if material.use_nodes and material.node_tree else []
    shader = next((node for node in nodes if node.type == "BSDF_PRINCIPLED"), None)
    color = list(shader.inputs["Base Color"].default_value) if shader else list(material.diffuse_color)
    textures = [{"image": node.image.name, "width": node.image.size[0], "height": node.image.size[1]}
                for node in nodes if node.type == "TEX_IMAGE" and node.image]
    return {"name": material.name, "base_color_linear_rgba": color, "textures": textures}


def mesh_info(obj):
    data = obj.data
    data.calc_loop_triangles()
    mesh = bmesh.new()
    try:
        mesh.from_mesh(data)
        raw = topology(mesh)
        bmesh.ops.remove_doubles(mesh, verts=list(mesh.verts), dist=1e-6)
        welded = topology(mesh)
    finally:
        mesh.free()
    uv = data.uv_layers.active
    coordinates = [tuple(loop.uv) for loop in uv.data] if uv else []
    return {"name": obj.name, "dimensions_file_units": list(obj.dimensions),
            "triangles": len(data.loop_triangles), "topology_imported": raw,
            "topology_welded_analysis_only_tolerance_1e_6": welded,
            "has_uv": bool(uv), "uv_layers": len(data.uv_layers),
            "uv_bounds": {"min": [min(p[i] for p in coordinates) for i in range(2)],
                          "max": [max(p[i] for p in coordinates) for i in range(2)]} if coordinates else None,
            "normals_finite": all(math.isfinite(n) for polygon in data.polygons for n in polygon.normal),
            "materials": [material_info(slot.material) for slot in obj.material_slots],
            "armature_modifiers": sum(mod.type == "ARMATURE" for mod in obj.modifiers),
            "shape_keys": bool(data.shape_keys)}


def inspect_file(path):
    before = digest(path)
    if path.stat().st_size > 8 * 1024 * 1024 or path.read_bytes()[:4] != b"glTF":
        raise ValueError("Expected a GLB no larger than 8 MiB")
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for data in list(bpy.data.meshes):
        bpy.data.meshes.remove(data)
    bpy.ops.import_scene.gltf(filepath=str(path), merge_vertices=False)
    bpy.context.view_layer.update()
    meshes = [mesh_info(obj) for obj in bpy.context.scene.objects if obj.type == "MESH"]
    static = not any(obj.type == "ARMATURE" or obj.animation_data for obj in bpy.context.scene.objects)
    static = static and not any(mesh["shape_keys"] or mesh["armature_modifiers"] for mesh in meshes)
    return {"filename": path.name, "bytes": path.stat().st_size, "sha256": before,
            "source_unchanged": digest(path) == before, "static": static,
            "mesh_objects": len(meshes), "triangles": sum(mesh["triangles"] for mesh in meshes),
            "meshes": meshes}


def report_text(results, inventory):
    lines = ["# Auditoria GLB com Blender", "",
             f"Blender {bpy.app.version_string}; {inventory['count']} operadores registrados descobertos por metadados.",
             "Nenhum operador descoberto foi executado. Descoberta não significa integração na UI.", "",
             "| Arquivo | Malhas | Triângulos | Componentes soldados | Arestas de borda soldadas | UV em todas | Estático |",
             "|---|---:|---:|---:|---:|---|---|"]
    for result in results:
        if "error" in result:
            lines.append(f"| {result['filename']} | ERRO: {result['error']} | | | | | |")
            continue
        meshes = result["meshes"]
        welded = [mesh["topology_welded_analysis_only_tolerance_1e_6"] for mesh in meshes]
        lines.append(f"| {result['filename']} | {result['mesh_objects']} | {result['triangles']} | "
                     f"{sum(mesh['components'] for mesh in welded)} | "
                     f"{sum(mesh['boundary_edges'] for mesh in welded)} | "
                     f"{all(mesh['has_uv'] for mesh in meshes)} | {result['static']} |")
    lines += ["", "A soldagem só existe em uma cópia de análise; nenhum GLB é alterado.",
              "Bordas abertas podem ser intencionais em gola, cintura, mangas e barras. A contagem não prova defeito isoladamente.",
              "Componentes separados também podem ser painéis legítimos; precisam de inspeção de união e costura.",
              "UV presente não certifica continuidade de estampa; material sem imagem não contém textura fotográfica.",
              "Dimensões são unidades do arquivo, sem validação de medidas corporais ou graduação.",
              "Normais finitas não comprovam orientação externa ou qualidade visual. O JSON detalha a inspeção por malha."]
    return "\n".join(lines) + "\n"


def main():
    args = arguments()
    input_dir = args.input_dir.resolve(strict=True)
    output_dir = args.output_dir.resolve()
    if input_dir == output_dir:
        raise ValueError("Output must be separate from input")
    output_dir.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.use_scripts_auto_execute = False
    inventory = operator_inventory()
    write_json(output_dir / "blender-operators.json", inventory)
    results = []
    for path in sorted(input_dir.glob("*.glb")):
        try:
            results.append(inspect_file(path))
        except Exception as error:
            results.append({"filename": path.name, "error": f"{type(error).__name__}: {error}"})
    if not results:
        raise ValueError("No GLB files found")
    write_json(output_dir / "glb-audit.json", {"blender": bpy.app.version_string,
               "source": "Local generated/editor-exported fixtures; not production garments", "files": results})
    (output_dir / "report.md").write_text(report_text(results, inventory))
    failures = sum("error" in result or not result.get("source_unchanged", False) for result in results)
    print(f"Audited {len(results)} GLBs; {inventory['count']} operator metadata entries; failures={failures}")
    if failures:
        raise RuntimeError("One or more GLBs failed inspection")


if __name__ == "__main__":
    main()
