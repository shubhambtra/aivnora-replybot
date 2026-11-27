// Central registry of every brand the poster publishes for.
// Each brand posts the SAME caption + card to both Instagram and its Facebook Page,
// using one long-lived Page token that carries both sets of permissions.

module.exports = [
  {
    key: "dukhdaa_app",
    label: "Dukhdaa App Promo",
    accessTokenEnv: "IG_DUKHDAA_ACCESS_TOKEN",
    businessIdEnv: "IG_DUKHDAA_BUSINESS_ID",
    pageIdEnv: "FB_DUKHDAA_PAGE_ID",
    contentType: "dukhdaa-promo",
    instagramHandle: "dukhdaa.app",
    // Every Dukhdaa post carries a download line. Instagram never makes links
    // in a caption clickable, so there it points at the tappable @handle, whose
    // profile link leads to the store. Facebook links ARE clickable, so there
    // it carries the Play Store URL itself.
    appPromo: {
      appName: "Dukhdaa: Anonymous Chat & Vent",
      playStoreUrl: "https://play.google.com/store/apps/details?id=com.dukhdaa.app",
      instagramHandle: "dukhdaa.app",
    },
  },
  {
    key: "aivnora",
    label: "AIVNORA (pure AI)",
    accessTokenEnv: "IG_AIVNORA_ACCESS_TOKEN",
    businessIdEnv: "IG_AIVNORA_BUSINESS_ID",
    pageIdEnv: "FB_AIVNORA_PAGE_ID",
    contentType: "aivnora-ai",
    instagramHandle: "aivnora",
    // YouTube channel created 2026-11-20. @aivnora was already taken on YouTube
    // by someone else, so the handle differs from Instagram's here.
    // categoryId 28 = Science & Technology.
    youtube: {
      channelId: "UCJsIh7dEXNliLs4Qd8-YxDw",
      channelTitle: "AIVNORA",
      handle: "aivnoraofficial",
      refreshTokenEnv: "YT_AIVNORA_REFRESH_TOKEN",
      categoryId: "28",
      // Closing paragraph of every YouTube description. Written once, by hand,
      // because a model describing the channel gets the positioning wrong.
      blurb:
        "AIVNORA is a daily channel about using AI to actually get things done — " +
        "copy-paste prompts, free tools, and workflows that kill an hour of boring work. " +
        "No funding rounds, no press releases, no hype. New AI tips every day for " +
        "beginners, students and creators.",
    },
  },
  {
    key: "finteqra",
    label: "FINTEQRA (AI + Tech + Finance)",
    accessTokenEnv: "IG_FINTEQRA_ACCESS_TOKEN",
    businessIdEnv: "IG_FINTEQRA_BUSINESS_ID",
    pageIdEnv: "FB_FINTEQRA_PAGE_ID",
    contentType: "finteqra-mix",
    // 24 Nov 2026: replyBot.js skips our own brands by this field, so without it the
    // bot publicly replied to @finteqra commenting on an AIVNORA reel.
    instagramHandle: "finteqra",
  },
  {
    key: "guessquizbharat",
    label: "GUESS QUIZ BHARAT (World quizzes)",
    accessTokenEnv: "IG_GUESSQUIZBHARAT_ACCESS_TOKEN",
    businessIdEnv: "IG_GUESSQUIZBHARAT_BUSINESS_ID",
    pageIdEnv: "FB_GUESSQUIZBHARAT_PAGE_ID",
    contentType: "guessquiz-quiz",
    instagramHandle: "guessquizbharat",
    // YouTube channel created 2026-11-20. categoryId 24 = Entertainment.
    youtube: {
      channelId: "UCHo9GH4xYKbAuDQkx976E5w",
      channelTitle: "Guess Quiz Bharat | GK Quiz",
      handle: "guessquizbharat",
      refreshTokenEnv: "YT_GUESSQUIZBHARAT_REFRESH_TOKEN",
      categoryId: "24",
      blurb:
        "Guess Quiz Bharat posts a new general knowledge quiz every single day — " +
        "world geography, history, science, sports and movies. Short quizzes you can " +
        "play in under a minute. Comment your score and see how you compare.",
    },
    // Quiz photos must never mislead: the options slide has no photo (clean
    // background, bigger text), the answer slide only accepts a photo whose
    // description names the answer, and anything without a strong match gets
    // the brand gradient instead of a generic stock photo.
    photoPolicy: { strict: true, noPhotoRoles: ["options"] },
  },
];
