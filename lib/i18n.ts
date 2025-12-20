/**
 * Internationalization (i18n) Types and Utilities
 */

export type Language = 'ar' | 'en';

export interface Translations {
  // Common
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    create: string;
    update: string;
    search: string;
    filter: string;
    export: string;
    import: string;
    loading: string;
    error: string;
    success: string;
    confirm: string;
    close: string;
    back: string;
    next: string;
    previous: string;
    submit: string;
    reset: string;
    select: string;
    selectAll: string;
    clear: string;
    yes: string;
    no: string;
    ok: string;
  };

  // Navigation
  nav: {
    dashboard: string;
    notifications: string;
    opdDashboard: string;
    scheduling: string;
    er: string;
    patientExperience: string;
    ipd: string;
    equipment: string;
    equipmentOPD: string;
    equipmentIPD: string;
    manpowerNursing: string;
    policySystem: string;
    admin: string;
    account: string;
    // OPD Submenu
    overview: string;
    clinicCensus: string;
    performanceComparison: string;
    clinicUtilization: string;
    dailyDataEntry: string;
    // Scheduling Submenu
    schedule: string;
    availability: string;
    // ER Submenu
    patientRegistration: string;
    triage: string;
    disposition: string;
    progressNote: string;
    // Patient Experience Submenu
    analytics: string;
    reports: string;
    allVisits: string;
    cases: string;
    visitWizard: string;
    setup: string;
    seedData: string;
    deleteAllData: string;
    // IPD Submenu
    bedSetup: string;
    liveBeds: string;
    departmentInput: string;
    // Equipment OPD Submenu
    master: string;
    clinicMap: string;
    checklist: string;
    movements: string;
    // Equipment IPD Submenu
    map: string;
    dailyChecklist: string;
    // Manpower Submenu
    manpowerOverview: string;
    manpowerEdit: string;
    weeklyScheduling: string;
    nursingOperations: string;
    // Policy Submenu
    uploadPolicy: string;
    library: string;
    policyAssistant: string;
    newPolicyCreator: string;
    policyHarmonization: string;
    // Admin Submenu
    dataAdmin: string;
    deleteSampleData: string;
    users: string;
  };

  // Header
  header: {
    hospitalOS: string;
    logout: string;
    welcome: string;
  };

  // Auth
  auth: {
    login: string;
    logout: string;
    email: string;
    password: string;
    signIn: string;
    signingIn: string;
    signInToAccess: string;
    defaultCredentials: string;
  };

  // User Management
  users: {
    title: string;
    userManagement: string;
    manageUsersRoles: string;
    addUser: string;
    createUser: string;
    editUser: string;
    editUserPermissions: string;
    firstName: string;
    lastName: string;
    name: string;
    role: string;
    department: string;
    isActive: string;
    permissions: string;
    updateUser: string;
    updating: string;
    creating: string;
    selectAll: string;
    newPassword: string;
    newPasswordOptional: string;
    leaveEmptyToKeep: string;
    allUsers: string;
    viewManageUsers: string;
    status: string;
    actions: string;
    updatePermissions: string;
    deleteUser: string;
    areYouSureDelete: string;
      userCreatedSuccess: string;
      userUpdatedSuccess: string;
      userDeletedSuccess: string;
      addNewUserToSystem: string;
      permissionsCount: string;
      active: string;
      inactive: string;
      staffId: string;
      staffIdPlaceholder: string;
    };

  // Roles
  roles: {
    admin: string;
    supervisor: string;
    staff: string;
    viewer: string;
  };

  // Dashboard
  dashboard: {
    home: string;
    loadingData: string;
    forSelectedPeriod: string;
    fromLastPeriod: string;
    stable: string;
    bedsOccupied: string;
    quickActions: string;
    commonTasks: string;
    viewOPDCensus: string;
    dailyClinicActivity: string;
    viewLiveBeds: string;
    currentBedStatus: string;
    viewEquipment: string;
      equipmentManagement: string;
      recentActivity: string;
      latestSystemUpdates: string;
      liveBedStatus: string;
      realTimeOccupancy: string;
      equipmentChecklist: string;
      dailyEquipmentChecks: string;
      systemStatus: string;
      platformHealthConnectivity: string;
      database: string;
      connected: string;
      apiServices: string;
      operational: string;
      aiServices: string;
      ready: string;
      opdDataUpdated: string;
      newEquipmentAdded: string;
      bedOccupancyAlert: string;
      minutesAgo: string;
      hoursAgo: string;
      // KPI Titles
    opdVisits: string;
    erVisits: string;
    bedOccupancy: string;
    orOperations: string;
    lapOperations: string;
    radiology: string;
    kathLap: string;
    endoscopy: string;
    physiotherapy: string;
    deliveries: string;
    deaths: string;
    pharmacyVisits: string;
    // KPI Descriptions
    emergencyRoomVisits: string;
    operatingRoomProcedures: string;
    laparoscopicProcedures: string;
    imagingStudies: string;
    catheterizationProcedures: string;
    endoscopicProcedures: string;
    physicalTherapySessions: string;
    births: string;
    mortalityCount: string;
    pharmacyConsultations: string;
  };

  // Account
  account: {
    accountSettings: string;
    manageAccountPreferences: string;
    profileInformation: string;
    accountDetails: string;
    changePassword: string;
    updatePassword: string;
    currentPassword: string;
    confirmNewPassword: string;
    changing: string;
    passwordChangedSuccess: string;
    passwordsDoNotMatch: string;
    failedToChangePassword: string;
  };

  // OPD Dashboard
  opd: {
    opdDashboard: string;
    totalVisits: string;
    activeClinics: string;
    avgUtilization: string;
    clinicCapacityUsage: string;
    dailyCensus: string;
    viewPatientCountsPerClinic: string;
    clinicUtilization: string;
    analyzeClinicCapacityUsage: string;
    doctorsView: string;
    doctorSchedulesWorkload: string;
    outpatientDepartmentOverview: string;
    showFilter: string;
    hideFilter: string;
    newPatients: string;
    firstTimeVisits: string;
    followUpVisits: string;
      returningPatients: string;
    };

  // Patient Experience
  px: {
    visit: {
      title: string;
      subtitle: string;
      stepStaff: string;
      stepVisit: string;
      stepPatient: string;
      stepClassification: string;
      stepDetails: string;
      stepSummary: string;
      staffName: string;
      staffId: string;
      floor: string;
      department: string;
      room: string;
      patientName: string;
      patientFileNumber: string;
      domain: string;
      classification: string;
      severity: string;
      details: string;
      complainedStaff: string;
      success: string;
      successMessage: string;
      newRecord: string;
      autoFilledFromAccount: string;
      addStaffIdInUsersPage: string;
      staffNameRequired: string;
      staffIdRequired: string;
    };
  };
}

