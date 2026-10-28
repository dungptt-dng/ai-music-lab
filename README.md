# AI MUSIC LAB – Phòng thí nghiệm âm nhạc số

Web app giúp học sinh lớp 4–5 nhận biết, đọc và nghe 8 nốt Đô₄ – Đô₅ trên khuông nhạc khóa Sol.

**Dùng thử trên mạng (GitHub Pages):** <https://dungptt-dng.github.io/ai-music-lab/> ·
trang kiểm thử: <https://dungptt-dng.github.io/ai-music-lab/tests/kiem-thu.html>.
GitHub Pages chỉ phục vụ trang tĩnh, nên trên website này Trợ lý giáo viên luôn báo "chưa có trợ lý AI";
các hoạt động của học sinh dùng đầy đủ.

> **Trạng thái:** Giai đoạn 6 (đã có hồ sơ dự thi và PowerPoint – xem mục 6) – **nguyên mẫu học tập số có kiến trúc mở rộng AI**.
> Mọi hoạt động của học sinh (Khuông nhạc, Nghe cao độ, Trắc nghiệm, Kéo thả, Sáng tạo, Báo cáo kèm gợi ý luyện tập)
> **không dùng AI**: âm thanh tổng hợp (Web Audio API), câu hỏi và gợi ý theo quy tắc nhạc lý cố định; không hỏi họ tên,
> không gửi dữ liệu lên mạng. Riêng **Trợ lý giáo viên** dùng AI (Claude của Anthropic) qua máy chủ Cloudflare Pages:
> mã đã viết xong và đã kiểm thử với AI giả lập, **chưa chạy với API thật**. Chi tiết: [docs/KIEN-TRUC-AI.md](docs/KIEN-TRUC-AI.md).

Mở `index.html` (không kèm `#…`) sẽ vào **Trang chủ** có linh vật Bé Nốt, 8 phím cầu vồng và 6 thẻ hoạt động.
Mỗi hoạt động có đường dẫn riêng để giáo viên mở thẳng: `index.html#khuong-nhac`, `index.html#nghe-cao-do`,
`index.html#trac-nghiem`, `index.html#keo-tha`, `index.html#sang-tao`, `index.html#bao-cao`.
Trang của giáo viên: `index.html#tro-ly-giao-vien` (đường dẫn ở chân trang, không nằm trên thanh của học sinh).

### Dữ liệu kết quả được lưu ở đâu? (để nói đúng trong hồ sơ dự thi)

- **Mặc định:** kết quả chỉ nằm trong bộ nhớ của trang đang mở ("Phiên này"). Tải lại hoặc đóng trang là mất.
- **Khi bấm bật "Lưu kết quả trên máy này"** ở mục Báo cáo: các phiên được lưu trong `localStorage` của trình duyệt
  trên chính máy đó, để xem ở "Tất cả các phiên trên máy này". Dữ liệu **không** gửi lên máy chủ, **không** đồng bộ
  giữa các máy, **không** có tài khoản. Xóa bằng nút "Xóa dữ liệu đã lưu" (hoặc xóa dữ liệu duyệt web).
- Nhật ký chỉ gồm: thời điểm, hoạt động, câu hỏi, đáp án đúng, lựa chọn của học sinh, đúng/sai. Không có họ tên.
- Trên máy dùng chung, kết quả của nhiều em gộp chung một chỗ. Cách dùng gợi ý: mỗi em làm xong thì xuất file
  CSV/JSON, rồi bấm "Bắt đầu phiên mới" (trang tải lại, mọi hoạt động bắt đầu từ đầu). Giáo viên đổi tên file theo
  mã số học sinh nếu cần – ứng dụng không tự ghi tên.
- Không thể tuyên bố: "có cơ sở dữ liệu trực tuyến", "đồng bộ nhiều thiết bị", "theo dõi tiến bộ từng học sinh".

## 1. Cách chạy

