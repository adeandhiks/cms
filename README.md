# Adam Puspabhuana — CMS Portfolio Website

A complete production-ready CMS personal academic portfolio with admin dashboard, Supabase backend, and full CRUD functionality.

---

## 📁 Project Structure

```
website_pribadi/
├── index.html              ← Home page
├── about.html              ← About / Experience timeline
├── research.html           ← Research & Publications
├── product.html            ← Products & IP
├── contact.html            ← Contact form
├── schema.sql              ← Supabase database schema
├── css/
│   ├── style.css           ← Public website styles
│   └── admin.css           ← Admin dashboard styles
├── js/
│   ├── supabase.js         ← Supabase client (configure here)
│   ├── main.js             ← Public data loading
│   └── animations.js       ← AOS, GSAP, navbar, counters
├── admin/
│   ├── login.html          ← Admin login
│   ├── dashboard.html      ← Dashboard overview
│   ├── experience.html     ← Manage experience
│   ├── research.html       ← Manage research
│   ├── product.html        ← Manage products
│   ├── messages.html       ← View messages
│   └── admin.js            ← Shared admin utilities
└── assets/
    ├── images/
    └── icons/
```

---

## ⚙️ Setup Instructions

### 1. Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com) and sign in
2. Click **New Project** and fill in the details
3. Wait for the project to be provisioned

### 2. Run the SQL Schema

1. In your Supabase project, go to **SQL Editor**
2. Open `schema.sql` from this project
3. Paste the entire contents and click **Run**
4. This creates all tables, RLS policies, indexes, and sample data

### 3. Configure Supabase Credentials

Open `js/supabase.js` and replace the placeholders:

```js
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
```

Find your credentials in: **Supabase Dashboard → Settings → API**

### 4. Create Admin User

1. In Supabase, go to **Authentication → Users**
2. Click **Add User** → **Create new user**
3. Enter your admin email and a secure password
4. This account will be used to log in to `/admin/login.html`

### 5. Add Your Profile Photo (Optional)

1. In Supabase, go to **Storage → Create new bucket** named `assets` (set to **public**)
2. Upload your profile photo
3. Copy the public URL
4. In **SQL Editor**, update the profile record:

```sql
UPDATE profile SET photo_url = 'YOUR_PHOTO_URL' WHERE name = 'Adam Puspabhuana';
```

---

## 🚀 Deployment

### Option A — Netlify (Recommended, Free)

1. Go to [https://netlify.com](https://netlify.com) and sign in
2. Drag and drop the entire `website_pribadi/` folder onto the Netlify dashboard
3. Your site will be live instantly at a `*.netlify.app` URL
4. To use a custom domain: **Site settings → Domain management → Add custom domain**

### Option B — Vercel

1. Go to [https://vercel.com](https://vercel.com) and sign in
2. Click **New Project → Import Git Repository** (or use CLI)
3. Set framework to **Other** and deploy root directory
4. Add your custom domain in **Settings → Domains**

### Option C — GitHub Pages

1. Push the project to a GitHub repository
2. Go to **Settings → Pages**
3. Set source to **main branch / root folder**
4. Your site will be available at `https://username.github.io/repo-name`

> ⚠️ **Note:** GitHub Pages serves static files, which works perfectly for this project. Make sure your Supabase CORS settings allow requests from your domain.

### Option D — Shared Hosting / cPanel

1. Connect via FTP (FileZilla or similar)
2. Upload all files to the `public_html` directory
3. The project will work as-is since it's entirely static HTML

---

## 🔒 Supabase CORS Configuration

In Supabase Dashboard → **Settings → API → CORS Allowed Origins**, add your domain:

```
https://yourdomain.com
https://www.yourdomain.com
```

For local development, also add:
```
http://localhost:5500
http://127.0.0.1:5500
```

---

## 💻 Local Development

Use **VS Code Live Server** extension (recommended):

1. Install the **Live Server** extension in VS Code
2. Right-click `index.html` → **Open with Live Server**
3. Your site runs at `http://127.0.0.1:5500`

Or use Python's built-in server:
```bash
python -m http.server 8000
```
Then open `http://localhost:8000`.

> ⚠️ **Important:** The site **must** be served over HTTP/HTTPS (not `file://`) for ES modules and Supabase to work properly. Always use Live Server or similar.

---

## 🎨 Customization

| What to change | Where |
|---|---|
| Colors, fonts, spacing | `css/style.css` → `:root` variables |
| Supabase connection | `js/supabase.js` |
| Profile data | Supabase `profile` table |
| Contact info | Supabase `contact_info` table |
| Logo text | `nav-logo` in each HTML file |
| Footer copyright | Footer section in each HTML file |

---

## 🛡️ Security Notes

- Admin pages (`/admin/*`) are protected by Supabase Auth — unauthenticated users are redirected to `login.html`
- Row Level Security (RLS) is enabled on all tables — public users can only read, only authenticated admins can write/delete
- Contact form submissions are allowed without authentication (public INSERT on `messages` table)
- Never expose your `service_role` key in frontend code — only use the `anon` key

---

## 📊 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| Animations | AOS (Animate on Scroll), GSAP |
| Backend | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Email/Password) |
| Deployment | Netlify / Vercel / GitHub Pages |

---

*Built for Adam Puspabhuana — 2024*
