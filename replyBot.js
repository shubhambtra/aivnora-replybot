// replyBot.js — jisne keyword comment kiya usko comment ke neeche public reply karta hai.
//
//   node replyBot.js                     dry run — sirf dikhata hai, kuch post nahi karta
//   node replyBot.js --live              asli reply post karta hai
//   node replyBot.js --brand finteqra    doosra brand
//   node replyBot.js --only shubhambtra  sirf is ek bande ko (text test karne ke liye)
//   node replyBot.js --live --max 50     ek run me 50 (default 10, cron har 10 min chalta hai)
//   node replyBot.js --live --gap 12     do reply ke beech 12 second (default 24 = 150/ghanta)
//   node replyBot.js list                kis-kis ko reply ho chuka hai
//   node replyBot.js --live --loose     aadhe-shabd ("Hello", "H", "Y") walon ko bhi, post ke hisaab se
//   node replyBot.js --live --emoji     emoji-only comments ko bhi (sirf haath se, cron nahi)
//   node replyBot.js audit               jo log chhoot rahe hain (keyword galat likha) — kuch post nahi karta
//
// DM NAHI bhejta. Instagram ki Private Replies API ke liye `instagram_manage_messages`
// chahiye, jo Meta ke App Review se aati hai — hamare token me nahi hai. Ye bot sirf
// comment ke neeche public reply karta hai, jiske liye `instagram_manage_comments` kaafi
// hai aur wo hamare token me HAI (21 Nov 2026 ko verify kiya).
//
// Har comment ko zindagi me EK baar reply hota hai — record `editor-replies.json` me.

require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");

const GRAPH = "https://graph.facebook.com/v21.0";
const STATE = path.join(__dirname, "editor-replies.json");
const MEDIA_TO_SCAN = 10;      // kitni recent posts dekhni hain