**Cách đơn giản nhất (dùng trong lớp, không cần mạng):** nhấp đúp vào `index.html` để mở bằng Chrome hoặc Edge.

**Chạy bằng máy chủ cục bộ** (để mở trang kiểm thử tự động `tests/kiem-thu.html`):

```bash
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
```

Sau đó mở `http://localhost:8765/` (ứng dụng) hoặc `http://localhost:8765/tests/kiem-thu.html` (kiểm thử).

**Đưa lên website không có AI:** phần học sinh là trang tĩnh, chỉ cần tải `index.html`, `css/`, `js/`
lên GitHub Pages, Netlify hoặc Cloudflare Pages. Trang Trợ lý giáo viên khi đó tự báo "chưa có trợ lý AI".

**Đưa lên Cloudflare Pages kèm Trợ lý giáo viên (AI)** – cần cài Node.js 20 trở lên (máy phát triển hiện chưa có
Node nên các bước này **chưa được chạy thử**):

```bash
npm install
```

```bash
npx wrangler login
```

```bash
npx wrangler pages secret put ANTHROPIC_API_KEY
```

```bash
npx wrangler pages secret put TEACHER_ACCESS_CODE
```

```bash
npm run deploy
```

`npm run build` chỉ chép `index.html`, `css/`, `js/` vào `dist/`; thư mục `functions/` được Cloudflare đóng gói thành máy chủ.
Hoặc nối kho GitHub với Cloudflare Pages: lệnh build `npm run build`, thư mục kết quả `dist`, rồi thêm hai biến trên
dạng **Secret** ở Settings → Variables and Secrets. Sau đó đặt hạn mức chi tiêu trong Claude Console và luật giới hạn
tần suất cho `/api/tro-ly-giao-vien` (xem mục 5 của tài liệu kiến trúc AI).

## 2. Cấu trúc mã nguồn

| File | Nội dung |
|---|---|
| `index.html` | Trang chính |
| `css/style.css` | Giao diện, hiệu ứng, bố cục điện thoại |
| `js/notes.js` | Dữ liệu 8 nốt; **thuật toán vị trí nốt** và công thức tần số (có chú thích) |
| `js/shared.js` | Tiện ích dùng chung (thông báo lỗi âm thanh, trộn ngẫu nhiên, thanh âm lượng, tải file về máy) |
| `js/practice-log.js` | Nhật ký luyện tập – nguồn dữ liệu duy nhất của báo cáo; lưu vào trình duyệt chỉ khi được bật |
| `js/staff.js` | Vẽ khuông, khóa Sol, nốt bằng SVG |
| `js/audio.js` | Phát âm thanh, giới hạn âm lượng, xử lý khi trình duyệt chặn âm thanh |
| `js/staff-activity.js` | Hoạt động 1: Khám phá / Tìm nốt; **cách tính điểm** (có chú thích) |
| `js/listening-activity.js` | Hoạt động 2: Nghe cao độ (mức độ, âm mốc, luyện tập/thử thách); cách tính điểm |
| `js/question-bank.js` | Ngân hàng câu hỏi: 5 dạng, sinh theo quy tắc, mỗi câu đúng 1 đáp án |
| `js/quiz-activity.js` | Hoạt động 3: Trắc nghiệm, kết quả theo dạng câu hỏi |
| `js/drag-activity.js` | Hoạt động 4: Kéo thả nốt; đổi điểm thả thành vị trí trên khuông, phản hồi cao hơn/thấp hơn |
| `js/melody-activity.js` | Hoạt động 5: Phòng sáng tạo giai điệu; phát, lưu/mở file JSON, lưu ảnh PNG |
| `js/report.js` | Hoạt động 6: Báo cáo (phiên này / tích lũy), **cách tính** (có chú thích), xuất CSV/JSON, in |
| `js/practice-advisor.js` | Gợi ý luyện tập tiếp theo trong Báo cáo – **5 quy tắc cố định, không dùng AI** (có chú thích) |
| `js/teacher-assistant.js` | Trang Trợ lý giáo viên: form, gọi máy chủ của trường, hiển thị kết quả đã kiểm tra, tải file |
| `js/app.js` | Thanh điều hướng; nối tiếng chuông, linh vật, pháo giấy vào kết quả trả lời (không đổi cách chấm) |
| `js/sound-fx.js` | Âm thanh giao diện: chuông đúng, tiếng động viên, tiếng bấm, giai điệu chúc mừng, nhạc nền |
| `js/fun-ui.js` | Linh vật Bé Nốt, Trang chủ, nút bật/tắt âm thanh, pháo giấy |
| `functions/_lib/tro-ly-core.js` | Lõi máy chủ AI: kiểm tra mã giáo viên/tham số, lời nhắn gửi Claude, **kiểm tra lại đáp án bằng quy tắc** |
| `functions/api/tro-ly-giao-vien.js` | Cloudflare Pages Function: gọi Claude bằng SDK chính thức của Anthropic |
| `docs/KIEN-TRUC-AI.md` | Kiến trúc AI: bảng 4 loại chức năng, luồng dữ liệu, bảo mật, chi phí ước tính |
| `package.json`, `wrangler.toml`, `tools/build-site.mjs` | Cấu hình triển khai Cloudflare Pages |
| `tests/` | Trang kiểm thử tự động |
| `tools/serve.ps1` | Máy chủ cục bộ để chạy thử (không chạy được máy chủ AI) |
| `tools/chup-anh.ps1`, `tools/chup-anh.html` | Chụp 10 ảnh giao diện thật vào `ho-so/anh-giao-dien/` (Edge chạy ẩn) |
| `tools/tao-ho-so.ps1`, `ho-so/nguon/ho-so-du-thi.html` | Tạo Hồ sơ dự thi .docx (Word) và .pdf (Edge) từ trang nguồn HTML |
| `tools/tao-powerpoint.ps1` | Tạo bộ PowerPoint dự thi (PowerPoint), có ghi chú người trình bày |

