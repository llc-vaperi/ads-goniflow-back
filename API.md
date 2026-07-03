# API ინსტრუქცია ფრონტენდ დეველოპერისთვის

Base URL: `http://localhost:3001/api/v1` (production-ში `NEXT_PUBLIC_API_URL`)

**ყველა request-ს სჭირდება `credentials: "include"`** (fetch-ის ოფცია), რადგან სესია ინახება httpOnly cookie-ებში (`sb-access-token`, `sb-refresh-token`) — ხელით token-ის მართვა არ სჭირდება.

---

## Auth (`/auth`)

### `POST /auth/signup`
```json
{ "email": "user@example.com", "password": "Str0ng!Pass" }
```
პაროლი: მინ. 8 სიმბოლო, ლათინური ასოები, 1+ დიდი, 1+ პატარა, 1+ ციფრი, 1+ სპეც. სიმბოლო.
**წარმატება (201):** `{ "success": true, "data": { "user": { "id", "email" } } }` + cookie-ები დაყენდება ავტომატურად.
**შეცდომა (400):** ცუდი email/password.
Rate limit: 5 მოთხოვნა / 15 წუთი (ამ IP-დან).

### `POST /auth/login`
```json
{ "email": "user@example.com", "password": "Str0ng!Pass" }
```
**წარმატება (200):** `{ "success": true, "data": { "user": {...} } }`.

### `GET /auth/me`
Body არ სჭირდება. აბრუნებს მიმდინარე მომხმარებელს cookie-დან.
**წარმატება (200):** `{ "success": true, "user": { "id", "email" } }`.
**401** — თუ სესია არ არის/ვადაგასულია.

### `POST /auth/forgot-password`
```json
{ "email": "user@example.com", "redirectTo": "http://localhost:3000/reset-password" }
```
Rate limit: 5/15წთ.

### `POST /auth/reset-password`
საჭიროებს ავტორიზაციას (cookie-ში access token, ჩვეულებრივ email-ის ბმულიდან).
```json
{ "newPassword": "NewStr0ng!Pass" }
```

### `POST /auth/logout`
Body არ სჭირდება. შლის cookie-ებს.

---

## Projects (`/projects`) — ყველა route საჭიროებს login-ს

### `GET /projects`
აბრუნებს მომხმარებლის ყველა პროექტს.
`{ "success": true, "data": [ { "id", "user_id", "name", "link", "description", "logo_url", "created_at" }, ... ] }`

### `POST /projects`
```json
{ "name": "My Project", "link": "https://...", "description": "...", "logo_url": "https://..." }
```
`name` სავალდებულოა, დანარჩენი ოფციონალურია. **201** → შექმნილი პროექტი.

### `PUT /projects/:id`
იგივე body როგორც create-ზე. აბრუნებს განახლებულ პროექტს.

### `DELETE /projects/:id`
`{ "success": true, "message": "..." }`

---

## Saved Ads (`/projects/:projectId/ads`)

### `GET /projects/:projectId/ads`
აბრუნებს კონკრეტული პროექტის შენახულ რეკლამებს.

### `POST /projects/:projectId/ads`
```json
{
  "platform": "facebook",
  "tone": "friendly",
  "headline": "Big Sale!",
  "text": "Get 50% off today only.",
  "cta": "Shop Now",
  "image_url": "https://.../ad-assets/.../image.png"
}
```
`text` სავალდებულოა. `image_url` — იხ. Uploads სექცია, თუ სურათი ლოკალურად აირჩია მომხმარებელმა.

### `DELETE /projects/:projectId/ads/:adId`

---

## Uploads (`/uploads`) — სურათების შენახვა

### `POST /uploads`
`multipart/form-data`, ველის სახელი: **`image`** (მხოლოდ ეს ველი, ფაილი).
- მაქს. ზომა: **5MB**.
- მხოლოდ `image/*` mime-ტიპები დაიშვება.

**წარმატება (201):**
```json
{ "success": true, "data": { "url": "https://<supabase-project>.supabase.co/storage/v1/object/public/ad-assets/<userId>/<uuid>.png" } }
```

**გამოყენების ნაკადი (მაგ. Generator ტაბიდან ან პროექტის ლოგოსთვის):**
1. მომხმარებელი ირჩევს ფაილს → `POST /uploads` (`FormData` ობიექტით, `formData.append("image", file)`).
2. პასუხის `data.url` ჩაწერე `logo_url`-ში (`POST/PUT /projects`) ან `image_url`-ში (`POST /projects/:id/ads`).

Frontend-ის `apiFetch` (`src/utils/api.ts`) ავტომატურად აყენებს `Content-Type: application/json`-ს, რაც **multipart request-ს გაუფუჭებს** — upload-ის request-ისთვის საჭიროა ცალკე fetch-ი, `Content-Type` header-ის გარეშე (ბრაუზერი თავად დააყენებს სწორ boundary-ს), მაგრამ `credentials: "include"` აუცილებელია.

---

## საერთო შეცდომის ფორმატი
```json
{ "success": false, "error": { "message": "...", "stack": "... (მხოლოდ dev-ში)" } }
```
ან მარტივ ვალიდაციის შემთხვევებში: `{ "success": false, "error": "..." }` (string).

## Rate limits
- გლობალურად (`/api/v1/*`): 100 request / 15 წუთი per IP.
- Auth-ის მგრძნობიარე endpoint-ები (`signup`, `forgot-password`, `reset-password`): 5 request / 15 წუთი per IP.
- გადაჭარბებისას: **429**.
