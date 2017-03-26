// @flow

import React from 'react';
import fetch from 'dva/fetch';
const autobahn = require('autobahn');
const _ = require('lodash');

import OrderbookVisualizer from 'react-orderbook';

type OrderBookMessage = {data: {type: string, rate: string, amount: ?string, tradeID: ?string, date: ?string, total: ?string}, type: string, timestamp: number};

function handleBookEvent(args: Array<OrderBookMessage>, kwargs: {seq: number}, modificationCallback, removalCallback, newTradeCallback) {
  _.each(args, arg => {
    if(arg.type === 'orderBookModify') {
      modificationCallback({timestamp: _.now(), modification: {
        price: parseFloat(arg.data.rate),
        newAmount: parseFloat(arg.data.amount),
        isBid: arg.data.type == 'bid' ? true : false,
      }});
    } else if(arg.type === 'orderBookRemove') {
      removalCallback({timestamp: _.now(), removal: {
        price: parseFloat(arg.data.rate),
        isBid: arg.data.type == 'bid' ? true : false,
      }});
    } else if(arg.type === 'newTrade') {
      newTradeCallback({timestamp: _.now(), newTrade: {
        price: parseFloat(arg.data.rate),
        wasBidFilled: arg.data.type == 'buy' ? true : false,
        amountTraded: parseFloat(arg.data.total),
        amountRemaining: parseFloat(arg.data.amount),
      }});
    } else {
      console.log(`Received invalid type on message from Poloniex: ${JSON.stringify(arg)}`);
    }
  });
}

class IndexPage extends React.Component {
  constructor(props){
    super(props);

    // fetch an image of the initial orderbook from the HTTP API
    const bookUrl = `https://poloniex.com/public?command=returnOrderBook&currencyPair=${this.props.pair}&depth=1000000000`;
    let handleResponse = parsedRes => {
      const bids = _.map(parsedRes.asks, level => {return {price: parseFloat(level[0]), volume: parseFloat(level[1])}; });
      const asks = _.map(parsedRes.bids, level => {return {price: parseFloat(level[0]), volume: parseFloat(level[1])}; });
      const orderbook = _.concat(bids, asks);

      // insert the initial book into the component's state
      this.setState({initialBook: orderbook});
    };

    handleResponse = handleResponse.bind(this);
    fetch(bookUrl).then(res => res.json()).then(handleResponse).catch(err => {console.log(err);});

    // bind callback executors
    this.bookModificationExecutor = this.bookModificationExecutor.bind(this);
    this.bookRemovalExecutor = this.bookRemovalExecutor.bind(this);
    this.newTradeExecutor = this.newTradeExecutor.bind(this);

    // set up noop functions for the callbacks until the proper ones are sent over from the inner visualization
    this.modificationCallback = () => {};
    this.removalCallback = () => {};
    this.newTradeCallback = () => {};

    // initialize WS connection to Poloniex servers
    this.connection = new autobahn.Connection({
      url: 'wss://api.poloniex.com',
      realm: 'realm1'
    });

    const pointer = this;
    this.connection.onopen = session => {
      console.log('Connection to Poloniex API open.');
      session.subscribe('BTC_ETH', (args, kwargs) => {
        const {modificationCallback, removalCallback, newTradeCallback} = pointer;
        handleBookEvent(args, kwargs, modificationCallback, removalCallback, newTradeCallback);
      });
    };

    this.connection.open();

    this.state = {
      curTimestamp: _.now(),
      initialBook: null,
    };
  }

  bookModificationExecutor(callback) {
    this.modificationCallback = callback;
  }

  bookRemovalExecutor(callback) {
    this.removalCallback = callback;
  }

  newTradeExecutor(callback) {
    this.newTradeCallback = callback;
  }

  render() {
    if(!this.state.initialBook) {
      return <div>{'Loading...'}</div>;
    } else {
      return (
        <OrderbookVisualizer
          bookModificationCallbackExecutor={this.bookModificationExecutor}
          bookRemovalCallbackExecutor={this.bookRemovalExecutor}
          initialTimestamp={this.state.curTimestamp}
          initialBook={this.state.initialBook}
          newTradeCallbackExecutor={this.newTradeExecutor}
          minPrice={0.05}
          maxPrice={0.058}
        />
      );
    }
  }
}

IndexPage.propTypes = {
  pair: React.PropTypes.string,
};

IndexPage.defaultProps = {
  pair: 'BTC_ETH',
};

export default IndexPage;
