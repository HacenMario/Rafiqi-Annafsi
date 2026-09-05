#!/usr/bin/env python3
"""إضافة مفاتيح v2.9.0 إلى fr.ts و en.ts بعد نقاط ارتكاز معروفة."""
import io, sys

def insert_after(src, anchor, block):
    idx = src.find(anchor)
    if idx == -1:
        raise SystemExit(f"anchor not found: {anchor[:60]}")
    end = idx + len(anchor)
    return src[:end] + block + src[end:]

# عناصر الدعاء — تُبنى ديناميكياً بالسلاسل المترجمة
def dua_block(items, t):
    arr = ",\n".join(f'      "{x}"' for x in items)
    return (
        "  /* ─── v2.9.0: تمرين تهدئة النفس ─── */\n"
        "  breathing: {\n"
        "    openBtn: \"" + t["b_openBtn"] + "\",\n"
        "    title: \"" + t["b_title"] + "\",\n"
        "    subtitle: \"" + t["b_subtitle"] + "\",\n"
        "    phaseIn: \"" + t["b_in"] + "\",\n"
        "    phaseHold: \"" + t["b_hold"] + "\",\n"
        "    phaseOut: \"" + t["b_out"] + "\",\n"
        "    cycleOf: \"" + t["b_cycle"] + "\",\n"
        "    start: \"" + t["b_start"] + "\",\n"
        "    stop: \"" + t["b_stop"] + "\",\n"
        "    done: \"" + t["b_done"] + "\",\n"
        "    doneAgain: \"" + t["b_again"] + "\",\n"
        "    hint: \"" + t["b_hint"] + "\",\n"
        "    seconds: \"" + t["b_sec"] + "\",\n"
        "  },\n"
        "  /* ─── v2.9.0: صفحة الدعاء ─── */\n"
        "  dua: {\n"
        "    title: \"" + t["d_title"] + "\",\n"
        "    subtitle: \"" + t["d_sub"] + "\",\n"
        "    intro: \"" + t["d_intro"] + "\",\n"
        "    items: [\n" + arr + ",\n    ],\n"
        "    amen: \"" + t["d_amen"] + "\",\n"
        "    amenNote: \"" + t["d_note"] + "\",\n"
        "    amenDone: \"" + t["d_done"] + "\",\n"
        "    amenCount: \"" + t["d_count"] + "\",\n"
        "  },\n"
    )

