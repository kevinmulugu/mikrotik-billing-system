"use client";

import React, { useState } from "react";
import {
  DollarSign,
  Download,
  Filter,
  Search,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  TrendingUp,
  Receipt,
  Eye,
  RefreshCw,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface Payment {
  id: string;
  transactionId: string;
  type: "voucher_purchase" | "pppoe_payment" | "commission_payout" | "subscription";
  amount: number;
  currency: string;
  status: "completed" | "pending" | "failed" | "cancelled" | "refunded";
  description: string;
  date: Date;
  mpesa?: {
    phoneNumber: string;
    accountReference: string;
    resultDesc?: string;
  };
  paybill?: {
    paybillNumber: string;
    accountNumber: string;
  };
  commission?: {
    rate: number;
    amount: number;
  };
  linkedItems?: {
    type: string;
    count: number;
  }[];
}

interface PaymentHistoryProps {
  routerId?: string;
  customerId?: string;
}

export const PaymentHistory: React.FC<PaymentHistoryProps> = ({
  routerId,
  customerId,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("30days");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  // Sample data - replace with API call
  const payments: Payment[] = [
    {
      id: "pay-1",
      transactionId: "MPESA-RFT123456789",
      type: "voucher_purchase",
      amount: 500,
      currency: "KES",
      status: "completed",
      description: "5 Hour WiFi Voucher",
      date: new Date("2025-01-28T14:30:00"),
      mpesa: {
        phoneNumber: "+254712345678",
        accountReference: "VOUCHER",
        resultDesc: "The service request is processed successfully",
      },
      paybill: {
        paybillNumber: "123456",
        accountNumber: "ROUTER001",
      },
      commission: {
        rate: 15,
        amount: 75,
      },
      linkedItems: [
        { type: "voucher", count: 1 },
      ],
    },
    {
      id: "pay-2",
      transactionId: "MPESA-RFT987654321",
      type: "pppoe_payment",
      amount: 1500,
      currency: "KES",
      status: "completed",
      description: "Monthly Internet - User: john_doe",
      date: new Date("2025-01-27T10:15:00"),
      mpesa: {
        phoneNumber: "+254723456789",
        accountReference: "PPPOE-JOHN",
        resultDesc: "The service request is processed successfully",
      },
      paybill: {
        paybillNumber: "123456",
        accountNumber: "ROUTER001",
      },
      commission: {
        rate: 15,
        amount: 225,
      },
    },
    {
      id: "pay-3",
      transactionId: "COMM-2025-01",
      type: "commission_payout",
      amount: 6850,
      currency: "KES",
      status: "completed",
      description: "Commission Payout - January 2025",
      date: new Date("2025-02-01T08:00:00"),
      mpesa: {
        phoneNumber: "+254700123456",
        accountReference: "COMMISSION",
        resultDesc: "Commission paid successfully",
      },
      commission: {
        rate: 15,
        amount: 6850,
      },
    },
    {
      id: "pay-4",
      transactionId: "MPESA-RFT555444333",
      type: "voucher_purchase",
      amount: 250,
      currency: "KES",
      status: "pending",
      description: "3 Hour WiFi Voucher",
      date: new Date("2025-01-28T16:45:00"),
      mpesa: {
        phoneNumber: "+254734567890",
        accountReference: "VOUCHER",
      },
      paybill: {
        paybillNumber: "123456",
        accountNumber: "ROUTER001",
      },
    },
    {
      id: "pay-5",
      transactionId: "MPESA-RFT111222333",
      type: "voucher_purchase",
      amount: 100,
      currency: "KES",
      status: "failed",
      description: "1 Hour WiFi Voucher",
      date: new Date("2025-01-28T12:20:00"),
      mpesa: {
        phoneNumber: "+254745678901",
        accountReference: "VOUCHER",
        resultDesc: "Insufficient funds in account",
      },
      paybill: {
        paybillNumber: "123456",
        accountNumber: "ROUTER001",
      },
    },
    {
      id: "pay-6",
      transactionId: "SUB-2025-01",
      type: "subscription",
      amount: 2500,
      currency: "KES",
      status: "completed",
      description: "Platform Subscription - January 2025",
      date: new Date("2025-01-01T00:00:00"),
      mpesa: {
        phoneNumber: "+254700123456",
        accountReference: "SUBSCRIPTION",
        resultDesc: "The service request is processed successfully",
      },
    },
  ];

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      searchQuery === "" ||
      payment.transactionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.mpesa?.phoneNumber.includes(searchQuery);

    const matchesStatus = statusFilter === "all" || payment.status === statusFilter;
    const matchesType = typeFilter === "all" || payment.type === typeFilter;

    // Date range filtering
    const now = new Date();
    const paymentDate = new Date(payment.date);
    let matchesDate = true;

    switch (dateRange) {
      case "7days":
        matchesDate = (now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24) <= 7;
        break;
      case "30days":
        matchesDate = (now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24) <= 30;
        break;
      case "90days":
        matchesDate = (now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24) <= 90;
        break;
    }

    return matchesSearch && matchesStatus && matchesType && matchesDate;
  });

  const stats = {
    total: filteredPayments.reduce((sum, p) => sum + (p.status === "completed" ? p.amount : 0), 0),
    count: filteredPayments.length,
    completed: filteredPayments.filter((p) => p.status === "completed").length,
    pending: filteredPayments.filter((p) => p.status === "pending").length,
    failed: filteredPayments.filter((p) => p.status === "failed").length,
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Payment history refreshed");
    } catch (error) {
      toast.error("Failed to refresh");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = () => {
    toast.success("Exporting payment history...");
    // Implement CSV/PDF export
  };

  const handleViewDetails = (payment: Payment) => {
    setSelectedPayment(payment);
  };

  const getStatusIcon = (status: Payment["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case "refunded":
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: Payment["status"]) => {
    switch (status) {
      case "completed":
        return "default";
      case "pending":
        return "secondary";
      case "failed":
        return "destructive";
      case "cancelled":
        return "outline";
      case "refunded":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getTypeLabel = (type: Payment["type"]) => {
    switch (type) {
      case "voucher_purchase":
        return "Voucher";
      case "pppoe_payment":
        return "PPPoE";
      case "commission_payout":
        return "Commission";
      case "subscription":
        return "Subscription";
      default:
        return type;
    }
  };

  const getTypeIcon = (type: Payment["type"]) => {
    switch (type) {
      case "voucher_purchase":
        return <Receipt className="h-4 w-4" />;
      case "pppoe_payment":
        return <DollarSign className="h-4 w-4" />;
      case "commission_payout":
        return <TrendingUp className="h-4 w-4" />;
      case "subscription":
        return <FileText className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatPhoneNumber = (phone: string): string => {
    return phone.replace(/(\+254)(\d{3})(\d{3})(\d{3})/, "$1 $2 $3 $4");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Payment History</h2>
          <p className="text-muted-foreground mt-1">
            Track all your transactions and earnings
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.total)}</p>
              </div>
              <div className="rounded-full bg-green-500/10 p-3">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-500">{stats.completed}</p>
              </div>
              <div className="rounded-full bg-green-500/10 p-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-500">{stats.pending}</p>
              </div>
              <div className="rounded-full bg-yellow-500/10 p-3">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-500">{stats.failed}</p>
              </div>
              <div className="rounded-full bg-red-500/10 p-3">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="voucher_purchase">Vouchers</SelectItem>
                <SelectItem value="pppoe_payment">PPPoE</SelectItem>
                <SelectItem value="commission_payout">Commission</SelectItem>
                <SelectItem value="subscription">Subscription</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="90days">Last 90 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payment List */}
      {filteredPayments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No transactions found</p>
            <p className="text-sm text-muted-foreground text-center">
              {searchQuery || statusFilter !== "all" || typeFilter !== "all"
                ? "Try adjusting your filters"
                : "Your payment history will appear here"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredPayments.map((payment) => (
                <div key={payment.id} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="rounded-lg bg-muted p-2">
                        {getTypeIcon(payment.type)}
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{payment.description}</p>
                          <Badge variant={getStatusBadge(payment.status)} className="text-xs">
                            {getStatusIcon(payment.status)}
                            <span className="ml-1">{payment.status}</span>
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {getTypeLabel(payment.type)}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Receipt className="h-3 w-3" />
                            {payment.transactionId}
                          </span>
                          {payment.mpesa && (
                            <span>{formatPhoneNumber(payment.mpesa.phoneNumber)}</span>
                          )}
                          <span>{payment.date.toLocaleString()}</span>
                        </div>

                        {payment.commission && payment.type !== "commission_payout" && (
                          <div className="flex items-center gap-2 text-xs">
                            <Badge variant="secondary" className="text-xs">
                              Commission: {formatCurrency(payment.commission.amount)} ({payment.commission.rate}%)
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold text-lg">
                          {formatCurrency(payment.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">{payment.currency}</p>
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewDetails(payment)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Payment Details</DialogTitle>
                            <DialogDescription>
                              Transaction ID: {payment.transactionId}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <h4 className="font-medium">Transaction Information</h4>
                              <div className="rounded-lg border p-3 space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Amount:</span>
                                  <span className="font-medium">{formatCurrency(payment.amount)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Status:</span>
                                  <Badge variant={getStatusBadge(payment.status)}>
                                    {payment.status}
                                  </Badge>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Type:</span>
                                  <span className="font-medium">{getTypeLabel(payment.type)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Date:</span>
                                  <span className="font-medium">{payment.date.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>

                            {payment.mpesa && (
                              <div className="space-y-2">
                                <h4 className="font-medium">M-Pesa Details</h4>
                                <div className="rounded-lg border p-3 space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Phone:</span>
                                    <span className="font-medium">
                                      {formatPhoneNumber(payment.mpesa.phoneNumber)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Reference:</span>
                                    <span className="font-medium">{payment.mpesa.accountReference}</span>
                                  </div>
                                  {payment.mpesa.resultDesc && (
                                    <div className="pt-2 border-t">
                                      <p className="text-muted-foreground mb-1">Message:</p>
                                      <p className="text-sm">{payment.mpesa.resultDesc}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {payment.paybill && (
                              <div className="space-y-2">
                                <h4 className="font-medium">Paybill Information</h4>
                                <div className="rounded-lg border p-3 space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Paybill:</span>
                                    <span className="font-medium">{payment.paybill.paybillNumber}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Account:</span>
                                    <span className="font-medium">{payment.paybill.accountNumber}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {payment.commission && (
                              <div className="space-y-2">
                                <h4 className="font-medium">Commission Details</h4>
                                <div className="rounded-lg border p-3 space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Rate:</span>
                                    <span className="font-medium">{payment.commission.rate}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Amount:</span>
                                    <span className="font-medium text-green-600">
                                      {formatCurrency(payment.commission.amount)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};