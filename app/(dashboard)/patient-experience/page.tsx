'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Building2, 
  Bed, 
  FileText, 
  AlertCircle, 
  Loader2, 
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ClipboardList,
  Plus,
  Database,
  Filter,
  Edit,
  Trash2,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { t } from '@/lib/i18n';
import { LanguageToggle } from '@/components/LanguageToggle';

type Step = 'add-data' | 'staff' | 'visit' | 'patient' | 'complaint' | 'details' | 'summary';

export default function PatientExperiencePage() {
  const { toast } = useToast();
  const { language, dir } = useLang();
  const [currentStep, setCurrentStep] = useState<Step>('add-data');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  // Data for dropdowns
  const [floors, setFloors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [complaintTypes, setComplaintTypes] = useState<any[]>([]);
  const [nursingComplaintTypes, setNursingComplaintTypes] = useState<any[]>([]);
  const [availableComplaintTypes, setAvailableComplaintTypes] = useState<any[]>([]); // For add data form
  
  // Edit mode state
  const [editingItem, setEditingItem] = useState<{ id: string; type: string } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Add data form states
  const [addDataForm, setAddDataForm] = useState({
    dataType: 'floor' as 'floor' | 'department' | 'room' | 'complaint-type' | 'nursing-complaint-type',
    // For floor
    selectedFloorForAdd: '', // Selected floor from filter
    floorNumber: '',
    floorName: '',
    // For department
    selectedFloorForDept: '', // Selected floor from filter
    selectedDepartment: '', // For editing - existing department ID
    departmentName: '', // For adding new department
    // For room
    selectedFloorForRoom: '', // Selected floor from filter
    selectedDepartmentForRoom: '', // Selected department from filter
    roomNumber: '',
    roomName: '',
    // For complaint type
    selectedComplaintCategory: '', // 'praise' or 'complaint'
    selectedComplaintType: '', // Selected existing type ID or 'new' for adding new
    complaintTypeName: '',
    // For nursing complaint type
    selectedNursingComplaintType: '', // Selected type from filter
    nursingComplaintTypeName: '',
  });
  
  const [formData, setFormData] = useState({
    // معلومات الموظف
    staffName: '',
    staffId: '',
    
    // معلومات الزيارة
    floor: '',
    department: '',
    departmentId: '',
    room: '',
    
    // معلومات المريض
    patientName: '',
    patientFileNumber: '',
    
    // التصنيف
    complaintType: '' as 'nursing' | 'maintenance' | 'diet' | 'housekeeping' | 'other' | '',
    
    // تفاصيل التصنيف (إذا كانت تمريض)
    nursingComplaintType: '' as 'call_bell' | 'nursing_error' | 'delay' | 'attitude' | 'medication' | 'other' | '',
    
    // نص الشكوى
    complaintText: '',
    
    // الموظف المشتكي عليه
    complainedStaffName: '',
  });

  const steps: { key: Step; title: string; icon: any }[] = [
    { key: 'add-data', title: 'إضافة بيانات', icon: Database },
    { key: 'staff', title: 'معلومات الموظف', icon: User },
    { key: 'visit', title: 'معلومات الزيارة', icon: Building2 },
    { key: 'patient', title: 'معلومات المريض', icon: Bed },
    { key: 'complaint', title: 'التصنيف', icon: AlertCircle },
    { key: 'details', title: 'تفاصيل الشكوى', icon: FileText },
    { key: 'summary', title: 'المراجعة', icon: ClipboardList },
  ];

  // Load initial data
  useEffect(() => {
    loadFloors();
    loadAllDepartments();
    loadComplaintTypes();
    loadNursingComplaintTypes();
  }, []);

  // Load departments when floor changes
  // For Patient Experience, load all departments regardless of floor
  useEffect(() => {
    if (formData.floor) {
      // Load all departments, then filter by floor if needed
      loadAllDepartments();
      // Also load departments for the selected floor for room filtering
      loadDepartments(formData.floor);
    } else {
      // Load all departments if no floor selected
      loadAllDepartments();
      setDepartments([]);
    }
  }, [formData.floor]);

  // Load rooms when floor and department change
  useEffect(() => {
    if (formData.floor && formData.departmentId) {
      loadRooms(formData.floor, formData.departmentId);
    } else {
      setRooms([]);
    }
  }, [formData.floor, formData.departmentId]);

  // Load available complaint types when category changes
  useEffect(() => {
    if (addDataForm.selectedComplaintCategory) {
      loadAvailableComplaintTypes(addDataForm.selectedComplaintCategory);
    } else {
      setAvailableComplaintTypes([]);
    }
  }, [addDataForm.selectedComplaintCategory]);

  async function loadFloors() {
    try {
      const response = await fetch('/api/patient-experience/data?type=floors');
      const data = await response.json();
      if (data.success) {
        setFloors(data.data);
      }
    } catch (error) {
      console.error('Error loading floors:', error);
    }
  }

  async function loadAllDepartments() {
    try {
      const response = await fetch('/api/patient-experience/data?type=all-departments');
      const data = await response.json();
      if (data.success) {
        setAllDepartments(data.data);
      }
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  }

  async function loadDepartments(floorId: string) {
    try {
      const response = await fetch(`/api/patient-experience/data?type=departments&floorId=${floorId}`);
      const data = await response.json();
      if (data.success) {
        setDepartments(data.data);
      }
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  }

  async function loadRooms(floorId: string, departmentId: string) {
    try {
      const response = await fetch(`/api/patient-experience/data?type=rooms&floorId=${floorId}&departmentId=${departmentId}`);
      const data = await response.json();
      if (data.success) {
        setRooms(data.data);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
    }
  }

  async function loadComplaintTypes() {
    try {
      const response = await fetch('/api/patient-experience/data?type=complaint-types');
      const data = await response.json();
      if (data.success) {
        setComplaintTypes(data.data);
      } else {
        // Default types if none in database
        setComplaintTypes([
          { id: '1', type: 'nursing', name: 'تمريض' },
          { id: '2', type: 'maintenance', name: 'صيانة' },
          { id: '3', type: 'diet', name: 'Diet Center' },
          { id: '4', type: 'housekeeping', name: 'النظافة' },
          { id: '5', type: 'other', name: 'أخرى' },
        ]);
      }
    } catch (error) {
      console.error('Error loading complaint types:', error);
      setComplaintTypes([
        { id: '1', type: 'nursing', name: 'تمريض' },
        { id: '2', type: 'maintenance', name: 'صيانة' },
        { id: '3', type: 'diet', name: 'Diet Center' },
        { id: '4', type: 'housekeeping', name: 'النظافة' },
        { id: '5', type: 'other', name: 'أخرى' },
      ]);
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
      } else {
        setNursingComplaintTypes([]);
      }
    } catch (error) {
      console.error('Error loading nursing complaint types:', error);
      setNursingComplaintTypes([]);
    }
  }

  async function loadAvailableComplaintTypes(category: string) {
    try {
      const response = await fetch(`/api/patient-experience/data?type=complaint-types&category=${category}`);
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
      } else if (addDataForm.dataType === 'department') {
        payload.floorId = addDataForm.selectedFloorForDept;
        if (editingItem) {
          // Editing: use existing departmentId
          payload.departmentId = addDataForm.selectedDepartment;
        } else {
          // Adding new: use departmentName
          payload.departmentName = addDataForm.departmentName;
        }
      } else if (addDataForm.dataType === 'room') {
        payload.floorId = addDataForm.selectedFloorForRoom;
        payload.departmentId = addDataForm.selectedDepartmentForRoom;
        payload.roomNumber = addDataForm.roomNumber;
        payload.roomName = addDataForm.roomName || undefined;
      } else if (addDataForm.dataType === 'complaint-type') {
        payload.category = addDataForm.selectedComplaintCategory;
        payload.type = 'other';
        payload.name = addDataForm.complaintTypeName;
      } else if (addDataForm.dataType === 'nursing-complaint-type') {
        payload.type = addDataForm.selectedNursingComplaintType;
        payload.name = addDataForm.nursingComplaintTypeName;
      }

      const method = editingItem ? 'PUT' : 'POST';
      const url = '/api/patient-experience/data';
      
      if (editingItem) {
        payload.id = editingItem.id;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: editingItem ? 'تم التعديل بنجاح' : 'تمت الإضافة بنجاح',
          description: editingItem ? 'تم تعديل البيانات بنجاح' : 'تم إضافة البيانات بنجاح',
        });
        
        // Reset form
        const currentDataType = addDataForm.dataType;
        setAddDataForm({
          dataType: 'floor',
          selectedFloorForAdd: '',
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
          loadNursingComplaintTypes();
        }
      } else {
        throw new Error(data.error || 'فشل في العملية');
      }
    } catch (error: any) {
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
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'تم الحذف بنجاح',
          description: 'تم حذف العنصر بنجاح',
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
        selectedNursingComplaintType: item.type,
        nursingComplaintTypeName: item.name,
      });
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
      selectedNursingComplaintType: '',
      nursingComplaintTypeName: '',
    });
  }

  function validateStep(step: Step): boolean {
    switch (step) {
      case 'add-data':
        return true; // Optional step
      case 'staff':
        if (!formData.staffName || !formData.staffId) {
          toast({
            title: 'خطأ في التحقق',
            description: 'يرجى إدخال اسم الموظف ورقمه الوظيفي',
            variant: 'destructive',
          });
          return false;
        }
        return true;
      case 'visit':
        if (!formData.floor || !formData.departmentId || !formData.room) {
          toast({
            title: 'خطأ في التحقق',
            description: 'يرجى اختيار الطابق والقسم والغرفة',
            variant: 'destructive',
          });
          return false;
        }
        return true;
      case 'patient':
        if (!formData.patientFileNumber) {
          toast({
            title: 'خطأ في التحقق',
            description: 'يرجى إدخال رقم ملف المريض',
            variant: 'destructive',
          });
          return false;
        }
        return true;
      case 'complaint':
        if (!formData.complaintType) {
          toast({
            title: 'خطأ في التحقق',
            description: 'يرجى اختيار التصنيف',
            variant: 'destructive',
          });
          return false;
        }
        if (formData.complaintType === 'nursing' && !formData.nursingComplaintType) {
          toast({
            title: 'خطأ في التحقق',
            description: 'يرجى اختيار التصنيف المتعلق بالتمريض',
            variant: 'destructive',
          });
          return false;
        }
        return true;
      case 'details':
        if (!formData.complaintText) {
          toast({
            title: 'خطأ في التحقق',
            description: 'يرجى إدخال نص الشكوى',
            variant: 'destructive',
          });
          return false;
        }
        return true;
      default:
        return true;
    }
  }

  function handleNext() {
    if (validateStep(currentStep)) {
      const stepOrder: Step[] = ['add-data', 'staff', 'visit', 'patient', 'complaint', 'details', 'summary'];
      const currentIndex = stepOrder.indexOf(currentStep);
      if (currentIndex < stepOrder.length - 1) {
        setCurrentStep(stepOrder[currentIndex + 1]);
      }
    }
  }

  function handleBack() {
    const stepOrder: Step[] = ['add-data', 'staff', 'visit', 'patient', 'complaint', 'details', 'summary'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  }

  async function handleSubmit() {
    if (!validateStep('details')) return;

    setIsLoading(true);
    try {
      // Get keys from selected items
      const selectedFloor = floors.find(f => f.number === formData.floor);
      const selectedDept = (allDepartments.length > 0 ? allDepartments : departments).find(d => (d.id || d.departmentId) === formData.departmentId);
      const selectedRoom = rooms.find(r => r.roomNumber === formData.room);
      const selectedComplaintType = complaintTypes.find(ct => ct.type === formData.complaintType);
      const selectedNursingType = formData.complaintType === 'nursing' 
        ? nursingComplaintTypes.find(nct => nct.type === formData.nursingComplaintType)
        : null;

      // Determine category key
      const categoryKey = selectedComplaintType?.category === 'praise' ? 'PRAISE' : 'COMPLAINT';

      const response = await fetch('/api/patient-experience', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Display values (for quick reference)
          staffName: formData.staffName,
          staffId: formData.staffId,
          floor: formData.floor,
          department: formData.department || selectedDept?.departmentName,
          departmentId: formData.departmentId,
          room: formData.room,
          patientName: formData.patientName,
          patientFileNumber: formData.patientFileNumber,
          complaintType: formData.complaintType as any,
          nursingComplaintType: formData.nursingComplaintType || undefined,
          complaintText: formData.complaintText,
          complainedStaffName: formData.complainedStaffName || undefined,
          // English keys (for dashboard consistency)
          floorKey: selectedFloor?.key || selectedFloor?.floorKey || `FLOOR_${formData.floor}`,
          departmentKey: selectedDept?.departmentKey || `DEPT_${formData.departmentId}`,
          roomKey: selectedRoom?.key || selectedRoom?.roomKey || `ROOM_${formData.room}`,
          typeKey: selectedComplaintType?.typeKey || selectedComplaintType?.domainKey || (formData.complaintType ? formData.complaintType.toUpperCase() : 'OTHER'),
          categoryKey,
          nursingTypeKey: selectedNursingType?.typeKey || (formData.nursingComplaintType ? formData.nursingComplaintType.toUpperCase().replace(/_/g, '_') : undefined),
          // Bilingual details
          detailsLang: language,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'تم الحفظ بنجاح',
          description: 'تم تسجيل الشكوى بنجاح',
        });
        setIsSubmitted(true);
      } else {
        throw new Error(data.error || 'فشل في حفظ البيانات');
      }
    } catch (error: any) {
      toast({
        title: 'خطأ في الحفظ',
        description: error.message || 'فشل في حفظ البيانات',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleReset() {
    setFormData({
      staffName: '',
      staffId: '',
      floor: '',
      department: '',
      departmentId: '',
      room: '',
      patientName: '',
      patientFileNumber: '',
      complaintType: '',
      nursingComplaintType: '',
      complaintText: '',
      complainedStaffName: '',
    });
    setCurrentStep('add-data');
    setIsSubmitted(false);
  }

  if (isSubmitted) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">تجربة المريض</h1>
          <p className="text-muted-foreground">تسجيل شكاوى المرضى</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <h2 className="text-2xl font-semibold">{t('px.visit.success', language)}</h2>
              <p className="text-muted-foreground text-center">
                {t('px.visit.successMessage', language)}
              </p>
              <Button onClick={handleReset} className="mt-4">
                {t('px.visit.newRecord', language)}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={dir}>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{t('px.visit.title', language)}</h1>
          <p className="text-muted-foreground">{t('px.visit.subtitle', language)}</p>
        </div>
        <LanguageToggle />
      </div>

      {/* Progress Steps */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6 overflow-x-auto">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.key;
              const stepIndex = steps.findIndex(s => s.key === currentStep);
              const isCompleted = index < stepIndex;
              
              return (
                <div key={step.key} className="flex items-center flex-1 min-w-[80px]">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground border-primary'
                          : isCompleted
                          ? 'bg-green-500 text-white border-green-500'
                          : 'bg-muted text-muted-foreground border-muted'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <span className={`text-xs mt-2 text-center ${isActive ? 'font-semibold' : ''}`}>
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-1 flex-1 mx-2 ${
                        isCompleted ? 'bg-green-500' : 'bg-muted'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Form Steps */}
      <Card>
        <CardHeader>
          <CardTitle>
            {steps.find(s => s.key === currentStep)?.title}
          </CardTitle>
          <CardDescription>
            {currentStep === 'add-data' && 'أضف بيانات جديدة (طوابق، أقسام، غرف، تصنيفات)'}
            {currentStep === 'staff' && 'أدخل معلومات الموظف'}
            {currentStep === 'visit' && 'اختر الطابق والقسم والغرفة'}
            {currentStep === 'patient' && 'أدخل معلومات المريض'}
            {currentStep === 'complaint' && 'اختر التصنيف'}
            {currentStep === 'details' && 'أدخل تفاصيل الشكوى'}
            {currentStep === 'summary' && 'راجع المعلومات قبل الحفظ'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step 0: Add Data */}
          {currentStep === 'add-data' && (
            <div className="space-y-6">
              {/* List/Select for choosing data type */}
              <div className="space-y-2">
                <Label htmlFor="dataTypeSelect">{t('px.setup.chooseDataType', language)} *</Label>
                <Select
                  value={addDataForm.dataType}
                  onValueChange={(value) => {
                    // Reset all form data when changing type
                    setAddDataForm({
                      dataType: value as any,
                      selectedFloorForAdd: '',
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
                      selectedNursingComplaintType: '',
                      nursingComplaintTypeName: '',
                    });
                    setEditingItem(null);
                    setShowAddForm(false);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('px.setup.chooseDataType', language)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="floor">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span>{t('px.setup.floor', language)}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="department">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span>{t('px.setup.department', language)}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="room">
                      <div className="flex items-center gap-2">
                        <Bed className="h-4 w-4" />
                        <span>{t('px.setup.room', language)}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="complaint-type">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        <span>{t('px.setup.classification', language)}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="nursing-complaint-type">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        <span>{t('px.setup.nursingClassification', language)}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Form Content Based on Selected Type */}
              {addDataForm.dataType && (
                <div className="border-t pt-6">

                {/* إدارة الطوابق */}
                {addDataForm.dataType === 'floor' && (
                  <div className="space-y-4">
                    {/* قائمة الطوابق الموجودة */}
                    <div className="space-y-2">
                      <Label>{t('px.setup.existingFloors', language)}</Label>
                      <div className="border rounded-lg divide-y">
                        {floors.map((floor) => (
                          <div key={floor.id} className="p-3 flex items-center justify-between hover:bg-muted/50">
                            <div>
                              <p className="font-medium">{language === 'ar' ? (floor.labelAr || `الطابق ${floor.number}`) : (floor.labelEn || `Floor ${floor.number}`)}</p>
                              {floor.name && <p className="text-sm text-muted-foreground">{floor.name}</p>}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditItem(floor, 'floor')}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteItem('floor', floor.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {floors.length === 0 && (
                          <div className="p-4 text-center text-muted-foreground">
                            {t('px.setup.noFloors', language)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* نموذج الإضافة/التعديل */}
                    {(showAddForm || editingItem) && (
                      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between">
                          <Label className="text-lg font-semibold">
                            {editingItem ? `${t('px.setup.editItem', language)} ${t('px.setup.floor', language)}` : `${t('px.setup.addNew', language)} ${t('px.setup.floor', language)}`}
                          </Label>
                          <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="floorNumber">{t('px.setup.floorNumber', language)} *</Label>
                          <Input
                            id="floorNumber"
                            value={addDataForm.floorNumber}
                            onChange={(e) => setAddDataForm({ ...addDataForm, floorNumber: e.target.value })}
                            placeholder="مثال: 1, 2, 3..."
                          />
                        </div>
                        <Button 
                          onClick={handleAddData} 
                          disabled={isLoading || !addDataForm.floorNumber}
                          className="w-full"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {editingItem ? t('common.loading', language) : t('common.loading', language)}
                            </>
                          ) : (
                            <>
                              {editingItem ? (
                                <>
                                  <Edit className="mr-2 h-4 w-4" />
                                  {t('common.save', language)}
                                </>
                              ) : (
                                <>
                                  <Plus className="mr-2 h-4 w-4" />
                                  {t('px.setup.addNew', language)} {t('px.setup.floor', language)}
                                </>
                              )}
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* زر إضافة جديد */}
                    {!showAddForm && !editingItem && (
                      <Button 
                        onClick={() => setShowAddForm(true)}
                        variant="outline"
                        className="w-full"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {t('px.setup.addNew', language)} {t('px.setup.floor', language)}
                      </Button>
                    )}
                  </div>
                )}

                {/* إدارة الأقسام */}
                {addDataForm.dataType === 'department' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="selectedFloorForDept">{t('px.setup.chooseFloor', language)} *</Label>
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
                          setShowAddForm(true); // Show form immediately
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الطابق من القائمة" />
                        </SelectTrigger>
                        <SelectContent>
                          {floors.map((floor) => (
                            <SelectItem key={floor.id} value={floor.number}>
                              الطابق {floor.number} {floor.name ? `- ${floor.name}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {addDataForm.selectedFloorForDept && (
                      <>
                        {/* قائمة الأقسام الموجودة في الطابق */}
                        <div className="space-y-2">
                          <Label>{t('px.setup.existingDepartments', language)} - {addDataForm.selectedFloorForDept}</Label>
                          <div className="border rounded-lg divide-y">
                            {departments
                              .filter(d => d.floorId === addDataForm.selectedFloorForDept)
                              .map((dept) => (
                                <div key={dept.id} className="p-3 flex items-center justify-between hover:bg-muted/50">
                                  <div>
                                    <p className="font-medium">{language === 'ar' ? (dept.labelAr || dept.departmentName) : (dept.labelEn || dept.departmentName)}</p>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditItem(dept, 'department')}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteItem('department', dept.id)}
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            {departments.filter(d => d.floorId === addDataForm.selectedFloorForDept).length === 0 && (
                              <div className="p-4 text-center text-muted-foreground">
                                {t('px.setup.noDepartments', language)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* نموذج الإضافة/التعديل */}
                        {(showAddForm || editingItem) && (
                          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                            <div className="flex items-center justify-between">
                              <Label className="text-lg font-semibold">
                                {editingItem ? `${t('px.setup.editItem', language)} ${t('px.setup.department', language)}` : `${t('px.setup.addNew', language)} ${t('px.setup.department', language)}`}
                              </Label>
                              <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="departmentName">{t('px.setup.departmentName', language)} *</Label>
                              <Input
                                id="departmentName"
                                value={addDataForm.departmentName}
                                onChange={(e) => setAddDataForm({ ...addDataForm, departmentName: e.target.value })}
                                placeholder="أدخل اسم القسم الجديد"
                                disabled={!!editingItem}
                              />
                            </div>
                            {addDataForm.departmentName && (
                              <Button 
                                onClick={handleAddData} 
                                disabled={isLoading || !addDataForm.departmentName}
                                className="w-full"
                              >
                                {isLoading ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {editingItem ? 'جاري التعديل...' : 'جاري الإضافة...'}
                                  </>
                                ) : (
                                  <>
                                    {editingItem ? (
                                      <>
                                        <Edit className="mr-2 h-4 w-4" />
                                        حفظ التعديلات
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="mr-2 h-4 w-4" />
                                        إضافة قسم للطابق
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

                {/* إضافة غرفة - متداخل مع الطابق والقسم */}
                {addDataForm.dataType === 'room' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="selectedFloorForRoom">اختر الطابق (فلتر) *</Label>
                      <Select
                        value={addDataForm.selectedFloorForRoom}
                        onValueChange={async (value) => {
                          setAddDataForm({ 
                            ...addDataForm, 
                            selectedFloorForRoom: value, 
                            selectedDepartmentForRoom: '', 
                            roomNumber: '', 
                            roomName: '' 
                          });
                          await loadDepartments(value);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الطابق من القائمة" />
                        </SelectTrigger>
                        <SelectContent>
                          {floors.map((floor) => (
                            <SelectItem key={floor.id} value={floor.number}>
                              الطابق {floor.number} {floor.name ? `- ${floor.name}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {addDataForm.selectedFloorForRoom && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="selectedDepartmentForRoom">اختر القسم (فلتر) *</Label>
                          <Select
                            value={addDataForm.selectedDepartmentForRoom}
                            onValueChange={(value) => setAddDataForm({ 
                              ...addDataForm, 
                              selectedDepartmentForRoom: value, 
                              roomNumber: '', 
                              roomName: '' 
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="اختر القسم من القائمة" />
                            </SelectTrigger>
                            <SelectContent>
                              {departments
                                .filter(d => d.floorId === addDataForm.selectedFloorForRoom)
                                .map((dept) => {
                                  // Get type from department data or from allDepartments
                                  const fullDept = allDepartments.find((ad: any) => ad.id === dept.departmentId || ad.id === dept.id);
                                  const deptType = dept.type || fullDept?.type || 'BOTH';
                                  const deptName = language === 'ar' 
                                    ? (dept.labelAr || dept.label_ar || dept.departmentName || fullDept?.name) 
                                    : (dept.labelEn || dept.label_en || dept.departmentName || fullDept?.name);
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
                              <Label htmlFor="roomNumber">رقم الغرفة *</Label>
                              <Input
                                id="roomNumber"
                                value={addDataForm.roomNumber}
                                onChange={(e) => setAddDataForm({ ...addDataForm, roomNumber: e.target.value })}
                                placeholder="مثال: 101, 102..."
                              />
                            </div>
                            <Button 
                              onClick={handleAddData} 
                              disabled={isLoading || !addDataForm.roomNumber}
                              className="w-full"
                            >
                              {isLoading ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  جاري الإضافة...
                                </>
                              ) : (
                                <>
                                  <Plus className="mr-2 h-4 w-4" />
                                  إضافة غرفة
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* إضافة تصنيف */}
                {addDataForm.dataType === 'complaint-type' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="selectedComplaintCategory">اختر شكر أو شكوى (فلتر) *</Label>
                      <Select
                        value={addDataForm.selectedComplaintCategory}
                        onValueChange={(value) => {
                          setAddDataForm({ 
                            ...addDataForm, 
                            selectedComplaintCategory: value,
                            selectedComplaintType: '',
                            complaintTypeName: ''
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر شكر أو شكوى" />
                        </SelectTrigger>
                          <SelectContent>
                          <SelectItem value="praise">{t('px.setup.praise', language)}</SelectItem>
                          <SelectItem value="complaint">{t('px.setup.complaint', language)}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {addDataForm.selectedComplaintCategory && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="selectedComplaintType">اختر التصنيف (فلتر) *</Label>
                          <Select
                            value={addDataForm.selectedComplaintType}
                            onValueChange={(value) => {
                              if (value === 'new') {
                                setAddDataForm({ 
                                  ...addDataForm, 
                                  selectedComplaintType: 'new',
                                  complaintTypeName: ''
                                });
                              } else {
                                setAddDataForm({ 
                                  ...addDataForm, 
                                  selectedComplaintType: value,
                                  complaintTypeName: ''
                                });
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="اختر التصنيف من القائمة أو أضف جديد" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableComplaintTypes.map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                  {language === 'ar' ? (type.labelAr || type.name) : (type.labelEn || type.name)}
                                </SelectItem>
                              ))}
                              <SelectItem value="new" className="font-semibold text-primary border-t">
                                <div className="flex items-center gap-2">
                                  <Plus className="h-4 w-4" />
                                  <span>إضافة تصنيف جديد</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* إذا اختار تصنيف موجود */}
                        {addDataForm.selectedComplaintType && addDataForm.selectedComplaintType !== 'new' && (
                          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-sm text-green-800 font-medium">
                              ✓ تم اختيار التصنيف: {availableComplaintTypes.find(t => t.id === addDataForm.selectedComplaintType)?.name}
                            </p>
                            <p className="text-xs text-green-600 mt-1">
                              هذا التصنيف موجود بالفعل في النظام
                            </p>
                          </div>
                        )}

                        {/* إذا اختار إضافة جديد */}
                        {addDataForm.selectedComplaintType === 'new' && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="complaintTypeName">اسم التصنيف *</Label>
                              <Input
                                id="complaintTypeName"
                                value={addDataForm.complaintTypeName}
                                onChange={(e) => setAddDataForm({ ...addDataForm, complaintTypeName: e.target.value })}
                                placeholder={`أدخل اسم التصنيف (${addDataForm.selectedComplaintCategory === 'praise' ? 'شكر' : 'شكوى'})`}
                              />
                            </div>
                            <Button 
                              onClick={handleAddData} 
                              disabled={isLoading || !addDataForm.complaintTypeName}
                              className="w-full"
                            >
                              {isLoading ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  جاري الإضافة...
                                </>
                              ) : (
                                <>
                                  <Plus className="mr-2 h-4 w-4" />
                                  إضافة تصنيف جديد
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* إضافة تصنيف تمريض */}
                {addDataForm.dataType === 'nursing-complaint-type' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="selectedNursingComplaintType">اختر التصنيف (فلتر) *</Label>
                      <Select
                        value={addDataForm.selectedNursingComplaintType}
                        onValueChange={(value) => setAddDataForm({ ...addDataForm, selectedNursingComplaintType: value as any })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر التصنيف من القائمة" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="call_bell">Call Bell</SelectItem>
                          <SelectItem value="nursing_error">خطأ تمريضي</SelectItem>
                          <SelectItem value="delay">تأخير</SelectItem>
                          <SelectItem value="attitude">سلوك/موقف</SelectItem>
                          <SelectItem value="medication">دواء</SelectItem>
                          <SelectItem value="other">أخرى</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {addDataForm.selectedNursingComplaintType && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="nursingComplaintTypeName">اسم التصنيف *</Label>
                          <Input
                            id="nursingComplaintTypeName"
                            value={addDataForm.nursingComplaintTypeName}
                            onChange={(e) => setAddDataForm({ ...addDataForm, nursingComplaintTypeName: e.target.value })}
                            placeholder="أدخل اسم التصنيف (شكر أو شكوى)"
                          />
                        </div>
                        <Button 
                          onClick={handleAddData} 
                          disabled={isLoading || !addDataForm.nursingComplaintTypeName}
                          className="w-full"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              جاري الإضافة...
                            </>
                          ) : (
                            <>
                              <Plus className="mr-2 h-4 w-4" />
                              إضافة تصنيف تمريض
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
          )}

          {/* Step 1: Staff Information */}
          {currentStep === 'staff' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="staffName">{t('px.visit.staffName', language)} *</Label>
                <Input
                  id="staffName"
                  value={formData.staffName}
                  onChange={(e) => setFormData({ ...formData, staffName: e.target.value })}
                  placeholder="أدخل اسم الموظف"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staffId">{t('px.visit.staffId', language)} *</Label>
                <Input
                  id="staffId"
                  value={formData.staffId}
                  onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                  placeholder="أدخل الرقم الوظيفي"
                  required
                />
              </div>
            </div>
          )}

          {/* Step 2: Visit Information */}
          {currentStep === 'visit' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="floor">{t('px.visit.floor', language)} *</Label>
                <Select
                  value={formData.floor}
                  onValueChange={(value) => {
                    setFormData({ 
                      ...formData, 
                      floor: value,
                      department: '',
                      departmentId: '',
                      room: ''
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الطابق" />
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
              <div className="space-y-2">
                <Label htmlFor="department">{t('px.visit.department', language)} *</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(value) => {
                    const dept = (allDepartments.length > 0 ? allDepartments : departments).find(d => (d.id || d.departmentId) === value);
                    setFormData({ 
                      ...formData, 
                      departmentId: value,
                      department: dept?.departmentName || '',
                      room: ''
                    });
                  }}
                  disabled={!formData.floor}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Use allDepartments to show all hospital departments, not just floor-specific ones */}
                    {(allDepartments.length > 0 ? allDepartments : departments).map((dept) => {
                      const deptType = dept.type || 'BOTH';
                      const deptName = language === 'ar' ? (dept.labelAr || dept.label_ar || dept.name || dept.departmentName) : (dept.labelEn || dept.label_en || dept.name || dept.departmentName);
                      const typeLabel = deptType === 'OPD' ? 'OPD' : deptType === 'IPD' ? 'IPD' : 'OPD/IPD';
                      return (
                        <SelectItem key={dept.id} value={dept.id || dept.departmentId}>
                          [{typeLabel}] {deptName}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="room">{t('px.visit.room', language)} *</Label>
                <Select
                  value={formData.room}
                  onValueChange={(value) => setFormData({ ...formData, room: value })}
                  disabled={!formData.departmentId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الغرفة" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map((room) => (
                      <SelectItem key={room.id} value={room.roomNumber}>
                        {language === 'ar' ? (room.labelAr || `غرفة ${room.roomNumber}`) : (room.labelEn || `Room ${room.roomNumber}`)} {room.roomName ? ` - ${room.roomName}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 3: Patient Information */}
          {currentStep === 'patient' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="patientName">{t('px.visit.patientName', language)}</Label>
                <Input
                  id="patientName"
                  value={formData.patientName}
                  onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                  placeholder="أدخل اسم المريض"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patientFileNumber">{t('px.visit.patientFileNumber', language)} *</Label>
                <Input
                  id="patientFileNumber"
                  value={formData.patientFileNumber}
                  onChange={(e) => setFormData({ ...formData, patientFileNumber: e.target.value })}
                  placeholder="أدخل رقم ملف المريض"
                  required
                />
              </div>
            </div>
          )}

          {/* Step 4: Complaint Type */}
          {currentStep === 'complaint' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="complaintType">{t('px.visit.classification', language)} *</Label>
                <Select
                  value={formData.complaintType}
                  onValueChange={(value) => {
                    const selectedComplaintType = complaintTypes.find(t => t.type === value || t.id === value);
                    const complaintTypeKey = selectedComplaintType?.key || selectedComplaintType?.typeKey || selectedComplaintType?.id;
                    
                    setFormData({ 
                      ...formData, 
                      complaintType: value as any,
                      nursingComplaintType: '' // Reset nursing complaint type when changing complaint type
                    });
                    
                    // Load sub Classifications for the selected Classification
                    if (complaintTypeKey) {
                      loadNursingComplaintTypes(complaintTypeKey);
                    } else {
                      setNursingComplaintTypes([]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر التصنيف (شكر أو شكوى)" />
                  </SelectTrigger>
                  <SelectContent>
                    {complaintTypes.map((type) => (
                      <SelectItem key={type.id} value={type.type}>
                        {language === 'ar' ? (type.labelAr || type.name) : (type.labelEn || type.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Show sub Classification for any selected Classification, not just 'nursing' */}
              {formData.complaintType && nursingComplaintTypes.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="nursingComplaintType">{t('px.visit.nursingClassification', language)} *</Label>
                  <Select
                    value={formData.nursingComplaintType}
                    onValueChange={(value) => setFormData({ ...formData, nursingComplaintType: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر التصنيف الفرعي" />
                    </SelectTrigger>
                    <SelectContent>
                      {nursingComplaintTypes.map((type) => (
                        <SelectItem key={type.id} value={type.type}>
                          {language === 'ar' ? (type.labelAr || type.name) : (type.labelEn || type.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Complaint Details */}
          {currentStep === 'details' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="complaintText">{t('px.visit.details', language)} *</Label>
                <Textarea
                  id="complaintText"
                  value={formData.complaintText}
                  onChange={(e) => setFormData({ ...formData, complaintText: e.target.value })}
                  placeholder="أدخل تفاصيل الشكوى..."
                  rows={6}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="complainedStaffName">{t('px.visit.complainedStaff', language)}</Label>
                <Input
                  id="complainedStaffName"
                  value={formData.complainedStaffName}
                  onChange={(e) => setFormData({ ...formData, complainedStaffName: e.target.value })}
                  placeholder="أدخل اسم الموظف (اختياري)"
                />
              </div>
            </div>
          )}

          {/* Step 6: Summary */}
          {currentStep === 'summary' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">اسم الموظف</Label>
                  <p className="font-medium">{formData.staffName}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">الرقم الوظيفي</Label>
                  <p className="font-medium">{formData.staffId}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">الطابق</Label>
                  <p className="font-medium">الطابق {formData.floor}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">اسم القسم</Label>
                  <p className="font-medium">{formData.department}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">الغرفة</Label>
                  <p className="font-medium">{formData.room}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">اسم المريض</Label>
                  <p className="font-medium">{formData.patientName}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">رقم ملف المريض</Label>
                  <p className="font-medium">{formData.patientFileNumber}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">التصنيف</Label>
                  <Badge variant="outline">
                    {complaintTypes.find(t => t.type === formData.complaintType)?.name || formData.complaintType}
                  </Badge>
                </div>
                {formData.complaintType === 'nursing' && formData.nursingComplaintType && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">التصنيف (تمريض)</Label>
                    <Badge variant="outline">
                      {nursingComplaintTypes.find(t => t.type === formData.nursingComplaintType)?.name || formData.nursingComplaintType}
                    </Badge>
                  </div>
                )}
                {formData.complainedStaffName && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">الموظف المشتكي عليه</Label>
                    <p className="font-medium">{formData.complainedStaffName}</p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">نص الشكوى</Label>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="whitespace-pre-wrap">{formData.complaintText}</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 'add-data'}
            >
              <ArrowRight className="mr-2 h-4 w-4" />
              {t('common.previous', language)}
            </Button>
            {currentStep === 'summary' ? (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.loading', language)}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {t('common.save', language)}
                  </>
                )}
              </Button>
            ) : (
              <Button type="button" onClick={handleNext}>
                {t('common.next', language)}
                <ArrowLeft className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
