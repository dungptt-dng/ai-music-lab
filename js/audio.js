/*
 * AI MUSIC LAB – Phát âm thanh bằng Web Audio API (âm thanh tổng hợp, không dùng file ghi âm)
 *
 * - Chỉ khởi tạo AudioContext sau khi người dùng chạm/nhấn (chính sách chặn tự phát của trình duyệt).
 * - Âm lượng tối đa bị giới hạn (MAX_GAIN) để tránh âm quá to với học sinh.
 * - Mỗi nốt có đường bao âm lượng (tăng nhanh, tắt dần) để không có tiếng "tách".
 */
(function (global) {
  'use strict';

  var AudioContextClass = global.AudioContext || global.webkitAudioContext;
  var MAX_GAIN = 0.35;
  // Âm sắc mềm giống đàn: âm cơ bản + 2 hoạ âm nhỏ. Cao độ nghe được là âm cơ bản.
  var HARMONICS = [
    { multiple: 1, gain: 1 },
    { multiple: 2, gain: 0.28 },
    { multiple: 3, gain: 0.08 }
  ];

  var context = null;
  var masterGain = null;
  var volume = 0.6;
  var activeVoices = [];
  var sequenceTimers = [];

  function isSupported() {
    return !!AudioContextClass;
  }

  /*
   * Tạo các bộ dao động cho một nốt và nối vào đích. Dùng chung cho phát thật
   * và cho bản dựng offline trong trang kiểm thử (để đo tần số thực tế).
   */
  function scheduleVoice(ctx, destination, frequency, startTime, duration) {
    var envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, startTime);
    envelope.gain.exponentialRampToValueAtTime(1, startTime + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.25, startTime + duration * 0.45);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    envelope.connect(destination);

    var oscillators = HARMONICS.map(function (harmonic) {
      var osc = ctx.createOscillator();
      var partialGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency * harmonic.multiple, startTime);
      partialGain.gain.value = harmonic.gain / 1.36;
      osc.connect(partialGain);
      partialGain.connect(envelope);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
      return osc;
    });

    return { oscillators: oscillators, envelope: envelope, endTime: startTime + duration };
  }

  /*
   * Đảm bảo AudioContext đang chạy. Trả về Promise; bị từ chối với
   * error.code = 'unsupported' (trình duyệt không hỗ trợ) hoặc 'blocked' (bị chặn).
   */
  function ensureRunning() {
    if (!isSupported()) {
      var unsupported = new Error('Trình duyệt không hỗ trợ Web Audio API');
      unsupported.code = 'unsupported';
      return Promise.reject(unsupported);
    }
    try {
      if (!context) {
        context = new AudioContextClass();
        masterGain = context.createGain();
        masterGain.gain.value = volume * MAX_GAIN;
        masterGain.connect(context.destination);
      }
    } catch (err) {
      err.code = 'unsupported';
      return Promise.reject(err);
    }
    if (context.state === 'running') return Promise.resolve(context);

    var resumed = context.resume ? context.resume() : Promise.resolve();
    var timeout = new Promise(function (resolve) { setTimeout(resolve, 1200); });
    return Promise.race([resumed, timeout]).then(function () {
      if (context.state === 'running') return context;
      var blocked = new Error('Trình duyệt đang chặn âm thanh');
      blocked.code = 'blocked';
      throw blocked;
    });
  }

  function forgetFinishedVoices() {
    var now = context ? context.currentTime : 0;
    activeVoices = activeVoices.filter(function (voice) { return voice.endTime > now; });
  }

  function playNote(frequency, duration) {
    duration = duration || 1.1;
    return ensureRunning().then(function (ctx) {
      forgetFinishedVoices();
      activeVoices.push(scheduleVoice(ctx, masterGain, frequency, ctx.currentTime + 0.01, duration));
    });
  }

  /*
   * Phát lần lượt một dãy tần số. onStep(index) được gọi đúng lúc nốt thứ index vang lên
   * để giao diện đánh dấu nốt; onDone() gọi khi phát xong (không gọi nếu bị dừng giữa chừng).
   */
  function playSequence(frequencies, options) {
    options = options || {};
    var gap = options.gap || 0.6;
    var noteDuration = options.noteDuration || 0.9;
    stopAll();
    return ensureRunning().then(function (ctx) {
      var start = ctx.currentTime + 0.05;
      frequencies.forEach(function (frequency, index) {
        activeVoices.push(scheduleVoice(ctx, masterGain, frequency, start + index * gap, noteDuration));
        sequenceTimers.push(setTimeout(function () {
          if (options.onStep) options.onStep(index);
        }, 50 + index * gap * 1000));
      });
      sequenceTimers.push(setTimeout(function () {
        sequenceTimers = [];
        if (options.onDone) options.onDone();
      }, 50 + ((frequencies.length - 1) * gap + noteDuration) * 1000));
    });
  }

  function stopAll() {
    sequenceTimers.forEach(clearTimeout);
    sequenceTimers = [];
    if (!context) return;
    var now = context.currentTime;
    activeVoices.forEach(function (voice) {
      try {
        voice.envelope.gain.cancelScheduledValues(now);
        voice.envelope.gain.setTargetAtTime(0.0001, now, 0.02);
        voice.oscillators.forEach(function (osc) { osc.stop(now + 0.12); });
      } catch (err) { /* nốt đã dừng từ trước */ }
    });
    activeVoices = [];
  }

  // value: 0 → 1 (thanh trượt âm lượng trên giao diện)
  function setVolume(value) {
    volume = Math.max(0, Math.min(1, value));
    if (masterGain && context) {
      masterGain.gain.setTargetAtTime(volume * MAX_GAIN, context.currentTime, 0.03);
    }
  }

  /*
   * Dựng một nốt ra bộ đệm (không phát ra loa). Dùng trong trang kiểm thử
   * để đo tần số thực tế mà bộ tổng hợp tạo ra.
   */
  function renderNoteOffline(frequency, duration, sampleRate) {
    var OfflineClass = global.OfflineAudioContext || global.webkitOfflineAudioContext;
    if (!OfflineClass) return Promise.reject(new Error('Không có OfflineAudioContext'));
    sampleRate = sampleRate || 44100;
    var offline = new OfflineClass(1, Math.ceil(sampleRate * (duration + 0.1)), sampleRate);
    scheduleVoice(offline, offline.destination, frequency, 0, duration);
    return offline.startRendering();
  }

  global.AudioEngine = {
    isSupported: isSupported,
    ensureRunning: ensureRunning,
    playNote: playNote,
    playSequence: playSequence,
    stopAll: stopAll,
    setVolume: setVolume,
    getVolume: function () { return volume; },
    renderNoteOffline: renderNoteOffline
  };
})(window);
