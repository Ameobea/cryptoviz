//! A set of React components used to render interactive orderbook visualizations for limit orderbook data

import React from 'react';

const _ = require('lodash');

// ***DEV***
import { mockBook, mockInitialTimestamp } from './dev';
import DepthChart from './DepthChart/DepthChart';
import Orderbook from './Orderbook/Orderbook';

/**
 * The parent component for the orderbook analysis visualizations.  Contains variables that keeps track of the current state
 * of the orderbook, the history of all modifications, removals, and trades that have occured, and pass this information and
 * events to the child components.
 *
 * For all timestamps provided to this component, they should be formatted as unix timestamps with ms precision.
 *
 * @param bookModificationCallbackExecutor {func} - A function that will be called when the visualization is ready.  It will be
 *        provided one argument that is a function that should be called every time an order is added to the orderbook or
 *        the volume at a certain price level changes to a different non-zero value.
 * @param bookRemovalCallbackExecutor {func} - A function that will be called when the visualization is ready.  It will be
 *        provided one argument that is a function that should be called every time all orders at a certain price level
 *        are completely removed, meaning that no more bids or asks exists at that level.
 * @param newTradeCallbackExecutor {func} - A function that will be called when the visualization is ready.  It will be provided
 *        with one argument that is a function that should be called every time an order is filled.
 * @param canvasHeight {number} - The height of the returned canvas objects in pixels
 * @param canvasWidth {number} - The width of the returned canvas objects in pixels
 * @param initialBook {[{price: number, volume: number, isBid: bool}]} - A snapshot of the orderbook before any updates or
 *        changes are sent to the callback functions.
 * @param initialTimestamp {number} - The timestamp that the `initialBook` was taken at as unix timestmap ms precision
 */
class OrderbookVisualizer extends React.Component {
  constructor(props) {
    super(props);

    this.handleBookModification = this.handleBookModification.bind(this);
    this.handleBookRemoval = this.handleBookRemoval.bind(this);
    this.handleNewTrade = this.handleNewTrade.bind(this);

    // ***DEV***
    let initialBook;
    if(!props.initialBook) {
      initialBook = mockBook;
    } else {
      initialBook = props.initialBook;
    }

    // ***DEV***
    let initialTimestamp;
    if(!props.initialTimestamp) {
      initialTimestamp = mockInitialTimestamp;
    } else {
      initialTimestamp = props.initialTimestamp;
    }

    const prices = _.map(initialBook, 'price');
    const values = _.map(initialBook, level => { return {volume: level.volume, isBid: level.isBid}; });
    this.bookState = {
      // map the array of objects to a K:V object matching price:volume at that price level
      curBook: _.zipObject(prices, values), // the latest version of the order book containing all live buy/sell limit orders
      latestChange: {}, // the most recent change that has occured in the orderbook
      initialBook: initialBook,
      initialTimestamp: initialTimestamp,
      curTimestamp: initialTimestamp,
    };
  }

  componentDidMount() {
    // register the callback callers to start receiving book updates
    this.props.bookModificationCallbackExecutor(this.handleBookModification);
    // TODO
    // this.props.bookRemovalCallbackExecutor(this.handleBookRemoval);
    // this.props.newTradeCallbackExecutor(this.handleNewTrade);
  }

  shouldComponentRender(nextProps) {
    // TODO: Change so that it re-renders if any of the component heights or widths change
    return false;
  }

  handleBookModification(change: {modification: {price: number, newAmount: number, isBid: boolean}, timestamp: number}) {
    const curBook = this.bookState.curBook;
    curBook[change.modification.price] = {volume: change.modification.newAmount, isBid: change.modification.isBid};
    this.bookState.curBook = curBook;
    this.bookState.latestChange = change;
  }

  handleBookRemoval(removal: {timestamp: number, price: number, isBid: boolean}) {
    this.bookState.latestChange = {removal: removal};
    // TODO
  }

  handleNewTrade(trade: {timestamp: number, price: number, amountRemaining: number, wasBidFilled: boolean}) {
    this.bookState.latestChange = {newTrade: trade};
    // TODO
  }

  render() {
    return (
      <div className='book-viz-container'>
        <Orderbook
          canvasHeight={this.props.orderbookCanvasHeight}
          canvasWidth={this.props.orderbookCanvasWidth}
          change={this.bookState.latestChange}
          curBook={this.bookState.curBook}
          initialTimestamp={this.props.initialTimestamp}
        />

        <DepthChart
          canvasHeight={this.props.depthChartCanvasHeight}
          canvasWidth={this.props.depthChartCanvasWidth}
          change={this.bookState.latestChange}
          initialBook={this.bookState.initialBook}
          initialTimestamp={this.bookState.initialTimestamp}
        />
      </div>
    );
  }
}

OrderbookVisualizer.propTypes = {
  bookModificationCallbackExecutor: React.PropTypes.func.isRequired,
  bookRemovalCallbackExecutor: React.PropTypes.func.isRequired,
  depthChartCanvasHeight: React.PropTypes.number,
  depthChartCanvasWidth: React.PropTypes.number,
  initialBook: React.PropTypes.arrayOf(React.PropTypes.shape({
    price: React.PropTypes.number.isRequired,
    volume: React.PropTypes.number.isRequired
  }))/*.isRequired ***DEV*** */,
  initialTimestamp: React.PropTypes.number/*.isRequired ***DEV*** */,
  newTradeCallbackExecutor: React.PropTypes.func.isRequired,
  orderbookCanvasHeight: React.PropTypes.number,
  orderbookCanvasWidth: React.PropTypes.number
};

OrderbookVisualizer.defaultProps = {
  orderbookCanvasHeight: 600,
  orderbookCanvasWidth: 1200,
  depthChartCanvasHeight: 600,
  depthChartCanvasWidth: 900,
};

export default OrderbookVisualizer;
