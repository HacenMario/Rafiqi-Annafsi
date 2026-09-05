// generate-report-docx.js — rafiqi-platform-guide.docx (RTL Arabic + FR, R1 cover FG-1)
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, LevelFormat, SectionType, TableLayoutType,
} = require("docx");
const fs = require("fs");
const H = require("./docx-helpers.js");
const { PAL, AR_FONT, NB, noBorders, allNoBorders, calcTitleLayout, calcCoverSpacing, arRun, frRun, arPara, frPara, kicker, h1, h2, frTitle, benefitBox, pledgeBox, zebraTable, headerCellAr } = H;

// ═══════════════ Cover — Recipe R1 mirrored for RTL (design-system.md R1) ═══════════════
function buildCoverR1RTL(config) {
  const P = config.palette;
  const padStart = 1200, padEnd = 800;
  const availableWidth = 11906 - padStart - padEnd - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length,
    fixedHeight: 400,
  });
  const accentBar = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];

  // 1. dynamic top whitespace
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));

  // 2. Latin label — LTR paragraph flushed to physical right, accent bottom border
  if (config.englishLabel) {
    children.push(new Paragraph({
      alignment: AlignmentType.RIGHT,
      indent: { right: padStart, left: padEnd },
      spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "), size: 18, color: P.accent, font: AR_FONT, characterSpacing: 40 })],
    }));
  }

  // 3. main title — bidi paragraphs, start-side indent (w:left = start under bidi)
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      bidirectional: true,
      indent: { left: padStart, right: padEnd },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, sizeComplexScript: titleSize, bold: true, rightToLeft: true, color: P.cover.titleColor, font: AR_FONT })],
    }));
  }

  // 4. subtitle
  if (config.subtitle) {
    children.push(new Paragraph({
      bidirectional: true,
      indent: { left: padStart, right: padEnd },
      spacing: { after: 800, line: 380, lineRule: "atLeast" },
      children: [new TextRun({ text: config.subtitle, size: 26, sizeComplexScript: 26, rightToLeft: true, color: P.cover.subtitleColor, font: AR_FONT })],
    }));
  }

  // 5. meta lines — accent bar on the start side (physical right for RTL)
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      bidirectional: true,
      indent: { left: padStart + 200, right: padEnd },
      spacing: { after: 80, line: 340, lineRule: "atLeast" },
      border: { right: accentBar },
      children: [new TextRun({ text: line, size: 24, sizeComplexScript: 24, rightToLeft: true, color: P.cover.metaColor, font: AR_FONT })],
    }));
  }

  // 6. dynamic bottom whitespace
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));

  // 7. footer line — top accent separator
  children.push(new Paragraph({
    bidirectional: true,
    indent: { left: padStart, right: padEnd },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, sizeComplexScript: 16, rightToLeft: true, color: P.cover.footerColor, font: AR_FONT }),
      new TextRun({ text: "                                        ", size: 16, font: AR_FONT }),
      new TextRun({ text: config.footerRight || "", size: 16, color: P.cover.footerColor, font: AR_FONT }),
    ],
  }));

  // single 16838 exact wrapper — the ONLY table, allNoBorders (non-negotiables)
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    visuallyRightToLeft: true,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg },
        borders: noBorders,
        children,
      })],
    })],
  })];
}

// ═══════════════ Content ═══════════════
const B = []; // body children

