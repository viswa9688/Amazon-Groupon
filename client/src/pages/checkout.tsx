import { useRoute } from "wouter";
import UnifiedCheckout from "@/components/UnifiedCheckout";

// Parse URL and query parameters to determine checkout type
const parseCheckoutData = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const pathMatch = window.location.pathname.match(/\/checkout\/(\d+)\/(\w+)/);
  
  if (pathMatch) {
    // Route-based checkout: /checkout/:productId/:type
    return {
      type: pathMatch[2] as 'individual' | 'group',
      productId: parseInt(pathMatch[1])
    };
  } else {
    // Query-based checkout: ?productId=...&type=... or ?group=...&member=...
    const productId = urlParams.get('productId');
    const type = urlParams.get('type');
    const group = urlParams.get('group');
    const member = urlParams.get('member');
    
    if (group && member) {
      // Group payment with share token
      return {
        type: 'group' as const,
        groupToken: group,
        memberId: member
      };
    } else if (productId && type) {
      // Individual or group payment with product ID
      return {
        type: type as 'individual' | 'group',
        productId: parseInt(productId)
      };
    }
  }
  
  return null;
};

export default function Checkout() {
  const [match, params] = useRoute("/checkout/:productId/:type");
  const checkoutData = parseCheckoutData();

  if (!checkoutData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center py-20">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Invalid Checkout URL</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                The checkout URL is invalid or missing required parameters.
              </p>
              <a 
                href="/browse" 
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Browse Products
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <UnifiedCheckout checkoutData={checkoutData} />;
}
