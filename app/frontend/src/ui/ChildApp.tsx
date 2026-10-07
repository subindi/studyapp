import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, errorMessage, isNetworkError } from '../sync/api';
import type { Child, DayView, Mood, Report, Task } from '../sync/api';
import { Outbox, browserStore } from '../sync/outbox';
import {
  HELP_PARENT, HELP_REASONS, MOODS, STATUS_LABEL, callName, clock, dayTitle, freeMessage, isCounted, isFreeOpen, levelName,
  moodLabel, shownElapsed, shownRemaining, subjectName, withPending,
} from '../policy';
import { ErrorText, Header, OfflineNotice, ProgressBar, Ring, TaskRow, useNow, useOnline, useWide } from './common';
import { DragGhost, SlideToConfirm, SortableList, useDragToZone } from './drag';

type Page = 'today' | 'plan' | 'focus' | 'help' | 'hint' | 'asked' | 'finish' | 'done' | 'waiting' | 'free' | 'review' | 'growth';

const outbox = new Outbox(browserStore());
const ACTIVITIES = ['🎮 게임', '📺 영상', '🎨 그림'];

/** 아이 화면. 승윤(quest) · 시윤(planner) 모양은 달라도 같은 데이터와 정책을 쓴다 */
export function ChildApp({ child, onSwitch }: { child: Child; onSwitch: () => void }) {
  const [raw, setRaw] = useState<DayView | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [page, setPage] = useState<Page>('today');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [reason, setReason] = useState(0);
  const [pendingIds, setPendingIds] = useState<number[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const busy = useRef(false);
  const [busyFlag, setBusyFlag] = useState(false);
  const online = useOnline();
  const wide = useWide();
  const now = useNow();

  const readOutbox = useCallback(() => {
    const items = outbox.forChild(child.id);
    setPendingIds(items.flatMap((i) => (i.kind === 'complete' ? [i.taskId] : [])));
    setPendingCount(items.length);
  }, [child.id]);

  const accept = useCallback((v: DayView) => {
    setRaw(v);
    setFetchedAt(Date.now());
    setLoadError(null);
  }, []);

  /** 보내지 못한 기록을 먼저 보내고 오늘을 다시 불러온다 */
  const refresh = useCallback(async () => {
    const result = await outbox.flush(async (item) => {
      if (item.childId !== child.id) return 'network'; // 다른 아이 기록은 그 아이 화면에서
      try {
        if (item.kind === 'complete') await api.complete(item.childId, item.taskId);
        else await api.review(item.childId, item.mood, item.note);
        return 'ok';
      } catch (e) {
        if (isNetworkError(e)) return 'network';
        return { rejected: errorMessage(e) };
      }
    });
    readOutbox();
    if (result.rejected.length) setActionError(`보내지 못한 기록이 있어요: ${result.rejected.join(', ')}`);
    try {
      accept(await api.today(child.id));
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, [accept, child.id, readOutbox]);

  useEffect(() => {
    readOutbox();
    void refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !busy.current) void refresh();
    }, 20000);
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', refresh);
    };
  }, [readOutbox, refresh]);

  const view = useMemo(() => (raw ? withPending(raw, pendingIds) : null), [raw, pendingIds]);

  /** 할 일을 '여기에 놓기' 칸에 끌어다 놓으면 바로 시작 · 아이콘을 톡 누르면 열기 (아래에서 채움) */
  const dropAction = useRef<{ drop: (id: number) => void; tap: (id: number) => void } | null>(null);
  const zone = useDragToZone(
    useCallback((id: number) => dropAction.current?.drop(id), []),
    useCallback((id: number) => dropAction.current?.tap(id), []),
  );

  /** 서버 동작 하나 (중복 클릭 방지). offline: 인터넷이 없을 때 기기에 남길 수 있는 동작이면 그 방법 */
  const send = useCallback(async (fn: () => Promise<DayView>, offline?: () => void): Promise<boolean> => {
    if (busy.current) return false;
    busy.current = true;
    setBusyFlag(true);
    setActionError(null);
    try {
      accept(await fn());
      return true;
    } catch (e) {
      if (isNetworkError(e) && offline) {
        offline();
        readOutbox();
        return true;
      }
      setActionError(isNetworkError(e) ? '인터넷이 연결되면 다시 해 주세요. 타이머 · 자유시간은 서버에서 확인해요.' : errorMessage(e));
      if (e instanceof ApiError && e.status === 404) void refresh();
      return false;
    } finally {
      busy.current = false;
      setBusyFlag(false);
    }
  }, [accept, readOutbox, refresh]);

  if (!view) {
    return (
      <div className="app">
        <Header badge={`${child.name} · ${child.age}세`}><button type="button" className="btn-small" onClick={onSwitch}>바꾸기</button></Header>
        {loadError ? (
          <div className="tip warm" role="alert"><strong>오늘 할 일을 불러오지 못했어요</strong><p>{loadError}</p>
            <button type="button" className="btn-secondary" onClick={() => void refresh()}>다시 불러오기</button></div>
        ) : <p role="status">오늘 할 일을 불러오는 중…</p>}
      </div>
    );
  }

  const me = view.child;
  const quest = me.uiStyle === 'quest';
  const tasks = view.tasks;
  const open = tasks.filter((t) => isCounted(t) && t.status !== 'done');
  const allRequiredDone = view.progress.total > 0 && view.progress.done === view.progress.total;
  const pending = view.pending.length > 0;
  const active = tasks.find((t) => t.id === activeId) ?? null;
  const nextTask = open[0] ?? null;

  const elapsedOf = (t: Task) => shownElapsed(t, fetchedAt, now);

  const go = (p: Page) => {
    setActionError(null);
    setPage(p);
    window.scrollTo?.({ top: 0 });
  };
  const resume = () => {
    const t = tasks.find((x) => isCounted(x) && x.status !== 'done');
    if (t) {
      setActiveId(t.id);
      go('focus');
    } else go('waiting');
  };
  /** 집중 화면을 떠날 때는 잠깐 쉬기 (쌓인 시간은 그대로) */
  const leaveFocus = async (p: Page) => {
    if (active?.running) await send(() => api.pause(me.id, active.id));
    go(p);
  };
  dropAction.current = {
    drop: (id) => {
      const t = tasks.find((x) => x.id === id);
      if (!t || !isCounted(t) || t.status === 'done') return;
      setActiveId(id);
      go('focus');
      if (online && !t.running) void send(() => api.start(me.id, id));
    },
    tap: (id) => {
      const t = tasks.find((x) => x.id === id);
      if (!t || !isCounted(t)) return;
      setActiveId(id);
      go(t.status === 'done' ? 'done' : 'focus');
    },
  };
  const dragTask = zone.dragging ? tasks.find((t) => t.id === zone.dragging!.id) ?? null : null;

  const ask = async (text: string) => {
    if (!active) return;
    if (await send(() => api.help(me.id, active.id, text))) go('asked');
  };

  // ---------------------------------------------------------------- 화면 조각

  const rewardBox = (
    <div className="reward">
      <div className="row"><strong>{isFreeOpen(view.free) ? '🔓' : '🔒'} 자유시간</strong><strong>{view.free.minutes}분</strong></div>
      <small>{freeMessage(view.free, view.progress, pending)}</small>
    </div>
  );

  const nav = (
    <nav className="nav" aria-label="아이 메뉴">
      {([['today', '오늘'], ['free', '자유시간'], ['growth', '나의 성장']] as const).map(([p, label]) => (
        <button key={p} type="button" aria-current={page === p ? 'page' : undefined} onClick={() => (page === 'focus' ? void leaveFocus(p) : go(p))}>{label}</button>
      ))}
    </nav>
  );

  const back = (p: Page = 'today') => <button type="button" className="btn-back" onClick={() => go(p)}>← 돌아가기</button>;

  const restDay = view.progress.total === 0;

  const todayPage = (
    <>
      <div className="kicker">{dayTitle(view.day)} · {levelName(me.level)}</div>
      <h2>{quest ? <>{callName(me.name)}, 하나씩<br />해볼까?</> : '오늘은 내가 계획해요'}</h2>
      <div className="hero">
        {quest && <><div style={{ fontSize: 34 }} aria-hidden="true">🌱</div><h3>작은 시작이 자라나요</h3></>}
        <ProgressBar done={view.progress.done} total={view.progress.total} />
      </div>
      {tasks.length === 0 ? (
        <div className="center">
          <div className="large-emoji" aria-hidden="true">☀️</div>
          <h3>오늘은 쉬어가는 날</h3>
          <p>오늘 등록된 할 일이 없어요.<br />자유시간은 부모님과 정해요.</p>
        </div>
      ) : (
        <>
          <div className="row"><h3>{quest ? '오늘의 퀘스트' : '오늘의 할 일'}</h3><small>{tasks.filter(isCounted).length}개</small></div>
          {open.length > 0 && !allRequiredDone && (
            <div ref={zone.zoneRef} className={`drop-zone${zone.dragging ? ' ready' : ''}${zone.dragging?.over ? ' over' : ''}`}>
              <strong>{zone.dragging?.over ? '놓으면 시작해요!' : '🎯 여기에 끌어다 놓으면 시작'}</strong>
              <small>할 일 아이콘을 잡고 이 칸으로 끌어와요 · 톡 누르면 열려요</small>
            </div>
          )}
          <div className="list">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} pending={view.pending.includes(t.id)} current={wide && page === 'focus' && t.id === activeId}
                handle={isCounted(t) && t.status !== 'done' ? zone.handle(t.id) : undefined}
                detail={t.movedIn ? `${STATUS_LABEL[t.status]} · 어제에서 옮겨 옴` : undefined}
                action={isCounted(t) ? (
                  <button type="button" className="btn-quiet" onClick={() => { setActiveId(t.id); go(t.status === 'done' ? 'done' : 'focus'); }}>
                    {t.status === 'done' ? '보기' : '열기'}
                  </button>
                ) : undefined} />
            ))}
          </div>
        </>
      )}
      {rewardBox}
      {isFreeOpen(view.free) ? (
        <button type="button" className="btn-main" onClick={() => go('free')}>{view.free.state === 'available' ? '자유시간 받기' : '자유시간 보기'}</button>
      ) : allRequiredDone ? (
        <button type="button" className="btn-main" onClick={() => go('waiting')}>오늘 모두 해냈어요</button>
      ) : restDay ? (
        <>
          {open.length > 0 && <button type="button" className="btn-secondary" onClick={resume}>선택 할 일 해보기 →</button>}
          <button type="button" className="btn-main" disabled={view.free.requested || busyFlag || pending}
            onClick={() => void send(() => api.requestFree(me.id))}>{view.free.requested ? '부모님께 요청했어요' : '부모님께 자유시간 요청'}</button>
        </>
      ) : me.level >= 2 && !view.planned ? (
        <button type="button" className="btn-main" onClick={() => go('plan')}>오늘 순서 정하기 →</button>
      ) : (
        <button type="button" className="btn-main" onClick={resume}>{tasks.some((t) => t.elapsedSec > 0 || t.status === 'done') ? '이어서 하기 →' : '시작하기 →'}</button>
      )}
    </>
  );

  const focusPage = (t: Task | null, inline: boolean): ReactNode => {
    if (!t) {
      return (
        <div className="center">
          <div className="large-emoji" aria-hidden="true">🌿</div>
          <h3>{open.length ? '왼쪽 목록에서 할 일을 열어요' : '오늘 할 일을 모두 마쳤어요'}</h3>
          {open.length > 0 && <button type="button" className="btn-main" onClick={resume}>다음 할 일 열기</button>}
        </div>
      );
    }
    const total = t.estimateMin * 60;
    const elapsed = elapsedOf(t);
    const left = Math.max(0, total - elapsed);
    const closed = !isCounted(t);
    return (
      <>
        {!inline && <button type="button" className="btn-back" onClick={() => void leaveFocus('today')}>← 돌아가기</button>}
        <div className="center">
          <div className="kicker">지금은 한 가지에 집중</div>
          <div className="large-emoji" aria-hidden="true">{t.icon}</div>
          <h2>{t.title}</h2>
          <p>{t.amount} · {me.level >= 3 ? '내 예상시간' : '시작할 시간'} {t.estimateMin}분</p>
          {closed ? <div className="tip">{t.status === 'waived' ? '오늘은 하지 않아도 돼요.' : '다른 날로 옮겼어요.'}</div> : t.status === 'done' ? (
            <div className="tip">이미 끝낸 할 일이에요.</div>
          ) : (
            <>
              <Ring ratio={total ? left / total : 0}>
                <span className="clock" role="timer" aria-live="off">{clock(left)}</span>
                <small>{left === 0 ? '시간이 지나도 계속해도 돼요' : t.running ? '남은 예상시간' : elapsed ? '잠깐 쉬고 있어요' : '준비되면 시작해요'}</small>
              </Ring>
              <button type="button" disabled={busyFlag || !online} onClick={() => void send(() => (t.running ? api.pause(me.id, t.id) : api.start(me.id, t.id)))}>
                {t.running ? 'Ⅱ 잠깐 쉬기' : '▶ 시작하기'}
              </button>
              {!online && <p>타이머는 인터넷이 연결되어 있을 때 기록돼요.</p>}
              <p>쓴 시간 {clock(elapsed)}</p>
              <button type="button" className="btn-main" disabled={busyFlag} onClick={async () => {
                setActiveId(t.id);
                if (t.running) await send(() => api.pause(me.id, t.id));
                go('finish');
              }}>✓ 다 했어요!</button>
              <button type="button" className="btn-quiet" onClick={() => { setActiveId(t.id); go('help'); }}>🙋 막혔어요</button>
            </>
          )}
        </div>
      </>
    );
  };

  let body: ReactNode;
  switch (page) {
    case 'today':
    case 'focus':
      if (wide) {
        body = (
          <div className="split">
            <section aria-label="오늘 할 일">{todayPage}{nav}</section>
            <section aria-label="지금 할 일">{focusPage(page === 'focus' ? active : nextTask, true)}</section>
          </div>
        );
      } else body = page === 'today' ? <>{todayPage}{nav}</> : focusPage(active, false);
      break;
    case 'plan':
      body = <PlanPage view={view} busy={busyFlag} onBack={() => go('today')} onSave={async (order, estimates) => {
        if (await send(() => api.plan(me.id, order, estimates))) {
          const first = order[0];
          if (first) {
            setActiveId(first);
            go('focus');
          } else resume();
        }
      }} />;
      break;
    case 'help':
      body = (
        <>
          {back('focus')}
          <div className="kicker">도움이 필요할 때</div>
          <h2>어떤 게 어려워?</h2>
          <div className="list">
            {HELP_REASONS.map((r, i) => (
              <button key={r.text} type="button" className="task" onClick={() => { setReason(i); go('hint'); }}>
                <span aria-hidden="true">{r.icon}</span> {r.text}
              </button>
            ))}
          </div>
          <button type="button" className="btn-secondary" disabled={busyFlag} onClick={() => void ask(HELP_PARENT)}>부모님 도움이 필요해요</button>
        </>
      );
      break;
    case 'hint':
      body = (
        <>
          {back('help')}
          <div className="center">
            <div className="large-emoji" aria-hidden="true">🌱</div>
            <h2>작게 해봐도 괜찮아</h2>
            <div className="hero">{HELP_REASONS[reason].hint}</div>
            <button type="button" className="btn-main" onClick={() => go('focus')}>다시 해볼게요</button>
            <button type="button" className="btn-secondary" disabled={busyFlag} onClick={() => void ask(HELP_REASONS[reason].text)}>부모님께 도움 요청</button>
          </div>
        </>
      );
      break;
    case 'asked':
      body = (
        <>
          {back('focus')}
          <div className="center">
            <div className="large-emoji" aria-hidden="true">🙋</div>
            <h2>도움을 요청했어요</h2>
            <p>타이머는 잠깐 멈췄어요.<br />부모님과 함께 이야기해 봐요.</p>
            <button type="button" className="btn-main" onClick={() => go('focus')}>다시 해볼게요</button>
          </div>
        </>
      );
      break;
    case 'finish':
      body = active && (
        <>
          {back('focus')}
          <div className="center">
            <div className="large-emoji" aria-hidden="true">🔎</div>
            <h2>한 번만 확인할까?</h2>
            <div className="panel"><h3>{active.title} · {active.amount}</h3><p>내가 정한 분량을 다 했나요?</p></div>
            <SlideToConfirm label="밀어서 다 했어요" disabled={busyFlag} onConfirm={async () => {
              const t = active;
              const ok = await send(() => api.complete(me.id, t.id), () => outbox.add({ childId: me.id, kind: 'complete', taskId: t.id }));
              if (ok) go('done');
            }} />
            <button type="button" className="btn-secondary" onClick={() => go('focus')}>조금 더 할게요</button>
          </div>
        </>
      );
      break;
    case 'done':
      body = active && (
        <div className="center">
          <div className="large-emoji" aria-hidden="true">🌿</div>
          <div className="kicker">하나씩 쌓이는 나의 하루</div>
          <h2>하나 해냈어요!</h2>
          <p>{active.title} · {active.amount}</p>
          <div className="hero">
            {me.level >= 3 ? (
              <>
                <div className="row"><span>내 예상</span><strong>{active.estimateMin}분</strong></div>
                <div className="row"><span>실제로 쓴 시간</span><strong>{clock(elapsedOf(active))}</strong></div>
              </>
            ) : '내가 시작하고 끝냈어요.'}
          </div>
          <ProgressBar done={view.progress.done} total={view.progress.total} />
          {view.pending.includes(active.id) && <div className="tip warm">완료 표시는 이 기기에 남겨 두었어요. 연결되면 보낼게요.</div>}
          <button type="button" className="btn-main" onClick={allRequiredDone ? () => go('waiting') : resume}>{allRequiredDone ? '오늘 할 일 끝!' : '다음 할 일로 →'}</button>
          <button type="button" className="btn-quiet" onClick={() => go('today')}>오늘 목록 보기</button>
          {active.status === 'done' && active.doneBy === 'child' && !view.pending.includes(active.id) && (
            <button type="button" className="btn-quiet" disabled={busyFlag} onClick={async () => {
              if (await send(() => api.undo(me.id, active.id))) go('focus');
            }}>잘못 눌렀어요 · 다시 할 일로</button>
          )}
        </div>
      );
      break;
    case 'waiting':
      body = (
        <>
          {back()}
          <div className="center">
            <div className="large-emoji" aria-hidden="true">🎉</div>
            <h2>{allRequiredDone ? '오늘의 약속을 지켰어요' : '오늘의 할 일'}</h2>
            {allRequiredDone && <p>{subjectName(me.name)} 끝까지 해냈어요.</p>}
          </div>
          <div className="list">{tasks.filter((t) => t.required && isCounted(t)).map((t) => <TaskRow key={t.id} task={t} pending={view.pending.includes(t.id)} />)}</div>
          {rewardBox}
          {isFreeOpen(view.free) ? (
            <button type="button" className="btn-main" onClick={() => go('free')}>자유시간 받기</button>
          ) : view.free.state === 'waiting' && !pending ? (
            <div className="tip">⌛ 부모님이 확인하면 자유시간이 열려요.</div>
          ) : null}
          <button type="button" className="btn-secondary" onClick={() => go('review')}>오늘 어땠는지 남기기</button>
        </>
      );
      break;
    case 'free':
      body = <FreePage view={view} fetchedAt={fetchedAt} now={now} busy={busyFlag || pending} online={online}
        onGo={go} onIssueAndStart={async (activity) => {
          if (view.free.state === 'available' && !(await send(() => api.issuePass(me.id)))) return;
          await send(() => api.startPass(me.id, activity));
        }} onToggle={() => void send(() => (view.free.running ? api.pausePass(me.id) : api.startPass(me.id, null)))} nav={nav} />;
      break;
    case 'review':
      body = <ReviewPage view={view} busy={busyFlag} nav={nav} onSave={(mood, note) =>
        send(() => api.review(me.id, mood, note), () => outbox.add({ childId: me.id, kind: 'review', mood, note }))} />;
      break;
    case 'growth':
      body = <GrowthPage view={view} nav={nav} onReview={() => go('review')} />;
      break;
  }

  return (
    <div className={`app ${quest ? 'quest' : 'planner'}${wide && (page === 'today' || page === 'focus') ? ' wide' : ''}`}>
      <Header badge={`${me.name} · ${me.age}세`}><button type="button" className="btn-small" onClick={onSwitch}>바꾸기</button></Header>
      <OfflineNotice online={online} pending={pendingCount} onRetry={() => void refresh()} lastError={loadError} />
      <ErrorText text={actionError} />
      {body}
      <DragGhost drag={zone.dragging}>{dragTask && <>{dragTask.icon} {dragTask.title}</>}</DragGhost>
    </div>
  );
}

