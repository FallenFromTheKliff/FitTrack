import { getQueueToken } from '@nestjs/bull';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import {
  NotificationType,
  PayableType,
  PaymentProvider,
  PaymentStage,
  Prisma,
} from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { NotificationsService } from '../../notifications/notifications.service';
import { PaymentRepository } from '../../membership/payment/payment.repository';
import { PAYMENT_COMPLETED_EVENT } from '../../membership/payment/events/payment-completed.event';
import type { PaymentCompletedEvent } from '../../membership/payment/events/payment-completed.event';
import { PaymongoCheckoutService } from '../../membership/payment/paymongo-checkout.service';
import { SubscriptionService } from '../../membership/subscription/subscription.service';
import { RecurringCoachingPlanService } from '../recurring-plan/recurring-coaching-plan.service';
import { AppointmentRepository } from './appointment.repository';
import { AppointmentLifecycleService } from './appointment-lifecycle.service';
import {
  COACHING_LIFECYCLE_QUEUE,
  COACHING_NO_SHOW_JOB,
  COACHING_REMINDER_JOB,
} from './appointment.constants';
import { AppointmentService } from './appointment.service';

type PaymentRecord = Awaited<
  ReturnType<PaymentRepository['findPaymentByIdOrThrow']>
>;

function flushAsyncEvents(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(() => resolve());
  });
}

describe('Appointment payment integration', () => {
  let moduleRef: TestingModule;
  let eventEmitter: EventEmitter2;

  const appointmentRepo = {
    findAppointmentLifecycleContextByIdOrThrow: jest.fn(),
    updateAppointment: jest.fn(),
    findAppointmentNotificationContextByIdOrThrow: jest.fn(),
  };

  const paymentRepo = {
    findPaymentByIdOrThrow: jest.fn(),
  };

  const subscriptionService = {
    hasCoachingAccess: jest.fn(),
  };

  const paymongoCheckoutService = {
    createCheckoutSession: jest.fn(),
  };

  const notificationsService = {
    dispatch: jest.fn(),
  };

  const recurringPlanService = {
    refreshPlanProgress: jest.fn(),
  };

  const lifecycleQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        AppointmentService,
        AppointmentLifecycleService,
        { provide: AppointmentRepository, useValue: appointmentRepo },
        { provide: PaymentRepository, useValue: paymentRepo },
        { provide: SubscriptionService, useValue: subscriptionService },
        {
          provide: PaymongoCheckoutService,
          useValue: paymongoCheckoutService,
        },
        {
          provide: RecurringCoachingPlanService,
          useValue: recurringPlanService,
        },
        { provide: NotificationsService, useValue: notificationsService },
        {
          provide: getQueueToken(COACHING_LIFECYCLE_QUEUE),
          useValue: lifecycleQueue,
        },
      ],
    }).compile();

    await moduleRef.init();
    eventEmitter = moduleRef.get(EventEmitter2);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('advances pending coaching appointments when the shared payment completion event arrives', async () => {
    paymentRepo.findPaymentByIdOrThrow.mockResolvedValue(
      createCompletedDownpayment(),
    );
    appointmentRepo.findAppointmentLifecycleContextByIdOrThrow.mockResolvedValue(
      createPendingPaymentAppointment(),
    );
    appointmentRepo.updateAppointment.mockResolvedValue(
      createConfirmedAppointment(),
    );
    appointmentRepo.findAppointmentNotificationContextByIdOrThrow.mockResolvedValue(
      createNotificationContext(),
    );

    eventEmitter.emit(PAYMENT_COMPLETED_EVENT, createPaymentCompletedEvent());
    await flushAsyncEvents();
    await flushAsyncEvents();

    const updateCalls = appointmentRepo.updateAppointment.mock.calls as Array<
      [string, { status: string; downpayment_paid_at: Date }]
    >;
    const updateInput = updateCalls[0]?.[1];

    expect(paymentRepo.findPaymentByIdOrThrow).toHaveBeenCalledWith(
      'payment-1',
    );
    expect(updateCalls[0]?.[0]).toBe('appt-1');
    expect(updateInput?.status).toBe('confirmed');
    expect(updateInput?.downpayment_paid_at).toBeInstanceOf(Date);
    expect(lifecycleQueue.add).toHaveBeenCalledWith(
      COACHING_NO_SHOW_JOB,
      { appointmentId: 'appt-1' },
      expect.objectContaining({
        jobId: `${COACHING_NO_SHOW_JOB}:appt-1`,
        removeOnComplete: true,
      }),
    );
    expect(lifecycleQueue.add).toHaveBeenCalledWith(
      COACHING_REMINDER_JOB,
      { appointmentId: 'appt-1' },
      expect.objectContaining({
        jobId: `${COACHING_REMINDER_JOB}:appt-1`,
        removeOnComplete: true,
      }),
    );
    expect(notificationsService.dispatch).toHaveBeenCalledWith(
      'member-1',
      NotificationType.appointment_confirmed,
      expect.objectContaining({
        title: 'Coaching appointment confirmed',
      }),
    );
  });

  it('ignores duplicate downpayment completion events after the appointment is already confirmed', async () => {
    paymentRepo.findPaymentByIdOrThrow.mockResolvedValue(
      createCompletedDownpayment(),
    );
    appointmentRepo.findAppointmentLifecycleContextByIdOrThrow.mockResolvedValue(
      createAlreadyConfirmedAppointment(),
    );

    eventEmitter.emit(PAYMENT_COMPLETED_EVENT, createPaymentCompletedEvent());
    await flushAsyncEvents();
    await flushAsyncEvents();

    expect(appointmentRepo.updateAppointment).not.toHaveBeenCalled();
    expect(
      appointmentRepo.findAppointmentNotificationContextByIdOrThrow,
    ).not.toHaveBeenCalled();
    expect(lifecycleQueue.add).not.toHaveBeenCalled();
    expect(notificationsService.dispatch).not.toHaveBeenCalled();
  });
});

