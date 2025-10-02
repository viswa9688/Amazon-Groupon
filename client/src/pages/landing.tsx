import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Header from "@/components/Header";
import { 
  Laptop, 
  Shirt, 
  Home, 
  Dumbbell, 
  Gamepad, 
  Baby,
  Shield,
  RotateCcw,
  Truck,
  Headphones,
  Facebook,
  Twitter,
  Instagram,
  Linkedin
} from "lucide-react";

export default function Landing() {
  const categories = [
    { icon: Laptop, name: "Electronics" },
    { icon: Shirt, name: "Fashion" },
    { icon: Home, name: "Home" },
    { icon: Dumbbell, name: "Sports" },
    { icon: Gamepad, name: "Gaming" },
    { icon: Baby, name: "Baby" },
  ];

  const trustFeatures = [
    {
      icon: Shield,
      title: "Secure Payments",
      description: "SSL encryption and trusted payment processors protect your information.",
    },
    {
      icon: RotateCcw,
      title: "Money Back Guarantee",
      description: "Not satisfied? Get your money back within 30 days, no questions asked.",
    },
    {
      icon: Truck,
      title: "Free Shipping",
      description: "Free shipping on all group orders within the continental United States.",
    },
    {
      icon: Headphones,
      title: "24/7 Support",
      description: "Our customer support team is available around the clock to help you.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-4xl lg:text-6xl font-bold leading-tight">
                Shop Together,<br />
                <span className="text-secondary">Save Together</span>
              </h1>
              <p className="text-xl text-primary-foreground/90 max-w-lg">
                Join group purchases and unlock amazing discounts. The more people buy, the more everyone saves.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg"
                  className="bg-secondary hover:bg-secondary/90 text-secondary-foreground text-lg px-8 py-4"
                  onClick={() => window.location.href = "/browse"}
                  data-testid="button-start-shopping"
                >
                  Start Shopping
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary text-lg px-8 py-4"
                  data-testid="button-learn-more"
                >
                  Learn More
                </Button>
              </div>
            </div>
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600" 
                alt="Group of diverse Americans shopping together with mobile devices" 
                className="rounded-2xl shadow-2xl w-full h-auto"
                data-testid="img-hero-group-shopping"
              />
              <div className="absolute -top-4 -right-4 bg-accent text-accent-foreground px-6 py-3 rounded-full font-bold text-xl shadow-lg animate-pulse-ring">
                Save up to 8%
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">How Group Buying Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Three simple steps to start saving with the power of group purchasing</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-4">
              <div className="bg-primary text-primary-foreground w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">1</div>
              <h3 className="text-xl font-semibold">Join a Group</h3>
              <p className="text-muted-foreground">Find products you love and join others who want to buy the same item.</p>
            </div>
            <div className="text-center space-y-4">
              <div className="bg-primary text-primary-foreground w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">2</div>
              <h3 className="text-xl font-semibold">Reach the Goal</h3>
              <p className="text-muted-foreground">As more people join, everyone unlocks bigger discounts automatically.</p>
            </div>
            <div className="text-center space-y-4">
              <div className="bg-primary text-primary-foreground w-16 h-16 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">3</div>
              <h3 className="text-xl font-semibold">Save Money</h3>
              <p className="text-muted-foreground">Get your products delivered at the lowest possible price. Everyone wins!</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Group Deals */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground">Hot Group Deals</h2>
            <Button variant="link" className="text-primary hover:text-primary/80 font-semibold p-0">
              View All →
            </Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Sample Product Cards */}
            {[
              {
                name: "Premium Wireless Headphones",
                image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
                currentPrice: "$89.99",
                originalPrice: "$159.99",
                savings: "$70",
                progress: 87,
                participants: "87/100",
                timeLeft: "2d 14h",
                status: "active"
              },
              {
                name: "Smart Fitness Tracker",
                image: "https://images.unsplash.com/photo-1544117519-31a4b719223d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
                currentPrice: "$129.99",
                originalPrice: "$199.99",
                savings: "$70",
                progress: 78,
                participants: "156/200",
                timeLeft: "1d 8h",
                status: "active"
              },
              {
                name: "Portable Bluetooth Speaker",
                image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
                currentPrice: "$49.99",
                originalPrice: "$89.99",
                savings: "$40",
                progress: 100,
                participants: "250/250",
                timeLeft: "",
                status: "complete"
              }
            ].map((product, index) => (
              <Card key={index} className="overflow-hidden hover:shadow-xl transition-shadow" data-testid={`card-product-${index}`}>
                <img 
                  src={product.image}
                  alt={product.name}
                  className="w-full h-48 object-cover"
                  data-testid={`img-product-${index}`}
                />
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-lg text-card-foreground">{product.name}</h3>
                    {product.status === "active" ? (
                      <div className="countdown-timer text-white px-2 py-1 rounded text-sm font-medium">
                        ⏰ {product.timeLeft}
                      </div>
                    ) : (
                      <div className="bg-accent text-accent-foreground px-2 py-1 rounded text-sm font-medium">
                        GOAL REACHED!
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-2xl font-bold text-accent">{product.currentPrice}</span>
                        <span className="text-muted-foreground line-through ml-2">{product.originalPrice}</span>
                      </div>
                      <div className="text-accent font-semibold">Save {product.savings}</div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress: {product.participants} people</span>
                        <span className="text-accent font-medium">{product.progress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-accent h-2 rounded-full transition-all" 
                          style={{ width: `${product.progress}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {product.status === "complete" 
                          ? "Maximum discount unlocked!" 
                          : `${100 - product.progress} more people for next discount tier!`
                        }
                      </p>
                    </div>
                    
                    <Button 
                      className={`w-full ${product.status === "complete" 
                        ? "bg-accent hover:bg-accent/90 text-accent-foreground" 
                        : "bg-primary hover:bg-primary/90 text-primary-foreground"
                      }`}
                      onClick={() => window.location.href = "/browse"}
                      data-testid={`button-join-group-${index}`}
                    >
                      {product.status === "complete" ? "Get Maximum Discount" : "Join Group Purchase"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Popular Categories</h2>
            <p className="text-xl text-muted-foreground">Discover amazing group deals across all categories</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {categories.map((category, index) => (
              <div key={index} className="text-center group cursor-pointer" data-testid={`category-${category.name.toLowerCase()}`}>
                <div className="bg-primary/10 hover:bg-primary/20 rounded-xl p-6 transition-colors group-hover:scale-105 transform transition-transform">
                  <category.icon className="w-8 h-8 text-primary mb-3 mx-auto" />
                  <h3 className="font-semibold text-foreground">{category.name}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Security Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">Shop with Confidence</h2>
            <p className="text-xl text-muted-foreground">Your security and satisfaction are our top priorities</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {trustFeatures.map((feature, index) => (
              <div key={index} className="text-center space-y-4">
                <div className="bg-accent text-accent-foreground w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                  <feature.icon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="bg-primary text-primary-foreground w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xl">
                  1A
                </div>
                <h3 className="text-2xl font-bold text-primary">OneAnt</h3>
              </div>
              <p className="text-muted-foreground">
                The future of e-commerce is here. Shop together, save together, and unlock the power of group buying.
              </p>
              <div className="flex space-x-4">
                <Facebook className="w-6 h-6 text-muted-foreground hover:text-primary cursor-pointer" />
                <Twitter className="w-6 h-6 text-muted-foreground hover:text-primary cursor-pointer" />
                <Instagram className="w-6 h-6 text-muted-foreground hover:text-primary cursor-pointer" />
                <Linkedin className="w-6 h-6 text-muted-foreground hover:text-primary cursor-pointer" />
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-4">For Buyers</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-muted-foreground hover:text-primary">How it Works</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary">Browse Products</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary">Join Groups</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary">Track Orders</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-4">For Sellers</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-muted-foreground hover:text-primary">Seller Hub</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary">List Products</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary">Analytics</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary">Resources</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-4">Support</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-muted-foreground hover:text-primary">Help Center</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary">Contact Us</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary">Terms of Service</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-primary">Privacy Policy</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border mt-12 pt-8 text-center">
            <p className="text-muted-foreground">
              © 2024 OneAnt, Inc. All rights reserved. Made with ❤️ in the USA.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
