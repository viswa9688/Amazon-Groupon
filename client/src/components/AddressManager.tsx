import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, MapPin, Edit, Trash2, Check, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { insertUserAddressSchema, type UserAddress, type InsertUserAddress } from "@shared/schema";
import { validateBCAddress, type AddressData } from "@/lib/addressValidation";

const addressSchema = insertUserAddressSchema.omit({ userId: true }).extend({
  pincode: z.string().min(1, "Postal code is required"),
  state: z.string().min(1, "Province/State is required"),
  country: z.string().default("Canada"),
});

type AddressFormData = z.infer<typeof addressSchema>;

interface AddressManagerProps {
  selectedAddressId?: number | null;
  onAddressSelect: (addressId: number) => void;
  showSelection?: boolean;
  deliveryMethod?: "pickup" | "delivery";
}

export default function AddressManager({ 
  selectedAddressId, 
  onAddressSelect, 
  showSelection = true,
  deliveryMethod = "delivery"
}: AddressManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<number | null>(null);
  const [groupsUsingAddress, setGroupsUsingAddress] = useState<number>(0);
  const { toast } = useToast();

  const form = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      nickname: "",
      fullName: "",
      phoneNumber: "",
      addressLine: "",
      city: "",
      pincode: "",
      state: "",
      country: "Canada",
      isDefault: false,
    },
  });

  // Get current user
  const { user, isAuthenticated } = useAuth();

  // Fetch user addresses
  const { data: addresses = [], isLoading } = useQuery<UserAddress[]>({
    queryKey: ["/api/addresses"],
    enabled: isAuthenticated,
  });

  // Create address mutation
  const createAddressMutation = useMutation({
    mutationFn: (data: InsertUserAddress) => 
      apiRequest("POST", "/api/addresses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/addresses"] });
      setShowForm(false);
      setEditingAddress(null);
      form.reset();
      toast({
        title: "Success",
        description: "Address saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save address",
        variant: "destructive",
      });
    },
  });

  // Update address mutation
  const updateAddressMutation = useMutation({
    mutationFn: (data: { id: number; address: Partial<InsertUserAddress> }) => 
      apiRequest("PUT", `/api/addresses/${data.id}`, data.address),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/addresses"] });
      setShowForm(false);
      setEditingAddress(null);
      form.reset();
      toast({
        title: "Success",
        description: "Address updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update address",
        variant: "destructive",
      });
    },
  });

  // Delete address mutation
  const deleteAddressMutation = useMutation({
    mutationFn: (addressId: number) => 
      apiRequest("DELETE", `/api/addresses/${addressId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/addresses"] });
      toast({
        title: "Success",
        description: "Address deleted successfully",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to delete address";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Set default address mutation
  const setDefaultMutation = useMutation({
    mutationFn: (addressId: number) => 
      apiRequest("POST", `/api/addresses/${addressId}/set-default`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/addresses"] });
      toast({
        title: "Success",
        description: "Default address updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to set default address",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (data: AddressFormData) => {
    // Validate BC address using geocoding API
    const addressData: AddressData = {
      addressLine1: data.addressLine,
      city: data.city,
      state: data.state,
      postalCode: data.pincode,
      country: data.country
    };

    try {
      const validationResult = await validateBCAddress(addressData);
      
      if (!validationResult.isValid) {
        toast({
          title: "Address Validation Error",
          description: validationResult.error || "Address is not in British Columbia. Please enter a valid BC address.",
          variant: "destructive"
        });
        return;
      }

      // Show success message with formatted address
      if (validationResult.formattedAddress) {
        console.log('Address validated successfully:', validationResult.formattedAddress);
      }
    } catch (error) {
      toast({
        title: "Validation Error",
        description: "Failed to validate address. Please check your internet connection and try again.",
        variant: "destructive"
      });
      return;
    }

    if (editingAddress) {
      updateAddressMutation.mutate({
        id: editingAddress.id,
        address: data,
      });
    } else {
      if (!user?.id) return;
      createAddressMutation.mutate({
        ...data,
        userId: user.id,
      });
    }
  };

  const handleEdit = (address: UserAddress) => {
    setEditingAddress(address);
    form.reset({
      nickname: address.nickname,
      fullName: address.fullName,
      phoneNumber: address.phoneNumber,
      addressLine: address.addressLine,
      city: address.city,
      pincode: address.pincode,
      state: address.state || "",
      country: address.country || "Canada",
      isDefault: address.isDefault || false,
    });
    setShowForm(true);
  };

  const handleDelete = async (addressId: number) => {
    try {
      // Check how many groups are using this address
      const response = await fetch(`/api/addresses/${addressId}/usage`, {
        credentials: 'include',
      });
      const data = await response.json();
      
      setAddressToDelete(addressId);
      setGroupsUsingAddress(data.groupCount || 0);
      setDeleteConfirmOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check address usage",
        variant: "destructive",
      });
    }
  };

  const confirmDelete = () => {
    if (addressToDelete) {
      deleteAddressMutation.mutate(addressToDelete);
      setDeleteConfirmOpen(false);
      setAddressToDelete(null);
      setGroupsUsingAddress(0);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingAddress(null);
    form.reset();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading addresses...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5" />
            <span>{deliveryMethod === "pickup" ? "Contact Addresses" : "Delivery Addresses"}</span>
          </div>
          {!showForm && (
            <Button 
              onClick={() => setShowForm(true)}
              size="sm"
              data-testid="button-add-address"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Address
            </Button>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {deliveryMethod === "pickup" 
            ? "Select your contact address for pickup coordination" 
            : "Select a delivery address for your order"
          }
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Address List */}
        {addresses.length > 0 && !showForm && (
          <div className="space-y-3">
            {showSelection ? (
              <RadioGroup 
                value={selectedAddressId?.toString()} 
                onValueChange={(value) => onAddressSelect(parseInt(value))}
              >
                {addresses.map((address) => (
                  <div key={address.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                    <RadioGroupItem 
                      value={address.id.toString()} 
                      id={`address-${address.id}`}
                      data-testid={`radio-address-${address.id}`}
                    />
                    <div className="flex-1">
                      <Label htmlFor={`address-${address.id}`} className="cursor-pointer">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium">{address.nickname}</span>
                          {address.isDefault && (
                            <Badge variant="secondary" className="text-xs">
                              Default
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <div>{address.fullName}</div>
                          <div>{address.addressLine}</div>
                          <div>{address.city}, {address.state} {address.pincode}</div>
                          <div>{address.phoneNumber}</div>
                        </div>
                      </Label>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(address)}
                        data-testid={`button-edit-address-${address.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {!address.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDefaultMutation.mutate(address.id)}
                          data-testid={`button-set-default-${address.id}`}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(address.id)}
                        className="text-red-600 hover:text-red-700"
                        data-testid={`button-delete-address-${address.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <div className="space-y-3">
                {addresses.map((address) => (
                  <div key={address.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium">{address.nickname}</span>
                        {address.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <div>{address.fullName}</div>
                        <div>{address.addressLine}</div>
                        <div>{address.city}, {address.state} {address.pincode}</div>
                        <div>{address.phoneNumber}</div>
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(address)}
                        data-testid={`button-edit-address-${address.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {!address.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDefaultMutation.mutate(address.id)}
                          data-testid={`button-set-default-${address.id}`}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(address.id)}
                        className="text-red-600 hover:text-red-700"
                        data-testid={`button-delete-address-${address.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* No addresses message */}
        {addresses.length === 0 && !showForm && (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No addresses saved yet</p>
            <p className="text-sm">Add your first delivery address to continue</p>
          </div>
        )}

        {/* Address Form */}
        {showForm && (
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">
                {editingAddress ? "Edit Address" : "Add New Address"}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                data-testid="button-cancel-address"
              >
                Cancel
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nickname">Nickname *</Label>
                <Input
                  id="nickname"
                  placeholder="e.g., Home, Office"
                  {...form.register("nickname")}
                  data-testid="input-address-nickname"
                />
                {form.formState.errors.nickname && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.nickname.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  placeholder="Recipient's full name"
                  {...form.register("fullName")}
                  data-testid="input-address-fullname"
                />
                {form.formState.errors.fullName && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.fullName.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="phoneNumber">Phone Number *</Label>
              <Input
                id="phoneNumber"
                placeholder="Contact phone number"
                {...form.register("phoneNumber")}
                data-testid="input-address-phone"
              />
              {form.formState.errors.phoneNumber && (
                <p className="text-sm text-red-600 mt-1">
                  {form.formState.errors.phoneNumber.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="addressLine">Address *</Label>
              <Textarea
                id="addressLine"
                placeholder="House/Flat no, Building name, Street, Area"
                {...form.register("addressLine")}
                data-testid="textarea-address-line"
              />
              {form.formState.errors.addressLine && (
                <p className="text-sm text-red-600 mt-1">
                  {form.formState.errors.addressLine.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  placeholder="City"
                  {...form.register("city")}
                  data-testid="input-address-city"
                />
                {form.formState.errors.city && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.city.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="state">Province/State * (Must be BC)</Label>
                <Input
                  id="state"
                  placeholder="e.g., British Columbia"
                  {...form.register("state")}
                  data-testid="input-address-state"
                />
                {form.formState.errors.state && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.state.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="pincode">Postal Code *</Label>
                <Input
                  id="pincode"
                  placeholder="e.g., V6C 1T4"
                  {...form.register("pincode")}
                  data-testid="input-address-zipcode"
                />
                {form.formState.errors.pincode && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.pincode.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isDefault"
                {...form.register("isDefault")}
                data-testid="checkbox-address-default"
              />
              <Label htmlFor="isDefault" className="text-sm">
                Set as default address
              </Label>
            </div>

            <div className="flex space-x-3 pt-4">
              <Button
                type="submit"
                disabled={createAddressMutation.isPending || updateAddressMutation.isPending}
                data-testid="button-save-address"
              >
                {editingAddress ? "Update Address" : "Save Address"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                data-testid="button-cancel-address-form"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <span>Delete Address</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {groupsUsingAddress > 0 ? (
                <div className="space-y-2">
                  <p className="font-semibold text-orange-600">
                    Warning: This address is being used as a pickup location in {groupsUsingAddress} {groupsUsingAddress === 1 ? 'group' : 'groups'}.
                  </p>
                  <p>
                    If you delete this address, those groups will lose their pickup location information. Members won't be able to see where to pick up their orders.
                  </p>
                  <p className="font-medium">
                    Are you sure you want to continue?
                  </p>
                </div>
              ) : (
                <p>Are you sure you want to delete this address? This action cannot be undone.</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteConfirmOpen(false);
              setAddressToDelete(null);
              setGroupsUsingAddress(0);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {groupsUsingAddress > 0 ? 'Delete Anyway' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}