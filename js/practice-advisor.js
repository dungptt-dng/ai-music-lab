/*
 * AI MUSIC LAB – Gợi ý luyện tập tiếp theo (THEO QUY TẮC CỐ ĐỊNH, KHÔNG DÙNG AI)
 *
 * Đầu vào: số liệu tổng hợp của báo cáo (ReportActivity.summarize), tức là các câu học sinh đã thực sự trả lời.
 * Mỗi gợi ý kèm LÝ DO lấy từ chính số liệu đó, để giáo viên kiểm tra được.
 *
 * QUY TẮC (theo thứ tự ưu tiên, tối đa MAX_SUGGESTIONS gợi ý):
 *  1. Nốt hay nhầm (từ 2 câu sai trở lên với cùng một nốt – cùng ngưỡng với báo cáo):
 *     ôn nốt đó ở hoạt động em sai nhiều nhất, kèm vị trí / quan hệ cao – thấp với nốt hay bị nhầm.
 *  2. Hoạt động có tỷ lệ đúng dưới WEAK_RATE (từ MIN_QUESTIONS câu trở lên): làm lại hoạt động đó.
 *  3. Nghe cao độ ở mức Dễ hoặc Vừa đúng từ STRONG_RATE trở lên (từ LEVEL_UP_QUESTIONS câu): lên mức khó hơn.
 *  4. Hoạt động chưa thử: thử hoạt động đó.
 *  5. Đã làm từ LEVEL_UP_QUESTIONS câu, tỷ lệ chung từ STRONG_RATE và không có nốt hay nhầm: thử lượt Trắc nghiệm dài hơn.
 */