// ── Section 01 ──
B.push(kicker("القسم 01 · SECTION 01"));
B.push(h1("ما هي منصة «رفيقي النفسي»؟"));
B.push(frTitle("Qu'est-ce que la plateforme « Rafiqi Nafsi » ?"));
B.push(arPara([arRun("«رفيقي النفسي» منصة جزائرية وُلدت من جراح حقيقية: حرائق اجتاحت قرى ومدناً، وتركّت وراءها أسراً فقدت أعضاءها، وأطفالاً فقدوا بيوتهم، وقلوباً تحمل صدمةً لا تجد لها من يستمع. المنصة ببساطة جسرٌ يصل بين هؤلاء المتضررين وبين أنت — المختصّ الذي يستطيع أن يخفف عنهم — دون وسطاء، ودون تكاليف، ودون أن يضطر أحدٌ للانتظار أشهراً في عيادةٍ بعيدة. كل ما يحتاجه المتضرر هو هاتفٌ في جيبه، وكل ما تحتاجه أنت هو فتح حسابٍ باسمك المهني.")], { align: AlignmentType.JUSTIFIED }));
B.push(arPara([arRun("المنصة ليست شبكة تواصل عامة ولا منتدى مفتوحاً، بل فضاء منظَّم بالكامل: المتضرر يدخل باسمٍ مستعار يحفظ له خصوصيته، يتصفح دليل المختصين الموثوقين، يختار من يناسبه، ويحجز موعداً في الوقت الذي يناسبه من الفترات المتاحة صباحاً ومساءً. أنت من جهتك تستقبل الطلب فوراً على هاتفك، تجري الجلسة كتابياً في مكانٍ ووقتٍ يناسبك، وتترك المنصة تتولى عنك أعمال التنظيم والتنبيه والمتابعة.")], { align: AlignmentType.JUSTIFIED }));
B.push(frPara("« Rafiqi Nafsi » est une plateforme humanitaire algérienne née des blessures réelles laissées par les incendies : des familles endeuillées, des enfants déracinés, des cœurs traumatisés sans écoute disponible. Elle est tout simplement le pont entre ces sinistrés et vous — le professionnel capable de les accompagner — sans intermédiaires, sans frais, et sans longues files d'attente.", { before: 80 }));
B.push(frPara("Loin d'un réseau social ouvert, c'est un espace entièrement structuré : la victime entre avec un pseudonyme, parcourt l'annuaire des praticiens vérifiés, choisit puis réserve un créneau. Vous recevez la demande instantanément, menez la séance par écrit où que vous soyez, et la plateforme gère pour vous l'organisation, les rappels et le suivi."));
B.push(h2("أنواع الدعم التي تستقبلها المنصة"));
B.push(arPara([arRun("المنصة مفتوحة لكل همٍّ نفسيّ ولّدته الكوارث والفقدان، وأبرز المجالات التي يصل إليها المختصون عبرها:")], { keepNext: true, after: 140 }));
const typeRows = [
  ["فقدان عزيزٍ وحزنٌ ممتد", "مرافقة من فقدوا أبناءهم أو آباءهم أو بيوتهم في الكارثة، ومساعدتهم على العيش مع الفراغ.", "Deuil et perte d'un proche"],
  ["صدمات ما بعد الحرائق", "رعاية الأشخاص الذين يعيشون كوابيس أو ذكريات متطفلة أو خوفاً شديداً من النار بعد ما عاشوه.", "Traumatismes post-incendie"],
  ["قلقٌ ورهبةٌ واضطراب نوم", "تعامل مع الخوف المستمر من الكوارث القادمة، والتوتر الذي يفسد النوم والتركيز والحياة اليومية.", "Anxiété, peurs et troubles du sommeil"],
  ["ضغوط النزوح وفقدان المنزل", "دعم من فقدوا مأواهم ومصدر رزقهم، ويعيشون ضغط البداية من جديد في ظروف صعبة.", "Stress du déplacement et de la perte du foyer"],
  ["دعم الأطفال والعائلات", "إرشاد الأسر على كيفية احتواء أطفالها، وفهم تغيّرات سلوكهم بعد الكارثة، ومساعدتهم على الشفاء.", "Soutien aux enfants et aux familles"],
  ["استعادة الطمأنينة والثقة", "مواكبة من تجاوزوا الخطر ويريدون استعادة توازنهم، وبناء مستقبل نفسيّ أكثر ثباتاً.", "Retrouver la sérénité et la confiance"],
].map(([t, d, f]) => [
  [arPara([arRun(t, { bold: true, color: PAL.h2 })], { after: 0 })],
  [arPara([arRun(d)], { after: 0 })],
  [frPara(f, { after: 0 })],
]);
B.push(zebraTable({
  headers: [headerCellAr("نوع الدعم"), headerCellAr("الوصف"), headerCellAr("Terme français")],
  rows: typeRows, widths: [26, 46, 28],
}));
B.push(frPara("La plateforme accueille toutes les souffrances psychologiques liées aux catastrophes : deuil, traumatismes post-incendie, anxiété et insomnies, stress du déplacement, accompagnement des familles, et reconstruction de la sérénité.", { before: 160, after: 0 }));

