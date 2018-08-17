//! Functions for rendering the PaperJS parts of the visualization on the second canvas
/* eslint no-unused-vars: 'off' */

const _ = require('lodash');

import {
  gpp,
  getPixelX,
  getPixelY,
  getTimestampFromPixel,
  getPriceFromPixel,
  getBandIndex,
} from '../calc';
import { histRender } from './histRender';

/**
 * Renders in the price and time scales for the visualization
 */
export const renderScales = vizState => {
  const { Color, Path, Point, PointText } = vizState.paperscope;
  // remove any pre-existing price lines first
  vizState.paperscope.project.activeLayer.children
    .filter(
      item => item.name && (item.name.includes('priceLine_') || item.name.includes('levelText_'))
    )
    .forEach(item => item.remove());

  // draw a line on the left side of the visualization to serve as the price axis
  const axisLine = new Path({
    segments: [new Point(60, 0), new Point(60, vizState.canvasHeight)],
    strokeColor: vizState.textColor,
  });

  // Draw to draw one price label every 50 pixels.  Have them be inline with bands.
  const labelCount = Math.floor((vizState.canvasHeight - 1) / 50);
  const bandPriceSpan = (+vizState.maxPrice - +vizState.minPrice) / vizState.priceGranularity;
  const bandPixelHeight = vizState.canvasHeight / vizState.priceGranularity;
  // how many price bands between each labeled price level
  const levelSpacing = Math.ceil(50 / bandPixelHeight);
  const totalLevels = Math.floor(vizState.canvasHeight / levelSpacing);
  let curLevel = vizState.priceGranularity;
  while (curLevel > 0) {
    // determine the raw price of where we'd like to place the band
    const rawPrice = +vizState.minPrice + bandPriceSpan * curLevel;
    // find the pixel value of the bottom of this price band
    const bandBottomPixel = vizState.canvasHeight - bandPixelHeight * curLevel;
    // write the price level at that point
    const levelText = new PointText(new Point(0, bandBottomPixel));
    levelText.fontSize = '10px';
    levelText.fillColor = vizState.textColor;
    levelText.content = rawPrice.toFixed(vizState.pricePrecision);
    levelText.name = `levelText_${bandBottomPixel}`;
    // draw a light line across the chart at that level
    const priceLine = new Path({
      name: `priceLine_${curLevel}`,
      segments: [new Point(60, bandBottomPixel), new Point(vizState.canvasWidth, bandBottomPixel)],
      strokeColor: new Color(0, 188, 212, 0.72),
      strokeWidth: 0.5,
    });

    curLevel -= levelSpacing;
  }
};

/**
 * Adds a new trade to the visualization, connecting the line between it and previous trades (if they exist).
 */
export const renderNewTrade = () => {
  // TODO
};

/**
 * Displays a transitive notification of an order placement, modification, or removal on the visualization.  The intensity of the
 * displayed notification is scaled according to the size of the modification in comparison to the rest of the visible book.
 */
export const renderOrderNotification = () => {
  // TODO
};

/**
 * Returns an array of all rendered path elements of the paperscope that are trade markers.
 */
export const getTradeNotifications = paperscope =>
  paperscope.project.activeLayer.children.filter(item => item.name && item.name.includes('trade-'));

/**
 * Sets up some initial state for the paper canvas.
 */
export const initPaperCanvas = vizState => {
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
    const { x, y } = e.point;
    vizState.hoveredX = x;
    vizState.hoveredY = y;
    updateTextInfo(vizState);
  };

  // start creating the bounding rectangle
  vizState.paperscope.project.view.onMouseDown = e => {
    vizState.firstZoomRectangleCorner = e.point;
    vizState.zoomRectangle = new Path.Rectangle(e.point, e.point);
    vizState.zoomRectangle.fillColor = new Color(200, 200, 200, 0.4);
  };

  // set up the zoom rectangle handler
  vizState.paperscope.project.view.onMouseDrag = e => {
    vizState.zoomRectangle.remove();
    vizState.zoomRectangle = new Path.Rectangle(vizState.firstZoomRectangleCorner, e.point);
    vizState.zoomRectangle.fillColor = new Color(200, 200, 200, 0.4);
  };

  // zoom into the selected region when the mouse is released
  vizState.paperscope.project.view.onMouseUp = e => {
    zoomToRectangle(vizState, e.point);
  };

  // draw the axis and price scales
  renderScales(vizState);
};