FR_SESSION = """\n    waPanelHint: "Utilisez le bouton WhatsApp en haut de la salle pour ouvrir la conversation",\n"""
FR_VICTIM = """\n    /* ─── v2.9.0: إثبات التضرر من الحرائق + مجموعات جلساتي ─── */
    fireTitle: "Êtes-vous parmi les victimes des incendies en Algérie ?",
    fireDesc: "Les séances sont gratuites exclusivement pour les sinistrés des incendies. Si vous en faites partie, remplissez ce qui suit pour que l'administration vérifie votre compte — la réservation s'ouvre dès la validation",
    fireYes: "Oui, je suis sinistré des incendies",
    fireNo: "Non — j'utilise la plateforme pour un soutien général",
    fireCommune: "Commune ou région où l'incendie a eu lieu",
    fireCommunePlaceholder: "Exemple : commune de Bab El Oued — Alger",
    fireDate: "Date de l'incendie (approximative)",
    fireDatePlaceholder: "Exemple : été 2026 ou 2026/08",
    fireDescLabel: "Décrivez brièvement ce qui vous est arrivé",
    fireDescPlaceholder: "Qu'avez-vous perdu ou subi ? Deux lignes suffisent — l'administration les examine en toute confidentialité",
    fireNote: "Ces données de vérification ne sont vues que par l'administration et sont généralement examinées sous 24 heures. Une fausse déclaration vous exclut définitivement de la plateforme",
    fireRequired: "Veuillez compléter les informations d'attestation de sinistre incendie",
    firePendingBanner: "Votre compte attend la validation de l'administration — les réservations s'ouvriront dès l'approbation (généralement sous 24 heures)",
    fireRejectedBanner: "La validation de votre compte n'a pas été approuvée — si vous avez des précisions, écrivez-nous depuis la page des suggestions",
    myGroups: {
      open: "Salle ouverte maintenant",
      accepted: "Acceptées — prêtes à entrer",
      pending: "Nouvelles demandes en attente",
      upcoming: "Programmées plus tard",
      completed: "Terminées",
      cancelled: "Annulées",
    },
    groupOpenDesc: "Le professionnel vous attend dans la salle sécurisée — entrez maintenant",
    groupAcceptedDesc: "Votre demande a été acceptée — la salle s'ouvre au rendez-vous",
    groupPendingDesc: "Le professionnel n'a pas encore répondu — vous recevrez des notifications dès acceptation",
    groupUpcomingDesc: "Votre prochaine séance est planifiée — des rappels vous seront envoyés",
    bookLimitNote: "Rappel : une seule séance par jour et par victime",
"""
FR_COUNSELOR = """\n    /* ─── v2.9.0: صندوق المحادثات + فضاء الأخصائيين ─── */
    conversationsTitle: "Conversations (avant la séance)",
    conversationsEmpty: "Aucune conversation pour l'instant — quand une victime vous écrit, sa conversation apparaît ici directement",
    conversationsHint: "Répondez aux messages des victimes ici avant d'accepter leurs séances — toucher une conversation l'ouvre",
    unreadBadge: "{n} nouveau",
    groupChatTitle: "Espace des professionnels",
    groupChatDesc: "Conversation de groupe réservée aux professionnels — partage d'expérience et coordination",
    groupChatPlaceholder: "Écrivez votre message à vos collègues…",
    groupChatEmpty: "Aucun message pour l'instant — soyez le premier à ouvrir le dialogue entre collègues",
    groupChatOpen: "Ouvrir l'espace",
    genderPrefTitle: "Sexe des victimes que j'accepte de prendre en charge",
    genderPrefHint: "Seules les victimes du sexe choisi apparaîtront dans vos demandes de réservation — modifiable à tout moment",
"""
FR_ADMIN = """\n    /* ─── v2.9.0: لوحة القيادة + توثيق المتضررين ─── */
    tabDashboard: "Tableau de bord",
    tabVictimVerify: "Vérification des victimes",
    dashVictims: "victimes inscrites",
    dashCounselors: "professionnels",
    dashPendingCounselors: "en attente de vérification",
    dashSuspended: "comptes suspendus",
    dashTotalSessions: "total des séances",
    dashToday: "séances aujourd'hui",
    dashWeek: "séances des 7 derniers jours",
    dashPending: "demandes en attente",
    dashAccepted: "acceptées",
    dashActive: "en cours",
    dashCompleted: "terminées",
    dashCancelled: "annulées",
    dashCrisis: "situations de crise détectées",
    dashFeedback: "signalements non traités",
    dashMessages: "messages enregistrés",
    dashFirePending: "demande de vérification de victime en attente",
    dashDaily: "Séances des 14 derniers jours",
    dashTopCounselors: "Professionnels les plus sollicités",
    dashWilayas: "Wilayas les plus actives",
    dashGender: "Répartition des victimes par sexe",
    dashWinners: "Gagnants des défis",
    dashVictimWinner: "Défi d'assiduité (victime)",
    dashCounselorWinner: "Défi interne (professionnel)",
    dashNoWinner: "Pas encore de gagnant",
    dashRefresh: "Actualiser les statistiques",
    dashMale: "Hommes",
    dashFemale: "Femmes",
    dashUnknown: "Non spécifié",
    genderAllLabel: "Tous (hommes + femmes)",
    vvTitle: "Demandes de vérification des victimes des incendies",
    vvDesc: "Examinez les attestations et approuvez ou refusez — l'approbation ouvre la réservation, le refus la bloque avec une notification automatique",
    vvEmpty: "Aucune demande de vérification en attente ✅",
    vvCommune: "Commune / région",
    vvDate: "Date de l'incendie",
    vvDescLabel: "Description de la victime",
    vvApprove: "Approuver et vérifier",
    vvReject: "Refuser",
    vvApprovedOk: "Vérification effectuée — réservation ouverte pour la victime et notification envoyée",
    vvRejectedOk: "Refus effectué et notification envoyée à la victime",
    vvContact: "Contact",
    vvReviewedBadge: "Examiné",
    genderBadgeMale: "Homme",
    genderBadgeFemale: "Femme",
"""