// ── Section 02 ──
B.push(kicker("القسم 02 · SECTION 02"));
B.push(h1("أسئلة يسألها المتضررون وأسرهم"));
B.push(frTitle("Questions que se posent les victimes et leurs familles"));

function qa(num, qAr, aAr, benefit, qFr, aFr) {
  B.push(h2("س" + num + " · " + qAr));
  B.push(arPara([arRun(aAr)], { align: AlignmentType.JUSTIFIED }));
  if (benefit) B.push(benefitBox(benefit));
  B.push(frPara(qFr, { bold: true, before: 100, after: 60 }));
  B.push(frPara(aFr, { after: 200 }));
}

qa(1, "هل استخدام المنصة مجاني فعلاً؟",
  "نعم، مجاني بالكامل دون استثناء: التصفح مجاني، والتسجيل مجاني، وحجز الجلسات مع المختصين مجاني. المنصة مبادرة إنسانية هدفها الوحيد أن يصل الدعم النفسي إلى كل من احتاجه بعد الكارثة، ولذلك لا توجد أي رسوم اشتراك ولا أي دفع مخفي في أي خطوة. الهدف أن لا يكون المال أبداً سبباً في حرمان متضررٍ من يدٍ تمده بالأمل.",
  "أنضمّ لقضية إنسانية صافية يثق بها الناس، ويصل اسمك لفئة محتاجة لا تملك غالباً وسائل العلاج التقليدية.",
  "La plateforme est-elle vraiment gratuite ?",
  "Oui, entièrement : navigation, inscription et séances sont gratuites. C'est une initiative humanitaire — aucun abonnement, aucun paiement caché — afin que l'argent ne soit jamais un obstacle entre un sinistré et l'écoute qu'il mérite.");

qa(2, "أنا لا أجيد التعامل مع التطبيقات… هل السهولة كافية؟",
  "صُممت المنصة أصلاً لأشخاص يمرون بظروف صعبة ولا أقراب لأدوات معقدة: الشاشة واضحة بخطٍّ كبير يمكن تكبيره، والأزرار مرتبة بشكلٍ منطقي يفهمه المرء من أول نظرة، وكل صفحة تخبرك ببساطة ماذا تفعل بعد ذلك. كما أن المنصة متوفرة بالعربية الكاملة أولاً، وبالفرنسية والإنجليزية لمن يفضلها، ويمكن تثبيتها على الهاتف كتطبيق مستقل بضغطة واحدة دون الحاجة لأي متجر تطبيقات.",
  "لن تضيع وقت الجلسات في شرح «كيف يستعمل الموقع» — فالمستفيد يصل إليك جاهزاً، والكل ينصبّ على الدعم لا على التقنية.",
  "Je ne suis pas à l'aise avec les applications — est-ce vraiment simple ?",
  "La plateforme a été conçue pour des personnes en situation difficile : interface claire, texte agrandissable, navigation intuitive, arabe complet d'abord (puis français et anglais), et installation sur téléphone en un clic, sans boutique d'applications.");

qa(3, "كيف أطلب الدعم من هاتفي؟",
  "ثلاث خطوات قصيرة فقط: أولى، تفتح المنصة من متصفح الهاتف وتدخل باسم مستعار تختاره بنفسك دون أي وثائق. ثانياً، تتصفح دليل المختصين وتقرأ بطاقة كلٍّ منهم: تخصصه، خبرته، اللغات التي يتحدثها، والمواعيد المتاحة عنده. ثالثاً، تختار الوقت المناسب لك من مواعيده المعلنة — من الصباح الباكر حتى مساءً — فتصل طلبك إليه فوراً ويصلك تأكيد بذلك. وبعد انتهاء جلستك الأولى، تفتح المنصة تلقائياً جلسة متابعة قادمة حتى لا تنقطع الرحلة.",
  "عميلك لا يضيع بين الخطوات: طلبٌ واضح، موعدٌ محدد مسبقاً، ومتابعة تلقائية تحفظ استمرارية العلاج دون أن تلاحقك أحد.",
  "Comment demander de l'aide depuis mon téléphone ?",
  "Trois étapes : entrer avec un pseudonyme sans documents, parcourir l'annuaire (spécialité, expérience, langues, créneaux), puis réserver le créneau qui convient — de tôt le matin jusqu'au soir. Après la première séance, une séance de suivi s'ouvre automatiquement pour que l'accompagnement ne s'interrompe pas.");

