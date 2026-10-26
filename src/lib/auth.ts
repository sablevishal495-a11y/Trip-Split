/** Phone auth without SMS: store as internal email phone@tripsplit.app */
export function phoneToEmail(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits + '@tripsplit.app';
}

export function formatPhoneDisplay(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length === 10) return '+91 ' + d.slice(0,5) + ' ' + d.slice(5);
  return phone;
}

export function normalizePhone(phone: string): string {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('91') && d.length === 12) d = d.slice(2);
  return d;
}