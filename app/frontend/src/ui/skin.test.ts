import { describe, expect, it } from 'vitest';
import { SCENES, THEMES, themeOf } from './skin';

describe('화면 테마', () => {
  it('모르는 값은 기본 용 테마', () => {
    expect(themeOf('capybara')).toBe('capybara');
    expect(themeOf('seal')).toBe('seal');
    expect(themeOf(undefined)).toBe('dragon');
    expect(themeOf('pony')).toBe('dragon');
    expect(THEMES.map((t) => t.id)).toEqual(['dragon', 'capybara', 'seal']);
  });

  it('축하 표정은 완료가 확정된 화면에만, 시작 알림 표정은 쓰지 않는다', () => {
    const celebrate = Object.entries(SCENES).filter(([, v]) => v[2] === 'celebrate').map(([k]) => k);
    expect(celebrate).toEqual(['done']);
    expect(Object.values(SCENES).some((v) => v[2] === 'start-soon')).toBe(false);
    // 확인 대기 · 저장 중은 축하가 아니다
    expect(SCENES.waiting[2]).toBe('well-done');
    expect(SCENES.saving[2]).not.toBe('try-again');
  });
});
