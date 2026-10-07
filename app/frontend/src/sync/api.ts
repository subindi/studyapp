/**
 * 서버 API (Spring Boot, 같은 주소의 /api). 로그인은 세션 쿠키(SSID)로 유지된다.
 * 권한(가족 격리 · 부모 모드)은 모두 서버가 판단한다. 화면은 결과만 보여 준다.
 */

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public body?: unknown) {
    super(message);
  }
}

const MESSAGES: Record<string, string> = {
  EMAIL_TAKEN: '이미 가입된 이메일이에요. 로그인해 주세요',
  BAD_CREDENTIALS: '이메일 또는 비밀번호가 맞지 않아요',
  TOO_MANY_ATTEMPTS: '시도가 너무 많아요. 잠시 후 다시 해 주세요',
  UNAUTHORIZED: '로그인이 필요해요',
  VALIDATION: '입력값을 확인해 주세요',
  NETWORK: '서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요',
  PARENT_LOCKED: '부모 PIN 을 입력해 주세요',
  PIN_LOCKED: 'PIN 을 여러 번 틀려서 잠시 잠갔어요. 잠시 후 다시 해 주세요',
  PIN_NOT_SET: '부모 PIN 을 먼저 설정해 주세요',
  CHILD_NOT_FOUND: '아이 정보를 찾을 수 없어요',
  TASK_NOT_FOUND: '오늘 할 일에서 찾을 수 없어요',
  TASK_CLOSED: '오늘은 하지 않아도 되는 할 일이에요',
  FREE_LOCKED: '아직 자유시간을 받을 수 없어요',
  NOT_READY: '남은 필수 할 일이 있어요',
  LEVEL: '이 단계에서는 부모님과 함께 정해요',
  MOVED_STARTED: '옮긴 날에 이미 시작한 할 일이에요',
};

export function errorMessage(e: unknown): string {
  if (!(e instanceof ApiError) || e.status === 0) return MESSAGES.NETWORK;
  return e.message || MESSAGES[e.code] || MESSAGES.VALIDATION; // 서버 문구 우선 (예: 남은 PIN 시도 횟수)
}

export function isNetworkError(e: unknown): boolean {
  return e instanceof ApiError && e.status === 0;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive: method !== 'GET', // 창을 닫는 중에도 저장 요청은 끝까지
    });
  } catch {
    throw new ApiError(0, 'NETWORK', MESSAGES.NETWORK);
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* JSON 이 아닌 응답 (예: 서버 없이 정적 호스팅, 프록시 오류 화면) */
  }
  if (!res.ok) {
    const err = data as { code?: string; message?: string } | null;
    if (!err?.code && res.status >= 502) throw new ApiError(0, 'NETWORK', MESSAGES.NETWORK);
    throw new ApiError(res.status, err?.code ?? `HTTP_${res.status}`, err?.message ?? `오류가 났어요 (${res.status})`, data);
  }
  if (data === null && text) throw new ApiError(0, 'NETWORK', MESSAGES.NETWORK);
  return data as T;
}

// ---------------------------------------------------------------- 타입 (서버 DTO 와 같은 모양)

export interface Me { email: string; displayName: string; familyName: string; pinSet: boolean; parentMode: boolean }

export type UiStyle = 'quest' | 'planner';
export interface Child {
  id: number;
  name: string;
  age: number;
  /** 자기주도 단계 1~3 (나이와 별개) */
  level: number;
  uiStyle: UiStyle;
  weekdayFreeMin: number;
  weekendFreeMin: number;
  approvalRequired: boolean;
}
export interface FamilyView { name: string; today: string; children: Child[] }

export type TaskStatus = 'ready' | 'active' | 'paused' | 'done' | 'waived' | 'moved';
export interface Task {
  id: number;
  icon: string;
  title: string;
  amount: string;
  estimateMin: number;
  required: boolean;
  status: TaskStatus;
  doneBy: 'child' | 'parent' | null;
  /** serverNow 시점의 누적 초 */
  elapsedSec: number;
  running: boolean;
  movedTo: string | null;
  adjustReason: string | null;
  fromRoutine: boolean;
  movedIn: boolean;
  helpOpen: boolean;
}
export type FreeState = 'locked' | 'waiting' | 'rest' | 'available' | 'ready' | 'running' | 'paused' | 'used';
export interface Free {
  state: FreeState;
  minutes: number;
  remainingSec: number;
  running: boolean;
  activity: string | null;
  approvalRequired: boolean;
  approved: boolean;
  requested: boolean;
}
export interface Help { id: number; childId: number; taskId: number; taskTitle: string; reason: string; createdAt: number }
export type Mood = 'good' | 'different' | 'hard';
export interface DayView {
  child: Child;
  day: string;
  serverNow: number;
  planned: boolean;
  tasks: Task[];
  progress: { done: number; total: number };
  free: Free;
  review: { mood: Mood; note: string | null } | null;
  help: Help[];
}
export interface ChildToday { child: Child; progress: { done: number; total: number }; free: Free; help: Help[]; planned: boolean }
export interface Overview { today: string; serverNow: number; children: ChildToday[] }

export interface RoutineInput { icon: string; title: string; amount: string; estimateMin: number; required: boolean; daysMask: number }
export interface Routine extends RoutineInput { id: number }

