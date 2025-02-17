
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

export function isValidPassword(password) {
  return password && password.length >= 6;
}

export function isValidName(name) {
  return name && name.trim().length > 0;
}

export function isValidTelephone(telephone) {
  const re = /^\+?[\d\s-]{10,}$/;
  return re.test(telephone);
}
