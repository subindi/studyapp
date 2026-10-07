import { describe, expect, it } from 'vitest';
import { addDays, callName, clock, dayTitle, daysLabel, freeMessage, mondayOf, shownElapsed, shownRemaining, subjectName, withPending } from './policy';
import type { DayView, Free, Task } from './sync/api';

const task = (id: number, over: Partial<Task> = {}): Task => ({
  id, icon: '📖', title: `할 일 ${id}`, amount: '1장', estimateMin: 15, required: true, status: 'ready', doneBy: null,
  elapsedSec: 0, running: false, movedTo: null, adjustReason: null, fromRoutine: true, movedIn: false, helpOpen: false, ...over,
});
const free = (over: Partial<Free> = {}): Free => ({
  state: 'locked', minutes: 40, remainingSec: 2400, running: false, activity: null, approvalRequired: true, approved: false, requested: false, ...over,
});
const view = (tasks: Task[]): DayView => ({
  child: { id: 1, name: '승윤', age: 7, level: 2, uiStyle: 'quest', weekdayFreeMin: 40, weekendFreeMin: 60, approvalRequired: true },
  day: '2026-10-07', serverNow: 0, planned: false, tasks, progress: { done: 0, total: tasks.length }, free: free(), review: null, help: [],
});

describe('표시 규칙', () => {
  it('시계는 분이 60을 넘어도 그대로 센다 (예상시간 초과는 실패가 아님)', () => {
    expect(clock(0)).toBe('00:00');
    expect(clock(61)).toBe('01:01');
    expect(clock(3725)).toBe('62:05');
    expect(clock(-5)).toBe('00:00');
  });

  it('이름 부르기 · 조사', () => {
    expect(callName('승윤')).toBe('승윤아');
    expect(callName('하나')).toBe('하나야');
    expect(subjectName('시윤')).toBe('시윤이가');
    expect(subjectName('하나')).toBe('하나가');
    expect(callName('Ann')).toBe('Ann야');
  });

  it('요일 표시', () => {
    expect(daysLabel(31)).toBe('월–금');
    expect(daysLabel(127)).toBe('매일');
    expect(daysLabel(96)).toBe('주말');
    expect(daysLabel(1 | 4 | 16)).toBe('월·수·금');
  });

  it('날짜 계산', () => {
    expect(dayTitle('2026-10-07')).toBe('10월 7일 수요일');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(mondayOf('2026-10-07')).toBe('2026-10-05');
    expect(mondayOf('2026-10-11')).toBe('2026-10-05');
    expect(mondayOf('2026-10-05')).toBe('2026-10-05');
  });

  it('진행 중인 타이머만 화면에서 늘어난다 (기준은 서버 값)', () => {
    expect(shownElapsed({ elapsedSec: 100, running: true }, 1000, 6000)).toBe(105);
    expect(shownElapsed({ elapsedSec: 100, running: false }, 1000, 60000)).toBe(100);
    expect(shownRemaining({ remainingSec: 10, running: true }, 0, 20000)).toBe(0);
  });

  it('보내지 못한 완료는 표시만 하고 자유시간은 열지 않는다', () => {
    const v = withPending(view([task(1), task(2), task(3, { required: false })]), [1, 2]);
    expect(v.progress).toEqual({ done: 2, total: 2 });
    expect(v.free.state).toBe('locked');
    expect(v.pending).toEqual([1, 2]);
    expect(freeMessage(v.free, v.progress, true)).toContain('인터넷이 연결되면');
  });

  it('면제된 할 일은 보내지 못한 완료로 바꾸지 않는다', () => {
    const v = withPending(view([task(1, { status: 'waived' }), task(2)]), [1]);
    expect(v.tasks[0].status).toBe('waived');
    expect(v.progress).toEqual({ done: 0, total: 1 });
  });

  it('남은 필수 개수 안내에서 선택 할 일은 조건이 아니라고 알려 준다', () => {
    expect(freeMessage(free(), { done: 1, total: 3 }, false)).toBe('필수 2개가 남았어요. 선택 할 일은 해제 조건에 포함되지 않아요.');
    expect(freeMessage(free({ state: 'rest' }), { done: 0, total: 0 }, false)).toContain('부모님과 정해요');
  });
});