(function (global) {
  'use strict';

  var MAX_SUGGESTIONS = 4;
  var MIN_QUESTIONS = 5;
  var LEVEL_UP_QUESTIONS = 10;
  var WEAK_RATE = 0.6;
  var STRONG_RATE = 0.8;

  var VIEW_NAMES = {
    'khuong-nhac': 'Khuông nhạc (Tìm nốt)',
    'nghe-cao-do': 'Nghe cao độ',
    'trac-nghiem': 'Trắc nghiệm',
    'keo-tha': 'Kéo thả nốt',
    'sang-tao': 'Phòng sáng tạo'
  };
  var TRY_ORDER = ['khuong-nhac', 'nghe-cao-do', 'trac-nghiem', 'keo-tha', 'sang-tao'];
  var NEXT_LEVEL = { 'Dễ': 'Vừa', 'Vừa': 'Khó' };

  function percent(rate) { return Math.round(rate * 100) + '%'; }

  // "Rê₄ thấp hơn Mi₄ 1 bậc" – so sánh hai nốt theo thứ tự trong 8 nốt.
  function compareText(a, b) {
    var notes = global.MusicNotes.NOTES;
    var diff = notes.indexOf(a) - notes.indexOf(b);
    return a.label + ' ' + (diff > 0 ? 'cao hơn ' : 'thấp hơn ') + b.label + ' ' + Math.abs(diff) + ' bậc';
  }

  // Hoạt động mà nốt này bị trả lời sai nhiều nhất (để gợi ý ôn đúng chỗ).
  function weakestActivityFor(summary, noteId) {
    var best = null, bestCount = 0;
    summary.activities.forEach(function (a) {
      var count = a.mistakes.filter(function (e) { return e.target === noteId; }).length;
      if (count > bestCount) { best = a.key; bestCount = count; }
    });
    return best || 'khuong-nhac';
  }

  function troubleSuggestion(summary, t) {
    var note = global.MusicNotes.findNote(t.noteId);
    var other = t.confusedWith.length ? global.MusicNotes.findNote(t.confusedWith[0].noteId) : null;
    var view = weakestActivityFor(summary, t.noteId);
    var detail;
    if (view === 'nghe-cao-do') {
      detail = 'Nghe lại thang 8 nốt ở mục Khuông nhạc, chú ý ' + note.label +
        (other ? ': ' + compareText(note, other) + '.' : '.') + ' Sau đó luyện Nghe cao độ có bật âm mốc Đô₄.';
    } else {
      detail = note.label + ' nằm ở ' + note.position + '.' +
        (other ? ' ' + other.label + ' nằm ở ' + other.position + ' (' + compareText(other, note) + ').' : '');
    }
    return {
      id: 'note-' + t.noteId,
      title: 'Ôn nốt ' + note.label + (other ? ' – hay nhầm với ' + other.label : ''),
      detail: detail,
      reason: 'Sai ' + t.wrong + ' trên ' + t.questions + ' câu về ' + note.label +
        (other ? ', trong đó ' + t.confusedWith[0].count + ' lần chọn ' + other.label : '') + '.',
      view: view
    };
  }

  /*
   * Trả về danh sách gợi ý: [{ id, title, detail, reason, view }].
   * view là đường dẫn hoạt động (ví dụ 'keo-tha') để mở thẳng từ báo cáo.
   */
  function suggest(summary) {
    var list = [];
    function add(item) {
      if (list.length >= MAX_SUGGESTIONS) return;
      if (list.some(function (s) { return s.id === item.id; })) return;
      list.push(item);
    }
    if (!summary || !summary.activities.length) return list;

    // 1. Nốt hay nhầm
    summary.trouble.slice(0, 2).forEach(function (t) { add(troubleSuggestion(summary, t)); });

    // 2. Hoạt động còn yếu
    summary.activities.forEach(function (a) {
      if (a.questions >= MIN_QUESTIONS && a.rate !== null && a.rate < WEAK_RATE) {
        add({
          id: 'weak-' + a.key,
          title: 'Luyện thêm ' + VIEW_NAMES[a.key],
          detail: 'Làm chậm lại, đọc kỹ câu hỏi; khi sai hãy xem lời giải thích và nghe lại trước khi sang câu mới.',
          reason: 'Tỷ lệ đúng ' + percent(a.rate) + ' (' + a.correct + '/' + a.questions + ' câu).',
          view: a.key
        });
      }
    });

    // 3. Nghe cao độ: lên mức khó hơn
    var listening = summary.activities.filter(function (a) { return a.key === 'nghe-cao-do'; })[0];
    if (listening) {
      ['Dễ', 'Vừa'].forEach(function (level) {
        var q = 0, c = 0;
        listening.modes.forEach(function (m) {
          if (m.mode.indexOf('mức ' + level) !== -1) { q += m.questions; c += m.correct; }
        });
        if (q >= LEVEL_UP_QUESTIONS && c / q >= STRONG_RATE) {
          add({
            id: 'level-' + level,
            title: 'Thử Nghe cao độ mức ' + NEXT_LEVEL[level],
            detail: 'Em đã nghe tốt ở mức ' + level + '. Mức ' + NEXT_LEVEL[level] + ' có nhiều nốt hơn để chọn.',
            reason: 'Mức ' + level + ': đúng ' + c + '/' + q + ' câu (' + percent(c / q) + ').',
            view: 'nghe-cao-do'
          });
        }
      });
    }

    // 4. Hoạt động chưa thử
    TRY_ORDER.forEach(function (key) {
      var tried = summary.activities.some(function (a) { return a.key === key; });
      if (!tried) {
        add({
          id: 'try-' + key,
          title: 'Thử ' + VIEW_NAMES[key],
          detail: 'Mỗi hoạt động luyện một kỹ năng khác: đọc vị trí, nghe cao độ, ghi nốt hoặc sáng tạo.',
          reason: 'Chưa có kết quả nào ở ' + VIEW_NAMES[key] + ' trong phạm vi báo cáo này.',
          view: key
        });
      }
    });

    // 5. Đã làm tốt: thử thách dài hơn
    if (summary.totals.questions >= LEVEL_UP_QUESTIONS && summary.rate >= STRONG_RATE && !summary.trouble.length) {
      add({
        id: 'challenge',
        title: 'Thử lượt Trắc nghiệm 20 câu',
        detail: 'Lượt dài có đủ 5 dạng câu hỏi, giúp em kiểm tra lại mọi kiến thức về 8 nốt.',
        reason: 'Đúng ' + summary.totals.correct + '/' + summary.totals.questions + ' câu (' + percent(summary.rate) +
          '), không có nốt hay nhầm.',
        view: 'trac-nghiem'
      });
    }
    return list;
  }

  global.PracticeAdvisor = {
    suggest: suggest,
    MIN_QUESTIONS: MIN_QUESTIONS,
    MAX_SUGGESTIONS: MAX_SUGGESTIONS
  };
})(window);
