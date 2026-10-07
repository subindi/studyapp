import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, errorMessage, newRequestId } from '../sync/api';
import type { AdjustAction, Child, ChildSettings, DayView, FamilyView, Me, Overview, Report, Routine, RoutineInput, Task } from '../sync/api';
import {
  DAY_NAMES, ICONS, LEVELS, addDays, clock, dayTitle, daysLabel, levelName, mondayOf, moodLabel, parentBadge,
} from '../policy';
import { ErrorText, Header, ProgressBar, SaveNotice, TaskRow, useSave } from './common';
import { ChildWizard, PinFields } from './Setup';

type Page =
  | { k: 'today' }
  | { k: 'detail'; childId: number }
  | { k: 'adjust'; childId: number; taskId: number }
  | { k: 'routines' }
  | { k: 'routine-form'; routine: Routine | null }
  | { k: 'report' }
  | { k: 'settings' }
  | { k: 'add-child' }
  | { k: 'pin' };

type Menu = 'today' | 'routines' | 'report' | 'settings';
const MENU: [Menu, string][] = [['today', '오늘'], ['routines', '할 일'], ['report', '성장'], ['settings', '설정']];

function menuOf(p: Page): Menu {
  if (p.k === 'detail' || p.k === 'adjust') return 'today';
  if (p.k === 'routine-form') return 'routines';
  if (p.k === 'add-child' || p.k === 'pin') return 'settings';
  return p.k;
}

/**
 * 부모 화면 (모바일 · 태블릿 · PC 같은 데이터). 모든 요청은 서버가 부모 모드인지 다시 확인한다.
 * 서버가 PARENT_LOCKED 를 돌려주면 PIN 화면으로 돌아간다.
 */
