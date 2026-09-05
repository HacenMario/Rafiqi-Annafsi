#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""إضافة عبارات الحكم والمقولات المشهورة إلى ملف العبارات المزرعة"""
import json

WISDOM = [
    {"cat": "wisdom", "au": "جلال الدين الرومي", "ar": "الجرح هو المكان الذي يدخل منه النور إليك", "fr": "La blessure est l'endroit par où la lumière entre en toi", "en": "The wound is the place where the Light enters you"},
    {"cat": "wisdom", "au": "نيلسون مانديلا", "ar": "الشجاعة ليست غياب الخوف، بل الانتصار عليه", "fr": "Le courage n'est pas l'absence de peur, mais le triomphe sur elle", "en": "Courage is not the absence of fear, but the triumph over it"},
    {"cat": "wisdom", "au": "ونستون تشرشل", "ar": "النجاح ليس نهائيًا، والفشل ليس قاتلًا؛ الشجاعة في الاستمرار هي ما يهم", "fr": "Le succès n'est pas définitif, l'échec n'est pas fatal: c'est le courage de continuer qui compte", "en": "Success is not final, failure is not fatal: it is the courage to continue that counts"},
    {"cat": "wisdom", "au": "ألبير كامو", "ar": "في قلب الشتاء، اكتشفتُ أن داخلي صيفٌ لا يُقهر", "fr": "Au cœur de l'hiver, j'ai découvert en moi un été invincible", "en": "In the depth of winter, I finally learned that within me there lay an invincible summer"},
    {"cat": "wisdom", "au": "أرسطو", "ar": "الأمل هو حلم الشخص اليقظ", "fr": "L'espoir est le rêve de l'homme éveillé", "en": "Hope is the dream of a waking man"},
    {"cat": "wisdom", "au": "فريدريش نيتشه", "ar": "ما لا يقتلني يجعلني أقوى", "fr": "Ce qui ne me tue pas me rend plus fort", "en": "That which does not kill me makes me stronger"},
    {"cat": "wisdom", "au": "لاو تسو", "ar": "الرحلة من ألف ميل تبدأ بخطوة واحدة", "fr": "Un voyage de mille lieues commence par un seul pas", "en": "A journey of a thousand miles begins with a single step"},
    {"cat": "wisdom", "au": "مثل صيني", "ar": "أفضل وقت لزرع شجرة كان قبل عشرين سنة، وثاني أفضل وقت هو الآن", "fr": "Le meilleur moment pour planter un arbre était il y a vingt ans; le second meilleur, c'est maintenant", "en": "The best time to plant a tree was twenty years ago; the second best time is now"},
    {"cat": "wisdom", "au": "مثل عربي", "ar": "الصبر مفتاح الفرج", "fr": "La patience est la clé de la délivrance", "en": "Patience is the key to relief"},
    {"cat": "wisdom", "au": "مثل عربي", "ar": "من جدّ وجد، ومن زرع حصد", "fr": "Qui persévère réussit, qui sème récolte", "en": "Who strives finds; who sows reaps"},
    {"cat": "wisdom", "au": "حكمة", "ar": "خير الكلام ما قلّ ودلّ", "fr": "Le meilleur discours est bref et sensé", "en": "The best speech is brief and meaningful"},
    {"cat": "wisdom", "au": "حكمة", "ar": "خلف كل سحابةٍ شمسٌ تنتظر", "fr": "Derrière chaque nuage attend un soleil", "en": "Behind every cloud waits a sun"},
    {"cat": "wisdom", "au": "حكمة", "ar": "حتى أطول الليل ينتهي بالفجر", "fr": "Même la nuit la plus longue se termine à l'aube", "en": "Even the longest night ends with dawn"},
    {"cat": "wisdom", "au": "حكمة", "ar": "وقتك أثمن ما تملك؛ أنفق بعضه على نفسك دون ذنب", "fr": "Ton temps est ton bien le plus précieux; consacre-en un peu à toi-même", "en": "Your time is your most precious possession; spend some of it on yourself"},
    {"cat": "wisdom", "au": "حكمة", "ar": "الابتسامة لا تكلف شيئًا وتمني الكثير", "fr": "Un sourire ne coûte rien et procure beaucoup", "en": "A smile costs nothing but gives much"},
    {"cat": "wisdom", "au": "حكمة يابانية", "ar": "سقوطُك ليس فشلَك؛ البقاء أرضًا هو الفشل", "fr": "Tomber n'est pas échouer; rester à terre, si", "en": "Falling is not failure; staying down is"},
    {"cat": "wisdom", "au": "مثل عربي", "ar": "الجار قبل الدار", "fr": "Le voisin avant la maison", "en": "The neighbor before the house"},
    {"cat": "wisdom", "au": "حكمة", "ar": "يدُ الله مع الجماعة؛ وحدك في يومك الصعب، جماعةٌ هنا", "fr": "La main de Dieu est avec la communauté; seul dans ton jour difficile, ensemble ici", "en": "God's hand is with the community; alone on your hard day, together here"},
    {"cat": "wisdom", "au": "أمير الشعراء أحمد شوقي", "ar": "وما نيلُ المطالبِ بالتمنّي، لكن تُؤخذُ الدنيا غِلابا", "fr": "Les souhaits ne suffisent pas à atteindre les buts; le monde se conquiert par l'effort", "en": "Wishes alone do not win goals; the world is taken by striving"},
    {"cat": "wisdom", "au": "حكمة", "ar": "قلبٌ واحد صادق يستطيع أن يدفئ مدينة كاملة", "fr": "Un seul cœur sincère peut réchauffer une ville entière", "en": "One sincere heart can warm an entire city"},
]

path = "shared/uplift-quotes.json"
d = json.load(open(path, encoding="utf-8"))
existing_keys = {(i["cat"], i["ar"]) for i in d}
added = 0
for w in WISDOM:
    if (w["cat"], w["ar"]) not in existing_keys:
        d.append(w)
        added += 1
json.dump(d, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
cats = {}
for i in d:
    cats[i["cat"]] = cats.get(i["cat"], 0) + 1
print(f"added={added}, total={len(d)}, by_cat={cats}")
