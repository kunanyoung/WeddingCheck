# 06. 디자인 시스템 · Figma 스타일 가이드

컨셉: **Modern · Simple · Clean · Luxury Wedding**
지정된 브랜드 값(`#C8A36B`, `#FFF8F2`, `#FAFAFA`, `#67C587`, radius 18px, Pretendard,
Lucide, Framer Motion)을 기준으로 실제 구현 가능한 토큰 세트로 확장했습니다.

---

## 1. 먼저 짚어야 할 접근성 제약

지정된 Primary/Success를 **텍스트 색으로 쓰면 WCAG AA에 미달합니다.** 흰 배경 대비:

| 색 | 흰 배경 대비 | 본문 텍스트(4.5:1) | UI·큰 텍스트(3:1) |
| --- | --- | --- | --- |
| `#C8A36B` Primary | **2.36:1** | ✕ 미달 | ✕ 미달 |
| `#67C587` Success | **2.11:1** | ✕ 미달 | ✕ 미달 |

따라서 **역할을 분리**합니다. 브랜드 색은 "채움(fill)·강조 면적"에, 텍스트·아이콘·포커스링에는
같은 색조의 어두운 변형을 씁니다. 브랜드 인상은 유지되고 대비는 통과합니다.

| 용도 | 토큰 | 값 | 흰 배경 대비 | 판정 |
| --- | --- | --- | --- | --- |
| 버튼 배경·진행률 채움·활성 바 | `primary-500` | `#C8A36B` | 2.36:1 | 비텍스트 ✓ |
| 링크·강조 텍스트·아이콘·포커스링 | `primary-700` | `#8A6A33` | **5.01:1** | AA ✓ |
| 완료 체크 채움·성공 배경 | `success-500` | `#67C587` | 2.11:1 | 비텍스트 ✓ |
| 완료 텍스트·성공 메시지 | `success-700` | `#2F855A` | **4.54:1** | AA ✓ |
| `primary-500` 위 텍스트 | `white` | `#FFFFFF` | 2.25:1 | ✕ → **`#3D2E12` 사용 (7.2:1)** |

> `#C8A36B` 버튼 위 글자는 **흰색이 아니라 진한 브라운(`#3D2E12`)** 이어야 합니다.
> 골드 버튼 + 흰 글자는 흔한 실수이고 실제로 잘 안 보입니다.

---

## 2. 색 토큰

### 2-1. Primary (Gold)

| 토큰 | HEX | 용도 |
| --- | --- | --- |
| `primary-50` | `#FDF9F2` | 선택 행 배경, 검색 하이라이트 |
| `primary-100` | `#F7EEDD` | 뱃지 배경, 진행률 trail |
| `primary-200` | `#EEDCBC` | 구분선 강조, 비활성 채움 |
| `primary-300` | `#E0C596` | hover 채움 |
| `primary-400` | `#D4B27E` | 다크모드 강조색 |
| **`primary-500`** | **`#C8A36B`** | **브랜드 기본 — 버튼·진행률·활성 표시** |
| `primary-600` | `#AE8850` | 버튼 hover |
| `primary-700` | `#8A6A33` | 텍스트·아이콘·포커스링 (AA) |
| `primary-800` | `#6B5228` | 버튼 active, 강한 텍스트 |
| `primary-900` | `#4A391B` | 헤드라인 강조 |
| `primary-ink` | `#3D2E12` | `primary-500` 배경 위의 텍스트 |

### 2-2. Neutral (Warm Gray — Secondary #FFF8F2 계열과 조화)

| 토큰 | HEX | 흰 배경 대비 | 용도 |
| --- | --- | --- | --- |
| `bg` | `#FAFAFA` | — | 페이지 배경 |
| `bg-warm` | `#FFF8F2` | — | Secondary — 사이드바, 카드 강조 영역 |
| `surface` | `#FFFFFF` | — | 카드, 시트, 모달 |
| `surface-2` | `#F6F3EF` | — | 중첩 카드, 입력창 배경 |
| `border` | `#EAE3DA` | 1.13:1 | 카드·구분선 (비텍스트) |
| `border-strong` | `#D6CCBF` | 1.42:1 | 입력창 테두리 |
| `ink` | `#201C17` | **16.9:1** | 본문·제목 |
| `muted` | `#6B6259` | **5.91:1** | 보조 텍스트 (AA) |
| `muted-2` | `#7A7166` | **4.79:1** | 캡션·메타 (AA, 최소 12px) |
| `disabled` | `#A79E93` | 2.85:1 | 비활성 텍스트 (비필수 정보만) |

