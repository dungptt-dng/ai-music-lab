/*
 * AI MUSIC LAB – Lõi máy chủ "Trợ lý giáo viên" (chạy trên Cloudflare Pages Functions)
 *
 * Đây là phần DUY NHẤT của sản phẩm dùng mô hình AI thật (Claude của Anthropic). Nó chỉ dành cho giáo viên:
 *   - "cau-hoi":   tạo câu hỏi luyện tập theo mức độ, về các nốt giáo viên chọn;
 *   - "hoat-dong": gợi ý kế hoạch một hoạt động âm nhạc dùng các mục của ứng dụng.
 *
 * NGUYÊN TẮC
 *  1. Khóa API chỉ nằm ở biến môi trường bí mật ANTHROPIC_API_KEY trên máy chủ – không bao giờ gửi về trình duyệt.
 *  2. Phải có mã giáo viên (biến môi trường TEACHER_ACCESS_CODE) thì mới gọi AI – tránh người ngoài dùng tốn tiền.
 *  3. Chỉ gửi cho AI các lựa chọn giáo viên nhập trong form – KHÔNG gửi kết quả, nhật ký hay thông tin học sinh.
 *  4. AI KHÔNG được tự quyết đáp án: mỗi câu hỏi phải khai báo dạng câu và các nốt liên quan; máy chủ tính lại
 *     đáp án bằng quy tắc nhạc lý (js/notes.js) và LOẠI mọi câu sai. Chữ hiển thị cho các phương án (tên nốt,
 *     vị trí) cũng lấy từ js/notes.js chứ không lấy từ AI.
 *  5. Lời văn câu hỏi và kế hoạch hoạt động do AI viết – giáo viên phải đọc lại trước khi dùng với học sinh.
 *
 * File này không phụ thuộc thư viện nào, để trang kiểm thử chạy được nó với một "AI giả lập".
 * Phần gọi SDK thật nằm trong functions/api/tro-ly-giao-vien.js.
 */
import '../../js/notes.js';

const MusicNotes = globalThis.MusicNotes;
const NOTES = MusicNotes.NOTES;
const NOTE_IDS = NOTES.map((n) => n.id);

export const MODEL = 'claude-opus-5-5';
export const MAX_BODY_CHARS = 4000;
export const ACCESS_HEADER = 'x-ma-giao-vien';
const MAX_TOKENS = 16000;
// Khi bộ lọc an toàn của Claude Opus 5.5 từ chối nhầm, API tự chạy lại trên mô hình Anthropic khuyến nghị.
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export const LEVELS = {
  de:  { name: 'Dễ',  minOptions: 2, maxOptions: 3 },
  vua: { name: 'Vừa', minOptions: 3, maxOptions: 4 },
  kho: { name: 'Khó', minOptions: 4, maxOptions: 4 }
};

/*
 * Các dạng câu hỏi AI được phép tạo. Mỗi dạng có cách TÍNH ĐÁP ÁN bằng quy tắc (answer),
 * nên máy chủ kiểm tra được mọi câu AI viết ra.
 */
export const KINDS = {
  'ten-not-tren-khuong': {
    name: 'Đọc tên nốt trên khuông', noteCount: 1,
    answer: (notes) => notes[0].id,
    hint: 'Ứng dụng sẽ vẽ nốt notes[0] trên khuông bên cạnh câu hỏi. Lời câu hỏi KHÔNG được nêu tên hay ký hiệu của nốt đó.'
  },
  'vi-tri-cua-not': {
    name: 'Vị trí của nốt', noteCount: 1,
    answer: (notes) => notes[0].id,
    hint: 'Hỏi nốt notes[0] nằm ở đâu. Các phương án là id nốt; ứng dụng sẽ hiển thị VỊ TRÍ của từng nốt làm phương án.'
  },
  'not-cao-hon': {
    name: 'Nốt nào cao hơn', noteCount: 2, twoOptions: true,
    answer: (notes) => (indexOf(notes[0]) > indexOf(notes[1]) ? notes[0] : notes[1]).id,
    hint: 'Hỏi nốt nào cao hơn giữa notes[0] và notes[1]; phương án đúng bằng hai nốt đó.'
  },
  'not-thap-hon': {
    name: 'Nốt nào thấp hơn', noteCount: 2, twoOptions: true,
    answer: (notes) => (indexOf(notes[0]) < indexOf(notes[1]) ? notes[0] : notes[1]).id,
    hint: 'Hỏi nốt nào thấp hơn giữa notes[0] và notes[1]; phương án đúng bằng hai nốt đó.'
  },
  'not-lien-sau': {
    name: 'Nốt liền sau (đi lên)', noteCount: 1,
    answer: (notes) => (indexOf(notes[0]) < NOTES.length - 1 ? NOTES[indexOf(notes[0]) + 1].id : null),
    hint: 'Hỏi nốt đứng ngay sau notes[0] khi đi lên (không dùng Đô₅ làm notes[0]).'
  },
  'not-lien-truoc': {
    name: 'Nốt liền trước (đi xuống)', noteCount: 1,
    answer: (notes) => (indexOf(notes[0]) > 0 ? NOTES[indexOf(notes[0]) - 1].id : null),
    hint: 'Hỏi nốt đứng ngay trước notes[0] (không dùng Đô₄ làm notes[0]).'
  }
};
const KIND_KEYS = Object.keys(KINDS);

