# 05. 폴더 구조 · 컴포넌트 설계 · 데이터 구조 · 상태 관리

## 1. 기술 스택 확정

| 영역 | 선택 | 비고 |
| --- | --- | --- |
| 프레임워크 | Next.js 16 (App Router) | 정적 출력(`output: 'export'`) 가능 — 서버 불필요 |
| 언어 | TypeScript 5 (`strict: true`) | — |
| 스타일 | TailwindCSS v4 + CSS 변수 토큰 | 토큰은 `@theme` 에 정의 |
| UI 프리미티브 | shadcn/ui (Radix 기반) | Button, Dialog, Sheet, Popover, Checkbox, Tabs, Accordion, Toast, Switch, Select, Command |
| 폼 | React Hook Form + Zod | `zodResolver` |
| 상태 | Zustand + `persist` 미들웨어 | LocalStorage 어댑터 |
| 파일 저장 | IndexedDB (`idb-keyval`) | 첨부 Blob 전용 |
| 정렬(DnD) | `@dnd-kit/core` + `sortable` | 키보드 대체 내장 |
| 아이콘 | `lucide-react` | tree-shaking |
| 애니메이션 | `framer-motion` | `LazyMotion` 으로 번들 축소 |
| 날짜 | `date-fns` + `date-fns/locale/ko` | `format`, `differenceInCalendarDays` 만 사용 |
| PWA | `next-pwa` 또는 수동 SW + manifest | 수동 권장(제어 명확) |
| 테스트 | Vitest + Testing Library + Playwright | — |
| 배포 | Vercel | 정적 배포 |

> **왜 Zustand인가** — Context + useReducer는 체크 1건에 전체 트리 리렌더가 발생합니다.
> 예식 50건 × 32항목 환경에서 선택자 기반 구독(Zustand)이 필요합니다. (NFR-PERF-03)

---

## 2. 폴더 구조

