"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dumbbell, Mail, Lock, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

import { loginSchema } from "@fittrack/validators";
import type { LoginData } from "@fittrack/validators";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useLoadingText } from "@fittrack/hooks";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { useAuthEntrance } from "@/hooks/animations/useAuthEntrance";
import { authStyles } from "@/styles/authStyles";
import { FEEDBACK_DURATION_MS } from "@/constants/feedback";
import { sleep } from "@/utils/sleep";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitInputField from "@/components/fit/FitInputField";
import OTPModal from "@/components/modals/OTPModal";
import ForgotPasswordModal from "@/components/modals/ForgotPasswordModal";
import BufferPage from "@/components/loading/BufferPage";

export default function LoginPage() {
  const { login, commitLogin } = useAuth();
  const { colors, settings, onBrandTextColor } = useTheme();
  const router = useRouter();
  const s = authStyles(colors);
  const themeTransition = useThemeTransition();
  const shouldAnimate = settings.animationLevel !== "none";
  const { floating } = useAuthEntrance(shouldAnimate);
  const [loading, setLoading] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [showBuffer, setShowBuffer] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [mounted, setMounted] = useState(false);

  const signInLabel = useLoadingText("SIGNING IN", loading);
  const getDelay = (index: number) => index * 0.08;
  const itemInitial = shouldAnimate ? { opacity: 0, y: 16 } : false;
  const itemTransition = (index: number) => shouldAnimate
    ? { duration: 0.4, ease: "easeOut" as const, delay: getDelay(index) }
    : { duration: 0 };

  useEffect(() => { setMounted(true); }, []);

  const { control, handleSubmit, formState: { errors } } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
    reValidateMode: "onChange"
  });

  const onSubmit = async (data: LoginData) => {
    if (loading || locked) return;
    setLoading(true);
    setErrorMsg("");
    await sleep(FEEDBACK_DURATION_MS.standard);
    const result = await login(data.email, data.password);
    setLoading(false);
    if (!result.success) {
      const next = attempts + 1;
      setAttempts(next);
      if (next >= 5) { setLocked(true); router.replace("/locked"); return; }
      setErrorMsg(result.error ?? "Invalid email or password.");
      return;
    }
    setAttempts(0);
    if (result.otpRequired) {
      setShowOTP(true);
      return;
    }
    setShowBuffer(true);
  };

  if (!mounted) return null;
  if (showBuffer) {
    return (
      <BufferPage
        onCommit={commitLogin}
        onDone={() => {
          setShowBuffer(false);
          router.replace("/dashboard");
        }}
      />
    );
  }

  return (
    <div className={themeTransition} style={s.screen}>
      <div
        style={{
          ...s.bgOverlay,
          backgroundImage: "url(https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&q=80)"
        }}
      />
      <div style={s.content}>
        <div className="hero-panel" style={s.heroPanel}>
          <div style={s.heroPanelInner}>
            <FitText as="h1" style={s.heroTitle}>
              Welcome Back,
            </FitText>
            <FitText as="h1" style={s.heroTitleAccent}>
              ADMIN.
            </FitText>
            <FitText as="p" style={s.heroSubtitle}>
              Full gym management. Members, schedules, inventory, and more — all in one place.
            </FitText>
            <div style={s.heroStatsRow}>
              {["580 Members", "124 Sessions/day", "$48K Revenue"].map((stat) => (
                <div key={stat} style={s.heroStatItem}>
                  <FitText as="span" style={s.heroStatItem}>{stat}</FitText>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={s.card}>
          <div style={s.cardInner}>
            <div style={s.cardHeader}>
              <motion.div initial={itemInitial} animate={{ opacity: 1, y: 0 }} transition={itemTransition(0)} style={s.brandRowWrap}>
                <motion.div animate={floating.animate} transition={floating.transition} style={s.brandRow}>
                  <span style={s.logoCircle}>
                    <Dumbbell size={26} color={onBrandTextColor} strokeWidth={2} />
                  </span>
                  <FitText as="h2" style={s.title}>FitTrack</FitText>
                </motion.div>
              </motion.div>
              <motion.div initial={itemInitial} animate={{ opacity: 1, y: 0 }} transition={itemTransition(1)}>
                <FitText as="p" style={s.subtitle}>Gym Management System</FitText>
              </motion.div>
              <motion.span initial={itemInitial} animate={{ opacity: 1, y: 0 }} transition={itemTransition(2)} style={s.badge}>Admin Access Portal</motion.span>
            </div>
            <div style={s.fields}>
              <motion.div initial={itemInitial} animate={{ opacity: 1, y: 0 }} transition={itemTransition(3)} style={s.fieldItem}>
                <FitInputField
                  control={control}
                  name="email"
                  label="Email Address"
                  placeholder="admin@fittrack.com"
                  errors={errors}
                  icon={Mail}
                  type="email"
                  autoComplete="email"
                  inputRowStyle={s.loginInputRow}
                  disabled={loading || locked}
                />
              </motion.div>
              <motion.div initial={itemInitial} animate={{ opacity: 1, y: 0 }} transition={itemTransition(4)} style={s.fieldItem}>
                <FitInputField
                  control={control}
                  name="password"
                  label="Password"
                  placeholder="••••••••"
                  errors={errors}
                  icon={Lock}
                  type="password"
                  autoComplete="current-password"
                  inputRowStyle={s.loginInputRow}
                  disabled={loading || locked}
                />
              </motion.div>
              <motion.div initial={itemInitial} animate={{ opacity: 1, y: 0 }} transition={itemTransition(5)} style={s.forgotRow}>
                <FitButton
                  variant="link"
                  style={s.forgotBtn}
                  onClick={() => setForgotOpen(true)}
                >
                  <FitText as="span" style={s.forgotBtn}>Forgot Password?</FitText>
                </FitButton>
              </motion.div>
            </div>
            {errorMsg && (
              <div style={s.errorBanner}>
                <div style={s.errorRow}>
                  <AlertCircle size={13} color={colors.danger} />
                  <FitText style={s.errorText}>{errorMsg}</FitText>
                </div>
                {attempts > 0 && attempts < 5 && (
                  <FitText style={s.errorMeta}>Attempt {attempts} of 5</FitText>
                )}
              </div>
            )}
            <motion.div initial={itemInitial} animate={{ opacity: 1, y: 0 }} transition={itemTransition(6)} style={s.signInWrap}>
              <FitButton
                label={loading ? signInLabel : "SIGN IN"}
                variant="primary"
                fullWidth
                loading={loading}
                disabled={locked}
                style={s.loginPrimaryBtn}
                onClick={handleSubmit(onSubmit)}
              />
            </motion.div>
            <motion.div initial={itemInitial} animate={{ opacity: 1, y: 0 }} transition={itemTransition(7)}>
              <FitText as="p" style={s.copyright}>
                © 2026 FitTrack Gym. All rights reserved.
              </FitText>
            </motion.div>
          </div>
        </div>
      </div>
      <OTPModal
        isOpen={showOTP}
        onSuccess={() => {
          setShowOTP(false);
          setShowBuffer(true);
        }}
        onDismiss={() => {
          setShowOTP(false);
          setErrorMsg("Verification cancelled.");
        }}
      />
      <ForgotPasswordModal
        isOpen={forgotOpen}
        onClose={() => setForgotOpen(false)}
      />
      <style>{`
        @media (min-width: 900px) {
          .hero-panel {
            display: flex !important;
            align-items: center;
            justify-content: flex-start;
            padding-right: 0;
            padding-left: 0;
          }
        }
      `}</style>
    </div>
  );
}
