/*
  Function: Download OSM elements along a way

  Algorithm:
    1. Create rects around the nodes of the reference (done at preprocessing)
    2. Merge the rects until the result would be too large
    3. Do the actual download(s) using the OSM API
*/

import layers from 'josm/layers';
import {Api} from 'josm/api';
import console from 'osm-smoothie/console'
import * as ct from 'osm-smoothie/coordtrans';


function mergeRects(rects, maxArea)
{
  if (rects.length === 0)
    return [];

  let result = [];
  let lastMerged = rects[0];
  let i;
  for (i = 1; i < rects.length; ++i) {
    const merged = {
      minX: Math.min(lastMerged.minX, rects[i].minX),
      minY: Math.min(lastMerged.minY, rects[i].minY),
      maxX: Math.max(lastMerged.maxX, rects[i].maxX),
      maxY: Math.max(lastMerged.maxY, rects[i].maxY)
    }
    const a = ct.getArea(merged.minX, merged.minY, merged.maxX, merged.maxY);
    if (a > maxArea * 1.0e6) {
      result.push(lastMerged);
      lastMerged = rects[i];
    } else {
      lastMerged = merged;
    }
  }
  result.push(lastMerged);

  return result;
}

export function downloadRects(refs, workName, maxArea)
{
  let rects = refs.map((r) => r.boxes).flat();
  let layer = layers.get(workName);
  if (layer) {
    // If we already have it open with elements on it, don't download again
    const bounds = layer.getViewProjectionBounds();
    const minLatLon = ct.webMercatorToLatLon(bounds.getMin().getX(), bounds.getMin().getY());
    const maxLatLon = ct.webMercatorToLatLon(bounds.getMax().getX(), bounds.getMax().getY());
	rects = rects.filter(r => (r.minX < minLatLon.lon || r.maxX > maxLatLon.lon && r.minY < minLatLon.lat && r.maxY > maxLatLon.lat));
  } else {
    layer = layers.addDataLayer(workName);
  }

  const merged = mergeRects(rects, maxArea);
  const layerDSet = layer.getDataSet();

  let i = 1;
  merged.forEach((rect) => {
    console.info(`Downloading rect ${i++} of ${merged.length} @ ${JSON.stringify(rect)}`);
    const dset = Api.downloadArea({
      min: { lat: rect.minY, lon: rect.minX },
      max: { lat: rect.maxY, lon: rect.maxX }
    });
    layerDSet.mergeFrom(dset);
  });
}
