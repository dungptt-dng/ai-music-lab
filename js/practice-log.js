/*
 * AI MUSIC LAB – Nhật ký luyện tập (nguồn dữ liệu DUY NHẤT của báo cáo)
 *
 * Mỗi lần học sinh trả lời (Tìm nốt, Nghe cao độ, Trắc nghiệm, Kéo thả) hoặc thao tác trong Khám phá /
 * Phòng sáng tạo, hoạt động ghi một dòng vào nhật ký. Báo cáo chỉ tính từ các dòng này.
 *
 * Hai loại dòng:
 *  { kind: 'answer', activity, mode, item, first, target, targetText, given, givenText, correct, time }
 *     item  – số thứ tự câu trong hoạt động (trong phiên); first – đây có phải lần trả lời đầu tiên của câu đó.
 *  { kind: 'action', activity, action, target?, detail, time }   – thao tác không có đúng/sai.
 *
 * PHIÊN = một lần mở trang. Dữ liệu phiên chỉ nằm trong bộ nhớ của trang.
 * Chỉ khi người dùng BẬT "Lưu trên máy này", các phiên mới được ghi vào localStorage của trình duyệt
 * trên chính máy đó – không gửi đi đâu, không đồng bộ sang máy khác. Nhật ký không chứa họ tên.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'aiml-nhat-ky-v1';
  var MAX_SESSIONS = 100;
  var MAX_ENTRIES_PER_SESSION = 1500;

  function defaultStorage() {
    try { return global.localStorage || null; } catch (e) { return null; }
  }

  function newSessionId(date) {
    var stamp = date.toISOString().replace(/\D/g, '').slice(0, 14);
    return stamp + '-' + Math.random().toString(36).slice(2, 6);
  }

  /*
   * options.storage – nơi lưu khi bật lưu (mặc định localStorage; null = không thể lưu)
   * options.now     – hàm trả về thời điểm hiện tại (trang kiểm thử truyền giá trị cố định)
   */
  function create(options) {
    options = options || {};
    var storage = 'storage' in options ? options.storage : defaultStorage();
    var now = options.now || function () { return new Date(); };
    var listeners = [];
    var counters = {};
    var session = null;
    var lastError = null;
    var droppedSessions = 0;

    function resetSession() {
      session = { id: newSessionId(now()), startedAt: null, lastAt: null, entries: [] };
      counters = {};
    }
    resetSession();

    // ---------- Bộ nhớ trình duyệt ----------
    function readStore() {
      if (!storage) return null;
      try {
        var data = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
        return data && Array.isArray(data.sessions) ? data : null;
      } catch (e) {
        return null;
      }
    }

    // Ghi lại; nếu bộ nhớ đầy thì bỏ dần phiên cũ nhất (không bao giờ bỏ phiên đang mở).
    function writeStore(data) {
      for (;;) {
        try {
          storage.setItem(STORAGE_KEY, JSON.stringify(data));
          lastError = null;
          return true;
        } catch (e) {
          var oldest = data.sessions.findIndex(function (s) { return s.id !== session.id; });
          if (oldest === -1) { lastError = e; return false; }
          data.sessions.splice(oldest, 1);
          droppedSessions += 1;
        }
      }
    }

    function savingEnabled() {
      var data = readStore();
      return !!(data && data.enabled);
    }

    function persistSession() {
      var data = readStore();
      if (!data || !data.enabled || !session.entries.length) return true;
      data.sessions = data.sessions.filter(function (s) { return s.id !== session.id; });
      data.sessions.push(session);
      if (data.sessions.length > MAX_SESSIONS) data.sessions = data.sessions.slice(-MAX_SESSIONS);
      return writeStore(data);
    }

    function setSaving(enabled) {
      if (!storage) { lastError = new Error('no-storage'); return false; }
      var data = readStore() || { app: 'AI MUSIC LAB', version: 1, sessions: [] };
      data.enabled = !!enabled;
      if (!writeStore(data)) return false;
      if (enabled) persistSession();
      notify();
      return !lastError;
    }

    function clearSaved() {
      if (!storage) return false;
      try {
        storage.removeItem(STORAGE_KEY);
      } catch (e) {
        lastError = e;
        return false;
      }
      notify();
      return true;
    }

    function savedSessions() {
      var data = readStore();
      return data ? data.sessions.slice() : [];
    }

    // Tất cả các phiên trên máy này: các phiên đã lưu + phiên đang mở (nếu chưa được lưu).
    function allSessions() {
      var list = savedSessions().filter(function (s) { return s.id !== session.id; });
      if (session.entries.length) list.push(session);
      return list.sort(function (a, b) { return a.startedAt < b.startedAt ? -1 : 1; });
    }

    // ---------- Ghi nhật ký ----------
    function notify() {
      listeners.forEach(function (fn) { fn(); });
    }

    function nextItem(activity) {
      counters[activity] = (counters[activity] || 0) + 1;
      return counters[activity];
    }

    function record(entry) {
      if (session.entries.length >= MAX_ENTRIES_PER_SESSION) return null;
      var time = now().toISOString();
      var line = { time: time };
      Object.keys(entry).forEach(function (key) { line[key] = entry[key]; });
      session.entries.push(line);
      if (!session.startedAt) session.startedAt = time;
      session.lastAt = time;
      persistSession();
      notify();
      return line;
    }

    return {
      record: record,
      nextItem: nextItem,
      currentSession: function () { return session; },
      allSessions: allSessions,
      savedSessions: savedSessions,
      savingEnabled: savingEnabled,
      storageAvailable: function () { return !!storage; },
      setSaving: setSaving,
      clearSaved: clearSaved,
      lastError: function () { return lastError; },
      droppedSessions: function () { return droppedSessions; },
      isFull: function () { return session.entries.length >= MAX_ENTRIES_PER_SESSION; },
      subscribe: function (fn) { listeners.push(fn); }
    };
  }

  global.PracticeLog = {
    STORAGE_KEY: STORAGE_KEY,
    MAX_ENTRIES_PER_SESSION: MAX_ENTRIES_PER_SESSION,
    create: create,
    current: create()   // nhật ký dùng chung của trang
  };
})(window);
