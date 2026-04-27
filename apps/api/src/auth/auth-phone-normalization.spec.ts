import {
  coerceAuthPhilippineMobileInput,
  formatAuthPhilippineMobileDigits,
  isSupportedAuthPhilippineMobileNumber,
  normalizeAuthPhilippineMobileNumber,
  registerSchema,
} from '../../../../packages/validators/auth';

describe('auth phone normalization helpers', () => {
  it('normalizes supported formats to canonical E.164', () => {
    expect(normalizeAuthPhilippineMobileNumber('+639171234567')).toBe(
      '+639171234567',
    );
    expect(normalizeAuthPhilippineMobileNumber('639171234567')).toBe(
      '+639171234567',
    );
    expect(normalizeAuthPhilippineMobileNumber('09171234567')).toBe(
      '+639171234567',
    );
  });

  it('accepts +63/09/63 variants and rejects invalid values in register schema', () => {
    expect(
      registerSchema.safeParse({
        firstName: 'Fit',
        lastName: 'Track',
        email: 'user@gmail.com',
        phone: '+639171234567',
        password: 'Password1!',
        confirmPassword: 'Password1!',
      }).success,
    ).toBe(true);

    expect(
      registerSchema.safeParse({
        firstName: 'Fit',
        lastName: 'Track',
        email: 'user@gmail.com',
        phone: '09171234567',
        password: 'Password1!',
        confirmPassword: 'Password1!',
      }).success,
    ).toBe(true);

    expect(
      registerSchema.safeParse({
        firstName: 'Fit',
        lastName: 'Track',
        email: 'user@gmail.com',
        phone: '639171234567',
        password: 'Password1!',
        confirmPassword: 'Password1!',
      }).success,
    ).toBe(true);

    expect(
      registerSchema.safeParse({
        firstName: 'Fit',
        lastName: 'Track',
        email: 'user@gmail.com',
        phone: '08171234567',
        password: 'Password1!',
        confirmPassword: 'Password1!',
      }).success,
    ).toBe(false);
  });

  it('coerces raw input to the correct prefix mode and stored value', () => {
    expect(coerceAuthPhilippineMobileInput('639171234567', '09')).toEqual({
      mode: '+63',
      digits: '9171234567',
      value: '+639171234567',
    });

    expect(coerceAuthPhilippineMobileInput('09171234567', '+63')).toEqual({
      mode: '09',
      digits: '171234567',
      value: '09171234567',
    });
  });

  it('formats stored values into number-only input portions per mode', () => {
    expect(formatAuthPhilippineMobileDigits('+639171234567', '+63')).toBe(
      '9171234567',
    );
    expect(formatAuthPhilippineMobileDigits('+639171234567', '09')).toBe(
      '171234567',
    );
  });

  it('detects supported formats with helper predicate', () => {
    expect(isSupportedAuthPhilippineMobileNumber('+639171234567')).toBe(true);
    expect(isSupportedAuthPhilippineMobileNumber('09171234567')).toBe(true);
    expect(isSupportedAuthPhilippineMobileNumber('639171234567')).toBe(true);
    expect(isSupportedAuthPhilippineMobileNumber('9171234567')).toBe(false);
  });
});
