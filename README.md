# AIVNORA reply bot — GitHub Actions

Ghar ki machine band ho tab Instagram comment ke reply chalate rehne ke liye. Code bilkul wahi
hai jo ghar par chalta hai (`replyBot.js`), bas runner GitHub ka hai. Server ki zarurat nahi.

## Setup (ek baar, ~10 minute)

1. GitHub par naya **PRIVATE** repo banao, naam kuch bhi (jaise `aivnora-replybot`).
2. Is folder ki saari file upload karo — `.github/workflows/reply.yml` samet.
   (Web se upload karo to pehle "Add file → Upload files" me folder drag karna kaafi hai.)
   **`.env` kabhi upload mat karna.**
3. Repo → **Settings → Secrets and variables → Actions → New repository secret** — do secret:
   - `IG_AIVNORA_ACCESS_TOKEN`
   - `IG_AIVNORA_BUSINESS_ID`
   Dono ki value ghar ke `.env` se copy karo.
4. Repo → **Actions** tab → agar "I understand my workflows, go ahead and enable them" dikhe
   to usey enable karo.
5. **Ghar par pehle `pm2 stop ig-poster` chalao** (niche wajah).
6. Actions → `reply-bot` → **Run workflow** — pehla run haath se chalao aur log dekh lo.

## Wapas aane par

1. Repo → Actions → `reply-bot` → **Disable workflow** (ya `.github/workflows/reply.yml` hata do).
2. Ghar par `pm2 start ig-poster` (ya `pm2 restart ig-poster --update-env`).
3. Jo adhoore keyword chhoot gaye unka sweep (cron me `--loose` nahi hota):
   `node replyBot.js --emoji --loose --gap 8` — pehle bina `--live`, phir `--live` ke saath.
4. `node replyBot.js audit` se dekh lo kaun chhoot raha hai.

## Teen cheezein jo galat ho sakti hain

- **Dono jagah ek saath mat chalao.** Ghar ka pm2 aur ye workflow dono live honge to ek hi
  bande ko do baar reply ja sakta hai (dono ka timing alag hai), aur 24 Nov 2026 ka Instagram
  spam block isi dohraav se aaya tha. Ek waqt par EK.
- **Naye reel ka rule pehle daalo.** `replyBot.js` ke `RULES` me us reel ka keyword aur uski
  `media` id honi chahiye. `game` rule ka `media: []` abhi KHAALI hai aur `strict: true` ki
  wajah se wo poora rule tab tak inert hai — us reel par koi reply nahi jayega.
  Rule yahan badlo to repo me file dobara update karni padegi (ghar wali copy se alag hai).
- **Token expire.** Instagram ka Page token expire ho to har run fail hoga. Actions tab me
  laal cross dikhega; naya token secret me update kar do.

## Jo is runner par NAHI hota

- Carousel aur Reels post nahi honge (wo render karte hain, yahan sirf reply bot hai).
- `--loose` aur `audit` nahi chalte (jaan-boojh ke — upar dekho).
- `editor-replies.json` record nahi banta. Zarurat bhi nahi: "dobara reply nahi" wala check
  Instagram se hota hai (`already` set, replyBot.js), state file se nahi.
