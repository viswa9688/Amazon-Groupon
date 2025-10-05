import Header from "@/components/Header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, HelpCircle } from "lucide-react";

export default function FAQ() {
  const faqSections = [
    {
      title: "About OneAnt",
      icon: HelpCircle,
      questions: [
        {
          q: "What is OneAnt?",
          a: "OneAnt is a community-powered grocery platform where you shop together to save more. By joining or creating groups, you unlock bulk discounts (typically 8-10%) on everyday groceries from trusted local sellers."
        },
        {
          q: "Why 'OneAnt'?",
          a: "Ants thrive together, sharing resources, working as a team, and multiplying their strength. That's exactly what OneAnt brings to grocery shopping: collective power, bigger savings, and less waste."
        }
      ]
    },
    {
      title: "Shopping & Deals",
      questions: [
        {
          q: "How do I find deals?",
          a: "Browse the OneAnt app or website. You'll see fresh produce, pantry staples, and local favorites at exclusive group prices. Add what you love to your cart, then share it to start or join a group."
        },
        {
          q: "What makes OneAnt cheaper than regular grocery shopping?",
          a: "Our discounts come from collective buying. When enough people commit to the same deal within 24 hours, sellers can offer wholesale-like prices. Everyone saves without compromising on quality."
        },
        {
          q: "Are products fresh and authentic?",
          a: "Yes! We partner directly with trusted local sellers and small businesses. This means fresher goods, better traceability, and your dollars staying within the community."
        }
      ]
    },
    {
      title: "Groups & Sharing",
      questions: [
        {
          q: "How do I join a group?",
          a: "Simple. When someone shares a link with you, click it, view the deal, and join with one click. Complete your payment, and once the group fills, your order is confirmed."
        },
        {
          q: "What if I don't have friends to share with?",
          a: "No worries. You can join an existing open group on the platform. OneAnt connects you to other shoppers in your community so you never miss out."
        },
        {
          q: "What happens if the group doesn't fill in 24 hours?",
          a: "If the minimum number of people isn't reached, your payment is released back to you automatically. No risk, no hidden costs."
        }
      ]
    },
    {
      title: "Delivery & Pick-Up",
      questions: [
        {
          q: "How does delivery work?",
          a: "You get two options:\n\nGroup Delivery (Extra 10% off): All orders in your group are sent to a single address (like an apartment lobby, or a friend's house). This reduces costs and cuts carbon emissions.\n\nIndividual Delivery: If you prefer doorstep delivery, you can choose that too (no extra discount, but maximum convenience)."
        },
        {
          q: "Can I pick up my order?",
          a: "Yes, we offer pick-up option at hub location."
        }
      ]
    },
    {
      title: "Payments & Refunds",
      questions: [
        {
          q: "When is my card charged?",
          a: "Your payment is captured when you confirm your order, but it only goes through if your group fills within 24 hours. If not, the amount is refunded."
        },
        {
          q: "How are refunds processed?",
          a: "Refunds are automatic and usually reflect back in your bank within 3–5 business days."
        },
        {
          q: "Is my payment secure?",
          a: "Yes. We use trusted, PCI-compliant payment gateways to ensure your data and transactions are safe."
        }
      ]
    },
    {
      title: "Impact & Community",
      questions: [
        {
          q: "How does OneAnt reduce carbon footprints?",
          a: "By encouraging group deliveries and consolidated orders, fewer delivery trips are made. That means less fuel, fewer trucks on the road, and lower emissions."
        },
        {
          q: "Does shopping on OneAnt support local businesses?",
          a: "Absolutely. We partner with local sellers, farms, and independent stores. Every order you place helps strengthen small businesses in your community."
        }
      ]
    },
    {
      title: "Tech & Troubleshooting",
      questions: [
        {
          q: "Do I need to download an app?",
          a: "Not necessarily. You can shop directly from our website or use our mobile app (coming soon)."
        },
        {
          q: "I didn't get my OTP (login code). What should I do?",
          a: "Check your SMS or email spam folder first. If it's still missing, hit 'Resend OTP.' If issues continue, reach out to our support team at support@oneant.ca."
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 via-orange-50 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Header />
      
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-r from-red-500 to-red-600 mb-4 sm:mb-6">
            <HelpCircle className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent mb-3 sm:mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
            Everything you need to know about OneAnt. Can't find what you're looking for? Feel free to contact us!
          </p>
        </div>

        {/* FAQ Sections */}
        <div className="space-y-6 sm:space-y-8 mb-8 sm:mb-12">
          {faqSections.map((section, sectionIndex) => (
            <Card key={sectionIndex} className="border-2 shadow-lg overflow-hidden" data-testid={`card-faq-section-${sectionIndex}`}>
              <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-gray-800 dark:to-gray-700 border-b">
                <CardTitle className="text-xl sm:text-2xl flex items-center gap-2 text-red-700 dark:text-red-300">
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <Accordion type="single" collapsible className="w-full">
                  {section.questions.map((item, qIndex) => (
                    <AccordionItem key={qIndex} value={`item-${sectionIndex}-${qIndex}`} data-testid={`accordion-item-${sectionIndex}-${qIndex}`}>
                      <AccordionTrigger className="text-left text-sm sm:text-base font-medium hover:text-red-600 dark:hover:text-red-400" data-testid={`accordion-trigger-${sectionIndex}-${qIndex}`}>
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm sm:text-base text-muted-foreground whitespace-pre-line leading-relaxed" data-testid={`accordion-content-${sectionIndex}-${qIndex}`}>
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Contact Section */}
        <Card className="border-2 border-red-200 dark:border-red-800 shadow-xl bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-800 dark:to-gray-700">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent">
              Still Have Questions?
            </CardTitle>
            <CardDescription className="text-base sm:text-lg mt-2">
              We're here to help!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
              <a 
                href="mailto:support@oneant.ca"
                className="flex items-center gap-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors group"
                data-testid="link-email-support"
              >
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900 group-hover:bg-red-200 dark:group-hover:bg-red-800 transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <span className="text-sm sm:text-base font-medium">support@oneant.ca</span>
              </a>
              <a 
                href="tel:+16042138455"
                className="flex items-center gap-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors group"
                data-testid="link-phone-support"
              >
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900 group-hover:bg-red-200 dark:group-hover:bg-red-800 transition-colors">
                  <Phone className="w-5 h-5" />
                </div>
                <span className="text-sm sm:text-base font-medium">604-213-8455</span>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
