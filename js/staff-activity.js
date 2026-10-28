/*
 * AI MUSIC LAB – Hoạt động 1: Khuông nhạc tương tác (nhận biết 8 vị trí nốt)
 *
 * Hai chế độ:
 *  - Khám phá: chạm vào nốt → nghe âm thanh, xem tên nốt, ký hiệu, tần số, vị trí.
 *  - Tìm nốt:  ứng dụng nêu tên một nốt, học sinh chạm vào đúng nốt đó trên khuông
 *              (tên nốt bị ẩn để học sinh tự đọc).
 */
(function (global) {
  'use strict';

  var shared = global.AppShared;
  var escapeHtml = shared.escapeHtml;
  var NEXT_QUESTION_DELAY_MS = 1400;
  var WRONG_TRIES_BEFORE_HINT = 2;

  var TEMPLATE =
    '<div class="activity-head">' +
      '<h2 class="activity-title">Khuông nhạc tương tác</h2>' +
      '<div class="mode-switch" role="tablist" aria-label="Chọn chế độ">' +
        '<button type="button" role="tab" data-mode="explore" aria-selected="true">Khám phá</button>' +
        '<button type="button" role="tab" data-mode="find" aria-selected="false">Tìm nốt</button>' +
      '</div>' +
    '</div>' +
    '<div class="toolbar">' +
      '<label class="switch">' +
        '<input type="checkbox" data-ref="labelsToggle" checked>' +
        '<span class="switch-track" aria-hidden="true"></span>' +
        '<span class="switch-text">Hiện tên nốt</span>' +
      '</label>' +
      '<button type="button" class="btn btn-secondary" data-ref="scaleButton">▶ Nghe cả 8 nốt</button>' +
      shared.VOLUME_SLIDER_HTML +
    '</div>' +
    '<p class="audio-alert" data-ref="audioAlert" role="alert" hidden></p>' +
    '<div class="staff-card" data-ref="staffHost"></div>' +
    '<div class="panel" data-ref="panel" aria-live="polite"></div>';

  /*
   * Gắn hoạt động vào phần tử root.
   * options.audio  – bộ phát âm thanh (mặc định AudioEngine; trang kiểm thử truyền bản giả lập)
   * options.random – hàm ngẫu nhiên (mặc định Math.random)
   * options.log    – nhật ký luyện tập cho báo cáo (mặc định PracticeLog.current)
   */
  function mount(root, options) {
    options = options || {};
    var audio = options.audio || global.AudioEngine;
    var random = options.random || Math.random;
    var log = options.log || global.PracticeLog.current;
    var notes = global.MusicNotes.NOTES;

    root.classList.add('activity');
    root.innerHTML = TEMPLATE;

    var refs = shared.collectRefs(root);
    var modeButtons = root.querySelectorAll('[data-mode]');

    var staff = global.StaffRenderer.createStaff(refs.staffHost, notes);

    var state = {
      mode: 'explore',
      labelsVisible: true,
      selectedId: null,
      scalePlaying: false,
      // Chế độ Tìm nốt
      targetId: null,
      item: null,         // số thứ tự câu trong nhật ký, cấp khi học sinh chạm lần đầu
      wrongTriesThisQuestion: 0,
      locked: false,
      /*
       * CÁCH TÍNH ĐIỂM trên màn hình hoạt động (trong lần mở trang này; báo cáo lấy từ nhật ký luyện tập):
       *  - Mỗi câu kết thúc khi học sinh chạm đúng nốt được yêu cầu → completed + 1.
       *  - Nếu chạm đúng ngay lần đầu → firstTryCorrect + 1.
       *  - Mỗi lần chạm sai → wrongTaps + 1 (câu đó không được tính "đúng ngay lần đầu").
       *  - Tỷ lệ = firstTryCorrect / completed. Câu bị bỏ qua bằng "Đổi câu khác" không được tính.
       */
      stats: { completed: 0, firstTryCorrect: 0, wrongTaps: 0 }
    };
    var nextQuestionTimer = null;

    shared.bindVolumeSlider(refs.volume, audio);

    // ---------- Âm thanh ----------
    function showAudioError(error) {
      refs.audioAlert.textContent = shared.audioErrorMessage(error);
      refs.audioAlert.hidden = false;
    }

    function clearAudioError() {
      refs.audioAlert.hidden = true;
    }

    function playNoteSound(note) {
      audio.playNote(note.frequency).then(clearAudioError, showAudioError);
    }

    function stopScale() {
      audio.stopAll();
      state.scalePlaying = false;
      refs.scaleButton.textContent = '▶ Nghe cả 8 nốt';
      staff.clearMarks(['is-playing']);
    }

    function playScale() {
      if (state.scalePlaying) { stopScale(); return; }
      state.scalePlaying = true;
      refs.scaleButton.textContent = '■ Dừng';
      audio.playSequence(notes.map(function (n) { return n.frequency; }), {
        onStep: function (index) {
          staff.clearMarks(['is-playing']);
          staff.noteElement(notes[index].id).classList.add('is-playing');
        },
        onDone: function () { stopScale(); }
      }).then(clearAudioError, function (error) {
        stopScale();
        showAudioError(error);
      });
    }

    // ---------- Hiển thị tên nốt ----------
    function applyLabelVisibility() {
      // Ở chế độ Tìm nốt luôn ẩn tên nốt để học sinh tự đọc vị trí.
      var visible = state.mode === 'explore' && state.labelsVisible;
      staff.setLabelsVisible(visible);
      refs.labelsToggle.checked = visible;
      refs.labelsToggle.disabled = state.mode !== 'explore';
    }

    // ---------- Chế độ Khám phá ----------
    function renderExplorePanel() {
      var note = state.selectedId ? global.MusicNotes.findNote(state.selectedId) : null;
      if (!note) {
        refs.panel.innerHTML = '<p class="panel-hint">Chạm vào một nốt trên khuông nhạc để nghe âm thanh và xem tên nốt.</p>';
        return;
      }
      refs.panel.innerHTML =
        '<div class="note-card" data-ref-card="' + note.id + '">' +
          '<div class="note-card-name">' + escapeHtml(note.label) + '</div>' +
          '<dl class="note-facts">' +
            '<div><dt>Ký hiệu quốc tế</dt><dd data-fact="symbol">' + note.symbol + '</dd></div>' +
            '<div><dt>Tần số</dt><dd data-fact="frequency">' + global.MusicNotes.formatFrequency(note.frequency) + '</dd></div>' +
            '<div class="wide"><dt>Vị trí trên khuông</dt><dd data-fact="position">' + escapeHtml(note.position) + '</dd></div>' +
          '</dl>' +
        '</div>';
    }

    function selectNoteForExplore(note) {
      state.selectedId = note.id;
      staff.clearMarks(['is-selected']);
      staff.noteElement(note.id).classList.add('is-selected');
      staff.flash(note.id, 'is-pulse');
      renderExplorePanel();
      log.record({ kind: 'action', activity: 'khuong-nhac', action: 'explore', target: note.id, detail: 'Khám phá nốt ' + note.label });
    }

    // ---------- Chế độ Tìm nốt ----------
    function pickTarget() {
      var candidates = notes.filter(function (n) { return n.id !== state.targetId; });
      return candidates[Math.floor(random() * candidates.length)];
    }

    function renderFindPanel(feedbackHtml, feedbackKind) {
      var target = global.MusicNotes.findNote(state.targetId);
      var s = state.stats;
      var rate = s.completed > 0 ? Math.round((s.firstTryCorrect / s.completed) * 100) + '%' : '—';
      refs.panel.innerHTML =
        '<p class="find-question">Hãy chạm vào nốt <strong data-ref-target>' + escapeHtml(target.label) + '</strong></p>' +
        '<p class="find-feedback ' + (feedbackKind || '') + '" data-ref-feedback>' + (feedbackHtml || '&nbsp;') + '</p>' +
        '<div class="find-footer">' +
          '<dl class="stats">' +
            '<div><dt>Câu đã làm</dt><dd data-stat="completed">' + s.completed + '</dd></div>' +
            '<div><dt>Đúng ngay lần đầu</dt><dd data-stat="firstTryCorrect">' + s.firstTryCorrect + '</dd></div>' +
            '<div><dt>Lần chạm sai</dt><dd data-stat="wrongTaps">' + s.wrongTaps + '</dd></div>' +
            '<div><dt>Tỷ lệ đúng lần đầu</dt><dd data-stat="rate">' + rate + '</dd></div>' +
          '</dl>' +
          '<button type="button" class="btn btn-ghost" data-action="skip">Đổi câu khác</button>' +
        '</div>' +
        '<p class="stats-note">Kết quả của lần mở trang này. Xem tổng hợp và xuất file ở mục 📊 Báo cáo.</p>';
    }

    function newQuestion() {
      clearTimeout(nextQuestionTimer);
      state.locked = false;
      state.wrongTriesThisQuestion = 0;
      state.item = null;
      state.targetId = pickTarget().id;
      staff.clearMarks(['is-correct', 'is-wrong', 'is-hint', 'is-selected', 'show-label']);
      renderFindPanel();
    }

    function answerFind(note) {
      if (state.locked) return;
      var target = global.MusicNotes.findNote(state.targetId);
      if (state.item === null) state.item = log.nextItem('khuong-nhac');
      log.record({
        kind: 'answer', activity: 'khuong-nhac', mode: 'Tìm nốt', item: state.item,
        first: state.wrongTriesThisQuestion === 0,
        target: target.id, targetText: target.label, given: note.id, givenText: note.label,
        correct: note.id === target.id
      });

      if (note.id === target.id) {
        state.locked = true;
        state.stats.completed += 1;
        if (state.wrongTriesThisQuestion === 0) state.stats.firstTryCorrect += 1;
        staff.clearMarks(['is-wrong', 'is-hint']);
        staff.noteElement(note.id).classList.add('show-label');
        staff.flash(note.id, 'is-correct');
        burstStars(staff.noteElement(note.id));
        renderFindPanel('✓ ' + shared.praise(random) +' Đây là nốt <strong>' + escapeHtml(note.label) + '</strong> – ' +
          escapeHtml(note.position) + '.', 'is-good');
        if (state.stats.completed % 5 === 0) shared.celebrate('khuong-nhac', 'Tìm đúng ' + state.stats.completed + ' nốt');
        nextQuestionTimer = setTimeout(newQuestion, NEXT_QUESTION_DELAY_MS);
        return;
      }

      state.wrongTriesThisQuestion += 1;
      state.stats.wrongTaps += 1;
      staff.flash(note.id, 'is-wrong');
      var message = '↻ Chưa đúng. Nốt em vừa chạm là <strong>' + escapeHtml(note.label) + '</strong>. Thử lại nhé!';
      if (state.wrongTriesThisQuestion >= WRONG_TRIES_BEFORE_HINT) {
        staff.noteElement(target.id).classList.add('is-hint', 'show-label');
        message = '↻ Nốt em vừa chạm là <strong>' + escapeHtml(note.label) + '</strong>. ' +
          'Nốt <strong>' + escapeHtml(target.label) + '</strong> nằm ở ' + escapeHtml(target.position) +
          ' (đang được tô sáng). Em chạm vào đó nhé!';
      }
      renderFindPanel(message, 'is-retry');
    }

    // Hiệu ứng ngôi sao nhỏ bay ra quanh nốt chọn đúng.
    function burstStars(noteNode) {
      var head = noteNode.querySelector('.note-head');
      var hostRect = refs.staffHost.getBoundingClientRect();
      var headRect = head.getBoundingClientRect();
      var centerX = headRect.left + headRect.width / 2 - hostRect.left;
      var centerY = headRect.top + headRect.height / 2 - hostRect.top;
      for (var i = 0; i < 8; i++) {
        var star = document.createElement('span');
        var angle = (Math.PI * 2 * i) / 8;
        star.className = 'star';
        star.textContent = '★';
        star.style.left = centerX + 'px';
        star.style.top = centerY + 'px';
        star.style.setProperty('--dx', Math.round(Math.cos(angle) * 46) + 'px');
        star.style.setProperty('--dy', Math.round(Math.sin(angle) * 46) + 'px');
        refs.staffHost.appendChild(star);
        setTimeout(star.remove.bind(star), 900);
      }
    }

    // ---------- Chuyển chế độ ----------
    function setMode(mode) {
      if (state.scalePlaying) stopScale();
      clearTimeout(nextQuestionTimer);
      state.mode = mode;
      Array.prototype.forEach.call(modeButtons, function (button) {
        button.setAttribute('aria-selected', String(button.getAttribute('data-mode') === mode));
      });
      root.setAttribute('data-mode', mode);
      refs.scaleButton.hidden = mode !== 'explore';
      staff.clearMarks(['is-selected', 'is-correct', 'is-wrong', 'is-hint', 'show-label', 'is-pulse']);
      applyLabelVisibility();
      if (mode === 'explore') {
        state.selectedId = null;
        renderExplorePanel();
      } else {
        newQuestion();
      }
    }

    // ---------- Sự kiện ----------
    function activateNoteNode(node) {
      var note = global.MusicNotes.findNote(node.getAttribute('data-note'));
      if (!note) return;
      if (state.scalePlaying) stopScale();
      playNoteSound(note);
      if (state.mode === 'explore') selectNoteForExplore(note);
      else answerFind(note);
    }

    staff.svg.addEventListener('click', function (event) {
      var node = event.target.closest('.note');
      if (node) activateNoteNode(node);
    });
    staff.svg.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      var node = event.target.closest('.note');
      if (!node) return;
      event.preventDefault();
      activateNoteNode(node);
    });

    Array.prototype.forEach.call(modeButtons, function (button) {
      button.addEventListener('click', function () {
        var mode = button.getAttribute('data-mode');
        if (mode !== state.mode) setMode(mode);
      });
    });

    refs.labelsToggle.addEventListener('change', function () {
      state.labelsVisible = refs.labelsToggle.checked;
      applyLabelVisibility();
    });

    refs.scaleButton.addEventListener('click', playScale);

    refs.panel.addEventListener('click', function (event) {
      if (event.target.closest('[data-action="skip"]')) newQuestion();
    });

    setMode('explore');

    return {
      root: root,
      staff: staff,
      setMode: setMode,
      getState: function () { return state; }
    };
  }

  global.StaffActivity = { mount: mount };
})(window);
