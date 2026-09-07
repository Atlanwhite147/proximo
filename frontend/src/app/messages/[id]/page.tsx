'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { ErrorMessage, Spinner } from '@/components/Feedback';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { Conversation, Message } from '@/lib/types';
import { RequireAccount } from '@/components/RequireAccount';


/**
 * Fil de discussion : affichage, envoi, rafraîchissement périodique
 * (5 s) et marquage des messages reçus comme lus.
 */
export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<Conversation['otherUser'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    try {
      const data = await api<{ conversationId: string; messages: Message[] }>(
        `/messages/${id}`,
      );
      setMessages(data.messages);
      // Marque comme lus (fait par l'API) — met à jour l'aperçu.
      const conversations = await api<{ conversations: Conversation[] }>('/messages');
      const conversation = conversations.conversations.find((c) => c.id === id);
      if (conversation) setOtherUser(conversation.otherUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversation inaccessible');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/connexion?next=/messages');
      return;
    }
    void loadMessages();
    const timer = setInterval(() => void loadMessages(), 5_000);
    return () => clearInterval(timer);
  }, [authLoading, user, id, loadMessages, router]);

  // Défilement automatique vers le bas.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      await api('/messages', {
        method: 'POST',
        body: JSON.stringify({ recipientId: otherUser?.id, content: trimmed }),
      });
      setContent('');
      await loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible');
    } finally {
      setSending(false);
    }
  };

  if (loading || authLoading) return <Spinner label="Chargement de la conversation…" />;

  if (!otherUser) {
    return (
      <div className="space-y-4">
        <ErrorMessage message={error ?? 'Conversation introuvable'} />
        <Link href="/messages" className="text-sm font-medium text-brand-600 hover:underline">
          ← Retour aux conversations
        </Link>
      </div>
    );
  }

  return (
    <RequireAccount>
    <div className="mx-auto flex max-w-2xl flex-col space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/messages" className="text-sm font-medium text-brand-600 hover:underline">
          ← Conversations
        </Link>
        <h1 className="text-lg font-bold text-slate-900">
          {otherUser.firstName}
          {otherUser.neighborhood ? (
            <span className="ml-2 text-sm font-normal text-slate-400">
              📍 {otherUser.neighborhood}
            </span>
          ) : null}
        </h1>
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="flex h-[60vh] flex-col ds-card">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              Envoyez le premier message !
            </p>
          ) : (
            messages.map((message) => {
              const mine = message.senderId === user?.id;
              return (
                <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                      mine
                        ? 'rounded-br-md bg-brand-600 text-white'
                        : 'rounded-bl-md bg-slate-100 text-slate-800'
                    }`}
                  >
                    <p className="whitespace-pre-line break-words">{message.content}</p>
                    <p
                      className={`mt-1 text-right text-[10px] ${
                        mine ? 'text-brand-100' : 'text-slate-400'
                      }`}
                    >
                      {formatDateTime(message.createdAt)}
                      {mine && message.readAt ? ' · lu' : ''}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={(event) => void handleSend(event)} className="flex gap-2 border-t border-slate-200 p-3">
          <input
            type="text"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Votre message…"
            maxLength={2000}
            className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !content.trim()}
            className="btn-primary-sm rounded-xl px-5"
          >
            Envoyer
          </button>
        </form>
      </div>
    </div>
      </RequireAccount>
  );
}