Muốn đổi "Sol" thành "Son" theo SGK của trường: sửa `VIETNAMESE_NAMES` trong `js/notes.js`.

Khóa Sol trên khuông là đường viền nguyên bản của glyph gClef (U+E050) trong phông ký âm **Bravura 1.482**
(chuẩn SMuFL) của Steinberg, trích thẳng từ `Bravura.otf`. Gốc glyph theo SMuFL nằm trên dòng Sol₄ nên được đặt
đúng lên dòng 2. Phông Bravura dùng giấy phép SIL Open Font License 1.1, xem [licenses/Bravura-OFL.txt](licenses/Bravura-OFL.txt).

## 3. Bảng trạng thái chức năng (để dùng trung thực trong hồ sơ dự thi)

| Chức năng | Trạng thái |
|---|---|
| Khuông 5 dòng, khóa Sol, 8 nốt đúng vị trí | ✅ Đã làm, đã kiểm thử tự động |
| Nhấn nốt → tên nốt, ký hiệu, tần số, vị trí, phát âm | ✅ Đã làm, đã kiểm thử |
| Bật/tắt tên nốt | ✅ Đã làm, đã kiểm thử |
| Chế độ Tìm nốt có phản hồi, gợi ý sau 2 lần sai, thống kê trong phiên | ✅ Đã làm, đã kiểm thử |
| Nghe cả 8 nốt, điều chỉnh âm lượng, báo lỗi khi bị chặn âm thanh | ✅ Đã làm, đã kiểm thử |
| Nghe cao độ: 3 mức (3/5/8 nốt), âm mốc Đô₄, nghe lại, so sánh khi sai | ✅ Đã làm, đã kiểm thử |
| Nghe cao độ: luyện tập không giới hạn và thử thách 5/10/15 câu | ✅ Đã làm, đã kiểm thử |
| Trắc nghiệm 5 dạng câu hỏi, trộn câu và phương án, giải thích từng câu | ✅ Đã làm, đã kiểm thử |
| Kết quả lượt trắc nghiệm: đúng/sai/tỷ lệ, theo dạng câu hỏi, xem lại câu sai | ✅ Đã làm, đã kiểm thử |
| Kéo thả nốt vào khuông (chuột, ngón tay, hoặc chạm – chạm), phản hồi cao hơn/thấp hơn, gợi ý sau 2 lần sai | ✅ Đã làm, đã kiểm thử |
| Kéo thả: gỡ nốt vừa đặt, xóa bài, thống kê đúng lần đầu / số lần sai | ✅ Đã làm, đã kiểm thử |
| Phòng sáng tạo: soạn tối đa 16 nốt, đổi thứ tự, xóa, 3 mẫu khởi đầu, 3 tốc độ phát | ✅ Đã làm, đã kiểm thử |
| Phòng sáng tạo: đặt tên, ghi ý tưởng; lưu/mở file JSON, lưu ảnh PNG | ✅ Đã làm, đã kiểm thử |
| Báo cáo tổng quan: số câu, đúng, sai, tỷ lệ, thời điểm, hoạt động đã tham gia, số lần làm lại | ✅ Đã làm, đã kiểm thử |
| Báo cáo chi tiết theo hoạt động (theo chế độ/dạng câu, danh sách câu sai) và theo từng nốt | ✅ Đã làm, đã kiểm thử |
| Nốt hay nhầm – chỉ kết luận khi có từ 2 câu sai với cùng một nốt, ít hơn thì ghi "chưa đủ dữ liệu" | ✅ Đã làm, đã kiểm thử |
| Phân biệt "Phiên này" và "Tất cả các phiên trên máy này" (lưu trong trình duyệt, chỉ khi bật) | ✅ Đã làm, đã kiểm thử |
| Xuất CSV (UTF-8 có BOM) và JSON; in báo cáo | ✅ Đã làm, đã kiểm thử (in: mới kiểm tra CSS, chưa in thật) |
| Gợi ý luyện tập tiếp theo (nốt hay nhầm, hoạt động còn yếu, lên mức, thử hoạt động mới) – quy tắc, không AI | ✅ Mới làm ở Giai đoạn 5, đã kiểm thử |
| Trợ lý giáo viên (AI – Claude): tạo câu hỏi theo mức độ, đáp án được máy chủ kiểm tra lại bằng quy tắc | 🧪 Mã xong, kiểm thử với AI giả lập; **chưa chạy với API thật** |
| Trợ lý giáo viên (AI – Claude): gợi ý kế hoạch hoạt động âm nhạc dùng các mục của ứng dụng | 🧪 Mã xong, kiểm thử với AI giả lập; **chưa chạy với API thật** |
| Giao diện vui (bổ sung): Trang chủ có 6 thẻ hoạt động và 8 phím cầu vồng, linh vật Bé Nốt phản ứng đúng/sai, nốt cầu vồng, pháo giấy khi hoàn thành | ✅ Đã làm, đã kiểm thử tự động (pháo giấy, màu sắc: đã xem trên trình duyệt) |
| Âm thanh giao diện: tiếng chuông khi đúng, tiếng động viên khi sai, tiếng bấm nút, giai điệu chúc mừng, nhạc nền (mặc định tắt) – đều tổng hợp bằng Web Audio, không dùng AI | ✅ Đã làm, đã kiểm thử phần điều khiển; **chưa nghe thử bằng tai** |
| Triển khai Cloudflare Pages kèm máy chủ AI | 🧪 Có file cấu hình; **chưa triển khai thật** |
| AI hỗ trợ học sinh sáng tạo giai điệu, giải thích ý tưởng | 💡 Mới là đề xuất (cần cơ chế thông báo/đồng ý vì là dữ liệu trẻ em) |
| Lưu trực tuyến, tài khoản, đồng bộ nhiều thiết bị, theo dõi theo tên học sinh | ❌ Không có – không được tuyên bố |

