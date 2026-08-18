# 08. 기본 체크리스트 템플릿 (기준 데이터)

> 이 문서는 다른 모든 문서가 참조하는 **단일 기준 데이터**입니다. 항목 수·키·D-오프셋이
> 바뀌면 진행률·일정 자동 생성·알림이 모두 영향을 받으므로 여기서만 수정합니다.

## 1. 구성 요약

| 항목 | 값 |
| --- | --- |
| 카테고리 | 12개 |
| 체크 항목 | **32개** |
| 항목 1개당 진행률 | 3.125% (100 ÷ 32) |
| 기준 템플릿 ID | `tpl_default` (이름: `기본 템플릿`) |
| 최초 마일스톤 | D-180 |
| 마지막 마일스톤 | D-0 (Wedding Day) |

진행률 예시값(0 / 25 / 50 / 75 / 100%)은 UI 표기 예시이며, 실제로는 체크 개수 ÷ 전체 개수를
반올림해 정수 %로 표시합니다. (예: 8/32 = 25%, 16/32 = 50%)

## 2. 카테고리

순서(`order`)는 예식 준비 시간축을 따릅니다. 사용자가 순서를 바꿀 수 있습니다.

| order | key | 이름 | 항목 수 | Lucide 아이콘 |
| --- | --- | --- | --- | --- |
| 1 | `contract` | 계약 | 4 | `file-signature` |
| 2 | `tasting` | 시식 | 2 | `utensils` |
| 3 | `sdm` | 스드메 | 2 | `camera` |
| 4 | `invitation` | 청첩장 | 2 | `mail` |
| 5 | `guarantee` | 보증인원 | 2 | `users` |
| 6 | `mealTicket` | 식권 | 2 | `ticket` |
| 7 | `program` | 식순 | 5 | `list-ordered` |
| 8 | `video` | 영상 | 2 | `monitor-play` |
| 9 | `parents` | 혼주 | 2 | `heart-handshake` |
| 10 | `flower` | 꽃장식 | 2 | `flower-2` |
| 11 | `pyebaek` | 폐백 | 2 | `gift` |
| 12 | `dday` | 당일 | 5 | `calendar-check` |

## 3. 체크 항목 32개 + 기본 D-오프셋

`dueOffset` = 예식일로부터 며칠 전인지. `기한 = 예식일 − dueOffset일`.
0은 예식 당일입니다. 모든 값은 사용자가 예식별로 수정할 수 있습니다.

| # | key | 카테고리 | 항목 | dueOffset | 기본 필수 | 근거 / 메모 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `contract.done` | 계약 | 계약 완료 | D-180 | 필수 | 준비 시작점 |
| 2 | `contract.deliver` | 계약 | 계약서 전달 | D-175 | 필수 | 계약 후 5일 내 |
| 3 | `contract.collect` | 계약 | 계약서 회수 | D-170 | 필수 | 서명본 회수 |
| 4 | `contract.verify` | 계약 | 계약 확인 | D-165 | 필수 | 홀·시간·조건 재확인 |
| 5 | `tasting.book` | 시식 | 시식 예약 | D-180 | 필수 | 계약과 동시 안내 |
| 6 | `tasting.done` | 시식 | 시식 완료 | D-150 | 필수 | 메뉴 확정으로 이어짐 |
| 7 | `sdm.vendor` | 스드메 | 업체 확인 | D-120 | 필수 | 스튜디오·드레스·메이크업 |
| 8 | `sdm.schedule` | 스드메 | 일정 확인 | D-110 | 필수 | 촬영·가봉 일정 |
| 9 | `invitation.make` | 청첩장 | 청첩장 제작 | D-90 | 필수 | 인쇄 리드타임 고려 |
| 10 | `invitation.deliver` | 청첩장 | 청첩장 전달 | D-70 | 필수 | 발송 시작 시점 |
| 11 | `guarantee.first` | 보증인원 | 1차 확인 | D-30 | 필수 | 식대 산정 1차 |
| 12 | `guarantee.final` | 보증인원 | 최종 확인 | D-10 | 필수 | 통상 10일 전 변경 불가 |
| 13 | `mealTicket.prepare` | 식권 | 식권 준비 | D-60 | 필수 | 시안·수량 확정 |
| 14 | `mealTicket.deliver` | 식권 | 식권 전달 | D-14 | 필수 | 전달 방법 확인 |
| 15 | `program.receive` | 식순 | 식순 수령 | D-21 | 필수 | 회신 기한 여유 확보 |
| 16 | `program.host` | 식순 | 사회 확인 | D-21 | 필수 | 사회자 유무·이름 미기재 |
| 17 | `program.song` | 식순 | 축가 확인 | D-14 | 필수 | 반주 음원 필요 여부 |
| 18 | `program.declaration` | 식순 | 성혼선언문 확인 | D-7 | 필수 | 원고 수령 여부만 체크 |
| 19 | `program.vow` | 식순 | 혼인서약서 확인 | D-7 | 필수 | 원고 수령 여부만 체크 |
| 20 | `video.opening` | 영상 | 식전영상 | D-14 | 필수 | 파일 수령 |
| 21 | `video.test` | 영상 | 영상 테스트 | D-3 | 필수 | 재생·음향 확인 |
| 22 | `parents.makeup` | 혼주 | 혼주 메이크업 | D-30 | 선택 | 예약 여부 |
| 23 | `parents.arrival` | 혼주 | 혼주 도착시간 확인 | D-3 | 필수 | 당일 동선 |
| 24 | `flower.bouquet` | 꽃장식 | 부케 | D-14 | 필수 | 발주 확인 |
| 25 | `flower.boutonniere` | 꽃장식 | 부토니에 | D-14 | 필수 | 수량 확인 |
| 26 | `pyebaek.decide` | 폐백 | 폐백 진행 여부 | D-30 | 필수 | 미진행이면 27번 자동 비활성 |
| 27 | `pyebaek.prepare` | 폐백 | 폐백 준비 | D-7 | 조건부 | `pyebaek.decide` 가 "진행"일 때만 |
| 28 | `dday.headcount` | 당일 | 최종인원 | D-3 | 필수 | 보증인원과 대조 |
| 29 | `dday.balance` | 당일 | 잔금 확인 | D-1 | 필수 | 금액은 기록하지 않음(여부만) |
| 30 | `dday.parking` | 당일 | 주차 확인 | D-1 | 필수 | 주차권·안내 |
| 31 | `dday.notes` | 당일 | 특이사항 확인 | D-1 | 필수 | 메모 연동 |
| 32 | `dday.complete` | 당일 | 예식 완료 | D-0 | 필수 | 체크 시 예식 상태 `done` 전환 |

