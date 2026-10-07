/**
 * 화면 표시 규칙 (계산의 기준은 항상 서버. 여기서는 보여 주는 방법만 정한다)
 */
import type { DayView, Free, Mood, Task } from './sync/api';

export const LEVELS: Record<number, { name: string; short: string; desc: string }> = {
  1: { name: 'Lv.1 같이 해요', short: '같이 해요', desc: '부모님과 함께 순서를 정해요.' },
  2: { name: 'Lv.2 내가 골라요', short: '내가 골라요', desc: '내가 할 순서를 고를 수 있어요.' },
  3: { name: 'Lv.3 내가 계획해요', short: '내가 계획해요', desc: '내가 순서와 예상시간을 정해요.' },
};

export function levelName(level: number): string {
  return LEVELS[level]?.name ?? `Lv.${level}`;
}

/** 00:00 (분이 60을 넘으면 그대로 늘어남) */
export function clock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** 받침이 있는지 (한글 음절만 판단, 그 외에는 받침 없음으로) */
function hasBatchim(word: string): boolean {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false;
  return code % 28 !== 0;
}

/** 승윤아 · 하나야 */
export function callName(name: string): string {
  return name + (hasBatchim(name) ? '아' : '야');
}

/** 승윤이가 · 하나가 */
export function subjectName(name: string): string {
  return name + (hasBatchim(name) ? '이가' : '가');
}

export const STATUS_LABEL: Record<Task['status'], string> = {
  ready: '아직 시작 전',
  active: '하고 있어요',
  paused: '잠깐 쉬는 중',
  done: '완료',
  waived: '오늘만 면제',
  moved: '내일로 이동',
};

export const MOODS: { value: Mood; label: string }[] = [
  { value: 'good', label: '😊 잘했어요' },
  { value: 'different', label: '😐 조금 달랐어요' },
  { value: 'hard', label: '😣 어려웠어요' },
];

export function moodLabel(m: Mood | null | undefined): string {
  return MOODS.find((x) => x.value === m)?.label ?? '';
}

export const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];

/** daysMask(월=1 … 일=64) → '월–금' · '매일' · '주말' · '월·수·금' */
export function daysLabel(mask: number): string {
  if (mask === 127) return '매일';
  if (mask === 31) return '월–금';
  if (mask === 96) return '주말';
  return DAY_NAMES.filter((_, i) => mask & (1 << i)).join('·') || '요일 없음';
}

/** '2026-10-07' → '10월 7일 수요일' */
export function dayTitle(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=일
  const names = ['일', '월', '화', '수', '목', '금', '토'];
  return `${m}월 ${d}일 ${names[dow]}요일`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** 그 주 월요일 */
export function mondayOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 월=0
  return addDays(day, -dow);
}

/** 화면에 보일 과제 누적 시간: 서버 값 + (진행 중이면) 받아 온 뒤 흐른 시간 */
export function shownElapsed(t: Pick<Task, 'elapsedSec' | 'running'>, fetchedAt: number, now: number): number {
  return t.elapsedSec + (t.running ? Math.max(0, Math.floor((now - fetchedAt) / 1000)) : 0);
}

/** 화면에 보일 남은 자유시간 */
export function shownRemaining(f: Pick<Free, 'remainingSec' | 'running'>, fetchedAt: number, now: number): number {
  return Math.max(0, f.remainingSec - (f.running ? Math.max(0, Math.floor((now - fetchedAt) / 1000)) : 0));
}

/** 자유시간 조건에서 빠지지 않는 할 일 (면제 · 이동 제외) */
export function isCounted(t: Task): boolean {
  return t.status !== 'waived' && t.status !== 'moved';
}

/**
 * 아직 서버에 보내지 못한 완료를 화면에 반영 (표시용). 자유시간 상태는 바꾸지 않는다 →
 * 서버가 확인하기 전에는 이용권이 열리지 않는다.
 */