qa(4, "هل يمكنني التحدث دون أن يكشف أحد هويتي؟",
  "نعم، وهذه من أهم قيم المنصة: لا تُطلب أسماء حقيقية ولا بطاقات هوية ولا عناوين؛ فالمتضرر يختار اسمه المستعار بنفسه، وكل ما يظهر للمختص هو هذا الاسم وما يريد هو بنفسه أن يروي. حتى الملف الشخصي للمختص نفسه يعرض ما يختار هو إظهاره من معلوماته المهنية فقط. الخصوصية هنا ليست خياراً إضافياً بل أساسٌ بُنيت عليه المنصة كلها، لأن الثقة هي أول دواء في رحلة التعافي.",
  null,
  "Puis-je parler sans que mon identité soit révélée ?",
  "Oui — c'est une valeur fondamentale : pas de nom réel, pas de pièce d'identité, pas d'adresse. Le sinistré choisit son pseudonyme et ne partage que ce qu'il décide de raconter. La confidentialité est le socle sur lequel toute la plateforme est bâtie.");

B.push(pledgeBox(
  "رحلة المتضرر — بخطى واضحة من أول لحظة",
  "يدخل باسمٍ مستعار يحفظ راحته، يتصفح دليل المختصين ويختار من يثق به، يحجز موعده من الأوقات المتاحة، تُعقد الجلسة في وقتها، ثم تفتح المتابعة التالية تلقائياً. كل خطوة مفهومة من أول مرة، ولا خطوة واحدة تحتاج إلى مساعدة تقنية من أحد.",
  "Le parcours en clair : pseudonyme, choix du praticien dans l'annuaire, réservation, séance à l'heure dite, puis suivi automatique. Chaque étape est évidente dès la première visite — aucune assistance technique requise."
));

// ── Section 03 ──
B.push(kicker("القسم 03 · SECTION 03"));
B.push(h1("أسئلة يسألها المختصون — ولماذا يجيبون بنعم"));
B.push(frTitle("Questions des professionnels — et pourquoi ils répondent oui"));

qa(1, "كيف أنضم إلى المنصة؟ وهل حسابي موثوق؟",
  "الانضمام يتم من نفس الموقع في دقائق: تملأ بياناتك المهنية (الاسم، التخصص، سنوات الخبرة، اللغات)، ثم يراجع فريق الإدارة طلبك ويوثّق حسابك بعد التأكد من صحة المعلومات قبل أن يظهر ملفك أمام أي متضرر. هذا التوثيق يحمي الطرفين: فالمتضرر يعلم أن كل مختصٍّ في الدليل تم التحقق منه بعناية، وأنت تعلم أنك تعمل في فضاءٍ نظيف بلا مستخدمين مزيفين ولا فوضى.",
  "شهادة ثقة مجانية تسبقك: ظهورك في دليلٍ موثّق يمنحك صورة مهنية مرموقة دون أي جهد دعائي.",
  "Comment rejoindre la plateforme ? Mon compte est-il vérifié ?",
  "L'inscription prend quelques minutes : vous remplissez vos informations professionnelles, puis l'équipe d'administration vérifie et valide votre compte avant l'affichage de votre profil. Ce contrôle protège les deux parties et garantit un annuaire fiable.");

qa(2, "كيف تصلك طلبات الجلسات؟ وهل ستنسى موعداً ما؟",
  "حين يحجز متضرر موعداً عندك، يصلك إشعار فوري على هاتفك يخبرك بذلك حتى لو كنت تغادر الموقع، وتصل التنبيهات كذلك عند وصول رسائل جديدة أثناء انتظارك. وقبل موعد الجلسة بساعة تقريباً تصلك تذكيرة من المنصة تلقائياً، ويصلك أنت ومتضررك معاً — فتقلّ الغيابات والمواعيد المفقودة إلى أدنى حد ممكن. الأمر أشبه بمساعدٍ شخصي يدير تقويمك نيابة عنك ولا ينسى أبداً.",
  "أقل غيابات، أقل ضياعٍ للوقت، وتقويمٌ يمتلئ بانتظام — من هاتفك وحده ودون أي أداة خارجية.",
  "Comment reçoit-on les demandes ? Risque-t-on d'oublier un rendez-vous ?",
  "Chaque réservation déclenche une notification instantanée sur votre téléphone, et les nouveaux messages sont signalés. Une heure avant la séance, la plateforme envoie automatiquement un rappel aux deux parties — réduisant au minimum les oublis et les absences.");

