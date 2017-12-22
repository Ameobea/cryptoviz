//! A set of React components used to render interactive orderbook visualizations for limit orderbook data

import React from 'react';
import PropTypes from 'prop-types';

const _ = require('lodash');

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
    this.handleCurrencyChange = this.handleCurrencyChange.bind(this);

    this.state = {
      // map the array of objects to a K:V object matching price:volume at that price level
      curBook: props.initialBook, // the latest version of the order book containing all live buy/sell limit orders
      latestChange: {}, // the most recent change that has occured in the orderbook
      initialBook: props.initialBook,
      initialTimestamp: this.props.initialTimestamp,
      curTimestamp: this.props.initialTimestamp,
    };
  }

  componentDidMount() {
    // register the callback callers to start receiving book updates
    this.props.bookModificationCallbackExecutor(this.handleBookModification);
    this.props.bookRemovalCallbackExecutor(this.handleBookRemoval);
    this.props.newTradeCallbackExecutor(this.handleNewTrade);
  }

  componentWillReceiveProps(nextProps) {
    if(!_.isEqual(nextProps.initialBook, this.props.initialBook)) {
      // currency has changed; reset all internal state and re-initialize component
      this.setState({initialBook: nextProps.initialBook});
    }
  }

  handleBookModification(change: {modification: {price: number, newAmount: number, isBid: boolean}, timestamp: number}) {
    this.setState({latestChange: change});
  }

  handleBookRemoval(change: {removal: {price: number, isBid: boolean}, timestamp: number}) {
    this.setState({latestChange: change});
  }

  handleNewTrade(change: { newTrade: {price: number, amountRemaining: number, wasBidFilled: boolean}, timestamp: number}) {
    this.setState({latestChange: change});
  }

  handleCurrencyChange(newCurrency) {
    this.props.onCurrencyChange(newCurrency);
  }

  render() {
    return (
      <div className='book-viz-container'>
        <Orderbook
          canvasHeight={this.props.orderbookCanvasHeight}
          canvasWidth={this.props.orderbookCanvasWidth}
          change={this.state.latestChange}
          initialBook={this.state.initialBook}
          currencies={this.props.currencies}
          initialTimestamp={this.props.initialTimestamp}
          maxPrice={this.props.maxPrice}
          minPrice={this.props.minPrice}
          onCurrencyChange={this.handleCurrencyChange}
          pricePrecision={this.props.pricePrecision}
        />
      </div>
    );
  }
}

OrderbookVisualizer.propTypes = {
  bookModificationCallbackExecutor: PropTypes.func.isRequired,
  bookRemovalCallbackExecutor: PropTypes.func.isRequired,
  currencies: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    exchange: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
  })).isRequired,
  depthChartCanvasHeight: PropTypes.number,
  depthChartCanvasWidth: PropTypes.number,
  initialBook: PropTypes.object.isRequired,
  initialTimestamp: PropTypes.number.isRequired,
  maxPrice: PropTypes.string.isRequired,
  minPrice: PropTypes.string.isRequired,
  newTradeCallbackExecutor: PropTypes.func.isRequired,
  onCurrencyChange: PropTypes.func.isRequired,
  orderbookCanvasHeight: PropTypes.number,
  orderbookCanvasWidth: PropTypes.number,
  pricePrecision: PropTypes.number.isRequired
};

var body = document.body,
    html = document.documentElement;

var height = Math.max(body.scrollHeight, body.offsetHeight,
    html.clientHeight, html.scrollHeight, html.offsetHeight);

OrderbookVisualizer.defaultProps = {
  orderbookCanvasHeight: .86 * height,
  orderbookCanvasWidth: document.getElementsByTagName('body')[0].offsetWidth,
  depthChartCanvasHeight: 600,
  depthChartCanvasWidth: 900,
};

export default OrderbookVisualizer;
