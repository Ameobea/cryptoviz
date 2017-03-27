//! Functions for rendering historical data rather than live streaming data.
// @flow

const assert = require('assert');

const _ = require('lodash');

import { getInitialBandValues, getBandIndex, getMaxVisibleBandVolume } from '../calc';
import { renderInitial, drawBand, drawBands } from './render';
import { reRenderTrades } from './paperRender';

/**
 * Given a set of historical price level updates and trade data as well as the settings for the visualization's current
 * display settings, re-renders all visible historical bands.
 */
function histRender(vizState, canvas) {
  // re-render the background to overwrite up all previous price bands
  renderInitial(vizState, canvas);

  // calculate a new max volume
  vizState.maxVisibleBandVolume = getMaxVisibleBandVolume(
    vizState, vizState.activePrices, vizState.minPrice, vizState.maxPrice, vizState.priceGranularity, vizState.pricePrecision
  );

  // find the price levels at the beginning of the visible time window by filtering the list of price level updates
  // there isn't a need to sort them by timestamp because they should already be sorted
  const curPriceLevels = {};
  _.each(_.filter(vizState.priceLevelUpdates, levelUpdate => levelUpdate.timestamp <= vizState.minTimestamp), ({price, volume, isBid}) => {
    curPriceLevels[price] = {
      volume: volume,
      isBid: isBid
    };
  });

  // set up the initial active bands using the generated initial price levels
  vizState.activeBands = getInitialBandValues(
    vizState.minTimestamp, curPriceLevels, vizState.minPrice, vizState.maxPrice, vizState.priceGranularity,
    vizState.pricePrecision
  );

  // loop through all of the visible price updates, drawing bands and updating the book as we go
  let curTimestamp;
  _.each(vizState.priceLevelUpdates, ({price, volume, timestamp, isBid}) => {
    const volumeDiff = curPriceLevels[price] ? +volume - +curPriceLevels[price].volume : +volume;

    // update the price level to reflect the update
    curPriceLevels[price] = {
      volume: volume,
      isBid: isBid,
    };

    // draw the band between the last update for the band and the current timestamp if its visible
    const bandIndex = getBandIndex(vizState, price);
    if(bandIndex >= 0 && bandIndex < vizState.priceGranularity) {
      const activeBand = vizState.activeBands[bandIndex];
      activeBand.endTimestamp = timestamp;
      drawBand(vizState, activeBand, bandIndex, canvas.getContext('2d'));

      // update the band volume and end timestamp to reflect this update
      const rawVolume = +activeBand.volume + volumeDiff;
      activeBand.volume = rawVolume.toFixed(vizState.pricePrecision);
      activeBand.startTimestamp = vizState.activeBands[bandIndex].endTimestamp;
      assert(_.isEqual(activeBand, vizState.activeBands[bandIndex]));
    }

    // update the most recent timestamp
    curTimestamp = timestamp;
  });

  // update the postions of the trade markers
  reRenderTrades(vizState);

  // finally, draw all the bands to be updated with the most recent prices
  drawBands(vizState, curTimestamp, canvas);
}

export { histRender };