qa(3, "كيف تجري الجلسة؟ وماذا عن المتابعة بعدها؟",
  "تجري الجلسة كتابياً في مساحة خاصة بينك وبين المتضرر فقط، في الوقت المحجوز من فترات يومية ممتدة من التاسعة صباحاً حتى التاسعة مساءً باستثناء ساعة الغداء — أي أن لديك آفاقاً واسعة تناسب دوامك وواجباتك الأخرى. والجميل أن المنصة تفتح تلقائياً بعد الجلسة الأولى موعد متابعة قادم، فتستمر المواكبة دون أن تطلب أنت ذلك، ودون أن يحتاج المتضرر إلى إعادة كل الإجراءات من البداية.",
  "مسار علاجي متصل يُدار ذاتياً: أنت تركّز على جوهر عملك، والمنصة تصون استمرارية الملف والرحلة.",
  "Comment se déroule une séance ? Et le suivi après ?",
  "La séance se déroule par écrit, dans un espace privé, sur des créneaux étendus (09h–21h, hors pause déjeuner). Après la première séance, un rendez-vous de suivi s'ouvre automatiquement — l'accompagnement continue sans démarches supplémentaires.");

qa(4, "ما الذي يوفره لي «دليل المختصين»؟",
  "دليل المختصين هو نافذتك المهنية أمام من يبحث عنك: بطاقة تعريفية أنيقة تعرض تخصصك وخبرتك ولغاتك ومواعيدك المتاحة، مع صورة شخصية إن اخترتها، ويمكن للمتضرر التنقل بين البطاقات والبحث عن التخصص المناسب لحالته ثم الحجز مباشرة من نفس البطاقة. بهذا الشكل لا تحتاج إلى موقع شخصي ولا حسابات دعائية؛ فبطاقتك داخل المنصة تصل إلى من يحتاجك في اللحظة التي يحتاجك فيها بالضبط.",
  "حضور مهني جاهز ومنظّم بدون أي تكلفة، يجعل من كل متضررٍ يتصفح الدليل فرصةً حقيقية للوصول إليك.",
  "Que m'apporte l'annuaire des praticiens ?",
  "Une vitrine professionnelle élégante : spécialité, expérience, langues, créneaux et photo au choix. Le sinistré compare, choisit et réserve directement depuis votre fiche — sans site web personnel ni publicité, votre carte atteint celui qui vous cherche au moment précis.");

qa(5, "لماذا هذه المنصة تحديداً وليس وسائل أخرى؟",
  "لأنها جمعت في مكانٍ واحد ما تتفرق بينه الأدوات عادة: وصولاً مباشراً إلى فئة محرومة من الدعم، وتنظيم مواعيد يحفظ وقتك، وسريةً حقيقية تحفظ سمعة عملك، وأدوات متابعة تحفظ استمرار الرحلة، وثلاث لغات تفتح لك أبواباً أوسع — وكل ذلك مجاناً في مبادرة إنسانية يشعر معها المختص بأنه يمنح وقتاً صافياً لا يتنازل فيه عن أي شيء. إنها ليست مهمة إضافية عليك، بل طريقة أسهل لأداء العمل الذي تؤمن به أصلاً.",
  null,
  "Pourquoi cette plateforme plutôt qu'un autre moyen ?",
  "Parce qu'elle réunit en un seul lieu ce qui est habituellement dispersé : accès direct aux sinistrés, organisation des rendez-vous, confidentialité réelle, suivi automatique, trois langues — le tout gratuitement, dans une initiative humanitaire où vous donnez du temps sans rien sacrifier.");

// ── Section 04 ──
B.push(kicker("القسم 04 · SECTION 04"));
B.push(h1("الخصوصية والسرية قبل كل شيء"));
B.push(frTitle("La confidentialité avant tout"));

