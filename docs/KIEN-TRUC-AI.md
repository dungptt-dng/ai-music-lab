# AI MUSIC LAB – Kiến trúc AI (Giai đoạn 5)

Tài liệu này mô tả **phần nào dùng AI, phần nào không**, dữ liệu đi đâu, và cách cài đặt an toàn.
Mọi trạng thái ghi dưới đây đều khớp với mã nguồn và kết quả kiểm thử ở thời điểm viết (28/10/2026).

## 1. Bảng phân loại chức năng

| Chức năng | Loại | Dùng AI? | Đã kiểm chứng đến đâu |
|---|---|---|---|
| Khuông nhạc tương tác, Tìm nốt (8 nốt Đô₄–Đô₅) | (1) Đã hoạt động | Không | Kiểm thử tự động + chạy trên trình duyệt |
| Nghe cao độ (âm thanh tổng hợp Web Audio) | (1) Đã hoạt động | Không | Tần số đo tự động; nghe bằng tai cần kiểm tra thủ công |
| Trắc nghiệm (câu hỏi sinh theo quy tắc nhạc lý) | (1) Đã hoạt động | Không | Kiểm thử tự động, đối chiếu đáp án độc lập |
| Kéo thả nốt, Phòng sáng tạo giai điệu | (1) Đã hoạt động | Không | Kiểm thử tự động + chạy trên trình duyệt |
| Báo cáo, xuất CSV/JSON, lưu trong trình duyệt (tùy chọn) | (1) Đã hoạt động | Không | Kiểm thử tự động; chưa thử mở CSV bằng Excel thật |
| **Gợi ý luyện tập tiếp theo** (trong mục Báo cáo) | (2) Mới phát triển, đã kiểm thử | **Không** – quy tắc cố định | 6 phép kiểm thử tự động |
| **Trợ lý giáo viên** – tạo câu hỏi theo mức độ | (4) Cần mô hình AI qua API | **Có** – Claude (Anthropic) | Đã kiểm thử với **AI giả lập**; **chưa chạy với API thật** |
| **Trợ lý giáo viên** – gợi ý thiết kế hoạt động âm nhạc | (4) Cần mô hình AI qua API | **Có** – Claude (Anthropic) | Đã kiểm thử với **AI giả lập**; **chưa chạy với API thật** |
| Hỗ trợ học sinh sáng tạo giai điệu và giải thích ý tưởng | (3) Mới là đề xuất | Sẽ cần AI | Chưa làm – xem mục 6 |

Vì sao gợi ý luyện tập **không** gắn nhãn AI: nó chỉ áp dụng 5 quy tắc cố định lên số liệu thật
(nốt sai từ 2 lần, hoạt động đúng dưới 60%, đúng từ 80% thì lên mức…). Mỗi gợi ý ghi kèm lý do lấy từ số liệu
để giáo viên tự kiểm tra. Mã: `js/practice-advisor.js`.

Vì vậy sản phẩm hiện là **nguyên mẫu học tập số có kiến trúc mở rộng AI**: phần học sinh dùng hoàn toàn không cần AI;
phần AI (Trợ lý giáo viên) đã có mã máy chủ đầy đủ nhưng chỉ hoạt động khi trường cài đặt khóa API.

## 2. Luồng dữ liệu