FR_T = {
    "b_openBtn": "Exercice de respiration apaisante",
    "b_title": "Exercice de respiration 4-4-6",
    "b_subtitle": "Un exercice de respiration guidé efficace pour calmer le système nerveux — suivez le cercle et respirez avec lui",
    "b_in": "Inspirez par le nez",
    "b_hold": "Retenez votre souffle",
    "b_out": "Expirez lentement par la bouche",
    "b_cycle": "Cycle {n} sur {total}",
    "b_start": "Commencer l'exercice",
    "b_stop": "Arrêter",
    "b_done": "Bravo ! Votre cœur bat plus doucement et vos nerfs se sont apaisés 🌿",
    "b_again": "Répéter l'exercice",
    "b_hint": "Installez-vous confortablement, détendez vos épaules et laissez le cercle guider votre respiration. L'exercice est disponible chaque fois que vous vous sentez stressé",
    "b_sec": "s",
    "d_title": "Une prière du cœur",
    "d_sub": "Si la plateforme vous a plu ou aidé — votre récompense est de prier pour ceux qui l'ont faite et pour ceux qu'ils aiment",
    "d_intro": "Je demande à quiconque a aimé cette page ou en a bénéficié de prier :",
    "d_items": [
        "pour ma mère bien-aimée et chérie, pour sa guérison immédiate",
        "que Dieu soulage l'angoisse de mon frère Rafiq, et qu'Il soit son secours et son compagnon dans sa solitude",
        "que Dieu protège mon père et tous nos parents",
        "que Dieu fasse miséricorde à tous les défunts musulmans",
        "que Dieu guérisse tout malade",
        "que Dieu ramène chaque absent et chaque expatrié chez lui sain et sauf",
        "que Dieu accomplisse le besoin de chaque solliciteur et apporte le souci de chaque affligé",
        "que Dieu accorde à chaque privé une bonne descendance",
        "que Dieu donne à chaque nécessiteux ce qu'Il agrée pour lui",
    ],
    "d_amen": "Amine 🤲",
    "d_note": "Touchez « Amine » pour avoir la même récompense que celui qui prie",
    "d_done": "Que Dieu vous récompense — vous êtes devenu partenaire de cette prière",
    "d_count": "{n} personnes ont dit Amine",
}

