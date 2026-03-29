'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Shield,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  Wifi,
  Terminal,
} from 'lucide-react';

interface VpnStatus {
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'pending' | 'failed' | 'setup';
  assignedVPNIP?: string | null;
  lastHandshake?: string | Date | null;
  provisionedAt?: string | Date | null;
}

interface VpnTabProps {
  routerId: string;
  vpnTunnel: VpnStatus;
}

const statusVariant = (
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (status === 'connected') return 'default';
  if (status === 'pending' || status === 'setup') return 'secondary';
  if (status === 'failed') return 'destructive';
  return 'outline';
};

const formatDate = (value: string | Date | null | undefined) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function VpnTab({ routerId, vpnTunnel }: VpnTabProps) {
  const [loading, setLoading] = useState(false);
  const [script, setScript] = useState<string | null>(null);
  const [vpnIP, setVpnIP] = useState<string | null>(vpnTunnel.assignedVPNIP ?? null);
  const [copied, setCopied] = useState(false);

  const fetchScript = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/routers/${routerId}/vpn-config`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to retrieve VPN configuration');
      }

      setScript(data.script);
      setVpnIP(data.vpnIP);
      toast.success('VPN setup script retrieved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load VPN configuration');
    } finally {
      setLoading(false);
    }
  };

  const copyScript = async () => {
    if (!script) return;
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      toast.success('Script copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy — please select and copy manually');
    }
  };

  const isConfigured = vpnTunnel.enabled && vpnTunnel.status !== 'pending';

  return (
    <div className="space-y-4">
      {/* Status card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            VPN Tunnel Status
          </CardTitle>
          <CardDescription>
            WireGuard tunnel for secure remote management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={statusVariant(vpnTunnel.status)} className="capitalize">
              {vpnTunnel.status}
            </Badge>
          </div>
          {vpnIP && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">VPN IP</span>
              <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{vpnIP}</code>
            </div>
          )}
          {vpnTunnel.lastHandshake && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Last Handshake
              </span>
              <span className="text-sm">{formatDate(vpnTunnel.lastHandshake)}</span>
            </div>
          )}
          {vpnTunnel.provisionedAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Wifi className="h-3 w-3" /> Provisioned
              </span>
              <span className="text-sm">{formatDate(vpnTunnel.provisionedAt)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="h-4 w-4" />
            Restore VPN Configuration
          </CardTitle>
          <CardDescription>
            Re-apply your existing VPN setup to a reset or replacement router without starting
            over from scratch.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConfigured ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                VPN has not been configured for this router yet. Complete the initial VPN setup
                from the Add Router wizard.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  The script contains your router's private key.{' '}
                  <strong>Do not share it.</strong> Run it only in your router's terminal
                  (Winbox → New Terminal).
                </AlertDescription>
              </Alert>

              <Button onClick={fetchScript} disabled={loading} className="w-full">
                {loading ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Terminal className="mr-2 h-4 w-4" />
                )}
                {script ? 'Refresh Script' : 'Get Restore Script'}
              </Button>

              {script && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Paste the script below into your router terminal:
                    </p>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={copyScript}>
                      {copied ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-72 overflow-y-auto border">
                    {script}
                  </pre>
                  <p className="text-xs text-muted-foreground">
                    After running the script, wait ~30 seconds then{' '}
                    <strong>sync the router</strong> from the overview page to confirm connectivity.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