// Các mục của ứng dụng mà kế hoạch hoạt động được phép nhắc tới ('' = hoạt động không dùng máy).
export const APP_VIEWS = {
  '': 'Không dùng ứng dụng',
  'khuong-nhac': 'Khuông nhạc tương tác',
  'nghe-cao-do': 'Nghe cao độ',
  'trac-nghiem': 'Trắc nghiệm',
  'keo-tha': 'Kéo thả nốt',
  'sang-tao': 'Phòng sáng tạo giai điệu',
  'bao-cao': 'Báo cáo'
};

function indexOf(note) { return NOTES.indexOf(note); }
function capitalize(text) { return text.charAt(0).toUpperCase() + text.slice(1); }
function isText(value, min, max) { return typeof value === 'string' && value.trim().length >= min && value.length <= max; }
function isInt(value, min, max) { return Number.isInteger(value) && value >= min && value <= max; }

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function fail(status, code, message) {
  return json(status, { ok: false, error: code, message });
}

// So sánh mã giáo viên với thời gian không phụ thuộc vào vị trí ký tự sai.
function sameSecret(given, expected) {
  const a = String(given || ''), b = String(expected || '');
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0 && b.length > 0;
}

// ---------- Kiểm tra yêu cầu của giáo viên ----------
function cleanNotes(value, fallbackAll) {
  if (value === undefined || value === null || (Array.isArray(value) && !value.length)) return fallbackAll ? NOTE_IDS.slice() : [];
  if (!Array.isArray(value) || value.some((id) => !NOTE_IDS.includes(id))) return null;
  return NOTE_IDS.filter((id) => value.includes(id));   // bỏ trùng, giữ thứ tự cao độ
}

/*
 * Trả về { ok: true, task, params } hoặc { ok: false, message }.
 * Chỉ nhận đúng các trường dưới đây; mọi trường khác bị bỏ qua (không chuyển cho AI).
 */
export function validateRequest(body) {
  if (!body || typeof body !== 'object') return { ok: false, message: 'Yêu cầu không đúng định dạng.' };
  if (body.task === 'cau-hoi') {
    const level = LEVELS[body.level] ? body.level : null;
    if (!level) return { ok: false, message: 'Mức độ phải là de, vua hoặc kho.' };
    if (!isInt(body.count, 3, 10)) return { ok: false, message: 'Số câu phải từ 3 đến 10.' };
    const notes = cleanNotes(body.notes, true);
    if (!notes) return { ok: false, message: 'Danh sách nốt chỉ được gồm 8 nốt từ C4 đến C5.' };
    const kinds = body.kinds === undefined || (Array.isArray(body.kinds) && !body.kinds.length) ? KIND_KEYS.slice() : body.kinds;
    if (!Array.isArray(kinds) || kinds.some((k) => !KINDS[k])) return { ok: false, message: 'Dạng câu hỏi không hợp lệ.' };
    const theme = body.theme === undefined ? '' : body.theme;
    if (typeof theme !== 'string' || theme.length > 120) return { ok: false, message: 'Chủ đề tối đa 120 ký tự.' };
    if (notes.length < 2 && kinds.every((k) => KINDS[k].noteCount === 2)) {
      return { ok: false, message: 'Dạng so sánh cao – thấp cần chọn ít nhất 2 nốt.' };
    }
    return { ok: true, task: 'cau-hoi', params: { level, count: body.count, notes, kinds: KIND_KEYS.filter((k) => kinds.includes(k)), theme: theme.trim() } };
  }
  if (body.task === 'hoat-dong') {
    if (body.grade !== 4 && body.grade !== 5) return { ok: false, message: 'Lớp phải là 4 hoặc 5.' };
    if (!isInt(body.minutes, 5, 45)) return { ok: false, message: 'Thời lượng phải từ 5 đến 45 phút.' };
    if (!isText(body.goal, 5, 300)) return { ok: false, message: 'Mục tiêu cần từ 5 đến 300 ký tự.' };
    const notes = cleanNotes(body.notes, true);
    if (!notes) return { ok: false, message: 'Danh sách nốt chỉ được gồm 8 nốt từ C4 đến C5.' };
    return { ok: true, task: 'hoat-dong', params: { grade: body.grade, minutes: body.minutes, goal: body.goal.trim(), notes } };
  }
  return { ok: false, message: 'Chỉ hỗ trợ task "cau-hoi" hoặc "hoat-dong".' };
}

