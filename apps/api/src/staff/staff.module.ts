// Add AdminModule to imports
import { BookingModule } from "src/booking-venue/booking/booking.module";
import { UserModule } from "src/user/user.module";
import { CoachModule } from "src/coach-appointment/coach/coach.module";
import { StaffController } from "./staff.controller";
import { Module } from "@nestjs/common";
import { AdminService } from "src/admin/admin.service";

@Module({
    imports: [
        BookingModule,
        UserModule,
        CoachModule,
    ],
    controllers: [StaffController],
    providers:[AdminService]
})
export class StaffModule { }