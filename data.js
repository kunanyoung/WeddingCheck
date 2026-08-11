/**
 * WeddingCheck — 시연용 고정 데이터
 *
 * 워킹 스켈레톤 프로토타입이므로 백엔드 대신 이 파일이 데이터 소스 역할을 합니다.
 * 실제 API 연동 시 아래 상수만 fetch 결과로 바꾸면 화면 코드는 그대로 동작합니다.
 *
 * 파일을 그대로 더블클릭해서 열 수 있도록(file://) ES 모듈 대신 전역 `WCData`로 노출합니다.
 */

/** 데모 기준일. D-Day 계산은 모두 이 날짜를 "오늘"로 봅니다. */
const TODAY = '2026-02-10';
const TODAY_LABEL = '2026년 2월 10일 화요일';

const STAFF = {
  name: '김수정 팀장',
  initial: '김',
  role: '예약실 · 7년차',
  hall: '라비드블랑 웨딩홀',
  phone: '02-1234-5678',
  hours: '평일 10:00–19:00',
};

const SHARE_LINK = 'https://weddingcheck.kr/s/9f2ac7';

/**
 * 예식 최종 체크리스트 — 예약실 종이 양식 `★예식체크리스트.xlsx` 기준
 *
 * 양식의 1~23번 항목을 순서 그대로 옮기고, 성격이 같은 번호끼리 7개 묶음으로만
 * 나눴습니다. `caption` 의 "양식 n–m번" 은 종이 양식의 번호와 대조하기 위한 표시이며,
 * `meta` 는 양식에 인쇄된 안내 문구를 요약한 것입니다.
 *
 * 양식 자체의 회신 기한: 예식 14일 전 (CHECKLIST_DUE)
 *
 * 금액은 계약 조건마다 달라 값을 넣지 않고 `BLANK` 빈칸으로 두었습니다.
 * 채워 넣을 때는 `${BLANK}원` 을 `560,000원` 처럼 실제 값으로 바꾸면 됩니다.
 * (BLANK 안쪽은 화면에서 폭이 줄지 않도록 일반 공백이 아닌 non-breaking space 입니다.)
 */
const CHECKLIST_DUE = '예식 14일 전까지 전체 항목 회신';

/** 금액·단가처럼 계약별로 달라지는 값을 비워 둔 자리 */
const NBSP = String.fromCharCode(0xa0);
const BLANK = '(' + NBSP.repeat(6) + ')';

