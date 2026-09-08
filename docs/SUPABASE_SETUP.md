# Kết nối Supabase (hướng dẫn từng bước)

Dự án chạy được ngay **không cần key** — dữ liệu lưu ở `./.data/db.json`.
Khi bạn tạo xong Supabase và điền key, ứng dụng **tự động** chuyển sang PostgreSQL.
Không phải sửa một dòng code nào.

> Schema được quản lý bằng **migration**, không paste tay vào SQL Editor.
> Chi tiết cách vận hành migration về sau: [`DATABASE.md`](./DATABASE.md).

---

## 1. Tạo project Supabase

1. Vào <https://supabase.com> → **Sign in** → **New project**
2. Điền:
   - **Name**: `bookingmodel`
   - **Database Password**: bấm Generate rồi **lưu lại** — cần khi chạy `supabase link`
   - **Region**: **East US (North Virginia)** — gần thị trường Mỹ nhất.
     ⚠️ Region **không đổi được** sau khi tạo project.
   - **Plan**: Free
3. **Create new project** → đợi ~2 phút

---

## 2. Đẩy schema lên bằng migration

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npm run db:push
```

**`PROJECT_REF` lấy ở đâu:** Dashboard → **Project Settings → General → Reference ID**,
hoặc đọc từ URL `https://supabase.com/dashboard/project/<PROJECT_REF>`.

Lệnh `link` sẽ hỏi Database Password — mật khẩu bạn lưu ở bước 1.

**Kiểm tra:**

```bash
npm run db:status
```

Hai migration phải xuất hiện ở **cả** cột LOCAL và REMOTE:

```
   LOCAL          │ REMOTE         │ TIME (UTC)
  ────────────────┼────────────────┼─────────────────────
   20260904120000 │ 20260904120000 │ 2026-09-04 12:00:00
   20260904120100 │ 20260904120100 │ 2026-09-04 12:01:00
```

Hoặc mở **Table Editor** trên dashboard — phải thấy đủ 15 bảng.

---

## 3. Lấy API key

1. **Project Settings** (bánh răng, góc dưới sidebar) → **API**
2. Copy 3 giá trị:

| Trong Supabase | Điền vào `.env.local` |
|---|---|
| **Project URL** | `NEXT_PUBLIC_SUPABASE_URL` |
| **Project API keys → `anon` `public`** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **Project API keys → `service_role` `secret`** | `SUPABASE_SERVICE_ROLE_KEY` |

> ⚠️ **`service_role` key bỏ qua toàn bộ RLS.** Chỉ để trong `.env.local` và trong
> Environment Variables của Vercel. **Tuyệt đối không** commit lên git, không đưa vào
> code chạy phía trình duyệt (biến không có tiền tố `NEXT_PUBLIC_` sẽ không bao giờ
> lộ ra client — đây là lý do key này không có tiền tố đó).

---

## 4. Điền key và khởi động lại

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
```

```bash
npm run dev
```

**Cách kiểm tra đã chuyển thành công:** vào `/admin` → thanh trên cùng hiện
`Storage: Supabase` (thay vì `Local JSON`). Hoặc vào `/admin/settings` → dòng
**Database** phải là `Supabase (PostgreSQL)` với badge xanh `configured`.

---

## 5. Nạp dữ liệu mẫu

Database mới còn trống. Có hai cách, chọn một:

**Cách A — qua migration (khuyên dùng, khớp với cách quản lý schema):**

```bash
npm run db:seed
```

**Cách B — qua API của app:**

```bash
curl -X POST http://localhost:3000/api/admin/seed
```

Cả hai đều nạp 40 creator, 160 ảnh portfolio, 6 campaign và 4 tài khoản demo
(xem `.env.local` phần `SEED_*`), và đều chạy lại nhiều lần được mà không nhân bản.

> Muốn bắt đầu với database sạch, chỉ có tài khoản admin: bỏ qua bước này, rồi
> insert thủ công một dòng vào bảng `users` với `password_hash` sinh bằng
> `node -e "console.log(require('bcryptjs').hashSync('MatKhau', 10))"`.

---

## Câu hỏi thường gặp

**Có bắt buộc dùng Supabase không?**
Không. Bất kỳ PostgreSQL nào cũng được — chỉ cần đổi `lib/db/supabase-store.ts`
sang driver khác. Toàn bộ code ứng dụng chỉ nói chuyện qua interface `DbDriver`
trong `lib/db/driver.ts`.

**Tại sao không dùng Supabase Auth?**
Để dự án chạy được trước khi có key. Auth hiện tại là email/password tự viết
(bcrypt + JWT trong httpOnly cookie) trên bảng `users`. Khi muốn chuyển sang
Supabase Auth, chỉ cần thay 2 hàm được đánh dấu `MIGRATION POINT` trong `lib/auth.ts`.

**RLS có ảnh hưởng gì tới app không?**
Không, vì server dùng `service_role` key (bypass RLS). RLS chỉ có tác dụng nếu
sau này bạn cho trình duyệt gọi thẳng Supabase bằng `anon` key.

**Muốn quay lại JSON store để dev cho nhanh?**
Thêm `DB_DRIVER=memory` vào `.env.local`. Hữu ích khi làm việc từ Việt Nam vì
mỗi query sang East US tốn khoảng 250ms.

**Dữ liệu trong `.data/db.json` có tự chuyển sang Supabase không?**
Không. Đó là hai kho riêng biệt. Dữ liệu demo thì cứ seed lại; nếu bạn đã nhập
dữ liệu thật vào JSON store thì cần viết script chuyển.