// ---------- Lời nhắn gửi Claude ----------
const NOTE_TABLE = NOTES.map((n) => '- ' + n.id + ' = ' + n.label + ' (ký hiệu ' + n.symbol + '): ' + n.position).join('\n');

// Phần cố định (giống nhau ở mọi yêu cầu).
export const SYSTEM_PROMPT =
  'Bạn hỗ trợ giáo viên âm nhạc tiểu học Việt Nam (lớp 4–5) soạn nội dung cho ứng dụng AI MUSIC LAB.\n' +
  'Ứng dụng chỉ dạy 8 nốt từ Đô₄ đến Đô₅ trên khuông nhạc khóa Sol. Dùng ĐÚNG tên và vị trí trong bảng sau, ' +
  'không thêm nốt thăng/giáng hay nốt ngoài bảng:\n' + NOTE_TABLE + '\n' +
  'Thứ tự từ thấp đến cao: Đô₄, Rê₄, Mi₄, Pha₄, Sol₄, La₄, Si₄, Đô₅.\n' +
  'Viết tiếng Việt chuẩn, câu ngắn, giọng thân thiện với học sinh 9–11 tuổi. Không dùng họ tên người thật, ' +
  'không nhắc thương hiệu, không đưa nội dung không phù hợp với trẻ em. ' +
  'Học sinh chỉ dùng ứng dụng trong lớp, không cần tài khoản. Trả lời đúng theo cấu trúc JSON được yêu cầu.';

const QUESTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'notes', 'prompt', 'options', 'answerId', 'explanation'],
        properties: {
          kind: { type: 'string', enum: KIND_KEYS },
          notes: { type: 'array', items: { type: 'string', enum: NOTE_IDS } },
          prompt: { type: 'string' },
          options: { type: 'array', items: { type: 'string', enum: NOTE_IDS } },
          answerId: { type: 'string', enum: NOTE_IDS },
          explanation: { type: 'string' }
        }
      }
    }
  }
};

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'objectives', 'steps', 'assessment'],
  properties: {
    title: { type: 'string' },
    objectives: { type: 'array', items: { type: 'string' } },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['minutes', 'name', 'teacher', 'students', 'appView'],
        properties: {
          minutes: { type: 'integer' },
          name: { type: 'string' },
          teacher: { type: 'string' },
          students: { type: 'string' },
          appView: { type: 'string', enum: Object.keys(APP_VIEWS) }
        }
      }
    },
    assessment: { type: 'string' }
  }
};

function labels(ids) { return ids.map((id) => MusicNotes.findNote(id).label).join(', '); }

function questionInstructions(p) {
  const level = LEVELS[p.level];
  return 'Hãy tạo ' + p.count + ' câu hỏi trắc nghiệm, mức ' + level.name + '.\n' +
    'Mỗi câu phải xoay quanh ít nhất một trong các nốt giáo viên chọn: ' + labels(p.notes) + ' (id: ' + p.notes.join(', ') + ').\n' +
    'Chỉ dùng các dạng câu sau (trường "kind"):\n' +
    p.kinds.map((k) => '- ' + k + ': ' + KINDS[k].name + '. ' + KINDS[k].hint).join('\n') + '\n' +
    'Trường "notes" là id các nốt mà câu hỏi nói tới (đúng số lượng của dạng câu). ' +
    'Trường "options" là id các phương án: ' + level.minOptions + '–' + level.maxOptions +
    ' phương án khác nhau, có đáp án đúng (riêng dạng cao hơn/thấp hơn: đúng 2 phương án là hai nốt được so sánh). ' +
    'Trường "answerId" là id đáp án đúng. ' +
    'Trường "prompt" là lời câu hỏi; trừ dạng ten-not-tren-khuong, lời câu hỏi phải nêu tên tiếng Việt của mọi nốt trong "notes" ' +
    '(ví dụ "Rê₄"). Trường "explanation" (1–2 câu) giải thích vì sao đúng và phải nêu tên đáp án.\n' +
    'Không lặp lại cùng một dạng câu với cùng các nốt.' +
    (p.theme ? '\nCó thể lồng vào chủ đề do giáo viên gợi ý: "' + p.theme + '".' : '');
}

