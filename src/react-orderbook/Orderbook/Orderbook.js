//! An interactive limit orderbook visualization showing the locations of limit orders, trade executions, and price action.
// @flow

import React from 'react';
import PropTypes from 'prop-types';
import _ from 'lodash';
import paper from 'paper';
import chroma from 'chroma-js';

import { ChangeShape } from '../util';
import { getMaxVisibleBandVolume, getInitialBandValues } from '../calc';
import { renderInitial, renderUpdate } from './render';
import { histRender } from './histRender';
import { initPaperCanvas, resetZoom } from './paperRender';
import BottomBar from './BottomBar';

const colorSchemes = {
  'Blue Moon': ['#141414', '#7cbeff'],
  'Candy Floss': ['#141414', '#f53dff'],
  'Deep Sea': ['#141414', '#389dff'],
  Pumpkin: ['#141414', '#ff9232'],
  Chalkboard: ['#030303', '#ffffff'],
  Heat: ['#fff7ec', '#fc8d59', '#7f0000'],
};

class Orderbook extends React.Component {
  constructor(props) {
    super(props);

    this.handleSettingChange = this.handleSettingChange.bind(this);
    this.initState = this.initState.bind(this);

    this.vizState = {
      // zoom settings
      timeScale: 1000 * 20, // how much time to display on the viz in ms
      minTimestamp: null,
      maxTimestamp: null,
      minPrice: null,
      maxPrice: null,
      priceGranularity: 100, // the number of destinct price levels to mark on the visualization
      timeGranuality: 1000, // the min number of ms that can exist as a distinct unit
      maxVisibleBandVolume: null, // the max level a band has ever been at in the current zoom
      manualZoom: false, // if true, then we shouldn't re-adjust the zoom level
      // duplicated settings from props
      canvasHeight: props.canvasHeight,
      canvasWidth: props.canvasWidth,
      pricePrecision: props.pricePrecision,
      nativeCanvas: null,
      // visual settings
      colorScheme: ['#141414', '#7cbeff'],
      backgroundColor: '#141414',
      textColor: '#dbe8ff',
      maxTradeMarketRadius: 10,
      // rendering state
      activeBands: null, // Array<BandDef>
      activePrices: null, // { [key: number]: BandDef }
      priceLevelUpdates: [], // Array<{price: number, volume: number, timestamp: number, isBid: boolean}>
      trades: [], // Array<{timestamp: number, price: number, amountTraded: number}>
      maxBandVolumeChanges: [], // every time the max visible band volume changes, it's recorded here.
      askTradeLineExtended: false,
      bidTradeLineExtended: false,
      hoveredX: 0,
      hoveredY: 0,
      histRendering: false, // set to true during historical renders to try to avoid race conditions
      // bestBid: null,
      // bestBidChanges: [],
      // bestAsk: null,
      // bestAskChanges: [],
      maxRenderedTrade: 0,
    };
  }

  componentWillMount() {
    this.initState(this.props);
  }

  componentDidMount() {
    renderInitial(this.vizState, this.nativeCanvas);
    this.vizState.nativeCanvas = this.nativeCanvas;

    // initialize the PaperJS environment on the internal canvas
    this.vizState.paperscope = new paper.PaperScope();
    this.vizState.paperscope.setup(this.paperCanvas);

    initPaperCanvas(this.vizState);
  }

  componentWillReceiveProps(nextProps) {
    if (!_.isEqual(nextProps.change, this.props.change)) {
      // if we've got a new update, render it
      if (this.vizState.histRendering) console.error(nextProps.change);
      renderUpdate(this.vizState, nextProps.change, this.nativeCanvas);
    } else if (!_.isEqual(nextProps.initialBook, this.props.initialBook)) {
      // currency has changed; reset all internal state and re-initialize component
      console.log('Reinitializing component state with new initial book...');
      this.initState(nextProps);

      console.log('re-rendering canvas...');
      renderInitial(this.vizState, this.nativeCanvas);

      // initialize the PaperJS environment on the internal canvas
      this.vizState.paperscope = new paper.PaperScope();
      this.vizState.paperscope.setup(this.paperCanvas);
      initPaperCanvas(this.vizState);

      // clear old trades from previous currency and reset zoom to default for the new currency
      this.vizState.trades = [];
      resetZoom(this.vizState);

      // Work around strange bug in Paper.JS causing canvas scaling to increase every time that
      // the visualization updates for a new currency
      const pixelRatio = this.vizState.paperscope.project._view._pixelRatio;
      const ctx = this.vizState.paperscope.project._view._context;
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }
  }

  shouldComponentUpdate(nextProps) {
    return (
      nextProps.canvasHeight !== this.props.canvasHeight ||
      nextProps.canvasWidth !== this.props.canvasWidth ||
      !_.isEqual(nextProps.initialBook, this.props.initialBook)
    );
  }