export interface ChildSettings {
  name: string;
  age: number;
  level: number;
  uiStyle: UiStyle;
  weekdayFreeMin: number;
  weekendFreeMin: number;
  approvalRequired: boolean;
}

export interface DaySummary {
  day: string;
  /** 그날 실제로 앱을 쓴 기록이 있는지 (없으면 숫자를 보여 주지 않는다) */
  recorded: boolean;
  requiredDone: number;
  requiredTotal: number;
  optionalDone: number;
  excused: number;
  studySec: number;
  planned: boolean;
  approved: boolean;
  freeMinutes: number;
  mood: Mood | null;
  note: string | null;
}
export interface Report { child: Child; from: string; to: string; days: DaySummary[] }

export type AdjustAction = 'amount' | 'waive' | 'move' | 'recognize' | 'restore';

const kid = (id: number) => `/children/${id}`;

export const api = {
  me: () => request<Me>('GET', '/auth/me'),
  login: (email: string, password: string) => request<Me>('POST', '/auth/login', { email, password }),
  signup: (email: string, password: string, displayName: string, familyName: string) =>
    request<Me>('POST', '/auth/signup', { email, password, displayName, familyName }),
  logout: () => request<null>('POST', '/auth/logout'),
  unlock: (pin: string) => request<Me>('POST', '/auth/pin/unlock', { pin }),
  lock: () => request<Me>('POST', '/auth/pin/lock'),
  resetPin: (password: string, pin: string) => request<Me>('POST', '/auth/pin/reset', { password, pin }),
  setPin: (pin: string) => request<Me>('PUT', '/parent/pin', { pin }),

  family: () => request<FamilyView>('GET', '/family'),
  renameFamily: (name: string) => request<FamilyView>('PUT', '/parent/family', { name }),
  addChild: (requestId: string, settings: ChildSettings, routines: RoutineInput[], addToday: boolean) =>
    request<Child>('POST', '/parent/children', { requestId, settings, routines, addToday }),
  updateChild: (id: number, settings: ChildSettings) => request<Child>('PUT', `/parent/children/${id}`, settings),

  today: (childId: number) => request<DayView>('GET', `${kid(childId)}/today`),
  plan: (childId: number, order: number[], estimates: { taskId: number; minutes: number }[]) =>
    request<DayView>('PUT', `${kid(childId)}/today/plan`, { order, estimates }),
  start: (childId: number, taskId: number) => request<DayView>('POST', `${kid(childId)}/tasks/${taskId}/start`),
  pause: (childId: number, taskId: number) => request<DayView>('POST', `${kid(childId)}/tasks/${taskId}/pause`),
  complete: (childId: number, taskId: number) => request<DayView>('POST', `${kid(childId)}/tasks/${taskId}/complete`),
  undo: (childId: number, taskId: number) => request<DayView>('POST', `${kid(childId)}/tasks/${taskId}/undo`),
  help: (childId: number, taskId: number, reason: string) => request<DayView>('POST', `${kid(childId)}/tasks/${taskId}/help`, { reason }),
  cancelHelp: (childId: number, taskId: number) => request<DayView>('POST', `${kid(childId)}/tasks/${taskId}/help/cancel`),
  issuePass: (childId: number) => request<DayView>('POST', `${kid(childId)}/today/free-pass`),
  startPass: (childId: number, activity: string | null) => request<DayView>('POST', `${kid(childId)}/today/free-pass/start`, { activity }),
  pausePass: (childId: number) => request<DayView>('POST', `${kid(childId)}/today/free-pass/pause`),
  requestFree: (childId: number) => request<DayView>('POST', `${kid(childId)}/today/free-request`),
  review: (childId: number, mood: Mood, note: string | null) => request<DayView>('PUT', `${kid(childId)}/today/review`, { mood, note }),
  growth: (childId: number) => request<Report>('GET', `${kid(childId)}/growth`),

  overview: () => request<Overview>('GET', '/parent/overview'),
  adjust: (childId: number, taskId: number, action: AdjustAction, amount?: string, reason?: string) =>
    request<DayView>('POST', `/parent/children/${childId}/tasks/${taskId}/adjust`, { action, amount, reason }),
  approve: (childId: number) => request<DayView>('POST', `/parent/children/${childId}/today/approve`),
  resolveHelp: (childId: number, helpId: number) => request<DayView>('POST', `/parent/children/${childId}/help/${helpId}/resolve`),
  report: (childId: number, from?: string) =>
    request<Report>('GET', `/parent/children/${childId}/report${from ? `?from=${encodeURIComponent(from)}` : ''}`),
  routines: (childId: number) => request<Routine[]>('GET', `/parent/children/${childId}/routines`),
  addRoutine: (childId: number, requestId: string, routine: RoutineInput, addToday: boolean) =>
    request<Routine>('POST', `/parent/children/${childId}/routines`, { requestId, routine, addToday }),
  updateRoutine: (childId: number, id: number, routine: RoutineInput) => request<Routine>('PUT', `/parent/children/${childId}/routines/${id}`, routine),
  deleteRoutine: (childId: number, id: number, today: boolean) =>
    request<{ removedToday: boolean }>('DELETE', `/parent/children/${childId}/routines/${id}?today=${today}`),
};

/** 재시도해도 같은 값이 가도록 폼을 열 때 한 번 만드는 요청 번호 */
export function newRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
