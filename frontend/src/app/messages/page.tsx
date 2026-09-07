'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ErrorMessage, Spinner } from '@/components/Feedback';
import api from '@/lib/api';
import { formatRelativeDate } from '@/lib/format';
import type { Conversation } from '@/lib/types';
import { RequireAccount } from '@/components/RequireAccount';


/**
 * Liste des conversations de l'utilisateur (dernier message + non-lus).
 */
export default function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    api<{ conversations: Conversation[] }>('/messages')
      .then((data) => setConversations(data.conversations))
      .catch((err) => setError(err instanceof Error ? err.message : 'Chargement impossible'))
      .finally(() => setLoading(false));
  }, [authLoading, user]);

  if (authLoading || loading) return <Spinner label="Chargement des conversations…" />;

  if (!user) {
    return (
      <div className="mx-auto max-w-md ds-card p-8 text-center">
        <p className="text-slate-600">Connectez-vous pour accéder à votre messagerie.</p>
        <Link
          href="/connexion?next=/messages"
          className="btn-primary-sm rounded-xl px-5 mt-4"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  if (error) return <ErrorMessage message={error} />;

  return (
    <RequireAccount>
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Mes conversations</h1>

      {conversations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          Aucune conversation pour le moment.
          <br />
          <Link href="/annonces" className="mt-2 inline-block font-medium text-brand-600 hover:underline">
            Découvrir les annonces près de chez vous →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <Link
                href={`/messages/${conversation.id}`}
                className="flex items-center justify-between gap-4 ds-card ds-card-hover p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {conversation.otherUser.firstName}
                    </span>
                    {conversation.otherUser.neighborhood && (
                      <span className="text-xs text-slate-400">
                        📍 {conversation.otherUser.neighborhood}
                      </span>
                    )}
                    {conversation.unreadCount > 0 && (
                      <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
                        {conversation.unreadCount} non lu{conversation.unreadCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-500">
                    {conversation.lastMessage
                      ? `${conversation.lastMessage.senderId === user.id ? 'Vous : ' : ''}${conversation.lastMessage.content}`
                      : 'Dites bonjour !'}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">
                  {conversation.lastMessage
                    ? formatRelativeDate(conversation.lastMessage.createdAt)
                    : formatRelativeDate(conversation.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
      </RequireAccount>
  );
}
