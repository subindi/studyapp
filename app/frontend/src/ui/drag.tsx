/**
 * 아이 화면용 끌기 부품 (라이브러리 없이 Pointer Events — 손가락 · 마우스 · 펜 공통).
 * - SortableList: 아이콘을 잡고 위아래로 끌어 순서 바꾸기
 * - useDragToZone: 할 일을 끌어다 '여기에 놓기' 칸에 놓기
 * - SlideToConfirm: 손잡이를 끝까지 밀어서 확인 (실수로 눌러도 바로 실행되지 않음)
 * 키보드 · 스크린리더 사용자는 같은 동작을 버튼으로 할 수 있다.
 */
import { useCallback, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from 'react';

function buzz(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* 진동이 없는 기기 */
  }
}

// ---------------------------------------------------------------- 순서 바꾸기

export interface HandleProps {
  onPointerDown: (e: RPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: RPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: RPointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: RPointerEvent<HTMLElement>) => void;
  className: string;
}

interface SortDrag {
  id: number;
  index: number;
  target: number;
  startY: number;
  dy: number;
  /** 문서 기준 각 줄의 위치 (끌기 시작할 때) */
  rects: { top: number; height: number }[];
  gap: number;
}

/** 다른 줄들의 중간선을 기준으로 지금 놓일 자리 */
export function targetIndex(rects: { top: number; height: number }[], index: number, dy: number): number {
  const center = rects[index].top + rects[index].height / 2 + dy;
  let target = index;
  for (let j = index + 1; j < rects.length; j++) if (center > rects[j].top + rects[j].height / 2) target = j;
  for (let j = index - 1; j >= 0; j--) if (center < rects[j].top + rects[j].height / 2) target = j;
  return target;
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

export function SortableList<T extends { id: number }>({ items, onReorder, renderItem, label }: {
  items: T[];
  onReorder: (ids: number[]) => void;
  renderItem: (item: T, handle: HandleProps, dragging: boolean) => ReactNode;
  label: string;
}) {
  const refs = useRef(new Map<number, HTMLElement>());
  const [drag, setDrag] = useState<SortDrag | null>(null);
  const dragRef = useRef<SortDrag | null>(null);
  const update = (d: SortDrag | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  const handleFor = (item: T, index: number): HandleProps => ({
    className: 'grip',
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const rects = items.map((it) => {
        const r = refs.current.get(it.id)!.getBoundingClientRect();
        return { top: r.top + window.scrollY, height: r.height };
      });
      const gap = rects.length > 1 ? Math.max(0, rects[1].top - (rects[0].top + rects[0].height)) : 0;
      buzz();
      update({ id: item.id, index, target: index, startY: e.clientY + window.scrollY, dy: 0, rects, gap });
    },
    onPointerMove: (e) => {
      const d = dragRef.current;
      if (!d || d.id !== item.id) return;
      // 화면 끝에 가까우면 조금씩 스크롤
      if (e.clientY < 70) window.scrollBy(0, -8);
      else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 8);
      const dy = e.clientY + window.scrollY - d.startY;
      const target = targetIndex(d.rects, d.index, dy);
      if (target !== d.target) buzz(8);
      update({ ...d, dy, target });
    },
    onPointerUp: () => {
      const d = dragRef.current;
      if (!d || d.id !== item.id) return;
      update(null);
      if (d.target !== d.index) onReorder(moveItem(items, d.index, d.target).map((x) => x.id));
    },
    onPointerCancel: () => update(null),
  });

  const styleFor = (i: number): CSSProperties | undefined => {
    if (!drag) return undefined;
    if (i === drag.index) return { transform: `translateY(${drag.dy}px) scale(1.03)`, zIndex: 3, transition: 'none' };
    const shift = drag.rects[drag.index].height + drag.gap;
    if (drag.index < i && i <= drag.target) return { transform: `translateY(${-shift}px)` };
    if (drag.target <= i && i < drag.index) return { transform: `translateY(${shift}px)` };
    return { transform: 'translateY(0)' };
  };

  return (
    <div className="list sortable" role="list" aria-label={label}>
      {items.map((item, i) => (
        <div key={item.id} role="listitem" className={`sort-item${drag?.id === item.id ? ' dragging' : ''}`} style={styleFor(i)}
          ref={(el) => {
            if (el) refs.current.set(item.id, el);
            else refs.current.delete(item.id);
          }}>
          {renderItem(item, handleFor(item, i), drag?.id === item.id)}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- 끌어다 놓기

interface ZoneDrag {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  active: boolean;
  over: boolean;
}

/** 할 일 카드의 손잡이를 끌어 놓기 칸에 놓으면 onDrop. 조금만 움직이고 떼면 onTap */
export function useDragToZone(onDrop: (id: number) => void, onTap?: (id: number) => void) {
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<ZoneDrag | null>(null);
  const dragRef = useRef<ZoneDrag | null>(null);
  const update = (d: ZoneDrag | null) => {
    dragRef.current = d;
    setDrag(d);
  };
  const isOver = (x: number, y: number) => {
    const r = zoneRef.current?.getBoundingClientRect();
    return !!r && x >= r.left - 12 && x <= r.right + 12 && y >= r.top - 12 && y <= r.bottom + 12;
  };

  const handle = useCallback((id: number): HandleProps => ({
    className: 'grip',
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      update({ id, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, active: false, over: false });
    },
    onPointerMove: (e) => {
      const d = dragRef.current;
      if (!d || d.id !== id) return;
      const active = d.active || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 8;
      // 할 일이 많아 놓기 칸이 화면 밖이면 끌면서 스크롤
      if (active && e.clientY < 70) window.scrollBy(0, -10);
      else if (active && e.clientY > window.innerHeight - 70) window.scrollBy(0, 10);
      if (active && !d.active) buzz();
      const over = active && isOver(e.clientX, e.clientY);
      if (over && !d.over) buzz(8);
      update({ ...d, x: e.clientX, y: e.clientY, active, over });
    },
    onPointerUp: (e) => {
      const d = dragRef.current;
      if (!d || d.id !== id) return;
      update(null);
      if (d.active && isOver(e.clientX, e.clientY)) {
        buzz(25);
        onDrop(id);
      } else if (!d.active) onTap?.(id);
    },
    onPointerCancel: () => update(null),
  }), [onDrop, onTap]);

  return { zoneRef, handle, dragging: drag?.active ? drag : null };
}

/** 끌고 있는 카드를 손가락 아래에 띄워 보여 준다 */
export function DragGhost({ drag, children }: { drag: { x: number; y: number; over: boolean } | null; children: ReactNode }) {
  if (!drag) return null;
  return (
    <div className={`drag-ghost${drag.over ? ' over' : ''}`} style={{ left: drag.x, top: drag.y }} aria-hidden="true">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- 밀어서 확인

const KNOB = 58;

export function SlideToConfirm({ label, onConfirm, disabled, warm }: {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  warm?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hint, setHint] = useState(false);
  const start = useRef<{ px: number; moved: boolean } | null>(null);
  const max = () => Math.max(0, (trackRef.current?.clientWidth ?? 0) - KNOB - 8);

  const finish = () => {
    setX(max());
    buzz(25);
    onConfirm();
    window.setTimeout(() => setX(0), 600);
  };

  return (
    <div ref={trackRef} className={`slide${warm ? ' warm' : ''}${disabled ? ' disabled' : ''}${hint ? ' hint' : ''}`}>
      <div className="slide-fill" style={{ width: x + KNOB + 4, transition: dragging ? 'none' : undefined }} />
      <span className="slide-label" aria-hidden="true">{label}</span>
      <button type="button" className="slide-knob" disabled={disabled} aria-label={`${label} (누르면 바로 실행)`}
        style={{ transform: `translateX(${x}px)`, transition: dragging ? 'none' : undefined }}
        onPointerDown={(e) => {
          if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          start.current = { px: e.clientX - x, moved: false };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const nx = Math.max(0, Math.min(max(), e.clientX - start.current.px));
          if (Math.abs(nx) > 4) start.current.moved = true;
          setX(nx);
        }}
        onPointerUp={() => {
          const s = start.current;
          start.current = null;
          setDragging(false);
          if (s && x >= max() * 0.82) finish();
          else {
            setX(0);
            if (s && !s.moved) {
              setHint(true); // 그냥 누르면 '밀어요' 안내만
              window.setTimeout(() => setHint(false), 700);
            }
          }
        }}
        onPointerCancel={() => {
          start.current = null;
          setDragging(false);
          setX(0);
        }}
        onClick={(e) => {
          if (e.detail === 0 && !disabled) finish(); // 키보드(Enter · Space)로는 바로 실행
        }}>
        →
      </button>
    </div>
  );
}
