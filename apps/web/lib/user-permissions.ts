import type {
  UserPermissionAction,
  UserPermissionModule,
  UserPermissions,
  UserRole,
} from '@/types';

export const USER_PERMISSION_MODULES: Array<{
  key: UserPermissionModule;
  label: string;
  description: string;
}> = [
  { key: 'dashboard', label: 'Dashboard', description: 'Tổng quan KPI và timeline' },
  { key: 'bookings', label: 'Đặt vé & Booking', description: 'Tạo và xử lý booking' },
  { key: 'customers', label: 'Khách hàng', description: 'Hồ sơ và lịch sử khách hàng' },
  { key: 'finance', label: 'Tài chính', description: 'Công nợ, quỹ, đối soát, deposit' },
  { key: 'reports', label: 'Reports', description: 'Báo cáo và phân tích' },
  { key: 'sales', label: 'Sales Pipeline', description: 'Cơ hội bán hàng và follow-up' },
  { key: 'priceLookup', label: 'Tra cứu giá', description: 'Tra cứu giá vé nhanh' },
  { key: 'settings', label: 'Cài đặt', description: 'Quản lý cấu hình và tài khoản' },
];

export const USER_PERMISSION_ACTIONS: Array<{
  key: UserPermissionAction;
  label: string;
}> = [
  { key: 'view', label: 'Xem' },
  { key: 'create', label: 'Tạo' },
  { key: 'update', label: 'Sửa' },
  { key: 'delete', label: 'Xóa' },
  { key: 'approve', label: 'Duyệt' },
  { key: 'export', label: 'Xuất' },
];

type PermissionPreset = Partial<
  Record<UserPermissionModule, Partial<Record<UserPermissionAction, boolean>>>
>;

function buildEmptyPermissions(): UserPermissions {
  return USER_PERMISSION_MODULES.reduce((moduleAcc, moduleItem) => {
    moduleAcc[moduleItem.key] = USER_PERMISSION_ACTIONS.reduce((actionAcc, actionItem) => {
      actionAcc[actionItem.key] = false;
      return actionAcc;
    }, {} as UserPermissions[UserPermissionModule]);

    return moduleAcc;
  }, {} as UserPermissions);
}

const ROLE_PERMISSION_PRESETS: Record<UserRole, PermissionPreset> = {
  ADMIN: USER_PERMISSION_MODULES.reduce((acc, moduleItem) => {
    acc[moduleItem.key] = USER_PERMISSION_ACTIONS.reduce((actionAcc, actionItem) => {
      actionAcc[actionItem.key] = true;
      return actionAcc;
    }, {} as UserPermissions[UserPermissionModule]);
    return acc;
  }, {} as Partial<UserPermissions>),
  MANAGER: {
    dashboard: { view: true, export: true },
    bookings: { view: true, create: true, update: true, delete: true, approve: true, export: true },
    customers: { view: true, create: true, update: true, export: true },
    finance: { view: true, create: true, update: true, approve: true, export: true },
    reports: { view: true, export: true },
    sales: { view: true, create: true, update: true, approve: true, export: true },
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

export function getDefaultPermissions(role: UserRole): UserPermissions {
  const matrix = buildEmptyPermissions();
  const preset = ROLE_PERMISSION_PRESETS[role];

  for (const moduleItem of USER_PERMISSION_MODULES) {
    for (const actionItem of USER_PERMISSION_ACTIONS) {
      matrix[moduleItem.key][actionItem.key] = Boolean(preset?.[moduleItem.key]?.[actionItem.key]);
    }
  }

  return matrix;
}

export function normalizePermissions(
  permissions: UserPermissions | Record<string, unknown> | undefined,
  role: UserRole,
): UserPermissions {
  const fallback = getDefaultPermissions(role);

  if (!permissions || typeof permissions !== 'object') {
    return fallback;
  }

  const normalized = buildEmptyPermissions();

  for (const moduleItem of USER_PERMISSION_MODULES) {
    const moduleValue = (permissions as Record<string, unknown>)[moduleItem.key];
    for (const actionItem of USER_PERMISSION_ACTIONS) {
      normalized[moduleItem.key][actionItem.key] =
        typeof moduleValue === 'object' && moduleValue !== null
          ? Boolean((moduleValue as Record<string, unknown>)[actionItem.key])
          : fallback[moduleItem.key][actionItem.key];
    }
  }

  return normalized;
}

export function clonePermissions(permissions: UserPermissions): UserPermissions {
  return normalizePermissions(permissions, 'SALES');
}

export function getPermissionPresetLabel(role: UserRole, permissions?: UserPermissions) {
  const normalized = normalizePermissions(permissions, role);
  const preset = getDefaultPermissions(role);
  return JSON.stringify(normalized) === JSON.stringify(preset) ? role : 'CUSTOM';
}