export function ParentApp({ me, family, onFamily, onChildMode, onLocked, onLogout }: {
  me: Me;
  family: FamilyView;
  onFamily: (f: FamilyView) => void;
  onChildMode: () => void;
  onLocked: () => void;
  onLogout: () => void;
}) {
  const [page, setPage] = useState<Page>({ k: 'today' });
  const [childId, setChildId] = useState<number | null>(family.children[0]?.id ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const child = family.children.find((c) => c.id === childId) ?? family.children[0] ?? null;

  /** 부모 API 공통 오류 처리 */
  const guard = useCallback(<T,>(p: Promise<T>): Promise<T> => p.catch((e) => {
    if (e instanceof ApiError && e.code === 'PARENT_LOCKED') onLocked();
    throw e;
  }), [onLocked]);

  const reloadFamily = useCallback(async () => onFamily(await api.family()), [onFamily]);

  const go = (p: Page, msg: string | null = null) => {
    setNotice(msg);
    setPage(p);
    window.scrollTo?.({ top: 0 });
  };

  const picker = family.children.length > 1 && (
    <div className="choices" role="group" aria-label="아이 선택">
      {family.children.map((c) => (
        <button key={c.id} type="button" className={`choice${child?.id === c.id ? ' selected' : ''}`} aria-pressed={child?.id === c.id} onClick={() => setChildId(c.id)}>{c.name}</button>
      ))}
    </div>
  );

  const menuButtons = (cls?: string) => MENU.map(([k, label]) => (
    <button key={k} type="button" className={cls} aria-current={menuOf(page) === k ? 'page' : undefined} onClick={() => go({ k } as Page)}>{label}</button>
  ));

  let body: ReactNode = null;
  const noChild = !child && page.k !== 'add-child' && page.k !== 'settings' && page.k !== 'pin';
  if (noChild) {
    body = (
      <div className="empty">
        <div className="large-emoji" aria-hidden="true">🌱</div>
        <h3>아직 등록된 아이가 없어요</h3>
        <button type="button" className="btn-main" onClick={() => go({ k: 'add-child' })}>아이 등록하기</button>
      </div>
    );
  } else if (page.k === 'today') {
    body = <TodayPage guard={guard} onDetail={(id) => { setChildId(id); go({ k: 'detail', childId: id }); }} notice={notice} />;
  } else if (page.k === 'detail') {
    body = <DetailPage guard={guard} childId={page.childId} onBack={() => go({ k: 'today' })}
      onAdjust={(taskId) => go({ k: 'adjust', childId: page.childId, taskId })} />;
  } else if (page.k === 'adjust') {
    body = <AdjustPage guard={guard} childId={page.childId} taskId={page.taskId} onBack={() => go({ k: 'detail', childId: page.childId })} />;
  } else if (page.k === 'routines' && child) {
    body = <RoutinesPage guard={guard} child={child} picker={picker} notice={notice} onEdit={(r) => go({ k: 'routine-form', routine: r })} />;
  } else if (page.k === 'routine-form' && child) {
    body = <RoutineForm guard={guard} child={child} routine={page.routine} onBack={() => go({ k: 'routines' })} onSaved={(msg) => go({ k: 'routines' }, msg)} />;
  } else if (page.k === 'report' && child) {
    body = <ReportPage guard={guard} child={child} picker={picker} />;
  } else if (page.k === 'settings') {
    body = <SettingsPage guard={guard} me={me} family={family} child={child} picker={picker} notice={notice}
      onSaved={async (msg) => { await reloadFamily(); setNotice(msg); }}
      onAddChild={() => go({ k: 'add-child' })} onPin={() => go({ k: 'pin' })} onChildMode={onChildMode} onLogout={onLogout} />;
  } else if (page.k === 'add-child') {
    body = <ChildWizard step="아이 추가" onCancel={() => go({ k: 'settings' })} onDone={async (c, another) => {
      await reloadFamily();
      setChildId(c.id);
      if (another) go({ k: 'settings' }, `${c.name}을(를) 등록했어요.`);
      else go({ k: 'today' }, `${c.name}을(를) 등록했어요.`);
    }} />;
  } else if (page.k === 'pin') {
    body = <PinChange guard={guard} onDone={() => go({ k: 'settings' }, '부모 PIN 을 바꿨어요.')} onBack={() => go({ k: 'settings' })} />;
  }

  // 아이 등록 마법사는 자체 화면 틀을 쓴다
  if (page.k === 'add-child') return <div className="parent-shell"><aside className="sidebar"><span className="brand">스스로 🌱</span></aside><div>{body}</div></div>;

  return (
    <div className="parent-shell">
      <aside className="sidebar" aria-label="부모 메뉴">
        <span className="brand">스스로 🌱</span>
        <p>{family.name}</p>
        <nav className="menu">{menuButtons()}</nav>
        <div className="note">부모 화면은 잠시 쓰지 않으면 다시 잠겨요.</div>
        <button type="button" className="btn-secondary" onClick={onChildMode}>🔒 아이 모드로 전환</button>
      </aside>
      <div className="app">
        <Header badge="부모 모드"><button type="button" className="btn-small" onClick={onChildMode}>🔒 잠그기</button></Header>
        {body}
        <nav className="nav mobile" aria-label="부모 메뉴">{menuButtons()}</nav>
      </div>
    </div>
  );
}

type Guard = <T>(p: Promise<T>) => Promise<T>;

// ---------------------------------------------------------------- 오늘 (아이별 요약)

function TodayPage({ guard, onDetail, notice }: { guard: Guard; onDetail: (id: number) => void; notice: string | null }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => guard(api.overview()).then((d) => alive && (setData(d), setError(null)), (e) => alive && setError(errorMessage(e)));
    load();
    const id = window.setInterval(() => document.visibilityState === 'visible' && load(), 15000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [guard]);
  return (
    <>
      <div className="kicker">{data ? dayTitle(data.today) : '오늘'}</div>
      <h2>아이의 하루를<br />함께 확인해요</h2>
      <p>할 일을 마친 뒤 한 번 확인해 주세요.</p>
      {notice && <div className="tip" role="status">{notice}</div>}
      {error && <div className="tip warm" role="alert">{error}</div>}
      {!data && !error && <p role="status">불러오는 중…</p>}
      <div className="parent-grid">
        {data?.children.map((c) => (
          <div key={c.child.id} className="panel">
            <div className="row"><h3>{c.child.name}</h3><span className={`badge${c.free.state === 'waiting' || (c.free.state === 'rest' && c.free.requested) ? ' warm' : ''}`}>{parentBadge(c.free)}</span></div>
            <p>{levelName(c.child.level)}{c.planned ? ' · 오늘 순서를 정했어요' : ''}</p>
            <ProgressBar done={c.progress.done} total={c.progress.total} />
            {c.help.length > 0 && <div className="tip warm">🙋 도움 요청 {c.help.length}건 · {c.help[0].taskTitle}</div>}
            <button type="button" className="btn-secondary" onClick={() => onDetail(c.child.id)}>
              {c.free.state === 'waiting' || c.free.state === 'rest' ? '완료 확인하기' : '오늘 할 일 보기'}
            </button>
          </div>
        ))}
      </div>
      <div className="tip">알림: 도움 요청과 확인 대기는 이 화면에서 자동으로 새로 고쳐 보여요. 휴대폰 푸시 알림은 아직 연결 전이에요.</div>
    </>
  );
}

// ---------------------------------------------------------------- 아이의 오늘 상세

function useDay(guard: Guard, childId: number) {
  const [view, setView] = useState<DayView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => guard(api.today(childId)).then((v) => (setView(v), setError(null)), (e) => setError(errorMessage(e))), [guard, childId]);
  useEffect(() => {
    void load();
  }, [load]);
  return { view, setView, error, setError, load };
}

