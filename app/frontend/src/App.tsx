import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, errorMessage } from './sync/api';
import type { FamilyView, Me } from './sync/api';
import { ChildApp } from './ui/ChildApp';
import { ModeSelect, PinRecover, PinScreen } from './ui/ModeSelect';
import { ParentApp } from './ui/ParentApp';
import { AuthScreen, ChildWizard, PinSetup } from './ui/Setup';
import { Header } from './ui/common';

type Screen =
  | { k: 'loading' }
  | { k: 'error'; text: string }
  | { k: 'auth' }
  | { k: 'setup-pin' }
  | { k: 'setup-child' }
  | { k: 'select' }
  | { k: 'pin' }
  | { k: 'recover' }
  | { k: 'child'; id: number }
  | { k: 'parent' };

/** 이 기기에서 마지막으로 쓴 아이 (새로 열면 그 아이 화면으로. 데이터는 서버에서) */
const LAST_CHILD = 'sseuro-last-child';
const lastChild = {
  get: () => {
    try {
      return Number(localStorage.getItem(LAST_CHILD)) || null;
    } catch {
      return null;
    }
  },
  set: (id: number | null) => {
    try {
      if (id) localStorage.setItem(LAST_CHILD, String(id));
      else localStorage.removeItem(LAST_CHILD);
    } catch {
      /* 저장 안 돼도 동작 */
    }
  },
};

export default function App() {
  const [screen, setScreen] = useState<Screen>({ k: 'loading' });
  const [me, setMe] = useState<Me | null>(null);
  const [family, setFamily] = useState<FamilyView | null>(null);
  const [wizardKey, setWizardKey] = useState(0);

  /** 로그인 상태 · 가족 정보로 첫 화면을 정한다 */
  const route = useCallback(async (m: Me) => {
    setMe(m);
    const f = await api.family();
    setFamily(f);
    if (!m.pinSet) return setScreen(m.parentMode ? { k: 'setup-pin' } : { k: 'recover' });
    if (f.children.length === 0) return setScreen(m.parentMode ? { k: 'setup-child' } : { k: 'pin' });
    if (m.parentMode) return setScreen({ k: 'parent' });
    const last = lastChild.get();
    if (last && f.children.some((c) => c.id === last)) return setScreen({ k: 'child', id: last });
    setScreen({ k: 'select' });
  }, []);

  const boot = useCallback(async () => {
    setScreen({ k: 'loading' });
    try {
      await route(await api.me());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setScreen({ k: 'auth' });
      else setScreen({ k: 'error', text: errorMessage(e) });
    }
  }, [route]);

  useEffect(() => {
    void boot();
  }, [boot]);

  /** 아이 모드로: 서버의 부모 모드를 먼저 잠근다 */
  const toChildMode = useCallback(async () => {
    setScreen({ k: 'select' }); // 부모 화면을 먼저 닫는다 (잠금 뒤 늦게 도착한 부모 응답이 PIN 화면을 띄우지 않게)
    lastChild.set(null);
    try {
      setMe(await api.lock());
    } catch {
      /* 잠금 요청이 실패해도 부모 모드는 20분 뒤 서버에서 자동으로 잠긴다 */
    }
    const f = await api.family().catch(() => null);
    if (f) setFamily(f);
  }, []);

  switch (screen.k) {
    case 'loading':
      return <div className="app"><Header /><p role="status">불러오는 중…</p></div>;
    case 'error':
      return (
        <div className="app">
          <Header />
          <div className="tip warm" role="alert"><strong>서버에 연결하지 못했어요</strong><p>{screen.text}</p>
            <button type="button" className="btn-secondary" onClick={() => void boot()}>다시 시도</button></div>
        </div>
      );
    case 'auth':
      return <AuthScreen onDone={(m) => void route(m).catch((e) => setScreen({ k: 'error', text: errorMessage(e) }))} />;
    case 'setup-pin':
      return <PinSetup onDone={(m) => void route(m)} />;
    case 'setup-child':
      return <ChildWizard key={wizardKey} onDone={async (_c, another) => {
        setFamily(await api.family());
        if (another) setWizardKey((k) => k + 1);
        else setScreen({ k: 'parent' });
      }} />;
    case 'select':
      return <ModeSelect family={family!} onParent={() => setScreen(me?.parentMode ? { k: 'parent' } : { k: 'pin' })}
        onChild={(id) => { lastChild.set(id); setScreen({ k: 'child', id }); }} />;
    case 'pin':
      return <PinScreen onBack={() => setScreen({ k: 'select' })} onForgot={() => setScreen({ k: 'recover' })}
        onUnlocked={(m) => void route(m)} />;
    case 'recover':
      return <PinRecover title={me?.pinSet ? undefined : '부모 PIN 을\n설정해 주세요'} onBack={() => setScreen(me?.pinSet ? { k: 'pin' } : { k: 'auth' })}
        onDone={(m) => void route(m)} />;
    case 'child': {
      const child = family?.children.find((c) => c.id === screen.id);
      if (!child) {
        lastChild.set(null);
        return <ModeSelect family={family!} onParent={() => setScreen({ k: 'pin' })} onChild={(id) => setScreen({ k: 'child', id })} />;
      }
      return <ChildApp key={child.id} child={child} onSwitch={() => { lastChild.set(null); setScreen({ k: 'select' }); }} />;
    }
    case 'parent':
      return <ParentApp me={me!} family={family!} onFamily={setFamily} onChildMode={() => void toChildMode()}
        onLocked={() => {
          setMe((m) => (m ? { ...m, parentMode: false } : m));
          setScreen((s) => (s.k === 'parent' ? { k: 'pin' } : s));
        }}
        onLogout={async () => {
          await api.logout().catch(() => null);
          lastChild.set(null);
          setMe(null);
          setScreen({ k: 'auth' });
        }} />;
  }
}
