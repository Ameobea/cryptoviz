//! Utility functions used for calculating values used for rendering the visualization
// @flow

const _ = require('lodash');

type Orderbook = { [key: number]: {price: number, isBid: boolean} };

/**
 * Given informatoin about the size and zoom of the visualization, calculates the X and Y positions of a certain
 * price/timestamp point on the canvas.  Returns a result like `{x: 882.12312, y: 299.399201}`.
 */
function getPixelPosition(
  minPrice: number, maxPrice: number, minTime: number, maxTime: number,
  canvasHeight: number, canvasWidth: number, price: number, timestamp: number
): {x: number, y: number} {
  const x = ((timestamp - minTime) / (maxTime - minTime)) * canvasWidth;
  const y = ((price - minPrice) / (maxTime - minTime)) * canvasHeight;
  return {x: x, y: y};
}

/**
 * Given a book in `Orderbook` format, returns a sorted list of prices from it.
 */
function getPricesFromBook(book: Orderbook): Array<number> {
  return _.map(Object.keys(book).sort(), parseFloat);
}

/**
 * Given an image of the orderbook as a HashMap, calculates an optimal min and max zoom using the density of orders
 * and the current top-of-book price.
 * @return {{min: number, max: number}} - The optimal locations of the min and max visible prices
 */
function getInitialPriceRange(book: Orderbook): {min: number, max: number} {
  const prices = getPricesFromBook(book);

  // calculate the total amount of volume listed in the book
  let totalVolume = 0;
  _.each(prices, price => {totalVolume += book[price].volume;});

  let minPrice;
  let partialSum = 0;
  // find the price where 25% of the volume is below it and the price where 25% is above it
  for(let i=0; i<prices.length; i++) {
    const price = prices[i];
    partialSum += book[price].volume;
    const percentage = partialSum / totalVolume;
    if(percentage >= .75) {
      return {min: minPrice, max: price};
    } else if(percentage >= .25) {
      minPrice = price;
    }
  }

  console.error('Finished looping in `getInitialPriceRange` and reached end of loop!');
}

/**
 * Given an image of an orderbook as a HashMap, calculates the current best offer on both the bid and ask side.
 * @return {{bestBid: number, bestAsk: number}} - The current top-of-book bid and ask
 */
function getTopOfBook(book: Orderbook): {bestBid: number, bestAsk: number} {
  const prices = getPricesFromBook(book);

  for(let i=0; i<prices.length; i++) {
    if(!book[prices[i]].isBid) {
      return {bestBid: prices[i-1].price, bestAsk: prices[i].price};
    }
  }

  console.error('Finished looping book in `getTopOfBook` and reached end of loop!');
}

/**
 * Given an image of the initial orderbook and the range of visible prices, finds the maximum amount of volume
 * located in one band to be used for shading the other bands.
 */
function getMaxVisibleBandVolume(book: Orderbook, minVisible: number, maxVisible: number): number {
  const visiblePrices = _.filter(getPricesFromBook(book), price => price >= minVisible && price <= maxVisible);
  return _.maxBy(visiblePrices, price => book[price].volume).volume;
}

export { getPixelPosition, getPricesFromBook, getInitialPriceRange, getTopOfBook, getMaxVisibleBandVolume };