```
wedding-desk-checklist/
├─ public/
│  ├─ manifest.webmanifest
│  ├─ sw.js                          # Service Worker (수동 작성)
│  └─ icons/                         # 192·256·384·512, maskable
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx                  # html/body, 폰트, Providers
│  │  ├─ page.tsx                    # 오늘 (/)
│  │  ├─ globals.css                 # Tailwind + @theme 토큰
│  │  ├─ (app)/
│  │  │  ├─ layout.tsx               # AppShell (Sidebar/BottomTab/Topbar)
│  │  │  ├─ events/
│  │  │  │  ├─ page.tsx              # 예식 목록
│  │  │  │  ├─ new/page.tsx          # 예식 등록
│  │  │  │  └─ [id]/
│  │  │  │     ├─ page.tsx           # 예식 상세 (탭 = searchParams)
│  │  │  │     └─ edit/page.tsx
│  │  │  ├─ schedule/page.tsx
│  │  │  ├─ memos/page.tsx
│  │  │  ├─ templates/
│  │  │  │  ├─ page.tsx
│  │  │  │  └─ [id]/page.tsx
│  │  │  └─ settings/page.tsx
│  │  └─ onboarding/page.tsx
│  │
│  ├─ components/
│  │  ├─ ui/                         # shadcn 생성물 (수정 최소화)
│  │  ├─ layout/
│  │  │  ├─ app-shell.tsx
│  │  │  ├─ sidebar.tsx
│  │  │  ├─ bottom-tab.tsx
│  │  │  ├─ topbar.tsx
│  │  │  └─ fab.tsx
│  │  ├─ checklist/
│  │  │  ├─ checklist-view.tsx       # 카테고리 아코디언 컨테이너
│  │  │  ├─ category-section.tsx
│  │  │  ├─ checklist-item-row.tsx   # ★ 최다 렌더 — memo 필수
│  │  │  ├─ item-checkbox.tsx
│  │  │  ├─ item-due-badge.tsx
│  │  │  ├─ item-memo-popover.tsx
│  │  │  └─ bulk-check-button.tsx
│  │  ├─ progress/
│  │  │  ├─ progress-ring.tsx        # SVG 원형
│  │  │  ├─ progress-bar.tsx
│  │  │  └─ category-stack-bar.tsx
│  │  ├─ event/
│  │  │  ├─ event-card.tsx
│  │  │  ├─ event-list.tsx
│  │  │  ├─ event-form.tsx           # RHF + Zod
│  │  │  ├─ event-header.tsx
│  │  │  ├─ event-tabs.tsx
│  │  │  ├─ dday-badge.tsx
│  │  │  └─ event-label.tsx          # 라벨 생성 규칙 단일 창구
│  │  ├─ schedule/
│  │  │  ├─ milestone-timeline.tsx
│  │  │  ├─ schedule-day-group.tsx
│  │  │  └─ month-grid.tsx
│  │  ├─ memo/
│  │  │  ├─ memo-composer.tsx
│  │  │  ├─ memo-item.tsx
│  │  │  ├─ memo-list.tsx
│  │  │  └─ tag-filter.tsx
│  │  ├─ template/
│  │  │  ├─ template-list.tsx
│  │  │  ├─ template-editor.tsx
│  │  │  ├─ sortable-category.tsx
│  │  │  └─ sortable-item.tsx
│  │  ├─ search/
│  │  │  ├─ search-dialog.tsx        # cmdk
│  │  │  └─ search-result-group.tsx
│  │  ├─ attachment/
│  │  │  ├─ attachment-list.tsx
│  │  │  ├─ file-drop.tsx
│  │  │  └─ link-form.tsx
│  │  ├─ privacy/
│  │  │  ├─ pii-warning.tsx          # 입력창 하단 상시 안내
│  │  │  └─ privacy-notice.tsx
│  │  └─ common/
│  │     ├─ empty-state.tsx
│  │     ├─ confirm-dialog.tsx
│  │     ├─ undo-toast.tsx
│  │     ├─ kpi-card.tsx
│  │     ├─ section-header.tsx
│  │     └─ hydration-gate.tsx       # persist 복원 전 스켈레톤
│  │
│  ├─ store/
│  │  ├─ index.ts                    # createStore + persist
│  │  ├─ slices/
│  │  │  ├─ events.slice.ts
│  │  │  ├─ memos.slice.ts
│  │  │  ├─ templates.slice.ts
│  │  │  ├─ settings.slice.ts
│  │  │  └─ ui.slice.ts              # persist 제외
│  │  ├─ selectors/
│  │  │  ├─ progress.ts
│  │  │  ├─ today.ts
│  │  │  ├─ schedule.ts
│  │  │  └─ search.ts
│  │  └─ migrations.ts
│  │
│  ├─ lib/
│  │  ├─ checklist/
│  │  │  ├─ default-template.ts      # docs/08 시드
│  │  │  ├─ instantiate.ts           # 템플릿 → 예식 항목 스냅샷
│  │  │  └─ status.ts                # done/overdue/today/soon 판정
│  │  ├─ date/
│  │  │  ├─ dday.ts
│  │  │  ├─ due.ts                   # dueOffset ↔ dueDate 변환
│  │  │  └─ format.ts                # ko 로케일 표기
│  │  ├─ privacy/
│  │  │  ├─ pii-patterns.ts
│  │  │  └─ pii-guard.ts             # block / warn 판정
│  │  ├─ storage/
│  │  │  ├─ local.ts                 # 안전 read/write + quota 처리
│  │  │  ├─ files.ts                 # IndexedDB Blob CRUD
│  │  │  ├─ quota.ts                 # 사용량 계산
│  │  │  └─ backup.ts                # JSON export/import
│  │  ├─ notify/
│  │  │  ├─ permission.ts
│  │  │  └─ scheduler.ts
│  │  ├─ id.ts                       # nanoid 래퍼
│  │  └─ utils.ts                    # cn()
│  │
│  ├─ hooks/
│  │  ├─ use-hydrated.ts
│  │  ├─ use-today.ts                # 자정 경과·포커스 복귀 시 갱신
│  │  ├─ use-keyboard-shortcut.ts
│  │  ├─ use-undo.ts
│  │  └─ use-media-query.ts
│  │
│  ├─ types/
│  │  ├─ event.ts
│  │  ├─ checklist.ts
│  │  ├─ memo.ts
│  │  ├─ template.ts
│  │  └─ settings.ts
│  │
│  ├─ schemas/                       # Zod
│  │  ├─ event.schema.ts
│  │  ├─ memo.schema.ts
│  │  ├─ template.schema.ts
│  │  └─ backup.schema.ts
│  │
│  └─ messages/ko.ts                 # 모든 UI 문자열
│
├─ docs/                             # 이 문서들
├─ legacy/                           # 기존 프로토타입 보관
├─ tests/
│  ├─ unit/                          # progress, dday, pii
│  └─ e2e/                           # playwright
├─ next.config.ts
├─ tailwind.config.ts
└─ package.json
```