### 2-3. Semantic

| 역할 | fill | text | bg (연한) | 용도 |
| --- | --- | --- | --- | --- |
| Success | `#67C587` | `#2F855A` (4.54:1) | `#EEF9F1` | 완료, 100% 달성 |
| Warning | `#E8A33D` | `#A65F00` (4.93:1) | `#FEF6E7` | D-7 이내, 임박 |
| Danger | `#E05C5C` | `#D14343` (4.57:1) | `#FDEEEE` | 지연, 삭제 |
| Info | `#7C96C4` | `#41608F` (5.34:1) | `#EEF2F9` | 안내, 개인정보 고지 |

### 2-4. 상태별 색 매핑 (체크 항목)

| 상태 | 텍스트 | 뱃지 배경 | 뱃지 텍스트 | 좌측 스트립 |
| --- | --- | --- | --- | --- |
| `done` | `muted` | `success-bg` | `success-text` | — |
| `overdue` | `ink` | `danger-bg` | `danger-text` | `danger-fill` 3px |
| `today` | `ink` (bold) | `primary-100` | `primary-800` | `primary-500` 3px |
| `soon` | `ink` | `warning-bg` | `warning-text` | — |
| `upcoming` | `ink` | 없음 | `muted-2` | — |
| `disabled` | `disabled` + 취소선 | 없음 | `disabled` | — |

### 2-5. 다크모드 (v1.2)

| 토큰 | Light | Dark |
| --- | --- | --- |
| `bg` | `#FAFAFA` | `#17140F` |
| `bg-warm` | `#FFF8F2` | `#1E1A14` |
| `surface` | `#FFFFFF` | `#211D17` |
| `surface-2` | `#F6F3EF` | `#2A251E` |
| `border` | `#EAE3DA` | `#332D25` |
| `ink` | `#201C17` | `#F5F0E8` |
| `muted` | `#6B6259` | `#B9AFA2` |
| `primary (강조)` | `#8A6A33` | `#D4B27E` (surface 대비 8.3:1 ✓) |
| `primary (채움)` | `#C8A36B` | `#C8A36B` (유지) |

```css
/* 구현: 3-state 대응 — 시스템 기본 + 명시적 토글 */
:root { --bg:#FAFAFA; --surface:#FFFFFF; --ink:#201C17; /* … 전체 라이트 팔레트 */ }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg:#17140F; --surface:#211D17; --ink:#F5F0E8; }
}
:root[data-theme="dark"] { --bg:#17140F; --surface:#211D17; --ink:#F5F0E8; }
```

---

## 3. 타이포그래피

폰트: **Pretendard Variable** (한글·영문·숫자 단일 폰트).
프로토타입의 세리프(Gowun Batang)는 제거합니다 — "Simple/Clean" 컨셉과 가독성 우선.

```
font-family: 'Pretendard Variable', Pretendard, -apple-system,
             'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
숫자: font-feature-settings: 'tnum' 1;   /* D-Day·진행률 자리 흔들림 방지 */
```

| 스타일 | size / line-height | weight | letter-spacing | 용도 |
| --- | --- | --- | --- | --- |
| `display` | 32 / 40 | 700 | -0.02em | 진행률 숫자, 온보딩 제목 |
| `h1` | 24 / 32 | 700 | -0.02em | 페이지 제목 |
| `h2` | 20 / 28 | 700 | -0.01em | 섹션 제목 |
| `h3` | 17 / 24 | 600 | -0.01em | 카테고리 제목, 카드 제목 |
| `body` | 15 / 22 | 400 | 0 | 본문, 체크 항목 라벨 |
| `body-strong` | 15 / 22 | 600 | 0 | 강조 라벨 |
| `sm` | 13 / 18 | 400 | 0 | 보조 설명, 예식 라벨 |
| `caption` | 12 / 16 | 400 | 0.01em | 완료 시각, 메타 |
| `badge` | 12 / 16 | 600 | 0.02em | D-Day, 상태 뱃지 |
| `mono-num` | 15 / 22 | 600 | 0 | `tnum` 적용 숫자 |