function planInstructions(p) {
  return 'Hãy gợi ý kế hoạch một hoạt động âm nhạc cho lớp ' + p.grade + ', tổng thời lượng ' + p.minutes + ' phút.\n' +
    'Mục tiêu của giáo viên: "' + p.goal + '".\n' +
    'Tập trung vào các nốt: ' + labels(p.notes) + '.\n' +
    'Chia thành 2–6 bước; tổng số phút các bước bằng ' + p.minutes + '. Mỗi bước nêu việc giáo viên làm ("teacher") ' +
    'và việc học sinh làm ("students"). Trường "appView" là mục ứng dụng dùng trong bước đó, chỉ chọn trong: ' +
    Object.keys(APP_VIEWS).filter(Boolean).map((k) => k + ' (' + APP_VIEWS[k] + ')').join(', ') +
    ', hoặc "" nếu bước đó không dùng máy. Có ít nhất một bước dùng ứng dụng.\n' +
    'Chỉ nhắc tới những gì các mục trên thực sự làm được: Khuông nhạc (nghe/xem 8 nốt, Tìm nốt), Nghe cao độ (nghe rồi chọn tên nốt), ' +
    'Trắc nghiệm (câu hỏi về tên, vị trí, thứ tự, cao – thấp), Kéo thả (đặt nốt lên khuông), Phòng sáng tạo (ghép tối đa 16 nốt thành giai điệu, ' +
    'phát, lưu file), Báo cáo (số câu đúng/sai, nốt hay nhầm). "objectives": 1–4 mục tiêu ngắn. "assessment": cách giáo viên kiểm tra ' +
    'học sinh đạt mục tiêu (không chấm điểm bằng AI).';
}

/*
 * Tham số gửi cho client.beta.messages.create (SDK chính thức của Anthropic).
 * Structured outputs (output_config.format) buộc câu trả lời theo đúng cấu trúc JSON; effort "medium" đủ cho việc soạn ngắn.
 */
export function buildMessageParams(task, params) {
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    system: SYSTEM_PROMPT,
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: task === 'cau-hoi' ? QUESTION_SCHEMA : PLAN_SCHEMA }
    },
    messages: [{ role: 'user', content: task === 'cau-hoi' ? questionInstructions(params) : planInstructions(params) }]
  };
}

// ---------- Kiểm tra lại kết quả của AI bằng quy tắc ----------
function optionText(kind, id) {
  const note = MusicNotes.findNote(id);
  return kind === 'vi-tri-cua-not' ? capitalize(note.position) : note.label;
}

/*
 * Kiểm tra MỘT câu hỏi. Trả về lý do bị loại (chuỗi), hoặc null nếu đạt.
 * Đáp án đúng được TÍNH LẠI từ dạng câu + các nốt, không tin vào answerId của AI.
 */
