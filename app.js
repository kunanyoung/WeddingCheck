/**
 * WeddingCheck — 라비드블랑 웨딩홀 예약실 업무 시스템
 *
 * 화면 구성
 *   1단계 로그인 → 2단계 홈 대시보드 → 3단계 고객/예식 관리 · 신규 등록 · 상세
 *   4단계 체크리스트 + 공유 링크 → 5단계 신랑신부 모바일 공유 화면
 *   부가: 시식 예약 관리 · 사내 공유 게시판 · 제휴업체 · 실적 대시보드
 *
 * 상태는 아래 `state` 하나에 모으고, 변경은 항상 setState()를 통해서만 합니다.
 * setState → render() 로 화면 전체를 다시 그리는 단방향 흐름입니다.
 */
(function () {
  'use strict';

  var D = window.WCData;

  /* ==================================================== 템플릿 유틸 ==== */

  /** 이미 이스케이프된(신뢰 가능한) HTML 조각 */
  class Safe {
    constructor(value) { this.value = value; }
    toString() { return this.value; }
  }

  var ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ESCAPES[c]; });
  }

  function interpolate(v) {
    if (v == null) return '';
    if (v instanceof Safe) return v.value;
    if (Array.isArray(v)) return v.map(interpolate).join('');
    // boolean 은 aria-pressed / aria-checked 에 그대로 쓰이므로 "true"/"false" 로 남깁니다.
    return esc(v);
  }

  /**
   * 태그드 템플릿. 삽입되는 값은 기본적으로 이스케이프하고,
   * h`...` 가 반환한 조각(Safe)과 배열은 그대로 이어 붙입니다.
   */
  function h(strings) {
    var out = strings[0];
    for (var i = 1; i < arguments.length; i++) {
      out += interpolate(arguments[i]) + strings[i];
    }
    return new Safe(out);
  }

  /** 톤 이름을 배지 클래스로. 알 수 없는 값은 중립 톤으로 떨어집니다. */
  function tone(name) {
    return 'tone-' + (D.TONE[name] || name || 'neutral');
  }

  /* ========================================================== 상태 ==== */

  var state = {
    screen: 'login',
    customerId: 1,
    hero: 'photo',

    checks: {},        // 체크리스트 항목 id → 완료 여부(기본값 덮어쓰기)
    memoDone: {},      // 메모 id → 완료 여부
    attended: {},      // 시식 id → 참석 체크 여부

    filter: '전체',
    search: '',
    boardFilter: '전체',
    stage: '계약완료',

    wedding: '2026-05-16',
    tasting: '2026-03-14',

    tastingDone: true,
    myTastingConfirmed: false,

    showShare: false,
    showMobile: false,
    copied: false,
  };

  var root = null;

  function setState(patch) {
    Object.assign(state, patch);
    render();
  }

  /* ================================================== 파생 데이터 ==== */

  function isItemDone(item) {
    return item.id in state.checks ? state.checks[item.id] : item.done;
  }

  function isMemoDone(memo) {
    return memo.id in state.memoDone ? state.memoDone[memo.id] : memo.done;
  }

  /** D.TODAY 를 "오늘"로 본 일수 차이. 잘못된 입력이면 null. */
  function dayDiff(iso) {
    if (!iso) return null;
    var from = new Date(D.TODAY + 'T00:00:00');
    var to = new Date(iso + 'T00:00:00');
    if (isNaN(to)) return null;
    return Math.round((to - from) / 86400000);
  }

  function ddayLabel(days) {
    if (days == null) return '날짜를 입력해 주세요';
    if (days === 0) return 'D-DAY';
    return days > 0 ? 'D-' + days : 'D+' + -days;
  }

  function derive() {
    var items = D.CHECKLIST.reduce(function (acc, g) { return acc.concat(g.items); }, []);
    var done = items.filter(isItemDone).length;
    var pct = Math.round((done / items.length) * 100);
    var customer = D.CUSTOMERS.find(function (c) { return c.id === state.customerId; }) || D.CUSTOMERS[0];
    var openMemos = D.MEMOS.filter(function (m) { return !isMemoDone(m); }).length;

    return {
      items: items,
      done: done,
      total: items.length,
      pct: pct,
      customer: customer,
      openMemos: openMemos,
      /** 1번 고객은 체크리스트와 연동되어 진행률이 실시간으로 움직입니다. */
      pctFor: function (c) { return c.id === 1 ? pct : c.pct; },
    };
  }

  /* ==================================================== 공통 조각 ==== */

  function kpiCard(k) {
    return h`
      <div class="kpi">
        <div class="kpi__label">${k.label}</div>
        <div class="kpi__row">
          <div class="kpi__value">${k.value}</div>
          <div class="kpi__unit">${k.unit}</div>
        </div>
        <div class="kpi__sub${k.accent ? ' kpi__sub--accent' : ''}">${k.sub}</div>
      </div>`;
  }

  function bar(pct, extraClass) {
    return h`<div class="bar ${extraClass || ''}"><div class="bar__fill" style="width:${pct}%"></div></div>`;
  }

  function chips(options, current, action) {
    return options.map(function (label) {
      return h`<button type="button" class="chip" data-action="${action}" data-value="${label}"
        aria-pressed="${label === current}">${label}</button>`;
    });
  }

  /* ==================================================== 히어로 배경 ==== */

  function petalSpans(list, mobile) {
    return list.map(function (p) {
      var size = mobile ? p.sm : p.s;
      return h`<span class="petal" style="left:${p.x}%;top:${p.y}%;width:${size}px;height:${size}px;background:${p.c};opacity:${p.o};transform:rotate(${p.r}deg)"></span>`;
    });
  }

  function hero(variant, mobile) {
    switch (variant) {
      case 'arch':
        return h`
          <div class="hero hero--arch">
            <div class="arch-outer"></div>
            ${mobile ? '' : h`<div class="arch-inner"></div>`}
            ${mobile ? '' : h`<div class="arch-floor"></div>`}
            ${petalSpans(D.PETALS, mobile)}
          </div>`;

      case 'petal':
        return h`
          <div class="hero hero--petal">
            ${mobile ? '' : h`<div class="glow-a"></div><div class="glow-b"></div>`}
            ${petalSpans(D.PETALS_DENSE, mobile)}
          </div>`;

      case 'linen':
        return h`
          <div class="hero hero--linen">
            <div class="weave"></div>
            ${mobile ? '' : h`<div class="sheen"></div>`}
            <div class="crest"${mobile ? new Safe(' style="top:44%"') : ''}>
              <div class="crest__ring"${mobile ? new Safe(' style="width:92px;height:92px"') : ''}>
                <div class="crest__names"${mobile ? new Safe(' style="font-size:14px"') : ''}>민준 &amp; 서연</div>
              </div>
              ${mobile ? '' : h`
                <div class="crest__rule"></div>
                <div class="crest__label">SAVE THE DATE</div>`}
            </div>
          </div>`;

      case 'tulle':
        return h`
          <div class="hero hero--tulle">
            <div class="veil veil-1"></div>
            <div class="veil veil-2"></div>
            ${mobile ? '' : h`<div class="veil veil-3"></div><div class="veil veil-4"></div>`}
            <div class="bloom"></div>
            ${mobile ? '' : h`<div class="floor"></div>`}
          </div>`;

      default: // photo
        return h`
          <div class="hero">
            <img class="hero__img" src="assets/hero-photo.webp" alt="" decoding="async">
          </div>`;
    }
  }

  /* ======================================================== 로그인 ==== */

  function loginView() {
    return h`
      <div class="login">
        <div class="login__visual">
          ${hero(state.hero, false)}
          <div class="login__scrim"></div>

          <div class="hero-switch" role="group" aria-label="로그인 배경 스타일">
            ${D.HERO_OPTIONS.map(function (o) {
              return h`<button type="button" class="hero-switch__btn" data-action="hero" data-value="${o.id}"
                aria-pressed="${state.hero === o.id}">${o.label}</button>`;
            })}
          </div>

          <div class="login__caption">
            <div class="login__eyebrow">WEDDINGCHECK</div>
            <div class="login__headline">상담부터 예식 당일까지,<br>하나의 체크리스트로</div>
          </div>
        </div>

        <form class="login__form" data-action="login">
          <div class="login__brand">WeddingCheck</div>
          <div class="login__brand-sub">${D.STAFF.hall} · 예약실 업무 시스템</div>

          <div class="login__fields">
            <label class="field">사번 / 아이디
              <input class="input input--lg" name="userId" value="soojung.kim" autocomplete="username" data-keep="login-id">
            </label>
            <label class="field">비밀번호
              <input class="input input--lg" type="password" name="password" value="12345678" autocomplete="current-password" data-keep="login-pw">
            </label>
            <button type="submit" class="btn btn--primary btn--tall" style="margin-top:10px">로그인</button>
            <button type="button" class="btn btn--outline" data-action="mobile-open" style="height:44px;font-size:13.5px">
              신랑신부 공유 링크로 접속
            </button>
          </div>

          <div class="login__foot">
            워킹 스켈레톤 프로토타입 · 5단계 화면 흐름 1~6단계 구현<br>
            예약실 직원(데스크톱) + 신랑신부(모바일 공유) 두 가지 사용자 흐름
          </div>
        </form>
      </div>`;
  }

  /* ==================================================== 사이드바 ==== */

  function sidebar(d) {
    var badges = {
      customers: String(D.CUSTOMERS.length),
      tastings: '3',
      checklist: d.pct + '%',
      board: d.openMemos ? String(d.openMemos) : '',
    };
    var current = state.screen === 'detail' || state.screen === 'new' ? 'customers' : state.screen;

    return h`
      <aside class="sidebar">
        <div class="sidebar__brand">
          <div class="sidebar__brand-name">WeddingCheck</div>
          <div class="sidebar__brand-sub">${D.STAFF.hall} 예약실</div>
        </div>

        <nav class="sidebar__nav" aria-label="주요 메뉴">
          ${D.NAV_ITEMS.map(function (item) {
            var on = current === item.id;
            var badge = badges[item.id] || '';
            return h`
              <button type="button" class="nav-item" data-action="go" data-value="${item.id}"
                ${on ? new Safe('aria-current="page"') : ''}>
                <span class="nav-item__dot"></span>
                <span class="nav-item__label">${item.label}</span>
                ${badge ? h`<span class="nav-item__badge">${badge}</span>` : ''}
              </button>`;
          })}
        </nav>

        <div class="sidebar__foot">
          <button type="button" class="sidebar__preview" data-action="mobile-open">신랑신부 화면 미리보기</button>
          <div class="sidebar__user">
            <div class="sidebar__avatar" aria-hidden="true">${D.STAFF.initial}</div>
            <div class="sidebar__user-meta">
              <div class="sidebar__user-name">${D.STAFF.name}</div>
              <div class="sidebar__user-role">${D.STAFF.role}</div>
            </div>
            <button type="button" class="sidebar__logout" data-action="logout">로그아웃</button>
          </div>
        </div>
      </aside>`;
  }

  /* ============================================== 2단계 · 홈 대시보드 ==== */

  function homeView(d) {
    var kpis = D.HOME_KPIS.map(function (k) {
      // "미확인 부재중 메모"는 게시판 상태와 같은 값이므로 함께 움직입니다.
      var value = k.label === '미확인 부재중 메모' ? String(d.openMemos) : k.value;
      return Object.assign({}, k, { value: value, accent: true });
    });

    return h`
      <div class="rise">
        <div class="page-head">
          <div>
            <div class="eyebrow-date">${D.TODAY_LABEL}</div>
            <h1 class="page-title page-title--lg" style="margin-top:8px">안녕하세요, ${D.STAFF.name}님</h1>
            <p class="page-sub">오늘 상담 3건, 시식 1건이 예정되어 있고 확인하지 않은 부재중 메모가 ${d.openMemos}건 있습니다.</p>
          </div>
          <button type="button" class="btn btn--primary" data-action="go" data-value="new">＋ 신규 고객 등록</button>
        </div>

        <div class="kpi-grid" style="margin-top:26px">${kpis.map(kpiCard)}</div>

        <div class="split-main mt-18">
          <section class="card">
            <header class="card__head">
              <h2 class="card__title">오늘 상담 · 시식 일정</h2>
              <button type="button" class="btn-link" data-action="go" data-value="customers">전체 보기 →</button>
            </header>
            <div class="rowlist">
              ${D.TODAY_SCHEDULE.map(function (s) {
                return h`
                  <button type="button" class="row-btn cols-schedule" data-action="open-customer" data-value="${s.cid}">
                    <div class="sched__time">${s.time}</div>
                    <div style="min-width:0">
                      <div class="sched__couple">${s.couple}</div>
                      <div class="sched__note">${s.note}</div>
                    </div>
                    <span class="tag ${tone(s.tag)}">${s.tag}</span>
                  </button>`;
              })}
            </div>
          </section>

          <section class="card">
            <header class="card__head">
              <h2 class="card__title">부재중 메모</h2>
              <button type="button" class="btn-link" data-action="go" data-value="board">게시판 →</button>
            </header>
            <div style="padding:6px 0">
              ${D.MEMOS.slice(0, 3).map(function (m) {
                var done = isMemoDone(m);
                var status = done ? '완료' : '진행중';
                return h`
                  <div class="memo-brief">
                    <div class="memo-brief__top">
                      <span class="tag tag--xs ${tone(status)}">${status}</span>
                      <span class="memo-brief__who">${m.who}</span>
                      <span class="memo-brief__time">${m.time}</span>
                    </div>
                    <div class="memo-brief__body">${m.body}</div>
                  </div>`;
              })}
            </div>
          </section>
        </div>

        <section class="card mt-18">
          <header class="card__head">
            <h2 class="card__title">예식 임박 고객 진행률</h2>
            <span class="card__note">D-60 이내 · 체크리스트 완료율 기준</span>
          </header>
          <div class="urgent-grid">
            ${D.CUSTOMERS.slice(1, 4).map(function (c) {
              var pct = d.pctFor(c);
              return h`
                <button type="button" class="urgent" data-action="open-customer" data-value="${c.id}">
                  <div class="urgent__top">
                    <div class="urgent__couple">${c.couple}</div>
                    <div class="urgent__dday">${c.dday}</div>
                  </div>
                  <div class="urgent__meta">${c.date} · ${c.hall}</div>
                  <div style="margin-top:12px">${bar(pct)}</div>
                  <div class="urgent__pct">체크리스트 ${pct}% 완료</div>
                </button>`;
            })}
          </div>
        </section>
      </div>`;
  }

  /* =========================================== 3단계 · 고객/예식 관리 ==== */

  function matchesSearch(c, query) {
    if (!query) return true;
    var needle = query.replace(/[\s-]/g, '').toLowerCase();
    var haystack = (c.couple + c.phone).replace(/[\s-]/g, '').toLowerCase();
    return haystack.indexOf(needle) !== -1;
  }

  function customersView(d) {
    var rows = D.CUSTOMERS
      .filter(function (c) { return state.filter === '전체' || c.status === state.filter; })
      .filter(function (c) { return matchesSearch(c, state.search); });

    return h`
      <div class="rise">
        <div class="page-head">
          <div>
            <h1 class="page-title">고객 / 예식 관리</h1>
            <p class="page-sub">계약 고객 ${D.CUSTOMERS.length}팀 · 예식일 기준 정렬</p>
          </div>
          <button type="button" class="btn btn--primary" data-action="go" data-value="new">＋ 신규 고객 등록</button>
        </div>

        <div class="filters">
          <input class="input input--sm input--search" type="search" placeholder="신랑신부 이름 · 연락처 검색"
            aria-label="신랑신부 이름 또는 연락처 검색"
            value="${state.search}" data-action="search" data-focus-key="customer-search">
          ${chips(['전체', '상담중', '계약완료', '진행중'], state.filter, 'filter')}
        </div>

        <div class="card mt-18 table-scroll">
          <div>
            <div class="table__head cols-customers">
              <div>신랑 · 신부</div><div>예식일시</div><div>홀</div><div>시식 예약</div><div>체크리스트</div><div>상태</div>
            </div>
            ${rows.length === 0
              ? h`<p class="empty">조건에 맞는 고객이 없습니다.</p>`
              : rows.map(function (c) {
                  var pct = d.pctFor(c);
                  return h`
                    <button type="button" class="row-btn cols-customers" data-action="open-customer" data-value="${c.id}">
                      <div style="min-width:0">
                        <div class="cust__couple">${c.couple}</div>
                        <div class="cust__phone">${c.phone}</div>
                      </div>
                      <div>
                        <div class="cust__date">${c.date}</div>
                        <div class="cust__dday">${c.dday}</div>
                      </div>
                      <div class="cust__cell">${c.hall}</div>
                      <div class="cust__cell">${c.tasting}</div>
                      <div>
                        ${bar(pct, 'bar--thin')}
                        <div class="cust__pct">${pct}%</div>
                      </div>
                      <div><span class="tag ${tone(c.status)}">${c.status}</span></div>
                    </button>`;
                })}
          </div>
        </div>
      </div>`;
  }

  /* ============================================== 3단계 · 신규 등록 ==== */

  function newCustomerView() {
    var weddingDays = dayDiff(state.wedding);
    var tastingDays = dayDiff(state.tasting);

    var ddayText = weddingDays == null
      ? '예식일을 입력해 주세요'
      : ddayLabel(weddingDays) + ' · ' + state.wedding.replace(/-/g, '. ');

    var conflict = weddingDays != null && tastingDays != null && tastingDays >= weddingDays;
    var conflictText = tastingDays == null
      ? '시식 예약일을 입력해 주세요'
      : conflict
        ? '시식일이 예식일 이후입니다 — 확인 필요'
        : '해당 시간대 시식 예약 2팀 · 수용 가능';

    return h`
      <div class="rise" style="max-width:880px">
        <button type="button" class="back-link" data-action="go" data-value="customers">← 고객 / 예식 관리</button>
        <h1 class="page-title">신규 고객 등록</h1>
        <p class="page-sub">예식일과 시식 예약일을 입력하면 D-Day가 자동 계산되고 기본 체크리스트가 생성됩니다.</p>

        <form class="form-card" data-action="save-customer">
          <div class="section-label">기본 정보</div>
          <div class="form-grid-2">
            <label class="field">신랑 이름
              <input class="input" placeholder="김민준" data-keep="new-groom"></label>
            <label class="field">신부 이름
              <input class="input" placeholder="이서연" data-keep="new-bride"></label>
            <label class="field">대표 연락처
              <input class="input" type="tel" placeholder="010-0000-0000" data-keep="new-phone"></label>
            <label class="field">담당자
              <input class="input" value="${D.STAFF.name}" data-keep="new-owner"></label>
          </div>

          <div class="section-label" style="margin-top:30px">예식 · 시식 일정</div>
          <div class="form-grid-3">
            <label class="field">예식일
              <input class="input" type="date" value="${state.wedding}" data-action="set-wedding"></label>
            <label class="field">예식 시간 / 홀
              <select class="select" data-keep="new-hall">
                ${D.HALL_OPTIONS.map(function (o) { return h`<option>${o}</option>`; })}
              </select></label>
            <label class="field">시식 예약일
              <input class="input" type="date" value="${state.tasting}" data-action="set-tasting"></label>
          </div>

          <div class="callouts">
            <div class="callout callout--rose">
              <div class="callout__label">예식 D-Day 자동 계산</div>
              <div class="callout__value">${ddayText}</div>
            </div>
            <div class="callout callout--sage">
              <div class="callout__label">시식 일정 충돌 확인</div>
              <div class="callout__text${conflict ? ' callout__text--warn' : ''}">${conflictText}</div>
            </div>
          </div>

          <div class="form-actions">
            <span class="form-actions__note">저장 시 예식 최종 체크리스트 양식 ${D.CHECKLIST.reduce(function (n, g) { return n + g.items.length; }, 0)}개 항목이 ${D.CHECKLIST.length}개 묶음으로 생성됩니다.</span>
            <button type="button" class="btn btn--outline" data-action="go" data-value="customers">취소</button>
            <button type="submit" class="btn btn--primary">저장하고 체크리스트 생성</button>
          </div>
        </form>
      </div>`;
  }

  /* ================================================ 3단계 · 고객 상세 ==== */

  function detailView(d) {
    var c = d.customer;
    var stats = [
      { label: '예식까지', value: c.dday },
      { label: '체크리스트', value: d.pctFor(c) + '% 완료' },
      { label: '시식 예약', value: c.tasting },
      { label: '예상 하객', value: '250명' },
    ];

    return h`
      <div class="rise">
        <button type="button" class="back-link" data-action="go" data-value="customers">← 고객 / 예식 관리</button>
        <div class="page-head">
          <div>
            <h1 class="page-title page-title--detail">${c.couple}</h1>
            <p class="page-sub">${c.date} · ${c.hall} · 담당 ${D.STAFF.name} · ${c.phone}</p>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button type="button" class="btn btn--outline" style="height:42px" data-action="go" data-value="checklist">체크리스트 열기</button>
            <button type="button" class="btn btn--primary" style="height:42px" data-action="share-open">신랑신부에게 공유 링크 보내기</button>
          </div>
        </div>

        <div class="stat-grid">
          ${stats.map(function (s) {
            return h`
              <div class="stat">
                <div class="stat__label">${s.label}</div>
                <div class="stat__value">${s.value}</div>
              </div>`;
          })}
        </div>

        <div class="grid-2 mt-18">
          <section class="card">
            <header class="card__head">
              <h2 class="card__title">상담 기록</h2>
              <button type="button" class="btn btn--xs btn--outline">＋ 기록 추가</button>
            </header>
            <div>
              ${D.CONSULTS.map(function (r) {
                return h`
                  <div class="consult">
                    <div class="consult__top">
                      <span class="consult__date">${r.date}</span>
                      <span class="consult__meta">${r.type} · ${r.staff}</span>
                    </div>
                    <div class="consult__body">${r.body}</div>
                  </div>`;
              })}
            </div>
          </section>

          <div class="stack">
            <section class="card">
              <header class="card__head"><h2 class="card__title">진행 상태</h2></header>
              <div class="stages">
                ${D.STAGES.map(function (s, i) {
                  return h`
                    <div class="stage${s.done ? ' stage--done' : ''}">
                      <span class="stage__mark" aria-hidden="true">${s.done ? '✓' : String(i + 1)}</span>
                      <span class="stage__label">${s.label}</span>
                      <span class="stage__date">${s.date}</span>
                    </div>`;
                })}
                <div class="stage-actions" role="group" aria-label="진행 단계 변경">
                  ${['상담중', '계약완료', '예식완료'].map(function (label) {
                    return h`<button type="button" class="chip chip--stage" data-action="stage" data-value="${label}"
                      aria-pressed="${state.stage === label}">${label}</button>`;
                  })}
                </div>
              </div>
            </section>

            <section class="card">
              <header class="card__head">
                <h2 class="card__title">시식 예약</h2>
                <button type="button" class="btn-link" data-action="go" data-value="tastings">시식 예약 관리 →</button>
              </header>
              <div class="tasting-box">
                <div>
                  <div class="tasting-box__label">예약 일시</div>
                  <div class="tasting-box__value">2026. 3. 14 (토) 12:00</div>
                  <div class="tasting-box__meta">참석 4명 · 그랜드홀 시식장</div>
                </div>
                <label class="tasting-box__check">
                  <input type="checkbox" data-action="toggle-tasting-done" ${state.tastingDone ? new Safe('checked') : ''}>참석 확인
                </label>
              </div>
            </section>
          </div>
        </div>
      </div>`;
  }

  /* ============================================== 4단계 · 체크리스트 ==== */

  function checklistView(d) {
    var c = d.customer;

    return h`
      <div class="rise">
        <button type="button" class="back-link" data-action="go" data-value="detail">← ${c.couple} 상세</button>
        <div class="page-head">
          <div>
            <h1 class="page-title">예식 최종 체크리스트</h1>
            <p class="page-sub">${c.couple} · ${c.date} · ${c.dday} · ${D.CHECKLIST_DUE} · 변경 사항은 신랑신부 화면에 즉시 반영됩니다.</p>
          </div>
          <button type="button" class="btn btn--primary" style="height:42px" data-action="share-open">공유 링크 보내기</button>
        </div>

        <div class="progress-card">
          <div class="progress-card__row">
            <div class="progress-card__pct">${d.pct}%</div>
            <div class="progress-card__count">${d.done} / ${d.total}개 항목 완료</div>
            <div class="progress-card__stamp">마지막 업데이트 오늘 09:12</div>
          </div>
          <div style="margin-top:14px">${bar(d.pct, 'bar--thick')}</div>
        </div>

        <div class="split-checklist mt-18">
          <div style="display:flex;flex-direction:column;gap:14px">
            ${D.CHECKLIST.map(function (g) {
              var groupDone = g.items.filter(isItemDone).length;
              var complete = groupDone === g.items.length;
              return h`
                <section class="card group${complete ? ' group--complete' : ''}">
                  <header class="group__head">
                    <span class="group__label">${g.label}</span>
                    <span class="group__caption">${g.caption}</span>
                    <span class="group__count">${groupDone} / ${g.items.length}</span>
                  </header>
                  <div>
                    ${g.items.map(function (it) {
                      var on = isItemDone(it);
                      return h`
                        <div class="item${on ? ' item--done' : ''}">
                          <button type="button" class="check" role="checkbox" aria-checked="${on}"
                            aria-label="${it.label}" data-action="toggle-item" data-value="${it.id}">${on ? '✓' : ''}</button>
                          <div class="item__body">
                            <div class="item__label">${it.label}</div>
                            <div class="item__meta">${it.meta}</div>
                          </div>
                          <span class="tag tag--sq ${tone(it.tag)}">${it.tag}</span>
                        </div>`;
                    })}
                  </div>
                </section>`;
            })}
          </div>

          <section class="card sticky-side">
            <header class="card__head" style="display:block">
              <h2 class="card__title">파일 첨부함</h2>
              <p style="margin-top:6px;font-size:11.5px;color:var(--muted-2)">식권 사진 · 식전 영상 · 축가 반주 음원</p>
            </header>
            <div>
              ${D.FILES.map(function (f) {
                return h`
                  <div class="file">
                    <div class="file__icon ${tone(f.tone)}">${f.kind}</div>
                    <div class="file__meta">
                      <div class="file__name" title="${f.name}">${f.name}</div>
                      <div class="file__sub">${f.meta}</div>
                    </div>
                  </div>`;
              })}
              <div class="dropzone">
                <div class="dropzone__title">파일을 끌어다 놓거나 선택하세요</div>
                <div class="dropzone__hint">JPG · PNG · MP4 · MP3 · 최대 500MB</div>
                <button type="button" class="btn btn--sm btn--outline">파일 선택</button>
              </div>
            </div>
          </section>
        </div>
      </div>`;
  }

  /* ============================================ 시식 예약 관리 ==== */

  function tastingsView() {
    return h`
      <div class="rise">
        <h1 class="page-title">시식 예약 관리</h1>
        <p class="page-sub">계약 후 예식 전 진행하는 시식 일정입니다. 예약실이 일정을 잡으면 신랑신부 화면에서 참석 인원과 코스를 확인할 수 있습니다.</p>

        <div class="kpi-grid">${D.TASTING_KPIS.map(kpiCard)}</div>

        <div class="card mt-18 table-scroll">
          <div>
            <div class="table__head cols-tastings">
              <div>신랑 · 신부</div><div>시식 일시 · 장소</div><div>인원</div><div>코스</div><div>신랑신부 확인</div><div>참석 체크</div>
            </div>
            ${D.TASTINGS.map(function (t) {
              var attended = state.attended[t.id] === true;
              var confirmLabel = t.confirmed ? '신랑신부 확인 완료' : '신랑신부 확인 대기';
              return h`
                <div class="table__row cols-tastings">
                  <div style="min-width:0">
                    <button type="button" class="tasting__couple" data-action="open-customer" data-value="${t.cid}">${t.couple}</button>
                    <div class="tasting__memo">${t.memo}</div>
                  </div>
                  <div>
                    <div class="tasting__date">${t.date}</div>
                    <div class="tasting__place">${t.place}</div>
                  </div>
                  <div class="tasting__cell">${t.party}명</div>
                  <div class="tasting__menu${t.menu === '미선택' ? ' tasting__menu--empty' : ''}">${t.menu}</div>
                  <div class="tasting__badges">
                    <span class="tag tag--sq ${t.confirmed ? 'tone-green' : 'tone-amber'}">${confirmLabel}</span>
                    <span class="tag tag--xs ${tone(t.status)}">${t.status}</span>
                  </div>
                  <button type="button" class="attend" role="checkbox" aria-checked="${attended}"
                    data-action="toggle-attend" data-value="${t.id}">
                    <span class="check check--sm" aria-hidden="true">${attended ? '✓' : ''}</span>
                    <span class="attend__label">${attended ? '참석 확인됨' : '참석 체크'}</span>
                  </button>
                </div>`;
            })}
          </div>
        </div>

        <div class="notice">
          <div class="notice__text">참석 체크와 코스 선택은 신랑신부 공유 화면과 실시간으로 동기화됩니다. 코스 미선택 팀에는 안내 문자를 발송하세요.</div>
          <button type="button" class="btn btn--sm btn--outline" data-action="mobile-open">신랑신부 화면 확인</button>
        </div>
      </div>`;
  }

  /* ============================================ 사내 공유 게시판 ==== */

  function boardView() {
    var rows = D.MEMOS.filter(function (m) {
      if (state.boardFilter === '전체') return true;
      return (isMemoDone(m) ? '완료' : '진행중') === state.boardFilter;
    });

    return h`
      <div class="rise">
        <h1 class="page-title">사내 공유 게시판</h1>
        <p class="page-sub">부재중 전화와 인수인계 사항을 기록해 담당자가 바뀌어도 요청사항이 유실되지 않도록 합니다.</p>

        <div class="split-board mt-22">
          <div class="card">
            <div class="board__filters" role="group" aria-label="메모 상태 필터">
              ${['전체', '진행중', '완료'].map(function (label) {
                return h`<button type="button" class="chip chip--pill" data-action="board-filter" data-value="${label}"
                  aria-pressed="${state.boardFilter === label}">${label}</button>`;
              })}
            </div>
            ${rows.length === 0
              ? h`<p class="empty">해당 상태의 메모가 없습니다.</p>`
              : rows.map(function (m) {
                  var done = isMemoDone(m);
                  var status = done ? '완료' : '진행중';
                  return h`
                    <div class="memo">
                      <div class="memo__body">
                        <div class="memo__top">
                          <span class="tag tag--sq ${tone(status)}">${status}</span>
                          <span class="memo__who">${m.who}</span>
                          <span class="memo__phone">${m.phone}</span>
                          <span class="memo__stamp">${m.time} · 작성 ${m.author}</span>
                        </div>
                        <div class="memo__text">${m.body}</div>
                        <div class="memo__assignee">담당 인계 → ${m.assignee}</div>
                      </div>
                      <button type="button" class="btn btn--sm ${done ? 'btn--outline' : 'btn--primary'} memo__action"
                        data-action="toggle-memo" data-value="${m.id}">${done ? '진행중으로' : '완료 처리'}</button>
                    </div>`;
                })}
          </div>

          <section class="card card--pad sticky-side">
            <h2 class="card__title">메모 작성</h2>
            <div class="memo-form">
              <input class="input" placeholder="고객명 / 문의자" data-keep="memo-who">
              <input class="input" type="tel" placeholder="연락처" data-keep="memo-phone">
              <textarea class="textarea" placeholder="요청 내용 / 인계 사항" rows="5" data-keep="memo-body"></textarea>
              <select class="select" data-keep="memo-assignee">
                ${D.ASSIGNEE_OPTIONS.map(function (o) { return h`<option>${o}</option>`; })}
              </select>
              <button type="button" class="btn btn--primary">메모 등록</button>
            </div>
          </section>
        </div>
      </div>`;
  }

  /* ================================================ 제휴업체 관리 ==== */

  function vendorsView() {
    return h`
      <div class="rise">
        <h1 class="page-title">제휴업체 관리</h1>
        <p class="page-sub">체크리스트 안내 시 신랑신부에게 함께 전달되는 제휴업체 목록입니다.</p>
        <div class="grid-3 mt-22">
          ${D.VENDORS.map(function (v) {
            return h`
              <div class="vendor">
                <div class="vendor__thumb"><span class="vendor__slot">${v.slot}</span></div>
                <div class="vendor__body">
                  <div class="vendor__top">
                    <span class="tag tag--xs tone-rose">${v.category}</span>
                    <span class="vendor__rate">${v.rate}</span>
                  </div>
                  <div class="vendor__name">${v.name}</div>
                  <div class="vendor__desc">${v.desc}</div>
                  <div class="vendor__foot">
                    <span class="vendor__phone">${v.phone}</span>
                    <button type="button" class="btn btn--xs btn--outline">안내 전달</button>
                  </div>
                </div>
              </div>`;
          })}
        </div>
      </div>`;
  }

  /* ================================================ 실적 대시보드 ==== */

  function statsView() {
    return h`
      <div class="rise">
        <h1 class="page-title">실적 대시보드</h1>
        <p class="page-sub">2026년 1월 1일 ~ 2월 10일 · 직원별 상담 및 계약 현황</p>

        <div class="kpi-grid">${D.STAT_KPIS.map(kpiCard)}</div>

        <div class="split-stats mt-18">
          <section class="card card--pad">
            <h2 class="card__title">직원별 상담 · 계약 건수</h2>
            <div class="staff-list">
              ${D.STAFF_STATS.map(function (s) {
                return h`
                  <div>
                    <div class="staff__top">
                      <span class="staff__name">${s.name}</span>
                      <span class="staff__meta">상담 ${s.consult}건 · 계약 ${s.contract}건</span>
                      <span class="staff__rate">전환율 ${s.rate}%</span>
                    </div>
                    <div class="staff__bars">
                      <div class="staff__bar staff__bar--consult" style="width:${s.wConsult}%"></div>
                      <div class="staff__bar staff__bar--contract" style="width:${s.wContract}%"></div>
                    </div>
                  </div>`;
              })}
            </div>
            <div class="legend">
              <span class="legend__item"><span class="legend__swatch" style="background:var(--rose-chart)"></span>상담</span>
              <span class="legend__item"><span class="legend__swatch" style="background:var(--rose)"></span>계약</span>
            </div>
          </section>

          <section class="card card--pad">
            <h2 class="card__title">월별 계약 추이</h2>
            <div class="chart">
              ${D.MONTHS.map(function (m) {
                return h`
                  <div class="chart__col">
                    <span class="chart__value">${m.value}</span>
                    <div class="chart__bar${m.peak ? ' chart__bar--peak' : ''}" style="height:${m.h}%"></div>
                    <span class="chart__label">${m.label}</span>
                  </div>`;
              })}
            </div>
            <p class="chart__note">봄·가을 성수기 직전인 2월과 8월에 계약이 집중됩니다.</p>
          </section>
        </div>
      </div>`;
  }

  /* ================================================ 4단계 · 공유 모달 ==== */

  function shareModal(d) {
    if (!state.showShare) return '';
    return h`
      <div class="overlay overlay--share" data-action="overlay-close" data-value="share">
        <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="share-title" data-stop>
          <div class="section-label">4단계 · 공유 링크 발송</div>
          <h2 class="dialog__title" id="share-title">신랑신부에게 공유 링크 보내기</h2>
          <p class="dialog__text">${d.customer.couple} 고객이 별도 로그인 없이 체크리스트 진행률과 첨부파일을 확인할 수 있는 링크입니다.</p>
          <div class="dialog__copy">
            <input class="input" value="${D.SHARE_LINK}" readonly aria-label="공유 링크" data-focus-key="share-link">
            <button type="button" class="btn btn--outline" style="height:44px" data-action="copy-link">${state.copied ? '복사됨' : '복사'}</button>
          </div>
          <div class="dialog__actions">
            <button type="button" class="btn btn--outline" data-action="share-close">닫기</button>
            <button type="button" class="btn btn--primary" data-action="mobile-open">신랑신부 화면으로 보기</button>
          </div>
        </div>
      </div>`;
  }

  /* ======================================= 5단계 · 신랑신부 모바일 화면 ==== */

  function mobileModal(d) {
    if (!state.showMobile) return '';
    var c = d.customer;

    return h`
      <div class="overlay overlay--mobile" data-action="overlay-close" data-value="mobile">
        <div class="preview" role="dialog" aria-modal="true" aria-labelledby="preview-title" data-stop>
          <div class="preview__copy">
            <div class="preview__eyebrow">5단계 · 신랑신부 공유 화면</div>
            <div class="preview__title" id="preview-title">로그인 없이<br>공유 링크로 접속</div>
            <p class="preview__text">직원이 체크리스트를 수정하면 이 화면에 즉시 반영됩니다. 읽기 전용이며 첨부파일 확인과 제출만 가능합니다.</p>
            <button type="button" class="preview__close" data-action="mobile-close">닫기</button>
          </div>

          <div class="phone">
            <div class="phone__screen">
              <div class="phone__status" aria-hidden="true"><span>9:41</span><span style="letter-spacing:.1em">▪▪▪ ▮</span></div>
              <div class="phone__scroll">
                <div class="m-hero">
                  ${hero(state.hero, true)}
                  <div class="m-hero__scrim"></div>
                  <div class="m-hero__copy">
                    <div class="m-hero__eyebrow">WEDDINGCHECK</div>
                    <div class="m-hero__couple">${c.couple}</div>
                    <div class="m-hero__meta">${c.date} · ${c.hall}</div>
                  </div>
                </div>

                <div class="m-body">
                  <div class="m-card">
                    <div class="m-card__row">
                      <div class="m-card__pct">${d.pct}%</div>
                      <div class="m-card__count">${d.done} / ${d.total} 완료</div>
                      <div class="m-card__dday">${c.dday}</div>
                    </div>
                    <div style="margin-top:13px">${bar(d.pct, 'bar--thick')}</div>
                    <div class="m-card__stamp">예약실에서 오늘 09:12 업데이트</div>
                  </div>

                  <div class="m-heading">예식 전 시식</div>
                  <div class="m-card m-tasting">
                    <div class="m-tasting__top">
                      <span class="tag tag--xs ${state.myTastingConfirmed ? 'tone-green' : 'tone-amber'}">${state.myTastingConfirmed ? '확정' : '확인 대기'}</span>
                      <span class="m-tasting__place">그랜드홀 시식장</span>
                    </div>
                    <div class="m-tasting__when">2026. 3. 14 (토) 12:00</div>
                    <div class="m-tasting__state">${state.myTastingConfirmed ? '참석 확정 · 4명' : '참석 여부 확인해 주세요'}</div>
                    <button type="button" class="btn ${state.myTastingConfirmed ? 'btn--outline' : 'btn--primary'}" data-action="confirm-my-tasting">
                      ${state.myTastingConfirmed ? '참석 확정 취소' : '참석 확정하기'}
                    </button>
                    <div class="m-tasting__hint">인원 변경이나 일정 조율은 예약실로 연락 주시면 이 화면에 바로 반영됩니다.</div>
                  </div>

                  <div class="m-heading">예식 최종 체크리스트</div>
                  ${D.CHECKLIST.map(function (g) {
                    var groupDone = g.items.filter(isItemDone).length;
                    return h`
                      <div class="m-group">
                        <div class="m-group__head">
                          <span class="m-group__label">${g.label}</span>
                          <span class="m-group__caption">${g.caption}</span>
                          <span class="m-group__count">${groupDone} / ${g.items.length}</span>
                        </div>
                        <div class="m-group__list">
                          ${g.items.map(function (it) {
                            var on = isItemDone(it);
                            return h`
                              <div class="m-item${on ? ' m-item--done' : ''}">
                                <span class="m-item__box" aria-hidden="true">${on ? '✓' : ''}</span>
                                <span class="m-item__label">${it.label}</span>
                                <span class="tag ${tone(it.tag)}" style="font-size:10.5px;padding:3px 7px;border-radius:5px">${it.tag}</span>
                              </div>`;
                          })}
                        </div>
                      </div>`;
                  })}

                  <div class="m-heading">제출한 파일</div>
                  <div class="m-files">
                    ${D.FILES.map(function (f) {
                      return h`
                        <div class="m-file">
                          <div class="m-file__icon ${tone(f.tone)}">${f.kind}</div>
                          <div class="m-file__meta">
                            <div class="m-file__name">${f.name}</div>
                            <div class="m-file__sub">${f.meta}</div>
                          </div>
                          <span class="m-file__view">보기</span>
                        </div>`;
                    })}
                    <div style="padding:0 15px">
                      <button type="button" class="m-submit">＋ 식전 영상 · 축가 음원 제출하기</button>
                    </div>
                  </div>

                  <div class="m-contact">
                    <div class="m-contact__title">담당 예약실</div>
                    <div class="m-contact__body">${D.STAFF.hall} · ${D.STAFF.name}<br>${D.STAFF.phone} · ${D.STAFF.hours}</div>
                  </div>
                  <div style="height:24px"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ========================================================== 렌더 ==== */

  var SCREENS = {
    home: homeView,
    customers: customersView,
    new: newCustomerView,
    detail: detailView,
    checklist: checklistView,
    tastings: tastingsView,
    board: boardView,
    vendors: vendorsView,
    stats: statsView,
  };

  var TITLES = {
    login: '로그인',
    home: '홈 대시보드',
    customers: '고객 / 예식 관리',
    new: '신규 고객 등록',
    detail: '고객 상세',
    checklist: '예식 최종 체크리스트',
    tastings: '시식 예약 관리',
    board: '사내 공유 게시판',
    vendors: '제휴업체 관리',
    stats: '실적 대시보드',
  };

  function view() {
    var d = derive();

    if (state.screen === 'login') {
      return h`${loginView()}${shareModal(d)}${mobileModal(d)}`;
    }

    var screen = SCREENS[state.screen] || homeView;
    return h`
      <div class="app">
        ${sidebar(d)}
        <main class="main">${screen(d)}</main>
      </div>
      ${shareModal(d)}
      ${mobileModal(d)}`;
  }

  /**
   * 화면 전체를 다시 그리되, 입력 중이던 값과 포커스는 잃지 않도록 복원합니다.
   * (data-keep = 입력값 보존, data-focus-key = 포커스·커서 위치 보존)
   */
  function render() {
    var kept = {};
    root.querySelectorAll('[data-keep]').forEach(function (el) {
      kept[el.dataset.keep] = el.value;
    });

    var active = document.activeElement;
    var focusKey = active && active.dataset ? active.dataset.focusKey : null;
    var caret = focusKey && 'selectionStart' in active ? active.selectionStart : null;

    root.innerHTML = String(view());

    root.querySelectorAll('[data-keep]').forEach(function (el) {
      if (el.dataset.keep in kept) el.value = kept[el.dataset.keep];
    });

    if (focusKey) {
      var next = root.querySelector('[data-focus-key="' + focusKey + '"]');
      if (next) {
        next.focus();
        if (caret != null) {
          try { next.setSelectionRange(caret, caret); } catch (e) { /* type=search 등 미지원 */ }
        }
      }
    } else if (state.showShare) {
      var link = root.querySelector('[data-focus-key="share-link"]');
      if (link) link.focus();
    }

    document.title = 'WeddingCheck · ' + (TITLES[state.screen] || '');
  }

  /* ======================================================== 이벤트 ==== */

  function toggleKey(map, key, fallback) {
    var next = Object.assign({}, map);
    next[key] = !(key in map ? map[key] : fallback);
    return next;
  }

  var ACTIONS = {
    login: function () { setState({ screen: 'home', showShare: false }); },
    logout: function () { setState({ screen: 'login', showShare: false, showMobile: false }); },

    go: function (value) { setState({ screen: value, showShare: false }); },
    'open-customer': function (value) { setState({ customerId: Number(value), screen: 'detail', showShare: false }); },
    'save-customer': function () { setState({ screen: 'checklist' }); },

    hero: function (value) { setState({ hero: value }); },
    filter: function (value) { setState({ filter: value }); },
    'board-filter': function (value) { setState({ boardFilter: value }); },
    stage: function (value) { setState({ stage: value }); },

    'toggle-item': function (value) {
      var item = derive().items.find(function (i) { return i.id === value; });
      setState({ checks: toggleKey(state.checks, value, item ? item.done : false) });
    },
    'toggle-memo': function (value) {
      var memo = D.MEMOS.find(function (m) { return m.id === value; });
      setState({ memoDone: toggleKey(state.memoDone, value, memo ? memo.done : false) });
    },
    'toggle-attend': function (value) {
      setState({ attended: toggleKey(state.attended, value, false) });
    },
    'confirm-my-tasting': function () { setState({ myTastingConfirmed: !state.myTastingConfirmed }); },

    'share-open': function () { setState({ showShare: true, copied: false }); },
    'share-close': function () { setState({ showShare: false }); },
    'mobile-open': function () { setState({ showMobile: true, showShare: false }); },
    'mobile-close': function () { setState({ showMobile: false }); },

    'copy-link': function () {
      var done = function () { setState({ copied: true }); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(D.SHARE_LINK).then(done, done);
      } else {
        var input = root.querySelector('[data-focus-key="share-link"]');
        if (input) { input.select(); try { document.execCommand('copy'); } catch (e) { /* 무시 */ } }
        done();
      }
    },
  };

  function closeTopOverlay() {
    if (state.showMobile) setState({ showMobile: false });
    else if (state.showShare) setState({ showShare: false });
  }

  function bind() {
    root.addEventListener('click', function (e) {
      // 오버레이 바깥 클릭으로 닫기 (다이얼로그 내부 클릭은 data-stop 에서 차단)
      var overlay = e.target.closest('[data-action="overlay-close"]');
      if (overlay && !e.target.closest('[data-stop]')) {
        return closeTopOverlay();
      }

      var el = e.target.closest('[data-action]');
      if (!el || el.dataset.action === 'overlay-close') return;

      var action = ACTIONS[el.dataset.action];
      if (!action) return;
      // form 의 submit 은 submit 핸들러에서 처리합니다.
      if (el.tagName === 'FORM') return;
      e.preventDefault();
      action(el.dataset.value);
    });

    root.addEventListener('submit', function (e) {
      var form = e.target.closest('[data-action]');
      if (!form) return;
      e.preventDefault();
      var action = ACTIONS[form.dataset.action];
      if (action) action(form.dataset.value);
    });

    root.addEventListener('input', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) return;
      if (el.dataset.action === 'search') setState({ search: el.value });
    });

    root.addEventListener('change', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) return;
      switch (el.dataset.action) {
        case 'set-wedding': setState({ wedding: el.value }); break;
        case 'set-tasting': setState({ tasting: el.value }); break;
        case 'toggle-tasting-done': setState({ tastingDone: el.checked }); break;
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeTopOverlay();
    });
  }

  /* ========================================================== 시작 ==== */

  document.addEventListener('DOMContentLoaded', function () {
    root = document.getElementById('app');
    bind();
    render();
  });
})();
