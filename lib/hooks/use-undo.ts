"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Desfazer para um estado controlado (ex.: a arte do Background Studio): guarda os valores anteriores a cada mudança e
 * `undo()` restaura o último. Mudanças feitas pelo próprio undo não entram na pilha.
 */
export function useUndo<T>(value: T, setValue: (v: T) => void, limit = 30) {
  const stack = useRef<T[]>([]);
  const last = useRef<T>(value);
  const restoring = useRef(false);
  const [size, setSize] = useState(0);
  useEffect(() => {
    if (restoring.current) { restoring.current = false; last.current = value; return; }
    if (Object.is(value, last.current)) return;
    stack.current.push(last.current);
    if (stack.current.length > limit) stack.current.shift();
    last.current = value;
    setSize(stack.current.length);
  }, [value, limit]);
  const undo = () => {
    const prev = stack.current.pop();
    if (prev === undefined) return;
    restoring.current = true;
    setValue(prev);
    setSize(stack.current.length);
  };
  return { undo, canUndo: size > 0 };
}