## 4. Kết quả kiểm thử tự động (28/10/2026, Chromium và Microsoft Edge)

**163/163 phép kiểm thử đạt** (155 phép của Giai đoạn 1–6 và 8 phép cho giao diện vui). Với cả 8 nốt,
trang kiểm thử đối chiếu với bảng chuẩn trong LENH.docx:

- tên tiếng Việt, ký hiệu quốc tế;
- tần số: so với giá trị tính toán, và **đo lại từ âm thanh tổng hợp thật** (sai số dưới 0,3%);
- vị trí: đo trên hình đã vẽ (tâm nốt so với dòng kẻ, cả theo số liệu và theo pixel trên màn hình);
- kết quả khi nhấn vào nốt;
- nghe và ghép tên: phát âm mốc Đô₄ rồi đúng tần số của nốt; chọn đúng/sai cho phản hồi đúng; nghe lại đúng nốt;
- kéo thả: kéo thật bằng Pointer Events, thả cao hơn một bậc → báo sai, thả đúng chỗ → nhận và nốt nằm đúng dòng/khe;
- báo cáo: trả lời sai một câu rồi đúng một câu về nốt đó → dòng của nốt trong báo cáo là 2 câu / đúng 1 / sai 1 / 50%,
  file CSV có đúng 2 dòng "Sai" rồi "Đúng".

