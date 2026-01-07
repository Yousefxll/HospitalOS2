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
  Building2, 
  Bed, 
  AlertCircle, 
  Loader2, 
  Plus,
  Edit,
  Trash2,
  X,
  Download
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { useTranslation } from '@/hooks/use-translation';
import { useIsMobile } from '@/hooks/use-mobile';
import { translations } from '@/lib/i18n';

export default function PatientExperienceSetupPage() {
  const { toast } = useToast();
  const { language, dir } = useLang();
  const { t, translate } = useTranslation();
  const isMobile = useIsMobile();
  
  // Helper function to get translation with fallback
  const getTranslation = (key: string, fallbackAr: string, fallbackEn: string) => {
    // Try to get from hook translate function first
    const translated = translate(key);
    // If translation returns the key itself, try direct access
    if (translated === key) {
      const keys = key.split('.');
      const lang = language as 'en' | 'ar';
      let value: any = translations[lang];
      
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          // If not found, use fallback
          return language === 'ar' ? fallbackAr : fallbackEn;
        }
      }
      
      // Return the value if it's a string, otherwise use fallback
      if (typeof value === 'string') {
        return value;
      }
      return language === 'ar' ? fallbackAr : fallbackEn;
    }
    return translated;
  };
  
  // Get title and subtitle
  const pageTitle = getTranslation('px.setup.title', 'إعدادات تجربة المريض', 'Patient Experience Setup');
  const pageSubtitle = getTranslation('px.setup.subtitle', 'إدارة الطوابق والأقسام والغرف والتصنيفات', 'Manage floors, departments, rooms, and classifications');
  
  // Debug: Log translations on mount
  useEffect(() => {
    console.log('[PatientExperienceSetupPage] Language:', language);
    console.log('[PatientExperienceSetupPage] Translations object:', t);
    console.log('[PatientExperienceSetupPage] px key exists:', !!t.px);
    console.log('[PatientExperienceSetupPage] px.setup exists:', !!(t.px as any)?.setup);
    console.log('[PatientExperienceSetupPage] px.setup.title:', (t.px as any)?.setup?.title);
    console.log('[PatientExperienceSetupPage] pageTitle:', pageTitle);
  }, [language, t, pageTitle]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  // Data for dropdowns
  const [floors, setFloors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const [departmentsWithType, setDepartmentsWithType] = useState<any[]>([]); // Departments with type info from departments collection
  const [rooms, setRooms] = useState<any[]>([]);
  const [complaintTypes, setComplaintTypes] = useState<any[]>([]);
  const [nursingComplaintTypes, setNursingComplaintTypes] = useState<any[]>([]);
  const [availableComplaintTypes, setAvailableComplaintTypes] = useState<any[]>([]);
  
  // Edit mode state
  const [editingItem, setEditingItem] = useState<{ id: string; type: string } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Add data form states
  const [addDataForm, setAddDataForm] = useState({
    dataType: 'floor' as 'floor' | 'department' | 'room' | 'complaint-type' | 'nursing-complaint-type',
    // For floor
    floorNumber: '',
    floorName: '',
    // For department
    selectedFloorForDept: '',
    selectedDepartment: '',
    departmentName: '',
    // For room
    selectedFloorForRoom: '',
    selectedDepartmentForRoom: '',
    roomNumber: '',
    roomName: '',
    // For complaint type
    selectedComplaintCategory: '',
    selectedComplaintType: '',
    complaintTypeName: '',
    // For nursing complaint type (sub Classification)
    selectedComplaintTypeForSub: '', // Parent Classification key
    selectedNursingComplaintType: '',
    nursingComplaintTypeName: '',
  });

  useEffect(() => {
    loadFloors();
    loadAllDepartments();
    loadComplaintTypes();
    loadNursingComplaintTypes();
  }, []);

  async function loadFloors() {
    try {
      const response = await fetch('/api/patient-experience/data?type=floors', { cache: 'no-store' });
      const data = await response.json();
      if (data.success) {
        setFloors(data.data);
      }
    } catch (error) {
      console.error('Error loading floors:', error);
    }
  }

  async function loadDepartments(floorId: string) {
    try {
      // Try by floorKey first, then fallback to floorId
      const floor = floors.find(f => f.number === floorId);
      const floorKey = floor?.key || floor?.floorKey;
      const url = floorKey 
        ? `/api/patient-experience/data?type=departments&floorKey=${floorKey}`
        : `/api/patient-experience/data?type=departments&floorId=${floorId}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setDepartments(data.data);
        
        // Enrich with type information from allDepartments
        if (allDepartments.length > 0) {
          const enriched = data.data.map((fd: any) => {
            const fullDept = allDepartments.find((ad: any) => ad.id === fd.departmentId || ad.id === fd.id);
            return {
              ...fd,
              type: fullDept?.type || fd.type || 'BOTH',
            };
          });
          setDepartmentsWithType(enriched);
        }
      }
    } catch (error) {
      console.error('Error loading departments:', error);
      setDepartments([]);
      setDepartmentsWithType([]);
    }
  }

  async function loadAllDepartments() {
    try {
      const response = await fetch('/api/patient-experience/data?type=all-departments', { cache: 'no-store' });
      const data = await response.json();
      if (data.success) {
        setAllDepartments(data.data);
        // Also update departmentsWithType if departments are already loaded
        if (departments.length > 0) {
          const enriched = departments.map((fd: any) => {
            const fullDept = data.data.find((ad: any) => ad.id === fd.departmentId || ad.id === fd.id);
            return {
              ...fd,
              type: fullDept?.type || fd.type || 'BOTH',
            };
          });
          setDepartmentsWithType(enriched);
        }
      }
    } catch (error) {
      console.error('Error loading all departments:', error);
    }
  }

  async function loadRooms(floorId: string, departmentId: string) {
    try {
      // Try by keys first, then fallback to IDs
      const dept = departments.find(d => d.departmentId === departmentId);
      const departmentKey = dept?.key || dept?.departmentKey;
      const url = departmentKey
        ? `/api/patient-experience/data?type=rooms&departmentKey=${departmentKey}`
        : `/api/patient-experience/data?type=rooms&floorId=${floorId}&departmentId=${departmentId}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setRooms(data.data);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
      setRooms([]);
    }
  }

  async function loadComplaintTypes() {
    try {
      const response = await fetch('/api/patient-experience/data?type=complaint-types', { cache: 'no-store' });
      const data = await response.json();
      if (data.success) {
        setComplaintTypes(data.data);
      }
    } catch (error) {
      console.error('Error loading complaint types:', error);
    }
  }

  async function loadNursingComplaintTypes(complaintTypeKey?: string) {
    try {
      // If complaintTypeKey is provided, filter sub Classifications by parent Classification
      const url = complaintTypeKey 
        ? `/api/patient-experience/data?type=nursing-complaint-types&complaintTypeKey=${complaintTypeKey}`
        : '/api/patient-experience/data?type=nursing-complaint-types';
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setNursingComplaintTypes(data.data);
      }
    } catch (error) {
      console.error('Error loading nursing complaint types:', error);
    }
  }

  async function loadAvailableComplaintTypes(category: string) {
    try {
      const response = await fetch(`/api/patient-experience/data?type=complaint-types&category=${category}`, { cache: 'no-store' });
      const data = await response.json();
      if (data.success) {
        setAvailableComplaintTypes(data.data);
      } else {
        setAvailableComplaintTypes([]);
      }
    } catch (error) {
      console.error('Error loading available complaint types:', error);
      setAvailableComplaintTypes([]);
    }
  }

  async function handleAddData() {
    setIsLoading(true);
    try {
      let payload: any = { dataType: addDataForm.dataType };

      if (addDataForm.dataType === 'floor') {
        payload.number = addDataForm.floorNumber;
        payload.name = addDataForm.floorName || undefined;
        // Add bilingual labels (snake_case)
        payload.label_en = `Floor ${addDataForm.floorNumber}`;
        payload.label_ar = `طابق ${addDataForm.floorNumber}`;
      } else if (addDataForm.dataType === 'department') {
        payload.floorId = addDataForm.selectedFloorForDept;
        if (editingItem) {
          payload.departmentId = addDataForm.selectedDepartment;
        } else {
          payload.departmentName = addDataForm.departmentName;
          payload.label_en = addDataForm.departmentName;
          payload.label_ar = addDataForm.departmentName;
        }
      } else if (addDataForm.dataType === 'room') {
        payload.floorId = addDataForm.selectedFloorForRoom;
        payload.departmentId = addDataForm.selectedDepartmentForRoom;
        payload.roomNumber = addDataForm.roomNumber;
        payload.roomName = addDataForm.roomName || undefined;
        payload.label_en = `Room ${addDataForm.roomNumber}`;
        payload.label_ar = `غرفة ${addDataForm.roomNumber}`;
      } else if (addDataForm.dataType === 'complaint-type') {
        payload.category = addDataForm.selectedComplaintCategory;
        payload.type = 'other';
        payload.name = addDataForm.complaintTypeName;
        payload.label_en = addDataForm.complaintTypeName;
        payload.label_ar = addDataForm.complaintTypeName;
      } else if (addDataForm.dataType === 'nursing-complaint-type') {
        // No longer need 'type' field - use label_en/label_ar directly
        payload.complaintTypeKey = addDataForm.selectedComplaintTypeForSub;
        payload.name = addDataForm.nursingComplaintTypeName;
        payload.label_en = addDataForm.nursingComplaintTypeName;
        payload.label_ar = addDataForm.nursingComplaintTypeName;
      }

      const method = editingItem ? 'PUT' : 'POST';
      const url = '/api/patient-experience/data';
      
      if (editingItem) {
        payload.id = editingItem.id;
      }

      console.log('Sending request to:', url, 'with payload:', payload);
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include', // Include cookies for authentication
      });

      console.log('Response status:', response.status, response.statusText);

      const data = await response.json();
      console.log('Response data:', data);

      if (response.ok) {
        toast({
          title: editingItem ? getTranslation('common.save', 'حفظ', 'Save') : getTranslation('px.setup.addNew', 'إضافة جديد', 'Add New'),
          description: editingItem ? 'تم التعديل بنجاح' : 'تمت الإضافة بنجاح',
        });
        
        // Reset form
        const currentDataType = addDataForm.dataType;
        setAddDataForm({
          dataType: 'floor',
          floorNumber: '',
          floorName: '',
          selectedFloorForDept: '',
          selectedDepartment: '',
          departmentName: '',
          selectedFloorForRoom: '',
          selectedDepartmentForRoom: '',
          roomNumber: '',
          roomName: '',
          selectedComplaintCategory: '',
          selectedComplaintType: '',
          complaintTypeName: '',
          selectedComplaintTypeForSub: '',
          selectedNursingComplaintType: '',
          nursingComplaintTypeName: '',
        });
        setEditingItem(null);
        setShowAddForm(false);

        // Reload data
        if (currentDataType === 'floor') {
          loadFloors();
        } else if (currentDataType === 'department') {
          if (addDataForm.selectedFloorForDept) {
            loadDepartments(addDataForm.selectedFloorForDept);
          }
        } else if (currentDataType === 'room') {
          if (addDataForm.selectedFloorForRoom && addDataForm.selectedDepartmentForRoom) {
            loadRooms(addDataForm.selectedFloorForRoom, addDataForm.selectedDepartmentForRoom);
          }
        } else if (currentDataType === 'complaint-type') {
          loadComplaintTypes();
          if (addDataForm.selectedComplaintCategory) {
            loadAvailableComplaintTypes(addDataForm.selectedComplaintCategory);
          }
        } else if (currentDataType === 'nursing-complaint-type') {
          // Load sub Classifications filtered by selected parent Classification
          if (addDataForm.selectedComplaintTypeForSub) {
            loadNursingComplaintTypes(addDataForm.selectedComplaintTypeForSub);
          } else {
            loadNursingComplaintTypes();
          }
        }
      } else {
        const errorMsg = data.error || data.message || 'فشل في العملية';
        console.error('API Error:', errorMsg, data);
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error('handleAddData error:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في العملية',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteItem(dataType: string, id: string) {
    if (!confirm('هل أنت متأكد من حذف هذا العنصر؟')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/patient-experience/data?dataType=${dataType}&id=${id}`, {
        cache: 'no-store',
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: getTranslation('px.setup.deleteItem', 'حذف', 'Delete'),
          description: 'تم الحذف بنجاح',
        });

        // Reload data
        if (dataType === 'floor') {
          loadFloors();
        } else if (dataType === 'department') {
          if (addDataForm.selectedFloorForDept) {
            loadDepartments(addDataForm.selectedFloorForDept);
          }
        } else if (dataType === 'room') {
          if (addDataForm.selectedFloorForRoom && addDataForm.selectedDepartmentForRoom) {
            loadRooms(addDataForm.selectedFloorForRoom, addDataForm.selectedDepartmentForRoom);
          }
        } else if (dataType === 'complaint-type') {
          loadComplaintTypes();
          if (addDataForm.selectedComplaintCategory) {
            loadAvailableComplaintTypes(addDataForm.selectedComplaintCategory);
          }
        } else if (dataType === 'nursing-complaint-type') {
          loadNursingComplaintTypes();
        }
      } else {
        throw new Error(data.error || 'فشل في حذف العنصر');
      }
    } catch (error: any) {
      toast({
        title: 'خطأ في الحذف',
        description: error.message || 'فشل في حذف العنصر',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleEditItem(item: any, dataType: string) {
    setEditingItem({ id: item.id, type: dataType });
    setShowAddForm(true);

    if (dataType === 'floor') {
      setAddDataForm({
        ...addDataForm,
        dataType: 'floor',
        floorNumber: item.number,
        floorName: item.name || '',
      });
    } else if (dataType === 'department') {
      setAddDataForm({
        ...addDataForm,
        dataType: 'department',
        selectedFloorForDept: item.floorId,
        selectedDepartment: item.departmentId,
        departmentName: item.departmentName,
      });
    } else if (dataType === 'room') {
      setAddDataForm({
        ...addDataForm,
        dataType: 'room',
        selectedFloorForRoom: item.floorId,
        selectedDepartmentForRoom: item.departmentId,
        roomNumber: item.roomNumber,
        roomName: item.roomName || '',
      });
    } else if (dataType === 'complaint-type') {
      setAddDataForm({
        ...addDataForm,
        dataType: 'complaint-type',
        selectedComplaintCategory: item.category,
        complaintTypeName: item.name,
      });
    } else if (dataType === 'nursing-complaint-type') {
      setAddDataForm({
        ...addDataForm,
        dataType: 'nursing-complaint-type',
        selectedComplaintTypeForSub: item.complaintTypeKey || '',
        selectedNursingComplaintType: '', // No longer needed
        nursingComplaintTypeName: item.label_en || item.name,
      });
      // Load sub Classifications for the parent Classification
      if (item.complaintTypeKey) {
        loadNursingComplaintTypes(item.complaintTypeKey);
      }
    }
  }

  function handleCancelEdit() {
    setEditingItem(null);
    setShowAddForm(false);
    setAddDataForm({
      ...addDataForm,
      floorNumber: '',
      floorName: '',
      selectedFloorForDept: '',
      selectedDepartment: '',
      departmentName: '',
      selectedFloorForRoom: '',
      selectedDepartmentForRoom: '',
      roomNumber: '',
      roomName: '',
      selectedComplaintCategory: '',
      selectedComplaintType: '',
      complaintTypeName: '',
      selectedComplaintTypeForSub: '',
      selectedNursingComplaintType: '',
      nursingComplaintTypeName: '',
    });
  }

  async function handleImportSeedTaxonomy() {
    if (!confirm(
      language === 'ar'
        ? 'هل تريد استيراد بيانات التصنيف الافتراضية؟ سيتم تحديث البيانات الموجودة أو إضافة الجديدة.'
        : 'Do you want to import default taxonomy seed data? Existing data will be updated or new data will be added.'
    )) {
      return;
    }

    setIsImporting(true);
    try {
      const response = await fetch('/api/patient-experience/complaints/seed', {
        cache: 'no-store',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to import seed data');
      }

      const summary = data.summary || {};
      const inserted = summary.inserted || 0;
      const updated = summary.updated || 0;
      const errors = summary.errors || 0;

      toast({
        title: language === 'ar' ? 'نجح الاستيراد' : 'Import Successful',
        description: language === 'ar'
          ? `تم إضافة ${inserted} عنصر وتحديث ${updated} عنصر${errors > 0 ? ` (${errors} أخطاء)` : ''}`
          : `Inserted ${inserted} items, updated ${updated} items${errors > 0 ? ` (${errors} errors)` : ''}`,
      });

      // Reload complaint types and sub-classifications
      loadComplaintTypes();
      loadNursingComplaintTypes();
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ في الاستيراد' : 'Import Error',
        description: error.message || (language === 'ar' ? 'فشل في استيراد البيانات' : 'Failed to import data'),
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{pageTitle}</h1>
          <p className="text-muted-foreground">{pageSubtitle}</p>
        </div>
      </div>

      {/* Complaint Taxonomy Import Section */}
      <Card>
        <CardHeader>
          <CardTitle>{language === 'ar' ? 'تصنيف الشكاوى' : 'Complaint Taxonomy'}</CardTitle>
          <CardDescription>
            {language === 'ar'
              ? 'استيراد بيانات التصنيف الافتراضية (Domains/Classes/SubClasses)'
              : 'Import default taxonomy seed data (Domains/Classes/SubClasses)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleImportSeedTaxonomy}
            disabled={isImporting}
            variant="outline"
            className="w-full"
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {language === 'ar' ? 'جاري الاستيراد...' : 'Importing...'}
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                {language === 'ar' ? 'استيراد بيانات التصنيف الافتراضية' : 'Import Seed Taxonomy'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{getTranslation('px.setup.addData', 'إضافة بيانات', 'Add Data')}</CardTitle>
          <CardDescription>{getTranslation('px.setup.subtitle', 'إدارة الطوابق والأقسام والغرف والتصنيفات', 'Manage floors, departments, rooms, and classifications')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* List/Select for choosing data type */}
            <div className="space-y-2">
              <Label htmlFor="dataTypeSelect">{getTranslation('px.setup.chooseDataType', 'اختر نوع البيانات المراد إضافتها', 'Choose the type of data to add')} *</Label>
              <Select
                value={addDataForm.dataType}
                onValueChange={(value) => {
                  setAddDataForm({
                    dataType: value as any,
                    floorNumber: '',
                    floorName: '',
                    selectedFloorForDept: '',
                    selectedDepartment: '',
                    departmentName: '',
                    selectedFloorForRoom: '',
                    selectedDepartmentForRoom: '',
                    roomNumber: '',
                    roomName: '',
                    selectedComplaintCategory: '',
                    selectedComplaintType: '',
                    complaintTypeName: '',
                    selectedComplaintTypeForSub: '',
                    selectedNursingComplaintType: '',
                    nursingComplaintTypeName: '',
                  });
                  setEditingItem(null);
                  setShowAddForm(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={getTranslation('px.setup.chooseDataType', 'اختر نوع البيانات المراد إضافتها', 'Choose the type of data to add')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="floor">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span>{getTranslation('px.setup.floor', 'طابق', 'Floor')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="department">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span>{getTranslation('px.setup.department', 'قسم', 'Department')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="room">
                    <div className="flex items-center gap-2">
                      <Bed className="h-4 w-4" />
                      <span>{getTranslation('px.setup.room', 'غرفة', 'Room')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="complaint-type">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <span>{getTranslation('px.setup.classification', 'تصنيف', 'Classification')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="nursing-complaint-type">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <span>{getTranslation('px.setup.nursingClassification', 'تصنيف فرعي', 'Sub Classification')}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Form Content Based on Selected Type */}
            {addDataForm.dataType && (
              <div className="border-t pt-6">
                {/* Floor Management */}
                {addDataForm.dataType === 'floor' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                          <Label>{getTranslation('px.setup.existingFloors', 'الطوابق الموجودة', 'Existing Floors')}</Label>
                      <div className="border rounded-xl divide-y">
                        {floors.map((floor) => (
                          <div key={floor.id} className="p-4 flex items-center justify-between hover:bg-muted/50">
                            <div>
                              <p className="font-medium">{language === 'ar' ? (floor.label_ar || floor.labelAr || `الطابق ${floor.number}`) : (floor.label_en || floor.labelEn || `Floor ${floor.number}`)}</p>
                              {floor.name && <p className="text-sm text-muted-foreground">{floor.name}</p>}
                            </div>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" onClick={() => handleEditItem(floor, 'floor')}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteItem('floor', floor.id)} className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {floors.length === 0 && (
                          <div className="p-4 text-center text-muted-foreground">
                            {getTranslation('px.setup.noFloors', 'لا توجد طوابق', 'No floors')}
                          </div>
                        )}
                      </div>
                    </div>

                    {(showAddForm || editingItem) && (
                      <div className="space-y-4 p-6 border rounded-xl bg-muted/30">
                        <div className="flex items-center justify-between">
                          <Label className="text-lg font-semibold">
                            {editingItem ? `${getTranslation('px.setup.editItem', 'تعديل', 'Edit')} ${getTranslation('px.setup.floor', 'طابق', 'Floor')}` : `${getTranslation('px.setup.addNew', 'إضافة جديد', 'Add New')} ${getTranslation('px.setup.floor', 'طابق', 'Floor')}`}
                          </Label>
                          <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="floorNumber">{getTranslation('px.setup.floorNumber', 'رقم الطابق', 'Floor Number')} *</Label>
                          <Input
                            id="floorNumber"
                            value={addDataForm.floorNumber}
                            onChange={(e) => setAddDataForm({ ...addDataForm, floorNumber: e.target.value })}
                            placeholder={language === 'ar' ? 'مثال: 1, 2, 3...' : 'Example: 1, 2, 3...'}
                          />
                        </div>
                        <Button onClick={handleAddData} disabled={isLoading || !addDataForm.floorNumber} className="w-full">
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {t.common?.loading || 'common.loading'}
                            </>
                          ) : (
                            <>
                              {editingItem ? (
                                <>
                                  <Edit className="mr-2 h-4 w-4" />
                                  {t.common?.save || 'common.save'}
                                </>
                              ) : (
                                <>
                                  <Plus className="mr-2 h-4 w-4" />
                                  {getTranslation('px.setup.addNew', 'إضافة جديد', 'Add New')} {getTranslation('px.setup.floor', 'طابق', 'Floor')}
                                </>
                              )}
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {!showAddForm && !editingItem && (
                      <Button onClick={() => setShowAddForm(true)} variant="outline" className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        {getTranslation('px.setup.addNew', 'إضافة جديد', 'Add New')} {getTranslation('px.setup.floor', 'طابق', 'Floor')}
                      </Button>
                    )}
                  </div>
                )}

                {/* Department Management */}
                {addDataForm.dataType === 'department' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="selectedFloorForDept">{getTranslation('px.setup.chooseFloor', 'اختر الطابق', 'Choose Floor')} *</Label>
                      <Select
                        value={addDataForm.selectedFloorForDept}
                        onValueChange={async (value) => {
                          setAddDataForm({ 
                            ...addDataForm, 
                            selectedFloorForDept: value, 
                            selectedDepartment: '',
                            departmentName: ''
                          });
                          await loadDepartments(value);
                          setEditingItem(null);
                          setShowAddForm(true);
                        }}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder={language === 'ar' ? 'اختر الطابق من القائمة' : 'Select floor from list'} />
                        </SelectTrigger>
                        <SelectContent>
                          {floors.map((floor) => (
                            <SelectItem key={floor.id} value={floor.number}>
                              {language === 'ar' ? `الطابق ${floor.number}` : `Floor ${floor.number}`} {floor.name ? ` - ${floor.name}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {addDataForm.selectedFloorForDept && (
                      <>
                        <div className="space-y-2">
                          <Label>{getTranslation('px.setup.existingDepartments', 'الأقسام الموجودة', 'Existing Departments')} - {addDataForm.selectedFloorForDept}</Label>
                          <div className="border rounded-xl divide-y">
                            {departments
                              .filter(d => {
                                // Filter by floorKey if available, otherwise by floorId
                                const floor = floors.find(f => f.number === addDataForm.selectedFloorForDept);
                                const floorKey = floor?.key || floor?.floorKey;
                                return floorKey 
                                  ? (d.floorKey === floorKey || d.floorId === addDataForm.selectedFloorForDept)
                                  : (d.floorId === addDataForm.selectedFloorForDept);
                              })
                              .map((dept) => {
                                // Get type from department data (API now includes type) or from allDepartments
                                const fullDept = allDepartments.find((ad: any) => ad.id === dept.departmentId || ad.id === dept.id);
                                const deptType = dept.type || fullDept?.type || 'BOTH';
                                const deptName = language === 'ar' 
                                  ? (dept.label_ar || dept.labelAr || dept.departmentName || fullDept?.name || dept.name) 
                                  : (dept.label_en || dept.labelEn || dept.departmentName || fullDept?.name || dept.name);
                                const typeLabel = deptType === 'OPD' ? 'OPD' : deptType === 'IPD' ? 'IPD' : 'OPD/IPD';
                                return (
                                  <div key={dept.id} className="p-4 flex items-center justify-between hover:bg-muted/50">
                                    <div>
                                      <p className="font-medium">[{typeLabel}] {deptName}</p>
                                    </div>
                                  <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => handleEditItem(dept, 'department')}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDeleteItem('department', dept.id)} className="text-destructive hover:text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                );
                              })}
                            {departments.filter(d => {
                              const floor = floors.find(f => f.number === addDataForm.selectedFloorForDept);
                              const floorKey = floor?.key || floor?.floorKey;
                              return floorKey 
                                ? (d.floorKey === floorKey || d.floorId === addDataForm.selectedFloorForDept)
                                : (d.floorId === addDataForm.selectedFloorForDept);
                            }).length === 0 && (
                              <div className="p-4 text-center text-muted-foreground">
                                {getTranslation('px.setup.noDepartments', 'لا توجد أقسام في هذا الطابق', 'No departments in this floor')}
                              </div>
                            )}
                          </div>
                        </div>

                        {(showAddForm || editingItem) && (
                          <div className="space-y-4 p-6 border rounded-xl bg-muted/30">
                            <div className="flex items-center justify-between">
                              <Label className="text-lg font-semibold">
                                {editingItem ? `${getTranslation('px.setup.editItem', 'تعديل', 'Edit')} ${getTranslation('px.setup.department', 'قسم', 'Department')}` : `${getTranslation('px.setup.addNew', 'إضافة جديد', 'Add New')} ${getTranslation('px.setup.department', 'قسم', 'Department')}`}
                              </Label>
                              <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="departmentName">{getTranslation('px.setup.departmentName', 'اسم القسم', 'Department Name')} *</Label>
                              <Input
                                id="departmentName"
                                value={addDataForm.departmentName}
                                onChange={(e) => setAddDataForm({ ...addDataForm, departmentName: e.target.value })}
                                placeholder={language === 'ar' ? 'أدخل اسم القسم الجديد' : 'Enter new department name'}
                                disabled={!!editingItem}
                              />
                            </div>
                            {addDataForm.departmentName && (
                              <Button onClick={handleAddData} disabled={isLoading || !addDataForm.departmentName} className="w-full">
                                {isLoading ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t.common?.loading || 'common.loading'}
                                  </>
                                ) : (
                                  <>
                                    {editingItem ? (
                                      <>
                                        <Edit className="mr-2 h-4 w-4" />
                                        {t.common?.save || 'common.save'}
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="mr-2 h-4 w-4" />
                                        {getTranslation('px.setup.addNew', 'إضافة جديد', 'Add New')} {getTranslation('px.setup.department', 'قسم', 'Department')}
                                      </>
                                    )}
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Room Management */}
                {addDataForm.dataType === 'room' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="selectedFloorForRoom">{getTranslation('px.setup.chooseFloor', 'اختر الطابق', 'Choose Floor')} *</Label>
                      <Select
                        value={addDataForm.selectedFloorForRoom}
                        onValueChange={async (value) => {
                          setAddDataForm({ 
                            ...addDataForm, 
                            selectedFloorForRoom: value, 
                            selectedDepartmentForRoom: '', 
                            roomNumber: ''
                          });
                          await loadDepartments(value);
                        }}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder={language === 'ar' ? 'اختر الطابق من القائمة' : 'Select floor from list'} />
                        </SelectTrigger>
                        <SelectContent>
                          {floors.map((floor) => (
                            <SelectItem key={floor.id} value={floor.number}>
                              {language === 'ar' ? `الطابق ${floor.number}` : `Floor ${floor.number}`} {floor.name ? ` - ${floor.name}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {addDataForm.selectedFloorForRoom && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="selectedDepartmentForRoom">{getTranslation('px.setup.chooseDepartment', 'اختر القسم', 'Choose Department')} *</Label>
                          <Select
                            value={addDataForm.selectedDepartmentForRoom}
                            onValueChange={(value) => setAddDataForm({ 
                              ...addDataForm, 
                              selectedDepartmentForRoom: value, 
                              roomNumber: ''
                            })}
                          >
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder={language === 'ar' ? 'اختر القسم من القائمة' : 'Select department from list'} />
                            </SelectTrigger>
                            <SelectContent>
                              {departments
                                .filter(d => {
                                  // Filter by floorKey if available, otherwise by floorId
                                  const floor = floors.find(f => f.number === addDataForm.selectedFloorForRoom);
                                  const floorKey = floor?.key || floor?.floorKey;
                                  return floorKey 
                                    ? (d.floorKey === floorKey || d.floorId === addDataForm.selectedFloorForRoom)
                                    : (d.floorId === addDataForm.selectedFloorForRoom);
                                })
                                .map((dept) => {
                                  // Get type from department data (API now includes type) or from allDepartments
                                  const fullDept = allDepartments.find((ad: any) => ad.id === dept.departmentId || ad.id === dept.id);
                                  const deptType = dept.type || fullDept?.type || 'BOTH';
                                  const deptName = language === 'ar' 
                                    ? (dept.label_ar || dept.labelAr || dept.departmentName || fullDept?.name || dept.name) 
                                    : (dept.label_en || dept.labelEn || dept.departmentName || fullDept?.name || dept.name);
                                  const typeLabel = deptType === 'OPD' ? 'OPD' : deptType === 'IPD' ? 'IPD' : 'OPD/IPD';
                                  return (
                                    <SelectItem key={dept.id} value={dept.departmentId}>
                                      [{typeLabel}] {deptName}
                                    </SelectItem>
                                  );
                                })}
                            </SelectContent>
                          </Select>
                        </div>
                        {addDataForm.selectedDepartmentForRoom && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="roomNumber">{getTranslation('px.setup.roomNumber', 'رقم الغرفة', 'Room Number')} *</Label>
                              <Input
                                id="roomNumber"
                                value={addDataForm.roomNumber}
                                onChange={(e) => setAddDataForm({ ...addDataForm, roomNumber: e.target.value })}
                                placeholder={language === 'ar' ? 'مثال: 101, 102...' : 'Example: 101, 102...'}
                              />
                            </div>
                            <Button onClick={handleAddData} disabled={isLoading || !addDataForm.roomNumber} className="w-full">
                              {isLoading ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  {t.common?.loading || 'common.loading'}
                                </>
                              ) : (
                                <>
                                  <Plus className="mr-2 h-4 w-4" />
                                  {getTranslation('px.setup.addNew', 'إضافة جديد', 'Add New')} {getTranslation('px.setup.room', 'غرفة', 'Room')}
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Complaint Type Management */}
                {addDataForm.dataType === 'complaint-type' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="selectedComplaintCategory">{getTranslation('px.setup.chooseCategory', 'اختر الفئة', 'Choose Category')} *</Label>
                      <Select
                        value={addDataForm.selectedComplaintCategory}
                        onValueChange={(value) => {
                          setAddDataForm({ 
                            ...addDataForm, 
                            selectedComplaintCategory: value,
                            selectedComplaintType: '',
                            complaintTypeName: ''
                          });
                          loadAvailableComplaintTypes(value);
                        }}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder={language === 'ar' ? 'اختر شكر أو شكوى' : 'Select praise or complaint'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="praise">{getTranslation('px.setup.praise', 'شكر', 'Praise')}</SelectItem>
                          <SelectItem value="complaint">{getTranslation('px.setup.complaint', 'شكوى', 'Complaint')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {addDataForm.selectedComplaintCategory && (
                      <>
                        <div className="space-y-2">
                          <Label>{getTranslation('px.setup.existingClassifications', 'التصنيفات الموجودة', 'Existing Classifications')}</Label>
                          <div className="border rounded-xl divide-y">
                            {availableComplaintTypes.map((type) => (
                              <div key={type.id} className="p-4 flex items-center justify-between hover:bg-muted/50">
                                <div>
                                  <p className="font-medium">{language === 'ar' ? (type.label_ar || type.labelAr || type.name) : (type.label_en || type.labelEn || type.name)}</p>
                                </div>
                                <div className="flex gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => handleEditItem(type, 'complaint-type')}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleDeleteItem('complaint-type', type.id)} className="text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                            {availableComplaintTypes.length === 0 && (
                              <div className="p-4 text-center text-muted-foreground">
                                {getTranslation('px.setup.noClassifications', 'لا توجد تصنيفات', 'No classifications')}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="complaintTypeName">{getTranslation('px.setup.classificationName', 'اسم التصنيف', 'Classification Name')} *</Label>
                          <Input
                            id="complaintTypeName"
                            value={addDataForm.complaintTypeName}
                            onChange={(e) => setAddDataForm({ ...addDataForm, complaintTypeName: e.target.value })}
                            placeholder={language === 'ar' ? `أدخل اسم التصنيف (${addDataForm.selectedComplaintCategory === 'praise' ? 'شكر' : 'شكوى'})` : `Enter classification name (${addDataForm.selectedComplaintCategory})`}
                          />
                        </div>
                        <Button onClick={handleAddData} disabled={isLoading || !addDataForm.complaintTypeName} className="w-full">
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {t.common?.loading || 'common.loading'}
                            </>
                          ) : (
                            <>
                              <Plus className="mr-2 h-4 w-4" />
                              {getTranslation('px.setup.addNew', 'إضافة جديد', 'Add New')} {getTranslation('px.setup.classification', 'تصنيف', 'Classification')}
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* Nursing Complaint Type Management (Sub Classification) */}
                {addDataForm.dataType === 'nursing-complaint-type' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{getTranslation('px.setup.existingNursingClassifications', 'التصنيفات الفرعية الموجودة', 'Existing Sub Classifications')}</Label>
                      <div className="border rounded-xl divide-y">
                        {nursingComplaintTypes.map((type) => (
                          <div key={type.id} className="p-3 flex items-center justify-between hover:bg-muted/50">
                            <div>
                              <p className="font-medium">{language === 'ar' ? (type.label_ar || type.labelAr || type.name) : (type.label_en || type.labelEn || type.name)}</p>
                              {type.complaintTypeKey && (
                                <p className="text-xs text-muted-foreground">
                                  {language === 'ar' ? 'التصنيف الرئيسي: ' : 'Parent: '}
                                  {complaintTypes.find(ct => ct.key === type.complaintTypeKey)?.label_en || type.complaintTypeKey}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" onClick={() => handleEditItem(type, 'nursing-complaint-type')}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteItem('nursing-complaint-type', type.id)} className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {nursingComplaintTypes.length === 0 && (
                          <div className="p-4 text-center text-muted-foreground">
                            {getTranslation('px.setup.noNursingClassifications', 'لا توجد تصنيفات فرعية', 'No sub classifications')}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="selectedComplaintTypeForSub">{getTranslation('px.setup.classification', 'تصنيف', 'Classification')} *</Label>
                      <Select
                        value={addDataForm.selectedComplaintTypeForSub}
                        onValueChange={(value) => {
                          setAddDataForm({ 
                            ...addDataForm, 
                            selectedComplaintTypeForSub: value,
                            nursingComplaintTypeName: ''
                          });
                          // Load sub Classifications for selected Classification
                          if (value) {
                            loadNursingComplaintTypes(value);
                          } else {
                            setNursingComplaintTypes([]);
                          }
                        }}
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder={language === 'ar' ? 'اختر التصنيف الرئيسي' : 'Select parent Classification'} />
                        </SelectTrigger>
                        <SelectContent>
                          {complaintTypes.map((type) => (
                            <SelectItem key={type.id} value={type.key || type.typeKey || type.id}>
                              {language === 'ar' ? (type.label_ar || type.labelAr || type.name) : (type.label_en || type.labelEn || type.name)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {addDataForm.selectedComplaintTypeForSub && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="nursingComplaintTypeName">{getTranslation('px.setup.nursingClassificationName', 'اسم التصنيف الفرعي', 'Sub Classification Name')} *</Label>
                          <Input
                            id="nursingComplaintTypeName"
                            value={addDataForm.nursingComplaintTypeName}
                            onChange={(e) => setAddDataForm({ ...addDataForm, nursingComplaintTypeName: e.target.value })}
                            placeholder={language === 'ar' ? 'أدخل اسم التصنيف الفرعي' : 'Enter sub classification name'}
                          />
                        </div>
                        <Button onClick={handleAddData} disabled={isLoading || !addDataForm.nursingComplaintTypeName} className="w-full">
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {t.common?.loading || 'common.loading'}
                            </>
                          ) : (
                            <>
                              <Plus className="mr-2 h-4 w-4" />
                              {getTranslation('px.setup.addNew', 'إضافة جديد', 'Add New')} {getTranslation('px.setup.nursingClassification', 'تصنيف فرعي', 'Sub Classification')}
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