```
 HỌC SINH (trình duyệt)                                   GIÁO VIÊN (trình duyệt)
 ┌──────────────────────────────┐                         ┌──────────────────────────────────┐
 │ 6 hoạt động + Báo cáo        │                         │ Trang #tro-ly-giao-vien          │
 │ Gợi ý luyện tập (quy tắc)    │                         │ – chọn mức độ, nốt, dạng câu…    │
 │ Nhật ký: chỉ trong máy này   │                         │ – nhập mã giáo viên (không lưu)  │
 └──────────────┬───────────────┘                         └────────────────┬─────────────────┘
                │ KHÔNG gửi gì lên mạng                                     │ HTTPS POST /api/tro-ly-giao-vien
                ▼                                                           │ (chỉ các lựa chọn trong form)
          localStorage (nếu bật lưu)                                        ▼
                                                    ┌──────────────────────────────────────────────┐
                                                    │ Cloudflare Pages Function (máy chủ trường)   │
                                                    │ functions/api/tro-ly-giao-vien.js            │
                                                    │ 1. kiểm tra nguồn trang, mã giáo viên        │
                                                    │ 2. kiểm tra & lọc tham số (bỏ trường thừa)   │
                                                    │ 3. gọi Claude với khóa ANTHROPIC_API_KEY     │──► Anthropic API
                                                    │ 4. TÍNH LẠI đáp án bằng quy tắc (notes.js),  │◄── (claude-opus-5-5)
                                                    │    loại câu sai; kiểm tra kế hoạch hoạt động │
                                                    │ 5. trả kết quả đã kiểm tra về trình duyệt    │
                                                    └──────────────────────────────────────────────┘
```

Điểm quan trọng:

- **Khóa API không bao giờ xuống trình duyệt.** Nó chỉ nằm trong biến môi trường bí mật của Cloudflare.
  Phép kiểm thử "Mã chạy trên trình duyệt không chứa khóa API…" quét mọi file JS mà `index.html` nạp.
- **Không có dữ liệu học sinh nào đi qua AI.** Trang giáo viên chỉ gửi: mức độ, số câu, danh sách nốt, dạng câu,
  chủ đề (≤120 ký tự) hoặc lớp, số phút, mục tiêu (≤300 ký tự). Máy chủ bỏ mọi trường khác trước khi gọi AI
  (có phép kiểm thử). Trang nhắc giáo viên không nhập tên học sinh.
- **AI không tự quyết đáp án.** Mỗi câu AI viết phải khai báo dạng câu và các nốt liên quan; máy chủ tính đáp án
  bằng quy tắc nhạc lý và loại câu có đáp án sai, lộ đáp án trong lời hỏi, phương án không hợp lệ, hoặc không hỏi về
  nốt giáo viên chọn. Chữ của các phương án (tên nốt, vị trí) lấy từ `js/notes.js`, không lấy từ AI.
- **Lời văn do AI viết** (câu hỏi, giải thích, kế hoạch) được ghi rõ nguồn và nhắc giáo viên đọc lại.

## 3. Nhà cung cấp và mô hình

| Mục | Giá trị |
|---|---|
| Nhà cung cấp | Anthropic |
| Mô hình | `claude-opus-5-5` (Claude Opus 5.5) |
| Thư viện | SDK chính thức `@anthropic-ai/sdk` (Node/TypeScript), chạy trong Cloudflare Pages Functions |
| Cách gọi | `client.beta.messages.create` với `output_config.format` = JSON Schema (structured outputs) để câu trả lời luôn đúng cấu trúc; `effort: "medium"`; beta `server-side-fallback-2026-07-01` + `fallbacks: "default"` để API tự chạy lại trên mô hình khuyến nghị nếu bộ lọc an toàn từ chối nhầm |
| Mã nguồn | `functions/_lib/tro-ly-core.js` (logic, kiểm thử được), `functions/api/tro-ly-giao-vien.js` (gọi SDK) |

## 4. Biến môi trường (đặt loại **Secret** trong Cloudflare)

| Tên | Nội dung | Ghi chú |
|---|---|---|
| `ANTHROPIC_API_KEY` | Khóa API tạo ở Claude Console (console.anthropic.com) | Không ghi vào mã, không gửi qua chat/email, không đưa vào Git |
| `TEACHER_ACCESS_CODE` | Mã giáo viên do nhà trường tự đặt (nên ≥ 12 ký tự) | Chia cho giáo viên; đổi khi có người nghỉ hoặc nghi lộ |

Thiếu một trong hai biến, trang giáo viên tự báo "chưa cài đặt xong" và khóa nút tạo; các hoạt động của học sinh không bị ảnh hưởng.

## 5. Yêu cầu bảo mật – danh sách kiểm tra

Đã làm trong mã (có kiểm thử tự động):

