//! Functions for rendering historical data rather than live streaming data.
// @flow

const _ = require('lodash');
const chroma = require('chroma-js');

import { getInitialBandValues, getBandIndex } from '../calc';
import { renderInitial, drawBand, drawBands } from './render';
import { reRenderTrades, updateTextInfo, renderScales } from './paperRender';

/**
 * Given a set of historical price level updates and trade data as well as the settings for the visualization's current
 * display settings, re-renders all visible historical bands.
 */
function histRender(vizState, canvas, recalcMaxBandValues) {
  vizState.histRendering = true;
  // return;
  // re-render the background to overwrite up all previous price bands
  renderInitial(vizState, canvas);

  // find the price levels at the beginning of the visible time window by filtering the list of price level updates
  // there isn't a need to sort them by timestamp because they should already be sorted
  const initialPriceLevels = {};
  _.each(_.filter(vizState.priceLevelUpdates, levelUpdate => {
    return levelUpdate.timestamp <= vizState.minTimestamp;
  }), ({price, volume, isBid}) => {
    initialPriceLevels[price] = {
      volume: volume,
      isBid: isBid
    };
  });
  const curPriceLevels = _.cloneDeep(initialPriceLevels);

  // set up the initial active bands using the generated initial price levels
  const initialBandValues = getInitialBandValues(
    vizState.minTimestamp, curPriceLevels, vizState.minPrice, vizState.maxPrice, vizState.priceGranularity,
    vizState.pricePrecision
  );
  vizState.activeBands = _.cloneDeep(initialBandValues);

  // if a setting has changed causing us to need to re-calculate max band values, do so.
  if(recalcMaxBandValues) {
    renderScales(vizState);
    // and create a variable to hold the max band volume of the current simulated price update
    let maxVisibleBandVolume = +_.maxBy(initialBandValues, 'volume').volume;

    _.each(vizState.priceLevelUpdates, ({price, volume, timestamp, isBid}) => {
      // ignore level updates already taken into account
      if(timestamp <= vizState.minTimestamp) {
        return;
      }

      const volumeDiff = curPriceLevels[price] ? +volume - +curPriceLevels[price].volume : +volume;
      curPriceLevels[price] = {volume: volume, isBid: isBid};
      const bandIndex = getBandIndex(vizState, price);
      if(bandIndex >= 0 && bandIndex < vizState.priceGranularity) {
        const activeBand = vizState.activeBands[bandIndex];
        const rawVolume = +activeBand.volume + volumeDiff;
        const fixedVolume = rawVolume.toFixed(vizState.pricePrecision);
        activeBand.volume = fixedVolume;

        // if it broke the max visible volume record, update that as well.
        if(rawVolume > maxVisibleBandVolume) {
          maxVisibleBandVolume = rawVolume;
        }
      }
    });

    // set both the current and max visible band volumes to vizState
    vizState.maxVisibleBandVolume = maxVisibleBandVolume.toFixed(vizState.pricePrecision);

    // generate a new color scaler function
    vizState.scaleColor = chroma.scale(vizState.colorScheme).mode('lch').domain([0, +maxVisibleBandVolume]);

    // reset the active band values before continuing with normal hist render
    vizState.activeBands = _.cloneDeep(initialBandValues);
  }

  // loop through all of the visible price updates, drawing bands and updating the book as we go
  let curTimestamp;
  // how many ms across a pixel is
  const pixelWidth = (vizState.maxTimestamp - vizState.minTimestamp) / vizState.canvasWidth;
  _.each(vizState.priceLevelUpdates, ({price, volume, timestamp, isBid}) => {
    // ignore level updates already taken into account
    if(timestamp <= vizState.minTimestamp) {
      return;
    }

    const volumeDiff = initialPriceLevels[price] ? +volume - +initialPriceLevels[price].volume : +volume;

    // update the price level to reflect the update
    initialPriceLevels[price] = {
      volume: volume,
      isBid: isBid,
    };

    // draw the band between the last update for the band and the current timestamp if its visible
    const bandIndex = getBandIndex(vizState, price);
    if(bandIndex >= 0 && bandIndex < vizState.priceGranularity) {
      const activeBand = vizState.activeBands[bandIndex];

      // if the band's length is less than a pixel, don't bother drawing it but still update volume.
      if(timestamp - activeBand.startTimestamp > pixelWidth) {
        activeBand.endTimestamp = timestamp;
        drawBand(vizState, activeBand, bandIndex, canvas.getContext('2d'));
        activeBand.startTimestamp = vizState.activeBands[bandIndex].endTimestamp;
      }

      // update the band volume and end timestamp to reflect this update
      const rawVolume = +activeBand.volume + volumeDiff;
      activeBand.volume = rawVolume.toFixed(vizState.pricePrecision);
    }

    // update the most recent timestamp
    curTimestamp = timestamp;
  });

  // update the postions of the trade markers
  reRenderTrades(vizState);

  // update displayed price information
  updateTextInfo(vizState);

  // finally, draw all the bands to be updated with the most recent prices
  drawBands(vizState, curTimestamp, canvas);

  vizState.histRendering = false;
}

export { histRender };
