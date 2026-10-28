/*
 * AI MUSIC LAB – Hoạt động 6: Báo cáo kết quả luyện tập
 *
 * Mọi con số trong báo cáo được tính từ nhật ký luyện tập (js/practice-log.js) – không có số liệu nào khác.
 *
 * CÁCH TÍNH:
 *  - Một "câu" là một câu hỏi học sinh đã trả lời ít nhất một lần: một câu Tìm nốt, Nghe cao độ, Trắc nghiệm,
 *    hoặc một nốt trong bài Kéo thả.
 *  - Đúng/sai của câu = kết quả LẦN TRẢ LỜI ĐẦU TIÊN. Các lần làm lại sau khi sai được đếm riêng.
 *  - Tỷ lệ trả lời đúng = số câu đúng / số câu.
 *  - Nốt hay nhầm: nốt có từ MIN_MISSES câu sai trở lên (tính lần trả lời đầu). Ít hơn thì báo "chưa đủ dữ liệu".
 *  - Khám phá và Phòng sáng tạo không có đúng/sai nên chỉ đếm số lần thao tác.
 */
(function (global) {
  'use strict';

  var shared = global.AppShared;
  var escapeHtml = shared.escapeHtml;
  var MIN_MISSES = 2;
  var MAX_MISTAKES_SHOWN = 10;
  var CONFIRM_MS = 3000;
  var FILE_TYPE = 'ai-music-lab/bao-cao';

  var ACTIVITIES = [
    { key: 'khuong-nhac', name: 'Khuông nhạc tương tác' },
    { key: 'nghe-cao-do', name: 'Nghe cao độ' },
    { key: 'trac-nghiem', name: 'Trắc nghiệm' },
    { key: 'keo-tha', name: 'Kéo thả nốt' },
    { key: 'sang-tao', name: 'Phòng sáng tạo giai điệu' }
  ];
  var ACTION_NAMES = {
    explore: 'lần chạm nốt ở chế độ Khám phá',
    play: 'lần phát giai điệu',
    'save-json': 'lần lưu file giai điệu',
    'save-image': 'lần lưu ảnh giai điệu',
    open: 'lần mở file giai điệu',
    'check-beats': 'lần kiểm tra nhịp'
  };

  function activityName(key) {
    for (var i = 0; i < ACTIVITIES.length; i++) if (ACTIVITIES[i].key === key) return ACTIVITIES[i].name;
    return key;
  }

  // ---------- Thời gian (giờ địa phương của máy) ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function clock(date) { return pad(date.getHours()) + ':' + pad(date.getMinutes()); }
  function day(date) { return pad(date.getDate()) + '/' + pad(date.getMonth() + 1) + '/' + date.getFullYear(); }
  function formatTime(iso) { var d = new Date(iso); return clock(d) + ', ' + day(d); }
  function stamp(iso) {
    var d = new Date(iso);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + clock(d) + ':' + pad(d.getSeconds());
  }

  function formatRange(fromIso, toIso) {
    var a = new Date(fromIso), b = new Date(toIso);
    return day(a) === day(b) ? clock(a) + ' – ' + clock(b) + ', ' + day(a) : formatTime(fromIso) + ' – ' + formatTime(toIso);
  }

  function formatDuration(fromIso, toIso) {
    var minutes = Math.round((new Date(toIso) - new Date(fromIso)) / 60000);
    return minutes < 1 ? 'dưới 1 phút' : 'khoảng ' + minutes + ' phút';
  }

  // ---------- Tính toán ----------
  function emptyCounts() { return { questions: 0, correct: 0, wrong: 0, retries: 0 }; }

  function addAnswer(counts, entry) {
    if (!entry.first) { counts.retries += 1; return; }
    counts.questions += 1;
    if (entry.correct) counts.correct += 1; else counts.wrong += 1;
  }

  function rateOf(counts) {
    return counts.questions ? counts.correct / counts.questions : null;
  }

  /*
   * Tổng hợp một danh sách phiên. Trả về:
   * { sessions, entries, firstTime, lastTime, totals, rate, activities[], notes[], trouble[] }
   */
  function summarize(sessions) {
    var entries = [];
    sessions.forEach(function (s) { entries = entries.concat(s.entries); });
    var totals = emptyCounts();
    var byActivity = {};
    var byNote = {};
    var pairs = {};
    var firstTime = null, lastTime = null;
    global.MusicNotes.NOTES.forEach(function (n) { byNote[n.id] = emptyCounts(); });

    entries.forEach(function (e) {
      if (!firstTime || e.time < firstTime) firstTime = e.time;
      if (!lastTime || e.time > lastTime) lastTime = e.time;
      var a = byActivity[e.activity];
      if (!a) {
        a = byActivity[e.activity] = { counts: emptyCounts(), modes: {}, modeOrder: [], actions: {}, mistakes: [],
          firstTime: e.time, lastTime: e.time };
      }
      if (e.time < a.firstTime) a.firstTime = e.time;
      if (e.time > a.lastTime) a.lastTime = e.time;

      if (e.kind !== 'answer') {
        a.actions[e.action] = (a.actions[e.action] || 0) + 1;
        return;
      }
      addAnswer(totals, e);
      addAnswer(a.counts, e);
      if (!a.modes[e.mode]) { a.modes[e.mode] = emptyCounts(); a.modeOrder.push(e.mode); }
      addAnswer(a.modes[e.mode], e);
      if (byNote[e.target]) addAnswer(byNote[e.target], e);
      if (e.first && !e.correct) {
        a.mistakes.push(e);
        if (byNote[e.target] && byNote[e.given]) {
          var key = e.target + '>' + e.given;
          pairs[key] = (pairs[key] || 0) + 1;
        }
      }
    });

    var notes = global.MusicNotes.NOTES.map(function (n) {
      var c = byNote[n.id];
      return { noteId: n.id, label: n.label, questions: c.questions, correct: c.correct, wrong: c.wrong, retries: c.retries };
    });

    var trouble = notes.filter(function (n) { return n.wrong >= MIN_MISSES; })
      .sort(function (x, y) { return y.wrong - x.wrong; })
      .map(function (n) {
        var confusions = Object.keys(pairs).filter(function (k) { return k.split('>')[0] === n.noteId; })
          .map(function (k) {
            var other = global.MusicNotes.findNote(k.split('>')[1]);
            return { noteId: other.id, label: other.label, count: pairs[k] };
          })
          .sort(function (x, y) { return y.count - x.count; });
        return { noteId: n.noteId, label: n.label, wrong: n.wrong, questions: n.questions, confusedWith: confusions };
      });

    var activities = ACTIVITIES.filter(function (def) { return byActivity[def.key]; }).map(function (def) {
      var a = byActivity[def.key];
      return {
        key: def.key,
        name: def.name,
        questions: a.counts.questions,
        correct: a.counts.correct,
        wrong: a.counts.wrong,
        retries: a.counts.retries,
        rate: rateOf(a.counts),
        firstTime: a.firstTime,
        lastTime: a.lastTime,
        modes: a.modeOrder.map(function (m) {
          var c = a.modes[m];
          return { mode: m, questions: c.questions, correct: c.correct, wrong: c.wrong, rate: rateOf(c) };
        }),
        actions: Object.keys(a.actions).map(function (k) { return { action: k, name: ACTION_NAMES[k] || k, count: a.actions[k] }; }),
        mistakes: a.mistakes
      };
    });

    return {
      sessions: sessions.length,
      entries: entries.length,
      firstTime: firstTime,
      lastTime: lastTime,
      totals: totals,
      rate: rateOf(totals),
      activities: activities,
      notes: notes,
      trouble: trouble
    };
  }

  function percentText(rate) {
    return rate === null ? '—' : Math.round(rate * 100) + '%';
  }

  // ---------- Xuất file ----------
  var CSV_COLUMNS = ['Phiên', 'Thời điểm', 'Hoạt động', 'Chế độ / dạng câu / thao tác', 'Câu số',
    'Lần trả lời', 'Đáp án đúng', 'Em chọn', 'Kết quả'];

  function csvCell(value) {
    var text = value === null || value === undefined ? '' : String(value);
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  /*
   * CSV: mỗi dòng là một lần trả lời hoặc một thao tác, đúng như trong nhật ký.
   * Có ký tự BOM ở đầu để Excel đọc đúng chữ tiếng Việt (UTF-8).
   */
  function toCsv(sessions) {
    var rows = [CSV_COLUMNS];
    sessions.forEach(function (s, index) {
      s.entries.forEach(function (e) {
        rows.push(e.kind === 'answer'
          ? [index + 1, stamp(e.time), activityName(e.activity), e.mode, e.item, e.first ? 'Lần đầu' : 'Làm lại',
            e.targetText, e.givenText, e.correct ? 'Đúng' : 'Sai']
          : [index + 1, stamp(e.time), activityName(e.activity), e.detail, '', '', '', '', '']);
      });
    });
    return '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }

  function toJson(sessions, scopeName, exportedAt) {
    var summary = summarize(sessions);
    return {
      app: 'AI MUSIC LAB',
      type: FILE_TYPE,
      version: 1,
      exportedAt: exportedAt.toISOString(),
      scope: scopeName,
      note: 'Dữ liệu ghi trong trình duyệt trên một máy, không có họ tên học sinh. ' +
        'Mỗi câu tính theo lần trả lời đầu tiên; lần làm lại được đếm riêng.',
      summary: {
        sessions: summary.sessions,
        firstTime: summary.firstTime,
        lastTime: summary.lastTime,
        questions: summary.totals.questions,
        correct: summary.totals.correct,
        wrong: summary.totals.wrong,
        retries: summary.totals.retries,
        rate: summary.rate === null ? null : Math.round(summary.rate * 1000) / 1000,
        activities: summary.activities.map(function (a) {
          return { key: a.key, name: a.name, questions: a.questions, correct: a.correct, wrong: a.wrong,
            retries: a.retries, modes: a.modes, actions: a.actions };
        }),
        notes: summary.notes,
        frequentlyConfused: summary.trouble
      },
      sessions: sessions
    };
  }

  // ---------- Giao diện ----------
  var TEMPLATE =
    '<div class="activity-head">' +
      '<h2 class="activity-title">Báo cáo kết quả luyện tập</h2>' +
      '<div class="mode-switch no-print" role="tablist" aria-label="Phạm vi báo cáo">' +
        '<button type="button" role="tab" data-scope="session" aria-selected="true">Phiên này</button>' +
        '<button type="button" role="tab" data-scope="all" aria-selected="false">Tất cả các phiên trên máy này</button>' +
      '</div>' +
    '</div>' +
    '<div class="report-storage no-print" data-ref="storageBox"></div>' +
    '<p class="print-only report-print-head" data-ref="printHead"></p>' +
    '<div class="report-body" data-ref="body" aria-live="polite"></div>' +
    '<div class="toolbar report-actions no-print">' +
      '<button type="button" class="btn btn-primary" data-ref="exportCsv">⬇ Xuất CSV</button>' +
      '<button type="button" class="btn btn-secondary" data-ref="exportJson">⬇ Xuất JSON</button>' +
      '<button type="button" class="btn btn-ghost" data-ref="printButton">🖨 In báo cáo</button>' +
    '</div>' +
    '<p class="find-feedback no-print" data-ref="message" role="status">&nbsp;</p>' +
    '<p class="honest-note">Báo cáo chỉ tính từ các câu học sinh đã thực sự trả lời trên máy này. ' +
      'Không có họ tên, không gửi dữ liệu lên mạng, không đồng bộ giữa các máy. Báo cáo không dùng AI.</p>';

  /*
   * options.log      – nhật ký luyện tập (mặc định PracticeLog.current)
   * options.download – hàm (tênFile, blob) để lưu file (mặc định tải về bằng trình duyệt)
   * options.now      – hàm trả về thời điểm hiện tại
   * options.print    – hàm in (mặc định window.print)
   * options.reload   – hàm tải lại trang để bắt đầu phiên mới (mặc định location.reload)
   */
  function mount(root, options) {
    options = options || {};
    var log = options.log || global.PracticeLog.current;
    var download = options.download || shared.downloadBlob;
    var now = options.now || function () { return new Date(); };
    var print = options.print || function () { global.print(); };
    var reload = options.reload || function () { global.location.reload(); };

    root.classList.add('activity', 'report');
    root.innerHTML = TEMPLATE;
    var refs = shared.collectRefs(root);
    var scopeButtons = root.querySelectorAll('[data-scope]');
    var state = { scope: 'session' };
    var confirmTimers = {};

    function sessionsInScope() {
      if (state.scope === 'all') return log.allSessions();
      var current = log.currentSession();
      return current.entries.length ? [current] : [];
    }

    function scopeName() {
      return state.scope === 'all' ? 'Tất cả các phiên trên máy này' : 'Phiên này';
    }

    function setMessage(text, kind) {
      refs.message.className = 'find-feedback no-print' + (kind ? ' ' + kind : '');
      refs.message.textContent = text || ' ';
    }

    // Nút cần bấm hai lần (xóa dữ liệu, bắt đầu phiên mới khi chưa lưu).
    function confirmTwice(button, question, action) {
      if (!button.classList.contains('is-confirming')) {
        button.dataset.label = button.textContent;
        button.classList.add('is-confirming');
        button.textContent = question;
        confirmTimers[button.dataset.ref] = setTimeout(function () { resetConfirm(button); }, CONFIRM_MS);
        return;
      }
      resetConfirm(button);
      action();
    }

    function resetConfirm(button) {
      clearTimeout(confirmTimers[button.dataset.ref]);
      if (!button.classList.contains('is-confirming')) return;
      button.classList.remove('is-confirming');
      button.textContent = button.dataset.label;
    }

    // ---------- Khung "dữ liệu nằm ở đâu" ----------
    function renderStorage() {
      var saving = log.savingEnabled();
      var saved = log.savedSessions().length;
      var text;
      if (!log.storageAvailable()) {
        text = 'Trình duyệt này không cho lưu dữ liệu trên máy. Kết quả chỉ có trong lần mở trang này – ' +
          'hãy xuất file CSV/JSON trước khi đóng trang.';
      } else if (saving) {
        text = 'Đang lưu kết quả trong trình duyệt trên máy này (' + saved + ' phiên đã lưu). ' +
          'Dữ liệu không gửi lên mạng và không đồng bộ sang máy khác. ' +
          'Nếu nhiều em dùng chung máy, kết quả sẽ gộp chung ở mục “Tất cả các phiên”.';
      } else {
        text = 'Kết quả hiện chỉ có trong lần mở trang này: tải lại hoặc đóng trang là mất. ' +
          'Muốn xem lại ở lần sau, hãy bật lưu bên dưới hoặc xuất file CSV/JSON.' +
          (saved ? ' Trên máy này còn ' + saved + ' phiên đã lưu từ trước.' : '');
      }
      refs.storageBox.innerHTML =
        '<p class="report-storage-text" data-ref-storage-text>' + escapeHtml(text) + '</p>' +
        '<div class="toolbar">' +
          '<label class="switch">' +
            '<input type="checkbox" data-ref-saving' + (saving ? ' checked' : '') + (log.storageAvailable() ? '' : ' disabled') + '>' +
            '<span class="switch-track" aria-hidden="true"></span>' +
            '<span class="switch-text">Lưu kết quả trên máy này để xem lại lần sau</span>' +
          '</label>' +
          '<button type="button" class="btn btn-ghost btn-small" data-ref="clearSaved"' + (saved ? '' : ' disabled') +
            '>🗑 Xóa dữ liệu đã lưu</button>' +
          '<button type="button" class="btn btn-ghost btn-small" data-ref="newSession">↻ Bắt đầu phiên mới</button>' +
        '</div>';
      refs.clearSaved = refs.storageBox.querySelector('[data-ref="clearSaved"]');
      refs.newSession = refs.storageBox.querySelector('[data-ref="newSession"]');
    }

    // ---------- Nội dung báo cáo ----------
    function statBox(key, label, value) {
      return '<div><dt>' + label + '</dt><dd data-stat="' + key + '">' + value + '</dd></div>';
    }

    function countsRow(cells) {
      return '<tr>' + cells.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
    }

    function actionsText(actions) {
      return actions.map(function (a) { return a.count + ' ' + a.name; }).join(', ');
    }

    function overviewHtml(sum) {
      var facts = [
        '<li>Thời điểm luyện tập: <strong data-fact="time">' + escapeHtml(formatRange(sum.firstTime, sum.lastTime)) +
          '</strong> (' + formatDuration(sum.firstTime, sum.lastTime) + ')</li>',
        '<li>Hoạt động đã tham gia: <strong data-fact="activities">' +
          escapeHtml(sum.activities.map(function (a) { return a.name; }).join(', ')) + '</strong></li>',
        '<li>Số lần làm lại sau khi trả lời sai: <strong data-fact="retries">' + sum.totals.retries + '</strong></li>'
      ];
      if (state.scope === 'all') facts.unshift('<li>Số phiên: <strong data-fact="sessions">' + sum.sessions + '</strong></li>');
      return '<section class="report-section" data-section="overview">' +
        '<h3>Tổng quan – ' + escapeHtml(scopeName()) + '</h3>' +
        '<dl class="stats report-stats">' +
          statBox('questions', 'Số câu đã trả lời', sum.totals.questions) +
          statBox('correct', 'Số câu đúng', sum.totals.correct) +
          statBox('wrong', 'Số câu sai', sum.totals.wrong) +
          statBox('rate', 'Tỷ lệ trả lời đúng', percentText(sum.rate)) +
        '</dl>' +
        '<ul class="report-facts">' + facts.join('') + '</ul>' +
      '</section>';
    }

    // Gợi ý luyện tập tiếp theo – theo quy tắc trong js/practice-advisor.js, không dùng AI.
    function adviceHtml(sum) {
      var items = global.PracticeAdvisor.suggest(sum);
      var few = sum.totals.questions < global.PracticeAdvisor.MIN_QUESTIONS;
      return '<section class="report-section report-advice" data-section="advice">' +
        '<h3>Gợi ý luyện tập tiếp theo</h3>' +
        '<p class="report-small">Gợi ý theo quy tắc cố định, tính từ kết quả ở trên – <strong>không dùng AI</strong>.' +
          (few ? ' Hiện mới có ' + sum.totals.questions + ' câu; làm thêm câu thì gợi ý sẽ sát hơn.' : '') + '</p>' +
        (items.length
          ? '<ol class="advice-list">' + items.map(function (s) {
              return '<li data-advice="' + escapeHtml(s.id) + '"><strong>' + escapeHtml(s.title) + '</strong>' +
                '<p>' + escapeHtml(s.detail) + '</p>' +
                '<p class="report-small">Vì: ' + escapeHtml(s.reason) + '</p>' +
                '<a class="btn btn-secondary btn-small no-print" href="#' + s.view + '">Mở ' +
                  escapeHtml(activityName(s.view)) + '</a></li>';
            }).join('') + '</ol>'
          : '<p class="report-small">Chưa có gợi ý nào: kết quả hiện tại chưa cho thấy điểm nào cần ôn thêm.</p>') +
      '</section>';
    }

    function sessionsHtml(sessions) {
      var currentId = log.currentSession().id;
      var rows = sessions.map(function (s, i) {
        var sum = summarize([s]);
        return countsRow([
          String(i + 1) + (s.id === currentId ? ' <span class="report-tag">đang mở</span>' : ''),
          escapeHtml(formatTime(s.startedAt)),
          formatDuration(s.startedAt, s.lastAt),
          escapeHtml(sum.activities.map(function (a) { return a.name; }).join(', ')),
          sum.totals.questions, sum.totals.correct, percentText(sum.rate)
        ]);
      });
      return '<section class="report-section" data-section="sessions">' +
        '<h3>Từng phiên luyện tập</h3>' +
        '<div class="table-scroll"><table class="result-table"><thead><tr><th>Phiên</th><th>Bắt đầu</th><th>Thời lượng</th>' +
        '<th>Hoạt động</th><th>Số câu</th><th>Đúng</th><th>Tỷ lệ đúng</th></tr></thead><tbody>' + rows.join('') +
        '</tbody></table></div></section>';
    }

    function activitiesHtml(sum) {
      var rows = sum.activities.map(function (a) {
        var hasQuestions = a.questions + a.retries > 0;
        return '<tr data-activity="' + a.key + '"><td>' + escapeHtml(a.name) + '</td>' +
          (hasQuestions
            ? '<td>' + a.questions + '</td><td>' + a.correct + '</td><td>' + a.wrong + '</td><td>' + percentText(a.rate) + '</td>'
            : '<td>—</td><td>—</td><td>—</td><td>—</td>') +
          '<td>' + escapeHtml(actionsText(a.actions)) + '</td></tr>';
      });
      return '<section class="report-section" data-section="activities">' +
        '<h3>Theo hoạt động</h3>' +
        '<div class="table-scroll"><table class="result-table"><thead><tr><th>Hoạt động</th><th>Số câu</th><th>Đúng</th>' +
        '<th>Sai</th><th>Tỷ lệ đúng</th><th>Thao tác khác (không chấm đúng/sai)</th></tr></thead><tbody>' +
        rows.join('') + '</tbody></table></div></section>';
    }

    function detailHtml(sum) {
      var blocks = sum.activities.map(function (a) {
        var parts = ['<h4>' + escapeHtml(a.name) + ' <span class="report-when">' +
          escapeHtml(formatRange(a.firstTime, a.lastTime)) + '</span></h4>'];
        if (a.modes.length) {
          parts.push('<div class="table-scroll"><table class="result-table"><thead><tr><th>Chế độ / dạng câu</th><th>Số câu</th>' +
            '<th>Đúng</th><th>Sai</th><th>Tỷ lệ đúng</th></tr></thead><tbody>' +
            a.modes.map(function (m) {
              return countsRow([escapeHtml(m.mode), m.questions, m.correct, m.wrong, percentText(m.rate)]);
            }).join('') + '</tbody></table></div>');
        }
        if (a.retries) parts.push('<p class="report-small">Làm lại sau khi sai: ' + a.retries + ' lần.</p>');
        if (a.mistakes.length) {
          var shown = a.mistakes.slice(-MAX_MISTAKES_SHOWN);
          parts.push('<p class="report-small">Câu trả lời sai' +
            (a.mistakes.length > shown.length ? ' (' + shown.length + ' câu gần nhất trên ' + a.mistakes.length + ')' : '') + ':</p>' +
            '<ul class="mistake-list">' + shown.map(function (e) {
              return '<li>' + escapeHtml(e.mode) + ': đáp án <strong>' + escapeHtml(e.targetText) + '</strong> – em chọn ' +
                escapeHtml(e.givenText) + '</li>';
            }).join('') + '</ul>');
        } else if (a.questions) {
          parts.push('<p class="report-small">Không có câu sai.</p>');
        }
        if (a.actions.length) parts.push('<p class="report-small">' + escapeHtml(actionsText(a.actions)) + '.</p>');
        return '<div class="report-activity" data-detail="' + a.key + '">' + parts.join('') + '</div>';
      });
      return '<section class="report-section" data-section="detail"><h3>Chi tiết từng hoạt động</h3>' + blocks.join('') + '</section>';
    }

    function notesHtml(sum) {
      var rows = sum.notes.map(function (n) {
        return '<tr data-note="' + n.noteId + '"><td><strong>' + escapeHtml(n.label) + '</strong></td>' +
          (n.questions
            ? '<td>' + n.questions + '</td><td>' + n.correct + '</td><td>' + n.wrong + '</td><td>' +
              percentText(n.correct / n.questions) + '</td>'
            : '<td>0</td><td>—</td><td>—</td><td>—</td>') + '</tr>';
      });
      var trouble = sum.trouble.length
        ? '<ul class="mistake-list" data-ref-trouble>' + sum.trouble.map(function (t) {
            return '<li><strong>' + escapeHtml(t.label) + '</strong>: sai ' + t.wrong + ' trên ' + t.questions + ' câu' +
              (t.confusedWith.length ? ' – hay nhầm với ' + t.confusedWith.map(function (c) {
                return escapeHtml(c.label) + ' (' + c.count + ' lần)';
              }).join(', ') : '') + '</li>';
          }).join('') + '</ul>'
        : '<p class="report-small" data-ref-trouble>Chưa đủ dữ liệu để kết luận nốt nào hay nhầm ' +
          '(cần ít nhất ' + MIN_MISSES + ' câu sai với cùng một nốt).</p>';
      return '<section class="report-section" data-section="notes">' +
        '<h3>Theo từng nốt</h3>' +
        '<p class="report-small">Tính các câu có đáp án là một nốt (không gồm câu “âm thứ hai cao hơn hay thấp hơn”).</p>' +
        '<div class="table-scroll"><table class="result-table"><thead><tr><th>Nốt</th><th>Số câu</th><th>Đúng</th><th>Sai</th>' +
        '<th>Tỷ lệ đúng</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' +
        '<h4>Những nốt hay nhầm</h4>' + trouble +
      '</section>';
    }

    var METHOD_HTML =
      '<section class="report-section report-method" data-section="method"><h3>Cách tính</h3><ul>' +
        '<li>Mỗi câu chỉ tính <strong>lần trả lời đầu tiên</strong>. Các lần làm lại sau khi sai được đếm riêng.</li>' +
        '<li>Ở Kéo thả, mỗi nốt trong một bài là một câu.</li>' +
        '<li>Khám phá và Phòng sáng tạo không có đúng/sai nên chỉ đếm số lần thao tác.</li>' +
        '<li>“Phiên này” là lần mở trang hiện tại. “Tất cả các phiên” chỉ gồm các phiên được lưu trên chính máy này.</li>' +
      '</ul></section>';

    function render() {
      Array.prototype.forEach.call(scopeButtons, function (b) {
        b.setAttribute('aria-selected', String(b.getAttribute('data-scope') === state.scope));
      });
      renderStorage();
      var sessions = sessionsInScope();
      var empty = !sessions.length;
      refs.exportCsv.disabled = empty;
      refs.exportJson.disabled = empty;
      refs.printButton.disabled = empty;
      if (empty) {
        refs.body.innerHTML = '<p class="panel-hint" data-ref-empty>Chưa có dữ liệu' +
          (state.scope === 'all' ? ' trên máy này' : ' trong phiên này') +
          '. Hãy làm Tìm nốt, Nghe cao độ, Trắc nghiệm hoặc Kéo thả – kết quả sẽ hiện ở đây.</p>';
        return;
      }
      var sum = summarize(sessions);
      refs.body.innerHTML = overviewHtml(sum) + adviceHtml(sum) +
        (state.scope === 'all' ? sessionsHtml(sessions) : '') +
        activitiesHtml(sum) + detailHtml(sum) + notesHtml(sum) + METHOD_HTML;
    }

    // ---------- Xuất file / in ----------
    function fileName(ext) {
      var d = now();
      return 'bao-cao-ai-music-lab-' + (state.scope === 'all' ? 'tat-ca-' : 'phien-') + d.getFullYear() + '-' +
        pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.' + ext;
    }

    function exportFile(ext) {
      var sessions = sessionsInScope();
      if (!sessions.length) return;
      try {
        var name = fileName(ext);
        var blob = ext === 'csv'
          ? new Blob([toCsv(sessions)], { type: 'text/csv;charset=utf-8' })
          : new Blob([JSON.stringify(toJson(sessions, scopeName(), now()), null, 2)], { type: 'application/json' });
        download(name, blob);
        setMessage('Đã xuất ' + name + ' (' + summarize(sessions).entries + ' dòng dữ liệu). ' +
          'File nằm trong thư mục Tải về của máy này.', 'is-good');
      } catch (err) {
        setMessage('Chưa xuất được file. Hãy thử lại, hoặc dùng Chrome/Edge bản mới.', 'is-retry');
      }
    }

    function printReport() {
      refs.printHead.textContent = 'AI MUSIC LAB – Báo cáo kết quả luyện tập · Phạm vi: ' + scopeName() +
        ' · In lúc ' + formatTime(now().toISOString());
      try {
        print();
      } catch (err) {
        setMessage('Chưa mở được hộp thoại in. Hãy bấm Ctrl + P.', 'is-retry');
      }
    }

    // ---------- Sự kiện ----------
    Array.prototype.forEach.call(scopeButtons, function (b) {
      b.addEventListener('click', function () {
        state.scope = b.getAttribute('data-scope');
        render();
      });
    });

    refs.storageBox.addEventListener('change', function (event) {
      if (!event.target.matches('[data-ref-saving]')) return;
      var on = event.target.checked;
      if (log.setSaving(on)) {
        setMessage(on ? 'Đã bật lưu: kết quả của phiên này và các lần mở trang sau được lưu trong trình duyệt trên máy này.'
          : 'Đã tắt lưu. Các phiên đã lưu trước đó vẫn còn cho đến khi bấm “Xóa dữ liệu đã lưu”.', 'is-good');
      } else {
        setMessage('Trình duyệt không cho lưu dữ liệu (có thể đang ở chế độ ẩn danh hoặc bộ nhớ đầy). ' +
          'Báo cáo phiên này vẫn dùng và xuất file được.', 'is-retry');
      }
      render();
    });

    refs.storageBox.addEventListener('click', function (event) {
      var button = event.target.closest('button');
      if (!button) return;
      if (button === refs.clearSaved) {
        confirmTwice(button, 'Bấm lần nữa để xóa ' + log.savedSessions().length + ' phiên đã lưu', function () {
          if (log.clearSaved()) setMessage('Đã xóa dữ liệu đã lưu trên máy này và tắt lưu.', 'is-good');
          else setMessage('Chưa xóa được dữ liệu. Hãy thử lại.', 'is-retry');
          render();
        });
      } else if (button === refs.newSession) {
        var unsaved = log.currentSession().entries.length && !log.savingEnabled();
        if (!unsaved) { reload(); return; }
        confirmTwice(button, 'Bấm lần nữa – kết quả phiên này chưa lưu sẽ mất', reload);
      }
    });

    refs.exportCsv.addEventListener('click', function () { exportFile('csv'); });
    refs.exportJson.addEventListener('click', function () { exportFile('json'); });
    refs.printButton.addEventListener('click', printReport);

    // Chỉ vẽ lại khi đang hiện; khi được mở lại, app.js gọi render().
    log.subscribe(function () { if (!root.closest('[hidden]')) render(); });
    render();

    return {
      root: root,
      render: render,
      getState: function () { return state; },
      setScope: function (scope) { state.scope = scope; render(); }
    };
  }

  global.ReportActivity = {
    mount: mount,
    summarize: summarize,
    toCsv: toCsv,
    toJson: toJson,
    MIN_MISSES: MIN_MISSES,
    CSV_COLUMNS: CSV_COLUMNS
  };
})(window);
