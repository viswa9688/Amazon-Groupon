import * as XLSX from 'xlsx';
import { storage } from './storage';
import { insertProductSchema, insertServiceProviderSchema, insertGroceryProductSchema } from '@shared/schema';
import { z } from 'zod';

// Security: File upload validation
const ALLOWED_FILE_TYPES = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ROWS = 1000; // Limit to prevent abuse

// Excel row validation schema
const excelProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(255, 'Product name too long'),
  description: z.string().min(1, 'Description is required').max(2000, 'Description too long'),
  originalPrice: z.coerce.number().positive('Price must be positive'),
  minimumParticipants: z.coerce.number().int().min(1, 'Minimum participants must be at least 1'),
  maximumParticipants: z.coerce.number().int().min(1, 'Maximum participants must be at least 1'),
  offerValidTill: z.string().refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime()) && parsed > new Date();
  }, 'Offer valid till must be a valid future date'),
  imageUrl: z.string().url('Invalid image URL').optional().or(z.literal('')),
  
  // Service-specific fields (for Services category)
  serviceType: z.string().optional(),
  isOnlineService: z.coerce.boolean().optional(),
  serviceAddress: z.string().optional(),
  serviceDescription: z.string().optional(),
  
  // Grocery-specific fields (for Groceries/Pet Essentials)
  brand: z.string().optional(),
  weight: z.string().optional(),
  expiryDate: z.string().optional(),
  nutritionalInfo: z.string().optional(),
  
  // Discount tiers (JSON string)
  discountTiers: z.string().optional(),
});

export interface ExcelImportResult {
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

export class ExcelService {
  /**
   * Generate Excel template for seller based on their shop type
   */
  static async generateTemplate(sellerId: string): Promise<Buffer> {
    try {
      // Get seller's shops to determine shop type
      const shops = await storage.getSellerShopsBySeller(sellerId);
      if (!shops || shops.length === 0) {
        throw new Error('No shops found for seller');
      }

      const shop = shops[0]; // Use first shop
      const shopType = shop.shopType;

      // Define headers based on shop type
      let headers: string[] = [];
      let sampleData: any[] = [];

      if (shopType === 'services') {
        headers = [
          'name',
          'description', 
          'originalPrice',
          'minimumParticipants',
          'maximumParticipants',
          'offerValidTill',
          'imageUrl',
          'serviceType',
          'isOnlineService',
          'serviceAddress',
          'serviceDescription'
        ];
        
        sampleData = [{
          name: 'Professional Car Detailing Service',
          description: 'Complete car detailing including wash, wax, and interior cleaning',
          originalPrice: 150,
          minimumParticipants: 5,
          maximumParticipants: 20,
          offerValidTill: '2024-12-31',
          imageUrl: 'https://example.com/car-detailing.jpg',
          serviceType: 'Car Services',
          isOnlineService: false,
          serviceAddress: '123 Main St, Vancouver, BC',
          serviceDescription: 'Professional car detailing service with eco-friendly products'
        }];
      } else if (shopType === 'pet-essentials') {
        headers = [
          'name',
          'description',
          'originalPrice', 
          'minimumParticipants',
          'maximumParticipants',
          'offerValidTill',
          'imageUrl',
          'brand',
          'weight',
          'expiryDate',
          'nutritionalInfo'
        ];
        
        sampleData = [{
          name: 'Premium Dog Food - Chicken & Rice',
          description: 'High-quality dog food with real chicken and brown rice',
          originalPrice: 45,
          minimumParticipants: 10,
          maximumParticipants: 50,
          offerValidTill: '2024-12-31',
          imageUrl: 'https://example.com/dog-food.jpg',
          brand: 'PetPro',
          weight: '15kg',
          expiryDate: '2025-12-31',
          nutritionalInfo: 'Protein: 25%, Fat: 12%, Fiber: 4%'
        }];
      } else { // groceries
        headers = [
          'name',
          'description',
          'originalPrice',
          'minimumParticipants', 
          'maximumParticipants',
          'offerValidTill',
          'imageUrl',
          'brand',
          'weight',
          'expiryDate',
          'nutritionalInfo'
        ];
        
        sampleData = [{
          name: 'Organic Bananas - Bunch',
          description: 'Fresh organic bananas, perfect for healthy snacking',
          originalPrice: 8,
          minimumParticipants: 20,
          maximumParticipants: 100,
          offerValidTill: '2024-12-31',
          imageUrl: 'https://example.com/bananas.jpg',
          brand: 'Organic Farms',
          weight: '2kg',
          expiryDate: '2024-12-15',
          nutritionalInfo: 'Calories: 89 per 100g, Potassium: 358mg'
        }];
      }

      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Convert sample data objects to arrays that match headers
      const sampleDataArrays = sampleData.map(item => 
        headers.map(header => item[header] || '')
      );
      
      // Create worksheet with headers and sample data
      const wsData = [headers, ...sampleDataArrays];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Add instructions sheet
      const instructions = [
        ['Instructions for Product Import'],
        [''],
        ['1. Fill in the product details in the columns below'],
        ['2. Required fields: name, description, originalPrice, minimumParticipants, maximumParticipants, offerValidTill'],
        ['3. Optional fields: imageUrl, and category-specific fields'],
        ['4. Date format: YYYY-MM-DD'],
        ['5. Price format: Numbers only (no currency symbols)'],
        ['6. Maximum 1000 rows allowed'],
        [''],
        ['Category-specific fields:'],
        ...(shopType === 'services' ? [
          ['- serviceType: Type of service (e.g., "Car Services", "Home Services")'],
          ['- isOnlineService: true/false'],
          ['- serviceAddress: Physical address for in-person services'],
          ['- serviceDescription: Detailed service description']
        ] : [
          ['- brand: Product brand name'],
          ['- weight: Product weight/size'],
          ['- expiryDate: Product expiry date (YYYY-MM-DD)'],
          ['- nutritionalInfo: Nutritional information']
        ])
      ];
      
      const instructionsWs = XLSX.utils.aoa_to_sheet(instructions);
      
      // Add sheets to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Products');
      XLSX.utils.book_append_sheet(wb, instructionsWs, 'Instructions');
      
      // Generate buffer
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      return buffer;
    } catch (error) {
      console.error('Error generating Excel template:', error);
      throw new Error('Failed to generate Excel template');
    }
  }

