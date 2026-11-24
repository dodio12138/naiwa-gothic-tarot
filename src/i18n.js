// 中英文切换：界面文案（牌与牌阵的英文在 data/*.json）
// 选择记在 localStorage；首次访问跟随浏览器语言

const KEY = 'naiwa-tarot-lang';
let lang = 'zh';
try {
  lang = localStorage.getItem(KEY) || ((navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en');
} catch { /* 无存储时用中文 */ }

export const getLang = () => lang;
export function setLang(v) {
  lang = v;
  try { localStorage.setItem(KEY, v); } catch { /* 忽略 */ }
}

/* ── 界面文案 ── */
const UI = {
  zh: {
    pageTitle: '奶蛙 · 暗夜塔罗 · Naiwa Gothic Tarot',
    titleSmall: '奶蛙', titleBig: '暗夜塔罗',
    lede: '一只始终面无表情的黄色梨形怪物，<br />穿行于庄严、阴郁、华丽的哥特塔罗世界。',
    question: '在心中默念你的问题……（可不填）',
    autoToggle: '一键抽牌 · 自动洗牌并揭示',
    revealAll: '全部揭示', restart: '重新抽牌', skip: '跳过 ››', again: '再抽一次',
    share: '生成分享图', shareSave: '保存图片', shareSend: '分享', shareClose: '关闭',
    daily: '今日一签', dailySubNew: '每日一张 · 今日的提醒', dailySubDone: '今日已抽 · 点击回看',
    streak: (n) => `已连续 ${n} 天`, comeTomorrow: '明天再来抽新的一签',
    hDailyAgain: '这是你今日的签 · 明天再来', hDailyDone: '今日之签已揭晓 · 明天再来',
    codex: '图鉴', codexLink: (a, b) => `图鉴 · 已收集 ${a} / ${b}`, codexProgress: (a, b) => `已收集 ${a} / ${b}`,
    codexStreak: (n) => (n ? `每日一签 · 已连续 ${n} 天` : '每日一签 · 今天还没抽'),
    drawnTimes: (n) => `抽到过 ${n} 次`, locked: '尚未遇见', codexHint: '每次翻开的牌都会收进图鉴',
    shareTip: '手机上也可以长按图片保存', shareMaking: '正在绘制……', shareCta: '扫码，抽一张属于你的牌', shareFail: '生成失败，请重试', shareSaved: '已保存到相册', shareAlbumHint: '需要相册权限来保存抽牌结果图',
    home: '回到首页', settings: '设置', close: '关闭',
    soundOn: '开启音效', soundOff: '关闭音效',
    langBtn: 'EN', langAria: 'Switch to English',
    hShuffle: '奶蛙正在洗牌……', hShuffleAuto: '奶蛙正在替你洗牌……',
    hPick: (n, pos) => `凭直觉选出 ${n} 张牌 · ${pos}`, hPicked: '牌已就位',
    hAutoPick: '奶蛙正在替你抽牌……',
    hRevealOne: '轻触牌面，翻开这张牌', hRevealMany: '轻触牌面，逐一翻开',
    hRevealing: '牌面正在翻开……', hDone: '牌已全部翻开 · 点击牌面查看详情',
    upright: '正位', reversed: '逆位', revTag: '逆',
    drawnUp: '正位 · 你抽到的', drawnRev: '逆位 · 你抽到的',
    whisper: '奶蛙低语：',
    disclaimer: '牌面是象征与自我反思的小提示，仅供娱乐。奶蛙只陪你看看不同的可能。',
    fLove: '感情', fWork: '事业', fAdvice: '建议', mScene: '画面', mOrigin: '原型', mAstro: '对应',
    stHead: '设 置', stGroupRead: '抽 牌', stGroupShow: '表 现',
    revTitle: '逆位概率', revDesc: '洗牌时每张牌成为逆位的机会',
    qTitle: '画质', qAutoNow: '按设备自动 · 当前：', qFixed: '手动指定 · 新一轮抽牌完全生效',
    qNames: { auto: '自动', high: '高', mid: '中', low: '低' },
    st: {
      autoDraw: ['一键抽牌', '自动洗牌、抽牌并依次揭示'],
      autoReveal: ['自动翻牌', '选完牌后自动揭示'],
      skipIntro: ['跳过洗牌动画', '直接进入选牌'],
      reversed: ['逆位', '允许抽到逆位牌'],
      parallax: ['视差 / 陀螺仪', '悬停或倾斜手机时的纵深'],
      lights: ['牌面光效', '月光、烛火、星芒等发光动效'],
      calm: ['弱化动效', '更快、更少闪光与震动'],
      sound: ['音效', '洗牌、翻牌等仪式音效'],
      ambient: ['背景音', '低沉的环境长音'],
    },
  },
  en: {
    pageTitle: 'Naiwa · Night Tarot',
    titleSmall: 'Naiwa', titleBig: 'Night Tarot',
    lede: 'A forever-expressionless, pear-shaped yellow creature<br />wanders a solemn, gloomy and ornate gothic tarot world.',
    question: 'Silently ask your question… (optional)',
    autoToggle: 'One-click reading · auto draw & reveal',
    revealAll: 'Reveal all', restart: 'Draw again', skip: 'Skip ››', again: 'Draw again',
    share: 'Share image', shareSave: 'Save image', shareSend: 'Share', shareClose: 'Close',
    daily: 'Daily Draw', dailySubNew: "One card a day · today's reminder", dailySubDone: 'Drawn today · tap to revisit',
    streak: (n) => `${n}-day streak`, comeTomorrow: 'Come back tomorrow for a new card',
    hDailyAgain: "This is today's card · come back tomorrow", hDailyDone: "Today's card is revealed · come back tomorrow",
    codex: 'Codex', codexLink: (a, b) => `Codex · ${a} / ${b} collected`, codexProgress: (a, b) => `${a} / ${b} collected`,
    codexStreak: (n) => (n ? `Daily draw · ${n}-day streak` : 'Daily draw · not drawn today'),
    drawnTimes: (n) => `Drawn ${n} time${n > 1 ? 's' : ''}`, locked: 'Not yet met', codexHint: 'Every card you reveal joins the codex',
    shareTip: 'On mobile you can also long-press the image to save it', shareMaking: 'Rendering…', shareCta: 'Scan to draw your own card', shareFail: 'Could not render, please try again', shareSaved: 'Saved to your album', shareAlbumHint: 'Album access is needed to save your reading',
    home: 'Back to home', settings: 'Settings', close: 'Close',
    soundOn: 'Turn sound on', soundOff: 'Turn sound off',
    langBtn: '中', langAria: '切换到中文',
    hShuffle: 'Naiwa is shuffling…', hShuffleAuto: 'Naiwa is shuffling for you…',
    hPick: (n, pos) => `Trust your intuition — choose ${n} · ${pos}`, hPicked: 'The cards are in place',
    hAutoPick: 'Naiwa is drawing for you…',
    hRevealOne: 'Tap the card to turn it over', hRevealMany: 'Tap each card to turn it over',
    hRevealing: 'Turning the cards…', hDone: 'All cards revealed · tap one for details',
    upright: 'Upright', reversed: 'Reversed', revTag: 'REV',
    drawnUp: 'Upright · your draw', drawnRev: 'Reversed · your draw',
    whisper: 'Naiwa whispers: ',
    disclaimer: 'The cards are symbols and small prompts for reflection, just for fun. Naiwa simply keeps you company while you look at the possibilities.',
    fLove: 'Love', fWork: 'Work', fAdvice: 'Advice', mScene: 'In This Deck', mOrigin: 'The Archetype', mAstro: 'Correspondence',
    stHead: 'SETTINGS', stGroupRead: 'READING', stGroupShow: 'PRESENTATION',
    revTitle: 'Reversal chance', revDesc: 'Chance each card lands reversed when shuffled',
    qTitle: 'Quality', qAutoNow: 'Auto for this device · now: ', qFixed: 'Manual · fully applies next reading',
    qNames: { auto: 'Auto', high: 'High', mid: 'Mid', low: 'Low' },
    st: {
      autoDraw: ['One-click reading', 'Auto shuffle, draw and reveal'],
      autoReveal: ['Auto reveal', 'Flip the cards once chosen'],
      skipIntro: ['Skip the shuffle', 'Go straight to choosing'],
      reversed: ['Reversals', 'Allow reversed cards'],
      parallax: ['Parallax / gyroscope', 'Depth on hover or phone tilt'],
      lights: ['Card lighting', 'Glowing moons, flames and stars'],
      calm: ['Reduce motion', 'Faster, fewer flashes and shakes'],
      sound: ['Sound effects', 'Shuffle, flip and ritual sounds'],
      ambient: ['Ambience', 'A low drone in the background'],
    },
  },
};
export const t = (k) => UI[lang][k];

export const titleCase = (s) => s.toLowerCase()
  .replace(/\b[a-z]+/g, (w, i) => (i > 0 && /^(of|the|and)$/.test(w) ? w : w[0].toUpperCase() + w.slice(1)));