export function checkQuestion(q, params) {
  const kind = KINDS[q && q.kind];
  if (!kind || !params.kinds.includes(q.kind)) return 'dạng câu không nằm trong lựa chọn của giáo viên';
  if (!Array.isArray(q.notes) || q.notes.length !== kind.noteCount) return 'số nốt không đúng với dạng câu';
  const notes = q.notes.map((id) => MusicNotes.findNote(id));
  if (notes.some((n) => !n) || new Set(q.notes).size !== q.notes.length) return 'nốt không hợp lệ';
  if (!q.notes.some((id) => params.notes.includes(id))) return 'không hỏi về nốt giáo viên chọn';
  const expected = kind.answer(notes);
  if (!expected) return 'câu hỏi không có đáp án trong 8 nốt';
  if (q.answerId !== expected) {
    return 'đáp án AI đưa ra (' + (MusicNotes.findNote(q.answerId) || {}).label + ') sai – đúng phải là ' + MusicNotes.findNote(expected).label;
  }
  const level = LEVELS[params.level];
  const options = Array.isArray(q.options) ? q.options : [];
  if (options.some((id) => !MusicNotes.findNote(id)) || new Set(options).size !== options.length) return 'phương án không hợp lệ';
  if (!options.includes(expected)) return 'thiếu đáp án đúng trong các phương án';
  if (kind.twoOptions) {
    if (options.length !== 2 || !q.notes.every((id) => options.includes(id))) return 'câu so sánh phải có đúng 2 phương án là hai nốt được so sánh';
  } else if (options.length < level.minOptions || options.length > level.maxOptions) {
    return 'số phương án không hợp với mức ' + level.name;
  }
  if (!isText(q.prompt, 8, 300)) return 'lời câu hỏi quá ngắn hoặc quá dài';
  if (q.kind === 'ten-not-tren-khuong') {
    if (q.prompt.includes(notes[0].label) || q.prompt.includes(notes[0].symbol)) return 'lời câu hỏi để lộ đáp án';
  } else if (!notes.every((n) => q.prompt.includes(n.label))) {
    return 'lời câu hỏi không nêu đúng nốt được hỏi';
  }
  if (!isText(q.explanation, 8, 400) || !q.explanation.includes(MusicNotes.findNote(expected).label)) {
    return 'lời giải thích không nêu đáp án đúng';
  }
  return null;
}

export function verifyQuestions(raw, params) {
  const accepted = [], rejected = [], seen = new Set();
  const list = raw && Array.isArray(raw.questions) ? raw.questions : [];
  list.forEach((q, index) => {
    let reason = checkQuestion(q, params);
    const key = q && q.kind + ':' + (q.notes || []).slice().sort().join('-');
    if (!reason && seen.has(key)) reason = 'trùng với câu trước';
    if (reason) { rejected.push({ index: index + 1, reason }); return; }
    seen.add(key);
    accepted.push({
      kind: q.kind,
      kindName: KINDS[q.kind].name,
      notes: q.notes.slice(),
      staffNoteId: q.kind === 'ten-not-tren-khuong' ? q.notes[0] : null,
      prompt: q.prompt.trim(),
      options: q.options.map((id) => ({ id, text: optionText(q.kind, id) })),
      answerId: q.answerId,
      explanation: q.explanation.trim(),
      verified: true
    });
  });
  return { accepted: accepted.slice(0, params.count), rejected };
}

// Kiểm tra kế hoạch hoạt động: cấu trúc, tổng thời lượng, chỉ nhắc tới các mục có thật của ứng dụng.
export function verifyLessonPlan(raw, params) {
  if (!raw || !isText(raw.title, 3, 150)) return { ok: false, reason: 'thiếu tên hoạt động' };
  if (!Array.isArray(raw.objectives) || raw.objectives.length < 1 || raw.objectives.length > 5 ||
      raw.objectives.some((o) => !isText(o, 3, 300))) return { ok: false, reason: 'mục tiêu không hợp lệ' };
  if (!Array.isArray(raw.steps) || raw.steps.length < 2 || raw.steps.length > 8) return { ok: false, reason: 'số bước phải từ 2 đến 8' };
  for (const s of raw.steps) {
    if (!isInt(s.minutes, 1, 45) || !isText(s.name, 2, 150) || !isText(s.teacher, 3, 600) || !isText(s.students, 3, 600)) {
      return { ok: false, reason: 'có bước thiếu nội dung hoặc thời lượng' };
    }
    if (!(s.appView in APP_VIEWS)) return { ok: false, reason: 'nhắc tới mục không có trong ứng dụng' };
  }
  const total = raw.steps.reduce((sum, s) => sum + s.minutes, 0);
  if (total > params.minutes || total < Math.ceil(params.minutes * 0.6)) {
    return { ok: false, reason: 'tổng thời lượng ' + total + ' phút không khớp ' + params.minutes + ' phút' };
  }
  if (!raw.steps.some((s) => s.appView)) return { ok: false, reason: 'không có bước nào dùng ứng dụng' };
  if (!isText(raw.assessment, 3, 600)) return { ok: false, reason: 'thiếu cách đánh giá' };
  return {
    ok: true,
    plan: {
      title: raw.title.trim(),
      objectives: raw.objectives.map((o) => o.trim()),
      steps: raw.steps.map((s) => ({ minutes: s.minutes, name: s.name.trim(), teacher: s.teacher.trim(),
        students: s.students.trim(), appView: s.appView, appName: s.appView ? APP_VIEWS[s.appView] : '' })),
      totalMinutes: total,
      assessment: raw.assessment.trim()
    }
  };
}