function DetailPage({ guard, childId, onBack, onAdjust }: { guard: Guard; childId: number; onBack: () => void; onAdjust: (taskId: number) => void }) {
  const { view, setView, error } = useDay(guard, childId);
  const save = useSave();
  const act = async (fn: () => Promise<DayView>, text: string) => {
    const v = await save.run(() => guard(fn()), text);
    if (v) setView(v);
  };
  if (!view) return <>{<button type="button" className="btn-back" onClick={onBack}>← 오늘로</button>}<p role={error ? 'alert' : 'status'}>{error ?? '불러오는 중…'}</p></>;
  const c = view.child;
  const allDone = view.progress.total > 0 && view.progress.done === view.progress.total;
  const approvable = allDone || view.progress.total === 0;
  const issued = ['ready', 'running', 'paused', 'used'].includes(view.free.state);
  return (
    <>
      <button type="button" className="btn-back" onClick={onBack}>← 오늘로</button>
      <div className="kicker">{c.name}의 오늘 · {dayTitle(view.day)}</div>
      <h2>{allDone ? '오늘의 약속을 마쳤어요' : view.progress.total === 0 ? '오늘은 필수 할 일이 없어요' : '차근차근 하고 있어요'}</h2>
      <div className="detail-grid">
        <div>
          <ProgressBar done={view.progress.done} total={view.progress.total} />
          <div className="list">
            {view.tasks.length === 0 && <p>오늘 할 일이 없어요.</p>}
            {view.tasks.map((t) => (
              <TaskRow key={t.id} task={t} detail={taskDetail(t)} action={<button type="button" className="btn-quiet" onClick={() => onAdjust(t.id)}>조정</button>} />
            ))}
          </div>
        </div>
        <div>
          {view.help.map((h) => (
            <div key={h.id} className="tip warm">
              <strong>🙋 {h.taskTitle}</strong>
              <p>{h.reason}</p>
              <button type="button" className="btn-secondary" disabled={save.saving} onClick={() => void act(() => api.resolveHelp(c.id, h.id), '도움 요청을 처리했어요')}>함께 확인했어요</button>
            </div>
          ))}
          <div className="reward">
            <div className="row"><span>오늘 자유시간</span><strong>{view.free.minutes}분</strong></div>
            <small>
              {issued ? `이용권 발급됨 · ${view.free.state === 'used' ? '다 썼어요' : `남은 시간 ${clock(view.free.remainingSec)}`}`
                : view.progress.total === 0 ? `필수 할 일이 없는 날은 부모님이 확인해야 열려요${view.free.requested ? ' · 아이가 요청했어요' : ''}`
                : c.approvalRequired ? '필수 할 일 완료 후 부모 확인' : '필수 할 일 완료 후 자동 해제'}
            </small>
          </div>
          {!issued && (c.approvalRequired || view.progress.total === 0) && (
            <button type="button" className="btn-main" disabled={!approvable || view.free.approved || save.saving}
              onClick={() => void act(() => api.approve(c.id), '확인했어요. 자유시간이 열렸어요')}>
              {view.free.approved ? '확인 완료 · 자유시간 열림' : `확인했어요 · ${view.free.minutes}분 열어주기`}
            </button>
          )}
          {!approvable && <p>남은 필수 할 일을 완료하거나 오늘만 조정하면 확인할 수 있어요.</p>}
          <SaveNotice state={save.state} />
          <div className="tip">면제 · 이동은 완료 횟수에 더하지 않아요. 이미 받은 자유시간은 유지돼요.</div>
        </div>
      </div>
    </>
  );
}

