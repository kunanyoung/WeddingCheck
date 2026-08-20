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

  /* ================================================== 저장소 공통 ==== */

  /**
   * LocalStorage 읽기 · 쓰기의 단일 창구.
   * 사생활 보호 모드 · 용량 초과 · 손상된 형식을 사람이 읽을 수 있는 오류로 바꿉니다.
   * 예식 · 직원 목록 · 활동 이력 세 저장소가 함께 씁니다.
   */
  function lsRead(key) {
    var raw;
    try {
      raw = window.localStorage.getItem(key);
    } catch (e) {
      // 사생활 보호 모드에서는 localStorage 접근 자체가 예외를 던집니다.
      throw new Error('브라우저 저장소에 접근할 수 없습니다. 사생활 보호 모드라면 일반 창에서 열어 주세요.');
    }
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new Error('저장된 정보를 읽을 수 없습니다. 저장 형식이 손상되었습니다.');
    }
  }

  function lsWrite(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      throw new Error('저장 공간이 부족해 저장하지 못했습니다.');
    }
    return value;
  }

  /** 저장소가 아직 한 번도 쓰인 적 없는지 (시드를 넣을지 판단) */
  function lsUntouched(key) {
    try { return window.localStorage.getItem(key) == null; }
    catch (e) { return false; }
  }

  /** 모든 저장 동작은 비동기입니다 — 저장 방식이 서버로 바뀌어도 호출부는 그대로입니다. */
  function lsRun(fn) { return Promise.resolve().then(fn); }

  /* ================================================== 예식 저장소 ==== */

  /**
   * 예식기본정보 저장소.
   *
   * 지금은 브라우저 LocalStorage 에만 씁니다. 다만 화면 코드가 저장 방식을 몰라도
   * 되도록 list / create / update / replace / remove 다섯 개의 Promise 함수로만
   * 감싸 두었습니다. 나중에 서버로 옮기려면 이 객체 안만 바꾸면 됩니다.
   *
   * 저장 항목에는 고객 개인정보(이름 · 연락처 · 주소 · 금액) 칸을 두지 않습니다.
   * 예식은 "예식일자 + 예식시간 + 홀" 세 값으로만 식별합니다.
   * 요일은 저장하지 않고 예식일자에서 계산합니다(날짜와 요일이 어긋날 수 없도록).
   */
  var eventStore = (function () {
    var KEY = 'wdc:v1:events';

    /** 정렬·비교에 쓰는 키. 예식일자 → 예식시간 순입니다. */
    function sortKey(r) { return (r.date || '') + ' ' + (r.time || ''); }

    function sorted(events) {
      return events.slice().sort(function (a, b) {
        var x = sortKey(a), y = sortKey(b);
        return x < y ? -1 : x > y ? 1 : 0;
      });
    }

    /**
     * 양식(D.CHECKLIST)을 이 예식만의 사본으로 복사합니다.
     * 이후 항목을 고치거나 지워도 양식 원본과 다른 예식은 건드리지 않습니다.
     */
    function templateGroups() {
      return D.CHECKLIST.map(function (g, gi) {
        return {
          id: 'g' + (gi + 1),
          label: String(g.label || ''),
          caption: String(g.caption || ''),
          items: g.items.map(function (it) {
            return {
              id: String(it.id),
              label: String(it.label || ''),
              meta: String(it.meta || ''),
              tag: String(it.tag || ''),
              done: it.done === true,
              createdBy: '',
              updatedBy: '',
              updatedAt: '',
            };
          }),
        };
      });
    }

    function normalizeGroup(g, gi) {
      g = g || {};
      return {
        id: String(g.id || 'g' + (gi + 1)),
        label: String(g.label || ''),
        caption: String(g.caption || ''),
        items: (Array.isArray(g.items) ? g.items : []).map(function (it, ii) {
          it = it || {};
          return {
            id: String(it.id || 'it-' + (gi + 1) + '-' + (ii + 1)),
            label: String(it.label || ''),
            meta: String(it.meta || ''),
            tag: String(it.tag || ''),
            done: it.done === true,
            createdBy: String(it.createdBy || ''),
            updatedBy: String(it.updatedBy || ''),
            updatedAt: String(it.updatedAt || ''),
          };
        }),
      };
    }

    /**
     * id 가 없는 레코드는 예식의 자연키(예식일자 · 예식시간 · 홀)로 채웁니다.
     * 세 값이 같은 예식은 등록할 수 없으므로 이 키는 서로 겹치지 않습니다.
     */
    function fallbackId(r) {
      return 'ev-' + [r.date || '', r.time || '', r.hall || ''].join('_');
    }

    /** 저장된 레코드에 빠진 칸이 있어도 화면이 깨지지 않도록 모양을 맞춥니다. */
    function normalize(r) {
      r = r || {};
      return {
        id: String(r.id || fallbackId(r)),
        date: String(r.date || ''),
        time: String(r.time || ''),
        hall: String(r.hall || ''),
        alias: String(r.alias || ''),
        checks: r.checks && typeof r.checks === 'object' ? Object.assign({}, r.checks) : {},
        // groups 가 없는 옛 레코드는 읽을 때 양식 사본으로 채워집니다(자동 이행).
        groups: Array.isArray(r.groups) && r.groups.length
          ? r.groups.map(normalizeGroup)
          : templateGroups(),
        files: Array.isArray(r.files) ? cloneList(r.files) : [],
        memos: Array.isArray(r.memos) ? cloneList(r.memos) : [],
        createdAt: String(r.createdAt || ''),
        updatedAt: String(r.updatedAt || ''),
        // 누가 남긴 기록인지 — 로그인 계정이 아니라 직접 고른 작성자입니다.
        createdBy: String(r.createdBy || ''),
        updatedBy: String(r.updatedBy || ''),
      };
    }

    function read() {
      var parsed = lsRead(KEY);
      return Array.isArray(parsed) ? parsed.map(normalize) : [];
    }

    function write(events) { return lsWrite(KEY, events); }

    function find(events, id) {
      for (var i = 0; i < events.length; i++) if (events[i].id === id) return i;
      return -1;
    }

    function run(fn) { return lsRun(fn); }

    return {
      list: function () {
        return run(function () { return sorted(read()); });
      },

      /** 저장소가 아직 한 번도 쓰인 적 없을 때만 시연용 한 건을 넣습니다. */
      seed: function (records) {
        return run(function () {
          // 저장소를 못 쓰는 환경이면 list() 에서 안내합니다.
          if (!lsUntouched(KEY)) return false;
          var now = new Date().toISOString();
          write(sorted(records.map(function (r, i) {
            return normalize(Object.assign({}, r, {
              id: 'seed-' + now.replace(/\D/g, '') + '-' + i,
              createdAt: now,
              updatedAt: now,
            }));
          })));
          return true;
        });
      },

      create: function (draft) {
        return run(function () {
          var events = read();
          var now = new Date().toISOString();
          var record = normalize(Object.assign({}, draft, {
            id: 'ev-' + now.replace(/\D/g, '') + '-' + events.length,
            createdAt: now,
            updatedAt: now,
          }));
          write(sorted(events.concat([record])));
          return record;
        });
      },

      update: function (id, patch) {
        return run(function () {
          var events = read();
          var at = find(events, id);
          if (at < 0) throw new Error('수정할 예식을 찾지 못했습니다. 목록을 새로 불러와 주세요.');
          events[at] = normalize(Object.assign({}, events[at], patch, {
            updatedAt: new Date().toISOString(),
          }));
          write(sorted(events));
          return events[at];
        });
      },

      /** 예식은 남기고 하위 항목만 지운 결과를 통째로 덮어씁니다. */
      replace: function (record) {
        return run(function () {
          var events = read();
          var at = find(events, record.id);
          if (at < 0) throw new Error('저장할 예식을 찾지 못했습니다. 목록을 새로 불러와 주세요.');
          events[at] = normalize(Object.assign({}, record, {
            updatedAt: new Date().toISOString(),
          }));
          write(sorted(events));
          return events[at];
        });
      },

      /** 예식 레코드 자체를 지웁니다(하위 항목도 함께 사라집니다). */
      remove: function (id) {
        return run(function () {
          var events = read();
          if (find(events, id) < 0) throw new Error('삭제할 예식을 찾지 못했습니다.');
          return sorted(write(events.filter(function (r) { return r.id !== id; })));
        });
      },
    };
  })();

  /* ============================== 직원 목록 · 활동 이력 저장소 ==== */

  /**
   * 작성자로 고를 수 있는 직원 목록.
   *
   * 로그인 계정(관리자 · 회원 관리)과 **완전히 별개** 목록입니다.
   * 로그인한 사람과 실제로 기록을 남기는 사람이 다를 수 있어서,
   * 여기서 고른 이름만 기록에 들어갑니다.
   */
  var staffStore = (function () {
    var KEY = 'wdc:v1:staff';

    function normalize(r, i) {
      r = r || {};
      var name = String(r.name || '').trim();
      return {
        id: String(r.id || 'st-' + i + '-' + name),
        name: name,
        createdAt: String(r.createdAt || ''),
      };
    }

    function read() {
      var parsed = lsRead(KEY);
      return (Array.isArray(parsed) ? parsed : [])
        .map(normalize)
        .filter(function (r) { return !!r.name; });
    }

    return {
      list: function () { return lsRun(read); },

      /** 첫 방문에만 시연용 이름을 넣습니다. */
      seed: function (names) {
        return lsRun(function () {
          if (!lsUntouched(KEY)) return false;
          var now = nowIso();
          lsWrite(KEY, names.map(function (name, i) {
            return normalize({ id: 'st-seed-' + i, name: name, createdAt: now }, i);
          }));
          return true;
        });
      },

      add: function (name) {
        return lsRun(function () {
          var list = read();
          var clean = String(name || '').trim();
          if (!clean) throw new Error('직원 이름을 입력해 주세요.');
          if (clean.length > 20) throw new Error('직원 이름은 20자까지 입력할 수 있습니다.');
          if (list.some(function (r) { return r.name === clean; })) {
            throw new Error('이미 등록된 직원입니다.');
          }
          var now = nowIso();
          var record = normalize({
            id: 'st-' + now.replace(/\D/g, ''), name: clean, createdAt: now,
          }, list.length);
          lsWrite(KEY, list.concat([record]));
          return record;
        });
      },

      /**
       * 목록에서만 지웁니다. 이미 남은 기록 · 이력의 이름은 그대로 두어야
       * 나중에 책임 소재를 확인할 수 있습니다.
       */
      remove: function (id) {
        return lsRun(function () {
          var list = read();
          var target = list.find(function (r) { return r.id === id; });
          if (!target) throw new Error('삭제할 직원을 찾지 못했습니다.');
          lsWrite(KEY, list.filter(function (r) { return r.id !== id; }));
          return target;
        });
      },
    };
  })();

  /* ======================================= 시식 일정 후보 저장소 ==== */

  /**
   * 시식 일정 후보 (tasting_schedule_candidates).
   *
   * 예약실이 가능일 후보를 여러 개 올리고, 신랑신부가 공유 링크 화면에서
   * 하나를 골라 확정합니다. 확정 결과는 저장소에 남으므로 새로고침해도 보입니다.
   *
   * weddingEventId 는 예식(고객) 레코드의 id 입니다 — 공유 링크가 가리키는 대상과 같습니다.
   * 신랑신부 이름 · 연락처는 여기에도 저장하지 않습니다.
   */
  var candidateStore = (function () {
    var KEY = 'wdc:v1:candidates';

    function normalize(r, i) {
      r = r || {};
      return {
        id: String(r.id || 'tc-' + i),
        weddingEventId: String(r.weddingEventId || ''),
        candidateDate: String(r.candidateDate || ''),
        candidateTime: String(r.candidateTime || ''),
        isConfirmed: r.isConfirmed === true,
        createdBy: String(r.createdBy || ''),
        createdAt: String(r.createdAt || ''),
        confirmedAt: String(r.confirmedAt || ''),
        // 확정을 한 번 바꿨을 때의 이전 일정 — 예약실에 변경 알림으로 보여 줍니다.
        changedFrom: String(r.changedFrom || ''),
      };
    }

    function sorted(list) {
      return list.slice().sort(function (a, b) {
        var x = a.candidateDate + ' ' + a.candidateTime;
        var y = b.candidateDate + ' ' + b.candidateTime;
        return x < y ? -1 : x > y ? 1 : 0;
      });
    }

    function read() {
      var parsed = lsRead(KEY);
      return sorted((Array.isArray(parsed) ? parsed : []).map(normalize));
    }

    return {
      list: function () { return lsRun(read); },

      add: function (draft) {
        return lsRun(function () {
          var all = read();
          var eventId = String(draft.weddingEventId || '');
          var date = String(draft.candidateDate || '');
          var time = String(draft.candidateTime || '');
          var dup = all.some(function (r) {
            return r.weddingEventId === eventId && r.candidateDate === date && r.candidateTime === time;
          });
          if (dup) throw new Error('같은 날짜 · 시간 후보가 이미 있습니다.');

          var now = nowIso();
          var record = normalize(Object.assign({}, draft, {
            id: 'tc-' + now.replace(/\D/g, '') + '-' + all.length,
            createdAt: now,
            isConfirmed: false,
          }), all.length);
          lsWrite(KEY, sorted(all.concat([record])));
          return record;
        });
      },

      remove: function (id) {
        return lsRun(function () {
          var all = read();
          var target = all.find(function (r) { return r.id === id; });
          if (!target) throw new Error('삭제할 후보를 찾지 못했습니다.');
          lsWrite(KEY, all.filter(function (r) { return r.id !== id; }));
          return target;
        });
      },

      /** 예식을 지울 때 그 예식의 후보도 함께 치웁니다. */
      removeFor: function (weddingEventId) {
        return lsRun(function () {
          var all = read();
          var id = String(weddingEventId);
          lsWrite(KEY, all.filter(function (r) { return r.weddingEventId !== id; }));
          return all.filter(function (r) { return r.weddingEventId === id; });
        });
      },

      /**
       * 신랑신부가 후보 하나를 확정합니다. 같은 예식의 다른 후보는 확정이 풀립니다.
       * 이미 확정한 뒤 다시 고르면 이전 일정을 changedFrom 에 남겨 예약실에 알립니다.
       */
      confirm: function (id) {
        return lsRun(function () {
          var all = read();
          var target = all.find(function (r) { return r.id === id; });
          if (!target) throw new Error('고른 후보를 찾지 못했습니다. 화면을 새로 불러와 주세요.');

          var prev = all.find(function (r) {
            return r.weddingEventId === target.weddingEventId && r.isConfirmed && r.id !== id;
          }) || null;
          var now = nowIso();

          var next = all.map(function (r) {
            if (r.weddingEventId !== target.weddingEventId) return r;
            if (r.id === id) {
              return Object.assign({}, r, {
                isConfirmed: true,
                confirmedAt: now,
                changedFrom: prev ? candidateLabel(prev) : '',
              });
            }
            return Object.assign({}, r, { isConfirmed: false, confirmedAt: '', changedFrom: '' });
          });

          lsWrite(KEY, sorted(next));
          return {
            confirmed: next.find(function (r) { return r.id === id; }),
            previous: prev,
          };
        });
      },
    };
  })();

  /* ========================================= 오늘 상담 기록 저장소 ==== */

  /**
   * 오늘 상담 (consultations).
   *
   * 계약 전 단계 — "상담이 있었다"는 사실만 가볍게 남기는 기록입니다.
   * 워킹인 · 컨설팅 상담이 하루에 몇 건 있었는지 세는 것이 목적이라
   * 고객 등록(정식 계약)과는 **완전히 별개 저장소**이고 서로를 참조하지 않습니다.
   *
   * 신랑신부 이름 · 연락처 칸은 두지 않습니다. 사람이 알아볼 표시가 필요하면
   * 선택 입력인 memo 한 줄에만 적습니다(연락처 · 이메일 · 금액은 저장 전에 걸러냅니다).
   *
   * 한 줄은 { consultationDate, consultationTime, type, status, memo,
   * linkedWeddingEventId, createdBy, createdAt } 입니다.
   * createdBy 는 앱의 다른 기록과 같은 규칙 — 로그인 계정이 아니라 직접 고른 작성자입니다.
   *
   * linkedWeddingEventId 는 계약완료 상담이 어느 예식(wedding_events)으로 이어졌는지 가리키는
   * 빈 값 허용 칸입니다. 값이 없는 계약완료 건은 실적 대시보드에서 "연결 필요"로 잡힙니다.
   * 예식이 지워지면 unlinkEvent() 로 함께 끊어, 사라진 예식을 가리키는 값이 남지 않게 합니다.
   */
  var consultStore = (function () {
    var KEY = 'wdc:v1:consultations';

    function normalize(r, i) {
      r = r || {};
      var type = String(r.type || '');
      var status = String(r.status || '');
      return {
        id: String(r.id || 'cs-' + i),
        consultationDate: String(r.consultationDate || ''),
        consultationTime: String(r.consultationTime || ''),
        // 알 수 없는 구분이 들어와도 배지 톤이 깨지지 않게 첫 번째 구분으로 떨어뜨립니다.
        type: D.CONSULT_TYPES.indexOf(type) >= 0 ? type : D.CONSULT_TYPES[0],
        // status 가 없는 옛 레코드는 읽을 때 '진행중' 으로 채워집니다(자동 이행).
        status: D.CONSULT_STATUSES.indexOf(status) >= 0 ? status : D.CONSULT_STATUSES[0],
        memo: String(r.memo || ''),
        linkedWeddingEventId: String(r.linkedWeddingEventId || ''),
        createdBy: String(r.createdBy || ''),
        createdAt: String(r.createdAt || ''),
      };
    }

    /** 상담일 → 상담시간 순. 목록은 언제나 시간순으로 보입니다. */
    function sorted(list) {
      return list.slice().sort(function (a, b) {
        var x = a.consultationDate + ' ' + a.consultationTime;
        var y = b.consultationDate + ' ' + b.consultationTime;
        return x < y ? -1 : x > y ? 1 : 0;
      });
    }

    function read() {
      var parsed = lsRead(KEY);
      return sorted((Array.isArray(parsed) ? parsed : []).map(normalize));
    }

    return {
      list: function () { return lsRun(read); },

      /** 저장소가 아직 한 번도 쓰인 적 없을 때만 시연용 기록을 넣습니다. */
      seed: function (records) {
        return lsRun(function () {
          if (!lsUntouched(KEY)) return false;
          var now = nowIso();
          lsWrite(KEY, sorted(records.map(function (r, i) {
            return normalize(Object.assign({}, r, { id: 'cs-seed-' + i, createdAt: now }), i);
          })));
          return true;
        });
      },

      add: function (draft) {
        return lsRun(function () {
          var all = read();
          var now = nowIso();
          var record = normalize(Object.assign({}, draft, {
            id: 'cs-' + now.replace(/\D/g, '') + '-' + all.length,
            createdAt: now,
          }), all.length);
          lsWrite(KEY, sorted(all.concat([record])));
          return record;
        });
      },

      /** 상태 변경 · 예식 연결처럼 한 건의 칸만 고칠 때 씁니다. */
      update: function (id, patch) {
        return lsRun(function () {
          var all = read();
          var want = String(id);
          var at = -1;
          for (var i = 0; i < all.length; i++) if (all[i].id === want) { at = i; break; }
          if (at < 0) throw new Error('수정할 상담 기록을 찾지 못했습니다. 화면을 새로 불러와 주세요.');
          all[at] = normalize(Object.assign({}, all[at], patch), at);
          lsWrite(KEY, sorted(all));
          return all[at];
        });
      },

      /**
       * 예식이 지워질 때 그 예식을 가리키던 연결을 함께 끊습니다.
       * 상담 기록 자체는 남기고 연결 칸만 비웁니다(상담이 있었던 사실은 사라지지 않습니다).
       */
      unlinkEvent: function (weddingEventId) {
        return lsRun(function () {
          var all = read();
          var id = String(weddingEventId);
          var hit = all.filter(function (r) { return r.linkedWeddingEventId === id; });
          if (!hit.length) return [];
          lsWrite(KEY, all.map(function (r) {
            return r.linkedWeddingEventId === id
              ? Object.assign({}, r, { linkedWeddingEventId: '' })
              : r;
          }));
          return hit;
        });
      },

      /** 리스트에서 체크한 여러 건을 한 번에 지웁니다. */
      remove: function (ids) {
        return lsRun(function () {
          var all = read();
          var wanted = (Array.isArray(ids) ? ids : [ids]).map(String);
          var gone = all.filter(function (r) { return wanted.indexOf(r.id) >= 0; });
          if (!gone.length) throw new Error('삭제할 상담 기록을 찾지 못했습니다. 화면을 새로 불러와 주세요.');
          lsWrite(KEY, all.filter(function (r) { return wanted.indexOf(r.id) < 0; }));
          return gone;
        });
      },
    };
  })();

  /** 이력에 보관하는 최대 건수 — 저장 공간을 아끼려고 오래된 것부터 버립니다. */
  var LOG_LIMIT = 400;

  /**
   * 활동 이력(activity_logs).
   *
   * 지운 기록은 원본이 사라지므로 "무엇을 지웠는지"는 이 이력에만 남습니다.
   * 한 줄은 { tableName, recordId, action, staffName, detail, createdAt } 입니다.
   */
  var logStore = (function () {
    var KEY = 'wdc:v1:logs';

    function normalize(r, i) {
      r = r || {};
      return {
        id: String(r.id || 'log-' + i),
        tableName: String(r.tableName || ''),
        recordId: String(r.recordId || ''),
        action: String(r.action || ''),
        staffName: String(r.staffName || ''),
        detail: String(r.detail || ''),
        createdAt: String(r.createdAt || ''),
      };
    }

    function read() {
      var parsed = lsRead(KEY);
      return (Array.isArray(parsed) ? parsed : []).map(normalize);
    }

    return {
      list: function () { return lsRun(read); },

      /** 한 동작이 여러 기록을 건드릴 때(선택 삭제 등)를 위해 여러 줄을 함께 받습니다. */
      append: function (entries) {
        return lsRun(function () {
          var now = nowIso();
          var stamp = now.replace(/\D/g, '');
          var rows = entries.map(function (e, i) {
            return normalize(Object.assign({ createdAt: now }, e, { id: 'log-' + stamp + '-' + i }), i);
          });
          // 최신 것이 앞에 오게 쌓고, 넘치면 오래된 것부터 버립니다.
          return lsWrite(KEY, rows.concat(read()).slice(0, LOG_LIMIT));
        });
      },
    };
  })();

  /** 이력 화면에서 쓰는 이름표 */
  var LOG_TABLES = {
    wedding_events: '예식기본정보',
    checklist_items: '체크리스트 항목',
    notices: '공지사항',
    customers: '고객 · 예식',
    tastings: '시식 예약',
    vendors: '제휴업체',
    members: '회원 계정',
    consults: '상담 기록',
    staff: '직원 목록',
    tasting_candidates: '시식 일정 후보',
    consultations: '오늘 상담',
  };
  var LOG_ACTIONS = { created: '등록', updated: '수정', deleted: '삭제' };
  var LOG_ACTION_TONES = { created: 'green', updated: 'amber', deleted: 'rose' };

  /** EDIT_FORMS 의 kind → 이력에 적을 테이블 이름 */
  var EDIT_TABLES = {
    post: 'notices', customer: 'customers', tasting: 'tastings',
    vendor: 'vendors', member: 'members', consult: 'consults',
  };

  /**
   * 첫 방문에서만 들어가는 시연용 예식 한 건.
   * 고객 이름 · 연락처는 넣지 않고 날짜 · 시간 · 홀 · 별칭만 둡니다.
   */
  var SEED_EVENTS = [
    {
      date: '2026-05-16', time: '13:00', hall: '그랜드홀', alias: '5월 셋째 주 1부',
      checks: {},
      // groups 는 비워 두면 저장할 때 양식 사본이 자동으로 들어갑니다.
      files: cloneList(D.FILES),
      memos: [
        { author: '예약실', time: '2026. 2. 3', body: '식권 시안 최종본 수령 — 인쇄소 발주 전 최종 확인 필요' },
        { author: '예약실', time: '2026. 1. 30', body: '축가 반주 음원 도착. 음향팀에 사전 전달 완료' },
      ],
    },
  ];

  /**
   * 첫 방문에서만 들어가는 시연용 오늘 상담 세 건 — 홈 대시보드 "오늘 상담" 집계의 예시입니다.
   * 신랑신부 이름 · 연락처는 넣지 않고, 메모는 상담 내용만 한 줄로 둡니다.
   */
  var SEED_CONSULTATIONS = [
    { consultationDate: D.TODAY, consultationTime: '10:30', type: '워킹인', status: '진행중',
      memo: '가든홀 견적 안내 · 6월 예식 희망', createdBy: '홍길동 팀장' },
    // 계약완료인데 예식 연결이 아직 없는 건 — "연결 필요" 안내가 어떻게 보이는지 보여 줍니다.
    { consultationDate: D.TODAY, consultationTime: '13:00', type: '컨설팅', status: '계약완료',
      memo: '', createdBy: '김철수 주임' },
    { consultationDate: D.TODAY, consultationTime: '16:00', type: '컨설팅', status: '진행중',
      memo: '채플홀 9월 예식 문의 · 하객 200명 기준 재견적 요청', createdBy: '홍길동 팀장' },
  ];

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
    customerError: '',     // 고객 등록 오류 안내

    // 수기 등록하는 예식기본정보 (날짜 · 요일 · 시간 · 홀 · 별칭 — 개인정보 없음)
    events: [],            // 저장소에서 불러온 예식 목록
    eventId: '',           // 체크리스트에서 보고 있는 예식
    eventsLoading: true,   // 저장소에서 처음 불러오는 중
    eventsError: '',       // 불러오기 실패 안내
    eventForm: null,       // 등록 · 수정 폼 { mode, id, date, error, saving }
    itemForm: null,        // 체크리스트 항목 폼 { mode, groupId, id, error, saving }
    itemDelete: null,      // 항목 삭제 확인 { groupId, id, busy, error }
    eventDelete: null,     // 삭제 모달 { id, stage, whole, picked, error, busy }
    toast: null,           // 저장 결과 알림 { kind: 'ok' | 'error', text }

    // 작성자 수기 기록 — 로그인 계정(D.STAFF)과 완전히 별개입니다.
    staff: [],             // 작성자로 고를 수 있는 직원 목록
    staffError: '',        // 직원 목록 불러오기 · 추가 오류
    recorder: '',          // 폼 없는 즉시 반영 토글에 쓰는 기록 담당
    logs: [],              // 활동 이력
    showLogs: false,       // 활동 이력 모달

    // 시식 일정 후보 — 예약실이 제안하고 신랑신부가 공유 링크에서 확정합니다.
    candidates: [],        // 후보 전체
    candidatesError: '',   // 불러오기 실패 안내
    candError: '',         // 후보 추가 폼 오류
    candDate: '',          // 후보 추가 폼의 날짜 (달력)
    candPick: '',          // 신랑신부 화면에서 고른 후보 id
    candBusy: false,       // 저장 중

    // 오늘 상담 기록 — 계약 전 단계의 상담 건수만 가볍게 남깁니다(고객 등록과 별개).
    consultations: [],         // 상담 기록 전체
    consultationsError: '',    // 불러오기 실패 안내
    consultError: '',          // 등록 폼 오류
    consultDate: D.TODAY,      // 등록 폼의 상담일 (기본값 오늘)
    consultType: D.CONSULT_TYPES[0],  // 등록 폼의 상담 구분
    consultOpen: {},           // 메모를 펼쳐 둔 기록 id
    consultPicked: {},         // 인라인 삭제로 고른 기록 id
    consultBusy: false,        // 저장 · 삭제 중

    // 예식 연결 — 계약완료 상담을 예식(wedding_events)에 잇는 인라인 영역
    consultLink: '',           // 연결 영역을 펼쳐 둔 상담 id
    consultLinkTab: 'existing',// 'existing' 기존 예식 연결 · 'new' 새 예식 등록
    consultLinkSearch: '',     // 기존 예식 검색어
    consultLinkDate: '',       // 새 예식 미니폼의 예식 예정일 (요일 자동 계산용)
    consultLinkAlias: '',      // 새 예식 미니폼의 별칭 초기값 (상담 메모에서 가져옵니다)
    consultLinkError: '',      // 연결 · 미니폼 오류
    consultLinkBusy: false,    // 연결 저장 중
    consultPreview: '',        // 연결된 예식 미리보기 모달 대상 상담 id

    editing: null,     // 수정 모달 대상 { kind, id }
    deleting: null,    // 삭제 확인 모달 대상 { kind, id }
    editError: '',     // 수정 모달 오류 안내
    postError: '',     // 게시글 작성 오류 안내

    filter: '전체',
    search: '',
    boardFilter: '전체',
    stage: '계약완료',

    wedding: '2026-05-16',   // 신규 등록 화면의 예식일 (D-Day 자동 계산용)
    tastingDate: '',         // 신규 등록 화면의 시식일 (비우면 미정)

    tastingDone: true,
    myTastingConfirmed: false,

    showShare: false,
    showMobile: false,
    copied: false,
  };

  var root = null;

  /** 다시 그릴 때 이전 입력값이 되살아나지 않도록 data-keep 칸을 비웁니다. */
  function clearKept(keys) {
    keys.forEach(function (key) {
      var el = root.querySelector('[data-keep="' + key + '"]');
      if (el) el.value = '';
    });
  }

  function setState(patch) {
    Object.assign(state, patch);
    render();
  }

  /* ================================================== 파생 데이터 ==== */

  /**
   * 체크 상태는 보고 있는 예식에 붙습니다. 등록된 예식이 없을 때만
   * 예식과 무관한 state.checks 로 떨어집니다.
   */
  function isItemDone(item) {
    var ev = selectedEvent();
    var checks = ev ? ev.checks : state.checks;
    return item.id in checks ? checks[item.id] : item.done;
  }

  /* ---- 예식기본정보 ---- */

  function eventById(id) {
    return state.events.find(function (r) { return r.id === id; }) || null;
  }

  /** 지금 보고 있는 예식. 고른 예식이 사라졌으면 첫 번째로 떨어집니다. */
  function selectedEvent() {
    return eventById(state.eventId) || state.events[0] || null;
  }

  /** '2026-05-16' → '토'. 잘못된 날짜면 빈 문자열입니다. */
  function weekdayOf(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return '';
    var d = new Date(iso + 'T00:00:00');
    return isNaN(d) ? '' : WEEKDAYS[d.getDay()];
  }

  /** 예식 한 건의 표시 이름. 이름 없이 날짜 · 시간 · 홀로만 가리킵니다. */
  function eventLabel(ev) {
    if (!ev) return '예식 미지정';
    return formatEventDate(ev.date, ev.time) + ' · ' + (ev.hall || '홀 미정');
  }

  /**
   * 별칭에 개인정보로 보이는 값이 섞이는 것을 막습니다.
   * (이름 · 연락처 · 금액은 설계상 저장하지 않는 값입니다)
   */
  var PII_PATTERNS = [
    { re: /\d{2,4}\s*-\s*\d{3,4}\s*-\s*\d{4}/, what: '연락처' },
    { re: /\d{9,}/, what: '연락처' },
    { re: /[\w.+-]+@[\w-]+\.[\w.]+/, what: '이메일' },
    { re: /\d{1,3}(,\d{3}){2,}/, what: '금액' },
  ];

  function piiReason(text) {
    var value = String(text || '');
    for (var i = 0; i < PII_PATTERNS.length; i++) {
      if (PII_PATTERNS[i].re.test(value)) return PII_PATTERNS[i].what;
    }
    return '';
  }

  /**
   * 화면에 그릴 체크리스트 구조의 단일 창구.
   * 예식을 고르면 그 예식의 사본을, 등록된 예식이 없으면 양식 원본을 보여 줍니다.
   */
  function checklistGroups() {
    var ev = selectedEvent();
    return ev && ev.groups.length ? ev.groups : D.CHECKLIST;
  }

  function checklistGroupById(id) {
    return checklistGroups().find(function (g) { return g.id === id; }) || null;
  }

  function checklistItem(groupId, itemId) {
    var g = checklistGroupById(groupId);
    if (!g) return null;
    return g.items.find(function (it) { return it.id === itemId; }) || null;
  }

  /** 체크리스트 전체 항목을 한 줄로 편 목록 */
  function allChecklistItems() {
    return checklistGroups().reduce(function (acc, g) { return acc.concat(g.items); }, []);
  }

  /**
   * 이 예식에서 완료로 표시된 항목 수.
   * 양식 기본값(done)에 예식별 체크(ev.checks)를 덮어쓴 결과를 셉니다.
   */
  function eventDoneCount(ev) {
    if (!ev) return 0;
    return ev.groups.reduce(function (acc, g) { return acc.concat(g.items); }, [])
      .filter(function (it) { return it.id in ev.checks ? ev.checks[it.id] : it.done; })
      .length;
  }

  /**
   * 완료 기록을 지울 때 저장하는 값.
   * 빈 객체로 두면 양식 기본값(기본 완료 15항목)이 되살아나므로
   * 모든 항목을 미완료로 명시해 둡니다.
   */
  function clearedChecks(ev) {
    var out = {};
    if (ev) {
      ev.groups.forEach(function (g) {
        g.items.forEach(function (it) { out[it.id] = false; });
      });
    }
    return out;
  }

  /**
   * 예식에 딸린 하위 항목 목록. 삭제 모달에서 체크박스로 하나씩 고릅니다.
   * key 는 'checks' · 'file:<index>' · 'memo:<index>' 형식입니다.
   */
  function eventSubItems(ev) {
    if (!ev) return [];
    var out = [];
    var doneCount = eventDoneCount(ev);
    if (doneCount) {
      out.push({ key: 'checks', label: '체크리스트 완료 기록', note: doneCount + '개 항목 완료 표시' });
    }
    ev.files.forEach(function (f, i) {
      out.push({ key: 'file:' + i, label: '첨부파일 · ' + f.name, note: f.meta });
    });
    ev.memos.forEach(function (m, i) {
      out.push({ key: 'memo:' + i, label: '스태프 메모 · ' + firstLine(m.body), note: m.author + ' · ' + m.time });
    });
    return out;
  }

  /* ---- 저장 결과 알림(토스트) ---- */

  var toastTimer = null;

  /** setState 패치에 넣을 토스트 객체를 만들고, 잠시 뒤 스스로 사라지게 겁니다. */
  function toast(kind, text) {
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastTimer = null;
      setState({ toast: null });
    }, 3600);
    return { kind: kind, text: text };
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

  /** ISO 저장 시각 → '2026. 2. 10 14:03' (마지막 저장 표시용) */
  function formatStamp(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '알 수 없음';
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate()
      + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /** 두 날짜의 일수 차 (to - from). 잘못된 입력이면 null. */
  function dayGap(fromIso, toIso) {
    var from = new Date(fromIso + 'T00:00:00');
    var to = new Date(toIso + 'T00:00:00');
    if (isNaN(from) || isNaN(to)) return null;
    return Math.round((to - from) / 86400000);
  }

  /**
   * 신규 등록 화면의 시식 일정 자동 계산 문구.
   * 예식일 D-Day 와 같은 방식으로, 고른 날짜에서 요일과 예식까지 남은 날을 계산합니다.
   * 시식이 아직 안 잡히는 경우가 많아 날짜를 비워 두면 미정입니다.
   */
  function tastingSummary() {
    if (!state.tastingDate) {
      return { text: '미정', note: '날짜를 비워 두면 미정으로 저장됩니다', warn: '' };
    }
    if (!weekdayOf(state.tastingDate)) {
      return { text: '날짜 확인 필요', note: '시식일을 다시 골라 주세요', warn: '' };
    }

    var gap = weekdayOf(state.wedding) ? dayGap(state.tastingDate, state.wedding) : null;
    var rel = '';
    if (gap != null) {
      rel = gap === 0 ? '예식 당일' : gap > 0 ? '예식 ' + gap + '일 전' : '예식 ' + -gap + '일 후';
    }
    return {
      text: formatEventDate(state.tastingDate, ''),
      note: rel,
      warn: gap != null && gap < 0 ? '시식일이 예식일보다 뒤입니다 — 예식 전으로 골라 주세요' : '',
    };
  }

  function ddayLabel(days) {
    if (days == null) return '날짜를 입력해 주세요';
    if (days === 0) return 'D-DAY';
    return days > 0 ? 'D-' + days : 'D+' + -days;
  }

  function derive() {
    var items = allChecklistItems();
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

  /* ================================= 작성자 (수기 기록) 공통 조각 ==== */

  /**
   * 작성자 드롭다운.
   *
   * 기록마다 사람이 직접 골라야 하므로 **항상 빈 값으로 시작**하고,
   * 로그인 계정(D.STAFF)에서는 절대 채우지 않습니다.
   * 목록에서만 고를 수 있어 이름 오타가 기록에 남지 않습니다.
   *
   * 폼이 닫히면 이 select 도 사라지므로, 다시 열 때 값이 되살아나지 않습니다.
   */
  function authorField(key, note) {
    if (state.staff.length === 0) {
      return h`
        <div class="authorfield--empty" role="alert">
          <span class="authorfield__warn">작성자로 고를 직원이 없습니다. 설정에서 직원을 먼저 추가해 주세요.</span>
          <button type="button" class="btn btn--xs btn--outline" data-action="go" data-value="settings">설정 열기</button>
        </div>`;
    }

    return h`
      <label class="field authorfield">작성자 <span class="field__req">필수</span>
        <select class="select" data-keep="${key}" data-focus-key="${key}">
          <option value="">작성자 선택</option>
          ${state.staff.map(function (s) { return h`<option>${s.name}</option>`; })}
        </select>
        <span class="field__hint">${note || '로그인 계정과 별개로, 이 기록을 남기는 사람을 고릅니다.'}</span>
      </label>`;
  }

  function readAuthor(key) {
    var el = root.querySelector('[data-keep="' + key + '"]');
    return el ? String(el.value || '').trim() : '';
  }

  /** 목록에 없는 이름은 받지 않습니다(오타 · 임의 입력 방지). */
  function knownStaff(name) {
    return !!name && state.staff.some(function (s) { return s.name === name; });
  }

  /** 통과하면 빈 문자열, 아니면 안내 문구를 돌려줍니다. */
  function authorProblem(name) {
    if (state.staff.length === 0) return '설정에서 직원을 먼저 추가해 주세요.';
    if (!name) return '작성자를 골라 주세요.';
    if (!knownStaff(name)) return '등록된 직원 목록에서 골라 주세요.';
    return '';
  }

  /**
   * 폼이 없는 즉시 반영 토글(체크 · 완료 · 참석 · 상태)에 쓰는 기록 담당.
   * 사이드바에서 사람이 직접 고르며, 비어 있으면 그 토글들이 막힙니다.
   */
  function recorderProblem() {
    if (state.staff.length === 0) return '설정에서 직원을 먼저 추가해 주세요.';
    if (!state.recorder) return '사이드바에서 기록 담당을 먼저 골라 주세요.';
    if (!knownStaff(state.recorder)) return '기록 담당을 다시 골라 주세요.';
    return '';
  }

  function nowIso() { return new Date().toISOString(); }

  /**
   * 활동 이력 남기기. 본 작업이 성공한 뒤에 부릅니다.
   * 이력 저장이 실패해도 본 작업을 되돌리지는 않고 알림만 띄웁니다.
   */
  function logActivity(entries) {
    var rows = (Array.isArray(entries) ? entries : [entries]).filter(Boolean);
    if (!rows.length) return Promise.resolve([]);
    return logStore.append(rows).then(function (all) {
      setState({ logs: all });
      return all;
    }).catch(function (err) {
      setState({ toast: toast('error', '활동 이력을 남기지 못했습니다. ' + (err.message || '')) });
      return [];
    });
  }

  /** '최종 수정 홍길동 팀장 · 2026. 8. 19 14:03' — 남은 정보가 없으면 빈 문자열 */
  function lastEditLine(record) {
    if (!record) return '';
    var who = record.updatedBy || record.createdBy || '';
    var when = record.updatedAt ? formatStamp(record.updatedAt) : '';
    if (!who && !when) return '';
    return '최종 수정 ' + (who || '작성자 미기록') + (when ? ' · ' + when : '');
  }

  function loadStaff() {
    return staffStore.list().then(function (list) {
      setState({ staff: list, staffError: '' });
      return list;
    }).catch(function (err) {
      setState({ staff: [], staffError: err.message || '직원 목록을 불러오지 못했습니다.' });
      return [];
    });
  }

  function loadLogs() {
    return logStore.list().then(function (list) {
      setState({ logs: list });
      return list;
    }).catch(function () { return []; });
  }

  /* ================================= 시식 일정 후보 공통 조각 ==== */

  /** '2026. 8. 21 (금) 11:00' */
  function candidateLabel(r) {
    if (!r) return '';
    return formatEventDate(r.candidateDate, r.candidateTime);
  }

  function candidatesFor(weddingEventId) {
    var id = String(weddingEventId);
    return state.candidates.filter(function (r) { return r.weddingEventId === id; });
  }

  function confirmedCandidate(weddingEventId) {
    return candidatesFor(weddingEventId).find(function (r) { return r.isConfirmed; }) || null;
  }

  /**
   * '2026. 5. 16 (토) 13:00' → '2026-05-16'.
   * 고객 레코드의 예식일은 사람이 읽는 문자열이라, 날짜 비교를 위해 되돌립니다.
   */
  function isoFromLabel(text) {
    var m = String(text || '').match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
    if (!m) return '';
    var pad = function (n) { return (n.length < 2 ? '0' : '') + n; };
    return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
  }

  function loadCandidates() {
    return candidateStore.list().then(function (list) {
      setState({ candidates: list, candidatesError: '' });
      return list;
    }).catch(function (err) {
      setState({ candidates: [], candidatesError: err.message || '시식 후보를 불러오지 못했습니다.' });
      return [];
    });
  }

  /**
   * 시식 일정 제안 (예약실 측).
   * 후보를 여러 개 올리고, 신랑신부가 공유 링크에서 고른 결과를 여기서 확인합니다.
   */
  function tastingCandidateCard(c) {
    var rows = candidatesFor(c.id);
    var confirmed = rows.find(function (r) { return r.isConfirmed; }) || null;
    var busy = new Safe(state.candBusy ? 'disabled' : '');
    var stateTone = confirmed ? 'tone-green' : rows.length ? 'tone-amber' : 'tone-neutral';

    return h`
      <section class="card">
        <header class="card__head">
          <h2 class="card__title">시식 일정 제안</h2>
          <span class="tag tag--sq ${stateTone}">
            ${confirmed ? '확정 완료' : rows.length ? '확정 대기중' : '후보 없음'}</span>
        </header>

        ${confirmed ? h`
          <div class="cand-confirmed">
            <div class="cand-confirmed__label">시식 확정</div>
            <div class="cand-confirmed__when">${candidateLabel(confirmed)}</div>
            <div class="cand-confirmed__meta">신랑신부가 공유 링크에서 확정${confirmed.confirmedAt ? ' · ' + formatStamp(confirmed.confirmedAt) : ''}</div>
            ${confirmed.changedFrom ? h`
              <div class="cand-changed" role="status">
                신랑신부가 일정을 바꿨습니다 — 이전 ${confirmed.changedFrom}
              </div>` : ''}
          </div>` : ''}

        ${state.candidatesError ? h`
          <div class="evinfo__error" role="alert" style="margin:16px 20px">
            <p class="evinfo__error-text">${state.candidatesError}</p>
            <button type="button" class="btn btn--outline btn--sm" data-action="cand-retry">다시 불러오기</button>
          </div>` : ''}

        <div>
          ${rows.length === 0
            ? h`<p class="empty">올린 후보가 없습니다. 아래에서 날짜 · 시간을 추가해 공유 링크로 보내세요.</p>`
            : rows.map(function (r) {
                return h`
                  <div class="cand${r.isConfirmed ? ' cand--on' : ''}">
                    <span class="cand__mark" aria-hidden="true">${r.isConfirmed ? '✓' : ''}</span>
                    <div class="cand__body">
                      <div class="cand__when">${candidateLabel(r)}</div>
                      <div class="cand__meta">${r.createdBy ? '제안 ' + r.createdBy : '제안자 미기록'}${r.isConfirmed ? ' · 신랑신부 확정' : ''}</div>
                    </div>
                    <button type="button" class="btn btn--xs btn--danger"
                      data-action="cand-remove" data-value="${r.id}" ${busy}>삭제</button>
                  </div>`;
              })}
        </div>

        <form class="candform" data-action="cand-add">
          <div class="candform__grid">
            <label class="field">후보 날짜 <span class="field__req">필수</span>
              <input class="input" type="date" value="${state.candDate}"
                data-action="set-cand-date" data-focus-key="cand-date" ${busy}></label>
            <label class="field">요일
              <input class="input input--locked" type="text" readonly tabindex="-1"
                value="${weekdayOf(state.candDate) ? weekdayOf(state.candDate) + '요일' : '날짜 선택 시 자동'}"
                aria-label="요일 (후보 날짜에서 자동 계산)"></label>
            <label class="field">후보 시간 <span class="field__req">필수</span>
              <input class="input" type="time" data-keep="cand-time" data-focus-key="cand-time" ${busy}></label>
          </div>

          ${authorField('cand-author', '이 후보를 제안하는 사람을 고릅니다.')}
          ${state.candError ? h`<p class="edit-form__error" role="alert">${state.candError}</p>` : ''}

          <div class="evform__actions">
            <span class="form-actions__note">후보는 여러 개 올릴 수 있습니다. 신랑신부가 공유 링크에서 하나를 고릅니다.</span>
            <button type="submit" class="btn btn--primary btn--sm" ${busy}>
              ${state.candBusy ? '저장 중…' : '＋ 후보 추가'}</button>
          </div>
        </form>
      </section>`;
  }

  /**
   * 시식 일정 후보 (신랑신부 측 · 공유 링크 화면).
   * 로그인 없이 링크로 들어와 후보 하나를 고르고 확정합니다.
   * 확정 뒤에도 다시 고를 수 있고, 바꾸면 예약실 화면에 변경 알림이 뜹니다.
   */
  function mobileCandidateCard(c) {
    var rows = candidatesFor(c.id);
    if (rows.length === 0) {
      return h`
        <div class="m-card">
          <div class="m-cand__empty">예약실에서 시식 가능일 후보를 보내면 이 카드에 표시됩니다.</div>
        </div>`;
    }

    var confirmed = rows.find(function (r) { return r.isConfirmed; }) || null;
    // 고른 값이 없거나 사라졌으면 확정된 후보를 기본 선택으로 둡니다.
    var picked = rows.some(function (r) { return r.id === state.candPick; })
      ? state.candPick
      : (confirmed ? confirmed.id : '');
    var same = !!confirmed && picked === confirmed.id;

    return h`
      <div class="m-card m-cand">
        <div class="m-tasting__top">
          <span class="tag tag--xs ${confirmed ? 'tone-green' : 'tone-amber'}">
            ${confirmed ? '확정 완료' : '선택 대기'}</span>
          <span class="m-tasting__place">후보 ${rows.length}개</span>
        </div>

        ${confirmed ? h`<div class="m-tasting__when">${candidateLabel(confirmed)}</div>` : ''}

        <div class="m-cand__hint">${confirmed
          ? '확정된 일정입니다. 바꾸시려면 다른 날짜를 골라 다시 확정해 주세요 — 예약실에 변경이 알려집니다.'
          : '가능한 날짜 하나를 골라 주세요.'}</div>

        <div class="m-cand__list" role="radiogroup" aria-label="시식 일정 후보">
          ${rows.map(function (r) {
            var on = r.id === picked;
            return h`
              <button type="button" class="m-cand__row${on ? ' m-cand__row--on' : ''}"
                role="radio" aria-checked="${on}" data-action="cand-pick" data-value="${r.id}">
                <span class="m-cand__dot" aria-hidden="true">${on ? '●' : ''}</span>
                <span class="m-cand__when">${candidateLabel(r)}</span>
                ${r.isConfirmed ? h`<span class="tag tag--xs tone-green">확정</span>` : ''}
              </button>`;
          })}
        </div>

        <button type="button" class="btn ${same ? 'btn--outline' : 'btn--primary'}"
          data-action="cand-confirm" data-value="${picked}"
          ${new Safe(!picked || same || state.candBusy ? 'disabled' : '')}>
          ${state.candBusy ? '저장 중…' : same ? '이미 확정된 일정입니다' : '이 날짜로 확정'}
        </button>
      </div>`;
  }

  /* ================================= 오늘 상담 기록 공통 조각 ==== */

  /** '10:30 · 워킹인' — 리스트 · 알림 · 활동 이력이 같은 표기를 씁니다. */
  function consultLabel(r) {
    if (!r) return '';
    return (r.consultationTime || '시간 미정') + ' · ' + r.type;
  }

  /** 하루치 상담 기록. 저장소가 이미 상담일 · 상담시간 순으로 돌려줍니다. */
  function consultationsOn(iso) {
    return state.consultations.filter(function (r) { return r.consultationDate === iso; });
  }

  /**
   * 앱이 "오늘"로 보는 날짜(D.TODAY) 기준 상담 기록.
   * 홈 대시보드의 "오늘 상담" 건수 · 시간 목록과 오늘 상담 리스트가 같은 값을 씁니다.
   */
  function todayConsultations() {
    return consultationsOn(D.TODAY);
  }

  /** 예식 연결은 계약완료 상담에서만 다룹니다. */
  function isConsultDone(r) {
    return !!r && r.status === '계약완료';
  }

  function consultById(id) {
    return state.consultations.find(function (r) { return r.id === id; }) || null;
  }

  /** 상담에 연결된 예식. 연결이 없거나 그 예식이 지워졌으면 null 입니다. */
  function linkedEventOf(r) {
    return r && r.linkedWeddingEventId ? eventById(r.linkedWeddingEventId) : null;
  }

  /**
   * 계약완료로 표시했지만 아직 예식과 잇지 않은 상담.
   * 실적 대시보드의 "연결 필요" 와 상담 카드의 안내가 같은 값을 씁니다.
   */
  function consultsNeedingLink() {
    return state.consultations.filter(function (r) {
      return isConsultDone(r) && !linkedEventOf(r);
    });
  }

  /**
   * 예식 검색 — 예식일자 · 요일 · 예식시간 · 홀 · 별칭으로 찾습니다.
   * 고객 검색과 같은 방식으로 기호를 떼어내 "5.16" · "5/16" 이 모두 걸리게 합니다.
   */
  function matchesEvent(ev, query) {
    var strip = function (v) { return String(v).replace(/[\s\-().·/]/g, '').toLowerCase(); };
    var hay = strip([formatEventDate(ev.date, ev.time), weekdayOf(ev.date), ev.hall, ev.alias].join(' '));
    // 여러 낱말을 적으면 모두 들어 있어야 합니다 — "5.16 그랜드홀" 처럼 띄어 적어도 찾힙니다.
    var terms = String(query || '').trim().split(/\s+/).map(strip).filter(Boolean);
    return terms.every(function (t) { return hay.indexOf(t) !== -1; });
  }

  /** 체크해 둔 기록 중 오늘 목록에 남아 있는 것만 (지워진 id 가 남지 않도록) */
  function pickedConsultations() {
    return todayConsultations().filter(function (r) { return state.consultPicked[r.id]; });
  }

  function loadConsultations() {
    return consultStore.list().then(function (list) {
      setState({ consultations: list, consultationsError: '' });
      return list;
    }).catch(function (err) {
      setState({
        consultations: [],
        consultationsError: err.message || '상담 기록을 불러오지 못했습니다.',
      });
      return [];
    });
  }

  /** '2. 9 (월)' — 오늘이 아닌 날짜 기록을 보여줄 때만 앞에 붙입니다(연도는 뗍니다). */
  function consultDateLabel(r) {
    return formatEventDate(r.consultationDate, '').replace(/^\d{4}\.\s*/, '');
  }

  /**
   * 예식 연결 영역 (인라인).
   *
   * 상담 상태가 계약완료일 때만 열리고, 연결 · 새 예식 등록까지 모두 이 자리에서 끝납니다
   * (화면 이동 없음). 두 갈래로 나뉩니다.
   *   기존 예식과 연결  등록된 예식을 예식일 · 요일 · 시간 · 홀로 찾아 고릅니다.
   *   새 예식으로 등록  최소 칸만 받아 예식을 만들고 곧바로 이 상담에 잇습니다.
   *
   * 폼이 열려 있어도 즉시 반영되는 기록이라 작성자는 사이드바 기록 담당을 씁니다.
   */
  function consultLinkPanel(r) {
    var tab = state.consultLinkTab === 'new' ? 'new' : 'existing';
    var busy = new Safe(state.consultLinkBusy ? 'disabled' : '');
    var linked = linkedEventOf(r);
    var matches = state.events.filter(function (ev) { return matchesEvent(ev, state.consultLinkSearch); });

    var existing = h`
      <div class="conlink__body">
        <input class="input input--sm input--search" type="search"
          placeholder="예식일 · 요일 · 시간 · 홀 검색 (예: 5.16 토 그랜드홀)"
          aria-label="연결할 예식 검색" value="${state.consultLinkSearch}"
          data-action="consult-link-search" data-focus-key="consult-link-search" ${busy}>

        <div class="conlink__list">
          ${state.eventsLoading
            ? h`<p class="empty">예식 목록을 불러오는 중입니다…</p>`
            : state.events.length === 0
              ? h`<p class="empty">등록된 예식이 없습니다. <strong>새 예식으로 등록</strong> 탭에서 바로 만들 수 있습니다.</p>`
              : matches.length === 0
                ? h`<p class="empty">검색과 맞는 예식이 없습니다.</p>`
                : matches.map(function (ev) {
                    var same = !!linked && linked.id === ev.id;
                    return h`
                      <div class="conlink__row${same ? ' conlink__row--on' : ''}">
                        <div class="conlink__row-body">
                          <div class="conlink__when">${eventLabel(ev)}</div>
                          <div class="conlink__meta">${ev.alias ? '별칭 ' + ev.alias + ' · ' : ''}체크리스트 ${eventDoneCount(ev)}개 완료</div>
                        </div>
                        <button type="button" class="btn btn--xs ${same ? 'btn--outline' : 'btn--primary'}"
                          data-action="consult-link-pick" data-value="${ev.id}"
                          ${new Safe(same || state.consultLinkBusy ? 'disabled' : '')}>
                          ${same ? '연결됨' : '이 예식으로 연결'}</button>
                      </div>`;
                  })}
        </div>
      </div>`;

    var weekday = weekdayOf(state.consultLinkDate);
    var fresh = h`
      <form class="conlink__body" data-action="consult-link-new"${state.consultLinkBusy ? new Safe(' aria-busy="true"') : ''}>
        <div class="candform__grid">
          <label class="field">예식 예정일 <span class="field__req">필수</span>
            <input class="input" type="date" value="${state.consultLinkDate}"
              data-action="set-consult-link-date" data-focus-key="conlink-date" ${busy}>
          </label>

          <label class="field">요일
            <input class="input input--locked" type="text" readonly tabindex="-1"
              value="${weekday ? weekday + '요일' : '예식 예정일 선택 시 자동'}"
              aria-label="요일 (예식 예정일에서 자동 계산)">
          </label>

          <label class="field">예식시간 <span class="field__req">필수</span>
            <input class="input" type="time" data-keep="conlink-time" data-focus-key="conlink-time" ${busy}>
          </label>

          <label class="field">홀 <span class="field__req">필수</span>
            <select class="select" data-keep="conlink-hall" data-focus-key="conlink-hall" ${busy}>
              <option value="">홀 선택</option>
              ${D.HALLS.map(function (o) { return h`<option>${o}</option>`; })}
            </select>
          </label>

          <label class="field candform__wide">별칭
            <input class="input" type="text" maxlength="30" value="${state.consultLinkAlias}"
              data-keep="conlink-alias" data-focus-key="conlink-alias" ${busy}>
            <span class="field__hint">상담 메모에서 가져온 초기값입니다. 고객 이름 · 연락처는 저장하지 않습니다.</span>
          </label>
        </div>

        <p class="conlink__carry">상담 구분 <strong>${r.type}</strong>${r.memo ? ' · 메모' : ''}는
          새 예식의 스태프 메모로 함께 넘어갑니다.</p>

        <div class="evform__actions">
          <span class="form-actions__note">등록과 동시에 이 상담에 연결됩니다. 화면은 그대로 유지됩니다.</span>
          <button type="submit" class="btn btn--primary btn--sm" ${busy}>
            ${state.consultLinkBusy ? '저장 중…' : '＋ 등록하고 연결'}</button>
        </div>
      </form>`;

    return h`
      <div class="conlink">
        <div class="conlink__head">
          <span class="conlink__title">예식 연결</span>
          <span class="conlink__sub">${linked
            ? '지금 연결된 예식 · ' + eventLabel(linked)
            : consultDateLabel(r) + ' ' + consultLabel(r) + ' 상담 — 이어질 예식을 고릅니다'}</span>
          <button type="button" class="btn btn--xs btn--outline" data-action="consult-link-close" ${busy}>닫기</button>
        </div>

        <div class="conlink__tabs" role="group" aria-label="예식 연결 방법">
          <button type="button" class="chip chip--pill" data-action="consult-link-tab" data-value="existing"
            aria-pressed="${tab === 'existing'}" ${busy}>기존 예식과 연결</button>
          <button type="button" class="chip chip--pill" data-action="consult-link-tab" data-value="new"
            aria-pressed="${tab === 'new'}" ${busy}>새 예식으로 등록</button>
        </div>

        ${tab === 'existing' ? existing : fresh}

        ${state.consultLinkError ? h`<p class="edit-form__error" role="alert">${state.consultLinkError}</p>` : ''}

        <p class="conlink__note">연결 · 해제는 사이드바 <strong>기록 담당</strong> 이름으로 활동 이력에 남습니다.
          예식은 예식일자 · 요일 · 예식시간 · 홀로만 구분합니다.</p>
      </div>`;
  }

  /**
   * 상담 기록 한 줄. "10:30 · 워킹인" 형태이고, 메모가 있는 줄만 눌러서 펼칩니다.
   * 왼쪽 체크박스는 인라인 삭제로 고르는 칸입니다(다른 목록의 삭제 체크박스와 같은 조작).
   *
   * opts.showDate     오늘이 아닌 기록이라 상담일을 함께 보여 줍니다.
   * opts.selectable   false 면 삭제 체크박스를 두지 않습니다(연결 필요 목록).
   */
  function consultRow(r, opts) {
    var o = opts || {};
    var selectable = o.selectable !== false;
    var on = selectable && !!state.consultPicked[r.id];
    var open = !!state.consultOpen[r.id];
    var linked = linkedEventOf(r);
    var panelOpen = state.consultLink === r.id && isConsultDone(r);
    var head = h`
      ${o.showDate ? h`<span class="consult-row__date">${consultDateLabel(r)}</span>` : ''}
      <span class="consult-row__when">${r.consultationTime || '시간 미정'}</span>
      <span class="consult-row__sep" aria-hidden="true">·</span>
      <span class="tag tag--sq ${tone(r.type)}">${r.type}</span>`;

    return h`
      <div class="consult-row${on ? ' consult-row--on' : ''}${panelOpen ? ' consult-row--open' : ''}">
        ${selectable
          ? h`<button type="button" class="check check--sm" role="checkbox" aria-checked="${on}"
                aria-label="${consultLabel(r)} 삭제 대상으로 선택"
                data-action="consult-pick" data-value="${r.id}">${on ? '✓' : ''}</button>`
          : h`<span class="consult-row__spacer" aria-hidden="true"></span>`}

        ${r.memo
          ? h`<button type="button" class="consult-row__main consult-row__main--open"
                data-action="consult-toggle" data-value="${r.id}" aria-expanded="${open}">
                ${head}
                <span class="consult-row__memo-mark">${open ? '메모 접기' : '메모 보기'}</span>
              </button>`
          : h`<div class="consult-row__main">${head}</div>`}

        <div class="consult-row__side">
          <select class="select select--sm consult-row__status ${tone(r.status)}"
            data-action="consult-status" data-value="${r.id}"
            aria-label="${consultLabel(r)} 상담 상태 — 현재 ${r.status}">
            ${D.CONSULT_STATUSES.map(function (st) {
              return h`<option ${new Safe(st === r.status ? 'selected' : '')}>${st}</option>`;
            })}
          </select>

          ${linked
            ? h`<button type="button" class="linkbadge linkbadge--on" data-action="consult-preview-open"
                  data-value="${r.id}" aria-label="연결된 예식 보기 — ${eventLabel(linked)}">🔗 예식 연결됨</button>`
            : isConsultDone(r)
              ? h`<button type="button" class="linkbadge linkbadge--warn" data-action="consult-link-open"
                    data-value="${r.id}" aria-expanded="${panelOpen}">연결 필요</button>`
              : ''}

          <span class="consult-row__by">${r.createdBy || '작성자 미기록'}</span>
        </div>

        ${r.memo && open ? h`<p class="consult-row__memo">${r.memo}</p>` : ''}
        ${panelOpen ? consultLinkPanel(r) : ''}
      </div>`;
  }

  /**
   * 연결된 예식 미리보기. 배지를 누르면 열리고, 여기서 연결을 끊거나 바꿉니다.
   * 연결된 예식이 지워졌으면 그 사실을 알리고 다시 연결하도록 안내합니다.
   */
  function consultLinkModal() {
    if (!state.consultPreview) return '';
    var r = consultById(state.consultPreview);
    if (!r) return '';
    var ev = linkedEventOf(r);
    var busy = new Safe(state.consultLinkBusy ? 'disabled' : '');

    return h`
      <div class="overlay overlay--share" data-action="overlay-close" data-value="consult-preview">
        <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="conlink-title" data-stop>
          <div class="section-label">예식 연결</div>
          <h2 class="dialog__title" id="conlink-title">${consultDateLabel(r)} ${consultLabel(r)} 상담</h2>
          <p class="dialog__text">
            <span class="tag tag--sq ${tone(r.status)}">${r.status}</span>
            ${r.memo ? ' ' + r.memo : ' 메모 없음'}
          </p>

          ${ev
            ? h`<div class="evinfo__grid conlink__preview">
                  ${evCell('예식일자', ev.date)}
                  ${evCell('요일', weekdayOf(ev.date) ? weekdayOf(ev.date) + '요일' : '')}
                  ${evCell('예식시간', ev.time)}
                  ${evCell('홀', ev.hall)}
                  ${evCell('별칭', ev.alias)}
                </div>`
            : h`<p class="conlink__gone" role="alert">연결된 예식을 찾지 못했습니다. 예식이 지워졌다면 다시 연결해 주세요.</p>`}

          ${state.consultLinkError ? h`<p class="edit-form__error" role="alert">${state.consultLinkError}</p>` : ''}

          <div class="dialog__actions">
            <span class="form-actions__note">기록 담당 이름으로 남습니다.</span>
            <button type="button" class="btn btn--danger" data-action="consult-link-clear" ${busy}>
              ${state.consultLinkBusy ? '처리 중…' : '연결 해제'}</button>
            <button type="button" class="btn btn--outline" data-action="consult-link-change" ${busy}>연결 변경</button>
            <button type="button" class="btn btn--primary" data-action="consult-preview-close">닫기</button>
          </div>
        </div>
      </div>`;
  }

  /**
   * 오늘 상담 등록 · 목록 카드 (홈 대시보드).
   *
   * 목록은 앱이 오늘로 보는 날짜(D.TODAY) 기준 시간순이고, 등록 폼의 상담일도 그 날짜로
   * 시작합니다. 다른 날짜로 바꿔 등록하면 저장은 되지만 이 목록에는 오르지 않으므로
   * 저장 알림과 아래 안내 줄에서 몇 건이 다른 날짜에 있는지 함께 알려 줍니다.
   */
  function consultCard() {
    var rows = todayConsultations();
    var picked = pickedConsultations();
    var others = state.consultations.length - rows.length;
    var busy = new Safe(state.consultBusy ? 'disabled' : '');
    var allPicked = rows.length > 0 && picked.length === rows.length;

    // 계약완료인데 예식과 잇지 않은 건 — 오늘 목록 밖(다른 날짜)에 있으면 아래에 따로 보여 줍니다.
    var pending = consultsNeedingLink();
    var pendingOther = pending.filter(function (r) { return r.consultationDate !== D.TODAY; });

    return h`
      <section class="card consult mt-18">
        <header class="card__head">
          <h2 class="card__title">오늘 상담 기록</h2>
          <span class="card__note">워킹인 · 컨설팅 상담이 있었다는 사실만 남깁니다 — 고객 등록과 별개</span>
        </header>

        ${state.consultationsError ? h`
          <div class="evinfo__error" role="alert" style="margin:16px 20px">
            <p class="evinfo__error-text">${state.consultationsError}</p>
            <button type="button" class="btn btn--outline btn--sm" data-action="consult-retry">다시 불러오기</button>
          </div>` : ''}

        <div class="consult-head">
          <span class="consult-head__label">${D.TODAY_LABEL} · ${rows.length}건</span>
          ${rows.length ? h`
            <button type="button" class="btn-link" data-action="consult-pick-all">
              ${allPicked ? '전체 해제' : '전체 선택'}</button>` : ''}
          ${picked.length ? h`
            <button type="button" class="btn btn--xs btn--danger" data-action="consult-remove" ${busy}>
              ${state.consultBusy ? '삭제 중…' : '선택 ' + picked.length + '건 삭제'}</button>` : ''}
        </div>

        ${pending.length ? h`
          <p class="consult-warn" role="status">계약완료로 표시했지만 예식과 연결되지 않은 상담이
            ${pending.length}건 있습니다. 상태 옆 <strong>연결 필요</strong> 를 눌러 이 화면에서 바로 연결할 수 있습니다.</p>` : ''}

        <div>
          ${rows.length === 0
            ? h`<p class="empty">오늘 남긴 상담 기록이 없습니다. 아래에서 시간 · 구분만 골라 바로 등록할 수 있습니다.</p>`
            : rows.map(function (r) { return consultRow(r); })}
        </div>

        ${pendingOther.length ? h`
          <div class="consult-head consult-head--sub">
            <span class="consult-head__label">연결 필요 · 다른 날짜 ${pendingOther.length}건</span>
          </div>
          <div>
            ${pendingOther.map(function (r) {
              return consultRow(r, { showDate: true, selectable: false });
            })}
          </div>` : ''}

        ${others > 0 ? h`
          <p class="consult-note">다른 날짜로 남긴 기록 ${others}건은 여기 보이지 않습니다 — 이 목록은 오늘 기준입니다
            (연결이 필요한 건만 위에 함께 보여 줍니다).</p>` : ''}

        <form class="candform" data-action="consult-add"${state.consultBusy ? new Safe(' aria-busy="true"') : ''}>
          <div class="candform__grid">
            <label class="field">상담일 <span class="field__req">필수</span>
              <input class="input" type="date" value="${state.consultDate}"
                data-action="set-consult-date" data-focus-key="consult-date" ${busy}>
              <span class="field__hint">기본값은 오늘입니다. 지난 상담은 날짜를 바꿔 적습니다.</span>
            </label>

            <label class="field">상담시간 <span class="field__req">필수</span>
              <input class="input" type="time" data-keep="consult-time" data-focus-key="consult-time" ${busy}>
            </label>

            <div class="field">구분 <span class="field__req">필수</span>
              <div class="seg" role="radiogroup" aria-label="상담 구분">
                ${D.CONSULT_TYPES.map(function (t) {
                  var on = state.consultType === t;
                  return h`
                    <button type="button" class="seg__btn${on ? ' seg__btn--on' : ''}" role="radio"
                      aria-checked="${on}" data-action="consult-type" data-value="${t}" ${busy}>${t}</button>`;
                })}
              </div>
            </div>

            <label class="field candform__wide">메모 <span class="field__opt">선택</span>
              <input class="input" type="text" maxlength="100" placeholder="예: OO커플, 특이사항 등"
                data-keep="consult-memo" data-focus-key="consult-memo" ${busy}>
              <span class="field__hint">비워 두어도 등록됩니다. 연락처 · 이메일 · 금액은 저장하지 않습니다.</span>
            </label>
          </div>

          ${authorField('consult-author', '이 상담을 기록하는 사람을 고릅니다.')}
          ${state.consultError ? h`<p class="edit-form__error" role="alert">${state.consultError}</p>` : ''}

          <div class="evform__actions">
            <span class="form-actions__note">계약 전 상담 건수만 세는 기록입니다. 신랑신부 이름 · 연락처는 저장하지 않습니다.</span>
            <button type="submit" class="btn btn--primary btn--sm" ${busy}>
              ${state.consultBusy ? '저장 중…' : '＋ 상담 등록'}</button>
          </div>
        </form>
      </section>`;
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
          <div class="recorder">
            <label class="recorder__label" for="recorder-select">기록 담당</label>
            <select class="select select--sm" id="recorder-select" data-action="recorder-pick"
              aria-label="기록 담당 선택 (로그인 계정과 별개)">
              <option value="">선택 안 함</option>
              ${state.staff.map(function (st) {
                return h`<option ${new Safe(st.name === state.recorder ? 'selected' : '')}>${st.name}</option>`;
              })}
            </select>
            <p class="recorder__hint">체크 · 완료 토글처럼 폼이 없는 기록에 이 이름이 남습니다.
              로그인 계정과 별개입니다.</p>
          </div>

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
    // "오늘 상담"은 consultations 저장소에서 집계합니다 — 건수와 시간 목록이 함께 움직입니다.
    var todayRows = todayConsultations();
    var times = todayRows.map(function (r) { return r.consultationTime || '시간 미정'; }).join(' · ');

    var kpis = D.HOME_KPIS.map(function (k) {
      var patch = { accent: true };
      if (k.label === '오늘 상담') {
        patch.value = String(todayRows.length);
        patch.sub = state.consultationsError
          ? '집계를 불러오지 못했습니다'
          : (times || '등록된 상담 기록이 없습니다');
      }
      // "확인 안 한 게시글"은 게시판 상태와 같은 값이므로 함께 움직입니다.
      if (k.label === '확인 안 한 게시글') patch.value = String(d.openMemos);
      return Object.assign({}, k, patch);
    });

    return h`
      <div class="rise">
        <div class="page-head">
          <div>
            <div class="eyebrow-date">${D.TODAY_LABEL}</div>
            <h1 class="page-title page-title--lg" style="margin-top:8px">안녕하세요, ${D.STAFF.name}님</h1>
            <p class="page-sub">오늘 상담 ${todayRows.length}건, 시식 1건이 예정되어 있고 확인하지 않은 게시글이 ${d.openMemos}건 있습니다.</p>
          </div>
          <button type="button" class="btn btn--primary" data-action="go" data-value="new">＋ 고객 등록</button>
        </div>

        <div class="kpi-grid" style="margin-top:26px">${kpis.map(kpiCard)}</div>

        ${consultCard()}

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
          <button type="button" class="btn btn--primary" data-action="go" data-value="new">＋ 고객 등록</button>
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

    // 시식 콜아웃과 같은 형식(요일 포함)으로 맞춥니다.
    var ddayText = weddingDays == null
      ? '예식일을 입력해 주세요'
      : ddayLabel(weddingDays) + ' · ' + formatEventDate(state.wedding, '');

    var tasting = tastingSummary();
    var tastingWeekday = weekdayOf(state.tastingDate);

    return h`
      <div class="rise" style="max-width:880px">
        <button type="button" class="back-link" data-action="go" data-value="customers">← 고객 / 예식 관리</button>
        <h1 class="page-title">고객 등록</h1>
        <p class="page-sub">예식일과 시식일을 달력에서 고르면 요일과 남은 날이 자동 계산됩니다.
          체크리스트는 자동으로 만들지 않고 <strong>직접 적은 메모</strong>로 관리합니다.</p>

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

          <div class="section-label" style="margin-top:30px">시식 일정</div>
          <div class="form-grid-2">
            <label class="field">시식일
              <input class="input" type="date" value="${state.tastingDate}"
                data-action="set-tasting-date" data-focus-key="new-tasting-date">
              <span class="field__hint">비워 두면 미정으로 저장됩니다.</span></label>
            <label class="field">시식 요일
              <input class="input input--locked" type="text" readonly tabindex="-1"
                value="${tastingWeekday ? tastingWeekday + '요일' : '시식일 선택 시 자동'}"
                aria-label="시식 요일 (시식일에서 자동 계산)">
              <span class="field__hint">시식일에서 자동 계산됩니다.</span></label>
            <label class="field">시식 시간
              <input class="input" type="time" data-keep="new-tasting-time"
                data-focus-key="new-tasting-time"></label>
            <label class="field">시식장
              <select class="select" data-keep="new-tasting-place">
                <option value="">미정</option>
                ${D.TASTING_PLACES.map(function (o) { return h`<option>${o}</option>`; })}
              </select></label>
          </div>

          <div class="callouts">
            <div class="callout callout--rose">
              <div class="callout__label">예식 D-Day 자동 계산</div>
              <div class="callout__value">${ddayText}</div>
            </div>
            <div class="callout ${tasting.warn ? 'callout--warn' : 'callout--sage'}">
              <div class="callout__label">시식 일정 자동 계산</div>
              <div class="callout__value">${tasting.text}</div>
              ${tasting.warn
                ? h`<div class="callout__text">${tasting.warn}</div>`
                : tasting.note ? h`<div class="callout__text">${tasting.note}</div>` : ''}
            </div>
          </div>

          <div class="section-label" style="margin-top:30px">수기 메모</div>
          <div class="memo-fields">
            <label class="field">시식 특이사항 메모
              <textarea class="textarea" rows="4" data-keep="new-tasting"
                placeholder="예: 4명 (신부 부모님 채식 1인) · 유아용 의자 1개
날짜가 아직이면 — 3월 첫째 주 토요일 희망"></textarea></label>
            <label class="field">체크리스트 메모
              <textarea class="textarea" rows="4" data-keep="new-check"
                placeholder="예: 식전 영상 파일 재전달 안내
축가 반주 MR 수령 완료
폐백 생략 확인"></textarea></label>
          </div>
          <p class="memo-fields__hint">두 메모는 형식 제한이 없습니다. 위에서 고른 시식 일정 아래에 그대로 붙어 저장되고,
            상세에서 언제든 고칠 수 있습니다. 비워 두면 <strong>미정</strong>으로 표시됩니다.</p>

          ${authorField('new-author')}
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
          <p class="empty">등록된 예식이 없습니다. 고객을 등록하면 이 화면이 다시 채워집니다.</p>
        </div>
      </div>`;
  }

  function detailView(d) {
    var c = d.customer;
    if (!c) return emptyCustomerView('고객 상세');
    var stats = [
      { label: '예식까지', value: c.dday },
      { label: '체크리스트', value: d.pctFor(c) + '% 완료' },
      // 시식은 신랑신부가 확정한 일정이 있으면 그걸 먼저 보여 주고,
      // 없으면 수기 메모의 첫 줄로 떨어집니다.
      confirmedCandidate(c.id)
        ? { label: '시식 확정', value: candidateLabel(confirmedCandidate(c.id)) }
        : { label: '시식 일정', value: candidatesFor(c.id).length
              ? '확정 대기중 · 후보 ' + candidatesFor(c.id).length + '개'
              : (firstLine(c.tasting) || '미정') },
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

            ${tastingCandidateCard(c)}

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

  /* ==================================== 예식기본정보 (수기 등록 · 수정) ==== */

  /** 읽기 모드의 정보 한 칸. 비어 있으면 '미입력'으로 표시합니다. */
  function evCell(label, value) {
    return h`
      <div class="evinfo__cell">
        <div class="evinfo__label">${label}</div>
        <div class="evinfo__value${value ? '' : ' evinfo__value--empty'}">${value || '미입력'}</div>
      </div>`;
  }

  /**
   * 등록 · 수정 폼. 요일은 예식일자에서 계산해 읽기 전용으로 보여 줍니다
   * (직접 고치게 열어 두면 날짜와 요일이 어긋날 수 있어 잠가 둡니다).
   *
   * 예식일자만 state.eventForm.date 로 관리합니다 — 값이 바뀌는 순간
   * 요일 칸을 다시 그려야 하기 때문입니다. 나머지 칸은 data-keep 으로
   * 다시 그릴 때 입력값이 보존됩니다.
   */
  function eventForm(form) {
    var record = form.mode === 'edit' ? eventById(form.id) : null;
    var weekday = weekdayOf(form.date);
    var busy = form.saving;
    var lock = new Safe(busy ? 'disabled' : '');

    return h`
      <form class="evform" data-action="event-form-save"${busy ? new Safe(' aria-busy="true"') : ''}>
        <div class="evform__grid">
          <label class="field">예식일자 <span class="field__req">필수</span>
            <input class="input" type="date" required value="${form.date}"
              data-action="event-form-date" data-focus-key="ev-date" ${lock}>
          </label>

          <label class="field">요일
            <input class="input input--locked" type="text" readonly tabindex="-1"
              value="${weekday ? weekday + '요일' : '예식일자 선택 시 자동'}"
              aria-label="요일 (예식일자에서 자동 계산)">
            <span class="field__hint">예식일자에서 자동 계산됩니다.</span>
          </label>

          <label class="field">예식시간 <span class="field__req">필수</span>
            <input class="input" type="time" required value="${record ? record.time : ''}"
              data-keep="ev-time" data-focus-key="ev-time" ${lock}>
          </label>

          <label class="field">홀 <span class="field__req">필수</span>
            <select class="select" data-keep="ev-hall" data-focus-key="ev-hall" ${lock}>
              <option value="">홀 선택</option>
              ${D.HALLS.map(function (o) {
                return h`<option ${new Safe(record && record.hall === o ? 'selected' : '')}>${o}</option>`;
              })}
            </select>
          </label>

          <label class="field evform__wide">별칭
            <input class="input" type="text" maxlength="30" placeholder="예: 5월 셋째 주 1부"
              value="${record ? record.alias : ''}"
              data-keep="ev-alias" data-focus-key="ev-alias" ${lock}>
            <span class="field__hint">운영 구분용 메모입니다. 신랑신부 이름 · 연락처는 저장하지 않습니다.</span>
          </label>
        </div>

        ${authorField('ev-author')}
        ${form.error ? h`<p class="edit-form__error" role="alert">${form.error}</p>` : ''}

        <div class="evform__actions">
          <span class="form-actions__note">예식은 예식일자 · 예식시간 · 홀 세 값으로 구분합니다.</span>
          <button type="button" class="btn btn--outline btn--sm" data-action="event-form-cancel" ${lock}>취소</button>
          <button type="submit" class="btn btn--primary btn--sm" ${lock}>
            ${busy ? '저장 중…' : (form.mode === 'edit' ? '수정 저장' : '등록')}</button>
        </div>
      </form>`;
  }

  /** 예식이 여러 건이면 보고 있는 예식을 고르는 선택기를 함께 보여 줍니다. */
  function eventPicker(ev) {
    if (state.events.length < 2) return '';
    return h`
      <label class="evpick">
        <span class="evpick__label">보는 예식</span>
        <select class="select select--sm" data-action="event-pick" aria-label="체크리스트에 표시할 예식 선택">
          ${state.events.map(function (r) {
            var label = eventLabel(r) + (r.alias ? ' · ' + r.alias : '');
            return h`<option value="${r.id}" ${new Safe(r.id === ev.id ? 'selected' : '')}>${label}</option>`;
          })}
        </select>
      </label>`;
  }

  /** 예식기본정보 카드. 불러오는 중 · 실패 · 없음 · 폼 · 읽기 다섯 가지 상태를 다룹니다. */
  function eventInfoCard() {
    var form = state.eventForm;
    var ev = selectedEvent();
    var idle = !state.eventsLoading && !state.eventsError && !form;

    var body;
    if (state.eventsLoading) {
      body = h`<p class="empty">예식기본정보를 불러오는 중입니다…</p>`;
    } else if (state.eventsError) {
      body = h`
        <div class="evinfo__error" role="alert">
          <p class="evinfo__error-text">${state.eventsError}</p>
          <button type="button" class="btn btn--outline btn--sm" data-action="events-retry">다시 불러오기</button>
        </div>`;
    } else if (form) {
      body = eventForm(form);
    } else if (!ev) {
      body = h`<p class="empty">등록된 예식이 없습니다. 예식일자 · 예식시간 · 홀을 직접 입력해 등록해 주세요.</p>`;
    } else {
      body = h`
        <div class="evinfo__grid">
          ${evCell('예식일자', ev.date)}
          ${evCell('요일', weekdayOf(ev.date) ? weekdayOf(ev.date) + '요일' : '')}
          ${evCell('예식시간', ev.time)}
          ${evCell('홀', ev.hall)}
          ${evCell('별칭', ev.alias)}
        </div>`;
    }

    return h`
      <section class="card evinfo">
        <header class="card__head">
          <h2 class="card__title">예식기본정보</h2>
          <div class="evinfo__tools">
            ${idle && ev ? eventPicker(ev) : ''}
            ${idle && ev ? h`<button type="button" class="btn btn--xs btn--outline" data-action="event-edit">수정</button>` : ''}
            ${idle && ev ? h`<button type="button" class="btn btn--xs btn--danger" data-action="event-del-open">삭제</button>` : ''}
            ${idle ? h`<button type="button" class="btn btn--xs btn--primary" data-action="event-new">＋ 신규 예식 등록</button>` : ''}
          </div>
        </header>
        <div class="evinfo__body">${body}</div>
        ${!state.eventsLoading && !state.eventsError && ev && !form && lastEditLine(ev)
          ? h`<div class="evinfo__stamp">
                ${ev.createdBy ? h`<span>등록 ${ev.createdBy}</span>` : ''}
                <span>${lastEditLine(ev)}</span>
              </div>`
          : ''}
      </section>`;
  }

  /**
   * 삭제 모달. 1단계에서 지울 항목을 직접 고르고, 2단계에서 한 번 더 확인합니다.
   * 예식 전체 삭제와 선택 항목만 삭제를 같은 자리에서 고를 수 있습니다.
   */
  function eventDeleteModal() {
    var del = state.eventDelete;
    if (!del) return '';
    var ev = eventById(del.id);
    if (!ev) return '';

    var subs = eventSubItems(ev);
    var picked = subs.filter(function (it) { return del.picked[it.key]; });
    var count = del.whole ? subs.length + 1 : picked.length;
    var allPicked = subs.length > 0 && picked.length === subs.length;
    var busy = new Safe(del.busy ? 'disabled' : '');

    if (del.stage === 'confirm') {
      return h`
        <div class="overlay overlay--share" data-action="overlay-close" data-value="event-delete">
          <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="evdel-confirm-title" data-stop>
            <div class="section-label section-label--danger">삭제 확인</div>
            <h2 class="dialog__title" id="evdel-confirm-title">선택한 ${count}개 항목을 삭제합니다.<br>되돌릴 수 없습니다.</h2>
            <p class="dialog__text">
              <strong>${eventLabel(ev)}</strong>${del.whole
                ? ' — 예식기본정보와 하위 항목 ' + subs.length + '개를 모두 지웁니다.'
                : ' — 예식기본정보는 남기고 아래 하위 항목만 지웁니다.'}
            </p>
            ${!del.whole && picked.length ? h`
              <ul class="del-recap">
                ${picked.map(function (it) { return h`<li>${it.label}</li>`; })}
              </ul>` : ''}
            ${authorField('evdel-author', '누가 삭제했는지 남깁니다. 지운 기록은 활동 이력에만 남습니다.')}
            ${del.error ? h`<p class="edit-form__error" role="alert">${del.error}</p>` : ''}
            <div class="dialog__actions">
              <button type="button" class="btn btn--outline" data-action="event-del-back" ${busy}>뒤로</button>
              <button type="button" class="btn btn--danger-solid" data-action="event-del-confirm" ${busy}>
                ${del.busy ? '삭제 중…' : '삭제'}</button>
            </div>
          </div>
        </div>`;
    }

    return h`
      <div class="overlay overlay--share" data-action="overlay-close" data-value="event-delete">
        <div class="dialog dialog--edit" role="dialog" aria-modal="true" aria-labelledby="evdel-title" data-stop>
          <div class="section-label section-label--danger">삭제</div>
          <h2 class="dialog__title" id="evdel-title">삭제할 항목을 고르세요</h2>
          <p class="dialog__text"><strong>${eventLabel(ev)}</strong>${ev.alias ? ' · ' + ev.alias : ''}</p>

          <div class="del-whole" data-action="event-del-whole">
            <button type="button" class="check check--sm" role="checkbox" aria-checked="${del.whole}"
              aria-label="예식 전체 삭제" data-action="event-del-whole">${del.whole ? '✓' : ''}</button>
            <span class="del-whole__body">
              <span class="del-whole__title">예식 전체 삭제</span>
              <span class="del-whole__note">예식기본정보와 하위 항목 ${subs.length}개를 함께 지웁니다.</span>
            </span>
          </div>

          <div class="del-list">
            <div class="del-list__head">
              <span>하위 항목 ${subs.length}개</span>
              ${subs.length && !del.whole ? h`
                <button type="button" class="btn-link" data-action="event-del-all">
                  ${allPicked ? '전체 해제' : '전체 선택'}</button>` : ''}
            </div>
            ${subs.length === 0
              ? h`<p class="empty">이 예식에 딸린 하위 항목이 없습니다.</p>`
              : subs.map(function (it) {
                  var on = del.whole || !!del.picked[it.key];
                  return h`
                    <div class="del-item${del.whole ? ' del-item--forced' : ''}"
                      data-action="event-del-pick" data-value="${it.key}">
                      <button type="button" class="check check--sm" role="checkbox" aria-checked="${on}"
                        aria-label="${it.label}" data-action="event-del-pick" data-value="${it.key}"
                        ${new Safe(del.whole ? 'disabled' : '')}>${on ? '✓' : ''}</button>
                      <span class="del-item__body">
                        <span class="del-item__label">${it.label}</span>
                        <span class="del-item__note">${it.note}</span>
                      </span>
                    </div>`;
                })}
          </div>

          ${del.error ? h`<p class="edit-form__error" role="alert">${del.error}</p>` : ''}

          <div class="dialog__actions">
            <span class="form-actions__note">${count ? count + '개 선택됨' : '선택된 항목이 없습니다'}</span>
            <button type="button" class="btn btn--outline" data-action="event-del-close">취소</button>
            <button type="button" class="btn btn--danger-solid" data-action="event-del-next"
              ${new Safe(count ? '' : 'disabled')}>삭제 진행</button>
          </div>
        </div>
      </div>`;
  }

  /** 저장 결과 알림. 화면 오른쪽 아래에 잠깐 떴다 사라집니다. */
  function toastLayer() {
    if (!state.toast) return '';
    return h`
      <div class="toast toast--${state.toast.kind}" role="status" aria-live="polite">
        <span class="toast__mark" aria-hidden="true">${state.toast.kind === 'ok' ? '✓' : '!'}</span>
        <span class="toast__text">${state.toast.text}</span>
      </div>`;
  }

  /* ============================================== 4단계 · 체크리스트 ==== */

  /* ======================================= 체크리스트 항목 목록 관리 ==== */

  /**
   * 체크리스트 항목 한 줄.
   * 폼이 열려 있는 동안에는 수정 · 삭제 버튼을 감춥니다 — 폼을 닫지 않고 다른
   * 항목으로 건너가면 입력값이 섞이기 때문입니다.
   */
  function itemRow(g, it, formOpen) {
    var on = isItemDone(it);
    return h`
      <div class="item${on ? ' item--done' : ''}">
        <button type="button" class="check" role="checkbox" aria-checked="${on}"
          aria-label="${it.label}" data-action="toggle-item" data-value="${it.id}">${on ? '✓' : ''}</button>
        <div class="item__body">
          <div class="item__label">${it.label}</div>
          ${it.meta ? h`<div class="item__meta">${it.meta}</div>` : ''}
          ${it.updatedBy
            ? h`<div class="item__stamp">최종 ${it.updatedBy}${it.updatedAt ? ' · ' + formatStamp(it.updatedAt) : ''}</div>`
            : ''}
        </div>
        <span class="tag tag--sq ${tone(it.tag)}">${it.tag}</span>
        ${formOpen ? '' : h`
          <div class="item__tools">
            <button type="button" class="btn btn--xs btn--outline"
              data-action="item-edit" data-value="${g.id}:${it.id}">수정</button>
            <button type="button" class="btn btn--xs btn--danger"
              data-action="item-del-open" data-value="${g.id}:${it.id}">삭제</button>
          </div>`}
      </div>`;
  }

  /**
   * 항목 등록 · 수정 폼. 목록 안에서 그 줄을 대신해 열리는 인라인 편집기입니다.
   * 담당 구분은 D.CHECKLIST_TAGS 에서 고르므로 배지 톤이 항상 맞습니다.
   */
  function itemForm(form) {
    var record = form.mode === 'edit' ? checklistItem(form.groupId, form.id) : null;
    var busy = form.saving;
    var lock = new Safe(busy ? 'disabled' : '');

    return h`
      <form class="itemform" data-action="item-form-save"${busy ? new Safe(' aria-busy="true"') : ''}>
        <div class="itemform__grid">
          <label class="field">항목명 <span class="field__req">필수</span>
            <input class="input" type="text" maxlength="60" placeholder="예: 식전 영상 파일 회신"
              value="${record ? record.label : ''}" data-keep="item-label" data-focus-key="item-label" ${lock}>
          </label>

          <label class="field">담당 <span class="field__req">필수</span>
            <select class="select" data-keep="item-tag" data-focus-key="item-tag" ${lock}>
              ${D.CHECKLIST_TAGS.map(function (t) {
                return h`<option ${new Safe(record && record.tag === t ? 'selected' : '')}>${t}</option>`;
              })}
            </select>
          </label>

          <label class="field itemform__wide">설명
            <input class="input" type="text" maxlength="100" placeholder="예: 예식 14일 전까지 · 용량 500MB 이하"
              value="${record ? record.meta : ''}" data-keep="item-meta" data-focus-key="item-meta" ${lock}>
            <span class="field__hint">확인에 필요한 조건만 적습니다. 신랑신부 이름 · 연락처는 저장하지 않습니다.</span>
          </label>
        </div>

        ${authorField('item-author')}
        ${form.error ? h`<p class="edit-form__error" role="alert">${form.error}</p>` : ''}

        <div class="evform__actions">
          <span class="form-actions__note">이 예식의 체크리스트만 바뀝니다. 양식 원본과 다른 예식은 그대로입니다.</span>
          <button type="button" class="btn btn--outline btn--sm" data-action="item-form-cancel" ${lock}>취소</button>
          <button type="submit" class="btn btn--primary btn--sm" ${lock}>
            ${busy ? '저장 중…' : (form.mode === 'edit' ? '수정 저장' : '추가')}</button>
        </div>
      </form>`;
  }

  /** 항목 묶음 하나(카드). 머리글에 항목 추가 버튼이 붙습니다. */
  function checklistGroupCard(g, editable) {
    var form = state.itemForm;
    var formOpen = !!form;
    var addingHere = !!form && form.mode === 'create' && form.groupId === g.id;
    var groupDone = g.items.filter(isItemDone).length;
    var complete = g.items.length > 0 && groupDone === g.items.length;

    return h`
      <section class="card group${complete ? ' group--complete' : ''}">
        <header class="group__head">
          <span class="group__label">${g.label}</span>
          <span class="group__caption">${g.caption}</span>
          <span class="group__count">${groupDone} / ${g.items.length}</span>
          ${editable && !formOpen ? h`<button type="button" class="btn btn--xs btn--outline"
            data-action="item-new" data-value="${g.id}">＋ 항목 추가</button>` : ''}
        </header>
        <div>
          ${g.items.length === 0 && !addingHere
            ? h`<p class="empty">등록된 항목이 없습니다.</p>`
            : g.items.map(function (it) {
                var editingHere = !!form && form.mode === 'edit' && form.id === it.id;
                return editingHere ? itemForm(form) : itemRow(g, it, editable && formOpen);
              })}
          ${addingHere ? itemForm(form) : ''}
        </div>
      </section>`;
  }

  /** 항목 삭제 확인. 한 건이라 고를 것 없이 확인만 받습니다. */
  function itemDeleteModal() {
    var del = state.itemDelete;
    if (!del) return '';
    var target = checklistItem(del.groupId, del.id);
    if (!target) return '';
    var group = checklistGroupById(del.groupId);
    var busy = new Safe(del.busy ? 'disabled' : '');

    return h`
      <div class="overlay overlay--share" data-action="overlay-close" data-value="item-delete">
        <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="itemdel-title" data-stop>
          <div class="section-label section-label--danger">삭제</div>
          <h2 class="dialog__title" id="itemdel-title">선택한 1개 항목을 삭제합니다.<br>되돌릴 수 없습니다.</h2>
          <p class="dialog__text"><strong>${target.label}</strong>
            — ${group ? group.label : ''} 목록에서 지웁니다. 완료 표시도 함께 사라집니다.</p>
          ${authorField('itemdel-author', '누가 삭제했는지 남깁니다. 지운 항목은 활동 이력에만 남습니다.')}
          ${del.error ? h`<p class="edit-form__error" role="alert">${del.error}</p>` : ''}
          <div class="dialog__actions">
            <button type="button" class="btn btn--outline" data-action="item-del-close" ${busy}>취소</button>
            <button type="button" class="btn btn--danger-solid" data-action="item-del-confirm" ${busy}>
              ${del.busy ? '삭제 중…' : '삭제'}</button>
          </div>
        </div>
      </div>`;
  }

  /**
   * 예식 최종 체크리스트.
   *
   * 맨 위에 수기로 등록한 예식기본정보가 오고, 그 아래 진행률 · 체크리스트 ·
   * 첨부함이 옵니다. 체크 상태 · 첨부파일 · 스태프 메모는 모두 보고 있는
   * 예식에 붙으므로, 예식이 한 건도 없으면 기본정보 카드만 보여 줍니다.
   */
  function checklistView(d) {
    var c = d.customer;
    var ev = selectedEvent();

    return h`
      <div class="rise">
        ${c
          ? h`<button type="button" class="back-link" data-action="go" data-value="detail">← ${coupleIdParts(c.id).event} 상세</button>`
          : h`<button type="button" class="back-link" data-action="go" data-value="customers">← 고객 / 예식 관리</button>`}

        <div class="page-head">
          <div>
            <h1 class="page-title">예식 최종 체크리스트</h1>
            <p class="page-sub">${ev ? eventLabel(ev) : '예식 미등록'} · ${D.CHECKLIST_DUE}</p>
          </div>
          ${c && ev
            ? h`<button type="button" class="btn btn--primary" style="height:42px" data-action="share-open">공유 링크 보내기</button>`
            : ''}
        </div>

        ${eventInfoCard()}

        ${!ev ? '' : h`
          <div class="progress-card mt-18">
            <div class="progress-card__row">
              <div class="progress-card__pct">${d.pct}%</div>
              <div class="progress-card__count">${d.done} / ${d.total}개 항목 완료</div>
              <div class="progress-card__stamp">${lastEditLine(ev) || '저장 기록 없음'}</div>
            </div>
            <div style="margin-top:14px">${bar(d.pct, 'bar--thick')}</div>
          </div>

          <div class="split-checklist mt-18">
            <div style="display:flex;flex-direction:column;gap:14px">
              ${checklistGroups().map(function (g) { return checklistGroupCard(g, true); })}
            </div>

            <div class="sticky-side" style="display:flex;flex-direction:column;gap:14px">
              <section class="card">
                <header class="card__head" style="display:block">
                  <h2 class="card__title">파일 첨부함</h2>
                  <p style="margin-top:6px;font-size:11.5px;color:var(--muted-2)">식권 사진 · 식전 영상 · 축가 반주 음원</p>
                </header>
                <div>
                  ${ev.files.map(function (f) {
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

              <section class="card">
                <header class="card__head" style="display:block">
                  <h2 class="card__title">스태프 메모</h2>
                  <p style="margin-top:6px;font-size:11.5px;color:var(--muted-2)">예약실 내부 공유용 · 신랑신부 화면에는 보이지 않습니다</p>
                </header>
                <div>
                  ${ev.memos.length === 0
                    ? h`<p class="empty">이 예식에 남긴 메모가 없습니다.</p>`
                    : ev.memos.map(function (m) {
                        return h`
                          <div class="evmemo">
                            <div class="evmemo__head">${m.author} · ${m.time}</div>
                            <div class="evmemo__body">${m.body}</div>
                          </div>`;
                      })}
                </div>
              </section>
            </div>
          </div>`}
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

              <label class="memo-form__label" for="post-author">작성자 <span class="field__req">필수</span></label>
              ${state.staff.length === 0
                ? h`<p class="memo-form__error">설정에서 직원을 먼저 추가해야 글을 남길 수 있습니다.</p>`
                : h`<select class="select" id="post-author"
                      data-keep="post-author" data-focus-key="post-author">
                      <option value="">작성자 선택</option>
                      ${state.staff.map(function (st) { return h`<option>${st.name}</option>`; })}
                    </select>`}
              <p class="memo-form__hint">로그인 계정과 별개로, 이 글을 남기는 사람을 고릅니다.</p>

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

  /**
   * 상담 → 예식 연결 현황.
   *
   * 계약완료로 표시한 상담 가운데 예식과 이어진 건과 아직 남은 건을 나눠 셉니다.
   * 계약완료 체크만 하고 연결을 미룬 건을 놓치지 않도록 "연결 필요" 를 따로 보여 주고,
   * 연결 자체는 홈의 오늘 상담 기록 카드에서 그 자리에서 처리합니다.
   */
  function consultLinkStats() {
    var done = state.consultations.filter(isConsultDone);
    var pending = consultsNeedingLink();
    var linked = done.length - pending.length;
    var rate = done.length ? Math.round((linked / done.length) * 100) : 0;

    return h`
      <section class="card card--pad mt-18">
        <header class="card__head" style="padding:0 0 4px">
          <h2 class="card__title">상담 → 예식 연결 현황</h2>
          <span class="card__note">계약완료 상담이 실제로 예식과 이어졌는지 추적합니다</span>
        </header>

        <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);margin-top:16px">
          <div class="stat">
            <div class="stat__label">계약완료 상담</div>
            <div class="stat__value">${done.length}건</div>
          </div>
          <div class="stat">
            <div class="stat__label">연결 완료</div>
            <div class="stat__value">${linked}건</div>
          </div>
          <div class="stat">
            <div class="stat__label">연결 필요</div>
            <div class="stat__value${pending.length ? ' stat__value--warn' : ''}">${pending.length}건</div>
          </div>
        </div>

        <div style="margin-top:16px">${bar(rate, 'bar--thick')}</div>
        <p class="chart__note">계약완료 ${done.length}건 중 ${linked}건 연결 완료 · 연결률 ${rate}%</p>

        ${state.consultationsError ? h`
          <div class="evinfo__error" role="alert" style="margin-top:14px">
            <p class="evinfo__error-text">${state.consultationsError}</p>
            <button type="button" class="btn btn--outline btn--sm" data-action="consult-retry">다시 불러오기</button>
          </div>` : ''}

        ${pending.length === 0
          ? h`<p class="linkrow__done">계약완료 상담이 모두 예식과 연결되어 있습니다.</p>`
          : h`
            <div class="linklist">
              <div class="linklist__head">
                <span>연결 필요 ${pending.length}건</span>
                <button type="button" class="btn btn--xs btn--outline" data-action="go" data-value="home">
                  오늘 상담 기록에서 연결하기</button>
              </div>
              ${pending.map(function (r) {
                return h`
                  <div class="linkrow">
                    <span class="linkrow__when">${consultDateLabel(r)} ${r.consultationTime || '시간 미정'}</span>
                    <span class="tag tag--sq ${tone(r.type)}">${r.type}</span>
                    <span class="linkrow__memo">${r.memo || '메모 없음'}</span>
                    <span class="linkrow__by">${r.createdBy || '작성자 미기록'}</span>
                  </div>`;
              })}
            </div>`}
      </section>`;
  }

  function statsView() {
    return h`
      <div class="rise">
        <h1 class="page-title">실적 대시보드</h1>
        <p class="page-sub">2026년 1월 1일 ~ 2월 10일 · 직원별 상담 및 계약 현황</p>

        <div class="kpi-grid">${D.STAT_KPIS.map(kpiCard)}</div>

        ${consultLinkStats()}

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
                ${authorField('member-author')}
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
        // 글 자체의 작성자(내용). 이 수정을 남기는 사람은 아래 공통 작성자 칸에 따로 고릅니다.
        { key: 'author', label: '글 작성자' },
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
            ${authorField('edit-by', '이 수정을 남기는 사람을 고릅니다. 로그인 계정과 별개입니다.')}
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
          ${authorField('del-by', '누가 삭제했는지 남깁니다. 지운 기록은 활동 이력에만 남습니다.')}
          ${state.editError ? h`<p class="edit-form__error" role="alert">${state.editError}</p>` : ''}
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

                  <div class="m-heading">시식 일정 선택</div>
                  ${mobileCandidateCard(c)}

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

  /* ==================================== 설정 · 직원 목록 · 활동 이력 ==== */

  /**
   * 설정 화면.
   * 작성자로 고를 직원 목록을 여기서 관리합니다 — 로그인 계정(회원 관리)과 별개입니다.
   */
  function settingsView() {
    return h`
      <div class="rise">
        <h1 class="page-title">설정</h1>
        <p class="page-sub">기록에 남길 작성자 목록과 활동 이력을 관리합니다.</p>

        <div class="grid-2 mt-18">
          <form class="card card--pad" data-action="staff-add">
            <h2 class="card__title">작성자 직원 목록</h2>
            <p class="memo-form__hint" style="margin-top:8px">
              예식 · 체크리스트 · 공지사항을 기록할 때 <strong>여기 등록된 이름에서만</strong> 작성자를 고를 수 있습니다.
              로그인 계정과는 별개 목록이라, 로그인한 사람과 실제 작성자가 달라도 그대로 남길 수 있습니다.
            </p>

            <div class="memo-form" style="margin-top:16px">
              <label class="memo-form__label" for="staff-name">직원 이름</label>
              <input class="input" id="staff-name" maxlength="20" placeholder="예: 정하람 주임"
                data-keep="staff-name" data-focus-key="staff-name">
              ${state.staffError ? h`<p class="memo-form__error" role="alert">${state.staffError}</p>` : ''}
              <button type="submit" class="btn btn--primary">직원 추가</button>
            </div>

            <div class="stafflist">
              ${state.staff.length === 0
                ? h`<p class="empty">등록된 직원이 없습니다. 최소 한 명은 등록해야 기록을 남길 수 있습니다.</p>`
                : state.staff.map(function (s) {
                    return h`
                      <div class="staffrow">
                        <span class="staffrow__name">${s.name}</span>
                        <button type="button" class="btn btn--xs btn--danger"
                          data-action="staff-remove" data-value="${s.id}">삭제</button>
                      </div>`;
                  })}
            </div>
            <p class="memo-form__hint" style="margin-top:12px">
              직원을 지우면 앞으로 고를 수 없게만 됩니다. <strong>이미 남은 기록과 활동 이력의 이름은 그대로 보존</strong>됩니다.
            </p>
          </form>

          <section class="card card--pad">
            <h2 class="card__title">활동 이력</h2>
            <p class="memo-form__hint" style="margin-top:8px">
              누가 언제 무엇을 등록 · 수정 · 삭제했는지 남습니다. 최근 ${LOG_LIMIT}건까지 보관합니다.
            </p>

            <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);margin-top:18px">
              ${['created', 'updated', 'deleted'].map(function (a) {
                var n = state.logs.filter(function (r) { return r.action === a; }).length;
                return h`
                  <div class="stat">
                    <div class="stat__label">${LOG_ACTIONS[a]}</div>
                    <div class="stat__value">${n}건</div>
                  </div>`;
              })}
            </div>

            <div style="display:flex;gap:10px;margin-top:20px">
              <button type="button" class="btn btn--outline" data-action="logs-open">활동 이력 열기</button>
            </div>

            <p class="memo-form__hint" style="margin-top:16px">
              지운 기록은 원본이 사라지므로 <strong>무엇을 지웠는지는 이 이력에만</strong> 남습니다.
            </p>
          </section>
        </div>
      </div>`;
  }

  /** 활동 이력 모달. 최근 것이 위로 옵니다. */
  function logsModal() {
    if (!state.showLogs) return '';
    var rows = state.logs;

    return h`
      <div class="overlay overlay--share" data-action="overlay-close" data-value="logs">
        <div class="dialog dialog--logs" role="dialog" aria-modal="true" aria-labelledby="logs-title" data-stop>
          <div class="section-label">활동 이력</div>
          <h2 class="dialog__title" id="logs-title">누가 언제 무엇을 했는지</h2>
          <p class="dialog__text">작성자는 로그인 계정이 아니라, 기록할 때 직접 고른 이름입니다.</p>

          <div class="logtable">
            <div class="logtable__head">
              <div>시각</div><div>작성자</div><div>대상</div><div>행위</div><div>내용</div>
            </div>
            ${rows.length === 0
              ? h`<p class="empty">아직 남은 활동 이력이 없습니다.</p>`
              : rows.map(function (r) {
                  return h`
                    <div class="logtable__row">
                      <div class="logtable__when">${r.createdAt ? formatStamp(r.createdAt) : '-'}</div>
                      <div class="logtable__who">${r.staffName || '미기록'}</div>
                      <div class="logtable__what">${LOG_TABLES[r.tableName] || r.tableName}</div>
                      <div><span class="tag tag--sq ${tone(LOG_ACTION_TONES[r.action] || 'neutral')}">${LOG_ACTIONS[r.action] || r.action}</span></div>
                      <div class="logtable__detail">${r.detail}</div>
                    </div>`;
                })}
          </div>

          <div class="dialog__actions">
            <span class="form-actions__note">${rows.length}건</span>
            <button type="button" class="btn btn--outline" data-action="logs-close">닫기</button>
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
    settings: settingsView,
  };

  var TITLES = {
    login: '로그인',
    home: '홈 대시보드',
    customers: '고객 / 예식 관리',
    new: '고객 등록',
    detail: '고객 상세',
    checklist: '예식 최종 체크리스트',
    tastings: '시식 예약 관리',
    board: '사내 공유 게시판',
    vendors: '제휴업체 관리',
    stats: '실적 대시보드',
    admin: '관리자 · 회원 관리',
    settings: '설정',
  };

  function view() {
    var d = derive();

    if (state.screen === 'login') {
      return h`${loginView()}${shareModal(d)}${mobileModal(d)}${toastLayer()}`;
    }

    var screen = SCREENS[state.screen] || homeView;
    return h`
      <div class="app">
        ${sidebar(d)}
        <main class="main">${screen(d)}</main>
      </div>
      ${editModal()}
      ${deleteModal()}
      ${eventDeleteModal()}
      ${consultLinkModal()}
      ${itemDeleteModal()}
      ${logsModal()}
      ${shareModal(d)}
      ${mobileModal(d)}
      ${toastLayer()}`;
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

  /**
   * 저장소에서 예식 목록을 다시 읽어 화면 상태에 맞춥니다.
   * opts.select 로 불러온 뒤 고를 예식을 지정할 수 있습니다('' 이면 첫 번째).
   */
  function loadEvents(opts) {
    var select = opts && 'select' in opts ? opts.select : null;
    setState({ eventsLoading: true, eventsError: '' });

    return eventStore.list().then(function (events) {
      var want = select != null ? select : state.eventId;
      var found = events.some(function (r) { return r.id === want; });
      setState({
        events: events,
        eventId: found ? want : (events.length ? events[0].id : ''),
        eventsLoading: false,
        eventsError: '',
      });
      return events;
    }).catch(function (err) {
      // 여기서 예외를 다시 던지지 않습니다 — 저장은 성공했는데 다시 읽기만
      // 실패한 경우에도 저장 결과 알림은 그대로 보여 주어야 합니다.
      setState({
        eventsLoading: false,
        eventsError: err.message || '예식기본정보를 불러오지 못했습니다.',
      });
      return [];
    });
  }

  var ACTIONS = {
    login: function () { setState({ screen: 'home', showShare: false }); },
    logout: function () { setState({ screen: 'login', showShare: false, showMobile: false }); },

    go: function (value) { setState({ screen: value, showShare: false }); },
    'open-customer': function (value) { setState({ customerId: Number(value), screen: 'detail', showShare: false }); },
    /** 고객 등록 — 목록에 실제로 한 건을 추가하고 체크리스트로 넘어갑니다. */
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
      // 시식 일정 — 달력에서 고른 날짜 · 시간 · 시식장을 한 줄로 합칩니다.
      var tDate = state.tastingDate;
      var tTime = read('new-tasting-time');
      var tPlace = read('new-tasting-place');

      if (!tDate && tTime) {
        return setState({ customerError: '시식 시간을 적었으면 시식일도 골라 주세요.' });
      }
      if (tDate && !weekdayOf(tDate)) {
        return setState({ customerError: '시식일을 다시 골라 주세요.' });
      }
      // 시식은 계약 후 예식 전에 진행하므로 예식일보다 뒤일 수 없습니다.
      if (tDate && weekdayOf(state.wedding) && dayGap(tDate, state.wedding) < 0) {
        return setState({ customerError: '시식일은 예식일보다 앞이어야 합니다.' });
      }

      var tastingLine = tDate
        ? formatEventDate(tDate, tTime) + (tPlace ? ' · ' + tPlace : '')
        : '';
      var tastingText = [tastingLine, read('new-tasting')].filter(Boolean).join('\n');

      var author = readAuthor('new-author');
      var authorBad = authorProblem(author);
      if (authorBad) return setState({ customerError: authorBad });

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
        // 시식 일정은 달력에서 고른 값을 한 줄로, 특이사항 메모는 그 아래 줄에 둡니다.
        tasting: tastingText,
        checkMemo: read('new-check'),
        createdBy: author,
        updatedBy: author,
        updatedAt: nowIso(),
      };

      ['new-groom', 'new-bride', 'new-phone', 'new-tasting', 'new-check', 'new-author',
        'new-tasting-time', 'new-tasting-place'].forEach(function (key) {
        var el = root.querySelector('[data-keep="' + key + '"]');
        if (el) el.value = '';
      });

      setState({
        customers: state.customers.concat([customer]),
        customerId: customer.id,
        customerError: '',
        tastingDate: '',
        screen: 'detail',
      });
      logActivity({
        tableName: 'customers', recordId: String(customer.id), action: 'created',
        staffName: author,
        detail: coupleIdParts(customer.id).event + ' 등록'
          + (tastingLine ? ' · 시식 ' + tastingLine : ' · 시식 미정'),
      });
    },

    hero: function (value) { setState({ hero: value }); },
    filter: function (value) { setState({ filter: value }); },
    'board-filter': function (value) { setState({ boardFilter: value }); },
    stage: function (value) { setState({ stage: value }); },

    /**
     * 체크 상태는 보고 있는 예식에 붙고 곧바로 저장소에 기록합니다.
     * 화면은 먼저 바꾸고, 저장이 실패하면 원래 상태로 되돌립니다.
     */
    'toggle-item': function (value) {
      // 폼이 없는 기록이라 사이드바에서 고른 기록 담당으로 남깁니다.
      var problem = recorderProblem();
      if (problem) return setState({ toast: toast('error', problem) });

      var item = derive().items.find(function (i) { return i.id === value; });
      var fallback = item ? item.done : false;
      var ev = selectedEvent();

      // 등록된 예식이 없으면 저장하지 않고 화면에서만 토글합니다.
      if (!ev) return setState({ checks: toggleKey(state.checks, value, fallback) });

      var who = state.recorder;
      var when = nowIso();
      var checks = toggleKey(ev.checks, value, fallback);
      var next = Object.assign({}, ev, {
        checks: checks,
        updatedBy: who,
        // 어느 항목을 누가 언제 만졌는지 항목에도 남깁니다.
        groups: ev.groups.map(function (g) {
          if (!g.items.some(function (it) { return it.id === value; })) return g;
          return Object.assign({}, g, {
            items: g.items.map(function (it) {
              return it.id === value
                ? Object.assign({}, it, { updatedBy: who, updatedAt: when })
                : it;
            }),
          });
        }),
      });
      var swap = function (list, record) {
        return list.map(function (r) { return r.id === record.id ? record : r; });
      };

      setState({ events: swap(state.events, next) });

      eventStore.replace(next).then(function (saved) {
        setState({ events: swap(state.events, saved) });
        logActivity({
          tableName: 'checklist_items', recordId: value, action: 'updated', staffName: who,
          detail: eventLabel(ev) + ' — ' + (item ? item.label : value)
            + (checks[value] ? ' 완료 체크' : ' 완료 해제'),
        });
      }).catch(function (err) {
        setState({
          events: swap(state.events, ev),
          toast: toast('error', err.message || '체크 상태를 저장하지 못했습니다.'),
        });
      });
    },
    'toggle-memo': function (value) {
      var problem = recorderProblem();
      if (problem) return setState({ toast: toast('error', problem) });
      var memo = recordOf('post', value);
      if (!memo) return;
      memo.done = !memo.done;
      memo.updatedBy = state.recorder;
      memo.updatedAt = nowIso();
      setState({});
      logActivity({
        tableName: 'notices', recordId: String(memo.id), action: 'updated',
        staffName: state.recorder,
        detail: memo.title + ' — ' + (memo.done ? '처리 완료' : '처리 해제'),
      });
    },

    /* ---- 체크리스트 항목 추가 · 수정 · 삭제 ---- */

    'item-new': function (value) {
      if (!selectedEvent()) return;
      setState({
        itemForm: { mode: 'create', groupId: value, id: '', error: '', saving: false },
        itemDelete: null,
      });
    },

    /** data-value 는 "그룹id:항목id" 입니다. */
    'item-edit': function (value) {
      if (!selectedEvent()) return;
      var at = value.indexOf(':');
      setState({
        itemForm: {
          mode: 'edit',
          groupId: value.slice(0, at),
          id: value.slice(at + 1),
          error: '',
          saving: false,
        },
        itemDelete: null,
      });
    },

    'item-form-cancel': function () {
      clearKept(['item-label', 'item-meta', 'item-tag']);
      setState({ itemForm: null });
    },

    /**
     * 항목 저장. 항목명과 담당은 필수이고, 같은 묶음 안에서 항목명은 겹칠 수 없습니다.
     * 바뀌는 것은 이 예식의 사본뿐이라 양식 원본(D.CHECKLIST)과 다른 예식은 그대로입니다.
     */
    'item-form-save': function () {
      var form = state.itemForm;
      if (!form || form.saving) return;
      var ev = selectedEvent();
      if (!ev) return setState({ itemForm: null });

      var read = function (key) {
        var el = root.querySelector('[data-keep="' + key + '"]');
        return el ? String(el.value || '').trim() : '';
      };
      var label = read('item-label');
      var meta = read('item-meta');
      var tag = read('item-tag');

      var fail = function (message) {
        return setState({ itemForm: Object.assign({}, form, { error: message, saving: false }) });
      };

      if (!label) return fail('항목명을 입력해 주세요.');
      if (label.length > 60) return fail('항목명은 60자까지 입력할 수 있습니다.');
      if (meta.length > 100) return fail('설명은 100자까지 입력할 수 있습니다.');
      if (D.CHECKLIST_TAGS.indexOf(tag) < 0) return fail('담당을 골라 주세요.');

      // 항목명 · 설명에도 개인정보를 두지 않습니다.
      var pii = piiReason(label) || piiReason(meta);
      if (pii) return fail(pii + '로 보이는 값이 있습니다. 개인정보는 저장하지 않습니다.');

      var group = ev.groups.find(function (g) { return g.id === form.groupId; });
      if (!group) return fail('항목을 넣을 목록을 찾지 못했습니다.');

      var duplicate = group.items.some(function (it) {
        return it.id !== form.id && it.label === label;
      });
      if (duplicate) return fail('같은 이름의 항목이 이 목록에 이미 있습니다.');

      var author = readAuthor('item-author');
      var authorBad = authorProblem(author);
      if (authorBad) return fail(authorBad);

      var groups = ev.groups.map(function (g) {
        if (g.id !== form.groupId) return g;
        var items;
        var when = nowIso();
        if (form.mode === 'edit') {
          items = g.items.map(function (it) {
            return it.id === form.id
              ? Object.assign({}, it, {
                  label: label, meta: meta, tag: tag,
                  updatedBy: author, updatedAt: when,
                })
              : it;
          });
        } else {
          items = g.items.concat([{
            id: 'it-' + when.replace(/\D/g, '') + '-' + g.items.length,
            label: label, meta: meta, tag: tag, done: false,
            createdBy: author, updatedBy: author, updatedAt: when,
          }]);
        }
        return Object.assign({}, g, { items: items });
      });

      setState({ itemForm: Object.assign({}, form, { error: '', saving: true }) });

      eventStore.replace(Object.assign({}, ev, { groups: groups, updatedBy: author })).then(function () {
        clearKept(['item-label', 'item-meta', 'item-tag', 'item-author']);
        logActivity({
          tableName: 'checklist_items',
          recordId: form.mode === 'edit' ? form.id : label,
          action: form.mode === 'edit' ? 'updated' : 'created',
          staffName: author,
          detail: eventLabel(ev) + ' — ' + label + ' (' + tag + ')',
        });
        return loadEvents({ select: ev.id }).then(function () {
          setState({
            itemForm: null,
            toast: toast('ok', form.mode === 'edit'
              ? '체크리스트 항목을 수정했습니다.'
              : '체크리스트 항목을 추가했습니다.'),
          });
        });
      }).catch(function (err) {
        setState({
          itemForm: Object.assign({}, state.itemForm || form, {
            error: err.message || '저장하지 못했습니다.',
            saving: false,
          }),
          toast: toast('error', err.message || '저장하지 못했습니다.'),
        });
      });
    },

    'item-del-open': function (value) {
      if (!selectedEvent()) return;
      var at = value.indexOf(':');
      setState({
        itemDelete: {
          groupId: value.slice(0, at),
          id: value.slice(at + 1),
          busy: false,
          error: '',
        },
        itemForm: null,
      });
    },

    'item-del-close': function () { setState({ itemDelete: null }); },

    'item-del-confirm': function () {
      var del = state.itemDelete;
      if (!del || del.busy) return;
      var ev = selectedEvent();
      var target = checklistItem(del.groupId, del.id);
      if (!ev || !target) return setState({ itemDelete: null });

      var author = readAuthor('itemdel-author');
      var authorBad = authorProblem(author);
      if (authorBad) {
        return setState({ itemDelete: Object.assign({}, del, { error: authorBad }) });
      }
      // 지워지기 전에 무엇을 지우는지 적어 둡니다.
      var logRow = {
        tableName: 'checklist_items', recordId: del.id, action: 'deleted', staffName: author,
        detail: eventLabel(ev) + ' — ' + target.label + ' 삭제',
      };

      setState({ itemDelete: Object.assign({}, del, { busy: true, error: '' }) });

      var groups = ev.groups.map(function (g) {
        if (g.id !== del.groupId) return g;
        return Object.assign({}, g, {
          items: g.items.filter(function (it) { return it.id !== del.id; }),
        });
      });

      // 지운 항목의 완료 기록도 함께 치웁니다(주인 없는 체크가 남지 않도록).
      var checks = Object.assign({}, ev.checks);
      delete checks[del.id];

      eventStore.replace(Object.assign({}, ev, {
        groups: groups, checks: checks, updatedBy: author,
      })).then(function () {
        logActivity(logRow);
        return loadEvents({ select: ev.id }).then(function () {
          setState({ itemDelete: null, toast: toast('ok', '체크리스트 항목을 삭제했습니다.') });
        });
      }).catch(function (err) {
        setState({
          itemDelete: Object.assign({}, state.itemDelete || del, {
            busy: false,
            error: err.message || '삭제하지 못했습니다.',
          }),
          toast: toast('error', err.message || '삭제하지 못했습니다.'),
        });
      });
    },

    /* ---- 시식 일정 후보 제안 · 확정 ---- */

    'cand-retry': function () { loadCandidates(); },

    /** 후보 추가 (예약실). 날짜 · 시간은 필수이고 예식일보다 앞이어야 합니다. */
    'cand-add': function () {
      if (state.candBusy) return;
      var c = derive().customer;
      if (!c) return;

      var timeEl = root.querySelector('[data-keep="cand-time"]');
      var date = state.candDate;
      var time = timeEl ? String(timeEl.value || '').trim() : '';

      var fail = function (message) { return setState({ candError: message }); };

      if (!weekdayOf(date)) return fail('후보 날짜를 골라 주세요.');
      if (!/^\d{2}:\d{2}$/.test(time)) return fail('후보 시간을 입력해 주세요.');

      // 시식은 예식 전에 진행하므로 후보도 예식일보다 앞이어야 합니다.
      var weddingIso = isoFromLabel(c.date);
      if (weddingIso && dayGap(date, weddingIso) < 0) {
        return fail('후보는 예식일보다 앞이어야 합니다.');
      }

      var author = readAuthor('cand-author');
      var authorBad = authorProblem(author);
      if (authorBad) return fail(authorBad);

      setState({ candError: '', candBusy: true });

      candidateStore.add({
        weddingEventId: String(c.id),
        candidateDate: date,
        candidateTime: time,
        createdBy: author,
      }).then(function (record) {
        clearKept(['cand-time', 'cand-author']);
        return loadCandidates().then(function () {
          setState({
            candBusy: false,
            candDate: '',
            toast: toast('ok', '시식 후보를 추가했습니다.'),
          });
          return logActivity({
            tableName: 'tasting_candidates', recordId: record.id, action: 'created',
            staffName: author,
            detail: coupleIdParts(c.id).event + ' — 시식 후보 ' + candidateLabel(record) + ' 제안',
          });
        });
      }).catch(function (err) {
        var message = err.message || '후보를 추가하지 못했습니다.';
        setState({ candBusy: false, candError: message, toast: toast('error', message) });
      });
    },

    /** 후보 삭제 (예약실). 폼이 없는 기록이라 사이드바 기록 담당으로 남깁니다. */
    'cand-remove': function (value) {
      if (state.candBusy) return;
      var problem = recorderProblem();
      if (problem) return setState({ toast: toast('error', problem) });

      var target = state.candidates.find(function (r) { return r.id === value; });
      if (!target) return;
      var by = state.recorder;
      var label = candidateLabel(target);
      var wasConfirmed = target.isConfirmed;

      setState({ candBusy: true, candError: '' });

      candidateStore.remove(value).then(function () {
        return loadCandidates().then(function () {
          setState({ candBusy: false, toast: toast('ok', '시식 후보를 삭제했습니다.') });
          return logActivity({
            tableName: 'tasting_candidates', recordId: value, action: 'deleted',
            staffName: by,
            detail: '시식 후보 ' + label + ' 삭제' + (wasConfirmed ? ' (확정된 일정이었습니다)' : ''),
          });
        });
      }).catch(function (err) {
        var message = err.message || '후보를 삭제하지 못했습니다.';
        setState({ candBusy: false, toast: toast('error', message) });
      });
    },

    /** 신랑신부가 후보를 고릅니다(아직 확정 전). */
    'cand-pick': function (value) { setState({ candPick: value }); },

    /**
     * 신랑신부가 확정합니다. 로그인 없이 공유 링크로 들어온 사람이라
     * 작성자는 직원 목록이 아니라 '신랑신부'로 남깁니다.
     */
    'cand-confirm': function (value) {
      if (!value || state.candBusy) return;
      setState({ candBusy: true });

      candidateStore.confirm(value).then(function (result) {
        return loadCandidates().then(function () {
          setState({
            candBusy: false,
            candPick: value,
            toast: toast('ok', '시식 일정을 ' + candidateLabel(result.confirmed) + '로 확정했습니다.'),
          });
          return logActivity({
            tableName: 'tasting_candidates', recordId: value, action: 'updated',
            staffName: '신랑신부 (공유 링크)',
            detail: result.previous
              ? '시식 확정 변경 — ' + candidateLabel(result.previous) + ' → ' + candidateLabel(result.confirmed)
              : '시식 확정 — ' + candidateLabel(result.confirmed),
          });
        });
      }).catch(function (err) {
        var message = err.message || '확정하지 못했습니다.';
        setState({ candBusy: false, toast: toast('error', message) });
      });
    },

    /* ---- 오늘 상담 기록 ---- */

    'consult-retry': function () { loadConsultations(); },

    /** 상담 구분(워킹인 · 컨설팅) 선택. 라디오 두 칸이라 상태만 바꿉니다. */
    'consult-type': function (value) {
      if (state.consultBusy || D.CONSULT_TYPES.indexOf(value) < 0) return;
      setState({ consultType: value, consultError: '' });
    },

    /** 메모 펼치기 · 접기. 메모가 있는 줄에만 붙습니다. */
    'consult-toggle': function (value) {
      setState({ consultOpen: toggleKey(state.consultOpen, value, false) });
    },

    /** 인라인 삭제로 고르기 · 해제 */
    'consult-pick': function (value) {
      setState({ consultPicked: toggleKey(state.consultPicked, value, false) });
    },

    'consult-pick-all': function () {
      var rows = todayConsultations();
      var next = {};
      // 하나라도 안 고른 게 남았으면 전체 선택, 다 골랐으면 전체 해제입니다.
      if (pickedConsultations().length < rows.length) {
        rows.forEach(function (r) { next[r.id] = true; });
      }
      setState({ consultPicked: next });
    },

    /**
     * 상담 등록. 상담일 · 상담시간 · 구분만 필수이고 메모는 선택입니다.
     * 신랑신부 이름을 별도 칸으로 받지 않고, 필요하면 메모 한 줄에 적습니다.
     */
    'consult-add': function () {
      if (state.consultBusy) return;

      var read = function (key) {
        var el = root.querySelector('[data-keep="' + key + '"]');
        return el ? String(el.value || '').trim() : '';
      };
      var date = state.consultDate;
      var time = read('consult-time');
      var type = state.consultType;
      var memo = read('consult-memo');

      var fail = function (message) { return setState({ consultError: message }); };

      if (!weekdayOf(date)) return fail('상담일을 골라 주세요.');
      if (!/^\d{2}:\d{2}$/.test(time)) return fail('상담시간을 입력해 주세요.');
      if (D.CONSULT_TYPES.indexOf(type) < 0) return fail('상담 구분을 골라 주세요.');
      if (memo.length > 100) return fail('메모는 100자까지 입력할 수 있습니다.');

      // 메모는 자유 입력이지만, 연락처 · 이메일 · 금액은 설계상 저장하지 않는 값입니다.
      var pii = piiReason(memo);
      if (pii) return fail('메모에 ' + pii + '로 보이는 값이 있습니다. 개인정보는 저장하지 않습니다.');

      var author = readAuthor('consult-author');
      var authorBad = authorProblem(author);
      if (authorBad) return fail(authorBad);

      setState({ consultError: '', consultBusy: true });

      consultStore.add({
        consultationDate: date,
        consultationTime: time,
        type: type,
        memo: memo,
        createdBy: author,
      }).then(function (record) {
        clearKept(['consult-time', 'consult-memo', 'consult-author']);
        return loadConsultations().then(function () {
          // 상담일은 오늘로 되돌리고, 구분은 고른 값을 그대로 둡니다(같은 구분을 잇달아 적는 경우가 많아서).
          setState({
            consultBusy: false,
            consultDate: D.TODAY,
            toast: toast('ok', date === D.TODAY
              ? '오늘 상담 ' + consultLabel(record) + ' 을 등록했습니다.'
              : formatEventDate(date, '') + ' 기록으로 저장했습니다. 오늘 목록에는 표시되지 않습니다.'),
          });
          return logActivity({
            tableName: 'consultations', recordId: record.id, action: 'created',
            staffName: author,
            detail: formatEventDate(date, '') + ' ' + consultLabel(record) + ' 상담 기록'
              + (memo ? ' · 메모 ' + firstLine(memo) : ' · 메모 없음'),
          });
        });
      }).catch(function (err) {
        var message = err.message || '상담 기록을 등록하지 못했습니다.';
        setState({ consultBusy: false, consultError: message, toast: toast('error', message) });
      });
    },

    /**
     * 고른 기록 삭제. 폼이 없는 즉시 삭제라 사이드바 기록 담당 이름으로 남깁니다
     * (다른 즉시 반영 동작 — 체크 토글 · 시식 후보 삭제 — 와 같은 규칙입니다).
     */
    'consult-remove': function () {
      if (state.consultBusy) return;
      var rows = pickedConsultations();
      if (!rows.length) return;

      var problem = recorderProblem();
      if (problem) return setState({ toast: toast('error', problem) });

      var by = state.recorder;
      var ids = rows.map(function (r) { return r.id; });

      setState({ consultBusy: true, consultError: '' });

      consultStore.remove(ids).then(function (gone) {
        return loadConsultations().then(function () {
          setState({
            consultBusy: false,
            consultPicked: {},
            toast: toast('ok', '상담 기록 ' + gone.length + '건을 삭제했습니다.'),
          });
          return logActivity(gone.map(function (r) {
            return {
              tableName: 'consultations', recordId: r.id, action: 'deleted',
              staffName: by,
              detail: formatEventDate(r.consultationDate, '') + ' ' + consultLabel(r) + ' 상담 기록 삭제'
                + (r.memo ? ' · 메모 ' + firstLine(r.memo) : ''),
            };
          }));
        });
      }).catch(function (err) {
        var message = err.message || '상담 기록을 삭제하지 못했습니다.';
        setState({ consultBusy: false, toast: toast('error', message) });
      });
    },

    /* ---- 상담 → 예식 연결 ---- */

    /**
     * 연결 영역 열기. 계약완료 상담에서만 열리고, 열 때 미니폼 초기값을 채웁니다.
     * (별칭은 상담 메모에서 가져오고, 나머지는 비웁니다)
     */
    'consult-link-open': function (value) { openConsultLink(consultById(value)); },

    'consult-link-close': function () {
      setState({ consultLink: '', consultLinkError: '', consultLinkSearch: '', consultLinkAlias: '' });
    },

    'consult-link-tab': function (value) {
      if (state.consultLinkBusy) return;
      setState({ consultLinkTab: value === 'new' ? 'new' : 'existing', consultLinkError: '' });
    },

    /** 미리보기에서 "연결 변경" — 모달을 닫고 같은 자리에서 연결 영역을 엽니다. */
    'consult-link-change': function () {
      var r = consultById(state.consultPreview);
      if (!r) return setState({ consultPreview: '' });
      // 계약완료가 아닌 상담(취소 · 보류로 내린 뒤 연결만 남은 경우)은 연결 영역을 열지 않습니다.
      if (!isConsultDone(r)) {
        return setState({ consultLinkError: '계약완료 상담만 예식과 연결할 수 있습니다. 상태를 계약완료로 바꿔 주세요.' });
      }
      openConsultLink(r);
    },

    'consult-preview-open': function (value) {
      setState({ consultPreview: value, consultLinkError: '' });
    },
    'consult-preview-close': function () { setState({ consultPreview: '', consultLinkError: '' }); },

    /** 기존 예식과 연결. 고른 즉시 저장하고 화면은 그대로 둡니다. */
    'consult-link-pick': function (value) {
      if (state.consultLinkBusy) return;
      var r = consultById(state.consultLink);
      var ev = eventById(value);
      if (!r || !ev) return setState({ consultLinkError: '연결할 예식을 찾지 못했습니다. 목록을 새로 불러와 주세요.' });
      if (!isConsultDone(r)) return setState({ consultLinkError: '계약완료 상담만 예식과 연결할 수 있습니다.' });

      var problem = recorderProblem();
      if (problem) return setState({ consultLinkError: problem });
      var by = state.recorder;

      setState({ consultLinkBusy: true, consultLinkError: '' });

      consultStore.update(r.id, { linkedWeddingEventId: ev.id }).then(function (saved) {
        return loadConsultations().then(function () {
          setState({
            consultLinkBusy: false,
            consultLink: '',
            consultLinkSearch: '',
            toast: toast('ok', consultLabel(saved) + ' 상담을 ' + eventLabel(ev) + ' 예식과 연결했습니다.'),
          });
          return logActivity({
            tableName: 'consultations', recordId: saved.id, action: 'updated',
            staffName: by,
            detail: consultLabel(saved) + ' 상담 → 예식 연결 ' + eventLabel(ev),
          });
        });
      }).catch(function (err) {
        var message = err.message || '예식과 연결하지 못했습니다.';
        setState({ consultLinkBusy: false, consultLinkError: message, toast: toast('error', message) });
      });
    },

    /**
     * 새 예식으로 등록하고 곧바로 연결.
     * 예식은 예식일자 · 예식시간 · 홀 세 값으로 구분하므로 그 세 칸만 필수입니다.
     * 상담 구분과 메모는 새 예식의 스태프 메모로 넘겨, 어디서 온 예식인지 남깁니다.
     */
    'consult-link-new': function () {
      if (state.consultLinkBusy) return;
      var r = consultById(state.consultLink);
      if (!r) return;
      if (!isConsultDone(r)) return setState({ consultLinkError: '계약완료 상담만 예식과 연결할 수 있습니다.' });

      var read = function (key) {
        var el = root.querySelector('[data-keep="' + key + '"]');
        return el ? String(el.value || '').trim() : '';
      };
      var date = state.consultLinkDate;
      var time = read('conlink-time');
      var hall = read('conlink-hall');
      var alias = read('conlink-alias');

      var fail = function (message) { return setState({ consultLinkError: message }); };

      if (!weekdayOf(date)) return fail('예식 예정일을 골라 주세요.');
      if (!/^\d{2}:\d{2}$/.test(time)) return fail('예식시간을 입력해 주세요.');
      if (!hall) return fail('홀을 골라 주세요.');
      if (alias.length > 30) return fail('별칭은 30자까지 입력할 수 있습니다.');

      // 별칭도 예식기본정보와 같은 검사를 받습니다(개인정보는 저장하지 않습니다).
      var pii = piiReason(alias);
      if (pii) return fail('별칭에 ' + pii + '로 보이는 값이 있습니다. 개인정보는 저장하지 않습니다.');

      var duplicate = state.events.some(function (ev) {
        return ev.date === date && ev.time === time && ev.hall === hall;
      });
      if (duplicate) {
        return fail('같은 예식일자 · 예식시간 · 홀로 등록된 예식이 이미 있습니다. 기존 예식과 연결해 주세요.');
      }

      var problem = recorderProblem();
      if (problem) return fail(problem);
      var by = state.recorder;

      setState({ consultLinkBusy: true, consultLinkError: '' });

      // 상담에서 넘어온 정보 — 예식에는 상담 구분 칸이 없으므로 스태프 메모로 남깁니다.
      var carry = formatEventDate(r.consultationDate, r.consultationTime) + ' ' + r.type
        + ' 상담에서 연결' + (r.memo ? ' · ' + r.memo : '');

      eventStore.create({
        date: date, time: time, hall: hall, alias: alias,
        memos: [{ author: by, time: formatEventDate(D.TODAY, ''), body: carry }],
        createdBy: by, updatedBy: by,
      }).then(function (ev) {
        return consultStore.update(r.id, { linkedWeddingEventId: ev.id }).then(function (saved) {
          return Promise.all([loadEvents({ select: ev.id }), loadConsultations()]).then(function () {
            clearKept(['conlink-time', 'conlink-hall', 'conlink-alias']);
            setState({
              consultLinkBusy: false,
              consultLink: '',
              consultLinkDate: '',
              consultLinkAlias: '',
              consultLinkTab: 'existing',
              toast: toast('ok', eventLabel(ev) + ' 예식을 등록하고 이 상담과 연결했습니다.'),
            });
            return logActivity([
              {
                tableName: 'wedding_events', recordId: ev.id, action: 'created', staffName: by,
                detail: eventLabel(ev) + ' 등록 — ' + consultLabel(saved) + ' 상담에서 연결',
              },
              {
                tableName: 'consultations', recordId: saved.id, action: 'updated', staffName: by,
                detail: consultLabel(saved) + ' 상담 → 새 예식 연결 ' + eventLabel(ev),
              },
            ]);
          });
        });
      }).catch(function (err) {
        var message = err.message || '예식을 등록하지 못했습니다.';
        setState({ consultLinkBusy: false, consultLinkError: message, toast: toast('error', message) });
      });
    },

    /** 연결 해제. 상담 기록과 예식은 그대로 남고 연결만 끊깁니다. */
    'consult-link-clear': function () {
      if (state.consultLinkBusy) return;
      var r = consultById(state.consultPreview) || consultById(state.consultLink);
      if (!r || !r.linkedWeddingEventId) return;

      var problem = recorderProblem();
      if (problem) return setState({ consultLinkError: problem });
      var by = state.recorder;
      var before = linkedEventOf(r);

      setState({ consultLinkBusy: true, consultLinkError: '' });

      consultStore.update(r.id, { linkedWeddingEventId: '' }).then(function (saved) {
        return loadConsultations().then(function () {
          setState({
            consultLinkBusy: false,
            consultPreview: '',
            consultLink: '',
            toast: toast('ok', '예식 연결을 해제했습니다. 상담 기록과 예식은 그대로 남아 있습니다.'),
          });
          // 계약완료 상태라면 연결이 다시 필요하므로 그 자리에서 연결 영역을 엽니다.
          openConsultLink(saved);
          return logActivity({
            tableName: 'consultations', recordId: saved.id, action: 'updated',
            staffName: by,
            detail: consultLabel(saved) + ' 상담 → 예식 연결 해제'
              + (before ? ' (이전 ' + eventLabel(before) + ')' : ''),
          });
        });
      }).catch(function (err) {
        var message = err.message || '연결을 해제하지 못했습니다.';
        setState({ consultLinkBusy: false, consultLinkError: message, toast: toast('error', message) });
      });
    },

    /* ---- 작성자 직원 목록 · 활동 이력 ---- */

    /**
     * 직원 추가. 이 목록이 비면 아무 기록도 남길 수 없으므로,
     * 직원 관리 자체는 작성자를 요구하지 않습니다(닭과 알 문제를 피합니다).
     * 대신 기록 담당이 잡혀 있으면 그 이름으로 이력에 남습니다.
     */
    'staff-add': function () {
      var el = root.querySelector('[data-keep="staff-name"]');
      var name = el ? String(el.value || '').trim() : '';
      var by = state.recorder || '미기록';
      if (!name) return setState({ staffError: '직원 이름을 입력해 주세요.' });

      staffStore.add(name).then(function (record) {
        if (el) el.value = '';
        return loadStaff().then(function () {
          setState({ staffError: '', toast: toast('ok', '직원을 추가했습니다.') });
          return logActivity({
            tableName: 'staff', recordId: record.id, action: 'created',
            staffName: by, detail: record.name + ' 추가',
          });
        });
      }).catch(function (err) {
        var message = err.message || '직원을 추가하지 못했습니다.';
        setState({ staffError: message, toast: toast('error', message) });
      });
    },

    'staff-remove': function (value) {
      var by = state.recorder || '미기록';
      staffStore.remove(value).then(function (removed) {
        // 지운 사람이 기록 담당으로 잡혀 있었으면 함께 비웁니다.
        var patch = { staffError: '' };
        if (state.recorder === removed.name) patch.recorder = '';
        return loadStaff().then(function () {
          setState(Object.assign(patch, { toast: toast('ok', '직원을 목록에서 지웠습니다.') }));
          return logActivity({
            tableName: 'staff', recordId: removed.id, action: 'deleted',
            staffName: by, detail: removed.name + ' 삭제 (이미 남은 기록의 이름은 보존)',
          });
        });
      }).catch(function (err) {
        var message = err.message || '직원을 삭제하지 못했습니다.';
        setState({ staffError: message, toast: toast('error', message) });
      });
    },

    'logs-open': function () {
      loadLogs();
      setState({ showLogs: true });
    },
    'logs-close': function () { setState({ showLogs: false }); },

    /* ---- 예식기본정보 등록 · 수정 · 삭제 ---- */

    'event-new': function () {
      setState({
        eventForm: { mode: 'create', id: '', date: '', error: '', saving: false },
        eventDelete: null,
      });
    },

    'event-edit': function () {
      var ev = selectedEvent();
      if (!ev) return;
      // 폼을 열 때 저장된 값을 입력칸에 미리 채웁니다(수정 = 인라인 편집 모드).
      setState({
        eventId: ev.id,
        eventForm: { mode: 'edit', id: ev.id, date: ev.date, error: '', saving: false },
        eventDelete: null,
      });
    },

    'event-form-cancel': function () {
      clearKept(['ev-time', 'ev-hall', 'ev-alias']);
      setState({ eventForm: null });
    },

    'events-retry': function () { loadEvents(); },

    /**
     * 등록 · 수정 저장. 필수 세 값(예식일자 · 예식시간 · 홀)이 비어 있으면
     * 저장하지 않고 폼에 사유를 띄웁니다.
     */
    'event-form-save': function () {
      var form = state.eventForm;
      if (!form || form.saving) return;

      var read = function (key) {
        var el = root.querySelector('[data-keep="' + key + '"]');
        return el ? String(el.value || '').trim() : '';
      };

      var draft = {
        date: String(form.date || '').trim(),
        time: read('ev-time'),
        hall: read('ev-hall'),
        alias: read('ev-alias'),
      };

      var fail = function (message) {
        return setState({ eventForm: Object.assign({}, form, { error: message, saving: false }) });
      };

      if (!weekdayOf(draft.date)) return fail('예식일자를 선택해 주세요.');
      if (!/^\d{2}:\d{2}$/.test(draft.time)) return fail('예식시간을 입력해 주세요.');
      if (!draft.hall) return fail('홀을 선택해 주세요.');
      if (draft.alias.length > 30) return fail('별칭은 30자까지 입력할 수 있습니다.');

      // 별칭에 개인정보가 섞이면 저장하지 않습니다(설계상 두지 않는 값입니다).
      var pii = piiReason(draft.alias);
      if (pii) return fail('별칭에 ' + pii + '로 보이는 값이 있습니다. 개인정보는 저장하지 않습니다.');

      // 예식은 날짜 · 시간 · 홀로 구분하므로 세 값이 모두 같은 예식은 둘 수 없습니다.
      var duplicate = state.events.some(function (r) {
        return r.id !== form.id && r.date === draft.date && r.time === draft.time && r.hall === draft.hall;
      });
      if (duplicate) return fail('같은 예식일자 · 예식시간 · 홀로 등록된 예식이 이미 있습니다.');

      // 작성자는 로그인 계정에서 채우지 않고 기록마다 직접 고릅니다.
      var author = readAuthor('ev-author');
      var authorBad = authorProblem(author);
      if (authorBad) return fail(authorBad);

      setState({ eventForm: Object.assign({}, form, { error: '', saving: true }) });

      var saving = form.mode === 'edit'
        ? eventStore.update(form.id, Object.assign({}, draft, { updatedBy: author }))
        : eventStore.create(Object.assign({}, draft, { createdBy: author, updatedBy: author }));

      saving.then(function (record) {
        clearKept(['ev-time', 'ev-hall', 'ev-alias', 'ev-author']);
        logActivity({
          tableName: 'wedding_events',
          recordId: record.id,
          action: form.mode === 'edit' ? 'updated' : 'created',
          staffName: author,
          detail: eventLabel(record) + (record.alias ? ' · ' + record.alias : ''),
        });
        return loadEvents({ select: record.id }).then(function () {
          setState({
            eventForm: null,
            // 등록을 마치면 그 예식의 체크리스트 화면으로 옮겨 갑니다.
            screen: form.mode === 'edit' ? state.screen : 'checklist',
            toast: toast('ok', form.mode === 'edit' ? '예식기본정보를 수정했습니다.' : '예식을 등록했습니다.'),
          });
        });
      }).catch(function (err) {
        setState({
          eventForm: Object.assign({}, state.eventForm || form, {
            error: err.message || '저장하지 못했습니다.',
            saving: false,
          }),
          toast: toast('error', err.message || '저장하지 못했습니다.'),
        });
      });
    },

    'event-del-open': function () {
      var ev = selectedEvent();
      if (!ev) return;
      setState({
        eventForm: null,
        eventDelete: { id: ev.id, stage: 'select', whole: false, picked: {}, error: '', busy: false },
      });
    },

    'event-del-close': function () { setState({ eventDelete: null }); },

    'event-del-whole': function () {
      var del = state.eventDelete;
      if (!del || del.busy) return;
      setState({ eventDelete: Object.assign({}, del, { whole: !del.whole, error: '' }) });
    },

    'event-del-pick': function (value) {
      var del = state.eventDelete;
      if (!del || del.whole || del.busy) return;
      var picked = Object.assign({}, del.picked);
      if (picked[value]) delete picked[value]; else picked[value] = true;
      setState({ eventDelete: Object.assign({}, del, { picked: picked, error: '' }) });
    },

    'event-del-all': function () {
      var del = state.eventDelete;
      if (!del || del.whole || del.busy) return;
      var subs = eventSubItems(eventById(del.id));
      var allPicked = subs.length > 0 && subs.every(function (it) { return del.picked[it.key]; });
      var picked = {};
      if (!allPicked) subs.forEach(function (it) { picked[it.key] = true; });
      setState({ eventDelete: Object.assign({}, del, { picked: picked, error: '' }) });
    },

    'event-del-next': function () {
      var del = state.eventDelete;
      if (!del) return;
      var picked = Object.keys(del.picked).length;
      if (!del.whole && !picked) {
        return setState({ eventDelete: Object.assign({}, del, { error: '삭제할 항목을 하나 이상 골라 주세요.' }) });
      }
      setState({ eventDelete: Object.assign({}, del, { stage: 'confirm', error: '' }) });
    },

    'event-del-back': function () {
      var del = state.eventDelete;
      if (!del || del.busy) return;
      setState({ eventDelete: Object.assign({}, del, { stage: 'select', error: '' }) });
    },

    /** 확인 모달의 삭제 버튼. 예식 전체 삭제와 선택 항목만 삭제를 나눠 처리합니다. */
    'event-del-confirm': function () {
      var del = state.eventDelete;
      if (!del || del.busy) return;
      var ev = eventById(del.id);
      if (!ev) return setState({ eventDelete: null });

      var subs = eventSubItems(ev);
      var count = del.whole ? subs.length + 1 : Object.keys(del.picked).length;

      var author = readAuthor('evdel-author');
      var authorBad = authorProblem(author);
      if (authorBad) {
        return setState({ eventDelete: Object.assign({}, del, { error: authorBad }) });
      }

      // 지워지기 전에 무엇을 지우는지 적어 둡니다(삭제되면 원본이 사라지므로).
      var logRows = del.whole
        ? [{
            tableName: 'wedding_events', recordId: ev.id, action: 'deleted', staffName: author,
            detail: '예식 전체 삭제 — ' + eventLabel(ev) + ' (하위 항목 ' + subs.length + '개 포함)',
          }]
        : subs.filter(function (it) { return del.picked[it.key]; }).map(function (it) {
            return {
              tableName: 'wedding_events', recordId: ev.id, action: 'deleted', staffName: author,
              detail: eventLabel(ev) + ' — ' + it.label + ' 삭제',
            };
          });

      setState({ eventDelete: Object.assign({}, del, { busy: true, error: '' }) });

      var work;
      if (del.whole) {
        // 예식이 사라지면 그 예식을 가리키던 상담 연결도 함께 끊습니다.
        work = eventStore.remove(ev.id).then(function (rest) {
          return consultStore.unlinkEvent(ev.id).then(function (unlinked) {
            if (unlinked.length) {
              logRows = logRows.concat(unlinked.map(function (r) {
                return {
                  tableName: 'consultations', recordId: r.id, action: 'updated', staffName: author,
                  detail: consultLabel(r) + ' 상담 → 예식 삭제로 연결 해제 (' + eventLabel(ev) + ')',
                };
              }));
            }
            return loadConsultations().then(function () { return rest; });
          }).catch(function () { return rest; });
        });
      } else {
        // 고른 하위 항목만 뺀 사본을 만들어 통째로 덮어씁니다.
        var next = Object.assign({}, ev, {
          checks: del.picked['checks'] ? clearedChecks(ev) : Object.assign({}, ev.checks),
          files: ev.files.filter(function (f, i) { return !del.picked['file:' + i]; }),
          memos: ev.memos.filter(function (m, i) { return !del.picked['memo:' + i]; }),
        });
        work = eventStore.replace(next);
      }

      work.then(function () {
        logActivity(logRows);
        return loadEvents({ select: del.whole ? '' : ev.id }).then(function () {
          setState({
            eventDelete: null,
            toast: toast('ok', '선택한 ' + count + '개 항목을 삭제했습니다.'),
          });
        });
      }).catch(function (err) {
        setState({
          eventDelete: Object.assign({}, state.eventDelete || del, {
            busy: false,
            error: err.message || '삭제하지 못했습니다.',
          }),
          toast: toast('error', err.message || '삭제하지 못했습니다.'),
        });
      });
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

      var author = readAuthor('edit-by');
      var authorBad = authorProblem(author);
      if (authorBad) return setState({ editError: authorBad });

      Object.assign(record, values, { updatedBy: author, updatedAt: nowIso() });
      logActivity({
        tableName: EDIT_TABLES[state.editing.kind] || state.editing.kind,
        recordId: String(record.id),
        action: 'updated',
        staffName: author,
        detail: form.what + ' — ' + form.name(record),
      });
      setState({ editing: null, editError: '' });
    },

    'delete-open': function (value) {
      var at = value.indexOf(':');
      setState({
        deleting: { kind: value.slice(0, at), id: value.slice(at + 1) },
        editing: null,
        editError: '',
      });
    },
    'delete-close': function () { setState({ deleting: null }); },

    'delete-confirm': function () {
      if (!state.deleting) return;
      var kind = state.deleting.kind;
      var form = EDIT_FORMS[kind];
      var record = recordOf(kind, state.deleting.id);
      if (!form || !record) return setState({ deleting: null });

      var author = readAuthor('del-by');
      var authorBad = authorProblem(author);
      if (authorBad) return setState({ editError: authorBad });

      // 지워지기 전에 무엇을 지우는지 적어 둡니다.
      logActivity({
        tableName: EDIT_TABLES[kind] || kind,
        recordId: String(record.id),
        action: 'deleted',
        staffName: author,
        detail: form.what + ' — ' + form.name(record) + ' 삭제',
      });

      var patch = { deleting: null, editError: '' };
      patch[form.list] = state[form.list].filter(function (r) { return r !== record; });

      // 예식을 지우면 그 예식의 시식 예약도 함께 사라집니다(주인 없는 예약이 남지 않도록).
      if (kind === 'customer') {
        patch.tastings = state.tastings.filter(function (t) { return t.cid !== record.id; });
        // 주인 없는 시식 후보가 남지 않게 함께 지웁니다.
        candidateStore.removeFor(record.id).then(loadCandidates).catch(function () { /* 이력만 남습니다 */ });
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
      var author = fields['post-author'] ? (fields['post-author'].value || '').trim() : '';

      if (!title || !body) {
        return setState({ postError: '제목과 내용을 모두 입력해 주세요.' });
      }
      var authorBad = authorProblem(author);
      if (authorBad) return setState({ postError: authorBad });

      var now = new Date();
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      var post = {
        id: 'p' + (state.posts.length + 1) + '-' + now.getTime(),
        time: '오늘 ' + pad(now.getHours()) + ':' + pad(now.getMinutes()),
        author: author,
        title: title,
        body: body,
        done: false,
        createdBy: author,
        updatedBy: author,
        updatedAt: nowIso(),
      };

      // 다시 그릴 때 입력값이 복원되지 않도록 폼을 먼저 비웁니다.
      // 작성자도 함께 비워, 다음 글에서 또 직접 고르게 합니다.
      fields['post-title'].value = '';
      fields['post-body'].value = '';
      if (fields['post-author']) fields['post-author'].value = '';

      setState({ posts: [post].concat(state.posts), postError: '', boardFilter: '전체' });
      logActivity({
        tableName: 'notices', recordId: post.id, action: 'created',
        staffName: author, detail: title,
      });

      var next = root.querySelector('[data-keep="post-title"]');
      if (next) next.focus();
    },
    'toggle-attend': function (value) {
      var problem = recorderProblem();
      if (problem) return setState({ toast: toast('error', problem) });
      var next = toggleKey(state.attended, value, false);
      setState({ attended: next });
      logActivity({
        tableName: 'tastings', recordId: String(value), action: 'updated',
        staffName: state.recorder,
        detail: '시식 참석 ' + (next[value] ? '체크' : '해제'),
      });
    },

    /* ---- 관리자 대시보드 · 회원 관리 ---- */

    'member-filter': function (value) { setState({ memberFilter: value }); },

    /** 상태 배지를 누르면 활성 → 승인 대기 → 휴면 순으로 돌아갑니다. */
    'member-cycle-status': function (value) {
      var problem = recorderProblem();
      if (problem) return setState({ toast: toast('error', problem) });
      var member = recordOf('member', value);
      if (!member) return;
      var order = D.MEMBER_STATUSES;
      var at = order.indexOf(member.status);
      member.status = order[(at + 1) % order.length];
      member.updatedBy = state.recorder;
      member.updatedAt = nowIso();
      setState({});
      logActivity({
        tableName: 'members', recordId: String(member.id), action: 'updated',
        staffName: state.recorder,
        detail: member.name + ' 상태 → ' + member.status,
      });
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
      var author = readAuthor('member-author');
      var authorBad = authorProblem(author);
      if (authorBad) return setState({ memberError: authorBad });
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

  /**
   * 보는 예식 변경. select 는 클릭으로도 잡히기 때문에 ACTIONS 에 두지 않고
   * change 전용 함수로 둡니다(그러지 않으면 data-value 없이 불려 값이 비워집니다).
   */
  function pickEvent(value) {
    if (!value || value === state.eventId) return;
    setState({ eventId: value, eventForm: null, eventDelete: null });
  }

  /**
   * 예식 연결 영역 열기 — 상태 변경 · "연결 필요" 배지 · 연결 변경 · 연결 해제가 모두 이 창구를 씁니다.
   * 새 예식 미니폼의 별칭은 이 상담의 메모에서 가져옵니다(별칭 칸은 30자까지).
   */
  function openConsultLink(r) {
    if (!r || !isConsultDone(r)) return;
    setState({
      consultLink: r.id,
      consultLinkTab: 'existing',
      consultLinkSearch: '',
      consultLinkDate: '',
      consultLinkAlias: (r.memo || '').slice(0, 30),
      consultLinkError: '',
      consultPreview: '',
    });
  }

  /**
   * 상담 상태 변경. 폼이 없는 즉시 반영이라 사이드바 기록 담당 이름으로 남깁니다.
   * 계약완료로 바뀌고 아직 연결이 없으면 그 자리에서 예식 연결 영역을 펼칩니다.
   * 상담취소 · 보류로 바뀌면 열려 있던 연결 영역을 닫습니다(연결할 예식이 없는 상태이므로).
   *
   * select 는 클릭으로도 잡히기 때문에 ACTIONS 에 두지 않고 change 전용 함수로 둡니다.
   */
  function setConsultStatus(id, next) {
    var r = consultById(id);
    if (!r || state.consultLinkBusy) return;
    var status = String(next || '');
    if (D.CONSULT_STATUSES.indexOf(status) < 0 || status === r.status) return;

    var problem = recorderProblem();
    // 기록 담당이 없으면 저장하지 않고, 고른 값도 원래 상태로 되돌립니다.
    if (problem) return setState({ toast: toast('error', problem) });

    var by = state.recorder;
    var before = r.status;
    setState({ consultLinkBusy: true, consultLinkError: '' });

    consultStore.update(r.id, { status: status }).then(function (saved) {
      return loadConsultations().then(function () {
        var done = saved.status === '계약완료';
        var needsLink = done && !saved.linkedWeddingEventId;
        setState({
          consultLinkBusy: false,
          // 계약완료가 아니게 되면 열려 있던 연결 영역을 닫습니다.
          consultLink: done || state.consultLink !== saved.id ? state.consultLink : '',
          toast: toast('ok', consultLabel(saved) + ' 상담 상태를 ' + saved.status + '으로 바꿨습니다.'
            + (needsLink ? ' 예식 연결을 이어서 진행해 주세요.' : '')),
        });
        // 계약완료로 바뀌었는데 아직 연결이 없으면 그 자리에서 연결 영역을 펼칩니다.
        if (needsLink) openConsultLink(saved);
        return logActivity({
          tableName: 'consultations', recordId: saved.id, action: 'updated',
          staffName: by,
          detail: formatEventDate(saved.consultationDate, '') + ' ' + consultLabel(saved)
            + ' 상담 상태 ' + before + ' → ' + saved.status,
        });
      });
    }).catch(function (err) {
      var message = err.message || '상담 상태를 바꾸지 못했습니다.';
      setState({ consultLinkBusy: false, toast: toast('error', message) });
    });
  }

  /** 예식일자 입력 반영. 값이 그대로면 다시 그리지 않습니다. */
  function setEventFormDate(value) {
    var form = state.eventForm;
    if (!form || form.saving || form.date === value) return;
    setState({ eventForm: Object.assign({}, form, { date: value, error: '' }) });
  }

  function closeTopOverlay() {
    if (state.showMobile) setState({ showMobile: false });
    else if (state.consultPreview) setState({ consultPreview: '', consultLinkError: '' });
    else if (state.showLogs) setState({ showLogs: false });
    else if (state.showShare) setState({ showShare: false });
    else if (state.itemDelete) setState({ itemDelete: null });
    else if (state.eventDelete) setState({ eventDelete: null });
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
      if (el.dataset.action === 'consult-link-search') setState({ consultLinkSearch: el.value });
      // 예식일자가 바뀌면 요일 칸을 다시 계산해 그립니다.
      if (el.dataset.action === 'event-form-date') setEventFormDate(el.value);
    });

    root.addEventListener('change', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) return;
      switch (el.dataset.action) {
        case 'set-wedding': setState({ wedding: el.value }); break;
        case 'set-tasting-date': setState({ tastingDate: el.value }); break;
        case 'set-cand-date': setState({ candDate: el.value, candError: '' }); break;
        case 'set-consult-date': setState({ consultDate: el.value, consultError: '' }); break;
        case 'set-consult-link-date': setState({ consultLinkDate: el.value, consultLinkError: '' }); break;
        // 상태 select 는 클릭으로도 잡히므로 ACTIONS 에 두지 않고 change 에서만 다룹니다.
        case 'consult-status': setConsultStatus(el.dataset.value, el.value); break;
        case 'toggle-tasting-done': setState({ tastingDone: el.checked }); break;
        case 'event-form-date': setEventFormDate(el.value); break;
        case 'event-pick': pickEvent(el.value); break;
        // select 는 클릭으로도 잡히므로 ACTIONS 에 두지 않습니다.
        case 'recorder-pick': setState({ recorder: el.value }); break;
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
    render();   // 로그인 화면은 저장소를 기다리지 않고 먼저 그립니다.

    // 첫 방문이면 시연용 예식 · 직원 목록을 넣고, 그 다음 저장된 값을 불러옵니다.
    eventStore.seed(SEED_EVENTS).catch(function () { /* 저장 불가 환경은 list() 에서 안내 */ })
      .then(function () { return loadEvents(); });

    staffStore.seed(D.STAFF_SEED).catch(function () { /* 아래 loadStaff 에서 안내 */ })
      .then(function () { return loadStaff(); })
      .then(function () { return loadLogs(); })
      .then(function () { return loadCandidates(); });

    consultStore.seed(SEED_CONSULTATIONS).catch(function () { /* loadConsultations 에서 안내 */ })
      .then(function () { return loadConsultations(); });

    /**
     * 다른 탭에서 저장소가 바뀌면 이 탭도 바로 다시 읽습니다.
     * 신랑신부가 공유 링크 화면(다른 탭)에서 시식 일정을 확정하면
     * 예약실 화면이 새로고침 없이 갱신됩니다. (storage 이벤트는 다른 탭에서만 옵니다)
     */
    window.addEventListener('storage', function (e) {
      if (!e.key) return;
      if (e.key === 'wdc:v1:candidates') loadCandidates();
      else if (e.key === 'wdc:v1:events') loadEvents();
      else if (e.key === 'wdc:v1:staff') loadStaff();
      else if (e.key === 'wdc:v1:logs') loadLogs();
      else if (e.key === 'wdc:v1:consultations') loadConsultations();
    });
  });
})();
