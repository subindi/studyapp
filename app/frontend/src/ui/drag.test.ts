import { describe, expect, it } from 'vitest';
import { moveItem, targetIndex } from './drag';

const rows = [0, 1, 2, 3].map((i) => ({ top: i * 70, height: 60 }));

describe('끌어서 순서 바꾸기', () => {
  it('조금만 움직이면 제자리', () => {
    expect(targetIndex(rows, 1, 20)).toBe(1);
    expect(targetIndex(rows, 1, -20)).toBe(1);
  });
  it('다른 줄의 가운데를 넘으면 그 자리로', () => {
    expect(targetIndex(rows, 0, 75)).toBe(1);
    expect(targetIndex(rows, 0, 220)).toBe(3);
    expect(targetIndex(rows, 3, -150)).toBe(1);
    expect(targetIndex(rows, 3, -999)).toBe(0);
  });
  it('목록에서 옮기기', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  });
});
