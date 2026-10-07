// 화면 테마 (docs/05-dragon-skin-spec.md · design-handoff/seungyun-capybara · design-handoff/siyun-seal)
// 캐릭터와 말풍선은 장식이다(aria-hidden). 상태의 뜻은 본문 글자에 따로 있어야 하고,
// 캐릭터가 축하해도 자유시간 승인이나 이용권 발급을 뜻하지 않는다.
// 테마는 색 · 캐릭터 · 배경 · 말풍선만 바꾼다. 기록 · 설정 · 정책은 그대로.
import { useEffect } from 'react';

export type Theme = 'dragon' | 'capybara' | 'seal';

export const THEMES: { id: Theme; name: string; note: string }[] = [
  { id: 'dragon', name: '아기 용', note: '민트 아기 용과 작은 정원' },
  { id: 'capybara', name: '카피바라 초록 쉼터', note: '카피바라 인형과 초록 강가' },
  { id: 'seal', name: '물범 작은 바다', note: '하얀 물범 인형과 파란 바다' },
];

export function themeOf(value: string | null | undefined): Theme {
  return value === 'capybara' || value === 'seal' ? value : 'dragon';
}

/** 아기 용 아틀라스(3×2) 포즈 */
export type Pose = 'welcome' | 'focus' | 'celebrate' | 'help' | 'waiting' | 'rest';

/** 카피바라 · 물범 아틀라스(3×3) 표정 (각 design-handoff 폴더의 EMOTIONS_GUIDE.ko.md) */
export type Emotion = 'hello' | 'well-done' | 'celebrate' | 'encourage' | 'try-again' | 'start-soon' | 'focus' | 'rest' | 'sleep';

export type Scene =
  | 'today' | 'plan' | 'focus' | 'help' | 'hint' | 'asked' | 'finish-check' | 'done'
  | 'waiting' | 'free' | 'review' | 'growth' | 'empty' | 'undo' | 'ended' | 'saving';

/**
 * 화면별 [용 포즈, 용 말풍선, 표정, 표정 말풍선].
 * 표정 규칙: 검증된 완료만 celebrate, 기다림 · 노력은 well-done, 서버 오류는 try-again 을 쓰지 않는다,
 * start-soon 은 시작 시각 알림 전용(아직 없음)이라 쓰지 않는다.
 */
export const SCENES: Record<Scene, [Pose, string, Emotion, string]> = {
  today: ['welcome', '우리 하나씩 해볼까?', 'hello', '반가워!'],
  plan: ['welcome', '내가 고른 순서로 시작해요.', 'encourage', '함께 해보자!'],
  focus: ['focus', '내 속도로 해도 괜찮아.', 'focus', '하나씩 차근차근'],
  help: ['help', '어려워도 괜찮아. 같이 찾아보자.', 'try-again', '괜찮아, 다시 해보자'],
  hint: ['help', '작은 한 걸음부터 해봐요.', 'encourage', '작은 한 걸음부터 해보자!'],
  asked: ['waiting', '함께 확인할 때까지 잠깐 쉬어요.', 'rest', '잠깐 쉬어도 괜찮아'],
  'finish-check': ['focus', '내가 정한 분량을 확인해요.', 'focus', '내가 정한 만큼 했는지 볼까?'],
  done: ['celebrate', '하나씩 해냈어!', 'celebrate', '해냈어!'],
  waiting: ['waiting', '다 해냈어! 확인을 기다려요.', 'well-done', '수고했어! 확인을 기다려요.'],
  free: ['rest', '오늘의 약속 뒤에 즐거운 쉼.', 'rest', '잠깐 쉬어도 괜찮아'],
  review: ['help', '오늘의 마음을 들려줘.', 'well-done', '오늘 마음을 들려줘.'],
  growth: ['celebrate', '내 작은 시작이 쌓이고 있어요.', 'well-done', '작은 시작이 쌓이고 있어.'],
  empty: ['rest', '오늘은 쉬어가는 날이에요.', 'rest', '오늘은 쉬어가는 날이야.'],
  undo: ['help', '다시 해봐도 괜찮아요.', 'try-again', '괜찮아, 다시 해보자'],
  ended: ['rest', '오늘도 수고했어.', 'sleep', '잘 자, 내일 또 만나'],
  saving: ['waiting', '내용을 안전하게 남겨요.', 'rest', '잠깐만 기다려 줘.'],
};

/** 용 포즈만 정해 둔 곳(안내 상자 · 사이드 메뉴)에서 다른 테마가 쓸 표정 */
const POSE_EMOTION: Record<Pose, Emotion> = {
  welcome: 'hello', focus: 'focus', celebrate: 'celebrate', help: 'encourage', waiting: 'rest', rest: 'rest',
};

/** 테마 인사말 (오늘 화면). 이름은 프로필에서 받아 붙인다 */
const GREETING: Record<Exclude<Theme, 'dragon'>, (call: string) => string> = {
  capybara: (call) => `${call}, 같이 해보자!`,
  seal: (call) => `${call}, 만나서 반가워!`,
};

export function Mascot({ pose, emotion, theme = 'dragon', className }: { pose: Pose; emotion?: Emotion; theme?: Theme; className?: string }) {
  if (theme === 'dragon') return <span className={`skin-mascot${className ? ` ${className}` : ''}`} data-pose={pose} aria-hidden="true" />;
  return <span className={`skin-emotion${className ? ` ${className}` : ''}`} data-set={theme} data-emotion={emotion ?? POSE_EMOTION[pose]} aria-hidden="true" />;
}

/** 배경 + 캐릭터 + 말풍선 헤더. compact 는 작은 헤더(약 90px). call 은 '승윤아' 같은 부름말 */
export function SkinHero({ scene, copy, pose, compact, theme = 'dragon', call }: {
  scene: Scene; copy?: string; pose?: Pose; compact?: boolean; theme?: Theme; call?: string;
}) {
  const [p, c, e, ec] = SCENES[scene];
  const text = copy ?? (theme === 'dragon' ? c : scene === 'today' && call ? GREETING[theme](call) : ec);
  return (
    <div className={`skin-hero${compact ? ' skin-compact' : ''}${scene === 'focus' ? ' skin-focus' : ''}`} data-set={theme} aria-hidden="true">
      <Mascot pose={pose ?? p} emotion={pose ? undefined : e} theme={theme} />
      <span className="skin-bubble">{text}</span>
    </div>
  );
}

/** 아이 화면이 열려 있는 동안 페이지 전체(배경 · 글자색)에 테마를 건다 */
export function useThemeOnPage(theme: Theme) {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dragon') delete root.dataset.theme;
    else root.dataset.theme = theme;
    return () => {
      delete root.dataset.theme;
    };
  }, [theme]);
}
