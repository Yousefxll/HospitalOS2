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
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
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
  Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';
import { useTranslation } from '@/hooks/use-translation';
import { LanguageToggle } from '@/components/LanguageToggle';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type Step = 'staff' | 'visit' | 'patient' | 'complaint' | 'details' | 'summary';

export default function PatientExperienceVisitPage() {
  const { toast } = useToast();
  const { language, dir } = useLang();
  const { t, translate } = useTranslation();
  const [currentStep, setCurrentStep] = useState<Step>('staff');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showCaseClosureDialog, setShowCaseClosureDialog] = useState(false);
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);
  const [createdVisitData, setCreatedVisitData] = useState<any>(null);
  const [isClosingCase, setIsClosingCase] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Data for dropdowns
  const [floors, setFloors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [complaintDomains, setComplaintDomains] = useState<any[]>([]);
  const [complaintTypes, setComplaintTypes] = useState<any[]>([]);
  const [nursingComplaintTypes, setNursingComplaintTypes] = useState<any[]>([]);
  
  // Classification type
  type Classification = {
    id: string;
    type: 'PRAISE' | 'COMPLAINT'; // New: praise or complaint
    domainKey?: string; // Only for complaint
    typeKey?: string; // Only for complaint
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; // Only for complaint
    shift?: 'NIGHT' | 'DAY' | 'DAY_NIGHT' | 'BOTH'; // Only for complaint
    // For praise only
    satisfactionPercentage?: number;
    praiseText?: string;
    praisedStaffName?: string;
  };
  
  const [formData, setFormData] = useState({
    staffName: '',
    staffId: '',
    // Canonical keys (for storage)
    floorKey: '',
    departmentKey: '',
    roomKey: '',
    classifications: [] as Classification[],
    patientName: '',
    patientFileNumber: '',
    complaintText: '',
    complainedStaffName: '',
    // Patient satisfaction
    isPatientSatisfied: false,
    satisfactionPercentage: 0,
  });

  const steps: { key: Step; title: string; icon: any }[] = [
    { key: 'staff', title: t.px.visit.stepStaff, icon: User },
    { key: 'visit', title: t.px.visit.stepVisit, icon: Building2 },
    { key: 'patient', title: t.px.visit.stepPatient, icon: Bed },
    { key: 'complaint', title: t.px.visit.stepClassification, icon: AlertCircle },
    { key: 'details', title: t.px.visit.stepDetails, icon: FileText },
    { key: 'summary', title: t.px.visit.stepSummary, icon: ClipboardList },
  ];

  useEffect(() => {
    setMounted(true);
    loadFloors();
    loadComplaintDomains();
    loadComplaintTypes();
    loadNursingComplaintTypes();
    loadCurrentUser();
  }, []);

  async function loadCurrentUser() {
    try {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Unauthorized: Please login again');
          // Redirect to login if session expired
          if (typeof window !== 'undefined') {
            window.location.href = '/login?sessionExpired=true';
          }
          return;
        }
        throw new Error(`Failed to load user: ${response.status}`);
      }
        const data = await response.json();
        const user = data.user;
        // Auto-fill staff name and ID from current user
        setFormData(prev => ({
          ...prev,
          staffName: `${user.firstName} ${user.lastName}`.trim(),
          staffId: user.staffId || '',
        }));
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  }

  // Load all departments for Patient Experience (all hospital departments)
  useEffect(() => {
    loadAllDepartments();
  }, []);

  // Load departments when floorKey changes (for room filtering)
  useEffect(() => {
    if (formData.floorKey) {
      loadDepartmentsByKey(formData.floorKey);
    } else {
      setDepartments([]);
    }
  }, [formData.floorKey]);

  async function loadAllDepartments() {
    try {
      const response = await fetch('/api/patient-experience/data?type=all-departments');
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Unauthorized: Please login again');
          return;
        }
        throw new Error(`Failed to load all departments: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setAllDepartments(data.data || []);
      }
    } catch (error) {
      console.error('Error loading all departments:', error);
      setAllDepartments([]);
    }
  }

  // Load rooms when departmentKey changes (need both floorKey and departmentKey)
  useEffect(() => {
    if (formData.floorKey && formData.departmentKey) {
      loadRoomsByKey(formData.floorKey, formData.departmentKey);
    } else {
      setRooms([]);
    }
  }, [formData.floorKey, formData.departmentKey]);

  async function loadFloors() {
    try {
      const response = await fetch('/api/patient-experience/data?type=floors');
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Unauthorized: Please login again');
          toast({
            title: language === 'ar' ? 'خطأ في المصادقة' : 'Authentication Error',
            description: language === 'ar' ? 'يرجى تسجيل الدخول مرة أخرى' : 'Please login again',
            variant: 'destructive',
          });
          return;
        }
        throw new Error(`Failed to load floors: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setFloors(data.data || []);
      }
    } catch (error) {
      console.error('Error loading floors:', error);
      setFloors([]);
    }
  }

  async function loadDepartmentsByKey(floorKey: string) {
    try {
      const response = await fetch(`/api/patient-experience/data?type=departments&floorKey=${floorKey}`);
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Unauthorized: Please login again');
          return;
        }
        throw new Error(`Failed to load departments: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setDepartments(data.data || []);
      } else {
        setDepartments([]);
      }
    } catch (error) {
      console.error('Error loading departments:', error);
      setDepartments([]);
    }
  }

  async function loadRoomsByKey(floorKey: string, departmentKey: string) {
    try {
      const response = await fetch(`/api/patient-experience/data?type=rooms&floorKey=${floorKey}&departmentKey=${departmentKey}`);
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Unauthorized: Please login again');
          return;
        }
        throw new Error(`Failed to load rooms: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setRooms(data.data || []);
      } else {
        console.error('Error loading rooms:', data.error);
        setRooms([]);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
      setRooms([]);
    }
  }

  async function loadComplaintDomains() {
    try {
      const response = await fetch('/api/patient-experience/data?type=complaint-domains');
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Unauthorized: Please login again');
          return;
        }
        throw new Error(`Failed to load complaint domains: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setComplaintDomains(data.data || []);
      }
    } catch (error) {
      console.error('Error loading complaint domains:', error);
      setComplaintDomains([]);
    }
  }

  async function loadComplaintTypes() {
    try {
      const response = await fetch('/api/patient-experience/data?type=complaint-types');
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Unauthorized: Please login again');
          return;
        }
        throw new Error(`Failed to load complaint types: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setComplaintTypes(data.data || []);
      }
    } catch (error) {
      console.error('Error loading complaint types:', error);
      setComplaintTypes([]);
    }
  }

  async function loadComplaintTypesByDomain(domainKey: string) {
    try {
      const response = await fetch(`/api/patient-experience/data?type=complaint-types&domainKey=${domainKey}`);
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Unauthorized: Please login again');
          return;
        }
        throw new Error(`Failed to load complaint types: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setComplaintTypes(data.data || []);
      }
    } catch (error) {
      console.error('Error loading complaint types by domain:', error);
      setComplaintTypes([]);
    }
  }

  async function loadNursingComplaintTypes() {
    try {
      const response = await fetch('/api/patient-experience/data?type=nursing-complaint-types');
      if (!response.ok) {
        if (response.status === 401) {
          console.warn('Unauthorized: Please login again');
          return;
        }
        throw new Error(`Failed to load nursing complaint types: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setNursingComplaintTypes(data.data || []);
      }
    } catch (error) {
      console.error('Error loading nursing complaint types:', error);
      setNursingComplaintTypes([]);
    }
  }

  function validateStep(step: Step): boolean {
    switch (step) {
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
        if (!formData.floorKey || !formData.departmentKey || !formData.roomKey) {
          toast({
            title: t.common.error,
            description: language === 'ar' ? 'يرجى اختيار الطابق والقسم والغرفة' : 'Please select floor, department, and room',
            variant: 'destructive',
          });
          return false;
        }
        return true;
      case 'patient':
        if (!formData.patientFileNumber) {
          toast({
            title: t.common.error,
            description: language === 'ar' ? 'يرجى إدخال رقم ملف المريض' : 'Please enter patient file number',
            variant: 'destructive',
          });
          return false;
        }
        return true;
      case 'complaint':
        if (formData.classifications.length === 0) {
          toast({
            title: t.common.error,
            description: language === 'ar' ? 'يرجى إضافة تصنيف واحد على الأقل' : 'Please add at least one classification',
            variant: 'destructive',
          });
          return false;
        }
        // Validate each classification
        for (const classification of formData.classifications) {
          if (!classification.type) {
            toast({
              title: t.common.error,
              description: language === 'ar' ? 'يرجى اختيار نوع التصنيف (شكر أو شكوى)' : 'Please select classification type (praise or complaint)',
              variant: 'destructive',
            });
            return false;
          }
          
          if (classification.type === 'PRAISE') {
            // Validate praise fields
            if (!classification.praiseText || !classification.praiseText.trim()) {
              toast({
                title: t.common.error,
                description: language === 'ar' ? 'يرجى إدخال تفاصيل الشكر' : 'Please enter praise details',
                variant: 'destructive',
              });
              return false;
            }
            if (classification.satisfactionPercentage === undefined || classification.satisfactionPercentage < 0 || classification.satisfactionPercentage > 100) {
              toast({
                title: t.common.error,
                description: language === 'ar' ? 'يرجى تحديد مدى الرضا' : 'Please set satisfaction level',
                variant: 'destructive',
              });
              return false;
            }
          } else if (classification.type === 'COMPLAINT') {
            // Validate complaint fields
            if (!classification.domainKey || !classification.typeKey) {
              toast({
                title: t.common.error,
                description: language === 'ar' ? 'يرجى إكمال جميع حقول الشكوى' : 'Please complete all complaint fields',
                variant: 'destructive',
              });
              return false;
            }
          }
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
      const stepOrder: Step[] = ['staff', 'visit', 'patient', 'complaint', 'details', 'summary'];
      const currentIndex = stepOrder.indexOf(currentStep);
      if (currentIndex < stepOrder.length - 1) {
        setCurrentStep(stepOrder[currentIndex + 1]);
      }
    }
  }

  function handleBack() {
    const stepOrder: Step[] = ['staff', 'visit', 'patient', 'complaint', 'details', 'summary'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  }

  // Classification management functions
  function addClassification() {
    const newClassification: Classification = {
      id: Date.now().toString(),
      type: 'COMPLAINT', // Default to complaint
      domainKey: '',
      typeKey: '',
      severity: 'MEDIUM',
      shift: 'DAY',
      // Praise fields are undefined by default
    };
    setFormData({
      ...formData,
      classifications: [...formData.classifications, newClassification],
    });
  }

  function removeClassification(id: string) {
    setFormData({
      ...formData,
      classifications: formData.classifications.filter(c => c.id !== id),
    });
  }

  function updateClassification(id: string, updates: Partial<Classification>) {
    setFormData({
      ...formData,
      classifications: formData.classifications.map(c =>
        c.id === id ? { ...c, ...updates } : c
      ),
    });
  }

  async function handleSubmit() {
    if (!validateStep('details')) return;

    setIsLoading(true);
    try {
      // Submit ONLY canonical keys (no Arabic strings in structured fields)
      const response = await fetch('/api/patient-experience', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Staff information
          staffName: formData.staffName,
          staffId: formData.staffId,
          // Patient information
          patientName: formData.patientName,
          patientFileNumber: formData.patientFileNumber,
          // Canonical keys only (required)
          floorKey: formData.floorKey,
          departmentKey: formData.departmentKey,
          roomKey: formData.roomKey,
          // Multiple classifications
          classifications: formData.classifications.map(c => ({
            type: c.type,
            domainKey: c.type === 'COMPLAINT' ? c.domainKey : undefined,
            typeKey: c.type === 'COMPLAINT' ? c.typeKey : undefined,
            severity: c.type === 'COMPLAINT' ? c.severity : undefined,
            shift: c.type === 'COMPLAINT' ? c.shift : undefined,
            // For praise
            satisfactionPercentage: c.type === 'PRAISE' ? c.satisfactionPercentage : undefined,
            praiseText: c.type === 'PRAISE' ? c.praiseText : undefined,
            praisedStaffName: c.type === 'PRAISE' ? c.praisedStaffName : undefined,
          })),
          // For backward compatibility, use first complaint classification (if exists)
          domainKey: formData.classifications.find(c => c.type === 'COMPLAINT')?.domainKey || '',
          typeKey: formData.classifications.find(c => c.type === 'COMPLAINT')?.typeKey || '',
          severity: formData.classifications.find(c => c.type === 'COMPLAINT')?.severity || 'MEDIUM',
          // Status as English enum
          status: 'PENDING', // Default status
          // Free text details (bilingual) - combine complaint text and praise texts
          complaintText: [
            formData.complaintText,
            ...formData.classifications
              .filter(c => c.type === 'PRAISE' && c.praiseText)
              .map(c => `[PRAISE] ${c.praiseText}${c.praisedStaffName ? ` - ${c.praisedStaffName}` : ''}`)
          ].filter(Boolean).join('\n\n'),
          detailsLang: language,
          // Optional
          complainedStaffName: formData.complainedStaffName || undefined,
          // Patient satisfaction (from praise classifications or old field)
          isPatientSatisfied: formData.isPatientSatisfied || formData.classifications.some(c => c.type === 'PRAISE') || undefined,
          satisfactionPercentage: formData.isPatientSatisfied 
            ? formData.satisfactionPercentage 
            : formData.classifications.find(c => c.type === 'PRAISE')?.satisfactionPercentage || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: t.px.visit.success,
          description: t.px.visit.successMessage,
        });
        // Store visit data for case closure option
        setCreatedVisitData(data.record);
        // Check if it's a complaint (not praise) to show closure option
        const isComplaint = !formData.typeKey.toUpperCase().includes('PRAISE');
        if (isComplaint && data.caseId) {
          setCreatedCaseId(data.caseId);
          setShowCaseClosureDialog(true);
        } else {
          setIsSubmitted(true);
        }
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

  async function handleCloseCase() {
    if (!createdCaseId) return;

    setIsClosingCase(true);
    try {
      const response = await fetch(`/api/patient-experience/cases/${createdCaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'CLOSED',
          resolutionNotesOriginal: language === 'ar' ? 'تم إغلاق الشكوى فوراً بعد التسجيل' : 'Case closed immediately after registration',
          resolutionNotesLang: language,
        }),
      });

      if (response.ok) {
        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم إغلاق الشكوى بنجاح' : 'Complaint closed successfully',
        });
        setShowCaseClosureDialog(false);
        setIsSubmitted(true);
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to close case');
      }
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message || (language === 'ar' ? 'فشل في إغلاق الشكوى' : 'Failed to close case'),
        variant: 'destructive',
      });
    } finally {
      setIsClosingCase(false);
    }
  }

  function handleContinueCase() {
    setShowCaseClosureDialog(false);
    setIsSubmitted(true);
  }

  async function handleSaveSatisfaction() {
    if (!formData.isPatientSatisfied || formData.satisfactionPercentage === 0) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'يرجى ملء بيانات رضا المريض' : 'Please fill patient satisfaction data',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/patient-experience', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Staff information
          staffName: formData.staffName,
          staffId: formData.staffId,
          // Patient information
          patientName: formData.patientName,
          patientFileNumber: formData.patientFileNumber,
          // Canonical keys
          floorKey: formData.floorKey,
          departmentKey: formData.departmentKey,
          roomKey: formData.roomKey,
          // Satisfaction data
          isPatientSatisfied: formData.isPatientSatisfied,
          satisfactionPercentage: formData.satisfactionPercentage,
          // Default values for satisfaction record
          domainKey: 'SATISFACTION',
          typeKey: 'PATIENT_SATISFACTION',
          severity: 'MEDIUM',
          status: 'CLOSED',
          complaintText: language === 'ar' 
            ? `رضا المريض: ${formData.satisfactionPercentage}%`
            : `Patient Satisfaction: ${formData.satisfactionPercentage}%`,
          detailsLang: language,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' 
            ? `تم حفظ رضا المريض بنسبة ${formData.satisfactionPercentage}%`
            : `Patient satisfaction saved: ${formData.satisfactionPercentage}%`,
        });
        // Reset satisfaction fields after save
        setFormData(prev => ({
          ...prev,
          isPatientSatisfied: false,
          satisfactionPercentage: 0,
        }));
      } else {
        throw new Error(data.error || 'Failed to save satisfaction');
      }
    } catch (error: any) {
      toast({
        title: language === 'ar' ? 'خطأ في الحفظ' : 'Error Saving',
        description: error.message || (language === 'ar' ? 'فشل في حفظ بيانات الرضا' : 'Failed to save satisfaction data'),
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
      floorKey: '',
      departmentKey: '',
      roomKey: '',
      classifications: [],
      patientName: '',
      patientFileNumber: '',
      complaintText: '',
      complainedStaffName: '',
      isPatientSatisfied: false,
      satisfactionPercentage: 0,
    });
    setCurrentStep('staff');
    setIsSubmitted(false);
    setShowCaseClosureDialog(false);
    setCreatedCaseId(null);
    setCreatedVisitData(null);
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="space-y-6" dir={dir}>
        <div>
          <h1 className="text-3xl font-bold">{t.px.visit.title}</h1>
          <p className="text-muted-foreground">{t.px.visit.subtitle}</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">{t.common.loading}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="space-y-6" dir={dir}>
        <div>
          <h1 className="text-3xl font-bold">{t.px.visit.title}</h1>
          <p className="text-muted-foreground">{t.px.visit.subtitle}</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <h2 className="text-2xl font-semibold">{t.px.visit.success}</h2>
              <p className="text-muted-foreground text-center">
                {t.px.visit.successMessage}
              </p>
              <Button onClick={handleReset} className="mt-4">
                {t.px.visit.newRecord}
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
          <h1 className="text-3xl font-bold">{t.px.visit.title}</h1>
          <p className="text-muted-foreground">{t.px.visit.subtitle}</p>
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
            {currentStep === 'staff' && t.px.visit.stepStaff}
            {currentStep === 'visit' && t.px.visit.stepVisit}
            {currentStep === 'patient' && t.px.visit.stepPatient}
            {currentStep === 'complaint' && t.px.visit.stepClassification}
            {currentStep === 'details' && t.px.visit.stepDetails}
            {currentStep === 'summary' && t.px.visit.stepSummary}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step 1: Staff Information */}
          {currentStep === 'staff' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="staffName">{t.px.visit.staffName} *</Label>
                <Input
                  id="staffName"
                  value={formData.staffName}
                  onChange={(e) => setFormData({ ...formData, staffName: e.target.value })}
                  required
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">{t.px.visit.autoFilledFromAccount}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="staffId">{t.px.visit.staffId} *</Label>
                <Input
                  id="staffId"
                  value={formData.staffId}
                  onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                  required
                  disabled={!!formData.staffId}
                  className={formData.staffId ? "bg-muted" : ""}
                />
                {!formData.staffId && (
                  <p className="text-xs text-muted-foreground">{t.px.visit.addStaffIdInUsersPage}</p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Visit Information */}
          {currentStep === 'visit' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="floorKey">{t.px.visit.floor} *</Label>
                <Select
                  value={formData.floorKey}
                  onValueChange={(value) => {
                    setFormData({ 
                      ...formData, 
                      floorKey: value,
                      departmentKey: '',
                      roomKey: ''
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'ar' ? 'اختر الطابق' : 'Select floor'} />
                  </SelectTrigger>
                  <SelectContent>
                    {floors.map((floor) => (
                      <SelectItem key={floor.id} value={floor.key || floor.floorKey}>
                        {language === 'ar' ? (floor.label_ar || floor.labelAr || `الطابق ${floor.number}`) : (floor.label_en || floor.labelEn || `Floor ${floor.number}`)} {floor.name ? ` - ${floor.name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">{t.px.visit.department} *</Label>
                <Select
                  value={formData.departmentKey}
                  onValueChange={(value) => {
                    setFormData({ 
                      ...formData, 
                      departmentKey: value,
                      roomKey: ''
                    });
                  }}
                  disabled={!formData.floorKey}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'ar' ? 'اختر القسم' : 'Select department'} />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Only show departments that belong to the selected floor */}
                    {departments.map((dept) => {
                      const deptType = dept.type || 'BOTH';
                      const deptName = language === 'ar' ? (dept.label_ar || dept.labelAr || dept.name || dept.departmentName) : (dept.label_en || dept.labelEn || dept.name || dept.departmentName);
                      const typeLabel = deptType === 'OPD' ? 'OPD' : deptType === 'IPD' ? 'IPD' : 'OPD/IPD';
                      return (
                        <SelectItem key={dept.id} value={dept.key || dept.departmentKey || dept.code || dept.id}>
                          [{typeLabel}] {deptName}
                        </SelectItem>
                      );
                    })}
                    {departments.length === 0 && formData.floorKey && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        {language === 'ar' ? 'لا توجد أقسام في هذا الطابق' : 'No departments in this floor'}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="room">{t.px.visit.room} *</Label>
                <Select
                  value={formData.roomKey}
                  onValueChange={(value) => setFormData({ ...formData, roomKey: value })}
                  disabled={!formData.departmentKey || !formData.floorKey}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'ar' ? 'اختر الغرفة' : 'Select room'} />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Only show rooms that belong to the selected department and floor */}
                    {rooms.map((room) => (
                      <SelectItem key={room.id} value={room.key || room.roomKey}>
                        {language === 'ar' ? (room.label_ar || room.labelAr || `غرفة ${room.roomNumber}`) : (room.label_en || room.labelEn || `Room ${room.roomNumber}`)} {room.roomName ? ` - ${room.roomName}` : ''}
                      </SelectItem>
                    ))}
                    {rooms.length === 0 && formData.departmentKey && formData.floorKey && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        {language === 'ar' ? 'لا توجد غرف في هذا القسم' : 'No rooms in this department'}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 3: Patient Information */}
          {currentStep === 'patient' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="patientName">{t.px.visit.patientName}</Label>
                <Input
                  id="patientName"
                  value={formData.patientName}
                  onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                  placeholder={language === 'ar' ? 'أدخل اسم المريض' : 'Enter patient name'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="patientFileNumber">{t.px.visit.patientFileNumber} *</Label>
                <Input
                  id="patientFileNumber"
                  value={formData.patientFileNumber}
                  onChange={(e) => setFormData({ ...formData, patientFileNumber: e.target.value })}
                  placeholder={language === 'ar' ? 'أدخل رقم ملف المريض' : 'Enter patient file number'}
                  required
                />
              </div>
              
              {/* Patient Satisfaction Section */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isPatientSatisfied"
                    checked={formData.isPatientSatisfied}
                    onCheckedChange={(checked) => {
                      setFormData({ 
                        ...formData, 
                        isPatientSatisfied: checked === true,
                        satisfactionPercentage: checked === true ? formData.satisfactionPercentage || 50 : 0
                      });
                    }}
                  />
                  <Label 
                    htmlFor="isPatientSatisfied" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {language === 'ar' ? 'المريض راضي' : 'Patient is Satisfied'}
                  </Label>
                </div>
                
                {formData.isPatientSatisfied && (
                  <div className="space-y-3 pl-6">
                    <div className="space-y-2">
                      <Label>
                        {language === 'ar' ? 'نسبة الرضا' : 'Satisfaction Percentage'}: {formData.satisfactionPercentage}%
                      </Label>
                      <div className="px-2">
                        <Slider
                          min={0}
                          max={100}
                          step={1}
                          value={[formData.satisfactionPercentage]}
                          onValueChange={(value) => {
                            setFormData({ ...formData, satisfactionPercentage: value[0] });
                          }}
                          className="w-full"
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground px-2">
                        <span>0%</span>
                        <span>50%</span>
                        <span>100%</span>
                      </div>
              </div>
                  </div>
                )}
              </div>
              
              {/* Save Satisfaction Button - Shows when patient is satisfied and percentage is set */}
              {formData.isPatientSatisfied && formData.satisfactionPercentage > 0 && (
                <div className="pt-4 border-t">
                  <Button
                    type="button"
                    onClick={handleSaveSatisfaction}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {language === 'ar' ? 'جاري الحفظ...' : 'Saving...'}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {language === 'ar' ? 'حفظ رضا المريض' : 'Save Patient Satisfaction'}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Complaint Type */}
          {currentStep === 'complaint' && (
            <div className="space-y-4">
              {/* List of Classifications */}
              {formData.classifications.map((classification, index) => (
                <Card key={classification.id} className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">
                      {language === 'ar' ? `تصنيف ${index + 1}` : `Classification ${index + 1}`}
                    </h3>
                    {formData.classifications.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeClassification(classification.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
            <div className="space-y-4">
              {/* Type Selection: Praise or Complaint */}
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'النوع' : 'Type'} *</Label>
                <Select
                  value={classification.type}
                  onValueChange={(value) => {
                    if (value === 'PRAISE') {
                      // Reset complaint fields when switching to praise
                      updateClassification(classification.id, { 
                        type: 'PRAISE',
                        domainKey: '',
                        typeKey: '',
                        severity: undefined, // Remove severity for praise
                        shift: undefined, // Remove shift for praise
                        satisfactionPercentage: 50,
                        praiseText: '',
                        praisedStaffName: '',
                      });
                    } else {
                      // Reset praise fields when switching to complaint
                      updateClassification(classification.id, { 
                        type: 'COMPLAINT',
                        domainKey: '',
                        typeKey: '',
                        severity: 'MEDIUM',
                        shift: 'DAY',
                        satisfactionPercentage: undefined,
                        praiseText: undefined,
                        praisedStaffName: undefined,
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'ar' ? 'اختر النوع' : 'Select type'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMPLAINT">{language === 'ar' ? 'شكوى' : 'Complaint'}</SelectItem>
                    <SelectItem value="PRAISE">{language === 'ar' ? 'شكر' : 'Praise'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Praise Section */}
              {classification.type === 'PRAISE' && (
                <div className="space-y-4 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'مدى الرضا' : 'Satisfaction Level'} *</Label>
                    <div className="px-2">
                      <Slider
                        min={0}
                        max={100}
                        step={1}
                        value={[classification.satisfactionPercentage || 50]}
                        onValueChange={(value) => {
                          updateClassification(classification.id, { satisfactionPercentage: value[0] });
                        }}
                        className="w-full"
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground px-2">
                      <span>0%</span>
                      <span className="font-medium">{classification.satisfactionPercentage || 50}%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'تفاصيل الشكر' : 'Praise Details'} *</Label>
                    <Textarea
                      value={classification.praiseText || ''}
                      onChange={(e) => updateClassification(classification.id, { praiseText: e.target.value })}
                      placeholder={language === 'ar' ? 'أدخل تفاصيل الشكر...' : 'Enter praise details...'}
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'اسم الموظف المشكور (اختياري)' : 'Praised Staff Name (Optional)'}</Label>
                    <Input
                      value={classification.praisedStaffName || ''}
                      onChange={(e) => updateClassification(classification.id, { praisedStaffName: e.target.value })}
                      placeholder={language === 'ar' ? 'أدخل اسم الموظف المشكور' : 'Enter praised staff name'}
                    />
                  </div>
                </div>
              )}

              {/* Complaint Section */}
              {classification.type === 'COMPLAINT' && (
                <>
                  <div className="space-y-2">
                    <Label>{t.px.visit.domain} *</Label>
                    <Select
                      value={classification.domainKey}
                      onValueChange={(value) => {
                        updateClassification(classification.id, { 
                          domainKey: value,
                          typeKey: '' // Reset type when domain changes
                        });
                        loadComplaintTypesByDomain(value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={language === 'ar' ? 'اختر المجال' : 'Select domain'} />
                      </SelectTrigger>
                      <SelectContent>
                        {complaintDomains.map((domain) => (
                          <SelectItem key={domain.id} value={domain.key}>
                            {language === 'ar' ? (domain.label_ar || domain.labelAr) : (domain.label_en || domain.labelEn)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {classification.domainKey && (
                    <div className="space-y-2">
                      <Label>{t.px.visit.classification} *</Label>
                      <Select
                        value={classification.typeKey}
                        onValueChange={(value) => updateClassification(classification.id, { typeKey: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={language === 'ar' ? 'اختر التصنيف' : 'Select classification'} />
                        </SelectTrigger>
                        <SelectContent>
                          {complaintTypes
                            .filter(type => type.domainKey === classification.domainKey)
                            .map((type) => (
                              <SelectItem key={type.id} value={type.key || type.typeKey}>
                                {language === 'ar' ? (type.label_ar || type.labelAr || type.name) : (type.label_en || type.labelEn || type.name)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t.px.visit.severity} *</Label>
                      <Select
                        value={classification.severity}
                        onValueChange={(value) => updateClassification(classification.id, { severity: value as any })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={language === 'ar' ? 'اختر مستوى الخطورة' : 'Select severity'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">{language === 'ar' ? 'منخفض' : 'Low'}</SelectItem>
                          <SelectItem value="MEDIUM">{language === 'ar' ? 'متوسط' : 'Medium'}</SelectItem>
                          <SelectItem value="HIGH">{language === 'ar' ? 'عالي' : 'High'}</SelectItem>
                          <SelectItem value="CRITICAL">{language === 'ar' ? 'حرج' : 'Critical'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{language === 'ar' ? 'الشيفت' : 'Shift'} *</Label>
                      <Select
                        value={classification.shift}
                        onValueChange={(value) => updateClassification(classification.id, { shift: value as any })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={language === 'ar' ? 'اختر الشيفت' : 'Select shift'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DAY">{language === 'ar' ? 'داي شيفت' : 'Day Shift'}</SelectItem>
                          <SelectItem value="NIGHT">{language === 'ar' ? 'نايت شيفت' : 'Night Shift'}</SelectItem>
                          <SelectItem value="DAY_NIGHT">{language === 'ar' ? 'داي ونايت' : 'Day & Night'}</SelectItem>
                          <SelectItem value="BOTH">{language === 'ar' ? 'الشفتين' : 'Both Shifts'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}
              
                    {classification.domainKey && (
                <div className="space-y-2">
                        <Label>{t.px.visit.classification} *</Label>
                  <Select
                          value={classification.typeKey}
                          onValueChange={(value) => updateClassification(classification.id, { typeKey: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === 'ar' ? 'اختر التصنيف' : 'Select classification'} />
                    </SelectTrigger>
                    <SelectContent>
                      {complaintTypes
                              .filter(type => type.domainKey === classification.domainKey)
                        .map((type) => (
                          <SelectItem key={type.id} value={type.key || type.typeKey}>
                            {language === 'ar' ? (type.label_ar || type.labelAr || type.name) : (type.label_en || type.labelEn || type.name)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

                    <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                        <Label>{t.px.visit.severity} *</Label>
                <Select
                          value={classification.severity}
                          onValueChange={(value) => updateClassification(classification.id, { severity: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'ar' ? 'اختر مستوى الخطورة' : 'Select severity'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">{language === 'ar' ? 'منخفض' : 'Low'}</SelectItem>
                    <SelectItem value="MEDIUM">{language === 'ar' ? 'متوسط' : 'Medium'}</SelectItem>
                    <SelectItem value="HIGH">{language === 'ar' ? 'عالي' : 'High'}</SelectItem>
                    <SelectItem value="CRITICAL">{language === 'ar' ? 'حرج' : 'Critical'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'الشيفت' : 'Shift'} *</Label>
                        <Select
                          value={classification.shift}
                          onValueChange={(value) => updateClassification(classification.id, { shift: value as any })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={language === 'ar' ? 'اختر الشيفت' : 'Select shift'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DAY">{language === 'ar' ? 'داي شيفت' : 'Day Shift'}</SelectItem>
                            <SelectItem value="NIGHT">{language === 'ar' ? 'نايت شيفت' : 'Night Shift'}</SelectItem>
                            <SelectItem value="DAY_NIGHT">{language === 'ar' ? 'داي ونايت' : 'Day & Night'}</SelectItem>
                            <SelectItem value="BOTH">{language === 'ar' ? 'الشفتين' : 'Both Shifts'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}

              {/* Add Classification Button */}
              <Button
                type="button"
                variant="outline"
                onClick={addClassification}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                {language === 'ar' ? 'إضافة تصنيف جديد' : 'Add New Classification'}
              </Button>

              {formData.classifications.length === 0 && (
                <p className="text-sm text-muted-foreground text-center">
                  {language === 'ar' ? 'اضغط على الزر أعلاه لإضافة تصنيف' : 'Click the button above to add a classification'}
                </p>
              )}
            </div>
          )}

          {/* Step 5: Complaint Details */}
          {currentStep === 'details' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="complaintText">{t.px.visit.details} *</Label>
                <Textarea
                  id="complaintText"
                  value={formData.complaintText}
                  onChange={(e) => setFormData({ ...formData, complaintText: e.target.value })}
                  placeholder={language === 'ar' ? 'أدخل تفاصيل الشكوى...' : 'Enter complaint details...'}
                  rows={6}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="complainedStaffName">{t.px.visit.complainedStaff}</Label>
                <Input
                  id="complainedStaffName"
                  value={formData.complainedStaffName}
                  onChange={(e) => setFormData({ ...formData, complainedStaffName: e.target.value })}
                  placeholder={language === 'ar' ? 'أدخل اسم الموظف (اختياري)' : 'Enter staff name (optional)'}
                />
              </div>
            </div>
          )}

          {/* Step 6: Summary */}
          {currentStep === 'summary' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t.px.visit.staffName}</Label>
                  <p className="font-medium">{formData.staffName}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t.px.visit.staffId}</Label>
                  <p className="font-medium">{formData.staffId}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t.px.visit.floor}</Label>
                  <p className="font-medium">
                    {floors.find(f => f.key === formData.floorKey) 
                      ? (language === 'ar' 
                          ? (floors.find(f => f.key === formData.floorKey)?.label_ar || floors.find(f => f.key === formData.floorKey)?.labelAr)
                          : (floors.find(f => f.key === formData.floorKey)?.label_en || floors.find(f => f.key === formData.floorKey)?.labelEn))
                      : formData.floorKey}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t.px.visit.department}</Label>
                  <p className="font-medium">
                    {departments.find(d => (d.key || d.departmentKey) === formData.departmentKey)
                      ? (language === 'ar'
                          ? (departments.find(d => (d.key || d.departmentKey) === formData.departmentKey)?.label_ar || departments.find(d => (d.key || d.departmentKey) === formData.departmentKey)?.labelAr)
                          : (departments.find(d => (d.key || d.departmentKey) === formData.departmentKey)?.label_en || departments.find(d => (d.key || d.departmentKey) === formData.departmentKey)?.labelEn))
                      : formData.departmentKey}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t.px.visit.room}</Label>
                  <p className="font-medium">
                    {rooms.find(r => (r.key || r.roomKey) === formData.roomKey)
                      ? (language === 'ar'
                          ? (rooms.find(r => (r.key || r.roomKey) === formData.roomKey)?.label_ar || rooms.find(r => (r.key || r.roomKey) === formData.roomKey)?.labelAr)
                          : (rooms.find(r => (r.key || r.roomKey) === formData.roomKey)?.label_en || rooms.find(r => (r.key || r.roomKey) === formData.roomKey)?.labelEn))
                      : formData.roomKey}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t.px.visit.patientName}</Label>
                  <p className="font-medium">{formData.patientName}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t.px.visit.patientFileNumber}</Label>
                  <p className="font-medium">{formData.patientFileNumber}</p>
                </div>
                {/* Classifications List */}
                <div className="col-span-2 space-y-2">
                  <Label className="text-muted-foreground">
                    {language === 'ar' ? 'التصنيفات' : 'Classifications'}
                  </Label>
                  <div className="space-y-3">
                    {formData.classifications.map((classification, index) => {
                      const shiftLabels: Record<string, { ar: string; en: string }> = {
                        DAY: { ar: 'داي شيفت', en: 'Day Shift' },
                        NIGHT: { ar: 'نايت شيفت', en: 'Night Shift' },
                        DAY_NIGHT: { ar: 'داي ونايت', en: 'Day & Night' },
                        BOTH: { ar: 'الشفتين', en: 'Both Shifts' },
                      };
                      
                      if (classification.type === 'PRAISE') {
                        return (
                          <Card key={classification.id} className="p-3 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs bg-green-100 text-green-800">
                                    {index + 1}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs bg-green-100 text-green-800">
                                    {language === 'ar' ? 'شكر' : 'Praise'}
                                  </Badge>
                                </div>
                                <div className="space-y-1">
                                  <div className="text-sm">
                                    <span className="font-medium">{language === 'ar' ? 'مدى الرضا' : 'Satisfaction'}: </span>
                                    <span>{classification.satisfactionPercentage || 0}%</span>
                                  </div>
                                  {classification.praiseText && (
                                    <div className="text-sm text-muted-foreground">
                                      {classification.praiseText}
                                    </div>
                                  )}
                                  {classification.praisedStaffName && (
                                    <div className="text-sm">
                                      <span className="font-medium">{language === 'ar' ? 'المشكور' : 'Praised Staff'}: </span>
                                      <span>{classification.praisedStaffName}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Card>
                        );
                      } else {
                        const domain = complaintDomains.find(d => d.key === classification.domainKey);
                        const type = complaintTypes.find(t => (t.key || t.typeKey) === classification.typeKey);
                        return (
                          <Card key={classification.id} className="p-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {index + 1}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs bg-red-100 text-red-800">
                                    {language === 'ar' ? 'شكوى' : 'Complaint'}
                                  </Badge>
                                  <span className="font-medium">
                                    {language === 'ar'
                                      ? (domain?.label_ar || domain?.labelAr || classification.domainKey)
                                      : (domain?.label_en || domain?.labelEn || classification.domainKey)}
                                  </span>
                                  <span className="text-muted-foreground">-</span>
                                  <span>
                                    {language === 'ar'
                                      ? (type?.label_ar || type?.labelAr || type?.name || classification.typeKey)
                                      : (type?.label_en || type?.labelEn || type?.name || classification.typeKey)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {language === 'ar' ? 'الخطورة' : 'Severity'}: {classification.severity}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {language === 'ar' ? 'الشيفت' : 'Shift'}: {language === 'ar' ? shiftLabels[classification.shift]?.ar : shiftLabels[classification.shift]?.en}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </Card>
                        );
                      }
                    })}
                  </div>
                </div>
                {formData.complainedStaffName && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t.px.visit.complainedStaff}</Label>
                    <p className="font-medium">{formData.complainedStaffName}</p>
                  </div>
                )}
                {formData.isPatientSatisfied && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">
                        {language === 'ar' ? 'رضا المريض' : 'Patient Satisfaction'}
                      </Label>
                      <Badge variant="outline" className="bg-green-100 text-green-800">
                        {language === 'ar' ? 'راضي' : 'Satisfied'}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">
                        {language === 'ar' ? 'نسبة الرضا' : 'Satisfaction Percentage'}
                      </Label>
                      <p className="font-medium">{formData.satisfactionPercentage}%</p>
                    </div>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">{t.px.visit.details}</Label>
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
              disabled={currentStep === 'staff'}
            >
              <ArrowRight className="mr-2 h-4 w-4" />
              {t.common.previous}
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
                    {t.common.loading}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {t.common.save}
                  </>
                )}
              </Button>
            ) : (
              <Button type="button" onClick={handleNext}>
                {t.common.next}
                <ArrowLeft className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Case Closure Dialog */}
      <AlertDialog open={showCaseClosureDialog} onOpenChange={setShowCaseClosureDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'إدارة الشكوى' : 'Manage Complaint'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' 
                ? 'هل تريد إغلاق الشكوى الآن أم سيتم متابعتها لاحقاً؟'
                : 'Do you want to close this complaint now or will it be followed up later?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleContinueCase} disabled={isClosingCase}>
              {language === 'ar' ? 'سيتم متابعتها' : 'Will be followed up'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseCase} disabled={isClosingCase}>
              {isClosingCase 
                ? (language === 'ar' ? 'جاري الإغلاق...' : 'Closing...')
                : (language === 'ar' ? 'إغلاق الشكوى الآن' : 'Close Complaint Now')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
