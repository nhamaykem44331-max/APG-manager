'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Database,
  KeyRound,
  Loader2,
  PencilLine,
  Plus,
  Shield,
  ShieldAlert,
  Trash2,
  User,
  Users,
  Webhook,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { authApi, systemApi, usersApi } from '@/lib/api';
import {
  getDefaultPermissions,
  getPermissionPresetLabel,
  normalizePermissions,
  USER_PERMISSION_ACTIONS,
  USER_PERMISSION_MODULES,
} from '@/lib/user-permissions';
import { cn, formatDateTime } from '@/lib/utils';
import type {
  ResetOperationalDataResult,
  User as AppUser,
  UserPermissionAction,
  UserPermissionModule,
  UserPermissions,
  UserRole,
} from '@/types';

const SIDEBAR_NAV = [
  { id: 'general', label: 'Tài khoản', icon: User },
  { id: 'notifications', label: 'Thông báo', icon: Bell },
  { id: 'integrations', label: 'Tích hợp', icon: Webhook },
  { id: 'permissions', label: 'Phân quyền', icon: Shield },
  { id: 'data', label: 'Dữ liệu', icon: Database },
] as const;

const ROLE_OPTIONS: Array<{ value: UserRole; label: string; note: string }> = [
  { value: 'ADMIN', label: 'Admin', note: 'Toàn quyền hệ thống' },
  { value: 'MANAGER', label: 'Quản lý', note: 'Điều phối vận hành và phê duyệt' },
  { value: 'SALES', label: 'Kinh doanh', note: 'Booking, khách hàng, sales pipeline' },
  { value: 'ACCOUNTANT', label: 'Kế toán', note: 'Tài chính, công nợ, đối soát' },
] as const;

type SettingsTab = (typeof SIDEBAR_NAV)[number]['id'];
type UserFormMode = 'create' | 'edit';

type UserFormState = {
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  password: string;
  permissions: UserPermissions;
};

function createEmptyUserForm(role: UserRole = 'SALES'): UserFormState {
  return {
    fullName: '',
    email: '',
    phone: '',
    role,
    isActive: true,
    password: '',
    permissions: getDefaultPermissions(role),
  };
}

function getApiErrorMessage(error: unknown) {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) {
    return message.join(', ');
  }
  if (typeof message === 'string' && message.trim()) {
    return message;
  }
  return (error as { message?: string })?.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
}

function RoleBadge({ role }: { role: UserRole }) {
  const styles: Record<UserRole, string> = {
    ADMIN: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    MANAGER: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
    SALES: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
    ACCOUNTANT: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  };

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]', styles[role])}>
      {role}
    </span>
  );
}