---

## 3. 컴포넌트 설계

### 3-1. 컴포넌트 계층

```
AppShell
├─ Sidebar / BottomTab       (nav + 배지)
├─ Topbar                    (제목 · 날짜 · SearchTrigger)
├─ SearchDialog              (전역, cmdk)
├─ ToastRegion               (전역)
└─ {page}

TodayPage
├─ DdayBanner?               (오늘 예식 있을 때만)
├─ TodoSection
│   ├─ SectionHeader
│   └─ ChecklistItemRow[]    (예식 상세와 동일 컴포넌트 재사용, variant="compact")
├─ KpiCard[] ×4
├─ UpcomingSection → ScheduleDayGroup[]
├─ MemoComposer + MemoItem[]
└─ RecentDoneList

EventDetailPage
├─ EventHeader → ProgressRing + DdayBadge + EventLabel
├─ EventTabs
├─ ChecklistView → CategorySection[] → ChecklistItemRow[]
│                                        ├─ ItemCheckbox
│                                        ├─ ItemDueBadge
│                                        └─ ItemMemoPopover?
├─ MilestoneTimeline
├─ MemoList
└─ AttachmentList
```

### 3-2. 핵심 컴포넌트 인터페이스

```ts
// components/checklist/checklist-item-row.tsx
type ChecklistItemRowProps = {
  eventId: string
  itemKey: string
  variant?: 'default' | 'compact'   // compact = 홈/일정 화면 (예식 라벨 함께 표시)
  showEventLabel?: boolean
  onToggle?: (next: boolean) => void
}
// 구현 규칙
// 1) props로 item 객체를 받지 않고 itemKey로 store를 구독한다
//    → 다른 항목 변경 시 리렌더되지 않음
// 2) React.memo + useShallow 로 감싼다
// 3) 토글은 store action 1개만 호출한다 (낙관적 갱신 불필요, 로컬이므로 즉시)
```

```ts
// components/progress/progress-ring.tsx
type ProgressRingProps = {
  value: number          // 0-100
  size?: number          // 기본 88
  strokeWidth?: number   // 기본 8
  label?: string         // 기본 `${value}%`
  tone?: 'primary' | 'success'   // 100%면 자동 success
}
// SVG 2겹(trail + indicator), strokeDasharray = 2πr
// framer-motion 의 animate로 strokeDashoffset 트윈
// role="progressbar" aria-valuenow/min/max, aria-label 필수
```

```ts
// components/event/event-form.tsx
const eventFormSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '예식일을 선택해 주세요'),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  hall: z.string().max(20).optional(),
  alias: z.string().max(30).optional().superRefine(piiRefine),  // ★ PII 차단
  templateId: z.string().min(1),
})
```

```ts
// lib/privacy/pii-guard.ts
export const PII_RULES = [
  { key: 'phone',   level: 'block', re: /(0(1[0-9]|[2-6][0-9]?))[-.\s]?\d{3,4}[-.\s]?\d{4}/ },
  { key: 'rrn',     level: 'block', re: /\d{6}[-\s]?[1-4]\d{6}/ },
  { key: 'email',   level: 'block', re: /[\w.+-]+@[\w-]+\.[A-Za-z]{2,}/ },
  { key: 'card',    level: 'block', re: /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/ },
  { key: 'money',   level: 'warn',  re: /\d{1,3}(,\d{3})+\s?원|\d+\s?만\s?원/ },
  { key: 'address', level: 'warn',  re: /\S+(시|도)\s*\S+(구|군|시)\s*\S+(로|길)\s*\d/ },
] as const

export type PiiResult =
  | { ok: true; warnings: string[] }
  | { ok: false; blocked: string[]; warnings: string[] }

export function checkPii(text: string): PiiResult { /* ... */ }

// Zod 연결
export const piiRefine: (v: string | undefined, ctx: z.RefinementCtx) => void
```

