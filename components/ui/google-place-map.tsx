import type { GooglePlace } from "@/lib/google-place";

export function GooglePlaceMap({ place, address, title, className }: {
  place?: GooglePlace; address?: string; title: string; className?: string;
}) {
  const destination = place?.address || address || place?.name;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;
  if (!destination && !(place && key)) return null;
  const query = place && key ? `place_id:${place.id}` : destination ?? "";
  const params = new URLSearchParams({ q: query });
  let src: string;
  if (key) {
    params.set("key", key);
    src = `https://www.google.com/maps/embed/v1/place?${params}`;
  } else {
    if (place?.coordinates) params.set("q", `${place.coordinates.latitude},${place.coordinates.longitude}`);
    params.set("output", "embed");
    src = `https://maps.google.com/maps?${params}`;
  }
  return <iframe title={title} src={src} loading="lazy" allowFullScreen
    referrerPolicy="no-referrer-when-downgrade"
    className={`min-h-52 w-full rounded-xl border border-border-subtle ${className ?? ""}`} />;
}

export function GooglePlaceReviews({ place, spanish = false }: { place: GooglePlace; spanish?: boolean }) {
  if (!place.reviews.length) return null;
  return <section className="space-y-3">
    <h3 className="font-semibold text-ink">{spanish ? "Reseñas de Google Maps" : "Avaliações do Google Maps"}</h3>
    <ul className="space-y-2">
      {place.reviews.map((review, index) => <li key={review.url ?? index} className="rounded-xl border border-border-subtle bg-surface p-3 text-sm">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-secondary">
          {review.authorUrl ? <a className="font-semibold text-ink underline" href={review.authorUrl} target="_blank" rel="noreferrer">{review.author}</a>
            : <span className="font-semibold text-ink">{review.author}</span>}
          {review.rating != null && <span>★ {review.rating}/5</span>}
          {review.published && <span className="text-xs">{review.published}</span>}
        </div>
        {review.text && <p className="mt-1 whitespace-pre-wrap break-words">{review.text}</p>}
        {review.url && <a href={review.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold underline">Google Maps</a>}
      </li>)}
    </ul>
  </section>;
}