Các nhóm kiểm thử khác:

- Khuông nhạc (17): khóa Sol ôm dòng 2, chỉ Đô₄ có dòng kẻ phụ, hướng thân nốt, Tìm nốt, cách tính điểm, lỗi âm thanh.
- Nghe cao độ (9): khoá nút khi chưa nghe, 3 mức độ, không hỏi lặp, bật/tắt âm mốc, thống kê, thử thách 5 câu, lỗi âm thanh.
- Ngân hàng câu hỏi (5): **1.500 câu ngẫu nhiên** được tính lại đáp án bằng cách độc lập – mỗi câu đúng 1 đáp án;
  đủ 8 nốt làm đáp án; phương án được trộn; một lượt 20 câu không trùng.
- Trắc nghiệm (6) và khung ứng dụng (3): chỉ tính lần chọn đầu, phải nghe trước khi chọn, kết quả theo dạng,
  điều hướng bằng đường dẫn, mặc định không ghi dữ liệu vào trình duyệt (cả 6 hoạt động), không có lỗi JavaScript,
  trả lời ở Tìm nốt rồi mở Báo cáo thì số liệu cập nhật ngay.
- Kéo thả (8): điểm thả được hút vào dòng/khe gần nhất, thả ra ngoài không tính, cách chạm – chạm,
  gợi ý sau 2 lần sai, gỡ/xóa, thống kê khi hoàn thành, màn hình hẹp chia 2 dòng khuông, không cuộn trang khi kéo.
- Phòng sáng tạo (9): thêm nốt và xuống dòng sau 8 nốt, giới hạn 16 nốt, đổi thứ tự/xóa, phát đúng thứ tự và tốc độ,
  làm mới cần bấm hai lần, file JSON không có trường họ tên, mở lại file và từ chối 5 loại file hỏng, ảnh PNG đọc lại được.

- Báo cáo (14): các hoạt động ghi nhật ký đúng; số liệu tổng hợp khớp với một phiên **dựng tay có kết quả biết trước**;
  màn hình tổng quan/theo hoạt động/theo nốt; "chưa đủ dữ liệu" khi mới sai 1 câu; CSV đọc lại được (BOM, 9 cột,
  ô có dấu phẩy/ngoặc kép); JSON khớp màn hình; phiên này / tích lũy sau khi "tải lại"; bật/tắt/xóa lưu;
  trình duyệt không cho lưu hoặc bộ nhớ đầy; lỗi khi xuất file; in; bắt đầu phiên mới; màn hình 360 px.
- Kiểm tra ngược: cố ý làm sai cách tính (tính cả lần làm lại thành câu mới) thì 6 phép thử báo lỗi – các phép thử
  thực sự phát hiện được sai số liệu.
