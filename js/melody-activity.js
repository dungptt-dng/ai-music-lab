/*
 * AI MUSIC LAB – Hoạt động 5: Phòng sáng tạo giai điệu
 *
 * Học sinh tự chọn và sắp xếp các nốt (trong 8 nốt đã học) thành một giai điệu ngắn,
 * nghe lại, rồi viết ý tưởng / cảm xúc / câu chuyện của giai điệu.
 * Phòng sáng tạo KHÔNG dùng AI và không tự sáng tác: giai điệu do học sinh tạo ra.
 *
 * Giai điệu chỉ được lưu khi học sinh bấm "Lưu": tải về máy một file JSON (chuỗi nốt và ý tưởng)
 * hoặc ảnh PNG của khuông nhạc. Không gửi lên máy chủ, không cần họ tên.
 */
(function (global) {
  'use strict';

  var shared = global.AppShared;
  var escapeHtml = shared.escapeHtml;
  var NOTES = global.MusicNotes.NOTES;

  var MAX_NOTES = 16;
  var NOTES_PER_ROW = 8;
  var TITLE_MAX = 60;
  var IDEA_MAX = 500;
  var TEMPOS = [
    { bpm: 72, name: 'Chậm' },
    { bpm: 100, name: 'Vừa' },
    { bpm: 132, name: 'Nhanh' }
  ];
  // Mẫu khởi đầu theo quy tắc đơn giản (đi lên, đi xuống, nhảy bậc) để học sinh có điểm xuất phát.
  var PATTERNS = [
    { name: 'Đi lên', notes: ['C4', 'D4', 'E4', 'F4', 'G4'] },
    { name: 'Đi xuống', notes: ['G4', 'F4', 'E4', 'D4', 'C4'] },
    { name: 'Nhảy bậc', notes: ['C4', 'E4', 'G4', 'E4', 'C4'] }
  ];
  var FILE_TYPE = 'ai-music-lab/giai-dieu';
  var CLEAR_CONFIRM_MS = 3000;

  var TEMPLATE =
    '<div class="activity-head">' +
      '<h2 class="activity-title">Phòng sáng tạo giai điệu</h2>' +
    '</div>' +
    '<p class="level-desc">Chạm vào các nốt để tạo giai điệu của em (tối đa ' + MAX_NOTES + ' nốt). ' +
      'Chạm vào một nốt trong giai điệu để đổi chỗ hoặc xóa nốt đó.</p>' +
    '<div class="palette melody-palette" data-ref="palette">' +
      NOTES.map(function (n) {
        return '<button type="button" class="choice" data-add="' + n.id + '">' +
          '<span class="choice-name">' + escapeHtml(n.label) + '</span><span class="choice-symbol">' + n.symbol + '</span></button>';
      }).join('') +
    '</div>' +
    '<div class="pattern-row"><span>Bắt đầu từ mẫu:</span>' +
      PATTERNS.map(function (p, i) {
        return '<button type="button" class="btn btn-ghost btn-small" data-pattern="' + i + '">' + p.name + '</button>';
      }).join('') +
    '</div>' +
    '<div class="staff-card melody-staff" data-ref="staffHost"></div>' +
    '<div class="sequence" data-ref="sequence" aria-label="Chuỗi nốt của giai điệu"></div>' +
    '<div class="toolbar edit-bar">' +
      '<button type="button" class="btn btn-ghost" data-ref="moveLeft">◀ Lùi</button>' +
      '<button type="button" class="btn btn-ghost" data-ref="moveRight">Tiến ▶</button>' +
      '<button type="button" class="btn btn-ghost" data-ref="removeNote">✕ Xóa nốt đã chọn</button>' +
    '</div>' +
    '<div class="toolbar">' +
      '<button type="button" class="btn btn-play" data-ref="playButton">▶ Phát giai điệu</button>' +
      '<label class="field">Tốc độ <select data-ref="tempoSelect">' +
        TEMPOS.map(function (t) { return '<option value="' + t.bpm + '">' + t.name + '</option>'; }).join('') +
      '</select></label>' +
      '<button type="button" class="btn btn-ghost" data-ref="clearButton">🔄 Làm mới</button>' +
      shared.VOLUME_SLIDER_HTML +
    '</div>' +
    '<p class="audio-alert" data-ref="audioAlert" role="alert" hidden></p>' +
    '<div class="idea-box">' +
      '<label class="idea-label">Tên giai điệu ' +
        '<input type="text" data-ref="titleInput" maxlength="' + TITLE_MAX + '" placeholder="Ví dụ: Buổi sáng ở sân trường"></label>' +
      '<label class="idea-label">Giai điệu của em gợi cảm xúc, hình ảnh hay câu chuyện gì?' +
        '<textarea data-ref="ideaInput" rows="3" maxlength="' + IDEA_MAX + '" ' +
        'placeholder="Ví dụ: Giai điệu đi lên giống như em đang leo cầu thang, càng lên càng vui."></textarea></label>' +
      '<p class="idea-tips">Gợi ý: Giai điệu đi lên hay đi xuống? Vui hay buồn? Nhanh hay chậm? Em nghĩ đến ai hoặc nơi nào?</p>' +
    '</div>' +
    '<div class="toolbar">' +
      '<button type="button" class="btn btn-primary" data-ref="saveJson">⬇ Lưu giai điệu (JSON)</button>' +
      '<button type="button" class="btn btn-ghost" data-ref="saveImage">🖼 Lưu ảnh khuông nhạc (PNG)</button>' +
      '<button type="button" class="btn btn-ghost" data-ref="openButton">📂 Mở giai điệu đã lưu</button>' +
      '<input type="file" accept=".json,application/json" data-ref="fileInput" hidden>' +
    '</div>' +
    '<p class="find-feedback" data-ref="message" aria-live="polite">&nbsp;</p>' +
    '<p class="honest-note">Phòng sáng tạo không dùng AI: giai điệu do chính em tạo. Giai điệu chỉ được lưu khi em bấm “Lưu” ' +
      '(tải file về máy này). Không cần ghi họ tên.</p>';

  /*
   * Đọc và kiểm tra file giai điệu. Trả về { notes, title, idea, tempo } hoặc ném lỗi có lời nhắn dễ hiểu.
   */
  function parseMelodyFile(text) {
    var data;
    try { data = JSON.parse(text); } catch (err) { throw new Error('File không đúng định dạng JSON.'); }
    if (!data || data.type !== FILE_TYPE) throw new Error('Đây không phải file giai điệu của AI MUSIC LAB.');
    if (!Array.isArray(data.notes) || data.notes.length === 0) throw new Error('File không có nốt nào.');
    if (data.notes.length > MAX_NOTES) throw new Error('Giai điệu có quá ' + MAX_NOTES + ' nốt.');
    data.notes.forEach(function (id) {
      if (!global.MusicNotes.findNote(id)) throw new Error('File có nốt không hợp lệ: ' + String(id).slice(0, 10));
    });
    var tempo = TEMPOS.some(function (t) { return t.bpm === data.tempo; }) ? data.tempo : TEMPOS[1].bpm;
    return {
      notes: data.notes.slice(),
      title: String(data.title || '').slice(0, TITLE_MAX),
      idea: String(data.idea || '').slice(0, IDEA_MAX),
      tempo: tempo
    };
  }

  /*
   * options.audio    – bộ phát âm thanh (mặc định AudioEngine)
   * options.download – hàm (tênFile, blob) để lưu file (mặc định tải về bằng trình duyệt)
   * options.now      – hàm trả về thời điểm hiện tại (mặc định new Date())
   */
  function mount(root, options) {
    options = options || {};
    var audio = options.audio || global.AudioEngine;
    var download = options.download || shared.downloadBlob;
    var log = options.log || global.PracticeLog.current;
    var now = options.now || function () { return new Date(); };

    root.classList.add('activity');
    root.innerHTML = TEMPLATE;
    var refs = shared.collectRefs(root);
    refs.tempoSelect.value = String(TEMPOS[1].bpm);
    shared.bindVolumeSlider(refs.volume, audio);

    var state = {
      notes: [],          // id các nốt theo thứ tự giai điệu
      selected: null,     // vị trí nốt đang chọn trong giai điệu
      playing: false,
      playingIndex: null
    };
    var staffRows = [];
    var clearConfirmTimer = null;

    function setMessage(text, kind) {
      refs.message.className = 'find-feedback' + (kind ? ' ' + kind : '');
      refs.message.textContent = text || ' ';
    }
    function showAudioError(error) {
      refs.audioAlert.textContent = shared.audioErrorMessage(error);
      refs.audioAlert.hidden = false;
    }
    function clearAudioError() { refs.audioAlert.hidden = true; }

    // ---------- Hiển thị ----------
    function renderStaff() {
      refs.staffHost.innerHTML = '';
      staffRows = [];
      var rows = Math.max(1, Math.ceil(state.notes.length / NOTES_PER_ROW));
      for (var r = 0; r < rows; r++) {
        var rowNotes = state.notes.slice(r * NOTES_PER_ROW, (r + 1) * NOTES_PER_ROW).map(function (id, i) {
          var index = r * NOTES_PER_ROW + i;
          var note = global.MusicNotes.findNote(id);
          return {
            id: note.id, key: 'm' + index, step: note.step, ledgerSteps: note.ledgerSteps,
            label: note.label, symbol: note.symbol
          };
        });
        var staff = global.StaffRenderer.createStaff(refs.staffHost, rowNotes, {
          interactive: false,
          columns: NOTES_PER_ROW,
          ariaLabel: 'Giai điệu trên khuông nhạc, dòng ' + (r + 1)
        });
        staffRows.push(staff);
      }
      if (!state.notes.length) {
        var hint = document.createElement('p');
        hint.className = 'melody-empty';
        hint.textContent = 'Khuông nhạc đang trống. Hãy chạm vào các nốt phía trên để bắt đầu.';
        refs.staffHost.appendChild(hint);
      }
      markNotes();
    }

    function noteNode(index) {
      var staff = staffRows[Math.floor(index / NOTES_PER_ROW)];
      return staff ? staff.noteElement('m' + index) : null;
    }

    function markNotes() {
      state.notes.forEach(function (id, index) {
        var node = noteNode(index);
        if (!node) return;
        node.classList.toggle('is-selected', index === state.selected);
        node.classList.toggle('is-playing', index === state.playingIndex);
      });
      Array.prototype.forEach.call(refs.sequence.querySelectorAll('[data-index]'), function (chip) {
        var index = Number(chip.getAttribute('data-index'));
        chip.classList.toggle('is-selected', index === state.selected);
        chip.classList.toggle('is-playing', index === state.playingIndex);
        chip.setAttribute('aria-pressed', String(index === state.selected));
      });
    }

    function renderSequence() {
      refs.sequence.innerHTML = state.notes.length
        ? state.notes.map(function (id, index) {
            return '<button type="button" class="sequence-chip" data-index="' + index + '">' +
              '<span class="sequence-number">' + (index + 1) + '</span>' +
              escapeHtml(global.MusicNotes.findNote(id).label) + '</button>';
          }).join('')
        : '<span class="sequence-empty">Chưa có nốt nào.</span>';
    }

    function renderControls() {
      var hasSelection = state.selected !== null;
      refs.moveLeft.disabled = !hasSelection || state.selected === 0;
      refs.moveRight.disabled = !hasSelection || state.selected === state.notes.length - 1;
      refs.removeNote.disabled = !hasSelection;
      refs.playButton.disabled = !state.notes.length;
      refs.playButton.textContent = state.playing ? '■ Dừng' : '▶ Phát giai điệu';
      refs.saveJson.disabled = !state.notes.length;
      refs.saveImage.disabled = !state.notes.length;
      Array.prototype.forEach.call(refs.palette.querySelectorAll('[data-add]'), function (b) {
        b.disabled = state.notes.length >= MAX_NOTES;
      });
    }

    function render() {
      renderStaff();
      renderSequence();
      markNotes();
      renderControls();
    }

    // ---------- Chỉnh sửa giai điệu ----------
    function stopPlayback() {
      if (!state.playing) return;
      audio.stopAll();
      state.playing = false;
      state.playingIndex = null;
      markNotes();
      renderControls();
    }

    function addNotes(ids) {
      stopPlayback();
      var room = MAX_NOTES - state.notes.length;
      if (room <= 0) {
        setMessage('Giai điệu đã đủ ' + MAX_NOTES + ' nốt.', 'is-retry');
        return;
      }
      state.notes = state.notes.concat(ids.slice(0, room));
      state.selected = null;
      setMessage(ids.length > room ? 'Chỉ thêm được ' + room + ' nốt vì giai điệu tối đa ' + MAX_NOTES + ' nốt.' : '', ids.length > room ? 'is-retry' : '');
      render();
    }

    function move(offset) {
      var i = state.selected;
      var j = i + offset;
      if (i === null || j < 0 || j >= state.notes.length) return;
      stopPlayback();
      var tmp = state.notes[i];
      state.notes[i] = state.notes[j];
      state.notes[j] = tmp;
      state.selected = j;
      render();
    }

    function removeSelected() {
      if (state.selected === null) return;
      stopPlayback();
      state.notes.splice(state.selected, 1);
      state.selected = null;
      render();
    }

    function select(index) {
      state.selected = state.selected === index ? null : index;
      var note = global.MusicNotes.findNote(state.notes[index]);
      if (state.selected !== null) audio.playNote(note.frequency).then(clearAudioError, showAudioError);
      markNotes();
      renderControls();
    }

    // Bấm "Làm mới" hai lần để xóa, tránh mất giai điệu do bấm nhầm.
    function clearMelody() {
      if (!state.notes.length && !refs.titleInput.value && !refs.ideaInput.value) return;
      if (!refs.clearButton.classList.contains('is-confirming')) {
        refs.clearButton.classList.add('is-confirming');
        refs.clearButton.textContent = 'Bấm lần nữa để xóa hết';
        clearConfirmTimer = setTimeout(resetClearButton, CLEAR_CONFIRM_MS);
        return;
      }
      resetClearButton();
      stopPlayback();
      state.notes = [];
      state.selected = null;
      refs.titleInput.value = '';
      refs.ideaInput.value = '';
      setMessage('Đã làm mới. Em hãy tạo giai điệu mới nhé!', '');
      render();
    }

    function resetClearButton() {
      clearTimeout(clearConfirmTimer);
      refs.clearButton.classList.remove('is-confirming');
      refs.clearButton.textContent = '🔄 Làm mới';
    }

    // ---------- Phát giai điệu ----------
    function play() {
      if (state.playing) { stopPlayback(); return; }
      if (!state.notes.length) return;
      var beat = 60 / Number(refs.tempoSelect.value);
      log.record({ kind: 'action', activity: 'sang-tao', action: 'play', detail: 'Phát giai điệu ' + state.notes.length + ' nốt' });
      state.playing = true;
      renderControls();
      audio.playSequence(state.notes.map(function (id) { return global.MusicNotes.findNote(id).frequency; }), {
        gap: beat,
        noteDuration: Math.min(0.9, beat * 0.92),
        onStep: function (index) {
          state.playingIndex = index;
          markNotes();
        },
        onDone: function () {
          state.playing = false;
          state.playingIndex = null;
          markNotes();
          renderControls();
        }
      }).then(clearAudioError, function (error) {
        state.playing = false;
        renderControls();
        showAudioError(error);
      });
    }

    // ---------- Lưu và mở ----------
    function melodyData() {
      return {
        app: 'AI MUSIC LAB',
        type: FILE_TYPE,
        version: 1,
        savedAt: now().toISOString(),
        title: refs.titleInput.value.trim(),
        idea: refs.ideaInput.value.trim(),
        tempo: Number(refs.tempoSelect.value),
        notes: state.notes.slice(),
        noteNames: state.notes.map(function (id) { return global.MusicNotes.findNote(id).label; })
      };
    }

    function saveJson() {
      if (!state.notes.length) return;
      var data = melodyData();
      try {
        download(shared.fileSlug(data.title, 'giai-dieu') + '.json', new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        setMessage('Đã lưu giai điệu thành file JSON trên máy này.', 'is-good');
        log.record({ kind: 'action', activity: 'sang-tao', action: 'save-json', detail: 'Lưu file giai điệu ' + data.notes.length + ' nốt' });
      } catch (err) {
        setMessage('Chưa lưu được file. Hãy thử lại hoặc dùng trình duyệt khác.', 'is-retry');
      }
    }

    /*
     * Ảnh PNG: ghép các dòng khuông thành một SVG, chép kiểu chữ/màu đang hiển thị vào từng phần tử
     * (vì ảnh không đọc được file CSS), rồi vẽ lên canvas.
     */
    var STYLE_PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity',
      'font-size', 'font-weight', 'font-family'];

    function inlineStyles(source, target) {
      var computed = getComputedStyle(source);
      target.setAttribute('style', STYLE_PROPS.map(function (p) {
        return p + ':' + computed.getPropertyValue(p);
      }).join(';'));
      for (var i = 0; i < source.children.length; i++) inlineStyles(source.children[i], target.children[i]);
    }

    function buildImageSvg() {
      var NS = 'http://www.w3.org/2000/svg';
      var first = staffRows[0].svg.viewBox.baseVal;
      var rowWidth = first.width, rowHeight = first.height;
      var headerHeight = 70, padding = 20;
      var width = rowWidth + padding * 2;
      var height = headerHeight + staffRows.length * rowHeight + padding;
      var out = document.createElementNS(NS, 'svg');
      out.setAttribute('xmlns', NS);
      out.setAttribute('width', width * 2);
      out.setAttribute('height', height * 2);
      out.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
      var bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('width', width); bg.setAttribute('height', height); bg.setAttribute('fill', '#ffffff');
      out.appendChild(bg);
      var title = document.createElementNS(NS, 'text');
      title.setAttribute('x', padding); title.setAttribute('y', 34);
      title.setAttribute('style', 'font: 800 22px Nunito, Segoe UI, Arial, sans-serif; fill: #5b4fd6');
      title.textContent = refs.titleInput.value.trim() || 'Giai điệu của em';
      out.appendChild(title);
      var sub = document.createElementNS(NS, 'text');
      sub.setAttribute('x', padding); sub.setAttribute('y', 58);
      sub.setAttribute('style', 'font: 600 13px Nunito, Segoe UI, Arial, sans-serif; fill: #5e5a78');
      sub.textContent = 'AI MUSIC LAB · ' + state.notes.length + ' nốt · ' +
        state.notes.map(function (id) { return global.MusicNotes.findNote(id).label; }).join(' ');
      out.appendChild(sub);
      staffRows.forEach(function (staff, r) {
        var group = document.createElementNS(NS, 'g');
        group.setAttribute('transform', 'translate(' + padding + ' ' + (headerHeight + r * rowHeight) + ')');
        var clone = staff.svg.cloneNode(true);
        inlineStyles(staff.svg, clone);
        Array.prototype.slice.call(clone.childNodes).forEach(function (child) { group.appendChild(child); });
        out.appendChild(group);
      });
      return { svg: out, width: width * 2, height: height * 2 };
    }

    function saveImage() {
      if (!state.notes.length) return Promise.resolve();
      stopPlayback();
      var built = buildImageSvg();
      var markup = new XMLSerializer().serializeToString(built.svg);
      var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
      return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () {
          var canvas = document.createElement('canvas');
          canvas.width = built.width;
          canvas.height = built.height;
          canvas.getContext('2d').drawImage(img, 0, 0);
          canvas.toBlob(function (blob) {
            if (!blob) { reject(new Error('toBlob')); return; }
            download(shared.fileSlug(refs.titleInput.value.trim(), 'giai-dieu') + '.png', blob);
            resolve();
          }, 'image/png');
        };
        img.onerror = function () { reject(new Error('image')); };
        img.src = url;
      }).then(function () {
        setMessage('Đã lưu ảnh khuông nhạc (PNG) trên máy này.', 'is-good');
        log.record({ kind: 'action', activity: 'sang-tao', action: 'save-image', detail: 'Lưu ảnh giai điệu ' + state.notes.length + ' nốt' });
      }, function () {
        setMessage('Chưa tạo được ảnh. Em vẫn có thể lưu giai điệu bằng file JSON.', 'is-retry');
      });
    }

    function loadMelodyText(text) {
      try {
        var melody = parseMelodyFile(text);
        stopPlayback();
        state.notes = melody.notes;
        state.selected = null;
        refs.titleInput.value = melody.title;
        refs.ideaInput.value = melody.idea;
        refs.tempoSelect.value = String(melody.tempo);
        setMessage('Đã mở giai điệu ' + (melody.title ? '“' + melody.title + '”' : '') + ' (' + melody.notes.length + ' nốt).', 'is-good');
        render();
        log.record({ kind: 'action', activity: 'sang-tao', action: 'open', detail: 'Mở file giai điệu ' + melody.notes.length + ' nốt' });
        return true;
      } catch (err) {
        setMessage('Không mở được file: ' + err.message, 'is-retry');
        return false;
      }
    }

    // ---------- Sự kiện ----------
    refs.palette.addEventListener('click', function (event) {
      var button = event.target.closest('[data-add]');
      if (!button) return;
      var note = global.MusicNotes.findNote(button.getAttribute('data-add'));
      audio.playNote(note.frequency).then(clearAudioError, showAudioError);
      addNotes([note.id]);
    });
    root.querySelector('.pattern-row').addEventListener('click', function (event) {
      var button = event.target.closest('[data-pattern]');
      if (button) addNotes(PATTERNS[Number(button.getAttribute('data-pattern'))].notes);
    });
    refs.sequence.addEventListener('click', function (event) {
      var chip = event.target.closest('[data-index]');
      if (chip) select(Number(chip.getAttribute('data-index')));
    });
    refs.staffHost.addEventListener('click', function (event) {
      var node = event.target.closest('[data-key]');
      if (node) select(Number(node.getAttribute('data-key').slice(1)));
    });
    refs.moveLeft.addEventListener('click', function () { move(-1); });
    refs.moveRight.addEventListener('click', function () { move(1); });
    refs.removeNote.addEventListener('click', removeSelected);
    refs.playButton.addEventListener('click', play);
    refs.tempoSelect.addEventListener('change', stopPlayback);
    refs.clearButton.addEventListener('click', clearMelody);
    refs.saveJson.addEventListener('click', saveJson);
    refs.saveImage.addEventListener('click', saveImage);
    refs.openButton.addEventListener('click', function () { refs.fileInput.click(); });
    refs.fileInput.addEventListener('change', function () {
      var file = refs.fileInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () { loadMelodyText(String(reader.result)); };
      reader.onerror = function () { setMessage('Không đọc được file.', 'is-retry'); };
      reader.readAsText(file);
      refs.fileInput.value = '';
    });

    render();

    return {
      root: root,
      getState: function () { return state; },
      melodyData: melodyData,
      loadMelodyText: loadMelodyText,
      saveImage: saveImage,
      noteNode: noteNode
    };
  }

  global.MelodyActivity = { mount: mount, MAX_NOTES: MAX_NOTES, parseMelodyFile: parseMelodyFile };
})(window);
