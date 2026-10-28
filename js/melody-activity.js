/*
 * AI MUSIC LAB – Hoạt động 5: Phòng sáng tạo giai điệu
 *
 * Học sinh chọn số chỉ nhịp (2/4, 3/4, 4/4), hình nốt (nốt đen 1 phách, nốt trắng 2 phách,
 * nốt tròn 4 phách) và cao độ (8 nốt đã học) để viết một giai điệu ngắn trên khuông nhạc,
 * kiểm tra các ô nhịp đã đủ phách chưa, nghe lại đúng trường độ, rồi viết ý tưởng của giai điệu.
 * Phòng sáng tạo KHÔNG dùng AI và không tự sáng tác: giai điệu do học sinh tạo ra;
 * phần "Kiểm tra nhịp" chỉ cộng số phách theo quy tắc nhạc lý cố định.
 *
 * Giai điệu chỉ được lưu khi học sinh bấm "Lưu": tải về máy một file JSON (nốt, trường độ, nhịp
 * và ý tưởng) hoặc ảnh PNG của bản nhạc. Không gửi lên máy chủ, không cần họ tên.
 */
(function (global) {
  'use strict';

  var shared = global.AppShared;
  var escapeHtml = shared.escapeHtml;
  var NOTES = global.MusicNotes.NOTES;

  var MAX_NOTES = 16;
  var NOTES_PER_ROW = 8;
  var NARROW_NOTES_PER_ROW = 4;               // màn hình điện thoại: 4 nốt mỗi dòng cho nốt to, dễ chạm (một ô nhịp tối đa 4 nốt)
  var NARROW_QUERY = '(max-width: 600px)';     // giống hoạt động Kéo thả
  var TITLE_MAX = 60;
  var IDEA_MAX = 500;
  var UNDO_LIMIT = 50;
  var METERS = [2, 3, 4];                      // số phách trong một ô nhịp; phách = nốt đen
  var DEFAULT_METER = 2;
  var OLD_FILE_METER = 4;                       // file phiên bản 1 chưa có nhịp: coi là 4/4, toàn nốt đen
  var NOTE_VALUES = [
    { beats: 1, name: 'Nốt đen', short: 'đen' },
    { beats: 2, name: 'Nốt trắng', short: 'trắng' },
    { beats: 4, name: 'Nốt tròn', short: 'tròn' }
  ];
  var TEMPOS = [
    { bpm: 72, name: 'Chậm' },
    { bpm: 100, name: 'Vừa' },
    { bpm: 132, name: 'Nhanh' }
  ];
  // Mẫu khởi đầu theo quy tắc đơn giản (đi lên, đi xuống, nhảy bậc) để học sinh có điểm xuất phát.
  var PATTERNS = [
    { name: 'Đi lên', notes: ['C4', 'D4', 'E4', 'F4', 'G4'] },
    { name: 'Đi xuống', notes: ['G4', 'F4', 'E4', 'D4', 'C4'] },
    { name: 'Nhảy bậc', notes: ['C4', 'E4', 'G4', 'E4', 'C4'] }
  ];
  var FILE_TYPE = 'ai-music-lab/giai-dieu';
  var FILE_VERSION = 2;
  var CLEAR_CONFIRM_MS = 3000;
  var CLEAR_LABEL = 'Xóa toàn bộ giai điệu';

  function noteValue(beats) {
    return NOTE_VALUES.filter(function (v) { return v.beats === beats; })[0];
  }

  // Hình nốt nhỏ trên nút chọn: dùng chính glyph Bravura như trên khuông nhạc.
  function noteIconSvg(beats) {
    var hollow = { 2: 'noteheadHalf', 4: 'noteheadWhole' }[beats];
    var head = hollow
      ? '<path d="' + global.StaffRenderer.glyphPath(hollow) + '" transform="translate(' + (beats === 4 ? 3 : 8) + ' 46) scale(0.08)"/>'
      : '<path d="M97 125C186 125 295 43 295-42C295-93 255-125 198-125C88-125 0-44 0 42C0 94 43 125 97 125Z" transform="translate(8 46) scale(0.08)"/>';
    var stem = beats === 4 ? '' : '<rect x="29.6" y="10" width="2.2" height="36"/>';
    return '<svg class="value-icon" viewBox="0 0 40 60" aria-hidden="true">' + head + stem + '</svg>';
  }

  function fnButton(ref, icon, label, extraClass) {
    return '<button type="button" class="fn-btn ' + extraClass + '" data-ref="' + ref + '">' +
      '<span class="fn-icon" aria-hidden="true">' + icon + '</span><span class="fn-label">' + label + '</span></button>';
  }

  var GUIDE_STEPS = [
    ['Chọn', 'số chỉ nhịp', '2/4, 3/4 hoặc 4/4'],
    ['Chọn', 'hình nốt nhạc', '(đen, trắng, tròn)'],
    ['Chọn', 'cao độ', '(Đô, Rê, Mi, Pha, Sol, La, Si)'],
    ['Nhấn', '“Thêm nốt”', 'hoặc chạm vào khuông nhạc'],
    ['Tiếp tục', 'thêm nốt', 'để hoàn thành giai điệu'],
    ['Nhấn', '“Phát giai điệu”', 'để nghe kết quả'],
    ['Nhấn', '“Kiểm tra nhịp”', 'để xem các ô nhịp đã đủ phách chưa']
  ];

  var TEMPLATE =
    '<div class="activity-head">' +
      '<h2 class="activity-title">Phòng sáng tạo giai điệu</h2>' +
    '</div>' +
    '<div class="mz-pickers">' +
      '<section class="mz-panel mz-p1" aria-labelledby="mz-h1">' +
        '<h3 class="mz-head" id="mz-h1"><span class="mz-num">1</span>Chọn số chỉ nhịp</h3>' +
        '<div class="meter-row" data-ref="meterRow" role="group" aria-label="Số chỉ nhịp">' +
          METERS.map(function (m) {
            return '<button type="button" class="meter-btn" data-meter="' + m + '" aria-label="Nhịp ' + m + ' trên 4">' +
              '<span class="frac" aria-hidden="true"><span>' + m + '</span><span>4</span></span></button>';
          }).join('') +
        '</div>' +
      '</section>' +
      '<section class="mz-panel mz-p2" aria-labelledby="mz-h2">' +
        '<h3 class="mz-head" id="mz-h2"><span class="mz-num">2</span>Chọn hình nốt nhạc</h3>' +
        '<div class="value-row" data-ref="valueRow" role="group" aria-label="Hình nốt">' +
          NOTE_VALUES.map(function (v) {
            return '<button type="button" class="value-btn" data-beats="' + v.beats + '">' + noteIconSvg(v.beats) +
              '<span class="value-name">' + v.name + '</span><span class="value-beats">(' + v.beats + ' phách)</span></button>';
          }).join('') +
        '</div>' +
      '</section>' +
      '<section class="mz-panel mz-p3" aria-labelledby="mz-h3">' +
        '<h3 class="mz-head" id="mz-h3"><span class="mz-num">3</span>Chọn cao độ</h3>' +
        '<div class="pitch-row melody-palette" data-ref="palette" role="group" aria-label="Cao độ">' +
          NOTES.map(function (n) {
            // Như mẫu: tên nốt to (không kèm số quãng tám) và ký hiệu C4…C5 bên dưới để phân biệt Đô₄ – Đô₅.
            return '<button type="button" class="choice pitch-btn" data-pitch="' + n.id + '" aria-label="' + escapeHtml(n.label) + '">' +
              '<span class="choice-name">' + escapeHtml(n.label.replace(/[₀-₉]/g, '')) + '</span>' +
              '<span class="choice-symbol">' + n.symbol + '</span></button>';
          }).join('') +
        '</div>' +
      '</section>' +
    '</div>' +
    '<section class="mz-panel mz-p4" aria-labelledby="mz-h4">' +
      '<h3 class="mz-head" id="mz-h4"><span class="mz-num">4</span>Khuông nhạc và giai điệu' +
        '<span class="beat-info" data-ref="beatInfo"></span></h3>' +
      '<div class="staff-card melody-staff" data-ref="staffHost"></div>' +
      '<p class="meter-example" data-ref="meterExample"></p>' +
      '<ul class="beat-report" data-ref="beatReport" aria-label="Kết quả kiểm tra nhịp" hidden></ul>' +
      '<div class="sequence-row">' +
        '<div class="sequence" data-ref="sequence" aria-label="Chuỗi nốt của giai điệu"></div>' +
        '<div class="edit-bar">' +
          '<button type="button" class="btn btn-ghost btn-small" data-ref="moveLeft">◀ Lùi</button>' +
          '<button type="button" class="btn btn-ghost btn-small" data-ref="moveRight">Tiến ▶</button>' +
        '</div>' +
      '</div>' +
      '<div class="pattern-row"><span>Bắt đầu từ mẫu (nốt đen):</span>' +
        PATTERNS.map(function (p, i) {
          return '<button type="button" class="btn btn-ghost btn-small" data-pattern="' + i + '">' + p.name + '</button>';
        }).join('') +
      '</div>' +
    '</section>' +
    '<section class="mz-panel mz-p5" aria-labelledby="mz-h5">' +
      '<h3 class="mz-head" id="mz-h5"><span class="mz-num">5</span>Các nút chức năng</h3>' +
      '<div class="fn-grid">' +
        fnButton('addButton', '➕', 'Thêm nốt', 'fn-add') +
        fnButton('undoButton', '↩️', 'Hoàn tác', 'fn-undo') +
        fnButton('removeNote', '🗑️', 'Xóa nốt đang chọn', 'fn-remove') +
        fnButton('clearButton', '🧹', CLEAR_LABEL, 'fn-clear') +
        fnButton('playButton', '▶️', 'Phát giai điệu', 'fn-play') +
        fnButton('stopButton', '⏹️', 'Dừng', 'fn-stop') +
        fnButton('checkButton', '📋', 'Kiểm tra nhịp', 'fn-check') +
        fnButton('saveJson', '💾', 'Lưu giai điệu', 'fn-save') +
        fnButton('saveImage', '⬇️', 'Tải xuống bản nhạc', 'fn-download') +
      '</div>' +
      '<div class="toolbar fn-extra">' +
        '<label class="field">Tốc độ <select data-ref="tempoSelect">' +
          TEMPOS.map(function (t) { return '<option value="' + t.bpm + '">' + t.name + ' (' + t.bpm + ' phách/phút)</option>'; }).join('') +
        '</select></label>' +
        shared.VOLUME_SLIDER_HTML +
        '<button type="button" class="btn btn-ghost" data-ref="openButton">📂 Mở giai điệu đã lưu</button>' +
        '<input type="file" accept=".json,application/json" data-ref="fileInput" hidden>' +
      '</div>' +
      '<p class="audio-alert" data-ref="audioAlert" role="alert" hidden></p>' +
      '<p class="find-feedback" data-ref="message" aria-live="polite">&nbsp;</p>' +
    '</section>' +
    '<div class="idea-box">' +
      '<label class="idea-label">Tên giai điệu ' +
        '<input type="text" data-ref="titleInput" maxlength="' + TITLE_MAX + '" placeholder="Ví dụ: Buổi sáng ở sân trường"></label>' +
      '<label class="idea-label">Giai điệu của em gợi cảm xúc, hình ảnh hay câu chuyện gì?' +
        '<textarea data-ref="ideaInput" rows="3" maxlength="' + IDEA_MAX + '" ' +
        'placeholder="Ví dụ: Giai điệu đi lên giống như em đang leo cầu thang, càng lên càng vui."></textarea></label>' +
      '<p class="idea-tips">Gợi ý: Giai điệu đi lên hay đi xuống? Vui hay buồn? Nhanh hay chậm? Em nghĩ đến ai hoặc nơi nào?</p>' +
    '</div>' +
    '<section class="mz-panel mz-p6" aria-labelledby="mz-h6">' +
      '<h3 class="mz-head" id="mz-h6"><span class="mz-num">6</span>Hướng dẫn sử dụng</h3>' +
      '<ol class="guide-steps">' +
        GUIDE_STEPS.map(function (s, i) {
          return '<li class="guide-step"><span class="guide-num" aria-hidden="true">' + (i + 1) + '</span>' +
            '<span class="guide-text">' + s[0] + ' <strong>' + s[1] + '</strong> <small>' + s[2] + '</small></span></li>';
        }).join('') +
      '</ol>' +
    '</section>' +
    '<p class="honest-note">Phòng sáng tạo không dùng AI: giai điệu do chính em tạo; “Kiểm tra nhịp” chỉ cộng số phách ' +
      'theo quy tắc nhạc lý. Giai điệu chỉ được lưu khi em bấm “Lưu” (tải file về máy này). Không cần ghi họ tên.</p>';

  /*
   * Chia giai điệu thành các ô nhịp theo số phách (nốt đen = 1 phách).
   * Mỗi ô nhịp nhận nốt cho đến khi đủ (hoặc vượt) số phách của nhịp; nốt làm ô nhịp vượt quá
   * vẫn nằm trong ô đó và được đánh dấu để học sinh sửa. Ô cuối có thể còn thiếu phách.
   * Trả về [{ start, end, beats, status: 'full' | 'short' | 'over', missing, extra, overIndex }].
   */
  function splitMeasures(beatsList, meter) {
    var measures = [];
    var current = null;
    beatsList.forEach(function (beats, index) {
      if (!current) current = { start: index, beats: 0 };
      current.beats += beats;
      if (current.beats >= meter) {
        current.end = index + 1;
        current.status = current.beats === meter ? 'full' : 'over';
        current.extra = current.beats - meter;
        current.missing = 0;
        current.overIndex = current.status === 'over' ? index : null;
        measures.push(current);
        current = null;
      }
    });
    if (current) {
      current.end = beatsList.length;
      current.status = 'short';
      current.missing = meter - current.beats;
      current.extra = 0;
      current.overIndex = null;
      measures.push(current);
    }
    return measures;
  }

  function missingHint(missing) {
    return { 1: 'thêm 1 nốt đen', 2: 'thêm 1 nốt trắng hoặc 2 nốt đen', 3: 'thêm 1 nốt trắng và 1 nốt đen' }[missing];
  }

  function measureText(m, meter) {
    if (m.status === 'full') return 'Đủ ' + meter + ' phách';
    if (m.status === 'short') return 'Còn thiếu ' + m.missing + ' phách';
    return 'Vượt quá số phách (thừa ' + m.extra + ')';
  }

  /*
   * Đọc và kiểm tra file giai điệu. Trả về { notes: [{ id, beats }], meter, title, idea, tempo }
   * hoặc ném lỗi có lời nhắn dễ hiểu. File phiên bản 1 (chưa có trường độ) được mở thành nốt đen, nhịp 4/4.
   */
  function parseMelodyFile(text) {
    var data;
    try { data = JSON.parse(text); } catch (err) { throw new Error('File không đúng định dạng JSON.'); }
    if (!data || data.type !== FILE_TYPE) throw new Error('Đây không phải file giai điệu của AI MUSIC LAB.');
    if (!Array.isArray(data.notes) || data.notes.length === 0) throw new Error('File không có nốt nào.');
    if (data.notes.length > MAX_NOTES) throw new Error('Giai điệu có quá ' + MAX_NOTES + ' nốt.');
    data.notes.forEach(function (id) {
      if (!global.MusicNotes.findNote(id)) throw new Error('File có nốt không hợp lệ: ' + String(id).slice(0, 10));
    });
    var durations = data.durations;
    if (durations === undefined) {
      durations = data.notes.map(function () { return 1; });
    } else if (!Array.isArray(durations) || durations.length !== data.notes.length ||
        !durations.every(function (b) { return !!noteValue(b); })) {
      throw new Error('File có hình nốt không hợp lệ.');
    }
    var meter = data.meter === undefined ? OLD_FILE_METER : data.meter;
    if (METERS.indexOf(meter) === -1) throw new Error('File có số chỉ nhịp không hợp lệ.');
    var tempo = TEMPOS.some(function (t) { return t.bpm === data.tempo; }) ? data.tempo : TEMPOS[1].bpm;
    return {
      notes: data.notes.map(function (id, i) { return { id: id, beats: durations[i] }; }),
      meter: meter,
      title: String(data.title || '').slice(0, TITLE_MAX),
      idea: String(data.idea || '').slice(0, IDEA_MAX),
      tempo: tempo
    };
  }

  /*
   * options.audio    – bộ phát âm thanh (mặc định AudioEngine)
   * options.download – hàm (tênFile, blob) để lưu file (mặc định tải về bằng trình duyệt)
   * options.now      – hàm trả về thời điểm hiện tại (mặc định new Date())
   */
  function mount(root, options) {
    options = options || {};
    var audio = options.audio || global.AudioEngine;
    var download = options.download || shared.downloadBlob;
    var log = options.log || global.PracticeLog.current;
    var now = options.now || function () { return new Date(); };
    var SR = global.StaffRenderer;

    root.classList.add('activity');
    root.innerHTML = TEMPLATE;
    var refs = shared.collectRefs(root);
    refs.tempoSelect.value = String(TEMPOS[1].bpm);
    shared.bindVolumeSlider(refs.volume, audio);

    var state = {
      meter: DEFAULT_METER,
      beats: 1,           // hình nốt đang chọn
      pitch: null,        // cao độ đang chọn (id nốt)
      notes: [],          // giai điệu: [{ id, beats }]
      selected: null,     // vị trí nốt đang chọn trong giai điệu
      checked: false,     // đã bấm "Kiểm tra nhịp" (từ đó các ô nhịp luôn hiện đủ / thiếu / thừa)
      playing: false,
      playingIndex: null
    };
    var undoStack = [];
    var staffRows = [];       // [{ staff, start }] – start: vị trí nốt đầu tiên của dòng khuông
    var clearConfirmTimer = null;
    var narrowMedia = global.matchMedia ? global.matchMedia(NARROW_QUERY) : null;
    function perRow() {
      if (options.notesPerRow) return options.notesPerRow;
      return narrowMedia && narrowMedia.matches ? NARROW_NOTES_PER_ROW : NOTES_PER_ROW;
    }

    function setMessage(text, kind) {
      refs.message.className = 'find-feedback' + (kind ? ' ' + kind : '');
      refs.message.textContent = text || ' ';
    }
    function showAudioError(error) {
      refs.audioAlert.textContent = shared.audioErrorMessage(error);
      refs.audioAlert.hidden = false;
    }
    function clearAudioError() { refs.audioAlert.hidden = true; }
    function playPreview(id) {
      audio.playNote(global.MusicNotes.findNote(id).frequency).then(clearAudioError, showAudioError);
    }
    function measures() {
      return splitMeasures(state.notes.map(function (n) { return n.beats; }), state.meter);
    }
    function totalBeats() {
      return state.notes.reduce(function (sum, n) { return sum + n.beats; }, 0);
    }

    // ---------- Hoàn tác ----------
    function snapshot(withText) {
      var shot = { meter: state.meter, notes: state.notes.map(function (n) { return { id: n.id, beats: n.beats }; }) };
      if (withText) { shot.title = refs.titleInput.value; shot.idea = refs.ideaInput.value; }
      undoStack.push(shot);
      if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    }

    function undo() {
      var shot = undoStack.pop();
      if (!shot) return;
      stopPlayback();
      state.meter = shot.meter;
      state.notes = shot.notes;
      state.selected = null;
      if ('title' in shot) { refs.titleInput.value = shot.title; refs.ideaInput.value = shot.idea; }
      setMessage('Đã hoàn tác bước vừa làm.', '');
      render();
    }

    // ---------- Hiển thị ----------
    /*
     * Xếp các ô nhịp vào từng dòng khuông (tối đa perRow() nốt mỗi dòng, không cắt đôi ô nhịp).
     * Vạch nhịp đứng sau mỗi ô nhịp đã đóng; cuối dòng khuông cuối cùng là vạch kết.
     */
    function layoutRows(list) {
      var rows = [{ start: 0, count: 0, measures: [] }];
      list.forEach(function (m) {
        var row = rows[rows.length - 1];
        var size = m.end - m.start;
        if (row.count + size > perRow()) {
          row = { start: m.start, count: 0, measures: [] };
          rows.push(row);
        }
        row.measures.push(m);
        row.count += size;
      });
      return rows;
    }

    function drawMeasureMarks(staff, row, list) {
      var svg = staff.svg;
      var bandTop = SR.STAFF_TOP - 14, bandBottom = SR.BOTTOM_LINE_Y + 14;
      row.measures.forEach(function (m) {
        var number = list.indexOf(m) + 1;
        var x1 = staff.columnX(m.start - row.start) - staff.columnWidth / 2 + 4;
        var x2 = staff.columnX(m.end - 1 - row.start) + staff.columnWidth / 2 - 4;
        var band = SR.svgElement('rect', {
          'class': 'measure-band is-' + m.status, 'data-measure': number,
          x: x1, y: bandTop, width: x2 - x1, height: bandBottom - bandTop, rx: 8
        });
        svg.insertBefore(band, svg.firstChild);
        var tag = SR.svgElement('g', { 'class': 'measure-tag is-' + m.status, 'data-measure': number }, svg);
        var cx = (x1 + x2) / 2;
        SR.svgElement('rect', { 'class': 'measure-tag-box', x: cx - 30, y: 2, width: 60, height: 34, rx: 8 }, tag);
        SR.svgElement('text', { 'class': 'measure-tag-title', x: cx, y: 16, 'text-anchor': 'middle' }, tag).textContent = 'Ô nhịp ' + number;
        SR.svgElement('text', { 'class': 'measure-tag-state', x: cx, y: 31, 'text-anchor': 'middle' }, tag).textContent =
          m.status === 'full' ? 'đủ ✓' : m.status === 'short' ? 'thiếu ' + m.missing : 'thừa ' + m.extra;
        if (m.overIndex !== null) {
          var node = noteNode(m.overIndex);
          if (node) node.classList.add('is-overflow');
        }
      });
    }

    function renderStaff() {
      refs.staffHost.innerHTML = '';
      staffRows = [];
      var list = measures();
      var rows = layoutRows(list);
      rows.forEach(function (row, r) {
        var last = r === rows.length - 1;
        var rowNotes = state.notes.slice(row.start, row.start + row.count).map(function (n, i) {
          var note = global.MusicNotes.findNote(n.id);
          return {
            id: note.id, key: 'm' + (row.start + i), step: note.step, ledgerSteps: note.ledgerSteps,
            label: note.label, symbol: note.symbol, beats: n.beats
          };
        });
        var barlines = [];
        row.measures.forEach(function (m) {
          var isLastMeasure = m === list[list.length - 1];
          if (m.status !== 'short' && !(last && isLastMeasure)) barlines.push(m.end - 1 - row.start);
        });
        var staff = SR.createStaff(refs.staffHost, rowNotes, {
          interactive: false,
          columns: perRow(),
          timeSignature: r === 0 ? state.meter : null,
          timeSignatureSpace: true,
          barlinesAfter: barlines,
          finalBarline: last,
          ariaLabel: 'Giai điệu nhịp ' + state.meter + '/4 trên khuông nhạc, dòng ' + (r + 1)
        });
        staffRows.push({ staff: staff, start: row.start });
        if (last && row.count < perRow() && state.notes.length < MAX_NOTES) {
          var x = staff.columnX(row.count);
          var slot = SR.svgElement('g', { 'class': 'add-slot', 'aria-hidden': 'true' }, staff.svg);
          SR.svgElement('rect', { x: x - 24, y: SR.STAFF_TOP - 16, width: 48, height: SR.BOTTOM_LINE_Y - SR.STAFF_TOP + 32, rx: 10 }, slot);
          SR.svgElement('text', { x: x, y: 214, 'text-anchor': 'middle' }, slot).textContent = '+';
        }
        if (state.checked) drawMeasureMarks(staff, row, list);
      });
      if (!state.notes.length) {
        var hint = document.createElement('p');
        hint.className = 'melody-empty';
        hint.textContent = 'Khuông nhạc đang trống. Chọn hình nốt và cao độ rồi bấm “Thêm nốt”, hoặc chạm vào khuông nhạc.';
        refs.staffHost.appendChild(hint);
      }
    }

    function noteNode(index) {
      for (var r = staffRows.length - 1; r >= 0; r--) {
        if (index >= staffRows[r].start) return staffRows[r].staff.noteElement('m' + index) || null;
      }
      return null;
    }

    function markNotes() {
      state.notes.forEach(function (n, index) {
        var node = noteNode(index);
        if (!node) return;
        node.classList.toggle('is-selected', index === state.selected);
        node.classList.toggle('is-playing', index === state.playingIndex);
      });
      Array.prototype.forEach.call(refs.sequence.querySelectorAll('[data-index]'), function (chip) {
        var index = Number(chip.getAttribute('data-index'));
        chip.classList.toggle('is-selected', index === state.selected);
        chip.classList.toggle('is-playing', index === state.playingIndex);
        chip.setAttribute('aria-pressed', String(index === state.selected));
      });
    }

    function renderSequence() {
      refs.sequence.innerHTML = state.notes.length
        ? state.notes.map(function (n, index) {
            return '<button type="button" class="sequence-chip" data-index="' + index + '">' +
              '<span class="sequence-number">' + (index + 1) + '</span>' +
              escapeHtml(global.MusicNotes.findNote(n.id).label) +
              '<small class="sequence-value">' + noteValue(n.beats).short + '</small></button>';
          }).join('')
        : '<span class="sequence-empty">Chưa có nốt nào.</span>';
    }

    function renderBeatReport() {
      var list = measures();
      refs.beatInfo.textContent = 'Nhịp ' + state.meter + '/4 · ' + state.notes.length + ' nốt · ' +
        totalBeats() + ' phách · ' + list.length + ' ô nhịp';
      refs.meterExample.innerHTML = '<strong>Nhịp ' + state.meter + '/4:</strong> mỗi ô nhịp có ' + state.meter +
        ' phách. Nốt đen = 1 phách, Nốt trắng = 2 phách, Nốt tròn = 4 phách.';
      refs.beatReport.hidden = !state.checked || !list.length;
      refs.beatReport.innerHTML = state.checked ? list.map(function (m, i) {
        return '<li class="is-' + m.status + '" data-measure="' + (i + 1) + '"><strong>Ô nhịp ' + (i + 1) + ':</strong> ' +
          measureText(m, state.meter) + (m.status === 'full' ? ' ✓' : '') + '</li>';
      }).join('') : '';
    }

    function renderPickers() {
      Array.prototype.forEach.call(refs.meterRow.querySelectorAll('[data-meter]'), function (b) {
        b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-meter')) === state.meter));
      });
      Array.prototype.forEach.call(refs.valueRow.querySelectorAll('[data-beats]'), function (b) {
        b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-beats')) === state.beats));
      });
      Array.prototype.forEach.call(refs.palette.querySelectorAll('[data-pitch]'), function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-pitch') === state.pitch));
      });
    }

    function renderControls() {
      var hasNotes = state.notes.length > 0;
      var hasSelection = state.selected !== null;
      refs.addButton.disabled = !state.pitch || state.notes.length >= MAX_NOTES;
      refs.undoButton.disabled = !undoStack.length;
      refs.moveLeft.disabled = !hasSelection || state.selected === 0;
      refs.moveRight.disabled = !hasSelection || state.selected === state.notes.length - 1;
      refs.removeNote.disabled = !hasSelection;
      refs.clearButton.disabled = !hasNotes && !refs.titleInput.value && !refs.ideaInput.value;
      refs.playButton.disabled = !hasNotes || state.playing;
      refs.stopButton.disabled = !state.playing;
      refs.checkButton.disabled = !hasNotes;
      refs.saveJson.disabled = !hasNotes;
      refs.saveImage.disabled = !hasNotes;
      Array.prototype.forEach.call(root.querySelectorAll('[data-pattern]'), function (b) {
        b.disabled = state.notes.length >= MAX_NOTES;
      });
    }

    function render() {
      renderStaff();
      renderSequence();
      renderBeatReport();
      renderPickers();
      markNotes();
      renderControls();
    }

    // ---------- Chỉnh sửa giai điệu ----------
    function stopPlayback() {
      if (!state.playing) return;
      audio.stopAll();
      state.playing = false;
      state.playingIndex = null;
      markNotes();
      renderControls();
    }

    function addNotes(list) {
      stopPlayback();
      var room = MAX_NOTES - state.notes.length;
      if (room <= 0) {
        setMessage('Giai điệu đã đủ ' + MAX_NOTES + ' nốt.', 'is-retry');
        return;
      }
      snapshot();
      state.notes = state.notes.concat(list.slice(0, room));
      state.selected = null;
      setMessage(list.length > room ? 'Chỉ thêm được ' + room + ' nốt vì giai điệu tối đa ' + MAX_NOTES + ' nốt.' : '', list.length > room ? 'is-retry' : '');
      render();
    }

    function addNote(id) {
      if (state.notes.length >= MAX_NOTES) {
        setMessage('Giai điệu đã đủ ' + MAX_NOTES + ' nốt.', 'is-retry');
        return;
      }
      playPreview(id);
      addNotes([{ id: id, beats: state.beats }]);
    }

    function chooseMeter(meter) {
      if (meter === state.meter) return;
      stopPlayback();
      if (state.notes.length) snapshot();
      state.meter = meter;
      setMessage('Nhịp ' + meter + '/4: mỗi ô nhịp có ' + meter + ' phách. Các vạch nhịp đã được xếp lại.', '');
      render();
    }

    function chooseValue(beats) {
      state.beats = beats;
      var value = noteValue(beats);
      if (state.selected !== null) {
        stopPlayback();
        snapshot();
        state.notes[state.selected].beats = beats;
        setMessage('Đã đổi nốt số ' + (state.selected + 1) + ' thành ' + value.name.toLowerCase() + ' (' + beats + ' phách).', '');
        render();
        return;
      }
      setMessage(beats > state.meter
        ? value.name + ' dài ' + beats + ' phách, dài hơn một ô nhịp ' + state.meter + '/4 – ô nhịp sẽ bị thừa phách.'
        : 'Em đã chọn ' + value.name.toLowerCase() + ' (' + beats + ' phách).', beats > state.meter ? 'is-retry' : '');
      renderPickers();
    }

    function choosePitch(id) {
      state.pitch = id;
      playPreview(id);
      var label = global.MusicNotes.findNote(id).label;
      if (state.selected !== null) {
        stopPlayback();
        snapshot();
        state.notes[state.selected].id = id;
        setMessage('Đã đổi nốt số ' + (state.selected + 1) + ' thành ' + label + '.', '');
        render();
        return;
      }
      setMessage('Em đã chọn ' + label + '. Bấm “Thêm nốt” hoặc chạm vào khuông nhạc.', '');
      renderPickers();
      renderControls();
    }

    function move(offset) {
      var i = state.selected;
      var j = i + offset;
      if (i === null || j < 0 || j >= state.notes.length) return;
      stopPlayback();
      snapshot();
      var tmp = state.notes[i];
      state.notes[i] = state.notes[j];
      state.notes[j] = tmp;
      state.selected = j;
      render();
    }

    function removeSelected() {
      if (state.selected === null) return;
      stopPlayback();
      snapshot();
      state.notes.splice(state.selected, 1);
      state.selected = null;
      render();
    }

    function select(index) {
      state.selected = state.selected === index ? null : index;
      if (state.selected !== null) {
        var n = state.notes[index];
        playPreview(n.id);
        setMessage('Đang chọn nốt số ' + (index + 1) + '. Chọn hình nốt hoặc cao độ khác để sửa nốt này.', '');
      } else {
        setMessage('', '');
      }
      markNotes();
      renderControls();
    }

    // Chạm vào chỗ trống trên khuông: thêm nốt ở đúng cao độ được chạm (hình nốt đang chọn).
    function tapStaff(event) {
      var svg = event.target.closest('svg.staff-svg');
      var row = staffRows.filter(function (r) { return r.staff.svg === svg; })[0];
      if (!row) return;
      var pos = row.staff.clientToStaff(event.clientX, event.clientY);
      var note = pos && NOTES.filter(function (n) { return n.step === pos.step; })[0];
      if (!note) {
        setMessage('Hãy chạm vào khuông nhạc, trong khoảng từ Đô₄ (dưới khuông) đến Đô₅.', 'is-retry');
        return;
      }
      state.pitch = note.id;
      addNote(note.id);
    }

    // Bấm "Xóa toàn bộ giai điệu" hai lần để xóa, tránh mất giai điệu do bấm nhầm (vẫn hoàn tác được).
    function clearMelody() {
      if (!state.notes.length && !refs.titleInput.value && !refs.ideaInput.value) return;
      if (!refs.clearButton.classList.contains('is-confirming')) {
        refs.clearButton.classList.add('is-confirming');
        refs.clearButton.querySelector('.fn-label').textContent = 'Bấm lần nữa để xóa hết';
        clearConfirmTimer = setTimeout(resetClearButton, CLEAR_CONFIRM_MS);
        return;
      }
      resetClearButton();
      stopPlayback();
      snapshot(true);
      state.notes = [];
      state.selected = null;
      state.checked = false;
      refs.titleInput.value = '';
      refs.ideaInput.value = '';
      setMessage('Đã xóa giai điệu. Em hãy tạo giai điệu mới nhé! (Bấm “Hoàn tác” nếu lỡ tay.)', '');
      render();
    }

    function resetClearButton() {
      clearTimeout(clearConfirmTimer);
      refs.clearButton.classList.remove('is-confirming');
      refs.clearButton.querySelector('.fn-label').textContent = CLEAR_LABEL;
    }

    // ---------- Kiểm tra nhịp ----------
    function checkBeats() {
      if (!state.notes.length) return;
      state.checked = true;
      render();
      var list = measures();
      var problems = list.map(function (m, i) {
        if (m.status === 'short') return 'Ô nhịp ' + (i + 1) + ' còn thiếu ' + m.missing + ' phách (' + missingHint(m.missing) + ').';
        if (m.status === 'over') return 'Ô nhịp ' + (i + 1) + ' thừa ' + m.extra + ' phách (đổi nốt tô đỏ thành nốt ngắn hơn, hoặc xóa bớt).';
        return null;
      }).filter(Boolean);
      log.record({ kind: 'action', activity: 'sang-tao', action: 'check-beats',
        detail: 'Kiểm tra nhịp ' + state.meter + '/4: ' + (list.length - problems.length) + '/' + list.length + ' ô nhịp đủ phách' });
      if (!problems.length) {
        setMessage('Tuyệt vời! Cả ' + list.length + ' ô nhịp đều đủ ' + state.meter + ' phách.', 'is-good');
        shared.celebrate('sang-tao', 'Các ô nhịp đều đủ phách');
      } else {
        setMessage(problems.join(' '), 'is-retry');
      }
    }

    // ---------- Phát giai điệu ----------
    function play() {
      if (state.playing || !state.notes.length) return;
      var beat = 60 / Number(refs.tempoSelect.value);
      log.record({ kind: 'action', activity: 'sang-tao', action: 'play', detail: 'Phát giai điệu ' + state.notes.length + ' nốt' });
      state.playing = true;
      renderControls();
      audio.playSequence(state.notes.map(function (n) { return global.MusicNotes.findNote(n.id).frequency; }), {
        gap: beat,
        noteDuration: Math.min(0.9, beat * 0.92),
        // Mỗi nốt vang đúng số phách của nó: nốt trắng gấp đôi, nốt tròn gấp bốn nốt đen.
        gaps: state.notes.map(function (n) { return n.beats * beat; }),
        noteDurations: state.notes.map(function (n) { return n.beats === 1 ? Math.min(0.9, beat * 0.92) : n.beats * beat * 0.92; }),
        onStep: function (index) {
          state.playingIndex = index;
          markNotes();
        },
        onDone: function () {
          state.playing = false;
          state.playingIndex = null;
          markNotes();
          renderControls();
        }
      }).then(clearAudioError, function (error) {
        state.playing = false;
        renderControls();
        showAudioError(error);
      });
    }

    // ---------- Lưu và mở ----------
    function melodyData() {
      return {
        app: 'AI MUSIC LAB',
        type: FILE_TYPE,
        version: FILE_VERSION,
        savedAt: now().toISOString(),
        title: refs.titleInput.value.trim(),
        idea: refs.ideaInput.value.trim(),
        tempo: Number(refs.tempoSelect.value),
        meter: state.meter,
        notes: state.notes.map(function (n) { return n.id; }),
        durations: state.notes.map(function (n) { return n.beats; }),
        noteNames: state.notes.map(function (n) { return global.MusicNotes.findNote(n.id).label; })
      };
    }

    function saveJson() {
      if (!state.notes.length) return;
      var data = melodyData();
      try {
        download(shared.fileSlug(data.title, 'giai-dieu') + '.json', new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        setMessage('Đã lưu giai điệu thành file JSON trên máy này.', 'is-good');
        log.record({ kind: 'action', activity: 'sang-tao', action: 'save-json', detail: 'Lưu file giai điệu ' + data.notes.length + ' nốt' });
      } catch (err) {
        setMessage('Chưa lưu được file. Hãy thử lại hoặc dùng trình duyệt khác.', 'is-retry');
      }
    }

    /*
     * Ảnh PNG: ghép các dòng khuông thành một SVG, chép kiểu chữ/màu đang hiển thị vào từng phần tử
     * (vì ảnh không đọc được file CSS), rồi vẽ lên canvas.
     */
    var STYLE_PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity',
      'font-size', 'font-weight', 'font-family', 'display'];

    function inlineStyles(source, target) {
      var computed = getComputedStyle(source);
      target.setAttribute('style', STYLE_PROPS.map(function (p) {
        return p + ':' + computed.getPropertyValue(p);
      }).join(';'));
      for (var i = 0; i < source.children.length; i++) inlineStyles(source.children[i], target.children[i]);
    }

    function buildImageSvg() {
      var NS = 'http://www.w3.org/2000/svg';
      var first = staffRows[0].staff.svg.viewBox.baseVal;
      var rowWidth = first.width, rowHeight = first.height;
      var headerHeight = 70, padding = 20;
      var width = rowWidth + padding * 2;
      var height = headerHeight + staffRows.length * rowHeight + padding;
      var out = document.createElementNS(NS, 'svg');
      out.setAttribute('xmlns', NS);
      out.setAttribute('width', width * 2);
      out.setAttribute('height', height * 2);
      out.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
      var bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('width', width); bg.setAttribute('height', height); bg.setAttribute('fill', '#ffffff');
      out.appendChild(bg);
      var title = document.createElementNS(NS, 'text');
      title.setAttribute('x', padding); title.setAttribute('y', 34);
      title.setAttribute('style', 'font: 800 22px Nunito, Segoe UI, Arial, sans-serif; fill: #5b4fd6');
      title.textContent = refs.titleInput.value.trim() || 'Giai điệu của em';
      out.appendChild(title);
      var sub = document.createElementNS(NS, 'text');
      sub.setAttribute('x', padding); sub.setAttribute('y', 58);
      sub.setAttribute('style', 'font: 600 13px Nunito, Segoe UI, Arial, sans-serif; fill: #5e5a78');
      // Tên từng nốt đã in dưới khuông; dòng phụ chỉ ghi tổng để không tràn ra ngoài ảnh.
      sub.textContent = 'AI MUSIC LAB · Nhịp ' + state.meter + '/4 · ' + state.notes.length + ' nốt · ' +
        totalBeats() + ' phách · ' + measures().length + ' ô nhịp';
      out.appendChild(sub);
      staffRows.forEach(function (row, r) {
        var group = document.createElementNS(NS, 'g');
        group.setAttribute('transform', 'translate(' + padding + ' ' + (headerHeight + r * rowHeight) + ')');
        var clone = row.staff.svg.cloneNode(true);
        inlineStyles(row.staff.svg, clone);
        Array.prototype.forEach.call(clone.querySelectorAll('.add-slot'), function (slot) { slot.remove(); });
        Array.prototype.slice.call(clone.childNodes).forEach(function (child) { group.appendChild(child); });
        out.appendChild(group);
      });
      return { svg: out, width: width * 2, height: height * 2 };
    }

    function saveImage() {
      if (!state.notes.length) return Promise.resolve();
      stopPlayback();
      var built = buildImageSvg();
      var markup = new XMLSerializer().serializeToString(built.svg);
      var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
      return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () {
          var canvas = document.createElement('canvas');
          canvas.width = built.width;
          canvas.height = built.height;
          canvas.getContext('2d').drawImage(img, 0, 0);
          canvas.toBlob(function (blob) {
            if (!blob) { reject(new Error('toBlob')); return; }
            download(shared.fileSlug(refs.titleInput.value.trim(), 'giai-dieu') + '.png', blob);
            resolve();
          }, 'image/png');
        };
        img.onerror = function () { reject(new Error('image')); };
        img.src = url;
      }).then(function () {
        setMessage('Đã tải xuống bản nhạc (ảnh PNG) trên máy này.', 'is-good');
        log.record({ kind: 'action', activity: 'sang-tao', action: 'save-image', detail: 'Lưu ảnh giai điệu ' + state.notes.length + ' nốt' });
      }, function () {
        setMessage('Chưa tạo được ảnh. Em vẫn có thể lưu giai điệu bằng file JSON.', 'is-retry');
      });
    }

    function loadMelodyText(text) {
      try {
        var melody = parseMelodyFile(text);
        stopPlayback();
        snapshot(true);
        state.notes = melody.notes;
        state.meter = melody.meter;
        state.selected = null;
        refs.titleInput.value = melody.title;
        refs.ideaInput.value = melody.idea;
        refs.tempoSelect.value = String(melody.tempo);
        setMessage('Đã mở giai điệu ' + (melody.title ? '“' + melody.title + '”' : '') + ' (' + melody.notes.length + ' nốt, nhịp ' + melody.meter + '/4).', 'is-good');
        render();
        log.record({ kind: 'action', activity: 'sang-tao', action: 'open', detail: 'Mở file giai điệu ' + melody.notes.length + ' nốt' });
        return true;
      } catch (err) {
        setMessage('Không mở được file: ' + err.message, 'is-retry');
        return false;
      }
    }

    // ---------- Sự kiện ----------
    refs.meterRow.addEventListener('click', function (event) {
      var button = event.target.closest('[data-meter]');
      if (button) chooseMeter(Number(button.getAttribute('data-meter')));
    });
    refs.valueRow.addEventListener('click', function (event) {
      var button = event.target.closest('[data-beats]');
      if (button) chooseValue(Number(button.getAttribute('data-beats')));
    });
    refs.palette.addEventListener('click', function (event) {
      var button = event.target.closest('[data-pitch]');
      if (button) choosePitch(button.getAttribute('data-pitch'));
    });
    root.querySelector('.pattern-row').addEventListener('click', function (event) {
      var button = event.target.closest('[data-pattern]');
      if (button) {
        addNotes(PATTERNS[Number(button.getAttribute('data-pattern'))].notes.map(function (id) { return { id: id, beats: 1 }; }));
      }
    });
    refs.sequence.addEventListener('click', function (event) {
      var chip = event.target.closest('[data-index]');
      if (chip) select(Number(chip.getAttribute('data-index')));
    });
    refs.staffHost.addEventListener('click', function (event) {
      var node = event.target.closest('[data-key]');
      if (node) select(Number(node.getAttribute('data-key').slice(1)));
      else tapStaff(event);
    });
    refs.addButton.addEventListener('click', function () { if (state.pitch) addNote(state.pitch); });
    refs.undoButton.addEventListener('click', undo);
    refs.moveLeft.addEventListener('click', function () { move(-1); });
    refs.moveRight.addEventListener('click', function () { move(1); });
    refs.removeNote.addEventListener('click', removeSelected);
    refs.playButton.addEventListener('click', play);
    refs.stopButton.addEventListener('click', stopPlayback);
    refs.checkButton.addEventListener('click', checkBeats);
    refs.tempoSelect.addEventListener('change', stopPlayback);
    refs.clearButton.addEventListener('click', clearMelody);
    refs.titleInput.addEventListener('input', renderControls);
    refs.ideaInput.addEventListener('input', renderControls);
    refs.saveJson.addEventListener('click', saveJson);
    refs.saveImage.addEventListener('click', saveImage);
    refs.openButton.addEventListener('click', function () { refs.fileInput.click(); });
    refs.fileInput.addEventListener('change', function () {
      var file = refs.fileInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () { loadMelodyText(String(reader.result)); };
      reader.onerror = function () { setMessage('Không đọc được file.', 'is-retry'); };
      reader.readAsText(file);
      refs.fileInput.value = '';
    });
    if (narrowMedia && !options.notesPerRow) {
      if (narrowMedia.addEventListener) narrowMedia.addEventListener('change', render);
      else if (narrowMedia.addListener) narrowMedia.addListener(render);
    }

    render();

    return {
      root: root,
      getState: function () { return state; },
      measures: measures,
      melodyData: melodyData,
      loadMelodyText: loadMelodyText,
      saveImage: saveImage,
      noteNode: noteNode,
      staffRows: function () { return staffRows.map(function (r) { return r.staff; }); }
    };
  }

  global.MelodyActivity = {
    mount: mount, MAX_NOTES: MAX_NOTES, parseMelodyFile: parseMelodyFile, splitMeasures: splitMeasures
  };
})(window);