/** Brand ke keyword aur reply. Naya reel = us brand ke array me ek entry. */
//
// 24 Nov 2026: ek brand ke EK se zyada keyword ho gaye. Pehle `RULES.aivnora` ek hi object
// tha jiska keyword "editor" tha. ep02 ka keyword KAHANI hai, aur 292 log keyword likh chuke
// the jinhe bot dekh hi nahi raha tha — RULES me wo keyword hi nahi tha. Ab har brand ke
// neeche rules ka ARRAY hai, naya campaign sabse upar.
//
// `media` kis liye: keyword KHUD likha ho (ya ek-do letter ka farak ho) to post se koi matlab
// nahi — bande ne naam leke maanga hai, jis reel pe bhi likha ho usey wahi kit milegi. Par
// akela AAM shabd ("kit", "skill", "link") do keyword ke beech phasa hua hai, aur wahan ye
// tay karta hai ki comment KIS reel pe hai. @ma.njeet8747 ne ep02 pe sirf "Skill" likha tha:
// media batata hai ki usey KAHANI chahiye, EDITOR nahi.
//
// `extra` kis liye: word-split `[^a-z0-9]+` par hota hai, to Devanagari poora gir jaata hai.
// @bhavikpargee.theking ne "कहानी" likha aur chhoot gaya. Ye regex usey pakad lete hain.
//
// 21 Nov 2026: reply ka text badla. Pehle ye "setup bhej raha hoon DM me" kehta tha —
// jo SACH NAHI tha. Ye bot DM bhej hi nahi sakta (`instagram_manage_messages` token me
// nahi hai), to 5 asli logon ne "Editor" comment kiya aur unhe kuch nahi mila.
//
// Ab reply wahi kehta hai jo asli me hota hai: kit https://aivnora.web.app pe pada hai,
// keyword ke saath. Yahi @techstackbro ka tareeka hai (ANALYSIS.md) — DM ki zarurat hi
// nahi rehti, aur reply TURANT sach hota hai.
//
// Link comment me CLICKABLE nahi hota — Instagram comments aur captions me URL ko link
// banata hi nahi (sirf bio ka website field, Story sticker aur ads me banta hai). Isliye
// reply BIO LINK se shuru hota hai, URL se nahi: URL likhne se bande ko type karna padta
// hai, bio link ek tap hai. Bio ka website field 21 Nov 2026 ko set ho gaya (verify kiya),
// to ye line ab sach hai.
//
// Ye reply maan kar chalta hai ki DM pehle ja chuki hai (owner khud bhejte hain,
// DM-MESSAGE.txt se). Isliye ye "DM ka intezaar mat karo" NAHI kehta — wo in 8 logon
// ke liye jhooth ho jaata, kyunki unhe DM mili hai. Public reply ka kaam do hai:
//   1. jis bande ne comment kiya usse batana ki uska DM aaya hai (notification miss ho
//      jaati hai, ya request folder me chali jaati hai)
//   2. jo AUR log comment padh rahe hain unhe bio link pe bhejna — unhe DM nahi mili
//
// AGAR aage DM bhejna band kar do (yahi asli plan hai, @techstackbro ka tareeka), to
// pehli line badal kar "bio link pe hai, DM ka intezaar mat karo" kar dena.
const RULES = {
  aivnora: [
    {
      // ep05 — GAME (Khel Party: 11-game Android app, Claude Code se). Rule 27 Nov 2026 ko
      // POST SE PEHLE daala gaya — 23 Nov ko ep02 bina rule ke gaya tha aur 292 log keyword
      // likh ke baithe rahe. Reel ke cover par badge "ep. 04" hai (published episode ki
      // ginti), par repo me folder ep05 hai.
      //
      // **`media` KHAALI HAI — post karte hi us reel ki id yahan daalni hai.**
      // Tab tak poora rule inert hai, aur yahi chahiye: `strict: true` ke saath strongMatch
      // bhi media dekhta hai (ruleFor, line ~352), aur `openPost`/`also`/`extra` to pehle se
      // media-gated hain. Id padte hi sab zinda ho jata hai.
      //
      // `strict` KYUN — "game" ek AAM shabd hai, bilkul ep04 ke "claude" jaisa: "nice game
      // bro", "game kaunsa hai", "game dekha" is account par roz aayenge. strict ka matlab:
      // comment CHHOTA ho (3 shabd tak, bina "?") AUR USI reel par ho.
      //
      // Fuzzy ka darr yahan apne aap khatam hai: strongMatch within1/within2 sirf 5+ letter
      // ke keyword par chalata hai (line 276-277) aur "game" 4 letter ka hai — to theek
      // "game" hi match karta hai. "gane"/"gaane" (songs) galti se nahi pakda jayega, jiska
      // dar REPLYBOT-RULE.md me likha tha. Isi wajah se galat spelling HAATH se `also` me
      // likhni padti hain (gme, gmae, gam, gaem...), apne aap nahi pakdi jaatin.
      //
      // Har variant me teen sach hone CHAHIYE: bio link (URL kabhi nahi — comment me
      // clickable nahi hota), shabd GAME (hub ka search isi se chalta hai), aur "free".
      // DM ka zikr KABHI nahi — token me instagram_manage_messages hai hi nahi.
      //
      // **Site par /game page abhi BANA NAHI hai.** Reply "search GAME" kehta hai, to post
      // se pehle AIVNORA/SITE/build.js ke KITS me `game` daalna hai (en + hi dono), warna
      // bio link par dhoondhne ko kuch nahi milega.
      keyword: "game",
      strict: true,
      media: ["18092033753278350"],   // ep05 reel, 27 Nov 2026 14:49 IST — instagram.com/reel/DgPVt0yJWVi/
      // Devanagari + game wale EMOJI (owner, 27 Nov 2026: "sare emojis bhi dal dena game se
      // related"). `extra` strongMatch me hai, aur `strict` ki wajah se ye bhi SIRF is reel
      // par chalta hai — kisi aur post par 🎮 likhne se kuch nahi jayega.
      //
      // Jaan-boojh ke BAAHAR: ❤️ 🔥 🙌 👏 jaise taareef wale emoji. Unhone kuch maanga nahi
      // hota, aur 24 Nov 2026 ko 380 bin-maange ek-jaise reply ne hi spam block diya tha
      // (code 20 / subcode 1772107). Wo log `openPost` se bhi bahar hain. Chahiye to
      // `--emoji` flag haath se chalana hota hai.
      extra: [
        /गेम/, /गेम्स/, /गेम्/, /खेल/, /गैम/,                      // Hindi
        /[\u{1F3AE}\u{1F579}\u{1F47E}]/u,                            // 🎮 🕹️ 👾
        /[\u{1F3B2}\u{265F}\u{1F0CF}\u{1F3AF}\u{1F9E9}]/u,           // 🎲 ♟ 🃏 🎯 🧩
        /[\u{1F4F1}\u{1F517}\u{1F4E5}\u{1F440}]/u,                   // 📱 🔗 📥 👀
      ],
      // Media-gated, isliye id padne tak inert. Yahan aam shabd (link, app) isi wajah se
      // surakshit hain. Galat spelling + Hinglish + game ke naam sab daale gaye hain.
      also: [
        "games", "gaming", "gamee", "gamez",
        "gme", "gmae", "gam", "gaem", "geme", "gamme", "gaming",      // typo
        "khel", "khelparty", "kkhel",                                  // Hinglish
        "kit", "guide", "link", "lnk", "linkk", "prompt", "prompts",
        "setup", "code", "app", "aap", "apk", "flutter", "android",
        "ludo", "carrom", "chess", "banao", "chahiye", "chaiye", "send",
      ],
      // owner, 27 Nov 2026 — ep04 wala hi faisla yahan bhi: is post par aaya koi bhi
      // comment ep05 ka jawab paata hai, keyword poora na ho ya galat ho to bhi. Ye SIRF
      // is post par chalta hai (media-gated), to kisi doosri reel ki kit nahi ja sakti.
      // Sirf-emoji aur sawaal ("?") phir bhi bahar hain — wajah upar likhi hai.
      openPost: true,
      reply: [
        (u) => `@${u} it's live 🙌 open the link in my bio and search GAME — the prompt I used and the full guide, free.`,
        (u) => `@${u} link in my bio 🙌 search GAME there — the prompt, the steps, and how to put it on Play Store. free.`,
        (u) => `@${u} yours is ready 🙌 go to my bio link, search GAME, and copy the prompt. free.`,
        (u) => `@${u} here you go 🙌 my bio link has it — search GAME for the prompt and every step, free.`,
        (u) => `@${u} it's free 🙌 tap the link in my bio and search GAME — the full guide to build this app.`,
        (u) => `@${u} done 🙌 bio link, search GAME — the prompt first, then the steps. free.`,
        (u) => `@${u} it's on my bio link 🙌 search GAME and you get the same prompt I started with, free.`,
        (u) => `@${u} ready for you 🙌 link in my bio, search GAME — prompt, steps, Play Store. all free.`,
        (u) => `@${u} open my bio link and search GAME 🙌 everything is written there, step by step, free.`,
        (u) => `@${u} free for you 🙌 link in my bio, search GAME — the prompt and the full build guide.`,
        (u) => `@${u} it's live 🙌 bio link, search GAME — copy the prompt and follow the steps. free.`,
        (u) => `@${u} you'll find it on my bio link 🙌 search GAME — the prompt and how I built it, free.`,
        (u) => `@${u} the whole guide is free 🙌 tap my bio link and search GAME.`,
        (u) => `@${u} link in my bio 🙌 search GAME — the prompt, the app structure, the Play Store steps. free.`,
        (u) => `@${u} it's waiting on my bio link 🙌 search GAME and start with the first prompt. free.`,
      ],
    },
    {
      // ep04 — PLUGINS (5 Claude Code plugins, 26 Nov 2026). Rule reel POST HONE SE PEHLE daala
      // gaya hai — 23 Nov ko ep02 bina rule ke gaya tha aur 292 log keyword likh ke baithe rahe.
      //
      // `media` abhi khaali hai: id post karne ke baad hi milti hai. Khaali hone se LIKHA HUA
      // keyword phir bhi chalta hai (`strongMatch` media nahi dekhta), sirf `also` wale aam
      // shabd aur emoji/loose mode tab tak chup rehte hain — jo sahi hai, warna "link" likhne
      // par kisi aur reel ki kit chali jaati. **Post karte hi yahan us reel ki id daalni hai.**
      //
      // Teen sach jo har variant me hone CHAHIYE: bio link (URL kabhi nahi — comment me
      // clickable nahi hota), shabd CLAUDE (jo reel bolti hai; hub ka search isi se chalta hai), aur "free".
      // DM ka zikr kabhi nahi — token me instagram_manage_messages hai hi nahi.
      // Page live hai: https://aivnora.web.app/plugins.html (hi/ me Hinglish).
      // Keyword CLAUDE hai, PLUGINS nahi — reel ki apni awaaz 1:07 par "Comment Claude" kehti
      // hai (words.js, segment 7). Jo shabd video me bola gaya hai wahi bot ko dhoondhna hai,
      // warna log wahi likhenge jo suna aur bot kuch aur dhoondhta rahega.
      // Page ka pata /plugins.html hi rehta hai (URL kisi ko type nahi karna), par hub ka
      // search dono shabd se chalta hai — build.js me keywords: ["CLAUDE", "PLUGINS"].
      keyword: "claude",
      strict: true,
      // Post ho gaya 26 Nov 2026 — id yahan hai, to ab `also`, phrases aur `openPost`
      // sab zinda hain. Isse pehle khaali thi aur 11 log ("Claude" x5) chhoot gaye the.
      media: ["18015828647768626"],
      // OWNER KA FAISLA (27 Nov 2026): "ep4 pr claude ya plugin ya kuch bhi jaye bhej dena".
      // Is post par aaya KOI BHI comment ep04 ka jawab paata hai — keyword poora na ho,
      // galat ho, ya sirf "Hi" ho, farak nahi padta. Ye SIRF is post par chalta hai
      // (media-gated), to kisi doosri reel ki kit galti se nahi ja sakti.
      // Do cheezein phir bhi bahar hain, aur jaan-boojh ke: sirf-emoji wale comment
      // (24 Nov ka spam block bin-maange ek-jaise reply se hi aaya tha) aur sawaal
      // ("?" wala) — unka jawab kit nahi, haath ka text hai. `audit` dono dikhata hai.
      openPost: true,
      extra: [/क्लॉड/, /क्लाउड/],
      // Media-gated, isliye id padne tak inert. "5 plugins kaun se hain" jaisa sawaal lamba
      // hota hai, to lone-word haad hi inhe sambhal leti hai.
      also: ["setup", "kit", "guide", "link", "prompt", "prompts", "skill", "skills",
             "command", "commands", "install", "list", "plugin", "plugins", "plgin", "plugns",
             "clade", "cluade", "cload", "clod"],
      reply: [
        (u) => `@${u} it's live 🙌 tap the link in my bio and search CLAUDE — all 5 install commands, free.`,
        (u) => `@${u} it's live 🙌 the link in my bio has it — search CLAUDE for all 5 install commands, free.`,
        (u) => `@${u} it's live 🙌 open the link in my bio and search CLAUDE — every install command is there, free.`,
        (u) => `@${u} the link in my bio has your list 🙌 search CLAUDE — all 5 commands in install order, free.`,
        (u) => `@${u} ready for you 🙌 link in my bio, search CLAUDE — all 5 install commands, free.`,
        (u) => `@${u} here you go 🙌 link in my bio, then search CLAUDE — the full install list, free.`,
        (u) => `@${u} yours is ready 🙌 tap the link in my bio and search CLAUDE for all 5 install commands, free.`,
        (u) => `@${u} done 🙌 the list is on my bio link — search CLAUDE and you get all 5 commands, free.`,
        (u) => `@${u} link in my bio 🙌 search CLAUDE there — all 5 install commands, completely free.`,
        (u) => `@${u} all 5 install commands are free 🙌 tap the link in my bio and search CLAUDE.`,
        (u) => `@${u} go to the link in my bio and search CLAUDE 🙌 every command, in install order, free.`,
        (u) => `@${u} it's live 🙌 my bio link has it — search CLAUDE and take all 5 commands, free.`,
        (u) => `@${u} you'll find it on my bio link 🙌 search CLAUDE — all 5 install commands, free.`,
        (u) => `@${u} free for you 🙌 tap the link in my bio, search CLAUDE, and all 5 commands are there.`,
        (u) => `@${u} the whole list is free 🙌 link in my bio, search CLAUDE — all 5 install commands.`,
      ],
    },
    {
      // ep02 — KAHANI (reel DgGG86-JPZ7, 23 Nov 2026). Text owner ne 24 Nov ko approve kiya.
      // Teen cheezein jaan-boojh ke hain aur teenon verify ki gayi hain:
      //   "link in my bio" — bio ka website field https://aivnora.web.app pe set hai (API)
      //   "search KAHANI"  — hub page pe keyword search box hai, KAHANI ka card aata hai
      //   "free"           — /kahani.html live hai aur story-reel-skills.zip 200 deta hai
      //
      // 15 variant (25 Nov 2026 ko owner ne 20 me se 5 hata diye). 500+ logon ko ek hi text bhejna Instagram ke
      // spam filter ko rate se bhi tez dikhta hai. Teenon ka
      // matlab BILKUL ek hai aur teenon me wahi teen sach hain — bio link, keyword KAHANI,
      // 5 skills + workflow free. Pehla wahi hai jo owner ne approve kiya.
      //
      // Naya variant jodte waqt teen cheezein honi CHAHIYE, warna reply jhooth ho jayega:
      // bio link (URL kabhi nahi, comment me clickable nahi hota), shabd KAHANI (page ka
      // search isi se chalta hai), aur "free". DM ka zikr kabhi nahi — bheji nahi ja sakti.
      keyword: "kahani",
      media: ["18361890898170435"],
      // 25 Nov 2026: @silent.swapppp ne Devanagari me KAHANI likha par NA ki jagah NNA tha
      // (Marathi keyboard par wahi sahi shabd hai) aur purane do regex me sirf NA tha, to wo
      // chhoot gaya. Ab unicode escape se likhe hain taaki shell/editor encoding na bigade.
      extra: [/कहान/, /कहाण/, /कहनी/, /\bkahaniy?a?n?\b/i],
      // `also` = akela AAM shabd, aur sirf isi rule ki post (ep02) par chalta hai.
      // ALSO_DEFAULT ko yahan DOBARA likhna padta hai, kyunki `rule.also` usey replace
      // karta hai, jodta nahi.
      //
      // 24 Nov 2026 raat: 34 log "koi keyword nahi" bucket me pade the. Unme se ~8 asli
      // me kit maang rahe the, bus shabd poora nahi tha — "Kh" (x2), "Kk", "K", "kkk"
      // (adhoora type), aur "Story" (x2), "Kahaniyan" (keyword ka MATLAB likh diya,
      // shabd nahi). `within2` inhe nahi pakadta kyunki "kahani" 6 letter ka hai aur
      // "kh" ka farak 4 letter ka hai. Ye sab lone-word + ep02-gated hain, isliye
      // "story kaha hai bhai" type comment par kuch nahi jayega.
      also: ["setup", "kit", "guide", "link", "prompt", "prompts", "skill", "skills",
             "story", "stories", "kahaniyan", "kahaniya", "kahaniyon",
             "kh", "kha", "kk", "kkk", "k", "kandi", "kahni", "kahan"],
      reply: [
        (u) => `@${u} it's live 🙌 tap the link in my bio and search KAHANI — all 5 style skills plus the full workflow, free.`,
        (u) => `@${u} it's live 🙌 the link in my bio has it — search KAHANI for all 5 style skills and the full workflow, free.`,
        (u) => `@${u} it's live 🙌 open the link in my bio and search KAHANI — all 5 style skills and the full workflow are free there.`,
        (u) => `@${u} the link in my bio has your kit 🙌 search KAHANI — all 5 style skills plus the full workflow, free.`,
        (u) => `@${u} ready for you 🙌 link in my bio, search KAHANI — all 5 style skills and the full workflow, free.`,
        (u) => `@${u} here you go 🙌 link in my bio, then search KAHANI — all 5 style skills plus the full workflow, free.`,
        (u) => `@${u} yours is ready 🙌 tap the link in my bio and search KAHANI for all 5 style skills and the full workflow, free.`,
        (u) => `@${u} done 🙌 the kit is on my bio link — search KAHANI and you get all 5 style skills plus the full workflow, free.`,
        (u) => `@${u} link in my bio 🙌 search KAHANI there — all 5 style skills and the full workflow, completely free.`,
        (u) => `@${u} all 5 style skills plus the full workflow are free 🙌 tap the link in my bio and search KAHANI.`,
        (u) => `@${u} go to the link in my bio and search KAHANI 🙌 all 5 style skills plus the full workflow, free.`,
        (u) => `@${u} it's live 🙌 my bio link has it — search KAHANI and take all 5 style skills plus the full workflow, free.`,
        (u) => `@${u} you'll find it on my bio link 🙌 search KAHANI — all 5 style skills plus the full workflow, free.`,
        (u) => `@${u} free for you 🙌 tap the link in my bio, search KAHANI, and all 5 style skills plus the full workflow are there.`,
        (u) => `@${u} the whole kit is free 🙌 link in my bio, search KAHANI — all 5 style skills plus the full workflow.`,
      ],
    },
    {
      // ep01 — EDITOR (reel Df_h7lNpnnv). Ye text 21 Nov se chal raha hai, chhua nahi.
      keyword: "editor",
      media: ["18196643647413467"],
      // 25 Nov 2026: "Editing" / "Editorial" jaan-boojh ke within1 se bahar hain, warna
      // "nice editing bro" pe bhi kit chali jaati. Par AKELA "Editing" ek hi cheez ho
      // sakti hai - @ashishrajput_32, @aadii_darling aur @samseg43 teenon ko haath se
      // bhejna pada. Lone word + ep01 ki post par hi chalta hai, isliye safe hai.
      // ALSO_DEFAULT yahan dobara likhna padta hai - `rule.also` usey replace karta hai.
      // ALSO_DEFAULT yahan use nahi kar sakte - RULES us const se PEHLE define hota hai,
      // to spread karne par "Cannot access before initialization" aata hai. Poori list likhi hai.
      also: ["setup", "kit", "guide", "link", "prompt", "prompts", "skill", "skills",
             "editing", "editor", "editr", "edit", "editorial", "edtr"],
      reply: (user) =>
        `@${user} kit is live 🙌 tap the link in my bio, your EDITOR kit is right there`,
    },
  ],
};