function taskDetail(t: Task): string {
  const parts: string[] = [];
  parts.push({ ready: '아직 시작 전', active: '하고 있어요', paused: '잠깐 쉬는 중', done: t.doneBy === 'parent' ? '완료 인정' : '완료', waived: '오늘만 면제', moved: `${t.movedTo ?? '다른 날'}로 이동` }[t.status]);
  if (t.elapsedSec > 0) parts.push(`쓴 시간 ${clock(t.elapsedSec)}`);
  if (t.movedIn) parts.push('어제에서 옮겨 옴');
  if (t.adjustReason) parts.push(t.adjustReason);
  return parts.join(' · ');
}

// ---------------------------------------------------------------- 오늘만 조정

function AdjustPage({ guard, childId, taskId, onBack }: { guard: Guard; childId: number; taskId: number; onBack: () => void }) {
  const { view } = useDay(guard, childId);
  const task = view?.tasks.find((t) => t.id === taskId);
  const [amount, setAmount] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = useSave();
  if (!view) return <p role="status">불러오는 중…</p>;
  if (!task) return <><button type="button" className="btn-back" onClick={onBack}>← 오늘 할 일로</button><p>오늘 할 일에서 찾을 수 없어요.</p></>;
  const run = async (action: AdjustAction) => {
    setError(null);
    const value = (amount ?? task.amount).trim();
    if (action === 'amount' && !value) return setError('오늘 분량을 입력해 주세요.');
    const r = await save.run(() => guard(api.adjust(childId, taskId, action, action === 'amount' ? value : undefined, reason.trim() || undefined)));
    if (r) onBack();
  };
  const s = task.status;
  return (
    <>
      <button type="button" className="btn-back" onClick={onBack}>← 오늘 할 일로</button>
      <div className="kicker">오늘만 조정 · {view.child.name}</div>
      <h2>{task.title}</h2>
      <p>반복 일정은 그대로 두고 오늘만 바꿔요.</p>
      <label className="label" htmlFor="adjust-amount">오늘 분량</label>
      <input id="adjust-amount" value={amount ?? task.amount} onChange={(e) => setAmount(e.target.value)} maxLength={60} />
      <label className="label" htmlFor="adjust-reason">조정 이유 <small>선택</small></label>
      <input id="adjust-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={60} placeholder="몸이 안 좋아서, 오늘 숙제가 많아서" />
      <ErrorText text={error} />
      <div className="list">
        <button type="button" className="btn-secondary" disabled={save.saving} onClick={() => void run('amount')}>분량 변경하기</button>
        {s !== 'waived' && s !== 'moved' && s !== 'done' && <button type="button" className="btn-secondary" disabled={save.saving} onClick={() => void run('waive')}>오늘만 면제</button>}
        {s !== 'moved' && s !== 'done' && <button type="button" className="btn-secondary" disabled={save.saving} onClick={() => void run('move')}>내일로 이동</button>}
        {s !== 'done' && s !== 'moved' && <button type="button" className="btn-secondary" disabled={save.saving} onClick={() => void run('recognize')}>완료로 인정하기</button>}
        {(s === 'done' || s === 'waived' || s === 'moved') && <button type="button" className="btn-secondary" disabled={save.saving} onClick={() => void run('restore')}>다시 할 일로 되돌리기</button>}
      </div>
      <SaveNotice state={save.state.kind === 'saved' ? { kind: 'idle' } : save.state} />
      <div className="tip">면제 · 이동은 완료 횟수에 더하지 않아요. 이미 받은 자유시간은 유지돼요.{s === 'done' && ' 완료를 되돌리면 아직 받지 않은 자유시간은 조건을 다시 확인해요.'}</div>
    </>
  );
}

