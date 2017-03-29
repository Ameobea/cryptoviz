//! An interactive limit orderbook visualization showing the locations of limit orders, trade executions, and price action.
// @flow

import React from 'react';
const _ = require('lodash');

import { ChangeShape } from '../util';
import { getInitialPriceRange, getMaxVisibleBandVolume, getInitialBandValues } from '../calc';
import { renderInitial, renderUpdate } from './render';

class Orderbook extends React.Component {
  constructor(props) {
    super(props);
    this.vizState = {
      // zoom settings
      timeScale: 1000 * 60, // how much time to display on the viz in ms
      minTimestamp: null,
      maxTimestamp: null,
      minPrice: null,
      maxPrice: null,
      priceGranularity: 100, // the number of destinct price levels to mark on the visualization
      timeGranuality: 1000, // the min number of ms that can exist as a distinct unit
      maxVisibleBandVolume: null,
      // duplicated settings from props
      canvasHeight: props.canvasHeight,
      canvasWidth: props.canvasWidth,
      // visual settings
      backgroundColor: '#141414',
      // rendering state
      activeBands: null, // Array<BandDef>
      activePrices: null, // { [key: number]: BandDef }
      priceLevelUpdates: [], // Array<{price: number, volume: number, timestamp: number, isBid: boolean}>
      trades: [], // Array<{timestamp: number, price: number, amountTraded: number}>
    };
  }

  componentWillMount() {
    // calculate initial zoom levels given the starting orderbook
    // const {min, max} = getInitialPriceRange(this.props.curBook);
    this.vizState.minTimestamp = this.props.initialTimestamp;
    this.vizState.maxTimestamp = this.props.initialTimestamp + this.vizState.timeScale;
    this.vizState.minPrice = this.props.minPrice;
    this.vizState.maxPrice = this.props.maxPrice;
    this.vizState.maxVisibleBandVolume = getMaxVisibleBandVolume(
      this.props.curBook, this.props.minPrice, this.props.maxPrice, this.vizState.priceGranularity
    );

    // populate the active prices from the initial book image
    const activePrices = {};
    _.each(this.props.curBook, (val: {volume: number, isBid: boolean}, price: number) => {
      activePrices[price] = {
        startTimestamp: this.props.initialTimestamp,
        endTimestamp: this.props.initialTimestamp,
        volume: val.volume,
        isBid: val.isBid,
      };
    });
    this.vizState.activePrices = activePrices;

    // create the initial band values using the initial book image
    this.vizState.activeBands = getInitialBandValues(
      this.props.initialTimestamp, this.props.curBook, this.props.minPrice, this.props.maxPrice, this.vizState.priceGranularity
    );

    // set up the price level updates with the initial prices
    const priceLevelUpdates = [];
    _.each(this.vizState.activePrices, (value, price) => {
      priceLevelUpdates.push({price: price, timestamp: this.props.initialTimestamp, volume: value.volume});
    });
    this.vizState.priceLevelUpdates = priceLevelUpdates;
  }

  componentDidMount() {
    renderInitial(this.vizState, this.canvas);
  }

  componentWillReceiveProps(nextProps) {
    if(!_.isEqual(nextProps.change, this.props.change)) {
      // if we've got a new update, render it
      renderUpdate(this.vizState, nextProps.change, this.canvas);
    }
  }

  shouldComponentUpdate(nextProps) {
    // only re-render if we need to resize
    if(nextProps.canvasHeight !== this.props.canvasHeight || nextProps.canvasWidth !== this.props.canvasWidth) {
      return true;
    }

    return false;
  }

  render() {
    return (
      <canvas
        height={this.props.canvasHeight}
        ref={function(canvas){this.canvas = canvas;}.bind(this)}
        width={this.props.canvasWidth}
      />
    );
  }
}

Orderbook.propTypes = {
  canvasHeight: React.PropTypes.number,
  canvasWidth: React.PropTypes.number,
  change: React.PropTypes.shape(ChangeShape).isRequired,
  curBook: React.PropTypes.object.isRequired,
  initialTimestamp: React.PropTypes.number.isRequired,
  minPrice: React.PropTypes.number.isRequired,
  maxPrice: React.PropTypes.number.isRequired,
};

Orderbook.defaultProps = {
  canvasHeight: 600,
  canvasWidth: 900
};

export default Orderbook;