export const translations: Record<Language, Translations> = {
  en: {
    common: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      create: 'Create',
      update: 'Update',
      search: 'Search',
      filter: 'Filter',
      export: 'Export',
      import: 'Import',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      confirm: 'Confirm',
      close: 'Close',
      back: 'Back',
      next: 'Next',
      previous: 'Previous',
      submit: 'Submit',
      reset: 'Reset',
      select: 'Select',
      selectAll: 'Select All',
      clear: 'Clear',
      yes: 'Yes',
      no: 'No',
      ok: 'OK',
    },
    nav: {
      dashboard: 'Dashboard',
      notifications: 'Notifications',
      opdDashboard: 'OPD Dashboard',
      dailyDataEntry: 'Daily Data Entry',
      scheduling: 'Scheduling',
      er: 'ER',
      patientExperience: 'Patient Experience',
      ipd: 'IPD',
      equipment: 'Equipment',
      equipmentOPD: 'Equipment (OPD)',
      equipmentIPD: 'Equipment (IPD)',
      manpowerNursing: 'Manpower & Nursing',
      policySystem: 'Policy System',
      admin: 'Admin',
      account: 'Account',
      overview: 'Overview',
      clinicCensus: 'Clinic Census',
      performanceComparison: 'Performance Comparison',
      clinicUtilization: 'Clinic Utilization',
      schedule: 'Schedule',
      availability: 'Availability',
      patientRegistration: 'Patient Registration',
      triage: 'Triage',
      disposition: 'Disposition',
      progressNote: 'Progress Note',
      analytics: 'Analytics',
      reports: 'Reports',
      allVisits: 'All Visits',
      cases: 'Cases',
      visitWizard: 'Visit Wizard',
      setup: 'Setup',
      seedData: 'Seed Data',
      deleteAllData: 'Delete All Data',
      bedSetup: 'Bed Setup',
      liveBeds: 'Live Beds',
      departmentInput: 'Department Input',
      master: 'Master',
      clinicMap: 'Clinic Map',
      checklist: 'Checklist',
      movements: 'Movements',
      map: 'Map',
      dailyChecklist: 'Daily Checklist',
      manpowerOverview: 'Manpower Overview',
      manpowerEdit: 'Manpower Edit (NEW)',
      weeklyScheduling: 'Weekly Scheduling',
      nursingOperations: 'Nursing Operations',
      uploadPolicy: 'Upload Policy',
      library: 'Library',
      policyAssistant: 'Policy Assistant',
      newPolicyCreator: 'New Policy Creator',
      policyHarmonization: 'Policy Harmonization',
      dataAdmin: 'Data Admin',
      deleteSampleData: 'Delete Sample Data',
      users: 'Users',
    },
    header: {
      hospitalOS: 'Hospital OS',
      logout: 'Logout',
      welcome: 'Welcome',
    },
    auth: {
      login: 'Login',
      logout: 'Logout',
      email: 'Email',
      password: 'Password',
      signIn: 'Sign In',
      signingIn: 'Signing in...',
      signInToAccess: 'Sign in to access the platform',
      defaultCredentials: 'Default credentials: admin@hospital.com / admin123',
    },
    users: {
      title: 'Users',
      userManagement: 'User Management',
      manageUsersRoles: 'Manage system users and roles',
      addUser: 'Add User',
      createUser: 'Create New User',
      editUser: 'Edit User Permissions',
      editUserPermissions: 'Edit User Permissions',
      firstName: 'First Name',
      lastName: 'Last Name',
      name: 'Name',
      role: 'Role',
      department: 'Department (Optional)',
      isActive: 'Active',
      permissions: 'Permissions',
      updateUser: 'Update User',
      updating: 'Updating...',
      creating: 'Creating...',
      selectAll: 'Select All',
      newPassword: 'New Password',
      newPasswordOptional: 'New Password (Optional)',
      leaveEmptyToKeep: 'Leave empty to keep current password',
      allUsers: 'All Users',
      viewManageUsers: 'View and manage all system users',
      status: 'Status',
      actions: 'Actions',
      updatePermissions: 'Update permissions for',
      deleteUser: 'Delete User',
      areYouSureDelete: 'Are you sure you want to delete this user?',
      userCreatedSuccess: 'User created successfully',
      userUpdatedSuccess: 'User updated successfully',
      userDeletedSuccess: 'User deleted successfully',
      addNewUserToSystem: 'Add a new user to the system',
      permissionsCount: 'permissions',
      active: 'Active',
      inactive: 'Inactive',
      staffId: 'Staff ID',
      staffIdPlaceholder: 'Enter employee/staff ID number',
    },
    roles: {
      admin: 'Admin',
      supervisor: 'Supervisor',
      staff: 'Staff',
      viewer: 'Viewer',
    },
    dashboard: {
      home: 'Home',
      loadingData: 'Loading data...',
      forSelectedPeriod: 'For selected period',
      fromLastPeriod: 'from last period',
      stable: 'Stable',
      bedsOccupied: 'beds occupied',
      quickActions: 'Quick Actions',
      commonTasks: 'Common tasks and operations',
      viewOPDCensus: 'View OPD Census',
      dailyClinicActivity: 'Daily clinic activity',
      viewLiveBeds: 'View Live Beds',
      currentBedStatus: 'Current bed status',
      viewEquipment: 'View Equipment',
      equipmentManagement: 'Equipment management',
      recentActivity: 'Recent Activity',
      latestSystemUpdates: 'Latest system updates',
      liveBedStatus: 'Live Bed Status',
      realTimeOccupancy: 'Real-time occupancy',
      equipmentChecklist: 'Equipment Checklist',
      dailyEquipmentChecks: 'Daily equipment checks',
      systemStatus: 'System Status',
      platformHealthConnectivity: 'Platform health and connectivity',
      database: 'Database',
      connected: 'Connected',
      apiServices: 'API Services',
      operational: 'Operational',
      aiServices: 'AI Services',
      ready: 'Ready',
      opdDataUpdated: 'OPD data updated',
      newEquipmentAdded: 'New equipment added',
      bedOccupancyAlert: 'Bed occupancy alert',
      minutesAgo: 'minutes ago',
      hoursAgo: 'hours ago',
      opdVisits: 'OPD Visits',
      erVisits: 'ER Visits',
      bedOccupancy: 'Bed Occupancy',
      orOperations: 'OR Operations',
      lapOperations: 'Lap Operations',
      radiology: 'Radiology',
      kathLap: 'Cath Lap',
      endoscopy: 'ENDOSCOPY',
      physiotherapy: 'Physiotherapy',
      deliveries: 'Deliveries',
      deaths: 'Deaths',
      pharmacyVisits: 'Pharmacy Visits',
      emergencyRoomVisits: 'Emergency room visits',
      operatingRoomProcedures: 'Operating room procedures',
      laparoscopicProcedures: 'Laparoscopic procedures',
      imagingStudies: 'Imaging studies',
      catheterizationProcedures: 'Catheterization procedures',
      endoscopicProcedures: 'Endoscopic procedures',
      physicalTherapySessions: 'Physical therapy sessions',
      births: 'Births',
      mortalityCount: 'Mortality count',
      pharmacyConsultations: 'Pharmacy consultations',
    },
    account: {
      accountSettings: 'Account Settings',
      manageAccountPreferences: 'Manage your account and preferences',
      profileInformation: 'Profile Information',
      accountDetails: 'Your account details',
      changePassword: 'Change Password',
      updatePassword: 'Update your password',
      currentPassword: 'Current Password',
      confirmNewPassword: 'Confirm New Password',
      changing: 'Changing...',
      passwordChangedSuccess: 'Password changed successfully',
      passwordsDoNotMatch: 'New passwords do not match',
      failedToChangePassword: 'Failed to change password',
    },
    opd: {
      opdDashboard: 'OPD Dashboard',
      totalVisits: 'Total Visits',
      activeClinics: 'Active Clinics',
      avgUtilization: 'Avg Utilization',
      clinicCapacityUsage: 'Clinic capacity usage',
      dailyCensus: 'Daily Census',
      viewPatientCountsPerClinic: 'View patient counts per clinic',
      clinicUtilization: 'Clinic Utilization',
      analyzeClinicCapacityUsage: 'Analyze clinic capacity usage',
      doctorsView: 'Doctors View',
      doctorSchedulesWorkload: 'Doctor schedules and workload',
      outpatientDepartmentOverview: 'Outpatient Department Overview',
      showFilter: 'Show Filter',
      hideFilter: 'Hide Filter',
      newPatients: 'New Patients',
      firstTimeVisits: 'First-time visits',
      followUpVisits: 'Follow-up Visits',
      returningPatients: 'Returning patients',
    },
    px: {
      visit: {
        title: 'Patient Experience Visit',
        subtitle: 'Record a new patient experience visit',
        stepStaff: 'Staff',
        stepVisit: 'Visit Location',
        stepPatient: 'Patient',
        stepClassification: 'Classification',
        stepDetails: 'Details',
        stepSummary: 'Summary',
        staffName: 'Staff Name',
        staffId: 'Staff ID',
        floor: 'Floor',
        department: 'Department',
        room: 'Room',
        patientName: 'Patient Name',
        patientFileNumber: 'Patient File Number',
        domain: 'Domain',
        classification: 'Classification',
        severity: 'Severity',
        details: 'Details',
        complainedStaff: 'Complained Staff',
        success: 'Success',
        successMessage: 'Visit recorded successfully',
        newRecord: 'Record New Visit',
        autoFilledFromAccount: 'Auto-filled from account',
        addStaffIdInUsersPage: 'Add Staff ID in Users page',
        staffNameRequired: 'Staff name is required',
        staffIdRequired: 'Staff ID is required. Please add it in the Users page.',
      },
    },
  },
  ar: {
    common: {
      save: 'حفظ',
      cancel: 'إلغاء',
      delete: 'حذف',
      edit: 'تعديل',
      create: 'إنشاء',
      update: 'تحديث',
      search: 'بحث',
      filter: 'تصفية',
      export: 'تصدير',
      import: 'استيراد',
      loading: 'جاري التحميل...',
      error: 'خطأ',
      success: 'نجح',
      confirm: 'تأكيد',
      close: 'إغلاق',
      back: 'رجوع',
      next: 'التالي',
      previous: 'السابق',
      submit: 'إرسال',
      reset: 'إعادة تعيين',
      select: 'اختر',
      selectAll: 'اختر الكل',
      clear: 'مسح',
      yes: 'نعم',
      no: 'لا',
      ok: 'موافق',
    },
    nav: {
      dashboard: 'لوحة التحكم',
      notifications: 'الإشعارات',
      opdDashboard: 'لوحة تحكم العيادات الخارجية',
      scheduling: 'الجدولة',
      er: 'الطوارئ',
      patientExperience: 'تجربة المريض',
      ipd: 'الأقسام الداخلية',
      equipment: 'المعدات',
      equipmentOPD: 'المعدات (عيادات خارجية)',
      equipmentIPD: 'المعدات (أقسام داخلية)',
      manpowerNursing: 'القوى العاملة والتمريض',
      policySystem: 'نظام السياسات',
      admin: 'الإدارة',
      account: 'الحساب',
      overview: 'نظرة عامة',
      clinicCensus: 'إحصائية العيادات',
      performanceComparison: 'مقارنة الأداء',
      clinicUtilization: 'استخدام العيادات',
      dailyDataEntry: 'إدخال البيانات اليومية',
      schedule: 'الجدول',
      availability: 'التوفر',
      patientRegistration: 'تسجيل المريض',
      triage: 'التصنيف',
      disposition: 'التصرف',
      progressNote: 'ملاحظة التقدم',
      analytics: 'التحليلات',
      reports: 'التقارير',
      allVisits: 'جميع الزيارات',
      cases: 'الحالات',
      visitWizard: 'معالج الزيارة',
      setup: 'الإعدادات',
      seedData: 'بيانات البذور',
      deleteAllData: 'حذف جميع البيانات',
      bedSetup: 'إعداد الأسرة',
      liveBeds: 'الأسرة الحية',
      departmentInput: 'إدخال القسم',
      master: 'الرئيسي',
      clinicMap: 'خريطة العيادة',
      checklist: 'قائمة التحقق',
      movements: 'الحركات',
      map: 'الخريطة',
      dailyChecklist: 'قائمة التحقق اليومية',
      manpowerOverview: 'نظرة عامة على القوى العاملة',
      manpowerEdit: 'تعديل القوى العاملة (جديد)',
      weeklyScheduling: 'الجدولة الأسبوعية',
      nursingOperations: 'عمليات التمريض',
      uploadPolicy: 'رفع سياسة',
      library: 'المكتبة',
      policyAssistant: 'مساعد السياسات',
      newPolicyCreator: 'منشئ السياسات الجديد',
      policyHarmonization: 'توحيد السياسات',
      dataAdmin: 'إدارة البيانات',
      deleteSampleData: 'حذف البيانات الوهمية',
      users: 'المستخدمون',
    },
    header: {
      hospitalOS: 'نظام المستشفى',
      logout: 'تسجيل الخروج',
      welcome: 'مرحباً',
    },
    auth: {
      login: 'تسجيل الدخول',
      logout: 'تسجيل الخروج',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      signIn: 'تسجيل الدخول',
      signingIn: 'جاري تسجيل الدخول...',
      signInToAccess: 'سجل الدخول للوصول إلى المنصة',
      defaultCredentials: 'بيانات الدخول الافتراضية: admin@hospital.com / admin123',
    },
    users: {
      title: 'المستخدمون',
      userManagement: 'إدارة المستخدمين',
      manageUsersRoles: 'إدارة مستخدمي النظام والأدوار',
      addUser: 'إضافة مستخدم',
      createUser: 'إنشاء مستخدم جديد',
      editUser: 'تعديل صلاحيات المستخدم',
      editUserPermissions: 'تعديل صلاحيات المستخدم',
      firstName: 'الاسم الأول',
      lastName: 'اسم العائلة',
      name: 'الاسم',
      role: 'الدور',
      department: 'القسم (اختياري)',
      isActive: 'نشط',
      permissions: 'الصلاحيات',
      updateUser: 'تحديث المستخدم',
      updating: 'جاري التحديث...',
      creating: 'جاري الإنشاء...',
      selectAll: 'اختر الكل',
      newPassword: 'كلمة المرور الجديدة',
      newPasswordOptional: 'كلمة المرور الجديدة (اختياري)',
      leaveEmptyToKeep: 'اتركه فارغاً للاحتفاظ بكلمة المرور الحالية',
      allUsers: 'جميع المستخدمين',
      viewManageUsers: 'عرض وإدارة جميع مستخدمي النظام',
      status: 'الحالة',
      actions: 'الإجراءات',
      updatePermissions: 'تحديث الصلاحيات لـ',
      deleteUser: 'حذف المستخدم',
      areYouSureDelete: 'هل أنت متأكد من حذف هذا المستخدم؟',
      userCreatedSuccess: 'تم إنشاء المستخدم بنجاح',
      userUpdatedSuccess: 'تم تحديث المستخدم بنجاح',
      userDeletedSuccess: 'تم حذف المستخدم بنجاح',
      addNewUserToSystem: 'إضافة مستخدم جديد إلى النظام',
      permissionsCount: 'صلاحيات',
      active: 'نشط',
      inactive: 'غير نشط',
      staffId: 'رقم الموظف',
      staffIdPlaceholder: 'أدخل رقم الموظف/الموظف',
    },
    roles: {
      admin: 'مدير',
      supervisor: 'مشرف',
      staff: 'موظف',
      viewer: 'مشاهد',
    },
    dashboard: {
      home: 'الرئيسية',
      loadingData: 'جاري تحميل البيانات...',
      forSelectedPeriod: 'للفترة المحددة',
      fromLastPeriod: 'من الفترة السابقة',
      stable: 'مستقر',
      bedsOccupied: 'أسرة مشغولة',
      quickActions: 'إجراءات سريعة',
      commonTasks: 'المهام والعمليات الشائعة',
      viewOPDCensus: 'عرض إحصائية العيادات الخارجية',
      dailyClinicActivity: 'نشاط العيادات اليومي',
      viewLiveBeds: 'عرض الأسرة الحية',
      currentBedStatus: 'حالة الأسرة الحالية',
      viewEquipment: 'عرض المعدات',
      equipmentManagement: 'إدارة المعدات',
      recentActivity: 'النشاط الأخير',
      latestSystemUpdates: 'آخر تحديثات النظام',
      liveBedStatus: 'حالة الأسرة الحية',
      realTimeOccupancy: 'الإشغال في الوقت الفعلي',
      equipmentChecklist: 'قائمة فحص المعدات',
      dailyEquipmentChecks: 'فحص المعدات اليومي',
      systemStatus: 'حالة النظام',
      platformHealthConnectivity: 'صحة المنصة والاتصال',
      database: 'قاعدة البيانات',
      connected: 'متصل',
      apiServices: 'خدمات API',
      operational: 'تعمل',
      aiServices: 'خدمات الذكاء الاصطناعي',
      ready: 'جاهز',
      opdDataUpdated: 'تم تحديث بيانات العيادات الخارجية',
      newEquipmentAdded: 'تم إضافة معدات جديدة',
      bedOccupancyAlert: 'تنبيه إشغال الأسرة',
      minutesAgo: 'دقائق مضت',
      hoursAgo: 'ساعات مضت',
      opdVisits: 'زيارات العيادات الخارجية',
      erVisits: 'زيارات الطوارئ',
      bedOccupancy: 'إشغال الأسرة',
      orOperations: 'عمليات غرفة العمليات',
      lapOperations: 'عمليات المنظار',
      radiology: 'الأشعة',
      kathLap: 'قسطرة القلب',
      endoscopy: 'المنظار',
      physiotherapy: 'العلاج الطبيعي',
      deliveries: 'الولادات',
      deaths: 'الوفيات',
      pharmacyVisits: 'زيارات الصيدلية',
      emergencyRoomVisits: 'زيارات غرفة الطوارئ',
      operatingRoomProcedures: 'إجراءات غرفة العمليات',
      laparoscopicProcedures: 'إجراءات المنظار',
      imagingStudies: 'دراسات التصوير',
      catheterizationProcedures: 'إجراءات القسطرة',
      endoscopicProcedures: 'إجراءات المنظار',
      physicalTherapySessions: 'جلسات العلاج الطبيعي',
      births: 'الولادات',
      mortalityCount: 'عدد الوفيات',
      pharmacyConsultations: 'استشارات الصيدلية',
    },
    account: {
      accountSettings: 'إعدادات الحساب',
      manageAccountPreferences: 'إدارة حسابك وتفضيلاتك',
      profileInformation: 'معلومات الملف الشخصي',
      accountDetails: 'تفاصيل حسابك',
      changePassword: 'تغيير كلمة المرور',
      updatePassword: 'تحديث كلمة المرور',
      currentPassword: 'كلمة المرور الحالية',
      confirmNewPassword: 'تأكيد كلمة المرور الجديدة',
      changing: 'جاري التغيير...',
      passwordChangedSuccess: 'تم تغيير كلمة المرور بنجاح',
      passwordsDoNotMatch: 'كلمات المرور الجديدة غير متطابقة',
      failedToChangePassword: 'فشل تغيير كلمة المرور',
    },
    opd: {
      opdDashboard: 'لوحة تحكم العيادات الخارجية',
      totalVisits: 'إجمالي الزيارات',
      activeClinics: 'العيادات النشطة',
      avgUtilization: 'متوسط الاستخدام',
      clinicCapacityUsage: 'استخدام سعة العيادة',
      dailyCensus: 'الإحصائية اليومية',
      viewPatientCountsPerClinic: 'عرض عدد المرضى لكل عيادة',
      clinicUtilization: 'استخدام العيادات',
      analyzeClinicCapacityUsage: 'تحليل استخدام سعة العيادات',
      doctorsView: 'عرض الأطباء',
      doctorSchedulesWorkload: 'جداول الأطباء وأعباء العمل',
      outpatientDepartmentOverview: 'نظرة عامة على قسم العيادات الخارجية',
      showFilter: 'إظهار الفلتر',
      hideFilter: 'إخفاء الفلتر',
      newPatients: 'مرضى جدد',
      firstTimeVisits: 'زيارات لأول مرة',
      followUpVisits: 'زيارات متابعة',
      returningPatients: 'مرضى عائدون',
    },
    px: {
      visit: {
        title: 'زيارة تجربة المريض',
        subtitle: 'تسجيل زيارة جديدة لتجربة المريض',
        stepStaff: 'الموظف',
        stepVisit: 'موقع الزيارة',
        stepPatient: 'المريض',
        stepClassification: 'التصنيف',
        stepDetails: 'التفاصيل',
        stepSummary: 'الملخص',
        staffName: 'اسم الموظف',
        staffId: 'رقم الموظف',
        floor: 'الطابق',
        department: 'القسم',
        room: 'الغرفة',
        patientName: 'اسم المريض',
        patientFileNumber: 'رقم ملف المريض',
        domain: 'المجال',
        classification: 'التصنيف',
        severity: 'الشدة',
        details: 'التفاصيل',
        complainedStaff: 'الموظف المشكو منه',
        success: 'نجح',
        successMessage: 'تم تسجيل الزيارة بنجاح',
        newRecord: 'تسجيل زيارة جديدة',
        autoFilledFromAccount: 'تم ملؤه تلقائياً من حسابك',
        addStaffIdInUsersPage: 'يرجى إضافة رقم الموظف في صفحة المستخدمين',
        staffNameRequired: 'اسم الموظف مطلوب',
        staffIdRequired: 'رقم الموظف مطلوب. يرجى إضافته في صفحة المستخدمين.',
      },
    },
  },
};

/**
 * Translation function
 * @param key - Dot-separated key path (e.g., 'px.setup.title')
 * @param lang - Language code ('en' | 'ar')
 * @returns Translated string or the key if not found
 */
export function t(key: string, lang: Language = 'en'): string {
  const keys = key.split('.');
  let value: any = translations[lang];
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key; // Return key if path not found
    }
  }
  
  return typeof value === 'string' ? value : key;
}

/**
 * Get all translations for a given key path
 * @param key - Dot-separated key path
 * @returns Object with 'en' and 'ar' translations
 */
export function getTranslations(key: string): { en: string; ar: string } {
  return {
    en: t(key, 'en'),
    ar: t(key, 'ar'),
  };
}

