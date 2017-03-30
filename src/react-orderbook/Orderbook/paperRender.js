//! Functions for rendering the PaperJS parts of the visualization on the second canvas

const _ = require('lodash');

import { gpp, getPixelX, getPixelY, getTimestampFromPixel, getPriceFromPixel, getBandIndex } from '../calc';
import { histRender } from './histRender';

/**
 * Renders in the price and time scales for the visualization
 */
function renderScales() {
  // TODO
}

/**
 * Adds a new trade to the visualization, connecting the line between it and previous trades (if they exist).
 */
function renderNewTrade() {
  // TODO
}

/**
 * Displays a transitive notification of an order placement, modification, or removal on the visualization.  The intensity of the
 * displayed notification is scaled according to the size of the modification in comparison to the rest of the visible book.
 */
function renderOrderNotification() {
  // TODO
}

/**
 * Returns an array of all rendered path elements of the paperscope that are trade markers.
 */
function getTradeNotifications(paperscope) {
  return _.filter(paperscope.project.activeLayer.children, item => _.includes(item.name, 'trade-'));
}

/**
 * Sets up some initial state for the paper canvas.
 */
function initPaperCanvas(vizState) {
  const { Color, Path, Point, PointText } = vizState.paperscope;

  vizState.paperscope.activate();
  // create two paths that will draw price lines
  const bidTradeLine = new Path({
    segments: [],
    selected: false,
  });
  bidTradeLine.name = 'bidTradeLine';
  bidTradeLine.strokeColor = 'blue'; // TODO: Make config option
  bidTradeLine.data.pointMeta = []; // create a space to hold price/timestamp data of trades to be used for re-scaling

  const askTradeLine = new Path({
    segments: [],
    selected: false,
  });
  askTradeLine.name = 'askTradeLine';
  askTradeLine.strokeColor = 'red'; // TODO: Make config option
  askTradeLine.data.pointMeta = []; // create a space to hold price/timestamp data of trades to be used for re-scaling

  // set up a crosshair to show currently hovered price/timestamp and display information about it
  const verticalCrosshair = new Path({
    name: 'verticalCrosshair',
    segments: [new Point(0, 0), new Point(0, vizState.canvasHeight)],
    strokeColor: new Color(0, 188, 212, 0.22),
    strokeWidth: 0.5,
  });
  const horizontalCrosshair = new Path({
    name: 'horizontalCrosshair',
    segments: [new Point(0, 0), new Point(vizState.canvasWidth, 0)],
    strokeColor: new Color(0, 188, 212, 0.22),
    strokeWidth: 0.5,
  });

  // create area to display currently hovered price, timestamp, and volume
  const timestampText = new PointText(new Point(vizState.canvasWidth - 150, 10));
  timestampText.fillColor = vizState.textColor;
  timestampText.name = 'timestampText';
  timestampText.fontSize = '12px';
  const priceRangeText = new PointText(new Point(vizState.canvasWidth - 150, 25));
  priceRangeText.fillColor = vizState.textColor;
  priceRangeText.name = 'priceRangeText';
  priceRangeText.fontSize = '12px';
  const curVolumeText = new PointText(new Point(vizState.canvasWidth - 150, 40));
  curVolumeText.fillColor = vizState.textColor;
  curVolumeText.name = 'curVolumeText';
  curVolumeText.fontSize = '12px';

  // set up mouse movement listener to move crosshair and update data
  vizState.paperscope.project.view.onMouseMove = e => {
    const {x, y} = e.point;
    vizState.hoveredX = x;
    vizState.hoveredY = y;
    updateTextInfo(vizState);
  };
}

/**
 * Updates the displayed price, timestamp, and volume information in the top-right corner of the visualization
 */
function updateTextInfo(vizState) {
  const x = vizState.hoveredX;
  const y = vizState.hoveredY;
  const timestamp = getTimestampFromPixel(vizState, x);
  const price = getPriceFromPixel(vizState, y);

  // update crosshair data
  const verticalSegments = vizState.paperscope.project.activeLayer.children['verticalCrosshair'].segments;
  verticalSegments[0].point.x = x;
  verticalSegments[1].point.x = x;

  const horizontalSegments = vizState.paperscope.project.activeLayer.children['horizontalCrosshair'].segments;
  horizontalSegments[0].point.y = y;
  horizontalSegments[1].point.y = y;

  // update text fields
  vizState.paperscope.project.activeLayer.children['timestampText'].content = new Date(timestamp).toString().split(' ')[4];
  const bandPriceSpan = (+vizState.maxPrice - +vizState.minPrice) / vizState.priceGranularity;
  const hoveredBandIndex = getBandIndex(vizState, price);
  const bandBottomPrice = +vizState.minPrice + (bandPriceSpan * hoveredBandIndex);
  const bandTopPrice = bandBottomPrice + bandPriceSpan;
  vizState.paperscope.project.activeLayer.children['priceRangeText'].content = `${bandBottomPrice.toFixed(8)} - ${bandTopPrice.toFixed(8)}`;
  vizState.paperscope.project.activeLayer.children['curVolumeText'].content = vizState.activeBands[hoveredBandIndex].volume;
}

/**
 * Draws a marker on the visualizaiton indicating that a trade took place, its bid/ask status, and its size.
 * Also updates the trade lines.
 */
