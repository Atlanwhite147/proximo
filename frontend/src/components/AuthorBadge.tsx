"use client";

/**
 * Pastille affichée à côté du nom d'un auteur de rôle AGENCE : elle distingue
 * une réponse officielle de l'agence d'un message de voisin. Le nom de l'agence
 * est repris quand il est connu.
 */
export function AuthorBadge({
  role,
  agencyName,
}: {
  role?: string | null;
  agencyName?: string | null;
}) {
  if (role !== "AGENCE") return null;
  return (
    <span className="ml-2 inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 align-middle text-[11px] font-semibold text-sky-800">
      Agence
      {agencyName ? (
        <span className="ml-1 font-normal text-sky-700">{agencyName}</span>
      ) : null}
    </span>
  );
}