### 3-3. 컴포넌트 작성 규칙

1. **서버/클라이언트 경계** — 데이터가 전부 LocalStorage에 있으므로 store를 읽는 컴포넌트는
   모두 `'use client'`. 페이지 컴포넌트는 얇은 래퍼로 두고 실제 화면은 client 컴포넌트에 위임.
2. **하이드레이션** — `persist` 복원 전에 렌더하면 서버 HTML과 불일치합니다.
   `skipHydration: true` + `HydrationGate` 로 복원 완료 후 렌더, 그 전에는 스켈레톤.
3. **문자열 하드코딩 금지** — 모든 UI 문자열은 `messages/ko.ts` 에서 가져옵니다.
4. **날짜 포맷 단일 창구** — `lib/date/format.ts` 만 사용. 컴포넌트에서 `toLocaleDateString` 금지.
5. **파생값은 selector에서** — 컴포넌트에서 `items.filter(...)` 금지. `selectors/` 의
   메모이즈된 함수 사용.
6. **접근성 필수 속성** — 체크박스 `aria-checked`, 아코디언 `aria-expanded`,
   진행률 `role="progressbar"`, 네비 `aria-current`.

---

## 4. LocalStorage 데이터 구조

### 4-1. 키 구성

| 키 | 내용 | 예상 크기 |
| --- | --- | --- |
| `wdc:v1:root` | Zustand persist 단일 저장소 (events·memos·templates·settings·meta) | 예식 50건 기준 ~700KB |
| `wdc:v1:recent-search` | 최근 검색어 5건 | < 1KB |
| `wdc:v1:onboarded` | 온보딩 완료 플래그 · 방문 횟수 | < 1KB |
| IndexedDB `wdc-files` | 첨부 Blob (`{id, eventId, itemKey, name, mime, size, blob}`) | 최대 50MB/예식 |

> 첨부를 LocalStorage에 넣으면 5MB 한계에서 즉사합니다. **파일은 반드시 IndexedDB**,
> LocalStorage에는 메타데이터(id·이름·크기)만 둡니다.

### 4-2. 타입 정의

```ts
// types/checklist.ts
export type CategoryKey =
  | 'contract' | 'tasting' | 'sdm' | 'invitation' | 'guarantee' | 'mealTicket'
  | 'program' | 'video' | 'parents' | 'flower' | 'pyebaek' | 'dday'

export type ChecklistCategory = {
  key: string            // 커스텀 카테고리는 nanoid
  name: string
  icon: string           // lucide 아이콘 이름
  order: number
}

export type ChecklistSeedItem = {
  key: string
  category: string
  label: string
  dueOffset: number      // 예식일 기준 N일 전 (0 = 당일)
  optional?: boolean
  hint?: string
  dependsOn?: { key: string; when: 'done' | 'notDone' }
}

// 예식에 복사된 실제 항목 (상태 포함)
export type ChecklistItem = ChecklistSeedItem & {
  order: number
  done: boolean
  doneAt: string | null       // ISO 8601
  dueOverride: string | null  // 'YYYY-MM-DD' — 개별 기한 수정 시
  memo: string | null         // 항목 메모 (짧은 1줄)
  attachmentIds: string[]
  custom?: boolean            // 사용자가 이 예식에만 추가한 항목
}
```

```ts
// types/event.ts
export type EventStatus = 'active' | 'done' | 'archived'

export type WeddingEvent = {
  id: string                  // nanoid(10)
  code: string                // 'W-260516-1300' 자동 생성, 표시용 식별자
  date: string                // 'YYYY-MM-DD'  ★ 유일한 필수 필드
  time: string | null         // 'HH:mm'
  hall: string | null         // 자사 시설명
  alias: string | null        // 사용자 별칭 (PII 차단 통과 필수)
  templateId: string
  templateName: string        // 스냅샷 당시 이름 (템플릿 삭제돼도 표시 가능)
  categories: ChecklistCategory[]   // 스냅샷
  items: ChecklistItem[]            // 스냅샷 (기본 32개)
  status: EventStatus
  createdAt: string
  updatedAt: string
}
// ※ 이름·연락처·주소·이메일·금액 필드는 존재하지 않는다. (설계상 저장 불가)
```