// ---------- Xử lý yêu cầu HTTP ----------
function configProblems(env) {
  const problems = [];
  if (!env || !env.ANTHROPIC_API_KEY) problems.push('Chưa đặt biến môi trường ANTHROPIC_API_KEY.');
  if (!env || !env.TEACHER_ACCESS_CODE) problems.push('Chưa đặt biến môi trường TEACHER_ACCESS_CODE (mã giáo viên).');
  return problems;
}

// GET: cho trang biết trợ lý đã được cài đặt chưa. Không bao giờ trả về khóa hay mã.
export function handleStatus(env) {
  const problems = configProblems(env);
  return json(200, { ok: true, ready: problems.length === 0, model: MODEL, problems });
}

/*
 * POST: tạo nội dung. deps.client là Anthropic client (hoặc bản giả lập khi kiểm thử);
 * deps.classifyError(err) trả về 'auth' | 'billing' | 'rate' | 'overloaded' | 'bad-request' | 'other'.
 */
export async function handleGenerate(request, env, deps) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return fail(403, 'sai-nguon', 'Chỉ trang AI MUSIC LAB của trường mới được dùng trợ lý.');
  if (configProblems(env).length) return fail(503, 'chua-cau-hinh', 'Trợ lý AI chưa được cài đặt trên máy chủ này.');
  if (!sameSecret(request.headers.get(ACCESS_HEADER), env.TEACHER_ACCESS_CODE)) {
    return fail(401, 'sai-ma', 'Mã giáo viên không đúng.');
  }

  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return fail(413, 'qua-dai', 'Yêu cầu quá dài.');
  let body;
  try { body = JSON.parse(text); } catch (e) { return fail(400, 'khong-hop-le', 'Yêu cầu không phải JSON.'); }
  const checked = validateRequest(body);
  if (!checked.ok) return fail(400, 'khong-hop-le', checked.message);

  let response;
  try {
    response = await deps.client.beta.messages.create(buildMessageParams(checked.task, checked.params));
  } catch (error) {
    const kind = deps.classifyError(error);
    if (kind === 'rate') return fail(429, 'qua-tai', 'Trợ lý đang nhận quá nhiều yêu cầu. Hãy thử lại sau ít phút.');
    if (kind === 'overloaded') return fail(503, 'qua-tai', 'Dịch vụ AI đang bận. Hãy thử lại sau ít phút.');
    if (kind === 'auth' || kind === 'billing') return fail(500, 'loi-cau-hinh', 'Máy chủ chưa được cấu hình đúng (khóa API hoặc hạn mức). Hãy báo người quản trị.');
    return fail(502, 'loi-ai', 'Chưa nhận được kết quả từ dịch vụ AI. Hãy thử lại.');
  }

  if (response.stop_reason === 'refusal') return fail(422, 'tu-choi', 'Dịch vụ AI từ chối yêu cầu này. Hãy diễn đạt lại mục tiêu.');
  if (response.stop_reason === 'max_tokens') return fail(502, 'chua-xong', 'Kết quả bị cắt ngang. Hãy thử lại với ít câu hơn.');
  const block = (response.content || []).find((b) => b.type === 'text');
  let raw;
  try { raw = JSON.parse(block ? block.text : ''); } catch (e) { return fail(502, 'loi-ai', 'Kết quả AI không đọc được. Hãy thử lại.'); }

  if (checked.task === 'cau-hoi') {
    const result = verifyQuestions(raw, checked.params);
    if (!result.accepted.length) {
      return json(502, { ok: false, error: 'khong-dat', message: 'Không câu nào qua được bước kiểm tra đáp án. Hãy thử lại.', rejected: result.rejected });
    }
    return json(200, { ok: true, task: 'cau-hoi', model: response.model, questions: result.accepted, rejected: result.rejected });
  }
  const plan = verifyLessonPlan(raw, checked.params);
  if (!plan.ok) return json(502, { ok: false, error: 'khong-dat', message: 'Kế hoạch AI đưa ra chưa đạt kiểm tra (' + plan.reason + '). Hãy thử lại.' });
  return json(200, { ok: true, task: 'hoat-dong', model: response.model, plan: plan.plan });
}