/**
 * Zooms into the area selected by the user
 */
export const zoomToRectangle = (vizState, finalPoint) => {
  if (!vizState.zoomRectangle) {
    return;
  }
  vizState.zoomRectangle.remove();
  vizState.zoomRectangle = null;

  // ignore extremely tiny/accidental zooms
  const xDiff = vizState.firstZoomRectangleCorner.x - finalPoint.x;
  const yDiff = vizState.firstZoomRectangleCorner.y - finalPoint.y;
  if (Math.abs(xDiff) <= 3 || Math.abs(yDiff) <= 3) return;

  const startPrice = getPriceFromPixel(vizState, vizState.firstZoomRectangleCorner.y);
  const startTime = getTimestampFromPixel(vizState, vizState.firstZoomRectangleCorner.x);
  const endPrice = getPriceFromPixel(vizState, finalPoint.y);
  const endTime = getTimestampFromPixel(vizState, finalPoint.x);

  if (startPrice > endPrice) {
    vizState.minPrice = endPrice.toFixed(vizState.pricePrecision);
    vizState.maxPrice = startPrice.toFixed(vizState.pricePrecision);
  } else {
    vizState.maxPrice = endPrice.toFixed(vizState.pricePrecision);
    vizState.minPrice = startPrice.toFixed(vizState.pricePrecision);
  }

  if (startTime > endTime) {
    vizState.minTimestamp = endTime;
    vizState.maxTimestamp = startTime;
  } else {
    vizState.maxTimestamp = endTime;
    vizState.minTimestamp = startTime;
  }

  vizState.manualZoom = true;
  if (!vizState.resetButtom) drawResetZoomButton(vizState);
  histRender(vizState, vizState.nativeCanvas, true);
};

/**
 * Creates a `Reset Zoom` button at the top-left of the visualization that can be used to reset the zoom back to default
 */
export const drawResetZoomButton = vizState => {
  if (vizState.resetButton) return;
  const { Color, Path, Point, PointText } = vizState.paperscope;

  vizState.resetButton = new Path.Rectangle(new Point(70, 20), new Point(147, 40));
  vizState.resetButton.fillColor = new Color(200, 200, 200, 0.22);
  vizState.resetButton.onMouseDown = e => {
    resetZoom(vizState);
  };

  vizState.resetText = new PointText(new Point(75, 35));
  vizState.resetText.onMouseDown = e => {
    resetZoom(vizState);
  };
  vizState.resetText.fillColor = vizState.textColor;
  vizState.resetText.name = 'priceRangeText';
  vizState.resetText.fontSize = '12px';
  vizState.resetText.content = 'Reset Zoom';
};

/**
 * Re-calculates optimal zoom levels and re-renders them into the visualization
 */
export const resetZoom = vizState => {
  if (vizState.resetButton) {
    vizState.resetButton.remove();
    vizState.resetText.remove();
  }
  vizState.resetButton = null;
  vizState.resetText = null;

  vizState.minTimestamp = _.first(vizState.priceLevelUpdates).timestamp;
  vizState.maxTimestamp = _.last(vizState.priceLevelUpdates).timestamp + 10 * 1000;
  if (vizState.trades.length > 0) {
    vizState.minPrice = _.minBy(vizState.trades, trade => +trade.price).price * 0.995;
    vizState.maxPrice = _.maxBy(vizState.trades, trade => +trade.price).price * 1.005;
  } else {
    vizState.minPrice = vizState.initialMinPrice;
    vizState.maxPrice = vizState.initialMaxPrice;
  }
  vizState.manualZoom = false;

  histRender(vizState, vizState.nativeCanvas, true);
};

/**
 * Updates the displayed price, timestamp, and volume information in the top-right corner of the visualization
 */
