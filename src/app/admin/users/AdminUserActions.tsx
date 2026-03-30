'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MoreHorizontal, Loader2 } from 'lucide-react';

interface AdminUserActionsProps {
  userId: string;
  currentRole: string;
  currentStatus: string;
}

const ROLES = ['homeowner', 'isp', 'isp_pro', 'system_admin'] as const;

export default function AdminUserActions({ userId, currentRole, currentStatus }: AdminUserActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  // Confirmation dialog state
  const [pending, setPending] = useState<{ body: Record<string, unknown>; label: string } | null>(null);

  const patch = async (body: Record<string, unknown>) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('User updated');
        router.refresh();
      } else {
        toast.error(data.error || 'Failed to update user');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
      setPending(null);
    }
  };

  const confirm = (body: Record<string, unknown>, label: string) => setPending({ body, label });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={loading} className="h-7 w-7">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem asChild>
            <Link href={`/admin/users/${userId}`}>View details</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {currentStatus === 'suspended' ? (
            <DropdownMenuItem onClick={() => confirm({ status: 'active' }, 'Activate this account?')}>
              Activate account
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => confirm({ status: 'suspended' }, `Suspend this account? Their active session will be ended immediately.`)}
              className="text-destructive focus:text-destructive"
            >
              Suspend account
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <div className="px-2 py-1 text-xs text-muted-foreground">Change role</div>
          {ROLES.filter((r) => r !== currentRole).map((r) => (
            <DropdownMenuItem
              key={r}
              onClick={() => confirm({ role: r }, `Change role to "${r}"?`)}
            >
              {r}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={!!pending} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm action</AlertDialogTitle>
            <AlertDialogDescription>{pending?.label}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pending && patch(pending.body)}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
