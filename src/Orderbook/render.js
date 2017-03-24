//! Functions for rendering the visualization's components on the canvas
// @flow

const _ = require('lodash');

import { gpp, getPricesFromBook } from '../calc';

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
    activeBands: Array<BandDef>,
    activePrices: { [price: number]: BandDef },
    oldBands: { [price: number]: Array<BandDef> },
    minPrice: number,
    maxVisibleBandVolume: number,
    priceGranularity: number,
    timeGranularity: number,
    timeScale: number
  }, change, curTimestamp: number, scope
) {
  if(change.modification) {
    const price = change.modification.price;
    // price range between the bottom and top of each band
    const bandPriceSpan = (vizState.maxPrice - vizState.minPrice) / vizState.priceGranularity;
    const curPriceIndex = Math.floor((price - vizState.minPrice) / bandPriceSpan);
    // if the update is not visible, no need to re-render so exit early
    if(curPriceIndex < 0 || curPriceIndex > (vizState.priceGranularity - 1)) {
      return;
    }

    const activeBand = vizState.activeBands[curPriceIndex];
    const activePrice = vizState.activePrices[price];
    const volumeDiff = change.modification.newAmount - activePrice.volume;
    if(activePrice) {
      const totalTime = curTimestamp - activeBand.startTimestamp;
      if(totalTime <= vizState.timeGranularity) {
        // if the band is still smaller than the minimum granularity, average the prices together and re-render it
        const prevTime = activeBand.endTimestamp - activeBand.startTimestamp;
        const timeSince = curTimestamp - activeBand.endTimestamp;
        const avgVolume = ((prevTime / totalTime) * activeBand.volume) + ((timeSince / totalTime) * change.modification.newAmount);
        drawOrderNotification(volumeDiff, curTimestamp, vizState.maxVisibleBandVolume);
        activePrice.endTimestamp = curTimestamp;
        activePrice.volume = avgVolume;
        activeBand.volume += volumeDiff;
        // TODO: See if this is a performance issue for very rapid modifications and if so, only re-render this band or
        //       don't render anything at all.
        return drawBands(vizState.maxVisibleBandVolume, vizState.priceGranularity, scope);
      } else {
        // if the modification is after the minimum granularity, create a new band and move the old band to `oldBands`.
        vizState.oldBands[price].push(activeBand);
      }
    }

    vizState.activePrices[price] = {
      startTimestamp: curTimestamp,
      endTimestamp: curTimestamp,
      volume: change.modification.newAmount,
    };
    activeBand.volume += volumeDiff;
  } else if(change.removal) {
    // TODO
  } else if(change.newTrade) {
    // TODO
  }

  // TODO: Handle the viz hitting the right side of the canvas

  // update the visualization and re-draw all active bands.
  drawBands(vizState, scope);
}

/**
 * Draws all active bands on the visualization.
 */
function drawBands(vizState, curTimestamp, scope) {
  const {activeBands, maxVisibleBandVolume, canvasHeight, timeScale, priceGranularity} = vizState;
  const realDefs = _.map(
    _.filter(Object.keys(activeBands),
    price => activeBands[price] !== undefined), price => activeBands[price]
  );

  // draw all the active bands and add a small bit of extra time at the right side so new bands are immediately visible
  _.each(realDefs, band => {
    band.endTimestamp = curTimestamp;
    drawBand(
      vizState, band.startTimestamp, band.endTimestamp + (.01 * timeScale), band.price, canvasHeight, band.volume,
      maxVisibleBandVolume, priceGranularity, scope
    );
  });
}

/**
 * Draws a volume band on the visualization with the specified dimensions.  It calculates the correct shading value for the band
 * by comparing its volume to the volume of other visible bands in the visualization.
 */
function drawBand(vizState, startTimestamp: number, endTimestamp: number, index: number, volume: number, scope) {
  const bandHeight = (vizState.canvasHeight / vizState.priceGranularity);
  const topPrice = index * bandHeight;
  const bottomPrice = bottomPrice + bandHeight;
  const topLeftCoords = gpp(vizState, startTimestamp, topPrice);
  const bottomRightCoords = gpp(vizState, endTimestamp, bottomPrice);

  // set the scope to active, render the rectangular path, and draw it to the canvas
  scope.activate();
  const bg = new scope.Path.Rectangle(
    new scope.Point(topLeftCoords.x, topLeftCoords.y),
    new scope.Point(bottomRightCoords.x, bottomRightCoords.y)
  );
  bg.fillColor = getBandColor(volume, vizState.maxVisibleBandVolume, scope);
  scope.view.draw();
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
