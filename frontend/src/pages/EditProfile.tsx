import { useMemo, useState } from 'react';

import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const EditProfile = () => {
  const { user } = useAuth();
  const metadata = user?.user_metadata ?? {};

  const initialValues = useMemo(
    () => ({
      fullName: metadata.full_name ?? metadata.name ?? '',
      preferredName: metadata.preferred_name ?? '',
      bio: metadata.bio ?? '',
    }),
    [metadata.bio, metadata.full_name, metadata.name, metadata.preferred_name],
  );

  const [fullName, setFullName] = useState(initialValues.fullName);
  const [preferredName, setPreferredName] = useState(initialValues.preferredName);
  const [bio, setBio] = useState(initialValues.bio);
  const [saving, setSaving] = useState(false);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      data: {
        ...metadata,
        full_name: fullName.trim(),
        preferred_name: preferredName.trim(),
        bio: bio.trim(),
      },
    });

    setSaving(false);

    if (error) {
      toast({
        title: 'Profile update failed',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Profile updated',
      description: 'Your account details were saved successfully.',
    });
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="glass-card rounded-3xl p-6 md:p-8">
          <h1 className="text-2xl font-bold text-foreground">Edit Profile</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Update the details tied to your Emoiva account.
          </p>
        </div>

        <form onSubmit={handleSave} className="glass-card space-y-5 rounded-3xl p-6 md:p-8">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Email</label>
            <Input value={user?.email ?? ''} readOnly className="h-12 rounded-xl opacity-80" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Full name</label>
            <Input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Arpit Shivhare"
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Preferred name</label>
            <Input
              value={preferredName}
              onChange={(event) => setPreferredName(event.target.value)}
              placeholder="Arpit"
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Short bio</label>
            <Textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="A short note about you or how you use Emoiva."
              className="min-h-32 rounded-2xl"
            />
          </div>

          <Button type="submit" variant="hero" size="lg" disabled={saving} className="w-full md:w-auto">
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </form>
      </div>
    </AppLayout>
  );
};

export default EditProfile;