// Ek run me itne se zyada reply nahi (24 Nov 2026).
//
// ep02 pe 518 log reply ke intezaar me hain. Sab ek saath bhejna galat hai — Instagram ek
// hi account se taabadtod reply ko spam maanta hai.
//
// 20 kyun, 10 kyun nahi: reel abhi chal rahi hai aur ~90 naye KAHANI per ghanta aa rahe
// hain. 10 per run = 60 per ghanta, yaani hum peeche padte jaate aur backlog roz badhta.
// 20 per run = 120 per ghanta, jo reel ki raftaar se aage hai. Cron har 10 min chalta hai.
// Haath se chalana ho to `--max 50`.
const MAX_PER_RUN = 500;

// Owner ke apne account, jo accounts.js me brand nahi hain. Inhe reply nahi karna —
// ep02 pe inhone test ke liye "Kahani" likha tha.
const OWN_EXTRA = ["shubhambtra", "dukhdaaaa", "khelparty.app"];

const DEFAULT_REPLY_WINDOW_DAYS = 7;   // isse purane comments chhod do

// Spelling galat ho to bhi pakdo (21 Nov 2026).
//
// @antechcomso ne "Editer" likha aur bot ne usey chhod diya, kyunki match seedha
// text.includes("editor") tha. Comment phone pe type hota hai — ek letter idhar-udhar
// aam baat hai, aur wo banda utna hi asli hai jitna baaki sab.
//
// Har word ko alag se dekhte hain aur EK letter tak ka farak maaf karte hain
// (Levenshtein <= 1): editer, editr, edior, editors, eidtor — sab pakde jaate hain.
// "editing" ka farak DO letters ka hai, to wo nahi pakda jaata — aur yahi chahiye,
// warna "nice editing bro" jaise comment pe bhi kit ka reply chala jaata.
// Keyword 5 letter se chhota ho to ye dhheel band, warna galat log pakde jayenge.
function within1(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, slack = 1;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (!slack--) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return slack - (a.length - i) - (b.length - j) >= 0;
}

