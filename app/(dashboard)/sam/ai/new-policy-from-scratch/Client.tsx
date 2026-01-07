'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Download, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import { PolicyQuickNav } from '@/components/policies/PolicyQuickNav';

export default function NewPolicyFromScratchClient() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    domain: '',
    detailLevel: 'standard' as 'brief' | 'standard' | 'detailed',
    accreditationFocus: '',
    riskLevel: undefined as 'low' | 'medium' | 'high' | 'critical' | undefined,
    purpose: '',
    scope: '',
    keyRules: '',
    monitoring: '',
    notes: '',
  });

  // Prefill form if draft data is provided (from Risk Detector)
  useEffect(() => {
    const draftParam = searchParams.get('draft');
    if (draftParam) {
      try {
        const draftData = JSON.parse(decodeURIComponent(draftParam));
        if (draftData.title) {
          setFormData(prev => ({
            ...prev,
            title: draftData.title || prev.title,
            purpose: draftData.description || prev.purpose,
          }));
          // If sections are provided, combine them into notes for display
          if (draftData.sections && Array.isArray(draftData.sections)) {
            const sectionsText = draftData.sections
              .map((s: any) => `## ${s.title}\n\n${s.content}`)
              .join('\n\n');
            setGeneratedText(sectionsText);
          }
          toast({
            title: 'Draft loaded',
            description: 'Policy draft loaded from Risk Detector',
          });
        }
      } catch (error) {
        console.error('Failed to parse draft data:', error);
      }
    }
  }, [searchParams, toast]);

  async function handleGenerate() {
    if (!formData.title.trim()) {
      toast({
        title: t.common.error,
        description: t.policies.newPolicy.pleaseEnterPolicyTitle,
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedText('');

    try {
      const response = await fetch('/api/sam/policies/ai-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setGeneratedText(data.policyText || '');
        toast({
          title: t.common.success,
          description: t.policies.newPolicy.generatePolicy + ' ' + t.common.success.toLowerCase(),
        });
      } else {
        throw new Error(data.error || 'Generation failed');
      }
    } catch (error: any) {
      toast({
        title: t.common.error,
        description: error.message || 'Failed to generate policy',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }

  function handleDownload() {
    if (!generatedText) {
      toast({
        title: t.common.error,
        description: 'No policy text to download',
        variant: 'destructive',
      });
      return;
    }

    const blob = new Blob([generatedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formData.title || 'policy'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: t.common.success,
      description: t.policies.newPolicy.downloadPolicy,
    });
  }

  return (
    <div className="space-y-6">
      <PolicyQuickNav />
      <div>
        <h1 className="text-3xl font-bold">{t.policies.newPolicy.title}</h1>
        <p className="text-muted-foreground">
          {t.policies.newPolicy.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>{t.policies.newPolicy.policyDetails}</CardTitle>
            <CardDescription>
              {t.policies.newPolicy.fillInDetails}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">{t.policies.newPolicy.policyTitle} *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Patient Fall Prevention Policy"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="domain">{t.policies.newPolicy.domain}</Label>
                <Input
                  id="domain"
                  placeholder="e.g., Patient Safety, Nursing, Emergency"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="detailLevel">{t.policies.newPolicy.detailLevel}</Label>
                <Select
                  value={formData.detailLevel}
                  onValueChange={(value: 'brief' | 'standard' | 'detailed') =>
                    setFormData({ ...formData, detailLevel: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brief">{t.policies.newPolicy.brief}</SelectItem>
                    <SelectItem value="standard">{t.policies.newPolicy.standard}</SelectItem>
                    <SelectItem value="detailed">{t.policies.newPolicy.detailed}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="accreditationFocus">{t.policies.newPolicy.accreditationFocus}</Label>
                <Input
                  id="accreditationFocus"
                  placeholder="e.g., JCI, CBAHI, ISO"
                  value={formData.accreditationFocus}
                  onChange={(e) => setFormData({ ...formData, accreditationFocus: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="riskLevel">{t.policies.newPolicy.riskLevel}</Label>
                <Select
                  value={formData.riskLevel || undefined}
                  onValueChange={(value: 'low' | 'medium' | 'high' | 'critical') =>
                    setFormData({ ...formData, riskLevel: value as 'low' | 'medium' | 'high' | 'critical' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.policies.newPolicy.selectRiskLevelOptional} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t.policies.newPolicy.low}</SelectItem>
                    <SelectItem value="medium">{t.policies.newPolicy.medium}</SelectItem>
                    <SelectItem value="high">{t.policies.newPolicy.high}</SelectItem>
                    <SelectItem value="critical">{t.policies.newPolicy.critical}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="purpose">{t.policies.newPolicy.purpose}</Label>
                <Textarea
                  id="purpose"
                  placeholder="Describe the purpose of this policy"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="scope">{t.policies.newPolicy.scope}</Label>
                <Textarea
                  id="scope"
                  placeholder="Describe the scope and applicability"
                  value={formData.scope}
                  onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="keyRules">{t.policies.newPolicy.keyRules}</Label>
                <Textarea
                  id="keyRules"
                  placeholder="List key rules or requirements"
                  value={formData.keyRules}
                  onChange={(e) => setFormData({ ...formData, keyRules: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="monitoring">{t.policies.newPolicy.monitoring}</Label>
                <Textarea
                  id="monitoring"
                  placeholder="Describe monitoring and compliance requirements"
                  value={formData.monitoring}
                  onChange={(e) => setFormData({ ...formData, monitoring: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="notes">{t.policies.newPolicy.notes}</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional notes or special considerations"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !formData.title.trim()}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t.policies.newPolicy.generating}
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    {t.policies.newPolicy.generatePolicy}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Generated Policy */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t.policies.newPolicy.generatedPolicy}</CardTitle>
                <CardDescription>
                  {t.policies.newPolicy.aiGeneratedPolicyDocument}
                </CardDescription>
              </div>
              {generatedText && (
                <Button onClick={handleDownload} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  {t.policies.newPolicy.downloadAsText}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {generatedText ? (
              <div className="prose max-w-none whitespace-pre-wrap bg-muted p-4 rounded max-h-[800px] overflow-auto">
                <h2 className="text-2xl font-bold mb-4">{formData.title}</h2>
                {generatedText}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-12">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t.policies.newPolicy.generatedPolicyWillAppear}</p>
                <p className="text-sm mt-2">{t.policies.newPolicy.fillFormAndClick}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

