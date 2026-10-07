CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_key text NOT NULL UNIQUE,
  osm_id text,
  wikidata_id text,
  name text NOT NULL,
  locality text,
  city text,
  district text,
  state text,
  country text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  geog geography(Point, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS places_geog_idx ON places USING GIST (geog);

CREATE TABLE IF NOT EXISTS etymology_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_key text NOT NULL UNIQUE,
  summary text NOT NULL,
  source_url text NOT NULL,
  source_text_hash text NOT NULL,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
