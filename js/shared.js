/*
 * AI MUSIC LAB – Tiện ích dùng chung cho các hoạt động
 */
(function (global) {
  'use strict';

  var PRAISES = ['Chính xác!', 'Giỏi quá!', 'Tuyệt vời!', 'Đúng rồi!', 'Rất tốt!'];
  var VOLUME_EVENT = 'aiml-volume-change';

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function audioErrorMessage(error) {
    if (error && error.code === 'unsupported') {
      return 'Trình duyệt này chưa hỗ trợ phát âm thanh. Hãy mở bằng Chrome, Edge hoặc Safari bản mới.';
    }
    return 'Chưa phát được âm thanh. Hãy chạm vào nút thêm một lần, kiểm tra loa và âm lượng thiết bị. ' +
      'Trên iPhone/iPad, hãy tắt chế độ im lặng (nút gạt bên cạnh máy).';
  }

  function pick(list, random) {
    return list[Math.floor(random() * list.length)];
  }

  // Trộn ngẫu nhiên (Fisher–Yates), trả về mảng mới.
  function shuffle(list, random) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    return copy;
  }

  function praise(random) {
    return pick(PRAISES, random);
  }

  /*
   * Báo "hoàn thành một chặng" (xong lượt thử thách, xong bài kéo thả…). Khung ứng dụng nghe sự kiện
   * này để phát giai điệu chúc mừng và bắn pháo giấy; hoạt động không cần biết chuyện đó.
   */
  var CELEBRATE_EVENT = 'aiml-celebrate';
  function celebrate(activity, reason) {
    global.dispatchEvent(new CustomEvent(CELEBRATE_EVENT, { detail: { activity: activity, reason: reason } }));
  }

  function percent(part, whole) {
    return whole > 0 ? Math.round((part / whole) * 100) + '%' : '—';
  }

  /*
   * Gắn thanh trượt âm lượng. Mọi thanh trượt trong ứng dụng dùng chung một mức âm lượng:
   * kéo một thanh thì các thanh khác cũng cập nhật theo.
   */
  function bindVolumeSlider(slider, audio) {
    slider.value = Math.round(audio.getVolume() * 100);
    slider.addEventListener('input', function () {
      var value = Number(slider.value) / 100;
      audio.setVolume(value);
      document.dispatchEvent(new CustomEvent(VOLUME_EVENT, { detail: { value: value, source: slider } }));
    });
    document.addEventListener(VOLUME_EVENT, function (event) {
      if (event.detail.source !== slider) slider.value = Math.round(event.detail.value * 100);
    });
  }

  var VOLUME_SLIDER_HTML =
    '<label class="volume">' +
      '<span aria-hidden="true">🔈</span>' +
      '<input type="range" min="0" max="100" step="5" data-ref="volume" aria-label="Âm lượng">' +
      '<span aria-hidden="true">🔊</span>' +
    '</label>';

  // Thu thập các phần tử có data-ref trong root thành một đối tượng.
  function collectRefs(root) {
    var refs = {};
    Array.prototype.forEach.call(root.querySelectorAll('[data-ref]'), function (node) {
      refs[node.getAttribute('data-ref')] = node;
    });
    return refs;
  }

  // Tải một file về máy bằng trình duyệt (không gửi dữ liệu đi đâu).
  function downloadBlob(filename, blob) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // Tên file an toàn: bỏ dấu tiếng Việt và ký tự đặc biệt.
  function fileSlug(title, fallback) {
    var slug = (title || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
    return slug || fallback;
  }

  global.AppShared = {
    downloadBlob: downloadBlob,
    fileSlug: fileSlug,
    escapeHtml: escapeHtml,
    audioErrorMessage: audioErrorMessage,
    pick: pick,
    shuffle: shuffle,
    praise: praise,
    celebrate: celebrate,
    CELEBRATE_EVENT: CELEBRATE_EVENT,
    percent: percent,
    bindVolumeSlider: bindVolumeSlider,
    VOLUME_SLIDER_HTML: VOLUME_SLIDER_HTML,
    collectRefs: collectRefs
  };
})(window);
