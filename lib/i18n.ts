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
    accessDenied: string;
    contactAdmin: string;
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
    policyConflicts: string;
    policyCreate: string;
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
    title: string;
    subtitle: string;
    setup: {
      title: string;
      subtitle: string;
      addData: string;
      chooseDataType: string;
      floor: string;
      department: string;
      room: string;
      classification: string;
      nursingClassification: string;
      existingFloors: string;
      existingDepartments: string;
      existingRooms: string;
      existingClassifications: string;
      noFloors: string;
      noDepartments: string;
      noRooms: string;
      noClassifications: string;
      addNew: string;
      editItem: string;
      deleteItem: string;
      floorNumber: string;
      floorName: string;
      chooseFloor: string;
      departmentName: string;
      roomNumber: string;
      category: string;
      praise: string;
      complaint: string;
      classificationName: string;
      nursingType: string;
      chooseDepartment: string;
      chooseCategory: string;
      nursingClassificationName: string;
      existingNursingClassifications: string;
      noNursingClassifications: string;
    };
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

  // Policy System
  policies: {
    library: {
      title: string;
      subtitle: string;
      uploadPolicies: string;
      uploading: string;
      policies: string;
      listDescription: string;
      filename: string;
      policyId: string;
      status: string;
      pages: string;
      progress: string;
      indexedAt: string;
      actions: string;
      loadingPolicies: string;
      noPoliciesFound: string;
      uploadFirstPolicy: string;
      uploadingFiles: string;
      processingIndexing: string;
      policyPreview: string;
      previewAvailableOnly: string;
      policyNotReady: string;
      stillProcessing: string;
      policyNotFound: string;
      mayHaveBeenDeleted: string;
      reRunOcr: string;
      reIndexAllChunks: string;
      processing: string;
      reIndex: string;
      scannedPdfNotIndexed: string;
      ocrRequired: string;
      indexed: string;
      notIndexed: string;
      page: string;
      of: string;
      areYouSureDelete: string;
      fileAlreadyExists: string;
      followingFilesExist: string;
    };
    conflicts: {
      title: string;
      scanPolicies: string;
      selectPolicyA: string;
      selectPolicyB: string;
      selectPolicies: string;
      comparePolicies: string;
      strictness: string;
      strict: string;
      balanced: string;
      limitPolicies: string;
      scan: string;
      scanning: string;
      issuesFound: string;
      issueType: string;
      severity: string;
      summary: string;
      recommendation: string;
      viewDetails: string;
      noIssuesFound: string;
      selectPolicyToRewrite: string;
      rewritePolicy: string;
      rewriteAll: string;
      rewriteAgain: string;
      downloadPolicy: string;
      downloadAsText: string;
      downloadAsPdf: string;
      copied: string;
      recommendationCopied: string;
      accreditation: string;
      selectAccreditations: string;
      customAccreditation: string;
      enterCustomAccreditation: string;
      aiReview: string;
      aiIssues: string;
      aiRewrite: string;
      findConflictsGapsRisks: string;
      generateAnswer: string;
      generating: string;
    };
    assistant: {
      title: string;
      subtitle: string;
      askQuestion: string;
      searchPolicies: string;
      selectHospital: string;
      selectCategory: string;
      generateAnswer: string;
      generating: string;
      questionPlaceholder: string;
    };
    newPolicy: {
      title: string;
      subtitle: string;
      policyDetails: string;
      fillInDetails: string;
      policyTitle: string;
      domain: string;
      detailLevel: string;
      brief: string;
      standard: string;
      detailed: string;
      accreditationFocus: string;
      riskLevel: string;
      selectRiskLevelOptional: string;
      low: string;
      medium: string;
      high: string;
      critical: string;
      purpose: string;
      scope: string;
      keyRules: string;
      monitoring: string;
      notes: string;
      generatePolicy: string;
      generating: string;
      downloadPolicy: string;
      downloadAsText: string;
      downloadAsPdf: string;
      generatedPolicy: string;
      aiGeneratedPolicyDocument: string;
      generatedPolicyWillAppear: string;
      fillFormAndClick: string;
      pleaseEnterPolicyTitle: string;
    };
    harmonization: {
      title: string;
      subtitle: string;
      selectDocuments: string;
      chooseHospitalsCategoryMethod: string;
      hospital: string;
      category: string;
      categoryFilter: string;
      compareMethod: string;
      allHospitals: string;
      topicQuery: string;
      autoPickNPolicies: string;
      manualSelection: string;
      allPolicies: string;
      allPoliciesWarning: string;
      topicQueryPlaceholder: string;
      step1Summarize: string;
      step2Harmonize: string;
      summarizing: string;
      harmonizing: string;
      availableDocuments: string;
      selectDocumentsToCompare: string;
      summaries: string;
      documentsSummarized: string;
      generateHarmonization: string;
      generating: string;
      selectAtLeastTwo: string;
      enterTopicQuery: string;
      harmonizationResult: string;
      analysisOfDocuments: string;
      harmonizationCompleted: string;
      atLeastTwoRequired: string;
      confirmHarmonizeMany: string;
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
      accessDenied: 'You do not have permission to view this page.',
      contactAdmin: 'Please contact your administrator to request access.',
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
      policyConflicts: 'Conflicts & Issues',
      policyCreate: 'Create',
      policyAssistant: 'Policy Assistant',
      newPolicyCreator: 'New Policy Creator',
      policyHarmonization: 'Policy Harmonization',
      dataAdmin: 'Data Admin',
      deleteSampleData: 'Delete Sample Data',
      users: 'Users',
    },
    header: {
      hospitalOS: 'SIRA',
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
      signInToAccess: 'Sign In',
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
      title: 'Patient Experience',
      subtitle: 'Record patient complaints and feedback',
      setup: {
        title: 'Patient Experience Setup',
        subtitle: 'Manage floors, departments, rooms, and classifications',
        addData: 'Add Data',
        chooseDataType: 'Choose the type of data to add',
        floor: 'Floor',
        department: 'Department',
        room: 'Room',
        classification: 'Classification',
        nursingClassification: 'sub Classification',
        existingFloors: 'Existing Floors',
        existingDepartments: 'Existing Departments',
        existingRooms: 'Existing Rooms',
        existingClassifications: 'Existing Classifications',
        noFloors: 'No floors',
        noDepartments: 'No departments in this floor',
        noRooms: 'No rooms',
        noClassifications: 'No classifications',
        addNew: 'Add New',
        editItem: 'Edit',
        deleteItem: 'Delete',
        floorNumber: 'Floor Number',
        floorName: 'Floor Name',
        chooseFloor: 'Choose Floor',
        departmentName: 'Department Name',
        roomNumber: 'Room Number',
        category: 'Category',
        praise: 'Praise',
        complaint: 'Complaint',
        classificationName: 'Classification Name',
        nursingType: 'Sub Classification Type',
        chooseDepartment: 'Choose Department',
        chooseCategory: 'Choose Category',
        nursingClassificationName: 'Sub Classification Name',
        existingNursingClassifications: 'Existing Sub Classifications',
        noNursingClassifications: 'No sub classifications',
      },
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
    policies: {
      library: {
        title: 'Policies Library',
        subtitle: 'Upload, manage, and preview policy documents',
        uploadPolicies: 'Upload Policies',
        uploading: 'Uploading...',
        policies: 'Policies',
        listDescription: 'List of all policy documents',
        filename: 'Filename',
        policyId: 'Policy ID',
        status: 'Status',
        pages: 'Pages',
        progress: 'Progress',
        indexedAt: 'Indexed At',
        actions: 'Actions',
        loadingPolicies: 'Loading policies...',
        noPoliciesFound: 'No policies found. Upload your first policy to get started.',
        uploadFirstPolicy: 'Upload your first policy to get started.',
        uploadingFiles: 'Uploading files...',
        processingIndexing: 'Processing and indexing files...',
        policyPreview: 'Policy Preview',
        previewAvailableOnly: 'Preview available only when READY',
        policyNotReady: 'Policy not ready',
        stillProcessing: 'This policy is still being processed.',
        policyNotFound: 'Policy not found',
        mayHaveBeenDeleted: 'This policy may have been deleted.',
        reRunOcr: 'Re-run OCR',
        reIndexAllChunks: 'Re-index all chunks',
        processing: 'Processing...',
        reIndex: 'Re-index',
        scannedPdfNotIndexed: 'Scanned PDF not indexed. OCR required to enable search.',
        ocrRequired: 'OCR required to enable search',
        indexed: 'Indexed ✅',
        notIndexed: 'Not Indexed',
        page: 'Page:',
        of: 'of',
        areYouSureDelete: 'Are you sure you want to delete this policy?',
        fileAlreadyExists: 'File already exists',
        followingFilesExist: 'The following file(s) already exist and cannot be uploaded again:',
      },
      conflicts: {
        title: 'Policy Conflicts & Issues',
        scanPolicies: 'Scan Policies',
        selectPolicyA: 'Select Policy A',
        selectPolicyB: 'Select Policy B',
        selectPolicies: 'Select Policies',
        comparePolicies: 'Compare Policies',
        strictness: 'Strictness',
        strict: 'Strict',
        balanced: 'Balanced',
        limitPolicies: 'Limit Policies',
        scan: 'Scan',
        scanning: 'Scanning...',
        issuesFound: 'Issues Found',
        issueType: 'Issue Type',
        severity: 'Severity',
        summary: 'Summary',
        recommendation: 'Recommendation',
        viewDetails: 'View Details',
        noIssuesFound: 'No issues found',
        selectPolicyToRewrite: 'Select Policy to Rewrite',
        rewritePolicy: 'Rewrite Policy',
        rewriteAll: 'Rewrite Policy (Apply All Issues)',
        rewriteAgain: 'Rewrite Again',
        downloadPolicy: 'Download Policy',
        downloadAsText: 'Download as Text',
        downloadAsPdf: 'Download as PDF',
        copied: 'Copied',
        recommendationCopied: 'Recommendation copied to clipboard',
        accreditation: 'Accreditation',
        selectAccreditations: 'Select Accreditations',
        customAccreditation: 'Custom Accreditation',
        enterCustomAccreditation: 'Enter custom accreditation name',
        aiReview: 'AI Review',
        aiIssues: 'AI Issues',
        aiRewrite: 'AI Rewrite',
        findConflictsGapsRisks: 'Find conflicts, gaps, and risks in these policies',
        generateAnswer: 'Generate Answer',
        generating: 'Generating...',
      },
      assistant: {
        title: 'Policy Assistant',
        subtitle: 'Ask questions about your policies',
        askQuestion: 'Ask a question',
        searchPolicies: 'Search Policies',
        selectHospital: 'Select Hospital',
        selectCategory: 'Select Category',
        generateAnswer: 'Generate Answer',
        generating: 'Generating...',
        questionPlaceholder: 'Ask a question about your policies...',
      },
      newPolicy: {
        title: 'AI New Policy Creator',
        subtitle: 'Generate a new policy from scratch',
        policyDetails: 'Policy Details',
        fillInDetails: 'Fill in the details to generate a new policy',
        policyTitle: 'Policy Title',
        domain: 'Domain',
        detailLevel: 'Detail Level',
        brief: 'Brief',
        standard: 'Standard',
        detailed: 'Detailed',
        accreditationFocus: 'Accreditation Focus',
        riskLevel: 'Risk Level',
        selectRiskLevelOptional: 'Select risk level (optional)',
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        critical: 'Critical',
        purpose: 'Purpose',
        scope: 'Scope',
        keyRules: 'Key Rules',
        monitoring: 'Monitoring',
        notes: 'Notes',
        generatePolicy: 'Generate Policy',
        generating: 'Generating...',
        downloadPolicy: 'Download Policy',
        downloadAsText: 'Download as Text',
        downloadAsPdf: 'Download as PDF',
        generatedPolicy: 'Generated Policy',
        aiGeneratedPolicyDocument: 'AI-generated policy document',
        generatedPolicyWillAppear: 'Generated policy will appear here',
        fillFormAndClick: 'Fill in the form and click "Generate Policy"',
        pleaseEnterPolicyTitle: 'Please enter a policy title',
      },
      harmonization: {
        title: 'Policy Harmonization',
        subtitle: 'Compare and harmonize multiple policies',
        selectDocuments: 'Select Documents',
        chooseHospitalsCategoryMethod: 'Choose hospitals, category, and comparison method',
        hospital: 'Hospital',
        category: 'Category',
        categoryFilter: 'Category filter',
        compareMethod: 'Compare Method',
        allHospitals: 'All Hospitals',
        topicQuery: 'Topic Query',
        autoPickNPolicies: 'Topic Query (Auto-pick N policies)',
        manualSelection: 'Manual Selection',
        allPolicies: 'All Policies',
        allPoliciesWarning: 'All Policies (Warning: Heavy)',
        topicQueryPlaceholder: 'e.g., patient fall prevention',
        step1Summarize: 'Step 1: Summarize',
        step2Harmonize: 'Step 2: Harmonize',
        summarizing: 'Summarizing...',
        harmonizing: 'Harmonizing...',
        availableDocuments: 'Available Documents',
        selectDocumentsToCompare: 'Select documents to compare',
        summaries: 'Summaries',
        documentsSummarized: 'document(s) summarized',
        generateHarmonization: 'Generate Harmonization',
        generating: 'Generating...',
        selectAtLeastTwo: 'Please select at least two documents',
        enterTopicQuery: 'Enter topic query',
        harmonizationResult: 'Harmonization Result',
        analysisOfDocuments: 'Analysis of',
        harmonizationCompleted: 'Harmonization completed',
        atLeastTwoRequired: 'At least 2 documents required for harmonization',
        confirmHarmonizeMany: 'You are about to harmonize {count} documents. This may take a long time. Continue?',
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
      accessDenied: 'ليس لديك صلاحية لعرض هذه الصفحة.',
      contactAdmin: 'يرجى الاتصال بالمسؤول لطلب الوصول.',
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
      policyConflicts: 'التعارضات والمشاكل',
      policyCreate: 'إنشاء',
      policyAssistant: 'مساعد السياسات',
      newPolicyCreator: 'منشئ السياسات الجديد',
      policyHarmonization: 'توحيد السياسات',
      dataAdmin: 'إدارة البيانات',
      deleteSampleData: 'حذف البيانات الوهمية',
      users: 'المستخدمون',
    },
    header: {
      hospitalOS: 'سِيرَه',
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
      signInToAccess: 'تسجيل الدخول',
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
    px: {
      title: 'تجربة المريض',
      subtitle: 'تسجيل شكاوى وملاحظات المرضى',
      setup: {
        title: 'إعدادات تجربة المريض',
        subtitle: 'إدارة الطوابق والأقسام والغرف والتصنيفات',
        addData: 'إضافة بيانات',
        chooseDataType: 'اختر نوع البيانات المراد إضافتها',
        floor: 'طابق',
        department: 'قسم',
        room: 'غرفة',
        classification: 'تصنيف',
        nursingClassification: 'تصنيف فرعي',
        existingFloors: 'الطوابق الموجودة',
        existingDepartments: 'الأقسام الموجودة',
        existingRooms: 'الغرف الموجودة',
        existingClassifications: 'التصنيفات الموجودة',
        noFloors: 'لا توجد طوابق',
        noDepartments: 'لا توجد أقسام في هذا الطابق',
        noRooms: 'لا توجد غرف',
        noClassifications: 'لا توجد تصنيفات',
        addNew: 'إضافة جديد',
        editItem: 'تعديل',
        deleteItem: 'حذف',
        floorNumber: 'رقم الطابق',
        floorName: 'اسم الطابق',
        chooseFloor: 'اختر الطابق',
        departmentName: 'اسم القسم',
        roomNumber: 'رقم الغرفة',
        category: 'الفئة',
        praise: 'شكر',
        complaint: 'شكوى',
        classificationName: 'اسم التصنيف',
        nursingType: 'نوع التصنيف الفرعي',
        chooseDepartment: 'اختر القسم',
        chooseCategory: 'اختر الفئة',
        nursingClassificationName: 'اسم التصنيف الفرعي',
        existingNursingClassifications: 'التصنيفات الفرعية الموجودة',
        noNursingClassifications: 'لا توجد تصنيفات فرعية',
      },
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
    policies: {
      library: {
        title: 'مكتبة السياسات',
        subtitle: 'رفع وإدارة ومعاينة وثائق السياسات',
        uploadPolicies: 'رفع السياسات',
        uploading: 'جاري الرفع...',
        policies: 'السياسات',
        listDescription: 'قائمة بجميع وثائق السياسات',
        filename: 'اسم الملف',
        policyId: 'معرف السياسة',
        status: 'الحالة',
        pages: 'الصفحات',
        progress: 'التقدم',
        indexedAt: 'تم الفهرسة في',
        actions: 'الإجراءات',
        loadingPolicies: 'جاري تحميل السياسات...',
        noPoliciesFound: 'لم يتم العثور على سياسات. ارفع أول سياسة للبدء.',
        uploadFirstPolicy: 'ارفعل أول سياسة للبدء.',
        uploadingFiles: 'جاري رفع الملفات...',
        processingIndexing: 'جاري المعالجة والفهرسة...',
        policyPreview: 'معاينة السياسة',
        previewAvailableOnly: 'المعاينة متاحة فقط عند الجاهزية',
        policyNotReady: 'السياسة غير جاهزة',
        stillProcessing: 'لا تزال هذه السياسة قيد المعالجة.',
        policyNotFound: 'لم يتم العثور على السياسة',
        mayHaveBeenDeleted: 'قد تكون هذه السياسة قد تم حذفها.',
        reRunOcr: 'إعادة تشغيل OCR',
        reIndexAllChunks: 'إعادة فهرسة جميع الأجزاء',
        processing: 'جاري المعالجة...',
        reIndex: 'إعادة الفهرسة',
        scannedPdfNotIndexed: 'ملف PDF الممسوح ضوئياً غير مفهرس. OCR مطلوب لتفعيل البحث.',
        ocrRequired: 'OCR مطلوب لتفعيل البحث',
        indexed: 'مفهرس ✅',
        notIndexed: 'غير مفهرس',
        page: 'الصفحة:',
        of: 'من',
        areYouSureDelete: 'هل أنت متأكد من حذف هذه السياسة؟',
        fileAlreadyExists: 'الملف موجود بالفعل',
        followingFilesExist: 'الملف(ات) التالية موجودة بالفعل ولا يمكن رفعها مرة أخرى:',
      },
      conflicts: {
        title: 'تعارضات ومشاكل السياسات',
        scanPolicies: 'فحص السياسات',
        selectPolicyA: 'اختر السياسة أ',
        selectPolicyB: 'اختر السياسة ب',
        selectPolicies: 'اختر السياسات',
        comparePolicies: 'مقارنة السياسات',
        strictness: 'الصرامة',
        strict: 'صارم',
        balanced: 'متوازن',
        limitPolicies: 'تقييد السياسات',
        scan: 'فحص',
        scanning: 'جاري الفحص...',
        issuesFound: 'المشاكل الموجودة',
        issueType: 'نوع المشكلة',
        severity: 'الشدة',
        summary: 'الملخص',
        recommendation: 'التوصية',
        viewDetails: 'عرض التفاصيل',
        noIssuesFound: 'لم يتم العثور على مشاكل',
        selectPolicyToRewrite: 'اختر السياسة لإعادة الكتابة',
        rewritePolicy: 'إعادة كتابة السياسة',
        rewriteAll: 'إعادة كتابة السياسة (تطبيق جميع المشاكل)',
        rewriteAgain: 'إعادة الكتابة مرة أخرى',
        downloadPolicy: 'تحميل السياسة',
        downloadAsText: 'تحميل كنص',
        downloadAsPdf: 'تحميل كـ PDF',
        copied: 'تم النسخ',
        recommendationCopied: 'تم نسخ التوصية إلى الحافظة',
        accreditation: 'الاعتماد',
        selectAccreditations: 'اختر الاعتمادات',
        customAccreditation: 'اعتماد مخصص',
        enterCustomAccreditation: 'أدخل اسم الاعتماد المخصص',
        aiReview: 'مراجعة الذكاء الاصطناعي',
        aiIssues: 'مشاكل الذكاء الاصطناعي',
        aiRewrite: 'إعادة كتابة الذكاء الاصطناعي',
        findConflictsGapsRisks: 'العثور على التعارضات والفجوات والمخاطر في هذه السياسات',
        generateAnswer: 'إنشاء إجابة',
        generating: 'جاري الإنشاء...',
      },
      assistant: {
        title: 'مساعد السياسات',
        subtitle: 'اطرح أسئلة حول سياساتك',
        askQuestion: 'اطرح سؤالاً',
        searchPolicies: 'بحث السياسات',
        selectHospital: 'اختر المستشفى',
        selectCategory: 'اختر الفئة',
        generateAnswer: 'إنشاء إجابة',
        generating: 'جاري الإنشاء...',
        questionPlaceholder: 'اطرح سؤالاً حول سياساتك...',
      },
      newPolicy: {
        title: 'منشئ السياسات الجديد بالذكاء الاصطناعي',
        subtitle: 'إنشاء سياسة جديدة من الصفر',
        policyDetails: 'تفاصيل السياسة',
        fillInDetails: 'املأ التفاصيل لإنشاء سياسة جديدة',
        policyTitle: 'عنوان السياسة',
        domain: 'المجال',
        detailLevel: 'مستوى التفاصيل',
        brief: 'مختصر',
        standard: 'قياسي',
        detailed: 'مفصل',
        accreditationFocus: 'تركيز الاعتماد',
        riskLevel: 'مستوى المخاطر',
        selectRiskLevelOptional: 'اختر مستوى المخاطر (اختياري)',
        low: 'منخفض',
        medium: 'متوسط',
        high: 'عالي',
        critical: 'حرج',
        purpose: 'الغرض',
        scope: 'النطاق',
        keyRules: 'القواعد الرئيسية',
        monitoring: 'المراقبة',
        notes: 'ملاحظات',
        generatePolicy: 'إنشاء السياسة',
        generating: 'جاري الإنشاء...',
        downloadPolicy: 'تحميل السياسة',
        downloadAsText: 'تحميل كنص',
        downloadAsPdf: 'تحميل كـ PDF',
        generatedPolicy: 'السياسة المنشأة',
        aiGeneratedPolicyDocument: 'وثيقة السياسة المنشأة بالذكاء الاصطناعي',
        generatedPolicyWillAppear: 'ستظهر السياسة المنشأة هنا',
        fillFormAndClick: 'املأ النموذج وانقر على "إنشاء السياسة"',
        pleaseEnterPolicyTitle: 'يرجى إدخال عنوان السياسة',
      },
      harmonization: {
        title: 'توحيد السياسات',
        subtitle: 'مقارنة وتوحيد سياسات متعددة',
        selectDocuments: 'اختر الوثائق',
        chooseHospitalsCategoryMethod: 'اختر المستشفيات والفئة وطريقة المقارنة',
        hospital: 'المستشفى',
        category: 'الفئة',
        categoryFilter: 'فلتر الفئة',
        compareMethod: 'طريقة المقارنة',
        allHospitals: 'جميع المستشفيات',
        topicQuery: 'استعلام الموضوع',
        autoPickNPolicies: 'استعلام الموضوع (اختيار N سياسات تلقائياً)',
        manualSelection: 'اختيار يدوي',
        allPolicies: 'جميع السياسات',
        allPoliciesWarning: 'جميع السياسات (تحذير: ثقيل)',
        topicQueryPlaceholder: 'مثال: منع سقوط المريض',
        step1Summarize: 'الخطوة 1: تلخيص',
        step2Harmonize: 'الخطوة 2: توحيد',
        summarizing: 'جاري التلخيص...',
        harmonizing: 'جاري التوحيد...',
        availableDocuments: 'الوثائق المتاحة',
        selectDocumentsToCompare: 'اختر الوثائق للمقارنة',
        summaries: 'الملخصات',
        documentsSummarized: 'وثيقة(ات) تم تلخيصها',
        generateHarmonization: 'إنشاء التوحيد',
        generating: 'جاري الإنشاء...',
        selectAtLeastTwo: 'يرجى اختيار وثيقتين على الأقل',
        enterTopicQuery: 'أدخل استعلام الموضوع',
        harmonizationResult: 'نتيجة التوحيد',
        analysisOfDocuments: 'تحليل',
        harmonizationCompleted: 'اكتمل التوحيد',
        atLeastTwoRequired: 'مطلوب وثيقتان على الأقل للتوحيد',
        confirmHarmonizeMany: 'أنت على وشك توحيد {count} وثيقة. قد يستغرق هذا وقتاً طويلاً. هل تريد المتابعة؟',
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

