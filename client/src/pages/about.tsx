import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, Eye, Heart, TrendingUp, Home } from "lucide-react";
import { useEffect, useState } from "react";

export default function About() {
  const [scrollY, setScrollY] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 via-orange-50 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Header />
      
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-6xl">
        {/* Hero Section */}
        <div 
          className={`text-center mb-12 sm:mb-16 transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          style={{ transform: `translateY(${scrollY * 0.1}px)` }}
        >
          <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-r from-red-500 to-red-600 mb-6 animate-pulse">
            <Users className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent mb-4">
            About Us
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Building a colony where everyone thrives
          </p>
        </div>

        {/* Our Tale Section */}
        <div 
          className={`mb-12 sm:mb-16 transition-all duration-1000 delay-200 ${
            isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"
          }`}
        >
          <Card className="border-2 border-red-100 dark:border-red-900 shadow-2xl overflow-hidden hover:shadow-red-200 dark:hover:shadow-red-900 transition-all duration-300 hover:scale-[1.02]">
            <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-gray-800 dark:to-gray-700 border-b pb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-red-100 dark:bg-red-900">
                  <Heart className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <CardTitle className="text-2xl sm:text-3xl text-red-700 dark:text-red-300">
                  Our Tale
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 sm:p-8">
              <p className="text-base sm:text-lg text-foreground leading-relaxed mb-4">
                In the heart of an ant colony, every member thrives on a shared purpose—each playing a part in survival and growth. Inspired by this natural marvel, <span className="font-semibold text-red-600 dark:text-red-400">OneAnt</span> was born as a community of shoppers and local businesses, working together to build something bigger than themselves.
              </p>
              <p className="text-base sm:text-lg text-foreground leading-relaxed">
                Just like ants on their trails, our members connect, share, and support one another. Local businesses showcase their unique offerings, while shoppers join forces to unlock savings, discover new favorites, and make choices that truly matter. Together, we create more than transactions—<span className="font-semibold text-red-600 dark:text-red-400">we create belonging</span>.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Mission and Vision Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 sm:mb-16">
          {/* Mission Card */}
          <div 
            className={`transition-all duration-1000 delay-300 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            }`}
          >
            <Card className="border-2 border-red-100 dark:border-red-900 shadow-xl h-full hover:shadow-red-200 dark:hover:shadow-red-900 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
              <CardHeader className="bg-gradient-to-br from-red-500 to-red-600 text-white pb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-2xl sm:text-3xl">
                    Our Mission
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 sm:p-8">
                <p className="text-base sm:text-lg text-foreground leading-relaxed">
                  To build a shopping experience rooted in connection. Every member, every interaction, and every purchase strengthens the colony—empowering local businesses, rewarding shoppers, and shaping a marketplace where value is shared, not extracted.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Vision Card */}
          <div 
            className={`transition-all duration-1000 delay-400 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            }`}
          >
            <Card className="border-2 border-red-100 dark:border-red-900 shadow-xl h-full hover:shadow-red-200 dark:hover:shadow-red-900 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
              <CardHeader className="bg-gradient-to-br from-orange-500 to-red-500 text-white pb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                    <Eye className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-2xl sm:text-3xl">
                    Our Vision
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 sm:p-8">
                <p className="text-base sm:text-lg text-foreground leading-relaxed mb-4">
                  We imagine a future where shopping goes beyond price tags. A future where:
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="mt-1 p-1.5 rounded-full bg-red-100 dark:bg-red-900 flex-shrink-0">
                      <Home className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <span className="text-base text-foreground leading-relaxed">
                      Communities rally around local businesses
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1 p-1.5 rounded-full bg-red-100 dark:bg-red-900 flex-shrink-0">
                      <Heart className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <span className="text-base text-foreground leading-relaxed">
                      Every purchase tells a story of support and sustainability
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1 p-1.5 rounded-full bg-red-100 dark:bg-red-900 flex-shrink-0">
                      <TrendingUp className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <span className="text-base text-foreground leading-relaxed">
                      Savings and discovery are shared joys, not solitary wins
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Closing Statement */}
        <div 
          className={`transition-all duration-1000 delay-500 ${
            isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          <Card className="border-2 border-red-200 dark:border-red-800 shadow-2xl bg-gradient-to-br from-red-50 via-orange-50 to-red-50 dark:from-gray-800 dark:to-gray-700 overflow-hidden">
            <CardContent className="p-8 sm:p-12 text-center">
              <p className="text-xl sm:text-2xl font-semibold text-foreground leading-relaxed mb-4">
                At OneAnt, we're not just buying groceries—
              </p>
              <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent">
                we're building a colony where everyone thrives.
              </p>
              <div className="mt-8 flex justify-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                <div className="w-3 h-3 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                <div className="w-3 h-3 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: "300ms" }}></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
