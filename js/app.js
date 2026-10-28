/*
 * AI MUSIC LAB – Khung ứng dụng: chuyển giữa các hoạt động.
 * Mỗi hoạt động có đường dẫn riêng (ví dụ index.html#trac-nghiem) để giáo viên mở thẳng.
 * Hoạt động chỉ được khởi tạo lần đầu khi được mở.
 *
 * Khung ứng dụng cũng nối phần "vui" vào các hoạt động mà không sửa cách chấm:
 * - nghe nhật ký luyện tập: mỗi câu trả lời → tiếng chuông đúng / tiếng động viên + linh vật phản ứng;
 * - nghe sự kiện hoàn thành (AppShared.celebrate) → giai điệu chúc mừng + pháo giấy;
 * - tạm im nhạc nền khi bài học phát nốt và ở các hoạt động luyện nghe.
 */
(function (global) {
  'use strict';

  var VIEWS = {
    'trang-chu': function (el) { return global.FunUi.mountHome(el); },
    'khuong-nhac': function (el) { return global.StaffActivity.mount(el); },
    'nghe-cao-do': function (el) { return global.ListeningActivity.mount(el); },
    'trac-nghiem': function (el) { return global.QuizActivity.mount(el); },
    'keo-tha': function (el) { return global.DragActivity.mount(el); },
    'sang-tao': function (el) { return global.MelodyActivity.mount(el); },
    'bao-cao': function (el) { return global.ReportActivity.mount(el); },
    // Trang của giáo viên: không có nút trên thanh chọn của học sinh, mở từ chân trang.
    'tro-ly-giao-vien': function (el) { return global.TeacherAssistant.mount(el); }
  };
  var DEFAULT_VIEW = 'trang-chu';
  // Hoạt động cần nghe rõ cao độ: nhạc nền tạm dừng.
  var QUIET_VIEWS = ['nghe-cao-do', 'trac-nghiem', 'tro-ly-giao-vien'];
  // Hoạt động tự phát nốt ngay khi trả lời: chờ nốt vang xong rồi mới rung chuông.
  var NOTE_ON_ANSWER = ['khuong-nhac', 'keo-tha'];
  var FEEDBACK_DELAY = 0.45;
  // Chỉ những nút điều hướng / chọn chế độ mới có tiếng "bóp"; nút phát nốt thì không, để khỏi lẫn cao độ.
  var CLICK_SOUND_SELECTOR = '.app-nav button, .home-card, .mode-switch button, .sound-toggle';
  var mounted = {};

  function viewFromHash() {
    var name = global.location.hash.replace('#', '');
    return VIEWS[name] ? name : DEFAULT_VIEW;
  }

  function show(name) {
    global.AudioEngine.stopAll();
    Object.keys(VIEWS).forEach(function (key) {
      var panel = document.getElementById('view-' + key);
      panel.hidden = key !== name;
      var tab = document.querySelector('[data-view="' + key + '"]');
      if (tab) tab.setAttribute('aria-selected', String(key === name));
    });
    document.body.setAttribute('data-active-view', name);
    global.SoundFx.setMusicAllowed(QUIET_VIEWS.indexOf(name) === -1);
    if (!mounted[name]) mounted[name] = VIEWS[name](document.getElementById('view-' + name));
    else if (mounted[name].render) mounted[name].render();   // Báo cáo: cập nhật số liệu mới nhất
  }

  // Mỗi lần bài học phát nốt, nhạc nền im trong lúc nốt vang.
  function duckMusicDuringLessonSound() {
    var engine = global.AudioEngine;
    var playNote = engine.playNote, playSequence = engine.playSequence;
    engine.playNote = function (frequency, duration) {
      global.SoundFx.duck(duration || 1.1);
      return playNote.apply(engine, arguments);
    };
    engine.playSequence = function (frequencies, options) {
      var o = options || {};
      global.SoundFx.duck((frequencies.length - 1) * (o.gap || 0.6) + (o.noteDuration || 0.9));
      return playSequence.apply(engine, arguments);
    };
  }

  function connectFeedback() {
    var log = global.PracticeLog.current;
    var seen = log.currentSession().entries.length;
    log.subscribe(function () {
      var entries = log.currentSession().entries;
      if (entries.length < seen) seen = 0;               // phiên mới
      entries.slice(seen).forEach(function (entry) {
        if (entry.kind !== 'answer') return;
        var delay = NOTE_ON_ANSWER.indexOf(entry.activity) !== -1 ? FEEDBACK_DELAY : 0;
        if (entry.correct) global.SoundFx.correct(delay); else global.SoundFx.wrong(delay);
        global.FunUi.react(entry.correct ? 'happy' : 'oops');
      });
      seen = entries.length;
    });
    global.addEventListener(global.AppShared.CELEBRATE_EVENT, function () {
      global.SoundFx.celebrate();
      global.FunUi.confetti();
      global.FunUi.react('party');
    });
    document.addEventListener('click', function (event) {
      if (event.isTrusted && event.target.closest && event.target.closest(CLICK_SOUND_SELECTOR)) global.SoundFx.click();
    }, true);
  }

  function start() {
    global.FunUi.mountHeader();
    duckMusicDuringLessonSound();
    connectFeedback();
    Array.prototype.forEach.call(document.querySelectorAll('.app-nav [data-view]'), function (tab) {
      tab.addEventListener('click', function () {
        var name = tab.getAttribute('data-view');
        if (global.location.hash !== '#' + name) global.location.hash = name;
        else show(name);
      });
    });
    global.addEventListener('hashchange', function () { show(viewFromHash()); });
    show(viewFromHash());
  }

  global.AiMusicLab = { start: start };
})(window);
