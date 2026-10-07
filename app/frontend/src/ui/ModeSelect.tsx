import { useState } from 'react';
import { api } from '../sync/api';
import type { FamilyView, Me } from '../sync/api';
import { LEVELS } from '../policy';
import { Header, SaveNotice, useSave } from './common';
import { PinFields } from './Setup';

/** 누가 시작할까요? — 아이 선택 · 부모 모드 (공용 태블릿에서도 아이마다 기록이 나뉜다) */
export function ModeSelect({ family, onChild, onParent }: { family: FamilyView; onChild: (id: number) => void; onParent: () => void }) {
  return (
    <div className="app">
      <Header badge={family.name} />
      <div className="kicker">누가 시작할까요?</div>
      <h2>내 이름을 골라요</h2>
      {family.children.length === 0 && <p>아직 등록된 아이가 없어요. 부모 모드에서 아이를 등록해 주세요.</p>}
      {family.children.map((c) => (
        <button key={c.id} type="button" className="profile" onClick={() => onChild(c.id)}>
          <span className="symbol" aria-hidden="true">{c.uiStyle === 'quest' ? '🌱' : '🌿'}</span>
          <span><strong>{c.name}</strong><small>{LEVELS[c.level]?.short ?? `Lv.${c.level}`}</small></span>
        </button>
      ))}
      <hr className="rule" />
      <button type="button" className="btn-secondary" onClick={onParent}>🔒 부모 모드로 들어가기</button>
      <p>공용 태블릿에서도 아이마다 기록이 분리돼요.</p>
    </div>
  );
}

/** 부모 PIN 입력. 틀린 횟수 · 잠금은 서버가 가족 단위로 센다 */
export function PinScreen({ onUnlocked, onBack, onForgot }: { onUnlocked: (me: Me) => void; onBack: () => void; onForgot: () => void }) {
  const [pin, setPin] = useState('');
  const save = useSave();
  return (
    <div className="app">
      <Header badge="부모 모드" />
      <button type="button" className="btn-back" onClick={onBack}>← 아이 선택</button>
      <div className="center">
        <div className="large-emoji" aria-hidden="true">🔒</div>
        <h2>부모님이 맞나요?</h2>
        <p>부모 PIN 을 입력해 주세요.</p>
      </div>
      <form onSubmit={async (e) => {
        e.preventDefault();
        const me = await save.run(() => api.unlock(pin), '부모 모드를 열었어요');
        setPin('');
        if (me) onUnlocked(me);
      }}>
        <label className="label" htmlFor="parent-pin">숫자 4자리</label>
        <input id="parent-pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} required autoFocus />
        {save.state.kind === 'failed' && <div className="error" role="alert">{save.state.text}</div>}
        <button type="submit" className="btn-main" disabled={save.saving}>부모 모드 열기</button>
      </form>
      <button type="button" className="btn-quiet" onClick={onForgot}>PIN 을 잊었어요</button>
    </div>
  );
}

/** PIN 복구: 부모 계정 비밀번호로 본인 확인 → 새 PIN */
export function PinRecover({ onDone, onBack, title = '부모 계정으로\n다시 확인해요' }: { onDone: (me: Me) => void; onBack: () => void; title?: string }) {
  const [password, setPassword] = useState('');
  const save = useSave();
  return (
    <div className="app">
      <Header badge="부모 모드" />
      <button type="button" className="btn-back" onClick={onBack}>← PIN 입력</button>
      <div className="center">
        <div className="large-emoji" aria-hidden="true">🔑</div>
        <h2 style={{ whiteSpace: 'pre-line' }}>{title}</h2>
        <p>가입한 부모 계정 비밀번호로 본인 확인 후<br />새 PIN 을 설정할 수 있어요.</p>
      </div>
      <PinFields saving={save.saving} submitLabel="확인하고 새 PIN 저장" extra={
        <>
          <label className="label" htmlFor="account-password">부모 계정 비밀번호</label>
          <input id="account-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </>
      } onSubmit={async (pin) => {
        const me = await save.run(() => api.resetPin(password, pin), '새 PIN 을 저장했어요');
        if (me) onDone(me);
      }} />
      <SaveNotice state={save.state.kind === 'saved' ? { kind: 'idle' } : save.state} />
    </div>
  );
}
