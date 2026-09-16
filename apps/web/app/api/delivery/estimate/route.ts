import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const EstimateSchema = z.object({
  county: z.string().trim().min(1).max(80),
  town: z.string().trim().min(1).max(120),
  address: z.string().trim().min(2).max(240)
});

const FALLBACK_FEE = 250;

function fallbackEstimate() {
  return {
    source: "local-estimate" as const,
    formattedAddress: null,
    distanceKm: null,
    durationMinutes: null,
    deliveryFee: FALLBACK_FEE,
    message: "We will confirm the exact delivery charge with you before dispatch."
  };
}

export async function POST(request: NextRequest) {
  try {
    const input = EstimateSchema.parse(await request.json());
    const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;

    if (!apiKey) return NextResponse.json(fallbackEstimate());

    const destination = `${input.address}, ${input.town}, ${input.county}, Kenya`;
    const origin = process.env.DANTOWN_DELIVERY_ORIGIN || "Dantown Electrical, Kitale, Kenya";
    const geocodeUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    geocodeUrl.searchParams.set("address", destination);
    geocodeUrl.searchParams.set("region", "ke");
    geocodeUrl.searchParams.set("key", apiKey);

    const geocodeResponse = await fetch(geocodeUrl, { cache: "no-store" });
    if (!geocodeResponse.ok) throw new Error("Google location lookup failed.");
    const geocode = await geocodeResponse.json() as {
      status: string;
      results?: Array<{ formatted_address: string; geometry: { location: { lat: number; lng: number } } }>;
    };
    const result = geocode.results?.[0];
    if (geocode.status !== "OK" || !result) {
      return NextResponse.json({ error: "We could not find that location. Add a nearby landmark, estate, or town." }, { status: 422 });
    }

    const routesResponse = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters"
      },
      body: JSON.stringify({
        origin: { address: origin },
        destination: {
          location: {
            latLng: {
              latitude: result.geometry.location.lat,
              longitude: result.geometry.location.lng
            }
          }
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE"
      }),
      cache: "no-store"
    });
    if (!routesResponse.ok) throw new Error("Google route lookup failed.");
    const routes = await routesResponse.json() as {
      routes?: Array<{ distanceMeters?: number; duration?: string }>;
    };
    const route = routes.routes?.[0];
    if (!route?.distanceMeters) throw new Error("Google returned no route.");

    const distanceKm = Math.round((route.distanceMeters / 1000) * 10) / 10;
    const durationMinutes = Math.max(1, Math.round(Number.parseFloat(route.duration?.replace("s", "") || "0") / 60));
    const baseFee = Number(process.env.DELIVERY_BASE_FEE_KES || FALLBACK_FEE);
    const ratePerKm = Number(process.env.DELIVERY_RATE_PER_KM_KES || 25);
    const deliveryFee = Math.max(FALLBACK_FEE, Math.ceil((baseFee + distanceKm * ratePerKm) / 50) * 50);

    return NextResponse.json({
      source: "google" as const,
      formattedAddress: result.formatted_address,
      distanceKm,
      durationMinutes,
      deliveryFee,
      message: "Estimated from Google Maps. Final timing can change with traffic and road conditions."
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter a complete delivery location." }, { status: 400 });
    }
    console.error("Delivery estimate failed:", error);
    return NextResponse.json(fallbackEstimate());
  }
}
