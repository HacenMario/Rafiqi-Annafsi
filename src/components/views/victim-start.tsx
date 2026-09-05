"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowLeft, ArrowRight, MapPin, UsersRound, LogIn, UserPlus, KeyRound, Phone } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApp } from "@/lib/store";
import { WILAYAS, WILAYA_LABELS, AGE_GROUPS, AGE_LABELS } from "@/lib/constants";
import type { AppLang } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BackButton } from "@/components/shared/back-button";

type Mode = "register" | "login" | "forgot";

export function VictimStartView() {
  const { t, lang, setLang } = useI18n();
  const { setView, setUser, victimDraft } = useApp();
  const [mode, setMode] = useState<Mode>("register");
  /* الاسم المستعار حر — يكتبه المستخدم بنفسه بأي نص يشاء */
  const [pseudonym, setPseudonym] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [wilaya, setWilaya] = useState<string>(victimDraft.wilaya || "");
  const [ageGroup, setAgeGroup] = useState<string>(victimDraft.ageGroup || "");
  /* الجنس — ذكر أو أنثى فقط، مطلوب عند إنشاء حساب جديد */
  const [gender, setGender] = useState<"male" | "female" | "">("");
  /* v2.7.0: رقم الهاتف — اختياري، لا يظهر إلا للأخصائي الذي يحجزه ليتواصل معه عبر واتساب */
  const [phone, setPhone] = useState<string>("");
  /* v2.9.0: إثبات التضرر من الحرائق — يراجعه الأدمين قبل فتح الحجز */
  const [fireVictim, setFireVictim] = useState<boolean | null>(null);
  const [fireCommune, setFireCommune] = useState("");
  const [fireDate, setFireDate] = useState("");
  const [fireDesc, setFireDesc] = useState("");
  const [prefLang, setPrefLang] = useState<string>(victimDraft.prefLang || lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const Arrow = lang === "ar" ? ArrowLeft : ArrowRight;

  const errorText = (code: string) => {
    switch (code) {
      case "PSEUDONYM_TAKEN":
        return t.victim.pseudonymTaken;
      case "PSEUDONYM_REQUIRED":
        return t.victim.pseudonymRequired;
      case "WEAK_PASSWORD":
        return t.victim.weakPassword;
      case "WEAK_RECOVERY":
        return t.victim.weakRecovery;
      case "INVALID":
        return t.victim.loginError;
      case "RECOVERY_INVALID":
        return t.victim.recoveryInvalid;
      case "INVALID_PHONE":
        /* v2.7.0: رقم هاتف غير صالح */
        return t.victim.phoneInvalid;
      case "VICTIM_UNVERIFIED":
        /* v2.9.0: بانتظار توثيق الإدارة */
        return t.victim.firePendingBanner;
      case "VICTIM_REJECTED":
        return t.victim.fireRejectedBanner;
      case "GENDER_NOT_ACCEPTED":
        return t.victim.counselorDayFull;
      case "SUSPENDED":
        /* v2.6.0: الحساب معطّل من الإدارة */
        return t.victim.accountSuspended;
      case "DB_UNAVAILABLE":
        return t.common.errorDb;
      case "SERVER_ERROR":
        return t.common.errorServer;
      default:
        return t.common.error;
    }
  };

  const call = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/victim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(errorText(data.error || ""));
        return null;
      }
      return data;
    } finally {
      setBusy(false);
    }
  };

  const afterAuth = (user: { id: string; pseudonym: string; wilaya?: string; ageGroup?: string; language?: string; gender?: string; phone?: string | null; fireStatus?: string }) => {
    setUser({
      id: user.id,
      role: "VICTIM",
      pseudonym: user.pseudonym,
      wilaya: user.wilaya,
      ageGroup: user.ageGroup,
      gender: user.gender === "male" || user.gender === "female" ? user.gender : null,
      phone: user.phone ?? null,
      fireStatus: (user.fireStatus === "PENDING" || user.fireStatus === "REJECTED" ? user.fireStatus : "VERIFIED") as "PENDING" | "REJECTED" | "VERIFIED",
      language: (["fr", "en", "tr", "ru", "zh"].includes(user.language || "") ? user.language : "ar") as AppLang,
    });
    setView("victim-topics");
  };

  const register = async () => {
    if (!gender) {
      setError(t.victim.genderRequired);
      return;
    }
    /* v2.9.0: إثبات التضرر من الحرائق — إلزامي لمن أعلن أنه من المتضررين */
    if (fireVictim && (!fireCommune.trim() || !fireDate.trim() || !fireDesc.trim())) {
      setError(t.victim.fireRequired);
      return;
    }
    const data = await call({
      action: "register",
      pseudonym,
      password,
      recoveryPhrase,
      language: prefLang,
      wilaya,
      ageGroup,
      gender,
      phone: phone.trim() || undefined,
      /* v2.9.0: بيانات إثبات التضرر من الحرائق */
      fireVictim: fireVictim === true || undefined,
      fireCommune: fireVictim === true ? fireCommune.trim() : undefined,
      fireDate: fireVictim === true ? fireDate.trim() : undefined,
      fireDesc: fireVictim === true ? fireDesc.trim() : undefined,
    });
    if (data) afterAuth(data.user);
  };

  const login = async () => {
    const data = await call({ action: "login", pseudonym, password });
    if (data) afterAuth(data.user);
  };

  const forgot = async () => {
    const data = await call({ action: "forgot", pseudonym, recoveryPhrase, newPassword });
    if (data) {
      setMode("login");
      setNotice(t.victim.passwordResetOk);
      setNewPassword("");
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 md:py-16">
      <BackButton />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-black">{t.victim.startTitle}</h1>
          <p className="text-muted-foreground leading-relaxed">{t.victim.startDesc}</p>
        </div>

        {/* تبويبات: حساب جديد / دخول */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { setMode("register"); setError(""); setNotice(""); }}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black transition-all ${
              mode !== "login" ? "gradient-primary text-white shadow" : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            <UserPlus className="h-4 w-4" />
            {t.victim.tabNewAccount}
          </button>
          <button
            onClick={() => { setMode("login"); setError(""); setNotice(""); }}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black transition-all ${
              mode === "login" ? "gradient-primary text-white shadow" : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            <LogIn className="h-4 w-4" />
            {t.victim.tabLogin}
          </button>
        </div>

        <Card className="border-primary/30 shadow-lg shadow-primary/5">
          <CardContent className="p-6 sm:p-8 space-y-6">
            {/* الاسم المستعار — نص حر يكتبه المستخدم بنفسه */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-muted-foreground">{t.victim.yourPseudonym}</label>
              <Input
                value={pseudonym}
                onChange={(e) => setPseudonym(e.target.value)}
                placeholder={t.victim.pseudonymPlaceholder}
                className="text-center text-lg font-black text-primary border-2 border-primary/30 bg-primary/5 rounded-xl h-12"
                dir="auto"
                maxLength={40}
              />
              {mode === "register" && (
                <p className="text-[11px] text-muted-foreground font-semibold">{t.victim.pseudonymUnique}</p>
              )}
            </div>

            {/* كلمة المرور */}
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <Label className="font-bold">{t.victim.passwordLabel} *</Label>
                <Input
                  type="password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-xl bg-card"
                  onKeyDown={(e) => e.key === "Enter" && (mode === "register" ? register() : login())}
                />
                {mode === "register" && (
                  <p className="text-[11px] text-muted-foreground font-semibold">{t.victim.passwordHint}</p>
                )}
              </div>
            )}

            {/* عبارة الاسترجاع — إلزامية عند إنشاء حساب جديد (تُطلب عند نسيان كلمة المرور) */}
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label className="font-bold">{t.victim.recoveryPhraseLabel} *</Label>
                <Input
                  value={recoveryPhrase}
                  onChange={(e) => setRecoveryPhrase(e.target.value)}
                  className="rounded-xl bg-card"
                  dir="auto"
                />
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-start gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {t.victim.recoveryExplain}
                </p>
              </div>
            )}

            {/* نسيان كلمة المرور: العبارة الاسترجاعية + كلمة مرور جديدة */}
            {mode === "forgot" && (
              <>
                <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 text-xs font-semibold text-muted-foreground leading-relaxed flex items-start gap-2">
                  <KeyRound className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  {t.victim.recoveryExplain}
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold">{t.victim.recoveryPhraseLabel} *</Label>
                  <Input
                    value={recoveryPhrase}
                    onChange={(e) => setRecoveryPhrase(e.target.value)}
                    className="rounded-xl bg-card"
                    dir="auto"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold">{t.victim.newPasswordLabel} *</Label>
                  <Input
                    type="password"
                    dir="ltr"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="rounded-xl bg-card"
                    onKeyDown={(e) => e.key === "Enter" && forgot()}
                  />
                </div>
              </>
            )}

            {/* معلومات اختيارية عند إنشاء حساب جديد */}
            {mode === "register" && (
              <div className="pt-1 space-y-3">
                <label className="text-sm font-bold text-muted-foreground">{t.victim.aboutYou}</label>
                {/* الجنس — ذكر أو أنثى فقط */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">{t.victim.genderLabel} *</span>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { v: "male" as const, label: t.victim.genderMale },
                      { v: "female" as const, label: t.victim.genderFemale },
                    ]).map((g) => (
                      <button
                        key={g.v}
                        type="button"
                        onClick={() => setGender(g.v)}
                        className={`rounded-xl border-2 py-2.5 text-sm font-bold transition-all ${
                          gender === g.v
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* v2.7.0: رقم الهاتف — اختياري، لا يظهر إلا للأخصائي الذي يحجزه ليتمكن من التواصل معه على واتساب */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {t.victim.phoneLabel} — {t.common.optional}
                  </span>
                  <Input
                    type="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0555123456"
                    className="rounded-xl bg-card font-mono"
                    maxLength={20}
                  />
                  <p className="text-[11px] text-muted-foreground font-semibold flex items-start gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                    {t.victim.phoneHint}
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {t.victim.wilayaLabel}
                    </span>
                    <Select value={wilaya} onValueChange={setWilaya} dir={lang === "ar" ? "rtl" : "ltr"}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {WILAYAS.map((w) => (
                          <SelectItem key={w} value={w}>
                            {WILAYA_LABELS[w]?.[lang] ?? w}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <UsersRound className="h-3.5 w-3.5" /> {t.victim.ageGroupLabel}
                    </span>
                    <Select value={ageGroup} onValueChange={setAgeGroup} dir={lang === "ar" ? "rtl" : "ltr"}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {AGE_GROUPS.map((a) => (
                          <SelectItem key={a} value={a}>
                            {AGE_LABELS[a]?.[lang] ?? a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* v2.9.0: إثبات التضرر من الحرائق — منعاً لاستغلال الجلسات المجانية */}
                <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <span className="text-xs font-black text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    🔥 {t.victim.fireTitle}
                  </span>
                  <p className="text-[11px] font-semibold text-muted-foreground leading-relaxed">{t.victim.fireDesc}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { v: true as const, label: t.victim.fireYes },
                      { v: false as const, label: t.victim.fireNo },
                    ].map((o) => (
                      <button
                        key={String(o.v)}
                        type="button"
                        onClick={() => setFireVictim(o.v)}
                        className={`rounded-xl border-2 py-2.5 px-2 text-xs font-bold transition-all ${
                          fireVictim === o.v
                            ? o.v ? "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-400" : "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {fireVictim === true && (
                    <div className="space-y-2.5 pt-1">
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-muted-foreground">{t.victim.fireCommune} *</span>
                        <Input value={fireCommune} onChange={(e) => setFireCommune(e.target.value)} placeholder={t.victim.fireCommunePlaceholder} className="rounded-xl bg-card text-sm" dir="auto" maxLength={120} />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-muted-foreground">{t.victim.fireDate} *</span>
                        <Input value={fireDate} onChange={(e) => setFireDate(e.target.value)} placeholder={t.victim.fireDatePlaceholder} className="rounded-xl bg-card text-sm" dir="auto" maxLength={30} />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-muted-foreground">{t.victim.fireDescLabel} *</span>
                        <Textarea value={fireDesc} onChange={(e) => setFireDesc(e.target.value)} placeholder={t.victim.fireDescPlaceholder} className="rounded-xl bg-card text-sm min-h-16" dir="auto" maxLength={800} />
                      </div>
                      <p className="text-[10px] font-bold text-muted-foreground leading-relaxed">🔒 {t.victim.fireNote}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">💬 {t.victim.langPrefLabel}</span>
                  <div className="flex gap-2 flex-wrap">
                    {(["ar", "fr", "en", "tr", "ru", "zh"] as const).map((l) => (
                      <Button
                        key={l}
                        type="button"
                        variant={prefLang === l ? "default" : "outline"}
                        size="sm"
                        className={`rounded-full font-bold ${prefLang === l ? "gradient-primary text-white" : ""}`}
                        onClick={() => setPrefLang(l)}
                      >
                        {l === "ar" ? "العربية" : l === "fr" ? "Français" : l === "en" ? "English" : l === "tr" ? "Türkçe" : l === "ru" ? "Русский" : "中文"}
                      </Button>
                    ))}
                  </div>
                </div>
                {prefLang !== lang && (
                  <Button variant="link" size="sm" className="p-0 h-auto text-primary" onClick={() => setLang(prefLang as never)}>
                    {t.settings.languageLabel} → {prefLang === "ar" ? "العربية" : prefLang === "fr" ? "Français" : prefLang === "en" ? "English" : prefLang === "tr" ? "Türkçe" : prefLang === "ru" ? "Русский" : "中文"}
                  </Button>
                )}
              </div>
            )}

            {error && <div className="rounded-xl bg-destructive/10 text-destructive text-sm font-bold px-4 py-3">{error}</div>}
            {notice && <div className="rounded-xl bg-primary/10 text-primary text-sm font-bold px-4 py-3">{notice}</div>}

            <Button
              size="lg"
              className="w-full gradient-primary text-white font-black text-base rounded-xl h-13"
              disabled={busy}
              onClick={mode === "register" ? register : mode === "login" ? login : forgot}
            >
              {busy ? t.common.loading : mode === "register" ? t.victim.startBtn : mode === "login" ? t.victim.tabLogin : t.victim.resetPasswordBtn}
              {mode !== "forgot" && <Arrow className="h-5 w-5" />}
            </Button>

            {mode !== "forgot" ? (
              <button
                className="w-full text-center text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
                onClick={() => { setMode("forgot"); setError(""); setNotice(""); }}
              >
                {t.victim.forgotPassword}
              </button>
            ) : (
              <button
                className="w-full text-center text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
                onClick={() => { setMode("login"); setError(""); setNotice(""); }}
              >
                {t.victim.backToLogin}
              </button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