EN_SESSION = """\n    waPanelHint: "Use the WhatsApp button at the top of the room to open the chat",\n"""
EN_VICTIM = """\n    /* ─── v2.9.0: fire-victim verification + my-sessions groups ─── */
    fireTitle: "Are you among the victims of the Algeria wildfires?",
    fireDesc: "Sessions are free exclusively for wildfire victims. If you are one of them, fill in the following so the administration can verify your account — booking opens right after approval",
    fireYes: "Yes, I am a wildfire victim",
    fireNo: "No — I use the platform for general support",
    fireCommune: "Commune or area where the fire occurred",
    fireCommunePlaceholder: "Example: Bab El Oued commune — Algiers",
    fireDate: "Date of the fire (approximate)",
    fireDatePlaceholder: "Example: summer 2026 or 2026/08",
    fireDescLabel: "Briefly describe what happened to you",
    fireDescPlaceholder: "What did you lose or suffer? Two lines are enough — the administration reviews it in full confidentiality",
    fireNote: "Your verification data is seen only by the administration and is usually reviewed within 24 hours. A false declaration permanently bans you from the platform",
    fireRequired: "Please complete the wildfire-victim verification details",
    firePendingBanner: "Your account is awaiting administration approval — booking opens as soon as it is approved (usually within 24 hours)",
    fireRejectedBanner: "Your account verification was not approved — if you have clarifications, message us from the feedback page",
    myGroups: {
      open: "Room open now",
      accepted: "Accepted — ready to enter",
      pending: "New requests awaiting approval",
      upcoming: "Scheduled for later",
      completed: "Completed",
      cancelled: "Cancelled",
    },
    groupOpenDesc: "Your counselor is waiting in the safe room — join now",
    groupAcceptedDesc: "Your request was accepted — the room opens at the appointment time",
    groupPendingDesc: "The counselor has not replied yet — you will be notified as soon as it is accepted",
    groupUpcomingDesc: "Your next session is scheduled — reminders will be sent before the appointment",
    bookLimitNote: "Reminder: only one session per day for each victim",
"""
EN_COUNSELOR = """\n    /* ─── v2.9.0: DM inbox + counselors space ─── */
    conversationsTitle: "Conversations (before the session)",
    conversationsEmpty: "No conversations yet — when a victim messages you, their conversation appears here directly",
    conversationsHint: "Reply to victims' messages here before accepting their sessions — tapping a conversation opens it",
    unreadBadge: "{n} new",
    groupChatTitle: "Counselors' space",
    groupChatDesc: "A group chat reserved for professionals only — share experience and coordinate",
    groupChatPlaceholder: "Write your message to your fellow counselors…",
    groupChatEmpty: "No messages yet — be the first to open the dialogue among colleagues",
    groupChatOpen: "Open the space",
    genderPrefTitle: "Gender of victims I accept to work with",
    genderPrefHint: "Only victims of the chosen gender will appear in your booking requests — you can change it anytime",
"""
EN_ADMIN = """\n    /* ─── v2.9.0: dashboard + victim verification ─── */
    tabDashboard: "Dashboard",
    tabVictimVerify: "Victim verification",
    dashVictims: "registered victims",
    dashCounselors: "counselors",
    dashPendingCounselors: "awaiting verification",
    dashSuspended: "suspended accounts",
    dashTotalSessions: "total sessions",
    dashToday: "sessions today",
    dashWeek: "sessions last 7 days",
    dashPending: "pending requests",
    dashAccepted: "accepted",
    dashActive: "active now",
    dashCompleted: "completed",
    dashCancelled: "cancelled",
    dashCrisis: "crisis events detected",
    dashFeedback: "unhandled reports",
    dashMessages: "stored messages",
    dashFirePending: "victim verification request awaiting review",
    dashDaily: "Sessions over the last 14 days",
    dashTopCounselors: "Most engaged counselors",
    dashWilayas: "Most active wilayas",
    dashGender: "Victims by gender",
    dashWinners: "Challenge winners",
    dashVictimWinner: "Commitment challenge (victim)",
    dashCounselorWinner: "Internal challenge (counselor)",
    dashNoWinner: "No winner yet",
    dashRefresh: "Refresh statistics",
    dashMale: "Male",
    dashFemale: "Female",
    dashUnknown: "Unspecified",
    genderAllLabel: "Everyone (male + female)",
    vvTitle: "Wildfire-victim verification requests",
    vvDesc: "Review the attestations and approve or reject — approval opens booking, rejection blocks it with an automatic notification",
    vvEmpty: "No verification requests awaiting review ✅",
    vvCommune: "Commune / area",
    vvDate: "Date of the fire",
    vvDescLabel: "Victim's description",
    vvApprove: "Approve & verify",
    vvReject: "Reject",
    vvApprovedOk: "Verified — booking opened for the victim and a notification was sent",
    vvRejectedOk: "Rejected and the victim was notified",
    vvContact: "Contact",
    vvReviewedBadge: "Reviewed",
    genderBadgeMale: "Male",
    genderBadgeFemale: "Female",
"""

