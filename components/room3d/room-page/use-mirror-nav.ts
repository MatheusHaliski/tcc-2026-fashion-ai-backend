import { useEffect, useRef, useState } from "react";
import { setNavSub } from "@/lib/nav/active-override";
import { MIRROR_ROOM_PATH } from "@/lib/nav/mirror-href";
import type { MirrorSession } from "@/lib/room3d/mirror-session";
import { keyOfPath } from "./room-page-model";

/**
 * O Espelho como navegação derivada do Meu Quarto: aberto quando a prova está à vista (cena 3D) ou na vista plana sem
 * WebGL; o sub-item do menu lateral e a URL acompanham (as refs do link vão para useMirrorDeepLink).
 */
export function useMirrorNav(session: MirrorSession, gl: boolean | null) {
  const inMirror = session.phase === "tryon";                     // aba Espelho aberta dentro do quarto
  // sem WebGL: a vista do espelho embutida — palco 2D + o mesmo painel
  const [flatMirror, setFlatMirror] = useState(false);
  // o Espelho só "está aberto" quando a prova está à vista: a cena 3D na prova, ou a vista embutida sem WebGL
  const mirrorOpen = (gl === true && inMirror) || (gl === false && flatMirror);
  // navegação derivada: "Espelho" recuado sob "Meu Quarto" no menu lateral enquanto a prova está à vista
  useEffect(() => { setNavSub(mirrorOpen ? { parent: "/room", key: "nav.mirror", icon: "ACT-32" } : null); }, [mirrorOpen]);
  useEffect(() => () => setNavSub(null), []);
  // a URL acompanha a prova (recarregar ou compartilhar reabre o espelho); só nas trocas, depois do link de entrada.
  // A escrita passa pelo roteador do Next (estado null: ele copia o interno e atualiza useSearchParams) — com o estado
  // interno (__NA) o Next ignorava a troca, a busca ficava velha e "Meu Quarto" (/room) parecia a mesma URL.
  // linkSeen: os parâmetros do espelho já tratados; linkWrote: os das URLs escritas aqui que ainda não voltaram como
  // busca nova (o eco não é um link a seguir).
  const deepLinked = useRef(false); const wasOpen = useRef(false);
  const linkSeen = useRef<string | null>(null); const linkWrote = useRef<string[]>([]);
  useEffect(() => {
    if (!deepLinked.current || wasOpen.current === mirrorOpen) { wasOpen.current = mirrorOpen; return; }
    wasOpen.current = mirrorOpen;
    const want = mirrorOpen ? MIRROR_ROOM_PATH : "/room";
    if (window.location.pathname + window.location.search !== want) { linkWrote.current.push(keyOfPath(want)); window.history.replaceState(null, "", want); }
  }, [mirrorOpen]);
  return { inMirror, flatMirror, setFlatMirror, mirrorOpen, link: { deepLinked, wasOpen, linkSeen, linkWrote } };
}
