# Mobile-First Implementation Guide

This document describes the mobile-first experience implementation for the HospitalOS application.

## Architecture Overview

The application uses a **dual-shell architecture** that switches between desktop and mobile layouts based on viewport width:

- **Desktop Shell**: Existing sidebar + header layout (unchanged)
- **Mobile Shell**: New mobile-first layout with bottom navigation and top app bar

## Components Created

### Core Shell Components

1. **`components/shell/ClientLayoutSwitcher.tsx`**
   - Client component that uses `useMediaQuery` to detect viewport width
   - Switches between DesktopShell and MobileShell at 768px breakpoint

2. **`components/shell/DesktopShell.tsx`**
   - Wraps existing desktop layout (Sidebar + Header)
   - No changes to desktop UI behavior

3. **`components/shell/MobileShell.tsx`**
   - Mobile-optimized layout
   - Includes MobileTopBar, content area, and MobileBottomNav
   - Supports safe area insets for iPhone notch/home indicator
   - Implements scroll restoration and smooth scrolling

### Navigation Components

4. **`components/nav/MobileTopBar.tsx`**
   - Sticky top app bar with:
     - Page title (center)
     - Back button (left, auto-shown when not on root paths)
     - Action button or menu (right)
   - Safe area support for iPhone notch

5. **`components/nav/MobileBottomNav.tsx`**
   - Fixed bottom navigation bar
   - 4 main sections: Home, Explore (Policies), Alerts, Profile
   - Badge counter for unread notifications
   - Active state highlighting
   - Safe area support for iPhone home indicator

### Mobile UI Components

6. **`components/mobile/MobileCardList.tsx`**
   - Converts table data into mobile-friendly card lists
   - Features:
     - Loading skeletons
     - Empty states
     - Badges and metadata
     - Card actions
     - Optional details Sheet/Drawer
   - Use this instead of tables on mobile

7. **`components/mobile/StickyActionBar.tsx`**
   - Sticky bottom action bar for primary actions
   - Use for Save/Submit buttons
   - Supports multiple actions
   - Safe area aware

### Hooks

8. **`hooks/useMediaQuery.ts`**
   - Custom hook for media query detection
   - Returns boolean indicating if query matches
   - Handles SSR safely

## CSS Enhancements

Added to `app/globals.css`:
- Safe area utility classes (`.safe-area-top`, `.safe-area-bottom`, etc.)
- Smooth scrolling support
- Respects `prefers-reduced-motion`

## Usage Examples

### Basic Mobile Page

```tsx
'use client';

import { MobileCardList } from '@/components/mobile/MobileCardList';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export default function MyPage() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  
  // Your data
  const items = [
    {
      id: '1',
      title: 'Item Title',
      subtitle: 'Subtitle',
      description: 'Description text',
      badges: [{ label: 'Active', variant: 'default' }],
      metadata: [
        { label: 'Status', value: 'Active' },
        { label: 'Date', value: '2024-01-01' }
      ],
      actions: [
        { label: 'Edit', onClick: () => {}, variant: 'outline' },
        { label: 'Delete', onClick: () => {}, variant: 'destructive' }
      ]
    }
  ];

  return (
    <div>
      {/* Show cards on mobile, table on desktop */}
      {isMobile ? (
        <MobileCardList 
          items={items}
          isLoading={false}
          emptyMessage="No items found"
          detailsSheet={{
            title: 'Item Details',
            content: (item) => (
              <div>
                <h2>{item.title}</h2>
                {/* Your details content */}
              </div>
            )
          }}
        />
      ) : (
        <Table>
          {/* Your existing table */}
        </Table>
      )}
    </div>
  );
}
```

### Using Sticky Action Bar

```tsx
import { StickyActionBar } from '@/components/mobile/StickyActionBar';

export default function FormPage() {
  return (
    <div className="pb-20"> {/* Add padding for sticky bar */}
      <form>
        {/* Your form fields */}
      </form>
      
      <StickyActionBar
        actions={[
          { label: 'Cancel', onClick: () => {}, variant: 'outline' },
          { label: 'Save', onClick: () => {}, variant: 'default' }
        ]}
      />
    </div>
  );
}
```

## Breakpoints

- **Mobile**: `< 768px` (uses MobileShell)
- **Desktop**: `>= 768px` (uses DesktopShell)

## Safe Area Support

All mobile components respect iPhone safe areas:
- **Top**: `env(safe-area-inset-top)` for notch
- **Bottom**: `env(safe-area-inset-bottom)` for home indicator

Applied automatically in:
- MobileTopBar
- MobileBottomNav
- StickyActionBar
- MobileShell content area

## Route Mapping

The MobileBottomNav maps to these routes:
- **Home** (`/dashboard`)
- **Explore** (`/policies`) - Search/Explore functionality
- **Alerts** (`/notifications`) - Notifications with badge
- **Profile** (`/account`) - User account settings

## Best Practices

1. **Use MobileCardList instead of tables on mobile**
   - Tables don't work well on small screens
   - Cards provide better touch targets
   - Use Sheet/Drawer for detailed views

2. **Use StickyActionBar for primary actions**
   - Keeps actions accessible
   - Better UX than scrolling to find buttons

3. **Leverage Sheet/Drawer for filters and details**
   - Mobile-friendly alternative to modals
   - Better use of screen space
   - Native-feeling interactions

4. **Always provide loading states**
   - Use Skeleton components
   - Better perceived performance

5. **Respect safe areas**
   - Always use safe area utilities
   - Test on actual devices when possible

## Testing

Test on:
- iPhone (with notch)
- Android devices
- iPad (tablet view)
- Desktop browsers
- Different screen orientations

## Future Enhancements

Potential improvements:
- Pull-to-refresh
- Swipe gestures
- Haptic feedback
- PWA capabilities
- Offline support

