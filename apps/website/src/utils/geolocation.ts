import type {
  CarmenGeojsonFeature,
  MaplibreGeocoderApi,
  MaplibreGeocoderApiConfig,
  MaplibreGeocoderFeatureResults,
} from "@maplibre/maplibre-gl-geocoder";
import { type Map, Marker } from "maplibre-gl";
import config from "../../tailwind.config";

type Address = {
  municipality?: string;
  city?: string;
  town?: string;
  village?: string;
  region?: string;
  state?: string;
  county?: string;
  country?: string;
};

/**
 * Rounds a coordinate to the desired precision
 * @param coord Longitude or Latitude
 * @param precision Any number.
 * @returns The rounded coord. If the precision is bigger than the coord it just returns the unaltered coord.
 */
export const roundCoord = (coord: number, precision: number) => {
  const coordStr = coord.toString();
  if (coordStr.includes(".")) {
    const decimals = coordStr.split(".")[1];
    if (decimals && decimals.length > 0 && decimals.length > precision) {
      return +coord.toFixed(precision);
    }
  }
  return coord;
};

/**
 * Gets a place name from its coordinates
 * @param lat Latitude
 * @param lon Longitude
 * @returns Place name or empty string if it can't find it.
 */
export const reverseSearch = async (lat: number, lon: number) => {
  const request = `https://nominatim.openstreetmap.org/reverse?format=geojson&lat=${lat}&lon=${lon}&addressdetails=1`;
  const response = await fetch(request, {
    method: "GET",
    headers: {
      "User-Agent": "OSS dev (fooji23@proton.me)",
      Referer: "http://localhost:3000",
    },
  });
  if (response.ok) {
    const data = await response.json();
    if (data && data.features) {
      return createAddress(data.features[0].properties.address);
    }
  }

  throw new Error("Couldn't search for that place.");
};

/**
 * Forms a nice looking address from the reverse search info.
 * @param address Result of the {@link https://nominatim.org/release-docs/develop/api/Reverse/|API Call}
 * @see {@link https://nominatim.org/release-docs/develop/api/Output/#addressdetails|Address Details}
 * @returns
 */
const createAddress = (address: Address) => {
  const parts = [];

  if (address.municipality) {
    parts.push(address.municipality);
  } else if (address.city) {
    parts.push(address.city);
  } else if (address.town) {
    parts.push(address.town);
  } else if (address.village) {
    parts.push(address.village);
  }

  if (address.region) {
    parts.push(address.region);
  } else if (address.state) {
    parts.push(address.state);
  } else if (address.county) {
    parts.push(address.county);
  }

  if (address.country) {
    parts.push(address.country);
  }

  return parts.join(", ");
};

const forwardGeocode = async (
  config: MaplibreGeocoderApiConfig,
): Promise<MaplibreGeocoderFeatureResults> => {
  const features: CarmenGeojsonFeature[] = [];
  try {
    const request = `https://nominatim.openstreetmap.org/search?q=${config.query}&format=geojson&polygon_geoData=1&addressdetails=1`;
    const response = await fetch(request);
    const geoData = await response.json();

    for (const feature of geoData.features) {
      const point: CarmenGeojsonFeature = {
        id: feature.properties.placeid,
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [feature.bbox[0], feature.bbox[1]],
        },
        properties: feature.properties,
        place_name: feature.properties.display_name,
        place_type: ["place"],
        text: feature.properties.display_name,
      };
      features.push(point);
    }
  } catch (e) {
    console.error(`Failed to forwardGeocode with error: ${e}`);
  }

  return {
    type: "FeatureCollection",
    features,
  };
};

const reverseGeocode = async (
  config: MaplibreGeocoderApiConfig,
): Promise<MaplibreGeocoderFeatureResults> => {
  const features: CarmenGeojsonFeature[] = [];
  try {
    if (!config.query || config.query.length != 2)
      return { type: "FeatureCollection", features: [] };

    const lon = config.query[0] as number;
    const lat = config.query[1] as number;

    const request = `https://nominatim.openstreetmap.org/reverse?format=geojson&lat=${lat}&lon=${lon}&addressdetails=1`;
    const response = await fetch(request);
    const geoData = await response.json();

    if (geoData && geoData.features) {
      for (const feature of geoData.features) {
        const point: CarmenGeojsonFeature = {
          id: feature.properties.placeid,
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [lon, lat],
          },
          properties: feature.properties,
          place_name: feature.properties.display_name,
          place_type: ["place"],
          text: feature.properties.display_name,
        };
        features.push(point);
      }
    }
  } catch (e) {
    console.error(`Failed to reverseGeocode with error: ${e}`);
  }

  return {
    type: "FeatureCollection",
    features,
  };
};

export const geocoderApi: MaplibreGeocoderApi = {
  forwardGeocode,
  reverseGeocode,
};

/**
 * Generates a default marker in Alveus green on the map and coordinates provided.
 * @param coords
 * @param map
 * @see {@link https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MarkerOptions/#type-declaration|Default Marker Options}
 * @returns Marker
 */
export const getDefaultMarker = (
  coords: { lat: number; lon: number },
  map: Map | null,
) => {
  if (map) {
    const marker = new Marker({
      color: config.theme.colors["alveus-green"].DEFAULT,
      draggable: true,
    })
      .setLngLat(coords)
      .addTo(map);
    return marker;
  }
  return new Marker();
};
