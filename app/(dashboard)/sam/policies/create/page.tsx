'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2 } from 'lucide-react';

export default function PoliciesCreatePage() {
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [standard, setStandard] = useState('CBAHI');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      toast({
        title: 'Error',
        description: 'Title is required',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/policy-engine/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          context: context.trim(),
          standard,
        }),
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Policy generated',
          description: 'New policy has been generated',
        });
        // Reset form
        setTitle('');
        setContext('');
        setStandard('CBAHI');
      } else {
        throw new Error('Failed to generate policy');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Policy</h1>
        <p className="text-muted-foreground">Generate a new policy document</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate New Policy</CardTitle>
          <CardDescription>Provide details to generate a new policy</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Falls Prevention Policy"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Context</Label>
              <Textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Provide context and requirements for the policy..."
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label>Standard</Label>
              <Select value={standard} onValueChange={setStandard}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CBAHI">CBAHI</SelectItem>
                  <SelectItem value="JCI">JCI</SelectItem>
                  <SelectItem value="Local">Local</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Generate Policy
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
