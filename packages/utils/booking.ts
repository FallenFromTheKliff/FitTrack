export function slotLabel(booked: number, capacity: number): string {
  if (booked >= capacity) return "Full";
  if (booked >= capacity * 0.8) return "Almost Full";
  return `${capacity - booked} left`;
}