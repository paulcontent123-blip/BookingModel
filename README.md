# BookingModel.com

Creator marketing marketplace kết nối brand Bắc Mỹ với KOL/KOC đã được VEA vet thủ công.

**Stack:** Next.js 15 (App Router) · TypeScript · Supabase (PostgreSQL) · Resend · Vercel

---

## Chạy thử ngay (không cần key nào)

```bash
npm install
npm run dev
```

Mở <http://localhost:3000>. Lần chạy đầu tiên tự nạp 40 creator, 6 campaign và
4 tài khoản demo vào `./.data/db.json`.

**Tài khoản demo:**

| Vai trò | Email | Password |
|---|---|---|
| Admin | `admin@bookingmodel.com` | `Admin@BM2026` |
| Brand (Pro) | `brand@demo.com` | `BrandDemo123` |
| Brand (Standard) | `standard@demo.com` | `StandardDemo123` |
| Brand (Free) | `free@demo.com` | `FreeDemo123` |

---

## Ba tầng của hệ thống

| URL | Dành cho | Nội dung |
|---|---|---|
| `/` | Công khai | Marketplace, campaigns, solutions, news, form apply/contact |
| `/dashboard` | Brand đã đăng nhập | Duyệt creator + contact info, bookings, hóa đơn |
| `/admin` | Chỉ admin | Creator database, import Excel, applicants, deals, leads, email log, settings |

---

## Cơ chế chặn IP theo khu vực

> Yêu cầu #1 và #2: chỉ thị trường Mỹ mới booking/thanh toán được. Việt Nam và
> Đông Nam Á xem được hết nhưng không thanh toán được, thay vào đó để lại thông tin
> liên hệ.

**Cách hoạt động:**

1. `middleware.ts` xác định quốc gia mỗi request từ header
   `x-vercel-ip-country` (Vercel) hoặc `cf-ipcountry` (Cloudflare) — **miễn phí,
   không cần API key**. Header do client gửi lên bị xoá trước khi middleware ghi
   giá trị của mình, nên không giả mạo được.
2. Quốc gia được truyền tới mọi server component qua header `x-bm-country`.
3. `PAYMENT_ALLOWED_COUNTRIES=US,CA` quyết định ai được thanh toán.
4. **Chặn ở server, không phải ở UI**: `POST /api/bookings` gọi
   `assertCanTransact()` trước khi động tới tiền. Gọi thẳng API từ curl với IP
   Việt Nam vẫn nhận `403 GEO_RESTRICTED`.
5. Với khu vực bị chặn, UI mở modal "Booking assistance" chứa thông tin liên hệ
   thật của account manager + form. Form gửi tới `POST /api/booking-requests` →
   lưu bảng `booking_requests` → gửi email cho `SALES_EMAIL` và email xác nhận
   cho người gửi. Admin xử lý tại `/admin/booking-requests`.

**Test không cần VPN:** thêm `?geo=VN` (hoặc `?geo=US`, `?geo=SG`…) vào bất kỳ URL
nào, hoặc dùng bộ chuyển quốc gia ở góc dưới trái màn hình. Chỉ hoạt động khi
`NEXT_PUBLIC_GEO_DEBUG=true` — **phải tắt trên production**.

```bash
# Kiểm tra bằng curl
curl -H "x-vercel-ip-country: VN" localhost:3000/api/geo
curl -H "x-vercel-ip-country: US" localhost:3000/api/geo
```

---

## Luồng booking (yêu cầu #3 và #5)

```
Brand Mỹ  →  /book/[creatorId]  →  POST /api/bookings
                                        │
                                        ├─ assertCanTransact()      ← chặn ngoài US/CA
                                        ├─ paymentProvider().charge()
                                        ├─ tạo bản ghi deals   (BM-2026-0001)
                                        ├─ tạo bản ghi invoices (BM-INV-2026-0001)
                                        └─ gửi 3 email:
                                             ① creator  → brief + rate + deadline   (yêu cầu #5)
                                             ② brand    → xác nhận thanh toán + hoá đơn
                                             ③ admin    → thông báo nội bộ
                                        ↓
                          /booking/success/BM-2026-0001
                          /invoices/BM-INV-2026-0001   (in / lưu PDF)
```

**Cổng thanh toán chưa chốt** nên `PAYMENT_PROVIDER=mock`: mọi thứ chạy thật
(deal, hoá đơn, email), chỉ bước trừ tiền là giả lập. Thẻ kết thúc bằng `0000`
giả lập bị từ chối. Đổi sang Stripe: xem [`docs/API_KEYS.md`](docs/API_KEYS.md).

---

## Creator do admin thêm (yêu cầu #4)

- `/admin/creators/new` — nhập tay từng profile
- `/admin/import` — upload CSV/Excel, xem preview trước khi confirm, tự bỏ qua
  handle trùng (13 cột, xem bảng mapping trên trang đó)
- `/admin/applicants` — creator tự đăng ký qua `/apply` vào đây, admin duyệt →
  tự tạo profile công khai + gửi email báo cho creator

Creator không thể tự đăng ký rồi lên marketplace ngay — luôn phải qua admin duyệt.

---

## Cấu trúc thư mục

```
app/
  (site)/          Public site + brand dashboard
  admin/           Internal dashboard (noindex)
  api/             Route handlers
components/        UI components (geo, checkout, admin…)
lib/
  config.ts        Đọc toàn bộ env — chỉ một nơi duy nhất
  db/              Data layer: driver.ts (interface) + json-store / supabase-store
  geo.ts           Logic xác định quốc gia
  guard.ts         assertCanTransact() — chặn phía server
  auth.ts          bcrypt + JWT httpOnly cookie
  payments/        PaymentProvider interface + mock + stripe
  email/           Resend wrapper + templates HTML
  services/        booking.ts, admin-actions.ts, refs.ts
  seed.ts          Nạp dữ liệu demo
data/              40 creators + campaigns + news (trích từ file mockup)
supabase/          config.toml + migrations/ + seed.sql
docs/              Hướng dẫn Supabase, API keys, deploy
```

**Điểm quan trọng:** không có file nào ngoài `lib/db/` biết đang dùng JSON hay
Supabase. Đổi database = điền key, không sửa code.

---

## Deploy

```bash
npm run build     # kiểm tra build sạch
vercel            # hoặc: vercel --prod
```

Xem [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) cho checklist đầy đủ.

---

## Tài liệu

| File | Nội dung |
|---|---|
| [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md) | Tạo database Supabase, chạy schema, lấy key |
| [`docs/API_KEYS.md`](docs/API_KEYS.md) | Từng dịch vụ: lấy key ở đâu, điền vào đâu |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Deploy Vercel + checklist trước go-live |
| [`docs/TESTING.md`](docs/TESTING.md) | Cách test 5 yêu cầu chính |

---

## Lệnh

```bash
npm run dev         # dev server
npm run build       # production build
npm start           # chạy bản build
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
```