  /**
   * Validate uploaded Excel file
   */
  static validateFile(file: Express.Multer.File): void {
    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      throw new Error('Invalid file type. Only Excel files (.xlsx, .xls) are allowed.');
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size allowed is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
    }

    // Check if file is empty
    if (file.size === 0) {
      throw new Error('File is empty.');
    }
  }

  /**
   * Parse and validate Excel data
   */
  static async parseExcelData(
    file: Express.Multer.File, 
    sellerId: string,
    shopId: string
  ): Promise<ExcelImportResult> {
    try {
      // Validate file
      this.validateFile(file);

      // Read Excel file
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (data.length < 2) {
        throw new Error('Excel file must contain at least a header row and one data row.');
      }

      // Check row limit
      if (data.length > MAX_ROWS + 1) { // +1 for header
        throw new Error(`Too many rows. Maximum ${MAX_ROWS} products allowed.`);
      }

      // Get headers and data rows
      const headers = data[0] as string[];
      const rows = data.slice(1) as any[][];

      // Get seller's shop info for validation
      const shops = await storage.getSellerShopsBySeller(sellerId);
      const shop = shops.find(s => s.id === shopId);
      if (!shop) {
        throw new Error('Shop not found or access denied.');
      }

      const shopType = shop.shopType;
      const categoryId = shopType === 'services' ? 2 : shopType === 'pet-essentials' ? 3 : 1;

      // Validate and process each row
      const errors: Array<{ row: number; field: string; message: string }> = [];
      const products: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2; // +2 because Excel is 1-indexed and we skip header

        try {
          // Convert row to object
          const rowData: any = {};
          headers.forEach((header, index) => {
            rowData[header] = row[index] || '';
          });

          // Validate row data
          const validatedData = excelProductSchema.parse(rowData);

          // Create product data
          const productData = {
            sellerId,
            categoryId,
            name: validatedData.name,
            description: validatedData.description,
            originalPrice: validatedData.originalPrice,
            minimumParticipants: validatedData.minimumParticipants,
            maximumParticipants: validatedData.maximumParticipants,
            offerValidTill: new Date(validatedData.offerValidTill),
            imageUrl: validatedData.imageUrl || null,
            isActive: true,
          };

          // Add category-specific data
          let categorySpecificData = null;
          if (categoryId === 2 && shopType === 'services') {
            categorySpecificData = {
              serviceType: validatedData.serviceType || 'General Services',
              isOnlineService: validatedData.isOnlineService || false,
              serviceAddress: validatedData.serviceAddress || '',
              serviceDescription: validatedData.serviceDescription || validatedData.description,
            };
          } else if ((categoryId === 1 || categoryId === 3) && (shopType === 'groceries' || shopType === 'pet-essentials')) {
            categorySpecificData = {
              brand: validatedData.brand || '',
              weight: validatedData.weight || '',
              expiryDate: validatedData.expiryDate ? new Date(validatedData.expiryDate) : null,
              nutritionalInfo: validatedData.nutritionalInfo || '',
            };
          }

          products.push({
            product: productData,
            categorySpecific: categorySpecificData,
            rowNumber
          });

        } catch (error) {
          if (error instanceof z.ZodError) {
            error.errors.forEach(err => {
              errors.push({
                row: rowNumber,
                field: err.path.join('.'),
                message: err.message
              });
            });
          } else {
            errors.push({
              row: rowNumber,
              field: 'general',
              message: `Row validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
          }
        }
      }

      return {
        success: errors.length === 0,
        message: errors.length === 0 
          ? `Successfully validated ${products.length} products` 
          : `Validation completed with ${errors.length} errors`,
        imported: products.length,
        errors,
        products: products.map(p => p.product)
      };

    } catch (error) {
      console.error('Error parsing Excel data:', error);
      throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate Excel export for existing products
   */
  static async generateExport(products: any[], shop: any): Promise<Buffer> {
    try {
      // Define headers based on shop type
      let headers: string[] = [];
      let exportData: any[] = [];

      const shopType = shop.shopType;

      if (shopType === 'services') {
        headers = [
          'name',
          'description', 
          'originalPrice',
          'minimumParticipants',
          'maximumParticipants',
          'offerValidTill',
          'imageUrl',
          'serviceType',
          'isOnlineService',
          'serviceAddress',
          'serviceDescription'
        ];
        
        exportData = products.map(product => ({
          name: product.name,
          description: product.description,
          originalPrice: product.originalPrice,
          minimumParticipants: product.minimumParticipants,
          maximumParticipants: product.maximumParticipants,
          offerValidTill: product.offerValidTill ? new Date(product.offerValidTill).toISOString().split('T')[0] : '',
          imageUrl: product.imageUrl || '',
          serviceType: product.serviceProvider?.serviceType || '',
          isOnlineService: product.serviceProvider?.isOnlineService || false,
          serviceAddress: product.serviceProvider?.serviceAddress || '',
          serviceDescription: product.serviceProvider?.serviceDescription || ''
        }));
      } else if (shopType === 'pet-essentials') {
        headers = [
          'name',
          'description',
          'originalPrice', 
          'minimumParticipants',
          'maximumParticipants',
          'offerValidTill',
          'imageUrl',
          'brand',
          'weight',
          'expiryDate',
          'nutritionalInfo'
        ];
        
        exportData = products.map(product => ({
          name: product.name,
          description: product.description,
          originalPrice: product.originalPrice,
          minimumParticipants: product.minimumParticipants,
          maximumParticipants: product.maximumParticipants,
          offerValidTill: product.offerValidTill ? new Date(product.offerValidTill).toISOString().split('T')[0] : '',
          imageUrl: product.imageUrl || '',
          brand: product.groceryProduct?.brand || '',
          weight: product.groceryProduct?.weight || '',
          expiryDate: product.groceryProduct?.expiryDate ? new Date(product.groceryProduct.expiryDate).toISOString().split('T')[0] : '',
          nutritionalInfo: product.groceryProduct?.nutritionalInfo || ''
        }));
      } else { // groceries
        headers = [
          'name',
          'description',
          'originalPrice',
          'minimumParticipants', 
          'maximumParticipants',
          'offerValidTill',
          'imageUrl',
          'brand',
          'weight',
          'expiryDate',
          'nutritionalInfo'
        ];
        
        exportData = products.map(product => ({
          name: product.name,
          description: product.description,
          originalPrice: product.originalPrice,
          minimumParticipants: product.minimumParticipants,
          maximumParticipants: product.maximumParticipants,
          offerValidTill: product.offerValidTill ? new Date(product.offerValidTill).toISOString().split('T')[0] : '',
          imageUrl: product.imageUrl || '',
          brand: product.groceryProduct?.brand || '',
          weight: product.groceryProduct?.weight || '',
          expiryDate: product.groceryProduct?.expiryDate ? new Date(product.groceryProduct.expiryDate).toISOString().split('T')[0] : '',
          nutritionalInfo: product.groceryProduct?.nutritionalInfo || ''
        }));
      }

      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Convert export data objects to arrays that match headers
      const exportDataArrays = exportData.map(item => 
        headers.map(header => item[header] || '')
      );
      
      // Create worksheet with headers and data
      const wsData = [headers, ...exportDataArrays];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Add sheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Products');
      
      // Generate buffer
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      return buffer;
    } catch (error) {
      console.error('Error generating Excel export:', error);
      throw new Error('Failed to generate Excel export');
    }
  }

  /**
   * Import products from validated Excel data
   */
  static async importProducts(
    validatedData: ExcelImportResult,
    sellerId: string,
    shopId: string
  ): Promise<{ success: boolean; message: string; imported: number; failed: number }> {
    try {
      if (!validatedData.success) {
        throw new Error('Cannot import products with validation errors');
      }

      let imported = 0;
      let failed = 0;

      for (const productInfo of validatedData.products) {
        try {
          // Create product
          const product = await storage.createProduct(productInfo.product);

      // Create category-specific data
      const productWithCategoryData = (validatedData as any).products.find((p: any) => p.product === productInfo);
      const categorySpecificData = productWithCategoryData?.categorySpecific;
          
          if (categorySpecificData) {
            if (productInfo.categoryId === 2) {
              // Service provider
              await storage.createServiceProvider({
                productId: product.id!,
                ...categorySpecificData
              });
            } else if (productInfo.categoryId === 1 || productInfo.categoryId === 3) {
              // Grocery product
              await storage.createGroceryProduct({
                productId: product.id!,
                ...categorySpecificData
              });
            }
          }

          imported++;
        } catch (error) {
          console.error(`Failed to import product: ${productInfo.name}`, error);
          failed++;
        }
      }

      return {
        success: true,
        message: `Successfully imported ${imported} products. ${failed} failed.`,
        imported,
        failed
      };

    } catch (error) {
      console.error('Error importing products:', error);
      throw new Error(`Failed to import products: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
