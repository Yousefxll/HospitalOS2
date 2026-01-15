/**
 * Organizational Structure Management Page
 * 
 * UI for managing organizational structure with drag & drop
 */

'use client';

import { useState, useEffect } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Trash2, Edit, GripVertical, Building2, Settings, Shield, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';

interface OrgNode {
  id: string;
  type: 'department' | 'unit' | 'floor' | 'room' | 'line' | 'section' | 'committee' | 'custom' | 'operation' | 'function' | 'risk-domain';
  name: string;
  code?: string;
  description?: string;
  parentId?: string;
  level: number;
  path: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  children?: OrgNode[]; // For tree structure
}

interface TaxonomyItem {
  id: string;
  name: string;
  code?: string;
  description?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export default function StructureManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useTranslation();
  const [nodes, setNodes] = useState<OrgNode[]>([]);
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const [allFloors, setAllFloors] = useState<any[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<Set<string>>(new Set());
  const [selectedFloors, setSelectedFloors] = useState<Set<string>>(new Set());
  const [operations, setOperations] = useState<TaxonomyItem[]>([]);
  const [functions, setFunctions] = useState<TaxonomyItem[]>([]);
  const [riskDomains, setRiskDomains] = useState<TaxonomyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAllDepts, setIsLoadingAllDepts] = useState(false);
  const [isLoadingAllFloors, setIsLoadingAllFloors] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<OrgNode | null>(null);
  const [editingTaxonomy, setEditingTaxonomy] = useState<{ type: 'operation' | 'function' | 'risk-domain'; item: TaxonomyItem | null }>({ type: 'operation', item: null });
  const [activeTab, setActiveTab] = useState<'structure' | 'operations' | 'functions' | 'risk-domains' | 'all-departments' | 'rooms' | 'floors' | 'units' | 'all-floors'>('structure');
  const [formData, setFormData] = useState({
    type: 'department' as OrgNode['type'],
    name: '',
    code: '',
    description: '',
    parentId: '',
  });
  const [taxonomyFormData, setTaxonomyFormData] = useState({
    name: '',
    code: '',
    description: '',
  });

