export function sanitizeProfileNameInput(value: string) {
  return value.replace(/[^\p{L}\s]/gu, "");
}

export function getPhilippinePhoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.startsWith("63")) {
    return digits.slice(2, 12);
  }

  if (digits.startsWith("0")) {
    return digits.slice(1, 11);
  }

  return digits.slice(0, 10);
}

export function toPhilippinePhoneValue(value: string) {
  const digits = getPhilippinePhoneDigits(value).slice(0, 10);
  return digits ? "+63" + digits : "";
}