// ---------------------------------------------------------------- 반복 할 일

function RoutinesPage({ guard, child, picker, notice, onEdit }: { guard: Guard; child: Child; picker: ReactNode; notice: string | null; onEdit: (r: Routine | null) => void }) {
  const [list, setList] = useState<Routine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setList(null);
    guard(api.routines(child.id)).then(setList, (e) => setError(errorMessage(e)));
  }, [guard, child.id]);
  return (
    <>
      <div className="kicker">한 번 설정하면 매주 반복</div>
      <h2>{child.name}의 할 일 관리</h2>
      {picker}
      {notice && <div className="tip" role="status">{notice}</div>}
      {error && <div className="tip warm" role="alert">{error}</div>}
      <div className="list">
        {list?.length === 0 && <p>아직 반복 할 일이 없어요.</p>}
        {list?.map((r) => (
          <div key={r.id} className="task">
            <span className="emoji" aria-hidden="true">{r.icon}</span>
            <div className="copy"><strong>{r.title}</strong><small>{r.amount} · {r.required ? '필수' : '선택'} · {daysLabel(r.daysMask)} · 예상 {r.estimateMin}분</small></div>
            <button type="button" className="btn-quiet" onClick={() => onEdit(r)}>수정</button>
          </div>
        ))}
      </div>
      <button type="button" className="btn-main" onClick={() => onEdit(null)}>+ 반복 할 일 추가</button>
      <div className="tip">기존 반복 일정 변경은 다음 생성일부터 적용돼요. 오늘 할 일은 '오늘' 화면에서 조정해요.</div>
    </>
  );
}

