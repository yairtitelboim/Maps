import overpy
import json
import time
import os


def download_taylor_buildings(batch_size=2):
    """
    Download OSM building footprints for Taylor, TX area and write GeoJSON
    to public/data/osm/taylor_buildings.geojson.

    The query fetches building ways/relations and attempts to emit Polygon
    or MultiPolygon features where possible; otherwise emits LineString for
    ways without closure. Designed to match existing POIOSM output patterns
    (FeatureCollection with properties including tags/osm_id/osm_type).
    """
    api = overpy.Overpass(url='https://overpass.kumi.systems/api/interpreter')

    # Taylor, TX approximate bounding box with a small buffer
    # Center ~ (30.572, -97.409). Bounds add ~6-8km margin.
    lat_min, lon_min = 30.50, -97.56  # SW
    lat_max, lon_max = 30.66, -97.26  # NE

    # Partition the bbox to reduce Overpass response size/timeouts
    lat_step = (lat_max - lat_min) / batch_size
    lon_step = (lon_max - lon_min) / batch_size

    features = []

    def make_feature(obj, geometry):
        return {
            "type": "Feature",
            "geometry": geometry,
            "properties": {
                "name": obj.tags.get("name", "Unnamed"),
                "osm_id": obj.id,
                "osm_type": obj.__class__.__name__.lower(),
                "tags": obj.tags,
            },
        }

    def way_to_polygon_coords(nodes):
        # Ensure closure; if first != last, close the ring
        coords = [[float(n.lon), float(n.lat)] for n in nodes]
        if coords and coords[0] != coords[-1]:
            coords.append(coords[0])
        return coords

    max_retries = 3

    for i in range(batch_size):
        for j in range(batch_size):
            chunk_lat_min = lat_min + (i * lat_step)
            chunk_lat_max = lat_min + ((i + 1) * lat_step)
            chunk_lon_min = lon_min + (j * lon_step)
            chunk_lon_max = lon_min + ((j + 1) * lon_step)
            bbox = f"{chunk_lat_min},{chunk_lon_min},{chunk_lat_max},{chunk_lon_max}"

            query = f"""
            [out:json][timeout:300];
            (
              way["building"]({bbox});
              relation["building"]({bbox});
            );
            out body;
            >;
            out skel qt;
            """

            for attempt in range(max_retries):
                try:
                    print(f"Downloading buildings batch {(i*batch_size)+j+1}/{batch_size*batch_size} bbox={bbox}")
                    result = api.query(query)

                    # Ways (typical building footprints)
                    for way in result.ways:
                        try:
                            ring = way_to_polygon_coords(way.nodes)
                            geometry = {
                                "type": "Polygon",
                                "coordinates": [ring],
                            } if len(ring) >= 4 else {
                                "type": "LineString",
                                "coordinates": [[float(n.lon), float(n.lat)] for n in way.nodes],
                            }
                            features.append(make_feature(way, geometry))
                        except Exception as e:
                            print(f"Error processing way {way.id}: {e}")

                    # Relations (multipolygons)
                    for rel in result.relations:
                        try:
                            outer_rings = []
                            inner_rings = []
                            for m in rel.members:
                                if m.role in ("outer", "inner") and hasattr(m, "resolve"):
                                    try:
                                        w = m.resolve()
                                    except Exception:
                                        w = None
                                    if w and hasattr(w, "nodes"):
                                        ring = way_to_polygon_coords(w.nodes)
                                        if m.role == "outer":
                                            outer_rings.append(ring)
                                        else:
                                            inner_rings.append(ring)

                            geometry = None
                            if outer_rings:
                                if len(outer_rings) == 1 and not inner_rings:
                                    geometry = {"type": "Polygon", "coordinates": [outer_rings[0]]}
                                else:
                                    coords = []
                                    for idx, r in enumerate(outer_rings):
                                        holes = [h for h in inner_rings] if idx == 0 else []
                                        coords.append([r] + holes)
                                    geometry = {"type": "MultiPolygon", "coordinates": coords}
                            else:
                                geometry = {"type": "GeometryCollection", "geometries": []}

                            features.append(make_feature(rel, geometry))
                        except Exception as e:
                            print(f"Error processing relation {rel.id}: {e}")

                    break
                except overpy.exception.OverpassGatewayTimeout:
                    if attempt < max_retries - 1:
                        wait = 10 * (2 ** attempt)
                        print(f"Timeout; retrying in {wait}s...")
                        time.sleep(wait)
                        continue
                    else:
                        print("Skipping batch due to repeated timeouts.")
                except Exception as e:
                    print(f"Error querying Overpass: {e}")
                    break

            time.sleep(1)

    # Output GeoJSON
    os.makedirs(os.path.join("public", "data", "osm"), exist_ok=True)
    out_path = os.path.join("public", "data", "osm", "taylor_buildings.geojson")
    with open(out_path, "w") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f)

    print(f"Saved {len(features)} building features to {os.path.abspath(out_path)}")


if __name__ == "__main__":
    download_taylor_buildings()

