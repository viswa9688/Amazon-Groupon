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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserCircle, Edit2, Phone, Mail, User, Shield } from "lucide-react";
import { z } from "zod";

const updatePersonalInfoSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z.string().min(10, "Valid phone number is required"),
  email: z.string().email("Valid email is required").optional(),
});

const otpVerificationSchema = z.object({
  otp: z.string().min(4, "OTP must be at least 4 digits"),
});

type UpdatePersonalInfoData = z.infer<typeof updatePersonalInfoSchema>;
type OTPVerificationData = z.infer<typeof otpVerificationSchema>;

export default function PersonalInfo() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<any>(null);
  const [verificationField, setVerificationField] = useState<'phoneNumber' | 'email' | null>(null);

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

  // Personal info form
  const form = useForm<UpdatePersonalInfoData>({
    resolver: zodResolver(updatePersonalInfoSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      email: "",
    },
  });

  // OTP verification form
  const otpForm = useForm<OTPVerificationData>({
    resolver: zodResolver(otpVerificationSchema),
    defaultValues: {
      otp: "",
    },
  });

  // Update form values when user data loads
  useEffect(() => {
    if (user) {
      form.reset({
        firstName: (user as any)?.firstName || "",
        lastName: (user as any)?.lastName || "",
        phoneNumber: (user as any)?.phoneNumber || "",
        email: (user as any)?.email || "",
      });
    }
  }, [user, form]);

  // Update personal info mutation
  const updateInfoMutation = useMutation({
    mutationFn: (data: UpdatePersonalInfoData) => apiRequest("PUT", "/api/auth/update-profile", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Success", description: "Personal information updated successfully" });
      setShowOtpModal(false);
      setPendingUpdate(null);
      setVerificationField(null);
      otpForm.reset();
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
        description: "Failed to update personal information. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Send OTP mutation
  const sendOtpMutation = useMutation({
    mutationFn: ({ field, value }: { field: string; value: string }) => 
      apiRequest("POST", "/api/auth/send-otp", { field, value }),
    onSuccess: () => {
      toast({ title: "OTP Sent", description: "Please check your phone or email for the verification code" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send OTP. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: UpdatePersonalInfoData) => {
    const originalUser = user as any;
    
    // Check if phone or email changed
    const phoneChanged = data.phoneNumber !== originalUser?.phoneNumber;
    const emailChanged = data.email !== originalUser?.email && data.email;

    if (phoneChanged || emailChanged) {
      // Store pending update and show OTP modal
      setPendingUpdate(data);
      
      if (phoneChanged) {
        setVerificationField('phoneNumber');
        sendOtpMutation.mutate({ field: 'phoneNumber', value: data.phoneNumber });
      } else if (emailChanged && data.email) {
        setVerificationField('email');
        sendOtpMutation.mutate({ field: 'email', value: data.email });
      }
      
      setShowOtpModal(true);
    } else {
      // No sensitive fields changed, update directly
      updateInfoMutation.mutate(data);
    }
  };

  const handleOtpVerification = (otpData: OTPVerificationData) => {
    // For now, accept any OTP as requested
    if (otpData.otp && pendingUpdate) {
      updateInfoMutation.mutate(pendingUpdate);
    } else {
      toast({
        title: "Invalid OTP",
        description: "Please enter a valid OTP",
        variant: "destructive",
      });
    }
  };

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
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-personal-info-title">
              Personal Information
            </h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <UserCircle className="w-6 h-6" />
                <span>Your Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                              <Input 
                                placeholder="Enter first name" 
                                className="pl-10" 
                                {...field} 
                                data-testid="input-first-name" 
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                              <Input 
                                placeholder="Enter last name" 
                                className="pl-10" 
                                {...field} 
                                data-testid="input-last-name" 
                              />
                            </div>
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
                        <FormLabel className="flex items-center space-x-1">
                          <span>Phone Number</span>
                          <Shield className="w-3 h-3 text-amber-500" />
                          <span className="text-xs text-muted-foreground">(Requires OTP verification)</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                            <Input 
                              placeholder="Enter phone number" 
                              className="pl-10" 
                              {...field} 
                              data-testid="input-phone-number" 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center space-x-1">
                          <span>Email Address</span>
                          <Shield className="w-3 h-3 text-amber-500" />
                          <span className="text-xs text-muted-foreground">(Requires OTP verification)</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                            <Input 
                              placeholder="Enter email address" 
                              type="email"
                              className="pl-10" 
                              {...field}
                              value={field.value || ""} 
                              data-testid="input-email" 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button 
                      type="submit" 
                      disabled={updateInfoMutation.isPending}
                      data-testid="button-update-info"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      {updateInfoMutation.isPending ? "Updating..." : "Update Information"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* OTP Verification Modal */}
      <Dialog open={showOtpModal} onOpenChange={setShowOtpModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5" />
              <span>Verify {verificationField === 'phoneNumber' ? 'Phone Number' : 'Email'}</span>
            </DialogTitle>
          </DialogHeader>
          <Form {...otpForm}>
            <form onSubmit={otpForm.handleSubmit(handleOtpVerification)} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We've sent a verification code to your{' '}
                {verificationField === 'phoneNumber' ? 'phone number' : 'email address'}.
                Please enter it below to confirm the change.
              </p>
              
              <FormField
                control={otpForm.control}
                name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Code</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter OTP" 
                        {...field} 
                        data-testid="input-otp" 
                        className="text-center text-lg tracking-widest"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowOtpModal(false);
                    setPendingUpdate(null);
                    setVerificationField(null);
                    otpForm.reset();
                  }}
                  data-testid="button-cancel-otp"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateInfoMutation.isPending}
                  data-testid="button-verify-otp"
                >
                  {updateInfoMutation.isPending ? "Verifying..." : "Verify & Update"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}