- 한글 본문 최소 크기 **13px**. 12px는 메타 정보 한정.
- 모바일에서 `body` 는 15px 유지(16px 승격 불필요, 줄 수가 늘어남).
- 입력 필드는 iOS 자동 확대 방지를 위해 **16px** 사용.

---

## 4. 간격 · 반경 · 그림자

### 4-1. Spacing (4px 기준)

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `space-1` | 4px | 아이콘-텍스트 |
| `space-2` | 8px | 뱃지 내부, 인라인 요소 |
| `space-3` | 12px | 항목 행 내부 여백 |
| `space-4` | 16px | 카드 내부 패딩(모바일), 요소 간격 |
| `space-5` | 20px | 카드 내부 패딩(데스크톱) |
| `space-6` | 24px | 섹션 내부 간격 |
| `space-8` | 32px | 섹션 간격 |
| `space-10` | 40px | 페이지 상단 여백 |
| `space-12` | 48px | 큰 섹션 분리 |
| `space-16` | 64px | 빈 상태 여백 |

### 4-2. Radius (기준 18px)

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `radius-sm` | 8px | 뱃지, 태그, 체크박스 |
| `radius-md` | 12px | 입력창, 작은 버튼, 칩 |
| `radius-lg` | **18px** | **기본 — 카드, 버튼, 모달** |
| `radius-xl` | 24px | 큰 카드, 바텀시트 상단 |
| `radius-full` | 9999px | 원형 진행률, 아바타, pill 버튼 |

### 4-3. Shadow (Soft — luxury 톤은 흐리고 넓게)

```css
--shadow-xs: 0 1px 2px rgba(61, 46, 18, 0.04);
--shadow-sm: 0 2px 8px rgba(61, 46, 18, 0.06);
--shadow-md: 0 4px 16px rgba(61, 46, 18, 0.08);      /* 카드 기본 */
--shadow-lg: 0 8px 32px rgba(61, 46, 18, 0.10);      /* 모달, 팝오버 */
--shadow-xl: 0 16px 48px rgba(61, 46, 18, 0.12);     /* 바텀시트 */
--shadow-focus: 0 0 0 3px rgba(138, 106, 51, 0.35);  /* 포커스링 */
```

그림자 색은 검정(`#000`)이 아니라 **브랜드 브라운 계열 반투명**입니다. 회색 그림자보다
따뜻하게 보이고 배경(`#FFF8F2`)과 어울립니다.

---

## 5. 컴포넌트 스펙

### 5-1. Button

| variant | 배경 | 텍스트 | 테두리 | hover | 용도 |
| --- | --- | --- | --- | --- | --- |
| `primary` | `primary-500` | `primary-ink` | 없음 | `primary-600` | 저장, 등록 |
| `secondary` | `surface` | `ink` | `border-strong` | `surface-2` | 취소, 보조 |
| `ghost` | 투명 | `primary-700` | 없음 | `primary-50` | 인라인 액션 |
| `danger` | `danger-bg` | `danger-text` | `danger-fill` | `#FBE0E0` | 삭제 |

| size | height | padding-x | font | radius |
| --- | --- | --- | --- | --- |
| `sm` | 32px | 12px | 13/18 600 | `radius-md` |
| `md` | 40px | 16px | 15/22 600 | `radius-lg` |
| `lg` | 48px | 20px | 15/22 700 | `radius-lg` |

모바일 주요 버튼은 `lg` + `width:100%`.

### 5-2. Checkbox (핵심 컴포넌트)

```
미체크                체크                 비활성
┌────┐               ┌────┐               ┌┄┄┄┐
│    │  항목 이름     │ ✓  │  항목 이름     ┊    ┊  항목 이름
└────┘               └────┘               └┄┄┄┘
24×24                24×24                24×24
border 2px           bg success-500       border 1px dashed
border-strong        border none          disabled
radius-sm(8)         ✓ #FFFFFF 2px        취소선 라벨
```

