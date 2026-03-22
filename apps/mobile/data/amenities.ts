export type AmenityStatus = "available" | "maintenance" | "unavailable";

export const AMENITY_STATUS_META: Record<AmenityStatus, { label: string; color: string }> = {
  available: { label: "Available", color: "#22C55E" },
  maintenance: { label: "Under Maintenance", color: "#F59E0B" },
  unavailable: { label: "Unavailable", color: "#EF4444" }
};

export const AMENITY_META: Record<string, { description: string; hours: string; status: AmenityStatus }> = {
  basketball: {
    description: "Full-sized indoor basketball court with hardwood flooring, adjustable hoops, and digital scoreboard. Suitable for recreational play and organized games.",
    hours: "6:00 AM – 10:00 PM daily",
    status: "available"
  },
  boxing: {
    description: "Professional boxing ring with padded canvas, corner posts, and surrounding mirrors. Ideal for sparring, pad work, and solo training sessions.",
    hours: "7:00 AM – 9:00 PM daily",
    status: "available"
  },
  "gym-front": {
    description: "The front gym area houses the main strength training floor with free weights, barbells, and cable machines. Climate-controlled with full-length mirrors and dedicated warm-up space.",
    hours: "5:00 AM – 11:00 PM daily",
    status: "available"
  },
  "gym-back": {
    description: "The rear gym area is dedicated to functional training, HIIT platforms, kettlebells, battle ropes, and stretching zones. Separate entrance with ventilation panels.",
    hours: "5:00 AM – 11:00 PM daily",
    status: "available"
  },
  volleyball: {
    description: "Indoor volleyball court with regulation net height, padded flooring, and scoreboard. Available for casual play and organized team sessions.",
    hours: "7:00 AM – 9:00 PM daily",
    status: "available"
  },
  reception: {
    description: "The main reception area handles membership enquiries, locker key assignments, towel service, and session bookings. Staff are available during all operating hours.",
    hours: "5:00 AM – 11:00 PM daily",
    status: "available"
  }
};

export const AMENITY_IMAGE_PLACEHOLDERS = ["Main View", "Equipment", "Layout", "Details"];