const CHECKLIST = [
  {
    label: '예식 기본 정보',
    caption: '양식 1–3번',
    items: [
      { id: 'a1', label: '예식일정 · 장소 확정', meta: '2026. 5. 16 (토) 13:00 · 그랜드홀', tag: '예약실', done: true },
      { id: 'a2', label: '양가 혼주 성함 · 관계 확인', meta: '안내판 표기용 · 장남 / 차녀 등 관계까지 기재', tag: '신랑신부', done: true },
      { id: 'a3', label: '피로연장 이용시간 안내', meta: '예식 30분 전부터 2시간 · 마감 10분 전 종료 안내 멘트', tag: '예약실', done: true },
    ],
  },
  {
    label: '식사 · 인원',
    caption: '양식 4–6번',
    items: [
      { id: 'b1', label: '식대 코스 · 소인 단가 확정', meta: `코스 ${BLANK}원 · 소인 ${BLANK}원 · 음·주류 1인당 ${BLANK}원 / 미취학아동 무료 · 초등학생 소인 · 중학생부터 대인`, tag: '예약실', done: true },
      { id: 'b2', label: '지불보증인원 · 청첩장 수량 회신', meta: '예식 10일 전 변경 불가 · 여유분 10% · 미달 시 보증인원 100% 정산', tag: '신랑신부', done: false },
      { id: 'b3', label: '식권 준비 · 검수 사진 회신', meta: '양가 도장 또는 사인 표기 필수 · 식권_시안_최종.jpg 첨부됨', tag: '파일첨부', done: true },
    ],
  },
  {
    label: '홀 · 기본 구성',
    caption: '양식 7–8번',
    items: [
      { id: 'c1', label: '홀대관료 · 폐백실 사용료 안내', meta: `홀대관료 ${BLANK}원 · 폐백실 사용료에 원삼 / 족두리 / 사모 / 관대 포함 (한복은 개인 준비)`, tag: '예약실', done: true },
      { id: 'c2', label: '기본구성 확인 · 스드메 업체 기재', meta: `기본구성 ${BLANK}원 · 혼구용품 / 부대사용 / 생화장식 / 원판 12P 3권`, tag: '제휴업체', done: true },
    ],
  },
  {
    label: '예식 진행 · 폐백',
    caption: '양식 9–13번',
    items: [
      { id: 'd1', label: '스냅 촬영 신청', meta: `외부 섭외 / 웨딩홀 신청 · 웨딩홀 신청 시 ${BLANK}원`, tag: '신랑신부', done: true },
      { id: 'd2', label: '비디오 촬영 신청', meta: `외부 섭외 / 웨딩홀 신청 · 웨딩홀 신청 시 ${BLANK}원`, tag: '신랑신부', done: false },
      { id: 'd3', label: '주례 · 사회자 섭외', meta: '성혼선언문 · 혼인서약 준비 주체 확인 / 종교식은 찬송가 · 반주자 · 순서지 추가 확인', tag: '예약실', done: false },
      { id: 'd4', label: '주례 없는 예식 · 폐백 진행 여부', meta: '주례 없는 예식은 식순 개인 준비 · 폐백 미진행 시 사진 촬영 여부 확인', tag: '신랑신부', done: false },
      { id: 'd5', label: '폐백 수모비 · 폐백 음식', meta: `수모비 ${BLANK}원 당일 직접 지불 · 폐백 음식은 외부 반입 또는 웨딩홀 신청 시 호수 기재 · ${BLANK}원`, tag: '제휴업체', done: false },
    ],
  },
  {
    label: '영상 · 음향 · 연출',
    caption: '양식 14–18번',
    items: [
      { id: 'e1', label: '식전 · 식중 동영상 제출', meta: `MP4 · 3~4분 · 예식주 수요일까지 제출 (전날 · 당일 테스트 불가) · 웨딩홀 제작 신청 시 ${BLANK}원`, tag: '파일첨부', done: false },
      { id: 'e2', label: '실시간 영상중계 신청 여부', meta: `유 / 무 선택 · 신청 시 ${BLANK}원`, tag: '신랑신부', done: false },
      { id: 'e3', label: '예도(들러리) 신청 여부', meta: `화촉점화 에스코트 · 피로연장 인사 포함 · 신청 시 ${BLANK}원 · 당일 결정 가능`, tag: '신랑신부', done: false },
      { id: 'e4', label: '웨딩연주 선택', meta: `피아노 3중주 / 재즈 4중주 / 남성 4중창+피아노 중 선택 · 신청 시 ${BLANK}원 · 미신청 시 기본 MR`, tag: '신랑신부', done: false },
      { id: 'e5', label: '축가 곡 · 반주 음원 제출', meta: 'MP3 · 예식주 수요일까지 제출 · 무선 마이크 최대 2개 · 축가반주_MR.mp3 첨부됨', tag: '파일첨부', done: true },
    ],
  },
  {
    label: '당일 준비물',
    caption: '양식 19–20번',
    items: [
      { id: 'f1', label: '대형 DP액자 · 포토테이블 신청', meta: '액자 수량 기재 · 포토테이블 유 / 무 선택', tag: '신랑신부', done: false },
      { id: 'f2', label: '포토테이블 사진 · 이젤 준비 안내', meta: '5×7 사진 당일 지참 · 액자 최대 10개 · 이젤 최대 2개 제공', tag: '예약실', done: false },
    ],
  },
  {
    label: '이동 · 정산',
    caption: '양식 21–23번',
    items: [
      { id: 'g1', label: '대형버스 운행 · 출발지 확인', meta: '신랑측 / 신부측 대수와 출발지 기재', tag: '신랑신부', done: false },
      { id: 'g2', label: '주차 안내 전달', meta: '주차 무료 · 진입 경로 안내 문자 발송 완료', tag: '예약실', done: true },
      { id: 'g3', label: '정산 방식 확정', meta: `계약금 ${BLANK}원 · 기본구성 / 식대 / 선택품목 결제 주체 선택 · 카드 당일 한도 확인`, tag: '예약실', done: false },
    ],
  },
];

