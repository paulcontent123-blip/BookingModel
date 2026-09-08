# Cách test 5 yêu cầu chính

Chạy `npm run dev` rồi làm theo từng mục. Không cần API key nào.

---

## Yêu cầu #1 — Chặn IP Việt Nam / Đông Nam Á khỏi booking & thanh toán

### Test trên giao diện

1. Mở <http://localhost:3000/?geo=US> → **không** có banner vàng, nút trên trang
   creator ghi **"Book this creator"**
2. Mở <http://localhost:3000/?geo=VN> → banner vàng xuất hiện ở đầu trang, nút
   đổi thành **"Request this creator"**
3. Vẫn ở chế độ `?geo=VN`, vào `/marketplace` → **vẫn xem được toàn bộ 40 creator
   và mọi mức giá**. Đây là điều kiện của yêu cầu: xem được, không thanh toán được.
4. Thử vào thẳng `/book/<id>` khi đang ở `?geo=VN` → trang không render form
   thanh toán, mà hiện trang "Booking assistance" + tự mở modal.

Bộ chuyển quốc gia ở góc dưới trái cho phép đổi nhanh (VN, TH, SG, PH, ID, MY,
GB, AU, US, CA).

### Test chặn ở tầng server (quan trọng nhất)

UI có thể bị bypass; server thì không. Gọi thẳng API:

```bash
# Lấy id một creator
ID=$(curl -s "localhost:3000/api/creators?limit=1" | node -pe "JSON.parse(require('fs').readFileSync(0)).items[0].id")

# IP Việt Nam → phải trả về 403
curl -i -X POST localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -H "x-vercel-ip-country: VN" \
  -d "{\"creatorId\":\"$ID\",\"quantity\":1,\"contentType\":\"Testimonial\",\"brandName\":\"Test\",\"brandEmail\":\"a@b.com\"}"
```

Kết quả đúng:

```
HTTP/1.1 403 Forbidden
{"error":"Online booking and payment are only available for brands based in US / CA...",
 "code":"GEO_RESTRICTED","country":"VN","allowed":["US","CA"],
 "contact":{"name":"VEA Group — Partnerships Desk","email":"...","phone":"...","whatsapp":"...","hours":"..."}}
```

Thử luôn các nước SEA khác: `TH`, `ID`, `PH`, `MY`, `SG` — đều phải 403.

---

## Yêu cầu #2 — Form để lại thông tin + lưu DB + gửi email

### Trên giao diện

1. `?geo=VN` → bấm **"Request a booking"** ở banner (hoặc nút trên trang creator)
2. Modal hiện ra với:
   - Thông tin liên hệ thật của account manager (tên, email, phone, WhatsApp/Zalo, giờ làm việc)
   - Form: họ tên, email, phone, công ty, kênh liên hệ ưu tiên, ngân sách, loại
     content, số lượng video, website, lời nhắn
3. Điền và gửi → hiện mã tham chiếu `BM-REQ-2026-0001`

### Kiểm tra đã lưu DB

```bash
node -pe "JSON.stringify(JSON.parse(require('fs').readFileSync('.data/db.json')).booking_requests, null, 2)"
```

Hoặc đăng nhập admin → **`/admin/booking-requests`**: thấy lead với đủ thông tin,
cờ `region_blocked`, quốc gia, và các nút Reply by email / Call / WhatsApp /
"Open checkout on their behalf".

### Kiểm tra email

Vào **`/admin/emails`** — phải có 2 dòng:

| To | Template |
|---|---|
| `sales@bookingmodel.com` | `admin_booking_request` |
| email người gửi | `lead_acknowledgement` |

Bấm **Preview** để xem nội dung HTML thật của email.

> Chưa có `RESEND_API_KEY` thì email được ghi log thay vì gửi đi — nội dung y hệt.
> Điền key thật vào là gửi được ngay, không sửa code.

---

## Yêu cầu #3 — Thị trường Mỹ: booking + thanh toán + hoá đơn

