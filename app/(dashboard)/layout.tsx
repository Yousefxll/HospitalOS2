'use client';

import { ClientLayoutSwitcher } from '@/components/shell/ClientLayoutSwitcher';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClientLayoutSwitcher>
      {children}
    </ClientLayoutSwitcher>
  );
}
