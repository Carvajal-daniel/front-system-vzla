export interface GooglePlace {
  id: string;
  name: string;
  address: string;
  coordinates: { latitude: number; longitude: number } | null;
  rating: number | null;
  reviewsCount: number | null;
  mapsUrl: string | null;
  reviews: {
    rating: number | null;
    text: string;
    published: string;
    url: string | null;
    author: string;
    authorUrl: string | null;
  }[];
}

type GooglePlaceStatus = "not_configured" | "not_linked" | "not_found" | "unavailable";
export type LinkedGooglePlace = { status: "ready"; place: GooglePlace } | { status: GooglePlaceStatus; message?: string };
export type GooglePlaceSearch = { status: "ready"; places: GooglePlace[] } | { status: GooglePlaceStatus; message?: string };

export function googleDirections(place?: GooglePlace, fallbackUrl?: string | null, address?: string) {
  if (!place && fallbackUrl) return fallbackUrl;
  if (!place && !address) return null;
  const params = new URLSearchParams({ api: "1", destination: place?.address || place?.name || address || place?.id || "" });
  if (place) params.set("destination_place_id", place.id);
  return `https://www.google.com/maps/dir/?${params}`;
}

