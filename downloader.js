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
  let result = [];
  let merged = rects[0];
  let i;
  for (i = 1; i < rects.length; ++i) {
    merged.minX = Math.min(merged.minX, rects[i].minX);
    merged.minY = Math.min(merged.minY, rects[i].minY);
    merged.maxX = Math.max(merged.maxX, rects[i].maxX);
    merged.maxY = Math.max(merged.maxY, rects[i].maxY);
    const a = ct.getArea(merged.minX, merged.minY, merged.maxX, merged.maxY);
    if (a > maxArea * 1.0e6) {
      result.push(merged);
      merged = rects[i];
    }
  }
  if (rects.length === 1 || merged !== rects.at(-1))
    result.push(merged);

  return result;
}

export function downloadRects(refs, workName, maxArea)
{
  const rects = refs.map((r) => r.boxes).flat();
  const merged = mergeRects(rects, maxArea);
  let layer = layers.get(workName);
  if (!layer)
    layer = layers.addDataLayer(workName);
  const layerDSet = layer.getDataSet();

  let i = 1;
  merged.forEach((rect) => {
    console.info(`Downloading rect ${i++} of ${merged.length}`);
    const dset = Api.downloadArea({
      min: { lat: rect.minY, lon: rect.minX },
      max: { lat: rect.maxY, lon: rect.maxX }
    });
    layerDSet.mergeFrom(dset);
  });
}
