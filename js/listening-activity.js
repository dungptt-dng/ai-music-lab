/*
 * AI MUSIC LAB – Hoạt động 2: Nghe cao độ và ghép tên nốt
 *
 * Đây là bài tập nhận biết cao độ từ ÂM THANH TỔNG HỢP; ứng dụng không thu âm,
 * không nhận diện giọng hát của học sinh.
 *
 * Vì phần lớn học sinh (và người lớn) không có "cảm âm tuyệt đối", mặc định
 * mỗi câu phát âm mốc Đô₄ trước rồi mới phát âm cần đoán, để học sinh so sánh
 * khoảng cách cao độ (cảm âm tương đối). Mức độ tăng dần từ 3 → 5 → 8 nốt.
 */
(function (global) {
  'use strict';

  var shared = global.AppShared;
  var escapeHtml = shared.escapeHtml;
  var NOTES = global.MusicNotes.NOTES;
  var REFERENCE_NOTE = global.MusicNotes.findNote('C4');

  var LEVELS = {
    easy:   { name: 'Dễ',   noteIds: ['C4', 'E4', 'G4'],             description: '3 nốt cách xa nhau: Đô₄ – Mi₄ – Sol₄' },
    medium: { name: 'Vừa',  noteIds: ['C4', 'D4', 'E4', 'F4', 'G4'], description: '5 nốt liền nhau: Đô₄ → Sol₄' },
    hard:   { name: 'Khó',  noteIds: NOTES.map(function (n) { return n.id; }), description: 'Cả 8 nốt: Đô₄ → Đô₅' }
  };
  var LEVEL_ORDER = ['easy', 'medium', 'hard'];
  var CHALLENGE_LENGTHS = [5, 10, 15];
  // Khoảng cách giữa âm mốc và âm cần đoán (giây).
  var REFERENCE_GAP = 1.1;
  // Một nốt bị nhầm từ ngần này lần trở lên trong một lượt thử thách mới được gợi ý "cần luyện thêm".
  var MISSES_TO_SUGGEST_PRACTICE = 2;

  var TEMPLATE =
    '<div class="activity-head">' +
      '<h2 class="activity-title">Nghe cao độ</h2>' +
      '<div class="mode-switch" role="tablist" aria-label="Chọn chế độ">' +
        '<button type="button" role="tab" data-mode="practice" aria-selected="true">Luyện tập</button>' +
        '<button type="button" role="tab" data-mode="challenge" aria-selected="false">Thử thách</button>' +
      '</div>' +
    '</div>' +
    '<div class="toolbar">' +
      '<div class="level-switch" role="radiogroup" aria-label="Mức độ">' +
        LEVEL_ORDER.map(function (key) {
          return '<button type="button" role="radio" data-level="' + key + '" aria-checked="false">' + LEVELS[key].name + '</button>';
        }).join('') +
      '</div>' +
      '<label class="field" data-ref="lengthField">Số câu ' +
        '<select data-ref="lengthSelect">' +
          CHALLENGE_LENGTHS.map(function (n) { return '<option value="' + n + '">' + n + '</option>'; }).join('') +
        '</select>' +
      '</label>' +
      '<label class="check"><input type="checkbox" data-ref="referenceToggle" checked> Nghe âm mốc Đô₄ trước</label>' +
      shared.VOLUME_SLIDER_HTML +
    '</div>' +
    '<p class="level-desc" data-ref="levelDesc"></p>' +
    '<p class="audio-alert" data-ref="audioAlert" role="alert" hidden></p>' +
    '<div class="listen-stage" data-ref="stage" aria-live="polite"></div>' +
    '<p class="honest-note">Bài tập nhận biết cao độ từ âm thanh tổng hợp. Ứng dụng không thu âm và không nhận diện giọng hát.</p>';

  /*
   * Gắn hoạt động vào root.
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
    var modeButtons = root.querySelectorAll('[data-mode]');
    var levelButtons = root.querySelectorAll('[data-level]');
    refs.lengthSelect.value = '10';
    shared.bindVolumeSlider(refs.volume, audio);

    var state = {
      mode: 'practice',
      levelKey: 'easy',
      useReference: true,
      challengeLength: 10,
      question: null,     // { targetId, played, chosenId }
      /*
       * CÁCH TÍNH ĐIỂM: mỗi câu chỉ tính LẦN TRẢ LỜI ĐẦU TIÊN (sau đó đáp án được hiện ra).
       *  - Luyện tập: practice.answered / practice.correct, đếm từ khi chọn mức độ hiện tại.
       *  - Thử thách: round.correct trên round.total câu; mỗi câu sai được ghi lại (âm thanh – nốt em chọn).
       *  - Tỷ lệ đúng = số câu đúng / số câu đã trả lời.
       */
      practice: { answered: 0, correct: 0 },
      round: null         // { total, number, correct, mistakes: [{ number, targetId, chosenId }], finished }
    };

    function levelNotes() {
      return LEVELS[state.levelKey].noteIds.map(global.MusicNotes.findNote);
    }

    // ---------- Âm thanh ----------
    function showAudioError(error) {
      refs.audioAlert.textContent = shared.audioErrorMessage(error);
      refs.audioAlert.hidden = false;
    }
    function clearAudioError() { refs.audioAlert.hidden = true; }

    function playQuestionSound() {
      var target = global.MusicNotes.findNote(state.question.targetId);
      var frequencies = state.useReference ? [REFERENCE_NOTE.frequency, target.frequency] : [target.frequency];
      audio.playSequence(frequencies, { gap: REFERENCE_GAP, noteDuration: 0.95 }).then(function () {
        clearAudioError();
        if (state.question && !state.question.played) {
          state.question.played = true;
          renderStage();
        }
      }, showAudioError);
    }

    function playSingle(note) {
      audio.playNote(note.frequency).then(clearAudioError, showAudioError);
    }

    // ---------- Câu hỏi ----------
    function pickTarget() {
      var notes = levelNotes();
      var previous = state.question && state.question.targetId;
      var candidates = notes.filter(function (n) { return n.id !== previous; });
      return shared.pick(candidates, random).id;
    }

    function newQuestion(targetId) {
      audio.stopAll();
      state.question = { targetId: targetId || pickTarget(), played: false, chosenId: null };
      renderStage();
    }

    function answer(noteId) {
      var q = state.question;
      if (!q || !q.played || q.chosenId) return;
      q.chosenId = noteId;
      q.praise = shared.praise(random);
      var correct = noteId === q.targetId;
      log.record({
        kind: 'answer', activity: 'nghe-cao-do',
        mode: (state.mode === 'practice' ? 'Luyện tập' : 'Thử thách') + ' · mức ' + LEVELS[state.levelKey].name +
          (state.useReference ? '' : ' · không âm mốc'),
        item: log.nextItem('nghe-cao-do'), first: true,
        target: q.targetId, targetText: global.MusicNotes.findNote(q.targetId).label,
        given: noteId, givenText: global.MusicNotes.findNote(noteId).label, correct: correct
      });
      if (state.mode === 'practice') {
        state.practice.answered += 1;
        if (correct) state.practice.correct += 1;
      } else {
        if (correct) state.round.correct += 1;
        else state.round.mistakes.push({ number: state.round.number, targetId: q.targetId, chosenId: noteId });
      }
      renderStage();
    }

    function next() {
      if (state.mode === 'challenge') {
        if (state.round.number >= state.round.total) {
          state.round.finished = true;
          state.question = null;
          renderStage();
          shared.celebrate('nghe-cao-do', 'Xong lượt thử thách ' + state.round.total + ' câu');
          return;
        }
        state.round.number += 1;
      }
      newQuestion();
    }

    function startSession() {
      audio.stopAll();
      state.practice = { answered: 0, correct: 0 };
      state.round = state.mode === 'challenge'
        ? { total: state.challengeLength, number: 1, correct: 0, mistakes: [], finished: false }
        : null;
      state.question = null;
      newQuestion();
    }

    // ---------- Hiển thị ----------
    function renderSettings() {
      Array.prototype.forEach.call(modeButtons, function (b) {
        b.setAttribute('aria-selected', String(b.getAttribute('data-mode') === state.mode));
      });
      Array.prototype.forEach.call(levelButtons, function (b) {
        b.setAttribute('aria-checked', String(b.getAttribute('data-level') === state.levelKey));
      });
      refs.lengthField.hidden = state.mode !== 'challenge';
      refs.levelDesc.textContent = 'Mức ' + LEVELS[state.levelKey].name + ': ' + LEVELS[state.levelKey].description + '.' +
        (state.useReference ? ' Mỗi câu phát âm mốc Đô₄ trước, rồi đến âm cần đoán.' : ' Không có âm mốc – chỉ phát âm cần đoán.');
    }

    function choiceButtonsHtml(q) {
      return levelNotes().map(function (note) {
        var classes = ['choice'];
        if (q.chosenId) {
          if (note.id === q.targetId) classes.push('is-correct');
          else if (note.id === q.chosenId) classes.push('is-wrong');
        }
        return '<button type="button" class="' + classes.join(' ') + '" data-answer="' + note.id + '"' +
          (!q.played || q.chosenId ? ' disabled' : '') + '>' +
          '<span class="choice-name">' + escapeHtml(note.label) + '</span>' +
          '<span class="choice-symbol">' + note.symbol + '</span>' +
        '</button>';
      }).join('');
    }

    function feedbackHtml(q) {
      if (!q.chosenId) return '';
      var target = global.MusicNotes.findNote(q.targetId);
      var chosen = global.MusicNotes.findNote(q.chosenId);
      var isLast = state.mode === 'challenge' && state.round.number >= state.round.total;
      var message = q.chosenId === q.targetId
        ? '<p class="find-feedback is-good">✓ ' + q.praise + ' Âm thanh vừa nghe là <strong>' + escapeHtml(target.label) + '</strong>.</p>'
        : '<p class="find-feedback is-retry">↻ Chưa đúng. Âm thanh vừa nghe là <strong>' + escapeHtml(target.label) +
          '</strong>, em chọn <strong>' + escapeHtml(chosen.label) + '</strong>. Hãy nghe lại để so sánh nhé!</p>';
      return message +
        '<div class="answer-detail">' +
          '<div class="mini-staff" data-ref-mini></div>' +
          '<div class="answer-actions">' +
            '<button type="button" class="btn btn-ghost" data-action="play-target">🔁 Nghe ' + escapeHtml(target.label) + '</button>' +
            (q.chosenId !== q.targetId
              ? '<button type="button" class="btn btn-ghost" data-action="play-chosen">Nghe ' + escapeHtml(chosen.label) + ' (em chọn)</button>'
              : '') +
            '<button type="button" class="btn btn-primary" data-action="next">' + (isLast ? 'Xem kết quả' : 'Câu tiếp theo →') + '</button>' +
          '</div>' +
        '</div>';
    }

    function practiceStatsHtml() {
      var p = state.practice;
      return '<dl class="stats">' +
          '<div><dt>Đã trả lời</dt><dd data-stat="answered">' + p.answered + '</dd></div>' +
          '<div><dt>Đúng</dt><dd data-stat="correct">' + p.correct + '</dd></div>' +
          '<div><dt>Chưa đúng</dt><dd data-stat="wrong">' + (p.answered - p.correct) + '</dd></div>' +
          '<div><dt>Tỷ lệ đúng</dt><dd data-stat="rate">' + shared.percent(p.correct, p.answered) + '</dd></div>' +
        '</dl>' +
        '<p class="stats-note">Luyện tập không giới hạn số câu. Kết quả tính từ khi chọn mức độ này, chỉ trong lần mở trang hiện tại.</p>';
    }

    function questionHtml() {
      var q = state.question;
      var progress = state.mode === 'challenge'
        ? '<p class="progress-line" data-ref-progress>Câu ' + state.round.number + '/' + state.round.total +
          ' · Đúng ' + state.round.correct + '</p>'
        : '';
      var prompt = q.played
        ? 'Em nghe được nốt nào?'
        : 'Nhấn <strong>▶ Nghe âm thanh</strong> để bắt đầu' + (state.useReference ? ' (âm mốc Đô₄ phát trước).' : '.');
      return progress +
        '<div class="listen-controls">' +
          '<button type="button" class="btn btn-play" data-action="play">' + (q.played ? '🔁 Nghe lại' : '▶ Nghe âm thanh') + '</button>' +
          '<button type="button" class="btn btn-ghost" data-action="reference">Nghe âm mốc Đô₄</button>' +
        '</div>' +
        '<p class="listen-prompt" data-ref-prompt>' + prompt + '</p>' +
        '<div class="choice-grid" data-count="' + levelNotes().length + '" style="--choices:' + levelNotes().length + '">' +
          choiceButtonsHtml(q) + '</div>' +
        '<div class="answer-area">' + feedbackHtml(q) + '</div>' +
        (state.mode === 'practice' ? practiceStatsHtml() : '');
    }

    function resultsHtml() {
      var r = state.round;
      var wrong = r.total - r.correct;
      var missCount = {};
      r.mistakes.forEach(function (m) { missCount[m.targetId] = (missCount[m.targetId] || 0) + 1; });
      var toPractice = Object.keys(missCount).filter(function (id) { return missCount[id] >= MISSES_TO_SUGGEST_PRACTICE; });
      var mistakesList = r.mistakes.length
        ? '<h3>Các câu chưa đúng</h3><ul class="mistake-list">' + r.mistakes.map(function (m) {
            return '<li>Câu ' + m.number + ': âm thanh là <strong>' + escapeHtml(global.MusicNotes.findNote(m.targetId).label) +
              '</strong> – em chọn ' + escapeHtml(global.MusicNotes.findNote(m.chosenId).label) + '</li>';
          }).join('') + '</ul>'
        : '<p class="find-feedback is-good">Em trả lời đúng tất cả các câu. Tuyệt vời!</p>';
      var practiceHint = toPractice.length
        ? '<p class="practice-hint">Nốt nên luyện thêm (nhầm từ ' + MISSES_TO_SUGGEST_PRACTICE + ' lần trở lên trong lượt này): <strong>' +
          toPractice.map(function (id) { return escapeHtml(global.MusicNotes.findNote(id).label); }).join(', ') + '</strong></p>'
        : '';
      return '<div class="results" data-ref-results>' +
          '<h3>Kết quả thử thách – mức ' + LEVELS[state.levelKey].name + '</h3>' +
          '<dl class="stats">' +
            '<div><dt>Số câu</dt><dd data-stat="total">' + r.total + '</dd></div>' +
            '<div><dt>Đúng</dt><dd data-stat="correct">' + r.correct + '</dd></div>' +
            '<div><dt>Chưa đúng</dt><dd data-stat="wrong">' + wrong + '</dd></div>' +
            '<div><dt>Tỷ lệ đúng</dt><dd data-stat="rate">' + shared.percent(r.correct, r.total) + '</dd></div>' +
          '</dl>' +
          mistakesList + practiceHint +
          '<div class="answer-actions">' +
            '<button type="button" class="btn btn-primary" data-action="restart">Chơi lại thử thách</button>' +
            '<button type="button" class="btn btn-ghost" data-action="to-practice">Chuyển sang luyện tập</button>' +
          '</div>' +
          '<p class="stats-note">Kết quả của lần mở trang này. Xem tổng hợp và xuất file ở mục 📊 Báo cáo.</p>' +
        '</div>';
    }

    function renderStage() {
      renderSettings();
      if (state.round && state.round.finished) {
        refs.stage.innerHTML = resultsHtml();
        return;
      }
      refs.stage.innerHTML = questionHtml();
      var mini = refs.stage.querySelector('[data-ref-mini]');
      if (mini) {
        var target = global.MusicNotes.findNote(state.question.targetId);
        global.StaffRenderer.createStaff(mini, [target], {
          interactive: false,
          ariaLabel: 'Nốt ' + target.label + ' trên khuông nhạc, nằm ở ' + target.position
        });
        var caption = document.createElement('p');
        caption.className = 'mini-caption';
        caption.textContent = target.label + ' nằm ở ' + target.position + '.';
        mini.appendChild(caption);
      }
    }

    // ---------- Sự kiện ----------
    refs.stage.addEventListener('click', function (event) {
      var answerButton = event.target.closest('[data-answer]');
      if (answerButton) { answer(answerButton.getAttribute('data-answer')); return; }
      var actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;
      var action = actionButton.getAttribute('data-action');
      var q = state.question;
      if (action === 'play') playQuestionSound();
      else if (action === 'reference') playSingle(REFERENCE_NOTE);
      else if (action === 'play-target') playSingle(global.MusicNotes.findNote(q.targetId));
      else if (action === 'play-chosen') playSingle(global.MusicNotes.findNote(q.chosenId));
      else if (action === 'next') next();
      else if (action === 'restart') startSession();
      else if (action === 'to-practice') setMode('practice');
    });

    function setMode(mode) {
      state.mode = mode;
      startSession();
    }

    Array.prototype.forEach.call(modeButtons, function (b) {
      b.addEventListener('click', function () {
        var mode = b.getAttribute('data-mode');
        if (mode !== state.mode) setMode(mode);
      });
    });
    Array.prototype.forEach.call(levelButtons, function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-level');
        if (key === state.levelKey) return;
        state.levelKey = key;
        startSession();
      });
    });
    refs.lengthSelect.addEventListener('change', function () {
      state.challengeLength = Number(refs.lengthSelect.value);
      startSession();
    });
    refs.referenceToggle.addEventListener('change', function () {
      state.useReference = refs.referenceToggle.checked;
      renderStage();
    });

    startSession();

    return {
      root: root,
      getState: function () { return state; },
      setMode: setMode,
      setLevel: function (key) { state.levelKey = key; renderSettings(); startSession(); },
      // Đặt câu hỏi với một nốt cụ thể (dùng cho trang kiểm thử và giáo viên trình diễn).
      ask: function (noteId) { newQuestion(noteId); }
    };
  }

  global.ListeningActivity = { mount: mount, LEVELS: LEVELS };
})(window);