// ---------------------------------------------------------------- 순서 정하기

function PlanPage({ view, busy, onBack, onSave }: {
  view: DayView;
  busy: boolean;
  onBack: () => void;
  onSave: (order: number[], estimates: { taskId: number; minutes: number }[]) => void;
}) {
  const me = view.child;
  const openTasks = view.tasks.filter((t) => isCounted(t) && t.status !== 'done');
  const [order, setOrder] = useState(() => openTasks.map((t) => t.id));
  const [est, setEst] = useState<Record<number, number>>(() => Object.fromEntries(openTasks.map((t) => [t.id, t.estimateMin])));
  const byId = new Map(openTasks.map((t) => [t.id, t]));
  const items = order.map((id) => byId.get(id)).filter((t): t is Task => !!t);
  const move = (i: number, dir: number) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };
  const options = (current: number) => Array.from(new Set([5, 10, 15, 20, 30, 40, 60, current])).sort((a, b) => a - b);
  return (
    <>
      <button type="button" className="btn-back" onClick={onBack}>← 돌아가기</button>
      <div className="kicker">내가 고르는 순서</div>
      <h2>뭐부터 할까?</h2>
      <p>아이콘을 잡고 위아래로 끌어 순서를 바꿔요.{me.level >= 3 && ' 예상시간도 내가 정해요.'}</p>
      <SortableList label="오늘 할 일 순서" items={items} onReorder={setOrder} renderItem={(t, handle) => {
        const i = order.indexOf(t.id);
        return (
          <>
            <TaskRow task={t} handle={handle} detail={`${i + 1}번째 · 예상 ${est[t.id]}분`} action={
              <div className="move">
                <button type="button" aria-label={`${t.title} 위로`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button type="button" aria-label={`${t.title} 아래로`} disabled={i === items.length - 1} onClick={() => move(i, 1)}>↓</button>
              </div>
            } />
            {me.level >= 3 && (
              <div className="row">
                <label htmlFor={`est-${t.id}`}><small>{t.title} 예상시간</small></label>
                <select id={`est-${t.id}`} style={{ width: 110 }} value={est[t.id]} onChange={(e) => setEst({ ...est, [t.id]: Number(e.target.value) })}>
                  {options(t.estimateMin).map((v) => <option key={v} value={v}>{v}분</option>)}
                </select>
              </div>
            )}
          </>
        );
      }} />
      <button type="button" className="btn-main" disabled={busy} onClick={() =>
        onSave(order, me.level >= 3 ? order.map((id) => ({ taskId: id, minutes: est[id] })) : [])}>이 순서로 할래요 →</button>
    </>
  );
}

