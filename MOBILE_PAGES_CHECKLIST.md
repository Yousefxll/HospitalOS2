# Mobile Pages Update Checklist

## ✅ Completed

### Foundation Components
- ✅ MobileSearchBar
- ✅ MobileFilterBar  
- ✅ MobileBottomNav (updated with permissions)
- ✅ MobileTopBar
- ✅ MobileCardList
- ✅ MobileShell
- ✅ Dashboard page (responsive KPI cards)

## 📋 Pages to Update

### Priority 1: Core Dashboards
- [x] `/dashboard` - ✅ Updated (responsive KPI grid)
- [ ] `/opd/dashboard`
- [ ] `/nursing/operations`
- [ ] `/patient-experience/dashboard`
- [ ] `/policies` (Policy Library)

### Priority 2: List/Table Pages (Need MobileCardList)
- [ ] `/opd/clinic-daily-census`
- [ ] `/opd/dept-view`
- [ ] `/opd/clinic-utilization`
- [ ] `/patient-experience/visits`
- [ ] `/patient-experience/cases`
- [ ] `/patient-experience/analytics`
- [ ] `/admin/users`
- [ ] `/admin/admin`
- [ ] `/admin/groups-hospitals`
- [ ] `/policies/conflicts`
- [ ] `/policies/tag-review-queue`

### Priority 3: Form Pages (Need Mobile-Friendly Forms)
- [ ] `/opd/daily-data-entry`
- [ ] `/opd/import-data`
- [ ] `/patient-experience/visit` (create/edit)
- [ ] `/patient-experience/cases/[id]` (edit)
- [ ] `/er/register`
- [ ] `/er/triage`
- [ ] `/er/disposition`
- [ ] `/er/progress-note`

### Priority 4: Detail/View Pages
- [ ] `/patient-experience/visit/[id]`
- [ ] `/patient-experience/cases/[id]`
- [ ] `/policies/[id]` (view policy)
- [ ] `/admin/users/[id]`

### Priority 5: Analytics/Reports Pages
- [ ] `/patient-experience/analytics`
- [ ] `/patient-experience/reports`
- [ ] `/opd/dept-view` (performance comparison)
- [ ] `/opd/clinic-utilization`

## 🔧 Update Pattern for Each Page

### Step 1: Add Mobile Search (if list/table)
```tsx
import { MobileSearchBar } from '@/components/mobile/MobileSearchBar';

// In component:
const [searchQuery, setSearchQuery] = useState('');

<MobileSearchBar
  placeholder="Search..."
  queryParam="q"
  onSearch={(q) => setSearchQuery(q)}
/>
```

### Step 2: Add Mobile Filters (if needed)
```tsx
import { MobileFilterBar } from '@/components/mobile/MobileFilterBar';

const [activeFilters, setActiveFilters] = useState({});

<MobileFilterBar
  filters={filterGroups}
  activeFilters={activeFilters}
  onFilterChange={(id, value) => {
    setActiveFilters(prev => ({ ...prev, [id]: value }));
  }}
/>
```

### Step 3: Convert Table to Cards (Mobile)
```tsx
import { MobileCardList } from '@/components/mobile/MobileCardList';

// Mobile view
<div className="md:hidden">
  <MobileCardList
    items={tableData.map(row => ({
      id: row.id,
      title: row.name,
      subtitle: row.category,
      badges: [{ label: row.status }],
      metadata: [
        { label: 'Date', value: row.date },
        { label: 'Amount', value: row.amount },
      ],
      onCardClick: () => router.push(`/details/${row.id}`),
    }))}
    isLoading={isLoading}
  />
</div>

// Desktop view (keep existing table)
<div className="hidden md:block">
  {/* Existing table */}
</div>
```

### Step 4: Make Layouts Responsive
```tsx
// Single column on mobile
<div className="flex flex-col md:flex-row gap-4">

// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// Hide on mobile
<div className="hidden md:block">

// Show on mobile only
<div className="md:hidden">
```

### Step 5: Touch-Friendly Buttons
```tsx
<Button className="min-h-[44px] w-full md:w-auto">
  Action
</Button>
```

### Step 6: Add Quick Summary (Mobile)
```tsx
<div className="md:hidden mb-4">
  <Card>
    <CardHeader>
      <CardTitle>Quick Summary</CardTitle>
    </CardHeader>
    <CardContent>
      {/* Key metrics */}
    </CardContent>
  </Card>
</div>
```

## 📱 Mobile-Specific Considerations

1. **Touch Targets**: Minimum 44x44px
2. **Spacing**: Use `gap-3` or `gap-4` (12-16px)
3. **Text Size**: Minimum 14px for body, 16px for inputs
4. **Cards**: Full width on mobile, use `p-4` padding
5. **Forms**: Full width inputs, stacked vertically
6. **Navigation**: Use bottom tabs, not sidebar
7. **Loading**: Show skeletons, not spinners
8. **Empty States**: Clear, actionable messages

## 🎯 Performance Checklist

- [ ] Lazy load charts (use `dynamic` import)
- [ ] Use `React.memo` for expensive components
- [ ] Debounce search (already in MobileSearchBar)
- [ ] Pagination or infinite scroll for long lists
- [ ] Optimize images (use Next.js Image)
- [ ] Minimize client bundle size

## ♿ Accessibility Checklist

- [ ] ARIA labels for icons
- [ ] Keyboard navigation
- [ ] Focus states visible
- [ ] Proper contrast ratios
- [ ] Screen reader support
- [ ] Touch target sizes (44px min)

## 📊 Files Changed Summary

### New Files Created
- `components/mobile/MobileSearchBar.tsx`
- `components/mobile/MobileFilterBar.tsx`
- `MOBILE_REBUILD_GUIDE.md`
- `MOBILE_PAGES_CHECKLIST.md`

### Updated Files
- `components/nav/MobileBottomNav.tsx` - Enhanced with permissions
- `app/(dashboard)/dashboard/page.tsx` - Responsive KPI cards

### Next Files to Update
- `app/(dashboard)/opd/dashboard/page.tsx`
- `app/(dashboard)/patient-experience/visits/page.tsx`
- `app/(dashboard)/patient-experience/cases/page.tsx`
- `app/(dashboard)/admin/users/page.tsx`
- ... (see checklist above)

