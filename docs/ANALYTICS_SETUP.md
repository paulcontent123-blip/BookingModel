# Google Analytics 4 & Google Search Console

Cả hai đều bật/tắt bằng biến môi trường. Để trống = tắt, site vẫn chạy bình thường.

| Biến | Lấy ở đâu | Ví dụ |
|---|---|---|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 → Admin → Data streams → Web stream | `G-ABC123XYZ9` |
| `GOOGLE_SITE_VERIFICATION` | Search Console → HTML tag (chỉ phần `content`) | `aBcD...xyz` |

> `NEXT_PUBLIC_*` được nhúng lúc **build**. Đổi giá trị → phải build/deploy lại.

## Code liên quan

- `components/google-analytics.tsx` — nạp gtag.js, chỉ mount trong `app/(site)/layout.tsx` nên `/admin` không bị track.
- `app/layout.tsx` — sinh `<meta name="google-site-verification">` khi có token.
- `lib/analytics.ts` — `trackEvent(name, params)` để gửi event tuỳ chỉnh từ client component.
- `lib/config.ts` → `config.analytics`; trạng thái hiển thị trong Admin → Settings.
- `app/sitemap.ts` → `/sitemap.xml`, `app/robots.ts` → `/robots.txt` (đã có sẵn).

## 1. Google Analytics 4

1. Vào https://analytics.google.com → **Admin** → **Create** → **Property** (timezone/currency theo thị trường US).
2. Chọn nền tảng **Web**, nhập domain (vd `https://bookingmodel.com`), đặt tên stream.
3. Giữ **Enhanced measurement** bật (cần cho page view khi chuyển trang kiểu SPA).
4. Copy **Measurement ID** `G-XXXXXXXXXX` → điền `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
5. Build & deploy lại. Mở site → GA4 **Reports → Realtime** sẽ thấy lượt truy cập trong ~1 phút.
6. (Khuyên dùng) Admin → Data settings → **Data retention** → 14 months; Admin → Data streams → Configure tag settings → **List unwanted referrals** / **Define internal traffic** để loại IP nội bộ.

Gửi event tuỳ chỉnh:

```tsx
'use client';
import { trackEvent } from '@/lib/analytics';

trackEvent('generate_lead', { form: 'contact' });
```

Sau đó đánh dấu event là **Key event** trong GA4 → Admin → Events.

## 2. Google Search Console

1. Vào https://search.google.com/search-console → **Add property**.
2. Cách A — **Domain property** (khuyên dùng, bao cả www/non-www/http/https): thêm bản ghi **TXT** vào DNS của domain. Không cần sửa code; có thể để trống `GOOGLE_SITE_VERIFICATION`.
3. Cách B — **URL prefix** (`https://bookingmodel.com/`): chọn **HTML tag**, copy giá trị trong `content="..."` → điền `GOOGLE_SITE_VERIFICATION` → deploy → bấm **Verify**.
   (Nếu GA4 đã chạy trên site với cùng tài khoản Google, có thể chọn verify bằng **Google Analytics**.)
4. Sau khi verify: **Sitemaps** → nhập `sitemap.xml` → Submit.
5. **Settings → Associations** → liên kết với property GA4 để xem dữ liệu tìm kiếm trong GA.

Lưu ý: `NEXT_PUBLIC_SITE_URL` production phải là domain thật, vì sitemap/robots dùng giá trị này.
