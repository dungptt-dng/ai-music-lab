/*
 * Kiểm thử tự động AI MUSIC LAB – Giai đoạn 1 và 2
 *
 * BẢNG CHUẨN bên dưới được chép tay từ "Quy ước cao độ bắt buộc" trong LENH.docx,
 * hoàn toàn độc lập với mã tính toán trong js/notes.js, để phép so sánh có ý nghĩa.
 */
(function () {
  'use strict';

  var REFERENCE = [
    { id: 'C4', label: 'Đô₄', symbol: 'C4', hz: 261.63, position: { kind: 'ledger-below' }, text: 'dòng kẻ phụ phía dưới khuông' },
    { id: 'D4', label: 'Rê₄', symbol: 'D4', hz: 293.66, position: { kind: 'below-line', line: 1 }, text: 'khe ngay dưới dòng kẻ dưới cùng' },
    { id: 'E4', label: 'Mi₄', symbol: 'E4', hz: 329.63, position: { kind: 'line', line: 1 }, text: 'dòng kẻ dưới cùng' },
    { id: 'F4', label: 'Pha₄', symbol: 'F4', hz: 349.23, position: { kind: 'space', lines: [1, 2] }, text: 'khe thứ nhất từ dưới lên' },
    { id: 'G4', label: 'Sol₄', symbol: 'G4', hz: 392.00, position: { kind: 'line', line: 2 }, text: 'dòng kẻ thứ hai từ dưới lên' },
    { id: 'A4', label: 'La₄', symbol: 'A4', hz: 440.00, position: { kind: 'space', lines: [2, 3] }, text: 'khe thứ hai từ dưới lên' },
    { id: 'B4', label: 'Si₄', symbol: 'B4', hz: 493.88, position: { kind: 'line', line: 3 }, text: 'dòng kẻ giữa' },
    { id: 'C5', label: 'Đô₅', symbol: 'C5', hz: 523.25, position: { kind: 'space', lines: [3, 4] }, text: 'ngay trên dòng kẻ giữa' }
  ];
  var REFERENCE_C4_HZ = 261.63;

  var FREQUENCY_TABLE_TOLERANCE_HZ = 0.01;   // bảng chuẩn làm tròn 2 chữ số thập phân
  var MEASURED_TOLERANCE_RATIO = 0.003;      // đo thực tế sai ≤ 0,3% (1 nửa cung ≈ 5,9%)

  var results = { pass: 0, fail: 0 };

  // ---------- Công cụ ----------
  function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  // Chờ đến khi điều kiện đúng (ví dụ hiệu ứng chuyển cảnh CSS chạy xong), tối đa timeoutMs.
  function waitFor(condition, timeoutMs) {
    var deadline = Date.now() + timeoutMs;
    return new Promise(function (resolve) {
      (function poll() {
        if (condition() || Date.now() > deadline) resolve(condition());
        else setTimeout(poll, 50);
      })();
    });
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function near(a, b, tolerance) { return Math.abs(a - b) <= tolerance; }

  function seededRandom(seed) {
    var value = seed;
    return function () {
      value = (value * 1103515245 + 12345) % 2147483648;
      return value / 2147483648;
    };
  }

  function createFakeAudio() {
    var fake = {
      notes: [],
      sequences: [],
      volume: 0.6,
      failNext: null,
      stopCount: 0,
      takeFailure: function () {
        var error = fake.failNext;
        fake.failNext = null;
        return error;
      },
      playNote: function (frequency) {
        fake.notes.push(frequency);
        var error = fake.takeFailure();
        return error ? Promise.reject(error) : Promise.resolve();
      },
      playSequence: function (frequencies, options) {
        fake.sequences.push({ frequencies: frequencies, options: options });
        var error = fake.takeFailure();
        return error ? Promise.reject(error) : Promise.resolve();
      },
      stopAll: function () { fake.stopCount += 1; },
      setVolume: function (value) { fake.volume = value; },
      getVolume: function () { return fake.volume; }
    };
    return fake;
  }

  function mountFresh(seed, activity, extraOptions) {
    var host = document.createElement('div');
    document.getElementById('sandbox').appendChild(host);
    var audio = createFakeAudio();
    // Mỗi lần gắn dùng nhật ký riêng, không ghi vào bộ nhớ trình duyệt (trừ khi phép thử truyền log khác).
    var options = { audio: audio, random: seededRandom(seed || 7), log: PracticeLog.create({ storage: null }) };
    for (var key in extraOptions || {}) options[key] = extraOptions[key];
    var app = (activity || StaffActivity).mount(host, options);
    return { host: host, audio: audio, app: app, log: options.log };
  }

  // Bộ nhớ giả thay cho localStorage: đếm số lần ghi, có thể giới hạn dung lượng hoặc báo lỗi khi ghi.
  function createFakeStorage(limitChars) {
    var data = {};
    var fake = {
      writes: 0,
      failWrites: false,
      getItem: function (k) { return k in data ? data[k] : null; },
      setItem: function (k, v) {
        fake.writes += 1;
        if (fake.failWrites) throw new Error('QuotaExceededError');
        if (limitChars && String(v).length > limitChars) throw new Error('QuotaExceededError');
        data[k] = String(v);
      },
      removeItem: function (k) { delete data[k]; },
      raw: function () { return data; }
    };
    return fake;
  }

  // Đồng hồ giả: mỗi lần hỏi giờ thì tăng thêm `stepSeconds` giây.
  function fakeClock(startIso, stepSeconds) {
    var t = new Date(startIso).getTime();
    return function () { var d = new Date(t); t += (stepSeconds || 0) * 1000; return d; };
  }

  function clickNote(app, id) {
    app.staff.noteElement(id).querySelector('.note-head').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  function click(host, selector) {
    var node = host.querySelector(selector);
    assert(node, 'Không tìm thấy nút ' + selector);
    node.click();
  }

  function lastSequence(audio) {
    return audio.sequences[audio.sequences.length - 1];
  }

  function lineYs(svg) {
    var ys = {};
    Array.prototype.forEach.call(svg.querySelectorAll('.staff-line'), function (line) {
      ys[line.getAttribute('data-line')] = Number(line.getAttribute('y1'));
    });
    return ys;
  }

  function lineRenderedY(svg, line) {
    var rect = svg.querySelector('.staff-line[data-line="' + line + '"]').getBoundingClientRect();
    return rect.top + rect.height / 2;
  }

  /*
   * Đo tần số cơ bản của âm thanh tổng hợp bằng tự tương quan (autocorrelation):
   * tìm độ trễ nhỏ nhất mà tín hiệu lặp lại giống chính nó, rồi nội suy parabol cho chính xác.
   */
  function measureFrequency(buffer) {
    var data = buffer.getChannelData(0);
    var sampleRate = buffer.sampleRate;
    var start = Math.floor(0.1 * sampleRate);
    var size = 4096;
    var minLag = Math.floor(sampleRate / 1000);
    var maxLag = Math.ceil(sampleRate / 150);
    var correlations = [];
    var best = 0;
    for (var lag = minLag; lag <= maxLag; lag++) {
      var sum = 0, energyA = 0, energyB = 0;
      for (var i = 0; i < size; i++) {
        var a = data[start + i], b = data[start + i + lag];
        sum += a * b; energyA += a * a; energyB += b * b;
      }
      var r = sum / Math.sqrt(energyA * energyB);
      correlations[lag] = r;
      if (r > best) best = r;
    }
    for (lag = minLag + 1; lag < maxLag; lag++) {
      var r0 = correlations[lag];
      if (r0 >= 0.9 * best && r0 >= correlations[lag - 1] && r0 >= correlations[lag + 1]) {
        var left = correlations[lag - 1], right = correlations[lag + 1];
        var shift = 0.5 * (left - right) / (left - 2 * r0 + right);
        return sampleRate / (lag + shift);
      }
    }
    return NaN;
  }

  // ---------- Bảng 8 nốt ----------
  var CRITERIA = [
    '1. Tên tiếng Việt', '2. Ký hiệu quốc tế', '3. Tần số', '4. Vị trí trên khuông',
    '5. Nhấn vào nốt', '6. Nghe và ghép tên', '7. Kéo thả', '8. Báo cáo'
  ];
  var NOT_YET = {};

  // vị trí mong đợi suy ra từ mô tả trong bảng chuẩn (độc lập với js/notes.js):
  // dòng n → 2(n−1); khe giữa dòng a và a+1 → 2a−1; khe dưới dòng 1 → −1; dòng kẻ phụ dưới → −2.
  function expectedStep(ref) {
    var p = ref.position;
    if (p.kind === 'ledger-below') return -2;
    if (p.kind === 'below-line') return -1;
    if (p.kind === 'line') return 2 * (p.line - 1);
    return 2 * p.lines[0] - 1;
  }

  // Mô phỏng kéo thẻ nốt bằng Pointer Events: nhấn ở giữa thẻ → di chuyển → thả tại (x, y).
  var nextPointerId = 100;
  function dragChip(host, noteId, clientX, clientY) {
    var chip = host.querySelector('[data-chip="' + noteId + '"]');
    assert(chip, 'Không còn thẻ ' + noteId + ' trên bảng nốt');
    var rect = chip.getBoundingClientRect();
    var sx = rect.left + rect.width / 2, sy = rect.top + rect.height / 2;
    var id = nextPointerId++;
    chip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: id, clientX: sx, clientY: sy, button: 0, isPrimary: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: id, clientX: (sx + clientX) / 2, clientY: (sy + clientY) / 2 }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: id, clientX: clientX, clientY: clientY }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, clientX: clientX, clientY: clientY }));
  }

  // Điểm trên màn hình của (cột tiếp theo, vị trí) trên bảng khuông, có thể lệch thêm dyHalfSteps nửa khoảng dòng.
  function dropPoint(ctx, step, dyHalfSteps) {
    var board = ctx.app.board();
    var column = ctx.app.getState().placed.length;
    var p = board.pointFor(column, step);
    var q = board.pointFor(column, step + 1);
    return { x: p.clientX, y: p.clientY + (q.clientY - p.clientY) * (dyHalfSteps || 0) };
  }

  function checkName(ref) {
    var note = MusicNotes.findNote(ref.id);
    assert(note, 'Không tìm thấy nốt ' + ref.id);
    assert(note.label === ref.label, 'Mong đợi "' + ref.label + '", nhận "' + note.label + '"');
    return note.label;
  }

  function checkSymbol(ref) {
    var note = MusicNotes.findNote(ref.id);
    assert(note.symbol === ref.symbol, 'Mong đợi ' + ref.symbol + ', nhận ' + note.symbol);
    return note.symbol;
  }

  function checkFrequency(ref) {
    var note = MusicNotes.findNote(ref.id);
    assert(near(note.frequency, ref.hz, FREQUENCY_TABLE_TOLERANCE_HZ),
      'Tính ra ' + note.frequency.toFixed(3) + ' Hz, bảng chuẩn ' + ref.hz);
    return AudioEngine.renderNoteOffline(note.frequency, 0.5).then(function (buffer) {
      var measured = measureFrequency(buffer);
      assert(near(measured, ref.hz, ref.hz * MEASURED_TOLERANCE_RATIO),
        'Âm thanh đo được ' + measured.toFixed(2) + ' Hz, chuẩn ' + ref.hz + ' Hz');
      return 'tính ' + note.frequency.toFixed(2) + ' Hz · đo âm thanh ' + measured.toFixed(2) + ' Hz';
    });
  }

  function checkPosition(ref, app) {
    var svg = app.staff.svg;
    var ys = lineYs(svg);
    var gap = ys[1] - ys[2];
    var node = app.staff.noteElement(ref.id);
    var head = node.querySelector('.note-head');
    var cy = Number(head.getAttribute('cy'));
    var ledgers = node.querySelectorAll('.ledger-line');
    var expectedY;
    var p = ref.position;

    if (p.kind === 'ledger-below') {
      expectedY = ys[1] + gap;
      assert(ledgers.length === 1, 'Cần đúng 1 dòng kẻ phụ, có ' + ledgers.length);
      assert(Number(ledgers[0].getAttribute('y1')) === cy, 'Dòng kẻ phụ không đi qua tâm nốt');
    } else {
      assert(ledgers.length === 0, 'Không được có dòng kẻ phụ, có ' + ledgers.length);
      if (p.kind === 'line') expectedY = ys[p.line];
      if (p.kind === 'space') expectedY = (ys[p.lines[0]] + ys[p.lines[1]]) / 2;
      if (p.kind === 'below-line') expectedY = ys[p.line] + gap / 2;
    }
    assert(cy === expectedY, 'Tâm nốt y = ' + cy + ', vị trí đúng y = ' + expectedY);

    // Kiểm tra trên hình đã hiển thị thật (pixel màn hình), không chỉ trên số liệu.
    var headRect = head.getBoundingClientRect();
    var renderedCenter = headRect.top + headRect.height / 2;
    var pxPerUnit = (lineRenderedY(svg, 1) - lineRenderedY(svg, 2)) / gap;
    var renderedExpected = lineRenderedY(svg, 1) + (expectedY - ys[1]) * pxPerUnit;
    assert(near(renderedCenter, renderedExpected, 1.5),
      'Trên màn hình lệch ' + (renderedCenter - renderedExpected).toFixed(2) + ' px');

    var note = MusicNotes.findNote(ref.id);
    assert(note.position.indexOf(ref.text) !== -1, 'Mô tả "' + note.position + '" thiếu "' + ref.text + '"');
    return note.position;
  }

  function checkClick(ref, ctx) {
    ctx.app.setMode('explore');
    var before = ctx.audio.notes.length;
    clickNote(ctx.app, ref.id);
    assert(ctx.audio.notes.length === before + 1, 'Không phát âm thanh khi nhấn');
    var played = ctx.audio.notes[ctx.audio.notes.length - 1];
    assert(near(played, ref.hz, FREQUENCY_TABLE_TOLERANCE_HZ), 'Phát ' + played.toFixed(2) + ' Hz');
    var panel = ctx.host.querySelector('[data-ref="panel"]');
    var name = panel.querySelector('.note-card-name').textContent;
    var symbol = panel.querySelector('[data-fact="symbol"]').textContent;
    var hz = panel.querySelector('[data-fact="frequency"]').textContent;
    assert(name === ref.label, 'Bảng hiện tên "' + name + '"');
    assert(symbol === ref.symbol, 'Bảng hiện ký hiệu "' + symbol + '"');
    assert(hz === ref.hz.toFixed(2).replace('.', ',') + ' Hz', 'Bảng hiện tần số "' + hz + '"');
    assert(ctx.app.staff.noteElement(ref.id).classList.contains('is-selected'), 'Nốt không được tô sáng');
    return 'hiện "' + name + ' · ' + symbol + ' · ' + hz + '", phát âm ' + played.toFixed(2) + ' Hz';
  }

  /*
   * Mục 6 – Nghe và ghép tên (mức Khó, có âm mốc):
   *  a) phát âm mốc Đô₄ rồi đến đúng tần số của nốt; b) chọn đúng → phản hồi đúng;
   *  c) chọn sai → hiện đáp án đúng, nút "Nghe lại" phát lại đúng nốt.
   */
  function checkListen(ref, ctx) {
    ctx.app.ask(ref.id);
    click(ctx.host, '[data-action="play"]');
    var seq = lastSequence(ctx.audio).frequencies;
    assert(seq.length === 2 && near(seq[0], REFERENCE_C4_HZ, 0.01), 'Không phát âm mốc Đô₄ trước');
    assert(near(seq[1], ref.hz, FREQUENCY_TABLE_TOLERANCE_HZ), 'Phát ' + seq[1].toFixed(2) + ' Hz thay vì ' + ref.hz);
    return wait(0).then(function () {
      click(ctx.host, '[data-answer="' + ref.id + '"]');
      var good = ctx.host.querySelector('.find-feedback.is-good');
      assert(good && good.textContent.indexOf(ref.label) !== -1, 'Chọn đúng nhưng không có phản hồi đúng');

      ctx.app.ask(ref.id);
      click(ctx.host, '[data-action="play"]');
      return wait(0);
    }).then(function () {
      var wrongId = ref.id === 'C4' ? 'C5' : 'C4';
      click(ctx.host, '[data-answer="' + wrongId + '"]');
      var retry = ctx.host.querySelector('.find-feedback.is-retry');
      assert(retry && retry.textContent.indexOf(ref.label) !== -1, 'Chọn sai nhưng không hiện đáp án đúng');
      assert(ctx.host.querySelector('[data-answer="' + ref.id + '"]').classList.contains('is-correct'), 'Nút đáp án đúng không được tô xanh');
      click(ctx.host, '[data-action="play-target"]');
      var replay = ctx.audio.notes[ctx.audio.notes.length - 1];
      assert(near(replay, ref.hz, FREQUENCY_TABLE_TOLERANCE_HZ), 'Nghe lại phát ' + replay + ' Hz');
      return 'âm mốc + ' + seq1(ctx) + ' Hz · đúng/sai/nghe lại đều đúng';
    });
  }

  /*
   * Mục 8 – Báo cáo: nghe nốt rồi trả lời SAI một câu, ĐÚNG một câu (ở Nghe cao độ, mức Khó),
   * kiểm tra dòng của nốt đó trong báo cáo và trong file CSV xuất ra.
   */
  function checkReport(ref) {
    var log = PracticeLog.create({ storage: null });
    var listen = mountFresh(9, ListeningActivity, { log: log });
    listen.app.setLevel('hard');
    var saved = [];
    var report = mountFresh(9, ReportActivity, { log: log, download: function (n, b) { saved.push(b); } });
    var wrongId = ref.id === 'C4' ? 'D4' : 'C4';
    function askAndAnswer(answerId) {
      listen.app.ask(ref.id);
      click(listen.host, '[data-action="play"]');
      return wait(0).then(function () { click(listen.host, '[data-answer="' + answerId + '"]'); });
    }
    return askAndAnswer(wrongId).then(function () { return askAndAnswer(ref.id); }).then(function () {
      var row = report.host.querySelector('[data-section="notes"] tr[data-note="' + ref.id + '"]');
      assert(row, 'Báo cáo không có dòng ' + ref.label);
      var cells = Array.prototype.map.call(row.cells, function (c) { return c.textContent; });
      assert(cells.join('|') === ref.label + '|2|1|1|50%', 'Dòng báo cáo: ' + cells.join(' | '));
      click(report.host, '[data-ref="exportCsv"]');
      return readBlob(saved[0]);
    }).then(function (csv) {
      var rows = csv.trim().split('\r\n').slice(1).filter(function (r) { return r.indexOf(',' + ref.label + ',') !== -1; });
      assert(rows.length === 2, 'CSV có ' + rows.length + ' dòng về ' + ref.label);
      assert(/,Sai$/.test(rows[0]) && /,Đúng$/.test(rows[1]), 'CSV ghi sai kết quả: ' + rows.join(' / '));
      return '2 câu · đúng 1 · sai 1 · 50%; CSV 2 dòng Sai → Đúng';
    });
  }

  function seq1(ctx) {
    return lastSequence(ctx.audio).frequencies[1].toFixed(2);
  }

  /*
   * Mục 7 – Kéo thả (kéo bằng Pointer Events thật trên khuông đang hiển thị):
   *  a) thả cao hơn vị trí đúng một bậc → báo sai, gợi ý "thấp hơn", nốt không được nhận;
   *  b) thả ở vị trí đúng (lệch tay 0,3 nửa khoảng dòng) → được nhận;
   *  c) nốt đã đặt nằm đúng dòng/khe theo bảng chuẩn; chỉ Đô₄ có dòng kẻ phụ và dòng kẻ phụ đi qua tâm nốt.
   */
  function checkDrag(ref, ctx) {
    var step = expectedStep(ref);
    var wrong = dropPoint(ctx, step + 1, 0);
    dragChip(ctx.host, ref.id, wrong.x, wrong.y);
    var feedback = ctx.host.querySelector('[data-ref="feedback"]');
    assert(feedback.classList.contains('is-retry') && feedback.textContent.indexOf(ref.label) !== -1 &&
      feedback.textContent.indexOf('thấp hơn') !== -1, 'Thả sai nhưng phản hồi là: ' + feedback.textContent);
    assert(ctx.app.getState().placed.indexOf(ref.id) === -1, 'Thả sai vẫn được nhận');

    var right = dropPoint(ctx, step, 0.3);
    dragChip(ctx.host, ref.id, right.x, right.y);
    assert(feedback.classList.contains('is-good'), 'Thả đúng nhưng phản hồi là: ' + feedback.textContent);
    assert(ctx.app.getState().placed.indexOf(ref.id) !== -1, 'Thả đúng nhưng không được nhận');

    var node = ctx.app.board().element('placed-' + ref.id);
    var svg = node.ownerSVGElement;
    var ys = lineYs(svg);
    var gap = ys[1] - ys[2];
    var cy = Number(node.querySelector('.note-head').getAttribute('cy'));
    var expectedY = ys[1] - step * gap / 2;
    assert(cy === expectedY, 'Nốt đặt ở y = ' + cy + ', đúng phải là ' + expectedY);
    var ledgers = node.querySelectorAll('.ledger-line');
    if (ref.id === 'C4') {
      assert(ledgers.length === 1 && Number(ledgers[0].getAttribute('y1')) === cy, 'Đô₄ thiếu dòng kẻ phụ đi qua tâm nốt');
    } else {
      assert(ledgers.length === 0, ref.label + ' không được có dòng kẻ phụ');
    }
    return 'thả ở vị trí ' + (step + 1) + ' → báo sai; thả ở vị trí ' + step + ' → nhận' + (ref.id === 'C4' ? ', có dòng kẻ phụ' : '');
  }

  function setCell(cell, ok, detail) {
    if (ok) results.pass += 1; else results.fail += 1;
    cell.className = ok ? 'ok' : 'bad';
    cell.innerHTML = (ok ? '✅ Đạt' : '❌ Lỗi') + '<span class="detail"></span>';
    cell.querySelector('.detail').textContent = detail || '';
  }

  function runNoteMatrix() {
    var table = document.getElementById('note-matrix');
    table.innerHTML = '<tr><th>Nốt</th>' + CRITERIA.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr>';
    var staffCtx = mountFresh(3);
    var listenCtx = mountFresh(5, ListeningActivity);
    listenCtx.app.setLevel('hard');
    var dragCtx = mountFresh(6, DragActivity, { columnsPerRow: 8 });

    return REFERENCE.reduce(function (chain, ref) {
      return chain.then(function () {
        var row = document.createElement('tr');
        row.innerHTML = '<th>' + ref.label + ' (' + ref.symbol + ')</th>';
        table.appendChild(row);
        var checks = [
          function () { return checkName(ref); },
          function () { return checkSymbol(ref); },
          function () { return checkFrequency(ref); },
          function () { return checkPosition(ref, staffCtx.app); },
          function () { return checkClick(ref, staffCtx); },
          function () { return checkListen(ref, listenCtx); },
          function () { return checkDrag(ref, dragCtx); },
          function () { return checkReport(ref); }
        ];
        var cells = checks.map(function () { return row.appendChild(document.createElement('td')); });
        for (var i = checks.length; i < CRITERIA.length; i++) {
          var td = row.appendChild(document.createElement('td'));
          td.className = 'na';
          td.textContent = NOT_YET[i];
        }
        return checks.reduce(function (inner, check, index) {
          return inner.then(function () {
            return Promise.resolve().then(check).then(function (detail) {
              setCell(cells[index], true, detail);
            }, function (error) {
              setCell(cells[index], false, error.message);
            });
          });
        }, Promise.resolve());
      });
    }, Promise.resolve());
  }

  // =====================================================================
  // NHÓM 1 – Khuông nhạc tương tác (Giai đoạn 1)
  // =====================================================================
  var STAFF_TESTS = [
    ['Khuông có đúng 5 dòng kẻ, cách đều nhau', function () {
      var ctx = mountFresh();
      var ys = lineYs(ctx.app.staff.svg);
      assert(Object.keys(ys).length === 5, 'Có ' + Object.keys(ys).length + ' dòng');
      for (var line = 1; line < 5; line++) {
        assert(ys[line] - ys[line + 1] === StaffRenderer.LINE_GAP, 'Khoảng cách dòng ' + line + '–' + (line + 1) + ' sai');
      }
      return 'dòng 1 → dòng 5 cách đều ' + StaffRenderer.LINE_GAP + ' đơn vị';
    }],
    ['Khóa Sol là glyph gClef của Bravura (SMuFL); vòng xoắn ôm quanh dòng 2', function () {
      var ctx = mountFresh();
      var svg = ctx.app.staff.svg;
      var group = svg.querySelector('.treble-clef');
      assert(group && group.getAttribute('data-glyph') === 'gClef', 'Không có khóa Sol gClef');
      var clef = group.querySelector('path');
      // Đường viền đúng là glyph Bravura: khung bao khớp số liệu chính thức của Bravura
      // (bBoxNE 2,684 / 4,392 và bBoxSW 0 / −2,632 khoảng dòng; 1 khoảng dòng = 250 đơn vị).
      var box = clef.getBBox();
      assert(Math.abs(box.x) < 1 && Math.abs(box.width - 671) < 1 &&
        Math.abs(box.y + 1098) < 1 && Math.abs(box.height - 1756) < 1,
        'Khung bao không khớp glyph gClef của Bravura: ' + [box.x, box.y, box.width, box.height].join(', '));
      // Gốc glyph (y = 0, theo SMuFL là dòng Sol) phải trùng dòng 2; cỡ khóa theo khoảng cách dòng.
      var ys = lineYs(svg);
      var m = group.transform.baseVal.consolidate().matrix;
      var scale = StaffRenderer.LINE_GAP / 250;
      assert(Math.abs(m.f - ys[2]) < 0.01, 'Gốc khóa ở y = ' + m.f + ', dòng 2 ở y = ' + ys[2]);
      assert(Math.abs(m.a - scale) < 1e-6 && Math.abs(m.d - scale) < 1e-6, 'Cỡ khóa sai: ' + m.a);
      var top = m.f + box.y * scale, bottom = m.f + (box.y + box.height) * scale;
      assert(top < ys[5] && bottom > ys[1], 'Khóa phải vượt lên trên dòng 5 và xuống dưới dòng 1');
      // Vòng xoắn ôm dòng 2: đi ngang theo dòng 2 gặp 4 đoạn nét (vòng ngoài và vòng trong
      // ở cả hai bên); đi dọc giữa vòng xoắn gặp nét ở cả trên và dưới dòng 2.
      function runs(points) {
        var count = 0, inside = false;
        points.forEach(function (p) {
          var point = svg.createSVGPoint(); point.x = p[0]; point.y = p[1];
          var fill = clef.isPointInFill(point);
          if (fill && !inside) count++;
          inside = fill;
        });
        return count;
      }
      var across = [], above = [], below = [];
      for (var x = -10; x <= 700; x += 2) across.push([x, 0]);
      for (var y = -250; y < 0; y += 2) above.push([336, y]);
      for (var y2 = 2; y2 <= 250; y2 += 2) below.push([336, y2]);
      var crossings = runs(across);
      assert(crossings === 4, 'Dòng 2 cắt nét khóa ' + crossings + ' lần (cần 4)');
      assert(runs(above) >= 1 && runs(below) >= 1, 'Vòng xoắn không bao quanh dòng 2');
      // Khóa nằm ở đầu khuông, không chạm nốt đầu tiên.
      var right = m.e + (box.x + box.width) * scale;
      var firstHead = svg.querySelector('.note-head');
      var firstLeft = Number(firstHead.getAttribute('cx')) - Number(firstHead.getAttribute('rx'));
      assert(m.e > 0 && right < firstLeft, 'Khóa chồng lên nốt đầu tiên');
      return 'gốc khóa trùng dòng 2 (y = ' + ys[2] + '); dòng 2 cắt vòng xoắn ' + crossings + ' lần';
    }],
    ['8 nốt đi lên đều, mỗi nốt cao hơn nốt trước đúng nửa khoảng dòng', function () {
      var ctx = mountFresh();
      var previous = null;
      MusicNotes.NOTES.forEach(function (note) {
        var cy = Number(ctx.app.staff.noteElement(note.id).querySelector('.note-head').getAttribute('cy'));
        if (previous !== null) {
          assert(previous - cy === StaffRenderer.LINE_GAP / 2, note.label + ' không cao hơn nốt trước nửa khoảng');
        }
        previous = cy;
      });
      return 'Đô₄ → Đô₅ tăng đều từng bậc';
    }],
    ['Chỉ Đô₄ có dòng kẻ phụ', function () {
      var ctx = mountFresh();
      var withLedger = MusicNotes.NOTES.filter(function (note) {
        return ctx.app.staff.noteElement(note.id).querySelectorAll('.ledger-line').length > 0;
      }).map(function (note) { return note.id; });
      assert(withLedger.join(',') === 'C4', 'Nốt có dòng kẻ phụ: ' + withLedger.join(', '));
      return 'chỉ C4';
    }],
    ['Hướng thân nốt: Si₄, Đô₅ quay xuống; các nốt dưới dòng giữa quay lên', function () {
      var ctx = mountFresh();
      MusicNotes.NOTES.forEach(function (note) {
        var direction = ctx.app.staff.noteElement(note.id).querySelector('.note-stem').getAttribute('data-direction');
        var expected = (note.id === 'B4' || note.id === 'C5') ? 'down' : 'up';
        assert(direction === expected, note.label + ' thân nốt quay ' + direction);
      });
      return 'đúng quy tắc nhạc lý';
    }],
    ['Bật/tắt tên nốt', function () {
      var ctx = mountFresh();
      ctx.host.classList.add('no-transition');
      var toggle = ctx.host.querySelector('[data-ref="labelsToggle"]');
      var label = ctx.app.staff.noteElement('E4').querySelector('.note-label');
      function opacityIs(value) { return function () { return getComputedStyle(label).opacity === value; }; }
      toggle.checked = false;
      toggle.dispatchEvent(new Event('change'));
      return waitFor(opacityIs('0'), 2000).then(function (hidden) {
        assert(hidden, 'Tên nốt vẫn hiện khi tắt');
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change'));
        return waitFor(opacityIs('1'), 2000);
      }).then(function (shown) {
        assert(shown, 'Tên nốt không hiện lại khi bật');
        return 'ẩn → hiện đúng';
      });
    }],
    ['Bàn phím: nhấn Enter trên nốt đang chọn cũng phát âm', function () {
      var ctx = mountFresh();
      var node = ctx.app.staff.noteElement('G4');
      node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      assert(ctx.audio.notes.length === 1 && near(ctx.audio.notes[0], 392, 0.01), 'Không phát Sol₄');
      return 'Enter → Sol₄ 392 Hz';
    }],
    ['Nghe cả 8 nốt: phát đúng thứ tự, tô sáng từng nốt, nút Dừng hoạt động', function () {
      var ctx = mountFresh();
      var button = ctx.host.querySelector('[data-ref="scaleButton"]');
      button.click();
      var seq = ctx.audio.sequences[0];
      assert(seq && seq.frequencies.length === 8, 'Không phát dãy 8 nốt');
      for (var i = 1; i < 8; i++) assert(seq.frequencies[i] > seq.frequencies[i - 1], 'Thứ tự không đi lên');
      seq.options.onStep(4);
      assert(ctx.app.staff.noteElement('G4').classList.contains('is-playing'), 'Không tô sáng Sol₄ khi phát');
      assert(button.textContent.indexOf('Dừng') !== -1, 'Nút không đổi thành Dừng');
      button.click();
      assert(ctx.audio.stopCount >= 1, 'Không dừng âm thanh');
      assert(button.textContent.indexOf('Nghe cả 8 nốt') !== -1, 'Nút không trở lại');
      assert(!ctx.app.staff.noteElement('G4').classList.contains('is-playing'), 'Vẫn còn tô sáng sau khi dừng');
      return 'phát → tô sáng → dừng';
    }],
    ['Thanh âm lượng điều khiển âm lượng và đồng bộ giữa các hoạt động', function () {
      var a = mountFresh();
      var b = mountFresh(9, ListeningActivity);
      var slider = a.host.querySelector('[data-ref="volume"]');
      slider.value = '30';
      slider.dispatchEvent(new Event('input'));
      assert(near(a.audio.volume, 0.3, 0.001), 'Âm lượng = ' + a.audio.volume);
      assert(b.host.querySelector('[data-ref="volume"]').value === '30', 'Thanh âm lượng ở hoạt động khác không cập nhật');
      return '30% → setVolume(0,3), thanh khác cũng về 30%';
    }],
    ['Âm thanh bị chặn: hiện thông báo hướng dẫn, phát được thì tự ẩn', function () {
      var ctx = mountFresh();
      var alertBox = ctx.host.querySelector('[data-ref="audioAlert"]');
      var blocked = new Error('blocked'); blocked.code = 'blocked';
      ctx.audio.failNext = blocked;
      clickNote(ctx.app, 'A4');
      return wait(0).then(function () {
        assert(!alertBox.hidden, 'Không hiện thông báo');
        assert(alertBox.textContent.indexOf('iPhone') !== -1, 'Thông báo thiếu hướng dẫn');
        clickNote(ctx.app, 'A4');
        return wait(0);
      }).then(function () {
        assert(alertBox.hidden, 'Thông báo không tự ẩn');
        return 'hiện → ẩn đúng';
      });
    }],
    ['Trình duyệt không hỗ trợ âm thanh: thông báo riêng', function () {
      var ctx = mountFresh();
      var alertBox = ctx.host.querySelector('[data-ref="audioAlert"]');
      var unsupported = new Error('x'); unsupported.code = 'unsupported';
      ctx.audio.failNext = unsupported;
      clickNote(ctx.app, 'A4');
      return wait(0).then(function () {
        assert(alertBox.textContent.indexOf('chưa hỗ trợ') !== -1, 'Thông báo sai: ' + alertBox.textContent);
        return alertBox.textContent;
      });
    }],
    ['Tìm nốt: ẩn tên nốt, khoá công tắc, ẩn nút nghe thang âm', function () {
      var ctx = mountFresh();
      ctx.app.setMode('find');
      var toggle = ctx.host.querySelector('[data-ref="labelsToggle"]');
      assert(ctx.app.staff.svg.classList.contains('labels-hidden'), 'Tên nốt chưa bị ẩn');
      assert(toggle.disabled && !toggle.checked, 'Công tắc chưa bị khoá');
      assert(ctx.host.querySelector('[data-ref="scaleButton"]').hidden, 'Nút nghe thang âm vẫn hiện');
      var ariaLabel = ctx.app.staff.noteElement('C4').getAttribute('aria-label');
      assert(ariaLabel === 'Nốt thứ 1', 'Nhãn đọc màn hình lộ đáp án: "' + ariaLabel + '"');
      var target = ctx.host.querySelector('[data-ref-target]').textContent;
      assert(MusicNotes.NOTES.some(function (n) { return n.label === target; }), 'Câu hỏi không phải 1 trong 8 nốt');
      return 'câu hỏi: "' + target + '"';
    }],
    ['Tìm nốt: chạm đúng ngay lần đầu được tính điểm', function () {
      var ctx = mountFresh();
      ctx.app.setMode('find');
      var state = ctx.app.getState();
      clickNote(ctx.app, state.targetId);
      assert(state.stats.completed === 1 && state.stats.firstTryCorrect === 1 && state.stats.wrongTaps === 0,
        'Điểm sai: ' + JSON.stringify(state.stats));
      assert(ctx.host.querySelector('.find-feedback.is-good'), 'Thiếu phản hồi đúng');
      assert(ctx.host.querySelector('[data-stat="rate"]').textContent === '100%', 'Tỷ lệ hiển thị sai');
      return 'đã làm 1 · đúng lần đầu 1 · tỷ lệ 100%';
    }],
    ['Tìm nốt: chạm sai 2 lần thì tô sáng đáp án; đúng sau đó không tính "đúng lần đầu"', function () {
      var ctx = mountFresh();
      ctx.app.setMode('find');
      var state = ctx.app.getState();
      var target = state.targetId;
      var wrong = MusicNotes.NOTES.filter(function (n) { return n.id !== target; });
      clickNote(ctx.app, wrong[0].id);
      assert(ctx.host.querySelector('.find-feedback.is-retry'), 'Thiếu phản hồi sai');
      assert(!ctx.app.staff.noteElement(target).classList.contains('is-hint'), 'Gợi ý quá sớm');
      clickNote(ctx.app, wrong[1].id);
      assert(ctx.app.staff.noteElement(target).classList.contains('is-hint'), 'Không tô sáng đáp án sau 2 lần sai');
      clickNote(ctx.app, target);
      assert(state.stats.completed === 1 && state.stats.firstTryCorrect === 0 && state.stats.wrongTaps === 2,
        'Điểm sai: ' + JSON.stringify(state.stats));
      assert(ctx.host.querySelector('[data-stat="rate"]').textContent === '0%', 'Tỷ lệ hiển thị sai');
      return 'đã làm 1 · đúng lần đầu 0 · chạm sai 2';
    }],
    ['Tìm nốt: câu tiếp theo tự xuất hiện và không lặp lại nốt vừa hỏi', function () {
      var ctx = mountFresh(11);
      ctx.app.setMode('find');
      var state = ctx.app.getState();
      var first = state.targetId;
      clickNote(ctx.app, first);
      return wait(1600).then(function () {
        assert(state.targetId && state.targetId !== first, 'Câu mới trùng câu cũ hoặc không có');
        assert(!state.locked, 'Câu mới vẫn bị khoá');
        return first + ' → ' + state.targetId;
      });
    }],
    ['Tìm nốt: "Đổi câu khác" không làm thay đổi điểm', function () {
      var ctx = mountFresh();
      ctx.app.setMode('find');
      var state = ctx.app.getState();
      var first = state.targetId;
      ctx.host.querySelector('[data-action="skip"]').click();
      assert(state.targetId !== first, 'Không đổi câu');
      assert(state.stats.completed === 0 && state.stats.wrongTaps === 0, 'Điểm bị thay đổi');
      return first + ' → ' + state.targetId + ', điểm giữ nguyên 0';
    }],
    ['Chuyển lại Khám phá: tên nốt hiện lại theo công tắc, bảng thông tin trở về ban đầu', function () {
      var ctx = mountFresh();
      ctx.app.setMode('find');
      ctx.app.setMode('explore');
      assert(!ctx.app.staff.svg.classList.contains('labels-hidden'), 'Tên nốt vẫn ẩn');
      assert(ctx.host.querySelector('.panel-hint'), 'Bảng thông tin chưa trở về ban đầu');
      return 'đúng';
    }]
  ];

  // =====================================================================
  // NHÓM 2 – Nghe cao độ (Giai đoạn 2)
  // =====================================================================
  function listen(seed) { return mountFresh(seed || 21, ListeningActivity); }

  // Phát âm thanh của câu hiện tại rồi chờ ứng dụng mở khoá các nút trả lời.
  function playAndWait(ctx) {
    click(ctx.host, '[data-action="play"]');
    return wait(0);
  }

  var LISTENING_TESTS = [
    ['Chưa nghe âm thanh thì chưa được trả lời', function () {
      var ctx = listen();
      var buttons = ctx.host.querySelectorAll('[data-answer]');
      assert(buttons.length === 3, 'Mức Dễ phải có 3 lựa chọn, có ' + buttons.length);
      assert(Array.prototype.every.call(buttons, function (b) { return b.disabled; }), 'Nút trả lời không bị khoá');
      ctx.app.getState().question.played = false;
      buttons[0].disabled = false; buttons[0].click(); // cố tình bấm khi chưa nghe
      assert(ctx.app.getState().practice.answered === 0, 'Vẫn tính điểm khi chưa nghe');
      return playAndWait(ctx).then(function () {
        var enabled = ctx.host.querySelectorAll('[data-answer]:not([disabled])').length;
        assert(enabled === 3, 'Sau khi nghe chỉ mở ' + enabled + ' nút');
        return 'khoá → nghe → mở 3 nút';
      });
    }],
    ['Mức độ: Dễ 3 nốt, Vừa 5 nốt, Khó 8 nốt; câu hỏi luôn thuộc mức đã chọn', function () {
      var ctx = listen(33);
      var expected = { easy: ['C4', 'E4', 'G4'], medium: ['C4', 'D4', 'E4', 'F4', 'G4'], hard: MusicNotes.NOTES.map(function (n) { return n.id; }) };
      Object.keys(expected).forEach(function (level) {
        ctx.app.setLevel(level);
        var shown = Array.prototype.map.call(ctx.host.querySelectorAll('[data-answer]'), function (b) { return b.getAttribute('data-answer'); });
        assert(shown.join(',') === expected[level].join(','), 'Mức ' + level + ' hiện ' + shown.join(','));
        for (var i = 0; i < 40; i++) {
          ctx.app.ask();
          assert(expected[level].indexOf(ctx.app.getState().question.targetId) !== -1, 'Câu hỏi ngoài mức ' + level);
        }
      });
      return 'Dễ: Đô₄ Mi₄ Sol₄ · Vừa: Đô₄→Sol₄ · Khó: 8 nốt (xếp theo cao độ)';
    }],
    ['Không hỏi lại ngay nốt vừa hỏi (40 câu liên tiếp)', function () {
      var ctx = listen(44);
      ctx.app.setLevel('hard');
      var previous = ctx.app.getState().question.targetId;
      for (var i = 0; i < 40; i++) {
        ctx.app.ask();
        var current = ctx.app.getState().question.targetId;
        assert(current !== previous, 'Câu ' + (i + 1) + ' lặp lại ' + current);
        previous = current;
      }
      return 'không có hai câu liền nhau trùng nốt';
    }],
    ['Có âm mốc: phát Đô₄ rồi đến âm cần đoán; tắt âm mốc: chỉ phát âm cần đoán', function () {
      var ctx = listen();
      ctx.app.ask('G4');
      click(ctx.host, '[data-action="play"]');
      var withRef = lastSequence(ctx.audio).frequencies;
      assert(withRef.length === 2 && near(withRef[0], 261.63, 0.01) && near(withRef[1], 392, 0.01), 'Có âm mốc nhưng phát ' + withRef);
      var toggle = ctx.host.querySelector('[data-ref="referenceToggle"]');
      toggle.checked = false;
      toggle.dispatchEvent(new Event('change'));
      click(ctx.host, '[data-action="play"]');
      var noRef = lastSequence(ctx.audio).frequencies;
      assert(noRef.length === 1 && near(noRef[0], 392, 0.01), 'Tắt âm mốc nhưng phát ' + noRef);
      click(ctx.host, '[data-action="reference"]');
      assert(near(ctx.audio.notes[ctx.audio.notes.length - 1], 261.63, 0.01), 'Nút "Nghe âm mốc" không phát Đô₄');
      return '[261,63; 392] → [392]; nút âm mốc phát 261,63 Hz';
    }],
    ['Luyện tập: chỉ tính lần trả lời đầu tiên; thống kê đúng/sai/tỷ lệ', function () {
      var ctx = listen();
      var state = ctx.app.getState();
      ctx.app.ask('E4');
      return playAndWait(ctx).then(function () {
        click(ctx.host, '[data-answer="E4"]');              // đúng
        click(ctx.host, '[data-action="next"]');
        state.question.targetId = 'G4';                      // đặt câu thứ hai là Sol₄
        return playAndWait(ctx);
      }).then(function () {
        click(ctx.host, '[data-answer="C4"]');              // sai
        var again = ctx.host.querySelector('[data-answer="G4"]');
        assert(again.disabled, 'Vẫn cho chọn lại sau khi đã trả lời');
        assert(state.practice.answered === 2 && state.practice.correct === 1, 'Thống kê sai: ' + JSON.stringify(state.practice));
        assert(ctx.host.querySelector('[data-stat="rate"]').textContent === '50%', 'Tỷ lệ hiển thị sai');
        assert(ctx.host.querySelector('[data-action="play-chosen"]'), 'Thiếu nút nghe nốt em chọn để so sánh');
        assert(ctx.host.querySelector('.mini-caption').textContent.indexOf('dòng kẻ thứ hai') !== -1, 'Khuông đáp án không ghi vị trí Sol₄');
        return 'đã trả lời 2 · đúng 1 · sai 1 · 50%';
      });
    }],
    ['Đổi mức độ thì thống kê luyện tập bắt đầu lại', function () {
      var ctx = listen();
      ctx.app.ask('C4');
      return playAndWait(ctx).then(function () {
        click(ctx.host, '[data-answer="C4"]');
        assert(ctx.app.getState().practice.answered === 1, 'Chưa ghi nhận câu trả lời');
        click(ctx.host, '[data-level="medium"]');
        assert(ctx.app.getState().practice.answered === 0, 'Thống kê không được đặt lại');
        return 'về 0 khi đổi mức';
      });
    }],
    ['Thử thách 5 câu: đếm câu, kết quả, danh sách câu sai, gợi ý nốt cần luyện', function () {
      var ctx = listen(55);
      ctx.app.setMode('challenge');
      var select = ctx.host.querySelector('[data-ref="lengthSelect"]');
      select.value = '5';
      select.dispatchEvent(new Event('change'));
      var state = ctx.app.getState();
      // Câu 1, 3: đúng. Câu 2, 4, 5: sai, trong đó Sol₄ bị nhầm 2 lần.
      var plan = [
        { target: 'C4', choose: 'C4' }, { target: 'G4', choose: 'E4' }, { target: 'E4', choose: 'E4' },
        { target: 'G4', choose: 'C4' }, { target: 'C4', choose: 'E4' }
      ];
      return plan.reduce(function (chain, step, i) {
        return chain.then(function () {
          assert(ctx.host.querySelector('[data-ref-progress]').textContent.indexOf('Câu ' + (i + 1) + '/5') === 0, 'Sai số thứ tự câu');
          state.question.targetId = step.target;
          return playAndWait(ctx);
        }).then(function () {
          click(ctx.host, '[data-answer="' + step.choose + '"]');
          click(ctx.host, '[data-action="next"]');
        });
      }, Promise.resolve()).then(function () {
        var resultsBox = ctx.host.querySelector('[data-ref-results]');
        assert(resultsBox, 'Không hiện bảng kết quả');
        var stat = function (k) { return resultsBox.querySelector('[data-stat="' + k + '"]').textContent; };
        assert(stat('total') === '5' && stat('correct') === '2' && stat('wrong') === '3' && stat('rate') === '40%',
          'Kết quả sai: ' + stat('total') + '/' + stat('correct') + '/' + stat('wrong') + '/' + stat('rate'));
        assert(resultsBox.querySelectorAll('.mistake-list li').length === 3, 'Danh sách câu sai không đủ 3 câu');
        var hint = resultsBox.querySelector('.practice-hint');
        assert(hint && hint.textContent.indexOf('Sol₄') !== -1 && hint.textContent.indexOf('Đô₄') === -1,
          'Gợi ý nốt cần luyện sai: ' + (hint && hint.textContent));
        click(ctx.host, '[data-action="restart"]');
        assert(state.round.number === 1 && state.round.correct === 0 && !state.round.finished, 'Chơi lại không đặt lại lượt');
        return '5 câu · đúng 2 · sai 3 · 40% · gợi ý luyện Sol₄ (nhầm 2 lần)';
      });
    }],
    ['Âm thanh bị chặn: báo lỗi và vẫn khoá nút trả lời', function () {
      var ctx = listen();
      var blocked = new Error('blocked'); blocked.code = 'blocked';
      ctx.audio.failNext = blocked;
      return playAndWait(ctx).then(function () {
        assert(!ctx.host.querySelector('[data-ref="audioAlert"]').hidden, 'Không hiện thông báo lỗi');
        assert(ctx.host.querySelectorAll('[data-answer]:not([disabled])').length === 0, 'Nút trả lời bị mở dù chưa nghe được');
        return 'thông báo hiện, nút vẫn khoá';
      });
    }],
    ['Ghi rõ đây là âm thanh tổng hợp, không nhận diện giọng hát', function () {
      var ctx = listen();
      var note = ctx.host.querySelector('.honest-note').textContent;
      assert(note.indexOf('tổng hợp') !== -1 && note.indexOf('không nhận diện giọng hát') !== -1, 'Thiếu ghi chú');
      return note;
    }]
  ];

  // =====================================================================
  // NHÓM 3 – Ngân hàng câu hỏi (Giai đoạn 2)
  // Kiểm tra lại đáp án bằng cách tính độc lập, không tin vào answerId do bộ sinh câu hỏi đưa ra.
  // =====================================================================
  var SAMPLES_PER_TYPE = 300;

  function noteIndex(id) {
    for (var i = 0; i < REFERENCE.length; i++) if (REFERENCE[i].id === id) return i;
    return -1;
  }
  function refHz(id) { return REFERENCE[noteIndex(id)].hz; }

  // Trả về id đáp án đúng tính độc lập từ nội dung câu hỏi.
  function independentAnswer(q) {
    var parts = q.key.split(':');
    switch (q.type) {
      case 'staff-name':
        return q.staffNoteId;
      case 'order':
        return REFERENCE[noteIndex(parts[2]) + (parts[1] === 'after' ? 1 : -1)].id;
      case 'position':
        if (parts[1] === 'which') {
          var matches = REFERENCE.filter(function (r) { return q.prompt.indexOf('nằm ở ' + MusicNotes.findNote(r.id).position + ' ') !== -1; });
          assert(matches.length === 1, 'Mô tả vị trí khớp ' + matches.length + ' nốt');
          return matches[0].id;
        }
        var asked = REFERENCE.filter(function (r) { return q.prompt.indexOf('nốt ' + r.label + ' ') !== -1; });
        assert(asked.length === 1, 'Không xác định được nốt được hỏi');
        return asked[0].id;
      case 'sound-symbol':
        var byFreq = REFERENCE.filter(function (r) { return near(r.hz, q.sound[1], 0.01); });
        return byFreq[0].id;
      case 'higher-lower':
        if (q.sound) return q.sound[1] > q.sound[0] ? 'higher' : 'lower';
        var ids = q.options.map(function (o) { return o.id; });
        var higher = refHz(ids[0]) > refHz(ids[1]) ? ids[0] : ids[1];
        var lower = higher === ids[0] ? ids[1] : ids[0];
        return q.prompt.indexOf('cao hơn?') !== -1 ? higher : lower;
    }
    throw new Error('Dạng câu hỏi lạ: ' + q.type);
  }

  var BANK_TESTS = [
    ['Mỗi dạng câu hỏi: ' + SAMPLES_PER_TYPE + ' câu ngẫu nhiên đều có đúng 1 đáp án đúng (kiểm tra độc lập)', function () {
      var random = seededRandom(2026);
      var checked = 0;
      QuestionBank.TYPE_KEYS.forEach(function (type) {
        for (var i = 0; i < SAMPLES_PER_TYPE; i++) {
          var q = QuestionBank.generate(type, random);
          var ids = q.options.map(function (o) { return o.id; });
          var texts = q.options.map(function (o) { return o.text; });
          var expectedCount = type === 'higher-lower' ? 2 : 4;
          assert(q.options.length === expectedCount, type + ': có ' + q.options.length + ' phương án');
          assert(new Set(ids).size === ids.length && new Set(texts).size === texts.length, type + ': phương án bị trùng – ' + texts.join(' | '));
          assert(ids.filter(function (id) { return id === q.answerId; }).length === 1, type + ': đáp án không nằm đúng 1 lần trong phương án');
          var truth = independentAnswer(q);
          assert(truth === q.answerId, type + ' "' + q.prompt + '": đáp án ' + q.answerId + ', tính lại được ' + truth);
          assert(q.explanation && q.prompt, type + ': thiếu lời giải thích hoặc câu hỏi');
          checked += 1;
        }
      });
      return checked + ' câu đã kiểm tra';
    }],
    ['Câu "Ghép ký hiệu với âm thanh": luôn có âm mốc Đô₄; phương án sai cách đáp án ≥ 2 bậc', function () {
      var random = seededRandom(7);
      for (var i = 0; i < SAMPLES_PER_TYPE; i++) {
        var q = QuestionBank.generate('sound-symbol', random);
        assert(near(q.sound[0], REFERENCE_C4_HZ, 0.01), 'Âm đầu không phải Đô₄');
        q.options.forEach(function (o) {
          if (o.id !== q.answerId) assert(Math.abs(noteIndex(o.id) - noteIndex(q.answerId)) >= 2, 'Phương án ' + o.id + ' quá gần ' + q.answerId);
        });
        var freqs = q.options.map(function (o) { return refHz(o.id); });
        for (var k = 1; k < freqs.length; k++) assert(freqs[k] > freqs[k - 1], 'Phương án không xếp theo cao độ');
      }
      return 'đạt với ' + SAMPLES_PER_TYPE + ' câu';
    }],
    ['Đủ cả 8 nốt làm đáp án trong các dạng đọc nốt, vị trí, nghe ký hiệu', function () {
      var random = seededRandom(99);
      ['staff-name', 'position', 'sound-symbol'].forEach(function (type) {
        var seen = {};
        for (var i = 0; i < 200; i++) seen[QuestionBank.generate(type, random).answerId] = true;
        assert(Object.keys(seen).length === 8, type + ' chỉ có ' + Object.keys(seen).length + ' nốt làm đáp án');
      });
      return '8/8 nốt ở cả 3 dạng';
    }],
    ['Thứ tự phương án được trộn (không phải lúc nào đáp án cũng ở vị trí A)', function () {
      var random = seededRandom(5);
      var positions = {};
      for (var i = 0; i < 200; i++) {
        var q = QuestionBank.generate('staff-name', random);
        positions[q.options.map(function (o) { return o.id; }).indexOf(q.answerId)] = true;
      }
      assert(Object.keys(positions).length === 4, 'Đáp án chỉ xuất hiện ở ' + Object.keys(positions).length + ' vị trí');
      return 'đáp án xuất hiện ở cả A, B, C, D';
    }],
    ['Một lượt 20 câu: không trùng câu, mỗi dạng 4 câu', function () {
      var round = QuestionBank.generateRound(20, seededRandom(31));
      assert(round.length === 20, 'Có ' + round.length + ' câu');
      var keys = round.map(function (q) { return q.key; });
      assert(new Set(keys).size === 20, 'Có câu bị trùng');
      var count = {};
      round.forEach(function (q) { count[q.type] = (count[q.type] || 0) + 1; });
      QuestionBank.TYPE_KEYS.forEach(function (t) { assert(count[t] === 4, t + ' có ' + count[t] + ' câu'); });
      return '20 câu khác nhau, 5 dạng × 4';
    }]
  ];

  // =====================================================================
  // NHÓM 4 – Giao diện Trắc nghiệm (Giai đoạn 2)
  // =====================================================================
  function quiz(seed) { return mountFresh(seed || 61, QuizActivity); }

  function fixedQuestions() {
    var random = seededRandom(404);
    return [
      QuestionBank.generate('staff-name', random),
      QuestionBank.generate('sound-symbol', random),
      QuestionBank.generate('order', random)
    ];
  }

  function wrongOption(q) {
    for (var i = 0; i < q.options.length; i++) if (q.options[i].id !== q.answerId) return q.options[i].id;
    return null;
  }

  var QUIZ_TESTS = [
    ['Mặc định 10 câu; đổi số câu tạo lượt mới đúng độ dài', function () {
      var ctx = quiz();
      assert(ctx.app.getState().questions.length === 10, 'Mặc định ' + ctx.app.getState().questions.length + ' câu');
      var select = ctx.host.querySelector('[data-ref="lengthSelect"]');
      select.value = '5';
      select.dispatchEvent(new Event('change'));
      assert(ctx.app.getState().questions.length === 5, 'Đổi sang 5 câu nhưng có ' + ctx.app.getState().questions.length);
      assert(ctx.host.querySelector('[data-ref-progress]').textContent === 'Câu 1/5', 'Thanh tiến độ sai');
      return '10 → 5 câu';
    }],
    ['Câu đọc nốt: hiện nốt trên khuông, ẩn tên nốt đến khi trả lời', function () {
      var ctx = quiz();
      var qs = fixedQuestions();
      ctx.app.loadQuestions(qs);
      var svg = ctx.host.querySelector('.mini-staff svg');
      assert(svg, 'Không có khuông nhạc trong câu hỏi');
      assert(svg.querySelector('[data-note="' + qs[0].staffNoteId + '"]'), 'Khuông không hiện đúng nốt được hỏi');
      assert(svg.classList.contains('labels-hidden'), 'Tên nốt bị lộ trước khi trả lời');
      assert(!svg.querySelector('[tabindex]'), 'Nốt minh hoạ không được bấm như nút');
      click(ctx.host, '[data-option="' + qs[0].answerId + '"]');
      assert(!ctx.host.querySelector('.mini-staff svg').classList.contains('labels-hidden'), 'Không hiện tên nốt sau khi trả lời');
      return 'ẩn → hiện sau khi trả lời';
    }],
    ['Chỉ tính lần chọn đầu tiên; sai thì hiện đáp án đúng và giải thích', function () {
      var ctx = quiz();
      var qs = fixedQuestions();
      ctx.app.loadQuestions(qs);
      var wrong = wrongOption(qs[0]);
      click(ctx.host, '[data-option="' + wrong + '"]');
      click(ctx.host, '[data-option="' + qs[0].answerId + '"]'); // bấm lại đáp án đúng – không được tính
      var a = ctx.app.getState().answers[0];
      assert(a.chosenId === wrong && !a.correct, 'Lần chọn thứ hai bị tính');
      var feedback = ctx.host.querySelector('.find-feedback.is-retry');
      assert(feedback && feedback.textContent.indexOf(qs[0].explanation) !== -1, 'Thiếu giải thích');
      assert(ctx.host.querySelector('[data-option="' + qs[0].answerId + '"]').classList.contains('is-correct'), 'Đáp án đúng không được tô');
      assert(ctx.host.querySelector('[data-option="' + wrong + '"]').classList.contains('is-wrong'), 'Lựa chọn sai không được đánh dấu');
      return 'giữ lần chọn đầu, hiện đáp án + giải thích';
    }],
    ['Câu có âm thanh: phải nghe trước; phát đúng âm mốc và âm cần tìm', function () {
      var ctx = quiz();
      var qs = fixedQuestions();
      ctx.app.loadQuestions(qs);
      click(ctx.host, '[data-option="' + qs[0].answerId + '"]');
      click(ctx.host, '[data-action="next"]');
      var options = ctx.host.querySelectorAll('[data-option]');
      assert(Array.prototype.every.call(options, function (b) { return b.disabled; }), 'Chưa nghe mà đã cho chọn');
      click(ctx.host, '[data-action="play"]');
      var seq = lastSequence(ctx.audio).frequencies;
      assert(seq.join() === qs[1].sound.join(), 'Phát sai âm thanh');
      return wait(0).then(function () {
        assert(ctx.host.querySelectorAll('[data-option]:not([disabled])').length === 4, 'Nghe xong vẫn chưa cho chọn');
        return 'phát [' + seq.map(function (f) { return f.toFixed(2); }).join(', ') + '] Hz rồi mới mở 4 phương án';
      });
    }],
    ['Kết thúc lượt: số câu đúng, sai, tỷ lệ, bảng theo dạng câu hỏi, danh sách câu sai', function () {
      var ctx = quiz();
      var qs = fixedQuestions();
      ctx.app.loadQuestions(qs);
      click(ctx.host, '[data-option="' + qs[0].answerId + '"]');            // đúng
      click(ctx.host, '[data-action="next"]');
      click(ctx.host, '[data-action="play"]');
      return wait(0).then(function () {
        click(ctx.host, '[data-option="' + wrongOption(qs[1]) + '"]');      // sai
        click(ctx.host, '[data-action="next"]');
        click(ctx.host, '[data-option="' + qs[2].answerId + '"]');          // đúng
        assert(ctx.host.querySelector('[data-action="next"]').textContent === 'Xem kết quả', 'Câu cuối không có nút "Xem kết quả"');
        click(ctx.host, '[data-action="next"]');
        var box = ctx.host.querySelector('[data-ref-results]');
        var stat = function (k) { return box.querySelector('[data-stat="' + k + '"]').textContent; };
        assert(stat('total') === '3' && stat('correct') === '2' && stat('wrong') === '1' && stat('rate') === '67%',
          'Kết quả: ' + [stat('total'), stat('correct'), stat('wrong'), stat('rate')].join('/'));
        var rows = box.querySelectorAll('.result-table tbody tr');
        assert(rows.length === 3, 'Bảng theo dạng có ' + rows.length + ' dòng');
        var soundRow = box.querySelector('tr[data-type="sound-symbol"]');
        assert(soundRow && soundRow.cells[1].textContent === '1' && soundRow.cells[2].textContent === '0', 'Dòng "Ghép ký hiệu với âm thanh" sai');
        assert(box.querySelectorAll('.mistake-list li').length === 1, 'Danh sách câu sai không đúng');
        click(ctx.host, '[data-action="restart"]');
        assert(!ctx.app.getState().finished && ctx.app.getState().answers.length === 0, 'Làm lượt mới không đặt lại');
        return '3 câu · đúng 2 · sai 1 · 67% · bảng 3 dạng · 1 câu cần xem lại';
      });
    }],
    ['Mặc định không ghi dữ liệu vào bộ nhớ trình duyệt khi chưa bật lưu ở Báo cáo', function () {
      var original = Storage.prototype.setItem;
      var writes = 0;
      var storage = createFakeStorage();
      var log = PracticeLog.create({ storage: storage });   // nhật ký có bộ nhớ, nhưng chưa bật lưu
      Storage.prototype.setItem = function () { writes += 1; return original.apply(this, arguments); };
      try {
        var a = mountFresh(7, StaffActivity, { log: log });
        clickNote(a.app, 'C4');
        a.app.setMode('find');
        clickNote(a.app, a.app.getState().targetId);
        var q = mountFresh(61, QuizActivity, { log: log });
        q.app.loadQuestions(fixedQuestions());
        click(q.host, '[data-option="' + q.app.getState().questions[0].answerId + '"]');
        mountFresh(5, ListeningActivity, { log: log }).app.setMode('challenge');
        var d = mountFresh(5, DragActivity, { columnsPerRow: 8, log: log });
        var p = dropPoint(d, -2, 0);
        dragChip(d.host, 'C4', p.x, p.y);
        var m = mountFresh(5, MelodyActivity, { download: function () {}, log: log });
        click(m.host, '[data-pattern="0"]');
        click(m.host, '[data-ref="saveJson"]');
        mountFresh(5, ReportActivity, { log: log });
      } finally {
        Storage.prototype.setItem = original;
      }
      assert(log.currentSession().entries.length >= 4, 'Nhật ký không ghi lại các lần trả lời');
      assert(writes === 0, 'Có ' + writes + ' lần ghi localStorage/sessionStorage');
      assert(storage.writes === 0, 'Nhật ký ghi vào bộ nhớ ' + storage.writes + ' lần dù chưa bật lưu');
      return '0 lần ghi ở cả 6 hoạt động (nhật ký có ' + log.currentSession().entries.length + ' dòng trong bộ nhớ trang)';
    }]
  ];

  // =====================================================================
  // NHÓM 5 – Khung ứng dụng (mở index.html thật trong khung ẩn)
  // =====================================================================
  function loadAppFrame(hash) {
    var frame = document.createElement('iframe');
    frame.style.cssText = 'width:420px;height:700px;border:0';
    document.getElementById('sandbox').appendChild(frame);
    return new Promise(function (resolve, reject) {
      frame.onload = function () {
        var win = frame.contentWindow;
        waitFor(function () { return win.document.querySelector('.activity'); }, 5000).then(function (ok) {
          if (ok) resolve(win); else reject(new Error('index.html không khởi động'));
        });
      };
      frame.src = '../index.html' + (hash || '');
    });
  }

  var APP_TESTS = [
    ['Mở đường dẫn #trac-nghiem thì vào thẳng Trắc nghiệm; bấm thanh điều hướng thì chuyển hoạt động', function () {
      return loadAppFrame('#trac-nghiem').then(function (win) {
        var doc = win.document;
        assert(!doc.getElementById('view-trac-nghiem').hidden, 'Trắc nghiệm không hiện');
        assert(doc.getElementById('view-khuong-nhac').hidden, 'Khuông nhạc vẫn hiện');
        assert(doc.querySelector('[data-view="trac-nghiem"]').getAttribute('aria-selected') === 'true', 'Tab không được đánh dấu');
        var stops = 0;
        var originalStop = win.AudioEngine.stopAll;
        win.AudioEngine.stopAll = function () { stops += 1; return originalStop.apply(this, arguments); };
        doc.querySelector('[data-view="nghe-cao-do"]').click();
        return waitFor(function () { return !doc.getElementById('view-nghe-cao-do').hidden; }, 2000).then(function (shown) {
          assert(shown, 'Không chuyển sang Nghe cao độ');
          assert(doc.querySelector('#view-nghe-cao-do .listen-stage'), 'Nghe cao độ chưa được khởi tạo');
          assert(stops >= 1, 'Không dừng âm thanh khi chuyển hoạt động');
          assert(doc.querySelectorAll('.activity').length === 2, 'Khuông nhạc bị khởi tạo dù chưa mở');
          return '#trac-nghiem → Nghe cao độ; dừng âm thanh; chỉ khởi tạo khi mở';
        });
      });
    }],
    ['Trang chính không có lỗi JavaScript khi khởi động', function () {
      return loadAppFrame('').then(function (win) {
        var errors = [];
        win.addEventListener('error', function (e) { errors.push(e.message); });
        function open(view) {
          return function () {
            win.document.querySelector('[data-view="' + view + '"]').click();
            return wait(150);
          };
        }
        return Promise.resolve().then(open('trac-nghiem')).then(open('nghe-cao-do')).then(open('keo-tha'))
          .then(open('sang-tao')).then(open('bao-cao')).then(open('khuong-nhac')).then(function () {
          assert(errors.length === 0, errors.join('; '));
          assert(win.document.querySelectorAll('.activity').length === 6, 'Không đủ 6 hoạt động');
          assert(win.document.querySelector('#view-keo-tha .drag-board, #view-keo-tha .staff-svg'), 'Kéo thả chưa vẽ khuông');
          assert(win.document.querySelector('#view-sang-tao .melody-palette'), 'Phòng sáng tạo chưa có bảng nốt');
          assert(win.document.querySelector('#view-bao-cao [data-ref-empty]'), 'Báo cáo chưa hiện trạng thái chưa có dữ liệu');
          return '6 hoạt động khởi tạo, 0 lỗi';
        });
      });
    }],
    ['Trả lời ở Tìm nốt rồi mở Báo cáo: số liệu cập nhật ngay, nhật ký dùng chung của trang', function () {
      return loadAppFrame('#khuong-nhac').then(function (win) {
        var doc = win.document;
        doc.querySelector('#view-khuong-nhac [data-mode="find"]').click();
        var label = doc.querySelector('#view-khuong-nhac [data-ref-target]').textContent;
        var target = win.MusicNotes.NOTES.filter(function (n) { return n.label === label; })[0];
        var other = win.MusicNotes.NOTES.filter(function (n) { return n !== target; })[0];
        function tap(id) {
          doc.querySelector('#view-khuong-nhac .note[data-note="' + id + '"] .note-head')
            .dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
        }
        tap(other.id);
        tap(target.id);
        doc.querySelector('[data-view="bao-cao"]').click();
        return waitFor(function () { return !doc.getElementById('view-bao-cao').hidden; }, 2000).then(function () {
          var stat = function (k) { return doc.querySelector('#view-bao-cao [data-stat="' + k + '"]').textContent; };
          assert(stat('questions') === '1' && stat('correct') === '0' && stat('wrong') === '1' && stat('rate') === '0%',
            'Báo cáo: ' + ['questions', 'correct', 'wrong', 'rate'].map(stat).join('/'));
          assert(doc.querySelector('#view-bao-cao [data-fact="retries"]').textContent === '1', 'Không đếm lần làm lại');
          return 'chạm sai ' + other.label + ' rồi đúng ' + target.label + ' → 1 câu, sai 1, làm lại 1';
        });
      });
    }],
    ['Trang giáo viên: mở từ chân trang (#tro-ly-giao-vien), không có trên thanh của học sinh, báo rõ khi chưa có máy chủ AI', function () {
      return loadAppFrame('#khuong-nhac').then(function (win) {
        var doc = win.document;
        var link = doc.querySelector('.app-footer a[href="#tro-ly-giao-vien"]');
        assert(link, 'Chân trang thiếu đường dẫn');
        assert(!doc.querySelector('.app-nav [data-view="tro-ly-giao-vien"]'), 'Trang giáo viên nằm trên thanh của học sinh');
        link.click();
        return waitFor(function () {
          var status = doc.querySelector('#view-tro-ly-giao-vien [data-ref="status"]');
          return status && status.classList.contains('is-off');
        }, 4000).then(function (off) {
          assert(off, 'Không báo trạng thái chưa có máy chủ');
          assert(doc.getElementById('view-khuong-nhac').hidden, 'Khuông nhạc vẫn hiện');
          assert(!doc.querySelector('.app-nav [aria-selected="true"]'), 'Vẫn đánh dấu một thẻ của học sinh');
          assert(doc.querySelector('#view-tro-ly-giao-vien [data-ref="submit"]').disabled, 'Nút tạo vẫn bấm được');
          doc.querySelector('[data-view="bao-cao"]').click();
          return waitFor(function () { return !doc.getElementById('view-bao-cao').hidden; }, 2000);
        }).then(function (back) {
          assert(back && doc.getElementById('view-tro-ly-giao-vien').hidden, 'Không quay lại được hoạt động của học sinh');
          return '"' + doc.querySelector('#view-tro-ly-giao-vien [data-ref="status"]').textContent.slice(0, 50) + '…"';
        });
      });
    }]
  ];

  // =====================================================================
  // NHÓM 6 – Kéo thả nốt (Giai đoạn 3)
  // =====================================================================
  function dragApp(extra) { return mountFresh(71, DragActivity, extra || { columnsPerRow: 8 }); }

  var DRAG_TESTS = [
    ['Điểm thả được "hút" vào dòng/khe gần nhất: lệch 0,45 nửa khoảng vẫn đúng, lệch 0,55 thành vị trí khác', function () {
      var ctx = dragApp();
      var p = dropPoint(ctx, 2, 0.55);                   // gần vị trí 3 hơn
      dragChip(ctx.host, 'G4', p.x, p.y);
      assert(ctx.app.getState().placed.length === 0, 'Lệch 0,55 nửa khoảng mà vẫn nhận Sol₄');
      p = dropPoint(ctx, 2, 0.45);
      dragChip(ctx.host, 'G4', p.x, p.y);
      assert(ctx.app.getState().placed[0] === 'G4', 'Lệch 0,45 nửa khoảng không được nhận');
      return 'ngưỡng hút đúng ở giữa dòng và khe';
    }],
    ['Thả ra ngoài khuông không tính là một lần đặt', function () {
      var ctx = dragApp();
      dragChip(ctx.host, 'E4', 5, 5);
      var s = ctx.app.getState().stats;
      assert(s.drops === 0, 'Bị tính ' + s.drops + ' lần đặt');
      assert(ctx.host.querySelector('[data-ref="feedback"]').textContent.indexOf('thả nốt lên trên khuông') !== -1, 'Thiếu lời nhắc');
      assert(ctx.host.querySelector('[data-chip="E4"]'), 'Thẻ nốt bị mất');
      return 'không tính, thẻ vẫn còn, có lời nhắc';
    }],
    ['Cách chạm – chạm: chạm thẻ để chọn, chạm lên khuông để đặt', function () {
      var ctx = dragApp();
      var chip = ctx.host.querySelector('[data-chip="A4"]');
      var r = chip.getBoundingClientRect();
      chip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 900, clientX: r.left + 5, clientY: r.top + 5, button: 0 }));
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 900, clientX: r.left + 6, clientY: r.top + 5 }));
      assert(ctx.app.getState().selectedId === 'A4', 'Chạm thẻ không chọn được');
      assert(ctx.host.querySelector('[data-chip="A4"]').getAttribute('aria-pressed') === 'true', 'Thẻ không hiện trạng thái đã chọn');
      var p = dropPoint(ctx, 3, 0);
      ctx.app.board().rows[0].svg.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: p.x, clientY: p.y }));
      assert(ctx.app.getState().placed[0] === 'A4', 'Chạm lên khuông không đặt được La₄');
      assert(ctx.app.getState().selectedId === null, 'Vẫn còn chọn thẻ sau khi đặt');
      return 'chọn La₄ → chạm khe 2 → đặt đúng';
    }],
    ['Sai 2 lần thì hiện nốt mờ ở vị trí đúng; nốt đặt sai tự biến mất', function () {
      var ctx = dragApp();
      var p = dropPoint(ctx, 6, 0);
      dragChip(ctx.host, 'D4', p.x, p.y);
      assert(ctx.app.board().element('wrong-mark'), 'Không hiện nốt đặt sai');
      assert(!ctx.app.board().element('hint'), 'Gợi ý quá sớm');
      dragChip(ctx.host, 'D4', p.x, p.y);
      var hint = ctx.app.board().element('hint');
      assert(hint, 'Không hiện nốt gợi ý sau 2 lần sai');
      var ys = lineYs(hint.ownerSVGElement);
      assert(Number(hint.querySelector('.note-head').getAttribute('cy')) === ys[1] + (ys[1] - ys[2]) / 2, 'Nốt gợi ý không ở khe dưới dòng 1');
      assert(ctx.host.querySelector('[data-ref="feedback"]').textContent.indexOf('khe ngay dưới dòng kẻ dưới cùng') !== -1, 'Lời gợi ý thiếu vị trí');
      return wait(1600).then(function () {
        assert(!ctx.app.board().element('wrong-mark'), 'Nốt đặt sai không tự biến mất');
        return 'gợi ý Rê₄ ở khe dưới dòng 1; nốt sai biến mất sau 1,4 giây';
      });
    }],
    ['Gỡ nốt vừa đặt: nốt trở về bảng; Xóa bài: làm lại từ đầu', function () {
      var ctx = dragApp();
      var p = dropPoint(ctx, 0, 0);
      dragChip(ctx.host, 'E4', p.x, p.y);
      p = dropPoint(ctx, 4, 0);
      dragChip(ctx.host, 'B4', p.x, p.y);
      click(ctx.host, '[data-ref="undoButton"]');
      var s = ctx.app.getState();
      assert(s.placed.join() === 'E4' && s.palette.indexOf('B4') !== -1, 'Gỡ nốt sai: ' + s.placed.join());
      assert(!ctx.app.board().element('placed-B4'), 'Si₄ vẫn còn trên khuông');
      click(ctx.host, '[data-ref="clearButton"]');
      s = ctx.app.getState();
      assert(s.placed.length === 0 && s.palette.length === 8 && s.stats.drops === 0, 'Xóa bài chưa làm lại từ đầu');
      assert(!ctx.app.board().element('placed-E4'), 'Mi₄ vẫn còn trên khuông');
      return 'gỡ Si₄ → còn Mi₄; xóa bài → 0/8';
    }],
    ['Đặt xong 8 nốt: thông báo hoàn thành, đúng lần đầu, số lần sai, tỷ lệ', function () {
      var ctx = dragApp();
      REFERENCE.forEach(function (ref, i) {
        if (i === 3) {                                     // Pha₄: cố tình sai một lần trước
          var w = dropPoint(ctx, expectedStep(ref) + 2, 0);
          dragChip(ctx.host, ref.id, w.x, w.y);
        }
        var p = dropPoint(ctx, expectedStep(ref), 0);
        dragChip(ctx.host, ref.id, p.x, p.y);
      });
      var done = ctx.host.querySelector('[data-ref-done]');
      assert(done, 'Không có thông báo hoàn thành');
      var stat = function (k) { return ctx.host.querySelector('[data-stat="' + k + '"]').textContent; };
      assert(stat('placed') === '8/8' && stat('firstTry') === '7' && stat('wrong') === '1' && stat('rate') === '89%',
        'Thống kê: ' + [stat('placed'), stat('firstTry'), stat('wrong'), stat('rate')].join(' / '));
      assert(ctx.host.querySelector('.palette-empty'), 'Bảng nốt chưa báo hết');
      return '8/8 · đúng lần đầu 7 · sai 1 · 89% (8/9 lần đặt)';
    }],
    ['Màn hình hẹp: khuông chia 2 dòng × 4 cột, nốt thứ 5 sang dòng 2, Đô₄ vẫn có dòng kẻ phụ', function () {
      // Đo trong khung rộng 360 px như điện thoại (ở cửa sổ rộng, cả hai khuông đều chạm giới hạn chiều cao).
      var ctx = dragApp({ columnsPerRow: 4 });
      ctx.host.style.width = '360px';
      var board = ctx.app.board();
      assert(board.rows.length === 2, 'Có ' + board.rows.length + ' dòng khuông');
      ['D4', 'E4', 'F4', 'G4', 'C4'].forEach(function (id) {
        var p = dropPoint(ctx, MusicNotes.findNote(id).step, 0);
        dragChip(ctx.host, id, p.x, p.y);
      });
      var c4 = board.element('placed-C4');
      assert(c4 && c4.ownerSVGElement === board.rows[1].svg, 'Nốt thứ 5 không nằm ở dòng 2');
      assert(c4.querySelectorAll('.ledger-line').length === 1, 'Đô₄ ở dòng 2 thiếu dòng kẻ phụ');
      var rect1 = board.rows[0].svg.getBoundingClientRect();
      var wide = dragApp();
      wide.host.style.width = '360px';
      var rect8 = wide.app.board().rows[0].svg.getBoundingClientRect();
      var gap4 = rect1.height, gap8 = rect8.height;
      assert(gap4 > gap8 * 1.3, 'Khuông 4 cột không to hơn rõ rệt (' + gap4.toFixed(0) + ' so với ' + gap8.toFixed(0) + ' px)');
      return '2 dòng; khuông cao ' + gap4.toFixed(0) + ' px so với ' + gap8.toFixed(0) + ' px khi 8 cột';
    }],
    ['Thẻ nốt không làm cuộn trang khi kéo bằng ngón tay (touch-action: none)', function () {
      var ctx = dragApp();
      var value = getComputedStyle(ctx.host.querySelector('[data-chip]')).touchAction;
      assert(value === 'none', 'touch-action = ' + value);
      return 'touch-action: none';
    }]
  ];

  // =====================================================================
  // NHÓM 7 – Phòng sáng tạo giai điệu (Giai đoạn 3)
  // =====================================================================
  function melody(extra) {
    var saved = [];
    var options = { download: function (name, blob) { saved.push({ name: name, blob: blob }); },
      now: function () { return new Date('2026-10-28T08:30:00Z'); } };
    for (var k in extra || {}) options[k] = extra[k];
    var ctx = mountFresh(81, MelodyActivity, options);
    ctx.saved = saved;
    return ctx;
  }
  function addMelodyNotes(ctx, ids) {
    ids.forEach(function (id) { click(ctx.host, '[data-add="' + id + '"]'); });
  }
  function sequenceText(ctx) {
    return Array.prototype.map.call(ctx.host.querySelectorAll('.sequence-chip'), function (c) { return c.textContent; }).join(' ');
  }
  function readBlob(blob) {
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result)); };
      reader.readAsText(blob);
    });
  }

  var MELODY_TESTS = [
    ['Thêm nốt: hiện trên khuông và bằng tên nốt, phát âm; quá 8 nốt thì xuống dòng khuông thứ hai', function () {
      var ctx = melody();
      addMelodyNotes(ctx, ['C4', 'E4', 'G4', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4']);
      assert(sequenceText(ctx) === '1Đô₄ 2Mi₄ 3Sol₄ 4Đô₅ 5Si₄ 6La₄ 7Sol₄ 8Pha₄ 9Mi₄', 'Chuỗi tên nốt: ' + sequenceText(ctx));
      var rows = ctx.host.querySelectorAll('.melody-staff .staff-svg');
      assert(rows.length === 2, 'Có ' + rows.length + ' dòng khuông');
      var ninth = ctx.app.noteNode(8);
      assert(ninth && ninth.ownerSVGElement === rows[1] && ninth.getAttribute('data-note') === 'E4', 'Nốt thứ 9 không ở dòng 2');
      var ys = lineYs(rows[0]);
      assert(Number(ctx.app.noteNode(3).querySelector('.note-head').getAttribute('cy')) === (ys[3] + ys[4]) / 2, 'Đô₅ không ở khe 3');
      assert(ctx.audio.notes.length === 9 && near(ctx.audio.notes[3], 523.25, 0.01), 'Không phát âm khi thêm nốt');
      return '9 nốt, 2 dòng khuông, mỗi nốt đúng vị trí';
    }],
    ['Tối đa ' + MelodyActivity.MAX_NOTES + ' nốt: mẫu khởi đầu chỉ thêm phần còn chỗ, nút thêm bị khoá', function () {
      var ctx = melody();
      for (var i = 0; i < 4; i++) click(ctx.host, '[data-pattern="0"]');   // 4 × 5 = 20 nốt
      assert(ctx.app.getState().notes.length === 16, 'Có ' + ctx.app.getState().notes.length + ' nốt');
      assert(ctx.host.querySelector('[data-add="C4"]').disabled, 'Nút thêm nốt chưa bị khoá');
      assert(ctx.host.querySelector('[data-ref="message"]').textContent.indexOf('tối đa 16') !== -1, 'Thiếu lời nhắc giới hạn');
      return '20 → giữ 16 nốt, khoá nút thêm';
    }],
    ['Đổi thứ tự và xóa nốt; nút bị khoá ở hai đầu', function () {
      var ctx = melody();
      addMelodyNotes(ctx, ['C4', 'D4', 'E4']);
      click(ctx.host, '[data-index="0"]');
      assert(ctx.host.querySelector('[data-ref="moveLeft"]').disabled, 'Nốt đầu vẫn lùi được');
      click(ctx.host, '[data-ref="moveRight"]');
      assert(ctx.app.getState().notes.join() === 'D4,C4,E4', 'Tiến: ' + ctx.app.getState().notes.join());
      assert(ctx.app.getState().selected === 1, 'Nốt đang chọn không đi theo');
      click(ctx.host, '[data-ref="moveRight"]');
      assert(ctx.host.querySelector('[data-ref="moveRight"]').disabled, 'Nốt cuối vẫn tiến được');
      click(ctx.host, '[data-ref="moveLeft"]');
      click(ctx.host, '[data-ref="removeNote"]');
      assert(ctx.app.getState().notes.join() === 'D4,E4', 'Xóa: ' + ctx.app.getState().notes.join());
      assert(ctx.host.querySelector('[data-ref="removeNote"]').disabled, 'Nút xóa vẫn mở khi chưa chọn');
      return 'Đô Rê Mi → Rê Đô Mi → Rê Mi Đô → Rê Đô Mi → Rê Mi';
    }],
    ['Phát giai điệu: đúng thứ tự, đúng tốc độ, tô sáng nốt đang phát, Dừng được', function () {
      var ctx = melody();
      addMelodyNotes(ctx, ['G4', 'E4', 'C4']);
      var select = ctx.host.querySelector('[data-ref="tempoSelect"]');
      select.value = '72';
      select.dispatchEvent(new Event('change'));
      click(ctx.host, '[data-ref="playButton"]');
      var seq = lastSequence(ctx.audio);
      assert(seq.frequencies.map(function (f) { return f.toFixed(2); }).join() === '392.00,329.63,261.63', 'Phát sai: ' + seq.frequencies);
      assert(near(seq.options.gap, 60 / 72, 0.0001), 'Khoảng cách nốt ' + seq.options.gap + ' s, đúng là ' + (60 / 72));
      seq.options.onStep(1);
      assert(ctx.app.noteNode(1).classList.contains('is-playing'), 'Nốt đang phát không được tô trên khuông');
      assert(ctx.host.querySelector('[data-index="1"]').classList.contains('is-playing'), 'Nốt đang phát không được tô trong chuỗi');
      assert(ctx.host.querySelector('[data-ref="playButton"]').textContent.indexOf('Dừng') !== -1, 'Nút không đổi thành Dừng');
      var stops = ctx.audio.stopCount;
      click(ctx.host, '[data-ref="playButton"]');
      assert(ctx.audio.stopCount > stops && !ctx.app.getState().playing, 'Không dừng được');
      click(ctx.host, '[data-ref="playButton"]');
      lastSequence(ctx.audio).options.onDone();
      assert(!ctx.app.getState().playing && ctx.host.querySelector('[data-ref="playButton"]').textContent.indexOf('Phát') !== -1, 'Phát xong chưa trở lại');
      return 'Sol Mi Đô, mỗi nốt ' + (60 / 72).toFixed(2).replace('.', ',') + ' s (Chậm), dừng và phát lại được';
    }],
    ['Làm mới cần bấm hai lần để tránh xóa nhầm', function () {
      var ctx = melody();
      addMelodyNotes(ctx, ['C4', 'D4']);
      ctx.host.querySelector('[data-ref="titleInput"]').value = 'Thử';
      click(ctx.host, '[data-ref="clearButton"]');
      assert(ctx.app.getState().notes.length === 2, 'Bấm một lần đã xóa');
      click(ctx.host, '[data-ref="clearButton"]');
      assert(ctx.app.getState().notes.length === 0 && ctx.host.querySelector('[data-ref="titleInput"]').value === '', 'Bấm hai lần chưa xóa');
      return 'lần 1 hỏi lại, lần 2 xóa';
    }],
    ['Lưu JSON: chuỗi nốt, tên nốt, tên giai điệu, ý tưởng, tốc độ; tên file không dấu; không có họ tên', function () {
      var ctx = melody();
      addMelodyNotes(ctx, ['C4', 'E4', 'G4']);
      ctx.host.querySelector('[data-ref="titleInput"]').value = 'Buổi sáng ở sân trường';
      ctx.host.querySelector('[data-ref="ideaInput"]').value = 'Đi lên như mặt trời mọc.';
      click(ctx.host, '[data-ref="saveJson"]');
      assert(ctx.saved.length === 1, 'Không lưu file');
      assert(ctx.saved[0].name === 'buoi-sang-o-san-truong.json', 'Tên file: ' + ctx.saved[0].name);
      return readBlob(ctx.saved[0].blob).then(function (text) {
        var data = JSON.parse(text);
        assert(data.type === 'ai-music-lab/giai-dieu' && data.version === 1, 'Sai loại file');
        assert(data.notes.join() === 'C4,E4,G4' && data.noteNames.join() === 'Đô₄,Mi₄,Sol₄', 'Sai chuỗi nốt');
        assert(data.title === 'Buổi sáng ở sân trường' && data.idea === 'Đi lên như mặt trời mọc.', 'Thiếu tên hoặc ý tưởng');
        assert(data.tempo === 100 && data.savedAt === '2026-10-28T08:30:00.000Z', 'Sai tốc độ hoặc thời điểm');
        var keys = Object.keys(data).sort().join();
        assert(keys === 'app,idea,noteNames,notes,savedAt,tempo,title,type,version', 'File có trường lạ: ' + keys);
        return 'buoi-sang-o-san-truong.json · 3 nốt · không có trường họ tên';
      });
    }],
    ['Mở lại file đã lưu khôi phục đúng giai điệu; file hỏng bị từ chối và không làm mất giai điệu đang có', function () {
      var a = melody();
      addMelodyNotes(a, ['A4', 'B4', 'C5']);
      a.host.querySelector('[data-ref="titleInput"]').value = 'Lên cao';
      var text = JSON.stringify(a.app.melodyData());
      var b = melody();
      addMelodyNotes(b, ['D4']);
      var bad = [
        'không phải json',
        JSON.stringify({ type: 'khac', notes: ['C4'] }),
        JSON.stringify({ type: 'ai-music-lab/giai-dieu', notes: ['C4', 'H9'] }),
        JSON.stringify({ type: 'ai-music-lab/giai-dieu', notes: new Array(17).fill('C4') }),
        JSON.stringify({ type: 'ai-music-lab/giai-dieu', notes: [] })
      ];
      bad.forEach(function (t) {
        assert(b.app.loadMelodyText(t) === false, 'Nhận file hỏng: ' + t.slice(0, 40));
        assert(b.app.getState().notes.join() === 'D4', 'File hỏng làm mất giai điệu đang có');
      });
      assert(b.host.querySelector('[data-ref="message"]').textContent.indexOf('Không mở được file') !== -1, 'Thiếu thông báo lỗi');
      assert(b.app.loadMelodyText(text) === true, 'Không mở được file hợp lệ');
      assert(b.app.getState().notes.join() === 'A4,B4,C5' && b.host.querySelector('[data-ref="titleInput"]').value === 'Lên cao', 'Khôi phục sai');
      assert(b.host.querySelectorAll('.sequence-chip').length === 3, 'Chuỗi nốt chưa vẽ lại');
      return '5 file hỏng bị từ chối; file hợp lệ khôi phục 3 nốt và tên';
    }],
    ['Lưu ảnh PNG: tạo được ảnh thật, đọc lại được', function () {
      var ctx = melody();
      addMelodyNotes(ctx, ['C4', 'E4', 'G4', 'C5', 'G4', 'E4', 'C4', 'D4', 'E4']);
      ctx.host.querySelector('[data-ref="titleInput"]').value = 'Ảnh thử';
      return ctx.app.saveImage().then(function () {
        assert(ctx.saved.length === 1, 'Không lưu ảnh – ' + ctx.host.querySelector('[data-ref="message"]').textContent);
        var file = ctx.saved[0];
        assert(file.name === 'anh-thu.png' && file.blob.type === 'image/png', 'File: ' + file.name + ' ' + file.blob.type);
        return createImageBitmap(file.blob).then(function (bitmap) {
          assert(bitmap.width > 600 && bitmap.height > 400, 'Ảnh quá nhỏ: ' + bitmap.width + '×' + bitmap.height);
          return file.name + ' · ' + bitmap.width + '×' + bitmap.height + ' px · ' + Math.round(file.blob.size / 1024) + ' KB';
        });
      });
    }],
    ['Giai điệu trống: không cho phát hay lưu; ghi rõ không dùng AI', function () {
      var ctx = melody();
      ['playButton', 'saveJson', 'saveImage'].forEach(function (ref) {
        assert(ctx.host.querySelector('[data-ref="' + ref + '"]').disabled, ref + ' không bị khoá');
      });
      assert(ctx.host.querySelector('.honest-note').textContent.indexOf('không dùng AI') !== -1, 'Thiếu ghi chú không dùng AI');
      return 'nút Phát / Lưu bị khoá khi chưa có nốt';
    }]
  ];

  // =====================================================================
  // NHÓM 8 – Báo cáo kết quả luyện tập (Giai đoạn 4)
  // =====================================================================
  function answerEntry(activity, mode, item, first, target, given, extra) {
    var e = { kind: 'answer', activity: activity, mode: mode, item: item, first: first, target: target, given: given,
      targetText: MusicNotes.findNote(target) ? MusicNotes.findNote(target).label : target,
      givenText: MusicNotes.findNote(given) ? MusicNotes.findNote(given).label : given,
      correct: target === given };
    for (var k in extra || {}) e[k] = extra[k];
    return e;
  }

  // Một phiên dựng tay với kết quả biết trước, để đối chiếu với số liệu báo cáo tự tính.
  function handSession(id, startIso) {
    var clock = fakeClock(startIso, 30);
    var entries = [
      answerEntry('khuong-nhac', 'Tìm nốt', 1, true, 'D4', 'E4'),      // sai
      answerEntry('khuong-nhac', 'Tìm nốt', 1, false, 'D4', 'D4'),     // làm lại, đúng
      answerEntry('khuong-nhac', 'Tìm nốt', 2, true, 'G4', 'G4'),      // đúng
      answerEntry('nghe-cao-do', 'Luyện tập · mức Khó', 1, true, 'D4', 'E4'), // sai
      answerEntry('nghe-cao-do', 'Luyện tập · mức Khó', 2, true, 'A4', 'B4'), // sai
      answerEntry('trac-nghiem', 'Cao hơn – thấp hơn', 1, true, 'higher', 'lower'), // sai, không phải nốt
      answerEntry('trac-nghiem', 'Đọc tên nốt trên khuông', 2, true, 'C5', 'C5'),  // đúng
      { kind: 'action', activity: 'sang-tao', action: 'play', detail: 'Phát giai điệu 5 nốt' }
    ];
    entries.forEach(function (e) { e.time = clock().toISOString(); });
    return { id: id, startedAt: entries[0].time, lastAt: entries[entries.length - 1].time, entries: entries };
  }

  function reportApp(log, extra) {
    var saved = [];
    var options = { log: log, now: fakeClock('2026-10-28T08:45:00Z', 0),
      download: function (name, blob) { saved.push({ name: name, blob: blob }); } };
    for (var k in extra || {}) options[k] = extra[k];
    var ctx = mountFresh(1, ReportActivity, options);
    ctx.saved = saved;
    return ctx;
  }

  // Ghi các dòng của một phiên dựng tay vào nhật ký (giữ nguyên thời điểm đã định).
  function logWithSession(session, storage) {
    var times = session.entries.map(function (e) { return new Date(e.time); });
    var i = 0;
    var log = PracticeLog.create({ storage: storage || null, now: function () { return times[Math.min(i++, times.length - 1)]; } });
    session.entries.forEach(function (e) {
      var copy = {};
      Object.keys(e).forEach(function (k) { if (k !== 'time') copy[k] = e[k]; });
      log.record(copy);
    });
    return log;
  }

  // Bộ đọc CSV đơn giản (theo RFC 4180) để kiểm tra lại file xuất ra.
  function parseCsv(text) {
    var rows = [], row = [], cell = '', quoted = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') quoted = false;
        else cell += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  var REPORT_TESTS = [
    ['Các hoạt động ghi nhật ký đúng: đáp án, lựa chọn, lần đầu / làm lại, đúng / sai', function () {
      var log = PracticeLog.create({ storage: null });
      var staff = mountFresh(7, StaffActivity, { log: log });
      staff.app.setMode('find');
      var target = staff.app.getState().targetId;
      var wrong = target === 'C4' ? 'D4' : 'C4';
      clickNote(staff.app, wrong);
      clickNote(staff.app, target);
      var q = mountFresh(61, QuizActivity, { log: log });
      q.app.loadQuestions(fixedQuestions());
      var q0 = q.app.getState().questions[0];
      click(q.host, '[data-option="' + q0.answerId + '"]');
      var d = mountFresh(5, DragActivity, { columnsPerRow: 8, log: log });
      var p = dropPoint(d, 0, 0);
      dragChip(d.host, 'F4', p.x, p.y);              // Pha₄ thả vào chỗ của Mi₄
      p = dropPoint(d, 1, 0);
      dragChip(d.host, 'F4', p.x, p.y);
      var m = mountFresh(5, MelodyActivity, { log: log, download: function () {} });
      click(m.host, '[data-pattern="0"]');
      click(m.host, '[data-ref="playButton"]');
      var e = log.currentSession().entries.filter(function (x) { return x.activity !== 'sang-tao' || x.action === 'play'; });
      var brief = e.map(function (x) {
        return x.kind === 'answer' ? [x.activity, x.item, x.first ? 'đầu' : 'lại', x.target, x.given, x.correct ? 'Đ' : 'S'].join(':')
          : x.activity + ':' + x.action;
      });
      var expected = [
        'khuong-nhac:1:đầu:' + target + ':' + wrong + ':S',
        'khuong-nhac:1:lại:' + target + ':' + target + ':Đ',
        'trac-nghiem:1:đầu:' + q0.answerId + ':' + q0.answerId + ':Đ',
        'keo-tha:1:đầu:F4:E4:S',
        'keo-tha:1:lại:F4:F4:Đ',
        'sang-tao:play'
      ];
      assert(brief.join(' | ') === expected.join(' | '), 'Nhật ký: ' + brief.join(' | '));
      var dragWrong = e[3];
      assert(dragWrong.givenText === 'chỗ của Mi₄' && dragWrong.mode === 'Kéo thả nốt', 'Kéo thả ghi: ' + dragWrong.givenText);
      assert(e[2].mode === 'Đọc tên nốt trên khuông', 'Dạng câu trắc nghiệm: ' + e[2].mode);
      var keys = Object.keys(e[0]).sort().join();
      assert(keys === 'activity,correct,first,given,givenText,item,kind,mode,target,targetText,time', 'Trường lạ trong nhật ký: ' + keys);
      return expected.length + ' dòng đúng thứ tự; không có trường họ tên';
    }],
    ['Tính toán tổng hợp khớp với số liệu dựng tay (chỉ tính lần trả lời đầu)', function () {
      var sum = ReportActivity.summarize([handSession('a', '2026-10-28T08:00:00Z')]);
      var t = sum.totals;
      assert(t.questions === 6 && t.correct === 2 && t.wrong === 4 && t.retries === 1, 'Tổng: ' + JSON.stringify(t));
      assert(Math.abs(sum.rate - 2 / 6) < 1e-9, 'Tỷ lệ ' + sum.rate);
      var names = sum.activities.map(function (a) { return a.key + '=' + a.questions + '/' + a.correct; }).join(' ');
      assert(names === 'khuong-nhac=2/1 nghe-cao-do=2/0 trac-nghiem=2/1 sang-tao=0/0', 'Theo hoạt động: ' + names);
      assert(sum.activities[3].actions[0].count === 1, 'Không đếm thao tác Phòng sáng tạo');
      var d4 = sum.notes.filter(function (n) { return n.noteId === 'D4'; })[0];
      assert(d4.questions === 2 && d4.wrong === 2 && d4.retries === 1, 'Nốt Rê₄: ' + JSON.stringify(d4));
      var total = sum.notes.reduce(function (s, n) { return s + n.questions; }, 0);
      assert(total === 5, 'Câu "cao hơn/thấp hơn" bị tính vào theo nốt (' + total + ')');
      assert(sum.trouble.length === 1 && sum.trouble[0].noteId === 'D4', 'Nốt hay nhầm: ' + JSON.stringify(sum.trouble));
      assert(sum.trouble[0].confusedWith[0].noteId === 'E4' && sum.trouble[0].confusedWith[0].count === 2, 'Nhầm với: ' +
        JSON.stringify(sum.trouble[0].confusedWith));
      return '6 câu · đúng 2 · sai 4 · làm lại 1 · 33%; Rê₄ hay nhầm với Mi₄ (2 lần); La₄ sai 1 lần chưa đủ kết luận';
    }],
    ['Màn hình Báo cáo: tổng quan, thời điểm, hoạt động đã tham gia, theo hoạt động, theo nốt', function () {
      var session = handSession('a', '2026-10-28T08:00:00Z');
      var ctx = reportApp(logWithSession(session));
      var host = ctx.host;
      var stat = function (k) { return host.querySelector('[data-stat="' + k + '"]').textContent; };
      assert([stat('questions'), stat('correct'), stat('wrong'), stat('rate')].join('/') === '6/2/4/33%',
        'Tổng quan: ' + [stat('questions'), stat('correct'), stat('wrong'), stat('rate')].join('/'));
      var first = new Date(session.entries[0].time), last = new Date(session.lastAt);
      var hhmm = function (d) { return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); };
      var time = host.querySelector('[data-fact="time"]').textContent;
      assert(time.indexOf(hhmm(first)) === 0 && time.indexOf(hhmm(last)) !== -1, 'Thời điểm: ' + time);
      assert(host.querySelector('[data-fact="activities"]').textContent ===
        'Khuông nhạc tương tác, Nghe cao độ, Trắc nghiệm, Phòng sáng tạo giai điệu', 'Hoạt động: ' +
        host.querySelector('[data-fact="activities"]').textContent);
      var row = host.querySelector('tr[data-activity="nghe-cao-do"]').textContent;
      assert(row.indexOf('Nghe cao độ2020%') === 0, 'Dòng Nghe cao độ: ' + row);
      assert(host.querySelector('tr[data-activity="sang-tao"]').textContent.indexOf('1 lần phát giai điệu') !== -1, 'Thiếu thao tác sáng tạo');
      assert(host.querySelectorAll('[data-detail]').length === 4, 'Thiếu phần chi tiết hoạt động');
      assert(host.querySelector('[data-detail="nghe-cao-do"]').textContent.indexOf('đáp án La₄ – em chọn Si₄') !== -1, 'Thiếu câu sai');
      assert(host.querySelector('[data-ref-trouble]').textContent.indexOf('Rê₄: sai 2 trên 2 câu – hay nhầm với Mi₄ (2 lần)') !== -1,
        'Nốt hay nhầm: ' + host.querySelector('[data-ref-trouble]').textContent);
      assert(!host.querySelector('[data-section="sessions"]'), 'Phiên này không cần bảng các phiên');
      return '6/2/4/33% · 4 hoạt động · Rê₄ hay nhầm với Mi₄';
    }],
    ['Chưa có dữ liệu: báo rõ, khoá nút xuất/in; ít câu sai: báo "chưa đủ dữ liệu" thay vì kết luận', function () {
      var empty = reportApp(PracticeLog.create({ storage: null }));
      assert(empty.host.querySelector('[data-ref-empty]'), 'Thiếu thông báo chưa có dữ liệu');
      ['exportCsv', 'exportJson', 'printButton'].forEach(function (r) {
        assert(empty.host.querySelector('[data-ref="' + r + '"]').disabled, r + ' không bị khoá');
      });
      var log = PracticeLog.create({ storage: null });
      log.record(answerEntry('nghe-cao-do', 'Luyện tập · mức Dễ', 1, true, 'E4', 'G4'));
      var one = reportApp(log);
      var text = one.host.querySelector('[data-ref-trouble]').textContent;
      assert(text.indexOf('Chưa đủ dữ liệu') === 0, 'Kết luận khi mới sai 1 câu: ' + text);
      return 'trống → khoá nút; 1 câu sai → "chưa đủ dữ liệu"';
    }],
    ['Xuất CSV: tên file, BOM UTF-8, tiêu đề cột, mỗi dòng nhật ký một dòng, ô có dấu phẩy/ngoặc kép được bọc đúng', function () {
      var session = handSession('a', '2026-10-28T08:00:00Z');
      session.entries[0].givenText = 'Mi₄, "dòng 1"';           // ô khó: có dấu phẩy và ngoặc kép
      var log = logWithSession(session);
      var ctx = reportApp(log);
      click(ctx.host, '[data-ref="exportCsv"]');
      assert(ctx.saved.length === 1, 'Không xuất file');
      var file = ctx.saved[0];
      assert(/^bao-cao-ai-music-lab-phien-2026-10-28-\d{4}\.csv$/.test(file.name), 'Tên file: ' + file.name);
      assert(file.blob.type.indexOf('text/csv') === 0, 'Kiểu file: ' + file.blob.type);
      return file.blob.arrayBuffer().then(function (buf) {
        var bytes = new Uint8Array(buf);
        assert(bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF, 'Thiếu BOM UTF-8');
        return readBlob(file.blob);
      }).then(function (text) {
        var rows = parseCsv(text.replace(/^\uFEFF/, ''));
        assert(rows[0].join('|') === ReportActivity.CSV_COLUMNS.join('|'), 'Tiêu đề: ' + rows[0].join('|'));
        assert(rows.length === 1 + session.entries.length, 'Có ' + (rows.length - 1) + ' dòng dữ liệu');
        assert(rows.every(function (r) { return r.length === 9; }), 'Số cột không đều');
        assert(rows[1][7] === 'Mi₄, "dòng 1"' && rows[1][8] === 'Sai' && rows[1][5] === 'Lần đầu', 'Dòng 1: ' + rows[1].join('|'));
        assert(rows[2][5] === 'Làm lại' && rows[2][8] === 'Đúng', 'Dòng 2: ' + rows[2].join('|'));
        assert(rows[8][3] === 'Phát giai điệu 5 nốt' && rows[8][8] === '', 'Dòng thao tác: ' + rows[8].join('|'));
        assert(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(rows[1][1]), 'Thời điểm: ' + rows[1][1]);
        assert(ctx.host.querySelector('[data-ref="message"]').textContent.indexOf(file.name) !== -1, 'Thiếu thông báo đã xuất');
        return file.name + ' · ' + (rows.length - 1) + ' dòng · 9 cột · đọc lại khớp';
      });
    }],
    ['Xuất JSON: số liệu tổng hợp khớp màn hình, kèm toàn bộ nhật ký, không có họ tên', function () {
      var ctx = reportApp(logWithSession(handSession('a', '2026-10-28T08:00:00Z')));
      click(ctx.host, '[data-ref="exportJson"]');
      var file = ctx.saved[0];
      assert(/\.json$/.test(file.name), 'Tên file: ' + file.name);
      return readBlob(file.blob).then(function (text) {
        var data = JSON.parse(text);
        assert(data.type === 'ai-music-lab/bao-cao' && data.scope === 'Phiên này', 'Sai loại/phạm vi');
        assert(data.exportedAt === '2026-10-28T08:45:00.000Z', 'Thời điểm xuất: ' + data.exportedAt);
        var s = data.summary;
        assert(s.questions === 6 && s.correct === 2 && s.wrong === 4 && s.retries === 1 && s.rate === 0.333, 'Tổng hợp: ' + JSON.stringify(s).slice(0, 120));
        assert(s.frequentlyConfused[0].label === 'Rê₄', 'Thiếu nốt hay nhầm');
        assert(data.sessions.length === 1 && data.sessions[0].entries.length === 8, 'Thiếu nhật ký');
        assert(!/hoTen|họ tên"|"name"\s*:\s*"[^"]*[A-ZĐ][a-zà-ỹ]+ [A-ZĐ]/.test(text), 'Có trường giống họ tên');
        assert(Object.keys(data).sort().join() === 'app,exportedAt,note,scope,sessions,summary,type,version', 'Trường: ' + Object.keys(data));
        return file.name + ' · 6/2/4 · 8 dòng nhật ký';
      });
    }],
    ['Phân biệt "Phiên này" và "Tất cả các phiên": tải lại trang (khi đã bật lưu) giữ phiên cũ ở mục tích lũy', function () {
      var storage = createFakeStorage();
      var first = logWithSession(handSession('a', '2026-10-27T08:00:00Z'), storage);
      assert(first.setSaving(true), 'Không bật được lưu');
      // "Tải lại trang": nhật ký mới trên cùng bộ nhớ.
      var second = PracticeLog.create({ storage: storage, now: fakeClock('2026-10-28T09:00:00Z', 20) });
      second.record(answerEntry('keo-tha', 'Kéo thả nốt', 1, true, 'C4', 'C4'));
      var ctx = reportApp(second);
      var stat = function (k) { return ctx.host.querySelector('[data-stat="' + k + '"]').textContent; };
      assert(stat('questions') === '1' && stat('rate') === '100%', 'Phiên này: ' + stat('questions') + ' câu ' + stat('rate'));
      ctx.app.setScope('all');
      assert(stat('questions') === '7' && stat('correct') === '3', 'Tất cả: ' + stat('questions') + ' câu, đúng ' + stat('correct'));
      assert(ctx.host.querySelector('[data-fact="sessions"]').textContent === '2', 'Số phiên sai');
      var rows = ctx.host.querySelectorAll('[data-section="sessions"] tbody tr');
      assert(rows.length === 2 && rows[1].textContent.indexOf('đang mở') !== -1 && rows[0].textContent.indexOf('đang mở') === -1,
        'Bảng các phiên sai');
      assert(ctx.host.querySelector('[data-scope="all"]').getAttribute('aria-selected') === 'true', 'Nút phạm vi chưa đổi');
      click(ctx.host, '[data-ref="exportCsv"]');
      assert(/-tat-ca-/.test(ctx.saved[0].name), 'Tên file tích lũy: ' + ctx.saved[0].name);
      return 'phiên này 1 câu · tất cả 2 phiên / 7 câu · file ' + ctx.saved[0].name;
    }],
    ['Bật / tắt / xóa dữ liệu đã lưu; thông báo rõ dữ liệu nằm ở đâu', function () {
      var storage = createFakeStorage();
      var log = PracticeLog.create({ storage: storage });
      var ctx = reportApp(log);
      var text = function () { return ctx.host.querySelector('[data-ref-storage-text]').textContent; };
      assert(text().indexOf('chỉ có trong lần mở trang này') !== -1, 'Thông báo khi tắt lưu: ' + text());
      log.record(answerEntry('khuong-nhac', 'Tìm nốt', 1, true, 'C4', 'C4'));
      assert(storage.writes === 0, 'Ghi khi chưa bật lưu');
      var box = ctx.host.querySelector('[data-ref-saving]');
      box.checked = true;
      box.dispatchEvent(new Event('change', { bubbles: true }));
      var stored = JSON.parse(storage.getItem(PracticeLog.STORAGE_KEY));
      assert(stored.enabled && stored.sessions.length === 1 && stored.sessions[0].entries.length === 1, 'Bật lưu không lưu phiên đang mở');
      assert(text().indexOf('không gửi lên mạng') !== -1 && text().indexOf('không đồng bộ') !== -1, 'Thông báo khi bật lưu: ' + text());
      assert(text().indexOf('1 phiên đã lưu') !== -1, 'Không nêu số phiên đã lưu');
      log.record(answerEntry('khuong-nhac', 'Tìm nốt', 2, true, 'D4', 'D4'));
      assert(JSON.parse(storage.getItem(PracticeLog.STORAGE_KEY)).sessions[0].entries.length === 2, 'Không lưu câu mới');
      box = ctx.host.querySelector('[data-ref-saving]');
      box.checked = false;
      box.dispatchEvent(new Event('change', { bubbles: true }));
      log.record(answerEntry('khuong-nhac', 'Tìm nốt', 3, true, 'E4', 'E4'));
      assert(JSON.parse(storage.getItem(PracticeLog.STORAGE_KEY)).sessions[0].entries.length === 2, 'Tắt lưu mà vẫn lưu');
      assert(text().indexOf('còn 1 phiên đã lưu') !== -1, 'Không nhắc dữ liệu cũ còn trên máy: ' + text());
      click(ctx.host, '[data-ref="clearSaved"]');
      assert(storage.getItem(PracticeLog.STORAGE_KEY) !== null, 'Bấm một lần đã xóa');
      click(ctx.host, '[data-ref="clearSaved"]');
      assert(storage.getItem(PracticeLog.STORAGE_KEY) === null, 'Bấm hai lần chưa xóa');
      assert(ctx.host.querySelector('[data-ref="clearSaved"]').disabled, 'Nút xóa vẫn mở khi không còn dữ liệu');
      return 'tắt: 0 lần ghi · bật: lưu cả phiên đang mở · tắt: dừng lưu · xóa: cần bấm 2 lần';
    }],
    ['Trình duyệt không cho lưu / bộ nhớ đầy: báo lỗi dễ hiểu, báo cáo phiên này vẫn dùng được', function () {
      var none = reportApp(PracticeLog.create({ storage: null }));
      assert(none.host.querySelector('[data-ref-saving]').disabled, 'Vẫn cho bật lưu khi không có bộ nhớ');
      assert(none.host.querySelector('[data-ref-storage-text]').textContent.indexOf('không cho lưu') !== -1, 'Thiếu thông báo');
      var storage = createFakeStorage();
      storage.failWrites = true;
      var log = PracticeLog.create({ storage: storage });
      log.record(answerEntry('khuong-nhac', 'Tìm nốt', 1, true, 'C4', 'C4'));
      var ctx = reportApp(log);
      var box = ctx.host.querySelector('[data-ref-saving]');
      box.checked = true;
      box.dispatchEvent(new Event('change', { bubbles: true }));
      var msg = ctx.host.querySelector('[data-ref="message"]');
      assert(msg.classList.contains('is-retry') && msg.textContent.indexOf('không cho lưu') !== -1, 'Thông báo lỗi: ' + msg.textContent);
      assert(!ctx.host.querySelector('[data-ref-saving]').checked, 'Công tắc vẫn bật dù lưu thất bại');
      assert(ctx.host.querySelector('[data-stat="questions"]').textContent === '1', 'Báo cáo phiên này bị mất');
      return 'không có bộ nhớ → khoá công tắc; lỗi ghi → thông báo, vẫn xem được báo cáo';
    }],
    ['Bộ nhớ gần đầy: bỏ phiên cũ nhất, không bao giờ bỏ phiên đang mở', function () {
      var storage = createFakeStorage(3600);
      var old = logWithSession(handSession('a', '2026-10-20T08:00:00Z'), storage);
      old.setSaving(true);
      var log = PracticeLog.create({ storage: storage, now: fakeClock('2026-10-28T08:00:00Z', 5) });
      for (var i = 1; i <= 12; i++) log.record(answerEntry('nghe-cao-do', 'Luyện tập · mức Khó', i, true, 'C4', 'C4'));
      var sessions = log.savedSessions();
      assert(log.droppedSessions() >= 1, 'Không bỏ phiên cũ');
      assert(sessions.length === 1 && sessions[0].id === log.currentSession().id && sessions[0].entries.length === 12,
        'Phiên đang mở không được giữ: ' + sessions.map(function (s) { return s.id; }).join());
      return 'bỏ ' + log.droppedSessions() + ' phiên cũ, giữ đủ 12 câu của phiên đang mở';
    }],
    ['Lỗi khi xuất file: báo lỗi, không làm hỏng báo cáo', function () {
      var ctx = reportApp(logWithSession(handSession('a', '2026-10-28T08:00:00Z')), {
        download: function () { throw new Error('blocked'); }
      });
      click(ctx.host, '[data-ref="exportJson"]');
      var msg = ctx.host.querySelector('[data-ref="message"]');
      assert(msg.classList.contains('is-retry') && msg.textContent.indexOf('Chưa xuất được file') !== -1, 'Thông báo: ' + msg.textContent);
      assert(ctx.host.querySelector('[data-stat="questions"]').textContent === '6', 'Báo cáo bị hỏng');
      return '"Chưa xuất được file…"';
    }],
    ['In báo cáo: có dòng tiêu đề phạm vi + giờ in; bản in ẩn thanh điều hướng, nút bấm và các hoạt động khác', function () {
      var printed = 0;
      var ctx = reportApp(logWithSession(handSession('a', '2026-10-28T08:00:00Z')), { print: function () { printed += 1; } });
      click(ctx.host, '[data-ref="printButton"]');
      assert(printed === 1, 'Không gọi lệnh in');
      var head = ctx.host.querySelector('[data-ref="printHead"]').textContent;
      assert(head.indexOf('Phạm vi: Phiên này') !== -1 && head.indexOf('In lúc') !== -1, 'Tiêu đề in: ' + head);
      var printCss = '';
      Array.prototype.forEach.call(document.styleSheets, function (sheet) {
        Array.prototype.forEach.call(sheet.cssRules, function (rule) {
          if (rule.media && rule.media.mediaText === 'print') printCss += rule.cssText;
        });
      });
      ['.app-nav', '.no-print', '#view-bao-cao', '.print-only'].forEach(function (sel) {
        assert(printCss.indexOf(sel) !== -1, 'CSS in thiếu ' + sel);
      });
      return 'gọi in 1 lần; CSS in ẩn điều hướng/nút, chỉ in Báo cáo';
    }],
    ['Bắt đầu phiên mới: chưa lưu thì phải bấm hai lần; tải lại trang để mọi hoạt động bắt đầu lại', function () {
      var reloads = 0;
      var log = logWithSession(handSession('a', '2026-10-28T08:00:00Z'));
      var ctx = reportApp(log, { reload: function () { reloads += 1; } });
      click(ctx.host, '[data-ref="newSession"]');
      assert(reloads === 0 && ctx.host.querySelector('[data-ref="newSession"]').textContent.indexOf('sẽ mất') !== -1, 'Không hỏi lại');
      click(ctx.host, '[data-ref="newSession"]');
      assert(reloads === 1, 'Bấm lần hai không bắt đầu phiên mới');
      var fresh = reportApp(PracticeLog.create({ storage: null }), { reload: function () { reloads += 1; } });
      click(fresh.host, '[data-ref="newSession"]');
      assert(reloads === 2, 'Phiên trống mà vẫn hỏi lại');
      return 'có dữ liệu chưa lưu → hỏi lại; phiên trống → làm ngay';
    }],
    ['Màn hình hẹp (360 px): bảng không làm tràn trang', function () {
      var ctx = reportApp(logWithSession(handSession('a', '2026-10-28T08:00:00Z')));
      ctx.host.style.width = '360px';
      var wide = ctx.host.scrollWidth;
      assert(wide <= 362, 'Báo cáo rộng ' + wide + ' px trong khung 360 px');
      ctx.host.style.width = '';
      return 'rộng ' + wide + ' px (bảng tự cuộn ngang trong khung riêng)';
    }]
  ];

  // =====================================================================
  // NHÓM 8 – Gợi ý luyện tập tiếp theo (quy tắc cố định, Giai đoạn 5)
  // =====================================================================
  // Dựng một phiên từ các câu trả lời (gắn thời điểm cách nhau 30 giây).
  function sessionOf(id, entries) {
    var clock = fakeClock('2026-10-28T08:00:00Z', 30);
    entries.forEach(function (e) { e.time = clock().toISOString(); });
    return { id: id, startedAt: entries[0].time, lastAt: entries[entries.length - 1].time, entries: entries };
  }

  function adviceFor(entries) {
    return PracticeAdvisor.suggest(ReportActivity.summarize([sessionOf('s', entries)]));
  }

  function ids(list) { return list.map(function (s) { return s.id; }).join(', '); }

  var ADVISOR_TESTS = [
    ['Chưa có dữ liệu: không đưa gợi ý nào', function () {
      var list = PracticeAdvisor.suggest(ReportActivity.summarize([]));
      assert(list.length === 0, 'Có ' + list.length + ' gợi ý');
      return '0 gợi ý';
    }],
    ['Nốt hay nhầm (Rê₄ sai 2 lần, cùng nhầm với Mi₄) được gợi ý đầu tiên, kèm lý do lấy từ số liệu', function () {
      var list = PracticeAdvisor.suggest(ReportActivity.summarize([handSession('a', '2026-10-28T08:00:00Z')]));
      var first = list[0];
      assert(first && first.id === 'note-D4', 'Gợi ý đầu: ' + ids(list));
      assert(first.title === 'Ôn nốt Rê₄ – hay nhầm với Mi₄', 'Tiêu đề: ' + first.title);
      assert(first.reason.indexOf('Sai 2 trên') === 0 && first.reason.indexOf('2 lần chọn Mi₄') !== -1, 'Lý do: ' + first.reason);
      assert(list.length <= PracticeAdvisor.MAX_SUGGESTIONS, 'Quá nhiều gợi ý');
      assert(list.some(function (s) { return s.id === 'try-keo-tha'; }), 'Thiếu gợi ý thử Kéo thả (chưa làm): ' + ids(list));
      assert(!list.some(function (s) { return s.id === 'note-A4'; }), 'La₄ chỉ sai 1 lần mà vẫn bị coi là hay nhầm');
      return ids(list) + ' · "' + first.reason + '"';
    }],
    ['Hoạt động đúng dưới 60% (từ 5 câu) được gợi ý luyện thêm; dưới 5 câu thì chưa kết luận', function () {
      var six = [], four = [];
      for (var i = 1; i <= 6; i++) six.push(answerEntry('trac-nghiem', 'Cao hơn – thấp hơn', i, true, 'higher', i <= 2 ? 'higher' : 'lower'));
      for (var j = 1; j <= 4; j++) four.push(answerEntry('trac-nghiem', 'Cao hơn – thấp hơn', j, true, 'higher', 'lower'));
      var weak = adviceFor(six).filter(function (s) { return s.id === 'weak-trac-nghiem'; })[0];
      assert(weak && weak.reason === 'Tỷ lệ đúng 33% (2/6 câu).', 'Gợi ý: ' + JSON.stringify(weak));
      assert(weak.view === 'trac-nghiem', 'Sai đường dẫn: ' + weak.view);
      assert(!adviceFor(four).some(function (s) { return s.id === 'weak-trac-nghiem'; }), '4 câu đã bị kết luận là yếu');
      return '6 câu đúng 2 → gợi ý; 4 câu sai cả 4 → chưa kết luận';
    }],
    ['Nghe cao độ mức Dễ đúng từ 80% (10 câu) → gợi ý lên mức Vừa; 9 câu thì chưa', function () {
      function listening(n) {
        var list = [];
        for (var i = 1; i <= n; i++) list.push(answerEntry('nghe-cao-do', 'Luyện tập · mức Dễ', i, true, 'C4', i === 1 ? 'D4' : 'C4'));
        return list;
      }
      var ten = adviceFor(listening(10));
      assert(ten[0].id === 'level-Dễ' && ten[0].title === 'Thử Nghe cao độ mức Vừa', 'Gợi ý: ' + ids(ten));
      assert(ten[0].reason === 'Mức Dễ: đúng 9/10 câu (90%).', 'Lý do: ' + ten[0].reason);
      assert(!adviceFor(listening(9)).some(function (s) { return s.id === 'level-Dễ'; }), '9 câu đã gợi ý lên mức');
      return ten[0].reason;
    }],
    ['Làm tốt đủ 5 hoạt động, không nốt hay nhầm → gợi ý thử thách Trắc nghiệm 20 câu', function () {
      var list = [];
      ['khuong-nhac', 'nghe-cao-do', 'trac-nghiem', 'keo-tha'].forEach(function (a) {
        for (var i = 1; i <= 3; i++) list.push(answerEntry(a, 'Thử', i, true, 'G4', 'G4'));
      });
      list.push({ kind: 'action', activity: 'sang-tao', action: 'play', detail: 'Phát giai điệu 3 nốt' });
      var advice = adviceFor(list);
      assert(advice.length === 1 && advice[0].id === 'challenge', 'Gợi ý: ' + ids(advice));
      return advice[0].reason;
    }],
    ['Báo cáo hiện mục gợi ý, ghi rõ "không dùng AI", mỗi gợi ý có nút mở thẳng hoạt động', function () {
      var ctx = reportApp(logWithSession(handSession('a', '2026-10-28T08:00:00Z')));
      var section = ctx.host.querySelector('[data-section="advice"]');
      assert(section, 'Không có mục gợi ý');
      var text = section.textContent;
      assert(text.indexOf('không dùng AI') !== -1, 'Không ghi rõ không dùng AI');
      assert(!/AI (gợi ý|đề xuất|phân tích)/.test(text), 'Có chữ gán nhãn AI cho gợi ý theo quy tắc');
      var links = section.querySelectorAll('a[href^="#"]');
      var items = section.querySelectorAll('[data-advice]');
      assert(items.length >= 2 && links.length === items.length, items.length + ' gợi ý, ' + links.length + ' nút');
      assert(links[0].getAttribute('href') === '#khuong-nhac' || links[0].getAttribute('href') === '#nghe-cao-do', 'Nút đầu: ' + links[0].getAttribute('href'));
      return items.length + ' gợi ý, nút đầu ' + links[0].getAttribute('href');
    }]
  ];

  // =====================================================================
  // NHÓM 9 – Máy chủ Trợ lý giáo viên (AI) – chạy với "Claude giả lập", KHÔNG gọi API thật
  // =====================================================================
  var corePromise;
  // Nạp lõi máy chủ (ES module). Cần mở trang kiểm thử qua máy chủ http (tools/serve.ps1), không mở được từ file://.
  function core() {
    if (!corePromise) corePromise = import('../functions/_lib/tro-ly-core.js');
    return corePromise;
  }

  // Giá trị giả lập để kiểm thử – không phải khóa thật.
  var TEST_ENV = { ANTHROPIC_API_KEY: 'khoa-gia-lap-de-kiem-thu', TEACHER_ACCESS_CODE: 'ma-thu-123' };
  var TEST_URL = 'https://ai-music-lab.example/api/tro-ly-giao-vien';

  function fakeRequest(body, headers) {
    var h = new Headers(headers === undefined ? { 'x-ma-giao-vien': TEST_ENV.TEACHER_ACCESS_CODE } : headers);
    return {
      url: TEST_URL,
      headers: h,
      text: function () { return Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)); }
    };
  }

  // "Claude giả lập": ghi lại tham số được gửi và trả về câu trả lời định sẵn (hoặc ném lỗi).
  function fakeClient(reply) {
    var calls = [];
    return {
      calls: calls,
      beta: { messages: { create: function (params) {
        calls.push(params);
        return typeof reply === 'function' ? Promise.resolve().then(function () { return reply(params); }) : Promise.resolve(reply);
      } } }
    };
  }

  function aiReply(data, extra) {
    var reply = { model: 'claude-opus-5-5', stop_reason: 'end_turn',
      content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data) }] };
    for (var k in extra || {}) reply[k] = extra[k];
    return reply;
  }

  function noClassify() { return 'other'; }

  function L(id) { return MusicNotes.findNote(id).label; }

  var QUESTION_REQUEST = { task: 'cau-hoi', level: 'vua', count: 3, notes: ['D4', 'E4'] };

  // 3 câu đúng + 3 câu sai (đáp án sai, lộ đáp án, không hỏi về nốt giáo viên chọn).
  function aiQuestions() {
    return { questions: [
      { kind: 'ten-not-tren-khuong', notes: ['D4'], prompt: 'Nốt nhạc trên khuông này tên là gì?',
        options: ['C4', 'D4', 'E4'], answerId: 'D4', explanation: 'Nốt nằm ngay dưới dòng kẻ 1 là ' + L('D4') + '.' },
      { kind: 'not-thap-hon', notes: ['E4', 'C5'], prompt: 'Nốt nào thấp hơn: ' + L('E4') + ' hay ' + L('C5') + '?',
        options: ['E4', 'C5'], answerId: 'C5', explanation: L('C5') + ' thấp hơn.' },
      { kind: 'not-cao-hon', notes: ['D4', 'G4'], prompt: 'Nốt nào cao hơn: ' + L('D4') + ' hay ' + L('G4') + '?',
        options: ['D4', 'G4'], answerId: 'G4', explanation: L('G4') + ' cao hơn ' + L('D4') + ' 3 bậc.' },
      { kind: 'ten-not-tren-khuong', notes: ['E4'], prompt: 'Nốt ' + L('E4') + ' trên khuông tên là gì?',
        options: ['E4', 'F4', 'G4'], answerId: 'E4', explanation: 'Đó là ' + L('E4') + '.' },
      { kind: 'vi-tri-cua-not', notes: ['A4'], prompt: L('A4') + ' nằm ở đâu trên khuông?',
        options: ['A4', 'B4', 'G4'], answerId: 'A4', explanation: L('A4') + ' nằm ở khe 2.' },
      { kind: 'vi-tri-cua-not', notes: ['E4'], prompt: L('E4') + ' nằm ở đâu trên khuông?',
        options: ['C4', 'E4', 'G4', 'B4'], answerId: 'E4', explanation: L('E4') + ' nằm trên dòng kẻ 1.' }
    ] };
  }

  function aiPlan(overrides) {
    var plan = {
      title: 'Ai nghe tinh hơn?',
      objectives: ['Phân biệt được Đô₄ và Sol₄ khi nghe'],
      steps: [
        { minutes: 3, name: 'Khởi động', teacher: 'Hát mẫu thang âm.', students: 'Hát theo.', appView: '' },
        { minutes: 7, name: 'Nghe và chọn', teacher: 'Chiếu mục Nghe cao độ mức Dễ.', students: 'Nghe rồi chọn tên nốt.', appView: 'nghe-cao-do' },
        { minutes: 5, name: 'Tổng kết', teacher: 'Mở Báo cáo, nhắc nốt hay nhầm.', students: 'Nói lại cách nhận biết.', appView: 'bao-cao' }
      ],
      assessment: 'Học sinh chọn đúng ít nhất 4/5 câu ở mức Dễ.'
    };
    for (var k in overrides || {}) plan[k] = overrides[k];
    return plan;
  }

  var PLAN_REQUEST = { task: 'hoat-dong', grade: 4, minutes: 15, goal: 'Phân biệt cao độ Đô và Sol', notes: ['C4', 'G4'] };

  function generate(c, body, client, env, headers, classify) {
    return c.handleGenerate(fakeRequest(body, headers), env || TEST_ENV, { client: client, classifyError: classify || noClassify })
      .then(function (res) { return res.json().then(function (data) { return { status: res.status, data: data, res: res }; }); });
  }

  var SERVER_TESTS = [
    ['Trạng thái: báo chưa cài khi thiếu biến môi trường; không bao giờ trả về khóa hay mã giáo viên', function () {
      return core().then(function (c) {
        return Promise.all([c.handleStatus({}).text(), c.handleStatus(TEST_ENV).text()]).then(function (texts) {
          var off = JSON.parse(texts[0]), on = JSON.parse(texts[1]);
          assert(off.ready === false && off.problems.length === 2, 'Chưa cài: ' + texts[0]);
          assert(on.ready === true && on.model === 'claude-opus-5-5', 'Đã cài: ' + texts[1]);
          assert(texts[1].indexOf(TEST_ENV.ANTHROPIC_API_KEY) === -1 && texts[1].indexOf(TEST_ENV.TEACHER_ACCESS_CODE) === -1, 'Lộ khóa/mã');
          return 'chưa cài: ' + off.problems.length + ' việc cần làm; đã cài: ready, ' + on.model;
        });
      });
    }],
    ['Chặn trước khi gọi AI: thiếu/sai mã → 401, trang khác → 403, chưa cài → 503, sai dữ liệu → 400, quá dài → 413', function () {
      return core().then(function (c) {
        var client = fakeClient(aiReply(aiQuestions()));
        var cases = [
          ['không mã', 401, QUESTION_REQUEST, {}],
          ['sai mã', 401, QUESTION_REQUEST, { 'x-ma-giao-vien': 'ma-thu-12' }],
          ['trang khác', 403, QUESTION_REQUEST, { 'x-ma-giao-vien': TEST_ENV.TEACHER_ACCESS_CODE, origin: 'https://trang-la.example' }],
          ['chưa cài', 503, QUESTION_REQUEST, undefined, {}],
          ['không phải JSON', 400, '{task:', undefined],
          ['20 câu', 400, { task: 'cau-hoi', level: 'vua', count: 20 }, undefined],
          ['nốt Rê₅', 400, { task: 'cau-hoi', level: 'de', count: 5, notes: ['D5'] }, undefined],
          ['lớp 3', 400, { task: 'hoat-dong', grade: 3, minutes: 10, goal: 'Nghe nốt' }, undefined],
          ['task lạ', 400, { task: 'tro-chuyen', text: 'xin chào' }, undefined],
          ['quá dài', 413, JSON.stringify({ task: 'cau-hoi', level: 'de', count: 5, theme: 'x'.repeat(5000) }), undefined]
        ];
        return cases.reduce(function (chain, k) {
          return chain.then(function (seen) {
            return generate(c, k[2], client, k[4], k[3]).then(function (r) {
              assert(r.status === k[1], k[0] + ': mã ' + r.status + ' (cần ' + k[1] + ')');
              assert(r.data.ok === false && r.data.message, k[0] + ': thiếu thông báo');
              return seen.concat(k[0] + '→' + r.status);
            });
          });
        }, Promise.resolve([])).then(function (seen) {
          assert(client.calls.length === 0, 'Đã gọi AI ' + client.calls.length + ' lần');
          return seen.join(', ') + '; AI không bị gọi lần nào';
        });
      });
    }],
    ['Tham số gửi Claude: claude-opus-5-5, structured outputs, fallback; chỉ chứa lựa chọn của giáo viên, không có khóa', function () {
      return core().then(function (c) {
        var client = fakeClient(aiReply(aiQuestions()));
        var body = { task: 'cau-hoi', level: 'vua', count: 3, notes: ['E4', 'D4', 'D4'], theme: 'mùa thu', hocSinh: 'DU-LIEU-THUA-KHONG-DUOC-GUI' };
        return generate(c, body, client).then(function (r) {
          assert(r.status === 200, 'Mã ' + r.status);
          var p = client.calls[0], text = JSON.stringify(p);
          assert(p.model === 'claude-opus-5-5' && p.max_tokens === 16000, 'model/max_tokens: ' + p.model + '/' + p.max_tokens);
          assert(p.betas.indexOf('server-side-fallback-2026-07-01') !== -1 && p.fallbacks === 'default', 'Thiếu fallback');
          assert(p.output_config.effort === 'medium' && p.output_config.format.type === 'json_schema', 'output_config sai');
          assert(!('thinking' in p) && !('temperature' in p), 'Có tham số không dùng cho Opus 5.5');
          assert(p.system === c.SYSTEM_PROMPT, 'Lời nhắn hệ thống không cố định');
          assert(text.indexOf('DU-LIEU-THUA') === -1, 'Trường thừa bị gửi cho AI');
          assert(text.indexOf(TEST_ENV.ANTHROPIC_API_KEY) === -1 && text.indexOf(TEST_ENV.TEACHER_ACCESS_CODE) === -1, 'Khóa/mã nằm trong lời nhắn');
          assert(p.messages[0].content.indexOf('mùa thu') !== -1 && p.messages[0].content.indexOf('Rê₄, Mi₄') !== -1, 'Thiếu lựa chọn của giáo viên');
          assert(r.res.headers.get('cache-control') === 'no-store', 'Thiếu cache-control: no-store');
          return 'model, betas, fallbacks, effort medium, json_schema; trường thừa bị bỏ';
        });
      });
    }],
    ['Kiểm tra lại đáp án bằng quy tắc: giữ 3 câu đúng, loại câu sai đáp án / lộ đáp án / không hỏi nốt đã chọn', function () {
      return core().then(function (c) {
        return generate(c, QUESTION_REQUEST, fakeClient(aiReply(aiQuestions()))).then(function (r) {
          assert(r.status === 200 && r.data.ok, 'Mã ' + r.status);
          var q = r.data.questions;
          assert(q.length === 3 && q.every(function (x) { return x.verified; }), 'Số câu đạt: ' + q.length);
          assert(q.map(function (x) { return x.answerId; }).join() === 'D4,G4,E4', 'Đáp án: ' + q.map(function (x) { return x.answerId; }).join());
          assert(q[0].staffNoteId === 'D4' && q[1].staffNoteId === null, 'Nốt vẽ trên khuông sai');
          var pos = q[2].options.filter(function (o) { return o.id === 'E4'; })[0].text;
          assert(pos.toLowerCase() === MusicNotes.findNote('E4').position.toLowerCase(), 'Phương án vị trí không lấy từ quy tắc: ' + pos);
          var reasons = r.data.rejected.map(function (x) { return x.index + ': ' + x.reason; });
          assert(r.data.rejected.length === 3, 'Bị loại: ' + reasons.join(' | '));
          assert(/sai – đúng phải là Mi₄/.test(reasons[0]) && /lộ đáp án/.test(reasons[1]) && /không hỏi về nốt/.test(reasons[2]),
            'Lý do loại: ' + reasons.join(' | '));
          return 'loại: ' + reasons.join(' | ');
        });
      });
    }],
    ['Không câu nào đúng → 502; AI từ chối → 422; bị cắt ngang → 502; trả về không phải JSON → 502', function () {
      return core().then(function (c) {
        var wrong = aiQuestions();
        wrong.questions = [wrong.questions[1], wrong.questions[3]];
        return Promise.all([
          generate(c, QUESTION_REQUEST, fakeClient(aiReply(wrong))),
          generate(c, QUESTION_REQUEST, fakeClient(aiReply('', { stop_reason: 'refusal' }))),
          generate(c, QUESTION_REQUEST, fakeClient(aiReply('{"questions": [', { stop_reason: 'max_tokens' }))),
          generate(c, QUESTION_REQUEST, fakeClient(aiReply('Xin lỗi, tôi không biết.')))
        ]).then(function (all) {
          var got = all.map(function (r) { return r.status + ' ' + r.data.error; });
          assert(got.join() === '502 khong-dat,422 tu-choi,502 chua-xong,502 loi-ai', got.join(', '));
          assert(all[0].data.rejected.length === 2, 'Thiếu lý do loại');
          return got.join(', ');
        });
      });
    }],
    ['Lỗi dịch vụ AI: quá tải → 429/503; lỗi khóa → 500 không lộ chi tiết; lỗi khác → 502', function () {
      return core().then(function (c) {
        function failing(kind) {
          var err = new Error('invalid x-api-key ' + TEST_ENV.ANTHROPIC_API_KEY);
          return generate(c, QUESTION_REQUEST, fakeClient(function () { throw err; }), null, undefined, function (e) {
            assert(e === err, 'Không chuyển lỗi gốc cho bộ phân loại');
            return kind;
          });
        }
        return Promise.all(['rate', 'overloaded', 'auth', 'billing', 'bad-request', 'other'].map(failing)).then(function (all) {
          var got = all.map(function (r) { return r.status; });
          assert(got.join() === '429,503,500,500,502,502', 'Mã: ' + got.join());
          all.forEach(function (r) {
            assert(JSON.stringify(r.data).indexOf(TEST_ENV.ANTHROPIC_API_KEY) === -1 && JSON.stringify(r.data).indexOf('x-api-key') === -1,
              'Lộ chi tiết lỗi: ' + r.data.message);
          });
          return 'rate→429, overloaded→503, auth/billing→500, khác→502; không lộ chi tiết';
        });
      });
    }],
    ['Kế hoạch hoạt động: nhận kế hoạch hợp lệ; loại kế hoạch sai tổng phút, nhắc mục không có, không dùng ứng dụng', function () {
      return core().then(function (c) {
        var noApp = aiPlan();
        noApp.steps = noApp.steps.map(function (s) { var x = {}; for (var k in s) x[k] = s[k]; x.appView = ''; return x; });
        var fakeView = aiPlan();
        fakeView.steps = fakeView.steps.slice();
        fakeView.steps[1] = { minutes: 7, name: 'Chơi game', teacher: 'Mở trò chơi', students: 'Chơi', appView: 'tro-choi-moi' };
        var tooLong = aiPlan();
        tooLong.steps = tooLong.steps.concat([{ minutes: 20, name: 'Thêm', teacher: 'Dạy thêm', students: 'Học thêm', appView: 'keo-tha' }]);
        return Promise.all([aiPlan(), tooLong, fakeView, noApp].map(function (plan) {
          return generate(c, PLAN_REQUEST, fakeClient(aiReply(plan)));
        })).then(function (all) {
          var ok = all[0];
          assert(ok.status === 200 && ok.data.plan.totalMinutes === 15, 'Kế hoạch đúng: ' + ok.status);
          assert(ok.data.plan.steps[1].appName === 'Nghe cao độ' && ok.data.plan.steps[0].appName === '', 'Tên mục ứng dụng sai');
          var bad = all.slice(1).map(function (r) { return r.status + ' ' + r.data.message; });
          assert(all.slice(1).every(function (r) { return r.status === 502; }), bad.join(' | '));
          assert(/35 phút/.test(bad[0]) && /mục không có/.test(bad[1]) && /không có bước nào dùng ứng dụng/.test(bad[2]), bad.join(' | '));
          return 'hợp lệ → 200 (15 phút); loại 3 kế hoạch sai';
        });
      });
    }],
    ['Mã chạy trên trình duyệt không chứa khóa API hay địa chỉ API của Anthropic', function () {
      return fetch('../index.html').then(function (r) { return r.text(); }).then(function (html) {
        var files = (html.match(/src="js\/[^"]+"/g) || []).map(function (s) { return '../' + s.slice(5, -1); });
        assert(files.indexOf('../js/teacher-assistant.js') !== -1, 'index.html chưa nạp teacher-assistant.js');
        return Promise.all(files.concat(['../index.html']).map(function (f) {
          return fetch(f).then(function (r) { return r.text(); }).then(function (text) {
            ['sk-ant', 'ANTHROPIC_API_KEY', 'api.anthropic.com', 'x-api-key'].forEach(function (bad) {
              assert(text.indexOf(bad) === -1, f + ' chứa "' + bad + '"');
            });
          });
        })).then(function () { return 'đã quét ' + (files.length + 1) + ' file gửi về trình duyệt'; });
      });
    }]
  ];

  // =====================================================================
  // NHÓM 10 – Trang Trợ lý giáo viên (dùng máy chủ giả lập ở trên)
  // =====================================================================
  /*
   * fetch giả: GET/POST được chuyển thẳng cho lõi máy chủ thật (tro-ly-core.js) với "Claude giả lập".
   * reply: câu trả lời của Claude giả lập; status: nếu có thì trả mã lỗi này cho mọi yêu cầu (máy chủ không có trợ lý).
   */
  function fakeServer(c, reply, opts) {
    opts = opts || {};
    var server = { requests: [], client: fakeClient(reply) };
    server.fetch = function (url, init) {
      server.requests.push({ url: url, init: init });
      if (opts.status) return Promise.resolve(new Response('Not found', { status: opts.status }));
      if (init.method === 'GET') return Promise.resolve(c.handleStatus(opts.env || TEST_ENV));
      var request = { url: TEST_URL, headers: new Headers(init.headers), text: function () { return Promise.resolve(init.body); } };
      return c.handleGenerate(request, opts.env || TEST_ENV, { client: server.client, classifyError: noClassify });
    };
    return server;
  }

  function teacherApp(server) {
    var saved = [];
    var ctx = mountFresh(1, TeacherAssistant, { fetch: server.fetch, now: fakeClock('2026-10-28T09:00:00Z', 0),
      download: function (name, blob) { saved.push({ name: name, blob: blob }); } });
    ctx.saved = saved;
    ctx.server = server;
    return ctx.app.ready().then(function () { return ctx; });
  }

  function fillCode(ctx, code) { ctx.host.querySelector('input[name="code"]').value = code; }
  function teacherMessage(ctx) { return ctx.host.querySelector('[data-ref="message"]').textContent; }

  var TEACHER_TESTS = [
    ['Máy chủ chưa có trợ lý (404) hoặc chưa cài khóa: báo rõ, khóa nút "Nhờ AI soạn"', function () {
      return core().then(function (c) {
        return Promise.all([teacherApp(fakeServer(c, null, { status: 404 })), teacherApp(fakeServer(c, null, { env: {} }))]);
      }).then(function (all) {
        var none = all[0], unset = all[1];
        var s1 = none.host.querySelector('[data-ref="status"]'), s2 = unset.host.querySelector('[data-ref="status"]');
        assert(s1.classList.contains('is-off') && s1.textContent.indexOf('chưa có trợ lý AI') !== -1, 'Trạng thái: ' + s1.textContent);
        assert(s2.textContent.indexOf('ANTHROPIC_API_KEY') !== -1, 'Không nói thiếu gì: ' + s2.textContent);
        assert(none.host.querySelector('[data-ref="submit"]').disabled && unset.host.querySelector('[data-ref="submit"]').disabled, 'Nút vẫn bấm được');
        return none.app.submit().then(function () {
          assert(none.server.requests.length === 1, 'Vẫn gửi yêu cầu tạo');
          return '"' + s1.textContent.slice(0, 60) + '…"';
        });
      });
    }],
    ['Tạo câu hỏi: gửi đúng lựa chọn, hiện câu đã kiểm tra, vẽ nốt trên khuông, nói rõ do AI viết', function () {
      return core().then(function (c) { return teacherApp(fakeServer(c, aiReply(aiQuestions()))); }).then(function (ctx) {
        var form = ctx.host.querySelector('form');
        assert(!ctx.host.querySelector('[data-ref="submit"]').disabled, 'Nút bị khóa dù máy chủ sẵn sàng');
        form.elements.count.value = '3';
        Array.prototype.forEach.call(form.querySelectorAll('input[name="qnotes"]'), function (i) { i.checked = i.value === 'D4' || i.value === 'E4'; });
        fillCode(ctx, TEST_ENV.TEACHER_ACCESS_CODE);
        return ctx.app.submit().then(function () {
          var post = ctx.server.requests[1];
          var body = JSON.parse(post.init.body);
          assert(post.init.method === 'POST' && post.init.headers['x-ma-giao-vien'] === TEST_ENV.TEACHER_ACCESS_CODE, 'Không gửi mã qua header');
          assert(Object.keys(body).sort().join() === 'count,kinds,level,notes,task,theme', 'Trường gửi đi: ' + Object.keys(body).join());
          assert(body.notes.join() === 'D4,E4' && body.count === 3 && post.init.body.indexOf(TEST_ENV.TEACHER_ACCESS_CODE) === -1, 'Nội dung gửi: ' + post.init.body);
          var items = ctx.host.querySelectorAll('[data-question]');
          assert(items.length === 3, 'Hiện ' + items.length + ' câu');
          assert(items[0].querySelector('.mini-staff .staff-svg'), 'Câu đọc tên nốt chưa vẽ khuông');
          assert(items[1].querySelector('[data-answer]').textContent.indexOf(L('G4')) === 0, 'Đánh dấu đáp án sai');
          var text = ctx.host.querySelector('[data-ref="result"]').textContent;
          assert(text.indexOf('đã được máy chủ kiểm tra bằng quy tắc nhạc lý') !== -1, 'Thiếu dòng đã kiểm tra');
          assert(text.indexOf('do AI (Claude – Anthropic) viết') !== -1 && text.indexOf('đọc lại') !== -1, 'Thiếu nhắc đọc lại');
          assert(text.indexOf('Máy đã loại 3 câu') !== -1, 'Không báo số câu bị loại');
          assert(ctx.host.querySelector('input[name="code"]').value === TEST_ENV.TEACHER_ACCESS_CODE, 'Ô mã bị xóa');
          return '3 câu, 1 khuông, loại 3; mã chỉ nằm ở header';
        });
      });
    }],
    ['Tải văn bản/JSON: ghi rõ soạn bởi Claude (Anthropic), có đáp án; mã giáo viên không nằm trong file', function () {
      return core().then(function (c) { return teacherApp(fakeServer(c, aiReply(aiQuestions()))); }).then(function (ctx) {
        fillCode(ctx, TEST_ENV.TEACHER_ACCESS_CODE);
        ctx.host.querySelector('form').elements.count.value = '3';
        return ctx.app.submit().then(function () {
          click(ctx.host, '[data-save="txt"]');
          click(ctx.host, '[data-save="json"]');
          assert(ctx.saved.length === 2 && /^cau-hoi-ai-2026-10-28-\d{4}\.txt$/.test(ctx.saved[0].name) && /\.json$/.test(ctx.saved[1].name),
            'Tên file: ' + ctx.saved.map(function (s) { return s.name; }).join());
          return Promise.all(ctx.saved.map(function (s) { return readBlob(s.blob); })).then(function (texts) {
            assert(texts[0].indexOf('Claude (Anthropic)') !== -1 && texts[0].indexOf('← đáp án') !== -1, 'Văn bản thiếu nguồn/đáp án');
            var data = JSON.parse(texts[1]);
            assert(data.type === 'ai-music-lab/tro-ly-giao-vien' && data.content.questions.length === 3, 'JSON sai');
            assert(texts.join().indexOf(TEST_ENV.TEACHER_ACCESS_CODE) === -1, 'Mã giáo viên nằm trong file');
            return ctx.saved.map(function (s) { return s.name; }).join(', ');
          });
        });
      });
    }],
    ['Sai mã giáo viên: báo "Mã giáo viên không đúng", không gọi AI, không hiện kết quả', function () {
      return core().then(function (c) { return teacherApp(fakeServer(c, aiReply(aiQuestions()))); }).then(function (ctx) {
        fillCode(ctx, 'doan-bua');
        return ctx.app.submit().then(function () {
          assert(teacherMessage(ctx) === 'Mã giáo viên không đúng.', 'Thông báo: ' + teacherMessage(ctx));
          assert(ctx.server.client.calls.length === 0 && !ctx.host.querySelector('[data-question]'), 'Vẫn gọi AI / hiện kết quả');
          assert(!ctx.host.querySelector('[data-ref="submit"]').disabled, 'Nút bị khóa sau lỗi');
          return teacherMessage(ctx);
        });
      });
    }],
    ['Gợi ý hoạt động: thiếu mục tiêu thì nhắc, không gửi; đủ thì hiện bảng các bước, nút mở mục ứng dụng; chữ của AI không chạy thành mã', function () {
      return core().then(function (c) {
        return teacherApp(fakeServer(c, aiReply(aiPlan({ title: '<img src=x onerror="window.__xss=1">Nghe tinh' }))));
      }).then(function (ctx) {
        click(ctx.host, '[data-task="hoat-dong"]');
        assert(!ctx.host.querySelector('[data-panel="hoat-dong"]').hidden && ctx.host.querySelector('[data-panel="cau-hoi"]').hidden, 'Không chuyển thẻ');
        fillCode(ctx, TEST_ENV.TEACHER_ACCESS_CODE);
        return ctx.app.submit().then(function () {
          assert(ctx.server.requests.length === 1 && /mục tiêu/.test(teacherMessage(ctx)), 'Không nhắc mục tiêu: ' + teacherMessage(ctx));
          var form = ctx.host.querySelector('form');
          form.elements.goal.value = PLAN_REQUEST.goal;
          form.elements.grade.value = '4';
          return ctx.app.submit();
        }).then(function () {
          var body = JSON.parse(ctx.server.requests[1].init.body);
          assert(body.task === 'hoat-dong' && body.minutes === 15 && body.grade === 4, 'Gửi: ' + JSON.stringify(body));
          var rows = ctx.host.querySelectorAll('.ta-plan tbody tr');
          assert(rows.length === 3, rows.length + ' bước');
          assert(ctx.host.querySelector('.ta-plan a[href="#nghe-cao-do"]'), 'Thiếu nút mở Nghe cao độ');
          assert(!ctx.host.querySelector('[data-ref="result"] img') && !window.__xss, 'Chữ của AI bị chạy như HTML');
          assert(ctx.host.querySelector('[data-ref="result"] h3').textContent.indexOf('<img') === 0, 'Tên hoạt động bị mất');
          return '3 bước, có nút #nghe-cao-do, thẻ <img> chỉ hiện thành chữ';
        });
      });
    }]
  ];

  // ---------- Chạy các nhóm kiểm thử ----------
  var SECTIONS = [
    ['Khuông nhạc tương tác (Giai đoạn 1)', STAFF_TESTS],
    ['Nghe cao độ (Giai đoạn 2)', LISTENING_TESTS],
    ['Ngân hàng câu hỏi (Giai đoạn 2)', BANK_TESTS],
    ['Giao diện Trắc nghiệm (Giai đoạn 2)', QUIZ_TESTS],
    ['Kéo thả nốt (Giai đoạn 3)', DRAG_TESTS],
    ['Phòng sáng tạo giai điệu (Giai đoạn 3)', MELODY_TESTS],
    ['Báo cáo kết quả luyện tập (Giai đoạn 4)', REPORT_TESTS],
    ['Gợi ý luyện tập tiếp theo – quy tắc cố định, không dùng AI (Giai đoạn 5)', ADVISOR_TESTS],
    ['Máy chủ Trợ lý giáo viên – AI giả lập, không gọi API thật (Giai đoạn 5)', SERVER_TESTS],
    ['Trang Trợ lý giáo viên (Giai đoạn 5)', TEACHER_TESTS],
    ['Khung ứng dụng', APP_TESTS]
  ];

  function runSection(section) {
    var container = document.getElementById('sections');
    var heading = document.createElement('h2');
    heading.textContent = section[0];
    container.appendChild(heading);
    var table = document.createElement('table');
    table.innerHTML = '<tr><th>Nội dung kiểm thử</th><th>Kết quả</th></tr>';
    container.appendChild(table);
    return section[1].reduce(function (chain, test) {
      return chain.then(function () {
        var row = table.insertRow();
        row.insertCell().textContent = test[0];
        var cell = row.insertCell();
        return Promise.resolve().then(test[1]).then(function (detail) {
          setCell(cell, true, detail);
        }, function (error) {
          setCell(cell, false, error.message);
        });
      });
    }, Promise.resolve());
  }

  runNoteMatrix().then(function () {
    return SECTIONS.reduce(function (chain, section) {
      return chain.then(function () { return runSection(section); });
    }, Promise.resolve());
  }).then(function () {
    var summary = document.getElementById('summary');
    var total = results.pass + results.fail;
    summary.className = 'summary ' + (results.fail === 0 ? 'pass' : 'fail');
    summary.textContent = (results.fail === 0 ? '✅ ' : '❌ ') + results.pass + '/' + total +
      ' phép kiểm thử đạt' + (results.fail ? ' – ' + results.fail + ' lỗi' : '') +
      '. Âm thanh trong các phép thử giao diện là giả lập – nghe bằng tai cần kiểm tra thủ công.';
    window.__testResults = results;
  });
})();