// Akela word jo poora comment hi ho (22 Nov 2026).
//
// @varunn_1611 ne sirf "Edit" likha aur @adnans_ash ne sirf "Setup" — dono ko kit chahiye
// thi, dono chhoot gaye aur haath se bhejne pade. "edit" ka farak "editor" se DO letter ka
// hai, aur "setup" ka to koi farak hi nahi — wo doosra shabd hai.
//
// Isliye: jab comment me SIRF EK hi word ho, to dhheel zyada — do letter tak ka farak,
// aur `also` list ke shabd bhi (setup, kit, link…). Lone word hi kyun: "nice edit bro" ya
// "link kaha hai bhai" pe kit ka reply nahi jaana chahiye, wahan banda kuch aur keh raha
// hai. Akela "Edit" ek hi cheez ho sakta hai — keyword likhne ki koshish.
// "skill" aur "skills" 24 Nov ko jude: @ma.njeet8747 aur @jadhav08suraj ne ep02 pe sirf
// "Skill" likha tha. ep02 ka kit skills ka hi zip hai, to akela "Skill" ek hi cheez ho
// sakti hai — keyword likhne ki koshish.
const ALSO_DEFAULT = ["setup", "kit", "guide", "link", "prompt", "prompts", "skill", "skills"];

// Chhota JUMLA jo saaf-saaf kit maang raha hai (25 Nov 2026).
//
// `also` sirf EK word wale comment par chalta hai, to @saurabh_hed99 ka "Link please" aur
// @_taukeer.11 ka "Give me" chhoot gaye - dono haath se bhejne pade. Ye list POORE comment
// se match hoti hai (3 word tak), aur `also` ki tarah SIRF us rule ki post par - warna ek
// "link please" do kit ke beech phas jata. Har jumle me maang saaf honi chahiye; "mujhe bhi"
// aur "me too" jaan-boojh ke NAHI hain, wo kisi aur baat ka jawab bhi ho sakta hai.
const PHRASE_DEFAULT = [
  "link please", "please link", "link plz", "link pls", "link do", "link dedo", "link bhejo",
  "link send", "send link", "send the link", "share link", "drop link", "drop the link",
  "link chahiye", "link kaha", "link kahan", "need link", "want link", "give link",
  "give me", "give me link", "give me the link", "kit please", "kit do", "kit chahiye",
  "send kit", "kit bhejo", "setup please", "setup bhejo", "guide please",
];

