"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AlertCircle, Dumbbell, Lock, Mail } from "lucide-react";
import { motion } from "framer-motion";

import { useLoadingText } from "@fittrack/hooks";
import type { Role } from "@fittrack/types";
import { loginSchema, type LoginData } from "@fittrack/validators";

import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import FitInputField from "@/components/fit/FitInputField";
import { ForgotPasswordModal, OTPModal } from "@/components/modals";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { LOGIN_BACKGROUND_IMAGE_URL } from "@/data/auth/auth";
import { useAuthEntrance } from "@/hooks/animations/useAuthEntrance";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { getWebPortalFallbackPath } from "@/lib/portal-access";
import { authStyles } from "@/styles/authStyles";

const PAGE_COPY = {
  team: {
    badge: "Team Portal",
    cardSubtitle: "Gym Team Portal",
    emailPlaceholder: "team@fittrack.com",
    heroAccent: "FITTRACK.",
    subtitle:
      "Sign in with your FitTrack team account for admin, staff, or coach tools.",
  },
  member: {
    badge: "Member Portal",
    cardSubtitle: "Member Web Portal",
    emailPlaceholder: "member@fittrack.com",
    heroAccent: "MEMBER ACCESS.",
    subtitle:
      "Sign in to view your bookings, facility map, workouts, and profile from the web.",
  },
} as const;

type LoginPortalVariant = keyof typeof PAGE_COPY;

function getPortalLandingPath(role?: Role) {
  return getWebPortalFallbackPath(role);
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

export function AdminLoginPage({
  variant = "team",
}: {
  variant?: LoginPortalVariant;
}) {
  const { commitLogin, login } = useAuth();
  const { colors, onBrandTextColor, settings } = useTheme();
  const router = useRouter();
  const styles = authStyles(colors);
  const themeTransition = useThemeTransition();
  const shouldAnimate = settings.animationLevel !== "none";
  const { floating } = useAuthEntrance(shouldAnimate);
  const copy = PAGE_COPY[variant];

  const [errorMsg, setErrorMsg] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
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

    const result = await login(data.email.trim(), data.password, {
      portal: variant,
    });

    if (!result.success) {
      setLoading(false);
      if (result.reason === "ACCOUNT_LOCKED") {
        router.replace("/locked");
        return;
      }

      setErrorMsg(result.error ?? "Invalid credentials.");
      return;
    }

    if (result.otpRequired) {
      setLoading(false);
      setShowOTP(true);
      return;
    }

    const committedUser = await commitLogin();
    if (!committedUser) {
      setLoading(false);
      setErrorMsg("Unable to prepare your authenticated portal. Please sign in again.");
      return;
    }

    router.replace(getPortalLandingPath(committedUser.role ?? result.user?.role));
  };

  if (!mounted) {
    return null;
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
              {copy.heroAccent}
            </FitText>
            <FitText as="p" style={styles.heroSubtitle}>
              {copy.subtitle}
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
                  {copy.cardSubtitle}
                </FitText>
              </motion.div>

              <motion.span
                animate={{ opacity: 1, y: 0 }}
                initial={itemInitial}
                style={styles.badge}
                transition={itemTransition(2)}
              >
                {copy.badge}
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
                  placeholder={copy.emailPlaceholder}
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
        onSuccess={async () => {
          setShowOTP(false);
          setLoading(true);
          const committedUser = await commitLogin();
          if (!committedUser) {
            setLoading(false);
            setErrorMsg("Unable to prepare your authenticated portal. Please sign in again.");
            return;
          }
          router.replace(getPortalLandingPath(committedUser.role));
        }}
      />

      <ForgotPasswordModal
        isOpen={forgotOpen}
        onClose={() => setForgotOpen(false)}
        portal={variant}
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
