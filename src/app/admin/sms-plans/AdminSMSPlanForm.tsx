'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil } from 'lucide-react';

interface Plan {
  id?: string;
  name: string;
  credits: number;
  price: number;
  validityDays: number;
  active: boolean;
}

interface AdminSMSPlanFormProps {
  plan?: Plan;
}

const defaultPlan: Plan = {
  name: '',
  credits: 100,
  price: 100,
  validityDays: 30,
  active: true,
};

export default function AdminSMSPlanForm({ plan }: AdminSMSPlanFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Plan>(plan ?? defaultPlan);
  const [error, setError] = useState('');

  const isEdit = !!plan?.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = isEdit
        ? `/api/admin/sms-plans?id=${plan.id}`
        : '/api/admin/sms-plans';

      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setOpen(false);
        if (!isEdit) setForm(defaultPlan);
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save plan');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit plan</span>
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Plan
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit SMS Plan' : 'Add SMS Plan'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Plan Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Starter 100"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="credits">Credits</Label>
              <Input
                id="credits"
                type="number"
                min={1}
                value={form.credits}
                onChange={(e) => setForm((f) => ({ ...f, credits: parseInt(e.target.value, 10) || 0 }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price">Price (KES)</Label>
              <Input
                id="price"
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: parseInt(e.target.value, 10) || 0 }))}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="validity">Validity (days)</Label>
            <Input
              id="validity"
              type="number"
              min={1}
              value={form.validityDays}
              onChange={(e) => setForm((f) => ({ ...f, validityDays: parseInt(e.target.value, 10) || 30 }))}
              required
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="active"
              checked={form.active}
              onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
            />
            <Label htmlFor="active">Active (visible to users)</Label>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
