"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AlertCircle, Dumbbell, Lock, Mail } from "lucide-react";
import { motion } from "framer-motion";

import { useLoadingText } from "@fittrack/hooks";
import { loginSchema, type LoginData } from "@fittrack/validators";

import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import FitInputField from "@/components/fit/FitInputField";
import BufferPage from "@/components/loading/BufferPage";
import { ForgotPasswordModal, OTPModal } from "@/components/modals";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { LOGIN_BACKGROUND_IMAGE_URL } from "@/data/auth/auth";
import { useAuthEntrance } from "@/hooks/animations/useAuthEntrance";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { authStyles } from "@/styles/authStyles";

const PAGE_COPY = {
  badge: "FitTrack Portal",
  heroAccent: "FITTRACK.",
  subtitle:
    "Sign in with your FitTrack account for the portal experience assigned to your role.",
  emailPlaceholder: "account@fittrack.com",
};

function getPortalLandingPath(role?: string) {
  if (role === "ADMIN") return "/analytics";
  if (role === "STAFF") return "/members";
  if (role === "USER" || role === "COACH") return "/profile";
  return "/profile";
}

function getLoginItemTransition(shouldAnimate: boolean, index: number) {
  if (!shouldAnimate) {
    return { duration: 0 };
  }

  return {
    delay: index * 0.08,
    duration: 0.4,
    ease: "easeOut" as const,
  };
}