```ts
// types/memo.ts
export type Memo = {
  id: string
  eventId: string | null      // null = 일반 메모
  body: string                // 최대 1000자
  tags: string[]              // '#' 제외한 문자열
  pinned: boolean
  createdAt: string
  updatedAt: string
}

// types/template.ts
export type Template = {
  id: string                  // 'tpl_default' | nanoid
  name: string
  categories: ChecklistCategory[]
  items: ChecklistSeedItem[]
  isSystem: boolean           // true = 기본 템플릿 (삭제 불가)
  isDefault: boolean          // 예식 등록 시 기본 선택
  createdAt: string
  updatedAt: string
}

// types/settings.ts
export type Settings = {
  defaultTemplateId: string
  includeOptionalInProgress: boolean   // 기본 true
  collapseCompletedCategory: boolean   // 기본 true
  theme: 'system' | 'light' | 'dark'
  notify: {
    inAppBadge: boolean                // 기본 true
    browser: boolean                   // 기본 false (사용자가 켜야 함)
    time: string                       // 'HH:mm' 기본 '09:00'
    dMinus7: boolean
    dMinus3: boolean
    dDay: boolean
    overdue: boolean
  }
  lastUsedHalls: string[]              // 칩 정렬용, 최대 5
  lastUsedTimes: string[]
}
```

### 4-3. 저장 형태 (실제 JSON)

```json
{
  "state": {
    "meta":     { "schemaVersion": 1, "appVersion": "1.0.0", "updatedAt": "2026-08-13T05:12:00.000Z" },
    "events":   [ { "id": "kQ2f8xTp1a", "code": "W-260516-1300", "date": "2026-05-16",
                    "time": "13:00", "hall": "그랜드홀", "alias": "5월 셋째 주 1부",
                    "templateId": "tpl_default", "templateName": "기본 템플릿",
                    "categories": [ /* 12 */ ],
                    "items": [ { "key": "contract.done", "category": "contract",
                                 "label": "계약 완료", "dueOffset": 180, "order": 1,
                                 "done": true, "doneAt": "2025-11-18T02:31:00.000Z",
                                 "dueOverride": null, "memo": null, "attachmentIds": [] } ],
                    "status": "active",
                    "createdAt": "2025-11-17T…", "updatedAt": "2026-08-13T…" } ],
    "memos":    [ { "id": "m_9dK2", "eventId": "kQ2f8xTp1a", "body": "영상 수정 예정",
                    "tags": ["영상"], "pinned": true,
                    "createdAt": "2026-08-13T01:24:00.000Z", "updatedAt": "…" } ],
    "templates":[ { "id": "tpl_default", "name": "기본 템플릿", "isSystem": true,
                    "isDefault": true, "categories": [], "items": [] } ],
    "settings": { "defaultTemplateId": "tpl_default", "theme": "system", "notify": {} }
  },
  "version": 1
}
```

### 4-4. 용량 관리

```ts
// lib/storage/local.ts
export function safeSetItem(key: string, value: string): 
  { ok: true } | { ok: false; reason: 'quota' | 'unavailable' } {
  try {
    localStorage.setItem(key, value)
    return { ok: true }
  } catch (e) {
    if (e instanceof DOMException &&
        (e.name === 'QuotaExceededError' || e.code === 22)) {
      return { ok: false, reason: 'quota' }
    }
    return { ok: false, reason: 'unavailable' }   // 시크릿 모드 등
  }
}
```

- 저장 실패 시: 전역 모달 + `설정 > 데이터` 로 유도, 이후 편집은 메모리에서 계속 동작
  (사용자가 정리하면 재저장 시도).
- 사용량 표시: `new Blob([raw]).size` 로 LocalStorage 사용량,
  `navigator.storage.estimate()` 로 IndexedDB 사용량 계산.
- 정리 우선순위 안내: ① 첨부 파일 → ② 보관된 예식 → ③ 오래된 메모.

