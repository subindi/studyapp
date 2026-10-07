/**
 * 오프라인 보관함: 인터넷이 끊긴 동안 아이가 누른 '완료' · '회고'를 이 기기에 임시로 남겼다가 연결되면 보낸다.
 * - 서버 동작이 같은 요청을 다시 받아도 결과가 같으므로(멱등) 재전송해도 중복되지 않는다.
 * - 부모 승인 · 자유시간 이용권은 여기 넣지 않는다 (서버 확인 없이 열지 않는다).
 * - 타이머 시작 · 멈춤도 넣지 않는다 (시간은 서버 시계로만 센다).
 */

export type OutboxItem =
  | { id: string; childId: number; kind: 'complete'; taskId: number; at: number }
  | { id: string; childId: number; kind: 'review'; mood: 'good' | 'different' | 'hard'; note: string | null; at: number };

type NewItem =
  | { childId: number; kind: 'complete'; taskId: number }
  | { childId: number; kind: 'review'; mood: 'good' | 'different' | 'hard'; note: string | null };

export interface OutboxStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'sseuro-outbox-v1';

export class Outbox {
  constructor(private store: OutboxStore) {}

  list(): OutboxItem[] {
    try {
      const raw = this.store.getItem(KEY);
      const parsed = raw ? (JSON.parse(raw) as OutboxItem[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  forChild(childId: number): OutboxItem[] {
    return this.list().filter((i) => i.childId === childId);
  }

  /** 같은 할 일 완료는 하나로, 회고는 가장 최근 것 하나로 합친다 */
  add(item: NewItem, now = Date.now()): OutboxItem[] {
    const items = this.list().filter((i) => {
      if (i.childId !== item.childId || i.kind !== item.kind) return true;
      if (item.kind === 'complete') return i.kind === 'complete' && i.taskId !== item.taskId;
      return false;
    });
    const id = `${item.kind}-${item.childId}-${item.kind === 'complete' ? item.taskId : 'day'}`;
    items.push({ ...item, id, at: now } as OutboxItem);
    this.save(items);
    return items;
  }

  remove(id: string) {
    this.save(this.list().filter((i) => i.id !== id));
  }

  /**
   * 순서대로 보낸다. 네트워크 오류면 멈추고 남겨 둔다. 서버가 거절(4xx)하면 버리고 사유를 돌려준다.
   * send 는 실패 시 { network: true } 또는 { rejected: message } 를 던지는 대신 결과로 알려 준다.
   */
  async flush(send: (item: OutboxItem) => Promise<'ok' | 'network' | { rejected: string }>): Promise<{ sent: number; rejected: string[]; left: number }> {
    let sent = 0;
    const rejected: string[] = [];
    for (const item of this.list()) {
      const r = await send(item);
      if (r === 'network') break;
      this.remove(item.id);
      if (r === 'ok') sent++;
      else rejected.push(r.rejected);
    }
    return { sent, rejected, left: this.list().length };
  }

  private save(items: OutboxItem[]) {
    try {
      this.store.setItem(KEY, JSON.stringify(items));
    } catch {
      /* 저장 공간이 없으면 기기 보관은 포기 (화면에 미동기화 상태는 그대로 보임) */
    }
  }
}

/** 브라우저 기본 저장소 (사용할 수 없으면 메모리) */
export function browserStore(): OutboxStore {
  try {
    const t = '__sseuro_test__';
    localStorage.setItem(t, t);
    localStorage.removeItem(t);
    return localStorage;
  } catch {
    const mem = new Map<string, string>();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) };
  }
}