1. `?geo=US` → vào một creator → **Book this creator**
2. Điền form: loại content, số video, ngày giao, brief, thông tin billing
3. Phần thanh toán hiện badge **"mock · test mode"** và điền sẵn thẻ test
4. Bấm **Pay $XXX** → chuyển tới trang **Payment successful**
5. Bấm **View invoice** → hoá đơn đầy đủ với con dấu **PAID**, bấm
   **Print / Save as PDF** để in

Kiểm tra bằng curl:

```bash
curl -X POST localhost:3000/api/bookings \
  -H "Content-Type: application/json" -H "x-vercel-ip-country: US" \
  -d "{\"creatorId\":\"$ID\",\"quantity\":3,\"contentType\":\"UGC Video (30s)\",
       \"brief\":\"Morning routine\",\"brandName\":\"LuminaSkin\",
       \"brandEmail\":\"buyer@luminaskin.com\",\"paymentToken\":\"4242424242424242\"}"
# → {"ok":true,"deal_ref":"BM-2026-0001","invoice_no":"BM-INV-2026-0001","total_usd":863,"creator_notified":true}
```

**Test trường hợp thẻ bị từ chối:** đổi `paymentToken` thành số kết thúc bằng
`0000` → trả về `402` và không tạo deal/hoá đơn nào.

---

## Yêu cầu #4 — Admin thêm creator sẵn

Đăng nhập `admin@bookingmodel.com` / `Admin@BM2026`.

- **`/admin/creators`** — 40 creator đã có sẵn, đủ contact info, lọc/tìm kiếm được,
  đổi trạng thái active/inactive ngay trên bảng
- **`/admin/creators/new`** — thêm tay một creator, có link video portfolio
- **`/admin/import`** — tạo file CSV theo mẫu trên trang rồi thả vào:

  ```csv
  name,handle,platform,channel_url,audience,er,rate,niche,contact
  Test Creator,@testcreator,TikTok,https://tiktok.com/@testcreator,50K,5.5%,$100-200,Food,test@gmail.com
  ```

  Hệ thống hiện preview (số dòng sẽ import / trùng / lỗi) trước khi bạn confirm.
  Upload lại đúng file đó lần nữa → tất cả bị đánh dấu duplicate, không nhân bản.

- **`/admin/applicants`** — creator tự nộp qua `/apply` nằm ở đây; bấm **Approve**
  sẽ tạo profile công khai và gửi email chào mừng

---

## Yêu cầu #5 — Email báo creator khi được book

Sau khi hoàn tất một booking ở yêu cầu #3:

1. Vào **`/admin/emails`** → lọc template `creator_booked`
2. Bấm **Preview** → thấy email gửi tới địa chỉ của creator, nội dung gồm:
   mã booking, tên brand, số lượng deliverable, rate của creator, ngày giao,
   nguyên văn brief, và yêu cầu xác nhận trong 48h
3. Vào **`/admin/deals`** → cột **Notified** hiện badge xanh `sent`

**Trường hợp gửi thất bại:** cột Notified hiện `not sent` màu đỏ, và có nút
**Re-send brief** để gửi lại. Dashboard admin cũng cảnh báo nếu có booking đã
thanh toán mà chưa báo được creator.

---

## Checklist đầy đủ

```
□ ?geo=US  → không banner, nút "Book this creator"
□ ?geo=VN  → có banner, nút "Request this creator", vẫn xem được giá
□ curl POST /api/bookings với VN → 403 GEO_RESTRICTED
□ curl POST /api/bookings với US → 201 + deal_ref + invoice_no
□ Thẻ ...0000 → 402, không tạo deal
□ Form VN → booking_requests có bản ghi mới + 2 email
□ /admin/emails có 5 template: creator_booked, booking_confirmed,
  admin_new_booking, admin_booking_request, lead_acknowledgement
□ /invoices/<no> in ra được, có dấu PAID
□ /admin/import upload CSV → preview → confirm → creator xuất hiện ở marketplace
□ /admin/applicants approve → creator lên marketplace + nhận email
```
