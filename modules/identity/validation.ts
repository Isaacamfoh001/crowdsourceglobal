export type RegistrationFieldErrors = Partial<Record<"name" | "email" | "password", string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Client-side validation for registration. This is a UX convenience only —
 * Better Auth independently enforces its own password/email rules
 * server-side, which remains the actual security boundary.
 */
export function validateRegistration(
  name: string,
  email: string,
  password: string,
): RegistrationFieldErrors {
  const errors: RegistrationFieldErrors = {};

  if (name.trim().length < 2) {
    errors.name = "Enter your full name.";
  }
  if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address.";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  return errors;
}
