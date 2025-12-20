'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Plus, Edit, Trash2, Building2, DoorOpen, Layers } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { translations } from '@/lib/i18n';

interface Floor {
  id: string;
  number: string;
  name?: string;
  label_en: string;
  label_ar: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
  type: 'OPD' | 'IPD' | 'BOTH';
  floorId?: string;
}

interface Room {
  id: string;
  floorId: string;
  departmentId: string;
  roomNumber: string;
  roomName?: string;
  label_en: string;
  label_ar: string;
}

export default function StructureManagementPage() {
  const { toast } = useToast();
  const { language, dir } = useLang();
  const t = translations[language] || translations.ar;

  const [floors, setFloors] = useState<Floor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Floor form
  const [floorForm, setFloorForm] = useState({
    number: '',
    name: '',
    label_en: '',
    label_ar: '',
  });
  const [isFloorDialogOpen, setIsFloorDialogOpen] = useState(false);
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);

  // Department form
  const [deptForm, setDeptForm] = useState({
    name: '',
    code: '',
    type: 'OPD' as 'OPD' | 'IPD' | 'BOTH',
    floorId: '',
  });
  const [isDeptDialogOpen, setIsDeptDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  // Room form
  const [roomForm, setRoomForm] = useState({
    floorId: '',
    departmentId: '',
    roomNumber: '',
    roomName: '',
    label_en: '',
    label_ar: '',
  });
  const [isRoomDialogOpen, setIsRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/structure');
      if (response.ok) {
        const data = await response.json();
        setFloors(data.floors || []);
        setDepartments(data.departments || []);
        setRooms(data.rooms || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل تحميل البيانات' : 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateFloor() {
    try {
      const response = await fetch('/api/admin/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'floor',
          data: floorForm,
        }),
      });

      if (response.ok) {
        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم إضافة الطابق بنجاح' : 'Floor added successfully',
        });
        setIsFloorDialogOpen(false);
        setFloorForm({ number: '', name: '', label_en: '', label_ar: '' });
        fetchData();
      } else {
        throw new Error('Failed to create floor');
      }
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل إضافة الطابق' : 'Failed to add floor',
        variant: 'destructive',
      });
    }
  }

  async function handleCreateDepartment() {
    try {
      const response = await fetch('/api/admin/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'department',
          data: deptForm,
        }),
      });

      if (response.ok) {
        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم إضافة القسم بنجاح' : 'Department added successfully',
        });
        setIsDeptDialogOpen(false);
        setDeptForm({ name: '', code: '', type: 'OPD', floorId: '' });
        fetchData();
      } else {
        throw new Error('Failed to create department');
      }
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل إضافة القسم' : 'Failed to add department',
        variant: 'destructive',
      });
    }
  }

  async function handleCreateRoom() {
    try {
      const response = await fetch('/api/admin/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'room',
          data: roomForm,
        }),
      });

      if (response.ok) {
        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم إضافة الغرفة بنجاح' : 'Room added successfully',
        });
        setIsRoomDialogOpen(false);
        setRoomForm({
          floorId: '',
          departmentId: '',
          roomNumber: '',
          roomName: '',
          label_en: '',
          label_ar: '',
        });
        fetchData();
      } else {
        throw new Error('Failed to create room');
      }
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل إضافة الغرفة' : 'Failed to add room',
        variant: 'destructive',
      });
    }
  }

  async function handleDelete(type: 'floor' | 'department' | 'room', id: string) {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من الحذف؟' : 'Are you sure you want to delete?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/structure?type=${type}&id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم الحذف بنجاح' : 'Deleted successfully',
        });
        fetchData();
      } else {
        throw new Error('Failed to delete');
      }
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل الحذف' : 'Failed to delete',
        variant: 'destructive',
      });
    }
  }

  // Filter departments by type
  const opdDepartments = departments.filter(d => d.type === 'OPD' || d.type === 'BOTH');
  const ipdDepartments = departments.filter(d => d.type === 'IPD' || d.type === 'BOTH');
  const otherDepartments = departments.filter(d => d.type === 'BOTH');

  return (
    <div className="space-y-6" dir={dir}>
      <div>
        <h1 className="text-3xl font-bold">
          {language === 'ar' ? 'إدارة البنية التحتية' : 'Structure Management'}
        </h1>
        <p className="text-muted-foreground">
          {language === 'ar' ? 'إدارة الطوابق والأقسام والغرف' : 'Manage floors, departments, and rooms'}
        </p>
      </div>

      <Tabs defaultValue="floors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="floors">
            <Layers className="mr-2 h-4 w-4" />
            {language === 'ar' ? 'الطوابق' : 'Floors'}
          </TabsTrigger>
          <TabsTrigger value="departments">
            <Building2 className="mr-2 h-4 w-4" />
            {language === 'ar' ? 'الأقسام' : 'Departments'}
          </TabsTrigger>
          <TabsTrigger value="rooms">
            <DoorOpen className="mr-2 h-4 w-4" />
            {language === 'ar' ? 'الغرف' : 'Rooms'}
          </TabsTrigger>
        </TabsList>

        {/* Floors Tab */}
        <TabsContent value="floors">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>{language === 'ar' ? 'الطوابق' : 'Floors'}</CardTitle>
                  <CardDescription>
                    {language === 'ar' ? 'إدارة طوابق المستشفى' : 'Manage hospital floors'}
                  </CardDescription>
                </div>
                <Dialog open={isFloorDialogOpen} onOpenChange={setIsFloorDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      {language === 'ar' ? 'إضافة طابق' : 'Add Floor'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {language === 'ar' ? 'إضافة طابق جديد' : 'Add New Floor'}
                      </DialogTitle>
                      <DialogDescription>
                        {language === 'ar' ? 'أدخل معلومات الطابق' : 'Enter floor information'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>{language === 'ar' ? 'رقم الطابق' : 'Floor Number'} *</Label>
                        <Input
                          value={floorForm.number}
                          onChange={(e) => setFloorForm({ ...floorForm, number: e.target.value })}
                          placeholder={language === 'ar' ? 'مثال: 1, 2, 3' : 'e.g., 1, 2, 3'}
                        />
                      </div>
                      <div>
                        <Label>{language === 'ar' ? 'اسم الطابق (اختياري)' : 'Floor Name (Optional)'}</Label>
                        <Input
                          value={floorForm.name}
                          onChange={(e) => setFloorForm({ ...floorForm, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>{language === 'ar' ? 'الاسم بالإنجليزية' : 'English Label'} *</Label>
                        <Input
                          value={floorForm.label_en}
                          onChange={(e) => setFloorForm({ ...floorForm, label_en: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>{language === 'ar' ? 'الاسم بالعربية' : 'Arabic Label'} *</Label>
                        <Input
                          value={floorForm.label_ar}
                          onChange={(e) => setFloorForm({ ...floorForm, label_ar: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsFloorDialogOpen(false)}>
                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                      </Button>
                      <Button onClick={handleCreateFloor}>
                        {language === 'ar' ? 'إضافة' : 'Add'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === 'ar' ? 'رقم الطابق' : 'Floor Number'}</TableHead>
                      <TableHead>{language === 'ar' ? 'الاسم' : 'Name'}</TableHead>
                      <TableHead>{language === 'ar' ? 'الاسم بالإنجليزية' : 'English Label'}</TableHead>
                      <TableHead>{language === 'ar' ? 'الاسم بالعربية' : 'Arabic Label'}</TableHead>
                      <TableHead>{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {floors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">
                          {language === 'ar' ? 'لا توجد طوابق' : 'No floors found'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      floors.map((floor) => (
                        <TableRow key={floor.id}>
                          <TableCell>{floor.number}</TableCell>
                          <TableCell>{floor.name || '-'}</TableCell>
                          <TableCell>{floor.label_en}</TableCell>
                          <TableCell>{floor.label_ar}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete('floor', floor.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>{language === 'ar' ? 'الأقسام' : 'Departments'}</CardTitle>
                  <CardDescription>
                    {language === 'ar' ? 'إدارة أقسام المستشفى' : 'Manage hospital departments'}
                  </CardDescription>
                </div>
                <Dialog open={isDeptDialogOpen} onOpenChange={setIsDeptDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      {language === 'ar' ? 'إضافة قسم' : 'Add Department'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {language === 'ar' ? 'إضافة قسم جديد' : 'Add New Department'}
                      </DialogTitle>
                      <DialogDescription>
                        {language === 'ar' ? 'أدخل معلومات القسم' : 'Enter department information'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>{language === 'ar' ? 'الطابق' : 'Floor'} *</Label>
                        <Select
                          value={deptForm.floorId}
                          onValueChange={(value) => setDeptForm({ ...deptForm, floorId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={language === 'ar' ? 'اختر الطابق' : 'Select floor'} />
                          </SelectTrigger>
                          <SelectContent>
                            {floors.map((floor) => (
                              <SelectItem key={floor.id} value={floor.id}>
                                {floor.number} - {language === 'ar' ? floor.label_ar : floor.label_en}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{language === 'ar' ? 'اسم القسم' : 'Department Name'} *</Label>
                        <Input
                          value={deptForm.name}
                          onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>{language === 'ar' ? 'رمز القسم' : 'Department Code'} *</Label>
                        <Input
                          value={deptForm.code}
                          onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                          placeholder={language === 'ar' ? 'مثال: CARD, SURG' : 'e.g., CARD, SURG'}
                        />
                      </div>
                      <div>
                        <Label>{language === 'ar' ? 'نوع القسم' : 'Department Type'} *</Label>
                        <Select
                          value={deptForm.type}
                          onValueChange={(value) => setDeptForm({ ...deptForm, type: value as 'OPD' | 'IPD' | 'BOTH' })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OPD">OPD</SelectItem>
                            <SelectItem value="IPD">IPD</SelectItem>
                            <SelectItem value="BOTH">
                              {language === 'ar' ? 'كلاهما' : 'Both'}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDeptDialogOpen(false)}>
                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                      </Button>
                      <Button onClick={handleCreateDepartment}>
                        {language === 'ar' ? 'إضافة' : 'Add'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
              ) : (
                <div className="space-y-6">
                  {/* OPD Departments */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">
                      {language === 'ar' ? 'أقسام العيادات الخارجية (OPD)' : 'OPD Departments'}
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{language === 'ar' ? 'الاسم' : 'Name'}</TableHead>
                          <TableHead>{language === 'ar' ? 'الرمز' : 'Code'}</TableHead>
                          <TableHead>{language === 'ar' ? 'الطابق' : 'Floor'}</TableHead>
                          <TableHead>{language === 'ar' ? 'النوع' : 'Type'}</TableHead>
                          <TableHead>{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {opdDepartments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center">
                              {language === 'ar' ? 'لا توجد أقسام OPD' : 'No OPD departments found'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          opdDepartments.map((dept) => {
                            const floor = floors.find(f => f.id === dept.floorId);
                            return (
                              <TableRow key={dept.id}>
                                <TableCell>{dept.name}</TableCell>
                                <TableCell>{dept.code}</TableCell>
                                <TableCell>
                                  {floor ? `${floor.number} - ${language === 'ar' ? floor.label_ar : floor.label_en}` : '-'}
                                </TableCell>
                                <TableCell>{dept.type}</TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete('department', dept.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* IPD Departments */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">
                      {language === 'ar' ? 'أقسام المرضى الداخليين (IPD)' : 'IPD Departments'}
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{language === 'ar' ? 'الاسم' : 'Name'}</TableHead>
                          <TableHead>{language === 'ar' ? 'الرمز' : 'Code'}</TableHead>
                          <TableHead>{language === 'ar' ? 'الطابق' : 'Floor'}</TableHead>
                          <TableHead>{language === 'ar' ? 'النوع' : 'Type'}</TableHead>
                          <TableHead>{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ipdDepartments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center">
                              {language === 'ar' ? 'لا توجد أقسام IPD' : 'No IPD departments found'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          ipdDepartments.map((dept) => {
                            const floor = floors.find(f => f.id === dept.floorId);
                            return (
                              <TableRow key={dept.id}>
                                <TableCell>{dept.name}</TableCell>
                                <TableCell>{dept.code}</TableCell>
                                <TableCell>
                                  {floor ? `${floor.number} - ${language === 'ar' ? floor.label_ar : floor.label_en}` : '-'}
                                </TableCell>
                                <TableCell>{dept.type}</TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete('department', dept.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rooms Tab */}
        <TabsContent value="rooms">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>{language === 'ar' ? 'الغرف' : 'Rooms'}</CardTitle>
                  <CardDescription>
                    {language === 'ar' ? 'إدارة غرف المستشفى' : 'Manage hospital rooms'}
                  </CardDescription>
                </div>
                <Dialog open={isRoomDialogOpen} onOpenChange={setIsRoomDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      {language === 'ar' ? 'إضافة غرفة' : 'Add Room'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {language === 'ar' ? 'إضافة غرفة جديدة' : 'Add New Room'}
                      </DialogTitle>
                      <DialogDescription>
                        {language === 'ar' ? 'أدخل معلومات الغرفة' : 'Enter room information'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>{language === 'ar' ? 'الطابق' : 'Floor'} *</Label>
                        <Select
                          value={roomForm.floorId}
                          onValueChange={(value) => setRoomForm({ ...roomForm, floorId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={language === 'ar' ? 'اختر الطابق' : 'Select floor'} />
                          </SelectTrigger>
                          <SelectContent>
                            {floors.map((floor) => (
                              <SelectItem key={floor.id} value={floor.id}>
                                {floor.number} - {language === 'ar' ? floor.label_ar : floor.label_en}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{language === 'ar' ? 'القسم' : 'Department'} *</Label>
                        <Select
                          value={roomForm.departmentId}
                          onValueChange={(value) => setRoomForm({ ...roomForm, departmentId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={language === 'ar' ? 'اختر القسم' : 'Select department'} />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name} ({dept.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{language === 'ar' ? 'رقم الغرفة' : 'Room Number'} *</Label>
                        <Input
                          value={roomForm.roomNumber}
                          onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>{language === 'ar' ? 'اسم الغرفة (اختياري)' : 'Room Name (Optional)'}</Label>
                        <Input
                          value={roomForm.roomName}
                          onChange={(e) => setRoomForm({ ...roomForm, roomName: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>{language === 'ar' ? 'الاسم بالإنجليزية' : 'English Label'} *</Label>
                        <Input
                          value={roomForm.label_en}
                          onChange={(e) => setRoomForm({ ...roomForm, label_en: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>{language === 'ar' ? 'الاسم بالعربية' : 'Arabic Label'} *</Label>
                        <Input
                          value={roomForm.label_ar}
                          onChange={(e) => setRoomForm({ ...roomForm, label_ar: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsRoomDialogOpen(false)}>
                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                      </Button>
                      <Button onClick={handleCreateRoom}>
                        {language === 'ar' ? 'إضافة' : 'Add'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === 'ar' ? 'رقم الغرفة' : 'Room Number'}</TableHead>
                      <TableHead>{language === 'ar' ? 'الاسم' : 'Name'}</TableHead>
                      <TableHead>{language === 'ar' ? 'الطابق' : 'Floor'}</TableHead>
                      <TableHead>{language === 'ar' ? 'القسم' : 'Department'}</TableHead>
                      <TableHead>{language === 'ar' ? 'الإجراءات' : 'Actions'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rooms.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">
                          {language === 'ar' ? 'لا توجد غرف' : 'No rooms found'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rooms.map((room) => {
                        const floor = floors.find(f => f.id === room.floorId);
                        const department = departments.find(d => d.id === room.departmentId);
                        return (
                          <TableRow key={room.id}>
                            <TableCell>{room.roomNumber}</TableCell>
                            <TableCell>
                              {language === 'ar' ? room.label_ar : room.label_en}
                            </TableCell>
                            <TableCell>
                              {floor ? `${floor.number} - ${language === 'ar' ? floor.label_ar : floor.label_en}` : '-'}
                            </TableCell>
                            <TableCell>{department ? department.name : '-'}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete('room', room.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