// ---------------------------------------------------------------- 자유시간

function FreePage({ view, fetchedAt, now, busy, online, onGo, onIssueAndStart, onToggle, nav }: {
  view: DayView;
  fetchedAt: number;
  now: number;
  busy: boolean;
  online: boolean;
  onGo: (p: Page) => void;
  onIssueAndStart: (activity: string | null) => void;
  onToggle: () => void;
  nav: ReactNode;
}) {
  const f = view.free;
  const [activity, setActivity] = useState<string | null>(f.activity);
  const remaining = shownRemaining(f, fetchedAt, now);
  const choices = (
    <div className="choices">
      {ACTIVITIES.map((a) => (
        <button key={a} type="button" className={`choice${activity === a ? ' selected' : ''}`} aria-pressed={activity === a} onClick={() => setActivity(a)}>{a}</button>
      ))}
    </div>
  );
  let content: ReactNode;
  if (!isFreeOpen(f)) {
    const allDone = view.progress.total > 0 && view.progress.done === view.progress.total;
    content = (
      <>
        <div className="large-emoji" aria-hidden="true">🔒</div>
        <h2>조금만 기다려요</h2>
        <div className="reward" style={{ textAlign: 'left' }}>
          <div className="row"><strong>🔒 자유시간</strong><strong>{f.minutes}분</strong></div>
          <small>{freeMessage(f, view.progress, busy && online)}</small>
        </div>
        <button type="button" className="btn-main" onClick={() => onGo(allDone ? 'waiting' : 'today')}>{allDone ? '완료한 일 보기' : '오늘 할 일로'}</button>
      </>
    );
  } else if (f.state === 'available' || f.state === 'ready') {
    content = (
      <>
        <div className="large-emoji" aria-hidden="true">🎁</div>
        <h2>자유시간이 열렸어요!</h2>
        <div className="hero"><span className="clock">{f.minutes}분</span><p>준비되면 시작해 주세요.</p></div>
        <p>무엇을 하며 쉬고 싶나요?</p>
        {choices}
        <SlideToConfirm warm label="밀어서 자유시간 시작" disabled={busy || !online} onConfirm={() => onIssueAndStart(activity)} />
        {!online && <p>자유시간은 인터넷이 연결되어 있을 때 시작할 수 있어요.</p>}
      </>
    );
  } else {
    const used = f.state === 'used' || remaining === 0;
    content = (
      <>
        <h2>{used ? '오늘 자유시간을 다 썼어요' : '즐겁게 쉬어요!'}</h2>
        <Ring ratio={f.minutes ? remaining / (f.minutes * 60) : 0} free>
          <span className="clock" role="timer" aria-live="off">{clock(remaining)}</span>
          <small>{used ? '내일도 하나씩 해봐요' : f.running ? '남은 자유시간' : '잠시 멈췄어요'}</small>
        </Ring>
        {f.activity && <p>{f.activity}</p>}
        {!used && <button type="button" className="btn-main" disabled={busy || !online} onClick={onToggle}>{f.running ? 'Ⅱ 잠깐 멈추기' : '▶ 이어서 쉬기'}</button>}
        <button type="button" className="btn-secondary" onClick={() => onGo('review')}>하루 돌아보기</button>
      </>
    );
  }
  return (
    <>
      <button type="button" className="btn-back" onClick={() => onGo('today')}>← 돌아가기</button>
      <div className="center"><div className="kicker">오늘의 자유시간</div>{content}</div>
      <div className="tip">자유시간은 앱 안의 이용권 타이머예요. 실제 게임 · 영상 앱 제한은 연결되어 있지 않아요.</div>
      {nav}
    </>
  );
}