function RoutineForm({ guard, child, routine, onBack, onSaved }: { guard: Guard; child: Child; routine: Routine | null; onBack: () => void; onSaved: (msg: string) => void }) {
  const requestId = useRef(newRequestId());
  const [f, setF] = useState<RoutineInput>(() => routine ?? { icon: '📖', title: '', amount: '', estimateMin: 15, required: true, daysMask: 31 });
  const [addToday, setAddToday] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useSave();
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!f.title.trim() || !f.amount.trim() || !f.daysMask || f.estimateMin < 1 || f.estimateMin > 180) {
      return setError('이름, 분량, 1–180분 예상시간과 반복 요일을 확인해 주세요.');
    }
    setError(null);
    const body = { ...f, title: f.title.trim(), amount: f.amount.trim() };
    const r = await save.run(() => guard(routine ? api.updateRoutine(child.id, routine.id, body) : api.addRoutine(child.id, requestId.current, body, addToday)));
    if (r) onSaved(routine ? '반복 일정을 저장했어요. 다음 생성일부터 적용돼요.' : '반복 할 일을 추가했어요.');
  };
  return (
    <>
      <button type="button" className="btn-back" onClick={onBack}>← 할 일 목록</button>
      <div className="kicker">{child.name} · 반복 할 일</div>
      <h2>{routine ? '반복 일정 수정' : '새 할 일 만들기'}</h2>
      <form onSubmit={submit}>
        <label className="label" htmlFor="task-name">할 일 이름</label>
        <input id="task-name" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="예: 한글책 읽기" maxLength={60} required />
        <label className="label" htmlFor="task-amount">분량</label>
        <input id="task-amount" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="예: 3권, 2장, 20분" maxLength={60} required />
        <div className="pair">
          <div>
            <label className="label" htmlFor="task-icon">아이콘</label>
            <select id="task-icon" value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })}>
              {Array.from(new Set([...ICONS, f.icon])).map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="task-est">기본 예상시간 (분)</label>
            <input id="task-est" type="number" min={1} max={180} value={f.estimateMin} onChange={(e) => setF({ ...f, estimateMin: Number(e.target.value) })} required />
          </div>
        </div>
        <span className="label" id="days-label">반복 요일</span>
        <div className="dayset" role="group" aria-labelledby="days-label">
          {DAY_NAMES.map((d, i) => (
            <label key={d}>{d}
              <input type="checkbox" aria-label={`${d}요일`} checked={(f.daysMask & (1 << i)) !== 0} onChange={(e) => setF({ ...f, daysMask: e.target.checked ? f.daysMask | (1 << i) : f.daysMask & ~(1 << i) })} />
            </label>
          ))}
        </div>
        <label className="check"><input type="checkbox" checked={f.required} onChange={(e) => setF({ ...f, required: e.target.checked })} />자유시간 해제에 필요한 필수 할 일</label>
        {!routine && <label className="check"><input type="checkbox" checked={addToday} onChange={(e) => setAddToday(e.target.checked)} />오늘 할 일에도 추가</label>}
        <div className="tip">사진 인증은 넣지 않았어요. 아이의 자기확인 후 하루 단위로 부모님이 확인해요.</div>
        <ErrorText text={error} />
        <SaveNotice state={save.state.kind === 'saved' ? { kind: 'idle' } : save.state} retry={() => void submit()} />
        <button type="submit" className="btn-main" disabled={save.saving}>{save.saving ? '저장하는 중…' : routine ? '반복 일정 저장' : '할 일 추가하기'}</button>
      </form>
      {routine && (confirmDelete ? (
        <div className="tip warm">
          <strong>반복을 끝낼까요?</strong>
          <p>다음 생성일부터 만들지 않아요. 오늘 할 일과 지난 기록은 남아요.</p>
          <button type="button" className="btn-secondary btn-danger" disabled={save.saving} onClick={async () => {
            const ok = await save.run(() => guard(api.deleteRoutine(child.id, routine.id)).then(() => true));
            if (ok) onSaved('반복을 끝냈어요.');
          }}>네, 반복 끝내기</button>
          <button type="button" className="btn-quiet" onClick={() => setConfirmDelete(false)}>취소</button>
        </div>
      ) : <button type="button" className="btn-quiet btn-danger" onClick={() => setConfirmDelete(true)}>반복 끝내기</button>)}
    </>
  );
}

// ---------------------------------------------------------------- 성장 리포트

