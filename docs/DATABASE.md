# Quản lý database bằng migration

Schema được quản lý bằng **Supabase CLI migrations**, không sửa tay trên giao diện web.
Mọi thay đổi cấu trúc đều nằm trong file, vào git, và áp dụng được lên nhiều môi trường.

```
supabase/
├── config.toml                                  ← cấu hình project (đã commit)
├── migrations/
│   ├── 20260904120000_initial_schema.sql        ← 15 bảng
│   ├── 20260904120100_row_level_security.sql    ← RLS + policies
│   └── 20260908120000_plan_tiers_and_upgrades.sql ← gói Enterprise, phí theo
│                                                   gói, upgrade_requests
└── seed.sql                                     ← 40 creator + campaign + tài khoản demo
```

**Quy tắc đặt tên** (Supabase CLI bắt buộc): `<YYYYMMDDHHMMSS>_<mô_tả>.sql`
— timestamp UTC 14 chữ số, gạch dưới, tên viết snake_case. CLI chạy các file
theo đúng thứ tự timestamp tăng dần, nên không được đặt trùng hoặc lùi thời gian.

---

## Lần đầu — kết nối và đẩy schema lên

```bash
# 1. Đăng nhập (mở trình duyệt để cấp quyền)
npx supabase login

# 2. Liên kết thư mục này với project trên cloud
npx supabase link --project-ref <PROJECT_REF>

# 3. Đẩy toàn bộ migration lên
npm run db:push

# 4. Nạp dữ liệu mẫu
npm run db:seed
```

**`PROJECT_REF` lấy ở đâu:** Supabase Dashboard → **Project Settings → General →
Reference ID**. Hoặc đọc từ URL của dashboard:
`https://supabase.com/dashboard/project/<PROJECT_REF>`.

Bước `link` sẽ hỏi **Database Password** — đó là mật khẩu bạn đã lưu lúc tạo project.
Quên thì vào **Project Settings → Database → Reset database password**.

---

## Kiểm tra

```bash
npm run db:status
```

Kết quả đúng — cột Local và Remote khớp nhau:

```
   LOCAL          │ REMOTE         │ TIME (UTC)
  ────────────────┼────────────────┼─────────────────────
   20260904120000 │ 20260904120000 │ 2026-09-04 12:00:00
   20260904120100 │ 20260904120100 │ 2026-09-04 12:01:00
   20260908120000 │ 20260908120000 │ 2026-09-08 12:00:00
```

Có timestamp ở cột LOCAL mà REMOTE trống nghĩa là migration đó **chưa được đẩy lên**
— chạy `npm run db:push`.

---

## Khi cần sửa schema về sau

**Không bao giờ sửa file migration đã đẩy lên.** Database đã ghi nhận nó chạy rồi;
sửa nội dung sẽ khiến hai môi trường lệch nhau mà CLI không phát hiện được.

Luôn tạo migration mới:

```bash
npx supabase migration new add_creator_languages
```

Lệnh này tạo `supabase/migrations/<timestamp>_add_creator_languages.sql` rỗng.
Viết SQL vào đó:

```sql
alter table public.creators
  add column if not exists languages text[];

create index if not exists creators_languages_idx
  on public.creators using gin (languages);
```

Rồi:

```bash
npm run db:push
```

Sau đó nhớ cập nhật `lib/types.ts` cho khớp — TypeScript không tự biết cột mới.

### Nếu lỡ sửa trực tiếp trên Table Editor

Kéo thay đổi đó về thành file migration:

```bash
npm run db:pull
```

CLI so sánh database thật với thư mục `migrations/` rồi sinh file chênh lệch.
Review file đó trước khi commit — `db:pull` đôi khi kéo về cả những thứ Supabase
tự tạo mà bạn không cần.

---

## Chạy database local (tuỳ chọn)

Cần Docker Desktop. Cho phép thử migration trước khi đụng vào cloud:

```bash
npx supabase start        # dựng Postgres + Studio ở localhost:54323
npx supabase db reset     # xoá sạch, chạy lại toàn bộ migration + seed.sql
npx supabase stop
```

`db reset` là cách nhanh nhất để kiểm tra migration có chạy từ đầu được không —
điều mà `db push` lên cloud không kiểm tra hộ bạn.

Muốn app trỏ vào database local, đổi `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
```

(`npx supabase start` in ra anon key và service_role key của môi trường local.)

---

## Bảng lệnh

