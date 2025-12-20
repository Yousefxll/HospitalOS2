'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Download, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function NewPolicyFromScratchPage() {
  const { toast } = useToast();
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

  async function handleGenerate() {
    if (!formData.title.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a policy title',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedText('');

    try {
      const response = await fetch('/api/policies/ai-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setGeneratedText(data.policyText || '');
        toast({
          title: 'Success',
          description: 'Policy generated successfully',
        });
      } else {
        throw new Error(data.error || 'Generation failed');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
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
        title: 'Error',
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
      title: 'Success',
      description: 'Policy downloaded',
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI New Policy Creator</h1>
        <p className="text-muted-foreground">
          Generate new hospital policies from scratch using AI
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Policy Details</CardTitle>
            <CardDescription>
              Fill in the details to generate a new policy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Patient Fall Prevention Policy"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="domain">Domain</Label>
                <Input
                  id="domain"
                  placeholder="e.g., Patient Safety, Nursing, Emergency"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="detailLevel">Detail Level</Label>
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
                    <SelectItem value="brief">Brief</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="accreditationFocus">Accreditation Focus</Label>
                <Input
                  id="accreditationFocus"
                  placeholder="e.g., JCI, CBAHI, ISO"
                  value={formData.accreditationFocus}
                  onChange={(e) => setFormData({ ...formData, accreditationFocus: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="riskLevel">Risk Level</Label>
                <Select
                  value={formData.riskLevel || undefined}
                  onValueChange={(value: 'low' | 'medium' | 'high' | 'critical') =>
                    setFormData({ ...formData, riskLevel: value as 'low' | 'medium' | 'high' | 'critical' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select risk level (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="purpose">Purpose</Label>
                <Textarea
                  id="purpose"
                  placeholder="Describe the purpose of this policy"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="scope">Scope</Label>
                <Textarea
                  id="scope"
                  placeholder="Describe the scope and applicability"
                  value={formData.scope}
                  onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="keyRules">Key Rules/Requirements</Label>
                <Textarea
                  id="keyRules"
                  placeholder="List key rules or requirements"
                  value={formData.keyRules}
                  onChange={(e) => setFormData({ ...formData, keyRules: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="monitoring">Monitoring Requirements</Label>
                <Textarea
                  id="monitoring"
                  placeholder="Describe monitoring and compliance requirements"
                  value={formData.monitoring}
                  onChange={(e) => setFormData({ ...formData, monitoring: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="notes">Additional Notes</Label>
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
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Policy
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
                <CardTitle>Generated Policy</CardTitle>
                <CardDescription>
                  AI-generated policy document
                </CardDescription>
              </div>
              {generatedText && (
                <Button onClick={handleDownload} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download .txt
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
                <p>Generated policy will appear here</p>
                <p className="text-sm mt-2">Fill in the form and click "Generate Policy"</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