### 조건부 항목 규칙

- `pyebaek.prepare` 는 `pyebaek.decide` 의 결과에 따라 활성/비활성됩니다.
  비활성 항목은 **진행률 분모에서 제외**되어 분모가 31이 됩니다.
- 선택(`optional: true`) 항목은 기본적으로 분모에 포함하되, 설정에서
  "선택 항목 진행률 제외"를 켜면 제외합니다. (기본값: 포함)

## 4. 일정 자동 생성 — 마일스톤

예식일을 입력하면 위 `dueOffset` 으로 13개 마일스톤이 자동 생성됩니다.
일정 화면 기본 보기는 **요약 8단계**이고, 펼치면 13단계 전체가 보입니다.

### 요약 8단계 (기본 보기)

| 마일스톤 | 포함 항목 |
| --- | --- |
| D-180 | 계약 완료 · 계약서 전달/회수 · 계약 확인 · 시식 예약 |
| D-120 | 스드메 업체 확인 · 일정 확인 |
| D-90 | 청첩장 제작 · 전달 |
| D-60 | 식권 준비 |
| D-30 | 보증인원 1차 확인 · 혼주 메이크업 · 폐백 진행 여부 |
| D-14 | 식전영상 · 축가 확인 · 부케 · 부토니에 · 식권 전달 |
| D-7 | 성혼선언문 · 혼인서약서 · 폐백 준비 · 최종 확인 |
| Wedding Day | 예식 완료 |

### 전체 13단계 (펼친 보기)

`D-180 → D-150 → D-120 → D-90 → D-70 → D-60 → D-30 → D-21 → D-14 → D-10 → D-7 → D-3 → D-1 → D-0`
(요약 보기의 8단계는 굵게 강조, 나머지는 얇은 눈금으로 표시)

## 5. 상태 판정 규칙

| 상태 | 조건 | 색 토큰 |
| --- | --- | --- |
| `done` | `done === true` | `success` |
| `overdue` | `!done && today > dueDate` | `danger` |
| `today` | `!done && today === dueDate` | `primary` |
| `soon` | `!done && 0 < dueDate − today ≤ 7` | `warning` |
| `upcoming` | `!done && dueDate − today > 7` | `muted` |
| `disabled` | 조건부 비활성 | `muted` (취소선) |

"오늘 해야 할 업무" = 상태가 `overdue` + `today` 인 항목 전체 (지연 항목 먼저 정렬).

## 6. 개발용 시드 데이터

`src/lib/checklist/default-template.ts`

