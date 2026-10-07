import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { api, newRequestId } from '../sync/api';
import type { Child, Me, UiStyle } from '../sync/api';
import { STARTER_TASKS } from '../policy';
import { ErrorText, Header, SaveNotice, useSave } from './common';

/** 로그인 · 가입 (부모 계정). 가입하면 새 가족이 만들어진다 */
export function AuthScreen({ onDone }: { onDone: (me: Me) => void }) {
  const [mode, setMode] = useState<'intro' | 'login' | 'signup'>('intro');
  const [form, setForm] = useState({ email: '', password: '', displayName: '', familyName: '우리 가족' });
  const save = useSave();
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const me = await save.run(() => (mode === 'login'
      ? api.login(form.email, form.password)
      : api.signup(form.email, form.password, form.displayName, form.familyName)), mode === 'login' ? '로그인했어요' : '가족을 만들었어요');
    if (me) onDone(me);
  };

  if (mode === 'intro') {
    return (
      <div className="app">
        <Header badge="처음 시작" />
        <div className="center">
          <div className="large-emoji" aria-hidden="true">🌱</div>
          <div className="kicker">아이의 작은 자율권부터</div>
          <h2>내가 고르고,<br />내가 해내는 하루</h2>
          <p>할 일을 정하는 부모님과<br />스스로 시작하는 아이가 함께 사용해요.</p>
        </div>
        <div className="panel">
          <div className="task">① 부모 계정 · 우리 가족 만들기</div>
          <div className="task">② 부모 PIN 설정</div>
          <div className="task">③ 아이 등록 · 자율권 · 반복 할 일 · 자유시간</div>
        </div>
        <button type="button" className="btn-main" onClick={() => setMode('signup')}>우리 가족 시작하기</button>
        <button type="button" className="btn-secondary" onClick={() => setMode('login')}>이미 계정이 있어요 · 로그인</button>
      </div>
    );
  }

  return (
    <div className="app">
      <Header badge={mode === 'login' ? '로그인' : '설정 1 / 3'} />
      <button type="button" className="btn-back" onClick={() => setMode('intro')}>← 이전</button>
      <div className="kicker">부모 계정</div>
      <h2>{mode === 'login' ? <>다시 만나서<br />반가워요</> : <>누구의 하루를<br />함께 시작할까요?</>}</h2>
      <form onSubmit={submit}>
        {mode === 'signup' && (
          <>
            <label className="label" htmlFor="family">가족 이름</label>
            <input id="family" value={form.familyName} onChange={set('familyName')} maxLength={30} required />
            <label className="label" htmlFor="display">부모 이름 · 호칭</label>
            <input id="display" value={form.displayName} onChange={set('displayName')} maxLength={20} placeholder="예: 엄마, 아빠" required />
          </>
        )}
        <label className="label" htmlFor="email">이메일</label>
        <input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} maxLength={190} required />
        <label className="label" htmlFor="password">비밀번호 {mode === 'signup' && <small>8자 이상</small>}</label>
        <input id="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={form.password} onChange={set('password')} minLength={mode === 'signup' ? 8 : 1} maxLength={72} required />
        {mode === 'signup' && <p>부모 계정은 PIN 을 잊었을 때 본인 확인에도 쓰여요. 아이 정보는 우리 가족 안에서만 보여요.</p>}
        <SaveNotice state={save.state.kind === 'saved' ? { kind: 'idle' } : save.state} />
        <button type="submit" className="btn-main" disabled={save.saving}>{save.saving ? '확인하는 중…' : mode === 'login' ? '로그인' : '다음 · 부모 PIN 설정'}</button>
      </form>
      <button type="button" className="btn-quiet" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? '처음이에요 · 가입하기' : '이미 계정이 있어요 · 로그인'}
      </button>
    </div>
  );
}