function ReportPage({ guard, child, picker }: { guard: Guard; child: Child; picker: ReactNode }) {
  const [from, setFrom] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setReport(null);
    guard(api.report(child.id, from ?? undefined)).then((r) => (setReport(r), setError(null)), (e) => setError(errorMessage(e)));
  }, [guard, child.id, from]);
  const recorded = report?.days.filter((d) => d.recorded) ?? [];
  const sum = (k: 'requiredDone' | 'requiredTotal' | 'optionalDone' | 'excused' | 'studySec') => recorded.reduce((a, d) => a + d[k], 0);
  const start = report?.from ?? (from ?? mondayOf(new Date().toISOString().slice(0, 10)));
  return (
    <>
      <div className="kicker">{report ? `${dayTitle(report.from).replace(/ .요일$/, '')}–${dayTitle(report.to).replace(/ .요일$/, '')}` : '이번 주'}</div>
      <h2>성장은 천천히 쌓여요</h2>
      {picker}
      <div className="row">
        <button type="button" className="btn-small" onClick={() => setFrom(addDays(start, -7))}>← 지난주</button>
        <button type="button" className="btn-small" onClick={() => setFrom(addDays(start, 7))}>다음 주 →</button>
      </div>
      {error && <div className="tip warm" role="alert">{error}</div>}
      {!report && !error && <p role="status">불러오는 중…</p>}
      {report && (recorded.length === 0 ? (
        <div className="empty">
          <div className="large-emoji" aria-hidden="true">🌱</div>
          <h3>{child.name}의 기록이 아직 없어요</h3>
          <p>실제 기록이 쌓이면 주간 변화가 보여요.<br />아이들끼리 비교하지 않아요.</p>
        </div>
      ) : (
        <>
          <div className="week" aria-label="요일별 필수 완료">
            {report.days.map((d) => (
              <div key={d.day} className={d.recorded ? '' : 'none'}>
                {DAY_NAMES[(new Date(`${d.day}T00:00:00Z`).getUTCDay() + 6) % 7]}
                <strong>{d.recorded ? `${d.requiredDone}/${d.requiredTotal}` : '–'}</strong>
                {d.recorded ? (d.mood ? moodLabel(d.mood).slice(0, 2) : '') : '기록 없음'}
              </div>
            ))}
          </div>
          <div className="panel">
            <h3>{child.name}의 이번 주 ({recorded.length}일 기록)</h3>
            <p>필수 할 일 {sum('requiredDone')} / {sum('requiredTotal')}개 완료 · 선택 할 일 {sum('optionalDone')}개 · 면제 · 이동 {sum('excused')}개 (완료에 넣지 않음)</p>
            <p>스스로 순서를 정한 날 {recorded.filter((d) => d.planned).length}일 · 타이머로 기록한 시간 {Math.round(sum('studySec') / 60)}분</p>
            {recorded.filter((d) => d.note).map((d) => <div key={d.day} className="tip">{dayTitle(d.day)} · {moodLabel(d.mood)}<br />{d.note}</div>)}
          </div>
          {recorded.length < 3 && <div className="tip">첫 주를 쌓고 있어요. 기록이 적을 때는 변화보다 오늘 한 일에 집중해 주세요.</div>}
        </>
      ))}
      <div className="tip">부모 도움 없이 시작했는지는 타이머만으로 판단하지 않아요. 아이 · 부모가 남긴 확인 기록을 사용해요. 형제 비교 · 순위 · 연속 기록은 보여 주지 않아요.</div>
    </>
  );
}

// ---------------------------------------------------------------- 설정

function SettingsPage({ guard, me, family, child, picker, notice, onSaved, onAddChild, onPin, onChildMode, onLogout }: {
  guard: Guard;
  me: Me;
  family: FamilyView;
  child: Child | null;
  picker: ReactNode;
  notice: string | null;
  onSaved: (msg: string) => Promise<void>;
  onAddChild: () => void;
  onPin: () => void;
  onChildMode: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      <div className="kicker">아이마다 다른 자율권</div>
      <h2>설정</h2>
      {notice && <div className="tip" role="status">{notice}</div>}
      {child && (
        <>
          {picker}
          <ChildSettingsForm key={child.id} guard={guard} child={child} onSaved={onSaved} />
        </>
      )}
      <button type="button" className="btn-secondary" onClick={onAddChild}>+ 아이 등록</button>
      <div className="panel">
        <h3>기기 이용 안내</h3>
        <p>자유시간은 앱 안의 이용권 타이머예요. 실제 게임 · 영상 앱 제한은 연결되어 있지 않아요.</p>
      </div>
      <div className="panel">
        <h3>부모 계정</h3>
        <p>{me.displayName} · {me.email} · {family.name}</p>
        <button type="button" className="btn-secondary" onClick={onPin}>부모 PIN 바꾸기</button>
        <button type="button" className="btn-secondary" onClick={onChildMode}>🔒 아이 모드로 전환 · 부모 화면 잠그기</button>
        <button type="button" className="btn-quiet" onClick={onLogout}>이 기기에서 로그아웃</button>
      </div>
    </>
  );
}

