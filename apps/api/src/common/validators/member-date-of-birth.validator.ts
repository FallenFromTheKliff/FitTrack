import { HttpException, HttpStatus } from '@nestjs/common';

export const MINIMUM_MEMBER_AGE_YEARS = 5;

const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDateOnly(value: string) {
  const dateOnly = value.slice(0, 10);
  if (!ISO_DATE_ONLY_PATTERN.test(dateOnly)) {
    return null;
  }

  const [yearText, monthText, dayText] = dateOnly.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { date, day, month, year };
}

function todayParts(today = new Date()) {
  return {
    day: today.getDate(),
    month: today.getMonth() + 1,
    year: today.getFullYear(),
  };
}

function formatYmd(parts: { day: number; month: number; year: number }) {
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
}

function calculateAge(input: { day: number; month: number; year: number }) {
  const current = todayParts();
  let age = current.year - input.year;
  if (
    current.month < input.month ||
    (current.month === input.month && current.day < input.day)
  ) {
    age -= 1;
  }

  return age;
}

function throwInvalidDateOfBirth(detail: string): never {
  throw new HttpException(
    {
      type: 'BUSINESS_RULE_VIOLATION',
      title: 'Invalid Date Of Birth',
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      detail,
    },
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}

export function assertValidMemberDateOfBirth(value: string | Date): Date {
  const rawValue =
    value instanceof Date ? value.toISOString().slice(0, 10) : value.trim();
  const parsed = parseDateOnly(rawValue);

  if (!parsed) {
    throwInvalidDateOfBirth(
      'date_of_birth must be a real ISO calendar date.',
    );
  }

  const dateOnly = formatYmd(parsed);
  if (dateOnly > formatYmd(todayParts())) {
    throwInvalidDateOfBirth('date_of_birth cannot be in the future.');
  }

  if (calculateAge(parsed) < MINIMUM_MEMBER_AGE_YEARS) {
    throwInvalidDateOfBirth(
      `Member must be at least ${MINIMUM_MEMBER_AGE_YEARS} years old.`,
    );
  }

  return parsed.date;
}
