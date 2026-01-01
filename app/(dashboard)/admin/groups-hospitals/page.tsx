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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
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

interface Group {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface Hospital {
  id: string;
  name: string;
  code: string;
  groupId: string;
  isActive: boolean;
}

export default function GroupsHospitalsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [isHospitalDialogOpen, setIsHospitalDialogOpen] = useState(false);
  const [isEditGroupDialogOpen, setIsEditGroupDialogOpen] = useState(false);
  const [isEditHospitalDialogOpen, setIsEditHospitalDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { t, language } = useTranslation();

  const [groupFormData, setGroupFormData] = useState({
    name: '',
    code: '',
  });

  const [hospitalFormData, setHospitalFormData] = useState({
    name: '',
    code: '',
    groupId: '',
  });

  useEffect(() => {
    fetchGroups();
    fetchHospitals();
  }, []);

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

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupFormData),
      });

      if (response.ok) {
        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم إنشاء المجموعة بنجاح' : 'Group created successfully',
        });
        setIsGroupDialogOpen(false);
        setGroupFormData({ name: '', code: '' });
        await fetchGroups();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create group');
      }
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error instanceof Error ? error.message : 'Failed to create group',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!editingGroup) return;
    
    setIsLoading(true);

    try {
      const response = await fetch(`/api/admin/groups/${editingGroup.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupFormData),
      });

      if (response.ok) {
        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم تحديث المجموعة بنجاح' : 'Group updated successfully',
        });
        setIsEditGroupDialogOpen(false);
        setEditingGroup(null);
        setGroupFormData({ name: '', code: '' });
        await fetchGroups();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update group');
      }
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error instanceof Error ? error.message : 'Failed to update group',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteGroup(groupId: string) {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذه المجموعة؟' : 'Are you sure you want to delete this group?')) return;

    try {
      const response = await fetch(`/api/admin/groups/${groupId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم حذف المجموعة بنجاح' : 'Group deleted successfully',
        });
        await fetchGroups();
        await fetchHospitals(); // Refresh hospitals in case they were deleted
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete group');
      }
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete group',
        variant: 'destructive',
      });
    }
  }

  function handleEditGroup(group: Group) {
    setEditingGroup(group);
    setGroupFormData({
      name: group.name,
      code: group.code,
    });
    setIsEditGroupDialogOpen(true);
  }

  async function handleCreateHospital(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/hospitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hospitalFormData),
      });

      if (response.ok) {
        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم إنشاء المستشفى بنجاح' : 'Hospital created successfully',
        });
        setIsHospitalDialogOpen(false);
        setHospitalFormData({ name: '', code: '', groupId: '' });
        await fetchHospitals();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create hospital');
      }
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error instanceof Error ? error.message : 'Failed to create hospital',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateHospital(e: React.FormEvent) {
    e.preventDefault();
    if (!editingHospital) return;
    
    setIsLoading(true);

    try {
      const response = await fetch(`/api/admin/hospitals/${editingHospital.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hospitalFormData),
      });

      if (response.ok) {
        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم تحديث المستشفى بنجاح' : 'Hospital updated successfully',
        });
        setIsEditHospitalDialogOpen(false);
        setEditingHospital(null);
        setHospitalFormData({ name: '', code: '', groupId: '' });
        await fetchHospitals();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update hospital');
      }
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error instanceof Error ? error.message : 'Failed to update hospital',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteHospital(hospitalId: string) {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا المستشفى؟' : 'Are you sure you want to delete this hospital?')) return;

    try {
      const response = await fetch(`/api/admin/hospitals/${hospitalId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم حذف المستشفى بنجاح' : 'Hospital deleted successfully',
        });
        await fetchHospitals();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete hospital');
      }
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete hospital',
        variant: 'destructive',
      });
    }
  }

  function handleEditHospital(hospital: Hospital) {
    setEditingHospital(hospital);
    setHospitalFormData({
      name: hospital.name,
      code: hospital.code,
      groupId: hospital.groupId,
    });
    setIsEditHospitalDialogOpen(true);
  }

  function getGroupName(groupId: string): string {
    const group = groups.find(g => g.id === groupId);
    return group ? group.name : groupId;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          {language === 'ar' ? 'إدارة المجموعات والمستشفيات' : 'Groups & Hospitals Management'}
        </h1>
        <p className="text-muted-foreground">
          {language === 'ar' ? 'إضافة وتعديل وحذف المجموعات والمستشفيات' : 'Add, edit, and delete groups and hospitals'}
        </p>
      </div>

      <Tabs defaultValue="groups" className="space-y-4">
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
                  <CardTitle>{language === 'ar' ? 'المجموعات' : 'Groups'}</CardTitle>
                  <CardDescription>
                    {language === 'ar' ? 'إدارة جميع المجموعات' : 'Manage all groups'}
                  </CardDescription>
                </div>
                <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      {language === 'ar' ? 'إضافة مجموعة' : 'Add Group'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{language === 'ar' ? 'إضافة مجموعة جديدة' : 'Create New Group'}</DialogTitle>
                      <DialogDescription>
                        {language === 'ar' ? 'أدخل معلومات المجموعة' : 'Enter group information'}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateGroup} className="space-y-4">
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'اسم المجموعة' : 'Group Name'}</Label>
                        <Input
                          value={groupFormData.name}
                          onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'رمز المجموعة' : 'Group Code'}</Label>
                        <Input
                          value={groupFormData.code}
                          onChange={(e) => setGroupFormData({ ...groupFormData, code: e.target.value })}
                          required
                        />
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsGroupDialogOpen(false)}>
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
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'الاسم' : 'Name'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الرمز' : 'Code'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead className="text-right">{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        {language === 'ar' ? 'لا توجد مجموعات' : 'No groups found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    groups.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell className="font-medium">{group.name}</TableCell>
                        <TableCell>{group.code}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              group.isActive
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                            }`}
                          >
                            {group.isActive ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditGroup(group)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteGroup(group.id)}
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
        </TabsContent>

        <TabsContent value="hospitals" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>{language === 'ar' ? 'المستشفيات' : 'Hospitals'}</CardTitle>
                  <CardDescription>
                    {language === 'ar' ? 'إدارة جميع المستشفيات' : 'Manage all hospitals'}
                  </CardDescription>
                </div>
                <Dialog open={isHospitalDialogOpen} onOpenChange={setIsHospitalDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      {language === 'ar' ? 'إضافة مستشفى' : 'Add Hospital'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{language === 'ar' ? 'إضافة مستشفى جديد' : 'Create New Hospital'}</DialogTitle>
                      <DialogDescription>
                        {language === 'ar' ? 'أدخل معلومات المستشفى' : 'Enter hospital information'}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateHospital} className="space-y-4">
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'المجموعة' : 'Group'}</Label>
                        <Select
                          value={hospitalFormData.groupId}
                          onValueChange={(value) => setHospitalFormData({ ...hospitalFormData, groupId: value })}
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
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'اسم المستشفى' : 'Hospital Name'}</Label>
                        <Input
                          value={hospitalFormData.name}
                          onChange={(e) => setHospitalFormData({ ...hospitalFormData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'رمز المستشفى' : 'Hospital Code'}</Label>
                        <Input
                          value={hospitalFormData.code}
                          onChange={(e) => setHospitalFormData({ ...hospitalFormData, code: e.target.value })}
                          required
                        />
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsHospitalDialogOpen(false)}>
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
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'الاسم' : 'Name'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الرمز' : 'Code'}</TableHead>
                    <TableHead>{language === 'ar' ? 'المجموعة' : 'Group'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead className="text-right">{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hospitals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        {language === 'ar' ? 'لا توجد مستشفيات' : 'No hospitals found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    hospitals.map((hospital) => (
                      <TableRow key={hospital.id}>
                        <TableCell className="font-medium">{hospital.name}</TableCell>
                        <TableCell>{hospital.code}</TableCell>
                        <TableCell>{getGroupName(hospital.groupId)}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              hospital.isActive
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                            }`}
                          >
                            {hospital.isActive ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditHospital(hospital)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteHospital(hospital.id)}
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
        </TabsContent>
      </Tabs>

      {/* Edit Group Dialog */}
      <Dialog open={isEditGroupDialogOpen} onOpenChange={setIsEditGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'تعديل المجموعة' : 'Edit Group'}</DialogTitle>
            <DialogDescription>
              {language === 'ar' ? 'قم بتحديث معلومات المجموعة' : 'Update group information'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateGroup} className="space-y-4">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'اسم المجموعة' : 'Group Name'}</Label>
              <Input
                value={groupFormData.name}
                onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'رمز المجموعة' : 'Group Code'}</Label>
              <Input
                value={groupFormData.code}
                onChange={(e) => setGroupFormData({ ...groupFormData, code: e.target.value })}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setIsEditGroupDialogOpen(false);
                setEditingGroup(null);
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

      {/* Edit Hospital Dialog */}
      <Dialog open={isEditHospitalDialogOpen} onOpenChange={setIsEditHospitalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'تعديل المستشفى' : 'Edit Hospital'}</DialogTitle>
            <DialogDescription>
              {language === 'ar' ? 'قم بتحديث معلومات المستشفى' : 'Update hospital information'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateHospital} className="space-y-4">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'المجموعة' : 'Group'}</Label>
              <Select
                value={hospitalFormData.groupId}
                onValueChange={(value) => setHospitalFormData({ ...hospitalFormData, groupId: value })}
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
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'اسم المستشفى' : 'Hospital Name'}</Label>
              <Input
                value={hospitalFormData.name}
                onChange={(e) => setHospitalFormData({ ...hospitalFormData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'رمز المستشفى' : 'Hospital Code'}</Label>
              <Input
                value={hospitalFormData.code}
                onChange={(e) => setHospitalFormData({ ...hospitalFormData, code: e.target.value })}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setIsEditHospitalDialogOpen(false);
                setEditingHospital(null);
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