- 실제 터치 영역은 **44×44px** (시각 크기는 24px, 여백으로 확장)
- 체크 애니메이션: 배경 fill scale 0.8→1 (120ms) + `✓` path draw (120ms, 60ms 지연)
- `hover`: 테두리 `primary-500`, 배경 `primary-50`
- `focus-visible`: `shadow-focus`
- 스크린리더: `<input type="checkbox" aria-checked>` + `<label>` 로 항목명·기한 함께 읽힘

### 5-3. Card

```
padding: 20px (데스크톱) / 16px (모바일)
background: surface
border: 1px solid border
radius: radius-lg (18px)
shadow: shadow-md
hover(클릭 가능 카드): shadow-lg + translateY(-1px), 160ms
좌측 상태 스트립: 3px, radius 왼쪽만
```

### 5-4. ProgressRing

| size | 지름 | stroke | 내부 숫자 |
| --- | --- | --- | --- |
| `sm` | 40px | 4px | 12/16 600 |
| `md` | 64px | 6px | 17/24 700 |
| `lg` | 88px | 8px | 24/32 700 (`display` 축소) |

- trail `primary-100`, indicator `primary-500`, 100%면 indicator `success-500`
- `stroke-linecap: round`, 12시 시작(`transform: rotate(-90deg)`)
- 100% 달성 시 scale 1→1.06→1 (500ms, 1회)

### 5-5. ProgressBar

```
height: 8px (카드) / 6px (컴팩트)
radius: radius-full
track: primary-100
fill:  primary-500 → 100%면 success-500
transition: width 300ms ease-out
```

### 5-6. Badge

| 종류 | 배경 | 텍스트 | 예시 |
| --- | --- | --- | --- |
| D-Day (당일) | `primary-500` | `primary-ink` | `D-DAY` |
| D-Day (임박) | `warning-bg` | `warning-text` | `D-3` |
| D-Day (일반) | `surface-2` | `muted` | `D-95` |
| 지연 | `danger-bg` | `danger-text` | `3일 지남` |
| 완료 | `success-bg` | `success-text` | `완료 7/22` |
| 카운트 | `primary-100` | `primary-800` | `3/5` |

`height 20px · padding 0 8px · radius-sm · badge 타이포`

### 5-7. Input / Textarea

```
height: 44px (input) / min 88px (textarea)
padding: 12px 14px
font-size: 16px  ← iOS 확대 방지
background: surface
border: 1px solid border-strong
radius: radius-md
focus: border primary-500 + shadow-focus
error: border danger-fill + 하단 danger-text 13px 메시지
helper(개인정보 안내): 하단 info-text 12px + Info 아이콘
```

### 5-8. 아이콘 (Lucide)

| 크기 | 용도 | stroke-width |
| --- | --- | --- |
| 16px | 인라인 텍스트 옆 | 2 |
| 20px | 버튼 내부, 항목 액션 | 2 |
| 24px | 네비게이션, 카테고리 | 2 |
| 32px | 빈 상태 | 1.5 |

주요 매핑: 오늘 `sun` / 예식 `heart` / 일정 `calendar-days` / 메모 `sticky-note` /
템플릿 `layout-list` / 설정 `settings` / 검색 `search` / 추가 `plus` /
지연 `alert-triangle` / 완료 `check-circle-2` / 첨부 `paperclip` / 메모 `message-square` /
개인정보 `shield-check` / 삭제 `trash-2` / 드래그 `grip-vertical`

### 5-9. Toast

```
position: 하단 중앙(모바일) / 우하단(데스크톱), safe-area 고려
width: max 360px
padding: 14px 16px
background: ink(#201C17), 텍스트 #FFFFFF   ← 대비 16.9:1
radius: radius-md
동작: y 12→0 + opacity, 200ms / 5초 후 자동 닫힘
Undo 토스트: 우측에 '되돌리기' ghost 버튼(텍스트 primary-400)
```

---

## 6. Tailwind 토큰 구현

