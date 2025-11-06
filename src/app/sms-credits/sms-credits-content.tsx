// src/app/sms-credits/sms-credits-content.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  MessageSquare, 
  CreditCard, 
  Check, 
  Loader2,
  TrendingUp,
  Calendar,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Plan {
  planId: string;
  name: string;
  description: string;
  pricePerCredit: number;
  minimumCredits: number;
  maximumCredits?: number;
  bonusPercentage: number;
  isCustom: boolean;
  features: string[];
}

interface Balance {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  lastPurchaseDate?: string;
  lastPurchaseAmount?: number;
}

export function SMSCreditsContent() {
  const { data: session } = useSession();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Custom amount state (for enterprise plan)
  const [customAmount, setCustomAmount] = useState('');
  const [customCredits, setCustomCredits] = useState(0);

  // Fetch plans and balance
  useEffect(() => {
    fetchPlans();
    fetchBalance();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/sms-credits/plans');
      const data = await res.json();
      
      if (data.success) {
        setPlans(data.plans);
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err);
      setError('Failed to load SMS plans');
    }
  };

  // Calculate custom credits when amount changes
  useEffect(() => {
    const amount = parseFloat(customAmount);
    const enterprisePlan = plans.find(p => p.isCustom);
    
    if (!isNaN(amount) && enterprisePlan && amount >= enterprisePlan.minimumCredits * enterprisePlan.pricePerCredit) {
      const credits = Math.floor(amount / enterprisePlan.pricePerCredit);
      setCustomCredits(credits);
    } else {
      setCustomCredits(0);
    }
  }, [customAmount, plans]);

  const fetchBalance = async () => {
    try {
      const res = await fetch('/api/sms-credits/balance');
      const data = await res.json();
      
      if (data.success) {
        setBalance(data);
      }
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (plan: Plan, credits: number) => {
    setError(null);
    setSuccess(null);
    setPurchasing(plan.planId);

    const amount = credits * plan.pricePerCredit;

    try {
      const response = await fetch('/api/sms-credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: plan.planId,
          customCredits: credits,
          customAmount: amount,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(
          `STK Push sent to your phone! Please enter your M-Pesa PIN to complete the purchase of ${credits} SMS credits.`
        );
        
        // Refresh balance after a few seconds
        setTimeout(() => {
          fetchBalance();
        }, 5000);
      } else {
        setError(data.error || 'Failed to initiate payment');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Purchase error:', err);
    } finally {
      setPurchasing(null);
    }
  };

  const handleCustomPurchase = async () => {
    const amount = parseFloat(customAmount);
    const enterprisePlan = plans.find(p => p.isCustom);
    
    if (!enterprisePlan) {
      setError('Enterprise plan not available');
      return;
    }

    const minimumAmount = enterprisePlan.minimumCredits * enterprisePlan.pricePerCredit;
    
    if (isNaN(amount) || amount < minimumAmount) {
      setError(`Minimum amount for custom purchase is KES ${minimumAmount.toFixed(2)}`);
      return;
    }

    setError(null);
    setSuccess(null);
    setPurchasing('enterprise');

    try {
      const response = await fetch('/api/sms-credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: enterprisePlan.planId,
          customAmount: amount,
          customCredits: customCredits,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(
          `STK Push sent to your phone! Please enter your M-Pesa PIN to complete the purchase of ${customCredits} SMS credits.`
        );
        
        // Clear custom amount
        setCustomAmount('');
        
        // Refresh balance after a few seconds
        setTimeout(() => {
          fetchBalance();
        }, 5000);
      } else {
        setError(data.error || 'Failed to initiate payment');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Purchase error:', err);
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isLowBalance = balance && balance.balance < 10;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">SMS Credits</h1>
        <p className="text-muted-foreground mt-1">
          Purchase SMS credits to send notifications to your customers
        </p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            {success}
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Current Balance Card */}
      <Card className={cn(isLowBalance && 'border-orange-500')}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Current Balance
            {isLowBalance && (
              <Badge variant="destructive" className="ml-auto">
                Low Balance
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Your available SMS credits for sending messages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Available</p>
              <p className="text-3xl font-bold text-primary">
                {balance?.balance || 0}
              </p>
              <p className="text-xs text-muted-foreground">SMS credits</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Total Purchased
              </p>
              <p className="text-2xl font-semibold">
                {balance?.totalPurchased || 0}
              </p>
              <p className="text-xs text-muted-foreground">All time</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                Total Used
              </p>
              <p className="text-2xl font-semibold">
                {balance?.totalUsed || 0}
              </p>
              <p className="text-xs text-muted-foreground">SMS sent</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Last Purchase
              </p>
              <p className="text-2xl font-semibold">
                {balance?.lastPurchaseAmount || 0}
              </p>
              <p className="text-xs text-muted-foreground">
                {balance?.lastPurchaseDate 
                  ? new Date(balance.lastPurchaseDate).toLocaleDateString()
                  : 'Never'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Packages */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Purchase Credits</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Choose a plan that suits your needs. All payments are processed via M-Pesa STK Push.
        </p>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.filter(p => !p.isCustom).map((plan) => {
            const credits = plan.minimumCredits;
            const amount = credits * plan.pricePerCredit;
            const isPurchasing = purchasing === plan.planId;
            const isPopular = plan.planId === 'standard'; // Make standard most popular

            return (
              <Card
                key={plan.planId}
                className={cn(
                  'relative',
                  isPopular && 'border-primary shadow-lg'
                )}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary">Most Popular</Badge>
                  </div>
                )}

                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {plan.name}
                  </CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-bold text-foreground">
                      KES {amount.toLocaleString()}
                    </span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">SMS Credits</span>
                      <span className="font-semibold text-lg text-primary">
                        {credits.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm border-t pt-2">
                      <span className="font-medium">Rate per SMS</span>
                      <span className="text-sm font-semibold">
                        KES {plan.pricePerCredit.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {plan.features.map((feature, idx) => (
                      <p key={idx} className="text-xs text-muted-foreground flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-600" />
                        {feature}
                      </p>
                    ))}
                  </div>

                  <Button
                    onClick={() => handlePurchase(plan, credits)}
                    disabled={isPurchasing}
                    className="w-full"
                    variant={isPopular ? 'default' : 'outline'}
                  >
                    {isPurchasing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Buy {credits.toLocaleString()} Credits
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Enterprise / Custom Amount Section */}
      {plans.filter(p => p.isCustom).map(enterprisePlan => {
        const minimumAmount = enterprisePlan.minimumCredits * enterprisePlan.pricePerCredit;
        const isPurchasing = purchasing === enterprisePlan.planId;

        return (
          <Card key={enterprisePlan.planId} className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {enterprisePlan.name}
                <Badge variant="outline" className="ml-auto">
                  Best Rate - KES {enterprisePlan.pricePerCredit.toFixed(2)}/SMS
                </Badge>
              </CardTitle>
              <CardDescription>
                {enterprisePlan.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customAmount">Amount (KES)</Label>
                <Input
                  id="customAmount"
                  type="number"
                  min={minimumAmount}
                  step={100}
                  placeholder={`Enter amount (minimum KES ${minimumAmount.toLocaleString()})`}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="text-lg"
                />
              </div>

              {customAmount && parseFloat(customAmount) >= minimumAmount && (
                <div className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">SMS Credits</span>
                    <span className="font-semibold text-xl text-primary">
                      {customCredits.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm border-t pt-2">
                    <span className="font-medium">Rate per SMS</span>
                    <span className="text-sm font-semibold">
                      KES {enterprisePlan.pricePerCredit.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    Total: KES {parseFloat(customAmount).toLocaleString()} for {customCredits.toLocaleString()} SMS
                  </p>
                </div>
              )}

              {customAmount && parseFloat(customAmount) < minimumAmount && parseFloat(customAmount) > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Minimum amount for {enterprisePlan.name} is KES {minimumAmount.toLocaleString()}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-1 pt-2">
                {enterprisePlan.features.map((feature, idx) => (
                  <p key={idx} className="text-xs text-muted-foreground flex items-center gap-1">
                    <Check className="h-3 w-3 text-green-600" />
                    {feature}
                  </p>
                ))}
              </div>

              <Button
                onClick={handleCustomPurchase}
                disabled={!customAmount || parseFloat(customAmount) < minimumAmount || isPurchasing}
                className="w-full"
                size="lg"
              >
                {isPurchasing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Purchase {customCredits > 0 ? `${customCredits.toLocaleString()} Credits` : 'Custom Amount'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        );
      })}

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
              1
            </div>
            <div>
              <p className="font-medium">Select a package</p>
              <p className="text-muted-foreground">Choose the SMS credits package that fits your needs</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
              2
            </div>
            <div>
              <p className="font-medium">Complete payment via M-Pesa</p>
              <p className="text-muted-foreground">You'll receive an STK Push prompt on your phone</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
              3
            </div>
            <div>
              <p className="font-medium">Credits added instantly</p>
              <p className="text-muted-foreground">Your SMS credits will be added to your account immediately after payment</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
