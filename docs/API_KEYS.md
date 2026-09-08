# Danh sách API key — lấy ở đâu, điền vào đâu

Toàn bộ key nằm trong `.env.local`. File `.env.example` đã có sẵn **key mẫu
(placeholder)** cho mọi dịch vụ — bạn chỉ việc thay giá trị thật vào.

Ứng dụng **chạy được với 100% key placeholder**. Mỗi dịch vụ thiếu key sẽ tự
fallback sang chế độ an toàn (xem cột "Khi chưa có key").

Kiểm tra trạng thái mọi key bất cứ lúc nào tại **`/admin/settings`**.

---

## Bảng tổng hợp

| Dịch vụ | Biến môi trường | Bắt buộc? | Khi chưa có key |
|---|---|---|---|
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`<br>`NEXT_PUBLIC_SUPABASE_ANON_KEY`<br>`SUPABASE_SERVICE_ROLE_KEY` | Cho production | Dùng file `./.data/db.json` |
| **Resend** (email) | `RESEND_API_KEY` | Cho production | Ghi ra console + `/admin/emails` |
| **Stripe** (thanh toán) | `STRIPE_SECRET_KEY`<br>`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`<br>`STRIPE_WEBHOOK_SECRET` | Khi chốt cổng thanh toán | Dùng mock provider (không tính tiền thật) |
| **Cloudinary** (ảnh) | `CLOUDINARY_CLOUD_NAME`<br>`CLOUDINARY_API_KEY`<br>`CLOUDINARY_API_SECRET` | Khi upload/re-host ảnh | Ảnh external hiện tại vẫn hiển thị; upload mới sẽ yêu cầu key |
| **ipinfo.io** (geo) | `IPINFO_TOKEN` | Không | Dùng header của Vercel/Cloudflare (miễn phí) |
| **Auth** | `AUTH_SECRET` | **Có** | Dùng giá trị dev — **phải đổi trước khi lên production** |
| **Anthropic / OpenAI** | `ANTHROPIC_API_KEY`<br>`OPENAI_API_KEY` | Không (Phase 2) | Tính năng AI chưa bật |

---

## 1. `AUTH_SECRET` — bắt buộc đổi

Dùng để ký session cookie (JWT). Nếu để giá trị mặc định, bất kỳ ai biết giá trị
đó đều có thể tự tạo session admin.

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy chuỗi in ra vào `AUTH_SECRET`.

---

## 2. Supabase

Xem hướng dẫn chi tiết tại [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md).

---

## 3. Resend (gửi email)

Email là phần cốt lõi của yêu cầu #2 (báo lead) và #5 (báo creator khi được book).

1. Đăng ký tại <https://resend.com> (free tier: 3.000 email/tháng, 100/ngày)
2. **API Keys** → **Create API Key** → quyền `Sending access` → copy `re_...`
3. Điền vào `RESEND_API_KEY`
4. **Domains** → **Add Domain** → nhập `bookingmodel.com` → thêm các bản ghi DNS
   (SPF, DKIM) mà Resend hiển thị vào nhà cung cấp domain
5. Sau khi domain verified, sửa:
   ```env
   EMAIL_FROM="BookingModel <no-reply@bookingmodel.com>"
   EMAIL_REPLY_TO=hello@bookingmodel.com
   ```

> Chưa verify domain thì chỉ gửi được tới chính email đã đăng ký Resend. Muốn test
> nhanh, để `EMAIL_FROM="BookingModel <onboarding@resend.dev>"`.

**Cách kiểm tra:** đặt một booking thử → vào `/admin/emails`, cột `Provider` phải
là `resend` và `Status` là `sent` (thay vì `console` / `logged`).

---

## 4. Stripe (khi đã chốt cổng thanh toán)

Hiện `PAYMENT_PROVIDER=mock`: booking, hóa đơn và email đều chạy thật, chỉ có
bước trừ tiền là giả lập. Khi chốt dùng Stripe:

1. <https://dashboard.stripe.com/apikeys> → copy **Secret key** (`sk_test_...`)
   và **Publishable key** (`pk_test_...`)
2. Điền vào `.env.local`, đổi `PAYMENT_PROVIDER=stripe`
3. Cài SDK nếu muốn dùng Stripe Elements ở client: `npm i stripe @stripe/stripe-js
   @stripe/react-stripe-js`
4. Webhook: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` →
   copy `whsec_...` vào `STRIPE_WEBHOOK_SECRET`

