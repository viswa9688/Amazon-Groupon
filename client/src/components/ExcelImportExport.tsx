import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface ExcelImportExportProps {
  selectedShop?: any;
  onImportComplete?: () => void;
}

interface ValidationResult {
  success: boolean;
  message: string;
  imported: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
  products: any[];
}

interface ImportResult {
  success: boolean;
  message: string;
  imported: number;
  failed: number;
}

export default function ExcelImportExport({ selectedShop, onImportComplete }: ExcelImportExportProps) {
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  // Fetch seller's shops automatically
  const { data: sellerShops, isLoading: shopsLoading } = useQuery({
    queryKey: ['/api/seller/shops'],
    queryFn: async () => {
      const response = await fetch('/api/seller/shops', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch shops');
      }
      return response.json();
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Use the first shop if available, or fall back to selectedShop prop
  const activeShop = sellerShops && sellerShops.length > 0 ? sellerShops[0] : selectedShop;
  
  console.log('🔍 ExcelImportExport - sellerShops:', sellerShops);
  console.log('🔍 ExcelImportExport - selectedShop:', selectedShop);
  console.log('🔍 ExcelImportExport - activeShop:', activeShop);
  
  // Validate that we have a valid shop
  if (!activeShop || !activeShop.id) {
    console.error('❌ No valid shop found for Excel operations');
  }

  // Download template mutation
  const downloadTemplateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/seller/excel/template', {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to download template');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'product-import-template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Template downloaded successfully!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to download template: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Validate file mutation
  const validateFileMutation = useMutation({
    mutationFn: async (file: File) => {
      // Validate that we have a valid shop before proceeding
      if (!activeShop || !activeShop.id) {
        throw new Error('No valid shop selected. Please ensure you have a shop assigned.');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('shopId', activeShop.id);

      console.log('🔍 Sending validation request for shop:', activeShop.id);

      const response = await fetch('/api/seller/excel/validate', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Validation failed');
      }

      return response.json();
    },
    onSuccess: (result: ValidationResult) => {
      console.log('✅ Frontend: Validation successful, result:', result);
      setValidationResult(result);
      setIsValidating(false);
      
      if (result.success) {
        toast({
          title: "Success",
          description: `Validation successful! ${result.imported} products ready to import.`,
        });
      } else {
        toast({
          title: "Warning",
          description: `Validation completed with ${result.errors.length} errors. Please review and fix.`,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      setIsValidating(false);
      toast({
        title: "Error",
        description: `Validation failed: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Import products mutation
  const importProductsMutation = useMutation({
    mutationFn: async (validatedData: ValidationResult) => {
      console.log('🚀 Frontend: Calling import API with data:', { validatedData, shopId: activeShop.id });
      
      try {
        const response = await fetch('/api/seller/excel/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            validatedData,
            shopId: activeShop.id,
          }),
          credentials: 'include',
        });

        console.log('🚀 Frontend: API response status:', response.status);
        console.log('🚀 Frontend: API response ok:', response.ok);

        if (!response.ok) {
          const errorData = await response.json();
          console.log('❌ Frontend: API error response:', errorData);
          throw new Error(errorData.message || 'Import failed');
        }

        const result = await response.json();
        console.log('✅ Frontend: API success response:', result);
        return result;
      } catch (error) {
        console.log('❌ Frontend: API call failed:', error);
        throw error;
      }
    },
    onSuccess: (result: ImportResult) => {
      console.log('✅ Frontend: Import successful, result:', result);
      setIsImporting(false);
      setImportProgress(100);
      
      toast({
        title: "Success",
        description: `Import completed! ${result.imported} products imported successfully.`,
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/seller/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      
      // Close dialog and reset state
      setIsImportDialogOpen(false);
      setSelectedFile(null);
      setValidationResult(null);
      setImportProgress(0);
      
      if (onImportComplete) {
        onImportComplete();
      }
    },
    onError: (error) => {
      console.log('❌ Frontend: Import failed, error:', error);
      setIsImporting(false);
      toast({
        title: "Error",
        description: `Import failed: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Export products mutation
  const exportProductsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/seller/excel/export?shopId=${activeShop.id}`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to export products');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products-export-${activeShop.displayName || activeShop.legalName}-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Products exported successfully!",
      });
      setIsExportDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to export products: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setValidationResult(null);
    }
  };

  const handleValidateFile = () => {
    if (!selectedFile) return;
    
    console.log('🔍 Frontend: Starting file validation for file:', selectedFile.name);
    setIsValidating(true);
    validateFileMutation.mutate(selectedFile);
  };

  const handleImportProducts = async () => {
    console.log('🔍 Frontend: handleImportProducts called');
    console.log('🔍 Frontend: validationResult:', validationResult);
    console.log('🔍 Frontend: validationResult.success:', validationResult?.success);
    
    if (!validationResult || !validationResult.success) {
      console.log('❌ Frontend: Cannot import - validation result:', validationResult);
      return;
    }
    
    console.log('🚀 Frontend: Starting import with validation result:', validationResult);
    console.log('🚀 Frontend: activeShop:', activeShop);
    console.log('🚀 Frontend: activeShop.id:', activeShop?.id);
    
    setIsImporting(true);
    setImportProgress(0);
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setImportProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);
    
    console.log('🚀 Frontend: Calling importProductsMutation.mutate...');
    importProductsMutation.mutate(validationResult);
  };

  const resetImportState = () => {
    setSelectedFile(null);
    setValidationResult(null);
    setIsValidating(false);
    setIsImporting(false);
    setImportProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (shopsLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
        <span className="text-sm">Loading shops...</span>
      </div>
    );
  }

  if (!activeShop || !activeShop.id) {
    return (
      <div className="flex items-center gap-2 text-amber-600">
        <FileSpreadsheet className="w-4 h-4" />
        <span className="text-sm">No valid shop selected for Excel operations</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => downloadTemplateMutation.mutate()}
        disabled={downloadTemplateMutation.isPending}
        className="flex items-center gap-2"
      >
        <Download className="w-4 h-4" />
        Download Template
      </Button>
      
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={resetImportState}
          >
            <Upload className="w-4 h-4" />
            Import Products
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Products from Excel/CSV</DialogTitle>
            <DialogDescription>
              Upload an Excel or CSV file to import products for {activeShop.displayName || activeShop.legalName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* File Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Excel or CSV File</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="w-full p-2 border rounded-md"
                disabled={isValidating || isImporting}
              />
              {selectedFile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileSpreadsheet className="w-4 h-4" />
                  {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}
            </div>

            {/* Validation Results */}
            {validationResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {validationResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                  )}
                  <span className="font-medium">
                    {validationResult.success ? 'Validation Successful' : 'Validation Completed with Errors'}
                  </span>
                  <Badge variant={validationResult.success ? 'default' : 'secondary'}>
                    {validationResult.imported} products
                  </Badge>
                </div>
                
                {validationResult.errors.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    <p className="text-sm font-medium text-red-600">Errors found:</p>
                    {validationResult.errors.slice(0, 10).map((error, index) => (
                      <div key={index} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                        Row {error.row}: {error.field} - {error.message}
                      </div>
                    ))}
                    {validationResult.errors.length > 10 && (
                      <p className="text-xs text-muted-foreground">
                        ... and {validationResult.errors.length - 10} more errors
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Import Progress */}
            {isImporting && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span className="text-sm">Importing products...</span>
                </div>
                <Progress value={importProgress} className="w-full" />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleValidateFile}
                disabled={!selectedFile || !activeShop?.id || isValidating || isImporting}
                className="flex items-center gap-2"
              >
                {isValidating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Validating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Validate File
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleImportProducts}
                disabled={!validationResult || !validationResult.success || isImporting}
                className="flex items-center gap-2"
              >
                {isImporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Import Products
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            disabled={exportProductsMutation.isPending}
          >
            <Download className="w-4 h-4" />
            Export Products
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Products to Excel</DialogTitle>
            <DialogDescription>
              Export all products from {activeShop.displayName || activeShop.legalName} to an Excel file
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertDescription>
                This will export all your products in a format that can be edited and re-imported.
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-2">
              <Button
                onClick={() => exportProductsMutation.mutate()}
                disabled={exportProductsMutation.isPending}
                className="flex items-center gap-2"
              >
                {exportProductsMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download Excel File
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
