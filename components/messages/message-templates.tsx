// components/messages/message-templates.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Tag, TrendingUp, Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface Template {
  id: string;
  name: string;
  category: string;
  message: string;
  variables: string[];
  isSystem: boolean;
  usageCount: number;
}

interface MessageTemplatesProps {
  templates: Template[];
}

export function MessageTemplates({ templates }: MessageTemplatesProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      service: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      sales: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      promotion: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      billing: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
      general: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
    };
    return colors[category] || colors.general;
  };

  const handleCopyTemplate = (templateId: string, message: string) => {
    navigator.clipboard.writeText(message)
      .then(() => {
        setCopiedId(templateId);
        toast.success('Template copied to clipboard');
        setTimeout(() => setCopiedId(null), 2000); // Reset after 2 seconds
      })
      .catch(() => {
        toast.error('Failed to copy template');
      });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Message Templates
        </CardTitle>
        <CardDescription>
          Pre-made message templates for common scenarios
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex flex-col gap-3 p-4 rounded-lg border hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm mb-1 truncate">{template.name}</h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={getCategoryColor(template.category)}>
                      <Tag className="h-3 w-3 mr-1" />
                      {template.category}
                    </Badge>
                    {template.isSystem && (
                      <Badge variant="outline" className="text-xs">
                        System
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground break-words line-clamp-3">
                {template.message}
              </p>

              {template.variables.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {template.variables.map((variable) => (
                    <code
                      key={variable}
                      className="text-xs bg-muted px-2 py-0.5 rounded"
                    >
                      {`{{${variable}}}`}
                    </code>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  <span>Used {template.usageCount} times</span>
                </div>
                <Button
                  size="sm"
                  variant={copiedId === template.id ? "default" : "outline"}
                  onClick={() => handleCopyTemplate(template.id, template.message)}
                  disabled={copiedId === template.id}
                >
                  {copiedId === template.id ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
