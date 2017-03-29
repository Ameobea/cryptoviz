//! Functions for rendering historical data rather than live streaming data.
// @flow

const assert = require('assert');

const _ = require('lodash');

import { getInitialBandValues, getBandIndex, getMaxVisibleBandVolume } from '../calc';
import { renderInitial, drawBand, drawBands } from './render';

/**
 * Given a set of historical price level updates and trade data as well as the settings for the visualization's current
 * display settings, re-renders all visible historical bands.
 */
function histRender(vizState, canvas) {
  // re-render the background to overwrite up all previous price bands
  renderInitial(vizState, canvas);

  // calculate a new max volume
  vizState.maxVisibleBandVolume = getMaxVisibleBandVolume(
    vizState.activePrices, vizState.minPrice, vizState.maxPrice, vizState.priceGranularity
  );

  // find the price levels at the beginning of the visible time window by filtering the list of price level updates
  // there isn't a need to sort them by timestamp because they should already be sorted
  const initialPriceLevels = {};
  _.each(_.filter(vizState.priceLevelUpdates, levelUpdate => levelUpdate.timestamp <= vizState.minTimestamp), ({price, volume, isBid}) => {
    // only store visible prices
    if(price >= vizState.minPrice && price <= vizState.maxPrice) {
      initialPriceLevels[price] = {
        volume: volume,
        isBid: isBid
      };
    }
  });
  vizState.activePrices = initialPriceLevels;

  // set up the initial active bands using the generated initial price levels
  vizState.activeBands = getInitialBandValues(
    vizState.minTimestamp, initialPriceLevels, vizState.minPrice, vizState.maxPrice, vizState.priceGranularity
  );

  // loop through all of the visible price updates, drawing bands and updating the book as we go
  let curTimestamp;
  const visibleLevelUpdates = _.filter(vizState.priceLevelUpdates, levelUpdate => {
    return levelUpdate.timestamp > vizState.minTimestamp && levelUpdate.timestamp <= vizState.maxTimestamp
      && vizState.minPrice < levelUpdate.price && vizState.maxPrice > levelUpdate.price;
  });
  _.each(visibleLevelUpdates, ({price, volume, timestamp, isBid}) => {
    const volumeDiff = vizState.activePrices[price] ? volume - vizState.activePrices[price].volume : volume;

    // update the price level to reflect the update
    vizState.activePrices[price] = {
      volume: volume,
      isBid: isBid,
    };

    // draw the band between the last update for the band and the current timestamp
    const bandIndex = getBandIndex(vizState, price);
    const activeBand = vizState.activeBands[bandIndex];
    activeBand.endTimestamp = timestamp;
    drawBand(vizState, activeBand, (vizState.priceGranularity - 1) - bandIndex, canvas.getContext('2d'));

    // update the band volume and end timestamp to reflect this update
    activeBand.volume += volumeDiff;
    activeBand.startTimestamp = vizState.activeBands[bandIndex].endTimestamp;
    assert(_.isEqual(activeBand, vizState.activeBands[bandIndex]));

    // update the most recent timestamp
    curTimestamp = timestamp;
  });

  // TODO: Draw all visible trades

  // finally, draw all the bands to be updated with the most recent prices
  drawBands(vizState, curTimestamp, canvas);
}

export { histRender };
