# Deploy lên production

## 1. Chuẩn bị

- [ ] Đã tạo Supabase và chạy `npm run db:push` ([hướng dẫn](./DATABASE.md))
- [ ] Đã có `RESEND_API_KEY` và verify domain ([hướng dẫn](./API_KEYS.md))
- [ ] Đã có `CRON_SECRET` để tự động xử lý booking creator không phản hồi sau 48 giờ
- [ ] Đã quyết định cổng thanh toán (hoặc tạm giữ `mock` để demo)
- [ ] `npm run build` chạy sạch ở máy local

---

## 2. Deploy lên Vercel

```bash
npm i -g vercel
vercel login
vercel            # preview
vercel --prod     # production
```

Hoặc kết nối GitHub repo trong Vercel dashboard để auto-deploy mỗi lần push.

**Quan trọng:** deploy trên Vercel để cơ chế chặn IP hoạt động miễn phí — Vercel
tự gửi header `x-vercel-ip-country` cho mọi request. Nếu tự host trên VPS, phải
đặt Cloudflare phía trước (dùng `cf-ipcountry`), điền `IPINFO_TOKEN`, hoặc bật
provider `ipapi` làm fallback không cần token.

---

## 3. Biến môi trường trên Vercel

**Project → Settings → Environment Variables.** Dán từng biến từ `.env.local`,
nhưng **sửa các giá trị sau**:

```env
NEXT_PUBLIC_SITE_URL=https://bookingmodel.com
AUTH_SECRET=<chuỗi 96 ký tự mới, sinh bằng lệnh dưới>
GEO_UNKNOWN_POLICY=block
```

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> ⚠️ **`GEO_UNKNOWN_POLICY=block`** — trên production, request không xác định được
> quốc gia (proxy lạ, VPN che header) sẽ bị coi là không được thanh toán, thay vì
> được cho qua như ở môi trường dev.

---

## 4. Domain

1. **Vercel → Settings → Domains** → thêm `bookingmodel.com` và `www.bookingmodel.com`
2. Trỏ DNS theo hướng dẫn Vercel hiển thị
3. SSL tự động cấp sau vài phút

**Admin panel:** hiện chạy tại `/admin` trên cùng domain, đã có header
`X-Robots-Tag: noindex`. Nếu muốn tách sang `admin.bookingmodel.com` như TechSpec,
thêm domain đó trong Vercel và rewrite `/` → `/admin`.

---

## 5. Nạp dữ liệu lần đầu

Sau khi deploy và Supabase đã kết nối, database còn trống:

```bash
curl -X POST https://bookingmodel.com/api/admin/seed
```

Lần gọi đầu tiên không cần đăng nhập (vì bảng `users` còn rỗng). Sau đó endpoint
yêu cầu quyền admin.

Đăng nhập ngay và **đổi mật khẩu admin** — mật khẩu seed nằm trong repo.

---

## 6. Checklist trước khi go-live

### Bảo mật
- [ ] `AUTH_SECRET` là chuỗi ngẫu nhiên mới, không phải giá trị trong `.env.example`
- [ ] `GEO_UNKNOWN_POLICY=block`
- [ ] Đã đổi mật khẩu 4 tài khoản demo, hoặc xoá hẳn 3 tài khoản brand demo
- [ ] `SUPABASE_SERVICE_ROLE_KEY` chỉ nằm trong env của Vercel, không có trong git
- [ ] Migration RLS đã áp dụng (`npm run db:status` — cả 2 dòng có ở cột REMOTE)
- [ ] `.env.local` nằm trong `.gitignore` (đã có sẵn)

### Chức năng
- [ ] Vào site từ IP Mỹ (hoặc VPN Mỹ) → booking + thanh toán chạy được
- [ ] Vào site từ IP Việt Nam → banner hiện, modal liên hệ hoạt động, lead vào `/admin/booking-requests`
- [ ] Admin → Settings → GEO test switcher: bật để kiểm thử `US`/`VN`, sau đó tắt trước khi go-live; khi tắt, khu vực tự nhận diện từ IP
- [ ] Email thật gửi được (`/admin/emails` hiện `provider: resend`, `status: sent`)
- [ ] Hoá đơn in ra đúng
- [ ] Creator nhận được email có nút Accept/Decline; timeout/refund hiển thị đúng ở `/admin/deals`
- [ ] Sửa thông tin liên hệ thật trong `NEXT_PUBLIC_MANAGER_*` (hiện đang là số điện thoại mẫu)

### Nội dung
- [ ] Thay ảnh Unsplash bằng ảnh creator thật (hoặc bật Cloudinary)
- [ ] Kiểm tra lại 40 creator: `contact_email` phải là email thật —
      22/40 profile trong bộ dữ liệu mẫu đang dùng địa chỉ placeholder
      `@creators.bookingmodel.dev` vì file mockup không có email. Lọc bằng
      `/admin/creators` → cột Contact hiện badge `unverified`.
- [ ] Cập nhật `data/news.json` và `data/showcase.json` bằng case study thật

---

## 7. Giám sát sau khi chạy

| Cần theo dõi | Xem ở đâu |
|---|---|
| Booking đã thanh toán nhưng chưa báo được creator | `/admin` — cảnh báo màu vàng đầu trang |
| Email gửi thất bại | `/admin/emails` — lọc status `failed` |
| Lead từ khu vực bị chặn chưa xử lý | `/admin/booking-requests` — badge `new` |
| Creator chưa verify contact | `/admin/creators` — badge `unverified` |
| Trạng thái mọi API key | `/admin/settings` |

---

## Ghi chú kỹ thuật

**Vì sao không dùng Edge runtime cho API routes?**
`bcryptjs` và `node:fs` (JSON store) cần Node runtime. Middleware vẫn chạy trên
edge nên việc xác định quốc gia không tốn thêm latency.

**Rate limiting**
Chưa bật. TechSpec đề xuất Upstash Redis — biến `UPSTASH_REDIS_REST_URL` /
`UPSTASH_REDIS_REST_TOKEN` đã có sẵn placeholder trong `.env.example`. Nên bật cho
`POST /api/booking-requests`, `/api/applicants`, `/api/contact` để chống spam form.

**JSON store trên production**
Không dùng được: Vercel có filesystem read-only và mỗi lambda là một instance
riêng. Bắt buộc phải kết nối Supabase trước khi deploy nếu muốn dữ liệu tồn tại.
