import {
  coerceAuthPhilippineMobileInput,
  adminCreateUserSchema,
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

  it('keeps admin-created account phone optional after repeated parsing', () => {
    const basePayload = {
      firstName: 'Fit',
      lastName: 'Track',
      email: 'staff@gmail.com',
      password: 'Password1!',
      role: 'staff' as const,
    };

    expect(adminCreateUserSchema.parse(basePayload).phone_no).toBeUndefined();

    const parsedBlankPhone = adminCreateUserSchema.parse({
      ...basePayload,
      phone_no: '',
    });

    expect(parsedBlankPhone.phone_no).toBeUndefined();
    expect(adminCreateUserSchema.parse(parsedBlankPhone).phone_no).toBeUndefined();
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
