/*
  Function: Adjust existing OSM nodes to the reference by
    1. snapping them to nearby reference nodes
    2. moving them perpendicular to a reference segment
    3. inserting additional nodes halfway of OSM segments if necessary
       (repeated until the reference is approximated close enough)
*/

import layers from 'josm/layers';
import console from 'osm-smoothie/console'
import * as ct from 'osm-smoothie/coordtrans';
const LatLon = Java.type('org.openstreetmap.josm.data.coor.LatLon');
const Node = Java.type('org.openstreetmap.josm.data.osm.Node');


function findNearestSegment(x, y, refs)
{
  let minDist = 1.0e30;
  let bestSegment;
  let i, j;
  for (i = 0; i < refs.length; ++i) {
    if (x < refs[i].bbox.minX || x > refs[i].bbox.maxX || y < refs[i].bbox.minY || y > refs[i].bbox.maxY)
      continue;
    const nodes = refs[i].nodes;
    for (j = 1; j < nodes.length; ++j) {
      const dist = ct.getDistFromSegment(x, y, nodes[j - 1].lon, nodes[j - 1].lat, nodes[j].lon, nodes[j].lat);
      if (minDist > dist) {
        minDist = dist;
        bestSegment = {
          x1: nodes[j - 1].lon,
          y1: nodes[j - 1].lat,
          x2: nodes[j].lon,
          y2: nodes[j].lat
        };
      }
    }
  }

  return { minDist, bestSegment };
}

function adjustNode(node, refs, config)
{
  const coordinates = node.getCoor();
  const x = coordinates.lon();
  const y = coordinates.lat();

  let minDist = 1.0e30;
  let bestPt;
  // Snap to existing nodes nearby
  // (only if the node has no tags, to prevent moving of crossings and traffic signs along the road)
  if (!node.isTagged()) {
    let i, j;
    for (i = 0; i < refs.length; ++i) {
      if (x < refs[i].bbox.minX || x > refs[i].bbox.maxX || y < refs[i].bbox.minY || y > refs[i].bbox.maxY)
        continue;
      const nodes = refs[i].nodes;
      for (j = 0; j < nodes.length; ++j) {
        const dist = ct.getDist(x, y, nodes[j].lon, nodes[j].lat);
        if (minDist > dist) {
          minDist = dist;
          bestPt = nodes[j];
        }
      }
    }
    if (minDist < config.MaxDistance)
      return;
  }

  if (minDist > config.SnapRadius) {
    // or pull to nearby segments
    const { minDistSegment, bestSegment } = findNearestSegment(x, y, refs);
    if (minDistSegment < config.MaxDistance || minDistSegment > config.BufferWidth)
      return;

    const b = ct.getPerpendicularBase(x, y, bestSegment.x1, bestSegment.y1, bestSegment.x2, bestSegment.y2);
    bestPt = { lat: b.y, lon: b.x };
  }

  node.setCoor(new LatLon(bestPt.lat, bestPt.lon));
  node.setModified(true);
}

function getTotalBBox(refs)
{
  let minX = 1.0e30;
  let minY = 1.0e30;
  let maxX = -1.0e30;
  let maxY = -1.0e30;
  let i;
  for (i = 0; i < refs.length; ++i) {
    minX = Math.min(minX, refs[i].bbox.minX);
    minY = Math.min(minY, refs[i].bbox.minY);
    maxX = Math.max(maxX, refs[i].bbox.maxX);
    maxY = Math.max(maxY, refs[i].bbox.maxY);
  }

  return { minX, minY, maxX, maxY };
}

