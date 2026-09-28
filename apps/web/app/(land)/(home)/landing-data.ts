import boxingRing from "../../../image assets/boxingring1.png";
import premiumGym1 from "../../../image assets/premiumgym1.png";
import premiumGym2 from "../../../image assets/premiumgym2.png";
import premiumGym3 from "../../../image assets/premiumgym3.png";
import punchingBags from "../../../image assets/punchingbags.png";
import sertFitBoxing from "../../../image assets/sertfit_boxing1.png";
import sertFitCourt from "../../../image assets/sertfit_court1.png";
import sertFitLocker from "../../../image assets/sertfit_locker.png";
import sertFitYogaRoom from "../../../image assets/sertfit_yogaroom.png";

export const ASSETS = {
  hero: premiumGym1.src,
  strength: premiumGym2.src,
  boxing: punchingBags.src,
  mobility: sertFitYogaRoom.src,
  team: sertFitBoxing.src,
  spacesStrength: premiumGym3.src,
  spacesCourt: sertFitCourt.src,
  spacesRing: boxingRing.src,
  spacesYoga: sertFitYogaRoom.src,
  spacesRecovery: sertFitLocker.src,
} as const;

export const NAV_ITEMS = [
  { label: "Training", href: "#training" },
  { label: "Spaces", href: "#spaces" },
  { label: "Our Team", href: "#team" },
  { label: "Visit", href: "#visit" },
] as const;

export const OFFERINGS = [
  "Strength & conditioning",
  "Boxing & active training",
  "Mobility, yoga & recovery",
  "Court & room bookings",
] as const;

export const TRACKS = [
  {
    no: "01",
    title: "Strength & conditioning",
    body: "Racks, plates, and cables on an open strength floor. Build a base, add load with intent, and train with room to move — whether it’s your first working set or your heaviest.",
    points: ["Free weights & racks", "Cable & machine stations", "Programmed conditioning"],
    image: ASSETS.strength,
    alt: "A person lifting dumbbells during strength training.",
  },
  {
    no: "02",
    title: "Boxing & active training",
    body: "Step into the ring for technique, footwork, and conditioning. Coaching keeps beginners safe and gives regulars something sharper to work toward.",
    points: ["Bag & pad work", "Ring practice", "Conditioning rounds"],
    image: ASSETS.boxing,
    alt: "Two people practicing boxing in a ring.",
  },
  {
    no: "03",
    title: "Mobility, yoga & recovery",
    body: "Quieter sessions to stretch, breathe, and reset. The yoga room and recovery corner give your training somewhere to land — so you come back ready.",
    points: ["Guided mobility", "Yoga & stretching", "Cooldown & recovery"],
    image: ASSETS.mobility,
    alt: "Calm studio space arranged for mobility and recovery work.",
  },
] as const;

export const FACILITIES = [
  {
    id: "strength",
    name: "Strength Floor",
    description: "Racks, plates, and cables with open space for free-weight and strength training at any level.",
    image: ASSETS.spacesStrength,
    alt: "Strength floor with racks and free weights.",
  },
  {
    id: "court",
    name: "Basketball Court",
    description: "An indoor court for pickup, drills, and reservable session time.",
    image: ASSETS.spacesCourt,
    alt: "Indoor basketball court prepared for training.",
  },
  {
    id: "ring",
    name: "Boxing Ring",
    description: "A dedicated ring for boxing practice, conditioning, and one-to-one coaching.",
    image: ASSETS.spacesRing,
    alt: "Boxing ring arranged for practice and coaching.",
  },
  {
    id: "yoga",
    name: "Yoga Room",
    description: "A calm, matted studio for mobility, stretching, and quieter guided sessions.",
    image: ASSETS.spacesYoga,
    alt: "Matted studio space arranged for yoga and mobility.",
  },
  {
    id: "recovery",
    name: "Recovery Corner",
    description: "A dedicated space to cool down, work on mobility, and reset after training.",
    image: ASSETS.spacesRecovery,
    alt: "Recovery area arranged for stretching and cooldown work.",
  },
] as const;

export const COACHING = [
  {
    title: "Strength & conditioning",
    body: "Coaching to help you lift well, program sensibly, and progress at a pace that fits you.",
    icon: "dumbbell",
  },
  {
    title: "Mobility & recovery",
    body: "Guidance for warmups, mobility work, and recovery so training feels sustainable.",
    icon: "heart",
  },
  {
    title: "Boxing",
    body: "Technique, footwork, and conditioning — for total beginners and returning boxers alike.",
    icon: "hand",
  },
] as const;

export const START_OPTIONS = [
  {
    title: "Memberships & passes",
    body: "Daily, weekly, monthly, and yearly options. Ask the front desk what each option includes before you choose.",
    note: "Ask the front desk for current rates",
    icon: "card",
  },
  {
    title: "Coaching",
    body: "Work with a coach on strength & conditioning, mobility & recovery, or boxing.",
    note: "Availability varies by coach",
    icon: "users",
  },
  {
    title: "Room & court bookings",
    body: "Ask about reserving the court, ring, or a room. Availability and rates depend on the amenity and time.",
    note: "Check availability before you visit",
    icon: "calendar",
  },
] as const;

export const START_STEPS = [
  { number: "1", title: "Explore", description: "Browse the gym, spaces, and available services above." },
  { number: "2", title: "Choose", description: "Pick the type of training or visit that suits you right now." },
  { number: "3", title: "Get going", description: "Sign in through FitTrack, or contact the team for guidance." },
] as const;

export const FAQ = [
  {
    question: "What training spaces are available?",
    answer: "Five spaces to explore: a strength floor, a basketball court, a boxing ring, a yoga room, and a recovery corner. Membership and amenity access can vary, so ask the team about the option that fits your visit.",
  },
  {
    question: "How can I ask about membership options?",
    answer: "Memberships come as daily, weekly, monthly, and yearly passes. For current details, contact the front desk by email or phone and they’ll guide you through what each option includes.",
  },
  {
    question: "Where do I sign in?",
    answer: "Members sign in through FitTrack, SertFit’s app and web management platform, using the Sign in button in the header or below.",
  },
  {
    question: "How can I ask about coaching or bookings?",
    answer: "Coaching covers strength & conditioning, mobility & recovery, and boxing. Room and court bookings depend on the amenity and time — reach out to the team and they’ll check availability with you.",
  },
  {
    question: "Who can help me prepare for my first visit?",
    answer: "The front desk helps with memberships, check-ins, account questions, booking assistance, and payment guidance — and is happy to help you plan a first visit.",
  },
] as const;

export const CONTACT = {
  email: "contact@sertfit.com",
  phone: "+63 928 123 4567",
  facebook: "https://www.facebook.com/sertfitgym",
  instagram: "https://www.instagram.com/sertfitgym/",
} as const;
