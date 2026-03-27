import { UserRole } from '@prisma/client';

export const USER_PERMISSION_MODULES = [
  'dashboard',
  'bookings',
  'customers',
  'finance',
  'reports',
  'sales',
  'priceLookup',
  'settings',
] as const;

export const USER_PERMISSION_ACTIONS = [
  'view',
  'create',
  'update',
  'delete',
  'approve',
  'export',
] as const;

export type UserPermissionModule = (typeof USER_PERMISSION_MODULES)[number];
export type UserPermissionAction = (typeof USER_PERMISSION_ACTIONS)[number];

export type UserPermissionMatrix = Record<
  UserPermissionModule,
  Record<UserPermissionAction, boolean>
>;

type PermissionPreset = Partial<
  Record<UserPermissionModule, Partial<Record<UserPermissionAction, boolean>>>
>;

function buildEmptyPermissions(): UserPermissionMatrix {
  return USER_PERMISSION_MODULES.reduce((moduleAcc, moduleKey) => {
    moduleAcc[moduleKey] = USER_PERMISSION_ACTIONS.reduce((actionAcc, actionKey) => {
      actionAcc[actionKey] = false;
      return actionAcc;
    }, {} as Record<UserPermissionAction, boolean>);

    return moduleAcc;
  }, {} as UserPermissionMatrix);
}

const PRESET_BY_ROLE: Record<UserRole, PermissionPreset> = {
  ADMIN: USER_PERMISSION_MODULES.reduce((acc, moduleKey) => {
    acc[moduleKey] = USER_PERMISSION_ACTIONS.reduce((actions, actionKey) => {
      actions[actionKey] = true;
      return actions;
    }, {} as Record<UserPermissionAction, boolean>);
    return acc;
  }, {} as Partial<UserPermissionMatrix>),
  MANAGER: {
    dashboard: { view: true, export: true },
    bookings: { view: true, create: true, update: true, delete: true, approve: true, export: true },
    customers: { view: true, create: true, update: true, delete: false, approve: false, export: true },
    finance: { view: true, create: true, update: true, delete: false, approve: true, export: true },
    reports: { view: true, export: true },
    sales: { view: true, create: true, update: true, delete: false, approve: true, export: true },
    priceLookup: { view: true, export: true },
    settings: { view: true, update: true },
  },
  SALES: {
    dashboard: { view: true },
    bookings: { view: true, create: true, update: true, export: true },
    customers: { view: true, create: true, update: true, export: true },
    finance: { view: true },
    reports: { view: true },
    sales: { view: true, create: true, update: true, export: true },
    priceLookup: { view: true, export: true },
    settings: { view: true },
  },
  ACCOUNTANT: {
    dashboard: { view: true, export: true },
    bookings: { view: true, update: true, export: true },
    customers: { view: true, update: true, export: true },
    finance: { view: true, create: true, update: true, approve: true, export: true },
    reports: { view: true, export: true },
    sales: { view: true },
    priceLookup: { view: true, export: true },
    settings: { view: true },
  },
};

export function getDefaultPermissions(role: UserRole): UserPermissionMatrix {
  const matrix = buildEmptyPermissions();
  const preset = PRESET_BY_ROLE[role];

  for (const moduleKey of USER_PERMISSION_MODULES) {
    for (const actionKey of USER_PERMISSION_ACTIONS) {
      matrix[moduleKey][actionKey] = Boolean(preset?.[moduleKey]?.[actionKey]);
    }
  }

  return matrix;
}

export function normalizePermissions(
  rawPermissions: unknown,
  role: UserRole,
): UserPermissionMatrix {
  const fallback = getDefaultPermissions(role);

  if (!rawPermissions || typeof rawPermissions !== 'object' || Array.isArray(rawPermissions)) {
    return fallback;
  }

  const normalized = buildEmptyPermissions();

  for (const moduleKey of USER_PERMISSION_MODULES) {
    const rawModule =
      rawPermissions && typeof rawPermissions === 'object'
        ? (rawPermissions as Record<string, unknown>)[moduleKey]
        : undefined;

    for (const actionKey of USER_PERMISSION_ACTIONS) {
      normalized[moduleKey][actionKey] =
        typeof rawModule === 'object' && rawModule !== null
          ? Boolean((rawModule as Record<string, unknown>)[actionKey])
          : fallback[moduleKey][actionKey];
    }
  }

  return normalized;
}
