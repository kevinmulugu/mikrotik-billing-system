"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Cookie, X } from "lucide-react";

export const CookieConsent: React.FC = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already accepted cookies
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      // Small delay for better UX
      setTimeout(() => {
        setShowBanner(true);
        setTimeout(() => setIsVisible(true), 100);
      }, 1000);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem("cookie-consent", "accepted");
    localStorage.setItem("cookie-consent-date", new Date().toISOString());
    setIsVisible(false);
    setTimeout(() => setShowBanner(false), 300);
  };

  const declineCookies = () => {
    localStorage.setItem("cookie-consent", "declined");
    localStorage.setItem("cookie-consent-date", new Date().toISOString());
    setIsVisible(false);
    setTimeout(() => setShowBanner(false), 300);
  };

  if (!showBanner) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 p-4 transition-all duration-300 ease-in-out ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
      }`}
    >
      <Card className="max-w-6xl mx-auto shadow-lg border-2">
        <div className="p-4 md:p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <Cookie className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-semibold text-lg mb-2">We Value Your Privacy</h3>
                <p className="text-sm text-muted-foreground">
                  We use cookies to enhance your browsing experience, analyze site traffic, and personalize content. 
                  By clicking "Accept All", you consent to our use of cookies. We comply with Kenya's Data Protection Act, 2019.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Link href="/legal/privacy-policy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
                <span className="text-muted-foreground">•</span>
                <Link href="/legal/cookie-policy" className="text-primary hover:underline">
                  Cookie Policy
                </Link>
                <span className="text-muted-foreground">•</span>
                <Link href="/legal/terms-of-service" className="text-primary hover:underline">
                  Terms of Service
                </Link>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
              <Button
                onClick={acceptCookies}
                size="sm"
                className="whitespace-nowrap"
              >
                Accept All
              </Button>
              <Button
                onClick={declineCookies}
                variant="outline"
                size="sm"
                className="whitespace-nowrap"
              >
                Decline
              </Button>
              <Button
                onClick={declineCookies}
                variant="ghost"
                size="sm"
                className="px-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
