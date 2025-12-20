'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Calculator,
  Users,
  Building2,
  Stethoscope,
  Activity,
  Plus,
  Edit,
  Trash2,
  Save,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { InlineEditField } from '@/components/InlineEditField';
import { InlineToggle } from '@/components/InlineToggle';

export default function ManpowerManagementPage() {
  const [selectedDepartment, setSelectedDepartment] = useState('dept-1');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Side panel states
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelContent, setPanelContent] = useState<'doctor-schedule' | 'workforce-calculator' | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);

  function openDoctorSchedule(doctor: any) {
    setSelectedDoctor(doctor);
    setPanelContent('doctor-schedule');
    setIsPanelOpen(true);
  }

  function openWorkforceCalculator() {
    setPanelContent('workforce-calculator');
    setIsPanelOpen(true);
  }

  async function handleInlineSave(id: string, field: string, value: any) {
    try {
      // API call to save
      await fetch(`/api/opd/manpower/inline-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, field, value }),
      });
      
      toast({
        title: 'Saved',
        description: `${field} updated successfully`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save changes',
        variant: 'destructive',
      });
      throw error;
    }
  }

  return (
    <div className=\"space-y-6\">
      <div className=\"flex justify-between items-center\">
        <div>
          <h1 className=\"text-3xl font-bold\">OPD Manpower Management</h1>
          <p className=\"text-muted-foreground\">Add, edit, and manage all staffing data</p>
        </div>
        <div className=\"flex gap-2\">
          <Button variant=\"outline\" onClick={openWorkforceCalculator}>
            <Calculator className=\"mr-2 h-4 w-4\" />
            Workforce Calculator
          </Button>
        </div>
      </div>

      {/* Demo content - will be replaced with full implementation */}
      <Card>
        <CardHeader>
          <CardTitle>Page 1 Rebuild in Progress</CardTitle>
          <CardDescription>Full editable version coming shortly...</CardDescription>
        </CardHeader>
        <CardContent>
          <p className=\"text-sm text-muted-foreground\">
            This page is being rebuilt with inline editing, side panels, and full CRUD functionality.
          </p>
        </CardContent>
      </Card>

      {/* Side Panel for Complex Edits */}
      <Sheet open={isPanelOpen} onOpenChange={setIsPanelOpen}>
        <SheetContent className=\"w-[600px] sm:max-w-[600px] overflow-y-auto\">
          <SheetHeader>
            <SheetTitle>
              {panelContent === 'doctor-schedule' && 'Edit Doctor Schedule'}
              {panelContent === 'workforce-calculator' && 'Workforce Calculator Settings'}
            </SheetTitle>
            <SheetDescription>
              {panelContent === 'doctor-schedule' && 'Manage weekly schedule and dedicated resources'}
              {panelContent === 'workforce-calculator' && 'Configure staffing requirements and ratios'}
            </SheetDescription>
          </SheetHeader>

          <div className=\"mt-6 space-y-6\">
            {panelContent === 'doctor-schedule' && (
              <div>Doctor schedule editor will go here</div>
            )}
            
            {panelContent === 'workforce-calculator' && (
              <div>Workforce calculator will go here</div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
