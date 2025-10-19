"use client";

import React, { useState } from "react";
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Wallet,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  FileText,
  X,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface PaymentMethod {
  id: string;
  type: "company_paybill" | "customer_paybill";
  paybillNumber: string;
  accountNumber?: string;
  isDefault: boolean;
  status: "active" | "pending" | "inactive";
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  dueDate: Date;
  paidDate?: Date;
  description: string;
}

interface CommissionPayout {
  id: string;
  amount: number;
  period: string;
  status: "completed" | "pending" | "processing";
  date: Date;
  transactionId?: string;
}

export const BillingSettings: React.FC = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [showAddPaybill, setShowAddPaybill] = useState(false);
  const [autoPayoutEnabled, setAutoPayoutEnabled] = useState(true);
  const [minPayoutAmount, setMinPayoutAmount] = useState("1000");

  const [newPaybill, setNewPaybill] = useState({
    paybillNumber: "",
    accountNumber: "",
  });

  // Sample data - replace with API calls
  const paymentMethods: PaymentMethod[] = [
    {
      id: "pm-1",
      type: "company_paybill",
      paybillNumber: "123456",
      isDefault: true,
      status: "active",
    },
  ];

  const revenueStats = {
    thisMonth: 45670,
    lastMonth: 38920,
    growth: 17.3,
    commission: 6850,
    pending: 2340,
  };

  const invoices: Invoice[] = [
    {
      id: "inv-1",
      invoiceNumber: "INV-2025-001",
      amount: 2500,
      status: "paid",
      dueDate: new Date("2025-01-31"),
      paidDate: new Date("2025-01-28"),
      description: "Platform subscription - January 2025",
    },
    {
      id: "inv-2",
      invoiceNumber: "INV-2025-002",
      amount: 2500,
      status: "pending",
      dueDate: new Date("2025-02-28"),
      description: "Platform subscription - February 2025",
    },
  ];

  const commissionPayouts: CommissionPayout[] = [
    {
      id: "payout-1",
      amount: 6850,
      period: "January 2025",
      status: "completed",
      date: new Date("2025-02-01"),
      transactionId: "MPESA123456",
    },
    {
      id: "payout-2",
      amount: 5420,
      period: "December 2024",
      status: "completed",
      date: new Date("2025-01-01"),
      transactionId: "MPESA123455",
    },
    {
      id: "payout-3",
      amount: 2340,
      period: "February 2025",
      status: "pending",
      date: new Date("2025-03-01"),
    },
  ];

  const handleAddPaybill = async () => {
    if (!newPaybill.paybillNumber || !newPaybill.accountNumber) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSaving(true);

    try {
      // API call to add customer paybill
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast.success("Paybill added successfully. Awaiting verification.");
      setShowAddPaybill(false);
      setNewPaybill({ paybillNumber: "", accountNumber: "" });
    } catch (error) {
      toast.error("Failed to add paybill");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetDefault = async (methodId: string) => {
    try {
      // API call to set default payment method
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success("Default payment method updated");
    } catch (error) {
      toast.error("Failed to update payment method");
    }
  };

  const handleRemovePaybill = async (methodId: string) => {
    try {
      // API call to remove paybill
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success("Paybill removed successfully");
    } catch (error) {
      toast.error("Failed to remove paybill");
    }
  };

  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      // API call to download invoice
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success("Invoice downloaded");
    } catch (error) {
      toast.error("Failed to download invoice");
    }
  };

  const handleRequestPayout = async () => {
    try {
      // API call to request payout
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast.success("Payout request submitted successfully");
    } catch (error) {
      toast.error("Failed to request payout");
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);

    try {
      // API call to save settings
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast.success("Settings saved successfully");
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
      case "completed":
      case "active":
        return "default";
      case "pending":
      case "processing":
        return "secondary";
      case "overdue":
      case "inactive":
        return "destructive";
      default:
        return "outline";
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const growthPercentage = ((revenueStats.thisMonth - revenueStats.lastMonth) / revenueStats.lastMonth) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Billing & Payments</h2>
        <p className="text-muted-foreground mt-1">
          Manage your payment methods, invoices, and commission payouts
        </p>
      </div>

      {/* Revenue Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>This Month</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(revenueStats.thisMonth)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              {growthPercentage >= 0 ? (
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              )}
              <span className={growthPercentage >= 0 ? "text-green-500" : "text-red-500"}>
                {Math.abs(growthPercentage).toFixed(1)}%
              </span>
              <span className="text-muted-foreground">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Commission Earned</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(revenueStats.commission)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span>15% commission rate</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Payout</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(revenueStats.pending)}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={handleRequestPayout}>
              Request Payout
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last Month</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(revenueStats.lastMonth)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>December 2024</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Methods
              </CardTitle>
              <CardDescription>
                Choose between company paybill or your own paybill for payments
              </CardDescription>
            </div>
            <Dialog open={showAddPaybill} onOpenChange={setShowAddPaybill}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Customer Paybill
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Your Own Paybill</DialogTitle>
                  <DialogDescription>
                    Use your own M-Pesa paybill to receive payments directly. Commission
                    rates still apply.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Paybill Number</label>
                    <Input
                      placeholder="Enter your paybill number"
                      value={newPaybill.paybillNumber}
                      onChange={(e) =>
                        setNewPaybill({ ...newPaybill, paybillNumber: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Account Number</label>
                    <Input
                      placeholder="Enter account number"
                      value={newPaybill.accountNumber}
                      onChange={(e) =>
                        setNewPaybill({ ...newPaybill, accountNumber: e.target.value })
                      }
                    />
                  </div>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Your paybill will be verified before activation. This may take 1-2
                      business days.
                    </AlertDescription>
                  </Alert>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddPaybill(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddPaybill} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Paybill"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentMethods.map((method) => (
            <div
              key={method.id}
              className="flex items-start justify-between rounded-lg border p-4"
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Wallet className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {method.type === "company_paybill"
                          ? "Company Paybill"
                          : "Customer Paybill"}
                      </p>
                      {method.isDefault && (
                        <Badge variant="default" className="text-xs">
                          Default
                        </Badge>
                      )}
                      <Badge variant={getStatusColor(method.status)} className="text-xs">
                        {method.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Paybill: {method.paybillNumber}
                      {method.accountNumber && ` • Account: ${method.accountNumber}`}
                    </p>
                  </div>
                </div>
                {method.type === "company_paybill" && (
                  <Alert className="bg-muted/50">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Using company paybill with 15% commission. Automated reconciliation
                      and payouts.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <div className="flex gap-2">
                {!method.isDefault && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetDefault(method.id)}
                  >
                    Set Default
                  </Button>
                )}
                {method.type === "customer_paybill" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemovePaybill(method.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Payout Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Payout Settings
          </CardTitle>
          <CardDescription>
            Configure automatic commission payouts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Automatic Payouts</p>
              <p className="text-sm text-muted-foreground">
                Receive commission payouts automatically each month
              </p>
            </div>
            <Switch
              checked={autoPayoutEnabled}
              onCheckedChange={setAutoPayoutEnabled}
            />
          </div>

          {autoPayoutEnabled && (
            <>
              <Separator />
              <div className="space-y-2">
                <label className="text-sm font-medium">Minimum Payout Amount</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="1000"
                    value={minPayoutAmount}
                    onChange={(e) => setMinPayoutAmount(e.target.value)}
                    className="max-w-[200px]"
                  />
                  <span className="text-sm text-muted-foreground">KES</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Payouts will only be processed when commission exceeds this amount
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium">Payout Schedule</label>
                <Select defaultValue="monthly">
                  <SelectTrigger className="max-w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How often you want to receive commission payouts
                </p>
              </div>
            </>
          )}

          <Button onClick={handleSaveSettings} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Commission Payouts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Commission Payouts
          </CardTitle>
          <CardDescription>Your commission payout history</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {commissionPayouts.map((payout) => (
            <div
              key={payout.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium">{formatCurrency(payout.amount)}</p>
                  <Badge variant={getStatusColor(payout.status)} className="text-xs">
                    {payout.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {payout.period} • {payout.date.toLocaleDateString()}
                </p>
                {payout.transactionId && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Transaction: {payout.transactionId}
                  </p>
                )}
              </div>
              {payout.status === "completed" && (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoices
          </CardTitle>
          <CardDescription>View and download your invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium">{invoice.invoiceNumber}</p>
                  <Badge variant={getStatusColor(invoice.status)} className="text-xs">
                    {invoice.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{invoice.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Due: {invoice.dueDate.toLocaleDateString()}
                  {invoice.paidDate && ` • Paid: ${invoice.paidDate.toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <p className="font-semibold">{formatCurrency(invoice.amount)}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownloadInvoice(invoice.id)}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};