const CUSTOMERS = [
  { id: 1, couple: '김민준 · 이서연', phone: '010-2841-7719', date: '2026. 5. 16 (토) 13:00', dday: 'D-95', hall: '그랜드홀', tasting: '3. 14 (토)', pct: 43, status: '진행중' },
  { id: 2, couple: '박지훈 · 최유나', phone: '010-9042-3388', date: '2026. 4. 4 (토) 11:00', dday: 'D-53', hall: '채플홀', tasting: '2. 21 (토)', pct: 71, status: '계약완료' },
  { id: 3, couple: '정우성 · 한소희', phone: '010-3311-8025', date: '2026. 3. 21 (토) 15:30', dday: 'D-39', hall: '그랜드홀', tasting: '2. 14 (토)', pct: 86, status: '계약완료' },
  { id: 4, couple: '이도현 · 김하늘', phone: '010-7788-1204', date: '2026. 6. 13 (토) 12:00', dday: 'D-123', hall: '가든홀', tasting: '미정', pct: 21, status: '상담중' },
  { id: 5, couple: '오정민 · 서다은', phone: '010-5520-6613', date: '2026. 9. 19 (토) 14:00', dday: 'D-221', hall: '채플홀', tasting: '미정', pct: 7, status: '상담중' },
];

const TASTINGS = [
  { id: 't1', cid: 3, couple: '정우성 · 한소희', date: '2026. 2. 10 (화) 12:00', place: '그랜드홀 시식장', party: 4, menu: '프리미엄 A 코스', memo: '신부 부모님 채식 1인 요청', status: '확정', confirmed: true },
  { id: 't2', cid: 2, couple: '박지훈 · 최유나', date: '2026. 2. 21 (토) 12:30', place: '채플홀 시식장', party: 6, menu: '스탠다드 B 코스', memo: '유아용 의자 2개 필요', status: '확정', confirmed: true },
  { id: 't3', cid: 1, couple: '김민준 · 이서연', date: '2026. 3. 14 (토) 12:00', place: '그랜드홀 시식장', party: 4, menu: '미선택', memo: '코스 선택 안내 문자 발송함', status: '확정', confirmed: false },
  { id: 't4', cid: 4, couple: '이도현 · 김하늘', date: '일정 조율 중', place: '미정', party: 4, menu: '미선택', memo: '3월 첫째 주 토요일 희망 (게시판 메모 참고)', status: '조율중', confirmed: false },
  { id: 't5', cid: 5, couple: '오정민 · 서다은', date: '미정', place: '미정', party: 2, menu: '미선택', memo: '계약 후 안내 예정', status: '미정', confirmed: false },
];

const MEMOS = [
  { id: 'm1', who: '김민준 · 이서연', phone: '010-2841-7719', time: '오늘 10:24', author: '윤채영 매니저', assignee: '김수정 팀장', body: '식전 영상 파일 용량이 커서 업로드가 안 된다고 문의. 압축 방법 안내 필요하며 오늘 중 회신 요청하셨습니다.', done: false },
  { id: 'm2', who: '이도현 · 김하늘', phone: '010-7788-1204', time: '오늘 09:05', author: '박서준 주임', assignee: '김수정 팀장', body: '시식 예약일을 3월 첫째 주 토요일로 변경 희망. 가능 여부 확인 후 연락 부탁드립니다.', done: false },
  { id: 'm3', who: '정우성 · 한소희', phone: '010-3311-8025', time: '어제 16:41', author: '김수정 팀장', assignee: '윤채영 매니저', body: '밝은 분위기 홀 선호 요청 재확인. 이전 상담에서 언급된 내용이라 담당 변경 시에도 반영되도록 기록합니다.', done: true },
  { id: 'm4', who: '박지훈 · 최유나', phone: '010-9042-3388', time: '2. 8 14:12', author: '박서준 주임', assignee: '박서준 주임', body: '혼주 한복 제휴업체 연락처 요청. 한복 소이 정보 문자 발송 완료했습니다.', done: true },
];

