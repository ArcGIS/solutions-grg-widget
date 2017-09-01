///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////
/**
 *  @fileOverview Module containing MGRS grid utilities used by GridOverlay widgets.
 *  @author Esri
 */

/**
 *  @module mgrs-utils
 *  @description Module containing MGRS grid utilities used by GridOverlay widgets.
 */

define([
  "dojo/json",
  "./constants",
  "./geometry-utils",
  "./labeling-utils",
  "./mgrs",
  "./NonPolarGridZone",
  "./VisibleGridZone",
  "./GridPolygon",
  "esri/geometry/geometryEngine",
  "esri/graphic",
  "esri/geometry/Point",
  "esri/geometry/Polyline",
  "esri/geometry/Polygon",
  "esri/symbols/SimpleLineSymbol",
  "esri/symbols/TextSymbol",
  "esri/symbols/Font",
  "esri/Color"
], function(
  JSON,
  constants,
  gridGeomUtils,
  gridLabelUtils,
  mgrs,
  NonPolarGridZone,
  VisibleGridZone,
  GridPolygon,
  geometryEngine,
  Graphic,
  Point,
  Polyline,
  Polygon,
  SimpleLineSymbol,
  TextSymbol,
  Font,
  Color
) {

  return {

    /**
     * The zonesDictionary object contains all 1197 unique keys
     * (one for each non-polar MGRS grid zone)
     * @type {Object.<String, module:mgrs-utils~NonPolarGridZone>}
     * @private
     * @example
     * // returns 12
     * _ZonesDictionary["12S"].utmZone;
     */
    _ZonesDictionary: (function() {
      // The zonesDictionary object has 1197 unique keys (one for eqch MGRS grid zone).
      // Rather than load it through a single, large json text file,
      // we build it here programmatically,
      // one time, on the client

      var zoneNum, zoneLtr, nonPolarGridZone;
      // Per MGRS definition, these are the valid grid zone letters
      var zoneLetters = [
        'C','D','E','F','G','H','J','K','L','M','N',
        'P','Q','R','S','T','U','V','W','X'
      ];
      // A dictionary object containing all MGRS zones (excluding any zones that don't exist)
      // this is the object that will be returned (i.e. set as the _ZonesDictionary)
      var zonesDictionary = {};

      /**
       * Returns the NonPolarGridZone object for the zone.
       * NOTE: This is only used during the initial creation of '_ZonesDictionary' object
       * @param  {Number} zoneNum The MGRS grid zone number
       * @param  {Number} zoneLtrIndex
       * The index of the MGRS grid zone letter (w.r.t. the zoneLetters object)
       * @return {module:mgrs-utils~NonPolarGridZone}  The NonPolarGridZone object
       * @private
       */
      var ltrZoneToExtent = function(zoneNum, zoneLtrIndex) {
        var nonPolarGridZoneArgs, xmin, xmax, ymin, ymax;
        var zoneLtr = zoneLetters[zoneLtrIndex];
        var zoneId = zoneNum + zoneLtr;

        // There are several unique MGRS zones which don't follow the standard convention,
        // they are defined here:
        if (zoneId === "32X" || zoneId === "34X" || zoneId === "36X") {
          // Per the MGRS definition, these zones don't exist
          return null;
        } else if (zoneId === "31V") {
          // unique sized zone
          nonPolarGridZoneArgs = {
            "xmin": 0,
            "ymin": 56,
            "xmax": 3,
            "ymax": 64,
            "id": zoneId
          };
        } else if (zoneId === "32V") {
          // unique sized zone
          nonPolarGridZoneArgs = {
            "xmin": 3,
            "ymin": 56,
            "xmax": 12,
            "ymax": 64,
            "id": zoneId
          };
        } else if (zoneId === "31X") {
          // unique sized zone
          nonPolarGridZoneArgs = {
            "xmin": 0,
            "ymin": 72,
            "xmax": 9,
            "ymax": 84,
            "id": zoneId
          };
        } else if (zoneId === "33X") {
          // unique sized zone
          nonPolarGridZoneArgs = {
            "xmin": 9,
            "ymin": 72,
            "xmax": 21,
            "ymax": 84,
            "id": zoneId
          };
        } else if (zoneId === "35X") {
          // unique sized zone
          nonPolarGridZoneArgs = {
            "xmin": 21,
            "ymin": 72,
            "xmax": 33,
            "ymax": 84,
            "id": zoneId
          };
        } else if (zoneId === "37X") {
          // unique sized zone
          nonPolarGridZoneArgs = {
            "xmin": 33,
            "ymin": 72,
            "xmax": 42,
            "ymax": 84,
            "id": zoneId
          };
        } else {
          // These are the default zones that do follow the standard MGRS convention:

          // Compute the extent attributes of the zone
          xmin = (zoneNum - 1) * constants.ZONE_WIDTH_DEGREES - 180;
          xmax = zoneNum * constants.ZONE_WIDTH_DEGREES - 180;
          ymin = zoneLtrIndex * constants.ZONE_HEIGHT_DEGREES + constants.MIN_MGRS_LATITUDE;
          ymax = (zoneLtrIndex + 1) * constants.ZONE_HEIGHT_DEGREES  + constants.MIN_MGRS_LATITUDE;

          // Fix special cases where the numbers need to be adjusted
          // exactly 180 or -180 causes problems, changes it to something close
          xmin = xmin === 180 ? constants.POSITIVE_180 : xmin;
          xmin = xmin === -180 ? constants.NEGATIVE_180 : xmin;
          xmax = xmax === 180 ? constants.POSITIVE_180 : xmax;
          xmax = xmax === -180 ? constants.NEGATIVE_180 : xmax;
          if (ymax === 80) {
            // the top row of MGRS grid zones is taller than most, in order to extent to N84°
            ymax  =  constants.MAX_MGRS_LATITUDE;
          }

          nonPolarGridZoneArgs = {
            "xmin": xmin,
            "ymin": ymin,
            "xmax": xmax,
            "ymax": ymax,
            "id": zoneId
          };
        }
        return new NonPolarGridZone(nonPolarGridZoneArgs);
      };

      // Loop through all possible zone number/letter combinations,
      // building the NonPolarGridZone object for each
      for (zoneNum = 1; zoneNum <= 60; zoneNum++) {
        for (zoneLtr = 0; zoneLtr < zoneLetters.length; zoneLtr++) {
          nonPolarGridZone = ltrZoneToExtent(zoneNum, zoneLtr);
          if (nonPolarGridZone) {
            zonesDictionary[nonPolarGridZone.id] = nonPolarGridZone;
          }
        }
      }
            
      // Loop through all possible zone number/letter combinations,
      // and add the full utm zone geometry
      for (zoneNum = 1; zoneNum <= 60; zoneNum++) {
        var geometriesToUnion = [];
        //this first loop creates an array of geometries for a single UTM zone
        for (zoneLtr = 0; zoneLtr < zoneLetters.length; zoneLtr++) {
          nonPolarGridZone = ltrZoneToExtent(zoneNum, zoneLtr);
          if (nonPolarGridZone) {
            var polygon = new Polygon({
              rings: JSON.parse(JSON.stringify(nonPolarGridZone._rings))
            });
            geometriesToUnion.push(polygon);            
          }
        }
        //union the geometries to create a single polygon
        var union = geometryEngine.union(geometriesToUnion);
        // loop back through each letter combination add the single zone geometry 
        for (zoneLtr = 0; zoneLtr < zoneLetters.length; zoneLtr++) {
          nonPolarGridZone = ltrZoneToExtent(zoneNum, zoneLtr);
          if (nonPolarGridZone) {
            zonesDictionary[nonPolarGridZone.id]['fullZoneGeometry'] = union;
          }
        } 
      }

      return zonesDictionary;
    })(),

    /**
     * Determines which MGRS grid interval (in meters) supports the current map extent
     * @param  {Number} minSpacing  The minimum spacing of lines (in screen pixels)
     * @param  {external:Map} map   A Map object
     * @param  {String} [detail]    Either "more" or "less".
     * For example, when close to the minSpacing threshhold,
     * which way to lean (i.e. "more" detail or "less" detail).
     * This effects the way rounding is dones within this function.
     * @return {Number}             The minimum spacing of lines (in meters)
     */
    getInterval: function(minSpacing, map, detail) {
      var minSpacingWidth, pt, pt1, pt2, utmZone, minSpacingLog10, minSpacingPow10, interval;
      var shift = 0;

      // Find which power of 10 (i.e. 1, 10, 100, 1000, 10000, etc) in meters
      // is the closest match to the 'minSpacing' parameter (minSpacing is in screen pixels)
      minSpacingWidth = map.getResolutionInMeters() * minSpacing; // the width in meters
      pt = map.extent.getCenter();

      // create two points, offset vertically from the screen center,
      // used to determine how many meters the minSpacing screen pixels equates to
      pt1 = map.toMap(map.toScreen(pt).offset(0, minSpacing / 2)); // bottom point
      pt2 = map.toMap(map.toScreen(pt).offset(0, -minSpacing / 2)); // top point

      // since the min/max extent of the MGRS grid is -80/84 respectively,
      // limit the computation to that range
      while (pt1.getLatitude() >= 84 || pt2.getLatitude() >= 84) {
        shift++;
        pt1 = map.toMap(map.toScreen(pt).offset(0, minSpacing / 2 + shift * minSpacing));
        pt2 = map.toMap(map.toScreen(pt).offset(0, -minSpacing / 2 + shift * minSpacing));
      }
      while (pt1.getLatitude() <= -80 || pt2.getLatitude() <= -80) {
        shift++;
        pt1 = map.toMap(map.toScreen(pt).offset(0, minSpacing / 2 - shift * minSpacing));
        pt2 = map.toMap(map.toScreen(pt).offset(0, -minSpacing / 2 - shift * minSpacing));
      }

      var pt1Lat = pt1.getLatitude();
      var pt1Lon = pt1.getLongitude();
      var pt2Lat = pt2.getLatitude();
      var pt2Lon = pt2.getLongitude();

      // convert to UTM, and determine approximate meter spacing (width)
      utmZone = mgrs.getZoneNumber(pt1Lat, pt1Lon);
      minSpacingWidth = Math.abs(mgrs.LLtoUTM(pt1Lat, pt1Lon, utmZone)[1] -
        mgrs.LLtoUTM(pt2Lat, pt2Lon, utmZone)[1]);

      // its easier for me to understand what minSpacingLog10
      // represents by thinking of it in terms of:
      // Equation: minSpacingWidth = 10 ^ minSpacingLog10
      minSpacingLog10 = Math.log10(minSpacingWidth);
      switch(detail) {
        case "more":
          minSpacingPow10 = Math.floor(minSpacingLog10); // round down
          break;
        case "less": case "strict":
          minSpacingPow10 = Math.ceil(minSpacingLog10); // round up
          break;
        default:
          minSpacingPow10 = Math.round(minSpacingLog10); // round closest
          break;
      }

      interval = Math.pow(10, minSpacingPow10);
      if (minSpacingWidth > interval * 2) {
        // sometimes, the computed interval is just too small using the
        // above method and needs to be adjusted
        // this check seems to work well
        interval *= 10;
      }
      if (interval > 100000) {
        // return 0 so that other functions can easily check if it is set (i.e. 0 == false)
        return false;
      } else {
        return interval;
      }
    },

    /**
     * Finds the intersecting MGRS grid zones that are visible in an extent
     * @param  {Object} grid The grid overlay object
     * @return {module:mgrs-utils~VisibleGridZone[]} An array of non-polar grid zones
     */
    zonesFromExtent: function(extent,map) {
      var xmin, ymin, xmax, ymax, minLtr, maxLtr, minNum, maxNum,
          ltr, idx, rings, polygon, polygon_i, polyline, polyline_i,
          minXOffset, maxXOffset;
      var mapExtent = extent._extent;
      var deg360 = mapExtent.spatialReference.isWebMercator() ?
        constants.WEBMERCATOR_360 :
        constants.GEOGRAPHIC_360;
      
      /**
      var labelParameters = {
        xOffset: grid.getCornerLabelXOffset(),
        yOffset: grid.getCornerLabelYOffset(),
        rotation: 0,
        color: grid.getColor(0),
        fontFamily: grid.getFontFamily(),
        fontSize: grid.getFontSize(0)
      };
      **/
      
      // per MGRS definition, these are the valid grid zone letters
      var zoneLetters = [
        'C','D','E','F','G','H','J','K','L','M',
        'N','P','Q','R','S','T','U','V','W','X'
      ];
      // this will be the returned array (of VisibleGridZone objects)
      var visibleGridZones = [];

      // check to see if the map extent spans the entire globe
      // (longitudinally) and hide the grid if it does
      if ((mapExtent.xmax - mapExtent.xmin) > deg360) {
        return visibleGridZones;
      }

      // polygon geometry of map extent, used for intersect later on
      var mapExtentPolygon = gridGeomUtils.extentToPolygon(mapExtent);
      mapExtentPolygon = gridGeomUtils.toWebMercator(mapExtentPolygon);

      // used to find min/max values of x and y, as well as to determine wraparound offset
      var southwestPoint = gridGeomUtils.pointToGeographic(
        new Point([mapExtent.xmin, mapExtent.ymin],mapExtent.spatialReference)
      );
      var northeastPoint = gridGeomUtils.pointToGeographic(
        new Point([mapExtent.xmax, mapExtent.ymax], mapExtent.spatialReference)
      );

      // ymin and ymax are geographic latitudes
      ymin = southwestPoint.y;
      ymax = northeastPoint.y;

      // when map is in wraparound mode, determine if map extent spans left of 180°W
      minXOffset = southwestPoint.offsetX;

      // when map is in wraparound mode, determine if map extent spans east of 180°E
      maxXOffset = northeastPoint.offsetX;

      // when the map is in wraparound mode, handle each span separately
      // (divided by Int'l Date Line)
      for (var x_offset = minXOffset; x_offset <= maxXOffset; x_offset++) {

        // xmin and xmax are gegraphic longitudes
        if (x_offset > minXOffset) {
          xmin = constants.NEGATIVE_180;
        } else {
          xmin = southwestPoint.x;
        }
        if (x_offset < maxXOffset) {
          xmax = constants.POSITIVE_180;
        } else {
          xmax = northeastPoint.x;
        }

        // find the min and max MGRS grid zone letters by dividing the
        // vertical extent by zone height (normally 8°),
        // only considering the valid range of -80° => +84°
        minLtr = Math.min(Math.max(Math.floor((ymin + 80) / constants.ZONE_HEIGHT_DEGREES), 0), 19);
        maxLtr = Math.min(Math.floor((ymax + 80) / constants.ZONE_HEIGHT_DEGREES), 19);
        minNum = Math.floor((xmin + 180) / constants.ZONE_WIDTH_DEGREES);
        maxNum = Math.min(Math.floor((xmax + 180) / constants.ZONE_WIDTH_DEGREES) + 2, 60);

        // loop through each zone number
        for (var num = minNum; num <= maxNum; num++) {

          // loop through each zone letter
          for (var l = minLtr; l <= maxLtr; l++) {

            // convert zone letter from int to character
            ltr = zoneLetters[l];
            idx = num + ltr; // index of zone

            if (!this._ZonesDictionary[idx]) {
              // skip and goto next zone if zone index is valid?
              continue;
            }
            // create a copy of the zone paths
            rings = JSON.parse(JSON.stringify(this._ZonesDictionary[idx]._rings));

            // modify the zone paths for x_offset
            for (var i = 0; i < rings[0].length; i++) {
              rings[0][i][0] += x_offset * constants.GEOGRAPHIC_360;
            }

            // create polygon from new zone paths
            polygon = new Polygon({
              rings: rings
            });

            // create the zone border polyline
            polyline = new Polyline({
              paths: rings
            }); 

            // check if zone polygon intersects with the original mapextent
            polygon_i = geometryEngine.intersect(
              gridGeomUtils.toWebMercator(polygon),
              mapExtentPolygon);
            if (polygon_i) {
              // get the border of the visible zone (can be null)
              polyline_i = geometryEngine.intersect(
                gridGeomUtils.toWebMercator(polyline),
                mapExtentPolygon);

              // create a VisibleGridZone instance and add it to the visibleGridZones results array
              visibleGridZones.push( new VisibleGridZone({
                "map": map,
                "polyline": polyline_i,
                "polygon": polygon_i,
                "fullZoneGeometry": this._ZonesDictionary[idx].fullZoneGeometry, 
                "offset": x_offset,
                "nonPolarGridZone": this._ZonesDictionary[idx]
                //"labelParameters": labelParameters
              }));
            }
          }
        }
      }
      return visibleGridZones;
    },

    /**
     * Processes an array of visible grid zone and hands them off to the appropriate handler(s)
     * @param  {module:mgrs-utils~VisibleGridZone[]} visibleGridZone A VisibleGridZone object
     * @param  {object} grid The grid overlay object that is calling this method
     */
    processZonePolygons: function(visibleGridZones, map, interval) {
      // Since MGRS grid zones are essentially UTM zones, further divided vertically,
      // it is more efficient to handle them in two different ways:
      //   1) The MGRS grid zone polygon does care about the vertical division of the UTM zone,
      //      and will deal with each individually
      //   2) The 100K grid zones and interval lines, do not care about the vertical division,
      //      and it is more efficient to group them by UTM zone, and handle these groups
      //      together
      // The utmZonePolygons object is a dictionary that holds information for scenario #2 above

      var utmZonePolygons = {};
      var intervalSpacing = interval;
      var polys = [];
      
      // process each grid zone separately
      for (var i = 0; i < visibleGridZones.length; i++) {
        var visibleGridZone = visibleGridZones[i];
        if (visibleGridZone) {
          // This is the handler for scenario #1 described above
          //this.handleZonePolygon(visibleGridZone, grid);

          // if intervalSpacing == 0 (or false), then processing can
          // stop as no 100K grids or intervals will be drawn
          if (intervalSpacing) {
            if (!utmZonePolygons[visibleGridZone.nonPolarGridZone.utmZone]) {
              // this is the first instance of a specific UTM zone, from scenario #2 above
              utmZonePolygons[visibleGridZone.nonPolarGridZone.utmZone] = {
                polygon: gridGeomUtils.toWebMercator(visibleGridZone.polygon),
                offset: visibleGridZone.offset
              };
            } else {
              // from scenario #2 above, the UTM zone instance already exists,
              // and will be merged with the new data

              // the polygon property is the union of the visibleGridZone geometry
              // and the already existing geometry
              utmZonePolygons[visibleGridZone.nonPolarGridZone.utmZone].polygon =
                geometryEngine.union([
                  gridGeomUtils.toWebMercator(visibleGridZone.polygon),
                  utmZonePolygons[visibleGridZone.nonPolarGridZone.utmZone].polygon
              ]);
            }
            utmZonePolygons[visibleGridZone.nonPolarGridZone.utmZone].fullZoneGeometry = visibleGridZone.fullZoneGeometry;
          }
          
        }
      }

      // after processing each visibleGridZone individually (scenario #1),
      // the following with handle each UTM zone
      // as a single group (scenario #2), only if intervalSpacing is greater
      // than 0 and less than or equal to 100K
      if (intervalSpacing) {
        var utmZoneKeys = Object.keys(utmZonePolygons);
        for (var j = 0; j < utmZoneKeys.length; j++) {
          var utmZone = utmZoneKeys[j];
          var utmZonePolygon = utmZonePolygons[utmZone].polygon;
          var offset = utmZonePolygons[utmZone].offset;
          var fullZoneGeometry = utmZonePolygons[utmZone].fullZoneGeometry;
          
          
          // using the extent of the utm zone polygon, determine the min/max eastings and northings
          // this will narrow down the amount of work each handler will need to do
          var clippedExtent = gridGeomUtils.toGeographic(utmZonePolygon.getExtent());

          // compute the UTM of each extent corner, as a basis for finding the min/max values
          var lowerLeftUtm = mgrs.LLtoUTM(clippedExtent.ymin, clippedExtent.xmin, utmZone);
          var lowerRightUtm = mgrs.LLtoUTM(clippedExtent.ymin, clippedExtent.xmax, utmZone);
          var upperRightUtm = mgrs.LLtoUTM(clippedExtent.ymax, clippedExtent.xmax, utmZone);
          var upperLeftUtm = mgrs.LLtoUTM(clippedExtent.ymax, clippedExtent.xmin, utmZone);

          // using the UTM coordinates, find the min/max values
          // (index 0 of a UTM point is easting, 1 is northing)
          var minEasting = Math.min(lowerLeftUtm[0],
            lowerRightUtm[0], upperRightUtm[0], upperLeftUtm[0]);
          var maxEasting = Math.max(lowerLeftUtm[0],
            lowerRightUtm[0], upperRightUtm[0], upperLeftUtm[0]);
          var minNorthing = Math.min(lowerLeftUtm[1],
          lowerRightUtm[1], upperRightUtm[1], upperLeftUtm[1]); // - 10000;
          var maxNorthing = Math.max(lowerLeftUtm[1],
            lowerRightUtm[1], upperRightUtm[1], upperLeftUtm[1]);

          // construct the arguments object for the handler methods
          var handlerArgs = {
            "minE": minEasting,
            "maxE": maxEasting,
            "minN": minNorthing,
            "maxN": maxNorthing,
            "utmZone": utmZone,
            "polygon": utmZonePolygon,
            "offset": offset,
            "fullZoneGeometry": fullZoneGeometry
          };
          
          polys = polys.concat(this.handle100kGrids(handlerArgs, map));
        }
      }      
      return polys;        
      
      
    },

    /** Handler methods for processing grid info, drawing lines, and labeling accordingly
     * @ignore
     */

    /**
     * Creates graphics and labels for a visible grid zone
     * @param  {module:mgrs-utils~VisibleGridZone} visibleGridZone A VisibleGridZone object
     * @param  {object} grid The grid overlay object that is calling this method
     *
     * @todo Implement configurable parameter for when to label (center and corners), based on zoom
     */
    handleZonePolygon: function(visibleGridZone, grid) {
      var polyline, color, lineWidth, labelElements, labels, i;

      // Creates graphics for the zone outline
      polyline = visibleGridZone.polyline;
      color = grid.getColor(0);
      lineWidth = grid.getLineWidth(0);
      grid._lineGraphics0.push(
        new Graphic(
          polyline,
          new SimpleLineSymbol(
            SimpleLineSymbol.STYLE_SOLID,
            new Color(color),
            lineWidth
          )
        )
      );

      // Creates labels for the zone

      // depending on the map zoom, labels may not be drawn
      if (grid.map.getZoom() < 4) {
        // TODO: 4 should be turned into a configurable number
        return;
      }

      // depending on the map zoom, only center labels may be drawn
      if (grid.map.getZoom() <= 5) {
        // TODO: 5 should be turned into a configurable number
        grid._labelGraphics.push(visibleGridZone.getCenterLabel());
        return;
      }

      labelElements = visibleGridZone.getLabels();
      labels = [];

      for (i = 0; i < labelElements.length; i++) {
        grid._labelGraphics.push(labelElements[i]);
      }
      return;
    },

    /**
     * An object that contains arguments used during 100K and interval handler methods,
     * allowing objects to be passed by reference
     * @typedef {Object} module:mgrs-utils~MgrsGridHandlerArguments
     * @property {external:Polygon} polygon
     * A geometry Polygon object that represents the visible grid zone
     * @property {Number} utmZone             The UTM zone number
     * @property {Number} offset              The non-normalized x-offset of the grid
     * @property {Number} minE                The minimum UTM easting of the visible zone
     * @property {Number} maxE                The maximum UTM easting of the visible zone
     * @property {Number} minN                The minimum UTM northing of the visible zone
     * @property {Number} maxN                The maximum UTM northing of the visible zone
     * @property {Object} grid                The grid object that is being processed
     */

    /**
     * Creates graphics and labels for the 100K meter grids
     * @param  {module:mgrs-utils~MgrsGridHandlerArguments} args
     * An object holding the arguments for the various handlers
     *
     * @todo Implement configurable parameter for when to label (center and corners), based on zoom
     */
    handle100kGrids: function(args, map) {
      var zonePolygon = args.polygon;
      var offset = args.offset;
      var utmZone = args.utmZone;
      var fullZoneGeometry = args.fullZoneGeometry;
      var minE = args.minE;
      var maxE = args.maxE;
      var minN = args.minN;
      var maxN = args.maxN;
      var poly100k = [];

      var n, e, i, ring, pt, text, polygon, polyline, gridPolygonArgs, gridPolygon, labels;

      // Loop through northings, starting at the increment just south of minN
      // go through each increment of 100K meters, until maxN is reached
      for (n = Math.floor(minN / 100000) * 100000; n < maxN; n += 100000) {

        // Loop through eastings, starting at the increment just west of minE
        // go through each increment of 100K meters, until maxE is reached
        for (e = Math.floor(minE / 100000) * 100000; e < maxE; e += 100000) {
          // For each 100k increment of n & e, build a 100k by 100k grid polygon,
          // used for labeling and border graphics

          // find the label of the 100K grid
          text = mgrs.findGridLetters(utmZone,
            (n + 50000 < 0 ? 10000000 + (n + 50000) : n + 50000), e + 50000);

          // Build the 100k grid boundary
          ring = [];
          // start at the bottom left corner, and work east to
          // the bottom right corner (in 10k m increments)
          // this is a faster way of densifying the line, since it
          // will appear to be curved on the map
          for (i = e; i <= e + 100000; i += 10000) {
            pt = mgrs.UTMtoLL(n, i, utmZone);
            ring.push([pt.lon, pt.lat]);
          }
          // continue adding points to the polygon, working from the
          // bottom right to top right corner
          for (i = n; i < n + 100000; i += 10000) {
            pt = mgrs.UTMtoLL(i, e + 100000, utmZone);
            ring.push([pt.lon, pt.lat]);
          }
          // continue adding points to the polygon, working from the top right to top left corner
          for (i = e + 100000; i >= e;i -= 10000) {
            pt = mgrs.UTMtoLL(n + 100000, i, utmZone);
            ring.push([pt.lon, pt.lat]);
          }
          // continue adding points to the polygon, working from
          // the top left to the bottom left corner (to close the polygon)
          for (i = n + 100000; i >= n; i -= 10000) {
            pt = mgrs.UTMtoLL(i, e, utmZone);
            ring.push([pt.lon, pt.lat]);
          }
          // now that the polygon ring is built, shift it left/right to match the x-offset
          // (i.e. how many increments left or right of the dateline, to support wraparound maps)
          for (i = 0; i < ring.length; i++) {
            ring[i][0] += offset * constants.GEOGRAPHIC_360;
          }
          // create the polygon, from the ring created above
          polygon = new Polygon([ring]);
          
          // now that the 100k grid polygon exists, clip it by the grid zone polygon
          var clippedPolygon = geometryEngine.intersect(
            gridGeomUtils.toWebMercator(polygon),
            gridGeomUtils.toWebMercator(zonePolygon));
          
          // after being clipped above, they may no longer exist
          // (i.e. they were not within the bounds of the zone)
          // if this is the case, skip the rest and move on to the next increment of n or e
          if (!clippedPolygon) {
            continue;
          }
          
          // now we now the polygon is still present clip to the full UTM zone
          var clippedPolyToUTMZone = geometryEngine.intersect(
            gridGeomUtils.toWebMercator(polygon),
            gridGeomUtils.toWebMercator(fullZoneGeometry));
          

          // The GridPolygon class is primarily meant to handle labeling.
          // The following code is all about building the GridPolygon in order to get the labels.
          gridPolygonArgs = {
            "clippedPolygon": clippedPolygon,
            "unclippedPolygon": polygon,
            "clippedPolyToUTMZone": clippedPolyToUTMZone,
            "map": map,
            "xmin": e,
            "ymin": n,
            "xmax": (e + 100000),
            "ymax": (n + 100000),
            "minMaxType": "utm",
            "utmZone": utmZone,
            "utmZonePoly": zonePolygon,
            "fullZoneGeometry" : fullZoneGeometry,
            "GZD": text, 
            "text": text            
          };
          gridPolygon = new GridPolygon(gridPolygonArgs);
          poly100k.push(gridPolygon);
          
        }
      }
      return poly100k;
    },

    /**
     * Creates graphics and labels for grid interval lines
     * (i.e. lines at less than 100K meter spacing)
     * @param  {module:mgrs-utils~MgrsGridHandlerArguments} poly
     * An object holding the arguments for the various handlers
     */
    handleGridSquares: function(poly, map, interval) {
      // This method is similar in nature tot he 'handle100kGrids' method,
      // but in the case of intervals,
      // there are no polygons to create, only horizontal and vertical lines.
      // Thus, much of this code is similar
      // to the 'handle100kGrids' method, without the need for a GridPolygon
      // class object (and less complex labeling logic)
      var polyTest = [];
      var zonePolygon = poly.utmZonePoly;
      var utmZone = poly.utmZone;
      var fullZoneGeometry = poly.fullZoneGeometry;
      var GZD = poly.GZD;
      var offset = poly.offset;
      var minE = poly.xmin;
      var maxE = poly.xmax;
      var minN = poly.ymin;
      var maxN = poly.ymax;
      
      //var grid = args.grid;
      //var fontFamily = grid.getFontFamily();
      //var xOffset = grid.getIntervalLabelXOffset();
      //var yOffset = grid.getIntervalLabelYOffset();
      //var interval = grid.getInterval();
      //var verticalLabels = grid.getVerticalLabels();
      var n, e, i, symbologyLevel, lineGraphics, color,
          lineWidth, fontSize, font, leftPt, rightPt,
          bottomPt, topPt, path, pt, horizontal,
          horizontalGraphic, vertical, verticalGraphic,
          text, labelSymbol, label, screenDistanceBetweenPoints,
          distanceFromMapEdge, polygon, gridPolygonArgs;

      // Horizontal lines
      for (e = Math.floor(minE / interval) * interval; e < maxE; e += interval) {
        for (n = Math.floor(minN / interval) * interval; n < maxN; n += interval) {
        
            ring = [];
            pt = mgrs.UTMtoLL(n, e, utmZone);
            ring.push([pt.lon, pt.lat]);
            pt = mgrs.UTMtoLL(n + interval, e, utmZone);
            ring.push([pt.lon, pt.lat]);
            pt = mgrs.UTMtoLL(n + interval, e + interval, utmZone);
            ring.push([pt.lon, pt.lat]);
            pt = mgrs.UTMtoLL(n, e + interval, utmZone);
            ring.push([pt.lon, pt.lat]);
            pt = mgrs.UTMtoLL(n, e, utmZone);
            ring.push([pt.lon, pt.lat]);
            
            
            // now that the polygon ring is built, shift it left/right to match the x-offset
            // (i.e. how many increments left or right of the dateline, to support wraparound maps)
            //for (i = 0; i < ring.length; i++) {
             //ring[i][0] += offset * constants.GEOGRAPHIC_360;
            //}
            
            polygon = new Polygon([ring]);
            
            var clippedPolygon = geometryEngine.intersect(
              gridGeomUtils.toWebMercator(polygon),
              zonePolygon);
              
            
            if (!clippedPolygon) {
              continue;
            }
            
            var clippedPolyToUTMZone = geometryEngine.intersect(
              gridGeomUtils.toWebMercator(polygon),
              gridGeomUtils.toWebMercator(fullZoneGeometry));
            
            // find the label text of the interval line
            text = utmZone + GZD + (gridLabelUtils.padZero(e % 100000 / interval,  5 - Math.log10(interval))).toString() 
              + (gridLabelUtils.padZero((minN < 0 ? (10000000 + n) : n) % 100000 / interval,
              5 - Math.log10(interval))).toString();

            
            
            
            gridPolygonArgs = {
            "clippedPolygon": clippedPolygon,
            "unclippedPolygon": polygon,
            "clippedPolyToUTMZone": clippedPolyToUTMZone,
            "fullZoneGeometry": fullZoneGeometry,
            "map": map,
            "xmin": e,
            "ymin": n,
            "xmax": e + interval,
            "ymax": n + interval,
            "minMaxType": "utm",
            "utmZone": utmZone,
            "GZD": GZD,
            "utmZonePoly": zonePolygon,
            "text": text
            
            };
            
            gridPolygon = new GridPolygon(gridPolygonArgs);
            polyTest.push(gridPolygon);
        
        } 
        
      }
      return polyTest;
      
    }

  };
});