/*
 * AI MUSIC LAB – Hoạt động 3: Trắc nghiệm có phản hồi đúng/sai
 *
 * Câu hỏi lấy từ js/question-bank.js. Không giới hạn thời gian, phản hồi nhẹ nhàng,
 * mỗi câu có giải thích. Cuối lượt hiển thị số câu đúng, sai, tỷ lệ đúng và chi tiết theo dạng câu hỏi.
 */
(function (global) {
  'use strict';

  var shared = global.AppShared;
  var escapeHtml = shared.escapeHtml;
  var ROUND_LENGTHS = [5, 10, 15, 20];
  var OPTION_LETTERS = ['A', 'B', 'C', 'D'];

  var TEMPLATE =
    '<div class="activity-head">' +
      '<h2 class="activity-title">Trắc nghiệm</h2>' +
    '</div>' +
    '<div class="toolbar">' +
      '<label class="field">Số câu mỗi lượt ' +
        '<select data-ref="lengthSelect">' +
          ROUND_LENGTHS.map(function (n) { return '<option value="' + n + '">' + n + '</option>'; }).join('') +
        '</select>' +
      '</label>' +
      '<button type="button" class="btn btn-secondary" data-ref="newRoundButton">Làm lượt mới</button>' +
      shared.VOLUME_SLIDER_HTML +
    '</div>' +
    '<p class="audio-alert" data-ref="audioAlert" role="alert" hidden></p>' +
    '<div class="quiz-stage" data-ref="stage" aria-live="polite"></div>';

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
    refs.lengthSelect.value = '10';
    shared.bindVolumeSlider(refs.volume, audio);

    /*
     * CÁCH TÍNH ĐIỂM: mỗi câu chỉ tính lần chọn đầu tiên (sau đó đáp án được hiện ra).
     * answers[i] = { chosenId, correct }. Tỷ lệ đúng = số câu đúng / số câu trong lượt.
     */
    var state = {
      roundLength: 10,
      questions: [],
      answers: [],
      index: 0,
      soundPlayed: false,
      finished: false
    };

    function current() { return state.questions[state.index]; }

    // ---------- Âm thanh ----------
    function showAudioError(error) {
      refs.audioAlert.textContent = shared.audioErrorMessage(error);
      refs.audioAlert.hidden = false;
    }
    function clearAudioError() { refs.audioAlert.hidden = true; }

    function playQuestionSound() {
      var q = current();
      audio.playSequence(q.sound, { gap: 1.1, noteDuration: 0.95 }).then(function () {
        clearAudioError();
        if (!state.soundPlayed && current() === q) {
          state.soundPlayed = true;
          render();
        }
      }, showAudioError);
    }

    // ---------- Luồng câu hỏi ----------
    function startRound() {
      audio.stopAll();
      state.questions = global.QuestionBank.generateRound(state.roundLength, random);
      state.answers = [];
      state.index = 0;
      state.soundPlayed = false;
      state.finished = false;
      render();
    }

    function choose(optionId) {
      var q = current();
      if (state.answers[state.index]) return;
      if (q.sound && !state.soundPlayed) return;
      state.answers[state.index] = {
        chosenId: optionId,
        correct: optionId === q.answerId,
        praise: shared.praise(random)
      };
      log.record({
        kind: 'answer', activity: 'trac-nghiem', mode: global.QuestionBank.TYPES[q.type],
        item: log.nextItem('trac-nghiem'), first: true,
        target: q.answerId, targetText: optionText(q, q.answerId),
        given: optionId, givenText: optionText(q, optionId), correct: optionId === q.answerId
      });
      render();
    }

    function next() {
      audio.stopAll();
      if (state.index >= state.questions.length - 1) {
        state.finished = true;
      } else {
        state.index += 1;
        state.soundPlayed = false;
      }
      render();
    }

    function correctCount() {
      return state.answers.filter(function (a) { return a && a.correct; }).length;
    }

    function optionText(q, id) {
      for (var i = 0; i < q.options.length; i++) if (q.options[i].id === id) return q.options[i].text;
      return '';
    }

    // ---------- Hiển thị ----------
    function questionHtml() {
      var q = current();
      var answered = state.answers[state.index];
      var locked = !!answered || (q.sound && !state.soundPlayed);
      var total = state.questions.length;
      var progressPct = Math.round((state.index / total) * 100);

      var soundBlock = q.sound
        ? '<div class="listen-controls">' +
            '<button type="button" class="btn btn-play" data-action="play">' +
              (state.soundPlayed ? '🔁 Nghe lại' : '▶ ' + escapeHtml(q.soundLabel)) + '</button>' +
            (state.soundPlayed ? '' : '<span class="listen-hint">Nghe xong rồi mới chọn đáp án nhé.</span>') +
          '</div>'
        : '';

      var optionsHtml = q.options.map(function (option, i) {
        var classes = ['quiz-option'];
        if (answered) {
          if (option.id === q.answerId) classes.push('is-correct');
          else if (option.id === answered.chosenId) classes.push('is-wrong');
        }
        return '<button type="button" class="' + classes.join(' ') + '" data-option="' + option.id + '"' +
          (locked ? ' disabled' : '') + '>' +
          '<span class="option-letter">' + OPTION_LETTERS[i] + '</span>' +
          '<span class="option-text">' + escapeHtml(option.text) + '</span>' +
        '</button>';
      }).join('');

      var feedback = '';
      if (answered) {
        var isLast = state.index === total - 1;
        feedback = (answered.correct
            ? '<p class="find-feedback is-good">✓ ' + answered.praise + ' ' + escapeHtml(q.explanation) + '</p>'
            : '<p class="find-feedback is-retry">↻ Chưa đúng. Đáp án đúng: <strong>' + escapeHtml(optionText(q, q.answerId)) +
              '</strong>. ' + escapeHtml(q.explanation) + '</p>') +
          '<div class="answer-actions">' +
            '<button type="button" class="btn btn-primary" data-action="next">' + (isLast ? 'Xem kết quả' : 'Câu tiếp theo →') + '</button>' +
          '</div>';
      }

      return '<div class="quiz-progress">' +
          '<span data-ref-progress>Câu ' + (state.index + 1) + '/' + total + '</span>' +
          '<div class="progress-bar" aria-hidden="true"><span style="width:' + progressPct + '%"></span></div>' +
          '<span>Đúng ' + correctCount() + '</span>' +
        '</div>' +
        '<p class="type-chip">' + escapeHtml(global.QuestionBank.TYPES[q.type]) + '</p>' +
        '<p class="quiz-prompt" data-ref-prompt>' + escapeHtml(q.prompt) + '</p>' +
        (q.staffNoteId ? '<div class="mini-staff" data-ref-mini></div>' : '') +
        soundBlock +
        '<div class="quiz-options">' + optionsHtml + '</div>' +
        '<div class="answer-area">' + feedback + '</div>';
    }

    function resultsHtml() {
      var total = state.questions.length;
      var correct = correctCount();
      var byType = {};
      state.questions.forEach(function (q, i) {
        var row = byType[q.type] || (byType[q.type] = { total: 0, correct: 0 });
        row.total += 1;
        if (state.answers[i].correct) row.correct += 1;
      });
      var typeRows = global.QuestionBank.TYPE_KEYS.filter(function (t) { return byType[t]; }).map(function (t) {
        return '<tr data-type="' + t + '"><td>' + escapeHtml(global.QuestionBank.TYPES[t]) + '</td><td>' +
          byType[t].total + '</td><td>' + byType[t].correct + '</td><td>' + shared.percent(byType[t].correct, byType[t].total) + '</td></tr>';
      }).join('');
      var wrongItems = state.questions.map(function (q, i) {
        var a = state.answers[i];
        if (a.correct) return '';
        return '<li><strong>Câu ' + (i + 1) + ':</strong> ' + escapeHtml(q.prompt) +
          '<br>Em chọn: ' + escapeHtml(optionText(q, a.chosenId)) +
          ' · Đáp án đúng: <strong>' + escapeHtml(optionText(q, q.answerId)) + '</strong></li>';
      }).join('');

      return '<div class="results" data-ref-results>' +
          '<h3>Kết quả lượt trắc nghiệm</h3>' +
          '<dl class="stats">' +
            '<div><dt>Số câu</dt><dd data-stat="total">' + total + '</dd></div>' +
            '<div><dt>Đúng</dt><dd data-stat="correct">' + correct + '</dd></div>' +
            '<div><dt>Chưa đúng</dt><dd data-stat="wrong">' + (total - correct) + '</dd></div>' +
            '<div><dt>Tỷ lệ đúng</dt><dd data-stat="rate">' + shared.percent(correct, total) + '</dd></div>' +
          '</dl>' +
          '<h3>Theo dạng câu hỏi</h3>' +
          '<table class="result-table"><thead><tr><th>Dạng câu hỏi</th><th>Số câu</th><th>Đúng</th><th>Tỷ lệ</th></tr></thead>' +
            '<tbody>' + typeRows + '</tbody></table>' +
          (wrongItems
            ? '<h3>Xem lại các câu chưa đúng</h3><ul class="mistake-list">' + wrongItems + '</ul>'
            : '<p class="find-feedback is-good">Em trả lời đúng tất cả các câu. Tuyệt vời!</p>') +
          '<div class="answer-actions">' +
            '<button type="button" class="btn btn-primary" data-action="restart">Làm lượt mới</button>' +
          '</div>' +
          '<p class="stats-note">Kết quả của lần mở trang này. Xem tổng hợp và xuất file ở mục 📊 Báo cáo.</p>' +
        '</div>';
    }

    function render() {
      if (state.finished) {
        refs.stage.innerHTML = resultsHtml();
        return;
      }
      refs.stage.innerHTML = questionHtml();
      var mini = refs.stage.querySelector('[data-ref-mini]');
      if (mini) {
        var note = global.MusicNotes.findNote(current().staffNoteId);
        var staff = global.StaffRenderer.createStaff(mini, [note], {
          interactive: false,
          ariaLabel: 'Một nốt nhạc trên khuông khóa Sol'
        });
        // Chỉ hiện tên nốt sau khi học sinh đã trả lời.
        staff.setLabelsVisible(!!state.answers[state.index]);
      }
    }

    // ---------- Sự kiện ----------
    refs.stage.addEventListener('click', function (event) {
      var optionButton = event.target.closest('[data-option]');
      if (optionButton) { choose(optionButton.getAttribute('data-option')); return; }
      var actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;
      var action = actionButton.getAttribute('data-action');
      if (action === 'play') playQuestionSound();
      else if (action === 'next') next();
      else if (action === 'restart') startRound();
    });
    refs.newRoundButton.addEventListener('click', startRound);
    refs.lengthSelect.addEventListener('change', function () {
      state.roundLength = Number(refs.lengthSelect.value);
      startRound();
    });

    startRound();

    return {
      root: root,
      getState: function () { return state; },
      startRound: startRound,
      // Dùng cho trang kiểm thử: thay lượt hiện tại bằng danh sách câu hỏi cho trước.
      loadQuestions: function (questions) {
        state.questions = questions;
        state.answers = [];
        state.index = 0;
        state.soundPlayed = false;
        state.finished = false;
        render();
      }
    };
  }

  global.QuizActivity = { mount: mount };
})(window);