  initState(props) {
    // calculate initial zoom levels given the starting orderbook
    this.vizState.minTimestamp = props.initialTimestamp;
    this.vizState.maxTimestamp = props.initialTimestamp + this.vizState.timeScale;
    this.vizState.minPrice = props.minPrice;
    this.vizState.maxPrice = props.maxPrice;
    this.vizState.initialMinPrice = props.minPrice;
    this.vizState.initialMaxPrice = props.maxPrice;
    this.vizState.maxVisibleBandVolume = getMaxVisibleBandVolume(
      this.vizState,
      props.initialBook,
      props.minPrice,
      props.maxPrice,
      this.vizState.priceGranularity,
      this.vizState.pricePrecision
    );
    this.vizState.latestMaxVolumeChange = this.vizState.maxVisibleBandVolume;
    this.vizState.askTradeLineExtended = false;
    this.vizState.bidTradeLineExtended = false;

    // calculate color scheme and set up chroma.js color scale function
    this.vizState.scaleColor = chroma
      .scale(this.vizState.colorScheme)
      .mode('lch')
      .domain([0, +this.vizState.maxVisibleBandVolume]);

    // populate the active prices from the initial book image
    this.vizState.activePrices = props.initialBook;

    // get the initial top-of-book bid and ask prices
    // const {bestBid, bestAsk} = getTopOfBook(this.vizState.activePrices, this.vizState.pricePrecision);
    // this.vizState.bestBid = bestBid;
    // this.vizState.bestAsk = bestAsk;

    // create the initial band values using the initial book image
    this.vizState.activeBands = getInitialBandValues(
      props.initialTimestamp,
      props.initialBook,
      props.minPrice,
      props.maxPrice,
      this.vizState.priceGranularity,
      this.vizState.pricePrecision
    );

    // set up the price level updates with the initial prices
    const priceLevelUpdates = [];
    _.each(this.vizState.activePrices, (value, price) => {
      priceLevelUpdates.push({
        price: price,
        timestamp: props.initialTimestamp,
        volume: value.volume,
        isBid: value.isBid,
      });
    });
    this.vizState.priceLevelUpdates = priceLevelUpdates;
  }

  handleSettingChange(setting) {
    if (setting.currency) {
      this.props.onCurrencyChange(setting.currency);
    } else if (setting.priceGranularity) {
      this.vizState.priceGranularity = setting.priceGranularity;
      renderInitial(this.vizState, this.nativeCanvas);
      histRender(this.vizState, this.nativeCanvas, true);
    } else if (setting.colorScheme) {
      this.vizState.colorScheme = colorSchemes[setting.colorScheme];
      this.vizState.backgroundColor = colorSchemes[setting.colorScheme][0];
      this.vizState.scaleColor = chroma
        .scale(this.vizState.colorScheme)
        .mode('lch')
        .domain([0, +this.vizState.maxVisibleBandVolume]);
      renderInitial(this.vizState, this.nativeCanvas);
      histRender(this.vizState, this.nativeCanvas);
    }
  }

  render() {
    return (
      <div>
        <div id="obWrapper" style={{ width: '100%' }}>
          <canvas
            height={this.vizState.canvasHeight}
            id="nativeCanvas"
            ref={canvas => {
              this.nativeCanvas = canvas;
            }}
            style={{ marginRight: '-100%' }}
            width={this.vizState.canvasWidth}
          />

          {/*
            PaperJS mutates the canvas DOM object directly, which really makes React unhappy.  It seems to do this by injecting in styles
            rather than changing attributes themselves, so I've switched both the height and width into the style rather than using them
            as attributes in order to fix an issue where this screwed up the canvas badly.
          */}
          <canvas
            id="paperCanvas"
            ref={canvas => {
              this.paperCanvas = canvas;
            }}
            style={{
              marginLeft: '-100%',
              height: this.vizState.canvasHeight,
              width: this.vizState.canvasWidth,
            }}
          />
        </div>

        <BottomBar
          colorSchemeNames={Object.keys(colorSchemes)}
          currencies={this.props.currencies}
          onSettingChange={this.handleSettingChange}
          vizState={this.vizState}
        />
      </div>
    );
  }
}

Orderbook.propTypes = {
  currencies: PropTypes.arrayOf(PropTypes.string).isRequired,
  canvasHeight: PropTypes.number,
  canvasWidth: PropTypes.number,
  change: PropTypes.shape(ChangeShape).isRequired,
  initialBook: PropTypes.object.isRequired,
  initialTimestamp: PropTypes.number.isRequired,
  maxPrice: PropTypes.string.isRequired,
  minPrice: PropTypes.string.isRequired,
  onCurrencyChange: PropTypes.func.isRequired,
  pricePrecision: PropTypes.number.isRequired,
};

Orderbook.defaultProps = {
  canvasHeight: 600,
  canvasWidth: 900,
};

export default Orderbook;
