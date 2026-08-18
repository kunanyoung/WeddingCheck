/**
 * WeddingCheck — OO웨딩홀 예약실 업무 시스템
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

  /**
   * 수정·삭제·추가가 일어나는 목록은 data.js 원본을 건드리지 않도록
   * 레코드까지 한 겹 복사해 state 안에 둡니다. (새로고침하면 원본으로 되돌아갑니다)
   */
  function cloneList(list) {
    return list.map(function (r) { return Object.assign({}, r); });
  }

  var state = {
    screen: 'login',
    customerId: 1,
    hero: 'photo',

    checks: {},        // 체크리스트 항목 id → 완료 여부(기본값 덮어쓰기)
    attended: {},      // 시식 id → 참석 체크 여부

    // 편집 가능한 목록 — EDIT_FORMS 의 list 키와 이름이 같습니다.
    posts: cloneList(D.MEMOS),
    customers: cloneList(D.CUSTOMERS),
    tastings: cloneList(D.TASTINGS),
    vendors: cloneList(D.VENDORS),
    consults: cloneList(D.CONSULTS),
    members: cloneList(D.MEMBERS),

    memberFilter: '전체',   // 관리자 대시보드 권한 필터
    memberSearch: '',
    memberError: '',
    customerError: '',     // 신규 고객 등록 오류 안내

    editing: null,     // 수정 모달 대상 { kind, id }
    deleting: null,    // 삭제 확인 모달 대상 { kind, id }
    editError: '',     // 수정 모달 오류 안내
    postError: '',     // 게시글 작성 오류 안내

    filter: '전체',
    search: '',
    boardFilter: '전체',
    stage: '계약완료',

    wedding: '2026-05-16',   // 신규 등록 화면의 예식일 (D-Day 자동 계산용)

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

  function customerById(cid) {
    return state.customers.find(function (c) { return c.id === cid; }) || null;
  }

  /** kind(EDIT_FORMS 키) → 해당 목록. 수정·삭제가 공통으로 씁니다. */
  function listOf(kind) {
    var form = EDIT_FORMS[kind];
    return form ? state[form.list] : null;
  }

  function recordOf(kind, id) {
    var list = listOf(kind);
    if (!list) return null;
    return list.find(function (r) { return String(r.id) === String(id); }) || null;
  }

  /**
   * 신랑신부 식별 표기의 단일 창구.
   * 앱 전체에서 예식일 · 시간 · 이름 · 홀 네 요소로 구분합니다.
   * CUSTOMERS.date 는 '2026. 5. 16 (토) 13:00' 형식이라 연도만 떼어 씁니다.
   *
   * 표기 순서는 항상 예식일 · 시간 → 홀 → 신랑신부 이름 입니다.
   *
   *   when  '5. 16 (토) 13:00'   예식일 + 시간
   *   hall  '그랜드홀'
   *   name  '김민준 · 이서연'     신랑신부
   *   dday  'D-95'
   *   event '5. 16 (토) 13:00 · 그랜드홀'          (이름 없이 예식만 가리킬 때)
   *   full  '5. 16 (토) 13:00 · 그랜드홀 · 김민준 · 이서연'
   */
  function coupleIdParts(cid) {
    var c = customerById(cid);
    // 예식을 삭제하면 이 예식을 가리키던 일정·시식은 "예식 미지정"으로 남습니다.
    if (!c) {
      return {
        when: '예식 미지정', name: '', hall: '', dday: '',
        full: '예식 미지정', event: '예식 미지정', eventDday: '예식 미지정',
      };
    }
    var when = c.date.replace(/^\d{4}\.\s*/, '');
    return {
      when: when,
      hall: c.hall,
      name: c.couple,
      dday: c.dday,
      event: when + ' · ' + c.hall,
      eventDday: when + ' · ' + c.hall + ' · ' + c.dday,
      full: when + ' · ' + c.hall + ' · ' + c.couple,
    };
  }

  /** 네 요소 전체. "5. 16 (토) 13:00 · 김민준 · 이서연 · 그랜드홀" */
  function coupleId(cid) {
    return coupleIdParts(cid).full;
  }

  /** D.TODAY 를 "오늘"로 본 일수 차이. 잘못된 입력이면 null. */
  function dayDiff(iso) {
    if (!iso) return null;
    var from = new Date(D.TODAY + 'T00:00:00');
    var to = new Date(iso + 'T00:00:00');
    if (isNaN(to)) return null;
    return Math.round((to - from) / 86400000);
  }

  /** 여러 줄 메모의 첫 줄만 (좁은 칸에 요약해 넣을 때) */
  function firstLine(text) {
    return String(text || '').split('\n')[0].trim();
  }

  var WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  /** '2026-05-16' + '13:00' → '2026. 5. 16 (토) 13:00' */
  function formatEventDate(iso, time) {
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return '일정 미정';
    var label = d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate()
      + ' (' + WEEKDAYS[d.getDay()] + ')';
    return time ? label + ' ' + time : label;
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
    // 고객을 모두 삭제하면 customer 는 null 이 되고, 상세·체크리스트는 빈 화면을 보여줍니다.
    var customer = customerById(state.customerId) || state.customers[0] || null;
    var posts = state.posts;
    var openMemos = posts.filter(function (m) { return !m.done; }).length;

    return {
      items: items,
      done: done,
      total: items.length,
      pct: pct,
      customer: customer,
      posts: posts,
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

  /**
   * 목록 항목 공통 수정 · 삭제 버튼.
   * kind 는 EDIT_FORMS 의 키이고, data-value 는 "kind:id" 형태로 넘깁니다.
   * 화면 낭독기에서 어느 항목의 버튼인지 구분되도록 aria-label 에 이름을 붙입니다.
   */
  function rowActions(kind, record, extraClass) {
    var name = EDIT_FORMS[kind].name(record);
    var target = kind + ':' + record.id;
    return h`
      <div class="row-actions ${extraClass || ''}">
        <button type="button" class="btn btn--xs btn--outline" data-action="edit-open" data-value="${target}"
          aria-label="${name} 수정">수정</button>
        <button type="button" class="btn btn--xs btn--danger" data-action="delete-open" data-value="${target}"
          aria-label="${name} 삭제">삭제</button>
      </div>`;
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
      customers: String(state.customers.length),
      tastings: String(state.tastings.length),
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
      // "확인 안 한 게시글"은 게시판 상태와 같은 값이므로 함께 움직입니다.
      var value = k.label === '확인 안 한 게시글' ? String(d.openMemos) : k.value;
      return Object.assign({}, k, { value: value, accent: true });
    });

    return h`
      <div class="rise">
        <div class="page-head">
          <div>
            <div class="eyebrow-date">${D.TODAY_LABEL}</div>
            <h1 class="page-title page-title--lg" style="margin-top:8px">안녕하세요, ${D.STAFF.name}님</h1>
            <p class="page-sub">오늘 상담 3건, 시식 1건이 예정되어 있고 확인하지 않은 게시글이 ${d.openMemos}건 있습니다.</p>
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
                var p = coupleIdParts(s.cid);
                return h`
                  <button type="button" class="row-btn cols-schedule" data-action="open-customer" data-value="${s.cid}">
                    <div class="sched__time">${s.time}</div>
                    <div style="min-width:0">
                      <div class="sched__event">예식 ${p.eventDday}</div>
                      <div class="sched__couple">${p.name}</div>
                      <div class="sched__note">${s.note}</div>
                    </div>
                    <span class="tag ${tone(s.tag)}">${s.tag}</span>
                  </button>`;
              })}
            </div>
          </section>

          <section class="card">
            <header class="card__head">
              <h2 class="card__title">게시판 최근 글</h2>
              <button type="button" class="btn-link" data-action="go" data-value="board">게시판 →</button>
            </header>
            <div style="padding:6px 0">
              ${d.posts.slice(0, 3).map(function (m) {
                var status = m.done ? '완료' : '진행중';
                return h`
                  <div class="memo-brief">
                    <div class="memo-brief__top">
                      <span class="tag tag--xs ${tone(status)}">${status}</span>
                      <span class="memo-brief__title">${m.title}</span>
                      <span class="memo-brief__time">${m.time}</span>
                    </div>
                    <div class="memo-brief__body">${m.body}</div>
                    <div class="memo-brief__author">${m.author}</div>
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
            ${state.customers.slice(1, 4).map(function (c) {
              var pct = d.pctFor(c);
              var p = coupleIdParts(c.id);
              return h`
                <button type="button" class="urgent" data-action="open-customer" data-value="${c.id}">
                  <div class="urgent__top">
                    <div class="urgent__event">${p.event}</div>
                    <div class="urgent__dday">${p.dday}</div>
                  </div>
                  <div class="urgent__couple">${p.name}</div>
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
    // 이름 · 연락처 외에 예식일 · 시간 · 홀로도 찾을 수 있게 합니다.
    // 검색어와 대상에서 같은 기호를 떼어내야 "5.16" · "5/16" 이 모두 걸립니다.
    var strip = function (s) { return s.replace(/[\s\-().·/]/g, '').toLowerCase(); };
    var needle = strip(query);
    var haystack = strip(c.couple + c.phone + c.date + c.hall);
    return haystack.indexOf(needle) !== -1;
  }

  function customersView(d) {
    var rows = state.customers
      .filter(function (c) { return state.filter === '전체' || c.status === state.filter; })
      .filter(function (c) { return matchesSearch(c, state.search); });

    return h`
      <div class="rise">
        <div class="page-head">
          <div>
            <h1 class="page-title">고객 / 예식 관리</h1>
            <p class="page-sub">계약 고객 ${state.customers.length}팀 · 예식일 기준 정렬</p>
          </div>
          <button type="button" class="btn btn--primary" data-action="go" data-value="new">＋ 신규 고객 등록</button>
        </div>

        <div class="filters">
          <input class="input input--sm input--search" type="search" placeholder="이름 · 예식일 · 홀 · 연락처 검색"
            aria-label="신랑신부 이름, 예식일, 홀 또는 연락처 검색"
            value="${state.search}" data-action="search" data-focus-key="customer-search">
          ${chips(['전체', '상담중', '계약완료', '진행중'], state.filter, 'filter')}
        </div>

        <div class="card mt-18 table-scroll">
          <div>
            <div class="table__head cols-customers">
              <div>예식일시</div><div>홀</div><div>신랑 · 신부</div><div>시식 일정 메모</div><div>체크리스트</div><div>상태</div><div>관리</div>
            </div>
            ${rows.length === 0
              ? h`<p class="empty">조건에 맞는 고객이 없습니다.</p>`
              : rows.map(function (c) {
                  var pct = d.pctFor(c);
                  return h`
                    <div class="table__row table__row--hover cols-customers">
                      <div>
                        <div class="cust__date">${c.date}</div>
                        <div class="cust__dday">${c.dday}</div>
                      </div>
                      <div class="cust__cell">${c.hall}</div>
                      <div style="min-width:0">
                        <button type="button" class="row-link" data-action="open-customer" data-value="${c.id}">${c.couple}</button>
                        <div class="cust__phone">${c.phone}</div>
                      </div>
                      <div class="cust__cell cust__memo${c.tasting ? '' : ' cust__memo--empty'}"
                        title="${c.tasting || '미정'}">${c.tasting || '미정'}</div>
                      <div>
                        ${bar(pct, 'bar--thin')}
                        <div class="cust__pct">${pct}%</div>
                      </div>
                      <div><span class="tag ${tone(c.status)}">${c.status}</span></div>
                      ${rowActions('customer', c)}
                    </div>`;
                })}
          </div>
        </div>
      </div>`;
  }

  /* ============================================== 3단계 · 신규 등록 ==== */

  function newCustomerView() {
    var weddingDays = dayDiff(state.wedding);

    var ddayText = weddingDays == null
      ? '예식일을 입력해 주세요'
      : ddayLabel(weddingDays) + ' · ' + state.wedding.replace(/-/g, '. ');

    return h`
      <div class="rise" style="max-width:880px">
        <button type="button" class="back-link" data-action="go" data-value="customers">← 고객 / 예식 관리</button>
        <h1 class="page-title">신규 고객 등록</h1>
        <p class="page-sub">예식일을 입력하면 D-Day가 자동 계산됩니다.
          시식 일정과 체크리스트는 자동으로 만들지 않고 <strong>직접 적은 메모</strong>로 관리합니다.</p>

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

          <div class="section-label" style="margin-top:30px">예식 일정</div>
          <div class="form-grid-2">
            <label class="field">예식일
              <input class="input" type="date" value="${state.wedding}" data-action="set-wedding"></label>
            <label class="field">예식 시간 / 홀
              <select class="select" data-keep="new-hall">
                ${D.HALL_OPTIONS.map(function (o) { return h`<option>${o}</option>`; })}
              </select></label>
          </div>

          <div class="callouts">
            <div class="callout callout--rose">
              <div class="callout__label">예식 D-Day 자동 계산</div>
              <div class="callout__value">${ddayText}</div>
            </div>
            <div class="callout callout--sage">
              <div class="callout__label">시식 · 체크리스트</div>
              <div class="callout__text">아래 메모칸에 직접 적어 관리합니다 — 자동 생성하지 않습니다</div>
            </div>
          </div>

          <div class="section-label" style="margin-top:30px">수기 메모</div>
          <div class="memo-fields">
            <label class="field">시식 일정 메모
              <textarea class="textarea" rows="4" data-keep="new-tasting"
                placeholder="예: 3. 14 (토) 12:00 그랜드홀 시식장 · 4명 (신부 부모님 채식 1인)
아직 안 잡혔으면 — 미정, 3월 첫째 주 토요일 희망"></textarea></label>
            <label class="field">체크리스트 메모
              <textarea class="textarea" rows="4" data-keep="new-check"
                placeholder="예: 식전 영상 파일 재전달 안내
축가 반주 MR 수령 완료
폐백 생략 확인"></textarea></label>
          </div>
          <p class="memo-fields__hint">두 메모는 형식 제한이 없습니다. 저장하면 고객 상세에 남고, 상세에서 언제든 고칠 수 있습니다.
            비워 두면 <strong>미정</strong>으로 표시됩니다.</p>

          ${state.customerError ? h`<p class="form-error" role="alert">${state.customerError}</p>` : ''}

          <div class="form-actions">
            <span class="form-actions__note">예식 최종 체크리스트 양식(${D.CHECKLIST.reduce(function (n, g) { return n + g.items.length; }, 0)}항목)은 사이드바 체크리스트 메뉴에서 따로 확인합니다.</span>
            <button type="button" class="btn btn--outline" data-action="go" data-value="customers">취소</button>
            <button type="submit" class="btn btn--primary">저장하고 상세 보기</button>
          </div>
        </form>
      </div>`;
  }

  /* ================================================ 3단계 · 고객 상세 ==== */

  /** 고객을 모두 삭제해 보여줄 예식이 없을 때의 화면 */
  function emptyCustomerView(title) {
    return h`
      <div class="rise">
        <button type="button" class="back-link" data-action="go" data-value="customers">← 고객 / 예식 관리</button>
        <h1 class="page-title">${title}</h1>
        <div class="card mt-18">
          <p class="empty">등록된 예식이 없습니다. 신규 고객을 등록하면 이 화면이 다시 채워집니다.</p>
        </div>
      </div>`;
  }

  function detailView(d) {
    var c = d.customer;
    if (!c) return emptyCustomerView('고객 상세');
    var stats = [
      { label: '예식까지', value: c.dday },
      { label: '체크리스트', value: d.pctFor(c) + '% 완료' },
      // 시식 일정은 수기 메모라 첫 줄만 요약해 보여 주고, 전문은 아래 메모 카드에 있습니다.
      { label: '시식 일정', value: firstLine(c.tasting) || '미정' },
      { label: '예상 하객', value: '250명' },
    ];

    return h`
      <div class="rise">
        <button type="button" class="back-link" data-action="go" data-value="customers">← 고객 / 예식 관리</button>
        <div class="page-head">
          <div>
            <div class="page-eyebrow">${coupleIdParts(c.id).event} · ${c.dday}</div>
            <h1 class="page-title page-title--detail">${c.couple}</h1>
            <p class="page-sub">담당 ${D.STAFF.name} · ${c.phone}</p>
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
              ${state.consults.length === 0
                ? h`<p class="empty">상담 기록이 없습니다.</p>`
                : state.consults.map(function (r) {
                    return h`
                      <div class="consult">
                        <div class="consult__top">
                          <span class="consult__date">${r.date}</span>
                          <span class="consult__meta">${r.type} · ${r.staff}</span>
                          ${rowActions('consult', r, 'row-actions--right')}
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
                <h2 class="card__title">시식 일정 메모</h2>
                <button type="button" class="btn-link" data-action="go" data-value="tastings">시식 예약 관리 →</button>
              </header>
              <div class="note">
                <div class="note__text${c.tasting ? '' : ' note__text--empty'}">${c.tasting || '미정 — 아직 적어 둔 메모가 없습니다.'}</div>
                <div class="note__foot">
                  <label class="tasting-box__check">
                    <input type="checkbox" data-action="toggle-tasting-done" ${state.tastingDone ? new Safe('checked') : ''}>참석 확인
                  </label>
                  <button type="button" class="btn btn--xs btn--outline" data-action="edit-open" data-value="customer:${c.id}"
                    aria-label="시식 일정 메모 수정">메모 수정</button>
                </div>
              </div>
            </section>

            <section class="card">
              <header class="card__head">
                <h2 class="card__title">체크리스트 메모</h2>
                <button type="button" class="btn-link" data-action="go" data-value="checklist">양식 체크리스트 →</button>
              </header>
              <div class="note">
                <div class="note__text${c.checkMemo ? '' : ' note__text--empty'}">${c.checkMemo || '미정 — 아직 적어 둔 메모가 없습니다.'}</div>
                <div class="note__foot">
                  <span class="note__hint">양식 23항목과 별도로 직접 적는 메모입니다.</span>
                  <button type="button" class="btn btn--xs btn--outline" data-action="edit-open" data-value="customer:${c.id}"
                    aria-label="체크리스트 메모 수정">메모 수정</button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>`;
  }

  /* ============================================== 4단계 · 체크리스트 ==== */

  function checklistView(d) {
    var c = d.customer;
    if (!c) return emptyCustomerView('예식 최종 체크리스트');

    return h`
      <div class="rise">
        <button type="button" class="back-link" data-action="go" data-value="detail">← ${coupleIdParts(c.id).event} 상세</button>
        <div class="page-head">
          <div>
            <h1 class="page-title">예식 최종 체크리스트</h1>
            <p class="page-sub">${coupleId(c.id)} · ${c.dday} · ${D.CHECKLIST_DUE} · 변경 사항은 신랑신부 화면에 즉시 반영됩니다.</p>
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
              <div>예식 · 신랑 · 신부</div><div>시식 일시 · 장소</div><div>인원</div><div>코스</div><div>신랑신부 확인</div><div>참석 체크</div><div>관리</div>
            </div>
            ${state.tastings.length === 0
              ? h`<p class="empty">등록된 시식 예약이 없습니다.</p>`
              : state.tastings.map(function (t) {
                  var attended = state.attended[t.id] === true;
                  var confirmLabel = t.confirmed ? '신랑신부 확인 완료' : '신랑신부 확인 대기';
                  var p = coupleIdParts(t.cid);
                  return h`
                    <div class="table__row cols-tastings">
                      <div style="min-width:0">
                        <div class="tasting__event">예식 ${p.eventDday}</div>
                        <button type="button" class="tasting__couple" data-action="open-customer" data-value="${t.cid}">${p.name}</button>
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
                      ${rowActions('tasting', t)}
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

  function boardView(d) {
    var rows = d.posts.filter(function (m) {
      if (state.boardFilter === '전체') return true;
      return (m.done ? '완료' : '진행중') === state.boardFilter;
    });

    return h`
      <div class="rise">
        <h1 class="page-title">사내 공유 게시판</h1>
        <p class="page-sub">공지·인수인계·업무 요청 등 어떤 내용이든 제한 없이 올릴 수 있습니다.
          예식을 지정하지 않아도 <strong>제목 · 내용 · 작성자</strong>만으로 등록됩니다.</p>

        <div class="split-board mt-22">
          <div class="card">
            <div class="board__filters" role="group" aria-label="게시글 상태 필터">
              ${['전체', '진행중', '완료'].map(function (label) {
                return h`<button type="button" class="chip chip--pill" data-action="board-filter" data-value="${label}"
                  aria-pressed="${state.boardFilter === label}">${label}</button>`;
              })}
            </div>
            ${rows.length === 0
              ? h`<p class="empty">해당 상태의 게시글이 없습니다.</p>`
              : rows.map(function (m) {
                  var done = m.done;
                  var status = done ? '완료' : '진행중';
                  return h`
                    <div class="memo">
                      <div class="memo__body">
                        <div class="memo__top">
                          <span class="tag tag--sq ${tone(status)}">${status}</span>
                          <span class="memo__title">${m.title}</span>
                          <span class="memo__stamp">${m.time} · 작성 ${m.author}</span>
                        </div>
                        <div class="memo__text">${m.body}</div>
                      </div>
                      <div class="memo__actions">
                        <button type="button" class="btn btn--sm ${done ? 'btn--outline' : 'btn--primary'}"
                          data-action="toggle-memo" data-value="${m.id}">${done ? '진행중으로' : '완료 처리'}</button>
                        ${rowActions('post', m)}
                      </div>
                    </div>`;
                })}
          </div>

          <form class="card card--pad sticky-side" data-action="post-add">
            <h2 class="card__title">글쓰기</h2>
            <div class="memo-form">
              <label class="memo-form__label" for="post-title">제목</label>
              <input class="input" id="post-title" placeholder="예: [공지] 2월 셋째 주 근무표 변경"
                data-keep="post-title" data-focus-key="post-title">

              <label class="memo-form__label" for="post-body">내용</label>
              <textarea class="textarea" id="post-body" rows="7" placeholder="공유할 내용을 자유롭게 적어 주세요."
                data-keep="post-body" data-focus-key="post-body"></textarea>

              <label class="memo-form__label" for="post-author">작성자</label>
              <input class="input" id="post-author" value="${D.STAFF.name}"
                data-keep="post-author" data-focus-key="post-author">

              <p class="memo-form__hint">신랑신부 이름·연락처 같은 개인정보는 남기지 않도록 주의해 주세요.</p>
              ${state.postError ? h`<p class="memo-form__error" role="alert">${state.postError}</p>` : ''}
              <button type="submit" class="btn btn--primary">게시글 등록</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  /* ================================================ 제휴업체 관리 ==== */

  function vendorsView() {
    return h`
      <div class="rise">
        <h1 class="page-title">제휴업체 관리</h1>
        <p class="page-sub">체크리스트 안내 시 신랑신부에게 함께 전달되는 제휴업체 목록입니다.</p>
        ${state.vendors.length === 0
          ? h`<div class="card mt-22"><p class="empty">등록된 제휴업체가 없습니다.</p></div>`
          : h`<div class="grid-3 mt-22">
          ${state.vendors.map(function (v) {
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
                  ${rowActions('vendor', v, 'row-actions--vendor')}
                </div>
              </div>`;
          })}
        </div>`}
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

  /* ============================== 관리자 대시보드 · 회원 관리 ==== */

  function memberMatchesSearch(m, query) {
    if (!query) return true;
    var needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (m.name + m.account + m.team + m.role).toLowerCase().indexOf(needle) !== -1;
  }

  function adminView() {
    var all = state.members;
    var countBy = function (key, value) {
      return all.filter(function (m) { return m[key] === value; }).length;
    };
    var kpis = [
      { label: '전체 회원', value: String(all.length), unit: '명', sub: D.STAFF.hall + ' 사내 계정' },
      { label: '활성 계정', value: String(countBy('status', '활성')), unit: '명', sub: '로그인 가능' },
      { label: '승인 대기', value: String(countBy('status', '승인 대기')), unit: '명', sub: '권한 부여 필요', accent: true },
      { label: '관리자', value: String(countBy('role', '관리자')), unit: '명', sub: '회원 관리 권한 보유' },
    ];

    var rows = all
      .filter(function (m) { return state.memberFilter === '전체' || m.role === state.memberFilter; })
      .filter(function (m) { return memberMatchesSearch(m, state.memberSearch); });

    return h`
      <div class="rise">
        <h1 class="page-title">관리자 · 회원 관리</h1>
        <p class="page-sub">사내 계정을 추가하고 권한과 상태를 관리합니다. 권한에 따라 열 수 있는 메뉴가 달라집니다.</p>

        <div class="kpi-grid">${kpis.map(kpiCard)}</div>

        <div class="filters">
          <input class="input input--sm input--search" type="search" placeholder="이름 · 계정 · 소속 검색"
            aria-label="회원 이름, 계정 또는 소속 검색"
            value="${state.memberSearch}" data-action="member-search" data-focus-key="member-search">
          ${chips(['전체'].concat(D.MEMBER_ROLES), state.memberFilter, 'member-filter')}
        </div>

        <div class="split-board mt-18">
          <div class="card table-scroll">
            <div>
              <div class="table__head cols-members">
                <div>이름 · 계정</div><div>소속</div><div>권한</div><div>상태</div><div>가입 · 최근 접속</div><div>관리</div>
              </div>
              ${rows.length === 0
                ? h`<p class="empty">조건에 맞는 회원이 없습니다.</p>`
                : rows.map(function (m) {
                    return h`
                      <div class="table__row cols-members">
                        <div style="min-width:0">
                          <div class="member__name">${m.name}</div>
                          <div class="member__account">${m.account}</div>
                        </div>
                        <div class="member__cell">${m.team}</div>
                        <div><span class="tag tag--sq ${tone(m.role)}">${m.role}</span></div>
                        <div>
                          <button type="button" class="tag tag--sq tag--btn ${tone(m.status)}"
                            data-action="member-cycle-status" data-value="${m.id}"
                            aria-label="${m.name} 상태 변경 — 현재 ${m.status}">${m.status}</button>
                        </div>
                        <div>
                          <div class="member__cell">${m.joined} 가입</div>
                          <div class="member__last">${m.last}</div>
                        </div>
                        ${rowActions('member', m)}
                      </div>`;
                  })}
            </div>
          </div>

          <div class="stack">
            <form class="card card--pad" data-action="member-add">
              <h2 class="card__title">회원 추가</h2>
              <div class="memo-form">
                <label class="memo-form__label" for="member-name">이름</label>
                <input class="input" id="member-name" placeholder="예: 정하람"
                  data-keep="member-name" data-focus-key="member-name">

                <label class="memo-form__label" for="member-account">사내 계정</label>
                <input class="input" id="member-account" placeholder="예: jung.hr"
                  data-keep="member-account" data-focus-key="member-account">

                <label class="memo-form__label" for="member-team">소속</label>
                <input class="input" id="member-team" value="예약실"
                  data-keep="member-team" data-focus-key="member-team">

                <label class="memo-form__label" for="member-role">권한</label>
                <select class="select" id="member-role" data-keep="member-role">
                  ${D.MEMBER_ROLES.map(function (r) { return h`<option ${new Safe(r === '직원' ? 'selected' : '')}>${r}</option>`; })}
                </select>

                <p class="memo-form__hint">추가한 계정은 <strong>승인 대기</strong> 상태로 들어갑니다. 목록에서 상태 배지를 눌러 활성으로 바꿔 주세요.</p>
                ${state.memberError ? h`<p class="memo-form__error" role="alert">${state.memberError}</p>` : ''}
                <button type="submit" class="btn btn--primary">회원 추가</button>
              </div>
            </form>

            <section class="card card--pad">
              <h2 class="card__title">권한별 열람 범위</h2>
              <div class="scope-list">
                ${D.MEMBER_ROLES.map(function (r) {
                  return h`
                    <div class="scope">
                      <span class="tag tag--xs ${tone(r)}">${r}</span>
                      <span class="scope__text">${D.ROLE_SCOPES[r]}</span>
                      <span class="scope__count">${countBy('role', r)}명</span>
                    </div>`;
                })}
              </div>
            </section>
          </div>
        </div>
      </div>`;
  }

  /* ==================================== 공통 수정 · 삭제 모달 ==== */

  /**
   * 모든 목록 화면이 같은 모달 하나를 씁니다.
   *   list   state 안의 목록 이름
   *   name   삭제 확인 문구와 버튼 aria-label 에 쓰는 항목 이름
   *   fields 모달에 그릴 입력 칸. optional 이 아니면 빈 값으로 저장할 수 없습니다.
   *   linked 삭제 시 함께 지워지는 항목 안내 (예식 → 그 예식의 시식 예약)
   */
  var EDIT_FORMS = {
    post: {
      title: '게시글 수정', list: 'posts', what: '게시글',
      name: function (r) { return r.title; },
      fields: [
        { key: 'title', label: '제목' },
        { key: 'body', label: '내용', type: 'textarea', rows: 7 },
        { key: 'author', label: '작성자' },
      ],
    },
    customer: {
      title: '고객 · 예식 정보 수정', list: 'customers', what: '예식',
      name: function (r) { return r.couple; },
      fields: [
        { key: 'couple', label: '신랑 · 신부' },
        { key: 'phone', label: '연락처' },
        { key: 'date', label: '예식일시', hint: '예: 2026. 5. 16 (토) 13:00' },
        { key: 'dday', label: 'D-Day 표기' },
        { key: 'hall', label: '홀', type: 'select', options: ['그랜드홀', '채플홀', '가든홀'] },
        { key: 'status', label: '상태', type: 'select', options: ['상담중', '계약완료', '진행중'] },
        { key: 'tasting', label: '시식 일정 메모', type: 'textarea', rows: 4, optional: true,
          hint: '비워 두면 미정으로 표시됩니다.' },
        { key: 'checkMemo', label: '체크리스트 메모', type: 'textarea', rows: 5, optional: true },
      ],
      linked: function (r) {
        var n = state.tastings.filter(function (t) { return t.cid === r.id; }).length;
        return n ? '이 예식의 시식 예약 ' + n + '건도 함께 삭제됩니다.' : '';
      },
    },
    tasting: {
      title: '시식 예약 수정', list: 'tastings', what: '시식 예약',
      name: function (r) { return coupleIdParts(r.cid).name + ' 시식 예약'; },
      fields: [
        { key: 'date', label: '시식 일시' },
        { key: 'place', label: '장소' },
        { key: 'party', label: '인원(명)', type: 'number' },
        { key: 'menu', label: '코스' },
        { key: 'memo', label: '메모', type: 'textarea', rows: 3, optional: true },
        { key: 'status', label: '상태', type: 'select', options: ['확정', '조율중', '미정'] },
      ],
    },
    vendor: {
      title: '제휴업체 수정', list: 'vendors', what: '제휴업체',
      name: function (r) { return r.name; },
      fields: [
        { key: 'name', label: '업체명' },
        { key: 'category', label: '분류' },
        { key: 'desc', label: '안내 문구', type: 'textarea', rows: 4 },
        { key: 'phone', label: '연락처' },
        { key: 'rate', label: '제휴 조건' },
      ],
    },
    member: {
      title: '회원 정보 수정', list: 'members', what: '회원',
      name: function (r) { return r.name + '(' + r.account + ')'; },
      fields: [
        { key: 'name', label: '이름' },
        { key: 'account', label: '사내 계정', hint: '로그인에 쓰는 아이디입니다.' },
        { key: 'team', label: '소속' },
        { key: 'role', label: '권한', type: 'select', options: D.MEMBER_ROLES },
        { key: 'status', label: '상태', type: 'select', options: D.MEMBER_STATUSES },
        { key: 'last', label: '최근 접속', optional: true },
      ],
    },
    consult: {
      title: '상담 기록 수정', list: 'consults', what: '상담 기록',
      name: function (r) { return r.date + ' ' + r.type; },
      fields: [
        { key: 'date', label: '상담일' },
        { key: 'type', label: '구분', hint: '예: 3차 상담 · 계약' },
        { key: 'staff', label: '담당자' },
        { key: 'body', label: '내용', type: 'textarea', rows: 6, optional: true },
      ],
    },
  };

  function editField(f, record) {
    var value = record[f.key] == null ? '' : String(record[f.key]);
    var attrs = 'id="edit-' + f.key + '" data-edit="' + f.key + '"'
      + ' data-keep="edit-' + f.key + '" data-focus-key="edit-' + f.key + '"';
    var control;

    if (f.type === 'textarea') {
      control = h`<textarea class="textarea" rows="${f.rows || 4}" ${new Safe(attrs)}>${value}</textarea>`;
    } else if (f.type === 'select') {
      control = h`<select class="select" ${new Safe(attrs)}>
        ${f.options.map(function (o) {
          return h`<option ${new Safe(o === value ? 'selected' : '')}>${o}</option>`;
        })}
      </select>`;
    } else {
      control = h`<input class="input" type="${f.type === 'number' ? 'number' : 'text'}"
        ${new Safe(f.type === 'number' ? 'min="0"' : '')} value="${value}" ${new Safe(attrs)}>`;
    }

    return h`
      <div class="edit-form__field">
        <label class="edit-form__label" for="edit-${f.key}">${f.label}</label>
        ${control}
        ${f.hint ? h`<p class="edit-form__hint">${f.hint}</p>` : ''}
      </div>`;
  }

  function editModal() {
    if (!state.editing) return '';
    var form = EDIT_FORMS[state.editing.kind];
    var record = recordOf(state.editing.kind, state.editing.id);
    if (!form || !record) return '';

    return h`
      <div class="overlay overlay--share" data-action="overlay-close" data-value="edit">
        <form class="dialog dialog--edit" role="dialog" aria-modal="true" aria-labelledby="edit-dialog-title"
          data-stop data-action="edit-save">
          <div class="section-label">수정</div>
          <h2 class="dialog__title" id="edit-dialog-title">${form.title}</h2>
          <div class="edit-form">
            ${form.fields.map(function (f) { return editField(f, record); })}
          </div>
          ${state.editError ? h`<p class="edit-form__error" role="alert">${state.editError}</p>` : ''}
          <div class="dialog__actions">
            <button type="button" class="btn btn--outline" data-action="edit-close">취소</button>
            <button type="submit" class="btn btn--primary">저장</button>
          </div>
        </form>
      </div>`;
  }

  function deleteModal() {
    if (!state.deleting) return '';
    var form = EDIT_FORMS[state.deleting.kind];
    var record = recordOf(state.deleting.kind, state.deleting.id);
    if (!form || !record) return '';
    var linked = form.linked ? form.linked(record) : '';

    return h`
      <div class="overlay overlay--share" data-action="overlay-close" data-value="delete">
        <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" data-stop>
          <div class="section-label section-label--danger">삭제</div>
          <h2 class="dialog__title" id="delete-dialog-title">${form.what}을 삭제할까요?</h2>
          <p class="dialog__text"><strong>${form.name(record)}</strong> 을(를) 목록에서 지웁니다.
            되돌릴 수 없으니 한 번 더 확인해 주세요.${linked ? ' ' + linked : ''}</p>
          <div class="dialog__actions">
            <button type="button" class="btn btn--outline" data-action="delete-close">취소</button>
            <button type="button" class="btn btn--danger-solid" data-action="delete-confirm">삭제</button>
          </div>
        </div>
      </div>`;
  }

  /* ================================================ 4단계 · 공유 모달 ==== */

  function shareModal(d) {
    if (!state.showShare || !d.customer) return '';
    return h`
      <div class="overlay overlay--share" data-action="overlay-close" data-value="share">
        <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="share-title" data-stop>
          <div class="section-label">4단계 · 공유 링크 발송</div>
          <h2 class="dialog__title" id="share-title">신랑신부에게 공유 링크 보내기</h2>
          <p class="dialog__text"><strong>${coupleId(d.customer.id)}</strong> 고객이 별도 로그인 없이 체크리스트 진행률과 첨부파일을 확인할 수 있는 링크입니다.</p>
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
    if (!state.showMobile || !d.customer) return '';
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
                    <div class="m-hero__meta">${coupleIdParts(c.id).event} · ${c.dday}</div>
                    <div class="m-hero__couple">${c.couple}</div>
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
    admin: adminView,
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
    admin: '관리자 · 회원 관리',
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
      ${editModal()}
      ${deleteModal()}
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
    /** 신규 고객 등록 — 목록에 실제로 한 건을 추가하고 체크리스트로 넘어갑니다. */
    'save-customer': function () {
      var read = function (key) {
        var el = root.querySelector('[data-keep="' + key + '"]');
        return el ? String(el.value || '').trim() : '';
      };
      var groom = read('new-groom');
      var bride = read('new-bride');
      if (!groom || !bride) {
        return setState({ customerError: '신랑과 신부 이름을 모두 입력해 주세요.' });
      }

      // 홀 선택값은 '13:00 · 그랜드홀' 형태라 시간과 홀로 나눠 씁니다.
      var slot = (read('new-hall') || D.HALL_OPTIONS[0]).split(' · ');
      var ids = state.customers.map(function (c) { return c.id; });
      var customer = {
        id: (ids.length ? Math.max.apply(null, ids) : 0) + 1,
        couple: groom + ' · ' + bride,
        phone: read('new-phone') || '연락처 미입력',
        date: formatEventDate(state.wedding, slot[0]),
        dday: ddayLabel(dayDiff(state.wedding)),
        hall: slot[1] || '미정',
        pct: 0,
        status: '상담중',
        // 시식·체크리스트는 자동 생성하지 않고 적어 둔 메모를 그대로 보관합니다.
        tasting: read('new-tasting'),
        checkMemo: read('new-check'),
      };

      ['new-groom', 'new-bride', 'new-phone', 'new-tasting', 'new-check'].forEach(function (key) {
        var el = root.querySelector('[data-keep="' + key + '"]');
        if (el) el.value = '';
      });

      setState({
        customers: state.customers.concat([customer]),
        customerId: customer.id,
        customerError: '',
        screen: 'detail',
      });
    },

    hero: function (value) { setState({ hero: value }); },
    filter: function (value) { setState({ filter: value }); },
    'board-filter': function (value) { setState({ boardFilter: value }); },
    stage: function (value) { setState({ stage: value }); },

    'toggle-item': function (value) {
      var item = derive().items.find(function (i) { return i.id === value; });
      setState({ checks: toggleKey(state.checks, value, item ? item.done : false) });
    },
    'toggle-memo': function (value) {
      var memo = recordOf('post', value);
      if (memo) memo.done = !memo.done;
      setState({});
    },

    /* ---- 목록 공통 수정 · 삭제 ---- */

    /** data-value 는 "kind:id" — 첫 콜론까지가 종류, 나머지가 id 입니다. */
    'edit-open': function (value) {
      var at = value.indexOf(':');
      setState({ editing: { kind: value.slice(0, at), id: value.slice(at + 1) }, editError: '', deleting: null });
    },
    'edit-close': function () { setState({ editing: null, editError: '' }); },

    'edit-save': function () {
      if (!state.editing) return;
      var form = EDIT_FORMS[state.editing.kind];
      var record = recordOf(state.editing.kind, state.editing.id);
      if (!form || !record) return setState({ editing: null, editError: '' });

      var values = {};
      var missing = null;
      form.fields.forEach(function (f) {
        var el = root.querySelector('[data-edit="' + f.key + '"]');
        if (!el) return;
        var raw = String(el.value == null ? '' : el.value).trim();
        if (!raw && !f.optional) missing = missing || f.label;
        values[f.key] = f.type === 'number' ? (Number(raw) || 0) : raw;
      });

      if (missing) return setState({ editError: missing + '을(를) 입력해 주세요.' });

      Object.assign(record, values);
      setState({ editing: null, editError: '' });
    },

    'delete-open': function (value) {
      var at = value.indexOf(':');
      setState({ deleting: { kind: value.slice(0, at), id: value.slice(at + 1) }, editing: null });
    },
    'delete-close': function () { setState({ deleting: null }); },

    'delete-confirm': function () {
      if (!state.deleting) return;
      var kind = state.deleting.kind;
      var form = EDIT_FORMS[kind];
      var record = recordOf(kind, state.deleting.id);
      if (!form || !record) return setState({ deleting: null });

      var patch = { deleting: null };
      patch[form.list] = state[form.list].filter(function (r) { return r !== record; });

      // 예식을 지우면 그 예식의 시식 예약도 함께 사라집니다(주인 없는 예약이 남지 않도록).
      if (kind === 'customer') {
        patch.tastings = state.tastings.filter(function (t) { return t.cid !== record.id; });
        var rest = patch.customers;
        // 보고 있던 예식을 지웠다면 목록으로 돌아갑니다.
        if (state.customerId === record.id || rest.length === 0) {
          patch.customerId = rest.length ? rest[0].id : 0;
          if (state.screen === 'detail' || state.screen === 'checklist') patch.screen = 'customers';
        }
        patch.showShare = false;
        patch.showMobile = false;
      }

      setState(patch);
    },

    /**
     * 게시글 등록. 제목·내용·작성자 세 값만 받고 내용 길이·형식은 제한하지 않습니다.
     * 등록된 글은 state.posts 맨 앞에 쌓여 기존 글 위에 표시됩니다.
     */
    'post-add': function () {
      var fields = {};
      ['post-title', 'post-body', 'post-author'].forEach(function (key) {
        fields[key] = root.querySelector('[data-keep="' + key + '"]');
      });
      var title = (fields['post-title'].value || '').trim();
      var body = (fields['post-body'].value || '').trim();
      var author = (fields['post-author'].value || '').trim() || D.STAFF.name;

      if (!title || !body) {
        return setState({ postError: '제목과 내용을 모두 입력해 주세요.' });
      }

      var now = new Date();
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      var post = {
        id: 'p' + (state.posts.length + 1) + '-' + now.getTime(),
        time: '오늘 ' + pad(now.getHours()) + ':' + pad(now.getMinutes()),
        author: author,
        title: title,
        body: body,
        done: false,
      };

      // 다시 그릴 때 입력값이 복원되지 않도록 폼을 먼저 비웁니다.
      fields['post-title'].value = '';
      fields['post-body'].value = '';

      setState({ posts: [post].concat(state.posts), postError: '', boardFilter: '전체' });

      var next = root.querySelector('[data-keep="post-title"]');
      if (next) next.focus();
    },
    'toggle-attend': function (value) {
      setState({ attended: toggleKey(state.attended, value, false) });
    },

    /* ---- 관리자 대시보드 · 회원 관리 ---- */

    'member-filter': function (value) { setState({ memberFilter: value }); },

    /** 상태 배지를 누르면 활성 → 승인 대기 → 휴면 순으로 돌아갑니다. */
    'member-cycle-status': function (value) {
      var member = recordOf('member', value);
      if (!member) return;
      var order = D.MEMBER_STATUSES;
      var at = order.indexOf(member.status);
      member.status = order[(at + 1) % order.length];
      setState({});
    },

    /** 회원 추가. 이름·계정은 필수이고 계정은 중복될 수 없습니다. */
    'member-add': function () {
      var read = function (key) {
        var el = root.querySelector('[data-keep="' + key + '"]');
        return el ? String(el.value || '').trim() : '';
      };
      var name = read('member-name');
      var account = read('member-account');
      var team = read('member-team') || '예약실';
      var role = read('member-role') || '직원';

      if (!name || !account) {
        return setState({ memberError: '이름과 사내 계정을 모두 입력해 주세요.' });
      }
      var taken = state.members.some(function (m) { return m.account === account; });
      if (taken) {
        return setState({ memberError: '이미 쓰고 있는 계정입니다. 다른 계정을 입력해 주세요.' });
      }

      var member = {
        id: 'u' + (state.members.length + 1) + '-' + new Date().getTime(),
        name: name,
        account: account,
        team: team,
        role: role,
        status: '승인 대기',
        joined: D.TODAY_LABEL.replace(/년 /, '. ').replace(/월 /, '. ').replace(/일.*$/, ''),
        last: '접속 없음',
      };

      ['member-name', 'member-account'].forEach(function (key) {
        var el = root.querySelector('[data-keep="' + key + '"]');
        if (el) el.value = '';
      });

      setState({ members: state.members.concat([member]), memberError: '', memberFilter: '전체' });

      var next = root.querySelector('[data-keep="member-name"]');
      if (next) next.focus();
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
    else if (state.deleting) setState({ deleting: null });
    else if (state.editing) setState({ editing: null, editError: '' });
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
      if (el.dataset.action === 'member-search') setState({ memberSearch: el.value });
    });

    root.addEventListener('change', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) return;
      switch (el.dataset.action) {
        case 'set-wedding': setState({ wedding: el.value }); break;
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