### 4-5. 스키마 마이그레이션

```ts
// store/migrations.ts
export const CURRENT_SCHEMA_VERSION = 1

export function migrate(persisted: unknown, fromVersion: number) {
  let s = persisted as any
  if (fromVersion < 1) s = migrateV0toV1(s)
  // 이후 버전은 여기에 누적. 각 단계는 순수 함수 + 단위 테스트 필수
  return s
}
```

- `persist({ version: CURRENT_SCHEMA_VERSION, migrate })`
- 마이그레이션 실패 시: 원본을 `wdc:v1:root.bak.<timestamp>` 로 보존한 뒤 초기화하고,
  "이전 데이터를 복원하지 못했습니다. 백업 파일을 저장했습니다" 안내 + JSON 내려받기 제공.
- **파괴적 마이그레이션 금지** — 항목 `key` 는 절대 재사용/변경하지 않습니다.

### 4-6. 백업 JSON 포맷

```json
{
  "app": "wedding-desk-checklist",
  "schemaVersion": 1,
  "exportedAt": "2026-08-13T05:20:00.000Z",
  "data": { "events": [], "memos": [], "templates": [], "settings": {} },
  "attachments": "not-included"
}
```
- `backup.schema.ts` (Zod)로 가져오기 시 전체 검증. 실패하면 아무것도 반영하지 않습니다.
- 가져오기 모드: **병합**(id 충돌 시 새 id 부여) / **교체**(전체 대치, 확인 2단계).
- 첨부 파일은 JSON에 포함하지 않습니다(용량). 별도 ZIP 내보내기는 v1.2 이후.

---

## 5. 상태 관리 구조

### 5-1. 스토어 구성

```ts
// store/index.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

export type AppStore = EventsSlice & MemosSlice & TemplatesSlice & SettingsSlice & UiSlice & {
  meta: { schemaVersion: number; appVersion: string; updatedAt: string }
}

export const useStore = create<AppStore>()(
  persist(
    immer((...a) => ({
      ...createEventsSlice(...a),
      ...createMemosSlice(...a),
      ...createTemplatesSlice(...a),
      ...createSettingsSlice(...a),
      ...createUiSlice(...a),
      meta: { schemaVersion: 1, appVersion: '1.0.0', updatedAt: new Date().toISOString() },
    })),
    {
      name: 'wdc:v1:root',
      version: CURRENT_SCHEMA_VERSION,
      migrate,
      skipHydration: true,                 // ★ Next.js 하이드레이션 불일치 방지
      partialize: (s) => ({                // ui 슬라이스는 저장 제외
        meta: s.meta, events: s.events, memos: s.memos,
        templates: s.templates, settings: s.settings,
      }),
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
```

`app/(app)/layout.tsx` 에서 최초 1회 `useStore.persist.rehydrate()` 호출 →
`HydrationGate` 가 완료 전 스켈레톤을 렌더합니다.

### 5-2. 슬라이스 액션 목록

```ts
// events.slice.ts
addEvent(input: EventFormInput): string          // 템플릿 스냅샷 생성, id 반환
updateEvent(id, patch: Partial<WeddingEvent>): void
changeEventDate(id, date: string): void          // 기한 재계산(완료 상태 보존)
deleteEvent(id): WeddingEvent                    // Undo용 스냅샷 반환
restoreEvent(snapshot): void
archiveEvent(id): void
duplicateEvent(id): string
toggleItem(eventId, itemKey): void               // ★ 최다 호출 — doneAt 자동 기록
bulkToggleCategory(eventId, categoryKey, next: boolean): void
setItemDue(eventId, itemKey, date: string | null): void
setItemMemo(eventId, itemKey, memo: string | null): void
addCustomItem(eventId, input): void
removeItem(eventId, itemKey): void

// memos.slice.ts
addMemo(input): string   updateMemo(id, patch)   deleteMemo(id): Memo
restoreMemo(snapshot)    togglePin(id)

// templates.slice.ts
duplicateTemplate(id, name): string
updateTemplate(id, patch)                deleteTemplate(id)
addTemplateItem(id, item)                removeTemplateItem(id, key)
reorderTemplateItems(id, categoryKey, from, to)
reorderCategories(id, from, to)
setDefaultTemplate(id)

// settings.slice.ts
updateSettings(patch)   pushRecentHall(hall)   pushRecentTime(time)

// ui.slice.ts (persist 제외)
searchOpen  searchQuery  activeTab  expandedCategories  toast[]
```

