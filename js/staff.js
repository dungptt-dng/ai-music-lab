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

  function yForStep(step) {
    return BOTTOM_LINE_Y - step * (LINE_GAP / 2);
  }

  function xForIndex(index) {
    return FIRST_NOTE_X + index * NOTE_SPACING;
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

  function drawNote(svg, note, index, interactive) {
    var cx = xForIndex(index);
    var cy = yForStep(note.step);
    var stemUp = note.step < MIDDLE_LINE_STEP;

    var attrs = { 'class': 'note', 'data-note': note.id, 'data-step': note.step };
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
      el('line', {
        'class': 'ledger-line', 'data-ledger-step': ledgerStep,
        x1: cx - LEDGER_HALF_WIDTH, x2: cx + LEDGER_HALF_WIDTH, y1: y, y2: y
      }, body);
    });

    var stemX = stemUp ? cx + NOTE_HEAD_RX - 1.2 : cx - NOTE_HEAD_RX + 1.2;
    el('line', {
      'class': 'note-stem',
      'data-direction': stemUp ? 'up' : 'down',
      x1: stemX, x2: stemX,
      y1: cy + (stemUp ? -2 : 2),
      y2: stemUp ? cy - STEM_LENGTH : cy + STEM_LENGTH
    }, body);

    var headWrap = el('g', { 'class': 'note-head-wrap' }, body);
    el('ellipse', {
      'class': 'note-head',
      cx: cx, cy: cy, rx: NOTE_HEAD_RX, ry: NOTE_HEAD_RY,
      transform: 'rotate(-20 ' + cx + ' ' + cy + ')'
    }, headWrap);

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
   * Mỗi nốt được tra theo note.key (nếu có) hoặc note.id.
   */
  function createStaff(container, notes, options) {
    options = options || {};
    var interactive = options.interactive !== false;
    var columns = Math.max(notes.length, options.columns || 0, 1);
    var width = xForIndex(columns - 1) + NOTE_SPACING / 2 + 14;
    var height = SYMBOL_Y + 14;
    var svg = el('svg', {
      'class': 'staff-svg' + (interactive ? '' : ' staff-static'),
      viewBox: '0 0 ' + width + ' ' + height,
      role: interactive ? 'group' : 'img',
      'aria-label': options.ariaLabel || 'Khuông nhạc khóa Sol với 8 nốt từ Đô 4 đến Đô 5'
    });

    drawStaffLines(svg, width);
    drawTrebleClef(svg);
    var noteElements = {};
    notes.forEach(function (note, index) {
      noteElements[note.key || note.id] = drawNote(svg, note, index, interactive);
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
        column: Math.round((local.x - FIRST_NOTE_X) / NOTE_SPACING),
        inside: local.x >= 0 && local.x <= box.width && local.y >= 0 && local.y <= box.height
      };
    }

    // Ngược lại: toạ độ màn hình của một (cột, vị trí) – dùng cho trang kiểm thử.
    function staffToClient(column, step) {
      var point = svg.createSVGPoint();
      point.x = xForIndex(column);
      point.y = yForStep(step);
      var screen = point.matrixTransform(svg.getScreenCTM());
      return { clientX: screen.x, clientY: screen.y };
    }

    return {
      svg: svg,
      columns: columns,
      noteElement: function (id) { return noteElements[id]; },
      clientToStaff: clientToStaff,
      staffToClient: staffToClient,
      // Thêm một nốt vào cột index (nốt có thể là nốt tạm tạo bằng noteAtStep).
      addNote: function (note, index, className) {
        var key = note.key || note.id;
        if (noteElements[key]) noteElements[key].remove();
        var node = drawNote(svg, note, index, false);
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
    createStaff: createStaff
  };
})(window);
