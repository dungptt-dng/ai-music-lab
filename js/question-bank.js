/*
 * AI MUSIC LAB – Ngân hàng câu hỏi trắc nghiệm (tạo câu hỏi theo quy tắc, không dùng AI)
 *
 * Mỗi câu hỏi được sinh từ dữ liệu 8 nốt trong js/notes.js nên đáp án luôn khớp nhạc lý.
 * Mỗi câu có đúng MỘT đáp án đúng; các phương án sai được chọn từ những nốt khác.
 *
 * Cấu trúc một câu hỏi:
 *   { type, key, prompt, staffNoteId?, sound?, soundLabel?, options: [{ id, text }], answerId, explanation }
 *   - staffNoteId: hiện nốt này trên khuông (ẩn tên) để học sinh đọc.
 *   - sound: danh sách tần số cần phát; học sinh phải nghe xong mới trả lời.
 *   - key: dùng để không lặp lại cùng một câu trong một lượt.
 */
(function (global) {
  'use strict';

  var shared = global.AppShared;
  var NOTES = global.MusicNotes.NOTES;
  var REFERENCE_NOTE = global.MusicNotes.findNote('C4');
  var SCALE_TEXT = NOTES.map(function (n) { return n.label; }).join(' – ');

  var TYPES = {
    'staff-name':   'Đọc tên nốt trên khuông',
    'order':        'Thứ tự các nốt',
    'position':     'Vị trí nốt trong khóa Sol',
    'sound-symbol': 'Ghép ký hiệu với âm thanh',
    'higher-lower': 'Cao hơn – thấp hơn'
  };
  var TYPE_KEYS = Object.keys(TYPES);

  function indexOfNote(note) { return NOTES.indexOf(note); }

  function capitalize(text) { return text.charAt(0).toUpperCase() + text.slice(1); }

  // Chọn ngẫu nhiên `count` nốt khác nhau từ danh sách, không lấy các nốt trong `exclude`.
  function pickOthers(pool, exclude, count, random) {
    var candidates = pool.filter(function (n) { return exclude.indexOf(n) === -1; });
    return shared.shuffle(candidates, random).slice(0, count);
  }

  function labelOptions(notes) {
    return notes.map(function (n) { return { id: n.id, text: n.label }; });
  }

  // ---------- Dạng 1: Đọc tên nốt trên khuông ----------
  function staffName(random) {
    var note = shared.pick(NOTES, random);
    var options = shared.shuffle([note].concat(pickOthers(NOTES, [note], 3, random)), random);
    return {
      type: 'staff-name',
      key: 'staff-name:' + note.id,
      prompt: 'Nốt trên khuông nhạc là nốt gì?',
      staffNoteId: note.id,
      options: labelOptions(options),
      answerId: note.id,
      explanation: note.label + ' (' + note.symbol + ') nằm ở ' + note.position + '.'
    };
  }

  // ---------- Dạng 2: Thứ tự các nốt ----------
  function order(random) {
    var index = Math.floor(random() * NOTES.length);
    var direction;
    if (index === 0) direction = 'after';
    else if (index === NOTES.length - 1) direction = 'before';
    else direction = random() < 0.5 ? 'after' : 'before';
    var asked = NOTES[index];
    var answer = NOTES[direction === 'after' ? index + 1 : index - 1];
    var options = shared.shuffle([answer].concat(pickOthers(NOTES, [answer, asked], 3, random)), random);
    var low = direction === 'after' ? asked : answer;
    var high = direction === 'after' ? answer : asked;
    return {
      type: 'order',
      key: 'order:' + direction + ':' + asked.id,
      prompt: 'Trong dãy ' + SCALE_TEXT + ', nốt nào đứng ngay ' + (direction === 'after' ? 'sau' : 'trước') +
        ' ' + asked.label + '?',
      options: labelOptions(options),
      answerId: answer.id,
      explanation: 'Trong dãy nốt đi lên, ' + low.label + ' liền trước ' + high.label + '.'
    };
  }

  // ---------- Dạng 3: Vị trí nốt trong khóa Sol ----------
  function position(random) {
    var note = shared.pick(NOTES, random);
    var others = pickOthers(NOTES, [note], 3, random);
    var all = shared.shuffle([note].concat(others), random);
    var explanation = note.label + ' nằm ở ' + note.position + '.';
    if (random() < 0.5) {
      return {
        type: 'position',
        key: 'position:where:' + note.id,
        prompt: 'Trong khóa Sol, nốt ' + note.label + ' nằm ở đâu trên khuông nhạc?',
        options: all.map(function (n) { return { id: n.id, text: capitalize(n.position) }; }),
        answerId: note.id,
        explanation: explanation
      };
    }
    return {
      type: 'position',
      key: 'position:which:' + note.id,
      prompt: 'Trong khóa Sol, nốt nằm ở ' + note.position + ' là nốt gì?',
      options: labelOptions(all),
      answerId: note.id,
      explanation: explanation
    };
  }

  // ---------- Dạng 4: Ghép ký hiệu với âm thanh ----------
  // Có âm mốc Đô₄ để so sánh; các phương án sai cách đáp án ít nhất 2 bậc để học sinh nghe phân biệt được.
  var MIN_STEPS_BETWEEN_SOUND_OPTIONS = 2;

  function soundSymbol(random) {
    var note = shared.pick(NOTES, random);
    var far = NOTES.filter(function (n) {
      return Math.abs(indexOfNote(n) - indexOfNote(note)) >= MIN_STEPS_BETWEEN_SOUND_OPTIONS;
    });
    var options = [note].concat(shared.shuffle(far, random).slice(0, 3));
    options.sort(function (a, b) { return a.frequency - b.frequency; });
    return {
      type: 'sound-symbol',
      key: 'sound-symbol:' + note.id,
      prompt: 'Em nghe âm mốc Đô₄ (C4), sau đó là một âm khác. Âm thứ hai có ký hiệu là gì?',
      sound: [REFERENCE_NOTE.frequency, note.frequency],
      soundLabel: 'Nghe âm mốc và âm cần tìm',
      options: options.map(function (n) { return { id: n.id, text: n.symbol }; }),
      answerId: note.id,
      explanation: 'Âm thứ hai là ' + note.label + ', ký hiệu ' + note.symbol + ' (' +
        global.MusicNotes.formatFrequency(note.frequency) + ').'
    };
  }

  // ---------- Dạng 5: Cao hơn – thấp hơn ----------
  function higherLower(random) {
    var pair = shared.shuffle(NOTES, random).slice(0, 2);
    var a = pair[0], b = pair[1];
    var higher = a.frequency > b.frequency ? a : b;
    var lower = higher === a ? b : a;

    if (random() < 0.5) {
      var askHigher = random() < 0.5;
      var word = askHigher ? 'cao hơn' : 'thấp hơn';
      return {
        type: 'higher-lower',
        key: 'hl-names:' + word + ':' + [a.id, b.id].sort().join('-'),
        prompt: 'Trong hai nốt ' + a.label + ' và ' + b.label + ', nốt nào ' + word + '?',
        options: labelOptions([a, b]),
        answerId: (askHigher ? higher : lower).id,
        explanation: higher.label + ' cao hơn ' + lower.label + '; trên khuông nhạc, ' + higher.label + ' cũng nằm cao hơn.'
      };
    }

    // Nghe hai âm: chọn hai nốt cách nhau ít nhất 2 bậc cho dễ phân biệt.
    var first = shared.pick(NOTES, random);
    var far = NOTES.filter(function (n) { return Math.abs(indexOfNote(n) - indexOfNote(first)) >= 2; });
    var second = shared.pick(far, random);
    var secondHigher = second.frequency > first.frequency;
    return {
      type: 'higher-lower',
      key: 'hl-sound:' + first.id + '>' + second.id,
      prompt: 'Nghe hai âm. Âm thứ hai cao hơn hay thấp hơn âm thứ nhất?',
      sound: [first.frequency, second.frequency],
      soundLabel: 'Nghe hai âm',
      options: [{ id: 'higher', text: 'Âm thứ hai cao hơn' }, { id: 'lower', text: 'Âm thứ hai thấp hơn' }],
      answerId: secondHigher ? 'higher' : 'lower',
      explanation: 'Âm thứ nhất là ' + first.label + ', âm thứ hai là ' + second.label + ', nên âm thứ hai ' +
        (secondHigher ? 'cao hơn' : 'thấp hơn') + '.'
    };
  }

  var GENERATORS = {
    'staff-name': staffName,
    'order': order,
    'position': position,
    'sound-symbol': soundSymbol,
    'higher-lower': higherLower
  };

  /*
   * Tạo một lượt gồm `count` câu: các dạng câu hỏi được chia đều và trộn thứ tự,
   * không có hai câu giống hệt nhau (cùng key) trong một lượt.
   */
  var MAX_ATTEMPTS_PER_QUESTION = 40;

  function generateRound(count, random) {
    var types = [];
    while (types.length < count) types = types.concat(shared.shuffle(TYPE_KEYS, random));
    types = shared.shuffle(types.slice(0, count), random);
    var usedKeys = {};
    return types.map(function (type) {
      var question;
      for (var attempt = 0; attempt < MAX_ATTEMPTS_PER_QUESTION; attempt++) {
        question = GENERATORS[type](random);
        if (!usedKeys[question.key]) break;
      }
      usedKeys[question.key] = true;
      return question;
    });
  }

  global.QuestionBank = {
    TYPES: TYPES,
    TYPE_KEYS: TYPE_KEYS,
    generate: function (type, random) { return GENERATORS[type](random || Math.random); },
    generateRound: generateRound
  };
})(window);