- Gợi ý luyện tập (6): không có dữ liệu thì không gợi ý; nốt sai từ 2 lần được ưu tiên, lý do khớp số liệu;
  ngưỡng 5 câu / 60% / 10 câu / 80%; mục gợi ý ghi rõ "không dùng AI" và có nút mở thẳng hoạt động.
- Máy chủ Trợ lý giáo viên (8) – dùng **Claude giả lập**, không gọi API thật: thiếu/sai mã, trang khác, chưa cài,
  sai tham số, quá dài đều bị chặn **trước khi gọi AI**; tham số gửi Claude (mô hình, structured outputs, fallback),
  trường thừa bị bỏ, không có khóa/mã trong lời nhắn; loại câu AI viết sai đáp án / lộ đáp án / không hỏi nốt đã chọn;
  xử lý AI từ chối, bị cắt ngang, quá tải, lỗi khóa (không lộ chi tiết); kiểm tra kế hoạch hoạt động;
  quét 16 file gửi về trình duyệt không có khóa hay địa chỉ API.
- Trang Trợ lý giáo viên (5) và khung ứng dụng (+1): báo rõ khi chưa có máy chủ, gửi đúng lựa chọn, hiện câu đã kiểm tra
  và vẽ nốt trên khuông, tải văn bản/JSON có ghi nguồn AI, sai mã, chữ của AI không chạy thành HTML.
- Kiểm tra ngược ở Giai đoạn 5: cố ý đảo quy tắc "nốt nào cao hơn" trong máy chủ thì 2 phép thử báo lỗi.
- Giai đoạn 6: chạy lại trong Edge chạy ẩn thì phép thử "màn hình hẹp chia 2 dòng khuông" báo sai vì so chiều cao khuông
  khi chưa cố định bề rộng (ở cửa sổ rộng, hai khuông cùng chạm giới hạn chiều cao). Đây là lỗi của phép thử, không phải
  của ứng dụng; đã sửa phép thử để đo trong khung rộng 360 px. Kết quả lại là 155/155 ở cả Edge và Chromium.

Các nút lưu/xuất file chỉ được kiểm thử qua hàm giả lập tải xuống, và lệnh in qua hàm giả lập;
việc trình duyệt thật lưu file vào máy và bản in thật cần kiểm tra thủ công (xem dưới).

- Giao diện vui (8): Trang chủ có 6 thẻ dẫn đúng 6 hoạt động; 8 phím cầu vồng phát đúng tần số Đô₄ → Đô₅;
  mặc định có âm hiệu ứng, tắt nhạc nền, bật/tắt được, không ghi vào trình duyệt; không phát âm thanh khi chưa có
  thao tác thật của người dùng; nhạc nền tự tạm dừng ở Nghe cao độ và Trắc nghiệm; sai rồi đúng ở Tìm nốt → tiếng
  động viên rồi tiếng chuông (chờ 0,45 giây cho nốt vang xong), linh vật phản ứng theo; Kéo thả đủ 8 nốt → chúc mừng
  đúng một lần; pháo giấy tự biến mất; nốt cầu vồng chỉ hiện ở Khám phá khi bật tên nốt (Tìm nốt và khi ẩn tên thì
  cùng một màu, để màu không "nhắc bài").

## 5. Checklist kiểm tra thủ công (máy tự động không thay được)

- [ ] Giao diện vui – nghe bằng tai: tiếng chuông đúng, tiếng động viên khi sai, giai điệu chúc mừng có vui, không
  chói, không át tiếng nốt của bài học; nhạc nền có nhẹ nhàng và có làm học sinh xao nhãng không.
- [ ] Giao diện vui – máy chiếu lớp học: màu cầu vồng (nhất là Mi₄ màu vàng) đọc rõ không; pháo giấy có làm rối mắt không.

