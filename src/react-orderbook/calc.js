//! Utility functions used for calculating values used for rendering the visualization
// @flow

const _ = require('lodash');

type Orderbook = { [key: number]: {volume: number, isBid: boolean} };

/**
 * Given informatoin about the size and zoom of the visualization, calculates the X and Y positions of a certain
 * price/timestamp point on the canvas.  Returns a result like `{x: 882.12312, y: 299.399201}`.
 */
function getPixelPosition(
  minPrice: number, maxPrice: number, minTime: number, maxTime: number,
  canvasHeight: number, canvasWidth: number, timestamp: number, price: number
): {x: number, y: number} {
  const x = ((timestamp - minTime) / (maxTime - minTime)) * canvasWidth;
  const y = canvasHeight - (((price - minPrice) / (maxPrice - minPrice)) * canvasHeight);
  return {x: x, y: y};
}

/**
 * Given a timestamp, returns its pixel position.
 */
function getPixelX(vizState, timestamp) {
  return ((timestamp - vizState.minTimestamp) / (vizState.maxTimestamp - vizState.minTimestamp)) * vizState.canvasWidth;
}

/**
 * Given a price, returns its pixel position
 */
function getPixelY(vizState, price) {
  return vizState.canvasHeight - (((+price - vizState.minPrice) / (vizState.maxPrice - vizState.minPrice)) * vizState.canvasHeight);
}

/**
 * Wrapper function around `getPixelPosition` that gets settings from `vizState`
 */
function gpp(
  {minPrice, maxPrice, minTimestamp, maxTimestamp, canvasHeight, canvasWidth}
    : {minPrice: number, maxPrice: number, minTimestamp: number, maxTimestamp: number, canvasHeight: number, canvasWidth: number},
  timestamp: number, price: number
) {
  return getPixelPosition(+minPrice, +maxPrice, minTimestamp, maxTimestamp, canvasHeight, canvasWidth, timestamp, +price);
}

/**
 * Given a book in `Orderbook` format, returns a sorted list of prices from it.
 */
function getPricesFromBook(book: Orderbook, pricePrecision: number): Array<string> {
  const floatKeys = _.map(Object.keys(book), parseFloat).sort((a, b) => a-b);
  return _.map(floatKeys, fp => fp.toFixed(pricePrecision));
}

/**
 * Given an image of the orderbook as a HashMap, calculates an optimal min and max zoom using the density of orders
 * and the current top-of-book price.  NOT CURRENTLY USED.
 * @return {{min: number, max: number}} - The optimal locations of the min and max visible prices
 * @param {number} pricePrecision - The max number of decimals a price level may have.
 */
function getInitialPriceRange(book: Orderbook, pricePrecision: number): {min: number, max: number} {
  const prices = Object.keys(book);

  // calculate the total amount of volume listed in the book
  const totalVolume = _.sumBy(prices, price => book[price].volume * price);
  // _.each(prices, price => {totalVolume += book[price].volume;});

  let minPrice = 0;
  let partialSum = 0;
  // find the price where 25% of the volume is below it and the price where 25% is above it
  for(let i=0; i<prices.length; i++) {
    const price = prices[i];
    partialSum += (book[price].volume * price);
    const percentage = partialSum / totalVolume;
    if(percentage >= .75) {
      return {min: minPrice, max: price};
    } else if(percentage >= .25 && minPrice === 0) {
      minPrice = price;
    }
  }

  console.error('Finished looping in `getInitialPriceRange` and reached end of loop!');
}

/**
 * Given an image of the initial orderbook, returns an array of `BandDef`s that contain the initial volumes for each band
 */
