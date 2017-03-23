//! Functions for rendering the visualization's components on the canvas
// @flow

const _ = require('lodash');

import { getPixelPosition, getPricesFromBook } from '../calc';
const gpp = getPixelPosition;

type Orderbook = { [key: number]: {price: number, isBid: boolean} };
type BandDef = {startTimestamp: number, endTimestamp: number, volume: number};

/**
 * Given the component's vizState and a reference to the canvas, renders the initial view of the orderbook given
 * the visualization.
 */
function renderInitial(vizState: {curBook: Orderbook, canvasHeight: number, canvasWidth: number}, scope: any) {
  scope.activate();
  // fill in the background
  const bg = new scope.Path.Rectangle(new scope.Point(0, 0), new scope.Point(vizState.canvasWidth, vizState.canvasHeight));
  bg.fillColor = vizState.backgroundColor;

  // render the drawings to the view
  scope.view.draw();
}

/**
 * Given a change to the orderbook, updates the visualization according to what changed.
 */
function renderUpdate(
  vizState: {
    activeBands: { [price: number]: BandDef },
    oldBands: { [price: number]: Array<BandDef> },
    maxVisibleVolume: number,
    priceGranularity: number,
    timeGranularity: number,
    timeScale: number
  }, change, curTimestamp: number, scope
) {
  if(change.modification) {
    const price = change.modification.price;
    const activeBand = vizState.activeBands[price];
    if(activeBand) {
      const totalTime = curTimestamp - activeBand.startTimestamp;
      if(totalTime <= vizState.timeGranularity) {
        // if the band is still smaller than the minimum granularity, average the prices together and re-render it
        const prevTime = activeBand.endTimestamp - activeBand.startTimestamp;
        const timeSince = curTimestamp - activeBand.endTimestamp;
        const avgVolume = ((prevTime / totalTime) * activeBand.volume) + ((timeSince / totalTime) * change.modification.newAmount);
        drawOrderNotification(change.modification.newAmount - activeBand.volume, curTimestamp, vizState.maxVisibleVolume);
        activeBand.endTimestamp = curTimestamp;
        activeBand.volume = avgVolume;
        // TODO: See if this is a performance issue for very rapid modifications and if so, only re-render this band or
        // don't render anything at all.
        // TODO TODO TODO: Create bands which are derivatives of the active price volumes
        return drawBands(vizState.maxVisibleVolume, vizState.priceGranularity, scope);
      } else {
        // if the modification is after the minimum granularity, create a new band and move the old band to `oldBands`.
        vizState.oldBands[price].push(activeBand);
      }
    }

    vizState.activeBands[price] = {
      startTimestamp: curTimestamp,
      endTimestamp: curTimestamp,
      volume: change.modification.newAmount,
    };
  } else if(change.removal) {
    // TODO
  } else if(change.newTrade) {
    // TODO
  }

  // TODO: Handle the viz hitting the right side of the canvas

  // update the visualization and re-draw all active bands.
  drawBands(vizState.maxVisibleVolume, vizState.timeScale, vizState.priceGranularity, scope);
}

/**
 * Draws all active bands on the visualization.
 */
function drawBands(
  activeBands: { [price: number]: BandDef }, maxVisibleVolume: number, timeScale: number, priceGranularity: number, scope
) {
  const realDefs = _.map(
    _.filter(Object.keys(activeBands),
    price => activeBands[price] !== undefined), price => activeBands[price]
  );

  // draw all the active bands and add a small bit of extra time at the right side so new bands are immediately visible
  _.each(realDefs, band => {
    drawBand(
      band.startTimestamp, band.endTimestamp + (.01 * timeScale), band.price, band.volume, maxVisibleVolume, priceGranularity, scope
    );
  });
}

/**
 * Draws a volume band on the visualization with the specified dimensions.  It calculates the correct shading value for the band
 * by comparing its volume to the volume of other visible bands in the visualization.
 */
function drawBand(
  startTimestamp: number, endTimestamp: number, price: number, volume: number, maxVisibleVolume: number,
  priceGranularity: number, scope
) {
  const bg = new scope.Path.Rectangle(new scope.Point(0, 0), new scope.Point(vizState.canvasWidth, vizState.canvasHeight));
  bg.fillColor = getBandColor(volume, maxVisibleVolume, scope);
}

/**
 * Given a band's density, the maximum visible density on the visualization, and the visualization's style settings,
 * determines the background color of a volume band and returns it.
 */
function getBandColor(volume: number, maxVisibleVolume: number, scope/* TODO: include viz color settings */) {
  // TODO
  return scope.Color(volume / maxVisibleVolume);
}

/**
 * Displays a transitive notification of an order placement, modification, or removal on the visualization.  The intensity of the
 * displayed notification is scaled according to the size of the modification in comparison to the rest of the visible book.
 */
function drawOrderNotification(price: number, timestamp: number, sizeDiff: number, maxVisibleVolume: number) {

}

export { renderInitial, renderUpdate };