const VENDORS = [
  { category: '스튜디오', name: '포엠 스튜디오', desc: '예식 2개월 전 촬영 권장. 웨딩홀 제휴가 15% 할인 적용.', phone: '02-540-1188', rate: '제휴가 15%', slot: '업체 대표 이미지' },
  { category: '드레스', name: '메종 드 블랑', desc: '가봉 포함 3벌 피팅. 주말 예약은 2개월 전 마감됩니다.', phone: '02-3446-0912', rate: '제휴가 10%', slot: '업체 대표 이미지' },
  { category: '메이크업', name: '라뷰티 청담', desc: '혼주 메이크업 동반 예약 시 추가 할인. 당일 출장 가능.', phone: '02-518-7740', rate: '제휴가 20%', slot: '업체 대표 이미지' },
  { category: '한복', name: '한복 소이', desc: '혼주 한복 대여 및 맞춤. 예식 1개월 전 채촌 필요.', phone: '02-744-2231', rate: '제휴가 10%', slot: '업체 대표 이미지' },
  { category: '청첩장', name: '카드모리', desc: '모바일 청첩장 무료 제작 포함. 인쇄 최소 수량 100장.', phone: '070-8899-2020', rate: '제휴가 12%', slot: '업체 대표 이미지' },
  { category: '폐백음식', name: '예담 폐백', desc: '예식 당일 반입. 이바지 음식 별도 주문 가능합니다.', phone: '02-2261-3355', rate: '제휴가 8%', slot: '업체 대표 이미지' },
];

const FILES = [
  { kind: 'MP3', name: '축가반주_MR.mp3', meta: '4.2MB · 2026. 1. 30 신부 업로드', tone: 'violet' },
  { kind: 'JPG', name: '식권_시안_최종.jpg', meta: '1.1MB · 2026. 2. 3 예약실 업로드', tone: 'rose' },
  { kind: 'MP4', name: '식전영상_v2.mp4', meta: '업로드 대기 · 용량 초과 문의 접수', tone: 'neutral' },
];

const TODAY_SCHEDULE = [
  { time: '10:30', cid: 4, couple: '이도현 · 김하늘', note: '1차 상담 · 가든홀 견적 안내', tag: '상담' },
  { time: '12:00', cid: 3, couple: '정우성 · 한소희', note: '시식 예약 · 참석 4명', tag: '시식' },
  { time: '13:00', cid: 1, couple: '김민준 · 이서연', note: '최종 체크리스트 점검 · 식전 영상 안내', tag: '점검' },
  { time: '16:00', cid: 5, couple: '오정민 · 서다은', note: '1차 상담 · 채플홀 9월 예식 문의', tag: '상담' },
];

const HOME_KPIS = [
  { label: '오늘 상담', value: '3', unit: '건', sub: '10:30 · 13:00 · 16:00' },
  { label: '오늘 시식', value: '1', unit: '건', sub: '12:00 정우성 · 한소희' },
  { label: '미확인 부재중 메모', value: '2', unit: '건', sub: '회신 필요' },
  { label: '이번 달 계약', value: '9', unit: '건', sub: '목표 12건 대비 75%' },
];

const TASTING_KPIS = [
  { label: '이번 주 시식', value: '2', unit: '건', sub: '2. 10 · 2. 14' },
  { label: '확인 대기', value: '1', unit: '팀', sub: '코스 미선택 1팀' },
  { label: '일정 조율 중', value: '2', unit: '팀', sub: '희망일 회신 필요' },
  { label: '이번 달 참석률', value: '94', unit: '%', sub: '노쇼 1건' },
];

const STAT_KPIS = [
  { label: '총 상담', value: '64', unit: '건', sub: '전월 대비 +12건' },
  { label: '계약 체결', value: '21', unit: '건', sub: '전월 대비 +5건' },
  { label: '평균 전환율', value: '32.8', unit: '%', sub: '목표 30% 상회' },
  { label: '시식 진행', value: '17', unit: '건', sub: '노쇼 1건' },
];

const CONSULTS = [
  { date: '2026. 1. 24', type: '3차 상담', staff: '김수정 팀장', body: '그랜드홀 A타입 데코 확정. 생화는 화이트 로즈로 요청하셨고, 예식 30일 전 최종 변경 가능하다고 안내드렸습니다.' },
  { date: '2025. 12. 6', type: '2차 상담 · 계약', staff: '김수정 팀장', body: '5월 16일 13시 그랜드홀 계약 체결. 시식 예약은 3월 14일로 함께 확정했습니다. 하객 250명 기준 견적 전달.' },
  { date: '2025. 11. 18', type: '1차 상담', staff: '박서준 주임', body: '밝은 분위기의 채광 좋은 홀 선호. 주차 200대 이상 가능한지 확인 요청하셨습니다.' },
];

