export type Resource = {
    id: string;
    name: string;
    type: "trainer" | "facility";
    icon: string;
    initials?: string;
};

export type Booking = {
    id: string;
    title: string;
    resourceId: string;
    resourceName: string;
    startHour: number;
    startMinute: number;
    durationMin: number;
    color: string;
    status: "pending" | "confirmed" | "cancelled" | "completed";
    source: "api" | "manual";
};