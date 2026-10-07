/**
 * 집에 붙여 둔 시간표를 그대로 옮긴 할 일 묶음 (2026-10-07 사진 기준).
 * 부모 모드 '할 일 관리 → 시간표 한 번에 넣기'에서 아이에게 한 번에 넣는다. 넣은 뒤에는 보통 할 일처럼 고칠 수 있다.
 * daysMask: 월=1, 화=2, 수=4, 목=8, 금=16, 토=32, 일=64
 */
import type { RoutineInput } from './sync/api';

export interface Preset {
  id: string;
  title: string;
  /** 이 이름의 아이에게 먼저 추천 */
  forName: string;
  items: RoutineInput[];
}

const MON = 1, TUE = 2, WED = 4, THU = 8, FRI = 16, SAT = 32, SUN = 64;
const WEEKDAYS = MON | TUE | WED | THU | FRI;
const WEEKEND = SAT | SUN;
const EVERYDAY = WEEKDAYS | WEEKEND;

const item = (icon: string, title: string, amount: string, estimateMin: number, daysMask: number): RoutineInput =>
  ({ icon, title, amount, estimateMin, required: true, daysMask });

export const PRESETS: Preset[] = [
  {
    id: 'siyoon-planner',
    title: '시윤이의 스터디플래너',
    forName: '시윤',
    items: [
      item('🔢', '최상위 수학', '20분', 20, MON | WED | FRI),
      item('🔢', '디기응', '20분', 20, TUE | THU),
      item('🧩', '사고력 수학', '10분', 10, MON | TUE | WED),
      item('🧩', '사고력 수학', '20분', 20, THU),
      item('📝', '수학 오답 풀기', '오답', 20, WEEKEND),
      item('📖', '책읽기', '150쪽', 30, EVERYDAY),
      item('🎧', '집중듣기', '30분', 30, WEEKDAYS),
      item('📚', '영어책 읽기', '40분', 40, WEEKDAYS),
      item('📚', '영어책 읽기', '10분', 10, WEEKEND),
      item('🎵', '흘려듣기', '30분', 30, EVERYDAY),
      item('✏️', '글쓰기', '1장', 20, WEEKDAYS),
      item('🖌️', '한자', '20분', 20, WEEKEND),
    ],
  },
  {
    id: 'seungyoon-daily',
    title: '승윤이의 매일 해야 할 일',
    forName: '승윤',
    items: [
      item('📖', '한글책 읽기', '3권', 15, EVERYDAY),
      item('🔢', '수학 문제집', '2장', 15, EVERYDAY),
      item('✏️', '한글 공부', '3장', 15, EVERYDAY),
      item('🎬', '영어 영상 보기', '1편', 15, EVERYDAY),
    ],
  },
];

/** 'YYYY-MM-DD' 의 요일 비트 (월=1 … 일=64) */
export function dayBitOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 월=0
  return 1 << dow;
}
