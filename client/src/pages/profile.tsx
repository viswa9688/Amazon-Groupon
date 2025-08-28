import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserAddressSchema } from "@shared/schema";
import type { UserAddress, InsertUserAddress } from "@shared/schema";
import { Plus, Edit2, Trash2, MapPin, Home, Star } from "lucide-react";
import { z } from "zod";

const addressFormSchema = insertUserAddressSchema.omit({ userId: true });
type AddressFormData = z.infer<typeof addressFormSchema>;

export default function Profile() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Fetch user addresses
  const { data: addresses = [], isLoading: addressesLoading } = useQuery<UserAddress[]>({
    queryKey: ["/api/addresses"],
    enabled: isAuthenticated,
  });

  // Address form
  const form = useForm<AddressFormData>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: {
      nickname: "",
      fullName: "",
      phoneNumber: "",
      addressLine: "",
      city: "",
      pincode: "",
      state: "",
      country: "India",
      isDefault: false,
    },
  });

  // Create address mutation
  const createAddressMutation = useMutation({
    mutationFn: (data: AddressFormData) => apiRequest("POST", "/api/addresses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/addresses"] });
      toast({ title: "Success", description: "Address added successfully" });
      setShowAddressForm(false);
      form.reset();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to add address. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update address mutation
  const updateAddressMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AddressFormData> }) =>
      apiRequest("PUT", `/api/addresses/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/addresses"] });
      toast({ title: "Success", description: "Address updated successfully" });
      setEditingAddress(null);
      setShowAddressForm(false);
      form.reset();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update address. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete address mutation
  const deleteAddressMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/addresses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/addresses"] });
      toast({ title: "Success", description: "Address deleted successfully" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete address. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Set default address mutation
  const setDefaultMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/addresses/${id}/set-default`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/addresses"] });
      toast({ title: "Success", description: "Default address updated" });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to set default address. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEditAddress = (address: UserAddress) => {
    setEditingAddress(address);
    form.reset({
      nickname: address.nickname,
      fullName: address.fullName,
      phoneNumber: address.phoneNumber,
      addressLine: address.addressLine,
      city: address.city,
      pincode: address.pincode,
      state: address.state || "",
      country: address.country || "India",
      isDefault: address.isDefault,
    });
    setShowAddressForm(true);
  };

  const handleSubmit = (data: AddressFormData) => {
    if (editingAddress) {
      updateAddressMutation.mutate({ id: editingAddress.id, data });
    } else {
      createAddressMutation.mutate(data);
    }
  };

  // Auto-populate form with user data when first adding an address
  useEffect(() => {
    if (user && !editingAddress && showAddressForm && addresses.length === 0) {
      form.reset({
        nickname: "Home",
        fullName: `${(user as any)?.firstName || ""} ${(user as any)?.lastName || ""}`.trim() || "User",
        phoneNumber: (user as any)?.phoneNumber || "",
        addressLine: "",
        city: "",
        pincode: "",
        state: "",
        country: "India",
        isDefault: true, // First address should be default
      });
    }
  }, [user, editingAddress, showAddressForm, addresses.length, form]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-64 mb-8"></div>
            <div className="h-64 bg-muted rounded mb-4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-profile-title">
              My Profile
            </h1>
          </div>

          {/* User Info Card */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-xl">
                  {(user as any)?.firstName?.charAt(0) || "U"}
                </div>
                <div>
                  <h2 className="text-xl font-semibold" data-testid="text-user-name">
                    {(user as any)?.firstName} {(user as any)?.lastName}
                  </h2>
                  <p className="text-muted-foreground" data-testid="text-user-phone">
                    {(user as any)?.phoneNumber || (user as any)?.email}
                  </p>
                </div>
              </CardTitle>
            </CardHeader>
          </Card>

          {/* Addresses Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="w-5 h-5" />
                <span>Delivery Addresses</span>
              </CardTitle>
              <Dialog open={showAddressForm} onOpenChange={setShowAddressForm}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={() => {
                      setEditingAddress(null);
                      form.reset();
                    }}
                    data-testid="button-add-address"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Address
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingAddress ? "Edit Address" : "Add New Address"}
                    </DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="nickname"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Address Nickname</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Home, Office, Mom's House" {...field} data-testid="input-nickname" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter recipient name" {...field} data-testid="input-full-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="phoneNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter phone number" {...field} data-testid="input-phone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="addressLine"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Street Address</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Enter complete address with landmark" 
                                className="min-h-20" 
                                {...field} 
                                data-testid="input-address-line" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter city" {...field} data-testid="input-city" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="pincode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Pincode</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter pincode" {...field} data-testid="input-pincode" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="state"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>State</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter state" {...field} value={field.value || ""} data-testid="input-state" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="isDefault"
                          {...form.register("isDefault")}
                          data-testid="checkbox-default"
                        />
                        <Label htmlFor="isDefault">Set as default address</Label>
                      </div>

                      <DialogFooter className="gap-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setShowAddressForm(false)}
                          data-testid="button-cancel-address"
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createAddressMutation.isPending || updateAddressMutation.isPending}
                          data-testid="button-save-address"
                        >
                          {createAddressMutation.isPending || updateAddressMutation.isPending
                            ? "Saving..."
                            : editingAddress 
                            ? "Update Address" 
                            : "Add Address"
                          }
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {addressesLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="animate-pulse h-32 bg-muted rounded-lg"></div>
                  ))}
                </div>
              ) : addresses.length === 0 ? (
                <div className="text-center py-12">
                  <Home className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">No Addresses Added</h3>
                  <p className="text-muted-foreground mb-6">
                    Add your first delivery address to complete your profile and start ordering.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {addresses.map((address) => (
                    <div 
                      key={address.id} 
                      className="border border-border rounded-lg p-4 relative"
                      data-testid={`address-card-${address.id}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-semibold text-foreground">{address.nickname}</h3>
                            {address.isDefault && (
                              <Badge variant="default" className="text-xs">
                                <Star className="w-3 h-3 mr-1" />
                                Default
                              </Badge>
                            )}
                          </div>
                          <p className="font-medium text-foreground">{address.fullName}</p>
                          <p className="text-sm text-muted-foreground">{address.phoneNumber}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {address.addressLine}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {address.city}, {address.state} {address.pincode}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          {!address.isDefault && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDefaultMutation.mutate(address.id)}
                              disabled={setDefaultMutation.isPending}
                              data-testid={`button-set-default-${address.id}`}
                            >
                              Set Default
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditAddress(address)}
                            data-testid={`button-edit-${address.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteAddressMutation.mutate(address.id)}
                            disabled={deleteAddressMutation.isPending}
                            data-testid={`button-delete-${address.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}