- [x] Khóa API chỉ ở biến môi trường máy chủ; không có trong file gửi về trình duyệt.
- [x] Yêu cầu mã giáo viên (header `x-ma-giao-vien`), so sánh không phụ thuộc thời gian; sai mã → 401, không gọi AI.
- [x] Chặn yêu cầu từ trang khác (kiểm tra `Origin`) → 403.
- [x] Giới hạn kích thước (4000 ký tự) và kiểm tra từng tham số; chỉ chấp nhận 8 nốt Đô₄–Đô₅.
- [x] Kiểm tra kết quả AI bằng quy tắc trước khi trả về; hiển thị mọi chữ của AI dưới dạng văn bản (không chạy HTML).
- [x] Thông báo lỗi không lộ chi tiết khóa; trả `cache-control: no-store`.
- [x] Mã giáo viên không lưu trong trình duyệt và không nằm trong file tải về.

Nhà trường cần làm khi triển khai:

- [ ] Đặt **hạn mức chi tiêu** (spend limit) cho khóa API trong Claude Console.
- [ ] Tạo **luật giới hạn tần suất** (Rate limiting rule) của Cloudflare cho đường dẫn `/api/tro-ly-giao-vien`
      (ví dụ 10 yêu cầu/phút cho mỗi địa chỉ IP).
- [ ] Không bật ghi log nội dung yêu cầu; mã nguồn không tự ghi log.
- [ ] Dùng khóa API riêng cho dự án này để thu hồi được khi cần.

## 6. Đề xuất chưa làm: AI hỗ trợ học sinh sáng tạo giai điệu

Ý tưởng: học sinh ghép giai điệu ở Phòng sáng tạo, AI nhận xét (đi lên/đi xuống, lặp lại…) và gợi ý em tự giải thích ý tưởng.
**Chưa làm** vì:

1. Giai điệu và lời giải thích là dữ liệu của trẻ em; gửi lên máy chủ cần thông báo tới phụ huynh/nhà trường
   và cơ chế đồng ý phù hợp, trong khi phiên bản hiện tại cam kết không gửi dữ liệu học sinh.
2. Cần giáo viên giám sát nội dung AI trả lời cho học sinh.

Nếu làm, nên tái dùng đúng kiến trúc ở mục 2 (máy chủ trung gian, kiểm tra đầu vào/đầu ra), chỉ gửi chuỗi nốt (không gửi tên),
và bật theo lớp do giáo viên chủ động.

## 7. Chi phí (ước tính – cần đo thực tế)

Giá Claude Opus 5.5: 4 USD / 1 triệu token đầu vào, 20 USD / 1 triệu token đầu ra.
Một lần tạo 5–10 câu hỏi ước tính khoảng 1.000–1.500 token đầu vào và 2.000–5.000 token đầu ra (gồm phần suy nghĩ của mô hình),
tức khoảng **0,05–0,11 USD mỗi lần**. Đây là ước tính từ độ dài lời nhắn, **chưa đo bằng lần gọi thật**;
sau khi triển khai, xem số token thực trong Claude Console để điều chỉnh hạn mức.

## 8. Đã kiểm chứng / chưa kiểm chứng

| Đã kiểm chứng (trang `tests/kiem-thu.html`, chạy qua `tools/serve.ps1`) | Chưa kiểm chứng |
|---|---|
| Lõi máy chủ với AI giả lập: chặn sai mã/nguồn/tham số, tham số gửi Claude, lọc trường thừa, loại câu sai, xử lý từ chối/cắt ngang/lỗi dịch vụ, kiểm tra kế hoạch | Gọi Claude API thật (chưa có khóa trong môi trường phát triển) |
| Trang giáo viên: trạng thái chưa cài, gửi yêu cầu, hiển thị, tải file, chống chèn HTML | Chất lượng lời văn thật của AI |
| Không có khóa/địa chỉ API trong mã trình duyệt | Triển khai thật lên Cloudflare Pages, đóng gói SDK bằng Wrangler |
| Một phép thử "cố ý làm sai quy tắc" cho thấy bộ kiểm thử phát hiện câu sai đáp án | Chi phí thực tế, giới hạn tần suất của Cloudflare |
