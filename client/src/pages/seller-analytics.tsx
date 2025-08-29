import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import Header from "@/components/Header";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  Users, 
  ShoppingCart,
  BarChart3,
  LineChart,
  PieChart,
  Calendar as CalendarIcon,
  Download,
  Filter
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

interface AnalyticsData {
  // Revenue Analytics
  totalRevenue: number;
  revenueGrowth: number;
  monthlyRevenue: Array<{ month: string; revenue: number }>;
  dailyRevenue: Array<{ date: string; revenue: number }>;
  
  // Sales Analytics  
  totalOrders: number;
  ordersGrowth: number;
  averageOrderValue: number;
  conversionRate: number;
  
  // Product Performance
  topProducts: Array<{
    id: number;
    name: string;
    revenue: number;
    orders: number;
    growth: number;
  }>;
  productCategories: Array<{
    category: string;
    revenue: number;
    percentage: number;
  }>;
  
  // Customer Insights
  totalCustomers: number;
  newCustomers: number;
  repeatCustomers: number;
  customerLifetimeValue: number;
  
  // Order Status Distribution
  orderStatuses: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
}

const dateRangeOptions = [
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "Last 90 Days", value: "90d" },
  { label: "This Month", value: "month" },
  { label: "Last Month", value: "lastMonth" },
  { label: "This Year", value: "year" },
  { label: "Custom Range", value: "custom" }
];