const wordsOf = (text) =>
  String(text || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** Keyword khud likha hai (spelling galat ho to bhi) — post se koi matlab nahi. */
function strongMatch(text, rule) {
  for (const re of rule.extra || []) if (re.test(String(text || ""))) return true;
  const words = wordsOf(text);
  const k = rule.keyword.toLowerCase();
  if (words.some((w) => (k.length >= 5 ? within1(w, k) : w === k))) return true;
  if (words.length === 1 && k.length >= 5 && within2(words[0], k)) return true;
  return false;
}

/** Akela AAM shabd ("kit", "skill", "link") — kis reel pe likha hai usse tay hoga. */
function genericMatch(text, rule) {
  const words = wordsOf(text);
  if (words.length === 1 && (rule.also || ALSO_DEFAULT).includes(words[0])) return true;
  // 2-3 word ka seedha maang - poora comment hi wahi jumla ho, usme aur kuch na ho.
  if (words.length >= 2 && words.length <= 3) {
    if ((rule.phrases || PHRASE_DEFAULT).includes(words.join(" "))) return true;
    // Keyword ke beech GALTI SE space (25 Nov 2026). @patakhaguddi_1805 ne "Kaha I" likha -
    // phone ka autocorrect "Kahani" ko do tukdon me tod deta hai. Space hata ke jodne par
    // "kahai" banta hai, jo "kahani" se 1 letter door hai. Ye bhi media-gated hai, aur
    // "link kaha hai bhai" 4 word ka hai to yahan tak pahunchta hi nahi.
    // within1, within2 NAHI: "kaha hai" (= kahan hai, sawaal) jud kar "kahahai" banta hai
    // jo "kahani" se 2 letter door hai, aur usey kit bhej dena galat hoga. 1 letter kaafi
    // hai - asli case ("kaha i", "kaha ni", "ka hani") sab 0-1 par aa jaate hain.
    const glued = words.join("");
    if (rule.keyword.length >= 5 && within1(glued, rule.keyword.toLowerCase())) return true;
  }
  return false;
}

/**
 * Comment ke liye rule chuno, ya null.
 * Pehle saare rules par strong match (naya campaign upar), phir aam shabd — aur aam shabd
 * tabhi chalta hai jab comment usi rule ki post par ho, warna ek "link" do kit me phas jata.
 */
/**
 * Rule ke variants me se ek chuno.
 *
 * Comment ki id se chunte hain, random se nahi: ek bande ko hamesha wahi text milega, aur
 * run dobara chale to bhi text badalta nahi — log na ho paane ki surat me do baar reply
 * jaye to kam se kam wo do alag-alag text na hon.
 */
function replyText(rule, user, commentId) {
  const fns = Array.isArray(rule.reply) ? rule.reply : [rule.reply];
  if (fns.length === 1) return fns[0](user);
  const s = String(commentId || user);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000003;
  return fns[h % fns.length](user);
}

const EMOJI_ONLY = /^[^\p{L}\p{N}]*$/u;

// EMOJI MODE (25 Nov 2026, owner ka faisla) — `--emoji` ke bina ye BAND hai.
//
// Default me emoji-only comment ko reply NAHI jata: 24 Nov ko 380 ek-jaise reply ne spam
// block diya tha, aur bin-maange reply usi dohraav ka sabse bada hissa the. Par owner ne
// 25 Nov ko kaha ki jitne emoji pending hain sabko bhejo — unka account, unka faisla.
// `--emoji` isey sirf HAATH ke run me kholta hai; `index.js` ka cron ye flag nahi deta,
// to apne aap kabhi nahi chalta.
//
// MEDIA-GATED hai aur rehna chahiye: emoji me koi keyword nahi hota, to kaun si kit bhejni
// hai ye SIRF post se tay hota hai. Bina iske ek 🔗 par dono kit me se koi bhi chali jaati —
// wahi galti 23 Nov ko 4 logon ke saath hui thi.
let EMOJI_MODE = false;
let LOOSE_MODE = false;

/** `strict` rule ka keyword ek AAM shabd hai (ep04 ka "claude" — is account pe wo din bhar
 *  comments me aata hai: "claude code is fire"). Aisa rule tabhi chalta hai jab comment CHHOTA
 *  ho (3 shabd tak, bina sawaal ke) AUR usi reel par ho. Bina iske "Claude code is great" wale
 *  ko kit chali jaati, aur ep01/ep02 ke "claude" comments par bhi ep04 ka jawab chala jaata —
 *  kyunki strongMatch media nahi dekhta. */
const shortAsk = (t) => {
  const s = String(t || "");
  return !s.includes("?") && wordsOf(s).length <= 3;
};

function ruleFor(brand, c) {
  const rules = RULES[brand] || [];
  for (const r of rules) {
    if (!strongMatch(c.text, r)) continue;
    if (r.strict && !((r.media || []).includes(c.mediaId) && shortAsk(c.text))) continue;
    return r;
  }
  for (const r of rules) {
    if (genericMatch(c.text, r) && (r.media || []).includes(c.mediaId)) return r;
  }
  // `openPost` — us rule ki post par kuch bhi likho, jawab mil jayega (owner, 27 Nov 2026).
  // Emoji-only aur sawaal bahar hain (wajah rule ke comment me).
  for (const r of rules) {
    if (!r.openPost || !(r.media || []).includes(c.mediaId)) continue;
    const t = String(c.text || "").trim();
    if (!t || EMOJI_ONLY.test(t) || t.includes("?")) continue;
    return r;
  }
  if (EMOJI_MODE && EMOJI_ONLY.test(String(c.text || "").trim())) {
    for (const r of rules) if ((r.media || []).includes(c.mediaId)) return r;
  }
  // LOOSE MODE (25 Nov 2026, owner ka faisla) — `--loose` ke bina ye BAND hai.
  //
  // "Hello", "Hi", "H", "Y", "Ya", "Claude", "Bachpan" — 9 log jinhone keyword likhne ki
  // koshish ki par shabd poora nahi tha, ya sirf hello likh ke intezaar karte rahe. Inhe
  // kit MILNI chahiye, aur kaun si — ye SIRF post se tay hoga (media-gated), kyunki text
  // me koi keyword hi nahi hai.
  //
  // Do haad jaan-boojh ke hain: 1-2 shabd se zyada nahi (lamba comment sawaal hota hai,
  // jiska jawab kit nahi hai), aur sawaaliya nishan wala comment nahi.
  if (LOOSE_MODE) {
    const w = wordsOf(c.text);
    if (w.length >= 1 && w.length <= 2 && !String(c.text || "").includes("?")) {
      for (const r of rules) if ((r.media || []).includes(c.mediaId)) return r;
    }
  }
  return null;
}

// Do letter tak ka farak. Sirf lone word pe chalta hai, warna "editing" bhi pakda jata.
function within2(a, b) {
  if (Math.abs(a.length - b.length) > 2) return false;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return d[a.length][b.length] <= 2;
}

// Ek waqt me ek hi run (24 Nov 2026).
//
// `index.js` ka `replyBotRunning` sirf cron ke apne bachchon ko rokta hai. Jab backlog
// khali karne ke liye ek run HAATH se chalaya jata hai, to cron ka agla tick uske saath
// chal padta hai — aur dono queue ek hi tarah banate hain (purane pehle), to ek hi bande
// ko DO reply chale jaate hain. Ye lock usey rokta hai.
//
// 15 minute se purana lock maan liya jata hai ki process mar gaya (machine so gayi, out of
// memory) — warna ek crash hamesha ke liye bot band kar deta.
//
// HEARTBEAT zaroori hai, aur ye seekha hua sabak hai (24 Nov 2026). Pehle lock ka `at` sirf
// shuru me likha jata tha. Ek manual run 06:50 pe shuru hua aur 500+ reply bhej raha tha;
// 07:05 ke cron tick ne lock dekha, 15 minute poore ho chuke the, usey "stale" maan ke hata
// diya aur SAATH ME chal pada. Dono ne ek hi queue banayi (purane pehle) aur 12 logon ko
// wahi reply DO BAAR chala gaya. Ab jab tak run zinda hai, har reply ke baad lock ka waqt
// taaza hota rehta hai — to lambe run ko koi stale nahi samjhega.
const LOCK = path.join(__dirname, "replyBot.lock");
const LOCK_STALE_MS = 15 * 60 * 1000;

function writeLock() {
  fs.writeFileSync(LOCK, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
}
// Mara hua process lock pakde na rahe (25 Nov 2026).
//
// pm2 restart Windows par poore child tree ko kill karta hai, aur mara hua process exit
// code 1 deta hai ("replyBot exited 1" wahi hai, koi error nahi). Us run ka lock file
// peeche reh jata hai, aur pehle agla tick usey 15 MINUTE tak taaza maanta tha — yaani
// har restart ke baad bot 15 min chup baitha rehta tha. Ab pehle dekhte hain ki wo pid
// zinda hai ya nahi: `kill(pid, 0)` process ko chhoota bhi nahi, sirf poochta hai.
function alive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; }
}

function takeLock() {
  try {
    const old = JSON.parse(fs.readFileSync(LOCK, "utf8"));
    if (!alive(old.pid)) {
      console.log(`  (lock ka process pid ${old.pid} zinda nahi hai — hata ke aage badh rahe hain)`);
      writeLock();
      return null;
    }
    if (Date.now() - new Date(old.at).getTime() < LOCK_STALE_MS) return old;
    console.log(`  (purana lock mila, pid ${old.pid}, ${old.at} — stale maan ke hata diya)`);
  } catch { /* lock nahi hai, ya kharab hai */ }
  writeLock();
  return null;
}
function touchLock() {
  try { writeLock(); } catch {}
}
function freeLock() {
  try { fs.unlinkSync(LOCK); } catch {}
}

function token(brand) {
  return process.env[`IG_${brand.toUpperCase()}_ACCESS_TOKEN`];
}
function businessId(brand) {
  return process.env[`IG_${brand.toUpperCase()}_BUSINESS_ID`];
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return { replied: {} }; }
}
function saveState(s) {
  fs.writeFileSync(STATE, JSON.stringify(s, null, 2));
}

async function api(url) {
  const r = await fetch(url);
  const j = await r.json();
  if (j.error) throw new Error(`${j.error.message} (code ${j.error.code})`);
  return j;
}

/** Recent posts ke saare comments, naye pehle. */
async function recentComments(brand) {
  const t = token(brand), id = businessId(brand);
  if (!t || !id) throw new Error(`${brand} ke token/business id .env me nahi mile`);

  const media = await api(
    `${GRAPH}/${id}/media?fields=id,permalink,timestamp&limit=${MEDIA_TO_SCAN}&access_token=${t}`
  );

  // PAGINATION (23 Nov 2026) — isse pehle sirf pehla page padha jaata tha.
  //
  // Ek hi reel pe 414 comments ho gaye the aur `limit=100` ka matlab tha ki bot ko unme se
  // 108 hi dikh rahe the. @nemurisusheelgoud ka "Editor" is wajah se chhoot gaya: audit ne
  // pakda, bot ne nahi. Jitne zyada comment aate hain utna hi ye bug bada hota jaata hai,
  // isliye ab `paging.next` tab tak follow hota hai jab tak pages khatam na ho jayein.
  //
  // Do pehre: 30 page ki hadd (bhaagta hua loop na bane) aur comment id ka `seen` set,
  // kyunki Graph kabhi-kabhi overlapping pages deta hai — wahi galti mere pehle audit me
  // hui thi aur 95 comments 103 gin liye gaye the.
  //
  // Nested replies bhi ab aate hain: kisi ne doosre ke comment ke neeche "Editor" likha to
  // wo bhi ek asli banda hai. `replies{}` wahi call me aa jaata hai, extra request nahi.
  const out = [];
  const seen = new Set();
  for (const m of media.data || []) {
    let url = `${GRAPH}/${m.id}/comments?fields=id,text,username,timestamp,replies{id,text,username}&limit=40&access_token=${t}`;
    for (let page = 0; url && page < 30; page++) {
      let c;
      try {
        c = await api(url);
      } catch (e) {
        console.log(`   ! ${m.permalink} ke comments nahi mile: ${e.message}`);
        break;
      }
      for (const x of c.data || []) {
        if (!seen.has(x.id)) {
          seen.add(x.id);
          out.push({ ...x, permalink: m.permalink, mediaId: m.id, top: true });
        }
        for (const r of (x.replies && x.replies.data) || []) {
          if (!seen.has(r.id)) {
            seen.add(r.id);
            // `parent` 24 Nov ko juda: isse pata chalta hai ki kis comment ke neeche hamara
            // reply PEHLE SE pada hai. ep02 ke 13 logon ko haath se reply gaya tha, jo state
            // file me nahi hai — bina is check ke bot unhe dobara reply kar deta.
            out.push({ ...r, permalink: m.permalink, mediaId: m.id, top: false, parent: x.id });
          }
        }
      }
      url = (c.paging && c.paging.next) || null;
    }
  }
  return out;
}