qa(1, "كيف تُحمى بيانات المتضررين؟",
  "المنصة لا تسأل أصلاً عن الأسماء الحقيقية ولا عن الوثائق؛ فكل متضرر يعمل باسمٍ مستعار يختاره بنفسه، وبيانات التواصل محفوظة في النظام لأغراض التشغيل فقط ولا تظهر لأي طرف آخر. الإشعارات التي تصلك مبنية على الحكمة: تخبرك بوجود رسالة أو موعد جديد دون أن تكتب لك محتوى المحادثة فيها، فلا يقرأ عينٌ ثالثة كلمةً مما يُقال في الجلسة.",
  null,
  "Comment les données des sinistrés sont-elles protégées ?",
  "La plateforme ne demande ni nom réel ni documents : chaque personne agit sous pseudonyme, les informations de contact restent internes à l'exploitation, et les notifications signalent l'existence d'un message sans jamais en révéler le contenu.");

qa(2, "هل محادثات الجلسات سرية فعلاً؟",
  "نعم: محتوى الجلسة محصور بينك وبين المتضرر وحدهما، ولا يستطيع أي مستخدم آخر الاطلاع عليه، كما أن استمرار خصوصية الطرفين مُراقب تقنياً حتى لا ينقطع الحوار دون سبب. وحين تنتهي الجلسة تبقى المحادثة في ملفكما كمرجع للمتابعة، بعيداً عن أعين أي شخص آخر. بهذا تحصل على بيئة عمل تحترم أخلاقيات مهنتك كما تحترمها أنت.",
  null,
  "Les conversations des séances sont-elles vraiment confidentielles ?",
  "Oui : le contenu d'une séance reste entre vous et le sinistré uniquement. La continuité de la confidentialité des deux parties est surveillée techniquement, et l'historique demeure dans votre dossier commun comme référence de suivi, à l'abri de tout regard extérieur.");

qa(3, "وماذا لو وصلت حالة خطرة تستوجب تدخلاً عاجلاً؟",
  "المنصة تراقب بعناية علامات الخطر الشديد خلال المحادثات، وعند اكتشاف حالة تستدعي تدخلاً عاجلاً توثّقها وتحيلها للفريق المختص بالمتابعة العاجلة، حتى لا تضيع حياةٌ بين يدي أي نظام. هذا الدور ليس تجسساً على الخصوصية بل صمام أمان إنساني يوازن بين احترام السرّ وواجب الإنقاذ — تماماً كما يفعل المختص في عيادته حين تظهر مؤشرات خطر حقيقي.",
  null,
  "Et si une situation dangereuse nécessitait une intervention urgente ?",
  "La plateforme surveille attentivement les signaux de danger grave et, en cas de situation critique, la documente et l'escalade vers l'équipe de suivi urgent. Ce n'est pas de la surveillance : c'est une soupape de sécurité humanitaire qui équilibre le respect du secret et le devoir de sauver des vies.");

B.push(pledgeBox(
  "ميثاق المنصة — وعدنا الثلاثي",
  "سريةٌ لا تنكسر: ما يُقال في الجلسة يبقى بين الطرفين. احترامٌ مطلق: لكرامة كل متضرر ولخصوصية كل مختص. أمانٌ دائم: توثيق للمختصين، ومراقبة لحالات الخطر، وحماية للبيانات في كل خطوة.",
  "Charte de la plateforme — trois promesses : confidentialité inviolable, respect absolu de la dignité de chacun, et sécurité permanente (praticiens vérifiés, surveillance des situations critiques, protection des données)."
));

// ── Section 05 ──
B.push(kicker("القسم 05 · SECTION 05"));
B.push(h1("الانضمام في أربع خطوات بسيطة"));
B.push(frTitle("Rejoindre la plateforme en quatre étapes simples"));
B.push(arPara([arRun("لا أوراقاً معقدة ولا إجراءات طويلة: من قرار الانضمام إلى استقبال أول جلسة، أربع خطوات قصيرة تفصلك فقط، والمنصة تمشي معك في كل واحدة منها.")], { align: AlignmentType.JUSTIFIED, after: 160 }));