export const updateTextInfo = vizState => {
  const x = vizState.hoveredX;
  const y = vizState.hoveredY;
  const timestamp = getTimestampFromPixel(vizState, x);
  const price = getPriceFromPixel(vizState, y);

  // update crosshair data
  const verticalSegments =
    vizState.paperscope.project.activeLayer.children['verticalCrosshair'].segments;
  verticalSegments[0].point.x = x;
  verticalSegments[1].point.x = x;

  const horizontalSegments =
    vizState.paperscope.project.activeLayer.children['horizontalCrosshair'].segments;
  horizontalSegments[0].point.y = y;
  horizontalSegments[1].point.y = y;

  // update text fields
  vizState.paperscope.project.activeLayer.children['timestampText'].content = new Date(timestamp)
    .toString()
    .split(' ')[4];
  const bandPriceSpan = (+vizState.maxPrice - +vizState.minPrice) / vizState.priceGranularity;
  const hoveredBandIndex = getBandIndex(vizState, price);
  const bandBottomPrice = +vizState.minPrice + bandPriceSpan * hoveredBandIndex;
  const bandTopPrice = bandBottomPrice + bandPriceSpan;
  vizState.paperscope.project.activeLayer.children[
    'priceRangeText'
  ].content = `${bandBottomPrice.toFixed(8)} - ${bandTopPrice.toFixed(8)}`;
  vizState.paperscope.project.activeLayer.children['curVolumeText'].content =
    vizState.activeBands[hoveredBandIndex].volume;
};

/**
 * Draws a marker on the visualizaiton indicating that a trade took place, its bid/ask status, and its size.
 * Also updates the trade lines.
 */
export const renderTradeNotification = (vizState, fixedPrice, amountTraded, timestamp, isBid) => {
  vizState.paperscope.activate();
  // if the size of this trade is a new high, we need to re-scale all the old markers
  if (+amountTraded > +vizState.maxRenderedTrade) {
    const sizeDiff = vizState.maxRenderedTrade / amountTraded;
    const tradeNotifications = getTradeNotifications(vizState.paperscope);
    tradeNotifications.forEach(item => item.scale(sizeDiff));

    vizState.maxRenderedTrade = amountTraded;
  }

  const { x, y } = gpp(vizState, timestamp, fixedPrice);
  const priceLine =
    vizState.paperscope.project.activeLayer.children[isBid ? 'bidTradeLine' : 'askTradeLine'];

  // draw an additional point to keep the price line squared if this isn't the first point
  if (priceLine.data.pointMeta.length !== 0) {
    const lastPrice = _.last(priceLine.data.pointMeta).price;
    const point = new vizState.paperscope.Point(x, getPixelY(vizState, lastPrice));
    priceLine.data.pointMeta.push({ timestamp, price: lastPrice });
    priceLine.add(point);
  }

  // add the new trade to its corresponding line
  const point = new vizState.paperscope.Point(x, y);
  priceLine.add(point);
  priceLine.data.pointMeta.push({ timestamp, price: fixedPrice });

  const radius = (amountTraded / vizState.maxRenderedTrade) * vizState.maxTradeMarketRadius;
  // don't bother drawing it if its diameter is less than a pixel
  if (radius < 0.5) {
    return;
  }

  const notification = new vizState.paperscope.Path.Circle(
    new vizState.paperscope.Point(x, y),
    radius
  );
  notification.name = `trade-${timestamp}_${fixedPrice}`;
  notification.fillColor = isBid ? 'blue' : 'red';
  // print out information about the trade when hovered
  notification.onMouseEnter = e => {
    renderTradeHover(vizState, e.point, e.target.area, e.target.name);
  };
  // and remove it when unhovered
  notification.onMouseLeave = e => {
    hideTradeHover(vizState);
  };

  // reset the status of the point line extension
  if (isBid) {
    vizState.bidTradeLineExtended = false;
  } else {
    vizState.askTradeLineExtended = false;
  }
};

/**
 * Displays an info box containing data about the currently hovered trade notification.
 */
export const renderTradeHover = (vizState, { x, y }, area, name) => {
  const { Point, PointText } = vizState.paperscope;
  // determine the start location of the notification
  let displayX, displayY;
  if (x > 160) {
    displayX = x - 50;
  } else {
    displayX = x + 25;
  }

  if (y > 50) {
    displayY = y - 25;
  } else {
    displayY = y + 25;
  }

  const volumeText = new PointText(new Point(displayX, displayY));
  const volume =
    (Math.sqrt(area / Math.PI) / vizState.maxTradeMarketRadius) * vizState.maxRenderedTrade;
  volumeText.content = '~ ' + volume.toFixed(vizState.pricePrecision);
  volumeText.fontSize = '11px';
  volumeText.fillColor = vizState.textColor;
  volumeText.name = 'volumeText';

  // [timestamp, fixedPrice]
  const split = name.split('-')[1].split('_');
  const timeText = new PointText(new Point(displayX, displayY - 15));
  timeText.content = new Date(+split[0]).toString().split(' ')[4];
  timeText.fontSize = '11px';
  timeText.fillColor = vizState.textColor;
  timeText.name = 'timeText';
};

