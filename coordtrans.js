/*
  Function: Make geometric calculations in a non-Cartesian system (WGS84)

  Implementation: Simplified, without elliptic geometry (orthodromes, etc.)
  There is an adjustment for the meridional radius of curvature to compensate some of this error.

*/

const RLat_Earth = 6356752.3142451795;
const RLon_Earth = 6378137.0;
const AdjFactor = 1.00185;  // Adjust for the meridional radius of curvature, in Central Europe.
export const Epsilon = 1.0e-12;		// degrees


export function webMercatorToLatLon(x, y)
{
  // Convert Web Mercator x and y (in meters) to Lat/Lon (in degrees)
  var lon = x / RLon_Earth * 180 / Math.PI;
  var lat = (2 * Math.atan(Math.exp(y / RLon_Earth)) - Math.PI / 2) * 180 / Math.PI;
  return { lat, lon };
}

export function getXDist(x1, x2, y) // lon -> metres
{
  const dCosY = Math.cos(y * Math.PI / 180);
  return RLon_Earth * (x2 - x1) * dCosY * Math.PI / 180;
}

export function getYDist(y1, y2) // lat -> metres
{
  return RLat_Earth * (y2 - y1) * AdjFactor * Math.PI / 180;
}

export function getDist(x1, y1, x2, y2) // (lon,lat) -> metres
{
  const dCosY = Math.cos((y1 + y2) * Math.PI / 360);
  const yD = RLat_Earth * (y2 - y1);
  const xD = RLon_Earth * (x2 - x1) * dCosY;

  return AdjFactor * Math.sqrt(xD * xD + yD * yD) * Math.PI / 180;
}

export function getDistFromLine(xp, yp, x1, y1, x2, y2) // (lon,lat) -> metres
{
  const dCosY = Math.cos(yp * Math.PI / 180);
  const dX = RLon_Earth * (x2 - x1) * dCosY;
  const dY = RLat_Earth * (y2 - y1) * AdjFactor;
  const dLength2 = dX * dX + dY * dY;
  if (dLength2 < Epsilon * Epsilon)
    return getDist(xp, yp, x1, y1);

  const dPX1 = RLon_Earth * (xp - x1) * dCosY;
  const dPY1 = RLat_Earth * (yp - y1) * AdjFactor;
  const dNom = dPX1 * dY - dPY1 * dX;

  return Math.sqrt(dNom * dNom / dLength2) * Math.PI / 180;
}

export function getDistFromSegment(xp, yp, x1, y1, x2, y2) // (lon,lat) -> metres
{
  // Calculates the distance between the point and the segment defined by the two points.
  // If the point is further to one end, the distance from that end point is returned
  // instead of the distance from the theoretical line defined by the two points.

  const dCosY = Math.cos(yp * Math.PI / 180);
  const dX = RLon_Earth * (x2 - x1) * dCosY;
  const dY = RLat_Earth * (y2 - y1) * AdjFactor;
  const dPX1 = RLon_Earth * (xp - x1) * dCosY;
  const dPY1 = RLat_Earth * (yp - y1) * AdjFactor;
  if (dX * dPX1 + dY * dPY1 < 0.0)
    return Math.sqrt(dPX1 * dPX1 + dPY1 * dPY1) * Math.PI / 180;

  const dPX2 = RLon_Earth * (xp - x2) * dCosY;
  const dPY2 = RLat_Earth * (yp - y2) * AdjFactor;
  if (dX * dPX2 + dY * dPY2 >= 0.0)
    return Math.sqrt(dPX2 * dPX2 + dPY2 * dPY2) * Math.PI / 180;

  return getDistFromLine(xp, yp, x1, y1, x2, y2);
}

export function offsetPoint(x, y, distX, distY) // (lon,lat), metres
{
  const dCosY = Math.cos(y * Math.PI / 180);

  return {
    x: x + distX * 180 / (RLon_Earth * dCosY * Math.PI),
    y: y + distY * 180 / (RLat_Earth * AdjFactor * Math.PI)
  };
}

export function getPerpendicularBase(xp, yp, x1, y1, x2, y2) // (lon,lat)
{
  const dCosY = Math.cos(yp * Math.PI / 180);
  const dX = RLon_Earth * (x2 - x1) * dCosY;
  const dY = RLat_Earth * (y2 - y1) * AdjFactor;
  const dLength2 = dX * dX + dY * dY;
  if (dLength2 < Epsilon * Epsilon)
    return { x: xp, y: yp };

  const dPX1 = RLon_Earth * (xp - x1) * dCosY;
  const dPY1 = RLat_Earth * (yp - y1) * AdjFactor;
  const f = (dPX1 * dX + dPY1 * dY) / dLength2;
  return {
    x: x1 + dX * f / (RLon_Earth * dCosY),
    y: y1 + dY * f / (RLat_Earth * AdjFactor)
  };
}

export function getArea(x1, y1, x2, y2) // (lon,lat) -> square metres
{
  const dCosY = Math.cos((y1 + y2) * Math.PI / 360);
  const dX = RLon_Earth * (x2 - x1) * dCosY * Math.PI / 180;
  const dY = RLat_Earth * (y2 - y1) * AdjFactor * Math.PI / 180;

  return Math.abs(dX * dY);
}

export function bufferRect(rect, bm) // (lon,lat), buffer metres -> (lon,lat)
{
  const dCosY = Math.cos((rect.minY + rect.maxY) * Math.PI / 360);
  const dOffsX = bm * 180 / (Math.PI * RLon_Earth * dCosY);
  const dOffsY = bm * 180 / (Math.PI * RLat_Earth * AdjFactor);

  return {
    minX: rect.minX - dOffsX,
    minY: rect.minY - dOffsY,
    maxX: rect.maxX + dOffsX,
    maxY: rect.maxY + dOffsY
  };
}
