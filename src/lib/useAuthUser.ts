import { useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { setCachedProviderToken } from '@/lib/googleFit';
import type { Profile } from '@/lib/types';

export interface CurrentUser {
  /** Best display name: profile override → auth full_name → auth name → profile.name → fallback */
  displayName: string;
  /** Best avatar URL: profile override → auth avatar_url → auth picture → null */
  avatarUrl: string | null;
  /** First letter of display name, uppercase, for initials fallback */
  initials: string;
  /** The auth user object if signed in, null otherwise */
  authUser: User | null;
  /** The profile row from the profiles table */
  profile: Profile | null;
}

function pickAuthName(user: User | null): string | null {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  return meta.full_name ?? meta.name ?? null;
}

function pickAuthAvatar(user: User | null): string | null {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  return meta.avatar_url ?? meta.picture ?? null;
}

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

export function useAuthUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user ?? null;

    if (authUser) {
      const meta = authUser.user_metadata ?? {};
      const fullName = meta.full_name ?? meta.name ?? null;
      const avatarUrl = meta.avatar_url ?? meta.picture ?? null;
      await supabase.from('profiles').upsert(
        {
          id: authUser.id,
          name: fullName ?? authUser.email ?? 'Athlete',
          role: 'athlete',
          full_name: fullName,
          avatar_url: avatarUrl,
        },
        { onConflict: 'id', ignoreDuplicates: true },
      );
    }

    const { data: profiles } = await supabase.from('profiles').select('*');
    const athleteProfile = (profiles as Profile[] | null)?.find((p) => p.role === 'athlete') ?? null;

    const profileName = athleteProfile?.full_name ?? athleteProfile?.name ?? null;
    const authName = pickAuthName(authUser);
    const displayName = profileName ?? authName ?? 'Атлет';

    const profileAvatar = athleteProfile?.avatar_url ?? null;
    const authAvatar = pickAuthAvatar(authUser);
    const avatarUrl = profileAvatar ?? authAvatar ?? null;

    let finalDisplayName = displayName;
    let finalAvatarUrl = avatarUrl;
    let finalInitials = getInitials(displayName);
    let finalProfile = athleteProfile;

    if (authUser?.email === 'demo@forma-app.com') {
      finalDisplayName = 'DEMO';
      finalAvatarUrl = null;
      finalInitials = 'D';
      finalProfile = null;
    }

    setUser({
      displayName: finalDisplayName,
      avatarUrl: finalAvatarUrl,
      initials: finalInitials,
      authUser,
      profile: finalProfile,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setCachedProviderToken(session?.provider_token ?? null);
      (async () => { await load(); })();
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const isDemo = user?.authUser?.email === 'demo@forma-app.com';

  return { user, loading, reload: load, isDemo };
}
