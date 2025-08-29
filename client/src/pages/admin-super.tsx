import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Edit, Users, ShoppingBag, Eye, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  isSeller: boolean;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
  _impersonation?: {
    isImpersonating: boolean;
    adminUserId: string;
    originalUserId: string;
  };
}

interface AdminUsers {
  sellers: User[];
  buyers: User[];
}

export default function AdminSuper() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginData, setLoginData] = useState({ userId: "", password: "" });
  const [users, setUsers] = useState<AdminUsers>({ sellers: [], buyers: [] });
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await apiRequest("POST", "/api/admin/login", loginData);
      setIsAuthenticated(true);
      toast({ title: "Admin Access Granted", description: "Welcome to super admin panel" });
      await fetchUsers();
    } catch (error) {
      toast({
        title: "Access Denied", 
        description: "Invalid admin credentials",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await apiRequest("POST", "/api/admin/users", loginData);
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive"
      });
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const response = await apiRequest("GET", "/api/auth/user");
      const user = await response.json();
      setCurrentUser(user);
    } catch (error) {
      setCurrentUser(null);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchCurrentUser();
    }
  }, [isAuthenticated]);

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      email: user.email,
      isSeller: user.isSeller,
    });
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    
    try {
      await apiRequest("PUT", `/api/admin/users/${editingUser.id}`, {
        ...loginData,
        ...editForm
      });
      
      toast({ title: "Success", description: "User updated successfully" });
      setEditingUser(null);
      await fetchUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive"
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }
    
    try {
      await apiRequest("DELETE", `/api/admin/users/${userId}`, loginData);
      toast({ title: "Success", description: "User deleted successfully" });
      await fetchUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive"
      });
    }
  };

  const handleImpersonate = async (userId: string) => {
    try {
      await apiRequest("POST", `/api/admin/impersonate/${userId}`, loginData);
      toast({ 
        title: "Impersonation Started", 
        description: "You are now viewing as this user. Visit any dashboard to see their data." 
      });
      await fetchCurrentUser();
      // Redirect to home or seller dashboard to see impersonated data
      window.location.href = "/";
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start impersonation",
        variant: "destructive"
      });
    }
  };

  const handleStopImpersonation = async () => {
    try {
      await apiRequest("POST", "/api/admin/stop-impersonation", loginData);
      toast({ title: "Success", description: "Impersonation stopped" });
      await fetchCurrentUser();
      window.location.reload();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to stop impersonation",
        variant: "destructive"
      });
    }
  };

  const UserTable = ({ userList, type }: { userList: User[], type: string }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Status</TableHead>
          {type === "sellers" && <TableHead>Products</TableHead>}
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {userList.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <div>
                <div className="font-medium">
                  {user.firstName} {user.lastName}
                </div>
                <div className="text-sm text-muted-foreground">ID: {user.id}</div>
              </div>
            </TableCell>
            <TableCell>
              <div>
                <div>{user.phoneNumber || "N/A"}</div>
                <div className="text-sm text-muted-foreground">{user.email || "N/A"}</div>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={user.isSeller ? "default" : "secondary"}>
                {user.isSeller ? "Seller" : "Buyer"}
              </Badge>
            </TableCell>
            {type === "sellers" && (
              <TableCell>
                <Badge variant="outline">{user.productCount || 0} products</Badge>
              </TableCell>
            )}
            <TableCell>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleImpersonate(user.id)}
                  data-testid={`impersonate-user-${user.id}`}
                  title="View as this user"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleEditUser(user)}
                  data-testid={`edit-user-${user.id}`}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => handleDeleteUser(user.id)}
                  data-testid={`delete-user-${user.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Super Admin Access</CardTitle>
            <CardDescription>
              Enter your admin credentials to access the user management panel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userId">User ID</Label>
                <Input
                  id="userId"
                  type="text"
                  value={loginData.userId}
                  onChange={(e) => setLoginData(prev => ({ ...prev, userId: e.target.value }))}
                  placeholder="Enter admin user ID"
                  required
                  data-testid="admin-userid-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={loginData.password}
                  onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter password"
                  required
                  data-testid="admin-password-input"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
                data-testid="admin-login-button"
              >
                {loading ? "Authenticating..." : "Login"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Super Admin Panel</h1>
            <p className="text-muted-foreground">Manage users and system operations</p>
            {currentUser?._impersonation?.isImpersonating && (
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="destructive">
                  Impersonating: {currentUser.firstName} {currentUser.lastName}
                </Badge>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleStopImpersonation}
                  data-testid="stop-impersonation-button"
                >
                  <X className="h-4 w-4 mr-1" />
                  Stop Impersonation
                </Button>
              </div>
            )}
          </div>
          <Button 
            onClick={() => setIsAuthenticated(false)}
            variant="outline"
            data-testid="admin-logout-button"
          >
            Logout
          </Button>
        </div>

        <Tabs defaultValue="sellers" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sellers" className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              Sellers ({users.sellers.length})
            </TabsTrigger>
            <TabsTrigger value="buyers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Buyers ({users.buyers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sellers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sellers Management</CardTitle>
                <CardDescription>
                  Users who have created products or are marked as sellers
                </CardDescription>
              </CardHeader>
              <CardContent>
                {users.sellers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No sellers found
                  </div>
                ) : (
                  <UserTable userList={users.sellers} type="sellers" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="buyers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Buyers Management</CardTitle>
                <CardDescription>
                  Users who have not created any products
                </CardDescription>
              </CardHeader>
              <CardContent>
                {users.buyers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No buyers found
                  </div>
                ) : (
                  <UserTable userList={users.buyers} type="buyers" />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editFirstName">First Name</Label>
                <Input
                  id="editFirstName"
                  value={editForm.firstName || ""}
                  onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                  data-testid="edit-first-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editLastName">Last Name</Label>
                <Input
                  id="editLastName"
                  value={editForm.lastName || ""}
                  onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                  data-testid="edit-last-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPhone">Phone Number</Label>
              <Input
                id="editPhone"
                value={editForm.phoneNumber || ""}
                onChange={(e) => setEditForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                data-testid="edit-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEmail">Email</Label>
              <Input
                id="editEmail"
                type="email"
                value={editForm.email || ""}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                data-testid="edit-email"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="editSeller"
                checked={editForm.isSeller || false}
                onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, isSeller: checked }))}
                data-testid="edit-seller-switch"
              />
              <Label htmlFor="editSeller">Is Seller</Label>
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={handleUpdateUser} data-testid="save-user-changes">
                Save Changes
              </Button>
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}