function ChildSettingsForm({ guard, child, onSaved }: { guard: Guard; child: Child; onSaved: (msg: string) => Promise<void> }) {
  const [s, setS] = useState<ChildSettings>({ ...child });
  const save = useSave();
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const r = await save.run(() => guard(api.updateChild(child.id, s)), '아이 설정을 저장했어요');
    if (r) await onSaved('아이 설정을 저장했어요. 이미 시작한 오늘 이용권에는 바뀐 시간이 적용되지 않아요.');
  };
  return (
    <form onSubmit={submit}>
      <div className="pair">
        <div>
          <label className="label" htmlFor="child-name">이름</label>
          <input id="child-name" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} maxLength={20} required />
        </div>
        <div>
          <label className="label" htmlFor="child-age">나이</label>
          <input id="child-age" type="number" min={3} max={18} value={s.age} onChange={(e) => setS({ ...s, age: Number(e.target.value) })} required />
        </div>
      </div>
      <label className="label" htmlFor="child-level">자기주도 단계</label>
      <select id="child-level" value={s.level} onChange={(e) => setS({ ...s, level: Number(e.target.value) })}>
        {[1, 2, 3].map((v) => <option key={v} value={v}>{LEVELS[v].name}</option>)}
      </select>
      <p>{LEVELS[s.level]?.desc} Lv.2는 순서 선택, Lv.3은 순서와 예상시간을 정해요.</p>
      <label className="label" htmlFor="child-style">화면 모양</label>
      <select id="child-style" value={s.uiStyle} onChange={(e) => setS({ ...s, uiStyle: e.target.value as ChildSettings['uiStyle'] })}>
        <option value="quest">큰 퀘스트 카드</option>
        <option value="planner">차분한 플래너</option>
      </select>
      <div className="pair">
        <div>
          <label className="label" htmlFor="weekday-time">평일 자유시간 (분)</label>
          <input id="weekday-time" type="number" min={0} max={180} value={s.weekdayFreeMin} onChange={(e) => setS({ ...s, weekdayFreeMin: Number(e.target.value) })} required />
        </div>
        <div>
          <label className="label" htmlFor="weekend-time">주말 자유시간 (분)</label>
          <input id="weekend-time" type="number" min={0} max={180} value={s.weekendFreeMin} onChange={(e) => setS({ ...s, weekendFreeMin: Number(e.target.value) })} required />
        </div>
      </div>
      <label className="check"><input type="checkbox" checked={s.approvalRequired} onChange={(e) => setS({ ...s, approvalRequired: e.target.checked })} />자유시간 전에 부모 확인 받기</label>
      <div className="tip">나이와 자기주도 단계는 별개예요. 아이와 함께 정해 주세요. 필수 할 일이 없는 날은 이 설정과 상관없이 부모님이 확인해요.</div>
      <SaveNotice state={save.state.kind === 'saved' ? { kind: 'idle' } : save.state} retry={() => void submit()} />
      <button type="submit" className="btn-main" disabled={save.saving}>{save.saving ? '저장하는 중…' : '설정 저장'}</button>
    </form>
  );
}

function PinChange({ guard, onDone, onBack }: { guard: Guard; onDone: () => void; onBack: () => void }) {
  const save = useSave();
  return (
    <>
      <button type="button" className="btn-back" onClick={onBack}>← 설정</button>
      <div className="kicker">부모 모드 보호</div>
      <h2>부모 PIN 바꾸기</h2>
      <PinFields saving={save.saving} submitLabel="새 PIN 저장" onSubmit={async (pin) => {
        if (await save.run(() => guard(api.setPin(pin)))) onDone();
      }} />
      <SaveNotice state={save.state.kind === 'saved' ? { kind: 'idle' } : save.state} />
    </>
  );
}

