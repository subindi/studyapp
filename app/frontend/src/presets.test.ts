import { describe, expect, it } from 'vitest';
import { PRESETS, dayBitOf } from './presets';
import { daysLabel } from './policy';

const by = (id: string) => PRESETS.find((p) => p.id === id)!;
/** 요일(월=0)마다 그날 나오는 할 일 '이름 분량' */
const onDay = (id: string, dow: number) => by(id).items.filter((i) => i.daysMask & (1 << dow)).map((i) => `${i.title} ${i.amount}`);

describe('집 시간표 옮기기', () => {
  it('시윤 스터디플래너: 사진의 요일별 칸과 같다', () => {
    expect(onDay('siyoon-planner', 0)).toEqual(['최상위 수학 20분', '사고력 수학 10분', '책읽기 150쪽', '집중듣기 30분', '영어책 읽기 40분', '흘려듣기 30분', '글쓰기 1장']);
    expect(onDay('siyoon-planner', 3)).toEqual(['디기응 20분', '사고력 수학 20분', '책읽기 150쪽', '집중듣기 30분', '영어책 읽기 40분', '흘려듣기 30분', '글쓰기 1장']);
    expect(onDay('siyoon-planner', 4)).toEqual(['최상위 수학 20분', '책읽기 150쪽', '집중듣기 30분', '영어책 읽기 40분', '흘려듣기 30분', '글쓰기 1장']);
    expect(onDay('siyoon-planner', 5)).toEqual(['수학 오답 풀기 오답', '책읽기 150쪽', '영어책 읽기 10분', '흘려듣기 30분', '한자 20분']);
    expect(onDay('siyoon-planner', 6)).toEqual(onDay('siyoon-planner', 5));
  });
  it('승윤 매일 할 일: 4개 매일', () => {
    expect(by('seungyoon-daily').items.map((i) => daysLabel(i.daysMask))).toEqual(['매일', '매일', '매일', '매일']);
  });
  it('날짜의 요일 비트', () => {
    expect(dayBitOf('2026-10-05')).toBe(1); // 월
    expect(dayBitOf('2026-10-07')).toBe(4); // 수
    expect(dayBitOf('2026-10-11')).toBe(64); // 일
  });
});
