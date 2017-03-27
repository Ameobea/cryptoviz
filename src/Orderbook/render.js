//! Functions for rendering the visualization's components on the canvas
// @flow

const _ = require('lodash');
const chroma = require('chroma-js');

import { gpp, getBandIndex, getPricesFromBook } from '../calc';
import { histRender } from './histRender';
import { renderOrderNotification, renderTradeNotification } from './paperRender';

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
  let volumeDiff: number, fixedPrice, curBandIndex, isBid;

  // determine the price level and how much the volume at the update's price level changed
  if(change.modification) {
    fixedPrice = change.modification.price;
    isBid = change.modification.isBid;

    if(vizState.activePrices[fixedPrice]) {
      volumeDiff = +change.modification.newAmount - +vizState.activePrices[fixedPrice].volume;
    } else {
      volumeDiff = +change.modification.newAmount;
    }

    renderOrderNotification(volumeDiff, timestamp, vizState.maxVisibleBandVolume);
  } else if(change.removal) {
    fixedPrice = change.removal.price;
    isBid = change.removal.isBid;

    if(vizState.activePrices[fixedPrice]) {
      volumeDiff = -+vizState.activePrices[fixedPrice].volume;
    } else {
      // console.error(`All orders removed at price level ${price} but we had no volume level there before!`);
      volumeDiff = 0;
    }

    renderOrderNotification(volumeDiff, timestamp, vizState.maxVisibleBandVolume);
  } else if(change.newTrade) {
    // console.log(change.newTrade);
    fixedPrice = change.newTrade.price;
    isBid = change.newTrade.wasBidFilled;

    if(vizState.activePrices[fixedPrice]) {
      volumeDiff = -+change.newTrade.amountTraded;
    } else {
      console.error(
        `New trade of amount ${change.newTrade.amountTraded} reported at price ${change.newTrade.price}` +
        'but we don\'t have any recorded volume at that level!'
      );
      volumeDiff = 0;
    }

    vizState.trades.push(
      {timestamp: timestamp, volume: change.newTrade.amountTraded, isBid: isBid, price: fixedPrice}
    );
    renderTradeNotification(vizState, fixedPrice, change.newTrade.amountTraded, timestamp, isBid);
  }

  const price = +fixedPrice;

  // determine the index of the band in which this price update lies
  curBandIndex = getBandIndex(vizState, price);

  let newPriceVolume = volumeDiff + parseFloat(vizState.activePrices[fixedPrice] ? vizState.activePrices[fixedPrice].volume : 0);
  // console.log(newPriceVolume);
  if(newPriceVolume < 0) {
    newPriceVolume = 0;
    // console.warn(`Negative new volume at price ${price}`);
  }
  vizState.activePrices[fixedPrice] = {
    volume: newPriceVolume,
    isBid: isBid,
  };

  // if auto-zoom adjust is on and the trade is very close to being off the screen, adjust visible price levels
  if(!vizState.manualZoom && change.newTrade) {
    if(change.newTrade.price >= .995 * vizState.maxPrice) {
      vizState.maxPrice = (vizState.maxPrice * 1.005).toFixed(vizState.pricePrecision);
      console.log(`Setting max visible price to ${vizState.maxPrice} in response to a edge trade.`);
      return histRender(vizState, canvas);
    } else if(change.newTrade.price <= 1.005 * vizState.minPrice) {
      vizState.minPrice = (vizState.minPrice * .995).toFixed(vizState.pricePrecision);
      console.log(`Setting min visible price to ${vizState.minPrice} in response to a edge trade.`);
      return histRender(vizState, canvas);
    }
  }

  // if the band that's being updated is the current high-volume band,
  // re-render the entire visualization with a different shading based on the new max volume
  if(curBandIndex > 0 && curBandIndex < vizState.priceGranularity) {
    if(vizState.activeBands[curBandIndex].volume === vizState.maxVisibleBandVolume) {
      console.log('New max band value; re-rendering...');
      return histRender(vizState, canvas);
    }
  }

  // // if this modification took all the volume at a price level, update the best bid/ask
  // if(newPriceVolume === 0 /*&& fixedPrice == vizState.bestBid || fixedPrice == vizState.bestAsk*/) {
  //   updateBestBidAsk(vizState, timestamp, isBid);
  // // if this modification adds volume at a level better than the current best bid/ask, update as well
  // } else if((isBid && price > vizState.bestBid) || (!isBid && price < vizState.bestAsk)) {
  //   updateBestBidAsk(vizState, timestamp, isBid);
  // }

  const activeBand = vizState.activeBands[curBandIndex];

  // draw the old band if it is currently visible.  If not, draw all the other bands and exit.
  if(curBandIndex >= 0 && curBandIndex < vizState.priceGranularity) {
    activeBand.endTimestamp = timestamp;
    drawBand(vizState, activeBand, /*(vizState.priceGranularity - 1) -*/ curBandIndex, canvas.getContext('2d'));
  } else {
    return drawBands(vizState, timestamp, canvas);
  }

  // create a new band and add this modification to the list of price level volume updates
  activeBand.startTimestamp = timestamp;
  vizState.priceLevelUpdates.push(
    {price: fixedPrice, timestamp: timestamp, volume: newPriceVolume.toFixed(vizState.pricePrecision), isBid: isBid}
  );

  // update the volume level and end timestamp of the band to reflect this modification
  const rawVolume = +activeBand.volume + +volumeDiff;
  activeBand.volume = rawVolume.toFixed(vizState.pricePrecision);
  if(activeBand.volume < 0) {
    activeBand.volume = 0;
  }
  activeBand.endTimestamp = timestamp;

  // if we've come very near to or crossed the right side of the canvas with this update, re-draw the viz with a larger view
  const timeRange = vizState.maxTimestamp - vizState.minTimestamp;
  if(timestamp > vizState.minTimestamp + (.95 * timeRange)) {
    vizState.maxTimestamp += .2 * (vizState.maxTimestamp - vizState.minTimestamp);
    return histRender(vizState, canvas);
  }
  // TODO: Handle the maximum displayed volume changing

  // update the visualization and re-draw all active bands.
  drawBands(vizState, timestamp, canvas);
}

