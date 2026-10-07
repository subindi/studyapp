// 아기 용 스킨 (docs/05-dragon-skin-spec.md · assets/skin.js)
// 캐릭터와 말풍선은 장식이다(aria-hidden). 상태의 뜻은 본문 글자에 따로 있어야 하고,
// 캐릭터가 축하해도 자유시간 승인이나 이용권 발급을 뜻하지 않는다.

export type Pose = 'welcome' | 'focus' | 'celebrate' | 'help' | 'waiting' | 'rest';

export type Scene =
  | 'today' | 'plan' | 'focus' | 'help' | 'hint' | 'asked' | 'finish-check' | 'done'
  | 'waiting' | 'free' | 'review' | 'growth' | 'empty' | 'undo' | 'ended' | 'saving';

export const SCENES: Record<Scene, [Pose, string]> = {
  today: ['welcome', '우리 하나씩 해볼까?'],
  plan: ['welcome', '내가 고른 순서로 시작해요.'],
  focus: ['focus', '내 속도로 해도 괜찮아.'],
  help: ['help', '어려워도 괜찮아. 같이 찾아보자.'],
  hint: ['help', '작은 한 걸음부터 해봐요.'],
  asked: ['waiting', '함께 확인할 때까지 잠깐 쉬어요.'],
  'finish-check': ['focus', '내가 정한 분량을 확인해요.'],
  done: ['celebrate', '하나씩 해냈어!'],
  waiting: ['waiting', '다 해냈어! 확인을 기다려요.'],
  free: ['rest', '오늘의 약속 뒤에 즐거운 쉼.'],
  review: ['help', '오늘의 마음을 들려줘.'],
  growth: ['celebrate', '내 작은 시작이 쌓이고 있어요.'],
  empty: ['rest', '오늘은 쉬어가는 날이에요.'],
  undo: ['help', '다시 해봐도 괜찮아요.'],
  ended: ['rest', '오늘도 수고했어.'],
  saving: ['waiting', '내용을 안전하게 남겨요.'],
};

export function Mascot({ pose, className }: { pose: Pose; className?: string }) {
  return <span className={`skin-mascot${className ? ` ${className}` : ''}`} data-pose={pose} aria-hidden="true" />;
}

/** 정원 + 캐릭터 + 말풍선 헤더. compact 는 작은 헤더(약 90px) */
export function SkinHero({ scene, copy, pose, compact }: { scene: Scene; copy?: string; pose?: Pose; compact?: boolean }) {
  const [p, c] = SCENES[scene];
  return (
    <div className={`skin-hero${compact ? ' skin-compact' : ''}${scene === 'focus' ? ' skin-focus' : ''}`} aria-hidden="true">
      <Mascot pose={pose ?? p} />
      <span className="skin-bubble">{copy ?? c}</span>
    </div>
  );
}
