export type ChatSession = {
  id: string;
  title: string;
  preview: string;
  date: string;
  messageCount: number;
};

export const GREETING_MESSAGE = "Hello! I'm BrodigyAI, your personal fitness assistant. I'm not fully online yet, but I'll be ready soon to help you with workouts, nutrition, and your fitness goals. Stay tuned! 💪";

export const MOCK_SESSIONS: ChatSession[] = [
  { id: "s1", title: "Chest day plan", preview: "Here's a 5-set chest routine...", date: "2026-03-14", messageCount: 8 },
  { id: "s2", title: "Cutting diet advice", preview: "For a caloric deficit of 500...", date: "2026-03-14", messageCount: 5 },
  { id: "s3", title: "Shoulder injury tips", preview: "Rest for 48 hours then...", date: "2026-03-12", messageCount: 12 },
  { id: "s4", title: "Best cardio for HIIT", preview: "Intervals of 30s on / 30s off...", date: "2026-03-10", messageCount: 6 },
  { id: "s5", title: "Protein intake goals", preview: "Aim for 1.8g per kg of body...", date: "2026-03-08", messageCount: 9 }
];