```ts
import type { ChecklistCategory, ChecklistSeedItem } from '@/types/checklist'

export const DEFAULT_CATEGORIES: ChecklistCategory[] = [
  { key: 'contract',   name: '계약',     icon: 'file-signature',  order: 1 },
  { key: 'tasting',    name: '시식',     icon: 'utensils',        order: 2 },
  { key: 'sdm',        name: '스드메',   icon: 'camera',          order: 3 },
  { key: 'invitation', name: '청첩장',   icon: 'mail',            order: 4 },
  { key: 'guarantee',  name: '보증인원', icon: 'users',           order: 5 },
  { key: 'mealTicket', name: '식권',     icon: 'ticket',          order: 6 },
  { key: 'program',    name: '식순',     icon: 'list-ordered',    order: 7 },
  { key: 'video',      name: '영상',     icon: 'monitor-play',    order: 8 },
  { key: 'parents',    name: '혼주',     icon: 'heart-handshake', order: 9 },
  { key: 'flower',     name: '꽃장식',   icon: 'flower-2',        order: 10 },
  { key: 'pyebaek',    name: '폐백',     icon: 'gift',            order: 11 },
  { key: 'dday',       name: '당일',     icon: 'calendar-check',  order: 12 },
]

export const DEFAULT_ITEMS: ChecklistSeedItem[] = [
  { key: 'contract.done',        category: 'contract',   label: '계약 완료',        dueOffset: 180 },
  { key: 'contract.deliver',     category: 'contract',   label: '계약서 전달',      dueOffset: 175 },
  { key: 'contract.collect',     category: 'contract',   label: '계약서 회수',      dueOffset: 170 },
  { key: 'contract.verify',      category: 'contract',   label: '계약 확인',        dueOffset: 165 },
  { key: 'tasting.book',         category: 'tasting',    label: '시식 예약',        dueOffset: 180 },
  { key: 'tasting.done',         category: 'tasting',    label: '시식 완료',        dueOffset: 150 },
  { key: 'sdm.vendor',           category: 'sdm',        label: '업체 확인',        dueOffset: 120 },
  { key: 'sdm.schedule',         category: 'sdm',        label: '일정 확인',        dueOffset: 110 },
  { key: 'invitation.make',      category: 'invitation', label: '청첩장 제작',      dueOffset: 90 },
  { key: 'invitation.deliver',   category: 'invitation', label: '청첩장 전달',      dueOffset: 70 },
  { key: 'guarantee.first',      category: 'guarantee',  label: '1차 확인',         dueOffset: 30 },
  { key: 'guarantee.final',      category: 'guarantee',  label: '최종 확인',        dueOffset: 10 },
  { key: 'mealTicket.prepare',   category: 'mealTicket', label: '식권 준비',        dueOffset: 60 },
  { key: 'mealTicket.deliver',   category: 'mealTicket', label: '식권 전달',        dueOffset: 14 },
  { key: 'program.receive',      category: 'program',    label: '식순 수령',        dueOffset: 21 },
  { key: 'program.host',         category: 'program',    label: '사회 확인',        dueOffset: 21 },
  { key: 'program.song',         category: 'program',    label: '축가 확인',        dueOffset: 14 },
  { key: 'program.declaration',  category: 'program',    label: '성혼선언문 확인',  dueOffset: 7 },
  { key: 'program.vow',          category: 'program',    label: '혼인서약서 확인',  dueOffset: 7 },
  { key: 'video.opening',        category: 'video',      label: '식전영상',         dueOffset: 14 },
  { key: 'video.test',           category: 'video',      label: '영상 테스트',      dueOffset: 3 },
  { key: 'parents.makeup',       category: 'parents',    label: '혼주 메이크업',    dueOffset: 30, optional: true },
  { key: 'parents.arrival',      category: 'parents',    label: '혼주 도착시간 확인', dueOffset: 3 },
  { key: 'flower.bouquet',       category: 'flower',     label: '부케',             dueOffset: 14 },
  { key: 'flower.boutonniere',   category: 'flower',     label: '부토니에',         dueOffset: 14 },
  { key: 'pyebaek.decide',       category: 'pyebaek',    label: '폐백 진행 여부',   dueOffset: 30 },
  { key: 'pyebaek.prepare',      category: 'pyebaek',    label: '폐백 준비',        dueOffset: 7,
    dependsOn: { key: 'pyebaek.decide', when: 'done' } },
  { key: 'dday.headcount',       category: 'dday',       label: '최종인원',         dueOffset: 3 },
  { key: 'dday.balance',         category: 'dday',       label: '잔금 확인',        dueOffset: 1 },
  { key: 'dday.parking',         category: 'dday',       label: '주차 확인',        dueOffset: 1 },
  { key: 'dday.notes',           category: 'dday',       label: '특이사항 확인',    dueOffset: 1 },
  { key: 'dday.complete',        category: 'dday',       label: '예식 완료',        dueOffset: 0 },
]

export const MILESTONE_OFFSETS = [180, 120, 90, 60, 30, 14, 7, 0] as const
```

## 7. 프로토타입에서 승계한 것 / 버린 것

기존 `data.js` 의 `CHECKLIST` 는 예약실 종이 양식(`★예식체크리스트.xlsx`) 23항목을
그대로 옮긴 것이었습니다. 새 템플릿은 그 업무 지식을 **개인정보 없이** 재구성했습니다.

| 프로토타입 | 신규 | 처리 |
| --- | --- | --- |
| 23항목 / 7묶음 (양식 번호 기준) | 32항목 / 12카테고리 (업무 흐름 기준) | 재구성 |
| `기본구성 (   )원`, `식대`, `홀대관료` 등 금액 필드 | 없음 (`dday.balance` 여부 체크만) | **제거** |
| 항목 `meta` 안내 문구 | `hint` (선택, 개인정보 유도 문구 제외) | 승계 |
| `CHECKLIST_DUE = '예식 14일 전'` | 항목별 `dueOffset` | 확장 |
| 고객별 체크 상태 (`CUSTOMERS[].pct`) | 예식 카드별 체크 상태 | 재구성 |
