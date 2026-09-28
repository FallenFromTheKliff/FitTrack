import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { CommerceCheckoutReturnInputDTO } from './checkout-return.dto';

function errorsFor(payload: unknown) {
  return validateSync(plainToInstance(CommerceCheckoutReturnInputDTO, payload), {
    whitelist: true,
  });
}

describe('CommerceCheckoutReturnInputDTO', () => {
  it.each([
    'http://localhost:8080/bookings',
    'http://192.168.1.20:8080/bookings',
    'https://fittrack.example.com/bookings',
  ])('accepts return_url %s for expo_web', (returnUrl) => {
    const errors = errorsFor({
      return_target: 'expo_web',
      return_url: returnUrl,
    });

    expect(errors).toHaveLength(0);
  });

  it.each([
    'localhost:8080/bookings',
    'fittrack://bookings',
    ':::/malformed',
  ])('rejects malformed or non-http(s) return_url %s', (returnUrl) => {
    const errors = errorsFor({
      return_target: 'expo_web',
      return_url: returnUrl,
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('requires return_url when return_target is expo_web', () => {
    const errors = errorsFor({
      return_target: 'expo_web',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('allows mobile without return_url', () => {
    const errors = errorsFor({
      return_target: 'mobile',
    });

    expect(errors).toHaveLength(0);
  });

  it('allows web without return_url', () => {
    const errors = errorsFor({
      return_target: 'web',
    });

    expect(errors).toHaveLength(0);
  });
});
