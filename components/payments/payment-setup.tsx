"use client";

import React, { useState } from "react";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Info,
  DollarSign,
  TrendingUp,
  Wallet,
  Shield,
  Clock,
  Loader2,
  HelpCircle,
  Building,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";

interface PaymentSetupProps {
  currentMethod?: "company" | "customer" | null;
  onComplete?: (method: "company" | "customer") => void;
}

interface CustomerPaybillData {
  paybillNumber: string;
  accountNumber: string;
  businessName: string;
  phoneNumber: string;
}

export const PaymentSetup: React.FC<PaymentSetupProps> = ({
  currentMethod,
  onComplete,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<"company" | "customer" | null>(
    currentMethod || null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [paybillData, setPaybillData] = useState<CustomerPaybillData>({
    paybillNumber: "",
    accountNumber: "",
    businessName: "",
    phoneNumber: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerPaybillData, string>>>({});

  const companyPaybillFeatures = [
    "No setup required - start earning immediately",
    "Automated payment reconciliation",
    "20% commission on all transactions",
    "Monthly automated payouts via M-Pesa",
    "Real-time payment notifications",
    "24/7 customer support",
  ];

  const customerPaybillFeatures = [
    "Use your own M-Pesa paybill number",
    "Receive payments directly to your account",
    "Still earn 20% commission",
    "Optional automated reconciliation",
    "Full payment control",
    "Requires paybill verification (1-2 days)",
  ];

  const handleInputChange = (field: keyof CustomerPaybillData, value: string) => {
    setPaybillData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateCustomerPaybill = (): boolean => {
    const newErrors: Partial<Record<keyof CustomerPaybillData, string>> = {};

    if (!paybillData.paybillNumber || paybillData.paybillNumber.length < 5) {
      newErrors.paybillNumber = "Valid paybill number required (5-7 digits)";
    }

    if (!paybillData.accountNumber || paybillData.accountNumber.length < 3) {
      newErrors.accountNumber = "Account number is required";
    }

    if (!paybillData.businessName || paybillData.businessName.length < 3) {
      newErrors.businessName = "Business name is required";
    }

    if (!paybillData.phoneNumber || !/^\+254\d{9}$/.test(paybillData.phoneNumber.replace(/\s/g, ""))) {
      newErrors.phoneNumber = "Valid Kenyan phone number required (+254...)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitCompany = async () => {
    setIsSubmitting(true);

    try {
      // API call to set up company paybill
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast.success("Company paybill activated successfully!");
      onComplete?.("company");
    } catch (error) {
      toast.error("Failed to activate company paybill");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitCustomer = async () => {
    if (!validateCustomerPaybill()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    setIsSubmitting(true);

    try {
      // API call to submit customer paybill for verification
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast.success("Paybill submitted for verification. We'll notify you within 1-2 business days.");
      setShowCustomerForm(false);
      onComplete?.("customer");
    } catch (error) {
      toast.error("Failed to submit paybill details");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Payment Setup</h2>
        <p className="text-muted-foreground mt-1">
          Choose how you want to receive payments from your customers
        </p>
      </div>

      {/* Current Status */}
      {currentMethod && (
        <Alert className="border-green-500 bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertTitle className="text-green-500">Payment Method Active</AlertTitle>
          <AlertDescription>
            You're currently using{" "}
            {currentMethod === "company" ? "Company Paybill" : "Your Own Paybill"}
          </AlertDescription>
        </Alert>
      )}

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>How It Works</AlertTitle>
        <AlertDescription>
          Choose between using our company paybill (recommended for homeowners) or your own M-Pesa paybill.
          Both options include 20% commission on transactions.
        </AlertDescription>
      </Alert>

      {/* Payment Method Selection */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Company Paybill Card */}
        <Card
          className={`cursor-pointer transition-all ${selectedMethod === "company"
            ? "border-primary ring-2 ring-primary ring-offset-2"
            : "hover:border-primary/50"
            }`}
          onClick={() => setSelectedMethod("company")}
        >
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-3">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Company Paybill</CardTitle>
                  <CardDescription className="mt-1">
                    Hassle-free payment processing
                  </CardDescription>
                </div>
              </div>
              {selectedMethod === "company" && (
                <CheckCircle2 className="h-6 w-6 text-primary" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Commission Rate</span>
                <Badge variant="default">20%</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Earn on every transaction with automated monthly payouts
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Features:</p>
              <ul className="space-y-2">
                {companyPaybillFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-sm font-medium">Example Calculation:</p>
              <div className="rounded-lg border p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer Payment:</span>
                  <span className="font-medium">{formatCurrency(1000)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Your Commission (20%):</span>
                  <span className="font-medium text-green-600">{formatCurrency(200)}</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t">
                  <span className="text-muted-foreground">Monthly (100 sales):</span>
                  <span className="font-semibold text-green-600">{formatCurrency(20000)}</span>
                </div>
              </div>
            </div>

            <Badge variant="secondary" className="w-full justify-center py-2">
              <Shield className="h-3 w-3 mr-1" />
              Recommended for Homeowners
            </Badge>
          </CardContent>
        </Card>

        {/* Customer Paybill Card */}
        <Card
          className={`cursor-pointer transition-all ${selectedMethod === "customer"
            ? "border-primary ring-2 ring-primary ring-offset-2"
            : "hover:border-primary/50"
            }`}
          onClick={() => setSelectedMethod("customer")}
        >
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-blue-500/10 p-3">
                  <Wallet className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">Your Own Paybill</CardTitle>
                  <CardDescription className="mt-1">
                    Use your M-Pesa paybill
                  </CardDescription>
                </div>
              </div>
              {selectedMethod === "customer" && (
                <CheckCircle2 className="h-6 w-6 text-primary" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Commission Rate</span>
                <Badge variant="default">20%</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Same commission rate with direct payment control
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Features:</p>
              <ul className="space-y-2">
                {customerPaybillFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Alert className="border-yellow-500 bg-yellow-500/10">
              <Clock className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-xs">
                Verification required: 1-2 business days processing time
              </AlertDescription>
            </Alert>

            <Badge variant="outline" className="w-full justify-center py-2">
              <Building className="h-3 w-3 mr-1" />
              Ideal for ISPs & Businesses
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Detailed Comparison
          </CardTitle>
          <CardDescription>
            Compare features to make the best choice for your business
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 font-medium">Feature</th>
                  <th className="text-center py-3 font-medium">Company Paybill</th>
                  <th className="text-center py-3 font-medium">Your Paybill</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-3">Setup Time</td>
                  <td className="text-center">
                    <Badge variant="default">Instant</Badge>
                  </td>
                  <td className="text-center">
                    <Badge variant="secondary">1-2 Days</Badge>
                  </td>
                </tr>
                <tr>
                  <td className="py-3">Commission Rate</td>
                  <td className="text-center">20%</td>
                  <td className="text-center">20%</td>
                </tr>
                <tr>
                  <td className="py-3">Payment Control</td>
                  <td className="text-center">Automated</td>
                  <td className="text-center">Direct</td>
                </tr>
                <tr>
                  <td className="py-3">Reconciliation</td>
                  <td className="text-center">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                  </td>
                  <td className="text-center">Optional</td>
                </tr>
                <tr>
                  <td className="py-3">Monthly Payouts</td>
                  <td className="text-center">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                  </td>
                  <td className="text-center">Manual</td>
                </tr>
                <tr>
                  <td className="py-3">Technical Setup</td>
                  <td className="text-center">None</td>
                  <td className="text-center">Required</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* FAQ Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>Can I change my payment method later?</AccordionTrigger>
              <AccordionContent>
                Yes, you can switch between company paybill and your own paybill anytime from
                your billing settings. Changes take effect immediately for new transactions.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger>How are commissions calculated?</AccordionTrigger>
              <AccordionContent>
                Commissions are calculated at 20% of every transaction. For example, if a
                customer purchases a 1000 KES voucher, you earn 200 KES commission. The
                calculation is automatic and transparent in your dashboard.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger>When do I receive commission payouts?</AccordionTrigger>
              <AccordionContent>
                With company paybill, commissions are paid out automatically on the 1st of each
                month via M-Pesa. With your own paybill, you receive payments directly and can
                request commission payouts anytime your balance exceeds 1000 KES.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger>What if my own paybill verification fails?</AccordionTrigger>
              <AccordionContent>
                If verification fails, you'll receive an email with the reason. Common issues
                include incorrect paybill details or business name mismatch. You can resubmit
                with corrected information or switch to company paybill instantly.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger>Are there any hidden fees?</AccordionTrigger>
              <AccordionContent>
                No hidden fees! The 20% commission is the only cost. M-Pesa transaction fees
                are borne by the customer. With company paybill, all payment processing is
                included. With your own paybill, standard M-Pesa charges apply.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          {selectedMethod ? (
            <>
              Selected: {selectedMethod === "company" ? "Company Paybill" : "Your Own Paybill"}
            </>
          ) : (
            "Please select a payment method"
          )}
        </div>
        <div className="flex gap-2">
          {selectedMethod === "company" && (
            <Button onClick={handleSubmitCompany} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Activate Company Paybill
                </>
              )}
            </Button>
          )}

          {selectedMethod === "customer" && (
            <Dialog open={showCustomerForm} onOpenChange={setShowCustomerForm}>
              <DialogTrigger asChild>
                <Button>
                  <Wallet className="h-4 w-4 mr-2" />
                  Setup Your Paybill
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Setup Your M-Pesa Paybill</DialogTitle>
                  <DialogDescription>
                    Enter your paybill details for verification. This process takes 1-2 business days.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      Ensure your paybill details match your M-Pesa business account exactly.
                    </AlertDescription>
                  </Alert>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Paybill Number *</Label>
                      <Input
                        placeholder="123456"
                        value={paybillData.paybillNumber}
                        onChange={(e) => handleInputChange("paybillNumber", e.target.value)}
                      />
                      {errors.paybillNumber && (
                        <p className="text-sm text-destructive">{errors.paybillNumber}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Account Number *</Label>
                      <Input
                        placeholder="Account number"
                        value={paybillData.accountNumber}
                        onChange={(e) => handleInputChange("accountNumber", e.target.value)}
                      />
                      {errors.accountNumber && (
                        <p className="text-sm text-destructive">{errors.accountNumber}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Business Name *</Label>
                    <Input
                      placeholder="As registered with Safaricom"
                      value={paybillData.businessName}
                      onChange={(e) => handleInputChange("businessName", e.target.value)}
                    />
                    {errors.businessName && (
                      <p className="text-sm text-destructive">{errors.businessName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Contact Phone Number *</Label>
                    <Input
                      placeholder="+254 700 000 000"
                      value={paybillData.phoneNumber}
                      onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                    />
                    {errors.phoneNumber && (
                      <p className="text-sm text-destructive">{errors.phoneNumber}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      We'll use this number for verification
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCustomerForm(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmitCustomer} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit for Verification"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </div>
  );
};