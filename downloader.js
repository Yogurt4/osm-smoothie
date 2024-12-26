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
  let i;
  for (i = 1; i < rects.length; ++i) {
    const merged = {
      minX: Math.min(rects[i - 1].minX, rects[i].minX),
      minY: Math.min(rects[i - 1].minY, rects[i].minY),
      maxX: Math.max(rects[i - 1].maxX, rects[i].maxX),
      maxY: Math.max(rects[i - 1].maxY, rects[i].maxY)
    };
    const a = ct.getArea(merged.minX, merged.minY, merged.maxX, merged.maxY);
    if (a <= maxArea * 1.0e6)
      rects[i] = merged;
    else
      result.push(rects[i - 1]);
  }
  result.push(rects.at(-1));

  return result;
}

export function downloadRects(refs, workName, maxArea)
{
  const rects = refs.map((r) => r.bbox);
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
