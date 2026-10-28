/*
 * AI MUSIC LAB – Khung ứng dụng: chuyển giữa các hoạt động.
 * Mỗi hoạt động có đường dẫn riêng (ví dụ index.html#trac-nghiem) để giáo viên mở thẳng.
 * Hoạt động chỉ được khởi tạo lần đầu khi được mở.
 */
(function (global) {
  'use strict';

  var VIEWS = {
    'khuong-nhac': function (el) { return global.StaffActivity.mount(el); },
    'nghe-cao-do': function (el) { return global.ListeningActivity.mount(el); },
    'trac-nghiem': function (el) { return global.QuizActivity.mount(el); },
    'keo-tha': function (el) { return global.DragActivity.mount(el); },
    'sang-tao': function (el) { return global.MelodyActivity.mount(el); },
    'bao-cao': function (el) { return global.ReportActivity.mount(el); },
    // Trang của giáo viên: không có nút trên thanh chọn của học sinh, mở từ chân trang.
    'tro-ly-giao-vien': function (el) { return global.TeacherAssistant.mount(el); }
  };
  var DEFAULT_VIEW = 'khuong-nhac';
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
    if (!mounted[name]) mounted[name] = VIEWS[name](document.getElementById('view-' + name));
    else if (mounted[name].render) mounted[name].render();   // Báo cáo: cập nhật số liệu mới nhất
  }

  function start() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (tab) {
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