// /**
//  * When a order removal or trade wipes out all the volume at a price level, re-calculate the best bid and ask.
//  */
// function updateBestBidAsk(vizState, timestamp, isBid: boolean) {
//   const allFixedPrices = getPricesFromBook(vizState.activePrices, vizState.pricePrecision);
//   if(isBid) {
//     const thisSideFixedPrices = _.filter(allFixedPrices, fixedPrice => {
//       return +vizState.activePrices[fixedPrice].volume > 0 && vizState.activePrices[fixedPrice].isBid;
//     });
//     vizState.bestBid = _.maxBy(thisSideFixedPrices, parseFloat);
//     vizState.bestBidChanges.push({timestamp: timestamp, price: vizState.bestBid});
//   } else {
//     const thisSideFixedPrices = _.filter(allFixedPrices, fixedPrice => {
//       return +vizState.activePrices[fixedPrice].volume > 0 && !vizState.activePrices[fixedPrice].isBid;
//     });
//     vizState.bestAsk = _.minBy(thisSideFixedPrices, parseFloat);
//     vizState.bestAskChanges.push({timestmap: timestamp, price: vizState.bestAsk});
//   }
//   console.log(`Updated best ${isBid ? 'bid' : 'ask'} to ${isBid ? vizState.bestBid : vizState.bestAsk}.`);
// }

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
      drawBand(vizState, band, /*(priceGranularity - 1) -*/ i, ctx);
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
  const lowPrice = (index * bandPriceSpan) + parseFloat(vizState.minPrice);
  const highPrice = lowPrice + bandPriceSpan;
  const topLeftCoords = gpp(vizState, band.startTimestamp, highPrice);
  const bottomRightCoords = gpp(vizState, band.endTimestamp, lowPrice);

  ctx.fillStyle = getBandColor(band, vizState.maxVisibleBandVolume);
  ctx.fillRect(Math.floor(topLeftCoords.x), Math.ceil(topLeftCoords.y), Math.ceil(bottomRightCoords.x - topLeftCoords.x), bottomRightCoords.y - topLeftCoords.y);
}

/**
 * Given a band's density, the maximum visible density on the visualization, and the visualization's style settings,
 * determines the background color of a volume band and returns it.
 */
function getBandColor(band, maxVisibleVolume: string/* TODO: include viz color settings */) {
  // TODO
  // const colorScheme = ['#141414', 'F39'];
  const colorScheme = ['#141414', '#7cbeff'];
  const scale = chroma.scale(colorScheme).mode('lch').domain([0, +maxVisibleVolume]);
  if(+band.volume > +maxVisibleVolume) {
    // console.warn(`Received band with volume of ${band.volume} which is greater than supplied max band volume of ${maxVisibleVolume}`);
  }
  return scale(+band.volume).hex();
}

export { renderInitial, renderUpdate, drawBand, drawBands };