export default function SellerAnalytics() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState("30d");
  const [customDateFrom, setCustomDateFrom] = useState<Date>();
  const [customDateTo, setCustomDateTo] = useState<Date>();
  const [showCustomCalendar, setShowCustomCalendar] = useState(false);

  // Redirect if not authenticated
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

  // Calculate date range for API call
  const getDateRangeParams = () => {
    const now = new Date();
    let startDate: Date;
    let endDate = now;

    switch (dateRange) {
      case "7d":
        startDate = subDays(now, 7);
        break;
      case "30d":
        startDate = subDays(now, 30);
        break;
      case "90d":
        startDate = subDays(now, 90);
        break;
      case "month":
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case "lastMonth":
        const lastMonth = subDays(startOfMonth(now), 1);
        startDate = startOfMonth(lastMonth);
        endDate = endOfMonth(lastMonth);
        break;
      case "year":
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      case "custom":
        if (customDateFrom && customDateTo) {
          startDate = customDateFrom;
          endDate = customDateTo;
        } else {
          startDate = subDays(now, 30);
        }
        break;
      default:
        startDate = subDays(now, 30);
    }

    return {
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd")
    };
  };

  // Fetch analytics data
  const { data: analytics, isLoading: analyticsLoading, error } = useQuery<AnalyticsData>({
    queryKey: ["/api/seller/analytics", dateRange, customDateFrom, customDateTo],
    enabled: isAuthenticated,
    retry: false,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatPercentage = (value: number) => 
    `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="text-analytics-title">
              Analytics Dashboard
            </h1>
            <p className="text-muted-foreground">
              Comprehensive insights into your business performance
            </p>
          </div>
          
          {/* Date Range Selector */}
          <div className="flex items-center gap-3">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-48" data-testid="select-date-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateRangeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {dateRange === "custom" && (
              <Popover open={showCustomCalendar} onOpenChange={setShowCustomCalendar}>
                <PopoverTrigger asChild>
                  <Button variant="outline" data-testid="button-custom-date">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {customDateFrom && customDateTo 
                      ? `${format(customDateFrom, "MMM dd")} - ${format(customDateTo, "MMM dd")}` 
                      : "Select dates"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <div className="p-4 space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">From</label>
                      <Calendar
                        mode="single"
                        selected={customDateFrom}
                        onSelect={setCustomDateFrom}
                        className="rounded-md border"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">To</label>
                      <Calendar
                        mode="single"
                        selected={customDateTo}
                        onSelect={setCustomDateTo}
                        className="rounded-md border"
                      />
                    </div>
                    <Button 
                      onClick={() => setShowCustomCalendar(false)}
                      className="w-full"
                    >
                      Apply Date Range
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            
            <Button variant="outline" data-testid="button-export">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-revenue">
                    {analyticsLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : (
                      formatCurrency(analytics?.totalRevenue || 0)
                    )}
                  </p>
                  {!analyticsLoading && analytics && (
                    <div className="flex items-center mt-2">
                      {analytics.revenueGrowth >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
                      )}
                      <span className={`text-sm font-medium ${
                        analytics.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatPercentage(analytics.revenueGrowth)}
                      </span>
                    </div>
                  )}
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-orders">
                    {analyticsLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      analytics?.totalOrders || 0
                    )}
                  </p>
                  {!analyticsLoading && analytics && (
                    <div className="flex items-center mt-2">
                      {analytics.ordersGrowth >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-blue-600 mr-1" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
                      )}
                      <span className={`text-sm font-medium ${
                        analytics.ordersGrowth >= 0 ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {formatPercentage(analytics.ordersGrowth)}
                      </span>
                    </div>
                  )}
                </div>
                <ShoppingCart className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg. Order Value</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-avg-order">
                    {analyticsLoading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      formatCurrency(analytics?.averageOrderValue || 0)
                    )}
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Customers</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-customers">
                    {analyticsLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      analytics?.totalCustomers || 0
                    )}
                  </p>
                  {!analyticsLoading && analytics && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {analytics.newCustomers} new this period
                    </p>
                  )}
                </div>
                <Users className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Products
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="trends" className="flex items-center gap-2">
              <LineChart className="w-4 h-4" />
              Trends
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Chart Placeholder */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {analyticsLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : (
                    <div className="h-64 flex items-center justify-center border-2 border-dashed border-muted-foreground rounded-lg">
                      <div className="text-center">
                        <LineChart className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground">Revenue chart will be implemented</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Order Status Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Order Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {analyticsLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {analytics?.orderStatuses?.map((status) => (
                        <div key={status.status} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500" />
                            <span className="text-sm font-medium capitalize">
                              {status.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              {status.count} orders
                            </span>
                            <Badge variant="secondary">
                              {status.percentage.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                      )) || (
                        <div className="text-center py-8 text-muted-foreground">
                          No order data available
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Products</CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {analytics?.topProducts?.map((product, index) => (
                      <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">{product.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {product.orders} orders • {formatCurrency(product.revenue)} revenue
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {product.growth >= 0 ? (
                            <TrendingUp className="w-4 h-4 text-green-600" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-600" />
                          )}
                          <span className={`font-medium ${
                            product.growth >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatPercentage(product.growth)}
                          </span>
                        </div>
                      </div>
                    )) || (
                      <div className="text-center py-8 text-muted-foreground">
                        No product data available
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Customer Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <span className="text-sm font-medium">Total Customers</span>
                      <span className="font-bold" data-testid="text-customer-total">
                        {analytics?.totalCustomers || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <span className="text-sm font-medium">New Customers</span>
                      <span className="font-bold text-green-600" data-testid="text-customer-new">
                        {analytics?.newCustomers || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <span className="text-sm font-medium">Repeat Customers</span>
                      <span className="font-bold text-blue-600" data-testid="text-customer-repeat">
                        {analytics?.repeatCustomers || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <span className="text-sm font-medium">Avg. Lifetime Value</span>
                      <span className="font-bold" data-testid="text-customer-ltv">
                        {formatCurrency(analytics?.customerLifetimeValue || 0)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Customer Acquisition</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center border-2 border-dashed border-muted-foreground rounded-lg">
                    <div className="text-center">
                      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">Customer acquisition chart will be implemented</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trends">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Sales Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-96 flex items-center justify-center border-2 border-dashed border-muted-foreground rounded-lg">
                    <div className="text-center">
                      <LineChart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-semibold text-lg mb-2">Advanced Charts Coming Soon</h3>
                      <p className="text-muted-foreground">
                        Interactive charts and trend analysis will be implemented with chart library
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}