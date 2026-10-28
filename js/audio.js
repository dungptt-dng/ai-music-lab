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
   * ---------- Mở khóa âm thanh trên điện thoại ----------
   * - iPhone/iPad: khi gạt công tắc im lặng, Web Audio bị tắt tiếng. Báo cho trình duyệt đây là
   *   âm thanh "phát lại" như video (navigator.audioSession); iOS cũ không có API này thì phát kèm
   *   một đoạn <audio> im lặng để chuyển sang kênh phát lại.
   * - Màn hình cảm ứng chỉ cho phát âm khi nhấc ngón tay (pointerup/touchend/click). Mỗi lần như vậy
   *   đánh thức lại mọi AudioContext đang bị treo (ví dụ sau khi khóa màn hình hoặc có cuộc gọi).
   */
  var GESTURE_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'];
  var knownContexts = [];
  var silentAudio = null;

  function isIos() {
    var nav = global.navigator;
    return /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  }

  // Tệp WAV im lặng 0,1 giây (8 kHz, 8 bit, một kênh).
  function silentWavUrl() {
    var samples = 800, bytes = new Uint8Array(44 + samples), view = new DataView(bytes.buffer);
    function text(offset, s) { for (var i = 0; i < s.length; i++) bytes[offset + i] = s.charCodeAt(i); }
    text(0, 'RIFF'); view.setUint32(4, 36 + samples, true); text(8, 'WAVE');
    text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 8000, true); view.setUint32(28, 8000, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
    text(36, 'data'); view.setUint32(40, samples, true);
    for (var i = 44; i < bytes.length; i++) bytes[i] = 128;   // 128 = im lặng với mẫu 8 bit
    var binary = '';
    for (var j = 0; j < bytes.length; j++) binary += String.fromCharCode(bytes[j]);
    return 'data:audio/wav;base64,' + global.btoa(binary);
  }

  function usePlaybackChannel() {
    var session = global.navigator.audioSession;
    if (session) {
      try { session.type = 'playback'; } catch (err) { /* trình duyệt không cho đổi */ }
      return;
    }
    if (!isIos() || document.visibilityState === 'hidden') return;
    if (!silentAudio) {
      silentAudio = document.createElement('audio');
      silentAudio.setAttribute('x-webkit-airplay', 'deny');
      silentAudio.setAttribute('playsinline', '');
      silentAudio.loop = true;
      silentAudio.src = silentWavUrl();
    }
    if (silentAudio.paused) {
      var playing = silentAudio.play();
      if (playing && playing.catch) playing.catch(function () { /* thử lại ở lần chạm sau */ });
    }
  }

  function wake(ctx) {
    if (ctx.state !== 'running' && ctx.state !== 'closed' && ctx.resume) {
      ctx.resume().catch(function () { /* thử lại ở lần chạm sau */ });
    }
  }

  // Các module khác (SoundFx) đăng ký AudioContext của mình để được đánh thức cùng.
  function registerContext(ctx) {
    if (knownContexts.indexOf(ctx) !== -1) return;
    knownContexts.push(ctx);
    // iOS cũ chỉ mở khóa khi có một nguồn âm được phát ngay trong lúc chạm.
    try {
      var source = ctx.createBufferSource();
      source.buffer = ctx.createBuffer(1, 1, 22050);
      source.connect(ctx.destination);
      source.start(0);
    } catch (err) { /* không cần với trình duyệt mới */ }
  }

  function onUserGesture(event) {
    if (!event.isTrusted) return;
    usePlaybackChannel();
    knownContexts.forEach(wake);
  }

  if (global.navigator.audioSession) usePlaybackChannel();
  GESTURE_EVENTS.forEach(function (type) { global.addEventListener(type, onUserGesture, true); });
  document.addEventListener('visibilitychange', function () {
    if (silentAudio && document.visibilityState === 'hidden') silentAudio.pause();
  });

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
        registerContext(context);
      }
      usePlaybackChannel();
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
   * options.gap / options.noteDuration: khoảng cách và độ vang chung cho mọi nốt (giây);
   * options.gaps / options.noteDurations (mảng, tuỳ chọn): riêng từng nốt – dùng cho nốt đen,
   * nốt trắng, nốt tròn có độ dài khác nhau.
   */
  function sequenceTiming(count, options) {
    var gap = options.gap || 0.6;
    var noteDuration = options.noteDuration || 0.9;
    var starts = [], durations = [], t = 0;
    for (var i = 0; i < count; i++) {
      starts.push(t);
      durations.push(options.noteDurations ? options.noteDurations[i] : noteDuration);
      t += options.gaps ? options.gaps[i] : gap;
    }
    return { starts: starts, durations: durations, total: count ? starts[count - 1] + durations[count - 1] : 0 };
  }

  function playSequence(frequencies, options) {
    options = options || {};
    var timing = sequenceTiming(frequencies.length, options);
    stopAll();
    return ensureRunning().then(function (ctx) {
      var start = ctx.currentTime + 0.05;
      frequencies.forEach(function (frequency, index) {
        activeVoices.push(scheduleVoice(ctx, masterGain, frequency, start + timing.starts[index], timing.durations[index]));
        sequenceTimers.push(setTimeout(function () {
          if (options.onStep) options.onStep(index);
        }, 50 + timing.starts[index] * 1000));
      });
      sequenceTimers.push(setTimeout(function () {
        sequenceTimers = [];
        if (options.onDone) options.onDone();
      }, 50 + timing.total * 1000));
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
    registerContext: registerContext,
    playNote: playNote,
    playSequence: playSequence,
    sequenceTiming: sequenceTiming,
    stopAll: stopAll,
    setVolume: setVolume,
    getVolume: function () { return volume; },
    renderNoteOffline: renderNoteOffline
  };
})(window);
