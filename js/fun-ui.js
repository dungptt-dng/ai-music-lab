/*
 * AI MUSIC LAB – Phần "vui mắt" của giao diện: linh vật Bé Nốt, trang chủ, nút bật/tắt âm thanh,
 * pháo giấy khi hoàn thành bài.
 *
 * Linh vật chỉ là hình vẽ phản ứng theo kết quả (vui khi đúng, động viên khi chưa đúng);
 * không phải trợ lý AI và không tự chấm điểm. Lời phản hồi chính vẫn nằm trong từng hoạt động.
 */
(function (global) {
  'use strict';

  var shared = global.AppShared;
  var escapeHtml = shared.escapeHtml;

  // Màu cầu vồng của 8 nốt (Đỏ – Cam – Vàng – Lục – Lam ngọc – Lam – Chàm – Tím), giống chuông màu ở trường tiểu học.
  var NOTE_COLORS = {
    C4: '#e53950', D4: '#f57c1f', E4: '#e0a800', F4: '#2fa84f',
    G4: '#11a3a3', A4: '#2f7de1', B4: '#5b4fd6', C5: '#b445c9'
  };

  var ACTIVITIES = [
    { view: 'khuong-nhac', icon: '🎼', name: 'Khuông nhạc', desc: 'Chạm nốt để nghe và xem tên', color: '#5b4fd6' },
    { view: 'nghe-cao-do', icon: '👂', name: 'Nghe cao độ', desc: 'Nghe âm thanh, đoán nốt', color: '#11a3a3' },
    { view: 'trac-nghiem', icon: '✅', name: 'Trắc nghiệm', desc: 'Trả lời câu hỏi vui', color: '#2fa84f' },
    { view: 'keo-tha', icon: '🎯', name: 'Kéo thả', desc: 'Đặt nốt lên khuông nhạc', color: '#f57c1f' },
    { view: 'sang-tao', icon: '🎹', name: 'Sáng tạo', desc: 'Ghép giai điệu của em', color: '#e53950' },
    { view: 'bao-cao', icon: '📊', name: 'Báo cáo', desc: 'Xem em đã học được gì', color: '#2f7de1' }
  ];

  var REACTIONS = {
    happy: ['Giỏi quá!', 'Đúng rồi!', 'Tuyệt vời!', 'Hay lắm!'],
    oops: ['Thử lại nhé!', 'Gần đúng rồi!', 'Cố lên nào!'],
    party: ['Hoan hô!', 'Em làm được rồi!', 'Xuất sắc!']
  };

  // Linh vật Bé Nốt: một nốt móc đơn có mắt và miệng cười. viewBox 64 × 64.
  function mascotSvg(extraClass) {
    return '<svg class="mascot ' + (extraClass || '') + '" viewBox="0 0 64 64" aria-hidden="true" focusable="false">' +
      '<g class="mascot-body">' +
        '<rect x="40" y="6" width="5" height="38" rx="2.5" fill="#3f35a8"/>' +
        '<path d="M44 6 C56 10 61 20 54 31 C55 22 51 17 44 15 Z" fill="#ff8a3d"/>' +
        '<ellipse cx="30" cy="45" rx="16" ry="12.5" fill="#5b4fd6" transform="rotate(-18 30 45)"/>' +
        '<circle cx="24" cy="42" r="4.2" fill="#fff"/><circle cx="35" cy="39.5" r="4.2" fill="#fff"/>' +
        '<circle class="mascot-pupil" cx="24.8" cy="42.6" r="2.2" fill="#2a2740"/>' +
        '<circle class="mascot-pupil" cx="35.8" cy="40.1" r="2.2" fill="#2a2740"/>' +
        '<circle cx="18.5" cy="48" r="2.6" fill="#ff9cc0" opacity="0.85"/>' +
        '<circle cx="40.5" cy="44.5" r="2.6" fill="#ff9cc0" opacity="0.85"/>' +
        '<path class="mascot-smile" d="M24 49 Q31 55 37 47.5" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
        '<path class="mascot-o" d="M28.5 50.5 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0" fill="#fff"/>' +
      '</g>' +
    '</svg>';
  }

  // ---------- Linh vật ở đầu trang ----------
  var headerMascot = null, bubble = null, moodTimer = null;

  function react(mood) {
    if (!headerMascot) return;
    clearTimeout(moodTimer);
    headerMascot.setAttribute('data-mood', 'idle');
    void headerMascot.offsetWidth;                 // cho hiệu ứng chạy lại khi phản ứng liên tiếp
    headerMascot.setAttribute('data-mood', mood);
    var words = REACTIONS[mood];
    bubble.textContent = words[Math.floor(Math.random() * words.length)];
    moodTimer = setTimeout(function () { headerMascot.setAttribute('data-mood', 'idle'); }, mood === 'party' ? 2200 : 1300);
  }

  // ---------- Nút bật/tắt âm thanh ----------
  function renderSoundBar(bar) {
    var fx = global.SoundFx;
    var effects = bar.querySelector('[data-sound="effects"]');
    var music = bar.querySelector('[data-sound="music"]');
    effects.setAttribute('aria-pressed', String(fx.effectsOn()));
    music.setAttribute('aria-pressed', String(fx.musicOn()));
    var paused = fx.musicOn() && !fx.musicAllowed();
    music.classList.toggle('is-paused', paused);
    music.querySelector('.sound-state').textContent = !fx.musicOn() ? 'Tắt' : (paused ? 'Tạm dừng' : 'Bật');
    effects.querySelector('.sound-state').textContent = fx.effectsOn() ? 'Bật' : 'Tắt';
    music.title = paused ? 'Nhạc nền tạm dừng ở hoạt động luyện nghe để em nghe rõ cao độ.' : 'Nhạc nền nhẹ, tự im khi bài học phát nốt.';
  }

  function mountHeader() {
    var mark = document.querySelector('.brand-mark');
    if (mark) {
      mark.classList.add('mascot-wrap');
      mark.setAttribute('data-mood', 'idle');
      mark.innerHTML = mascotSvg() + '<span class="mascot-bubble" aria-hidden="true"></span>';
      headerMascot = mark;
      bubble = mark.querySelector('.mascot-bubble');
    }
    var bar = document.querySelector('.sound-bar');
    if (!bar) return;
    bar.innerHTML =
      '<button type="button" class="sound-toggle" data-sound="effects" aria-pressed="true">' +
        '<span aria-hidden="true">🔔</span> Âm hiệu ứng: <span class="sound-state">Bật</span></button>' +
      '<button type="button" class="sound-toggle" data-sound="music" aria-pressed="false">' +
        '<span aria-hidden="true">🎵</span> Nhạc nền: <span class="sound-state">Tắt</span></button>';
    bar.addEventListener('click', function (event) {
      var button = event.target.closest('[data-sound]');
      if (!button) return;
      var fx = global.SoundFx;
      if (button.getAttribute('data-sound') === 'effects') fx.setEffects(!fx.effectsOn());
      else fx.setMusic(!fx.musicOn());
    });
    global.SoundFx.subscribe(function () { renderSoundBar(bar); });
    renderSoundBar(bar);
  }

  // ---------- Pháo giấy ----------
  function confetti() {
    if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
    var layer = document.createElement('div');
    layer.className = 'confetti';
    layer.setAttribute('aria-hidden', 'true');
    var colors = Object.keys(NOTE_COLORS).map(function (k) { return NOTE_COLORS[k]; });
    var html = '';
    for (var i = 0; i < 70; i++) {
      var shape = i % 5 === 0 ? 'is-note' : (i % 2 ? 'is-round' : '');
      html += '<i class="' + shape + '" style="left:' + (Math.random() * 100).toFixed(1) + '%;' +
        'background:' + (shape === 'is-note' ? 'transparent' : colors[i % colors.length]) + ';' +
        'color:' + colors[i % colors.length] + ';' +
        'animation-delay:' + (Math.random() * 0.5).toFixed(2) + 's;' +
        'animation-duration:' + (1.6 + Math.random() * 1.2).toFixed(2) + 's;' +
        '--drift:' + Math.round(Math.random() * 160 - 80) + 'px;' +
        '--spin:' + Math.round(Math.random() * 720 - 360) + 'deg">' + (shape === 'is-note' ? '♪' : '') + '</i>';
    }
    layer.innerHTML = html;
    document.body.appendChild(layer);
    setTimeout(function () { layer.remove(); }, 3400);
    return layer;
  }

  // ---------- Trang chủ ----------
  var HOME_TEMPLATE =
    '<div class="home-hero">' +
      mascotSvg('mascot-big') +
      '<div>' +
        '<h2 class="home-title">Chào em! Cùng chơi với nốt nhạc nào!</h2>' +
        '<p class="home-lead">Em sẽ nhìn, nghe, kéo thả và sáng tạo với 8 nốt từ Đô₄ đến Đô₅. ' +
          'Nhớ bật loa nhé – mỗi lần làm đúng sẽ có tiếng chuông vui!</p>' +
      '</div>' +
    '</div>' +
    '<p class="home-try">Thử bấm 8 phím cầu vồng:</p>' +
    '<div class="rainbow-keys" data-ref="keys"></div>' +
    '<p class="audio-alert" data-ref="audioAlert" hidden></p>' +
    '<h3 class="home-pick">Chọn một hoạt động để bắt đầu</h3>' +
    '<div class="home-grid">' +
      ACTIVITIES.map(function (a) {
        return '<a class="home-card" href="#' + a.view + '" style="--card:' + a.color + '">' +
          '<span class="home-card-icon" aria-hidden="true">' + a.icon + '</span>' +
          '<span class="home-card-name">' + escapeHtml(a.name) + '</span>' +
          '<span class="home-card-desc">' + escapeHtml(a.desc) + '</span>' +
          '<span class="home-card-go" aria-hidden="true">Bắt đầu ▶</span>' +
        '</a>';
      }).join('') +
    '</div>';

  function mountHome(root, options) {
    options = options || {};
    var audio = options.audio || global.AudioEngine;
    root.classList.add('activity', 'home');
    root.innerHTML = HOME_TEMPLATE;
    var refs = shared.collectRefs(root);
    refs.keys.innerHTML = global.MusicNotes.NOTES.map(function (n) {
      return '<button type="button" class="rainbow-key" data-key-note="' + n.id + '" style="--key:' + NOTE_COLORS[n.id] + '" ' +
        'aria-label="Phát nốt ' + escapeHtml(n.label) + '"><span>' + escapeHtml(n.label) + '</span></button>';
    }).join('');
    refs.keys.addEventListener('click', function (event) {
      var key = event.target.closest('[data-key-note]');
      if (!key) return;
      var note = global.MusicNotes.findNote(key.getAttribute('data-key-note'));
      key.classList.remove('is-ringing');
      void key.offsetWidth;
      key.classList.add('is-ringing');
      audio.playNote(note.frequency, 0.9).then(function () {
        refs.audioAlert.hidden = true;
      }, function (error) {
        refs.audioAlert.textContent = shared.audioErrorMessage(error);
        refs.audioAlert.hidden = false;
      });
    });
    return { root: root };
  }

  global.FunUi = {
    NOTE_COLORS: NOTE_COLORS,
    ACTIVITIES: ACTIVITIES,
    mountHeader: mountHeader,
    mountHome: mountHome,
    react: react,
    confetti: confetti
  };
})(window);