- [ ] Nghe bằng tai: 8 nốt đi lên đều, Đô₅ cao hơn Đô₄ đúng một quãng tám, âm không bị rè hay có tiếng "tách".
- [ ] Âm lượng mặc định không quá to với loa lớp học; thanh trượt giảm được về im lặng.
- [ ] Nhấp đúp `index.html` (không qua máy chủ) trên máy của trường: trang hiện đầy đủ và có âm thanh.
- [ ] Điện thoại Android (Chrome): chạm từng nốt, chạm nhanh hai lần liên tiếp đều được tính.
- [ ] iPhone/iPad (Safari): có âm thanh khi tắt chế độ im lặng; khi bật im lặng thì thấy thông báo hướng dẫn hoặc biết cách xử lý.
- [ ] Máy chiếu/bảng tương tác: chữ và nốt nhìn rõ từ cuối lớp.
- [ ] Giáo viên âm nhạc xem lại hình khóa Sol và cách viết tên nốt (Sol/Son, Pha/Fa) cho khớp SGK đang dùng.
- [ ] Tải lại trang: thống kê trên màn hình các hoạt động trở về 0; Báo cáo "Phiên này" trống (đúng thiết kế).
- [ ] Nghe cao độ: khoảng nghỉ giữa âm mốc Đô₄ và âm cần đoán (khoảng 1 giây) có vừa với học sinh không.
- [ ] Nghe cao độ: thử với vài học sinh xem mức Dễ / Vừa / Khó có tăng dần hợp lý không.
- [ ] Trắc nghiệm: giáo viên đọc lại cách diễn đạt các câu hỏi và lời giải thích cho phù hợp lứa tuổi.
- [ ] Kéo thả trên điện thoại/máy tính bảng thật: kéo bằng ngón tay mượt, trang không bị cuộn, thả đúng chỗ ngón tay nhắm.
- [ ] Kéo thả trên bảng tương tác: kéo bằng bút/ngón tay được, hoặc dùng cách chạm thẻ rồi chạm khuông.
- [ ] Phòng sáng tạo: bấm "Lưu file" và "Lưu ảnh" trên Chrome/Edge thật – file xuất hiện trong thư mục Tải về và mở lại được.
- [ ] Phòng sáng tạo trên iPhone/iPad: lưu ảnh có thể mở trang xem ảnh thay vì tải về – kiểm tra cách học sinh lưu.
- [ ] Nghe giai điệu ở 3 tốc độ Chậm / Vừa / Nhanh: tốc độ có phù hợp với học sinh không.
- [ ] Báo cáo: bấm "Xuất CSV" và mở bằng Excel trên máy cài tiếng Việt. Nếu Excel dồn tất cả vào một cột
  (do máy dùng dấu chấm phẩy làm dấu phân cách), mở bằng Data → From Text/CSV, hoặc mở bằng Google Sheets.