export function processOSM(ref, refs, config)
{
  const layer = layers.get(config.WorkName);
  const ds = layer.getDataSet();

  const refBBox = getTotalBBox(refs);

  const startTime = Date.now() - 86400 * 1000;
  let cntN = 0;
  let cntFreshN = 0;
  let users = {};
  for (let w of ds.getWays()) {
    if (!w.get('highway') || w.get('ref') !== ref)
      continue;
    if (w.get('oneway') === 'yes' || w.get('junction') === 'roundabout' || w.get('highway') === 'construction')
      continue;

    const la = parseInt(w.get('lanes'));
    const lb = parseInt(w.get('lanes:backward'));
    const lf = parseInt(w.get('lanes:forward'));
    if (la && (la % 1) == 1)
      continue;
    if (la && lb && (2 * lb !== la))
      continue;
    if (la && lf && (2 * lf !== la))
      continue;
    if (lb && lf && (lb !== lf))
      continue;

    // Process only ways entirely within the selected references
    const bb = w.getBBox();
    if (bb.getMinLon() < refBBox.minX || bb.getMinLat() < refBBox.minY || bb.getMaxLon() > refBBox.maxX || bb.getMaxLat() > refBBox.maxY) {
      console.info(`Way ${w.getId()} is out of the selected area. Skipped.`);
      continue;
    }

    // Snap existing nodes to nearby references
    // plus administer recent check
    const nodes = w.getNodes();
    nodes.forEach((node) => {
      ++cntN;
      if (node.getInstant().getTime() > startTime) {
        ++cntFreshN;
        const uname = node.getUser().getName();
        if (!users.hasOwnProperty(uname))
          users[uname] = 1;
        else
          ++users[uname];
      }
      adjustNode(node, refs, config);
    });

    // Check distance between nodes from the reference
    // Add new node if necessary
    let lastCoord;
    let ni;
    for (ni = 1; ni < w.getNodesCount(); ++ni) {
      const c1 = w.getNode(ni - 1).getCoor();
      const c2 = w.getNode(ni).getCoor();
      if (ct.getDist(c1.lon(), c1.lat(), c2.lon(), c2.lat()) > config.MinSegmentLength) {
        const cx = (c1.lon() + c2.lon()) / 2;
        const cy = (c1.lat() + c2.lat()) / 2;

        const { minDist, bestSegment } = findNearestSegment(cx, cy, refs);
        if (minDist > config.BufferWidth) {
          console.info(`Way ${w.getId()} is out of the selected area. Skipped.`);
          break;
        }

        if (ct.getDistFromSegment(cx, cy, bestSegment.x1, bestSegment.y1, bestSegment.x2, bestSegment.y2) > config.MaxDistance) {
          let node = new Node(new LatLon(cy, cx));
          adjustNode(node, refs, config);
          if (lastCoord !== node.getCoor().toString()) {
            lastCoord = node.getCoor().toString();
            ds.addPrimitive(node);
            w.addNode(ni, node);
            w.setModified(true);
            --ni;
          } else {
            console.warn(`Check ${w.getId()}[${ni}] @ ${cx},${cy} -> ${lastCoord}, it would cause infinite loop.`);
          }
        }
      }
    }

    // Find duplicated nodes (typically resulting from snapping to reference nodes)
    for (ni = 1; ni < w.getNodesCount(); ++ni) {
      const n1 = w.getNode(ni - 1);
      const n2 = w.getNode(ni);
      const c1 = n1.getCoor();
      const c2 = n2.getCoor();
      if (Math.abs(c1.lon() - c2.lon()) > ct.Epsilon || Math.abs(c1.lat() - c2.lat()) > ct.Epsilon)
        continue;

      let delNode;
      if (n2.isNew()) {
         delNode = n2;
      } else if (n1.isNew()) {
         delNode = n1;
      } else if (n1.isReferredByWays(2)) {
        if (n2.isReferredByWays(2)) {
          // Conflict but cannot remove any of them
        } else {
          delNode = n2;
        }
      } else if (n2.isReferredByWays(2)) {
          delNode = n1;
      } else if (n2.isModified()) {
         delNode = n2;
      } else if (n1.isModified()) {
         delNode = n1;
      } else {
         // Conflict was present before
      }
      if (delNode) {
        w.removeNode(delNode);
        delNode.setDeleted(true);
        --ni;
      }
    }
  }
  ds.cleanupDeletedPrimitives();

  if (cntFreshN > 2) {
    const unames = Object.keys(users).sort((a, b) => (users[b] - users[a])).map(i => `${i} (${users[i]})`).join(', ');
    console.warn(`${cntFreshN} of ${cntN} nodes were recently modified by ${unames}`);
  }

  // Scatter result
  if (config.Variance > 0.0) {
    for (let node of ds.getNodes()) {
      if (!node.isModified() && !node.isNew())
        continue;

      const randX = (Math.random() - 0.5) * 2.0;
      const randY = (Math.random() - 0.5) * 2.0 * Math.sqrt(1.0 - randX * randX);
      const p = ct.offsetPoint(node.getCoor().lon(), node.getCoor().lat(), randX * config.Variance, randY * config.Variance);
      node.setCoor(new LatLon(p.y, p.x));
    }
  }
}