function createPaymentCompletedEvent(): PaymentCompletedEvent {
  return {
    paymentId: 'payment-1',
    userId: 'member-1',
    payableType: PayableType.coaching,
    payableId: 'appt-1',
    amount: '450',
  };
}

function createCompletedDownpayment(): PaymentRecord {
  return {
    id: 'payment-1',
    user_id: 'member-1',
    payable_type: PayableType.coaching,
    payable_id: 'appt-1',
    payment_stage: PaymentStage.downpayment,
    amount: new Prisma.Decimal('450'),
    currency: 'PHP',
    provider: PaymentProvider.paymongo,
    provider_ref: 'cs_test_coaching',
    gateway_event_id: 'evt_test_payment_1',
    idempotency_key: '55555555-5555-4555-8555-555555555555',
    status: 'completed',
    gateway_metadata: {
      checkout_url: 'https://checkout.paymongo.test/coaching-appt',
    },
    screenshot_url: null,
    rejection_reason: null,
    verified_by: null,
    verified_at: null,
    created_at: new Date('2026-03-26T00:00:00.000Z'),
    updated_at: new Date('2026-03-26T00:00:00.000Z'),
  };
}

function createPendingPaymentAppointment() {
  return {
    id: 'appt-1',
    user_id: 'member-1',
    coach_id: 'coach-1',
    status: 'pending_payment',
    is_free_session: false,
    downpayment_amount: new Prisma.Decimal('450'),
    balance_amount: new Prisma.Decimal('1050'),
    downpayment_paid_at: null,
    balance_paid_at: null,
    scheduled_at: new Date('2099-04-01T08:00:00.000Z'),
    duration_minutes: 60,
    coach: {
      id: 'coach-1',
      user_id: 'coach-user-1',
    },
  };
}

function createConfirmedAppointment() {
  return {
    id: 'appt-1',
    user_id: 'member-1',
    coach_id: 'coach-1',
    status: 'confirmed',
    is_free_session: false,
    scheduled_at: new Date('2099-04-01T08:00:00.000Z'),
    duration_minutes: 60,
    total_amount: new Prisma.Decimal('1500'),
    downpayment_amount: new Prisma.Decimal('450'),
    balance_amount: new Prisma.Decimal('1050'),
    gym_revenue: new Prisma.Decimal('300'),
    coach_earnings: new Prisma.Decimal('1200'),
    downpayment_paid_at: new Date('2099-04-01T07:45:00.000Z'),
    balance_paid_at: null,
    session_notes: null,
    member_notes: 'Focus on mobility.',
    completed_at: null,
    no_show_at: null,
    cancellation_reason: null,
    cancelled_at: null,
    created_at: new Date('2026-03-26T00:00:00.000Z'),
    updated_at: new Date('2026-03-26T00:00:00.000Z'),
  };
}

function createAlreadyConfirmedAppointment() {
  return {
    ...createPendingPaymentAppointment(),
    status: 'confirmed',
    downpayment_paid_at: new Date('2026-03-26T00:15:00.000Z'),
  };
}

function createNotificationContext() {
  return {
    id: 'appt-1',
    status: 'confirmed',
    scheduled_at: '2099-04-01T08:00:00.000Z',
    duration_minutes: 60,
    user: {
      id: 'member-1',
      auth_identities: [
        { identifier: 'member@example.com', provider: 'email' },
      ],
      notification_prefs: {
        appointment_confirmed_email: true,
        appointment_confirmed_sms: true,
        coach_appointment_reminder_email: true,
      },
      profile: {
        first_name: 'Jamie',
        last_name: 'Rivera',
        phone: '+639171234567',
      },
    },
    coach: {
      user: {
        id: 'coach-user-1',
        auth_identities: [
          { identifier: 'coach@example.com', provider: 'email' },
        ],
        notification_prefs: {
          appointment_confirmed_email: true,
          appointment_confirmed_sms: true,
        },
        profile: {
          first_name: 'Maria',
          last_name: 'Santos',
          phone: '+639179999999',
        },
      },
    },
  };
}