/** 4자리 PIN 두 번 입력 (설정 · 변경 · 복구 공통) */
export function PinFields({ onSubmit, saving, submitLabel, extra }: {
  onSubmit: (pin: string) => void;
  saving: boolean;
  submitLabel: string;
  extra?: ReactNode;
}) {
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (!/^\d{4}$/.test(pin)) return setError('PIN 은 숫자 4자리로 입력해 주세요.');
      if (pin !== again) return setError('두 PIN 이 서로 달라요. 다시 확인해 주세요.');
      if (pin === '1234' || /^(\d)\1{3}$/.test(pin)) return setError('쉽게 짐작할 수 있는 PIN 이에요. 다른 숫자를 골라 주세요.');
      setError(null);
      onSubmit(pin);
    }}>
      {extra}
      <label className="label" htmlFor="new-pin">부모 PIN · 숫자 4자리</label>
      <input id="new-pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value)} required />
      <label className="label" htmlFor="confirm-pin">PIN 한 번 더 입력</label>
      <input id="confirm-pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required />
      <ErrorText text={error} />
      <button type="submit" className="btn-main" disabled={saving}>{saving ? '저장하는 중…' : submitLabel}</button>
    </form>
  );
}

export function PinSetup({ onDone }: { onDone: (me: Me) => void }) {
  const save = useSave();
  return (
    <div className="app">
      <Header badge="설정 2 / 3" />
      <div className="kicker">부모 모드 보호</div>
      <h2>부모님만 설정을<br />바꿀 수 있게 해요</h2>
      <PinFields saving={save.saving} submitLabel="PIN 저장" onSubmit={async (pin) => {
        const me = await save.run(() => api.setPin(pin), 'PIN 을 저장했어요');
        if (me) onDone(me);
      }} />
      <SaveNotice state={save.state.kind === 'saved' ? { kind: 'idle' } : save.state} />
      <div className="tip">아이 모드로 전환하면 부모 화면은 다시 잠겨요. PIN 은 화면 잠금 보조 수단이고, 권한은 서버에서 한 번 더 확인해요.</div>
    </div>
  );
}

/**
 * 아이 등록 (처음 시작 · 아이 추가 공통): 이름/나이 → 자율권 → 첫 반복 할 일 · 자유시간.
 * 저장 요청 번호를 화면을 여는 동안 유지 → 저장 재시도 · 중복 클릭에도 한 명만 만들어진다.
 */
