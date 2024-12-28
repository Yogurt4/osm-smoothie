/*
  Function: Preprocess reference polylines from the current selection

  What is done in getReference():
    1. Get selected ways from the reference layer
    2. Verify if only a single ref is selected
    3. Try to order the selected ways to minimise downloads

  What is done in buildFinder():
    1. Convert from LatLon objects to lat and lon values.
    2. Calculate bounding boxes to speed up searches
    3. Calculate buffer zones around nodes for download
*/

import layers from 'josm/layers';
import console from 'osm-smoothie/console'
import * as ct from 'osm-smoothie/coordtrans';


export function getReference(refName, refTag)
{
  const refLayer = layers.get(refName);
  if (!refLayer) {
    console.error(`Reference layer ${refName} not found.`);
    return { refWays: [] };
  }

  const ds = refLayer.getDataSet();
  let ref;
  let selWays = [];
  for (const way of ds.getSelectedWays()) {
    const currRef = way.get(refTag);
    if (!ref && currRef) {
      ref = currRef;
    } else if (ref !== currRef) {
      console.warn(`Ref mismatch in selection: ${ref} / ${currRef}`);
      continue;
    }

    selWays.push(way);
  }

  // Multiple selection may be scattered so we order them to minimise downloads
  selWays.sort((a, b) => {
    const ca1 = a.firstNode().getCoor();
    const ca2 = a.lastNode().getCoor();
    const cb1 = b.firstNode().getCoor();
    const cb2 = b.lastNode().getCoor();
    let mina = ca1;
    if (ca2.lon() < ca1.lon())
      mina = ca2;
    let minb = cb1;
    if (cb2.lon() < cb1.lon())
      minb = cb2;
    if (mina.lon() !== minb.lon())
      return mina.lon() - minb.lon();
    return mina.lat() - minb.lat();
  });

  let i;
  let ordered = [];
  let visited = new Set();
  let currentWay = selWays[0];
  let currentEnd;
  if (currentWay.firstNode().getCoor().lon() > currentWay.lastNode().getCoor().lon())
    currentEnd = currentWay.firstNode().getUniqueId();
  else
    currentEnd = currentWay.lastNode().getUniqueId();
  for ( ; currentWay; ) {
    ordered.push(currentWay);
    visited.add(currentWay.getUniqueId());

    let nextWay;
    // Check if we can find a segment whose startId matches currentSegment's endId
    for (i = 0; i < selWays.length; ++i) {
      if (visited.has(selWays[i].getUniqueId()))
        continue;

      if (currentEnd === selWays[i].firstNode().getUniqueId()) {
        // Normal chaining: current end matches next start
        nextWay = selWays[i];
        currentEnd = selWays[i].lastNode().getUniqueId();
        break;
      }
      if (currentEnd === selWays[i].lastNode().getUniqueId()) {
        // Reverse chaining: current end matches next end
        nextWay = selWays[i];
        currentEnd = selWays[i].firstNode().getUniqueId();
        break;
      }
    }
    if (!nextWay) {
      // If no matching link found, proceed to the next unvisited
      for (i = 0; i < selWays.length; ++i) {
        if (!visited.has(selWays[i].getUniqueId())) {
          nextWay = selWays[i];
          if (nextWay.firstNode().getCoor().lon() > nextWay.lastNode().getCoor().lon())
            currentEnd = nextWay.firstNode().getUniqueId();
          else
            currentEnd = nextWay.lastNode().getUniqueId();
          break;
        }
      }
    }
    currentWay = nextWay;
  }

  return { ref, refWays: ordered };
}

function getBBox(nodes)
{
  let minX = 1.0e30;
  let minY = 1.0e30;
  let maxX = -1.0e30;
  let maxY = -1.0e30;
  let i;
  for (i = 0; i < nodes.length; ++i) {
    minX = Math.min(minX, nodes[i].lon);
    minY = Math.min(minY, nodes[i].lat);
    maxX = Math.max(maxX, nodes[i].lon);
    maxY = Math.max(maxY, nodes[i].lat);
  }

  return { minX, minY, maxX, maxY };
}

export function buildFinder(refWays, bufferWidth, maxArea)
{
  let refs = [];
  for (const way of refWays) {
    const nodes = [];
    way.getNodes().forEach((node) => {
      const coordinates = node.getCoor();
      nodes.push({ lat: coordinates.lat(), lon: coordinates.lon()});
    });

    const boxes = [];
    let start = 0;
    let end = nodes.length;
    for ( ; start < nodes.length; ) {
      if (start === end) {
        end = nodes.length;
        continue;
      }
      if (start + 1 === end) {
        console.error('Too long segment in the reference.');
        break;
      }

      const bbox = ct.bufferRect(getBBox(nodes.slice(start, end)), bufferWidth);
      const a = ct.getArea(bbox.minX, bbox.minY, bbox.maxX, bbox.maxY);
      if (a < maxArea * 1.0e6) {
        boxes.push(bbox);
        start = end;
      } else {
        end = Math.floor((start + end) / 2);
      }
    }

    refs.push({ bbox: ct.bufferRect(getBBox(nodes), bufferWidth), nodes, boxes });
  }

  return refs;
}
