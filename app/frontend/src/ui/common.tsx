import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { errorMessage } from '../sync/api';
import type { Task } from '../sync/api';
import { STATUS_LABEL } from '../policy';
import type { HandleProps } from './drag';

/** 1초마다 다시 그리기 (타이머 표시용. 실제 시간은 서버가 계산) */
export function useNow(active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function useWide(minWidth = 760): boolean {
  const query = `(min-width: ${minWidth}px)`;
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches);
  useEffect(() => {
    const m = window.matchMedia?.(query);
    if (!m) return;
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return wide;
}

export type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; text: string } | { kind: 'failed'; text: string };

/**
 * 저장 버튼 공통: 저장 중에는 다시 누를 수 없고(중복 클릭 방지), 실패해도 입력 내용은 화면에 남는다.
 */
export function useSave() {
  const [state, setState] = useState<SaveState>({ kind: 'idle' });
  const busy = useRef(false);
  const run = useCallback(async <T,>(fn: () => Promise<T>, savedText = '저장했어요'): Promise<T | undefined> => {
    if (busy.current) return undefined;
    busy.current = true;
    setState({ kind: 'saving' });
    try {
      const r = await fn();
      setState({ kind: 'saved', text: savedText });
      return r;
    } catch (e) {
      setState({ kind: 'failed', text: errorMessage(e) });
      return undefined;
    } finally {
      busy.current = false;
    }
  }, []);
  const reset = useCallback(() => setState({ kind: 'idle' }), []);
  return { state, run, reset, saving: state.kind === 'saving' };
}

/** 저장 상태 안내: 지금 상태 · 입력 보존 여부 · 다음 행동 */
export function SaveNotice({ state, retry }: { state: SaveState; retry?: () => void }) {
  if (state.kind === 'saving') return <div className="tip" role="status">저장 중… 화면을 닫지 말아 주세요.</div>;
  if (state.kind === 'saved') return <div className="tip" role="status">✓ {state.text}</div>;
  if (state.kind === 'failed') {
    return (
      <div className="tip warm" role="alert">
        <strong>저장하지 못했어요</strong>
        <p>{state.text} 입력한 내용은 이 화면에 남아 있어요.</p>
        {retry && <button type="button" className="btn-secondary" onClick={retry}>다시 저장하기</button>}
      </div>
    );
  }
  return null;
}

export function Header({ badge, children }: { badge?: ReactNode; children?: ReactNode }) {
  return (
    <div className="header">
      <span className="brand">스스로 🌱</span>
      <div className="header-actions">
        {badge && <span className="badge">{badge}</span>}
        {children}
      </div>
    </div>
  );
}

export function ProgressBar({ done, total, label = '필수 할 일' }: { done: number; total: number; label?: string }) {
  return (
    <>
      <div className="row"><span>{label}</span><strong>{done} / {total}</strong></div>
      <div className="progress" role="progressbar" aria-label={`${label} 완료`} aria-valuenow={done} aria-valuemin={0} aria-valuemax={total || 1}>
        <div style={{ width: `${total ? (done / total) * 100 : 100}%` }} />
      </div>
    </>
  );
}

export function TaskRow({ task, detail, action, pending, current, handle, onKey, onOpen, label }: {
  task: Task;
  detail?: ReactNode;
  action?: ReactNode;
  pending?: boolean;
  current?: boolean;
  /** 아이콘을 손잡이로 (끌기). 상자의 나머지 부분은 스크롤 · 누르기용 */
  handle?: HandleProps;
  /** 상자를 누르면 열기 */
  onOpen?: () => void;
  /** 키보드로 같은 동작 (Enter · 방향키) */
  onKey?: (e: KeyboardEvent<HTMLDivElement>) => void;
  label?: string;
}) {
  const done = task.status === 'done';
  return (
    <div tabIndex={onKey || onOpen ? 0 : undefined} role={onOpen ? 'button' : onKey ? 'group' : undefined} aria-label={label} onKeyDown={onKey}
      onClick={onOpen} className={`task${done ? ' done' : ''}${current ? ' current' : ''}${onOpen ? ' clickable' : ''}`}>
      <span aria-hidden="true" {...handle} onClick={handle ? (e) => e.stopPropagation() : undefined}
        className={`emoji${handle ? ` ${handle.className}` : ''}`}>{done ? '✓' : task.icon}</span>
      <div className="copy">
        <strong>{task.title}</strong>
        <small>
          {task.amount} · {task.required ? '필수' : '선택'} · {detail ?? STATUS_LABEL[task.status]}
          {pending && ' · 아직 보내지 못함'}
          {task.helpOpen && ' · 🙋 도움 요청'}
        </small>
      </div>
      {action}
    </div>
  );
}

/** 원형 타이머 (ratio 1 = 가득) */
export function Ring({ ratio, free, children }: { ratio: number; free?: boolean; children: ReactNode }) {
  const arc = Math.max(0, Math.min(1, ratio)) * 360;
  return (
    <div className={`ring${free ? ' free' : ''}`} style={{ ['--arc' as string]: `${arc}deg` }}>
      <div>{children}</div>
    </div>
  );
}

export function ErrorText({ text }: { text: string | null }) {
  return text ? <div className="error" role="alert">{text}</div> : null;
}

/** 네트워크 상태 · 보내지 못한 기록 안내 */
export function OfflineNotice({ online, pending, onRetry, lastError }: { online: boolean; pending: number; onRetry: () => void; lastError: string | null }) {
  if (online && pending === 0 && !lastError) return null;
  return (
    <div className="status-bar">
      <div className="tip warm" role="status">
        <strong>{online ? (pending ? `아직 보내지 못한 기록 ${pending}개` : '서버에 연결하지 못했어요') : '인터넷 연결이 끊겼어요'}</strong>
        <p>
          {pending
            ? '완료 표시는 이 기기에 임시로 남아 있어요. 부모님 확인과 자유시간은 연결된 뒤 확인해요.'
            : lastError ?? '연결되면 다시 불러올게요.'}
        </p>
        <button type="button" className="btn-secondary" onClick={onRetry}>연결 다시 확인</button>
      </div>
    </div>
  );
}