| Lệnh | Việc |
|---|---|
| `npm run db:push` | Đẩy migration chưa áp dụng lên database đã link |
| `npm run db:seed` | Đẩy migration **và** chạy `seed.sql` |
| `npm run db:status` | So sánh migration local với remote |
| `npm run db:pull` | Kéo thay đổi trên cloud về thành file migration |
| `npx supabase migration new <tên>` | Tạo file migration rỗng đúng chuẩn tên |
| `npx supabase db reset` | Dựng lại database local từ số 0 (cần Docker) |
| `npx supabase db lint` | Kiểm lỗi kiểu dữ liệu trong schema |

---

## Về `seed.sql`

Chứa 40 creator, 160 ảnh portfolio, 6 campaign và 4 tài khoản demo.

Toàn bộ insert đều `on conflict do nothing`, khoá theo cột unique tự nhiên
(`users.email`, `creators.handle`), nên chạy lại nhiều lần không nhân bản dữ liệu.

Riêng portfolio dùng `join ... on c.handle = v.handle` thay vì UUID cứng, nên
không phụ thuộc id được sinh ra ở lần chạy nào.

⚠️ **Mật khẩu 4 tài khoản demo là public** (nằm trong README). Đổi trước khi site
lên internet:

```sql
update public.users
set password_hash = '<hash bcrypt mới>'
where email = 'admin@bookingmodel.com';
```

Sinh hash mới:

```bash
node -e "console.log(require('bcryptjs').hashSync('MatKhauMoi', 10))"
```

---

## Đưa lên production

`npm run db:push` áp dụng vào database đang link. Với nhiều môi trường, link lại
trước khi push:

```bash
npx supabase link --project-ref <REF_CUA_PRODUCTION>
npm run db:push
```

Trong CI (GitHub Actions), dùng access token thay vì đăng nhập tương tác:

```yaml
- run: npx supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
  env:
    SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
    SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
- run: npx supabase db push
  env:
    SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

Access token lấy ở <https://supabase.com/dashboard/account/tokens>.

---

## Gói tài khoản Brand (plan tiers)

Nguồn duy nhất: **`lib/plans.ts`**. Mọi gate trong app (contact reveals, brief
builder, advanced filters, shortlist, analytics, phí booking) đều đọc file này.
Không hard-code tên gói, giá, phí hay quota ở bất kỳ chỗ nào khác.

| Quyền lợi | Free | Standard $49 | Pro $149 | Enterprise |
|---|:--:|:--:|:--:|:--:|
| Browse roster, niche + follower, rate | ✓ | ✓ | ✓ | ✓ |
| Book & pay per campaign | ✓ | ✓ | ✓ | ✓ |
| Contact reveals / ngày | 0 | 10 | ∞ | ∞ |
| Campaign brief builder | ✕ | ✓ | ✓ | ✓ |
| Advanced filters (ER, rate) | ✕ | ✓ | ✓ | ✓ |
| Creator shortlisting / CRM | ✕ | ✓ | ✓ | ✓ |
| Analytics & deal tracking | ✕ | ✕ | ✓ | ✓ |
| Priority support | ✕ | ✕ | ✓ | ✓ |
| VEA team notifies creators | ✕ | ✕ | ✕ | ✓ |
| Dedicated account manager | ✕ | ✕ | ✕ | ✓ |
| **Phí nền tảng trên booking** | 15% | 15% | 10% | 8% |

Admin bỏ qua mọi plan gate (là nhân sự, không phải khách hàng).

**Contact reveal** tính theo *creator/ngày*, không phải theo lượt bấm: bảng
`contact_reveals` có unique index `(user_id, creator_id, reveal_date)`, nên mở
lại một creator đã mở trong ngày không tốn thêm quota. Quota reset lúc 00:00 UTC.

**Phí nền tảng** được ghi lại trên từng `deals.platform_fee_percent` và
`invoices.platform_fee_percent`, nên hoá đơn cũ không bao giờ hiển thị lại theo
mức phí mới khi bảng giá thay đổi.

**Nâng cấp gói** — `upgrade_requests`:

- Có `STRIPE_SECRET_KEY` thật + gói self-serve (Standard, Pro) → Stripe Checkout
  (subscription mode). `/api/billing/plan-return` đọc lại session từ Stripe rồi
  mới đổi plan, nên sửa URL trả về không thể tự cấp gói.
- Chưa có key, hoặc gói Enterprise → tạo request `pending`, gửi email cho sales,
  VEA team duyệt ở **Admin → Plan Upgrades**.

Chỉ hai đường đó được ghi vào `users.plan`. Không có endpoint nào cho phép client
tự chọn plan.
