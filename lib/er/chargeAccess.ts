export function isDevSuperAdmin(email: string | null | undefined, tenantId: string | null | undefined): boolean {
  const e = String(email || '').trim().toLowerCase();
  const t = String(tenantId || '').trim();
  return e === 'tak@syra.com.a' || t === '1';
}

const CHARGE_ROLES = new Set([
  'admin',
  'supervisor',
  'er-admin',
  'charge-nurse',
  'charge_nurse',
  'charge',
  'er-charge',
  'er_supervisor',
  'er-supervisor',
]);

export function isChargeOperator(role: string | null | undefined): boolean {
  const r = String(role || '').trim().toLowerCase();
  return CHARGE_ROLES.has(r);
}

export function canAccessChargeConsole(args: {
  email: string | null | undefined;
  tenantId: string | null | undefined;
  role: string | null | undefined;
}): boolean {
  return isDevSuperAdmin(args.email, args.tenantId) || isChargeOperator(args.role);
}

