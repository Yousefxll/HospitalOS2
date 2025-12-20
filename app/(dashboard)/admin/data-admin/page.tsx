'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, Download, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PreviewData {
  columns: string[];
  rows: any[][];
  totalRows: number;
}

export default function DataAdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [collection, setCollection] = useState('opd_census');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      await previewFile(selectedFile);
    }
  }

  async function previewFile(file: File) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/data-import/preview', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setPreview(data);
      }
    } catch (error) {
      console.error('Preview error:', error);
    }
  }

  async function handleImport() {
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('collection', collection);

      const response = await fetch('/api/admin/data-import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Imported ${data.imported} records successfully`,
        });
        setFile(null);
        setPreview(null);
      } else {
        throw new Error(data.error || 'Import failed');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Import failed',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleExport() {
    try {
      const response = await fetch(
        `/api/admin/data-export?collection=${collection}`
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${collection}_export_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: 'Success',
          description: 'Data exported successfully',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Export failed',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Data Admin</h1>
        <p className="text-muted-foreground">Import and export data in bulk</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Import Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Data
            </CardTitle>
            <CardDescription>
              Upload Excel files to import data into collections
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="collection">Target Collection</Label>
              <Select value={collection} onValueChange={setCollection}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="opd_census">OPD Census</SelectItem>
                  <SelectItem value="departments">Departments</SelectItem>
                  <SelectItem value="clinics">Clinics</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="equipment_mapping">Equipment Mapping</SelectItem>
                  <SelectItem value="beds">Beds</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Excel File</Label>
              <Input
                id="file"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
              />
            </div>

            {preview && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Preview: {preview.totalRows} rows found
                </p>
                <Button
                  onClick={handleImport}
                  disabled={isUploading}
                  className="w-full"
                >
                  {isUploading ? 'Importing...' : 'Import Data'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Export Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Data
            </CardTitle>
            <CardDescription>
              Download data from collections as Excel files
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="export-collection">Source Collection</Label>
              <Select value={collection} onValueChange={setCollection}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="opd_census">OPD Census</SelectItem>
                  <SelectItem value="departments">Departments</SelectItem>
                  <SelectItem value="clinics">Clinics</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="equipment_mapping">Equipment Mapping</SelectItem>
                  <SelectItem value="beds">Beds</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleExport} className="w-full">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export to Excel
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Preview Table */}
      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>Data Preview</CardTitle>
            <CardDescription>
              Showing first 5 rows of {preview.totalRows} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {preview.columns.map((col, idx) => (
                      <TableHead key={idx}>{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.slice(0, 5).map((row, rowIdx) => (
                    <TableRow key={rowIdx}>
                      {row.map((cell, cellIdx) => (
                        <TableCell key={cellIdx}>
                          {cell !== null && cell !== undefined ? String(cell) : '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