export function withPending(view: DayView, pendingDone: number[]): DayView & { pending: number[] } {
  if (pendingDone.length === 0) return { ...view, pending: [] };
  const set = new Set(pendingDone);
  const tasks = view.tasks.map((t) => (set.has(t.id) && isCounted(t) && t.status !== 'done' ? { ...t, status: 'done' as const, running: false, doneBy: 'child' as const } : t));
  const counted = tasks.filter((t) => t.required && isCounted(t));
  return {
    ...view,
    tasks,
    progress: { done: counted.filter((t) => t.status === 'done').length, total: counted.length },
    pending: pendingDone.filter((id) => tasks.some((t) => t.id === id)),
  };
}

/** 자유시간 상자 문구 (아이 화면) */
export function freeMessage(free: Free, progress: { done: number; total: number }, pending: boolean): string {
  if (pending) return '인터넷이 연결되면 부모님 확인과 자유시간을 다시 확인해요.';
  switch (free.state) {
    case 'locked':
      return `필수 ${progress.total - progress.done}개가 남았어요. 선택 할 일은 해제 조건에 포함되지 않아요.`;
    case 'waiting':
      return '부모님 확인을 기다리고 있어요.';
    case 'rest':
      return free.requested ? '부모님께 요청했어요. 확인을 기다려요.' : '오늘은 필수 할 일이 없어요. 자유시간은 부모님과 정해요.';
    case 'available':
      return '오늘의 자유시간이 열렸어요.';
    case 'ready':
      return '자유시간을 받았어요. 준비되면 시작해요.';
    case 'running':
      return '자유시간을 쓰고 있어요.';
    case 'paused':
      return '자유시간을 잠깐 멈췄어요.';
    case 'used':
      return '오늘 자유시간을 다 썼어요.';
  }
}

export function isFreeOpen(free: Free): boolean {
  return free.state !== 'locked' && free.state !== 'waiting' && free.state !== 'rest';
}

/** 부모 화면 아이 상태 꼬리표 */
export function parentBadge(free: Free): string {
  switch (free.state) {
    case 'locked':
      return '진행 중';
    case 'waiting':
      return '확인 대기';
    case 'rest':
      return free.requested ? '자유시간 요청' : '필수 없음';
    case 'available':
      return '자유시간 열림';
    case 'used':
      return '자유시간 다 씀';
    default:
      return '자유시간 사용';
  }
}

export const ICONS = ['📖', '🔢', '✏️', '🎬', '🎧', '🧩', '📚', '🎵', '🌱'];

/** 처음 시작할 때 고를 수 있는 할 일 (시안의 예시 · 월–금 필수로 시작) */
export const STARTER_TASKS: { icon: string; title: string; amount: string; estimateMin: number }[] = [
  { icon: '📖', title: '책 읽기', amount: '3권', estimateMin: 15 },
  { icon: '🔢', title: '수학 문제집', amount: '2장', estimateMin: 15 },
  { icon: '✏️', title: '한글 공부', amount: '3장', estimateMin: 15 },
  { icon: '🎬', title: '영어 영상 보기', amount: '1편', estimateMin: 15 },
];

export const HELP_REASONS: { icon: string; text: string; hint: string }[] = [
  { icon: '📖', text: '문제가 이해되지 않아요', hint: '문제를 소리 내어 한 번 읽어봐요. 아는 말부터 찾아볼까요?' },
  { icon: '🤔', text: '어떻게 할지 모르겠어요', hint: '처음 한 문제만 해볼까요? 작은 시작이면 충분해요.' },
  { icon: '💭', text: '집중이 안 돼요', hint: '잠깐 몸을 쭉 펴고 물 한 모금 마셔봐요.' },
  { icon: '😣', text: '하기 싫어졌어요', hint: '어려운 마음도 괜찮아요. 아주 작은 한 가지부터 해볼까요?' },
];
export const HELP_PARENT = '부모님 도움이 필요해요';
