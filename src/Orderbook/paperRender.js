//! Functions for rendering the PaperJS parts of the visualization on the second canvas

const _ = require('lodash');

import { gpp } from '../calc';
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
  vizState.paperscope.activate();
  // create two paths that will draw price lines
  const bidTradeLine = new vizState.paperscope.Path({
    segments: [],
    selected: false,
  });
  bidTradeLine.name = 'bidTradeLine';
  bidTradeLine.strokeColor = 'red'; // TODO: Make config option
  bidTradeLine.data.trades = []; // create a space to hold price/timestamp data of trades to be used for re-scaling

  const askTradeLine = new vizState.paperscope.Path({
    segments: [],
    selected: false,
  });
  askTradeLine.name = 'askTradeLine';
  askTradeLine.strokeColor = 'blue'; // TODO: Make config option
  askTradeLine.data.trades = []; // create a space to hold price/timestamp data of trades to be used for re-scaling

  // vizState.paperscope.view.draw();
}

/**
 * Draws a transitory market on the visualizatino indicating that a trade took place.
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

  // add the new trade to its corresponding line
  const {x, y} = gpp(vizState, timestamp, fixedPrice);
  let priceLine;
  if(isBid) {
    priceLine = vizState.paperscope.project.activeLayer.children['bidTradeLine'];
  } else {
    priceLine = vizState.paperscope.project.activeLayer.children['askTradeLine'];
  }
  const point = new vizState.paperscope.Point(x, y);
  priceLine.add(point);
  priceLine.data.trades.push({timestamp: timestamp, price: fixedPrice});

  const radius = (amountTraded / vizState.maxRenderedTrade) * vizState.maxTradeMarketRadius;
  // don't bother drawing it if its diameter is less than a pixel
  if(radius < .5) {
    return;
  }

  const notification = new vizState.paperscope.Path.Circle(new vizState.paperscope.Point(x, y), radius);
  notification.name = `trade-${timestamp}_${fixedPrice}`;
  notification.fillColor = isBid ? 'red' : 'blue';

  // vizState.paperscope.view.draw();
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
    const {x, y} = gpp(vizState, parseInt(split[0]), split[1]);
    item.position = new vizState.paperscope.Point(x, y);
  });

  // move all of the points of the price line as well
  const bidLine = vizState.paperscope.project.activeLayer.children['bidTradeLine'];
  const askLine = vizState.paperscope.project.activeLayer.children['askTradeLine'];
  _.each(bidLine.segments, (segment, i) => {
    const {timestamp, price} = bidLine.data.trades[i];
    const {x, y} = gpp(vizState, timestamp, price);
    segment.point.x = x;
    segment.point.y = y;
  });
  _.each(askLine.segments, (segment, i) => {
    const {timestamp, price} = askLine.data.trades[i];
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
  initPaperCanvas
};