- [ ] Báo cáo: bấm "Xuất JSON" – file tải về mở được; bấm "In báo cáo" – bản xem trước in chỉ có phần báo cáo, dễ đọc.
- [ ] Báo cáo: bật lưu, tải lại trang, làm thêm vài câu → "Tất cả các phiên" có 2 phiên; bấm "Xóa dữ liệu đã lưu" → hết.
- [ ] Nhấp đúp `index.html` (file://) rồi bật lưu: một số trình duyệt không cho lưu khi mở file trực tiếp – xem thông báo.
- [ ] Báo cáo: giáo viên đọc các gợi ý luyện tập với dữ liệu thật của lớp xem có hợp lý, dễ hiểu với học sinh không.
- [ ] Sau khi triển khai Cloudflare Pages: mở `#tro-ly-giao-vien`, thấy "Máy chủ đã sẵn sàng"; tạo thử 5 câu và 1 kế hoạch.
- [ ] Giáo viên âm nhạc đọc lại lời văn câu hỏi và kế hoạch do AI viết (đúng chuyên môn, phù hợp lứa tuổi).
- [ ] Xem số token và chi phí thật của vài lần tạo trong Claude Console; đặt hạn mức chi tiêu phù hợp.

## 6. Hồ sơ dự thi và PowerPoint (Giai đoạn 6)

| File | Nội dung |
|---|---|
| `ho-so/Ho-so-du-thi-AI-MUSIC-LAB.docx` / `.pdf` | Hồ sơ 16 trang khổ A4: đủ 11 mục theo LENH mục VI, 7 ảnh thật, 4 phụ lục (phiếu phản hồi học sinh, phiếu giáo viên, bảng kết quả đầu vào – đầu ra để trống, thông báo phụ huynh) |
| `ho-so/AI-MUSIC-LAB-du-thi.pptx` | 18 trang 16:9, khớp chức năng thực tế, mỗi trang có ghi chú người trình bày |
| `ho-so/anh-giao-dien/` | 10 ảnh chụp từ ứng dụng thật (6 hoạt động, trang giáo viên, điện thoại, trang kiểm thử 155/155) |

Nguyên tắc đã áp dụng: **không có số liệu tự tạo**. Tên tác giả, đơn vị, website, mã QR và mọi kết quả thử nghiệm
để trống (……), kèm cách thu thập. Ảnh Báo cáo có số liệu do người phát triển thao tác thử 4 câu – đã ghi chú rõ
"không phải kết quả học sinh". Gợi ý luyện tập không gắn nhãn AI; Trợ lý giáo viên ghi "đã kiểm thử với AI giả lập,
chưa chạy API thật".

Tạo lại (Windows, cần Microsoft Office và Edge; chạy theo thứ tự):

```bash
powershell -ExecutionPolicy Bypass -File tools/chup-anh.ps1
```

```bash
powershell -ExecutionPolicy Bypass -File tools/tao-ho-so.ps1
```

```bash
powershell -ExecutionPolicy Bypass -File tools/tao-powerpoint.ps1
```

`tools/chup-anh.ps1` cần máy chủ cục bộ `tools/serve.ps1` đang chạy. Trên máy phát triển, lệnh "Lưu" của Word khi điều
khiển tự động bị treo ở một hộp thoại ẩn, nên `tao-ho-so.ps1` lấy nội dung Word đã dựng và tự đóng gói thành .docx.
Nếu PowerPoint/Word chạy ẩn còn sót lại sau khi tạo file, đóng chúng trong Task Manager.

Đã kiểm tra: file .docx mở lại được bằng Word (16 trang, 7 ảnh, 15 bảng); file .pdf có 16 trang và 7 ảnh (chưa xem
bằng mắt từng trang PDF); file .pptx mở lại được, 18 trang đều có ghi chú, ảnh xuất từng trang đã xem lại bố cục.

Trước khi nộp:

- [ ] Điền tên tác giả, đơn vị, liên hệ trong hồ sơ (`ho-so/nguon/ho-so-du-thi.html`) và trang 1, 18 của PowerPoint.
- [ ] Thay ô "Mã QR website" ở trang cuối bằng mã QR thật của <https://dungptt-dng.github.io/ai-music-lab/>
  (hoặc địa chỉ Cloudflare Pages nếu triển khai cả Trợ lý giáo viên).
- [ ] Hồ sơ (.docx/.pdf/.pptx), thư mục `ho-so/nguon/` và `LENH.docx` cố ý không đưa lên kho GitHub công khai
  (xem `.gitignore`); giữ bản trên máy.
- [ ] Thực hiện kế hoạch thử nghiệm; chỉ điền số liệu đã thu thập thật vào bảng ở trang 16 và Phụ lục C.
- [ ] Thu minh chứng hợp pháp (có đồng ý, dùng mã số thay họ tên): ảnh tiết học, giai điệu học sinh tạo, CSV, phiếu phản hồi.
- [ ] Xem lại toàn bộ file PDF bằng mắt; mở PowerPoint trên máy trình chiếu để kiểm tra phông chữ và biểu tượng.
