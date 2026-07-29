export const FITTRACK_LEGAL_VERSION = "2026-07-28";
export const FITTRACK_PAYMENT_POLICY_VERSION = "2026-07-28";

export type FitTrackLegalSection = {
  title: string;
  body: string;
};

export const FITTRACK_TERMS_SECTIONS: readonly FitTrackLegalSection[] = [
  {
    title: "Accounts and eligibility",
    body:
      "Use accurate registration details, keep your credentials private, and use only the role and account assigned to you. You are responsible for activity performed through your account unless you promptly report unauthorized access.",
  },
  {
    title: "Gym access, memberships, and bookings",
    body:
      "Membership access, coaching sessions, venue reservations, attendance, and schedules remain subject to SertFit Gym availability, operating rules, verification, and the status shown in FitTrack. Do not misuse QR access, reserve unavailable resources, or interfere with another member's session.",
  },
  {
    title: "Workout, nutrition, pose, and AI guidance",
    body:
      "FitTrack plans, nutrition estimates, pose tracking, rep counting, milestones, and AI suggestions are fitness-support tools. They do not replace medical advice, diagnosis, emergency care, or the judgment of a qualified coach. Stop training and seek appropriate help if pain, illness, or injury occurs.",
  },
  {
    title: "User plans and content",
    body:
      "You may create workout plans, custom exercises, logs, feedback, and other content needed by the service. Keep that content lawful and accurate. You retain ownership of your original content while granting SertFit Gym the limited permission needed to store, process, and display it for FitTrack services.",
  },
  {
    title: "Payments, cancellations, and refunds",
    body:
      "Prices, payment stage, amount due, and cancellation terms are shown before confirmation. A member-initiated cancellation, no-show, or change of mind after a slot is confirmed does not refund a downpayment or full payment. Refund, correction, replacement, or credit remains available when SertFit Gym cancels or cannot deliver the service, a charge is duplicate or unauthorized, the service is materially defective, a payment provider reverses it, or Philippine law requires a remedy.",
  },
  {
    title: "Acceptable use and intellectual property",
    body:
      "Do not probe, disrupt, copy, resell, scrape, reverse engineer, or misuse FitTrack, its protected content, branding, or another person's data. SertFit Gym and its licensors retain rights in the application, design, software, and service materials, excluding content that users own.",
  },
  {
    title: "Suspension and termination",
    body:
      "SertFit Gym may restrict or terminate access for fraud, unsafe conduct, non-payment, policy violations, abuse, security risk, or misuse of gym facilities. You may request account closure, subject to lawful retention of payment, attendance, safety, dispute, and accounting records.",
  },
  {
    title: "Service availability and responsibility",
    body:
      "FitTrack may be updated, interrupted, or temporarily unavailable. SertFit Gym will use reasonable care but does not promise uninterrupted operation or perfect AI and sensor outputs. Nothing in these terms excludes rights or remedies that cannot legally be excluded.",
  },
  {
    title: "Governing terms and contact",
    body:
      "These terms are governed by applicable Philippine law. Raise account, payment, privacy, or service concerns with SertFit Gym through the support channel in Settings so the gym can investigate and provide the appropriate remedy.",
  },
] as const;

export const FITTRACK_PRIVACY_SECTIONS: readonly FitTrackLegalSection[] = [
  {
    title: "Who handles your data",
    body:
      "SertFit Gym operates FitTrack and acts as the personal information controller for data collected through the gym service. Authorized staff and assigned coaches receive only the access needed for their responsibilities.",
  },
  {
    title: "Data we process",
    body:
      "FitTrack may process identity and contact details, verification status, membership and attendance, bookings and coaching, workout and pose records, nutrition logs, milestones, payments, support feedback, device and security logs, and optional inputs sent to AI features.",
  },
  {
    title: "Why we use it",
    body:
      "Data is used for account security, gym access, memberships, scheduling, coaching, workout and nutrition support, payments, notifications, service analytics, fraud or abuse detection, support, dispute handling, and legal or accounting obligations.",
  },
  {
    title: "Sharing and service providers",
    body:
      "Data may be shared with authorized SertFit personnel, your assigned coach within role limits, and providers used for hosting, databases, email, payments, and AI processing when necessary to deliver the service. FitTrack does not sell personal data.",
  },
  {
    title: "AI and automated assistance",
    body:
      "AI may summarize business signals, suggest workouts, or flag unusual activity. These outputs are advisory and may be reviewed by a member, coach, or administrator before action. Do not submit unrelated sensitive information to AI features.",
  },
  {
    title: "Retention and protection",
    body:
      "Records are retained only while needed for service delivery, security, accounting, legal obligations, or disputes. FitTrack uses role-based access and reasonable technical and organizational safeguards, but no online service can guarantee absolute security.",
  },
  {
    title: "Your privacy rights",
    body:
      "Under the Philippine Data Privacy Act, you may be informed, request access or correction, object, request erasure or blocking where applicable, request portability where applicable, seek damages, and file a complaint. Some records may remain when another lawful basis or retention duty applies.",
  },
  {
    title: "Requests and complaints",
    body:
      "Use the FitTrack support channel or contact SertFit Gym to exercise a privacy right. You may also contact the National Privacy Commission when you believe your data rights were not respected.",
  },
] as const;

export const FITTRACK_PAYMENT_POLICY_SUMMARY =
  "Member cancellations, no-shows, and change-of-mind after confirmation do not refund downpayments or full payments. Remedies remain available for gym cancellation or non-delivery, duplicate or unauthorized charges, materially defective service, provider reversal, or when required by Philippine law.";

export const FITTRACK_PAYMENT_ACCEPTANCE_LABEL =
  "ACCEPT POLICY & CONTINUE";