function getInitialBandValues(
  initialTimestamp: number, initialBook: Orderbook, minVisiblePrice: number, maxVisiblePrice: number, priceGranularity: number,
  pricePrecision: number
): Array<BandDef> {
  // const prices = getPricesFromBook(initialBook, pricePrecision);
  const prices = Object.keys(initialBook);

  // price range between the bottom and top of each band
  const bandPriceSpan = (maxVisiblePrice - minVisiblePrice) / priceGranularity;
  const bands = new Array(priceGranularity);
  for(var i=0; i<bands.length; i++) {
    bands[i] = {
      startTimestamp: initialTimestamp,
      endTimestamp: initialTimestamp,
      volume: 0,
    };
  }
  let curBandIndex = 0;

  _.each(prices, price => {
    if((+price >= +minVisiblePrice) && (+price <= +maxVisiblePrice)) {
      if(+price > ((curBandIndex + 1) * bandPriceSpan)) {
        curBandIndex = getBandIndex({maxPrice: maxVisiblePrice, minPrice: minVisiblePrice, priceGranularity: priceGranularity}, price);

        const rawVolume = (+bands[curBandIndex].volume + +initialBook[price].volume);
        bands[curBandIndex].volume = rawVolume.toFixed(pricePrecision);
      }
    }
  });

  return bands;
}

/**
 * Given an image of an orderbook as a HashMap, calculates the current best offer on both the bid and ask side.
 * @return {{bestBid: number, bestAsk: number}} - The current top-of-book bid and ask
 */
function getTopOfBook(book: Orderbook, pricePrecision: number): {bestBid: number, bestAsk: number} {
  const prices = getPricesFromBook(book, pricePrecision);

  for(let i=0; i<prices.length; i++) {
    if(!book[prices[i]].isBid) {
      return {bestBid: prices[i-1], bestAsk: prices[i]};
    }
  }

  console.error('Finished looping book in `getTopOfBook` and reached end of loop!');
}

/**
 * Given an image of the initial orderbook and the range of visible prices, finds the maximum amount of volume
 * located in one band to be used for shading the other bands.
 */
function getMaxVisibleBandVolume(
  vizState, book: Orderbook, minVisibleFixedPrice: string, maxVisibleFixedPrice: string, priceGranularity: number, pricePrecision: number
): string {
  const minVisiblePrice = parseFloat(minVisibleFixedPrice);
  const maxVisiblePrice = parseFloat(maxVisibleFixedPrice);
  const allPrices = _.map(Object.keys(book), parseFloat).sort((a, b) => a-b);
  const visiblePrices = _.filter(allPrices, price => price >= minVisiblePrice && price <= maxVisiblePrice);
  // const visibleFixedPrices = _.map(visiblePrices, fp => fp.toFixed(pricePrecision));

  let curBandIndex = 0;
  let curBandVolume = 0;
  let maxBandVolume = 0;
  _.each(visiblePrices, price => {
    // if this price is outside of the current band, change band index, reset counts, and determine new band index
    const newBandIndex = getBandIndex(vizState, price);
    if(newBandIndex > curBandIndex) {
      if(curBandVolume > maxBandVolume) {
        maxBandVolume = curBandVolume;
      }
      curBandVolume = 0;
      curBandIndex = newBandIndex;
    }

    curBandVolume += +book[price.toFixed(pricePrecision)].volume;
  });

  if(curBandVolume > maxBandVolume) {
    maxBandVolume = curBandVolume;
  }

  return maxBandVolume.toFixed(pricePrecision);
}

/**
 * Given a price level and information about the visualization's current zoom level, calculates the index of the
 * band that the price level is a part of.
 */
function getBandIndex(
  vizState: {maxPrice: number, minPrice: number, priceGranularity: number}, price: number
): number {
  // price range between the bottom and top of each band
  const bandPriceSpan = (+vizState.maxPrice - +vizState.minPrice) / vizState.priceGranularity;

  if(price === vizState.maxPrice) {
    return vizState.priceGranularity - 1;
  } else {
    return Math.floor((+price - +vizState.minPrice) / bandPriceSpan);
  }
}

export {
  getPixelPosition, gpp, getPricesFromBook, getInitialPriceRange, getInitialBandValues,
  getTopOfBook, getMaxVisibleBandVolume, getBandIndex, getPixelX, getPixelY
};
