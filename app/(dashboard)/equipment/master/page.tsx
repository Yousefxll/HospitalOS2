'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from '@/hooks/use-translation';
import { MobileCardList } from '@/components/mobile/MobileCardList';
import { MobileSearchBar } from '@/components/mobile/MobileSearchBar';

interface Equipment {
  id: string;
  name: string;
  code: string;
  type: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  status: string;
  location?: string;
  department?: string;
}

export default function EquipmentMasterPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    status: 'active',
    location: '',
    department: '',
  });

  useEffect(() => {
    fetchEquipment();
  }, []);

  async function fetchEquipment() {
    try {
      const response = await fetch('/api/equipment');
      if (response.ok) {
        const data = await response.json();
        setEquipment(data.equipment);
      }
    } catch (error) {
      console.error('Failed to fetch equipment:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Equipment added successfully',
        });
        setIsDialogOpen(false);
        fetchEquipment();
        setFormData({
          name: '',
          code: '',
          type: '',
          manufacturer: '',
          model: '',
          serialNumber: '',
          status: 'active',
          location: '',
          department: '',
        });
      } else {
        throw new Error('Failed to add equipment');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  const filteredEquipment = equipment.filter(
    (eq) =>
      eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Convert equipment to card format for mobile
  const equipmentCardItems = filteredEquipment.map(eq => ({
    id: eq.id,
    title: eq.name,
    subtitle: eq.code,
    description: `${eq.type}${eq.manufacturer ? ` | ${eq.manufacturer}` : ''}${eq.model ? ` ${eq.model}` : ''}`,
    badges: [
      { 
        label: eq.status || 'active', 
        variant: (eq.status === 'active' ? 'default' : eq.status === 'maintenance' ? 'destructive' : 'secondary') as 'default' | 'destructive' | 'secondary'
      },
    ],
    metadata: [
      ...(eq.location ? [{ label: 'Location', value: eq.location }] : []),
      ...(eq.department ? [{ label: 'Department', value: eq.department }] : []),
      ...(eq.serialNumber ? [{ label: 'Serial', value: eq.serialNumber }] : []),
    ],
  }));

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - Hidden on mobile (MobileTopBar shows it) */}
      <div className="hidden md:flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Equipment Master</h1>
          <p className="text-muted-foreground">Central equipment registry</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Equipment
            </Button>
          </DialogTrigger>
          <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Equipment</DialogTitle>
              <DialogDescription>
                Register new equipment in the system
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Equipment Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Equipment Code</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    required
                    className="h-11"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Input
                    id="type"
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input
                    id="manufacturer"
                    value={formData.manufacturer}
                    onChange={(e) =>
                      setFormData({ ...formData, manufacturer: e.target.value })
                    }
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) =>
                      setFormData({ ...formData, model: e.target.value })
                    }
                    className="h-11"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="serialNumber">Serial Number</Label>
                  <Input
                    id="serialNumber"
                    value={formData.serialNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, serialNumber: e.target.value })
                    }
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) =>
                    setFormData({ ...formData, department: e.target.value })
                  }
                  className="h-11"
                />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={isLoading} className="h-11 min-w-[120px]">
                  {isLoading ? 'Adding...' : 'Add Equipment'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Mobile Add Button */}
      {isMobile && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full h-11">
              <Plus className="mr-2 h-4 w-4" />
              Add Equipment
            </Button>
          </DialogTrigger>
          <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Equipment</DialogTitle>
              <DialogDescription>
                Register new equipment in the system
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name-mobile">Equipment Name</Label>
                  <Input
                    id="name-mobile"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code-mobile">Equipment Code</Label>
                  <Input
                    id="code-mobile"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    required
                    className="h-11"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type-mobile">Type</Label>
                  <Input
                    id="type-mobile"
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status-mobile">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manufacturer-mobile">Manufacturer</Label>
                  <Input
                    id="manufacturer-mobile"
                    value={formData.manufacturer}
                    onChange={(e) =>
                      setFormData({ ...formData, manufacturer: e.target.value })
                    }
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model-mobile">Model</Label>
                  <Input
                    id="model-mobile"
                    value={formData.model}
                    onChange={(e) =>
                      setFormData({ ...formData, model: e.target.value })
                    }
                    className="h-11"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="serialNumber-mobile">Serial Number</Label>
                  <Input
                    id="serialNumber-mobile"
                    value={formData.serialNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, serialNumber: e.target.value })
                    }
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location-mobile">Location</Label>
                  <Input
                    id="location-mobile"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department-mobile">Department</Label>
                <Input
                  id="department-mobile"
                  value={formData.department}
                  onChange={(e) =>
                    setFormData({ ...formData, department: e.target.value })
                  }
                  className="h-11"
                />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={isLoading} className="h-11 min-w-[120px]">
                  {isLoading ? 'Adding...' : 'Add Equipment'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Search */}
      {isMobile ? (
        <MobileSearchBar
          defaultValue={searchTerm}
          onSearch={setSearchTerm}
          placeholder="Search equipment by name, code, or type..."
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <Input
                placeholder="Search equipment by name, code, or type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 h-11"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Equipment Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Equipment</CardTitle>
          <CardDescription>
            {filteredEquipment.length} equipment items
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isMobile ? (
            <MobileCardList
              items={equipmentCardItems}
              isLoading={isLoading}
              emptyMessage="No equipment found"
            />
          ) : (
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Manufacturer</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEquipment.map((eq) => (
                    <TableRow key={eq.id}>
                      <TableCell className="font-medium">{eq.name}</TableCell>
                      <TableCell>{eq.code}</TableCell>
                      <TableCell>{eq.type}</TableCell>
                      <TableCell>{eq.manufacturer || '-'}</TableCell>
                      <TableCell>{eq.location || '-'}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded text-xs capitalize ${
                            eq.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : eq.status === 'maintenance'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {eq.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