// ---------------------------------------------------------------- 회고 · 성장

function ReviewPage({ view, busy, nav, onSave }: { view: DayView; busy: boolean; nav: ReactNode; onSave: (mood: Mood, note: string | null) => Promise<boolean> }) {
  const me = view.child;
  const [mood, setMood] = useState<Mood | null>(view.review?.mood ?? null);
  const [note, setNote] = useState(view.review?.note ?? '');
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <>
      <div className="kicker">짧게 돌아보는 오늘</div>
      <h2>오늘 어땠어?</h2>
      <p>{me.level >= 3 ? '내 계획대로 해봤나요?' : '마음에 가까운 표정을 골라주세요.'}</p>
      <div className="choices" role="group" aria-label="오늘의 마음">
        {MOODS.map((m) => (
          <button key={m.value} type="button" className={`choice${mood === m.value ? ' selected' : ''}`} aria-pressed={mood === m.value}
            onClick={() => { setMood(m.value); setError(false); setSaved(false); }}>{m.label}</button>
        ))}
      </div>
      {me.level >= 3 && (
        <>
          <label className="label" htmlFor="reflect">내일은 어떻게 해볼까? <small>선택</small></label>
          <textarea id="reflect" rows={3} maxLength={200} placeholder="한 문장만 적어도 좋아요" value={note} onChange={(e) => { setNote(e.target.value); setSaved(false); }} />
        </>
      )}
      <p>어려웠던 날도 내 경험으로 남아요.</p>
      <button type="button" className="btn-main" disabled={busy} onClick={async () => {
        if (!mood) {
          setError(true);
          return;
        }
        if (await onSave(mood, me.level >= 3 && note.trim() ? note.trim() : null)) setSaved(true);
      }}>오늘의 마음 남기기</button>
      {error && <div className="error" role="alert">마음에 가까운 표정 하나를 골라주세요.</div>}
      {saved && <div className="tip" role="status">오늘의 마음을 남겼어요. 내일도 하나씩 해봐요 🌱</div>}
      {nav}
    </>
  );
}

