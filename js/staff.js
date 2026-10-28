/*
 * AI MUSIC LAB – Vẽ khuông nhạc khóa Sol bằng SVG
 *
 * Toạ độ dọc của mỗi nốt được suy ra từ vị trí (MusicNotes.staffStep):
 *     y = yDòng1 − vị trí × (KHOẢNG_CÁCH_DÒNG / 2)
 * nên nốt luôn nằm chính xác trên dòng kẻ hoặc giữa hai dòng kẻ.
 */
(function (global) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  // Kích thước tính theo đơn vị của viewBox; SVG tự co giãn theo màn hình.
  var LINE_GAP = 20;                          // khoảng cách giữa hai dòng kẻ
  var STAFF_TOP = 60;                         // y của dòng 5 (trên cùng)
  var BOTTOM_LINE_Y = STAFF_TOP + 4 * LINE_GAP; // y của dòng 1 (dưới cùng)
  var STAFF_LEFT = 8;
  var FIRST_NOTE_X = 118;
  var NOTE_SPACING = 64;
  var NOTE_HEAD_RX = 12.5;
  var NOTE_HEAD_RY = 8.6;
  var STEM_LENGTH = 3.5 * LINE_GAP;           // độ dài thân nốt chuẩn: 3,5 khoảng
  var LEDGER_HALF_WIDTH = NOTE_HEAD_RX + 7;
  var LABEL_Y = 214;
  var SYMBOL_Y = 236;

  /*
   * Khóa Sol: đường viền nguyên bản của glyph gClef (U+E050) trong phông ký âm Bravura 1.482
   * (chuẩn SMuFL, © Steinberg Media Technologies GmbH, giấy phép SIL Open Font License 1.1 –
   * xem licenses/Bravura-OFL.txt). Đường viền được trích thẳng từ file Bravura.otf, không vẽ lại.
   * Đơn vị: 1 em = 1000, 1 khoảng dòng = 250; trục y hướng xuống như SVG.
   * Theo SMuFL, gốc toạ độ (y = 0) của gClef nằm đúng trên dòng Sol₄ – tâm vòng xoắn –
   * nên chỉ cần đặt gốc lên dòng 2 và co theo khoảng cách dòng.
   */
  var BRAVURA_G_CLEF_PATH =
    'M376-415C374-427 376-428 382-434C398-449 419-470 438-491C522-583 572-702 572-815' +
    'C572-902 548-988 507-1048C492-1070 466-1098 455-1098C441-1098 410-1072 390-1050' +
    'C316-968 292-843 292-739C292-681 299-616 306-575C308-563 309-561 297-551' +
    'C233-498 164-437 112-373C43-287 0-194 0-87C0 87 119 252 364 252C387 252 413 250 433 246' +
    'C444 244 446 243 448 255C460 322 475 409 475 456C475 604 375 622 316 622' +
    'C262 622 236 606 236 593C236 586 245 583 268 576C299 567 335 540 335 482' +
    'C335 427 300 380 239 380C172 380 132 433 132 495C132 560 171 658 322 658' +
    'C389 658 519 628 519 458C519 401 501 306 490 244C488 232 489 233 503 227' +
    'C604 187 671 102 671-11C671-139 577-252 430-252C404-252 404-252 401-270Z' +
    'M470-943C503-943 530-916 530-861C530-792 497-728 419-650C403-634 379-611 356-591' +
    'C349-585 345-586 343-599C339-625 337-659 337-691C337-847 409-943 470-943Z' +
    'M361-262C364-243 364-244 346-238C258-208 201-129 201-44C201 46 248 110 316 133' +
    'C324 136 336 139 343 139C351 139 355 134 355 128C355 121 347 118 340 115' +
    'C298 97 268 54 268 8C268-49 307-92 368-109C384-113 386-112 388-101L438 197' +
    'C440 208 439 208 424 211C408 214 388 216 368 216C193 216 80 119 80-20' +
    'C80-79 90-158 173-252C233-319 279-356 326-394C336-402 338-401 340-390Z' +
    'M430-103C428-115 429-118 441-117C522-110 589-42 589 46C589 109 551 160 495 188' +
    'C483 194 481 194 479 182Z';
  var SMUFL_STAFF_SPACE = 250;                 // một khoảng dòng tính theo đơn vị phông
  var CLEF_SCALE = LINE_GAP / SMUFL_STAFF_SPACE;
  var G_LINE_STEP = 2;                         // dòng 2 = Sol₄ (vị trí 2 tính từ dòng 1)
  var CLEF_X = STAFF_LEFT + 12;

  /*
   * Các glyph khác cũng trích nguyên từ Bravura 1.482 (cùng đơn vị, gốc y = 0 ở giữa glyph):
   * đầu nốt trắng (noteheadHalf U+E0A3), đầu nốt tròn (noteheadWhole U+E0A2) và
   * chữ số chỉ nhịp (timeSig2–4, U+E082–E084). Nốt đen vẫn vẽ bằng hình elip như các hoạt động khác.
   */
  var BRAVURA_GLYPHS = {
    noteheadHalf: { width: 295, d:
      'M97 125C262 125 295-9 295-42C295-93 254-125 196-125C47-125 0-10 0 42C0 95 42 125 97 125Z' +
      'M173 46C128 76 97 87 75 87C54 87 42 76 35 64C32 58 29 51 29 44C29 22 51-5 120-45' +
      'C170-74 201-84 221-84C240-84 251-75 258-63C261-57 264-51 264-44C264-24 243 0 173 46Z' },
    noteheadWhole: { width: 422, d:
      'M216-125C83-125 0-70 0-2C0 65 57 125 206 125C370 125 422 68 422-2C422-73 309-125 216-125Z' +
      'M111-63C122-98 159-103 190-103C259-103 314-29 314 31C314 38 313 44 312 50C307 75 293 92 268 98' +
      'C258 101 247 102 237 102C228 102 220 101 211 98C194 93 178 84 164 72C156 65 149 58 143 50' +
      'C123 27 108-7 108-39C108-47 109-55 111-63Z' },
    timeSig2: { width: 446, d:
      'M421 91C421 79 416 77 409 77C401 77 398 81 396 87C396 88 395 89 395 90C385 114 377 133 356 133' +
      'C351 133 346 132 339 130C326 125 319 124 309 119C289 111 242 95 201 95C188 95 175 97 164 101' +
      'C186 65 271 35 293 29C308 25 350 17 383-10C407-29 426-58 426-102C426-149 406-183 380-205' +
      'C329-248 251-254 229-254C202-254 168-253 142-247C107-240 72-219 48-191C31-170 20-145 20-118' +
      'C20-104 23-90 29-75C44-44 75-20 111-20C172-20 181-83 181-108C181-168 112-171 112-191' +
      'C114-205 132-229 191-229C280-229 281-162 281-133C281-95 269-60 247-31C211 17 183 41 134 71' +
      'C79 106 40 155 23 218C23 220 22 222 22 224C22 235 29 248 40 255C43 257 46 257 48 257' +
      'C70 257 82 196 141 196C181 196 196 250 285 250C328 250 405 246 421 91Z' },
    timeSig3: { width: 421, d:
      'M213-248C208-248 203-249 198-249C112-249 26-192 26-139C26-106 45-62 107-58L112-58' +
      'C156-58 178-90 178-123L178-131C175-168 150-170 145-172C140-174 125-172 125-186L125-190' +
      'C127-207 158-215 167-215C252-215 260-162 260-138L260-131C260-57 201-28 138-25' +
      'C128-24 114-19 114-8C114 4 131 4 139 4C254 4 263 82 263 95C263 201 209 213 187 213' +
      'C183 213 179 212 178 212C170 211 151 211 150 196L150 191C150 169 172 154 173 125' +
      'C173 115 172 104 168 94C157 69 128 53 101 53C97 53 94 53 90 54C73 57 54 67 42 80' +
      'C25 95 20 119 20 141C22 219 93 249 191 251L200 251C299 251 401 200 401 112L401 105' +
      'C400 91 398 77 392 64C388 54 381 44 373 35C367 27 359 20 349 14L328 2L295-7' +
      'C290-8 287-8 285-12C284-14 284-15 284-17C284-21 285-25 288-26C299-29 310-30 319-35' +
      'C334-42 347-49 358-62C374-80 380-103 380-126C380-218 255-245 213-248Z' },
    timeSig4: { width: 470, d:
      'M362 74L362-140C362-148 361-157 350-157C341-157 336-155 330-148L235-33C231-28 226-22 226-10' +
      'L226 74L91 74C171 6 331-221 334-232C334-234 335-235 335-237C335-245 328-251 320-251' +
      'C311-251 270-249 252-249C234-249 189-251 181-251C172-251 158-248 158-232C158-108 60 31 30 73' +
      'L24 81C24 82 23 83 23 84C21 88 20 92 20 95C20 105 28 112 40 112L226 112L226 175' +
      'C226 202 204 210 186 210C170 210 163 219 163 229C163 239 167 250 182 250L395 250' +
      'C405 250 415 243 415 229C415 215 403 209 393 209C383 209 362 203 362 171L362 112L435 112' +
      'C445 112 450 105 450 93C450 81 446 74 435 74Z' }
  };
  var GLYPH_SCALE = LINE_GAP / SMUFL_STAFF_SPACE;
  // Số chỉ nhịp đứng sau khóa Sol; khi có số chỉ nhịp, nốt đầu tiên lùi sang phải một đoạn.
  var TIME_SIG_X = 98;
  var TIME_SIG_SPACE = 44;
  var BARLINE_WIDTH = 2;
  var FINAL_BAR_WIDTH = 6;

  function yForStep(step) {
    return BOTTOM_LINE_Y - step * (LINE_GAP / 2);
  }

  // Đặt một glyph Bravura: (x, y) là điểm giữa theo chiều ngang và gốc (giữa) theo chiều dọc.
  function glyph(parent, name, x, y, className) {
    var g = BRAVURA_GLYPHS[name];
    return el('path', {
      'class': className, 'data-glyph': name, d: g.d,
      transform: 'translate(' + (x - g.width * GLYPH_SCALE / 2) + ' ' + y + ') scale(' + GLYPH_SCALE + ')'
    }, parent);
  }

  function el(name, attrs, parent) {
    var node = document.createElementNS(SVG_NS, name);
    for (var key in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, key)) node.setAttribute(key, attrs[key]);
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  function drawStaffLines(svg, width) {
    var group = el('g', { 'class': 'staff-lines' }, svg);
    for (var line = 1; line <= 5; line++) {
      var y = yForStep((line - 1) * 2);
      el('line', {
        x1: STAFF_LEFT, x2: width - STAFF_LEFT, y1: y, y2: y,
        'class': 'staff-line', 'data-line': line
      }, group);
    }
    return group;
  }

  function drawTrebleClef(svg) {
    var group = el('g', {
      'class': 'treble-clef',
      'data-glyph': 'gClef',
      transform: 'translate(' + CLEF_X + ' ' + yForStep(G_LINE_STEP) + ') scale(' + CLEF_SCALE + ')',
      'aria-hidden': 'true'
    }, svg);
    el('path', { d: BRAVURA_G_CLEF_PATH, 'class': 'clef-glyph' }, group);
    return group;
  }

  // Quy tắc hướng thân nốt: nốt thấp hơn dòng giữa → thân hướng lên (bên phải),
  // nốt từ dòng giữa trở lên → thân hướng xuống (bên trái).
  var MIDDLE_LINE_STEP = 4;

  // Độ dài nốt (số phách, nốt đen = 1 phách): 1 = nốt đen, 2 = nốt trắng, 4 = nốt tròn.
  var HOLLOW_HEADS = { 2: 'noteheadHalf', 4: 'noteheadWhole' };

  function drawNote(svg, note, cx, interactive) {
    var cy = yForStep(note.step);
    var stemUp = note.step < MIDDLE_LINE_STEP;
    var beats = note.beats || 1;
    var headName = HOLLOW_HEADS[beats];
    var headHalfWidth = headName ? BRAVURA_GLYPHS[headName].width * GLYPH_SCALE / 2 : NOTE_HEAD_RX;

    var attrs = { 'class': 'note', 'data-note': note.id, 'data-step': note.step };
    if (note.beats) attrs['data-beats'] = beats;
    if (note.key) attrs['data-key'] = note.key;
    if (interactive) {
      attrs.tabindex = '0';
      attrs.role = 'button';
      attrs['aria-label'] = note.label + ', ' + note.symbol;
    }
    var group = el('g', attrs, svg);

    // Vùng chạm rộng bằng cả cột để học sinh dễ chạm trên điện thoại.
    el('rect', {
      'class': 'note-hit',
      x: cx - NOTE_SPACING / 2, y: 6,
      width: NOTE_SPACING, height: SYMBOL_Y + 4
    }, group);

    // note-body và note-head-wrap chỉ dùng cho hiệu ứng động, để CSS transform
    // không ghi đè góc nghiêng của đầu nốt.
    var body = el('g', { 'class': 'note-body' }, group);

    note.ledgerSteps.forEach(function (ledgerStep) {
      var y = yForStep(ledgerStep);
      var half = LEDGER_HALF_WIDTH + headHalfWidth - NOTE_HEAD_RX;
      el('line', {
        'class': 'ledger-line', 'data-ledger-step': ledgerStep,
        x1: cx - half, x2: cx + half, y1: y, y2: y
      }, body);
    });

    // Nốt tròn không có thân.
    if (beats !== 4) {
      var stemX = stemUp ? cx + headHalfWidth - 1.2 : cx - headHalfWidth + 1.2;
      el('line', {
        'class': 'note-stem',
        'data-direction': stemUp ? 'up' : 'down',
        x1: stemX, x2: stemX,
        y1: cy + (stemUp ? -2 : 2),
        y2: stemUp ? cy - STEM_LENGTH : cy + STEM_LENGTH
      }, body);
    }

    var headWrap = el('g', { 'class': 'note-head-wrap' }, body);
    if (headName) {
      // Đầu nốt rỗng: glyph Bravura có lỗ ở giữa, dòng kẻ đi qua vẫn nhìn thấy như bản in thật.
      glyph(headWrap, headName, cx, cy, 'note-head note-head-hollow').setAttribute('data-cy', cy);
    } else {
      el('ellipse', {
        'class': 'note-head',
        cx: cx, cy: cy, rx: NOTE_HEAD_RX, ry: NOTE_HEAD_RY,
        transform: 'rotate(-20 ' + cx + ' ' + cy + ')'
      }, headWrap);
    }

    var name = el('text', { 'class': 'note-label', x: cx, y: LABEL_Y, 'text-anchor': 'middle' }, group);
    name.textContent = note.label;
    var symbol = el('text', { 'class': 'note-symbol', x: cx, y: SYMBOL_Y, 'text-anchor': 'middle' }, group);
    symbol.textContent = note.symbol;

    return group;
  }

  /*
   * Tạo "nốt tạm" ở một vị trí bất kỳ (dùng khi học sinh thả nốt vào chỗ chưa đúng):
   * dòng kẻ phụ được tính lại theo vị trí đó, nên Đô₄ hay một nốt đặt sai ngoài khuông
   * vẫn được vẽ đúng quy tắc.
   */
  function noteAtStep(base, step, key) {
    return {
      id: base.id, key: key, step: step,
      ledgerSteps: global.MusicNotes.ledgerSteps(step),
      label: base.label, symbol: base.symbol
    };
  }

  /*
   * Vẽ khuông nhạc vào container. Trả về đối tượng điều khiển để đánh dấu nốt.
   * options.interactive = false: khuông chỉ để xem (dùng trong câu hỏi), không bấm được.
   * options.columns: số cột nốt (mặc định = số nốt) – dùng khi khuông còn chỗ trống để đặt nốt.
   * options.ariaLabel: mô tả cho trình đọc màn hình.
   * Phòng sáng tạo dùng thêm (các hoạt động khác không truyền nên giữ nguyên hình cũ):
   * options.timeSignature: số phách mỗi ô nhịp (2, 3, 4) → vẽ số chỉ nhịp 2/4, 3/4, 4/4 sau khóa Sol;
   * options.timeSignatureSpace: chừa chỗ cho số chỉ nhịp mà không vẽ (các dòng khuông sau dòng đầu);
   * options.barlinesAfter: các cột có vạch nhịp ngay sau; options.finalBarline: vạch kết ở cuối khuông.
   * Mỗi nốt được tra theo note.key (nếu có) hoặc note.id.
   */
  function drawTimeSignature(svg, beats) {
    var group = el('g', { 'class': 'time-signature', 'data-beats': beats, 'aria-hidden': 'true' }, svg);
    // Hai chữ số, mỗi số cao 2 khoảng dòng: số trên giữa dòng 4, số dưới (4 = nốt đen) giữa dòng 2.
    glyph(group, 'timeSig' + beats, TIME_SIG_X, yForStep(6), 'time-sig-digit').setAttribute('data-digit', 'top');
    glyph(group, 'timeSig4', TIME_SIG_X, yForStep(2), 'time-sig-digit').setAttribute('data-digit', 'bottom');
    return group;
  }

  function drawBarline(svg, x, final) {
    var top = yForStep(8), bottom = yForStep(0);
    if (!final) {
      return el('rect', { 'class': 'barline', x: x - BARLINE_WIDTH / 2, y: top, width: BARLINE_WIDTH, height: bottom - top }, svg);
    }
    // Vạch kết: một vạch mảnh rồi một vạch đậm, vạch đậm sát mép phải khuông.
    var group = el('g', { 'class': 'barline-final' }, svg);
    el('rect', { 'class': 'barline', x: x - FINAL_BAR_WIDTH - 6 - BARLINE_WIDTH, y: top, width: BARLINE_WIDTH, height: bottom - top }, group);
    el('rect', { 'class': 'barline barline-thick', x: x - FINAL_BAR_WIDTH, y: top, width: FINAL_BAR_WIDTH, height: bottom - top }, group);
    return group;
  }

  function createStaff(container, notes, options) {
    options = options || {};
    var interactive = options.interactive !== false;
    var columns = Math.max(notes.length, options.columns || 0, 1);
    var firstX = FIRST_NOTE_X + (options.timeSignature || options.timeSignatureSpace ? TIME_SIG_SPACE : 0);
    function columnX(index) { return firstX + index * NOTE_SPACING; }
    var width = columnX(columns - 1) + NOTE_SPACING / 2 + 14;
    var height = SYMBOL_Y + 14;
    var svg = el('svg', {
      'class': 'staff-svg' + (interactive ? '' : ' staff-static'),
      viewBox: '0 0 ' + width + ' ' + height,
      role: interactive ? 'group' : 'img',
      'aria-label': options.ariaLabel || 'Khuông nhạc khóa Sol với 8 nốt từ Đô 4 đến Đô 5'
    });

    drawStaffLines(svg, width);
    drawTrebleClef(svg);
    if (options.timeSignature) drawTimeSignature(svg, options.timeSignature);
    (options.barlinesAfter || []).forEach(function (column) {
      drawBarline(svg, columnX(column) + NOTE_SPACING / 2).setAttribute('data-after', column);
    });
    if (options.finalBarline) drawBarline(svg, width - STAFF_LEFT, true);
    var noteElements = {};
    notes.forEach(function (note, index) {
      noteElements[note.key || note.id] = drawNote(svg, note, columnX(index), interactive);
    });

    container.appendChild(svg);

    /*
     * ĐỔI TOẠ ĐỘ MÀN HÌNH → VỊ TRÍ TRÊN KHUÔNG (dùng khi kéo thả / chạm để đặt nốt)
     * 1. Đổi điểm chạm (pixel) sang toạ độ của SVG bằng ma trận biến đổi của trình duyệt,
     *    nên đúng với mọi cỡ màn hình và mức thu phóng.
     * 2. vị trí = làm tròn((yDòng1 − y) / nửa khoảng cách dòng): điểm chạm được "hút" vào
     *    dòng kẻ hoặc khe gần nhất (sai lệch tối đa một phần tư khoảng cách dòng).
     * 3. Cột = làm tròn((x − xCộtĐầu) / khoảng cách cột).
     */
    function clientToStaff(clientX, clientY) {
      var matrix = svg.getScreenCTM();
      if (!matrix) return null;
      var point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      var local = point.matrixTransform(matrix.inverse());
      var box = svg.viewBox.baseVal;
      return {
        x: local.x,
        y: local.y,
        step: Math.round((BOTTOM_LINE_Y - local.y) / (LINE_GAP / 2)),
        column: Math.round((local.x - firstX) / NOTE_SPACING),
        inside: local.x >= 0 && local.x <= box.width && local.y >= 0 && local.y <= box.height
      };
    }

    // Ngược lại: toạ độ màn hình của một (cột, vị trí) – dùng cho trang kiểm thử.
    function staffToClient(column, step) {
      var point = svg.createSVGPoint();
      point.x = columnX(column);
      point.y = yForStep(step);
      var screen = point.matrixTransform(svg.getScreenCTM());
      return { clientX: screen.x, clientY: screen.y };
    }

    return {
      svg: svg,
      columns: columns,
      columnX: columnX,
      columnWidth: NOTE_SPACING,
      noteElement: function (id) { return noteElements[id]; },
      clientToStaff: clientToStaff,
      staffToClient: staffToClient,
      // Thêm một nốt vào cột index (nốt có thể là nốt tạm tạo bằng noteAtStep).
      addNote: function (note, index, className) {
        var key = note.key || note.id;
        if (noteElements[key]) noteElements[key].remove();
        var node = drawNote(svg, note, columnX(index), false);
        if (className) node.setAttribute('class', 'note ' + className);
        noteElements[key] = node;
        return node;
      },
      removeNote: function (key) {
        if (noteElements[key]) noteElements[key].remove();
        delete noteElements[key];
      },
      // Khi ẩn tên nốt, nhãn đọc màn hình cũng chỉ còn số thứ tự để không lộ đáp án.
      setLabelsVisible: function (visible) {
        svg.classList.toggle('labels-hidden', !visible);
        if (!interactive) return;
        notes.forEach(function (note, index) {
          noteElements[note.id].setAttribute('aria-label',
            visible ? note.label + ', ' + note.symbol : 'Nốt thứ ' + (index + 1));
        });
      },
      // Đặt lại hiệu ứng: xoá lớp rồi thêm lại để animation chạy lại mỗi lần.
      flash: function (id, className) {
        var node = noteElements[id];
        if (!node) return;
        node.classList.remove(className);
        void node.getBoundingClientRect();
        node.classList.add(className);
      },
      clearMarks: function (classNames) {
        Object.keys(noteElements).forEach(function (id) {
          classNames.forEach(function (name) { noteElements[id].classList.remove(name); });
        });
      }
    };
  }

  global.StaffRenderer = {
    LINE_GAP: LINE_GAP,
    yForStep: yForStep,
    noteAtStep: noteAtStep,
    STAFF_TOP: STAFF_TOP,
    BOTTOM_LINE_Y: BOTTOM_LINE_Y,
    svgElement: el,
    glyphPath: function (name) { return BRAVURA_GLYPHS[name].d; },
    createStaff: createStaff
  };
})(window);