export function AdminLoginPage() {
  const { commitLogin, login } = useAuth();
  const { colors, onBrandTextColor, settings } = useTheme();
  const router = useRouter();
  const styles = authStyles(colors);
  const themeTransition = useThemeTransition();
  const shouldAnimate = settings.animationLevel !== "none";
  const { floating } = useAuthEntrance(shouldAnimate);

  const [errorMsg, setErrorMsg] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [landingPath, setLandingPath] = useState("/analytics");
  const [mounted, setMounted] = useState(false);
  const [showBuffer, setShowBuffer] = useState(false);
  const [showOTP, setShowOTP] = useState(false);

  const signInLabel = useLoadingText("SIGNING IN", loading);
  const itemInitial = shouldAnimate ? { opacity: 0, y: 16 } : false;
  const itemTransition = (index: number) =>
    getLoginItemTransition(shouldAnimate, index);

  const {
    control,
    formState: { errors },
    handleSubmit,
  } = useForm<LoginData>({
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const onSubmit = async (data: LoginData) => {
    if (loading) {
      return;
    }

    setLoading(true);
    setErrorMsg("");

    const result = await login(data.email, data.password);
    setLoading(false);

    if (!result.success) {
      if (result.reason === "ACCOUNT_LOCKED") {
        router.replace("/locked");
        return;
      }

      setErrorMsg(result.error ?? "Invalid email or password.");
      return;
    }

    if (result.otpRequired) {
      setShowOTP(true);
      return;
    }

    setLandingPath(getPortalLandingPath(result.user?.role));
    setShowBuffer(true);
  };

  if (!mounted) {
    return null;
  }

  if (showBuffer) {
    return (
      <BufferPage
        onCommit={commitLogin}
        onDone={() => {
          setShowBuffer(false);
          router.replace(landingPath);
        }}
      />
    );
  }

  return (
    <div className={themeTransition} style={styles.screen}>
      <div
        style={{
          ...styles.bgOverlay,
          backgroundImage: LOGIN_BACKGROUND_IMAGE_URL,
        }}
      />
      <div style={styles.content}>
        <div className="hero-panel" style={styles.heroPanel}>
          <div style={styles.heroPanelInner}>
            <FitText as="h1" style={styles.heroTitle}>
              Welcome Back,
            </FitText>
            <FitText as="h1" style={styles.heroTitleAccent}>
              {PAGE_COPY.heroAccent}
            </FitText>
            <FitText as="p" style={styles.heroSubtitle}>
              {PAGE_COPY.subtitle}
            </FitText>
          </div>
        </div>

        <div className="login-card" style={styles.card}>
          <div style={styles.cardInner}>
            <Link
              href="/"
              style={{
                alignSelf: "flex-start",
                color: colors.textMuted,
                fontSize: 13,
                fontWeight: 800,
                marginBottom: 18,
                textDecoration: "none",
              }}
            >
              Back to FitTrack
            </Link>
            <div style={styles.cardHeader}>
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                initial={itemInitial}
                style={styles.brandRowWrap}
                transition={itemTransition(0)}
              >
                <motion.div
                  animate={floating.animate}
                  style={styles.brandRow}
                  transition={floating.transition}
                >
                  <span style={styles.logoCircle}>
                    <Dumbbell
                      color={onBrandTextColor}
                      size={26}
                      strokeWidth={2}
                    />
                  </span>
                  <FitText as="h2" style={styles.title}>
                    FitTrack
                  </FitText>
                </motion.div>
              </motion.div>

              <motion.div
                animate={{ opacity: 1, y: 0 }}
                initial={itemInitial}
                transition={itemTransition(1)}
              >
                <FitText as="p" style={styles.subtitle}>
                  Gym Access Portal
                </FitText>
              </motion.div>

              <motion.span
                animate={{ opacity: 1, y: 0 }}
                initial={itemInitial}
                style={styles.badge}
                transition={itemTransition(2)}
              >
                {PAGE_COPY.badge}
              </motion.span>
            </div>

            <div style={styles.fields}>
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                initial={itemInitial}
                style={styles.fieldItem}
                transition={itemTransition(3)}
              >
                <FitInputField
                  autoComplete="email"
                  control={control}
                  disabled={loading}
                  errors={errors}
                  icon={Mail}
                  inputRowStyle={styles.loginInputRow}
                  label="Email Address"
                  name="email"
                  placeholder={PAGE_COPY.emailPlaceholder}
                  type="email"
                />
              </motion.div>

              <motion.div
                animate={{ opacity: 1, y: 0 }}
                initial={itemInitial}
                style={styles.fieldItem}
                transition={itemTransition(4)}
              >
                <FitInputField
                  autoComplete="current-password"
                  control={control}
                  disabled={loading}
                  errors={errors}
                  icon={Lock}
                  inputRowStyle={styles.loginInputRow}
                  label="Password"
                  name="password"
                  placeholder="********"
                  type="password"
                />
              </motion.div>

              <motion.div
                animate={{ opacity: 1, y: 0 }}
                initial={itemInitial}
                style={styles.forgotRow}
                transition={itemTransition(5)}
              >
                <FitButton
                  onClick={() => setForgotOpen(true)}
                  style={styles.forgotBtn}
                  variant="link"
                >
                  <FitText as="span" style={styles.forgotBtn}>
                    Forgot Password?
                  </FitText>
                </FitButton>
              </motion.div>
            </div>

            {errorMsg ? (
              <div style={styles.errorBanner}>
                <div style={styles.errorRow}>
                  <AlertCircle color={colors.danger} size={13} />
                  <FitText style={styles.errorText}>{errorMsg}</FitText>
                </div>
              </div>
            ) : null}

            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={itemInitial}
              style={styles.signInWrap}
              transition={itemTransition(6)}
            >
              <FitButton
                fullWidth
                label={loading ? signInLabel : "SIGN IN"}
                loading={loading}
                onClick={handleSubmit(onSubmit)}
                style={styles.loginPrimaryBtn}
                variant="primary"
              />
            </motion.div>

            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={itemInitial}
              transition={itemTransition(7)}
            >
              <FitText as="p" style={styles.copyright}>
                (c) 2026 FitTrack Gym. All rights reserved.
              </FitText>
            </motion.div>
          </div>
        </div>
      </div>

      <OTPModal
        isOpen={showOTP}
        onDismiss={() => {
          setShowOTP(false);
          setErrorMsg("Verification cancelled.");
        }}
        onSuccess={() => {
          setShowOTP(false);
          setShowBuffer(true);
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

        @media (min-width: 900px) and (max-aspect-ratio: 3/5) {
          .login-card {
            width: min(42vw, 420px) !important;
            min-width: 0 !important;
            padding: 40px 28px !important;
          }

          .hero-panel {
            padding-left: 32px !important;
            padding-right: 18px !important;
          }
        }
      `}</style>
    </div>
  );
}
