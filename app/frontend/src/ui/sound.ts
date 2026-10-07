// 효과음: 소리 파일 없이 Web Audio 로 짧게 만든다 (라이선스 · 다운로드 없음).
// - 아이가 누른 행동에만 울린다. 화면이 스스로 소리를 내지 않는다 (디자인 가이드 '자동 소리 없음')
// - 켜고 끄기는 아이마다 이 기기에 저장 (localStorage). 기록 · 정책과 무관
// - 어떤 브라우저에서도 예외를 던지지 않는다 (소리가 안 나도 화면은 그대로)
import { useCallback, useState } from 'react';

export type Sfx = 'tap' | 'start' | 'pause' | 'done' | 'allDone' | 'help' | 'free' | 'on';

type Note = [freq: number, at: number, len: number];

const SFX: Record<Sfx, { notes: Note[]; type: OscillatorType; gain: number }> = {
  tap: { notes: [[660, 0, 0.06]], type: 'sine', gain: 0.12 },
  on: { notes: [[523, 0, 0.08], [784, 0.08, 0.1]], type: 'sine', gain: 0.14 },
  start: { notes: [[523, 0, 0.09], [659, 0.09, 0.09], [784, 0.18, 0.14]], type: 'triangle', gain: 0.16 },
  pause: { notes: [[587, 0, 0.1], [440, 0.1, 0.14]], type: 'sine', gain: 0.12 },
  done: { notes: [[659, 0, 0.1], [784, 0.1, 0.1], [1047, 0.2, 0.22]], type: 'triangle', gain: 0.18 },
  allDone: { notes: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.34]], type: 'triangle', gain: 0.18 },
  help: { notes: [[494, 0, 0.12], [587, 0.14, 0.16]], type: 'sine', gain: 0.12 },
  free: { notes: [[784, 0, 0.08], [988, 0.08, 0.08], [1175, 0.16, 0.18]], type: 'sine', gain: 0.14 },
};

const KEY = (childId: number) => `sseuro.sound.${childId}`;

export function soundOn(childId: number): boolean {
  try {
    return window.localStorage?.getItem(KEY(childId)) !== 'off';
  } catch {
    return true;
  }
}

function saveSound(childId: number, on: boolean) {
  try {
    window.localStorage?.setItem(KEY(childId), on ? 'on' : 'off');
  } catch {
    /* 저장 못 해도 이번 화면에서는 적용 */
  }
}

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return null;
  }
}

export function playSfx(kind: Sfx) {
  const a = audio();
  if (!a) return;
  try {
    const { notes, type, gain } = SFX[kind];
    const t0 = a.currentTime + 0.01;
    for (const [freq, at, len] of notes) {
      const osc = a.createOscillator();
      const g = a.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      // 부드럽게 시작 · 끝 (딸깍 소리 없이)
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(gain, t0 + at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
      osc.connect(g).connect(a.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + len + 0.02);
    }
  } catch {
    /* 소리는 꾸밈일 뿐 */
  }
}

/** 아이 화면의 효과음: on 상태 · 켜기/끄기 · 울리기 */
export function useSound(childId: number) {
  const [on, setOn] = useState(() => soundOn(childId));
  const play = useCallback((kind: Sfx) => {
    if (on) playSfx(kind);
  }, [on]);
  const toggle = useCallback(() => {
    setOn((v) => {
      saveSound(childId, !v);
      if (!v) playSfx('on');
      return !v;
    });
  }, [childId]);
  return { on, toggle, play };
}
