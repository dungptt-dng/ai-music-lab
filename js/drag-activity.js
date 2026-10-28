/*
 * AI MUSIC LAB – Hoạt động 4: Kéo thả nốt vào khuông nhạc
 *
 * Học sinh kéo thẻ nốt (ví dụ "Pha₄") lên khuông. Ứng dụng đổi điểm thả thành vị trí trên khuông
 * (xem clientToStaff trong js/staff.js) và so sánh với vị trí đúng theo nhạc lý (js/notes.js).
 * Kết quả dựa trên VỊ TRÍ THỰC TẾ nốt được thả, không chỉ dựa trên tên nốt.
 *
 * Hai cách đặt nốt: kéo thả bằng chuột/ngón tay (Pointer Events),
 * hoặc chạm vào thẻ nốt rồi chạm lên khuông (dễ hơn cho học sinh khó thao tác kéo).
 */
(function (global) {
  'use strict';

  var shared = global.AppShared;
  var escapeHtml = shared.escapeHtml;
  var NOTES = global.MusicNotes.NOTES;

  // Chỉ nhận điểm thả trong khoảng này (vị trí); ngoài khoảng coi như thả ra ngoài khuông.
  var MIN_DROP_STEP = -4;
  var MAX_DROP_STEP = 12;
  var DRAG_THRESHOLD_PX = 6;          // di chuyển ít hơn mức này thì coi là chạm (chọn thẻ)
  var WRONG_MARK_MS = 1400;           // nốt đặt sai hiện bao lâu rồi tự biến mất
  var WRONG_TRIES_BEFORE_HINT = 2;
  // Màn hình hẹp: chia khuông thành 2 hàng × 4 cột để khuông to hơn, ngón tay đặt chính xác hơn.
  var NARROW_QUERY = '(max-width: 600px)';

  /*
   * "Bảng khuông": một hoặc nhiều dòng khuông chứa đủ 8 cột. Cột thứ c nằm ở dòng c / số cột mỗi dòng.
   * Mọi dòng khuông có cùng kích thước, nên thả nốt lên dòng nào cũng đo vị trí như nhau.
   */
  function createBoard(host, perRow) {
    host.innerHTML = '';
    var rows = [];
    var rowOfKey = {};
    for (var r = 0; r < Math.ceil(NOTES.length / perRow); r++) {
      rows.push(global.StaffRenderer.createStaff(host, [], {
        columns: perRow,
        ariaLabel: 'Khuông nhạc khóa Sol còn trống để đặt nốt' + (perRow < NOTES.length ? ', dòng ' + (r + 1) : '')
      }));
    }
    function remove(key) {
      if (rowOfKey[key]) rowOfKey[key].removeNote(key);
      delete rowOfKey[key];
    }
    return {
      perRow: perRow,
      rows: rows,
      add: function (note, column, className) {
        remove(note.key);
        var row = rows[Math.floor(column / perRow)];
        rowOfKey[note.key] = row;
        return row.addNote(note, column % perRow, className);
      },
      remove: remove,
      element: function (key) { return rowOfKey[key] ? rowOfKey[key].noteElement(key) : null; },
      // Tìm dòng khuông dưới điểm chạm rồi đổi ra vị trí; null nếu không nằm trên dòng khuông nào.
      locate: function (clientX, clientY) {
        for (var i = 0; i < rows.length; i++) {
          var rect = rows[i].svg.getBoundingClientRect();
          if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
            return rows[i].clientToStaff(clientX, clientY);
          }
        }
        return null;
      },
      pointFor: function (column, step) {
        return rows[Math.floor(column / perRow)].staffToClient(column % perRow, step);
      }
    };
  }

  var TEMPLATE =
    '<div class="activity-head">' +
      '<h2 class="activity-title">Kéo thả nốt vào khuông</h2>' +
    '</div>' +
    '<p class="level-desc">Kéo từng nốt lên đúng vị trí trên khuông nhạc. ' +
      'Hoặc chạm vào một thẻ nốt, rồi chạm lên khuông ở chỗ em muốn đặt.</p>' +
    '<div class="palette" data-ref="palette" aria-label="Các nốt cần đặt"></div>' +
    '<p class="hover-line" data-ref="hoverLine" aria-live="polite">&nbsp;</p>' +
    '<div class="staff-card drop-zone" data-ref="staffHost"></div>' +
    '<p class="find-feedback" data-ref="feedback" aria-live="polite">&nbsp;</p>' +
    '<div class="toolbar">' +
      '<button type="button" class="btn btn-ghost" data-ref="undoButton">↶ Gỡ nốt vừa đặt</button>' +
      '<button type="button" class="btn btn-ghost" data-ref="clearButton">🗑 Xóa bài, làm lại từ đầu</button>' +
      shared.VOLUME_SLIDER_HTML +
    '</div>' +
    '<div data-ref="stats"></div>';

  /*
   * options.audio  – bộ phát âm thanh (mặc định AudioEngine)
   * options.random – hàm ngẫu nhiên (mặc định Math.random)
   */
  function mount(root, options) {
    options = options || {};
    var audio = options.audio || global.AudioEngine;
    var random = options.random || Math.random;
    var log = options.log || global.PracticeLog.current;

    root.classList.add('activity');
    root.innerHTML = TEMPLATE;
    var refs = shared.collectRefs(root);
    shared.bindVolumeSlider(refs.volume, audio);

    var narrowMedia = global.matchMedia ? global.matchMedia(NARROW_QUERY) : null;
    function columnsPerRow() {
      if (options.columnsPerRow) return options.columnsPerRow;
      return narrowMedia && narrowMedia.matches ? NOTES.length / 2 : NOTES.length;
    }
    var board = createBoard(refs.staffHost, columnsPerRow());

    /*
     * CÁCH TÍNH ĐIỂM (chỉ trong lần mở trang này):
     *  - Mỗi lần thả nốt lên khuông là một lần đặt: drops + 1, đúng → correctDrops + 1, sai → wrongDrops + 1.
     *  - firstResult[nốt] ghi kết quả LẦN ĐẶT ĐẦU TIÊN của nốt đó; "đúng ngay lần đầu" = số nốt có firstResult = true.
     *  - Thả ra ngoài khuông không được tính là một lần đặt.
     */
    var state = {
      palette: [],        // id các nốt chưa đặt, theo thứ tự hiện trên bảng
      placed: [],         // id các nốt đã đặt đúng, theo thứ tự cột từ trái sang phải
      selectedId: null,   // thẻ đang được chọn (cách chạm – chạm)
      wrongTries: {},     // số lần đặt sai của từng nốt
      firstResult: {},
      items: {},          // số thứ tự câu trong nhật ký của từng nốt (mỗi nốt trong một bài là một câu)
      hintFor: null,
      stats: { drops: 0, correctDrops: 0, wrongDrops: 0 }
    };
    var wrongMarkTimer = null;
    var drag = null;      // { noteId, pointerId, startX, startY, moved, ghost }

    function nextColumn() { return state.placed.length; }

    // ---------- Hiển thị ----------
    function renderPalette() {
      refs.palette.innerHTML = state.palette.length
        ? state.palette.map(function (id) {
            var note = global.MusicNotes.findNote(id);
            return '<button type="button" class="note-chip' + (state.selectedId === id ? ' is-selected' : '') +
              '" data-chip="' + id + '" aria-pressed="' + (state.selectedId === id) + '">' + escapeHtml(note.label) + '</button>';
          }).join('')
        : '<p class="palette-empty">Em đã đặt hết các nốt.</p>';
    }

    function setFeedback(html, kind) {
      refs.feedback.className = 'find-feedback' + (kind ? ' ' + kind : '');
      refs.feedback.innerHTML = html || '&nbsp;';
    }

    function renderStats() {
      var s = state.stats;
      var firstTry = Object.keys(state.firstResult).filter(function (id) { return state.firstResult[id]; }).length;
      var done = state.placed.length === NOTES.length;
      refs.stats.innerHTML =
        (done ? '<p class="find-feedback is-good" data-ref-done>🎉 Em đã đặt đúng cả 8 nốt! Đúng ngay lần đầu: ' +
          firstTry + '/8 nốt. Số lần đặt chưa đúng: ' + s.wrongDrops + '.</p>' : '') +
        '<dl class="stats">' +
          '<div><dt>Đã đặt đúng</dt><dd data-stat="placed">' + state.placed.length + '/8</dd></div>' +
          '<div><dt>Đúng ngay lần đầu</dt><dd data-stat="firstTry">' + firstTry + '</dd></div>' +
          '<div><dt>Lần đặt chưa đúng</dt><dd data-stat="wrong">' + s.wrongDrops + '</dd></div>' +
          '<div><dt>Tỷ lệ lần đặt đúng</dt><dd data-stat="rate">' + shared.percent(s.correctDrops, s.drops) + '</dd></div>' +
        '</dl>' +
        '<p class="stats-note">Kết quả của lần mở trang này. Xem tổng hợp và xuất file ở mục 📊 Báo cáo.</p>';
      refs.undoButton.disabled = state.placed.length === 0;
    }

    function clearTemporaryMarks() {
      clearTimeout(wrongMarkTimer);
      board.remove('wrong-mark');
      board.remove('preview');
    }

    function clearHint() {
      board.remove('hint');
      state.hintFor = null;
    }

    // ---------- Đặt nốt ----------
    /*
     * KIỂM TRA VỊ TRÍ: nốt được tính là đúng khi vị trí của điểm thả (sau khi hút vào dòng/khe gần nhất)
     * bằng đúng vị trí của nốt theo nhạc lý. Ví dụ Pha₄ phải ở vị trí 1 (khe 1);
     * thả ở vị trí 2 (dòng 2) là sai dù tên thẻ là Pha₄.
     */
    function placeAt(noteId, step) {
      var note = global.MusicNotes.findNote(noteId);
      if (step < MIN_DROP_STEP || step > MAX_DROP_STEP) {
        setFeedback('Hãy thả nốt lên trên khuông nhạc nhé.', 'is-retry');
        return;
      }
      clearTemporaryMarks();
      if (state.hintFor && state.hintFor !== noteId) clearHint();
      state.stats.drops += 1;
      var correct = step === note.step;
      var first = !(noteId in state.firstResult);
      if (first) {
        state.firstResult[noteId] = correct;
        state.items[noteId] = log.nextItem('keo-tha');
      }
      var occupant = global.MusicNotes.noteAtStep(step);
      log.record({
        kind: 'answer', activity: 'keo-tha', mode: 'Kéo thả nốt', item: state.items[noteId], first: first,
        target: noteId, targetText: note.label,
        given: occupant ? occupant.id : null,
        givenText: occupant ? 'chỗ của ' + occupant.label : global.MusicNotes.describePosition(step),
        correct: correct
      });
      audio.playNote(note.frequency).catch(function () { /* không chặn bài tập khi thiếu âm thanh */ });

      if (correct) {
        state.stats.correctDrops += 1;
        clearHint();
        var node = board.add(global.StaffRenderer.noteAtStep(note, step, 'placed-' + noteId), nextColumn(), 'is-placed');
        node.classList.add('is-correct');
        state.placed.push(noteId);
        state.palette = state.palette.filter(function (id) { return id !== noteId; });
        state.selectedId = null;
        setFeedback('✓ ' + shared.praise(random) + ' <strong>' + escapeHtml(note.label) + '</strong> nằm ở ' +
          escapeHtml(note.position) + '.', 'is-good');
      } else {
        state.stats.wrongDrops += 1;
        state.wrongTries[noteId] = (state.wrongTries[noteId] || 0) + 1;
        board.add(global.StaffRenderer.noteAtStep(note, step, 'wrong-mark'), nextColumn(), 'is-wrong-mark');
        wrongMarkTimer = setTimeout(function () { board.remove('wrong-mark'); }, WRONG_MARK_MS);
        var message = '↻ Em đặt <strong>' + escapeHtml(note.label) + '</strong> ở ' +
          escapeHtml(global.MusicNotes.describePosition(step)) +
          (occupant ? ' – đó là chỗ của ' + escapeHtml(occupant.label) : '') + '. ' +
          escapeHtml(note.label) + ' phải nằm <strong>' + (note.step > step ? 'cao hơn' : 'thấp hơn') + '</strong> chỗ đó.';
        if (state.wrongTries[noteId] >= WRONG_TRIES_BEFORE_HINT) {
          clearHint();
          board.add(global.StaffRenderer.noteAtStep(note, note.step, 'hint'), nextColumn(), 'is-ghost');
          state.hintFor = noteId;
          message += ' Gợi ý: ' + escapeHtml(note.label) + ' nằm ở ' + escapeHtml(note.position) + ' (chỗ có nốt mờ).';
        }
        setFeedback(message, 'is-retry');
      }
      renderPalette();
      renderStats();
      if (correct && state.placed.length === NOTES.length) shared.celebrate('keo-tha', 'Đặt đúng cả 8 nốt');
    }

    function undoLast() {
      if (!state.placed.length) return;
      clearTemporaryMarks();
      var noteId = state.placed.pop();
      board.remove('placed-' + noteId);
      state.palette.push(noteId);
      setFeedback('Đã gỡ ' + escapeHtml(global.MusicNotes.findNote(noteId).label) + ' về bảng nốt.', '');
      renderPalette();
      renderStats();
    }

    function resetExercise() {
      clearTemporaryMarks();
      clearHint();
      state.placed.forEach(function (id) { board.remove('placed-' + id); });
      state.palette = shared.shuffle(NOTES.map(function (n) { return n.id; }), random);
      state.placed = [];
      state.selectedId = null;
      state.wrongTries = {};
      state.firstResult = {};
      state.items = {};
      state.stats ={ drops: 0, correctDrops: 0, wrongDrops: 0 };
      setFeedback('', '');
      renderPalette();
      renderStats();
    }

    // ---------- Kéo thả bằng Pointer Events (chuột, bút, ngón tay) ----------
    function showPreview(clientX, clientY) {
      var pos = board.locate(clientX, clientY);
      board.remove('preview');
      if (!pos || !pos.inside || pos.step < MIN_DROP_STEP || pos.step > MAX_DROP_STEP) {
        refs.hoverLine.innerHTML = '&nbsp;';
        return;
      }
      var note = global.MusicNotes.findNote(drag.noteId);
      board.add(global.StaffRenderer.noteAtStep(note, pos.step, 'preview'), nextColumn(), 'is-preview');
      refs.hoverLine.textContent = 'Thả ở: ' + global.MusicNotes.describePosition(pos.step);
    }

    function onPointerMove(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      var dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
      if (!drag.moved && Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD_PX) return;
      if (!drag.moved) {
        drag.moved = true;
        drag.ghost = document.createElement('div');
        drag.ghost.className = 'drag-ghost';
        drag.ghost.textContent = global.MusicNotes.findNote(drag.noteId).label;
        document.body.appendChild(drag.ghost);
      }
      drag.ghost.style.left = event.clientX + 'px';
      drag.ghost.style.top = event.clientY + 'px';
      showPreview(event.clientX, event.clientY);
      event.preventDefault();
    }

    function endDrag(event, cancelled) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      var current = drag;
      drag = null;
      global.removeEventListener('pointermove', onPointerMove);
      global.removeEventListener('pointerup', onPointerUp);
      global.removeEventListener('pointercancel', onPointerCancel);
      if (current.ghost) current.ghost.remove();
      board.remove('preview');
      refs.hoverLine.innerHTML = '&nbsp;';
      if (cancelled) return;

      if (!current.moved) {
        // Chạm (không kéo): chọn / bỏ chọn thẻ nốt.
        state.selectedId = state.selectedId === current.noteId ? null : current.noteId;
        renderPalette();
        if (state.selectedId) {
          setFeedback('Em đã chọn ' + escapeHtml(global.MusicNotes.findNote(state.selectedId).label) +
            '. Chạm lên khuông nhạc ở chỗ em muốn đặt.', '');
        }
        return;
      }
      var pos = board.locate(event.clientX, event.clientY);
      if (!pos || !pos.inside) {
        setFeedback('Hãy thả nốt lên trên khuông nhạc nhé.', 'is-retry');
        return;
      }
      placeAt(current.noteId, pos.step);
    }

    function onPointerUp(event) { endDrag(event, false); }
    function onPointerCancel(event) { endDrag(event, true); }

    refs.palette.addEventListener('pointerdown', function (event) {
      var chip = event.target.closest('[data-chip]');
      if (!chip || drag || event.button > 0) return;
      drag = {
        noteId: chip.getAttribute('data-chip'),
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        ghost: null
      };
      global.addEventListener('pointermove', onPointerMove);
      global.addEventListener('pointerup', onPointerUp);
      global.addEventListener('pointercancel', onPointerCancel);
      event.preventDefault();
    });

    // Bàn phím: Enter/Space trên thẻ nốt để chọn, sau đó chạm/nhấp lên khuông.
    refs.palette.addEventListener('keydown', function (event) {
      var chip = event.target.closest('[data-chip]');
      if (!chip || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      var id = chip.getAttribute('data-chip');
      state.selectedId = state.selectedId === id ? null : id;
      renderPalette();
      var again = refs.palette.querySelector('[data-chip="' + id + '"]');
      if (again) again.focus();
    });

    // Cách chạm – chạm: đã chọn thẻ thì chạm lên khuông để đặt.
    refs.staffHost.addEventListener('click', function (event) {
      if (!state.selectedId) return;
      var pos = board.locate(event.clientX, event.clientY);
      if (pos) placeAt(state.selectedId, pos.step);
    });

    refs.undoButton.addEventListener('click', undoLast);
    refs.clearButton.addEventListener('click', resetExercise);

    // Xoay máy / đổi cỡ cửa sổ qua ngưỡng màn hình hẹp: vẽ lại bảng khuông và giữ các nốt đã đặt.
    function rebuildBoard() {
      if (board.perRow === columnsPerRow()) return;
      clearTemporaryMarks();
      clearHint();
      board = createBoard(refs.staffHost, columnsPerRow());
      state.placed.forEach(function (id, column) {
        var note = global.MusicNotes.findNote(id);
        board.add(global.StaffRenderer.noteAtStep(note, note.step, 'placed-' + id), column, 'is-placed');
      });
    }
    if (narrowMedia && !options.columnsPerRow) {
      if (narrowMedia.addEventListener) narrowMedia.addEventListener('change', rebuildBoard);
      else if (narrowMedia.addListener) narrowMedia.addListener(rebuildBoard);
    }

    resetExercise();

    return {
      root: root,
      board: function () { return board; },
      getState: function () { return state; },
      reset: resetExercise
    };
  }

  global.DragActivity = { mount: mount };
})(window);