function PermissionMatrix({
  permissions,
  onToggle,
  readOnly = false,
}: {
  permissions: UserPermissions;
  onToggle?: (moduleKey: UserPermissionModule, actionKey: UserPermissionAction) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-[13px]">
          <thead className="bg-accent/40">
            <tr>
              <th className="w-[240px] px-4 py-3 text-left font-medium text-foreground">Phân hệ</th>
              {USER_PERMISSION_ACTIONS.map((action) => (
                <th key={action.key} className="px-3 py-3 text-center font-medium text-muted-foreground">
                  {action.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {USER_PERMISSION_MODULES.map((moduleItem) => (
              <tr key={moduleItem.key} className="bg-background">
                <td className="px-4 py-3 align-top">
                  <div className="font-medium text-foreground">{moduleItem.label}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{moduleItem.description}</div>
                </td>
                {USER_PERMISSION_ACTIONS.map((actionItem) => (
                  <td key={actionItem.key} className="px-3 py-3 text-center">
                    <input
                      checked={permissions[moduleItem.key][actionItem.key]}
                      className="h-4 w-4 cursor-pointer rounded border-border bg-background text-primary focus:ring-primary"
                      disabled={readOnly}
                      onChange={() => onToggle?.(moduleItem.key, actionItem.key)}
                      type="checkbox"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, update: updateSession } = useSession();

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userFormMode, setUserFormMode] = useState<UserFormMode>('create');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({ fullName: '', email: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [userForm, setUserForm] = useState<UserFormState>(createEmptyUserForm());
  const [generalNotice, setGeneralNotice] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetForm, setResetForm] = useState({
    adminEmail: session?.user?.email ?? '',
    adminPassword: '',
  });
  const [resetResult, setResetResult] = useState<ResetOperationalDataResult | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const sessionRole = (session?.user?.role ?? 'ADMIN') as UserRole;
  const isAdmin = sessionRole === 'ADMIN';

  const { data: currentUser, isLoading: currentUserLoading } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => authApi.me(),
    select: (response) => response.data as AppUser,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    enabled: isAdmin,
    queryKey: ['settings-users'],
    queryFn: () => usersApi.list(),
    select: (response) => response.data as AppUser[],
  });

  const updateProfileMutation = useMutation({
    mutationFn: (payload: { fullName: string; email: string; phone: string }) => authApi.updateProfile(payload),
    onSuccess: async (response) => {
      const data = response.data as AppUser;
      setGeneralNotice('Đã cập nhật hồ sơ tài khoản.');
      setFormError(null);
      setProfileDialogOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['auth-me'] }),
        queryClient.invalidateQueries({ queryKey: ['settings-users'] }),
      ]);
      await updateSession({
        name: data.fullName,
        email: data.email,
        role: data.role,
        accessToken: session?.user?.accessToken,
      });
      router.refresh();
    },
    onError: (error: unknown) => {
      setFormError(getApiErrorMessage(error));
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (payload: { currentPassword: string; newPassword: string }) => authApi.changePassword(payload),
    onSuccess: () => {
      setPasswordNotice('Đã đổi mật khẩu thành công.');
      setFormError(null);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    },
    onError: (error: unknown) => {
      setPasswordNotice(null);
      setFormError(getApiErrorMessage(error));
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (payload: Omit<UserFormState, 'permissions'> & { permissions: UserPermissions }) => usersApi.create(payload),
    onSuccess: async () => {
      setPermissionNotice('Đã tạo tài khoản mới.');
      setFormError(null);
      setUserDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['settings-users'] });
    },
    onError: (error: unknown) => {
      setFormError(getApiErrorMessage(error));
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: (payload: { id: string; data: Record<string, unknown> }) => usersApi.update(payload.id, payload.data),
    onSuccess: async (response) => {
      const data = response.data as AppUser;
      setPermissionNotice('Đã cập nhật tài khoản và phân quyền.');
      setFormError(null);
      setUserDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['settings-users'] });
      await queryClient.invalidateQueries({ queryKey: ['auth-me'] });

      if (data.id === currentUser?.id) {
        await updateSession({
          name: data.fullName,
          email: data.email,
          role: data.role,
          accessToken: session?.user?.accessToken,
        });
        router.refresh();
      }
    },
    onError: (error: unknown) => {
      setFormError(getApiErrorMessage(error));
    },
  });

  const resetMutation = useMutation({
    mutationFn: (payload: { adminEmail: string; adminPassword: string }) => systemApi.resetOperationalData(payload),
    onSuccess: async (response) => {
      const data = response.data as ResetOperationalDataResult;
      setResetResult(data);
      setResetError(null);
      setResetForm((current) => ({ ...current, adminPassword: '' }));
      setIsResetDialogOpen(false);
      queryClient.clear();
      router.refresh();
    },
    onError: (error: unknown) => {
      setResetError(getApiErrorMessage(error));
    },
  });

  const currentDisplayName = currentUser?.fullName ?? session?.user?.name ?? 'Người dùng';
  const currentDisplayEmail = currentUser?.email ?? session?.user?.email ?? '';
  const currentDisplayPhone = currentUser?.phone ?? '';
  const currentPermissions = normalizePermissions(currentUser?.permissions, currentUser?.role ?? sessionRole);

  const openProfileDialog = () => {
    setFormError(null);
    setGeneralNotice(null);
    setProfileForm({
      fullName: currentDisplayName,
      email: currentDisplayEmail,
      phone: currentDisplayPhone,
    });
    setProfileDialogOpen(true);
  };

  const openCreateUserDialog = () => {
    setFormError(null);
    setPermissionNotice(null);
    setUserFormMode('create');
    setEditingUserId(null);
    setUserForm(createEmptyUserForm());
    setUserDialogOpen(true);
  };

  const openEditUserDialog = (user: AppUser) => {
    setFormError(null);
    setUserFormMode('edit');
    setEditingUserId(user.id);
    setUserForm({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone ?? '',
      role: user.role,
      isActive: user.isActive,
      password: '',
      permissions: normalizePermissions(user.permissions, user.role),
    });
    setUserDialogOpen(true);
  };

  const closeProfileDialog = () => {
    if (!updateProfileMutation.isPending) {
      setProfileDialogOpen(false);
      setFormError(null);
    }
  };

  const closeUserDialog = () => {
    if (!createUserMutation.isPending && !updateUserMutation.isPending) {
      setUserDialogOpen(false);
      setFormError(null);
    }
  };

  const togglePermission = (moduleKey: UserPermissionModule, actionKey: UserPermissionAction) => {
    setUserForm((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [moduleKey]: {
          ...current.permissions[moduleKey],
          [actionKey]: !current.permissions[moduleKey][actionKey],
        },
      },
    }));
  };

  const handleUserRoleChange = (role: UserRole) => {
    setUserForm((current) => ({
      ...current,
      role,
      permissions: getDefaultPermissions(role),
    }));
  };

  const handleSubmitProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    updateProfileMutation.mutate({
      fullName: profileForm.fullName.trim(),
      email: profileForm.email.trim(),
      phone: profileForm.phone.trim(),
    });
  };

  const handleSubmitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setPasswordNotice(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setFormError('Mật khẩu xác nhận chưa khớp.');
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  const handleSubmitUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (userFormMode === 'create') {
      createUserMutation.mutate({
        fullName: userForm.fullName.trim(),
        email: userForm.email.trim(),
        phone: userForm.phone.trim(),
        role: userForm.role,
        isActive: userForm.isActive,
        password: userForm.password,
        permissions: userForm.permissions,
      });
      return;
    }

    if (!editingUserId) {
      setFormError('Không tìm thấy tài khoản để cập nhật.');
      return;
    }

    updateUserMutation.mutate({
      id: editingUserId,
      data: {
        fullName: userForm.fullName.trim(),
        email: userForm.email.trim(),
        phone: userForm.phone.trim(),
        role: userForm.role,
        isActive: userForm.isActive,
        newPassword: userForm.password.trim() ? userForm.password : undefined,
        permissions: userForm.permissions,
      },
    });
  };

  const openResetDialog = () => {
    setResetError(null);
    setResetForm({
      adminEmail: session?.user?.email ?? '',
      adminPassword: '',
    });
    setIsResetDialogOpen(true);
  };

  const closeResetDialog = () => {
    if (!resetMutation.isPending) {
      setIsResetDialogOpen(false);
      setResetError(null);
      setResetForm((current) => ({ ...current, adminPassword: '' }));
    }
  };

  const submitReset = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResetError(null);
    resetMutation.mutate({
      adminEmail: resetForm.adminEmail.trim(),
      adminPassword: resetForm.adminPassword,
    });
  };

  const activePresetLabel = getPermissionPresetLabel(userForm.role, userForm.permissions);

  return (
    <div className="max-w-[1320px] space-y-6">
      <PageHeader title="Cài đặt hệ thống" description="Cấu hình APG Manager RMS" />

      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-[260px]">
          <nav className="flex flex-col space-y-1">
            {SIDEBAR_NAV.map((navItem) => (
              <button
                key={navItem.id}
                className={cn(
                  'flex h-10 w-full items-center gap-2 rounded-md px-3 text-left text-[13px] font-medium transition-colors',
                  activeTab === navItem.id
                    ? 'bg-foreground/5 text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
                onClick={() => setActiveTab(navItem.id)}
                type="button"
              >
                <navItem.icon className="h-4 w-4" />
                {navItem.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 space-y-6">
          {activeTab === 'general' && (
            <>
              <div className="card overflow-hidden border border-border">
                <div className="bg-background px-6 py-5">
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">Hồ sơ cá nhân</h3>
                      <p className="mt-1 text-[14px] text-muted-foreground">
                        Thông tin định danh dùng xuyên suốt hệ thống.
                      </p>
                    </div>
                    <button
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
                      onClick={openProfileDialog}
                      type="button"
                    >
                      <PencilLine className="h-4 w-4" />
                      Chỉnh sửa
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-border/50 bg-gradient-to-br from-primary/80 to-primary shadow-sm">
                      <User className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-foreground">
                          {currentUserLoading ? 'Đang tải...' : currentDisplayName}
                        </p>
                        <RoleBadge role={currentUser?.role ?? sessionRole} />
                      </div>
                      <p className="mt-1 text-[14px] text-muted-foreground">{currentDisplayEmail || 'Chưa có email'}</p>
                      <p className="mt-1 text-[13px] text-muted-foreground">
                        {currentDisplayPhone || 'Chưa cập nhật số điện thoại'}
                      </p>
                      {currentUser?.lastLoginAt ? (
                        <p className="mt-2 text-[12px] text-muted-foreground">
                          Đăng nhập gần nhất: {formatDateTime(currentUser.lastLoginAt)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border bg-accent/40 px-6 py-3">
                  <p className="text-[13px] text-muted-foreground">
                    Thông tin này hiển thị trên booking, báo cáo và lịch sử thao tác.
                  </p>
                  {generalNotice ? <span className="text-[12px] text-emerald-400">{generalNotice}</span> : null}
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.3fr,0.9fr]">
                <form className="card overflow-hidden border border-border" onSubmit={handleSubmitPassword}>
                  <div className="bg-background px-6 py-5">
                    <div className="mb-5 flex items-start gap-3">
                      <div className="mt-0.5 rounded-lg border border-border bg-accent/50 p-2">
                        <KeyRound className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-foreground">Đổi mật khẩu</h3>
                        <p className="mt-1 text-[14px] text-muted-foreground">
                          Mật khẩu mới nên dài tối thiểu 8 ký tự và khác với mật khẩu cũ.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-[13px] font-medium text-foreground">Mật khẩu hiện tại</label>
                        <input
                          className="h-10 w-full rounded-md border border-border bg-background px-3 text-[13px] text-foreground transition-all focus:outline-none focus:ring-1 focus:ring-foreground"
                          onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                          placeholder="Nhập mật khẩu hiện tại"
                          type="password"
                          value={passwordForm.currentPassword}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[13px] font-medium text-foreground">Mật khẩu mới</label>
                        <input
                          className="h-10 w-full rounded-md border border-border bg-background px-3 text-[13px] text-foreground transition-all focus:outline-none focus:ring-1 focus:ring-foreground"
                          onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                          placeholder="Nhập mật khẩu mới"
                          type="password"
                          value={passwordForm.newPassword}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[13px] font-medium text-foreground">Xác nhận mật khẩu mới</label>
                        <input
                          className="h-10 w-full rounded-md border border-border bg-background px-3 text-[13px] text-foreground transition-all focus:outline-none focus:ring-1 focus:ring-foreground"
                          onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                          placeholder="Nhập lại mật khẩu mới"
                          type="password"
                          value={passwordForm.confirmPassword}
                        />
                      </div>
                    </div>
                    {passwordNotice ? <p className="mt-4 text-[12px] text-emerald-400">{passwordNotice}</p> : null}
                  </div>
                  <div className="flex items-center justify-between border-t border-border bg-accent/40 px-6 py-3">
                    <p className="text-[13px] text-muted-foreground">Đổi mật khẩu không làm mất phiên đăng nhập hiện tại.</p>
                    <button
                      className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-4 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={changePasswordMutation.isPending}
                      type="submit"
                    >
                      {changePasswordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Cập nhật
                    </button>
                  </div>
                </form>

                <div className="card overflow-hidden border border-border">
                  <div className="bg-background px-6 py-5">
                    <div className="mb-4 flex items-start gap-3">
                      <div className="mt-0.5 rounded-lg border border-border bg-accent/50 p-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-foreground">Quyền hiện tại</h3>
                        <p className="mt-1 text-[14px] text-muted-foreground">
                          Xem nhanh cấu hình quyền của tài khoản đang đăng nhập.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {ROLE_OPTIONS.map((roleOption) => {
                        const active = (currentUser?.role ?? sessionRole) === roleOption.value;
                        return (
                          <div
                            key={roleOption.value}
                            className={cn(
                              'rounded-lg border p-3',
                              active ? 'border-primary/30 bg-primary/5' : 'border-border bg-accent/20',
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-foreground">{roleOption.label}</span>
                              {active ? <RoleBadge role={roleOption.value} /> : null}
                            </div>
                            <p className="mt-1 text-[12px] text-muted-foreground">{roleOption.note}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="border-t border-border bg-accent/40 px-6 py-3">
                    <p className="text-[13px] text-muted-foreground">
                      Muốn quản lý tài khoản và phân quyền chi tiết, chuyển sang tab <span className="font-medium text-foreground">Phân quyền</span>.
                    </p>
                  </div>
                </div>
              </div>

              {formError ? (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-400">
                  {formError}
                </div>
              ) : null}
            </>
          )}

          {activeTab === 'notifications' && (
            <div className="card overflow-hidden border border-border">
              <div className="bg-background px-6 py-5">
                <h3 className="text-xl font-semibold text-foreground">Kênh thông báo</h3>
                <p className="mt-1 text-[14px] text-muted-foreground">
                  Khu vực này sẽ cấu hình Telegram, Zalo OA và luồng cảnh báo sau. Hiện tại chưa nối backend riêng.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="card overflow-hidden border border-border">
              <div className="bg-background px-6 py-5">
                <h3 className="text-xl font-semibold text-foreground">Tích hợp</h3>
                <p className="mt-1 text-[14px] text-muted-foreground">
                  Khu vực này dành cho webhook, n8n và các tích hợp ngoài. Hiện tại giữ nguyên để tránh ảnh hưởng cấu hình đang chạy.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="space-y-6">
              <div className="card overflow-hidden border border-border">
                <div className="flex items-center justify-between gap-4 bg-background px-6 py-5">
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">Tài khoản & phân quyền</h3>
                    <p className="mt-1 text-[14px] text-muted-foreground">
                      Quản lý user theo ma trận quyền kiểu MISA: phân hệ ở hàng, thao tác ở cột.
                    </p>
                  </div>

                  {isAdmin ? (
                    <button
                      className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-4 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
                      onClick={openCreateUserDialog}
                      type="button"
                    >
                      <Plus className="h-4 w-4" />
                      Tạo tài khoản mới
                    </button>
                  ) : null}
                </div>

                {!isAdmin ? (
                  <div className="space-y-4 px-6 py-5">
                    <div className="rounded-lg border border-border bg-accent/20 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">Quyền của tài khoản hiện tại</span>
                      </div>
                      <p className="mb-4 text-[13px] text-muted-foreground">
                        Bạn không có quyền quản trị user, nhưng vẫn có thể xem ma trận quyền của chính mình.
                      </p>
                      <PermissionMatrix permissions={currentPermissions} readOnly />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 px-6 py-5">
                    <div className="grid gap-3 lg:grid-cols-3">
                      <div className="rounded-xl border border-border bg-accent/20 p-4">
                        <p className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground">Tổng tài khoản</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">{users.length}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-accent/20 p-4">
                        <p className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground">Đang hoạt động</p>
                        <p className="mt-2 text-2xl font-semibold text-emerald-400">
                          {users.filter((user) => user.isActive).length}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-accent/20 p-4">
                        <p className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground">Admin</p>
                        <p className="mt-2 text-2xl font-semibold text-amber-400">
                          {users.filter((user) => user.role === 'ADMIN').length}
                        </p>
                      </div>
                    </div>

                    {permissionNotice ? (
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-400">
                        {permissionNotice}
                      </div>
                    ) : null}

                    <div className="overflow-hidden rounded-xl border border-border">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-border text-[13px]">
                          <thead className="bg-accent/40">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nhân sự</th>
                              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vai trò</th>
                              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Trạng thái</th>
                              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Preset quyền</th>
                              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Đăng nhập gần nhất</th>
                              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border bg-background">
                            {usersLoading ? (
                              <tr>
                                <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                                  Đang tải danh sách tài khoản...
                                </td>
                              </tr>
                            ) : users.length === 0 ? (
                              <tr>
                                <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                                  Chưa có tài khoản nào trong hệ thống.
                                </td>
                              </tr>
                            ) : (
                              users.map((user) => {
                                const presetLabel = getPermissionPresetLabel(user.role, normalizePermissions(user.permissions, user.role));
                                return (
                                  <tr key={user.id}>
                                    <td className="px-4 py-4">
                                      <div className="font-medium text-foreground">{user.fullName}</div>
                                      <div className="mt-1 text-[12px] text-muted-foreground">{user.email}</div>
                                      <div className="mt-1 text-[12px] text-muted-foreground">{user.phone || 'Chưa có số điện thoại'}</div>
                                    </td>
                                    <td className="px-4 py-4">
                                      <RoleBadge role={user.role} />
                                    </td>
                                    <td className="px-4 py-4">
                                      <span
                                        className={cn(
                                          'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
                                          user.isActive
                                            ? 'bg-emerald-500/10 text-emerald-300'
                                            : 'bg-red-500/10 text-red-300',
                                        )}
                                      >
                                        {user.isActive ? 'Đang hoạt động' : 'Đã khóa'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-4">
                                      <span className="text-muted-foreground">
                                        {presetLabel === 'CUSTOM' ? 'Tùy chỉnh' : presetLabel}
                                      </span>
                                    </td>
                                    <td className="px-4 py-4 text-muted-foreground">
                                      {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Chưa đăng nhập'}
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                      <button
                                        className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
                                        onClick={() => openEditUserDialog(user)}
                                        type="button"
                                      >
                                        <PencilLine className="h-3.5 w-3.5" />
                                        Sửa tài khoản
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {formError && activeTab === 'permissions' ? (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-400">
                  {formError}
                </div>
              ) : null}
            </div>
          )}

          {activeTab === 'data' && (
            <div className="card overflow-hidden border border-border border-red-500/30">
              <div className="bg-background px-6 py-5">
                <h3 className="text-xl font-semibold text-foreground">Danger Zone</h3>
                <p className="mb-6 mt-1 text-[14px] text-muted-foreground">
                  Các tác vụ nguy hiểm đối với cơ sở dữ liệu.
                </p>

                <div className="flex max-w-[460px] flex-col gap-3">
                  <button
                    className="h-9 w-max rounded-md bg-red-500 px-4 text-left text-[13px] font-medium text-white transition-colors hover:bg-red-600"
                    type="button"
                  >
                    Export toàn bộ dữ liệu (.csv)
                  </button>

                  <button
                    className={cn(
                      'inline-flex h-10 w-max items-center gap-2 rounded-md border px-4 text-[13px] font-medium transition-colors',
                      isAdmin
                        ? 'border-red-500/40 bg-red-500/10 text-red-500 hover:bg-red-500/15'
                        : 'cursor-not-allowed border-border bg-accent text-muted-foreground',
                    )}
                    disabled={!isAdmin}
                    onClick={openResetDialog}
                    type="button"
                  >
                    <Trash2 className="h-4 w-4" />
                    Xóa toàn bộ dữ liệu nghiệp vụ
                  </button>

                  <p className="text-[12px] leading-5 text-muted-foreground">
                    Xóa sạch toàn bộ dữ liệu Booking, Customers và Finance đã phát sinh trong vận hành.
                    Hệ thống vẫn giữ lại users, supplier profiles và airline deposits gốc.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-red-500/20 bg-red-500/5 px-6 py-3">
                <p className="text-[13px] text-red-600 dark:text-red-400">
                  Thao tác này không thể hoàn tác và bắt buộc phải xác nhận bằng tài khoản admin.
                </p>
              </div>

              {resetResult ? (
                <div className="border-t border-emerald-500/20 bg-emerald-500/5 px-6 py-4">
                  <div className="text-[13px] font-medium text-emerald-500">
                    {resetResult.message} Xác nhận bởi {resetResult.confirmedBy}.
                  </div>
                  <div className="mt-2 grid gap-2 text-[12px] text-muted-foreground sm:grid-cols-2">
                    <div>
                      Đã xóa: {resetResult.deleted.bookings} booking, {resetResult.deleted.customers} customer,
                      {` ${resetResult.deleted.ledgers}`} công nợ, {` ${resetResult.deleted.cashFlowEntries}`} dòng tiền.
                    </div>
                    <div>
                      Giữ lại: {resetResult.preserved.users} user, {resetResult.preserved.supplierProfiles} supplier,
                      {` ${resetResult.preserved.airlineDeposits}`} airline deposit.
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="pb-4 pt-8">
        <p className="text-center text-[11px] text-muted-foreground">
          APG Manager RMS v1.0.0 · Coded with Vercel Design System
        </p>
      </div>

      {profileDialogOpen ? (
        <>
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={closeProfileDialog} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-[560px] rounded-2xl border border-border bg-card shadow-2xl">
              <div className="flex items-start justify-between border-b border-border px-6 py-5">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tài khoản</p>
                  <h3 className="mt-3 text-xl font-semibold text-foreground">Chỉnh sửa hồ sơ cá nhân</h3>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Cập nhật tên hiển thị, email đăng nhập và số điện thoại.
                  </p>
                </div>
                <button
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={closeProfileDialog}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form className="space-y-5 px-6 py-5" onSubmit={handleSubmitProfile}>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-[13px] font-medium text-foreground">Họ và tên</label>
                    <input
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-[13px] text-foreground transition-all focus:outline-none focus:ring-1 focus:ring-foreground"
                      onChange={(event) => setProfileForm((current) => ({ ...current, fullName: event.target.value }))}
                      type="text"
                      value={profileForm.fullName}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[13px] font-medium text-foreground">Email đăng nhập</label>
                    <input
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-[13px] text-foreground transition-all focus:outline-none focus:ring-1 focus:ring-foreground"
                      onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
                      type="email"
                      value={profileForm.email}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[13px] font-medium text-foreground">Số điện thoại</label>
                    <input
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-[13px] text-foreground transition-all focus:outline-none focus:ring-1 focus:ring-foreground"
                      onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))}
                      type="text"
                      value={profileForm.phone}
                    />
                  </div>
                </div>

                {formError ? (
                  <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-400">
                    {formError}
                  </div>
                ) : null}

                <div className="flex justify-end gap-3">
                  <button
                    className="h-10 rounded-md border border-border px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
                    onClick={closeProfileDialog}
                    type="button"
                  >
                    Hủy
                  </button>
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-4 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={updateProfileMutation.isPending}
                    type="submit"
                  >
                    {updateProfileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Lưu thay đổi
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      ) : null}

      {userDialogOpen ? (
        <>
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={closeUserDialog} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="max-h-[92vh] w-full max-w-[1080px] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
              <div className="flex items-start justify-between border-b border-border px-6 py-5">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Quản lý tài khoản</p>
                  <h3 className="mt-3 text-xl font-semibold text-foreground">
                    {userFormMode === 'create' ? 'Tạo tài khoản mới' : 'Chỉnh sửa tài khoản'}
                  </h3>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Chọn vai trò trước, sau đó tinh chỉnh ma trận quyền theo từng phân hệ.
                  </p>
                </div>
                <button
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={closeUserDialog}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form className="space-y-5 overflow-y-auto px-6 py-5" onSubmit={handleSubmitUser}>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[13px] font-medium text-foreground">Họ và tên</label>
                    <input
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-[13px] text-foreground transition-all focus:outline-none focus:ring-1 focus:ring-foreground"
                      onChange={(event) => setUserForm((current) => ({ ...current, fullName: event.target.value }))}
                      type="text"
                      value={userForm.fullName}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[13px] font-medium text-foreground">Email</label>
                    <input
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-[13px] text-foreground transition-all focus:outline-none focus:ring-1 focus:ring-foreground"
                      onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
                      type="email"
                      value={userForm.email}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[13px] font-medium text-foreground">Số điện thoại</label>
                    <input
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-[13px] text-foreground transition-all focus:outline-none focus:ring-1 focus:ring-foreground"
                      onChange={(event) => setUserForm((current) => ({ ...current, phone: event.target.value }))}
                      type="text"
                      value={userForm.phone}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[13px] font-medium text-foreground">Vai trò</label>
                    <select
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-[13px] text-foreground transition-all focus:outline-none focus:ring-1 focus:ring-foreground"
                      onChange={(event) => handleUserRoleChange(event.target.value as UserRole)}
                      value={userForm.role}
                    >
                      {ROLE_OPTIONS.map((roleOption) => (
                        <option key={roleOption.value} value={roleOption.value}>
                          {roleOption.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      Khi đổi vai trò, hệ thống sẽ áp preset quyền mặc định của vai trò đó.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-[13px] font-medium text-foreground">
                      {userFormMode === 'create' ? 'Mật khẩu khởi tạo' : 'Mật khẩu mới (nếu muốn reset)'}
                    </label>
                    <input
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-[13px] text-foreground transition-all focus:outline-none focus:ring-1 focus:ring-foreground"
                      onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
                      placeholder={userFormMode === 'create' ? 'Tối thiểu 8 ký tự' : 'Để trống nếu không đổi'}
                      type="password"
                      value={userForm.password}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border bg-accent/20 px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">Trạng thái tài khoản</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {userForm.isActive ? 'Đang hoạt động và có thể đăng nhập' : 'Đã khóa, không thể đăng nhập'}
                      </p>
                    </div>
                    <button
                      className={cn(
                        'inline-flex h-8 items-center rounded-full px-3 text-[12px] font-medium transition-colors',
                        userForm.isActive
                          ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20'
                          : 'bg-red-500/15 text-red-300 hover:bg-red-500/20',
                      )}
                      onClick={() => setUserForm((current) => ({ ...current, isActive: !current.isActive }))}
                      type="button"
                    >
                      {userForm.isActive ? 'Đang hoạt động' : 'Đã khóa'}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-accent/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">Preset quyền hiện tại</p>
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        {activePresetLabel === 'CUSTOM'
                          ? 'Ma trận quyền đang được tùy chỉnh riêng.'
                          : `Đang dùng preset chuẩn theo vai trò ${activePresetLabel}.`}
                      </p>
                    </div>
                    <button
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
                      onClick={() => setUserForm((current) => ({ ...current, permissions: getDefaultPermissions(current.role) }))}
                      type="button"
                    >
                      Áp quyền chuẩn theo vai trò
                    </button>
                  </div>
                </div>

                <PermissionMatrix permissions={userForm.permissions} onToggle={togglePermission} />

                {formError ? (
                  <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-400">
                    {formError}
                  </div>
                ) : null}

                <div className="flex justify-end gap-3 border-t border-border pt-5">
                  <button
                    className="h-10 rounded-md border border-border px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
                    onClick={closeUserDialog}
                    type="button"
                  >
                    Hủy
                  </button>
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-4 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={createUserMutation.isPending || updateUserMutation.isPending}
                    type="submit"
                  >
                    {createUserMutation.isPending || updateUserMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {userFormMode === 'create' ? 'Tạo tài khoản' : 'Lưu tài khoản'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      ) : null}

      {isResetDialogOpen ? (
        <>
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={closeResetDialog} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-[520px] rounded-2xl border border-red-500/20 bg-card shadow-2xl">
              <div className="flex items-start justify-between border-b border-border px-6 py-5">
                <div>
                  <div className="flex items-center gap-2 text-red-500">
                    <ShieldAlert className="h-5 w-5" />
                    <p className="text-sm font-semibold uppercase tracking-[0.18em]">Danger Zone</p>
                  </div>
                  <h3 className="mt-3 text-xl font-semibold text-foreground">Xác nhận xóa toàn bộ dữ liệu</h3>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Nhập tài khoản admin để xóa sạch dữ liệu Booking, Customers và Finance.
                  </p>
                </div>
                <button
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={closeResetDialog}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form className="space-y-5 px-6 py-5" onSubmit={submitReset}>
                <div className="rounded-xl border border-red-500/15 bg-red-500/5 p-4 text-[12px] text-muted-foreground">
                  <p className="font-medium text-red-500">Dữ liệu sẽ bị xóa:</p>
                  <p className="mt-1">Booking, ticket, payment, customer, công nợ, dòng tiền và các dữ liệu finance liên quan.</p>
                  <p className="mt-3 font-medium text-emerald-500">Dữ liệu được giữ lại:</p>
                  <p className="mt-1">Tài khoản đăng nhập, supplier profiles, airline deposits và toàn bộ code/chức năng hệ thống.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-[13px] font-medium text-foreground">Tài khoản admin</label>
                    <input
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-[13px] text-foreground transition-all focus:outline-none focus:ring-1 focus:ring-red-500"
                      onChange={(event) => setResetForm((current) => ({ ...current, adminEmail: event.target.value }))}
                      placeholder="andy@tanphuapg.com"
                      type="email"
                      value={resetForm.adminEmail}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[13px] font-medium text-foreground">Mật khẩu admin</label>
                    <input
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-[13px] text-foreground transition-all focus:outline-none focus:ring-1 focus:ring-red-500"
                      onChange={(event) => setResetForm((current) => ({ ...current, adminPassword: event.target.value }))}
                      placeholder="Nhập mật khẩu để xác nhận"
                      type="password"
                      value={resetForm.adminPassword}
                    />
                  </div>
                </div>

                {resetError ? (
                  <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-400">
                    {resetError}
                  </div>
                ) : null}

                <div className="flex justify-end gap-3">
                  <button
                    className="h-10 rounded-md border border-border px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
                    onClick={closeResetDialog}
                    type="button"
                  >
                    Hủy
                  </button>
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-red-500 px-4 text-[13px] font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={resetMutation.isPending}
                    type="submit"
                  >
                    {resetMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Xác nhận xóa dữ liệu
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
