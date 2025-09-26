import { apiRequest } from './queryClient';

export interface AddressValidationResult {
  isValid: boolean;
  formattedAddress?: string;
  province?: string;
  confidence?: number;
  error?: string;
}

export interface AddressData {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * Validate if an address is in British Columbia using the geocoding API
 */
export async function validateBCAddress(address: AddressData): Promise<AddressValidationResult> {
  try {
    console.log('Sending address validation request:', address);
    const response = await apiRequest('POST', '/api/validate-address', address);
    const result = await response.json() as AddressValidationResult;
    console.log('Received validation response:', result);
    return result;
  } catch (error) {
    console.error('Address validation error:', error);
    return {
      isValid: false,
      error: 'Failed to validate address. Please check your internet connection and try again.'
    };
  }
}

/**
 * Format address data for display
 */
export function formatAddressForDisplay(address: AddressData): string {
  const parts = [
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.state,
    address.postalCode,
    address.country
  ].filter(Boolean);
  
  return parts.join(', ');
}

/**
 * Check if address data looks like it might be BC (basic validation)
 */
export function isLikelyBCAddress(address: AddressData): boolean {
  const bcProvinceNames = ['British Columbia', 'BC', 'Colombie-Britannique', 'Colombie Britannique'];
  return bcProvinceNames.some(name => 
    address.state?.toLowerCase().includes(name.toLowerCase())
  );
}
