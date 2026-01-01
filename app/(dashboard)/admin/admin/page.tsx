'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
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
  });

  useEffect(() => {
    fetchUsers();
    fetchGroups();
    fetchHospitals();
  }, []);

  async function fetchUsers() {
    try {
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const data = await response.json();
        // Filter users without groupId or hospitalId
        const orphanedUsers = (data.users || []).filter((u: User) => !u.groupId && !u.hospitalId);
        setUsers(orphanedUsers);
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
        body: JSON.stringify({
          ...formData,
          permissions: [],
        }),
      });

      if (response.ok) {
        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم إنشاء المستخدم بنجاح' : 'User created successfully',
        });
        setIsDialogOpen(false);
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
        });
        await fetchUsers();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create user');
      }
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error instanceof Error ? error.message : 'Failed to create user',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا المستخدم؟' : 'Are you sure you want to delete this user?')) return;

    try {
      const response = await fetch(`/api/admin/users?id=${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم حذف المستخدم بنجاح' : 'User deleted successfully',
        });
        await fetchUsers();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete user');
      }
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete user',
        variant: 'destructive',
      });
    }
  }

  function handleEdit(user: User) {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      groupId: user.groupId || '',
      hospitalId: user.hospitalId || '',
      department: user.department || '',
      staffId: user.staffId || '',
    });
    setIsEditDialogOpen(true);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    
    setIsLoading(true);

    try {
      const updateData: any = {
        groupId: formData.groupId && formData.groupId !== 'none' ? formData.groupId : undefined,
        hospitalId: formData.hospitalId && formData.hospitalId !== 'none' ? formData.hospitalId : undefined,
        department: formData.department || undefined,
        staffId: formData.staffId || undefined,
      };
      
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
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم تحديث المستخدم بنجاح' : 'User updated successfully',
        });
        setIsEditDialogOpen(false);
        setEditingUser(null);
        await fetchUsers();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update user');
      }
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error instanceof Error ? error.message : 'Failed to update user',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  const filteredHospitals = hospitals.filter(h => !formData.groupId || h.groupId === formData.groupId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">
            {language === 'ar' ? 'إدارة المستخدمين بدون مجموعات/مستشفيات' : 'Admin - Users without Groups/Hospitals'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' ? 'المستخدمين الذين لا يملكون مجموعة أو مستشفى - يمكنك إضافة أو حذف' : 'Users without group or hospital assignment - you can add or delete'}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{language === 'ar' ? 'إضافة مستخدم جديد' : 'Create New User'}</DialogTitle>
              <DialogDescription>
                {language === 'ar' ? 'إنشاء مستخدم بدون مجموعة أو مستشفى' : 'Create a user without group or hospital'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t.users.firstName}</Label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.users.lastName}</Label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t.auth.email}</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.auth.password}</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.users.role}</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value, hospitalId: '' })}
                >
                  <SelectTrigger>
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
                <Label>{t.users.department}</Label>
                <Input
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t.common.cancel}
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (language === 'ar' ? 'جاري الإنشاء...' : 'Creating...') : (language === 'ar' ? 'إنشاء' : 'Create')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{language === 'ar' ? 'المستخدمين بدون مجموعات/مستشفيات' : 'Users without Groups/Hospitals'}</CardTitle>
          <CardDescription>
            {language === 'ar' ? 'عرض وإدارة المستخدمين الذين لا يملكون مجموعة أو مستشفى' : 'View and manage users without group or hospital assignment'}
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
                <TableHead>{t.users.status}</TableHead>
                <TableHead className="text-right">{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {language === 'ar' ? 'لا يوجد مستخدمين بدون مجموعات/مستشفيات' : 'No users without groups/hospitals'}
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

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'تعديل المستخدم' : 'Edit User'}</DialogTitle>
            <DialogDescription>
              {language === 'ar' ? 'قم بتحديث المستخدم (يمكنك إضافة مجموعة/مستشفى أو حذف المستخدم)' : 'Update user (you can add group/hospital or delete user)'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
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
              <Label>{language === 'ar' ? 'المجموعة (اختياري)' : 'Group (Optional)'}</Label>
              <Select
                value={formData.groupId || 'none'}
                onValueChange={(value) => setFormData({ ...formData, groupId: value === 'none' ? '' : value, hospitalId: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر مجموعة' : 'Select group'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{language === 'ar' ? 'لا يوجد' : 'None'}</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formData.groupId && (
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'المستشفى (اختياري)' : 'Hospital (Optional)'}</Label>
                <Select
                  value={formData.hospitalId || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, hospitalId: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'ar' ? 'اختر مستشفى' : 'Select hospital'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{language === 'ar' ? 'لا يوجد' : 'None'}</SelectItem>
                    {filteredHospitals.map((hospital) => (
                      <SelectItem key={hospital.id} value={hospital.id}>
                        {hospital.name} ({hospital.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>{t.users.department}</Label>
              <Input
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'كلمة مرور جديدة (اختياري)' : 'New Password (Optional)'}</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setIsEditDialogOpen(false);
                setEditingUser(null);
              }}>
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (language === 'ar' ? 'جاري التحديث...' : 'Updating...') : (language === 'ar' ? 'تحديث' : 'Update')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