function renderTradeNotification(vizState, fixedPrice, amountTraded, timestamp, isBid) {
  vizState.paperscope.activate();
  // if the size of this trade is a new high, we need to re-scale all the old markers
  if(+amountTraded > +vizState.maxRenderedTrade) {
    const sizeDiff = vizState.maxRenderedTrade / amountTraded;
    const tradeNotifications = getTradeNotifications(vizState.paperscope);
    _.each(tradeNotifications, item => {
      item.scale(sizeDiff);
    });

    vizState.maxRenderedTrade = amountTraded;
  }

  const {x, y} = gpp(vizState, timestamp, fixedPrice);
  let priceLine;
  if(isBid) {
    priceLine = vizState.paperscope.project.activeLayer.children['bidTradeLine'];
  } else {
    priceLine = vizState.paperscope.project.activeLayer.children['askTradeLine'];
  }

  // draw an additional point to keep the price line squared if this isn't the first point
  if(priceLine.data.pointMeta.length !== 0) {
    const lastPrice = _.last(priceLine.data.pointMeta).price;
    const point = new vizState.paperscope.Point(x, getPixelY(vizState, lastPrice));
    priceLine.data.pointMeta.push({timestamp: timestamp, price: lastPrice});
    priceLine.add(point);
  }

  // add the new trade to its corresponding line
  const point = new vizState.paperscope.Point(x, y);
  priceLine.add(point);
  priceLine.data.pointMeta.push({timestamp: timestamp, price: fixedPrice});

  const radius = (amountTraded / vizState.maxRenderedTrade) * vizState.maxTradeMarketRadius;
  // don't bother drawing it if its diameter is less than a pixel
  if(radius < .5) {
    return;
  }

  const notification = new vizState.paperscope.Path.Circle(new vizState.paperscope.Point(x, y), radius);
  notification.name = `trade-${timestamp}_${fixedPrice}`;
  notification.fillColor = isBid ? 'blue' : 'red';

  // reset the status of the point line extension
  if(isBid) {
    vizState.bidTradeLineExtended = false;
  } else {
    vizState.askTradeLineExtended = false;
  }
}

/**
 * Triggered every price update.  In order to keep the trade lines from crisscrossing, extend them out every price update.
 * If an extension point has already been drawn, modifies its position rather than drawing another one to keep things clean.
 */
function extendTradeLines(vizState, timestamp) {
  const bidLine = vizState.paperscope.project.activeLayer.children['bidTradeLine'];
  const askLine = vizState.paperscope.project.activeLayer.children['askTradeLine'];

  if(vizState.bidTradeLineExtended) {
    // already have a reference point, so find it for each of the lines and alter its position
    bidLine.segments[bidLine.segments.length - 1].point.x = getPixelX(vizState, timestamp);
    bidLine.segments[bidLine.segments.length - 1].point.y = getPixelY(vizState, _.last(bidLine.data.pointMeta).price);
  } else if(bidLine.data.pointMeta.length > 0) {
    // we have no reference point, so add a new one for each of the lines using the price of the last trade point
    const lastPrice = _.last(bidLine.data.pointMeta).price;
    const {x, y} = gpp(vizState, timestamp, lastPrice);
    bidLine.data.pointMeta.push({timestamp: timestamp, price: lastPrice});
    bidLine.add(new vizState.paperscope.Point(x, y));

    // make sure to remember that we added this reference point for next time
    vizState.bidTradeLineExtended = true;
  }

  if(vizState.askTradeLineExtended) {
    askLine.segments[askLine.segments.length - 1].point.x = getPixelX(vizState, timestamp);
    askLine.segments[askLine.segments.length - 1].point.y = getPixelY(vizState, _.last(askLine.data.pointMeta).price);
  } else if(askLine.data.pointMeta.length > 0) {
    const lastPrice = _.last(askLine.data.pointMeta).price;
    const {x, y} = gpp(vizState, timestamp, lastPrice);
    askLine.data.pointMeta.push({timestamp: timestamp, price: lastPrice});
    askLine.add(new vizState.paperscope.Point(x, y));

    vizState.askTradeLineExtended = true;
  }
}

/**
 * Moves all of the currently drawn trade markers to their proper locations based on the current `vizState`.
 */
function reRenderTrades(vizState) {
  vizState.paperscope.activate();

  // move all of the circular trade markers
  _.each(getTradeNotifications(vizState.paperscope), item => {
    // get the timestamp and price out of the item's name
    const split = item.name.split('-')[1].split('_');
    const {x, y} = gpp(vizState, +split[0], split[1]);
    item.position = new vizState.paperscope.Point(x, y);
  });

  // move all of the points of the price line as well
  const bidLine = vizState.paperscope.project.activeLayer.children['bidTradeLine'];
  const askLine = vizState.paperscope.project.activeLayer.children['askTradeLine'];
  _.each(bidLine.segments, (segment, i) => {
    const {timestamp, price} = bidLine.data.pointMeta[i];
    const {x, y} = gpp(vizState, timestamp, price);
    segment.point.x = x;
    segment.point.y = y;
  });
  _.each(askLine.segments, (segment, i) => {
    const {timestamp, price} = askLine.data.pointMeta[i];
    const {x, y} = gpp(vizState, timestamp, price);
    segment.point.x = x;
    segment.point.y = y;
  });
}

/**
 * Updates the new top-of-book bid or ask price // TODO
 */
function renderNewBestPrice(vizState) {
  // TODO?
}

export {
  renderScales, renderNewTrade, renderOrderNotification, renderTradeNotification, renderNewBestPrice, reRenderTrades,
  initPaperCanvas, extendTradeLines, updateTextInfo
};
