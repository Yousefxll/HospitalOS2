'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Search, Loader2, Trash2, AlertTriangle, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId?: string;
  isActive: boolean;
  createdAt?: Date;
}

export default function OwnerUsersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToChangeRole, setUserToChangeRole] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<string>('');
  const [isChangeRoleDialogOpen, setIsChangeRoleDialogOpen] = useState(false);
  const [isChangingRole, setIsChangingRole] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const query = searchQuery.toLowerCase();
    setFilteredUsers(
      users.filter(
        (user) =>
          user.email.toLowerCase().includes(query) ||
          user.firstName.toLowerCase().includes(query) ||
          user.lastName.toLowerCase().includes(query) ||
          user.role.toLowerCase().includes(query) ||
          (user.tenantId && user.tenantId.toLowerCase().includes(query))
      )
    );
  }, [searchQuery, users]);

  async function fetchUsers() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/owner/users', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setFilteredUsers(data.users || []);
      } else if (response.status === 403) {
        toast({
          title: 'Access Denied',
          description: 'SYRA Owner access required',
          variant: 'destructive',
        });
        router.push('/owner');
      } else {
        throw new Error('Failed to fetch users');
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleDeleteClick(user: User) {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!userToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/owner/users/${userToDelete.id}/delete`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `User ${userToDelete.email} deleted successfully`,
        });
        setIsDeleteDialogOpen(false);
        setUserToDelete(null);
        await fetchUsers();
      } else {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete user',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  }

  function handleChangeRoleClick(user: User) {
    setUserToChangeRole(user);
    setNewRole(user.role === 'syra-owner' ? 'admin' : user.role);
    setIsChangeRoleDialogOpen(true);
  }

  async function handleChangeRoleConfirm() {
    if (!userToChangeRole || !newRole) return;

    setIsChangingRole(true);
    try {
      const response = await fetch(`/api/owner/users/${userToChangeRole.id}/change-role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Success',
          description: data.message || 'User role changed successfully',
        });
        setIsChangeRoleDialogOpen(false);
        setUserToChangeRole(null);
        setNewRole('');
        await fetchUsers();
      } else {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to change user role');
      }
    } catch (error) {
      console.error('Failed to change role:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to change user role',
        variant: 'destructive',
      });
    } finally {
      setIsChangingRole(false);
    }
  }

  function getRoleBadge(role: string) {
    const roleColors: Record<string, string> = {
      'syra-owner': 'bg-purple-100 text-purple-800',
      'admin': 'bg-blue-100 text-blue-800',
      'supervisor': 'bg-green-100 text-green-800',
      'staff': 'bg-gray-100 text-gray-800',
      'viewer': 'bg-yellow-100 text-yellow-800',
    };
    return (
      <Badge className={roleColors[role] || 'bg-gray-100 text-gray-800'}>
        {role}
      </Badge>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/owner')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">All Users</h1>
            <p className="text-muted-foreground">View and manage all users in the system</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users ({users.length})</CardTitle>
          <CardDescription>
            All users across all tenants. SYRA Owner users are shown but cannot be deleted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email, name, role, or tenant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {searchQuery ? 'No users found matching your search' : 'No users found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.firstName} {user.lastName}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>
                        {user.tenantId ? (
                          <Badge variant="outline">{user.tenantId}</Badge>
                        ) : (
                          <span className="text-muted-foreground">No tenant</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.isActive ? (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        ) : (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {user.role === 'syra-owner' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleChangeRoleClick(user)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Change Role
                            </Button>
                          )}
                          {user.role === 'syra-owner' ? (
                            <span className="text-muted-foreground text-sm">Cannot delete</span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(user)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete user{' '}
              <strong>{userToDelete?.email}</strong>?
              <br />
              <br />
              This action cannot be undone and will delete:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>The user account</li>
                <li>All user sessions</li>
                <li>All audit logs related to this user</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setUserToDelete(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete User
                </>
              )}
            </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={isChangeRoleDialogOpen} onOpenChange={setIsChangeRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Change role for user <strong>{userToChangeRole?.email}</strong>
              <br />
              <br />
              Current role: <Badge className="bg-purple-100 text-purple-800">{userToChangeRole?.role}</Badge>
              <br />
              <br />
              After changing the role, you will be able to delete this user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">New Role</label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsChangeRoleDialogOpen(false);
                setUserToChangeRole(null);
                setNewRole('');
              }}
              disabled={isChangingRole}
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangeRoleConfirm}
              disabled={isChangingRole || !newRole || newRole === userToChangeRole?.role}
            >
              {isChangingRole ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Changing...
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Change Role
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