  useEffect(() => {
    const loadAllData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchNodes(),
          fetchOperations(),
          fetchFunctions(),
          fetchRiskDomains(),
        ]);
      } finally {
        setIsLoading(false);
      }
    };
    loadAllData();
  }, []);

  useEffect(() => {
    if (activeTab === 'all-departments') {
      fetchAllDepartments();
    } else if (activeTab === 'all-floors') {
      fetchAllFloors();
    }
  }, [activeTab]);

  async function fetchNodes() {
    try {
      console.log('[StructureManagement] 🔍 Fetching org nodes from /api/structure/org');
      const response = await fetch('/api/structure/org', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[StructureManagement] ✅ Fetched ${data.nodes?.length || 0} org nodes`);
        setNodes(data.nodes || []);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error(`[StructureManagement] ❌ Failed to fetch nodes: status ${response.status}`, errorData);
        throw new Error(errorData.error || 'Failed to fetch nodes');
      }
    } catch (error) {
      console.error('[StructureManagement] ❌ Exception fetching nodes:', error);
      toast({
        title: 'Error',
        description: 'Failed to load organizational structure',
        variant: 'destructive',
      });
    }
  }

  async function fetchAllFloors() {
    setIsLoadingAllFloors(true);
    try {
      console.log('[StructureManagement] 🔍 Fetching ALL floors (including deleted)');
      
      // Fetch from floors collection (including deleted/inactive)
      const floorsResponse = await fetch('/api/structure/floors?includeDeleted=true', {
        credentials: 'include',
      });
      let floors: any[] = [];
      if (floorsResponse.ok) {
        const floorsData = await floorsResponse.json();
        floors = (floorsData.data || [])
          .map((f: any) => ({
            id: f.id,
            name: f.label_en || f.name,
            code: f.key || f.code,
            number: f.number,
            label_en: f.label_en,
            label_ar: f.label_ar,
            source: 'floors',
            isActive: f.active !== false,
            deletedAt: f.deletedAt,
            createdAt: f.createdAt,
            updatedAt: f.updatedAt,
          }));
      }
      
      // Also fetch from org_nodes (if any floors exist there)
      try {
        const orgResponse = await fetch('/api/structure/org', {
          credentials: 'include',
        });
        if (orgResponse.ok) {
          const orgData = await orgResponse.json();
          const orgFloors = (orgData.nodes || [])
            .filter((n: any) => n.type === 'floor')
            .map((n: any) => ({
              id: n.id,
              name: n.name,
              code: n.code,
              number: n.number,
              label_en: n.name,
              label_ar: n.name,
              source: 'org_nodes',
              isActive: n.isActive !== false,
              deletedAt: n.deletedAt,
              createdAt: n.createdAt,
              updatedAt: n.updatedAt,
            }));
          
          // Merge and deduplicate (prefer org_nodes)
          const floorsMap = new Map<string, any>();
          floors.forEach(f => {
            if (!floorsMap.has(f.id)) {
              floorsMap.set(f.id, f);
            }
          });
          orgFloors.forEach(f => {
            floorsMap.set(f.id, f); // Overwrite with org_nodes (preferred source)
          });
          
          floors = Array.from(floorsMap.values());
        }
      } catch (orgError) {
        // Ignore - continue with floors collection only
      }
      
      console.log(`[StructureManagement] ✅ Fetched ${floors.length} total floors`);
      setAllFloors(floors);
    } catch (error) {
      console.error('[StructureManagement] ❌ Error fetching all floors:', error);
      toast({
        title: 'Error',
        description: 'Failed to load all floors',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAllFloors(false);
    }
  }

  async function fetchAllDepartments() {
    setIsLoadingAllDepts(true);
    try {
      console.log('[StructureManagement] 🔍 Fetching ALL departments (including deleted)');
      
        // Fetch from org_nodes (including deleted/inactive)
        // CRITICAL: Fetch ALL nodes, not just deleted ones, to show all departments
        const orgResponse = await fetch('/api/structure/org', {
          credentials: 'include',
        });
        let orgDepts: any[] = [];
        if (orgResponse.ok) {
          const orgData = await orgResponse.json();
          // Get all departments from org_nodes (active and inactive)
          orgDepts = (orgData.nodes || [])
            .filter((n: any) => n.type === 'department')
            .map((n: any) => ({
              id: n.id,
              name: n.name,
              code: n.code,
              source: 'org_nodes',
              isActive: n.isActive !== false,
              deletedAt: n.deletedAt,
              createdAt: n.createdAt,
              updatedAt: n.updatedAt,
            }));
        }
        
        // Also fetch from includeDeleted=true to get truly deleted ones
        try {
          const orgDeletedResponse = await fetch('/api/structure/org?includeDeleted=true', {
            credentials: 'include',
          });
          if (orgDeletedResponse.ok) {
            const orgDeletedData = await orgDeletedResponse.json();
            const deletedDepts = (orgDeletedData.nodes || [])
              .filter((n: any) => n.type === 'department' && n.deletedAt)
              .map((n: any) => ({
                id: n.id,
                name: n.name,
                code: n.code,
                source: 'org_nodes',
                isActive: false,
                deletedAt: n.deletedAt,
                createdAt: n.createdAt,
                updatedAt: n.updatedAt,
              }));
            
            // Merge with existing, avoiding duplicates
            const existingIds = new Set(orgDepts.map(d => d.id));
            const newDeleted = deletedDepts.filter(d => !existingIds.has(d.id));
            orgDepts = [...orgDepts, ...newDeleted];
          }
        } catch (error) {
          // Ignore error - continue with normal fetch
        }
      
      // Fetch from floor_departments (including deleted/inactive)
      const floorResponse = await fetch('/api/structure/departments?includeDeleted=true', {
        credentials: 'include',
      });
      let floorDepts: any[] = [];
      if (floorResponse.ok) {
        const floorData = await floorResponse.json();
        floorDepts = (floorData.data || [])
          .map((d: any) => ({
            id: d.id || d.departmentId,
            name: d.label_en || d.name || d.departmentName,
            code: d.departmentKey || d.code,
            source: 'floor_departments',
            isActive: d.active !== false,
            deletedAt: d.deletedAt,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          }));
      }
      
      // Merge and deduplicate (prefer org_nodes)
      const allDeptsMap = new Map<string, any>();
      floorDepts.forEach(d => {
        if (!allDeptsMap.has(d.id)) {
          allDeptsMap.set(d.id, d);
        }
      });
      orgDepts.forEach(d => {
        allDeptsMap.set(d.id, d); // Overwrite with org_nodes (preferred source)
      });
      
      const allDepts = Array.from(allDeptsMap.values());
      console.log(`[StructureManagement] ✅ Fetched ${allDepts.length} total departments (${orgDepts.length} from org_nodes, ${floorDepts.length} from floor_departments)`);
      setAllDepartments(allDepts);
    } catch (error) {
      console.error('[StructureManagement] ❌ Error fetching all departments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load all departments',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAllDepts(false);
    }
  }

  async function fetchOperations() {
    try {
      const response = await fetch('/api/taxonomy/operations', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setOperations(data.data || []);
      }
    } catch (error) {
      console.error('[StructureManagement] Error fetching operations:', error);
    }
  }

  async function fetchFunctions() {
    try {
      const response = await fetch('/api/taxonomy/functions', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setFunctions(data.data || []);
      }
    } catch (error) {
      console.error('[StructureManagement] Error fetching functions:', error);
    }
  }

  async function fetchRiskDomains() {
    try {
      const response = await fetch('/api/taxonomy/risk-domains', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setRiskDomains(data.data || []);
      }
    } catch (error) {
      console.error('[StructureManagement] Error fetching risk domains:', error);
    }
  }

  async function handleCreate() {
    try {
      const response = await fetch('/api/structure/org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          parentId: formData.parentId || undefined,
        }),
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Node created successfully',
        });
        setIsDialogOpen(false);
        setFormData({
          type: 'department',
          name: '',
          code: '',
          description: '',
          parentId: '',
        });
        
        // Refresh nodes to show in Structure tab
        await fetchNodes();
        
        // Also refresh relevant tab based on node type
        if (formData.type === 'department') {
          await fetchAllDepartments();
          setActiveTab('all-departments');
        } else if (formData.type === 'room') {
          setActiveTab('rooms');
        } else if (formData.type === 'floor') {
          setActiveTab('floors');
        } else if (formData.type === 'unit') {
          setActiveTab('units');
        } else if (formData.type === 'operation') {
          await fetchOperations();
          setActiveTab('operations');
        } else if (formData.type === 'function') {
          await fetchFunctions();
          setActiveTab('functions');
        } else if (formData.type === 'risk-domain') {
          await fetchRiskDomains();
          setActiveTab('risk-domains');
        } else {
          // For other types, stay on Structure tab
          setActiveTab('structure');
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create node');
      }
    } catch (error) {
      console.error('Failed to create node:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create node',
        variant: 'destructive',
      });
    }
  }

  async function handleDelete(nodeId: string, forceDelete: boolean = false) {
    const node = nodes.find(n => n.id === nodeId);
    const nodeName = node?.name || 'this node';
    
    const confirmMessage = forceDelete 
      ? `⚠️ Force delete: Are you sure you want to permanently delete "${nodeName}"? This will delete all associated data.`
      : `Are you sure you want to delete "${nodeName}"?`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch(`/api/structure/org/${nodeId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ forceDelete }),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Node deleted successfully',
        });
        await fetchNodes();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete node');
      }
    } catch (error) {
      console.error('Failed to delete node:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete node',
        variant: 'destructive',
      });
    }
  }

  function getNodeTypeColor(type: OrgNode['type']): string {
    const colors: Record<OrgNode['type'], string> = {
      department: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      unit: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      floor: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      room: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      line: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      section: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      committee: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      custom: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      operation: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
      function: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
      'risk-domain': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return colors[type] || colors.custom;
  }

  function buildTree(nodes: OrgNode[]): OrgNode[] {
    const nodeMap = new Map<string, OrgNode>();
    const rootNodes: OrgNode[] = [];

    // Create map of all nodes
    nodes.forEach(node => {
      nodeMap.set(node.id, { ...node, children: [] });
    });

    // Build tree
    nodes.forEach(node => {
      const nodeWithChildren = nodeMap.get(node.id)!;
      if (node.parentId) {
        const parent = nodeMap.get(node.parentId);
        if (parent) {
          if (!parent.children) parent.children = [];
          parent.children.push(nodeWithChildren);
        }
      } else {
        rootNodes.push(nodeWithChildren);
      }
    });

    return rootNodes;
  }

  function renderNode(node: OrgNode & { children?: OrgNode[] }, level: number = 0) {
    return (
      <div key={node.id} className="ml-4">
        <div className="flex items-center gap-2 p-2 rounded hover:bg-muted">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <Badge className={getNodeTypeColor(node.type)}>{node.type}</Badge>
          <span className="font-medium">{node.name}</span>
          {node.code && (
            <span className="text-sm text-muted-foreground">({node.code})</span>
          )}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditingNode(node);
              setFormData({
                type: node.type,
                name: node.name,
                code: node.code || '',
                description: node.description || '',
                parentId: node.parentId || '',
              });
              setIsDialogOpen(true);
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(node.id, false)}
            title="Delete node"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {(
            node.name.toLowerCase().includes('emergency') ||
            node.name.toLowerCase().includes('quality') ||
            node.name.toLowerCase().includes('surgery') ||
            node.name.toLowerCase() === 'surg' ||
            node.name.toLowerCase() === 'er' ||
            node.name.toLowerCase() === 'ed'
          ) && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDelete(node.id, true)}
              title="Force delete (bypass data checks)"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        {node.children && node.children.length > 0 && (
          <div className="ml-4">
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  }

  async function handleCreateTaxonomy(type: 'operation' | 'function' | 'risk-domain') {
    try {
      const endpoint = `/api/taxonomy/${type === 'risk-domain' ? 'risk-domains' : `${type}s`}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taxonomyFormData),
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `${type.charAt(0).toUpperCase() + type.slice(1)} created successfully`,
        });
        setIsDialogOpen(false);
        setTaxonomyFormData({ name: '', code: '', description: '' });
        if (type === 'operation') await fetchOperations();
        else if (type === 'function') await fetchFunctions();
        else await fetchRiskDomains();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create');
      }
    } catch (error) {
      console.error(`Failed to create ${type}:`, error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create',
        variant: 'destructive',
      });
    }
  }

  async function handleDeleteTaxonomy(type: 'operation' | 'function' | 'risk-domain', id: string) {
    const itemName = type === 'risk-domain' ? 'risk domain' : type;
    if (!confirm(`Are you sure you want to delete this ${itemName}?`)) {
      return;
    }

    try {
      const endpoint = `/api/taxonomy/${type === 'risk-domain' ? 'risk-domains' : `${type}s`}/${id}`;
      const response = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully`,
        });
        if (type === 'operation') await fetchOperations();
        else if (type === 'function') await fetchFunctions();
        else await fetchRiskDomains();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete');
      }
    } catch (error) {
      console.error(`Failed to delete ${type}:`, error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete',
        variant: 'destructive',
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tree = buildTree(nodes);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Structure Management</h1>
          <p className="text-muted-foreground">
            Manage organizational structure, operations, functions, and risk domains
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingNode(null);
              setFormData({
                type: 'department',
                name: '',
                code: '',
                description: '',
                parentId: '',
              });
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Node
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingNode ? 'Edit Node' : 'Create New Node'}
              </DialogTitle>
              <DialogDescription>
                {editingNode
                  ? 'Update the organizational node details'
                  : 'Add a new organizational unit to the structure'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as OrgNode['type'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="department">Department</SelectItem>
                    <SelectItem value="unit">Unit</SelectItem>
                    <SelectItem value="floor">Floor</SelectItem>
                    <SelectItem value="room">Room</SelectItem>
                    <SelectItem value="line">Line</SelectItem>
                    <SelectItem value="section">Section</SelectItem>
                    <SelectItem value="committee">Committee</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter node name"
                />
              </div>
              <div>
                <Label>Code (Optional)</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Enter code"
                />
              </div>
              <div>
                <Label>Description (Optional)</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter description"
                />
              </div>
              <div>
                <Label>Parent Node (Optional)</Label>
                <Select
                  value={formData.parentId || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, parentId: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent node" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Root Level)</SelectItem>
                    {nodes.map((node) => (
                      <SelectItem key={node.id} value={node.id}>
                        {node.path} ({node.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>
                {editingNode ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="structure">
            <Building2 className="h-4 w-4 mr-2" />
            Structure
          </TabsTrigger>
          <TabsTrigger value="all-departments">
            <AlertTriangle className="h-4 w-4 mr-2" />
            All Departments
          </TabsTrigger>
          <TabsTrigger value="all-floors">
            <AlertTriangle className="h-4 w-4 mr-2" />
            All Floors
          </TabsTrigger>
          <TabsTrigger value="rooms">
            <Building2 className="h-4 w-4 mr-2" />
            Rooms
          </TabsTrigger>
          <TabsTrigger value="floors">
            <Building2 className="h-4 w-4 mr-2" />
            Floors (Nodes)
          </TabsTrigger>
          <TabsTrigger value="units">
            <Building2 className="h-4 w-4 mr-2" />
            Units
          </TabsTrigger>
          <TabsTrigger value="operations">
            <Settings className="h-4 w-4 mr-2" />
            Operations
          </TabsTrigger>
          <TabsTrigger value="functions">
            <Settings className="h-4 w-4 mr-2" />
            Functions
          </TabsTrigger>
          <TabsTrigger value="risk-domains">
            <Shield className="h-4 w-4 mr-2" />
            Risk Domains
          </TabsTrigger>
        </TabsList>

        <TabsContent value="structure" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Structure Tree</CardTitle>
              <CardDescription>
                Hierarchical view of organizational structure
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tree.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No organizational nodes found. Create your first node to get started.
                </div>
              ) : (
                <div className="space-y-2">
                  {tree.map(node => renderNode(node))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all-departments" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Departments (Including Deleted/Hidden)</CardTitle>
                  <CardDescription>
                    View all departments from all sources (org_nodes and floor_departments), including deleted or inactive ones
                  </CardDescription>
                </div>
                {allDepartments.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedDepartments.size === allDepartments.length) {
                          setSelectedDepartments(new Set());
                        } else {
                          setSelectedDepartments(new Set(allDepartments.map(d => d.id)));
                        }
                      }}
                    >
                      {selectedDepartments.size === allDepartments.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    {selectedDepartments.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isDeleting}
                        onClick={async () => {
                          if (!confirm(`Are you sure you want to permanently delete ${selectedDepartments.size} department(s)? This action cannot be undone.`)) {
                            return;
                          }
                          
                          setIsDeleting(true);
                          const selectedIds = Array.from(selectedDepartments);
                          let successCount = 0;
                          let failCount = 0;
                          
                          for (const deptId of selectedIds) {
                            try {
                              // Delete from floor_departments
                              const floorResponse = await fetch(`/api/structure/departments/${deptId}`, {
                                method: 'DELETE',
                                credentials: 'include',
                              });
                              
                              // Also try to delete from org_nodes (might not exist there)
                              try {
                                await fetch(`/api/structure/org/${deptId}`, {
                                  method: 'DELETE',
                                  credentials: 'include',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ forceDelete: true }),
                                });
                              } catch (orgError) {
                                // Ignore - might not exist in org_nodes
                              }
                              
                              if (floorResponse.ok) {
                                successCount++;
                              } else {
                                failCount++;
                              }
                            } catch (error) {
                              console.error(`Error deleting department ${deptId}:`, error);
                              failCount++;
                            }
                          }
                          
                          setIsDeleting(false);
                          setSelectedDepartments(new Set());
                          
                          if (successCount > 0) {
                            toast({
                              title: 'Success',
                              description: `Successfully deleted ${successCount} department(s)${failCount > 0 ? `. ${failCount} failed.` : ''}`,
                            });
                          } else {
                            toast({
                              title: 'Error',
                              description: `Failed to delete ${failCount} department(s)`,
                              variant: 'destructive',
                            });
                          }
                          
                          // Refresh list
                          await fetchAllDepartments();
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete Selected ({selectedDepartments.size})
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingAllDepts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading all departments...</span>
                </div>
              ) : allDepartments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No departments found in any source.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground mb-4">
                    Found {allDepartments.length} department(s) total
                  </div>
                  <div className="space-y-2">
                    {allDepartments.map((dept) => (
                      <div
                        key={dept.id}
                        className={`flex items-center justify-between p-3 border rounded-lg ${
                          selectedDepartments.has(dept.id)
                            ? 'bg-primary/10 border-primary'
                            : 'bg-background'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <input
                            type="checkbox"
                            checked={selectedDepartments.has(dept.id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedDepartments);
                              if (e.target.checked) {
                                newSelected.add(dept.id);
                              } else {
                                newSelected.delete(dept.id);
                              }
                              setSelectedDepartments(newSelected);
                            }}
                            className="h-4 w-4"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{dept.name}</span>
                              <Badge variant="outline" className="text-xs">{dept.source}</Badge>
                            </div>
                            {dept.code && (
                              <div className="text-sm text-muted-foreground">Code: {dept.code}</div>
                            )}
                            <div className="text-xs text-muted-foreground mt-1">
                              ID: {dept.id}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={isDeleting}
                            onClick={async () => {
                              if (!confirm(`Are you sure you want to permanently delete "${dept.name}"? This action cannot be undone.`)) {
                                return;
                              }
                              
                              setIsDeleting(true);
                              try {
                                // Delete from floor_departments (HARD DELETE)
                                const floorResponse = await fetch(`/api/structure/departments/${dept.id}`, {
                                  method: 'DELETE',
                                  credentials: 'include',
                                });
                                
                                if (!floorResponse.ok) {
                                  const errorData = await floorResponse.json().catch(() => ({ error: 'Unknown error' }));
                                  throw new Error(errorData.error || 'Failed to delete from floor_departments');
                                }
                                
                                // Also try to delete from org_nodes (might not exist there)
                                try {
                                  await fetch(`/api/structure/org/${dept.id}`, {
                                    method: 'DELETE',
                                    credentials: 'include',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ forceDelete: true }),
                                  });
                                } catch (orgError) {
                                  // Ignore - node might not exist in org_nodes
                                }
                                
                                toast({
                                  title: 'Success',
                                  description: `Department "${dept.name}" permanently deleted`,
                                });
                                
                                // Remove from selection if selected
                                const newSelected = new Set(selectedDepartments);
                                newSelected.delete(dept.id);
                                setSelectedDepartments(newSelected);
                                
                                // Refresh list
                                await fetchAllDepartments();
                              } catch (error: any) {
                                console.error('Error deleting department:', error);
                                toast({
                                  title: 'Error',
                                  description: error.message || 'Failed to delete department',
                                  variant: 'destructive',
                                });
                              } finally {
                                setIsDeleting(false);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all-floors" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Floors (Including Deleted/Hidden)</CardTitle>
                  <CardDescription>
                    View all floors from all sources (floors collection and org_nodes), including deleted or inactive ones
                  </CardDescription>
                </div>
                {allFloors.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedFloors.size === allFloors.length) {
                          setSelectedFloors(new Set());
                        } else {
                          setSelectedFloors(new Set(allFloors.map(f => f.id)));
                        }
                      }}
                    >
                      {selectedFloors.size === allFloors.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    {selectedFloors.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isDeleting}
                        onClick={async () => {
                          if (!confirm(`Are you sure you want to permanently delete ${selectedFloors.size} floor(s)? This action cannot be undone.`)) {
                            return;
                          }
                          
                          setIsDeleting(true);
                          const selectedIds = Array.from(selectedFloors);
                          let successCount = 0;
                          let failCount = 0;
                          
                          for (const floorId of selectedIds) {
                            try {
                              // Delete from floors collection
                              const floorResponse = await fetch(`/api/structure/floors/${floorId}`, {
                                method: 'DELETE',
                                credentials: 'include',
                              });
                              
                              // Also try to delete from org_nodes (might not exist there)
                              try {
                                await fetch(`/api/structure/org/${floorId}`, {
                                  method: 'DELETE',
                                  credentials: 'include',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ forceDelete: true }),
                                });
                              } catch (orgError) {
                                // Ignore - might not exist in org_nodes
                              }
                              
                              if (floorResponse.ok) {
                                successCount++;
                              } else {
                                failCount++;
                              }
                            } catch (error) {
                              console.error(`Error deleting floor ${floorId}:`, error);
                              failCount++;
                            }
                          }
                          
                          setIsDeleting(false);
                          setSelectedFloors(new Set());
                          
                          if (successCount > 0) {
                            toast({
                              title: 'Success',
                              description: `Successfully deleted ${successCount} floor(s)${failCount > 0 ? `. ${failCount} failed.` : ''}`,
                            });
                          } else {
                            toast({
                              title: 'Error',
                              description: `Failed to delete ${failCount} floor(s)`,
                              variant: 'destructive',
                            });
                          }
                          
                          // Refresh list
                          await fetchAllFloors();
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete Selected ({selectedFloors.size})
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingAllFloors ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading all floors...</span>
                </div>
              ) : allFloors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No floors found in any source.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground mb-4">
                    Found {allFloors.length} floor(s) total
                  </div>
                  <div className="space-y-2">
                    {allFloors.map((floor) => (
                      <div
                        key={floor.id}
                        className={`flex items-center justify-between p-3 border rounded-lg ${
                          selectedFloors.has(floor.id)
                            ? 'bg-primary/10 border-primary'
                            : 'bg-background'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <input
                            type="checkbox"
                            checked={selectedFloors.has(floor.id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedFloors);
                              if (e.target.checked) {
                                newSelected.add(floor.id);
                              } else {
                                newSelected.delete(floor.id);
                              }
                              setSelectedFloors(newSelected);
                            }}
                            className="h-4 w-4"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{floor.label_en || floor.name}</span>
                              {floor.label_ar && (
                                <span className="text-sm text-muted-foreground">({floor.label_ar})</span>
                              )}
                              <Badge variant="outline" className="text-xs">{floor.source}</Badge>
                            </div>
                            {floor.code && (
                              <div className="text-sm text-muted-foreground">Code: {floor.code}</div>
                            )}
                            {floor.number && (
                              <div className="text-sm text-muted-foreground">Number: {floor.number}</div>
                            )}
                            <div className="text-xs text-muted-foreground mt-1">
                              ID: {floor.id}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={isDeleting}
                            onClick={async () => {
                              if (!confirm(`Are you sure you want to permanently delete "${floor.label_en || floor.name}"? This action cannot be undone.`)) {
                                return;
                              }
                              
                              setIsDeleting(true);
                              try {
                                // Delete from floors collection (HARD DELETE)
                                const floorResponse = await fetch(`/api/structure/floors/${floor.id}`, {
                                  method: 'DELETE',
                                  credentials: 'include',
                                });
                                
                                if (!floorResponse.ok) {
                                  const errorData = await floorResponse.json().catch(() => ({ error: 'Unknown error' }));
                                  throw new Error(errorData.error || 'Failed to delete from floors collection');
                                }
                                
                                // Also try to delete from org_nodes (might not exist there)
                                try {
                                  await fetch(`/api/structure/org/${floor.id}`, {
                                    method: 'DELETE',
                                    credentials: 'include',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ forceDelete: true }),
                                  });
                                } catch (orgError) {
                                  // Ignore - node might not exist in org_nodes
                                }
                                
                                toast({
                                  title: 'Success',
                                  description: `Floor "${floor.label_en || floor.name}" permanently deleted`,
                                });
                                
                                // Remove from selection if selected
                                const newSelected = new Set(selectedFloors);
                                newSelected.delete(floor.id);
                                setSelectedFloors(newSelected);
                                
                                // Refresh list
                                await fetchAllFloors();
                              } catch (error: any) {
                                console.error('Error deleting floor:', error);
                                toast({
                                  title: 'Error',
                                  description: error.message || 'Failed to delete floor',
                                  variant: 'destructive',
                                });
                              } finally {
                                setIsDeleting(false);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rooms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rooms</CardTitle>
              <CardDescription>
                All rooms from organizational structure
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading rooms...</span>
                </div>
              ) : (
                (() => {
                  const roomNodes = nodes.filter(n => n.type === 'room');
                  return roomNodes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No rooms found. Create a room using "Add Node" button.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {roomNodes.map((node) => (
                        <div
                          key={node.id}
                          className="flex items-center justify-between p-3 border rounded-lg bg-background"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{node.name}</span>
                              {node.code && (
                                <Badge variant="outline" className="text-xs">Code: {node.code}</Badge>
                              )}
                            </div>
                            {node.description && (
                              <div className="text-sm text-muted-foreground mt-1">{node.description}</div>
                            )}
                            <div className="text-xs text-muted-foreground mt-1">ID: {node.id}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingNode(node);
                                setFormData({
                                  type: node.type,
                                  name: node.name,
                                  code: node.code || '',
                                  description: node.description || '',
                                  parentId: node.parentId || '',
                                });
                                setIsDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(node.id, false)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="floors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Floors</CardTitle>
              <CardDescription>
                All floors from organizational structure
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading floors...</span>
                </div>
              ) : (
                (() => {
                  const floorNodes = nodes.filter(n => n.type === 'floor');
                  return floorNodes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No floors found. Create a floor using "Add Node" button.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {floorNodes.map((node) => (
                        <div
                          key={node.id}
                          className="flex items-center justify-between p-3 border rounded-lg bg-background"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{node.name}</span>
                              {node.code && (
                                <Badge variant="outline" className="text-xs">Code: {node.code}</Badge>
                              )}
                            </div>
                            {node.description && (
                              <div className="text-sm text-muted-foreground mt-1">{node.description}</div>
                            )}
                            <div className="text-xs text-muted-foreground mt-1">ID: {node.id}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingNode(node);
                                setFormData({
                                  type: node.type,
                                  name: node.name,
                                  code: node.code || '',
                                  description: node.description || '',
                                  parentId: node.parentId || '',
                                });
                                setIsDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(node.id, false)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="units" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Units</CardTitle>
              <CardDescription>
                All units from organizational structure
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading units...</span>
                </div>
              ) : (
                (() => {
                  const unitNodes = nodes.filter(n => n.type === 'unit');
                  return unitNodes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No units found. Create a unit using "Add Node" button.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {unitNodes.map((node) => (
                        <div
                          key={node.id}
                          className="flex items-center justify-between p-3 border rounded-lg bg-background"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{node.name}</span>
                              {node.code && (
                                <Badge variant="outline" className="text-xs">Code: {node.code}</Badge>
                              )}
                            </div>
                            {node.description && (
                              <div className="text-sm text-muted-foreground mt-1">{node.description}</div>
                            )}
                            <div className="text-xs text-muted-foreground mt-1">ID: {node.id}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingNode(node);
                                setFormData({
                                  type: node.type,
                                  name: node.name,
                                  code: node.code || '',
                                  description: node.description || '',
                                  parentId: node.parentId || '',
                                });
                                setIsDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(node.id, false)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Operations</CardTitle>
                <CardDescription>
                  Manage policy operations and processes
                </CardDescription>
              </div>
              <Dialog open={activeTab === 'operations' && isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingTaxonomy({ type: 'operation', item: null });
                    setTaxonomyFormData({ name: '', code: '', description: '' });
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Operation
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Operation</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Name *</Label>
                      <Input
                        value={taxonomyFormData.name}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, name: e.target.value })}
                        placeholder="Enter operation name"
                      />
                    </div>
                    <div>
                      <Label>Code (Optional)</Label>
                      <Input
                        value={taxonomyFormData.code}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, code: e.target.value })}
                        placeholder="Enter code"
                      />
                    </div>
                    <div>
                      <Label>Description (Optional)</Label>
                      <Input
                        value={taxonomyFormData.description}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, description: e.target.value })}
                        placeholder="Enter description"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button onClick={() => handleCreateTaxonomy('operation')}>Create</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {operations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No operations found. Create your first operation.
                </div>
              ) : (
                <div className="space-y-2">
                  {operations.map((op) => (
                    <div key={op.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted">
                      <Badge className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200">Operation</Badge>
                      <span className="font-medium flex-1">{op.name}</span>
                      {op.code && <span className="text-sm text-muted-foreground">({op.code})</span>}
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteTaxonomy('operation', op.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="functions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Functions</CardTitle>
                <CardDescription>
                  Manage functional areas (HR, Finance, Operations, etc.)
                </CardDescription>
              </div>
              <Dialog open={activeTab === 'functions' && isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingTaxonomy({ type: 'function', item: null });
                    setTaxonomyFormData({ name: '', code: '', description: '' });
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Function
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Function</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Name *</Label>
                      <Input
                        value={taxonomyFormData.name}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, name: e.target.value })}
                        placeholder="Enter function name"
                      />
                    </div>
                    <div>
                      <Label>Code (Optional)</Label>
                      <Input
                        value={taxonomyFormData.code}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, code: e.target.value })}
                        placeholder="Enter code"
                      />
                    </div>
                    <div>
                      <Label>Description (Optional)</Label>
                      <Input
                        value={taxonomyFormData.description}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, description: e.target.value })}
                        placeholder="Enter description"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button onClick={() => handleCreateTaxonomy('function')}>Create</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {functions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No functions found. Create your first function.
                </div>
              ) : (
                <div className="space-y-2">
                  {functions.map((func) => (
                    <div key={func.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted">
                      <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200">Function</Badge>
                      <span className="font-medium flex-1">{func.name}</span>
                      {func.code && <span className="text-sm text-muted-foreground">({func.code})</span>}
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteTaxonomy('function', func.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk-domains" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Risk Domains</CardTitle>
                <CardDescription>
                  Manage risk domains (Data Privacy, Safety, Regulatory Compliance, etc.)
                </CardDescription>
              </div>
              <Dialog open={activeTab === 'risk-domains' && isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingTaxonomy({ type: 'risk-domain', item: null });
                    setTaxonomyFormData({ name: '', code: '', description: '' });
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Risk Domain
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Risk Domain</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Name *</Label>
                      <Input
                        value={taxonomyFormData.name}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, name: e.target.value })}
                        placeholder="Enter risk domain name"
                      />
                    </div>
                    <div>
                      <Label>Code (Optional)</Label>
                      <Input
                        value={taxonomyFormData.code}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, code: e.target.value })}
                        placeholder="Enter code"
                      />
                    </div>
                    <div>
                      <Label>Description (Optional)</Label>
                      <Input
                        value={taxonomyFormData.description}
                        onChange={(e) => setTaxonomyFormData({ ...taxonomyFormData, description: e.target.value })}
                        placeholder="Enter description"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button onClick={() => handleCreateTaxonomy('risk-domain')}>Create</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {riskDomains.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No risk domains found. Create your first risk domain.
                </div>
              ) : (
                <div className="space-y-2">
                  {riskDomains.map((rd) => (
                    <div key={rd.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted">
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Risk Domain</Badge>
                      <span className="font-medium flex-1">{rd.name}</span>
                      {rd.code && <span className="text-sm text-muted-foreground">({rd.code})</span>}
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteTaxonomy('risk-domain', rd.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
