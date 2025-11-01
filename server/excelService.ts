import * as XLSX from 'xlsx';
import { storage } from './storage';
import { insertProductSchema, insertServiceProviderSchema, insertGroceryProductSchema } from '@shared/schema';
import { z } from 'zod';

// Security: File upload validation
const ALLOWED_FILE_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv'
];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ROWS = 1000; // Limit to prevent abuse

// Excel row validation schema
const excelProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(255, 'Product name too long'),
  description: z.string().min(1, 'Description is required').max(2000, 'Description too long'),
  originalPrice: z.coerce.number().positive('Price must be positive'),
  minimumParticipants: z.coerce.number().int().min(1, 'Minimum participants must be at least 1'),
  maximumParticipants: z.coerce.number().int().min(1, 'Maximum participants must be at least 1'),
  offerValidTill: z.string().optional().refine((date) => {
    if (!date || date === '') return true; // Allow empty values
    const parsed = new Date(date);
    return !isNaN(parsed.getTime()) && parsed > new Date();
  }, 'Offer valid till must be a valid future date'),
  imageUrl: z.string().optional().refine((val) => {
    if (!val || val === '') return true;
    try {
      new URL(val);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid image URL'),
  subcategory: z.string().optional(),
  
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
          'subcategory',
          'serviceType',
          'isOnlineService',
          'serviceAddress',
          'serviceDescription'
        ];
        
        sampleData = [
          {
            name: 'Professional Car Detailing Service',
            description: 'Complete car detailing including wash, wax, and interior cleaning',
            originalPrice: 150,
            minimumParticipants: 5,
            maximumParticipants: 20,
            offerValidTill: '2025-12-31',
            imageUrl: 'https://example.com/car-detailing.jpg',
            subcategory: '',
            serviceType: 'Car Services',
            isOnlineService: false,
            serviceAddress: '123 Main St, Vancouver, BC',
            serviceDescription: 'Professional car detailing service with eco-friendly products'
          },
          {
            name: 'Mobile Car Oil Change',
            description: 'Convenient oil change service at your location',
            originalPrice: 80,
            minimumParticipants: 3,
            maximumParticipants: 15,
            offerValidTill: '',
            imageUrl: '',
            subcategory: '',
            serviceType: 'Car Services',
            isOnlineService: false,
            serviceAddress: 'Service area: Vancouver Metro',
            serviceDescription: 'Full synthetic oil change with filter replacement'
          }
        ];
      } else if (shopType === 'pet-essentials') {
        headers = [
          'name',
          'description',
          'originalPrice', 
          'minimumParticipants',
          'maximumParticipants',
          'offerValidTill',
          'imageUrl',
          'subcategory',
          'brand',
          'weight',
          'expiryDate',
          'nutritionalInfo'
        ];
        
        sampleData = [
          {
            name: 'Premium Dog Food - Chicken & Rice',
            description: 'High-quality dog food with real chicken and brown rice',
            originalPrice: 45,
            minimumParticipants: 10,
            maximumParticipants: 50,
            offerValidTill: '2025-12-31',
            imageUrl: '',
            subcategory: '',
            brand: 'PetPro',
            weight: '15kg',
            expiryDate: '2025-12-31',
            nutritionalInfo: 'Protein: 25%, Fat: 12%, Fiber: 4%'
          },
          {
            name: 'Cat Litter - Clumping',
            description: 'Premium clumping cat litter for easy cleanup',
            originalPrice: 25,
            minimumParticipants: 5,
            maximumParticipants: 30,
            offerValidTill: '',
            imageUrl: '',
            subcategory: '',
            brand: 'CatCare',
            weight: '10kg',
            expiryDate: '2026-12-31',
            nutritionalInfo: 'Non-toxic, dust-free formula'
          },
          {
            name: 'Dog Treats - Training Rewards',
            description: 'Small training treats for positive reinforcement',
            originalPrice: 12.99,
            minimumParticipants: 15,
            maximumParticipants: 80,
            offerValidTill: '2025-12-31',
            imageUrl: '',
            subcategory: '',
            brand: 'TrainWell',
            weight: '500g',
            expiryDate: '2026-06-30',
            nutritionalInfo: 'Low calorie, high protein'
          },
          {
            name: 'Cat Scratching Post',
            description: 'Multi-level cat scratching post with toys',
            originalPrice: 89.99,
            minimumParticipants: 3,
            maximumParticipants: 20,
            offerValidTill: '',
            imageUrl: '',
            subcategory: '',
            brand: 'CatHaven',
            weight: '15kg',
            expiryDate: '2027-12-31',
            nutritionalInfo: 'Sisal rope, carpeted platforms'
          }
        ];
      } else { // groceries
        headers = [
          'name',
          'description',
          'originalPrice',
          'minimumParticipants', 
          'maximumParticipants',
          'offerValidTill',
          'imageUrl',
          'subcategory',
          'brand',
          'weight',
          'expiryDate',
          'nutritionalInfo'
        ];
        
        // Sample data using actual grocery items from the CSV
        sampleData = [
          {
            name: 'Blue Bubble Hand Soap',
            description: 'Premium hand soap with blue bubble fragrance',
            originalPrice: 4.99,
            minimumParticipants: 10,
            maximumParticipants: 50,
            offerValidTill: '2025-12-31',
            imageUrl: '',
            subcategory: '',
            brand: 'Blue Bubble',
            weight: '500ml',
            expiryDate: '2026-12-31',
            nutritionalInfo: 'Gentle formula, pH balanced'
          },
          {
            name: 'Hellmanns Mayo',
            description: 'Classic mayonnaise for sandwiches and cooking',
            originalPrice: 6.99,
            minimumParticipants: 15,
            maximumParticipants: 80,
            offerValidTill: '',
            imageUrl: '',
            subcategory: '',
            brand: 'Hellmanns',
            weight: '890ml',
            expiryDate: '2025-10-15',
            nutritionalInfo: 'Made with real eggs, no artificial preservatives'
          },
          {
            name: 'Nescafe Original',
            description: 'Premium instant coffee blend',
            originalPrice: 7.49,
            minimumParticipants: 20,
            maximumParticipants: 100,
            offerValidTill: '2025-12-31',
            imageUrl: '',
            subcategory: '',
            brand: 'Nescafe',
            weight: '200g',
            expiryDate: '2026-06-30',
            nutritionalInfo: '100% pure coffee, no additives'
          },
          {
            name: 'Bounty Kitchen Towel 16 Pack',
            description: 'Super absorbent kitchen towels',
            originalPrice: 23.99,
            minimumParticipants: 5,
            maximumParticipants: 30,
            offerValidTill: '',
            imageUrl: '',
            subcategory: '',
            brand: 'Bounty',
            weight: '16 rolls',
            expiryDate: '2027-12-31',
            nutritionalInfo: '2-ply, extra absorbent'
          },
          {
            name: 'LX Sella XL Basmati Rice 20lb',
            description: 'Premium basmati rice, extra long grain',
            originalPrice: 22.99,
            minimumParticipants: 8,
            maximumParticipants: 40,
            offerValidTill: '2025-12-31',
            imageUrl: '',
            subcategory: '',
            brand: 'LX Sella',
            weight: '20lb',
            expiryDate: '2026-12-31',
            nutritionalInfo: 'Aged basmati rice, aromatic'
          }
        ];
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
      
      // Add store information sheet for groceries and pet-essentials
      if (shopType === 'groceries' || shopType === 'pet-essentials') {
        const storeInfo = [
          ['Store Information Template'],
          [''],
          ['Please fill in your store details below:'],
          [''],
          ['Field', 'Value', 'Description'],
          ['store_id', '', 'Unique store identifier (e.g., ST001)'],
          ['legal_name', '', 'Legal business name'],
          ['display_name', '', 'Display name for customers'],
          ['status', 'active', 'Store status: active, inactive, pending'],
          ['timezone', 'America/Vancouver', 'Store timezone'],
          ['currency', 'CAD', 'Currency code (CAD, USD, etc.)'],
          ['languages', 'en,fr', 'Supported languages (comma-separated)'],
          ['address_line_1', '', 'Street address line 1'],
          ['address_line_2', '', 'Street address line 2 (optional)'],
          ['locality', '', 'City/Town'],
          ['region', '', 'Province/State'],
          ['postal_code', '', 'Postal/ZIP code'],
          ['country', 'Canada', 'Country'],
          ['service_area', '', 'Service area description'],
          ['operating_hours', 'Mon-Fri 9AM-9PM, Sat-Sun 10AM-8PM', 'Store operating hours'],
          ['pickup_hours', 'Mon-Fri 9AM-9PM, Sat-Sun 10AM-8PM', 'Pickup hours'],
          ['delivery_hours', 'Mon-Fri 9AM-9PM, Sat-Sun 10AM-8PM', 'Delivery hours'],
          ['age_check', 'false', 'Age verification required (true/false)'],
          ['substitution_policy', 'allow', 'Substitution policy: allow, deny, ask'],
          ['refund_policy', '', 'Refund policy URL or description']
        ];
        
        const storeInfoWs = XLSX.utils.aoa_to_sheet(storeInfo);
        XLSX.utils.book_append_sheet(wb, storeInfoWs, 'Store Info');
      }
      
      // Add instructions sheet
      const instructions = [
        ['Instructions for Product Import'],
        [''],
        ['REQUIRED FIELDS (must be filled):'],
        ['- name: Product/service name'],
        ['- description: Product/service description'],
        ['- originalPrice: Price as number (e.g., 25.99)'],
        ['- minimumParticipants: Minimum group size (e.g., 5)'],
        ['- maximumParticipants: Maximum group size (e.g., 50)'],
        [''],
        ['OPTIONAL FIELDS (can be left empty):'],
        ['- offerValidTill: Offer expiry date (YYYY-MM-DD format) - defaults to 30 days from now'],
        ['- imageUrl: Product image URL (leave empty if no image)'],
        [''],
        ['CATEGORY-SPECIFIC FIELDS (optional):'],
        ...(shopType === 'services' ? [
          ['- serviceType: Type of service (e.g., "Car Services", "Home Services")'],
          ['- isOnlineService: true or false'],
          ['- serviceAddress: Physical address for in-person services'],
          ['- serviceDescription: Detailed service description']
        ] : [
          ['- brand: Product brand name'],
          ['- weight: Product weight/size (e.g., "2kg", "500ml")'],
          ['- expiryDate: Product expiry date (YYYY-MM-DD format)'],
          ['- nutritionalInfo: Nutritional information']
        ]),
        [''],
        ['IMPORTANT NOTES:'],
        ['- Date format: YYYY-MM-DD (e.g., 2025-12-31)'],
        ['- Price format: Numbers only (e.g., 25.99, not $25.99)'],
        ['- Maximum 1000 products allowed per file'],
        ['- Delete sample rows before adding your products'],
        ['- All dates must be in the future'],
        ...(shopType === 'groceries' ? [
          [''],
          ['GROCERY-SPECIFIC NOTES:'],
          ['- Sample products are based on actual grocery items from our inventory'],
          ['- Use the Store Info sheet to provide your store details'],
          ['- All grocery items must have proper expiry dates'],
          ['- Weight/size information is required for proper inventory management']
        ] : shopType === 'pet-essentials' ? [
          [''],
          ['PET ESSENTIALS-SPECIFIC NOTES:'],
          ['- Sample products include food, treats, and accessories'],
          ['- Use the Store Info sheet to provide your store details'],
          ['- Pet food items must have proper expiry dates'],
          ['- Weight/size information is required for proper inventory management'],
          ['- Nutritional information is important for pet food products']
        ] : [])
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
   * Convert grocery CSV format to expected Excel template format
   */
  static convertGroceryCSVToExpectedFormat(headers: string[], rows: any[][]): { headers: string[], rows: any[][] } {
    // Expected headers for the Excel template
    const expectedHeaders = [
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

    // Map CSV headers to expected headers
    const headerMap: { [key: string]: string } = {};
    headers.forEach((header, index) => {
      if (header) {
        const lowerHeader = header.toLowerCase().trim();
        if (lowerHeader.includes('item name')) {
          headerMap['name'] = header;
        } else if (lowerHeader.includes('retail price')) {
          headerMap['originalPrice'] = header;
        } else if (lowerHeader.includes('category')) {
          headerMap['brand'] = header; // Use category as brand for now
        } else if (lowerHeader.includes('size')) {
          headerMap['weight'] = header;
        } else if (lowerHeader.includes('upc')) {
          headerMap['nutritionalInfo'] = header; // Use UPC as additional info
        }
      }
    });

    // Convert rows to expected format, filtering for valid items only
    const convertedRows = rows
      .filter(row => {
        // Only process rows with valid item name and price
        const itemNameIndex = headers.findIndex(h => h && h.toLowerCase().includes('item name'));
        const priceIndex = headers.findIndex(h => h && h.toLowerCase().includes('retail price'));
        const itemName = itemNameIndex >= 0 ? row[itemNameIndex] : '';
        const price = priceIndex >= 0 ? row[priceIndex] : '';
        return itemName && price && price !== '' && price !== 0;
      })
      .map(row => {
        const convertedRow: any[] = [];
        
        expectedHeaders.forEach(expectedHeader => {
          if (expectedHeader === 'name') {
            // Use Item Name as name
            const itemNameIndex = headers.findIndex(h => h && h.toLowerCase().includes('item name'));
            convertedRow.push(itemNameIndex >= 0 ? row[itemNameIndex] || '' : '');
          } else if (expectedHeader === 'description') {
            // Use Item Name as description (can be enhanced later)
            const itemNameIndex = headers.findIndex(h => h && h.toLowerCase().includes('item name'));
            convertedRow.push(itemNameIndex >= 0 ? row[itemNameIndex] || '' : '');
          } else if (expectedHeader === 'originalPrice') {
            // Use Retail Price as originalPrice
            const priceIndex = headers.findIndex(h => h && h.toLowerCase().includes('retail price'));
            convertedRow.push(priceIndex >= 0 ? row[priceIndex] || '0' : '0');
          } else if (expectedHeader === 'minimumParticipants') {
            // Default minimum participants
            convertedRow.push('10');
          } else if (expectedHeader === 'maximumParticipants') {
            // Default maximum participants
            convertedRow.push('50');
          } else if (expectedHeader === 'offerValidTill') {
            // Default offer valid till (30 days from now)
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30);
            convertedRow.push(futureDate.toISOString().split('T')[0]);
          } else if (expectedHeader === 'imageUrl') {
            // Use Primary Image URL or Backup Image URL
            const primaryImageIndex = headers.findIndex(h => h && h.toLowerCase().includes('primary image'));
            const backupImageIndex = headers.findIndex(h => h && h.toLowerCase().includes('backup image'));
            const imageUrl = (primaryImageIndex >= 0 && row[primaryImageIndex]) ? row[primaryImageIndex] : 
                           (backupImageIndex >= 0 && row[backupImageIndex]) ? row[backupImageIndex] : '';
            convertedRow.push(imageUrl);
          } else if (expectedHeader === 'brand') {
            // Use Category as brand
            const categoryIndex = headers.findIndex(h => h && h.toLowerCase().includes('category'));
            convertedRow.push(categoryIndex >= 0 ? row[categoryIndex] || '' : '');
          } else if (expectedHeader === 'weight') {
            // Use Size as weight
            const sizeIndex = headers.findIndex(h => h && h.toLowerCase().includes('size'));
            convertedRow.push(sizeIndex >= 0 ? row[sizeIndex] || '' : '');
          } else if (expectedHeader === 'expiryDate') {
            // Default expiry date (1 year from now)
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);
            convertedRow.push(futureDate.toISOString().split('T')[0]);
          } else if (expectedHeader === 'nutritionalInfo') {
            // Use UPC as additional info
            const upcIndex = headers.findIndex(h => h && h.toLowerCase().includes('upc'));
            convertedRow.push(upcIndex >= 0 ? `UPC: ${row[upcIndex] || ''}` : '');
          } else {
            convertedRow.push('');
          }
        });
        
        return convertedRow;
      });

    return {
      headers: expectedHeaders,
      rows: convertedRows
    };
  }

  /**
   * Validate uploaded Excel file
   */
  static validateFile(file: Express.Multer.File): void {
    // Check if it's a CSV file by extension or MIME type
    const isCSV = file.originalname.toLowerCase().endsWith('.csv') || 
                  file.mimetype === 'text/csv' || 
                  file.mimetype === 'application/csv';

    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.mimetype) && !isCSV) {
      throw new Error('Invalid file type. Only Excel files (.xlsx, .xls) and CSV files (.csv) are allowed.');
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
      console.log('🔍 Starting Excel parsing for seller:', sellerId, 'shop:', shopId);
      
      // Validate file
      this.validateFile(file);
      console.log('✅ File validation passed');

      // Read Excel/CSV file with error handling
      let workbook;
      try {
        // Check if it's a CSV file
        const isCSV = file.originalname.toLowerCase().endsWith('.csv') || 
                      file.mimetype === 'text/csv' || 
                      file.mimetype === 'application/csv';
        
        if (isCSV) {
          // For CSV files, read as string first
          const csvString = file.buffer.toString('utf-8');
          workbook = XLSX.read(csvString, { type: 'string' });
          console.log('✅ CSV file read successfully');
        } else {
          // For Excel files, read as buffer
          workbook = XLSX.read(file.buffer, { type: 'buffer' });
          console.log('✅ Excel file read successfully');
        }
      } catch (excelError) {
        console.error('❌ File parsing error:', excelError);
        throw new Error('Invalid file format. Please ensure the file is a valid .xlsx, .xls, or .csv file.');
      }

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('File contains no data sheets.');
      }

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      if (!worksheet) {
        throw new Error('First worksheet is empty or corrupted.');
      }
      
      // Convert to JSON with error handling
      let data;
      try {
        data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        console.log('✅ Excel data converted to JSON');
      } catch (jsonError) {
        console.error('❌ JSON conversion error:', jsonError);
        throw new Error('Failed to parse Excel data. Please check the file format.');
      }
      
      if (!data || !Array.isArray(data)) {
        throw new Error('Excel file contains no data.');
      }

      if (data.length < 2) {
        throw new Error('Excel file must contain at least a header row and one data row.');
      }

      // Check row limit
      if (data.length > MAX_ROWS + 1) { // +1 for header
        throw new Error(`Too many rows. Maximum ${MAX_ROWS} products allowed.`);
      }

      // Get headers and data rows
      let headers = data[0] as string[];
      let rows = data.slice(1) as any[][];
      
      if (!headers || headers.length === 0) {
        throw new Error('File has no headers.');
      }
      
      // Check if this is a grocery inventory format (CSV or Excel)
      console.log('🔍 Checking headers for grocery format:', headers.slice(0, 10));
      const isGroceryInventoryFormat = headers.some(h => {
        if (!h) return false;
        const lower = String(h).toLowerCase();
        const matches = lower.includes('item name') || 
                       lower.includes('retail price') ||
                       lower.includes('primary image');
        if (matches) console.log(`✅ Found grocery header: "${h}"`);
        return matches;
      });
      
      console.log('🔍 Is grocery format?', isGroceryInventoryFormat);
      
      if (isGroceryInventoryFormat) {
        console.log('🛒 Detected grocery inventory format, converting...');
        // Convert grocery inventory format to expected format
        const convertedData = this.convertGroceryCSVToExpectedFormat(headers, rows);
        console.log('📋 Converted headers:', convertedData.headers);
        console.log('📋 Converted rows sample:', convertedData.rows.slice(0, 2));
        headers = convertedData.headers;
        rows = convertedData.rows;
      }
      
      console.log('📊 File parsed successfully:');
      console.log('Headers:', headers);
      console.log('Number of rows:', rows.length);
      console.log('First few rows:', rows.slice(0, 3));

      // Get seller's shop info for validation
      const shops = await storage.getSellerShopsBySeller(sellerId);
      const shop = shops.find(s => s.id === shopId);
      if (!shop) {
        throw new Error('Shop not found or access denied.');
      }

      const shopType = shop.shopType;
      const categoryId = shopType === 'services' ? 2 : shopType === 'pet-essentials' ? 3 : 1;

      // Fetch subcategories for the category
      const subcategories = await storage.getSubcategoriesByCategory(categoryId);
      const subcategoryMap = new Map<string, number>();
      subcategories.forEach((sub: any) => {
        subcategoryMap.set(sub.name.toLowerCase().trim(), sub.id);
      });

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

          // Map subcategory name to ID if provided
          let subcategoryId = null;
          if (validatedData.subcategory && validatedData.subcategory.trim()) {
            const subcatLower = validatedData.subcategory.toLowerCase().trim();
            if (subcategoryMap.has(subcatLower)) {
              subcategoryId = subcategoryMap.get(subcatLower);
            } else {
              errors.push({
                row: rowNumber,
                field: 'subcategory',
                message: `Subcategory "${validatedData.subcategory}" not found. Available subcategories: ${Array.from(subcategoryMap.keys()).join(', ')}`
              });
            }
          }

          // Create product data
          const productData = {
            sellerId,
            categoryId,
            subcategoryId,
            name: validatedData.name,
            description: validatedData.description,
            originalPrice: validatedData.originalPrice,
            minimumParticipants: validatedData.minimumParticipants,
            maximumParticipants: validatedData.maximumParticipants,
            offerValidTill: validatedData.offerValidTill ? new Date(validatedData.offerValidTill) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default to 30 days from now
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

      console.log('📋 Validation Summary:');
      console.log('Total rows processed:', rows.length);
      console.log('Products validated successfully:', products.length);
      console.log('Errors found:', errors.length);
      if (errors.length > 0) {
        console.log('Error details:', errors);
      }

      return {
        success: errors.length === 0,
        message: errors.length === 0 
          ? `Successfully validated ${products.length} products` 
          : `Validation completed with ${errors.length} errors`,
        imported: products.length,
        errors,
        products: products
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
          'subcategory',
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
          subcategory: product.subcategory?.name || '',
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
          'subcategory',
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
          subcategory: product.subcategory?.name || '',
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
          'subcategory',
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
          subcategory: product.subcategory?.name || '',
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
      console.log('🚀 Starting import process...');
      console.log('Validated data success:', validatedData.success);
      console.log('Number of products to import:', validatedData.products.length);
      
      if (!validatedData.success) {
        throw new Error('Cannot import products with validation errors');
      }

      let imported = 0;
      let failed = 0;

      for (const productInfo of validatedData.products) {
        try {
          console.log(`📦 Importing product: ${productInfo.product.name}`);
          
          // Fix offerValidTill - convert string to Date object
          const productData = {
            ...productInfo.product,
            offerValidTill: new Date(productInfo.product.offerValidTill)
          };
          
          // Create product
          const product = await storage.createProduct(productData);
          console.log('✅ Product created successfully:', product.id);

          // Create category-specific data
          const categorySpecificData = productInfo.categorySpecific;
          
          if (categorySpecificData) {
            if (productInfo.product.categoryId === 2) {
              // Service provider
              await storage.createServiceProvider({
                productId: product.id!,
                ...categorySpecificData
              });
            } else if (productInfo.product.categoryId === 1 || productInfo.product.categoryId === 3) {
              // Grocery product
              // Fix expiryDate - convert null to undefined or a valid date
              const groceryData = {
                ...categorySpecificData,
                expiryDate: categorySpecificData.expiryDate || undefined
              };
              await storage.createGroceryProduct({
                productId: product.id!,
                ...groceryData
              });
              console.log('✅ Grocery product created successfully');
            }
          }

          imported++;
          console.log(`✅ Successfully imported: ${productInfo.product.name}`);
        } catch (error) {
          console.error(`❌ Failed to import product: ${productInfo.product.name}`);
          console.error('Error details:', error);
          console.error('Product data that failed:', productInfo);
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