`src/app/globals.css`

```css
@import "tailwindcss";

@theme {
  /* Primary */
  --color-primary-50:  #FDF9F2;
  --color-primary-100: #F7EEDD;
  --color-primary-200: #EEDCBC;
  --color-primary-300: #E0C596;
  --color-primary-400: #D4B27E;
  --color-primary-500: #C8A36B;
  --color-primary-600: #AE8850;
  --color-primary-700: #8A6A33;
  --color-primary-800: #6B5228;
  --color-primary-900: #4A391B;
  --color-primary-ink: #3D2E12;

  /* Neutral */
  --color-bg:            #FAFAFA;
  --color-bg-warm:       #FFF8F2;
  --color-surface:       #FFFFFF;
  --color-surface-2:     #F6F3EF;
  --color-border:        #EAE3DA;
  --color-border-strong: #D6CCBF;
  --color-ink:           #201C17;
  --color-muted:         #6B6259;
  --color-muted-2:       #7A7166;
  --color-disabled:      #A79E93;

  /* Semantic */
  --color-success:     #67C587;
  --color-success-text:#2F855A;
  --color-success-bg:  #EEF9F1;
  --color-warning:     #E8A33D;
  --color-warning-text:#A65F00;
  --color-warning-bg:  #FEF6E7;
  --color-danger:      #E05C5C;
  --color-danger-text: #D14343;
  --color-danger-bg:   #FDEEEE;
  --color-info:        #7C96C4;
  --color-info-text:   #41608F;
  --color-info-bg:     #EEF2F9;

  /* Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --radius-xl: 24px;

  /* Shadow */
  --shadow-xs: 0 1px 2px rgba(61,46,18,.04);
  --shadow-sm: 0 2px 8px rgba(61,46,18,.06);
  --shadow-md: 0 4px 16px rgba(61,46,18,.08);
  --shadow-lg: 0 8px 32px rgba(61,46,18,.10);
  --shadow-xl: 0 16px 48px rgba(61,46,18,.12);

  /* Font */
  --font-sans: 'Pretendard Variable', Pretendard, -apple-system,
               'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;

  /* Breakpoints */
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
}

@layer base {
  :root { color-scheme: light; }
  body { background: var(--color-bg); color: var(--color-ink);
         font-family: var(--font-sans); font-size: 15px; line-height: 1.47; }
  .tnum { font-feature-settings: 'tnum' 1; }
  *:focus-visible { outline: none; box-shadow: var(--shadow-focus); border-radius: 4px; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .01ms !important; transition-duration: .01ms !important;
    }
  }
}
```

`--shadow-focus: 0 0 0 3px rgba(138,106,51,.35)` 는 `@theme` 밖 `:root` 에 둡니다.

### shadcn/ui 매핑

`components.json` 생성 후 `ui/*.tsx` 의 기본 클래스를 위 토큰으로 교체합니다.

| shadcn 변수 | 이 시스템의 토큰 |
| --- | --- |
| `--primary` | `primary-500` |
| `--primary-foreground` | `primary-ink` |
| `--background` | `bg` |
| `--card` | `surface` |
| `--muted` | `surface-2` |
| `--muted-foreground` | `muted` |
| `--border` | `border` |
| `--ring` | `primary-700` |
| `--radius` | `18px` |
| `--destructive` | `danger-text` |

---

## 7. Figma 스타일 가이드

### 7-1. 파일 · 페이지 구성

```
📁 Wedding Desk Checklist
├─ 📄 00 Cover              커버, 버전 이력, 담당
├─ 📄 01 Foundation         색·타이포·간격·반경·그림자 스타일 시트
├─ 📄 02 Components         컴포넌트 세트 (variants)
├─ 📄 03 Patterns           체크리스트 행·카드·빈 상태·토스트 조합
├─ 📄 04 Screens · Desktop  1440px 프레임
├─ 📄 05 Screens · Mobile   390px 프레임
├─ 📄 06 Flows              FigJam 스타일 유저 플로우 (docs/03 대응)
└─ 📄 99 Archive            폐기된 프로토타입(WeddingCheck) 화면 보관
```