function GrowthPage({ view, nav, onReview }: { view: DayView; nav: ReactNode; onReview: () => void }) {
  const me = view.child;
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.growth(me.id).then(setReport, (e) => setError(errorMessage(e)));
  }, [me.id]);
  const recorded = report?.days.filter((d) => d.recorded) ?? [];
  return (
    <>
      <div className="kicker">나의 성장</div>
      <h2>작은 시작이 쌓여요</h2>
      <div className="hero">
        <div className="large-emoji" aria-hidden="true">🌱</div>
        <h3>{levelName(me.level)}</h3>
        <p>{me.level >= 3 ? '내가 순서와 예상시간을 정해요.' : me.level === 2 ? '내가 할 순서를 고를 수 있어요.' : '부모님과 함께 순서를 정해요.'}</p>
      </div>
      <div className="panel">
        <h3>오늘 내가 해낸 일</h3>
        <p>필수 할 일 {view.progress.done}개 완료{view.planned ? ' · 내 순서로 계획했어요' : ''}</p>
        {view.review ? <div className="tip">오늘의 마음 · {moodLabel(view.review.mood)}</div> : <p>하루를 마치면 내 마음도 남겨봐요.</p>}
      </div>
      <div className="panel">
        <h3>최근 7일</h3>
        {error ? <p>{error}</p> : !report ? <p role="status">불러오는 중…</p> : recorded.length <= 1 ? (
          <p>기록이 쌓이면 여기에서 나의 한 주가 보여요.</p>
        ) : (
          <div className="week">
            {report.days.map((d) => (
              <div key={d.day} className={d.recorded ? '' : 'none'}>
                {Number(d.day.slice(8))}일
                <strong>{d.recorded ? d.requiredDone : '–'}</strong>
                {d.recorded ? '완료' : '기록 없음'}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="tip">레벨은 부모님과 함께 정해요. 빨리 올라갈 필요는 없어요.</div>
      <button type="button" className="btn-secondary" onClick={onReview}>오늘 돌아보기</button>
      {nav}
    </>
  );
}
