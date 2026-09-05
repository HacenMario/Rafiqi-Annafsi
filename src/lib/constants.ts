// ─── رفيقي النفسي — Platform constants ──────────────────────────────

export const CHAT_SERVICE_PORT = process.env.CHAT_SERVICE_PORT || 3003;

export const EMERGENCY_NUMBERS = {
  civilProtection: "14",
  civilProtectionAlt: "1021",
  police: "17",
  ambulance: "115",
};

export const TOPICS = [
  "grief",
  "homeLoss",
  "anxiety",
  "safety",
  "childSupport",
  "helperBurnout",
  "other",
] as const;
export type TopicKey = (typeof TOPICS)[number];

export const SPECIALTIES = [
  "trauma",
  "grief",
  "anxietyDepression",
  "children",
  "burnout",
  "crisisIntervention",
  "ptsd",
  "mediaTrauma",
  "displacementSupport",
  "other",
] as const;
export type SpecialtyKey = (typeof SPECIALTIES)[number];

export const LANGUAGES = ["ar", "fr", "en", "tr", "ru", "zh"] as const;
export type AppLang = (typeof LANGUAGES)[number];

/**
 * ولايات الجزائر — القائمة الرسمية الكاملة (58 ولاية مرقّمة 01–58)
 * ملاحظة: إذا أُضيفت ولايات جديدة مستقبلاً يكفي إضافتها هنا فقط
 * (الواجهات الثلاث تقرأ من هذه القائمة تلقائياً).
 */
export const WILAYA_LIST: { code: string; key: string; ar: string; fr: string; en: string }[] = [
  { code: "01", key: "adrar", ar: "أدرار", fr: "Adrar", en: "Adrar" },
  { code: "02", key: "chlef", ar: "الشلف", fr: "Chlef", en: "Chlef" },
  { code: "03", key: "laghouat", ar: "الأغواط", fr: "Laghouat", en: "Laghouat" },
  { code: "04", key: "oumElBouaghi", ar: "أم البواقي", fr: "Oum El Bouaghi", en: "Oum El Bouaghi" },
  { code: "05", key: "batna", ar: "باتنة", fr: "Batna", en: "Batna" },
  { code: "06", key: "bejaia", ar: "بجاية", fr: "Béjaïa", en: "Béjaïa" },
  { code: "07", key: "biskra", ar: "بسكرة", fr: "Biskra", en: "Biskra" },
  { code: "08", key: "bechar", ar: "بشار", fr: "Béchar", en: "Béchar" },
  { code: "09", key: "blida", ar: "البليدة", fr: "Blida", en: "Blida" },
  { code: "10", key: "bouira", ar: "البويرة", fr: "Bouira", en: "Bouira" },
  { code: "11", key: "tamanrasset", ar: "تمنراست", fr: "Tamanrasset", en: "Tamanrasset" },
  { code: "12", key: "tebessa", ar: "تبسة", fr: "Tébessa", en: "Tébessa" },
  { code: "13", key: "tlemcen", ar: "تلمسان", fr: "Tlemcen", en: "Tlemcen" },
  { code: "14", key: "tiaret", ar: "تيارت", fr: "Tiaret", en: "Tiaret" },
  { code: "15", key: "tiziOuzou", ar: "تيزي وزو", fr: "Tizi Ouzou", en: "Tizi Ouzou" },
  { code: "16", key: "alger", ar: "الجزائر", fr: "Alger", en: "Algiers" },
  { code: "17", key: "djelfa", ar: "الجلفة", fr: "Djelfa", en: "Djelfa" },
  { code: "18", key: "jijel", ar: "جيجل", fr: "Jijel", en: "Jijel" },
  { code: "19", key: "setif", ar: "سطيف", fr: "Sétif", en: "Sétif" },
  { code: "20", key: "saida", ar: "سعيدة", fr: "Saïda", en: "Saïda" },
  { code: "21", key: "skikda", ar: "سكيكدة", fr: "Skikda", en: "Skikda" },
  { code: "22", key: "sidiBelAbbes", ar: "سيدي بلعباس", fr: "Sidi Bel Abbès", en: "Sidi Bel Abbès" },
  { code: "23", key: "annaba", ar: "عنابة", fr: "Annaba", en: "Annaba" },
  { code: "24", key: "guelma", ar: "قالمة", fr: "Guelma", en: "Guelma" },
  { code: "25", key: "constantine", ar: "قسنطينة", fr: "Constantine", en: "Constantine" },
  { code: "26", key: "medea", ar: "المدية", fr: "Médéa", en: "Médéa" },
  { code: "27", key: "mostaganem", ar: "مستغانم", fr: "Mostaganem", en: "Mostaganem" },
  { code: "28", key: "msila", ar: "المسيلة", fr: "M'Sila", en: "M'Sila" },
  { code: "29", key: "mascara", ar: "معسكر", fr: "Mascara", en: "Mascara" },
  { code: "30", key: "ouargla", ar: "ورقلة", fr: "Ouargla", en: "Ouargla" },
  { code: "31", key: "oran", ar: "وهران", fr: "Oran", en: "Oran" },
  { code: "32", key: "elBayadh", ar: "البيض", fr: "El Bayadh", en: "El Bayadh" },
  { code: "33", key: "illizi", ar: "إليزي", fr: "Illizi", en: "Illizi" },
  { code: "34", key: "bordjBouArreridj", ar: "برج بوعريريج", fr: "Bordj Bou Arréridj", en: "Bordj Bou Arréridj" },
  { code: "35", key: "boumerdes", ar: "بومرداس", fr: "Boumerdès", en: "Boumerdès" },
  { code: "36", key: "elTarf", ar: "الطارف", fr: "El Tarf", en: "El Tarf" },
  { code: "37", key: "tindouf", ar: "تندوف", fr: "Tindouf", en: "Tindouf" },
  { code: "38", key: "tissemsilt", ar: "تيسمسيلت", fr: "Tissemsilt", en: "Tissemsilt" },
  { code: "39", key: "elOued", ar: "الوادي", fr: "El Oued", en: "El Oued" },
  { code: "40", key: "khenchela", ar: "خنشلة", fr: "Khenchela", en: "Khenchela" },
  { code: "41", key: "soukAhras", ar: "سوق أهراس", fr: "Souk Ahras", en: "Souk Ahras" },
  { code: "42", key: "tipaza", ar: "تيبازة", fr: "Tipaza", en: "Tipaza" },
  { code: "43", key: "mila", ar: "ميلة", fr: "Mila", en: "Mila" },
  { code: "44", key: "ainDefla", ar: "عين الدفلى", fr: "Aïn Defla", en: "Aïn Defla" },
  { code: "45", key: "naama", ar: "النعامة", fr: "Naâma", en: "Naâma" },
  { code: "46", key: "ainTemouchent", ar: "عين تموشنت", fr: "Aïn Témouchent", en: "Aïn Témouchent" },
  { code: "47", key: "ghardaia", ar: "غرداية", fr: "Ghardaïa", en: "Ghardaïa" },
  { code: "48", key: "relizane", ar: "غليزان", fr: "Relizane", en: "Relizane" },
  { code: "49", key: "timimoun", ar: "تيميمون", fr: "Timimoun", en: "Timimoun" },
  { code: "50", key: "bordjBadjiMokhtar", ar: "برج باجي مختار", fr: "Bordj Badji Mokhtar", en: "Bordj Badji Mokhtar" },
  { code: "51", key: "ouledDjellal", ar: "أولاد جلال", fr: "Ouled Djellal", en: "Ouled Djellal" },
  { code: "52", key: "beniAbbes", ar: "بني عباس", fr: "Béni Abbès", en: "Béni Abbès" },
  { code: "53", key: "inSalah", ar: "عين صالح", fr: "In Salah", en: "In Salah" },
  { code: "54", key: "inGuezzam", ar: "عين قزام", fr: "In Guezzam", en: "In Guezzam" },
  { code: "55", key: "touggourt", ar: "تقرت", fr: "Touggourt", en: "Touggourt" },
  { code: "56", key: "djanet", ar: "جانت", fr: "Djanet", en: "Djanet" },
  { code: "57", key: "elMghair", ar: "المغير", fr: "El M'Ghair", en: "El M'Ghair" },
  { code: "58", key: "elMeniaa", ar: "المنيعة", fr: "El Meniaa", en: "El Meniaa" },
];

