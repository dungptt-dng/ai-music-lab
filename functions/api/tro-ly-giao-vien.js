/*
 * AI MUSIC LAB – Cloudflare Pages Function: /api/tro-ly-giao-vien
 *
 * GET  → trạng thái (đã cài đặt khóa API và mã giáo viên chưa).
 * POST → tạo câu hỏi luyện tập / gợi ý hoạt động bằng Claude (Anthropic). Cần header "x-ma-giao-vien".
 *
 * Biến môi trường (đặt trong Cloudflare → Pages → Settings → Variables and Secrets, loại "Secret"):
 *   ANTHROPIC_API_KEY    – khóa API Anthropic. KHÔNG bao giờ đặt trong mã nguồn hay file gửi lên trình duyệt.
 *   TEACHER_ACCESS_CODE  – mã giáo viên tự đặt, nhập ở trang Trợ lý giáo viên.
 *
 * Toàn bộ logic (kiểm tra đầu vào, lời nhắn, kiểm tra đáp án) nằm ở ../_lib/tro-ly-core.js.
 */
import Anthropic from '@anthropic-ai/sdk';
import { handleGenerate, handleStatus } from '../_lib/tro-ly-core.js';

// Phân loại lỗi bằng các lớp lỗi của SDK (từ cụ thể đến chung).
function classifyError(error) {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return 'auth';
  if (error instanceof Anthropic.RateLimitError) return 'rate';
  if (error instanceof Anthropic.BadRequestError) return 'bad-request';
  if (error instanceof Anthropic.InternalServerError) return 'overloaded';
  if (error instanceof Anthropic.APIConnectionError) return 'overloaded';
  if (error instanceof Anthropic.APIError && error.type === 'billing_error') return 'billing';
  return 'other';
}

export function onRequestGet({ env }) {
  return handleStatus(env);
}

export async function onRequestPost({ request, env }) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return handleGenerate(request, env, { client, classifyError });
}