/** Comment ke neeche reply post karta hai. */
async function postReply(brand, commentId, message) {
  const t = token(brand);
  const r = await fetch(`${GRAPH}/${commentId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: t }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`${j.error.message} (code ${j.error.code})`);
  return j.id;
}

// Jo comment kisi rule se match NAHI hua, usey teen dhero me baanto (25 Nov 2026).
//
// Kyun: 25 Nov ko 157 unmatched comments haath se padhne par 9 ASLI log nikle jinhe kit
// chahiye thi par shabd poora nahi tha ("Kaha I", "कहाणी", "Kandi", "Link please"). Unhe
// koi system nahi dhoondh raha tha — main ad-hoc script se dhoondh raha tha, jo dobara
// nahi chal sakti. Ab `node replyBot.js audit` wahi kaam har reel ke baad 2 minute me
// kara deta hai. Teen dher:
//   maang    — chhota comment jo keyword ki koshish lagta hai (ya saaf-saaf maang raha hai)
//   emoji    — sirf emoji/punctuation. INHE REPLY NAHI KARNA: unhone maanga nahi, aur 120
//              bin-maange ek-jaise reply wahi pattern hai jisne 24 Nov ko spam block diya.
//   sawaal   — lamba comment, asli sawaal. Inka jawab haath se, alag text me.
function auditBucket(c, brand) {
  const raw = String(c.text || "").trim();
  if (!raw || EMOJI_ONLY.test(raw)) return "emoji";
  const words = wordsOf(raw);
  if (!words.length) return "emoji";
  // keyword ke KAREEB hai? (3 letter tak ka farak, ya keyword ka tukda)
  const rules = RULES[brand] || [];
  for (const r of rules) {
    const k = r.keyword.toLowerCase();
    const glued = words.join("");
    if (words.length <= 3 && (within2(glued, k) || within2(words[0], k))) return "maang";
    if (words.length === 1 && k.startsWith(words[0]) && words[0].length >= 1) return "maang";
  }
  if (words.length <= 3) return "maang";          // chhota comment — dekhne layak hai
  return "sawaal";
}

/** node replyBot.js audit — kuch post nahi karta, sirf dikhata hai. */
async function audit({ brand, days }) {
  const cutoff = Date.now() - (days || DEFAULT_REPLY_WINDOW_DAYS) * 86400000;
  const comments = await recentComments(brand);
  const myHandles = require("./accounts.js")
    .map((a) => (a.instagramHandle || "").toLowerCase()).filter(Boolean).concat(OWN_EXTRA);

  const buckets = { maang: [], emoji: [], sawaal: [] };
  const perMedia = {};                            // post ke hisaab se unmatched "maang"
  for (const c of comments) {
    if (!c.top) continue;
    if (myHandles.includes((c.username || "").toLowerCase())) continue;
    if (c.timestamp && new Date(c.timestamp).getTime() < cutoff) continue;
    if (ruleFor(brand, c)) continue;              // isey bot khud bhej dega
    const b = auditBucket(c, brand);
    buckets[b].push(c);
    if (b === "maang") {
      perMedia[c.mediaId] = perMedia[c.mediaId] || { n: 0, link: c.permalink };
      perMedia[c.mediaId].n++;
    }
  }

  console.log(`\n  AUDIT · ${brand} · pichhle ${days || DEFAULT_REPLY_WINDOW_DAYS} din`);
  console.log(`  ${buckets.maang.length} dekhne layak · ${buckets.emoji.length} sirf emoji · ${buckets.sawaal.length} sawaal\n`);

  const show = (name, list) => {
    if (!list.length) return;
    console.log(`  --- ${name} (${list.length}) ---`);
    for (const c of list) {
      const ep = (RULES[brand] || []).find((r) => (r.media || []).includes(c.mediaId));
      const tag = ep ? ep.keyword.toUpperCase() : c.mediaId;
      console.log(`  ${tag.padEnd(7)} @${(c.username || "?").padEnd(24)} "${String(c.text || "").replace(/\s+/g, " ").slice(0, 60)}"`);
    }
    console.log();
  };
  show("DEKHNE LAYAK — keyword ki koshish ya seedhi maang", buckets.maang);
  show("SAWAAL — jawab haath se, alag text me", buckets.sawaal);
  console.log(`  --- SIRF EMOJI (${buckets.emoji.length}) — inhe reply NAHI karna, pinned comment hi kaafi hai ---\n`);

  missingRuleWarning(brand, perMedia);
  console.log(`  Jisko bhejna ho:  node replyBot.js --live --only <username>\n`);
}

// Naye reel ka keyword RULES me daalna bhool gaye? (25 Nov 2026)
//
// 23 Nov ko ep02 gaya aur rule nahi tha: 292 log keyword likh ke baithe rahe aur bot unhe
// dekh bhi nahi raha tha. 4 ghante baad haath se pakda gaya. Ab jis post pe 10+ aise
// comment hain jinka koi rule nahi, uska naam cheekh ke bolta hai — har run me.
const MISSING_RULE_MIN = 10;

function missingRuleWarning(brand, perMedia) {
  const known = new Set((RULES[brand] || []).flatMap((r) => r.media || []));
  const loud = Object.entries(perMedia)
    .filter(([id, v]) => !known.has(id) && v.n >= MISSING_RULE_MIN)
    .sort((a, b) => b[1].n - a[1].n);
  if (!loud.length) return false;
  console.log(`\n  ================== DHYAN DO ==================`);
  for (const [id, v] of loud) {
    console.log(`  Post ${id} pe ${v.n} aise comment hain jinka koi RULE nahi.`);
    console.log(`  ${v.link || ""}`);
  }
  console.log(`  Naya reel gaya hai aur uska keyword RULES me nahi daala? Daal do —`);
  console.log(`  warna ye log intezaar karte rahenge aur bot unhe dekh bhi nahi raha.`);
  console.log(`  ==============================================\n`);
  return true;
}

async function run({ brand, live, only, max, gap, emoji, loose, own }) {
  EMOJI_MODE = !!emoji;
  LOOSE_MODE = !!loose;
  const rules = RULES[brand];
  if (!rules || !rules.length) {
    console.log(`"${brand}" ke liye koi rule nahi hai. RULES me jodo.`);
    process.exit(1);
  }
  const cap = max || MAX_PER_RUN;
  // Do reply ke beech ka faasla. Default 24s = 150/ghanta, jo napi hui SAFE raftaar hai
  // (24 Nov: 150 aur 175 safe chale; 380 aur 520 par Instagram ne spam block diya). Ise
  // `--gap <second>` se sirf HAATH se badla jata hai, cron kabhi nahi badalta — aur 5s
  // (720/ghanta) maangne se pehle jaan lo ki wo block dene wali raftaar se dugna hai.
  const gapMs = (gap ? Number(gap) * 1000 : 0) || 24000;

  // Lock sirf LIVE run par. Dry run kuch post nahi karta, to wo kabhi na roke aur na roka jaye.
  if (live) {
    const held = takeLock();
    if (held) {
      console.log(`\n  Ek run pehle se chal raha hai (pid ${held.pid}, ${held.at}). Ye tick chhod diya.\n`);
      return;
    }
    process.on("exit", freeLock);
    process.on("SIGINT", () => { freeLock(); process.exit(130); });
    process.on("SIGTERM", () => { freeLock(); process.exit(143); });
  }

  const state = loadState();
  // Apne kisi bhi brand ko reply mat karo — accounts.js se saare handles lo, sirf RULES se nahi,
  // warna @guessquizbharat jaise apne hi account ko "DM bhej raha hoon" likh dega.
  const myHandles = require("./accounts.js")
    .map((a) => (a.instagramHandle || "").toLowerCase())
    .filter(Boolean)
    .concat(OWN_EXTRA);
  const selfHandle = ((require("./accounts.js").find((a) => a.key === brand) || {})
    .instagramHandle || "").toLowerCase();
  const cutoff = Date.now() - DEFAULT_REPLY_WINDOW_DAYS * 86400000;

  console.log(
    `\n  ${live ? "LIVE" : "DRY RUN"}${emoji ? " · EMOJI MODE" : ""}${loose ? " · LOOSE MODE" : ""} · brand: ${brand} · keywords: ${rules
      .map((r) => `"${r.keyword}"`)
      .join(", ")} · ek run me max ${cap}\n`
  );

  let comments;
  try {
    comments = await recentComments(brand);
  } catch (e) {
    console.log(`  Ruk gaya: ${e.message}`);
    process.exit(1);
  }

  // --only: reply text ko ek asli comment pe test karne ke liye. Baaki sab chhoot jaate
  // hain, aur record me bhi sirf yahi jaata hai — baad me baaki ko reply ho sakta hai.
  const onlyUser = (only || "").replace(/^@/, "").toLowerCase();

  // Jin comments ke neeche HAMARA reply pehle se pada hai (24 Nov 2026).
  //
  // state file hi kaafi nahi hai: ep02 ke 13 logon ko owner ne app se haath se reply kiya
  // tha, jo kahin record nahi hua. Instagram se aaye hue replies hi sabse sachcha record
  // hain, aur isse state file kho jaane par bhi koi dobara reply nahi paata.
  const already = new Set(
    comments
      .filter((c) => !c.top && myHandles.includes((c.username || "").toLowerCase()) && c.parent)
      .map((c) => c.parent)
  );

  // EK BANDA + EK KEYWORD = EK REPLY (owner ka rule, 24 Nov 2026 raat).
  //
  // Pehle ginti COMMENT ki thi, isliye jisne "Kahani" paanch baar likha usey wahi message
  // paanch baar gaya (@pvtt.yxvi ko 5, @op_jaat_0004 ko 4). Technically sahi tha, par us
  // bande ko hamara ek hi message baar-baar dikhta hai — aur Instagram ki nazar me yahi
  // dohraav hai, jo subah ke block ki aadhi wajah tha.
  //
  // Keyword se bandha hai, post se nahi — par har rule ki apni `media` hoti hai, to asar
  // wahi "ek post pe ek reply" hai. Keyword alag ho to reply dobara jaata hai, aur yahi
  // chahiye: @krixhnahere ne "Kahani" aur "Editor" dono likhe the, wo do alag kit hain.
  const servedPairs = new Set();
  for (const c of comments) {
    if (!c.top || !already.has(c.id)) continue;
    const r = ruleFor(brand, c);
    if (r) servedPairs.add(`${(c.username || "").toLowerCase()}|${r.keyword}`);
  }

  const queue = [];
  for (const c of comments) {
    if (!c.top) continue;                                             // apne hi reply na padho
    // `--own` doosre accounts kholta hai, par IS brand ke apne handle ko kabhi nahi: apne hi
    // pehle/pinned comment ke neeche kit ka link bhejna bematlab hai (27 Nov ko dry run me
    // @aivnora ka apna "Setup ka order galat karne se" comment queue me aa gaya tha).
    if (myHandles.includes((c.username || "").toLowerCase())) {
      if (!own) continue;
      if ((c.username || "").toLowerCase() === selfHandle) continue;
    }
    if (onlyUser && (c.username || "").toLowerCase() !== onlyUser) continue;
    if (state.replied[c.id] || already.has(c.id)) continue;
    if (c.timestamp && new Date(c.timestamp).getTime() < cutoff) continue;
    const rule = ruleFor(brand, c);
    if (!rule) continue;
    const pair = `${(c.username || "").toLowerCase()}|${rule.keyword}`;
    if (servedPairs.has(pair)) continue;        // is bande ko is keyword ka reply mil chuka
    servedPairs.add(pair);                      // isi run me uske doosre comment par na jaaye
    queue.push({ c, rule });
  }

  // Purane pehle — jo sabse der se intezaar kar raha hai usey pehla reply mile.
  queue.sort((a, b) => new Date(a.c.timestamp || 0) - new Date(b.c.timestamp || 0));

  // HAR KEYWORD KO HISSA (24 Nov 2026) — aur yahi aaj ka sabak hai.
  //
  // Sirf "purane pehle" se naya campaign purane ko BHOOKHA maar deta hai. ep02 ke ~500
  // KAHANI 23 Nov raat se line me the, to ep01 ke EDITOR wale — jo aaj subah aaye —
  // har run me peeche hi reh gaye. Do baar owner ko haath se bhejna pada aur 4 ghante
  // me ep01 ka ek bhi reply nahi gaya, jabki bot 298 reply bhej chuka tha.
  //
  // Ab queue keyword ke hisaab se baari-baari chalti hai: kahani, editor, kahani,
  // editor… Har keyword ke andar purane pehle wala kram waisa hi rehta hai. Jis
  // keyword ka kaam khatam ho jaye uska hissa apne aap doosre ko mil jata hai, isliye
  // raftaar girti nahi — cap poora istemaal hota hai.
  //
  // Faida aage ke liye: ep03, ep04 jo bhi aayega, purana campaign kabhi nahi marega.
  {
    const groups = new Map();
    for (const q of queue) {
      if (!groups.has(q.rule.keyword)) groups.set(q.rule.keyword, []);
      groups.get(q.rule.keyword).push(q);
    }
    const lists = [...groups.values()];
    const fair = [];
    while (lists.some((l) => l.length)) for (const l of lists) if (l.length) fair.push(l.shift());
    queue.length = 0;
    queue.push(...fair);
  }

  const byKeyword = {};
  for (const q of queue) byKeyword[q.rule.keyword] = (byKeyword[q.rule.keyword] || 0) + 1;
  const breakdown = Object.entries(byKeyword).map(([k, n]) => `${k}: ${n}`).join(" · ") || "-";

  // Har run me dekho ki kisi post pe bina-rule ki bheed jama nahi ho rahi (25 Nov 2026).
  {
    const perMedia = {};
    for (const c of comments) {
      if (!c.top || ruleFor(brand, c)) continue;
      if (c.timestamp && new Date(c.timestamp).getTime() < cutoff) continue;
      if (auditBucket(c, brand) !== "maang") continue;
      perMedia[c.mediaId] = perMedia[c.mediaId] || { n: 0, link: c.permalink };
      perMedia[c.mediaId].n++;
    }
    missingRuleWarning(brand, perMedia);
  }

  console.log(`  ${comments.length} comments dekhe · ${queue.length} reply baaki (${breakdown})`);
  if (already.size) console.log(`  ${already.size} ko pehle se reply hai (Instagram se dekha), chhod diye`);

  if (!queue.length) {
    console.log("\n  Sab ko reply ho chuka hai. Kuch karne ko nahi.\n");
    return;
  }

  const hits = queue.slice(0, cap);
  if (queue.length > hits.length) {
    console.log(`  Is run me ${hits.length} jayenge, baaki ${queue.length - hits.length} agle tick par (har 10 min).`);
  }
  console.log();

  // Lagataar fail hone par run turant rok do (24 Nov 2026).
  //
  // Aaj ~380 reply ek ghante me jaane ke baad Instagram ne comment reply par rok laga di:
  // har POST `This API call does not support the requested response format (code 20)` deta
  // hai. Us run ne rukne ke bajaye apne poore 50 attempt jalaye. Bekaar hi nahi — block ke
  // doran gine jaane wale failed attempt rok ko aur lamba karte hain.
  //
  // Isliye: teen lagataar fail = Instagram ne haath rok diya hai, run khatam. Jo reh gaye
  // wo queue me hi rehte hain (state file me kuch nahi likha jata) aur agle tick par apne
  // aap try honge — ek bhi banda khota nahi. Ek-do chhut-pat fail (banda account delete kar
  // gaya) run nahi rokte, kyunki counter har kaamyaab reply par zero ho jata hai.
  let streak = 0;
  const STREAK_STOP = 3;

  // Ginti bhi chhapo (25 Nov 2026): owner log kholte hain aur dekhna chahte hain ki kitne
  // ho gaye aur kitne bache. "12/61" se ye ek nazar me pata chal jata hai, log ki lines
  // ginne ki zarurat nahi padti. `done` sirf kaamyaab reply ginta hai, fail nahi.
  let done = 0;
  const total = hits.length;

  for (const { c, rule } of hits) {
    const msg = replyText(rule, c.username, c.id);
    if (!live) {
      console.log(`  [dry] ${String(++done).padStart(String(total).length)}/${total}  @${c.username}  (${rule.keyword.toUpperCase()}, likha: "${String(c.text || "").replace(/\s+/g, " ").slice(0, 30)}")`);
      console.log(`        -> ${msg}`);
      continue;
    }
    try {
      const id = await postReply(brand, c.id, msg);
      state.replied[c.id] = {
        username: c.username,
        keyword: rule.keyword,
        repliedAt: new Date().toISOString(),
        replyId: id,
        // 25 Nov 2026: record me TEXT bhi. Pehle sirf username/keyword/waqt tha, to file
        // dekh kar ye pata hi nahi chalta tha ki bande ne kya likha aur usey kaunsa variant
        // gaya. 15 variant hain, aur jab kisi ek par shikayat aaye ya koi reply galat lage
        // to dhoondhne ka koi zariya nahi tha.
        comment: String(c.text || "").replace(/\s+/g, " ").trim().slice(0, 300),
        reply: msg,
      };
      saveState(state);
      console.log(`  ✅ ${String(++done).padStart(String(total).length)}/${total}  @${c.username} (${rule.keyword})  ·  ${total - done} bache`);
      // Owner ka rule (25 Nov 2026): log me HAMESHA dikhe ki KYA bheja gaya. Pehle live
      // run sirf naam chhapta tha, to log se ye pata hi nahi chalta tha ki kis bande ko
      // kaun sa variant/kit gaya — aur 23 Nov ki galti (EDITOR ki kit KAHANI walon ko)
      // log padh kar pakdi hi nahi ja sakti thi.
      console.log(`        likha  : "${String(c.text || "").slice(0, 60)}"`);
      console.log(`        bheja  : ${msg}`);
      streak = 0;
    } catch (e) {
      console.log(`  ❌ ${done}/${total}  @${c.username}: ${e.message}`);
      if (++streak >= STREAK_STOP) {
        console.log(`\n  ${streak} lagataar fail — Instagram ne rok lagayi lagti hai. Run yahin band.`);
        console.log(`  Baaki ${queue.length - 1} queue me hain, agle tick par try honge.\n`);
        break;
      }
    }
    if (live) touchLock();                           // lock zinda rakho, warna cron ghus jayega
    // Owner ka faisla 2026-11-24: ek reply per MINUTE, burst nahi. 5 reply 10 second me
    // bhejna Instagram ko burst dikhta hai; 60 second ka faasla insaan jaisa lagta hai.
    // Cron har 10 min chalta hai aur MAX_PER_RUN 10 hai, to run ~10 min chalta hai aur
    // raftaar 60/ghanta ban jati hai — comments sirf ek baar per run padhe jate hain,
    // isliye read call nahi badhte. Lock heartbeat (upar touchLock) is lambe run ko
    // zinda rakhta hai, warna 15-minute wala stale check ise maar deta.
    // 24 Nov 2026, 11:05 pm: owner ne "jldi bhejo" kaha, 24000 (150/ghanta) se 12000
    // (300/ghanta) kiya. Aaj ka napa hua data: 150/ghanta aur 175/ghanta safe chale,
    // 380/ghanta aur 520/ghanta ne spam block di. 300 beech me hai — backlog khali hone
    // ke baad ISEY WAPAS 24000 KAR DENA, roz ki raftaar 150/ghanta hi rehni chahiye.
    await new Promise((r) => setTimeout(r, live ? gapMs : 200));
  }

  if (!live) {
    console.log(`\n  Ye sirf dikhaya hai, post kuch nahi hua.`);
    console.log(`  Asli reply bhejne ke liye:  node replyBot.js --live\n`);
  } else {
    console.log(`
  Ho gaya — ${done}/${total} reply gaye. Record: editor-replies.json
`);
  }
}

function listReplied() {
  const s = loadState();
  const rows = Object.entries(s.replied || {});
  if (!rows.length) return console.log("\n  Abhi tak kisi ko reply nahi hua.\n");
  console.log(`\n  ${rows.length} logon ko reply ho chuka hai:\n`);
  for (const [, v] of rows) {
    console.log(`  @${(v.username || "?").padEnd(22)} ${(v.repliedAt || "").slice(0, 16).replace("T", " ")}  ${v.keyword || ""}`);
    if (v.comment) console.log(`     likha  : "${v.comment}"`);
    if (v.reply)   console.log(`     bheja  : ${v.reply}`);
  }
  console.log();
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv[0] === "list") { listReplied(); process.exit(0); }
  if (argv[0] === "audit") {
    const bIdx = argv.indexOf("--brand"), dIdx = argv.indexOf("--days");
    audit({
      brand: bIdx > -1 ? argv[bIdx + 1] : "aivnora",
      days: dIdx > -1 ? Number(argv[dIdx + 1]) || null : null,
    }).catch((e) => { console.error("  " + e.message); process.exit(1); });
    return;
  }
  const brandIdx = argv.indexOf("--brand");
  const onlyIdx = argv.indexOf("--only");
  const maxIdx = argv.indexOf("--max");
  run({
    brand: brandIdx > -1 ? argv[brandIdx + 1] : "aivnora",
    live: argv.includes("--live"),
    only: onlyIdx > -1 ? argv[onlyIdx + 1] : null,
    max: maxIdx > -1 ? Number(argv[maxIdx + 1]) || null : null,
    emoji: argv.includes("--emoji"),
    loose: argv.includes("--loose"),
    // --own (2026-11-27, owner: *"chahe mere id hai kise ke bhi ... sabko bhejo"*):
    // apne hi brand/alt accounts ko BHI reply karo. Default OFF, kyunki bot ka
    // apne aap ko kit ka link bhejna bematlab hai. ON karne ki ek hi wajah hai jo
    // owner ne di: reel ke comment section me har "Game" ke neeche jawab dikhna
    // chahiye. Queue, rule aur dedup sab waise ke waise lagte hain.
    own: argv.includes("--own"),
    gap: (() => { const i = argv.indexOf("--gap"); return i > -1 ? argv[i + 1] : null; })(),
  }).catch((e) => { console.error("  " + e.message); process.exit(1); });
}

module.exports = { recentComments, postReply, RULES, ruleFor, replyText, auditBucket };