export function ChildWizard({ step: stepLabel, onDone, onCancel }: {
  step?: string;
  onDone: (child: Child, another: boolean) => void;
  onCancel?: () => void;
}) {
  const requestId = useRef(newRequestId());
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [age, setAge] = useState(8);
  const [level, setLevel] = useState(2);
  const [uiStyle, setUiStyle] = useState<UiStyle>('quest');
  const [chosen, setChosen] = useState<number[]>([0, 1, 2, 3]);
  const [weekday, setWeekday] = useState(40);
  const [weekend, setWeekend] = useState(60);
  const [created, setCreated] = useState<Child | null>(null);
  const save = useSave();

  const header = <Header badge={stepLabel ?? `아이 등록 ${Math.min(step, 3)} / 3`} />;
  const backBtn = (to: number) => (
    <button type="button" className="btn-back" onClick={() => (to === 0 ? onCancel?.() : setStep(to))}>← 이전</button>
  );

  if (created) {
    return (
      <div className="app">
        {header}
        <div className="center">
          <div className="large-emoji" aria-hidden="true">🎉</div>
          <h2>첫 하루가 준비됐어요</h2>
          <p>{created.name} · {created.level >= 3 ? '내가 계획해요' : '내가 골라요'}</p>
          <div className="hero">
            <h3>월–금 할 일 {chosen.length}개</h3>
            <p>평일 자유시간 {created.weekdayFreeMin}분 · 부모 확인 후 해제</p>
          </div>
          <button type="button" className="btn-main" onClick={() => onDone(created, false)}>시작 화면으로</button>
          <button type="button" className="btn-secondary" onClick={() => onDone(created, true)}>아이 한 명 더 등록</button>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="app">
        {header}
        {onCancel && backBtn(0)}
        <div className="kicker">우리 가족</div>
        <h2>누구의 하루를<br />함께 시작할까요?</h2>
        <form onSubmit={(e) => {
          e.preventDefault();
          setUiStyle(age <= 7 ? 'quest' : 'planner');
          setStep(2);
        }}>
          <label className="label" htmlFor="child-name">아이 이름</label>
          <input id="child-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} required />
          <label className="label" htmlFor="child-age">아이 나이</label>
          <input id="child-age" type="number" min={3} max={18} value={age} onChange={(e) => setAge(Number(e.target.value))} required />
          <p>이름은 아이가 알아보기 쉬운 별명도 괜찮아요.</p>
          <button type="submit" className="btn-main">다음 · 자율권 정하기</button>
        </form>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="app">
        {header}
        {backBtn(1)}
        <div className="kicker">{name}에게 맞는 시작</div>
        <h2>무엇부터<br />스스로 해볼까요?</h2>
        <p>나이가 아닌 지금의 습관에 맞춰 골라요.</p>
        {[2, 3].map((v) => (
          <button key={v} type="button" className={`profile${level === v ? ' selected' : ''}`} aria-pressed={level === v} onClick={() => setLevel(v)}>
            <span className="symbol" aria-hidden="true">{v === 3 ? '🌿' : '🌱'}</span>
            <span><strong>{v === 3 ? '내가 계획해요' : '내가 골라요'}</strong><small>{v === 3 ? '순서와 예상시간을 아이가 정해요' : '할 일의 순서를 아이가 정해요'}</small></span>
          </button>
        ))}
        <label className="label">화면 모양</label>
        <div className="choices">
          <button type="button" className={`choice${uiStyle === 'quest' ? ' selected' : ''}`} aria-pressed={uiStyle === 'quest'} onClick={() => setUiStyle('quest')}>큰 퀘스트 카드</button>
          <button type="button" className={`choice${uiStyle === 'planner' ? ' selected' : ''}`} aria-pressed={uiStyle === 'planner'} onClick={() => setUiStyle('planner')}>차분한 플래너</button>
        </div>
        <div className="tip">언제든 바꿀 수 있어요. 레벨을 빨리 올릴 필요는 없어요.</div>
        <button type="button" className="btn-main" onClick={() => setStep(3)}>다음 · 첫 할 일 고르기</button>
      </div>
    );
  }

  const submit = async () => {
    const child = await save.run(() => api.addChild(requestId.current,
      { name, age, level, uiStyle, weekdayFreeMin: weekday, weekendFreeMin: weekend, approvalRequired: true },
      chosen.map((i) => ({ ...STARTER_TASKS[i], required: true, daysMask: 31 })), true), '아이를 등록했어요');
    if (child) setCreated(child);
  };

  return (
    <div className="app">
      {header}
      {backBtn(2)}
      <div className="kicker">매주 반복할 첫 할 일</div>
      <h2>작은 약속부터<br />시작해요</h2>
      <p>필요한 항목만 선택하세요. 나중에 자유롭게 수정할 수 있어요.</p>
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div className="panel">
          {STARTER_TASKS.map((t, i) => (
            <label key={t.title} className="check">
              <input type="checkbox" checked={chosen.includes(i)} onChange={(e) => setChosen(e.target.checked ? [...chosen, i].sort() : chosen.filter((x) => x !== i))} />
              {t.icon} {t.title} · {t.amount}
            </label>
          ))}
        </div>
        <div className="tip">선택한 할 일은 월–금 반복, 필수로 시작하고 오늘 할 일에도 넣어요.</div>
        <div className="pair">
          <div>
            <label className="label" htmlFor="reward">평일 자유시간 (분)</label>
            <input id="reward" type="number" min={0} max={180} value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} required />
          </div>
          <div>
            <label className="label" htmlFor="weekend">주말 자유시간 (분)</label>
            <input id="weekend" type="number" min={0} max={180} value={weekend} onChange={(e) => setWeekend(Number(e.target.value))} required />
          </div>
        </div>
        <label className="check"><input type="checkbox" checked disabled />완료 후 부모 확인 받기 <small>설정에서 바꿀 수 있어요</small></label>
        <SaveNotice state={save.state.kind === 'saved' ? { kind: 'idle' } : save.state} retry={submit} />
        <button type="submit" className="btn-main" disabled={save.saving}>{save.saving ? '설정을 저장하는 중…' : '우리 가족 설정 완료'}</button>
      </form>
    </div>
  );
}
