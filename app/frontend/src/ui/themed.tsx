// 카피바라 · 물범 테마 화면 틀 (각 design-handoff 폴더의 approved-concept.png 구성)
// 위: 배경 장면(캐릭터 · 인사말 · 말풍선) / 아래: 장면 위로 겹쳐 올라오는 흰 시트 / 맨 아래: 고정 탭.
// 장면의 그림 · 말풍선은 장식(aria-hidden)이고, 상태 · 버튼 · 미션은 시트 안의 실제 글자다.
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import capybaraHome from '../skin/themes/concept/capybara-home.jpg';
import capybaraDone from '../skin/themes/concept/capybara-done.jpg';
import capybaraReward from '../skin/themes/concept/capybara-reward.jpg';
import sealHome from '../skin/themes/concept/seal-home.jpg';
import sealDone from '../skin/themes/concept/seal-done.jpg';
import sealReward from '../skin/themes/concept/seal-reward.jpg';
import type { Task } from '../sync/api';
import { STATUS_LABEL } from '../policy';
import type { HandleProps } from './drag';
import { Mascot, SCENES, type Emotion, type Scene, type Theme } from './skin';

type Shown = Exclude<Theme, 'dragon'>;

/** 테마별 문구 (각 패키지 tokens.json copy) */
const COPY: Record<Shown, { greeting: (call: string) => string; sub: string; done: (call: string) => string }> = {
  capybara: { greeting: (c) => `${c},\n같이 해보자!`, sub: '하나씩 천천히', done: (c) => `${c},\n멋지게 해냈어!` },
  seal: { greeting: (c) => `${c},\n만나서 반가워!`, sub: '오늘도 같이 해보자!', done: (c) => `${c}, 해냈어!` },
};

/**
 * 승인된 시안 그림을 그대로 쓰는 장면 (각 design-handoff 폴더의 images/approved-concept.png 에서 잘라 냄).
 * 그림 안에 프로필 이름 · 인사말이 그려져 있으므로, 그 이름의 아이일 때만 쓴다 (다른 아이는 아래 조립형 장면).
 * chip: 그림 속 프로필 칸 위치(%) — 그 자리에 '바꾸기' 버튼을 투명하게 겹친다.
 */
const SHOTS: Record<Shown, { owner: string; home: string; done: string; reward: string; chip: { home: Box; done: Box } }> = {
  capybara: { owner: '승윤', home: capybaraHome, done: capybaraDone, reward: capybaraReward,
    chip: { home: [66.5, 3.3, 30, 12.8], done: [67.2, 2.9, 29.7, 10] } },
  seal: { owner: '시윤', home: sealHome, done: sealDone, reward: sealReward,
    chip: { home: [67.4, 3.2, 27.5, 12.7], done: [68.5, 2.9, 27, 10.8] } },
};
type Box = [left: number, top: number, width: number, height: number];

export function usesConceptShot(theme: Theme, name: string): theme is Shown {
  return theme !== 'dragon' && name.includes(SHOTS[theme].owner);
}

export function rewardShot(theme: Shown): string {
  return SHOTS[theme].reward;
}