### 5-3. 액션 규칙

```ts
// toggleItem 구현 예 — immer 사용
toggleItem: (eventId, itemKey) => set((s) => {
  const ev = s.events.find(e => e.id === eventId); if (!ev) return
  const it = ev.items.find(i => i.key === itemKey); if (!it) return
  if (isDisabledByDependency(ev, it)) return          // 조건부 비활성 항목 보호
  it.done = !it.done
  it.doneAt = it.done ? new Date().toISOString() : null
  ev.updatedAt = new Date().toISOString()
  if (itemKey === 'dday.complete' && it.done) ev.status = 'done'
  if (itemKey === 'dday.complete' && !it.done) ev.status = 'active'
  s.meta.updatedAt = ev.updatedAt
})
```

1. 모든 mutation은 액션을 통해서만. 컴포넌트에서 `set` 직접 호출 금지.
2. 액션 내부에서 `updatedAt` 을 항상 갱신합니다.
3. 삭제 액션은 **삭제된 객체를 반환**해 Undo 토스트가 복원할 수 있게 합니다.
4. persist 쓰기는 300ms 디바운스(연속 체크 시 쓰기 폭주 방지).

### 5-4. 선택자 (파생 상태)

```ts
// selectors/progress.ts
export function selectProgress(ev: WeddingEvent, includeOptional: boolean) {
  const active = ev.items.filter(i =>
    !isDisabledByDependency(ev, i) && (includeOptional || !i.optional))
  const done = active.filter(i => i.done).length
  return { done, total: active.length,
           percent: active.length ? Math.round((done / active.length) * 100) : 0 }
}

// selectors/today.ts
export function selectTodayTasks(events: WeddingEvent[], today: string) {
  // overdue → today 순, 각 그룹 안에서는 기한 오름차순 → 예식 D-Day 오름차순
}
export function selectUpcoming(events, today, days = 7)
export function selectRecentlyDone(events, hours = 24)

// selectors/search.ts
export function selectSearchResults(state, q: string):
  { events: […]; items: […]; memos: […]; schedule: […] }
```

- 선택자는 **순수 함수**로 두고 컴포넌트에서 `useMemo` 로 감쌉니다.
  (`reselect` 도입은 예식 100건 이상에서 성능 측정 후 판단)
- 항목 단위 구독:
  ```ts
  const item = useStore(s =>
    s.events.find(e => e.id === eventId)?.items.find(i => i.key === itemKey))
  ```
  → 이 형태는 매 렌더 새 참조를 만들 수 있으므로 필요한 원시값만 뽑아 구독합니다.
  ```ts
  const done = useStore(s => selectItem(s, eventId, itemKey)?.done ?? false)
  ```

### 5-5. "오늘" 기준일 관리

```ts
// hooks/use-today.ts
// D-Day·오늘 목록은 today 값에 의존합니다. 다음 시점에 갱신합니다.
// 1) 다음 자정까지 setTimeout
// 2) window focus / visibilitychange 복귀
// 3) 시스템 시간 변경 대비 60초 폴링(가벼움)
export function useToday(): string   // 'YYYY-MM-DD'
```

프로토타입의 `TODAY = '2026-02-10'` 고정값은 제거하고, 테스트에서만 주입 가능하게
`TodayProvider` 로 감쌉니다(Playwright에서 시간 고정 테스트용).

### 5-6. 성능 체크리스트

| 항목 | 조치 |
| --- | --- |
| 체크 1건에 전체 리렌더 | 원시값 단위 구독 + `React.memo` |
| 목록 스크롤 | 예식 30건 초과 시 `@tanstack/react-virtual` 도입 |
| persist 쓰기 폭주 | 300ms 디바운스 |
| 선택자 재계산 | `useMemo(deps: [events, today, settings])` |
| framer-motion 번들 | `LazyMotion` + `domAnimation` |
| 아이콘 번들 | `lucide-react` 개별 import |
