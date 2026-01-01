'use client';

import { useState, useEffect } from 'react';
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PERMISSIONS, getPermissionsByCategory, getDefaultPermissionsForRole } from '@/lib/permissions';
import { useTranslation } from '@/hooks/use-translation';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department?: string;
  staffId?: string;
  permissions?: string[];
  isActive: boolean;
  groupId?: string;
  hospitalId?: string;
}

interface Group {
  id: string;
  name: string;
  code: string;
}

interface Hospital {
  id: string;
  name: string;
  code: string;
  groupId: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]); // All users for filtering
  const [groups, setGroups] = useState<Group[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'groups' | 'hospitals'>('groups');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { t, language } = useTranslation();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'staff',
    groupId: '',
    hospitalId: '',
    department: '',
    staffId: '',
    permissions: [] as string[],
  });

  const permissionsByCategory = getPermissionsByCategory();

  // Update permissions when role changes
  useEffect(() => {
    if (formData.role) {
      const defaultPerms = getDefaultPermissionsForRole(formData.role);
      setFormData(prev => ({ ...prev, permissions: defaultPerms }));
    }
  }, [formData.role]);

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
    fetchGroups();
    fetchHospitals();
  }, []);

  useEffect(() => {
    // Filter users based on selected group/hospital
    if (activeTab === 'groups' && selectedGroupId) {
      const filtered = allUsers.filter(u => u.groupId === selectedGroupId);
      setUsers(filtered);
    } else if (activeTab === 'hospitals' && selectedHospitalId) {
      const filtered = allUsers.filter(u => u.hospitalId === selectedHospitalId);
      setUsers(filtered);
    } else {
      setUsers([]);
    }
  }, [selectedGroupId, selectedHospitalId, activeTab, allUsers]);

  async function fetchUsers() {
    try {
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const data = await response.json();
        setAllUsers(data.users);
        // Initially show empty (user must select group/hospital)
        setUsers([]);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  }

  async function fetchGroups() {
    try {
      const response = await fetch('/api/admin/groups');
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  }

  async function fetchHospitals() {
    try {
      const response = await fetch('/api/admin/hospitals');
      if (response.ok) {
        const data = await response.json();
        setHospitals(data.hospitals || []);
      }
    } catch (error) {
      console.error('Failed to fetch hospitals:', error);
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
        fetchGroups();
        fetchHospitals();
        // Reset form but preserve selected group/hospital if creating from tab
        const resetFormData: any = {
          email: '',
          password: '',
          firstName: '',
          lastName: '',
          role: 'staff',
          department: '',
          staffId: '',
          permissions: getDefaultPermissionsForRole('staff'),
        };
        if (activeTab === 'groups' && selectedGroupId) {
          resetFormData.groupId = selectedGroupId;
          resetFormData.hospitalId = '';
        } else if (activeTab === 'hospitals' && selectedHospitalId) {
          const hospital = hospitals.find(h => h.id === selectedHospitalId);
          if (hospital) {
            resetFormData.groupId = hospital.groupId;
            resetFormData.hospitalId = selectedHospitalId;
          } else {
            resetFormData.groupId = '';
            resetFormData.hospitalId = '';
          }
        } else {
          resetFormData.groupId = '';
          resetFormData.hospitalId = '';
        }
        setFormData(resetFormData);
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
        fetchGroups();
        fetchHospitals();
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
      groupId: (user as any).groupId || '',
      hospitalId: (user as any).hospitalId || '',
      department: user.department || '',
      staffId: user.staffId || '',
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
        fetchGroups();
        fetchHospitals();
        setFormData({
          email: '',
          password: '',
          firstName: '',
          lastName: '',
          role: 'staff',
          groupId: '',
          hospitalId: '',
          department: '',
          staffId: '',
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

  // When creating user from groups/hospitals tab, pre-fill groupId/hospitalId
  function handleCreateUser() {
    if (activeTab === 'groups' && selectedGroupId) {
      setFormData(prev => ({ ...prev, groupId: selectedGroupId, hospitalId: '' }));
    } else if (activeTab === 'hospitals' && selectedHospitalId) {
      const hospital = hospitals.find(h => h.id === selectedHospitalId);
      if (hospital) {
        setFormData(prev => ({ ...prev, groupId: hospital.groupId, hospitalId: selectedHospitalId }));
      }
    }
    setIsDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t.users.firstName}</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    required
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">{t.users.role}</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => {
                    setFormData({ ...formData, role: value, hospitalId: '' });
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
                    <SelectItem value="group-admin">Group Admin</SelectItem>
                    <SelectItem value="hospital-admin">Hospital Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="groupId">{language === 'ar' ? 'المجموعة' : 'Group'}</Label>
                <Select
                  value={formData.groupId}
                  onValueChange={(value) => {
                    setFormData({ ...formData, groupId: value, hospitalId: '' });
                  }}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'ar' ? 'اختر مجموعة' : 'Select group'} />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} ({group.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(formData.role === 'staff' || formData.role === 'hospital-admin') && (
                <div className="space-y-2">
                  <Label htmlFor="hospitalId">{language === 'ar' ? 'المستشفى' : 'Hospital'}</Label>
                  <Select
                    value={formData.hospitalId || ''}
                    onValueChange={(value) =>
                      setFormData({ ...formData, hospitalId: value })
                    }
                    disabled={!formData.groupId}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === 'ar' ? 'اختر مستشفى' : 'Select hospital'} />
                    </SelectTrigger>
                    <SelectContent>
                      {hospitals
                        .filter(h => !formData.groupId || h.groupId === formData.groupId)
                        .map((hospital) => (
                          <SelectItem key={hospital.id} value={hospital.id}>
                            {hospital.name} ({hospital.code})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {!formData.groupId && (
                    <p className="text-xs text-muted-foreground">
                      {language === 'ar' ? 'يجب اختيار مجموعة أولاً' : 'Please select a group first'}
                    </p>
                  )}
                </div>
              )}
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
              
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label>{t.users.permissions}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        permissions: PERMISSIONS.map(p => p.key),
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
                                  id={`perm-${permission.key}`}
                                  checked={formData.permissions.includes(permission.key)}
                                  onCheckedChange={(checked) =>
                                    handlePermissionToggle(permission.key, checked === true)
                                  }
                                />
                                <Label
                                  htmlFor={`perm-${permission.key}`}
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
              <Button type="submit" form="create-user-form" disabled={isLoading}>
                {isLoading ? t.users.creating : t.users.createUser}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
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
              
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label>{t.users.permissions}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        permissions: PERMISSIONS.map(p => p.key),
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
      </div>

      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v as 'groups' | 'hospitals');
        setSelectedGroupId('');
        setSelectedHospitalId('');
        setUsers([]);
      }} className="space-y-4">
        <TabsList>
          <TabsTrigger value="groups">
            {language === 'ar' ? 'المجموعات' : 'Groups'}
          </TabsTrigger>
          <TabsTrigger value="hospitals">
            {language === 'ar' ? 'المستشفيات' : 'Hospitals'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="groups" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>{language === 'ar' ? 'اختر مجموعة' : 'Select Group'}</CardTitle>
                  <CardDescription>
                    {language === 'ar' ? 'اختر مجموعة لعرض وإدارة المستخدمين' : 'Select a group to view and manage users'}
                  </CardDescription>
                </div>
                {selectedGroupId && (
                  <Button onClick={handleCreateUser}>
                    <Plus className="mr-2 h-4 w-4" />
                    {language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'المجموعة' : 'Group'}</Label>
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'ar' ? 'اختر مجموعة...' : 'Select a group...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} ({group.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {selectedGroupId && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {language === 'ar' ? 'مستخدمي المجموعة' : 'Group Users'} - {groups.find(g => g.id === selectedGroupId)?.name}
                </CardTitle>
                <CardDescription>
                  {language === 'ar' ? 'عرض وإدارة المستخدمين في هذه المجموعة' : 'View and manage users in this group'}
                </CardDescription>
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
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          {language === 'ar' ? 'لا يوجد مستخدمين في هذه المجموعة' : 'No users in this group'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.firstName} {user.lastName}
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
          )}
        </TabsContent>

        <TabsContent value="hospitals" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>{language === 'ar' ? 'اختر مستشفى' : 'Select Hospital'}</CardTitle>
                  <CardDescription>
                    {language === 'ar' ? 'اختر مستشفى لعرض وإدارة المستخدمين' : 'Select a hospital to view and manage users'}
                  </CardDescription>
                </div>
                {selectedHospitalId && (
                  <Button onClick={handleCreateUser}>
                    <Plus className="mr-2 h-4 w-4" />
                    {language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'المستشفى' : 'Hospital'}</Label>
                <Select value={selectedHospitalId} onValueChange={setSelectedHospitalId}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'ar' ? 'اختر مستشفى...' : 'Select a hospital...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {hospitals.map((hospital) => (
                      <SelectItem key={hospital.id} value={hospital.id}>
                        {hospital.name} ({hospital.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {selectedHospitalId && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {language === 'ar' ? 'مستخدمي المستشفى' : 'Hospital Users'} - {hospitals.find(h => h.id === selectedHospitalId)?.name}
                </CardTitle>
                <CardDescription>
                  {language === 'ar' ? 'عرض وإدارة المستخدمين في هذا المستشفى' : 'View and manage users in this hospital'}
                </CardDescription>
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
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          {language === 'ar' ? 'لا يوجد مستخدمين في هذا المستشفى' : 'No users in this hospital'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.firstName} {user.lastName}
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
