//! An interactive limit orderbook visualization showing the locations of limit orders, trade executions, and price action.
// @flow

import React from 'react';
const _ = require('lodash');
import paper from 'paper';

import { ChangeShape } from '../util';
import { getMaxVisibleBandVolume, getInitialBandValues, getTopOfBook } from '../calc';
import { renderInitial, renderUpdate } from './render';
import { initPaperCanvas } from './paperRender';

class Orderbook extends React.Component {
  constructor(props) {
    super(props);
    this.vizState = {
      // zoom settings
      timeScale: 1000 * 20, // how much time to display on the viz in ms
      minTimestamp: null,
      maxTimestamp: null,
      minPrice: null,
      maxPrice: null,
      priceGranularity: 60, // the number of destinct price levels to mark on the visualization
      timeGranuality: 1000, // the min number of ms that can exist as a distinct unit
      maxVisibleBandVolume: null,
      manualZoom: false, // if true, then we shouldn't re-adjust the zoom level
      // duplicated settings from props
      canvasHeight: props.canvasHeight,
      canvasWidth: props.canvasWidth,
      pricePrecision: props.pricePrecision,
      // visual settings
      backgroundColor: '#141414',
      maxTradeMarketRadius: 10,
      // rendering state
      activeBands: null, // Array<BandDef>
      activePrices: null, // { [key: number]: BandDef }
      priceLevelUpdates: [], // Array<{price: number, volume: number, timestamp: number, isBid: boolean}>
      trades: [], // Array<{timestamp: number, price: number, amountTraded: number}>
      // bestBid: null,
      // bestBidChanges: [],
      // bestAsk: null,
      // bestAskChanges: [],
      maxRenderedTrade: 0,
    };
  }

  componentWillMount() {
    // calculate initial zoom levels given the starting orderbook
    this.vizState.minTimestamp = this.props.initialTimestamp;
    this.vizState.maxTimestamp = this.props.initialTimestamp + this.vizState.timeScale;
    this.vizState.minPrice = this.props.minPrice;
    this.vizState.maxPrice = this.props.maxPrice;
    this.vizState.maxVisibleBandVolume = getMaxVisibleBandVolume(
      this.props.curBook, this.props.minPrice, this.props.maxPrice, this.vizState.priceGranularity, this.vizState.pricePrecision
    );

    // populate the active prices from the initial book image
    const activePrices = {};
    _.each(this.props.curBook, (val: {volume: number, isBid: boolean}, price: number) => {
      activePrices[parseFloat(price).toFixed(this.vizState.pricePrecision)] = {
        startTimestamp: this.props.initialTimestamp,
        endTimestamp: this.props.initialTimestamp,
        volume: val.volume.toFixed(this.vizState.pricePrecision),
        isBid: val.isBid,
      };
    });
    this.vizState.activePrices = activePrices;

    // get the initial top-of-book bid and ask prices
    // const {bestBid, bestAsk} = getTopOfBook(this.vizState.activePrices, this.vizState.pricePrecision);
    // this.vizState.bestBid = bestBid;
    // this.vizState.bestAsk = bestAsk;

    // create the initial band values using the initial book image
    this.vizState.activeBands = getInitialBandValues(
      this.props.initialTimestamp, this.props.curBook, this.props.minPrice, this.props.maxPrice, this.vizState.priceGranularity,
      this.vizState.pricePrecision
    );

    // set up the price level updates with the initial prices
    const priceLevelUpdates = [];
    _.each(this.vizState.activePrices, (value, price) => {
      priceLevelUpdates.push({price: price, timestamp: this.props.initialTimestamp, volume: value.volume, isBid: value.isBid});
    });
    this.vizState.priceLevelUpdates = priceLevelUpdates;
  }

  componentDidMount() {
    renderInitial(this.vizState, this.nativeCanvas);

    // initialize the PaperJS environment on the internal canvas
    this.vizState.paperscope = new paper.PaperScope();
    this.vizState.paperscope.setup(this.paperCanvas);
    initPaperCanvas(this.vizState);
  }

  componentWillReceiveProps(nextProps) {
    if(!_.isEqual(nextProps.change, this.props.change)) {
      // if we've got a new update, render it
      renderUpdate(this.vizState, nextProps.change, this.nativeCanvas);
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
      <div id='obWrapper' style={{width: this.props.canvasWidth}}>
        <canvas
          height={this.props.canvasHeight}
          id='nativeCanvas'
          ref={function(canvas){this.nativeCanvas = canvas;}.bind(this)}
          style={{ marginRight: -this.props.canvasWidth - 2, width: this.props.canvasWidth}}
          width={this.props.canvasWidth}
        />

        <canvas
          height={this.props.canvasHeight}
          id='paperCanvas'
          ref={function(canvas){this.paperCanvas = canvas;}.bind(this)}
          style={{ marginRight: -2 }}
          width={this.props.canvasWidth}
        />
      </div>
    );
  }
}

Orderbook.propTypes = {
  canvasHeight: React.PropTypes.number,
  canvasWidth: React.PropTypes.number,
  change: React.PropTypes.shape(ChangeShape).isRequired,
  curBook: React.PropTypes.object.isRequired,
  initialTimestamp: React.PropTypes.number.isRequired,
  maxPrice: React.PropTypes.number.isRequired,
  minPrice: React.PropTypes.number.isRequired,
  pricePrecision: React.PropTypes.number.isRequired,
};

Orderbook.defaultProps = {
  canvasHeight: 600,
  canvasWidth: 900
};

export default Orderbook;