const STAGES = [
  { label: '문의 접수', date: '2025. 11. 18', done: true },
  { label: '상담 완료', date: '2026. 1. 24', done: true },
  { label: '계약 완료', date: '2025. 12. 6', done: true },
  { label: '시식 진행', date: '2026. 3. 14 예정', done: false },
  { label: '예식 진행', date: '2026. 5. 16 예정', done: false },
];

const STAFF_STATS = [
  { name: '김수정 팀장', consult: 24, contract: 9, rate: 37.5, wConsult: 62, wContract: 23 },
  { name: '박서준 주임', consult: 18, contract: 6, rate: 33.3, wConsult: 47, wContract: 16 },
  { name: '윤채영 매니저', consult: 14, contract: 4, rate: 28.6, wConsult: 36, wContract: 10 },
  { name: '장하윤 사원', consult: 8, contract: 2, rate: 25.0, wConsult: 21, wContract: 5 },
];

const MONTHS = [
  { label: '9월', value: 14, h: 52 },
  { label: '10월', value: 19, h: 70 },
  { label: '11월', value: 11, h: 41 },
  { label: '12월', value: 9, h: 33 },
  { label: '1월', value: 16, h: 59 },
  { label: '2월', value: 21, h: 78, peak: true },
];

const HALL_OPTIONS = ['13:00 · 그랜드홀', '11:00 · 채플홀', '15:30 · 가든홀'];

const ASSIGNEE_OPTIONS = [
  '담당 인계 — 김수정 팀장',
  '담당 인계 — 박서준 주임',
  '담당 인계 — 윤채영 매니저',
];

/* ------------------------------------------------------------------ 톤 -- */

/** 상태·태그 문자열 → 배지 톤 클래스 매핑 */
const TONE = {
  진행중: 'amber',
  계약완료: 'green',
  상담중: 'violet',
  완료: 'green',
  확정: 'green',
  조율중: 'amber',
  미정: 'neutral',
  예약실: 'rose',
  신랑신부: 'green',
  파일첨부: 'violet',
  제휴업체: 'amber',
  상담: 'violet',
  시식: 'green',
  점검: 'rose',
};

/* ------------------------------------------------------- 히어로 꽃잎 -- */

const PETAL_COLORS = ['#f0b8c2', '#e79aa8', '#f7d4d8', '#dba0aa', '#fbe6e6'];

/** 결정적(seeded) 난수로 꽃잎을 배치해 새로고침해도 배열이 동일하도록 합니다. */
function makePetals(count, seed) {
  const out = [];
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 0; i < count; i++) {
    const size = 7 + Math.round(rnd() * 13);
    out.push({
      x: +(rnd() * 96).toFixed(2),
      y: +(rnd() * 94).toFixed(2),
      s: size,
      sm: Math.max(5, Math.round(size * 0.62)),
      r: Math.round(rnd() * 360),
      o: +(0.35 + rnd() * 0.5).toFixed(2),
      c: PETAL_COLORS[Math.floor(rnd() * PETAL_COLORS.length)],
    });
  }
  return out;
}

const PETALS = makePetals(16, 7919);
const PETALS_DENSE = makePetals(34, 104729);

const HERO_OPTIONS = [
  { id: 'photo', label: '사진' },
  { id: 'arch', label: '아치' },
  { id: 'petal', label: '꽃잎' },
  { id: 'linen', label: '리넨' },
  { id: 'tulle', label: '튤' },
];

const NAV_ITEMS = [
  { id: 'home', label: '홈 대시보드' },
  { id: 'customers', label: '고객 / 예식 관리' },
  { id: 'tastings', label: '시식 예약 관리' },
  { id: 'checklist', label: '체크리스트' },
  { id: 'board', label: '사내 공유 게시판' },
  { id: 'vendors', label: '제휴업체 관리' },
  { id: 'stats', label: '실적 대시보드' },
];

window.WCData = {
  TODAY, TODAY_LABEL, STAFF, SHARE_LINK,
  CHECKLIST, CHECKLIST_DUE, CUSTOMERS, TASTINGS, MEMOS, VENDORS, FILES,
  TODAY_SCHEDULE, HOME_KPIS, TASTING_KPIS, STAT_KPIS,
  CONSULTS, STAGES, STAFF_STATS, MONTHS,
  HALL_OPTIONS, ASSIGNEE_OPTIONS, TONE,
  PETALS, PETALS_DENSE, HERO_OPTIONS, NAV_ITEMS,
};
