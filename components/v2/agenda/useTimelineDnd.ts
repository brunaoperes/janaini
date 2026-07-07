'use client';

// Drag (mover) + resize (redimensionar) de blocos na timeline da Agenda V2.
// Baseado na mecânica da agenda de produção (app/agenda/page.tsx), porém com
// Pointer Events (funciona com mouse/caneta/toque) e adaptado ao posicionamento V2:
// janela 06:00–22:00, left% = (min-360)/960, snap de 15 min, mínimo 15 min.
//
// A persistência fica na página (onde vive o estado dos agendamentos): este hook só
// calcula o novo início/fim/colaboradora e dispara os callbacks de commit no pointerup.
// O clique curto (< THRESHOLD px) NÃO é tratado como arraste: chama o onClick original.

import { useCallback, useRef, useState } from 'react';
import { INICIO_MIN, FIM_MIN, JANELA_MIN, Bloco } from './timeline-utils';

const THRESHOLD = 4;         // px de tolerância antes de considerar arraste
const SNAP = 15;             // snap de 15 min
const MIN_DUR = 15;          // duração mínima

const snap15 = (m: number) => Math.round(m / SNAP) * SNAP;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const xToMin = (clientX: number, gr: DOMRect) =>
  INICIO_MIN + ((clientX - gr.left) / gr.width) * JANELA_MIN;

export type DndMode = 'move' | 'resize-l' | 'resize-r';

export type DndPreview = {
  mode: DndMode;
  id: number;
  colaboradorId: number | null;
  inicioMin: number;
  fimMin: number;
  leftPx: number;
  widthPx: number;
  topPx: number;
  heightPx: number;
};

export type CommitMove = (p: { id: number; colaboradorId: number | null; inicioMin: number; fimMin: number }) => void;
export type CommitResize = (p: { id: number; inicioMin: number; fimMin: number }) => void;

type Interaction = {
  mode: DndMode;
  b: Bloco;
  onClick: () => void;
  downX: number;
  downY: number;
  started: boolean;
  offsetMin: number;      // (só move) distância em min entre o cursor e o início do bloco
  originColabId: number | null;
  result: { colaboradorId: number | null; inicioMin: number; fimMin: number } | null;
};

/** Linhas da grade (o div com data-colab-row é a área da grade de cada profissional). */
function rows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-colab-row]'));
}
function rowUnder(clientY: number, list: HTMLElement[]) {
  for (const r of list) {
    const rect = r.getBoundingClientRect();
    if (clientY >= rect.top && clientY <= rect.bottom) {
      return { rect, colabId: r.dataset.colabId ? Number(r.dataset.colabId) : null };
    }
  }
  return null;
}
function rowOf(colabId: number | null, list: HTMLElement[]) {
  for (const r of list) {
    const id = r.dataset.colabId ? Number(r.dataset.colabId) : null;
    if (id === colabId) return r.getBoundingClientRect();
  }
  return list[0]?.getBoundingClientRect() ?? null;
}

export function useTimelineDnd(opts: { onCommitMove: CommitMove; onCommitResize: CommitResize }) {
  const [preview, setPreview] = useState<DndPreview | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const stateRef = useRef<Interaction | null>(null);
  const commitRef = useRef(opts);
  commitRef.current = opts;

  const finish = useCallback(() => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    stateRef.current = null;
    setPreview(null);
    setActiveId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMove = useCallback((e: PointerEvent) => {
    const st = stateRef.current;
    if (!st) return;

    if (!st.started) {
      if (Math.hypot(e.clientX - st.downX, e.clientY - st.downY) < THRESHOLD) return;
      st.started = true;
      setActiveId(st.b.id);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = st.mode === 'move' ? 'grabbing' : 'ew-resize';
    }

    const list = rows();
    const grade = list[0]?.getBoundingClientRect();
    if (!grade) return;

    let colId = st.b.colaboradorId;
    let rowRect: DOMRect | null = null;
    let inicioMin = st.b.inicioMin;
    let fimMin = st.b.fimMin;

    if (st.mode === 'move') {
      const dur = st.b.fimMin - st.b.inicioMin;
      const target = rowUnder(e.clientY, list);
      colId = target ? target.colabId : st.originColabId;
      rowRect = target ? target.rect : rowOf(st.originColabId, list);
      const maxStart = Math.max(INICIO_MIN, FIM_MIN - dur);
      inicioMin = clamp(snap15(xToMin(e.clientX, grade) - st.offsetMin), INICIO_MIN, maxStart);
      fimMin = Math.min(FIM_MIN, inicioMin + dur);
    } else if (st.mode === 'resize-l') {
      colId = st.originColabId;
      rowRect = rowOf(st.originColabId, list);
      inicioMin = clamp(snap15(xToMin(e.clientX, grade)), INICIO_MIN, st.b.fimMin - MIN_DUR);
      fimMin = st.b.fimMin;
    } else {
      colId = st.originColabId;
      rowRect = rowOf(st.originColabId, list);
      inicioMin = st.b.inicioMin;
      fimMin = clamp(snap15(xToMin(e.clientX, grade)), st.b.inicioMin + MIN_DUR, FIM_MIN);
    }

    if (!rowRect) return;
    st.result = { colaboradorId: colId, inicioMin, fimMin };
    setPreview({
      mode: st.mode,
      id: st.b.id,
      colaboradorId: colId,
      inicioMin,
      fimMin,
      leftPx: grade.left + ((inicioMin - INICIO_MIN) / JANELA_MIN) * grade.width,
      widthPx: ((fimMin - inicioMin) / JANELA_MIN) * grade.width,
      topPx: rowRect.top + 7,
      heightPx: rowRect.height - 14,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onUp = useCallback(() => {
    const st = stateRef.current;
    if (st) {
      if (!st.started) {
        st.onClick();
      } else if (st.result) {
        const r = st.result;
        const mudou =
          r.colaboradorId !== st.b.colaboradorId ||
          r.inicioMin !== st.b.inicioMin ||
          r.fimMin !== st.b.fimMin;
        if (mudou) {
          if (st.mode === 'move') {
            commitRef.current.onCommitMove({ id: st.b.id, colaboradorId: r.colaboradorId, inicioMin: r.inicioMin, fimMin: r.fimMin });
          } else {
            commitRef.current.onCommitResize({ id: st.b.id, inicioMin: r.inicioMin, fimMin: r.fimMin });
          }
        }
      }
    }
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback((mode: DndMode, e: React.PointerEvent, b: Bloco, onClick: () => void) => {
    if (e.button !== undefined && e.button !== 0) return; // só botão principal
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    const rowEl = el.closest('[data-colab-row]') as HTMLElement | null;
    const grade = rows()[0]?.getBoundingClientRect();
    if (!grade) return;
    const originColabId = rowEl?.dataset.colabId ? Number(rowEl.dataset.colabId) : b.colaboradorId;
    stateRef.current = {
      mode,
      b,
      onClick,
      downX: e.clientX,
      downY: e.clientY,
      started: false,
      offsetMin: xToMin(e.clientX, grade) - b.inicioMin,
      originColabId,
      result: null,
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginMove = useCallback((e: React.PointerEvent, b: Bloco, onClick: () => void) => start('move', e, b, onClick), [start]);
  const beginResize = useCallback((e: React.PointerEvent, b: Bloco, side: 'l' | 'r') => start(side === 'l' ? 'resize-l' : 'resize-r', e, b, () => {}), [start]);

  return { preview, activeId, beginMove, beginResize };
}