const steps = [
  ["سجّل بياناتك المهنية", "من الموقع نفسه: اسمك، تخصصك، سنوات خبرتك، واللغات التي تتيحها — في نموذج واحد قصير لا يستغرق دقائق.", "Inscrivez vos informations professionnelles en quelques minutes."],
  ["يُوثَّق حسابك", "يراجع فريق الإدارة طلبك بعناية ويوثّق حسابك، فتصبح بطاقتك مؤهلة للظهور في دليل المختصين الموثوق.", "L'équipe d'administration vérifie puis valide votre compte."],
  ["حدد مواعيدك وتخصصك", "تعلن الفترات التي تخصصها للجلسات من يومك، وتكمل بطاقتك التعريفية بصورتك ونبذة عنك إن أردت.", "Déclarez vos créneaux et finalisez votre fiche de présentation."],
  ["استقبل أول جلسة", "تثبّت المنصة على هاتفك كتطبيق، تفعّل الإشعارات بضغطة، وتبدأ باستقبال المتضررين وإشعارات المواعيد فوراً.", "Installez l'application, activez les notifications, recevez votre première séance."],
];
for (const [t, d, f] of steps) {
  B.push(arPara(
    [arRun(t + " — ", { bold: true, color: PAL.h2 }), arRun(d)],
    { numbering: { reference: "steps-list", level: 0 }, after: 40 }
  ));
  B.push(frPara(f, { align: AlignmentType.RIGHT, indent: { right: 720 }, after: 140, color: PAL.muted, size: 20 }));
}
B.push(arPara([arRun("بعد الموافقة مباشرة: يظهر ملفك في الدليل أمام المتضررين، وتصلك الإشعارات الفورية على هاتفك، ويمكنك إدارة كل شيء من جيبك — دون أي برنامج إضافي ودون أي كلفة.", { bold: true, color: PAL.h2 })], { align: AlignmentType.JUSTIFIED, before: 100 }));

// ── Section 06 ──
B.push(kicker("القسم 06 · SECTION 06"));
B.push(h1("المميزات في لمحة واحدة"));
B.push(frTitle("Toutes les fonctionnalités en un coup d'œil"));
B.push(arPara([arRun("هذه خلاصة ما تقدمه المنصة، وماذا يعني كل ميزةً لك ولمن تخدمهم:")], { keepNext: true, after: 140 }));
const featRows = [
  ["ثلاث لغات كاملة", "Trois langues complètes", "عربية وفرنسية وإنجليزية بواجهة عربية أصيلة من اليمين لليسار — فلا يبقى أحد خارج الحوار بسبب اللغة."],
  ["تثبيت كتطبيق على الهاتف", "Installation comme application", "المنصة تنزل على هاتفك بضغطة واحدة وتعمل كأي تطبيق، دون متاجر ولا تحديثات مزعجة."],
  ["إشعارات فورية", "Notifications instantanées", "كل حجزٍ أو رسالةٍ أو تذكيرٍ يصلك لحظياً على هاتفك، فلا يفوتك شيء حتى وأنت بعيد عن الشاشة."],
  ["مواعيد منظمة 09:00–21:00", "Créneaux organisés 09h–21h", "آفاق يومية واسعة تناسب دوامك، مع تعطيل ساعة الغداء، وحجز مسبق يمنع التزاحم والفوضى."],
  ["تذكير قبل الجلسة بساعة", "Rappel une heure avant", "تنبيه تلقائي للطرفين معاً يقلل الغياب ويحافظ على انتظام المسار العلاجي."],
  ["متابعة تلقائية بعد الجلسة", "Suivi automatique", "جلسة الموعد القادم تُفتح من تلقاء نفسها، فتستمر الرحلة دون إجراءات متكررة على أحدكم."],
  ["أسماء مستعارة وخصوصية كاملة", "Pseudonymes et confidentialité", "لا أسماء حقيقية ولا وثائق، وإشعارات ذكية لا تكشف محتوى المحادثات لأي عينٍ ثالثة."],
  ["وضع ليلي وتكبير الخط", "Mode sombre et taille du texte", "راحة للعين في كل الأوقات، وخطٌّ يمكن تكبيره لكبار السن ومن يرتاح للخط الأكبر."],
  ["مجانية بالكامل", "Entièrement gratuit", "كل الخدمات السابقة بدون أي رسوم على المتضرر أو المختص — لأنها مبادرة إنسانية أولاً."],
].map(([t, f, d]) => [
  [arPara([arRun(t, { bold: true, color: PAL.h2 })], { after: 20 }), frPara(f, { after: 0, size: 20 })],
  [arPara([arRun(d)], { after: 0 })],
]);
B.push(zebraTable({
  headers: [headerCellAr("الميزة · Fonctionnalité"), headerCellAr("كيف تخدمك · En quoi elle vous sert")],
  rows: featRows, widths: [36, 64],
}));

