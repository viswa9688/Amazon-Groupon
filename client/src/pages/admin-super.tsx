import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Trash2, Edit, Users, ShoppingBag, Eye, X, Plus, Store, MapPin, 
  Clock, Globe, CreditCard, Languages, Shield, FileText 
} from "lucide-react";
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
  
  // Shop/Store Details
  storeId?: string;
  legalName?: string;
  displayName?: string;
  shopType?: string;
  status?: string;
  timezone?: string;
  currency?: string;
  languages?: string;
  
  // Address
  addressLine1?: string;
  addressLine2?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  serviceAreaPolygon?: any;
  
  // Operating Hours
  operatingHours?: string;
  pickupHours?: string;
  deliveryHours?: string;
  
  // Policies
  ageCheckEnabled?: boolean;
  substitutionPolicy?: string;
  refundPolicyUrl?: string;
  
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
  const [addShopDialogOpen, setAddShopDialogOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [deleteWarningUser, setDeleteWarningUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);
  const [newShopForm, setNewShopForm] = useState<Partial<User>>({
    isSeller: true,
    shopType: "groceries",
    status: "active",
    currency: "CAD",
    languages: "en",
    country: "CA",
    ageCheckEnabled: false,
    substitutionPolicy: "customer_opt_in"
  });
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
      storeId: user.storeId,
      legalName: user.legalName,
      displayName: user.displayName,
      shopType: user.shopType,
      status: user.status,
      timezone: user.timezone,
      currency: user.currency,
      languages: user.languages,
      addressLine1: user.addressLine1,
      addressLine2: user.addressLine2,
      locality: user.locality,
      region: user.region,
      postalCode: user.postalCode,
      country: user.country,
      operatingHours: user.operatingHours,
      pickupHours: user.pickupHours,
      deliveryHours: user.deliveryHours,
      ageCheckEnabled: user.ageCheckEnabled,
      substitutionPolicy: user.substitutionPolicy,
      refundPolicyUrl: user.refundPolicyUrl,
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

  const handleDeleteUser = (user: User) => {
    setDeleteWarningUser(user);
  };

  const handleConfirmFirstWarning = () => {
    if (deleteWarningUser) {
      setDeleteConfirmUser(deleteWarningUser);
      setDeleteWarningUser(null);
    }
  };

  const handleFinalDeleteConfirm = async () => {
    if (!deleteConfirmUser) return;
    
    try {
      await apiRequest("DELETE", `/api/admin/users/${deleteConfirmUser.id}`, loginData);
      toast({ 
        title: "Success", 
        description: `User ${deleteConfirmUser.firstName} ${deleteConfirmUser.lastName} and all their products have been deleted successfully` 
      });
      setDeleteConfirmUser(null);
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
        description: "You are now viewing as the selected user",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
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
      toast({ 
        title: "Impersonation Stopped", 
        description: "Returning to admin view",
      });
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to stop impersonation",
        variant: "destructive"
      });
    }
  };

  const handleAddShop = async () => {
    try {
      // Create a new user with shop details
      await apiRequest("POST", `/api/admin/create-shop`, {
        ...loginData,
        ...newShopForm
      });
      
      toast({ title: "Success", description: "New shop created successfully" });
      setAddShopDialogOpen(false);
      setNewShopForm({
        isSeller: true,
        status: "active",
        currency: "CAD",
        languages: "en",
        country: "CA",
        ageCheckEnabled: false,
        substitutionPolicy: "customer_opt_in"
      });
      await fetchUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create shop",
        variant: "destructive"
      });
    }
  };

  const UserTable = ({ userList, type }: { userList: User[], type: string }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Shop Info</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Location</TableHead>
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
                  {user.displayName || `${user.firstName} ${user.lastName}`}
                </div>
                <div className="text-sm text-muted-foreground">
                  {user.storeId && <span>ID: {user.storeId}</span>}
                  {!user.storeId && <span>User ID: {user.id.slice(0, 8)}...</span>}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={user.shopType === "groceries" ? "default" : "secondary"}>
                {user.shopType === "groceries" ? "Groceries" : user.shopType === "services" ? "Services" : "Not Set"}
              </Badge>
            </TableCell>
            <TableCell>
              <div>
                <div>{user.phoneNumber || "N/A"}</div>
                <div className="text-sm text-muted-foreground">{user.email || "N/A"}</div>
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm">
                {user.locality && user.region ? (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {user.locality}, {user.region}
                  </div>
                ) : (
                  <span className="text-muted-foreground">No location</span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={user.status === "active" ? "default" : "secondary"}>
                {user.status || "inactive"}
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
                  onClick={() => setViewingUser(user)}
                  data-testid={`view-user-${user.id}`}
                  title="View details"
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
                  variant="outline" 
                  size="sm"
                  onClick={() => handleImpersonate(user.id)}
                  data-testid={`impersonate-user-${user.id}`}
                  title="Login as this user"
                >
                  <Users className="h-4 w-4" />
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => handleDeleteUser(user)}
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
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Sellers Management</CardTitle>
                    <CardDescription>
                      Users who have created products or are marked as sellers
                    </CardDescription>
                  </div>
                  <Button onClick={() => setAddShopDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add New Shop
                  </Button>
                </div>
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

      {/* Add New Shop Dialog */}
      <Dialog open={addShopDialogOpen} onOpenChange={setAddShopDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add New Shop</DialogTitle>
            <DialogDescription>
              Create a new shop with all necessary details
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[60vh] overflow-y-auto px-1">
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Basic Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="storeId">Store ID</Label>
                    <Input
                      id="storeId"
                      value={newShopForm.storeId || ""}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, storeId: e.target.value }))}
                      placeholder="e.g., ST001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shopType">Shop Type</Label>
                    <Select
                      value={newShopForm.shopType}
                      onValueChange={(value) => setNewShopForm(prev => ({ ...prev, shopType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="groceries">Groceries</SelectItem>
                        <SelectItem value="services">Services</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legalName">Legal Name</Label>
                    <Input
                      id="legalName"
                      value={newShopForm.legalName || ""}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, legalName: e.target.value }))}
                      placeholder="e.g., Vancouver Fresh Mart Ltd."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      value={newShopForm.displayName || ""}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, displayName: e.target.value }))}
                      placeholder="e.g., Vancouver Fresh Mart"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={newShopForm.status}
                      onValueChange={(value) => setNewShopForm(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={newShopForm.firstName || ""}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={newShopForm.lastName || ""}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    <Input
                      id="phoneNumber"
                      value={newShopForm.phoneNumber || ""}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newShopForm.email || ""}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Location */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Location
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="addressLine1">Address Line 1</Label>
                    <Input
                      id="addressLine1"
                      value={newShopForm.addressLine1 || ""}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, addressLine1: e.target.value }))}
                      placeholder="e.g., 123 Main Street"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="addressLine2">Address Line 2</Label>
                    <Input
                      id="addressLine2"
                      value={newShopForm.addressLine2 || ""}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, addressLine2: e.target.value }))}
                      placeholder="e.g., Unit 5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="locality">City</Label>
                    <Input
                      id="locality"
                      value={newShopForm.locality || ""}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, locality: e.target.value }))}
                      placeholder="e.g., Vancouver"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Province/State</Label>
                    <Input
                      id="region"
                      value={newShopForm.region || ""}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, region: e.target.value }))}
                      placeholder="e.g., BC"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      value={newShopForm.postalCode || ""}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, postalCode: e.target.value }))}
                      placeholder="e.g., V5K0A1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={newShopForm.country || ""}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, country: e.target.value }))}
                      placeholder="e.g., CA"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Operating Hours */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Operating Hours
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="operatingHours">Operating Hours</Label>
                    <Input
                      id="operatingHours"
                      value={newShopForm.operatingHours || ""}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, operatingHours: e.target.value }))}
                      placeholder="e.g., Mon-Sun 09:00-21:00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pickupHours">Pickup Hours</Label>
                    <Input
                      id="pickupHours"
                      value={newShopForm.pickupHours || ""}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, pickupHours: e.target.value }))}
                      placeholder="e.g., Mon-Sun 10:00-20:00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deliveryHours">Delivery Hours</Label>
                    <Input
                      id="deliveryHours"
                      value={newShopForm.deliveryHours || ""}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, deliveryHours: e.target.value }))}
                      placeholder="e.g., Mon-Sun 11:00-19:00"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Settings
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      id="timezone"
                      value={newShopForm.timezone || ""}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, timezone: e.target.value }))}
                      placeholder="e.g., America/Vancouver"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      value={newShopForm.currency || ""}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, currency: e.target.value }))}
                      placeholder="e.g., CAD"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="languages">Languages</Label>
                    <Input
                      id="languages"
                      value={newShopForm.languages || ""}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, languages: e.target.value }))}
                      placeholder="e.g., en,fr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="substitutionPolicy">Substitution Policy</Label>
                    <Select
                      value={newShopForm.substitutionPolicy}
                      onValueChange={(value) => setNewShopForm(prev => ({ ...prev, substitutionPolicy: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer_opt_in">Customer Opt-in</SelectItem>
                        <SelectItem value="automatic">Automatic</SelectItem>
                        <SelectItem value="no_substitution">No Substitution</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="refundPolicyUrl">Refund Policy URL</Label>
                  <Input
                    id="refundPolicyUrl"
                    value={newShopForm.refundPolicyUrl || ""}
                    onChange={(e) => setNewShopForm(prev => ({ ...prev, refundPolicyUrl: e.target.value }))}
                    placeholder="e.g., https://example.com/refund-policy"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="ageCheckEnabled"
                    checked={newShopForm.ageCheckEnabled || false}
                    onCheckedChange={(checked) => setNewShopForm(prev => ({ ...prev, ageCheckEnabled: checked }))}
                  />
                  <Label htmlFor="ageCheckEnabled">Age Check Enabled</Label>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddShopDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddShop}>
              Create Shop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Shop/User</DialogTitle>
            <DialogDescription>
              Update shop information and settings
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[70vh] px-1">
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  Basic Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editStoreId">Store ID</Label>
                    <Input
                      id="editStoreId"
                      value={editForm.storeId || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, storeId: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editShopType">Shop Type</Label>
                    <Select
                      value={editForm.shopType || "groceries"}
                      onValueChange={(value) => setEditForm(prev => ({ ...prev, shopType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="groceries">Groceries</SelectItem>
                        <SelectItem value="services">Services</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editStatus">Status</Label>
                    <Select
                      value={editForm.status || "active"}
                      onValueChange={(value) => setEditForm(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editLegalName">Legal Name</Label>
                    <Input
                      id="editLegalName"
                      value={editForm.legalName || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, legalName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editDisplayName">Display Name</Label>
                    <Input
                      id="editDisplayName"
                      value={editForm.displayName || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, displayName: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editFirstName">First Name</Label>
                    <Input
                      id="editFirstName"
                      value={editForm.firstName || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editLastName">Last Name</Label>
                    <Input
                      id="editLastName"
                      value={editForm.lastName || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editPhone">Phone Number</Label>
                    <Input
                      id="editPhone"
                      value={editForm.phoneNumber || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editEmail">Email</Label>
                    <Input
                      id="editEmail"
                      type="email"
                      value={editForm.email || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Location */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Location
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editAddressLine1">Address Line 1</Label>
                    <Input
                      id="editAddressLine1"
                      value={editForm.addressLine1 || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, addressLine1: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editAddressLine2">Address Line 2</Label>
                    <Input
                      id="editAddressLine2"
                      value={editForm.addressLine2 || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, addressLine2: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editLocality">City</Label>
                    <Input
                      id="editLocality"
                      value={editForm.locality || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, locality: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editRegion">Province/State</Label>
                    <Input
                      id="editRegion"
                      value={editForm.region || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, region: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editPostalCode">Postal Code</Label>
                    <Input
                      id="editPostalCode"
                      value={editForm.postalCode || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, postalCode: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editCountry">Country</Label>
                    <Input
                      id="editCountry"
                      value={editForm.country || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, country: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Operating Hours */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Operating Hours
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="editOperatingHours">Operating Hours</Label>
                    <Input
                      id="editOperatingHours"
                      value={editForm.operatingHours || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, operatingHours: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editPickupHours">Pickup Hours</Label>
                    <Input
                      id="editPickupHours"
                      value={editForm.pickupHours || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, pickupHours: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editDeliveryHours">Delivery Hours</Label>
                    <Input
                      id="editDeliveryHours"
                      value={editForm.deliveryHours || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, deliveryHours: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Settings
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editTimezone">Timezone</Label>
                    <Input
                      id="editTimezone"
                      value={editForm.timezone || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, timezone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editCurrency">Currency</Label>
                    <Input
                      id="editCurrency"
                      value={editForm.currency || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, currency: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editLanguages">Languages</Label>
                    <Input
                      id="editLanguages"
                      value={editForm.languages || ""}
                      onChange={(e) => setEditForm(prev => ({ ...prev, languages: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editSubstitutionPolicy">Substitution Policy</Label>
                    <Select
                      value={editForm.substitutionPolicy || "customer_opt_in"}
                      onValueChange={(value) => setEditForm(prev => ({ ...prev, substitutionPolicy: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer_opt_in">Customer Opt-in</SelectItem>
                        <SelectItem value="automatic">Automatic</SelectItem>
                        <SelectItem value="no_substitution">No Substitution</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editRefundPolicyUrl">Refund Policy URL</Label>
                  <Input
                    id="editRefundPolicyUrl"
                    value={editForm.refundPolicyUrl || ""}
                    onChange={(e) => setEditForm(prev => ({ ...prev, refundPolicyUrl: e.target.value }))}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="editAgeCheckEnabled"
                    checked={editForm.ageCheckEnabled || false}
                    onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, ageCheckEnabled: checked }))}
                  />
                  <Label htmlFor="editAgeCheckEnabled">Age Check Enabled</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="editSeller"
                    checked={editForm.isSeller || false}
                    onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, isSeller: checked }))}
                  />
                  <Label htmlFor="editSeller">Is Seller</Label>
                </div>
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View User Details Dialog */}
      <Dialog open={!!viewingUser} onOpenChange={() => setViewingUser(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Shop Details</DialogTitle>
            <DialogDescription>
              Complete information about the shop
            </DialogDescription>
          </DialogHeader>
          
          {viewingUser && (
            <ScrollArea className="max-h-[70vh] px-1">
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Store className="h-5 w-5" />
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Store ID</Label>
                      <p className="font-medium">{viewingUser.storeId || "Not set"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <Badge variant={viewingUser.status === "active" ? "default" : "secondary"}>
                        {viewingUser.status || "inactive"}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Legal Name</Label>
                      <p className="font-medium">{viewingUser.legalName || "Not set"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Display Name</Label>
                      <p className="font-medium">{viewingUser.displayName || "Not set"}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Contact Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Name</Label>
                      <p className="font-medium">
                        {viewingUser.firstName} {viewingUser.lastName}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Phone</Label>
                      <p className="font-medium">{viewingUser.phoneNumber || "Not set"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <p className="font-medium">{viewingUser.email || "Not set"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">User Type</Label>
                      <Badge>{viewingUser.isSeller ? "Seller" : "Buyer"}</Badge>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Location */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Location
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label className="text-muted-foreground">Address</Label>
                      <p className="font-medium">
                        {viewingUser.addressLine1 || "Not set"}
                        {viewingUser.addressLine2 && <>, {viewingUser.addressLine2}</>}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">City</Label>
                      <p className="font-medium">{viewingUser.locality || "Not set"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Province/State</Label>
                      <p className="font-medium">{viewingUser.region || "Not set"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Postal Code</Label>
                      <p className="font-medium">{viewingUser.postalCode || "Not set"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Country</Label>
                      <p className="font-medium">{viewingUser.country || "Not set"}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Operating Hours */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Operating Hours
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">Operating Hours</Label>
                      <p className="font-medium">{viewingUser.operatingHours || "Not set"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Pickup Hours</Label>
                      <p className="font-medium">{viewingUser.pickupHours || "Not set"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Delivery Hours</Label>
                      <p className="font-medium">{viewingUser.deliveryHours || "Not set"}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Settings & Policies */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Settings & Policies
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Timezone</Label>
                      <p className="font-medium">{viewingUser.timezone || "Not set"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Currency</Label>
                      <p className="font-medium">{viewingUser.currency || "Not set"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Languages</Label>
                      <p className="font-medium">{viewingUser.languages || "Not set"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Substitution Policy</Label>
                      <p className="font-medium">{viewingUser.substitutionPolicy || "Not set"}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-muted-foreground">Refund Policy URL</Label>
                      <p className="font-medium text-blue-600">
                        {viewingUser.refundPolicyUrl || "Not set"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Age Check</Label>
                      <Badge variant={viewingUser.ageCheckEnabled ? "default" : "secondary"}>
                        {viewingUser.ageCheckEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* System Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">System Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">User ID</Label>
                      <p className="font-mono text-sm">{viewingUser.id}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Product Count</Label>
                      <Badge variant="outline">{viewingUser.productCount || 0} products</Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Created At</Label>
                      <p className="text-sm">
                        {new Date(viewingUser.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Updated At</Label>
                      <p className="text-sm">
                        {new Date(viewingUser.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingUser(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* First Delete Warning Dialog */}
      <Dialog open={!!deleteWarningUser} onOpenChange={() => setDeleteWarningUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete User Warning
            </DialogTitle>
            <DialogDescription className="space-y-3 py-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="font-semibold text-destructive">
                  ⚠️ All the products will be deleted for this user
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  User: <span className="font-medium">{deleteWarningUser?.firstName} {deleteWarningUser?.lastName}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Products: <span className="font-medium">{deleteWarningUser?.productCount || 0} products</span>
                </p>
              </div>
              <p className="text-sm">
                This action will permanently delete all products associated with this seller before removing their account.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setDeleteWarningUser(null)}
              data-testid="cancel-delete-warning"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmFirstWarning}
              data-testid="continue-delete-warning"
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Final Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmUser} onOpenChange={() => setDeleteConfirmUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Final Confirmation
            </DialogTitle>
            <DialogDescription className="space-y-3 py-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="font-semibold text-destructive text-center">
                  Are you sure?
                </p>
                <p className="text-sm text-center mt-2">
                  This action cannot be undone.
                </p>
              </div>
              <div className="text-sm space-y-1">
                <p><span className="font-medium">User:</span> {deleteConfirmUser?.firstName} {deleteConfirmUser?.lastName}</p>
                <p><span className="font-medium">Products to delete:</span> {deleteConfirmUser?.productCount || 0}</p>
                <p><span className="font-medium">Store ID:</span> {deleteConfirmUser?.storeId || "N/A"}</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirmUser(null)}
              data-testid="cancel-final-delete"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleFinalDeleteConfirm}
              data-testid="confirm-final-delete"
            >
              Yes, Delete Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}