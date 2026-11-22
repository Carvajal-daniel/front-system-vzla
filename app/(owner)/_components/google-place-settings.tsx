"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { GooglePlaceMap, GooglePlaceReviews } from "@/components/ui/google-place-map";
import { CompanyRating } from "@/components/ui/company-rating";
import { apiRequest } from "@/lib/api-client";
import { formatCompanyAddress, type CompanySettings } from "@/lib/company-settings";
import { googleDirections, type GooglePlace, type GooglePlaceSearch } from "@/lib/google-place";
import { useLocale } from "@/lib/i18n/locale-context";
import { saveCompanySettings } from "@/lib/use-company-settings";
import { useGooglePlace } from "@/lib/use-google-place";

export function GooglePlaceSettings({ companyId, settings }: { companyId: string; settings: CompanySettings }) {
  const { locale } = useLocale();
  const es = locale === "es";
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<GooglePlace[]>([]);
  const [preview, setPreview] = useState<GooglePlace>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const request = useRef<AbortController | null>(null);
  const { result, place } = useGooglePlace(companyId, settings.googlePlaceId, { checkConfig: true });
  const location = preview ?? place;
  const address = formatCompanyAddress(settings.address);
  const mapLink = googleDirections(location, settings.googleMapsUrl, address);

  useEffect(() => () => request.current?.abort(), []);

  async function search(text: string, select = false) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setNotice("");
    if (!select) { setCandidates([]); setPreview(undefined); }
    try {
      const response = await apiRequest<GooglePlaceSearch>(`/companies/${encodeURIComponent(companyId)}/google-place/search`, {
        query: { query: text }, signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (response.status === "ready" && response.places.length) {
        if (select || response.places.length === 1 && /^(?:places\/|ChIJ|GhIJ)/.test(text)) {
          setPreview(response.places[0]);
          setCandidates([]);
        } else setCandidates(response.places);
      } else if (response.status === "not_configured") {
        setNotice(es ? "Configura GOOGLE_MAPS_API_KEY en el backend." : "Configure GOOGLE_MAPS_API_KEY no .env do backend.");
      } else if (response.status === "ready" || response.status === "not_found") {
        setNotice(es ? "No se encontraron establecimientos." : "Nenhum estabelecimento encontrado.");
      } else setNotice(es ? "Google Places no está disponible." : "O Google Places está indisponível.");
    } catch {
      if (!controller.signal.aborted) setNotice(es ? "No se pudo completar la búsqueda." : "Não foi possível concluir a busca.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  async function link(id: string | null) {
    setBusy(true);
    setNotice("");
    try {
      await saveCompanySettings(companyId, { googlePlaceId: id });
      setPreview(undefined);
      setCandidates([]);
      setNotice(id ? (es ? "Establecimiento vinculado." : "Estabelecimento vinculado.")
        : (es ? "Vínculo eliminado." : "Vínculo removido."));
    } catch {
      setNotice(es ? "No se pudo guardar el vínculo." : "Não foi possível salvar o vínculo.");
    } finally { setBusy(false); }
  }

  return <div className="space-y-4">
    <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void search(query.trim()); }}>
      <label htmlFor="google-place-query" className="text-sm font-semibold text-ink">
        {es ? "Vincular establecimiento en Google Maps" : "Vincular estabelecimento no Google Maps"}
      </label>
      <div className="flex flex-wrap gap-2 sm:flex-nowrap">
        <input id="google-place-query" className="min-h-11 min-w-0 flex-1 rounded-xl border border-border-strong bg-surface px-3 text-sm"
          placeholder={es ? "Nombre, dirección o Place ID" : "Nome, endereço ou Place ID"} value={query} onChange={(event) => setQuery(event.target.value)}
          required minLength={3} maxLength={255} />
        <Button type="submit" className="min-h-11" disabled={busy || query.trim().length < 3}>{es ? "Buscar" : "Buscar"}</Button>
      </div>
    </form>
    {(notice || result?.status === "not_configured") && <p role="status" className="text-sm text-ink-secondary">
      {notice || (es ? "Configura GOOGLE_MAPS_API_KEY en el backend." : "Configure GOOGLE_MAPS_API_KEY no .env do backend.")}
    </p>}
    {!!candidates.length && <ul className="space-y-2">
      {candidates.map((candidate) => <li key={candidate.id}>
        <button className="block w-full rounded-xl border border-border-subtle p-3 text-left text-sm hover:bg-subtle"
          type="button" disabled={busy} onClick={() => void search(`places/${candidate.id}`, true)}>
          <span className="block font-semibold">{candidate.name}</span>
          <span className="text-ink-secondary">{candidate.address}</span>
          <span className="block text-xs text-ink-secondary">Google Maps</span>
        </button>
      </li>)}
    </ul>}
    {location && <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-ink">{location.name}</p>
        {location.rating != null && <CompanyRating rating={{ average: location.rating, count: location.reviewsCount ?? 0, source: "Google Maps" }} />}
      </div>
      <p className="text-sm text-ink-secondary">{location.address}</p>
      {location.reviewsCount != null && <p className="text-xs text-ink-secondary">{location.reviewsCount} {es ? "reseñas" : "avaliações"}</p>}
    </div>}
    <GooglePlaceMap place={location} address={address} title={es ? "Mapa del establecimiento" : "Mapa do estabelecimento"} />
    <div className="flex flex-wrap items-center gap-3">
      {preview && preview.id !== settings.googlePlaceId && <Button type="button" disabled={busy} className="min-h-10" onClick={() => void link(preview.id)}>
        {es ? "Vincular establecimiento" : "Vincular estabelecimento"}
      </Button>}
      {settings.googlePlaceId && <Button type="button" variant="outline" disabled={busy} className="min-h-10" onClick={() => void link(null)}>
        {es ? "Desvincular" : "Desvincular"}
      </Button>}
      {mapLink && <a href={mapLink} target="_blank" rel="noreferrer" className="text-sm font-semibold underline">
        {es ? "Cómo llegar en Google Maps" : "Como chegar no Google Maps"}
      </a>}
    </div>
    {location && <GooglePlaceReviews place={location} spanish={es} />}
  </div>;
}

