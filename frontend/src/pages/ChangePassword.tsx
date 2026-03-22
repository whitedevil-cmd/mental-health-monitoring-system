import { useState } from 'react';

import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

const ChangePassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password.length < 8) {
      toast({
        title: 'Password too short',
        description: 'Use at least 8 characters for your new password.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Re-enter the same password in both fields.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      toast({
        title: 'Password update failed',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setPassword('');
    setConfirmPassword('');
    toast({
      title: 'Password updated',
      description: 'Your Emoiva account password has been changed.',
    });
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="glass-card rounded-3xl p-6 md:p-8">
          <h1 className="text-2xl font-bold text-foreground">Change Password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Update your password while signed in. If you lose access later, you can still use the
            forgot password flow from login.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card space-y-5 rounded-3xl p-6 md:p-8">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">New password</label>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Confirm new password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat the new password"
              minLength={8}
              required
              className="h-12 rounded-xl"
            />
          </div>

          <Button
            type="submit"
            variant="hero"
            size="lg"
            disabled={saving}
            className="w-full md:w-auto"
          >
            {saving ? 'Updating...' : 'Update password'}
          </Button>
        </form>
      </div>
    </AppLayout>
  );
};

export default ChangePassword;
