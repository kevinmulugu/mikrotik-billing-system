"use client";

import React, { useState, useMemo } from "react";
import { Search, BookOpen, ChevronRight, FileText, Video, HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface Article {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  type: "article" | "video" | "guide";
  tags: string[];
  views: number;
  helpful: number;
  lastUpdated: string;
}

interface Category {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  articleCount: number;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  helpful: number;
}

export const KnowledgeBase: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("browse");

  // Sample data - replace with API calls
  const categories: Category[] = [
    {
      id: "getting-started",
      name: "Getting Started",
      description: "Learn the basics of router management",
      icon: <BookOpen className="h-5 w-5" />,
      articleCount: 12,
    },
    {
      id: "router-setup",
      name: "Router Setup",
      description: "Configure and manage your MikroTik router",
      icon: <FileText className="h-5 w-5" />,
      articleCount: 18,
    },
    {
      id: "vouchers",
      name: "Voucher Management",
      description: "Generate and manage hotspot vouchers",
      icon: <HelpCircle className="h-5 w-5" />,
      articleCount: 10,
    },
    {
      id: "payments",
      name: "Payments & Billing",
      description: "M-Pesa payments and reconciliation",
      icon: <FileText className="h-5 w-5" />,
      articleCount: 8,
    },
  ];

  const articles: Article[] = [
    {
      id: "1",
      title: "How to Add Your First Router",
      excerpt: "Step-by-step guide to connect your MikroTik router to the billing system",
      category: "getting-started",
      type: "guide",
      tags: ["router", "setup", "beginner"],
      views: 1234,
      helpful: 89,
      lastUpdated: "2025-01-15",
    },
    {
      id: "2",
      title: "Understanding Voucher Packages",
      excerpt: "Learn about different voucher types and how to price them",
      category: "vouchers",
      type: "article",
      tags: ["vouchers", "pricing", "packages"],
      views: 856,
      helpful: 72,
      lastUpdated: "2025-01-10",
    },
    {
      id: "3",
      title: "Setting Up M-Pesa Payments",
      excerpt: "Configure M-Pesa integration for automated payments",
      category: "payments",
      type: "video",
      tags: ["mpesa", "payments", "setup"],
      views: 2341,
      helpful: 156,
      lastUpdated: "2025-01-20",
    },
    {
      id: "4",
      title: "Managing Hotspot Users",
      excerpt: "Monitor and control WiFi users on your network",
      category: "router-setup",
      type: "guide",
      tags: ["hotspot", "users", "monitoring"],
      views: 678,
      helpful: 54,
      lastUpdated: "2025-01-08",
    },
    {
      id: "5",
      title: "Troubleshooting Router Connection",
      excerpt: "Fix common router connectivity issues",
      category: "router-setup",
      type: "article",
      tags: ["troubleshooting", "connection", "router"],
      views: 1567,
      helpful: 123,
      lastUpdated: "2025-01-18",
    },
  ];

  const faqs: FAQ[] = [
    {
      id: "faq-1",
      question: "How do I reset my router password?",
      answer: "To reset your router password, go to Router Settings > Security > Change Password. You'll need to verify your identity via M-Pesa or email before changing the password.",
      category: "router-setup",
      helpful: 45,
    },
    {
      id: "faq-2",
      question: "What payment methods are supported?",
      answer: "We support M-Pesa payments through Paybill numbers. You can use either the company paybill (for commission-based earnings) or set up your own customer paybill.",
      category: "payments",
      helpful: 67,
    },
    {
      id: "faq-3",
      question: "How long do vouchers last?",
      answer: "Voucher expiry depends on the package type. Time-based vouchers (1 hour, 1 day, etc.) expire after the time is used. Data-based vouchers expire after the data limit is reached. Unused vouchers typically expire 30 days after generation.",
      category: "vouchers",
      helpful: 89,
    },
    {
      id: "faq-4",
      question: "Can I manage multiple routers?",
      answer: "Yes! You can add and manage multiple MikroTik routers from a single account. Each router can have its own payment settings, voucher packages, and user management.",
      category: "getting-started",
      helpful: 34,
    },
    {
      id: "faq-5",
      question: "How do commissions work?",
      answer: "If you're using the company paybill, you earn a commission on every voucher sale. The commission rate depends on your customer type (typically 10-15%). Commissions are calculated automatically and can be withdrawn via M-Pesa.",
      category: "payments",
      helpful: 112,
    },
  ];

  // Filter articles based on search and category
  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const matchesSearch =
        searchQuery === "" ||
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = !selectedCategory || article.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  // Filter FAQs based on search
  const filteredFAQs = useMemo(() => {
    return faqs.filter(
      (faq) =>
        searchQuery === "" ||
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const getTypeIcon = (type: Article["type"]) => {
    switch (type) {
      case "video":
        return <Video className="h-4 w-4" />;
      case "guide":
        return <BookOpen className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeBadgeVariant = (type: Article["type"]) => {
    switch (type) {
      case "video":
        return "default";
      case "guide":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Knowledge Base</h2>
        <p className="text-muted-foreground mt-1">
          Find answers, tutorials, and guides to help you get the most out of your routers
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search for articles, guides, or FAQs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="browse">Browse Articles</TabsTrigger>
          <TabsTrigger value="faq">FAQs</TabsTrigger>
        </TabsList>

        {/* Browse Articles Tab */}
        <TabsContent value="browse" className="space-y-6">
          {/* Categories Grid */}
          {!selectedCategory && searchQuery === "" && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {categories.map((category) => (
                <Card
                  key={category.id}
                  className="cursor-pointer transition-colors hover:bg-accent"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        {category.icon}
                      </div>
                      <Badge variant="secondary">{category.articleCount}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardTitle className="text-base">{category.name}</CardTitle>
                    <CardDescription className="mt-1 text-sm">
                      {category.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Category breadcrumb */}
          {selectedCategory && (
            <div className="flex items-center gap-2 text-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCategory(null)}
                className="h-auto p-0 text-muted-foreground hover:text-foreground"
              >
                All Categories
              </Button>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {categories.find((c) => c.id === selectedCategory)?.name}
              </span>
            </div>
          )}

          {/* Articles List */}
          <div className="space-y-4">
            {filteredArticles.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-center text-muted-foreground">
                    No articles found matching your search
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory(null);
                    }}
                    className="mt-4"
                  >
                    Clear filters
                  </Button>
                </CardContent>
              </Card>
            ) : (
              filteredArticles.map((article) => (
                <Card key={article.id} className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={getTypeBadgeVariant(article.type)} className="gap-1">
                            {getTypeIcon(article.type)}
                            {article.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Updated {new Date(article.lastUpdated).toLocaleDateString()}
                          </span>
                        </div>
                        <CardTitle className="text-lg">{article.title}</CardTitle>
                        <CardDescription>{article.excerpt}</CardDescription>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-2">
                        {article.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{article.views.toLocaleString()} views</span>
                        <span>{article.helpful} found helpful</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* FAQs Tab */}
        <TabsContent value="faq" className="space-y-4">
          {filteredFAQs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <HelpCircle className="h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-center text-muted-foreground">
                  No FAQs found matching your search
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="mt-4"
                >
                  Clear search
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Frequently Asked Questions</CardTitle>
                <CardDescription>
                  Quick answers to common questions about router management and payments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {filteredFAQs.map((faq) => (
                    <AccordionItem key={faq.id} value={faq.id}>
                      <AccordionTrigger className="text-left">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">{faq.answer}</p>
                          <div className="flex items-center justify-between border-t pt-3">
                            <span className="text-xs text-muted-foreground">
                              {faq.helpful} people found this helpful
                            </span>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm">
                                Yes
                              </Button>
                              <Button variant="outline" size="sm">
                                No
                              </Button>
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Help Footer */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="font-medium">Can't find what you're looking for?</p>
            <p className="text-sm text-muted-foreground">
              Contact our support team for personalized assistance
            </p>
          </div>
          <Button>Create Ticket</Button>
        </CardContent>
      </Card>
    </div>
  );
};