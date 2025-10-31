// components/messages/send-message-form.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Loader2, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface Router {
  id: string;
  name: string;
  customerCount: number;
}

interface Template {
  id: string;
  name: string;
  category: string;
  message: string;
  variables: string[];
  isSystem: boolean;
  usageCount: number;
}

interface SendMessageFormProps {
  routers: Router[];
  totalCustomers: number;
  templates: Template[];
}

export function SendMessageForm({ routers, totalCustomers, templates }: SendMessageFormProps) {
  const [recipientType, setRecipientType] = useState<'all' | 'router'>('all');
  const [selectedRouterId, setSelectedRouterId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('none');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  const selectedRouter = routers.find((r) => r.id === selectedRouterId);
  const recipientCount = recipientType === 'all' 
    ? totalCustomers 
    : selectedRouter?.customerCount || 0;

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId && templateId !== 'none') {
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        setMessage(template.message);
      }
    } else {
      setMessage('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (recipientType === 'router' && !selectedRouterId) {
      toast.error('Please select a router');
      return;
    }

    setIsSending(true);
    setSendResult(null);

    try {
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientType,
          routerId: recipientType === 'router' ? selectedRouterId : undefined,
          templateId: selectedTemplateId && selectedTemplateId !== 'none' ? selectedTemplateId : undefined,
          message: message.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setSendResult({
        success: true,
        message: `Message sent successfully to ${data.sentCount} customer${data.sentCount !== 1 ? 's' : ''}`,
      });

      toast.success(`Message sent to ${data.sentCount} customer${data.sentCount !== 1 ? 's' : ''}`);

      // Reset form
      setMessage('');
      setRecipientType('all');
      setSelectedRouterId('');
      setSelectedTemplateId('none');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      setSendResult({
        success: false,
        message: errorMessage,
      });

      toast.error(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Send Message
        </CardTitle>
        <CardDescription>
          Compose and send messages to your WiFi customers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Recipient Selection */}
          <div className="space-y-3">
            <Label>Select Recipients</Label>
            <RadioGroup value={recipientType} onValueChange={(value) => setRecipientType(value as 'all' | 'router')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="font-normal cursor-pointer">
                  All Customers ({totalCustomers})
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="router" id="router" />
                <Label htmlFor="router" className="font-normal cursor-pointer">
                  Customers from specific router
                </Label>
              </div>
            </RadioGroup>

            {recipientType === 'router' && (
              <div className="ml-6 mt-3">
                <Select value={selectedRouterId} onValueChange={setSelectedRouterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a router" />
                  </SelectTrigger>
                  <SelectContent>
                    {routers.map((router) => (
                      <SelectItem key={router.id} value={router.id}>
                        {router.name} ({router.customerCount} customers)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">{recipientCount}</span> customer
                {recipientCount !== 1 ? 's' : ''} will receive this message
              </p>
            </div>
          </div>

          {/* Template Selection */}
          {templates.length > 0 && (
            <div className="space-y-3">
              <Label htmlFor="template">Use a Template (Optional)</Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template or write your own" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template (custom message)</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>{template.name}</span>
                        {template.isSystem && (
                          <span className="text-xs text-muted-foreground">(System)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Message Input */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="message">Message</Label>
              <span className="text-xs text-muted-foreground">
                {message.length}/160 characters
              </span>
            </div>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 160))}
              placeholder="Enter your message here..."
              className="min-h-[120px] resize-none"
              maxLength={160}
            />
            <p className="text-xs text-muted-foreground">
              Keep messages concise. SMS is limited to 160 characters.
            </p>
          </div>

          {/* Send Result */}
          {sendResult && (
            <div
              className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
                sendResult.success
                  ? 'bg-green-50 text-green-900 dark:bg-green-900/10 dark:text-green-400'
                  : 'bg-red-50 text-red-900 dark:bg-red-900/10 dark:text-red-400'
              }`}
            >
              {sendResult.success ? (
                <CheckCircle className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <p>{sendResult.message}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button type="submit" disabled={isSending || !message.trim()} className="w-full">
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Message to {recipientCount} Customer{recipientCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