// ── Closing ──
B.push(kicker("شارك الرحلة · REJOIGNEZ LE VOYAGE", { center: true }));
B.push(arPara([arRun("لكل قلبٍ جرح ورفيقٌ يسير معه", { bold: true, size: 36, color: PAL.h1 })], { align: AlignmentType.CENTER, before: 100, after: 80, line: 440, lineRule: "atLeast", keepNext: true }));
B.push(frPara("Pour chaque cœur blessé, un compagnon de route — Rafiqi Nafsi.", { align: AlignmentType.CENTER, after: 220, keepNext: true }));
B.push(arPara([arRun("إن كنت مختصاً نفسانياً، فمساحتك جاهزة في المنصة بانتظار تخصصك وقلبك. وإن لم تكن كذلك، فقد تكون أنت سبب وصول هذا الدليل إلى مختصٍّ يعرف قيمة وقته — شاركه هذه الصفحات، فقد تكون مشاركتك بداية تعافي شخصٍ لم تلتق به قط.")], { align: AlignmentType.JUSTIFIED, keepNext: true }));
B.push(arPara([arRun("مجاني بالكامل    ·    آمن وسرّي    ·    بثلاث لغات", { bold: true, size: 24, color: PAL.h2 })], { align: AlignmentType.CENTER, before: 100, after: 100, keepNext: true }));
B.push(arPara([arRun("منصة «رفيقي النفسي» — مبادرة جزائرية للتأهيل النفسي بعد الكوارث · Guide partenaires · Septembre 2026", { size: 18, color: PAL.muted })], { align: AlignmentType.CENTER, after: 0 }));

// ═══════════════ Assembly ═══════════════
const doc = new Document({
  creator: "فريق منصة «رفيقي النفسي»",
  title: "رفيقي النفسي — دليل تعريفي للمختصين والشركاء",
  subject: "دليل تعريفي بلغة بسيطة لكل مميزات المنصة",
  description: "منصة جزائرية إنسانية تربط المتضررين من الكوارث بالمختصين النفسانيين — دليل الشركاء، سبتمبر 2026",
  keywords: "رفيقي النفسي، الدعم النفسي، دليل الشركاء، Rafiqi Nafsi",
  styles: {
    default: {
      document: {
        run: { font: AR_FONT, size: 24, color: "000000" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: AR_FONT, size: 32, bold: true, color: PAL.h1 },
        paragraph: { spacing: { before: 400, after: 100, line: 380, lineRule: "atLeast" } },
      },
      heading2: {
        run: { font: AR_FONT, size: 28, bold: true, color: PAL.h2 },
        paragraph: { spacing: { before: 260, after: 120, line: 340, lineRule: "atLeast" } },
      },
    },
  },
  numbering: {
    config: [{
      reference: "steps-list",
      levels: [{
        level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    }],
  },
  sections: [
    { // Cover — margin 0, no footer
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } },
      },
      children: buildCoverR1RTL({
        title: "رفيقي النفسي",
        subtitle: "دليل تعريفي للمختصين والشركاء — منصة جزائرية للدعم النفسي بعد الكوارث",
        englishLabel: "GUIDE DES PARTENAIRES",
        metaLines: [
          "إعداد: فريق منصة «رفيقي النفسي»",
          "للعلماء النفسانيين والأطباء النفسانيين والممارسين",
          "سبتمبر 2026 · نسخة الشركاء",
        ],
        footerLeft: "منصة رفيقي النفسي — مبادرة إنسانية",
        footerRight: "Septembre 2026",
        palette: { bg: PAL.bg, accent: PAL.accent, cover: PAL.cover },
      }),
    },
    { // Body — mirrored margins (RTL binding), page numbers from 1
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1417, right: 1701 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            bidirectional: true,
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "منصة رفيقي النفسي — دليل تعريفي للمختصين والشركاء", size: 18, sizeComplexScript: 18, rightToLeft: true, color: PAL.muted, font: AR_FONT })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: PAL.muted, font: AR_FONT })],
          })],
        }),
      },
      children: B,
    },
  ],
});

const OUT = "/home/z/my-project/download/rafiqi-nafsi-guide/rafiqi-platform-guide.docx";
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("OK written:", OUT, buf.length, "bytes");
}).catch((e) => { console.error("FAIL:", e); process.exit(1); });
