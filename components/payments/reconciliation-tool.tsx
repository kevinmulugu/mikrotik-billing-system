"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  Download,
  Upload,
  RefreshCw,
  FileText,
  Link2,
  Unlink,
  Eye,
  Calendar,
  DollarSign,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface MpesaTransaction {
  id: string;
  transactionId: string;
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDate: Date;
  reconciled: boolean;
  systemTransactionId?: string;
  discrepancy?: number;
}

interface SystemTransaction {
  id: string;
  orderId: string;
  type: "voucher" | "pppoe" | "subscription";
  amount: number;
  phoneNumber: string;
  accountReference: string;
  createdAt: Date;
  reconciled: boolean;
  mpesaTransactionId?: string;
  discrepancy?: number;
}

interface ReconciliationMatch {
  mpesaId: string;
  systemId: string;
  confidence: "high" | "medium" | "low";
  matchedBy: string[];
  amountDiff: number;
}

export const ReconciliationTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"auto" | "manual" | "unmatched">("auto");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState("today");
  const [isReconciling, setIsReconciling] = useState(false);
  const [selectedMpesa, setSelectedMpesa] = useState<MpesaTransaction | null>(null);
  const [selectedSystem, setSelectedSystem] = useState<SystemTransaction | null>(null);

  // Sample M-Pesa transactions
  const mpesaTransactions: MpesaTransaction[] = [
    {
      id: "mpesa-1",
      transactionId: "RFT123456789",
      phoneNumber: "+254712345678",
      amount: 500,
      accountReference: "VOUCHER",
      transactionDate: new Date("2025-01-28T14:30:00"),
      reconciled: false,
    },
    {
      id: "mpesa-2",
      transactionId: "RFT987654321",
      phoneNumber: "+254723456789",
      amount: 1500,
      accountReference: "PPPOE-JOHN",
      transactionDate: new Date("2025-01-28T10:15:00"),
      reconciled: true,
      systemTransactionId: "sys-2",
    },
    {
      id: "mpesa-3",
      transactionId: "RFT555444333",
      phoneNumber: "+254734567890",
      amount: 250,
      accountReference: "VOUCHER",
      transactionDate: new Date("2025-01-28T16:45:00"),
      reconciled: false,
    },
    {
      id: "mpesa-4",
      transactionId: "RFT222333444",
      phoneNumber: "+254745678901",
      amount: 1505,
      accountReference: "PPPOE-JANE",
      transactionDate: new Date("2025-01-28T09:20:00"),
      reconciled: false,
    },
  ];

  // Sample system transactions
  const systemTransactions: SystemTransaction[] = [
    {
      id: "sys-1",
      orderId: "ORD-2025-001",
      type: "voucher",
      amount: 500,
      phoneNumber: "+254712345678",
      accountReference: "VOUCHER",
      createdAt: new Date("2025-01-28T14:29:50"),
      reconciled: false,
    },
    {
      id: "sys-2",
      orderId: "ORD-2025-002",
      type: "pppoe",
      amount: 1500,
      phoneNumber: "+254723456789",
      accountReference: "PPPOE-JOHN",
      createdAt: new Date("2025-01-28T10:14:30"),
      reconciled: true,
      mpesaTransactionId: "mpesa-2",
    },
    {
      id: "sys-3",
      orderId: "ORD-2025-003",
      type: "voucher",
      amount: 250,
      phoneNumber: "+254734567890",
      accountReference: "VOUCHER",
      createdAt: new Date("2025-01-28T16:44:20"),
      reconciled: false,
    },
    {
      id: "sys-4",
      orderId: "ORD-2025-004",
      type: "pppoe",
      amount: 1500,
      phoneNumber: "+254745678901",
      accountReference: "PPPOE-JANE",
      createdAt: new Date("2025-01-28T09:19:00"),
      reconciled: false,
    },
  ];

  // Auto-match suggestions
  const suggestedMatches: ReconciliationMatch[] = [
    {
      mpesaId: "mpesa-1",
      systemId: "sys-1",
      confidence: "high",
      matchedBy: ["amount", "phone", "reference", "time"],
      amountDiff: 0,
    },
    {
      mpesaId: "mpesa-3",
      systemId: "sys-3",
      confidence: "high",
      matchedBy: ["amount", "phone", "reference", "time"],
      amountDiff: 0,
    },
    {
      mpesaId: "mpesa-4",
      systemId: "sys-4",
      confidence: "medium",
      matchedBy: ["phone", "reference", "time"],
      amountDiff: 5,
    },
  ];

  const stats = {
    totalMpesa: mpesaTransactions.length,
    totalSystem: systemTransactions.length,
    reconciled: mpesaTransactions.filter((t) => t.reconciled).length,
    unmatched: mpesaTransactions.filter((t) => !t.reconciled).length,
    discrepancies: suggestedMatches.filter((m) => m.amountDiff !== 0).length,
    autoMatches: suggestedMatches.filter((m) => m.confidence === "high").length,
  };

  const reconciliationRate = stats.totalMpesa > 0 
    ? (stats.reconciled / stats.totalMpesa) * 100 
    : 0;

  const handleAutoReconcile = async () => {
    setIsReconciling(true);
    try {
      // API call to auto-reconcile
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      toast.success(`${stats.autoMatches} transactions auto-reconciled successfully`);
    } catch (error) {
      toast.error("Auto-reconciliation failed");
    } finally {
      setIsReconciling(false);
    }
  };

  const handleManualMatch = async (mpesaId: string, systemId: string) => {
    try {
      // API call to manually match transactions
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      toast.success("Transactions matched successfully");
      setSelectedMpesa(null);
      setSelectedSystem(null);
    } catch (error) {
      toast.error("Failed to match transactions");
    }
  };

  const handleUnmatch = async (transactionId: string) => {
    try {
      // API call to unmatch transaction
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      toast.success("Transaction unmatched");
    } catch (error) {
      toast.error("Failed to unmatch transaction");
    }
  };

  const handleImportMpesa = () => {
    toast.info("M-Pesa import feature coming soon");
    // Implement CSV import
  };

  const handleExport = () => {
    toast.success("Exporting reconciliation report...");
    // Implement export
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

  const getConfidenceBadge = (confidence: ReconciliationMatch["confidence"]) => {
    switch (confidence) {
      case "high":
        return <Badge variant="default">High Confidence</Badge>;
      case "medium":
        return <Badge variant="secondary">Medium Confidence</Badge>;
      case "low":
        return <Badge variant="outline">Low Confidence</Badge>;
    }
  };

  const getMpesaTransaction = (id: string) => 
    mpesaTransactions.find((t) => t.id === id);

  const getSystemTransaction = (id: string) => 
    systemTransactions.find((t) => t.id === id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Payment Reconciliation</h2>
          <p className="text-muted-foreground mt-1">
            Match M-Pesa payments with system transactions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImportMpesa}>
            <Upload className="h-4 w-4 mr-2" />
            Import M-Pesa
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{stats.totalMpesa}</p>
              <p className="text-xs text-muted-foreground">M-Pesa Txns</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{stats.totalSystem}</p>
              <p className="text-xs text-muted-foreground">System Txns</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-500">{stats.reconciled}</p>
              <p className="text-xs text-muted-foreground">Reconciled</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-500">{stats.unmatched}</p>
              <p className="text-xs text-muted-foreground">Unmatched</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-500">{stats.autoMatches}</p>
              <p className="text-xs text-muted-foreground">Auto-Match</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-500">{stats.discrepancies}</p>
              <p className="text-xs text-muted-foreground">Discrepancies</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reconciliation Progress */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Reconciliation Status</CardTitle>
              <CardDescription>
                {reconciliationRate.toFixed(1)}% of transactions reconciled
              </CardDescription>
            </div>
            <Button onClick={handleAutoReconcile} disabled={isReconciling}>
              {isReconciling ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Reconciling...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Auto-Reconcile
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={reconciliationRate} className="h-2" />
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="auto">
            Auto-Match Suggestions ({stats.autoMatches})
          </TabsTrigger>
          <TabsTrigger value="manual">Manual Matching</TabsTrigger>
          <TabsTrigger value="unmatched">
            Unmatched ({stats.unmatched})
          </TabsTrigger>
        </TabsList>

        {/* Auto-Match Tab */}
        <TabsContent value="auto" className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Auto-Match Suggestions</AlertTitle>
            <AlertDescription>
              Review and approve automatically matched transactions. High confidence matches can be bulk-approved.
            </AlertDescription>
          </Alert>

          {suggestedMatches.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                <p className="text-lg font-medium mb-2">All Caught Up!</p>
                <p className="text-sm text-muted-foreground">
                  No auto-match suggestions available
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {suggestedMatches.map((match) => {
                const mpesa = getMpesaTransaction(match.mpesaId);
                const system = getSystemTransaction(match.systemId);
                if (!mpesa || !system) return null;

                return (
                  <Card key={`${match.mpesaId}-${match.systemId}`}>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {getConfidenceBadge(match.confidence)}
                              {match.amountDiff !== 0 && (
                                <Badge variant="destructive">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Amount Mismatch: {formatCurrency(match.amountDiff)}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Matched by: {match.matchedBy.join(", ")}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleManualMatch(match.mpesaId, match.systemId)}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Approve Match
                            </Button>
                            <Button variant="outline" size="sm">
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          {/* M-Pesa Transaction */}
                          <div className="rounded-lg border p-4 space-y-2">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="rounded-full bg-green-500/10 p-2">
                                <DollarSign className="h-4 w-4 text-green-500" />
                              </div>
                              <h4 className="font-medium">M-Pesa Transaction</h4>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Transaction ID:</span>
                                <span className="font-mono">{mpesa.transactionId}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Amount:</span>
                                <span className="font-semibold">{formatCurrency(mpesa.amount)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Phone:</span>
                                <span>{formatPhoneNumber(mpesa.phoneNumber)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Reference:</span>
                                <span>{mpesa.accountReference}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Date:</span>
                                <span>{mpesa.transactionDate.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          {/* System Transaction */}
                          <div className="rounded-lg border p-4 space-y-2">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="rounded-full bg-blue-500/10 p-2">
                                <FileText className="h-4 w-4 text-blue-500" />
                              </div>
                              <h4 className="font-medium">System Transaction</h4>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Order ID:</span>
                                <span className="font-mono">{system.orderId}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Amount:</span>
                                <span className="font-semibold">{formatCurrency(system.amount)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Phone:</span>
                                <span>{formatPhoneNumber(system.phoneNumber)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Reference:</span>
                                <span>{system.accountReference}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Date:</span>
                                <span>{system.createdAt.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Manual Matching Tab */}
        <TabsContent value="manual" className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Manual Matching</AlertTitle>
            <AlertDescription>
              Select an M-Pesa transaction and a system transaction to manually create a match.
            </AlertDescription>
          </Alert>

          <div className="grid gap-6 md:grid-cols-2">
            {/* M-Pesa Transactions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">M-Pesa Transactions</CardTitle>
                <CardDescription>Select a transaction to match</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {mpesaTransactions
                  .filter((t) => !t.reconciled)
                  .map((transaction) => (
                    <div
                      key={transaction.id}
                      onClick={() => setSelectedMpesa(transaction)}
                      className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                        selectedMpesa?.id === transaction.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-1">
                          <p className="font-mono text-sm">{transaction.transactionId}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatPhoneNumber(transaction.phoneNumber)}
                          </p>
                        </div>
                        <p className="font-semibold">{formatCurrency(transaction.amount)}</p>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>

            {/* System Transactions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">System Transactions</CardTitle>
                <CardDescription>Select a transaction to match</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {systemTransactions
                  .filter((t) => !t.reconciled)
                  .map((transaction) => (
                    <div
                      key={transaction.id}
                      onClick={() => setSelectedSystem(transaction)}
                      className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                        selectedSystem?.id === transaction.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-1">
                          <p className="font-mono text-sm">{transaction.orderId}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatPhoneNumber(transaction.phoneNumber)}
                          </p>
                        </div>
                        <p className="font-semibold">{formatCurrency(transaction.amount)}</p>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>

          {selectedMpesa && selectedSystem && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium mb-2">Ready to Match</p>
                    <p className="text-sm text-muted-foreground">
                      M-Pesa: {selectedMpesa.transactionId} ↔ System: {selectedSystem.orderId}
                    </p>
                  </div>
                  <Button onClick={() => handleManualMatch(selectedMpesa.id, selectedSystem.id)}>
                    <Link2 className="h-4 w-4 mr-2" />
                    Match Transactions
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Unmatched Tab */}
        <TabsContent value="unmatched" className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Unmatched Transactions</AlertTitle>
            <AlertDescription>
              These transactions have no corresponding match. Review for potential issues or manual intervention.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            {mpesaTransactions
              .filter((t) => !t.reconciled)
              .map((transaction) => (
                <Card key={transaction.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">Unmatched</Badge>
                          <span className="font-mono text-sm">{transaction.transactionId}</span>
                        </div>
                        <div className="grid gap-2 text-sm md:grid-cols-4">
                          <div>
                            <p className="text-muted-foreground">Amount</p>
                            <p className="font-semibold">{formatCurrency(transaction.amount)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Phone</p>
                            <p>{formatPhoneNumber(transaction.phoneNumber)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Reference</p>
                            <p>{transaction.accountReference}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Date</p>
                            <p>{transaction.transactionDate.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        Investigate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};