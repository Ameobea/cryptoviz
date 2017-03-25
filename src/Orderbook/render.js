//! Functions for rendering the visualization's components on the canvas
// @flow

const _ = require('lodash');
const chroma = require('chroma-js');

import { gpp, getPricesFromBook } from '../calc';

type Orderbook = { [price: number]: {volume: number, isBid: boolean} };
type BandDef = {startTimestamp: number, endTimestamp: number, volume: number, isBid: ?boolean};

/**
 * Given the component's vizState and a reference to the canvas, renders the initial view of the orderbook given
 * the visualization.
 */
function renderInitial(vizState: {curBook: Orderbook, canvasHeight: number, canvasWidth: number}, canvas: any) {
  // fill in the background
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = vizState.backgroundColor;
  ctx.fillRect(0, 0, vizState.canvasWidth, vizState.canvasHeight);
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
  }, change, canvas
) {
  const timestamp = change.timestamp;
  if(change.modification) {
    const price = change.modification.price;
    // price range between the bottom and top of each band
    const bandPriceSpan = (vizState.maxPrice - vizState.minPrice) / vizState.priceGranularity;

    // determine the index of the band in which this price update lies
    let curPriceIndex;
    if(price === vizState.maxPrice) {
      curPriceIndex = vizState.priceGranularity - 1;
    } else {
      curPriceIndex = Math.floor((price - vizState.minPrice) / bandPriceSpan);
      // if the update is not visible, no need to re-render so exit early
      if(curPriceIndex < 0 || curPriceIndex > (vizState.priceGranularity - 1)) {
        return;
      }
    }

    const activeBand = vizState.activeBands[curPriceIndex];

    // determine the change in volume level for the band
    let volumeDiff;
    if(vizState.activePrices[price]) {
      volumeDiff = change.modification.newAmount - vizState.activePrices[price].volume;
    } else {
      volumeDiff = change.modification.newAmount;
    }

    vizState.activePrices[price] = {
      volume: change.modification.newAmount,
      isBid: change.modification.isBid,
    };

    const totalTime = timestamp - activeBand.startTimestamp;
    if(totalTime <= vizState.timeGranularity) {
      // if the band is still smaller than the minimum granularity, average the prices together and re-render it
      const prevTime = activeBand.endTimestamp - activeBand.startTimestamp;
      const timeSince = timestamp - activeBand.endTimestamp;
      const prevBandVolume = ((prevTime / totalTime) * activeBand.volume);
      const newBandVolume = ((timeSince / totalTime) * (activeBand.volume + volumeDiff));
      volumeDiff = (prevBandVolume + newBandVolume) / 2;
      drawOrderNotification(volumeDiff, timestamp, vizState.maxVisibleBandVolume);
      // TODO: See if this is a performance issue for very rapid modifications and if so, only re-render this band or
      //       don't render anything at all.
      return drawBands(vizState.maxVisibleBandVolume, vizState.priceGranularity, canvas);
    } else {
      // draw the old band
      drawBand(vizState, activeBand, (vizState.priceGranularity - 1) - curPriceIndex, canvas.getContext('2d'));

      // somce the modification is after the minimum granularity, create a new band and move the old band to `oldBands`.
      vizState.oldBands[curPriceIndex].push(_.cloneDeep(activeBand));
      activeBand.startTimestamp = timestamp;
    }

    // update the volume level and end timestamp of the band to reflect this modification
    activeBand.volume += volumeDiff;
    activeBand.endTimestamp = timestamp;
  } else if(change.removal) {
    // TODO
  } else if(change.newTrade) {
    // TODO
  }

  // TODO: Handle the viz hitting the right side of the canvas

  // update the visualization and re-draw all active bands.
  drawBands(vizState, timestamp, canvas);
}

/**
 * Draws all active bands on the visualization.
 */
function drawBands(vizState, curTimestamp, canvas) {
  const {activeBands, priceGranularity} = vizState;
  const realDefs = _.map(
    _.filter(Object.keys(activeBands).sort(),
    price => activeBands[price] !== undefined), price => activeBands[price]
  );

  // draw all the active bands and add a small bit of extra time at the right side so new bands are immediately visible
  const ctx = canvas.getContext('2d');
  _.each(realDefs, (band: BandDef, i: number) => {
    band.endTimestamp = curTimestamp;
    if(band.volume !== 0) {
      // render the band, subtracting the index from the total number of bands because the coordinates are reversed on the canvas
      drawBand(vizState, band, (priceGranularity - 1) - i, ctx);
    }
  });
}

/**
 * Draws a volume band on the visualization with the specified dimensions.  It calculates the correct shading value for the band
 * by comparing its volume to the volume of other visible bands in the visualization.
 */
function drawBand(vizState, band: {startTimestamp: number, endTimestamp: number}, index: number, ctx) {
  const bandPriceSpan = ((vizState.maxPrice - vizState.minPrice) / vizState.priceGranularity);
  const bottomPrice = (index * bandPriceSpan) + vizState.minPrice;
  const topPrice = bottomPrice + bandPriceSpan;
  const topLeftCoords = gpp(vizState, band.startTimestamp, bottomPrice);
  const bottomRightCoords = gpp(vizState, band.endTimestamp, topPrice);

  ctx.fillStyle = getBandColor(band, vizState.maxVisibleBandVolume);
  ctx.fillRect(topLeftCoords.x, topLeftCoords.y, bottomRightCoords.x - topLeftCoords.x, bottomRightCoords.y - topLeftCoords.y);
}

/**
 * Given a band's density, the maximum visible density on the visualization, and the visualization's style settings,
 * determines the background color of a volume band and returns it.
 */
function getBandColor(band, maxVisibleVolume: number/* TODO: include viz color settings */) {
  // TODO
  // const colorScheme = ['#141414', 'F39'];
  const colorScheme = ['#141414', '#7cbeff'];
  const scale = chroma.scale(colorScheme).mode('lch').domain([0, maxVisibleVolume]);
  return scale(band.volume).hex();
}

/**
 * Displays a transitive notification of an order placement, modification, or removal on the visualization.  The intensity of the
 * displayed notification is scaled according to the size of the modification in comparison to the rest of the visible book.
 */
function drawOrderNotification(price: number, timestamp: number, sizeDiff: number, maxVisibleVolume: number) {
  // TODO
}

export { renderInitial, renderUpdate };
