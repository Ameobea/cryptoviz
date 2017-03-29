//! Functions for rendering the visualization's components on the canvas
// @flow

const _ = require('lodash');
const chroma = require('chroma-js');

import { gpp, getBandIndex } from '../calc';
import { histRender } from './histRender';

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
    activePrices: { [price: number]: {volume: number, isBid: boolean} },
    priceLevelUpdates: Array<{price: number, volume: number, timestamp: number, isBid: boolean}>,
    minPrice: number,
    maxVisibleBandVolume: number,
    priceGranularity: number,
    timeGranularity: number,
    timeScale: number,
    trades: Array<{timestamp: number, price: number, amountTraded: number}>
  }, change, canvas
) {
  // console.log(change);
  const timestamp = change.timestamp;
  let volumeDiff, price, curBandIndex, isBid;

  // determine the price level and how much the volume at the update's price level changed
  if(change.modification) {
    price = change.modification.price;
    isBid = change.modification.isBid;

    if(vizState.activePrices[price]) {
      volumeDiff = change.modification.newAmount - vizState.activePrices[price].volume;
    } else {
      volumeDiff = change.modification.newAmount;
    }

    drawOrderNotification(volumeDiff, timestamp, vizState.maxVisibleBandVolume);
  } else if(change.removal) {
    price = change.removal.price;
    isBid = change.removal.isBid;

    if(vizState.activePrices[price]) {
      volumeDiff = -vizState.activePrices[price].volume;
    } else {
      volumeDiff = 0;
    }

    drawOrderNotification(volumeDiff, timestamp, vizState.maxVisibleBandVolume);
  } else if(change.newTrade) {
    price = change.newTrade.price;
    isBid = change.newTrade.wasBidFilled;

    if(vizState.activePrices[price]) {
      volumeDiff = change.newTrade.amountRemaining - vizState.activePrices[price].volume;
    } else {
      volumeDiff = change.newTrade.amountRemaining;
    }

    vizState.trades.push({timestamp: timestamp, volume: change.newTrade.amountTraded});
    drawTradeNotification(price, change.newTrade.amountTraded, timestamp, vizState.trades);
  }

  // determine the index of the band in which this price update lies
  curBandIndex = getBandIndex(vizState, price);

  // if the band that's being updated is the current high-volume band and the volume change is dramatic,
  // re-render the entire visualization with a different shading based on the new max volume
  if(
    (vizState.activeBands[curBandIndex].volume === vizState.maxVisibleBandVolume) &&
    Math.abs(1 - (Math.abs(volumeDiff) / vizState.activeBands[curBandIndex].volume)) <= .75
  ) {
    console.log('New max value; re-rendering...');
    return histRender(vizState, canvas);
  }

  const newPriceVolume = volumeDiff + (vizState.activePrices[price] ? vizState.activePrices[price].volume : 0);
  vizState.activePrices[price] = {
    volume: newPriceVolume,
    isBid: isBid,
  };

  const activeBand = vizState.activeBands[curBandIndex];

  // draw the old band if it is currently visible
  activeBand.endTimestamp = timestamp;
  if(curBandIndex >= 0 && curBandIndex < vizState.priceGranularity) {
    drawBand(vizState, activeBand, (vizState.priceGranularity - 1) - curBandIndex, canvas.getContext('2d'));
  }

  // create a new band and add this modification to the list of price level volume updates
  activeBand.startTimestamp = timestamp;
  vizState.priceLevelUpdates.push({price: price, timestamp: timestamp, volume: newPriceVolume, isBid: isBid});

  // update the volume level and end timestamp of the band to reflect this modification
  activeBand.volume += volumeDiff;
  activeBand.endTimestamp = timestamp;

  // if we've come very near to or crossed the right side of the canvas with this update, re-draw the viz with a larger view
  const timeRange = vizState.maxTimestamp - vizState.minTimestamp;
  if(timestamp > vizState.minTimestamp + (.9 * timeRange)) {
    vizState.maxTimestamp += (vizState.maxTimestamp - vizState.minTimestamp);
    return histRender(vizState, canvas);
  }
  // TODO: Handle the maximum displayed volume changing

  // update the visualization and re-draw all active bands.
  drawBands(vizState, timestamp, canvas);
}

/**
 * Draws all active bands on the visualization.
 */
function drawBands(vizState, curTimestamp, canvas) {
  const {activeBands, priceGranularity} = vizState;

  // draw all the active bands and add a small bit of extra time at the right side so new bands are immediately visible
  const ctx = canvas.getContext('2d');
  _.each(activeBands, (band: BandDef, i: number) => {
    band.endTimestamp = curTimestamp;
    if(band.volume !== 0) {
      // render the band, subtracting the index from the total number of bands because the coordinates are reversed on the canvas
      // i is the band's index from the bottom of the viz
      drawBand(vizState, band, (priceGranularity - 1) - i, ctx);
    }
  });
}

/**
 * Draws a volume band on the visualization with the specified dimensions.  It calculates the correct shading value for the band
 * by comparing its volume to the volume of other visible bands in the visualization.
 * @param {number} index - The band's index from the top of the page
 */
function drawBand(vizState, band: {startTimestamp: number, endTimestamp: number}, index: number, ctx) {
  const bandPriceSpan = ((vizState.maxPrice - vizState.minPrice) / vizState.priceGranularity);
  const lowPrice = (index * bandPriceSpan) + vizState.minPrice;
  const highPrice = lowPrice + bandPriceSpan;
  const topLeftCoords = gpp(vizState, band.startTimestamp, highPrice);
  const bottomRightCoords = gpp(vizState, band.endTimestamp, lowPrice);

  ctx.fillStyle = getBandColor(band, vizState.maxVisibleBandVolume);
  ctx.fillRect(topLeftCoords.x, topLeftCoords.y, Math.ceil(bottomRightCoords.x - topLeftCoords.x), bottomRightCoords.y - topLeftCoords.y);
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

/**
 * Displays a notification of a trade that has occured.
 */
function drawTradeNotification(price: number, volume: number, timestamp: number, trades: Array<{timestamp: number, volume: number}>) {
  // TODO
}

export { renderInitial, renderUpdate, drawBand, drawBands };
