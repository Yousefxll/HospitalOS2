'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PERMISSIONS, getPermissionsByCategory, getDefaultPermissionsForRole, Permission } from '@/lib/permissions';
import { useTranslation } from '@/hooks/use-translation';
import { usePlatform } from '@/lib/hooks/usePlatform';
import { MobileSearchBar } from '@/components/mobile/MobileSearchBar';
import { MobileCardList } from '@/components/mobile/MobileCardList';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRouter } from 'next/navigation';
import TenantAccessPanel from '@/components/admin/TenantAccessPanel';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department?: string;
  staffId?: string;
  employeeNo?: string;
  permissions?: string[];
  isActive: boolean;
  groupId?: string;
  hospitalId?: string;
}


export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { toast } = useToast();
  const { t, language } = useTranslation();
  const isMobile = useIsMobile();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'staff',
    department: '',
    staffId: '',
    employeeNo: '',
    permissions: [] as string[],
  });

  const { platform: platformData } = usePlatform();
  const platform = platformData?.platform === 'sam' || platformData?.platform === 'health' 
    ? platformData.platform 
    : null;

  // Filter permissions by platform
  const getFilteredPermissionsByCategory = () => {
    const allPermissionsByCategory = getPermissionsByCategory();
    
    if (!platform) {
      // If no platform selected, show all permissions
      return allPermissionsByCategory;
    }

    // Define platform-specific permission categories
    const SAM_CATEGORIES = ['Document System', 'Account', 'Admin'];
    const HEALTH_CATEGORIES = ['Dashboard', 'Notifications', 'OPD', 'Scheduling', 'ER', 'Patient Experience', 'IPD', 'Equipment (OPD)', 'Equipment (IPD)', 'Manpower & Nursing', 'Account', 'Admin'];

    const targetCategories = platform === 'sam' ? SAM_CATEGORIES : HEALTH_CATEGORIES;
    
    const filtered: Record<string, Permission[]> = {};
    Object.entries(allPermissionsByCategory).forEach(([category, permissions]) => {
      if (targetCategories.includes(category)) {
        filtered[category] = permissions;
      }
    });
    
    return filtered;
  };

  // Filter permissions by platform (recalculate when platform changes)
  const permissionsByCategory = useMemo(() => getFilteredPermissionsByCategory(), [platform]);

  // Filter users by search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(user => 
      user.email.toLowerCase().includes(query) ||
      user.firstName.toLowerCase().includes(query) ||
      user.lastName.toLowerCase().includes(query) ||
      (user.department && user.department.toLowerCase().includes(query)) ||
      (user.staffId && user.staffId.toLowerCase().includes(query)) ||
      (user.employeeNo && user.employeeNo.toLowerCase().includes(query))
    );
  }, [users, searchQuery]);

  // Update permissions when role changes (filter by platform)
  useEffect(() => {
    if (formData.role) {
      const defaultPerms = getDefaultPermissionsForRole(formData.role);
      // Filter default permissions to only include those available in current platform
      const platformPermKeys = Object.values(permissionsByCategory).flat().map(p => p.key);
      const filteredPerms = defaultPerms.filter(p => platformPermKeys.includes(p));
      setFormData(prev => ({ ...prev, permissions: filteredPerms }));
    }
  }, [formData.role, platform]);

  function handlePermissionToggle(permissionKey: string, checked: boolean) {
    setFormData(prev => {
      if (checked) {
        return { ...prev, permissions: [...prev.permissions, permissionKey] };
      } else {
        return { ...prev, permissions: prev.permissions.filter(p => p !== permissionKey) };
      }
    });
  }

  function handleSelectAllCategory(category: string, checked: boolean) {
    const categoryPerms = permissionsByCategory[category] || [];
    const permKeys = categoryPerms.map(p => p.key);
    
    setFormData(prev => {
      if (checked) {
        // Add all category permissions
        const newPerms = Array.from(new Set([...prev.permissions, ...permKeys]));
        return { ...prev, permissions: newPerms };
      } else {
        // Remove all category permissions
        return { ...prev, permissions: prev.permissions.filter(p => !permKeys.includes(p)) };
      }
    });
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast({
          title: t.common.success,
          description: t.users.userCreatedSuccess,
        });
        setIsDialogOpen(false);
        await fetchUsers();
        // Reset form
        setFormData({
          email: '',
          password: '',
          firstName: '',
          lastName: '',
          role: 'staff',
          department: '',
          staffId: '',
          employeeNo: '',
          permissions: getDefaultPermissionsForRole('staff'),
        });
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create user');
      }
    } catch (error) {
      toast({
        title: t.common.error,
        description: error instanceof Error ? error.message : t.common.error,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm(t.users.areYouSureDelete)) return;

    try {
      const response = await fetch(`/api/admin/users?id=${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: t.common.success,
          description: t.users.userDeletedSuccess,
        });
        await fetchUsers();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete user');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete user',
        variant: 'destructive',
      });
    }
  }

  function handleEdit(user: User) {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '', // Don't pre-fill password
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      department: user.department || '',
      staffId: user.staffId || '',
      employeeNo: user.employeeNo || '',
      permissions: user.permissions || getDefaultPermissionsForRole(user.role),
    });
    setIsEditDialogOpen(true);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    
    setIsLoading(true);

    try {
      const updateData: any = {
        permissions: formData.permissions,
        staffId: formData.staffId || undefined,
        employeeNo: formData.employeeNo || undefined,
      };
      
      // Only include password if provided
      if (formData.password) {
        updateData.password = formData.password;
      }

      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        toast({
          title: t.common.success,
          description: t.users.userUpdatedSuccess,
        });
        setIsEditDialogOpen(false);
        setEditingUser(null);
        await fetchUsers();
        setFormData({
          email: '',
          password: '',
          firstName: '',
          lastName: '',
          role: 'staff',
          department: '',
          staffId: '',
          employeeNo: '',
          permissions: getDefaultPermissionsForRole('staff'),
        });
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update user');
      }
    } catch (error) {
      toast({
        title: t.common.error,
        description: error instanceof Error ? error.message : t.common.error,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleCreateUser() {
    setIsDialogOpen(true);
  }

  // Convert users to card format for mobile
  const cardItems = filteredUsers.map((user) => ({
    id: user.id,
    title: `${user.firstName} ${user.lastName}`,
    subtitle: user.email,
    description: user.department || '-',
    badges: [
      {
        label: t.roles[user.role as keyof typeof t.roles] || user.role,
        variant: (user.role === 'admin' ? 'default' : 'secondary') as 'default' | 'secondary',
      },
      {
        label: user.isActive ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive'),
        variant: (user.isActive ? 'default' : 'outline') as 'default' | 'outline',
      },
    ],
    metadata: [
      { label: t.users.department, value: user.department || '-' },
      { label: (t.users as any).employeeNo || 'Employee No', value: user.employeeNo || '-' },
      { label: t.users.permissions, value: `${user.permissions?.length || 0} ${language === 'ar' ? 'صلاحية' : 'permissions'}` },
    ],
    actions: [
      {
        label: t.common.edit,
        onClick: () => handleEdit(user),
        icon: <Edit className="h-4 w-4" />,
        variant: 'outline' as const,
      },
      {
        label: t.common.delete,
        onClick: () => handleDelete(user.id),
        icon: <Trash2 className="h-4 w-4" />,
        variant: 'destructive' as const,
      },
    ],
  }));

  return (
    <div className="space-y-4 md:space-y-6">
      <TenantAccessPanel />
      {/* Header - Hidden on mobile (MobileTopBar shows it) */}
      <div className="hidden md:flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t.users.userManagement}</h1>
          <p className="text-muted-foreground">{t.users.manageUsersRoles}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreateUser}>
              <Plus className="mr-2 h-4 w-4" />
              {t.users.addUser}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] !grid !grid-rows-[auto_1fr_auto] !p-0 !gap-0 overflow-hidden">
            <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b relative z-10 bg-background">
              <DialogTitle>{t.users.createUser}</DialogTitle>
              <DialogDescription>
                {t.users.addNewUserToSystem}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto overflow-x-hidden px-6" style={{ maxHeight: 'calc(90vh - 180px)' }}>
            <form id="create-user-form" onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t.users.firstName}</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t.users.lastName}</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    required
                    className="h-11"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t.auth.email}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t.auth.password}</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">{t.users.role}</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => {
                    setFormData({ ...formData, role: value });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{t.roles.admin}</SelectItem>
                    <SelectItem value="supervisor">{t.roles.supervisor}</SelectItem>
                    <SelectItem value="staff">{t.roles.staff}</SelectItem>
                    <SelectItem value="viewer">{t.roles.viewer}</SelectItem>
                    {/* syra-owner role is NOT exposed in admin UI */}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">{t.users.department}</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) =>
                    setFormData({ ...formData, department: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employeeNo">{(t.users as any).employeeNo || 'Employee No'}</Label>
                <Input
                  id="employeeNo"
                  value={formData.employeeNo}
                  onChange={(e) =>
                    setFormData({ ...formData, employeeNo: e.target.value })
                  }
                  placeholder={(t.users as any).employeeNoPlaceholder || 'Enter employee number'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staffId">{(t.users as any).staffId || 'Staff ID'}</Label>
                <Input
                  id="staffId"
                  value={formData.staffId}
                  onChange={(e) =>
                    setFormData({ ...formData, staffId: e.target.value })
                  }
                  placeholder={(t.users as any).staffIdPlaceholder || 'Enter staff ID'}
                />
              </div>
              
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label>{t.users.permissions}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Select all permissions for current platform only
                      const allPlatformPermissions = Object.values(permissionsByCategory)
                        .flat()
                        .map(p => p.key);
                      setFormData(prev => ({
                        ...prev,
                        permissions: allPlatformPermissions,
                      }));
                    }}
                  >
                    {t.users.selectAll}
                  </Button>
                </div>
                
                <Accordion type="multiple" className="w-full">
                  {Object.entries(permissionsByCategory).map(([category, permissions]) => {
                    const categoryPerms = permissions.map(p => p.key);
                    const allSelected = categoryPerms.every(key => formData.permissions.includes(key));
                    const someSelected = categoryPerms.some(key => formData.permissions.includes(key));
                    
                    return (
                      <AccordionItem key={category} value={category}>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={allSelected}
                            ref={(el) => {
                              if (el && 'indeterminate' in el) {
                                (el as any).indeterminate = someSelected && !allSelected;
                              }
                            }}
                            onCheckedChange={(checked) =>
                              handleSelectAllCategory(category, checked === true)
                            }
                          />
                          <AccordionTrigger className="text-sm flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{category}</span>
                              <span className="text-xs text-muted-foreground">
                                ({categoryPerms.filter(k => formData.permissions.includes(k)).length}/{categoryPerms.length})
                              </span>
                            </div>
                          </AccordionTrigger>
                        </div>
                        <AccordionContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
                            {permissions.map((permission) => (
                              <div key={permission.key} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`perm-${permission.key}`}
                                  checked={formData.permissions.includes(permission.key)}
                                  onCheckedChange={(checked) =>
                                    handlePermissionToggle(permission.key, checked === true)
                                  }
                                />
                                <Label
                                  htmlFor={`perm-${permission.key}`}
                                  className="text-sm font-normal cursor-pointer flex-1"
                                >
                                  {permission.label}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </form>
            </div>
            <DialogFooter className="flex-shrink-0 border-t px-6 py-4 relative z-10 bg-background">
              <Button type="submit" form="create-user-form" disabled={isLoading}>
                {isLoading ? t.users.creating : t.users.createUser}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Mobile Quick Summary */}
      <div className="md:hidden">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t.users.userManagement}</CardTitle>
            <CardDescription>
              {language === 'ar' 
                ? `إجمالي ${users.length} مستخدم` 
                : `Total ${users.length} users`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleCreateUser} className="w-full min-h-[44px]">
                  <Plus className="mr-2 h-4 w-4" />
                  {t.users.addUser}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] max-h-[90vh] !grid !grid-rows-[auto_1fr_auto] !p-0 !gap-0 overflow-hidden">
                <DialogHeader className="flex-shrink-0 px-4 pt-4 pb-3 border-b relative z-10 bg-background">
                  <DialogTitle className="text-lg">{t.users.createUser}</DialogTitle>
                  <DialogDescription className="text-sm">
                    {t.users.addNewUserToSystem}
                  </DialogDescription>
                </DialogHeader>
                <div className="overflow-y-auto overflow-x-hidden px-4" style={{ maxHeight: 'calc(90vh - 180px)' }}>
                <form id="create-user-form" onSubmit={handleSubmit} className="space-y-4 py-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="mobile-firstName">{t.users.firstName}</Label>
                      <Input
                        id="mobile-firstName"
                        value={formData.firstName}
                        onChange={(e) =>
                          setFormData({ ...formData, firstName: e.target.value })
                        }
                        required
                        className="h-11 w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mobile-lastName">{t.users.lastName}</Label>
                      <Input
                        id="mobile-lastName"
                        value={formData.lastName}
                        onChange={(e) =>
                          setFormData({ ...formData, lastName: e.target.value })
                        }
                        required
                        className="h-11 w-full"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mobile-email">{t.auth.email}</Label>
                    <Input
                      id="mobile-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      required
                      className="h-11 w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mobile-password">{t.auth.password}</Label>
                    <Input
                      id="mobile-password"
                      type="password"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      required
                      className="h-11 w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mobile-role">{t.users.role}</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => {
                        setFormData({ ...formData, role: value });
                      }}
                    >
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">{t.roles.admin}</SelectItem>
                        <SelectItem value="supervisor">{t.roles.supervisor}</SelectItem>
                        <SelectItem value="staff">{t.roles.staff}</SelectItem>
                        <SelectItem value="viewer">{t.roles.viewer}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mobile-department">{t.users.department}</Label>
                    <Input
                      id="mobile-department"
                      value={formData.department}
                      onChange={(e) =>
                        setFormData({ ...formData, department: e.target.value })
                      }
                      className="h-11 w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mobile-employeeNo">{(t.users as any).employeeNo || 'Employee No'}</Label>
                    <Input
                      id="mobile-employeeNo"
                      value={formData.employeeNo}
                      onChange={(e) =>
                        setFormData({ ...formData, employeeNo: e.target.value })
                      }
                      placeholder={(t.users as any).employeeNoPlaceholder || 'Enter employee number'}
                      className="h-11 w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mobile-staffId">{(t.users as any).staffId || 'Staff ID'}</Label>
                    <Input
                      id="mobile-staffId"
                      value={formData.staffId}
                      onChange={(e) =>
                        setFormData({ ...formData, staffId: e.target.value })
                      }
                      placeholder={(t.users as any).staffIdPlaceholder || 'Enter staff ID'}
                      className="h-11 w-full"
                    />
                  </div>
                  {/* Permissions section - simplified for mobile */}
                  <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label>{t.users.permissions}</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const allPlatformPermissions = Object.values(permissionsByCategory)
                            .flat()
                            .map(p => p.key);
                          setFormData(prev => ({
                            ...prev,
                            permissions: allPlatformPermissions,
                          }));
                        }}
                        className="min-h-[44px]"
                      >
                        {t.users.selectAll}
                      </Button>
                    </div>
                    <Accordion type="multiple" className="w-full">
                      {Object.entries(permissionsByCategory).map(([category, permissions]) => {
                        const categoryPerms = permissions.map(p => p.key);
                        const allSelected = categoryPerms.every(key => formData.permissions.includes(key));
                        const someSelected = categoryPerms.some(key => formData.permissions.includes(key));
                        
                        return (
                          <AccordionItem key={category} value={category}>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={allSelected}
                                ref={(el) => {
                                  if (el && 'indeterminate' in el) {
                                    (el as any).indeterminate = someSelected && !allSelected;
                                  }
                                }}
                                onCheckedChange={(checked) =>
                                  handleSelectAllCategory(category, checked === true)
                                }
                              />
                              <AccordionTrigger className="text-sm flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{category}</span>
                                  <span className="text-xs text-muted-foreground">
                                    ({categoryPerms.filter(k => formData.permissions.includes(k)).length}/{categoryPerms.length})
                                  </span>
                                </div>
                              </AccordionTrigger>
                            </div>
                            <AccordionContent>
                              <div className="space-y-3 pl-6">
                                {permissions.map((permission) => (
                                  <div key={permission.key} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`mobile-perm-${permission.key}`}
                                      checked={formData.permissions.includes(permission.key)}
                                      onCheckedChange={(checked) =>
                                        handlePermissionToggle(permission.key, checked === true)
                                      }
                                    />
                                    <Label
                                      htmlFor={`mobile-perm-${permission.key}`}
                                      className="text-sm font-normal cursor-pointer flex-1"
                                    >
                                      {permission.label}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </div>
                </form>
                </div>
                <DialogFooter className="flex-shrink-0 border-t px-4 py-3 relative z-10 bg-background">
                  <Button type="submit" form="create-user-form" disabled={isLoading} className="w-full min-h-[44px]">
                    {isLoading ? t.users.creating : t.users.createUser}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Search */}
      <div className="md:hidden">
        <MobileSearchBar
          placeholderKey="common.search"
          queryParam="q"
          onSearch={setSearchQuery}
        />
      </div>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] !grid !grid-rows-[auto_1fr_auto] !p-0 !gap-0 overflow-hidden">
            <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b relative z-10 bg-background">
              <DialogTitle>{t.users.editUserPermissions}</DialogTitle>
              <DialogDescription>
                {t.users.updatePermissions} {editingUser?.firstName} {editingUser?.lastName}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto overflow-x-hidden px-6" style={{ maxHeight: 'calc(90vh - 180px)' }}>
              <form id="edit-user-form" onSubmit={handleUpdate} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t.users.name}</Label>
                  <Input
                    value={`${editingUser?.firstName} ${editingUser?.lastName}`}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.auth.email}</Label>
                  <Input
                    value={editingUser?.email}
                    disabled
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-password">{t.users.newPasswordOptional}</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder={t.users.leaveEmptyToKeep}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-staffId">{(t.users as any).staffId || 'Staff ID'}</Label>
                <Input
                  id="edit-staffId"
                  value={formData.staffId}
                  onChange={(e) =>
                    setFormData({ ...formData, staffId: e.target.value })
                  }
                  placeholder={(t.users as any).staffIdPlaceholder || 'Enter staff ID'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-employeeNo">{(t.users as any).employeeNo || 'Employee No'}</Label>
                <Input
                  id="edit-employeeNo"
                  value={formData.employeeNo}
                  onChange={(e) =>
                    setFormData({ ...formData, employeeNo: e.target.value })
                  }
                  placeholder={(t.users as any).employeeNoPlaceholder || 'Enter employee number'}
                />
              </div>
              
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label>{t.users.permissions}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Select all permissions for current platform only
                      const allPlatformPermissions = Object.values(permissionsByCategory)
                        .flat()
                        .map(p => p.key);
                      setFormData(prev => ({
                        ...prev,
                        permissions: allPlatformPermissions,
                      }));
                    }}
                  >
                    {t.users.selectAll}
                  </Button>
                </div>
                
                <Accordion type="multiple" className="w-full">
                  {Object.entries(permissionsByCategory).map(([category, permissions]) => {
                    const categoryPerms = permissions.map(p => p.key);
                    const allSelected = categoryPerms.every(key => formData.permissions.includes(key));
                    const someSelected = categoryPerms.some(key => formData.permissions.includes(key));
                    
                    return (
                      <AccordionItem key={category} value={category}>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={allSelected}
                            ref={(el) => {
                              if (el && 'indeterminate' in el) {
                                (el as any).indeterminate = someSelected && !allSelected;
                              }
                            }}
                            onCheckedChange={(checked) =>
                              handleSelectAllCategory(category, checked === true)
                            }
                          />
                          <AccordionTrigger className="text-sm flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{category}</span>
                              <span className="text-xs text-muted-foreground">
                                ({categoryPerms.filter(k => formData.permissions.includes(k)).length}/{categoryPerms.length})
                              </span>
                            </div>
                          </AccordionTrigger>
                        </div>
                        <AccordionContent>
                          <div className="grid grid-cols-2 gap-3 pl-6">
                            {permissions.map((permission) => (
                              <div key={permission.key} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`edit-perm-${permission.key}`}
                                  checked={formData.permissions.includes(permission.key)}
                                  onCheckedChange={(checked) =>
                                    handlePermissionToggle(permission.key, checked === true)
                                  }
                                />
                                <Label
                                  htmlFor={`edit-perm-${permission.key}`}
                                  className="text-sm font-normal cursor-pointer"
                                >
                                  {permission.label}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
              </form>
            </div>
            <DialogFooter className="flex-shrink-0 border-t px-6 py-4 relative z-10 bg-background">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingUser(null);
                }}
              >
                {t.common.cancel}
              </Button>
              <Button 
                type="submit" 
                form="edit-user-form"
                disabled={isLoading}
              >
                {isLoading ? t.users.updating : t.users.updateUser}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Mobile: Card List */}
      <div className="md:hidden">
        <MobileCardList
          items={cardItems}
          isLoading={isLoading}
          emptyMessage={language === 'ar' ? 'لا يوجد مستخدمين' : 'No users found'}
        />
      </div>

      {/* Desktop: Users Table */}
      <Card className="hidden md:block">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{language === 'ar' ? 'جميع المستخدمين' : 'All Users'}</CardTitle>
              <CardDescription>
                {language === 'ar' ? 'عرض وإدارة جميع المستخدمين في النظام' : 'View and manage all users in the system'}
              </CardDescription>
            </div>
            <Button onClick={handleCreateUser}>
              <Plus className="mr-2 h-4 w-4" />
              {language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.users.name}</TableHead>
                <TableHead>{t.auth.email}</TableHead>
                <TableHead>{t.users.role}</TableHead>
                <TableHead>{t.users.department}</TableHead>
                <TableHead>{t.users.permissions}</TableHead>
                <TableHead>{t.users.status}</TableHead>
                <TableHead className="text-right">{t.users.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {language === 'ar' ? 'لا يوجد مستخدمين' : 'No users found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div>{user.firstName} {user.lastName}</div>
                      <div className="text-xs text-muted-foreground">
                        {user.employeeNo ? `employeeNo=${user.employeeNo}` : user.staffId ? `staffId=${user.staffId}` : ''}
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <span className="capitalize">{t.roles[user.role as keyof typeof t.roles] || user.role}</span>
                    </TableCell>
                    <TableCell>{user.department || '-'}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {user.permissions?.length || 0} permissions
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          user.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-500'
                        }`}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(user.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
