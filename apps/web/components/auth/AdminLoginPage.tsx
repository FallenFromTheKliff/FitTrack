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
    heroTitle: "Ready to start the clock?",
    subtitle:
      "Welcome back, FitTrack team. Admins, staff, and coaches can jump into the tools that keep SertFit moving.",
    showBadge: true,
  },
  member: {
    badge: "",
    cardSubtitle: "Welcome to FitTrack!",
    emailPlaceholder: "member@fittrack.com",
    heroTitle: "Ready? Let's get started!",
    subtitle: "Welcome to FitTrack!",
    showBadge: false,
  },
} as const;

type LoginPortalVariant = keyof typeof PAGE_COPY;

const LOGIN_SLASH_IMAGES = [
  LOGIN_BACKGROUND_IMAGE_URL,
  "url(https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80)",
  "url(https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=1200&q=80)",
  "url(https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=1200&q=80)",
  "url(https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=1200&q=80)",
] as const;

const MEMBER_LOGIN_SLASH_IMAGES = [
  "url(https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=1400&q=80)",
  "url(https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=1400&q=80)",
] as const;

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

function LoginSlashBackground({ variant }: { variant: LoginPortalVariant }) {
  const orderedImages = variant === "team"
    ? LOGIN_SLASH_IMAGES
    : MEMBER_LOGIN_SLASH_IMAGES;
  const isMember = variant === "member";

  return (
    <div
      aria-hidden="true"
      className="login-slash-background"
      style={{
        display: "grid",
        gridTemplateColumns: isMember
          ? "repeat(2, minmax(260px, 1fr))"
          : "repeat(5, minmax(160px, 1fr))",
        inset: 0,
        overflow: "hidden",
        position: "fixed",
        zIndex: 0,
      }}
    >
      {orderedImages.map((image, index) => (
        <span
          key={`${variant}-${index}`}
          style={{
            backgroundColor: "rgba(255,255,255,0.05)",
            backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.14), rgba(0,0,0,0.76)), ${image}`,
            backgroundPosition: "center",
            backgroundSize: "cover",
            clipPath: isMember
              ? index === 0
                ? "polygon(0 0, 100% 0, 84% 100%, 0 100%)"
                : "polygon(16% 0, 100% 0, 100% 100%, 0 100%)"
              : index % 2 === 0
                ? "polygon(18% 0, 100% 0, 82% 100%, 0 100%)"
                : "polygon(0 0, 100% 0, 100% 100%, 18% 100%)",
            filter: "saturate(0.85) contrast(1.08)",
            marginLeft: index === 0 ? 0 : isMember ? "-10vw" : "-7vw",
            minHeight: "100vh",
            opacity: variant === "team" ? 0.78 : 0.7,
            width: index === 0 ? "100%" : isMember ? "calc(100% + 10vw)" : "calc(100% + 7vw)",
          }}
        />
      ))}
    </div>
  );
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
      <div style={styles.bgOverlay} />
      <LoginSlashBackground variant={variant} />
      <div className={`login-content login-portal-${variant}`} style={styles.content}>
        <div className="hero-panel" style={styles.heroPanel}>
          <div
            className="hero-panel-inner"
            style={{
              ...styles.heroPanelInner,
              maxWidth: variant === "team" ? 680 : styles.heroPanelInner.maxWidth,
            }}
          >
            <FitText as="h1" style={styles.heroTitle}>
              {copy.heroTitle}
            </FitText>
            <FitText as="p" style={styles.heroSubtitle}>
              {copy.subtitle}
            </FitText>
          </div>
        </div>

        <div className="login-card" style={styles.card}>
          <Link className="auth-back-link" href="/" style={styles.backLink}>
            &lt; Back to FitTrack
          </Link>
          <div style={styles.cardInner}>
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

              {copy.showBadge ? (
                <motion.span
                  animate={{ opacity: 1, y: 0 }}
                  initial={itemInitial}
                  style={styles.badge}
                  transition={itemTransition(2)}
                >
                  {copy.badge}
                </motion.span>
              ) : null}
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
        .auth-back-link {
          transition: color 160ms ease, text-shadow 160ms ease, filter 160ms ease;
        }

        .auth-back-link:hover,
        .auth-back-link:focus-visible {
          color: ${colors.brand} !important;
          filter: drop-shadow(0 0 10px ${colors.brand}66);
          outline: 0;
          text-shadow: 0 0 16px ${colors.brand}88;
        }

        .hero-panel {
          transition: opacity 240ms ease, flex-basis 240ms ease, padding 240ms ease;
        }

        @media (min-width: 900px) {
          .hero-panel {
            display: flex !important;
            align-items: center;
            justify-content: flex-start;
            padding-right: 0;
            padding-left: 0;
          }
        }

        @media (min-width: 900px) and (max-width: 1120px) {
          .hero-panel {
            flex: 0 1 44vw !important;
          }

          .hero-panel-inner {
            max-width: 540px !important;
          }
        }

        @media (max-width: 980px), (max-height: 560px) {
          .login-content {
            justify-content: center !important;
          }

          .hero-panel {
            flex: 0 0 0 !important;
            min-width: 0 !important;
            opacity: 0 !important;
            overflow: hidden !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            pointer-events: none !important;
          }

          .login-card {
            margin: 0 auto !important;
          }
        }

        @media (max-width: 899px) {
          .login-content {
            justify-content: center !important;
          }

          .login-card {
            margin: 0 auto !important;
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

        @media (max-width: 760px) {
          .login-slash-background {
            grid-auto-columns: minmax(150px, 48vw) !important;
            grid-auto-flow: column !important;
            grid-template-columns: none !important;
          }
        }
      `}</style>
    </div>
  );
}