### 7-2. Variables (Figma Variables 컬렉션)

| 컬렉션 | 모드 | 변수 그룹 |
| --- | --- | --- |
| `color` | `light` / `dark` | `primary/50…900`, `neutral/*`, `semantic/*` |
| `number` | 단일 | `space/1…16`, `radius/sm…xl`, `size/icon-16…32` |
| `string` | 단일 | `copy/*` (반복 문구: 개인정보 안내 등) |

- 색은 **반드시 Variables** 로 만듭니다 (다크모드 모드 전환을 위해).
- 컴포넌트에서 하드코딩 색 사용 금지 — 린트 규칙: `Design Lint` 플러그인으로 검사.

### 7-3. Text Styles 명명

```
Display/32-700
Heading/H1-24-700      Heading/H2-20-700      Heading/H3-17-600
Body/15-400            Body/15-600
Small/13-400           Small/13-600
Caption/12-400         Badge/12-600
Number/15-600-tnum
```

### 7-4. Effect Styles

```
Elevation/xs   Elevation/sm   Elevation/md   Elevation/lg   Elevation/xl
Focus/Ring
```

### 7-5. Component Sets (variants)

| 컴포넌트 | Property | Values |
| --- | --- | --- |
| `Button` | variant / size / state / icon | primary·secondary·ghost·danger / sm·md·lg / default·hover·active·disabled / none·leading·trailing·only |
| `Checkbox` | state | unchecked·checked·disabled·focus |
| `ChecklistRow` | status / variant / hasMemo / hasFile | done·overdue·today·soon·upcoming·disabled / default·compact / true·false / true·false |
| `Badge` | type | dday-today·dday-soon·dday-normal·overdue·done·count |
| `ProgressRing` | size / tone | sm·md·lg / primary·success |
| `Card` | type / state | event·kpi·memo·section / default·hover |
| `Input` | state | default·focus·error·disabled |
| `EmptyState` | context | today·events·memos·search·files |
| `Nav` | platform / active | sidebar·bottomtab / (항목별) |
| `Toast` | type | default·success·danger·undo |

### 7-6. 프레임 규격

| 대상 | 폭 | 비고 |
| --- | --- | --- |
| Desktop | 1440 × auto | 컨텐츠 max 1120, Sidebar 240 |
| Tablet | 834 × auto | BottomTab |
| Mobile | 390 × 844 | iPhone 14 기준, safe-area 34px 표시 |
| Mobile 최소 | 320 × 568 | 깨짐 검증용 |

### 7-7. 네이밍 · 인수인계 규칙

- 레이어명은 컴포넌트 역할로: `EventCard/Progress/Bar` (`Rectangle 24` 금지)
- Auto Layout 필수, 고정 크기 사용 금지 (반응형 검증용)
- 아이콘은 Lucide Figma 플러그인에서 가져와 `Icon/{name}` 로 컴포넌트화
- 각 화면 프레임 우측에 개발 노트(요구사항 ID 표기): `FR-CHK-01`, `FR-PRG-04` 등
- 개발자 전달 시 **Dev Mode** 로 토큰 값이 변수명으로 노출되는지 확인
- 색 변경은 Figma Variables → `globals.css` `@theme` 순서로 반영 (역방향 금지)

---

## 8. 디자인 QA 체크리스트

| 항목 | 확인 |
| --- | --- |
| 하드코딩 색 | 0건 (모두 토큰 참조) |
| 본문 텍스트 대비 | 4.5:1 이상 |
| 골드 배경 위 텍스트 | `primary-ink`(`#3D2E12`) 사용 — 흰색 금지 |
| 터치 타깃 | 모바일 44×44px 이상 |
| 포커스 표시 | 모든 인터랙티브 요소에 `shadow-focus` |
| 320px 폭 | 가로 스크롤 없음, 텍스트 잘림 없음 |
| 숫자 정렬 | D-Day·진행률에 `tnum` 적용 |
| 모션 축소 | `prefers-reduced-motion` 시 애니메이션 제거 |
| 다크모드 | 모든 토큰이 dark 모드 값 보유 |
| 빈 상태 | 8개 화면 전부 정의됨 |
