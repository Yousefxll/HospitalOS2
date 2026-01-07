# Mobile UI/UX Rebuild Guide

## ✅ Completed Foundation Components

### Core Mobile Components
1. **MobileSearchBar** (`components/mobile/MobileSearchBar.tsx`)
   - Debounced search with URL sync
   - Touch-friendly (44px height)
   - Clear button

2. **MobileFilterBar** (`components/mobile/MobileFilterBar.tsx`)
   - Sticky filter button with badge count
   - Sheet drawer for filter options
   - Active filter chips
   - Clear all option

3. **MobileCardList** (`components/mobile/MobileCardList.tsx`)
   - Card-based layout for mobile
   - Details sheet/drawer
   - Loading skeletons
   - Empty states

4. **MobileTopBar** (`components/nav/MobileTopBar.tsx`)
   - Auto back button
   - Page title
   - Quick actions menu

5. **MobileBottomNav** (`components/nav/MobileBottomNav.tsx`)
   - 5 main tabs (Dashboard, OPD, Nursing, PX, Policies)
   - Admin tab (permission-based)
   - Account tab
   - More button for overflow
   - Permission-based filtering

6. **MobileShell** (`components/shell/MobileShell.tsx`)
   - Layout wrapper
   - Safe area support (iPhone notch/home indicator)
   - Scroll restoration

## 📋 Page Update Checklist

### Pattern for Each Page

#### 1. Layout Structure
```tsx
<div className="space-y-4">
  {/* Quick Summary Section (Mobile) */}
  <div className="md:hidden">
    {/* Key metrics/quick actions */}
  </div>

  {/* Search Bar */}
  <MobileSearchBar 
    placeholder="Search..."
    queryParam="q"
    onSearch={handleSearch}
  />

  {/* Filter Bar (if needed) */}
  <MobileFilterBar
    filters={filterGroups}
    activeFilters={activeFilters}
    onFilterChange={handleFilterChange}
  />

  {/* Content - Cards on Mobile, Table on Desktop */}
  <div className="md:hidden">
    <MobileCardList items={cardItems} />
  </div>
  <div className="hidden md:block">
    {/* Existing table */}
  </div>
</div>
```

#### 2. Responsive Utilities
- Use `md:hidden` for mobile-only
- Use `hidden md:block` for desktop-only
- Use `md:grid-cols-2 lg:grid-cols-3` for responsive grids
- Single column on mobile: `flex flex-col`

#### 3. Touch Targets
- Buttons: `min-h-[44px]` or `h-11`
- Inputs: `h-11` (44px)
- Cards: `p-4` minimum padding

#### 4. Forms
- Full width inputs: `w-full`
- Large touch targets: `h-11`
- Multi-step forms for long forms
- Inline validation

## 📝 Pages to Update

### Priority 1: Core Pages
- [ ] `/dashboard` - Main dashboard
- [ ] `/opd/dashboard` - OPD overview
- [ ] `/nursing/operations` - Nursing operations
- [ ] `/patient-experience/dashboard` - PX dashboard
- [ ] `/policies` - Policy library

### Priority 2: List/Table Pages
- [ ] `/opd/clinic-daily-census`
- [ ] `/opd/dept-view`
- [ ] `/patient-experience/visits`
- [ ] `/patient-experience/cases`
- [ ] `/admin/users`
- [ ] `/admin/admin`

### Priority 3: Form Pages
- [ ] `/opd/daily-data-entry`
- [ ] `/patient-experience/visit` (create/edit)
- [ ] `/er/register`
- [ ] `/er/triage`

### Priority 4: Detail Pages
- [ ] `/patient-experience/visit/[id]`
- [ ] `/patient-experience/cases/[id]`
- [ ] `/policies/[id]`

## 🔧 Implementation Steps

1. **Add Mobile Search** (if page has list/table)
2. **Add Mobile Filters** (if page has filters)
3. **Convert Table to Cards** (mobile view)
4. **Add Quick Summary** (top section on mobile)
5. **Update Forms** (touch-friendly, full width)
6. **Add Skeleton Loading** (for better UX)
7. **Test on Mobile** (actual device or Chrome DevTools)

## 📱 Mobile-First CSS Patterns

```css
/* Single column on mobile */
.container {
  @apply flex flex-col md:flex-row;
}

/* Responsive grid */
.grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3;
}

/* Hide on mobile, show on desktop */
.desktop-only {
  @apply hidden md:block;
}

/* Show on mobile, hide on desktop */
.mobile-only {
  @apply md:hidden;
}

/* Touch-friendly buttons */
.button {
  @apply min-h-[44px] px-4;
}
```

## 🎯 Performance Tips

1. **Lazy Load Charts**
   ```tsx
   const Chart = dynamic(() => import('./Chart'), { ssr: false });
   ```

2. **Use React.memo** for expensive components
3. **Virtual scrolling** for long lists (react-window)
4. **Debounce search** (already in MobileSearchBar)
5. **Pagination/Infinite scroll** for large datasets

## ♿ Accessibility

- ARIA labels for icons
- Keyboard navigation
- Focus states
- Proper contrast ratios
- Screen reader support

## 📊 Files Changed Summary

### New Files
- `components/mobile/MobileSearchBar.tsx`
- `components/mobile/MobileFilterBar.tsx`
- `MOBILE_REBUILD_GUIDE.md`

### Updated Files
- `components/nav/MobileBottomNav.tsx` - Enhanced with permissions and 5+ tabs

### Existing Files (Already Mobile-Ready)
- `components/mobile/MobileCardList.tsx`
- `components/nav/MobileTopBar.tsx`
- `components/shell/MobileShell.tsx`
- `components/shell/ClientLayoutSwitcher.tsx`