/** 시안 그림 장면 (오늘 · 완료). 그림은 장식이고 같은 뜻의 글자를 따로 둔다 */
export function ConceptScene({ theme, variant, call, name, sound, onSwitch }: {
  theme: Shown;
  variant: 'home' | 'done';
  call: string;
  name: string;
  sound: { on: boolean; toggle: () => void };
  onSwitch: () => void;
}) {
  const shot = SHOTS[theme];
  const [l, t, w, h] = shot.chip[variant];
  const chip: CSSProperties = { left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%` };
  const c = COPY[theme];
  return (
    <div className={`th-top th-shot-wrap th-${variant}`} data-set={theme}>
      <img className="th-shot" src={variant === 'home' ? shot.home : shot.done} alt="" />
      <h1 className="sr-only">{(variant === 'home' ? c.greeting(call) : c.done(call)).replace('\n', ' ')}</h1>
      <button type="button" className="th-hit" style={chip} onClick={onSwitch} aria-label={`${name} · 다른 사람으로 바꾸기`} title="바꾸기" />
      <button type="button" className="th-sound" style={{ left: `calc(${l}% - 50px)`, top: `calc(${t + h / 2}% - 20px)` }}
        aria-pressed={sound.on} aria-label={sound.on ? '효과음 끄기' : '효과음 켜기'} title={sound.on ? '효과음 끄기' : '효과음 켜기'}
        onClick={sound.toggle}>{sound.on ? '🔊' : '🔇'}</button>
    </div>
  );
}

/**
 * 장면. variant
 * - home: 큰 인사말 + 작은 말풍선 + 큰 캐릭터 (오늘)
 * - done: 가운데 제목 + 축하 캐릭터 (완료)
 * - page: 캐릭터 + 말풍선 한 줄 (그 밖의 화면)
 */
export function ThemeScene({ theme, variant, scene, call, header, emotion }: {
  theme: Shown;
  variant: 'home' | 'done' | 'page';
  scene: Scene;
  call: string;
  header: ReactNode;
  emotion?: Emotion;
}) {
  const [, , e, line] = SCENES[scene];
  const c = COPY[theme];
  return (
    <div className={`th-top th-${variant}`} data-set={theme}>
      {header}
      <div className="th-stage" aria-hidden="true">
        {variant === 'home' && (
          <>
            <p className="th-greeting">{c.greeting(call)}</p>
            <span className="th-sub">{c.sub}</span>
            <Mascot pose="welcome" emotion={emotion ?? e} theme={theme} />
          </>
        )}
        {variant === 'done' && (
          <>
            <p className="th-greeting">{c.done(call)}</p>
            <Mascot pose="celebrate" emotion="celebrate" theme={theme} />
          </>
        )}
        {variant === 'page' && (
          <>
            <Mascot pose="welcome" emotion={emotion ?? e} theme={theme} />
            <span className="th-bubble">{line}</span>
          </>
        )}
      </div>
    </div>
  );
}

/** 오늘의 미션 진행: 카피바라(큰 카드)는 잎사귀, 물범(플래너)은 막대 */
export function MissionProgress({ done, total, quest }: { done: number; total: number; quest: boolean }) {
  return (
    <span className="th-progress" role="img" aria-label={`필수 할 일 ${total}개 중 ${done}개 완료`}>
      {quest ? (
        total <= 8 && (
          <span className="th-leaves" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => <span key={i} className={i < done ? 'on' : ''} />)}
          </span>
        )
      ) : (
        <span className="th-bar" aria-hidden="true"><span style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></span>
      )}
      <span aria-hidden="true">{done} / {total} 완료</span>
    </span>
  );
}

export type MissionState = 'done' | 'current' | 'todo' | 'closed';

/** 미션 한 줄. quest: 아이콘 타일 + 제목 + 오른쪽 동그라미 / planner: 왼쪽 체크 + 제목 + 오른쪽 아이콘 */
export function MissionRow({ task, state, quest, handle, onOpen, onKey, pending, detail }: {
  task: Task;
  state: MissionState;
  quest: boolean;
  handle?: HandleProps;
  onOpen?: () => void;
  onKey?: (e: KeyboardEvent<HTMLDivElement>) => void;
  pending?: boolean;
  detail?: string;
}) {
  const status = detail ?? STATUS_LABEL[task.status];
  const icon = (
    <span aria-hidden="true" {...handle} onClick={handle ? (e) => e.stopPropagation() : undefined}
      className={`mission-icon${handle ? ` ${handle.className}` : ''}`}>{task.icon}</span>
  );
  const label = `${task.title} ${task.amount} · ${task.required ? '필수' : '선택'} · ${status}${state === 'current' ? ' · 지금 할 차례' : ''}`;
  return (
    <div className={`mission ${quest ? 'm-quest' : 'm-plan'} ${state}${onOpen ? ' clickable' : ''}`}
      role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined} aria-label={label} onClick={onOpen} onKeyDown={onKey}>
      {quest ? icon : <span className="mission-check" aria-hidden="true">{state === 'done' ? '✓' : ''}</span>}
      <span className="mission-copy">
        <strong>{quest ? task.title : `${task.title} ${task.amount}`}</strong>
        <small>
          {quest ? `${task.amount} · ` : ''}{task.required ? '필수' : '선택'} · {status}
          {!quest && ` · ${task.estimateMin}분`}
          {pending && ' · 아직 보내지 못함'}
          {task.helpOpen && ' · 🙋 도움 요청'}
        </small>
      </span>
      {quest ? <span className="mission-mark" aria-hidden="true">{state === 'done' ? '✓' : '›'}</span> : icon}
    </div>
  );
}