EN_T = {
    "b_openBtn": "Calming breathing exercise",
    "b_title": "4-4-6 Breathing exercise",
    "b_subtitle": "An effective guided breathing exercise to calm your nervous system — follow the circle and breathe with it",
    "b_in": "Breathe in through your nose",
    "b_hold": "Hold your breath",
    "b_out": "Breathe out slowly through your mouth",
    "b_cycle": "Cycle {n} of {total}",
    "b_start": "Start the exercise",
    "b_stop": "Stop",
    "b_done": "Well done! Your heartbeat is slower and your nerves are calmer 🌿",
    "b_again": "Repeat the exercise",
    "b_hint": "Sit comfortably, relax your shoulders, and let the circle guide your breathing. The exercise is available whenever you feel stressed",
    "b_sec": "s",
    "d_title": "A prayer from the heart",
    "d_sub": "If you liked this platform or benefited from it — your reward is to pray for those who built it and those they love",
    "d_intro": "I ask everyone who liked this page or benefited from it to pray:",
    "d_items": [
        "for my beloved, dear mother — for her swift healing",
        "that God relieves my brother Rafiq's distress, and be his aid and companion in his solitude",
        "that God protects my father and all our parents",
        "that God have mercy on all deceased Muslims",
        "that God heal every sick person",
        "that God return every absent and every expatriate to their family safe and sound",
        "that God fulfill the need of every requester and relieve the worry of every distressed person",
        "that God grant every deprived person righteous offspring",
        "that God provide every needy person with what God is pleased to give them",
    ],
    "d_amen": "Ameen 🤲",
    "d_note": "Tap «Ameen» to share the reward with the one who prays",
    "d_done": "May God reward you — you are now a partner in this prayer",
    "d_count": "{n} people said Ameen",
}

def patch(path, session_blk, victim_blk, counselor_blk, admin_blk, t):
    src = io.open(path, encoding="utf-8").read()
    src = insert_after(src, 'waMissingNumber: "Le numéro WhatsApp de ce professionnel n\'est pas encore configuré — contactez l\'administration",' if "fr" in path else 'waMissingNumber: "This counselor\'s WhatsApp number is not set yet — please contact administration",', session_blk)
    anchor_v = 'phoneInvalid: "Numéro de téléphone invalide — saisissez-le comme 0555123456",' if "fr" in path else 'phoneInvalid: "Invalid phone number — enter it like 0555123456",'
    src = insert_after(src, anchor_v, victim_blk)
    anchor_c = 'suspendedLogin: "Votre compte est suspendu par l\'administration — contactez l\'équipe de la plateforme pour le réactiver",' if "fr" in path else 'suspendedLogin: "Your account has been suspended by the administration — contact the platform team to reactivate it",'
    src = insert_after(src, anchor_c, counselor_blk)
    anchor_a = 'challengeWinnerProfile: "Voir le profil public",' if "fr" in path else 'challengeWinnerProfile: "View public profile",'
    src = insert_after(src, anchor_a, admin_blk)
    # breathing + dua before closing "};"  — append after founders block end
    src = insert_after(src, "  },\n\n};", dua_block(t["d_items"], t)[:-0] if False else dua_block(t["d_items"], t).join(["", ""]) )  # placeholder replaced below
    return src

def patch2(path, session_blk, victim_blk, counselor_blk, admin_blk, t):
    src = io.open(path, encoding="utf-8").read()
    is_fr = "fr" in path
    src = insert_after(src, 'waMissingNumber: "Le numéro WhatsApp de ce professionnel n\'est pas encore configuré — contactez l\'administration",' if is_fr else 'waMissingNumber: "This counselor\'s WhatsApp number is not set yet — please contact administration",', session_blk)
    anchor_v = 'phoneInvalid: "Numéro de téléphone invalide — saisissez-le comme 0555123456",' if is_fr else 'phoneInvalid: "Invalid phone number — enter it like 0555123456",'
    src = insert_after(src, anchor_v, victim_blk)
    anchor_c = 'suspendedLogin: "Votre compte est suspendu par l\'administration — contactez l\'équipe de la plateforme pour le réactiver",' if is_fr else 'suspendedLogin: "Your account has been suspended by the administration — contact the platform team to reactivate it",'
    src = insert_after(src, anchor_c, counselor_blk)
    anchor_a = 'challengeWinnerProfile: "Voir le profil public",' if is_fr else 'challengeWinnerProfile: "View public profile",'
    src = insert_after(src, anchor_a, admin_blk)
    dua = dua_block(t["d_items"], t)
    # insert before the final "};"
    idx = src.rfind("\n};")
    src = src[:idx] + "\n" + dua + src[idx:]
    io.open(path, "w", encoding="utf-8").write(src)
    print("patched", path)

patch2("src/lib/i18n/fr.ts", FR_SESSION, FR_VICTIM, FR_COUNSELOR, FR_ADMIN, FR_T)
patch2("src/lib/i18n/en.ts", EN_SESSION, EN_VICTIM, EN_COUNSELOR, EN_ADMIN, EN_T)