export const WILAYAS = WILAYA_LIST.map((w) => w.key);

export const WILAYA_LABELS: Record<string, { ar: string; fr: string; en: string }> =
  Object.fromEntries(WILAYA_LIST.map((w) => [w.key, { ar: w.ar, fr: w.fr, en: w.en }]));

export const AGE_GROUPS = ["under18", "age18_30", "age31_50", "over50"] as const;

export const AGE_LABELS: Record<string, { ar: string; fr: string; en: string }> = {
  under18: { ar: "أقل من 18", fr: "Moins de 18", en: "Under 18" },
  age18_30: { ar: "18 - 30", fr: "18 - 30", en: "18 - 30" },
  age31_50: { ar: "31 - 50", fr: "31 - 50", en: "31 - 50" },
  over50: { ar: "أكثر من 50", fr: "Plus de 50", en: "Over 50" },
};

export const SESSION_MODES = ["TEXT", "VOICE", "VIDEO"] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

/**
 * v2.6.0 — أيام الأسبوع الثلاثية بالترتيب الجزائري (يبدأ بالأحد).
 * الفهرس = رقم اليوم في Date.getDay() (0=الأحد … 6=السبت).
 */
export const WEEKDAY_LABELS: Record<AppLang, string[]> = {
  ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
  fr: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  tr: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"],
  ru: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"],
  zh: ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"],
};

/* v2.7.0: أيام مختصرة لرؤوس شبكة التقويم في منتقي المواعيد — 7 أعمدة بلا تمرير */
export const WEEKDAY_SHORT: Record<AppLang, string[]> = {
  ar: ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"],
  fr: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  tr: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"],
  ru: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
  zh: ["日", "一", "二", "三", "四", "五", "六"],
};

export const SESSION_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
] as const;

/**
 * المواعيد الافتراضية الموحّدة لكل الأخصائيين:
 * من 09:00 صباحاً إلى 20:00 مساءً بفارق ساعة بين كل موعد،
 * مع استثناء وقت الفطور 12:00–13:00 (لا جلسات على الساعة 12:00).
 */
export const SLOT_TIMES = [
  "09:00", "10:00", "11:00",
  /* 12:00 — وقت الفطور (مستثنى عمداً) */
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00",
];

// Crisis keywords (server + client detection) — ar/fr/en
// المصدر الوحيد: shared/crisis-keywords.json (يقرأه الخادم الموحّد server.js أيضاً)
import crisisKeywordsJson from "../../shared/crisis-keywords.json";
export const CRISIS_KEYWORDS: string[] = crisisKeywordsJson as string[];

export const CRISIS_ACTION = "CRISIS_BANNER_SHOWN";
