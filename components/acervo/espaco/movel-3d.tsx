"use client";
/**
 * ACERVO — um móvel na cena 3D: as partes procedurais (lib/acervo/cena/modelo.ts), as peças dentro dos compartimentos,
 * o alvo de clique de cada compartimento (que também acende na busca, na seleção e no mapa de uso) e as gavetas, que
 * saem do móvel quando abertas.
 */
import { useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { AssetGlb } from "@/lib/flair/nucleos/scene/assets";
import { encaixeDaRoupa } from "@/lib/acervo/cena/assets";
import { COR_LIMA } from "@/lib/acervo/cena/materiais";
import { cursoDaGaveta, modeloDoMovel, volumeDaCelula, type ParteDoMovel } from "@/lib/acervo/cena/modelo";
import { roupasDaCelula, type RoupaNaCena } from "@/lib/acervo/cena/roupas";
import type { Celula } from "@/lib/acervo/planta";
import type { AcervoMovel } from "@/lib/acervo/types";
import type { CenaProps } from "./cena-tipos";
import { EncaixeGlb } from "./glb-encaixe";
import { Marcador3D } from "./marcador-3d";
import { useMateriaisDoMovel, type MateriaisDoMovel } from "./use-materiais-do-movel";

const COR_PARADO = "#F2A33A";
const semRaio = () => null;

interface Props extends Omit<CenaProps, "moveis" | "vista" | "rotulo"> {
  movel: AcervoMovel;
  x: number;
  manifesto: AssetGlb[];
  /** marcadores numerados sobre os compartimentos */
  rotulos: boolean;
  carregada: string | null;
  onCarregar: (pieceId: string | null) => void;
}

function Parte({ parte, materiais }: { parte: ParteDoMovel; materiais: MateriaisDoMovel }) {
  const porta = parte.papel === "porta";
  return (
    <mesh name={parte.id} position={parte.pos} rotation={parte.forma === "cilindro" ? [0, 0, Math.PI / 2] : undefined}
      material={materiais[parte.mat]} castShadow={!porta} receiveShadow raycast={porta ? semRaio : undefined}>
      {parte.forma === "cilindro"
        ? <cylinderGeometry args={[parte.tam[0], parte.tam[0], parte.tam[1], 12]} />
        : <boxGeometry args={parte.tam} />}
    </mesh>
  );
}

/** Grupo da gaveta: desliza para a frente quando aberta (direto, sem animação, com "reduzir movimento"). */
function Gaveta({ aberta, curso, reduzido, children }: { aberta: boolean; curso: number; reduzido: boolean; children: ReactNode }) {
  const grupo = useRef<THREE.Group>(null);
  const destino = aberta ? curso : 0;
  useFrame((_, dt) => {
    const g = grupo.current;
    if (!g) return;
    g.position.z = reduzido ? destino : THREE.MathUtils.damp(g.position.z, destino, 9, dt);
  });
  return <group ref={grupo} position={[0, 0, reduzido ? destino : 0]}>{children}</group>;
}

export function Movel3D(props: Props) {
  const { movel, manifesto } = props;
  const modelo = useMemo(() => modeloDoMovel(movel), [movel]);
  const materiais = useMateriaisDoMovel(movel, props.raioX);
  const curso = cursoDaGaveta(modelo.planta);

  const roupa = (r: RoupaNaCena, pendurada: boolean, interativa: boolean) => (
    <EncaixeGlb key={r.id} encaixe={encaixeDaRoupa(r.categoria, pendurada)} manifesto={manifesto} tam={r.tam} pos={r.pos}>
      <mesh name={`${r.fantasma ? "fantasma" : "roupa"}-${r.id}`} position={r.pos} castShadow={!r.fantasma}
        onClick={r.fantasma || !interativa ? undefined : (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); props.onPeca(r.id); }}
        onPointerDown={r.fantasma || !interativa ? undefined : () => props.onCarregar(r.id)}>
        <boxGeometry args={r.tam} />
        <meshStandardMaterial color={r.fantasma ? COR_LIMA : r.cor} roughness={0.85} transparent={r.fantasma} opacity={r.fantasma ? 0.45 : 1}
          emissive={r.fantasma ? COR_LIMA : "#000000"} emissiveIntensity={r.fantasma ? 0.5 : 0} />
      </mesh>
    </EncaixeGlb>
  );

  const alvo = (c: Celula) => {
    const volume = volumeDaCelula(modelo.planta, c);
    const atual = props.selecionado === c.id;
    const aceso = props.acesos.has(c.id);
    const parado = props.parados.has(c.id);
    const opacidade = atual ? 0.3 : aceso ? 0.42 : parado ? 0.3 : 0;
    const numeros = props.marcadores.get(c.id) ?? [];
    return (
      <group key={`alvo-${c.id}`}>
        <mesh name={`alvo-${c.id}`} position={volume.pos} userData={{ compartimentoId: c.id }}
          onClick={() => props.onEscolher(c.id)}
          onPointerUp={(e: ThreeEvent<PointerEvent>) => {
            const id = props.carregada;
            if (!id) return;
            e.stopPropagation();
            props.onCarregar(null);
            if (!props.itensDe(c.id).some((item) => item.id === id)) props.onSoltar([id], c.id);
          }}>
          <boxGeometry args={volume.tam} />
          <meshBasicMaterial color={parado && !atual && !aceso ? COR_PARADO : COR_LIMA} transparent opacity={opacidade} depthWrite={false} />
        </mesh>
        {props.rotulos && numeros.map((n, i) => (
          <Marcador3D key={n} numero={n} pos={[volume.pos[0] + (i - (numeros.length - 1) / 2) * 0.15, volume.pos[1], 0.05]} />
        ))}
      </group>
    );
  };

  const fixas = modelo.partes.filter((p) => p.papel !== "gaveta" && !(p.papel === "puxador" && p.compartimentoId));
  return (
    <group name={`movel-${movel.id}`} position={[props.x, modelo.elevacao, 0]}>
      {fixas.map((p) => <Parte key={p.id} parte={p} materiais={materiais} />)}
      {modelo.planta.celulas.map((c) => {
        const aberta = c.tipo !== "GAVETA" || props.gavetasAbertas || props.selecionado === c.id;
        const roupas = roupasDaCelula(modelo.planta, c, props.itensDe(c.id)).map((r) => roupa(r, c.tipo === "CABIDEIRO", aberta));
        if (c.tipo !== "GAVETA") return <group key={c.id}>{roupas}{alvo(c)}</group>;
        const partes = modelo.partes.filter((p) => p.compartimentoId === c.id && (p.papel === "gaveta" || p.papel === "puxador"));
        return (
          <Gaveta key={c.id} aberta={aberta} curso={curso} reduzido={props.reduzido}>
            {partes.map((p) => <Parte key={p.id} parte={p} materiais={materiais} />)}
            {roupas}
            {alvo(c)}
          </Gaveta>
        );
      })}
    </group>
  );
}
