import { describe, expect, it } from 'vitest';
import { Outbox, type OutboxStore } from './outbox';

function memStore(): OutboxStore {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

describe('오프라인 보관함', () => {
  it('같은 할 일 완료를 여러 번 눌러도 하나만 남긴다', () => {
    const o = new Outbox(memStore());
    o.add({ childId: 1, kind: 'complete', taskId: 5 });
    o.add({ childId: 1, kind: 'complete', taskId: 5 });
    o.add({ childId: 1, kind: 'complete', taskId: 6 });
    expect(o.forChild(1).map((i) => i.id)).toEqual(['complete-1-5', 'complete-1-6']);
  });

  it('아이별로 나눠 보관한다', () => {
    const o = new Outbox(memStore());
    o.add({ childId: 1, kind: 'complete', taskId: 5 });
    o.add({ childId: 2, kind: 'review', mood: 'good', note: null });
    expect(o.forChild(1)).toHaveLength(1);
    expect(o.forChild(2)[0].kind).toBe('review');
  });

  it('회고는 가장 최근 것 하나만', () => {
    const o = new Outbox(memStore());
    o.add({ childId: 1, kind: 'review', mood: 'hard', note: null });
    o.add({ childId: 1, kind: 'review', mood: 'good', note: '내일은 수학 먼저' });
    const items = o.forChild(1);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ mood: 'good', note: '내일은 수학 먼저' });
  });

  it('네트워크 오류면 멈추고 남은 것은 보존한다', async () => {
    const o = new Outbox(memStore());
    o.add({ childId: 1, kind: 'complete', taskId: 1 });
    o.add({ childId: 1, kind: 'complete', taskId: 2 });
    let calls = 0;
    const r = await o.flush(async () => (++calls === 1 ? 'ok' : 'network'));
    expect(r).toEqual({ sent: 1, rejected: [], left: 1 });
    expect(o.list()[0].id).toBe('complete-1-2');
  });

  it('서버가 거절하면 버리고 사유를 알려 준다', async () => {
    const o = new Outbox(memStore());
    o.add({ childId: 1, kind: 'complete', taskId: 1 });
    const r = await o.flush(async () => ({ rejected: '오늘은 하지 않아도 되는 할 일이에요' }));
    expect(r.rejected).toEqual(['오늘은 하지 않아도 되는 할 일이에요']);
    expect(o.list()).toHaveLength(0);
  });

  it('저장소가 깨져 있어도 빈 목록으로 시작한다', () => {
    const s = memStore();
    s.setItem('sseuro-outbox-v1', '{not json');
    expect(new Outbox(s).list()).toEqual([]);
  });
});
