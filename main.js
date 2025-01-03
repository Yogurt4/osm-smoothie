import layers from 'josm/layers';
import console from 'osm-smoothie/console'
import * as ct from 'osm-smoothie/coordtrans';
import * as dl from 'osm-smoothie/downloader';
import * as rf from 'osm-smoothie/reference';
import * as sm from 'osm-smoothie/smoothie';
const MainApp = Java.type('org.openstreetmap.josm.gui.MainApplication');
const LatLon = Java.type('org.openstreetmap.josm.data.coor.LatLon');

const config = {
  RefName: 'wfs_21616037.kml',
  RefTag: 'kszam',
  WorkName: 'work',
  BufferWidth: 50.0,  // m
  MaxArea: 25.0,      // km2
  SnapRadius: 2.0,    // m
  MaxDistance: 0.5,   // m
  MinSegmentLength: 10.0, // m
  Variance: 0.2      // m
};


function smoothRoadsToReference()
{
  console.clear();

  const { ref, refWays } = rf.getReference(config.RefName, config.RefTag);
  if (refWays.length === 0)
    console.error(`No selected ways.`);

  const refs = rf.buildFinder(refWays, config.BufferWidth, config.MaxArea);

  console.info(`Processing ref ${ref}, ${refs.length} ways`);
  dl.downloadRects(refs, config.WorkName, config.MaxArea);
  sm.processOSM(ref, refs, config);

  // Try to find the starting (at least, West-most) point of the selection
  let cx = refs[0].nodes[0].lon;
  let cy = refs[0].nodes[0].lat;
  if (refs.length > 1 && (JSON.stringify(refs[0].nodes[0]) === JSON.stringify(refs[1].nodes[0])
       || JSON.stringify(refs[0].nodes[0]) === JSON.stringify(refs[1].nodes.at(-1)))) {
    cx = refs[0].nodes.at(-1).lon;
    cy = refs[0].nodes.at(-1).lat;
  }

  // Zoom around it
  const mapView = MainApp.getMap().mapView;
  mapView.zoomTo(new LatLon(cy, cx));
  mapView.zoomTo(mapView.getCenter(), 0.5);

  // Turn on FÖMI layer as it is needed for the human verification
  let i;
  for (i = 0; i < layers.length; ++i) {
    let layer = layers.get(i);
    if (layer.getName().startsWith('FÖMI')) {
      layer.setVisible(true);
      break;
    }
  }

  console.display();
}

smoothRoadsToReference();
