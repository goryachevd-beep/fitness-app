import { useState } from 'react';
import { X, User, Upload, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { CurrentUser } from '@/lib/useAuthUser';

interface Props {
  open: boolean;
  onClose: () => void;
  user: CurrentUser;
  onSaved: () => void;
}

export default function ProfileSettingsModal({ open, onClose, user, onSaved }: Props) {
  const [name, setName] = useState(user.displayName);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('progress-photos')
        .upload(fileName, file, { contentType: file.type });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('progress-photos').getPublicUrl(fileName);
      setAvatarUrl(urlData.publicUrl);
    } catch {
      // user can retry
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (user.profile) {
        await supabase
          .from('profiles')
          .update({
            full_name: name || null,
            avatar_url: avatarUrl || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.profile.id);
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const initials = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-brand-300" />
            <h3 className="text-lg font-bold text-white">Профиль</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Avatar preview */}
        <div className="mt-5 flex flex-col items-center gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Аватар" className="h-20 w-20 rounded-full object-cover border-2 border-brand-500/40" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-500/15 text-2xl font-extrabold text-brand-300 border-2 border-brand-500/40">
              {initials}
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-brand-500/50 hover:text-brand-300">
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Загрузка...' : 'Загрузить фото'}
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </label>
        </div>

        {/* Display name */}
        <div className="mt-5">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Отображаемое имя
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Введите имя"
            className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-brand-500"
          />
        </div>

        {/* Avatar URL (advanced) */}
        <div className="mt-3">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            URL аватара
          </label>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-ink-600 bg-ink-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-brand-500"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 font-bold text-ink-950 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}
