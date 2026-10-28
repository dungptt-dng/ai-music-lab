/*
 * AI MUSIC LAB – Âm thanh vui cho giao diện (hiệu ứng, giai điệu chúc mừng, nhạc nền)
 *
 * - Tất cả được tổng hợp bằng Web Audio API, không dùng file ghi âm.
 * - Dùng AudioContext riêng, tách khỏi AudioEngine (âm thanh bài học), để tắt/bật độc lập.
 * - Chỉ phát sau khi người dùng thật sự chạm/nhấn phím (event.isTrusted); trước đó mọi lệnh đều bỏ qua.
 * - Âm hiệu ứng mặc định BẬT, nhạc nền mặc định TẮT. Lựa chọn chỉ nhớ trong trang đang mở,
 *   không ghi vào trình duyệt.
 * - Nhạc nền tự im khi bài học đang phát nốt (duck) và ở các hoạt động luyện nghe
 *   (do khung ứng dụng quyết định qua setMusicAllowed).
 */
(function (global) {
  'use strict';

  var AudioContextClass = global.AudioContext || global.webkitAudioContext;
  var VOLUME_EVENT = 'aiml-volume-change';
  var EFFECTS_LEVEL = 0.22;          // hiệu ứng nhỏ hơn âm thanh bài học (AudioEngine tối đa 0,35)
  var MUSIC_LEVEL = 0.06;            // nhạc nền rất nhỏ
  var FREQ = {
    G3: 196.00, A3: 220.00, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00,
    A4: 440.00, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00,
    B5: 987.77, C6: 1046.50, E6: 1318.51, G6: 1567.98
  };

  var context = null, masterGain = null, effectsBus = null, musicBus = null, musicDuck = null;
  var unlocked = false;
  var effectsOn = true, musicOn = false, musicAllowed = true;
  var volume = global.AudioEngine ? global.AudioEngine.getVolume() : 0.6;
  var musicTimer = null, nextBeatTime = 0, beatIndex = 0, duckUntil = 0;
  var listeners = [];

  function notify() { listeners.forEach(function (fn) { fn(); }); }

  // Chỉ coi là "đã mở khóa" khi có thao tác thật của người dùng (không tính sự kiện do mã giả lập).
  function onGesture(event) {
    if (!event.isTrusted || unlocked) return;
    unlocked = true;
    global.removeEventListener('pointerdown', onGesture, true);
    global.removeEventListener('keydown', onGesture, true);
  }
  global.addEventListener('pointerdown', onGesture, true);
  global.addEventListener('keydown', onGesture, true);

  function ready() {
    if (!unlocked || !AudioContextClass) return null;
    try {
      if (!context) {
        context = new AudioContextClass();
        masterGain = context.createGain();
        masterGain.gain.value = volume;
        masterGain.connect(context.destination);
        effectsBus = context.createGain();
        effectsBus.gain.value = EFFECTS_LEVEL;
        effectsBus.connect(masterGain);
        musicDuck = context.createGain();
        musicDuck.connect(masterGain);
        musicBus = context.createGain();
        musicBus.gain.value = MUSIC_LEVEL;
        musicBus.connect(musicDuck);
        if (global.AudioEngine) global.AudioEngine.registerContext(context);   // đánh thức lại trên điện thoại
      }
      if (context.state !== 'running' && context.resume) context.resume().catch(function () {});
    } catch (err) {
      return null;
    }
    return context;
  }

  // Một âm ngắn có đường bao mềm (không có tiếng "tách").
  function tone(destination, freq, start, duration, type, peak, glideTo) {
    var ctx = context;
    var osc = ctx.createOscillator();
    var env = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + duration);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(peak || 1, start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env);
    env.connect(destination);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  function effect(build, delay) {
    if (!effectsOn) return false;
    var ctx = ready();
    if (!ctx) return false;
    build(ctx.currentTime + 0.02 + (delay || 0));
    return true;
  }

  // ---------- Hiệu ứng ----------
  // Đúng: ba tiếng chuông sáng đi lên (Đô₆ – Mi₆ – Sol₆).
  function correct(delay) {
    return effect(function (t) {
      [FREQ.C6, FREQ.E6, FREQ.G6].forEach(function (f, i) { tone(effectsBus, f, t + i * 0.08, 0.22, 'triangle', 0.9); });
    }, delay);
  }

  // Chưa đúng: hai tiếng trầm, nhẹ nhàng (không phải tiếng còi chê bai).
  function wrong(delay) {
    return effect(function (t) {
      tone(effectsBus, 330, t, 0.16, 'sine', 0.7);
      tone(effectsBus, 262, t + 0.14, 0.24, 'sine', 0.6);
    }, delay);
  }

  // Bấm nút: tiếng "bóp" rất ngắn.
  function click() {
    return effect(function (t) { tone(effectsBus, 620, t, 0.07, 'sine', 0.5, 980); });
  }

  // Hoàn thành bài: giai điệu kèn ngắn Đô – Mi – Sol – Đô cao, kết bằng hợp âm Đô trưởng.
  function celebrate() {
    return effect(function (t) {
      var melody = [['C5', 0, 0.16], ['E5', 0.15, 0.16], ['G5', 0.3, 0.16], ['C6', 0.45, 0.3],
        ['G5', 0.75, 0.14], ['C6', 0.9, 0.7]];
      melody.forEach(function (n) { tone(effectsBus, FREQ[n[0]], t + n[1], n[2] + 0.1, 'triangle', 0.8); });
      ['C5', 'E5', 'G5'].forEach(function (name) { tone(effectsBus, FREQ[name], t + 0.9, 0.9, 'sine', 0.35); });
    });
  }

  // ---------- Nhạc nền: hộp nhạc nhẹ, vòng hợp âm Đô – La thứ – Pha – Sol ----------
  var BEAT = 0.3;                                   // 200 nốt móc đơn / phút
  var PATTERN = [
    ['C4', 'C5', 'E5', 'G5', 'E5', 'C5', 'G4', 'E5'],
    ['A3', 'A4', 'C5', 'E5', 'C5', 'A4', 'E4', 'C5'],
    ['F4', 'F4', 'A4', 'C5', 'A4', 'F4', 'C5', 'A4'],
    ['G3', 'G4', 'B4', 'D5', 'B4', 'G4', 'D5', 'B4']
  ];

  function scheduleMusic() {
    var ctx = context;
    while (nextBeatTime < ctx.currentTime + 0.6) {
      var bar = PATTERN[Math.floor(beatIndex / 8) % PATTERN.length];
      var slot = beatIndex % 8;
      if (slot === 0) tone(musicBus, FREQ[bar[0]], nextBeatTime, BEAT * 7.5, 'sine', 0.55);   // nốt trầm giữ cả ô nhịp
      else tone(musicBus, FREQ[bar[slot]], nextBeatTime, BEAT * 1.6, 'triangle', 0.5);
      nextBeatTime += BEAT;
      beatIndex += 1;
    }
    var target = (ctx.currentTime < duckUntil) ? 0.0001 : 1;
    musicDuck.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
  }

  function updateMusic() {
    var shouldPlay = musicOn && musicAllowed && !!ready();
    if (shouldPlay && !musicTimer) {
      nextBeatTime = context.currentTime + 0.1;
      musicDuck.gain.setValueAtTime(0.0001, context.currentTime);
      musicTimer = setInterval(scheduleMusic, 150);
      scheduleMusic();
    } else if (!shouldPlay && musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
      if (context) musicDuck.gain.setTargetAtTime(0.0001, context.currentTime, 0.05);
    }
  }

  // Bài học sắp phát nốt trong `seconds` giây: tạm im nhạc nền để học sinh nghe rõ cao độ.
  function duck(seconds) {
    if (!context) return;
    duckUntil = Math.max(duckUntil, context.currentTime + seconds + 0.2);
    musicDuck.gain.setTargetAtTime(0.0001, context.currentTime, 0.03);
  }

  function setEffects(on) { effectsOn = !!on; notify(); }
  function setMusic(on) { musicOn = !!on; updateMusic(); notify(); }
  function setMusicAllowed(allowed) { musicAllowed = !!allowed; updateMusic(); notify(); }

  // Dùng chung mức âm lượng với thanh trượt của các hoạt động.
  document.addEventListener(VOLUME_EVENT, function (event) {
    volume = event.detail.value;
    if (context) masterGain.gain.setTargetAtTime(volume, context.currentTime, 0.03);
  });

  global.SoundFx = {
    correct: correct,
    wrong: wrong,
    click: click,
    celebrate: celebrate,
    duck: duck,
    setEffects: setEffects,
    setMusic: setMusic,
    setMusicAllowed: setMusicAllowed,
    effectsOn: function () { return effectsOn; },
    musicOn: function () { return musicOn; },
    musicAllowed: function () { return musicAllowed; },
    musicPlaying: function () { return !!musicTimer; },
    hasContext: function () { return !!context; },
    subscribe: function (fn) { listeners.push(fn); }
  };
})(window);