/**
 * Removes the displayed information about the previously hovered trade notification.
 */
export const hideTradeHover = vizState => {
  const item = vizState.paperscope.project.activeLayer.children['volumeText'];
  if (item) {
    vizState.paperscope.project.activeLayer.children['timeText'].remove();
    item.remove();
  }
};

/**
 * Triggered every price update.  In order to keep the trade lines from crisscrossing, extend them out every price update.
 * If an extension point has already been drawn, modifies its position rather than drawing another one to keep things clean.
 */
export const extendTradeLines = (vizState, timestamp) => {
  const bidLine = vizState.paperscope.project.activeLayer.children['bidTradeLine'];
  const askLine = vizState.paperscope.project.activeLayer.children['askTradeLine'];

  if (vizState.bidTradeLineExtended) {
    // already have a reference point, so find it for each of the lines and alter its position
    bidLine.segments[bidLine.segments.length - 1].point.x = getPixelX(vizState, timestamp);
    bidLine.segments[bidLine.segments.length - 1].point.y = getPixelY(
      vizState,
      _.last(bidLine.data.pointMeta).price
    );
  } else if (bidLine.data.pointMeta.length > 0) {
    // we have no reference point, so add a new one for each of the lines using the price of the last trade point
    const lastPrice = _.last(bidLine.data.pointMeta).price;
    const { x, y } = gpp(vizState, timestamp, lastPrice);
    bidLine.data.pointMeta.push({ timestamp: timestamp, price: lastPrice });
    bidLine.add(new vizState.paperscope.Point(x, y));

    // make sure to remember that we added this reference point for next time
    vizState.bidTradeLineExtended = true;
  }

  if (vizState.askTradeLineExtended) {
    askLine.segments[askLine.segments.length - 1].point.x = getPixelX(vizState, timestamp);
    askLine.segments[askLine.segments.length - 1].point.y = getPixelY(
      vizState,
      _.last(askLine.data.pointMeta).price
    );
  } else if (askLine.data.pointMeta.length > 0) {
    const lastPrice = _.last(askLine.data.pointMeta).price;
    const { x, y } = gpp(vizState, timestamp, lastPrice);
    askLine.data.pointMeta.push({ timestamp: timestamp, price: lastPrice });
    askLine.add(new vizState.paperscope.Point(x, y));

    vizState.askTradeLineExtended = true;
  }
};

/**
 * Moves all of the currently drawn trade markers to their proper locations based on the current `vizState`.
 */
export const reRenderTrades = vizState => {
  vizState.paperscope.activate();

  // hide any previously visible trade notification since it's likely no longer hovered
  hideTradeHover(vizState);

  // move all of the circular trade markers
  getTradeNotifications(vizState.paperscope).forEach(item => {
    // get the timestamp and price out of the item's name
    const split = item.name.split('-')[1].split('_');
    const { x, y } = gpp(vizState, +split[0], split[1]);
    item.position = new vizState.paperscope.Point(x, y);
  });

  // move all of the points of the price line as well
  const bidLine = vizState.paperscope.project.activeLayer.children['bidTradeLine'];
  const askLine = vizState.paperscope.project.activeLayer.children['askTradeLine'];

  bidLine.segments.forEach((segment, i) => {
    const { timestamp, price } = bidLine.data.pointMeta[i];
    const { x, y } = gpp(vizState, timestamp, price);
    segment.point.x = x;
    segment.point.y = y;
  });
  askLine.segments.forEach((segment, i) => {
    const { timestamp, price } = askLine.data.pointMeta[i];
    const { x, y } = gpp(vizState, timestamp, price);
    segment.point.x = x;
    segment.point.y = y;
  });
};

/**
 * Updates the new top-of-book bid or ask price // TODO
 */
export const renderNewBestPrice = vizState => {
  // TODO?
};
