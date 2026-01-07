'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { AlertCircle, User, CreditCard, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from '@/hooks/use-translation';

export default function ERRegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    nationalId: '',
    iqama: '',
    fullName: '',
    dateOfBirth: '',
    gender: '',
    insuranceCompany: '',
    policyClass: '',
    eligibilityStatus: 'unknown',
    paymentType: 'insurance',
  });

  async function handleNafathLogin() {
    // TODO: Integrate with Nafath API
    toast({
      title: 'Nafath Integration',
      description: 'Nafath integration will be implemented here',
    });
  }

  async function handleAbsherLogin() {
    // TODO: Integrate with Absher API
    toast({
      title: 'Absher Integration',
      description: 'Absher integration will be implemented here',
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/er/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Registration Successful',
          description: `ER Visit ID: ${data.erVisitId}`,
        });
        // Redirect to triage page
        router.push(`/er/triage?erVisitId=${data.erVisitId}`);
      } else {
        throw new Error(data.error || 'Registration failed');
      }
    } catch (error: any) {
      toast({
        title: 'Registration Failed',
        description: error.message || 'Failed to register patient',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - Hidden on mobile (MobileTopBar shows it) */}
      <div className="hidden md:block">
        <h1 className="text-3xl font-bold">ER Patient Registration</h1>
        <p className="text-muted-foreground">
          Register patient for ER visit and link identity, insurance, and payment data
        </p>
      </div>

      {/* Quick Login Options */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Login</CardTitle>
          <CardDescription>Login using Nafath or Absher to auto-fetch patient data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={handleNafathLogin} variant="outline" className="flex-1 h-11">
              <User className="mr-2 h-4 w-4" />
              Login with Nafath
            </Button>
            <Button onClick={handleAbsherLogin} variant="outline" className="flex-1 h-11">
              <User className="mr-2 h-4 w-4" />
              Login with Absher
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Registration Form */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Information</CardTitle>
          <CardDescription>Enter patient details manually or use quick login above</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nationalId">National ID</Label>
                <Input
                  id="nationalId"
                  value={formData.nationalId}
                  onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                  placeholder="Enter National ID"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="iqama">Iqama</Label>
                <Input
                  id="iqama"
                  value={formData.iqama}
                  onChange={(e) => setFormData({ ...formData, iqama: e.target.value })}
                  placeholder="Enter Iqama"
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
                placeholder="Enter full name"
                className="h-11"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender *</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => setFormData({ ...formData, gender: value })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Insurance Section */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Insurance Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="insuranceCompany">Insurance Company</Label>
                  <Input
                    id="insuranceCompany"
                    value={formData.insuranceCompany}
                    onChange={(e) => setFormData({ ...formData, insuranceCompany: e.target.value })}
                    placeholder="e.g., Bupa, Tawuniya"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="policyClass">Policy Class</Label>
                  <Input
                    id="policyClass"
                    value={formData.policyClass}
                    onChange={(e) => setFormData({ ...formData, policyClass: e.target.value })}
                    placeholder="e.g., Gold, Silver"
                    className="h-11"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="eligibilityStatus">Eligibility Status</Label>
                  <Select
                    value={formData.eligibilityStatus}
                    onValueChange={(value) => setFormData({ ...formData, eligibilityStatus: value })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eligible">Eligible</SelectItem>
                      <SelectItem value="not-eligible">Not Eligible</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentType">Payment Type</Label>
                  <Select
                    value={formData.paymentType}
                    onValueChange={(value) => setFormData({ ...formData, paymentType: value })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="insurance">Insurance</SelectItem>
                      <SelectItem value="self-pay">Self-Pay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={isLoading} className="flex-1 h-11">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Register Patient
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