**Việc còn phải làm khi chuyển sang Stripe thật:** hiện tại `charge()` tạo
PaymentIntent và trả về `requires_action` + `client_secret`. Cần bổ sung ở client
bước confirm bằng Stripe.js, rồi tạo `/api/webhooks/stripe` để nhận
`payment_intent.succeeded` và gọi phần tạo deal/invoice/email. Vị trí cần sửa được
đánh dấu rõ trong `lib/payments/index.ts` và `lib/services/booking.ts`.

> Nếu chọn cổng khác (PayPal, Authorize.net, Adyen…), chỉ cần viết thêm một object
> `PaymentProvider` trong `lib/payments/index.ts` — phần còn lại của app không đổi.

---

## 5. Cloudinary (upload và re-host ảnh creator)

<https://console.cloudinary.com/settings/api-keys> → copy `Cloud name`, `API Key`,
`API Secret`.

Điền vào `.env.local`:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=bookingmodel/creators
```

Luồng ảnh creator đã được tích hợp như sau:

1. Admin chọn ảnh từ thiết bị hoặc nhập một URL ảnh công khai trong **Add Creator / Edit Creator**.
2. Trình duyệt gửi file/URL đến endpoint admin của project.
3. Server ký request bằng `CLOUDINARY_API_SECRET` rồi upload lên Cloudinary.
4. Server nhận `secure_url` từ Cloudinary và lưu URL đó vào trường `creators.photo_url`.
5. Creator card ở Marketplace dùng `photo_url` nên ảnh mới tự động hiển thị.

Không cần tạo **unsigned upload preset**; project dùng signed upload ở server để không
lộ API Secret ra trình duyệt. Folder `bookingmodel/creators` cũng sẽ được Cloudinary
tạo tự động khi ảnh đầu tiên được upload. Giới hạn hiện tại là ảnh JPG, PNG, WebP,
GIF hoặc AVIF, tối đa 10 MB.

Nếu chưa điền key, các ảnh seed/external hiện tại vẫn hiển thị bình thường, nhưng
chức năng upload ảnh mới hoặc re-host URL mới sẽ báo Cloudinary chưa được cấu hình.

---

## 6. ipinfo.io (geo — không bắt buộc)

**Nếu deploy trên Vercel hoặc Cloudflare thì KHÔNG cần key này** — hai nền tảng
này gửi sẵn header `x-vercel-ip-country` / `cf-ipcountry` miễn phí, và code đã
đọc header đó trước tiên.

Chỉ cần khi self-host (VPS, Docker) không có CDN phía trước:

1. <https://ipinfo.io/signup> (free: 50.000 request/tháng)
2. Copy token → `IPINFO_TOKEN`
3. Giữ `GEO_PROVIDERS=vercel,cloudflare,ipinfo`

---

## Đưa key lên production (Vercel)

```bash
vercel env add AUTH_SECRET production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# ... lặp lại cho từng biến
```

Hoặc dán qua giao diện: **Project → Settings → Environment Variables**.

**Trước khi go-live, bắt buộc đổi:**

```env
NEXT_PUBLIC_SITE_URL=https://bookingmodel.com
AUTH_SECRET=<chuỗi ngẫu nhiên mới>
NEXT_PUBLIC_GEO_DEBUG=false     # tắt bộ chuyển quốc gia giả lập
GEO_UNKNOWN_POLICY=block        # không cho IP không xác định thanh toán
```

`NEXT_PUBLIC_GEO_DEBUG=true` cho phép bất kỳ ai thêm `?geo=US` để giả lập vị trí —
tiện lúc dev, nhưng để bật trên production là **thủng hoàn toàn** cơ chế chặn IP.
