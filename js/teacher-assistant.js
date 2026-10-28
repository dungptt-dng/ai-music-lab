/*
 * AI MUSIC LAB – Trợ lý giáo viên (dùng AI: Claude của Anthropic)
 *
 * Trang dành cho giáo viên, không nằm trên thanh chọn hoạt động của học sinh (mở bằng index.html#tro-ly-giao-vien).
 * Trang này KHÔNG chứa khóa API: nó chỉ gửi lựa chọn của giáo viên tới máy chủ của trường
 * (functions/api/tro-ly-giao-vien.js); máy chủ mới gọi Claude và kiểm tra lại đáp án bằng quy tắc nhạc lý.
 *
 * Khi mở bằng file:// hoặc trên máy chủ chưa cài trợ lý, trang báo rõ là chưa dùng được và khóa nút tạo.
 */
(function (global) {
  'use strict';

  var shared = global.AppShared;
  var escapeHtml = shared.escapeHtml;
  var NOTES = global.MusicNotes.NOTES;

  var ENDPOINT = 'api/tro-ly-giao-vien';
  var ACCESS_HEADER = 'x-ma-giao-vien';

  var KIND_NAMES = {
    'ten-not-tren-khuong': 'Đọc tên nốt trên khuông',
    'vi-tri-cua-not': 'Vị trí của nốt',
    'not-cao-hon': 'Nốt nào cao hơn',
    'not-thap-hon': 'Nốt nào thấp hơn',
    'not-lien-sau': 'Nốt liền sau (đi lên)',
    'not-lien-truoc': 'Nốt liền trước (đi xuống)'
  };
  var LEVEL_NAMES = { de: 'Dễ', vua: 'Vừa', kho: 'Khó' };

  function noteChecks(name) {
    return '<fieldset class="ta-fieldset"><legend>Các nốt cần tập trung</legend><div class="ta-checks">' +
      NOTES.map(function (n) {
        return '<label class="ta-check"><input type="checkbox" name="' + name + '" value="' + n.id + '" checked> ' +
          escapeHtml(n.label) + '</label>';
      }).join('') + '</div></fieldset>';
  }

  var TEMPLATE =
    '<div class="activity-head">' +
      '<h2 class="activity-title">Trợ lý giáo viên <span class="ai-badge">AI · Claude (Anthropic)</span></h2>' +
      '<div class="mode-switch" role="tablist" aria-label="Việc cần trợ lý làm">' +
        '<button type="button" role="tab" data-task="cau-hoi" aria-selected="true">Tạo câu hỏi luyện tập</button>' +
        '<button type="button" role="tab" data-task="hoat-dong" aria-selected="false">Gợi ý thiết kế hoạt động</button>' +
      '</div>' +
    '</div>' +
    '<p class="ta-status" data-ref="status" role="status">Đang kiểm tra máy chủ…</p>' +
    '<div class="ta-privacy">' +
      '<strong>Dữ liệu gửi đi:</strong> chỉ các lựa chọn thầy cô nhập dưới đây được gửi tới máy chủ của trường và dịch vụ ' +
      'Claude của Anthropic để soạn nội dung. Không gửi kết quả, nhật ký hay thông tin của học sinh. ' +
      '<strong>Xin không nhập tên học sinh</strong> hay thông tin cá nhân vào ô mục tiêu và chủ đề.' +
    '</div>' +
    '<form class="ta-form" data-ref="form" novalidate>' +
      '<div data-panel="cau-hoi">' +
        '<div class="ta-row">' +
          '<label class="ta-field">Mức độ <select name="level">' +
            '<option value="de">Dễ (2–3 phương án)</option><option value="vua" selected>Vừa (3–4 phương án)</option>' +
            '<option value="kho">Khó (4 phương án)</option></select></label>' +
          '<label class="ta-field">Số câu <input type="number" name="count" min="3" max="10" value="5"></label>' +
        '</div>' +
        noteChecks('qnotes') +
        '<fieldset class="ta-fieldset"><legend>Dạng câu hỏi</legend><div class="ta-checks">' +
          Object.keys(KIND_NAMES).map(function (k) {
            return '<label class="ta-check"><input type="checkbox" name="kinds" value="' + k + '" checked> ' + KIND_NAMES[k] + '</label>';
          }).join('') +
        '</div></fieldset>' +
        '<label class="ta-field">Chủ đề lồng ghép (không bắt buộc) <input type="text" name="theme" maxlength="120" ' +
          'placeholder="Ví dụ: mùa thu, con vật"></label>' +
      '</div>' +
      '<div data-panel="hoat-dong" hidden>' +
        '<div class="ta-row">' +
          '<label class="ta-field">Lớp <select name="grade"><option value="4">Lớp 4</option><option value="5">Lớp 5</option></select></label>' +
          '<label class="ta-field">Thời lượng (phút) <input type="number" name="minutes" min="5" max="45" value="15"></label>' +
        '</div>' +
        '<label class="ta-field">Mục tiêu của hoạt động <textarea name="goal" rows="3" maxlength="300" ' +
          'placeholder="Ví dụ: Học sinh phân biệt được nốt Mi và Pha trên khuông, nghe được nốt nào cao hơn."></textarea></label>' +
        noteChecks('anotes') +
      '</div>' +
      '<div class="ta-row ta-submit">' +
        '<label class="ta-field">Mã giáo viên <input type="password" name="code" autocomplete="off" ' +
          'placeholder="Do người quản trị máy chủ cung cấp"></label>' +
        '<button type="submit" class="btn btn-primary" data-ref="submit" disabled>✨ Nhờ AI soạn</button>' +
      '</div>' +
    '</form>' +
    '<p class="find-feedback" data-ref="message" role="status">&nbsp;</p>' +
    '<div class="ta-result" data-ref="result" aria-live="polite"></div>' +
    '<p class="honest-note">Chỉ trang này dùng mô hình AI. Mã giáo viên không được lưu trên máy. ' +
      'Đáp án của mỗi câu hỏi được máy chủ tính lại bằng quy tắc nhạc lý; câu sai bị loại trước khi hiện ra. ' +
      'Lời văn do AI viết nên thầy cô cần đọc lại trước khi dùng với học sinh.</p>';

  // ---------- Văn bản để tải về ----------
  function questionText(q, i) {
    var lines = ['Câu ' + (i + 1) + ' (' + q.kindName + '): ' + q.prompt];
    if (q.staffNoteId) lines.push('   [Vẽ nốt trên khuông – đáp án: ' + global.MusicNotes.findNote(q.staffNoteId).label + ']');
    q.options.forEach(function (o, k) {
      lines.push('   ' + String.fromCharCode(65 + k) + '. ' + o.text + (o.id === q.answerId ? '   ← đáp án' : ''));
    });
    lines.push('   Giải thích: ' + q.explanation);
    return lines.join('\n');
  }

  function toText(result) {
    var head = 'AI MUSIC LAB – Trợ lý giáo viên\nSoạn bởi AI: Claude (Anthropic), mô hình ' + result.model +
      ', lúc ' + result.generatedAt + '\n';
    if (result.task === 'cau-hoi') {
      return head + 'Đáp án đã được kiểm tra bằng quy tắc nhạc lý. Lời văn do AI viết – giáo viên đọc lại trước khi dùng.\n\n' +
        result.questions.map(questionText).join('\n\n') + '\n';
    }
    var p = result.plan;
    return head + 'Gợi ý do AI soạn – giáo viên điều chỉnh cho phù hợp với lớp.\n\n' + p.title + '\n\nMục tiêu:\n' +
      p.objectives.map(function (o) { return '- ' + o; }).join('\n') + '\n\nCác bước (' + p.totalMinutes + ' phút):\n' +
      p.steps.map(function (s, i) {
        return (i + 1) + '. ' + s.name + ' (' + s.minutes + ' phút' + (s.appName ? ' – ứng dụng: ' + s.appName : '') + ')\n' +
          '   Giáo viên: ' + s.teacher + '\n   Học sinh: ' + s.students;
      }).join('\n') + '\n\nĐánh giá: ' + p.assessment + '\n';
  }

  /*
   * options.fetch    – hàm fetch (mặc định của trình duyệt; trang kiểm thử thay bằng máy chủ giả lập)
   * options.endpoint – đường dẫn máy chủ (mặc định api/tro-ly-giao-vien)
   * options.download – hàm (tênFile, blob) để lưu file
   * options.now      – hàm trả về thời điểm hiện tại
   */
  function mount(root, options) {
    options = options || {};
    var doFetch = options.fetch || (global.fetch ? global.fetch.bind(global) : null);
    var endpoint = options.endpoint || ENDPOINT;
    var download = options.download || shared.downloadBlob;
    var now = options.now || function () { return new Date(); };

    root.classList.add('activity', 'teacher-assistant');
    root.innerHTML = TEMPLATE;
    var refs = shared.collectRefs(root);
    var form = refs.form;
    var state = { task: 'cau-hoi', ready: false, busy: false, result: null };
    var statusDone;

    function setMessage(text, kind) {
      refs.message.className = 'find-feedback' + (kind ? ' ' + kind : '');
      refs.message.textContent = text || ' ';
    }

    function updateSubmit() {
      refs.submit.disabled = !state.ready || state.busy;
    }

    // ---------- Trạng thái máy chủ ----------
    function setStatus(ready, text) {
      state.ready = ready;
      refs.status.className = 'ta-status ' + (ready ? 'is-ready' : 'is-off');
      refs.status.textContent = text;
      updateSubmit();
    }

    function checkStatus() {
      if (!doFetch || global.location.protocol === 'file:' && !options.fetch) {
        setStatus(false, 'Trợ lý AI chỉ dùng được khi trang được mở từ máy chủ của trường (Cloudflare Pages) đã cài đặt. ' +
          'Khi mở trực tiếp từ file trên máy, các hoạt động của học sinh vẫn dùng bình thường.');
        return Promise.resolve();
      }
      return doFetch(endpoint, { method: 'GET', headers: { accept: 'application/json' } })
        .then(function (res) {
          if (!res.ok) throw new Error('status ' + res.status);
          return res.json();
        })
        .then(function (data) {
          if (data && data.ready) setStatus(true, 'Máy chủ đã sẵn sàng (mô hình ' + data.model + '). Nhập mã giáo viên để dùng.');
          else setStatus(false, 'Máy chủ có trợ lý nhưng chưa cài đặt xong: ' + ((data && data.problems) || []).join(' ') +
            ' Hãy báo người quản trị.');
        })
        .catch(function () {
          setStatus(false, 'Máy chủ này chưa có trợ lý AI (ví dụ đang chạy thử trên máy). ' +
            'Các hoạt động của học sinh vẫn dùng bình thường.');
        });
    }

    // ---------- Đọc form ----------
    function checked(name) {
      return Array.prototype.filter.call(form.querySelectorAll('input[name="' + name + '"]'), function (i) { return i.checked; })
        .map(function (i) { return i.value; });
    }

    function readRequest() {
      if (state.task === 'cau-hoi') {
        var count = Number(form.elements.count.value);
        if (!(count >= 3 && count <= 10 && Math.floor(count) === count)) return { error: 'Số câu phải từ 3 đến 10.' };
        var notes = checked('qnotes'), kinds = checked('kinds');
        if (!notes.length) return { error: 'Hãy chọn ít nhất một nốt.' };
        if (!kinds.length) return { error: 'Hãy chọn ít nhất một dạng câu hỏi.' };
        return { body: { task: 'cau-hoi', level: form.elements.level.value, count: count, notes: notes, kinds: kinds,
          theme: form.elements.theme.value.trim() } };
      }
      var minutes = Number(form.elements.minutes.value);
      if (!(minutes >= 5 && minutes <= 45 && Math.floor(minutes) === minutes)) return { error: 'Thời lượng phải từ 5 đến 45 phút.' };
      var goal = form.elements.goal.value.trim();
      if (goal.length < 5) return { error: 'Hãy viết mục tiêu của hoạt động (ít nhất 5 ký tự).' };
      var anotes = checked('anotes');
      if (!anotes.length) return { error: 'Hãy chọn ít nhất một nốt.' };
      return { body: { task: 'hoat-dong', grade: Number(form.elements.grade.value), minutes: minutes, goal: goal, notes: anotes } };
    }

    // ---------- Hiển thị kết quả ----------
    function questionsHtml(result) {
      var rejected = result.rejected || [];
      return '<section class="report-section">' +
        '<h3>' + result.questions.length + ' câu hỏi luyện tập</h3>' +
        '<p class="ta-verified">✓ Đáp án của từng câu đã được máy chủ kiểm tra bằng quy tắc nhạc lý.</p>' +
        '<p class="report-small">Lời văn do AI (Claude – Anthropic) viết – thầy cô đọc lại trước khi dùng với học sinh.' +
          (rejected.length ? ' Máy đã loại ' + rejected.length + ' câu AI viết chưa đúng (' +
            rejected.map(function (r) { return 'câu ' + r.index + ': ' + escapeHtml(r.reason); }).join('; ') + ').' : '') + '</p>' +
        '<ol class="ta-questions">' + result.questions.map(function (q, i) {
          return '<li class="ta-question" data-question="' + i + '">' +
            '<p class="ta-kind"><span class="report-tag">' + escapeHtml(q.kindName) + '</span></p>' +
            (q.staffNoteId ? '<div class="mini-staff" data-mini="' + escapeHtml(q.staffNoteId) + '"></div>' : '') +
            '<p class="ta-prompt">' + escapeHtml(q.prompt) + '</p>' +
            '<ul class="ta-options">' + q.options.map(function (o) {
              var right = o.id === q.answerId;
              return '<li' + (right ? ' class="is-answer" data-answer' : '') + '>' + escapeHtml(o.text) +
                (right ? ' <strong>✓ đáp án</strong>' : '') + '</li>';
            }).join('') + '</ul>' +
            '<p class="report-small">Giải thích: ' + escapeHtml(q.explanation) + '</p>' +
          '</li>';
        }).join('') + '</ol></section>';
    }

    function planHtml(result) {
      var p = result.plan;
      return '<section class="report-section">' +
        '<h3>' + escapeHtml(p.title) + '</h3>' +
        '<p class="report-small">Gợi ý do AI (Claude – Anthropic) soạn – thầy cô điều chỉnh cho phù hợp với lớp. ' +
          'Máy chủ đã kiểm tra: tổng thời lượng ' + p.totalMinutes + ' phút, chỉ dùng các mục có trong ứng dụng.</p>' +
        '<h4>Mục tiêu</h4><ul>' + p.objectives.map(function (o) { return '<li>' + escapeHtml(o) + '</li>'; }).join('') + '</ul>' +
        '<h4>Các bước</h4><div class="table-scroll"><table class="result-table ta-plan">' +
          '<thead><tr><th>Bước</th><th>Phút</th><th>Giáo viên</th><th>Học sinh</th><th>Mục ứng dụng</th></tr></thead><tbody>' +
          p.steps.map(function (s) {
            return '<tr><td>' + escapeHtml(s.name) + '</td><td>' + s.minutes + '</td><td>' + escapeHtml(s.teacher) + '</td>' +
              '<td>' + escapeHtml(s.students) + '</td><td>' +
              (s.appView ? '<a href="#' + escapeHtml(s.appView) + '">' + escapeHtml(s.appName) + '</a>' : '–') + '</td></tr>';
          }).join('') +
        '</tbody></table></div>' +
        '<h4>Đánh giá</h4><p>' + escapeHtml(p.assessment) + '</p></section>';
    }

    function renderResult() {
      var result = state.result;
      if (!result) { refs.result.innerHTML = ''; return; }
      refs.result.innerHTML = (result.task === 'cau-hoi' ? questionsHtml(result) : planHtml(result)) +
        '<div class="toolbar report-actions">' +
          '<button type="button" class="btn btn-secondary" data-save="txt">⬇ Tải văn bản (.txt)</button>' +
          '<button type="button" class="btn btn-ghost" data-save="json">⬇ Tải JSON</button>' +
        '</div>';
      Array.prototype.forEach.call(refs.result.querySelectorAll('[data-mini]'), function (host) {
        global.StaffRenderer.createStaff(host, [global.MusicNotes.findNote(host.getAttribute('data-mini'))], {
          interactive: false,
          ariaLabel: 'Một nốt nhạc trên khuông khóa Sol'
        });
      });
    }

    function fileName(ext) {
      var d = now();
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      return (state.result.task === 'cau-hoi' ? 'cau-hoi-ai' : 'hoat-dong-ai') + '-' + d.getFullYear() + '-' +
        pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.' + ext;
    }

    function save(ext) {
      var result = state.result;
      var blob = ext === 'txt'
        ? new Blob(['\ufeff' + toText(result)], { type: 'text/plain;charset=utf-8' })
        : new Blob([JSON.stringify({
          app: 'AI MUSIC LAB', type: 'ai-music-lab/tro-ly-giao-vien', version: 1,
          generatedBy: 'AI: Claude (Anthropic), mô hình ' + result.model,
          checkedBy: 'Quy tắc nhạc lý của AI MUSIC LAB (máy chủ)',
          generatedAt: result.generatedAt, request: result.request,
          content: result.task === 'cau-hoi' ? { questions: result.questions, rejected: result.rejected } : { plan: result.plan }
        }, null, 2)], { type: 'application/json' });
      try {
        var name = fileName(ext);
        download(name, blob);
        setMessage('Đã tải ' + name + ' vào thư mục Tải về.', 'is-good');
      } catch (err) {
        setMessage('Chưa tải được file. Hãy thử lại.', 'is-retry');
      }
    }

    // ---------- Gửi yêu cầu ----------
    function submit() {
      if (!state.ready || state.busy) return Promise.resolve();
      var read = readRequest();
      if (read.error) { setMessage(read.error, 'is-retry'); return Promise.resolve(); }
      var code = form.elements.code.value;
      if (!code) { setMessage('Hãy nhập mã giáo viên.', 'is-retry'); return Promise.resolve(); }

      state.busy = true;
      updateSubmit();
      setMessage('Đang chờ AI soạn và máy chủ kiểm tra… (thường mất 20–60 giây)');
      var headers = { 'content-type': 'application/json', accept: 'application/json' };
      headers[ACCESS_HEADER] = code;
      return doFetch(endpoint, { method: 'POST', headers: headers, body: JSON.stringify(read.body) })
        .then(function (res) {
          return res.json().then(function (data) { return { status: res.status, data: data }; },
            function () { return { status: res.status, data: null }; });
        })
        .then(function (reply) {
          var data = reply.data;
          if (!data || !data.ok) {
            setMessage((data && data.message) || 'Máy chủ trả lỗi ' + reply.status + '. Hãy thử lại.', 'is-retry');
            return;
          }
          state.result = {
            task: data.task, model: data.model, generatedAt: now().toISOString(), request: read.body,
            questions: data.questions, rejected: data.rejected, plan: data.plan
          };
          renderResult();
          setMessage(data.task === 'cau-hoi' ? 'Đã soạn xong ' + data.questions.length + ' câu hỏi.' : 'Đã soạn xong gợi ý hoạt động.', 'is-good');
        })
        .catch(function () {
          setMessage('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', 'is-retry');
        })
        .then(function () {
          state.busy = false;
          updateSubmit();
        });
    }

    // ---------- Sự kiện ----------
    Array.prototype.forEach.call(root.querySelectorAll('[data-task]'), function (b) {
      b.addEventListener('click', function () {
        state.task = b.getAttribute('data-task');
        Array.prototype.forEach.call(root.querySelectorAll('[data-task]'), function (other) {
          other.setAttribute('aria-selected', String(other === b));
        });
        Array.prototype.forEach.call(root.querySelectorAll('[data-panel]'), function (panel) {
          panel.hidden = panel.getAttribute('data-panel') !== state.task;
        });
        setMessage('');
      });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      submit();
    });

    refs.result.addEventListener('click', function (event) {
      var button = event.target.closest('[data-save]');
      if (button) save(button.getAttribute('data-save'));
    });

    statusDone = checkStatus();

    return {
      root: root,
      ready: function () { return statusDone; },
      submit: submit,
      getState: function () { return state; }
    };
  }

  global.TeacherAssistant = { mount: mount, toText: toText, ENDPOINT: ENDPOINT };
})(window);
