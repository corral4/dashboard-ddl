// Emails autorizados para acceder al dashboard
const ALLOWED_EMAILS = [
  'rogelio.corral@conquer.com.mx',
  'jrogelio2@gmail.com',
  'anelcorral1@gmail.com',
]

export function isEmailAuthorized(email: string | undefined): boolean {
  if (!email) return false
  return ALLOWED_EMAILS.includes(email.toLowerCase())
}
