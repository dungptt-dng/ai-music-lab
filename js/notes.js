/*
 * AI MUSIC LAB – Dữ liệu 8 nốt và thuật toán xác định vị trí nốt
 *
 * Mọi thông tin của một nốt (tên, ký hiệu, tần số, vị trí trên khuông)
 * đều được TÍNH từ hai giá trị gốc: chữ cái (C…B) và quãng tám (4, 5).
 * Nhờ vậy không có chỗ nào phải "ước lượng" hay gõ tay toạ độ từng nốt.
 *
 * Quy ước: ký hiệu cao độ khoa học (Đô giữa = C4), chuẩn A4 = 440 Hz.
 */
(function (global) {
  'use strict';

  var LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  // Số nửa cung tính từ C trong cùng quãng tám (C=0, D=2, E=4, F=5, G=7, A=9, B=11).
  var SEMITONES_FROM_C = [0, 2, 4, 5, 7, 9, 11];
  // Tên nốt tiếng Việt. Nếu SGK của trường dùng "Son" thay cho "Sol", chỉ cần sửa tại đây.
  var VIETNAMESE_NAMES = { C: 'Đô', D: 'Rê', E: 'Mi', F: 'Pha', G: 'Sol', A: 'La', B: 'Si' };
  var SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

  var A4_FREQUENCY = 440;
  var A4_MIDI = 69;

  /*
   * THUẬT TOÁN VỊ TRÍ NỐT TRÊN KHUÔNG KHÓA SOL
   *
   * 1. Đánh số "bậc" liên tục cho mọi nốt tự nhiên: bậc = quãng tám × 7 + thứ tự chữ cái.
   *    Ví dụ: C4 = 28, D4 = 29, E4 = 30, …, B4 = 34, C5 = 35.
   * 2. Với khóa Sol, dòng kẻ dưới cùng (dòng 1) là E4. Lấy E4 làm mốc 0:
   *        vị trí = bậc − 30
   *    Mỗi bậc là nửa khoảng cách giữa hai dòng kẻ.
   * 3. vị trí chẵn  → nốt nằm TRÊN DÒNG KẺ; vị trí lẻ → nốt nằm TRONG KHE.
   *    Các dòng kẻ của khuông ứng với vị trí 0, 2, 4, 6, 8 (dòng 1 → dòng 5).
   *    vị trí âm hoặc lớn hơn 8 nằm ngoài khuông; nếu là số chẵn ngoài khuông
   *    (−2, −4, … hoặc 10, 12, …) thì cần dòng kẻ phụ.
   *
   * Kết quả với 8 nốt: C4 = −2 (dòng kẻ phụ dưới), D4 = −1 (khe dưới dòng 1),
   * E4 = 0 (dòng 1), F4 = 1 (khe 1), G4 = 2 (dòng 2), A4 = 3 (khe 2),
   * B4 = 4 (dòng 3 – dòng giữa), C5 = 5 (khe 3 – ngay trên dòng giữa).
   */
  var BOTTOM_LINE_DIATONIC_INDEX = 4 * 7 + LETTERS.indexOf('E'); // = 30 (E4)
  var TOP_LINE_STEP = 8; // dòng 5

  function diatonicIndex(letter, octave) {
    return octave * 7 + LETTERS.indexOf(letter);
  }

  function staffStep(letter, octave) {
    return diatonicIndex(letter, octave) - BOTTOM_LINE_DIATONIC_INDEX;
  }

  function midiNumber(letter, octave) {
    return 12 * (octave + 1) + SEMITONES_FROM_C[LETTERS.indexOf(letter)];
  }

  // Tần số theo hệ bình quân 12 cung: f = 440 × 2^((midi − 69) / 12)
  function frequencyOf(letter, octave) {
    return A4_FREQUENCY * Math.pow(2, (midiNumber(letter, octave) - A4_MIDI) / 12);
  }

  function isOnLine(step) {
    return step % 2 === 0;
  }

  // Các dòng kẻ phụ cần vẽ cho một nốt (danh sách vị trí chẵn nằm ngoài khuông).
  function ledgerSteps(step) {
    var steps = [];
    var s;
    for (s = -2; s >= step; s -= 2) steps.push(s);
    for (s = TOP_LINE_STEP + 2; s <= step; s += 2) steps.push(s);
    return steps;
  }

  var LINE_DESCRIPTIONS = {
    1: 'dòng kẻ dưới cùng (dòng 1)',
    2: 'dòng kẻ thứ hai từ dưới lên (dòng 2)',
    3: 'dòng kẻ giữa (dòng 3)',
    4: 'dòng kẻ thứ tư từ dưới lên (dòng 4)',
    5: 'dòng kẻ trên cùng (dòng 5)'
  };
  var SPACE_DESCRIPTIONS = {
    1: 'khe thứ nhất từ dưới lên (khe 1)',
    2: 'khe thứ hai từ dưới lên (khe 2)',
    3: 'khe thứ ba, ngay trên dòng kẻ giữa (khe 3)',
    4: 'khe thứ tư từ dưới lên (khe 4)'
  };

  function describePosition(step) {
    if (step === -2) return 'dòng kẻ phụ phía dưới khuông';
    if (step === -1) return 'khe ngay dưới dòng kẻ dưới cùng';
    if (step === TOP_LINE_STEP + 1) return 'khe ngay trên dòng kẻ trên cùng';
    if (step === TOP_LINE_STEP + 2) return 'dòng kẻ phụ phía trên khuông';
    if (step >= 0 && step <= TOP_LINE_STEP) {
      return isOnLine(step) ? LINE_DESCRIPTIONS[step / 2 + 1] : SPACE_DESCRIPTIONS[(step + 1) / 2];
    }
    return (isOnLine(step) ? 'dòng kẻ phụ' : 'khe') + (step < 0 ? ' phía dưới khuông' : ' phía trên khuông');
  }

  function formatFrequency(hz) {
    return hz.toFixed(2).replace('.', ',') + ' Hz';
  }

  function createNote(letter, octave) {
    var step = staffStep(letter, octave);
    var name = VIETNAMESE_NAMES[letter];
    return {
      id: letter + octave,               // "C4"
      letter: letter,
      octave: octave,
      name: name,                        // "Đô"
      label: name + SUBSCRIPT_DIGITS[octave], // "Đô₄"
      symbol: letter + octave,           // "C4"
      frequency: frequencyOf(letter, octave),
      step: step,
      onLine: isOnLine(step),
      ledgerSteps: ledgerSteps(step),
      position: describePosition(step)
    };
  }

  // 8 nốt của chương trình, theo đúng thứ tự Đô₄ → Đô₅.
  var NOTES = [
    ['C', 4], ['D', 4], ['E', 4], ['F', 4], ['G', 4], ['A', 4], ['B', 4], ['C', 5]
  ].map(function (pair) { return createNote(pair[0], pair[1]); });

  function findNote(id) {
    for (var i = 0; i < NOTES.length; i++) {
      if (NOTES[i].id === id) return NOTES[i];
    }
    return null;
  }

  // Nốt (trong 8 nốt) nằm ở vị trí cho trước, hoặc null nếu không có.
  function noteAtStep(step) {
    for (var i = 0; i < NOTES.length; i++) {
      if (NOTES[i].step === step) return NOTES[i];
    }
    return null;
  }

  global.MusicNotes = {
    NOTES: NOTES,
    TOP_LINE_STEP: TOP_LINE_STEP,
    findNote: findNote,
    noteAtStep: noteAtStep,
    ledgerSteps: ledgerSteps,
    staffStep: staffStep,
    frequencyOf: frequencyOf,
    describePosition: describePosition,
    formatFrequency: formatFrequency
  };
  // Chạy được cả trong trình duyệt (window) lẫn máy chủ Cloudflare (globalThis) – máy chủ AI dùng chung dữ liệu này để kiểm tra đáp án.
})(typeof window !== 'undefined' ? window : globalThis);
