// @flow

import React from 'react';
import fetch from 'dva/fetch';
const autobahn = require('autobahn');
const _ = require('lodash');

import OrderbookVisualizer from 'react-orderbook';

type OrderBookMessage = {
  data: {type: string, rate: string, amount: ?string, tradeID: ?string, date: ?string, total: ?string},
  type: string, timestamp: number
};

function handleBookEvent(
  arg: OrderBookMessage, modificationCallback, removalCallback, newTradeCallback
) {
  if(arg.type == 'orderBookModify') {
    modificationCallback({timestamp: _.now(), modification: {
      price: arg.data.rate,
      newAmount: arg.data.amount,
      isBid: arg.data.type == 'bid' ? true : false,
    }});
  } else if(arg.type == 'orderBookRemove') {
    removalCallback({timestamp: _.now(), removal: {
      price: arg.data.rate,
      isBid: arg.data.type == 'bid' ? true : false,
    }});
  } else if(arg.type == 'newTrade') {
    newTradeCallback({timestamp: _.now(), newTrade: {
      price: arg.data.rate,
      wasBidFilled: arg.data.type == 'buy' ? false : true,
      amountTraded: arg.data.amount,
    }});
  } else {
    console.log(`Received invalid type on message from Poloniex: ${JSON.stringify(arg)}`);
  }
}

class IndexPage extends React.Component {
  constructor(props){
    super(props);

    // function for handling the result of the HTTP request for the list of currencies
    let handleCurrencies = currencyDefinitions => {
      const activeSymbols = _.filter(Object.keys(currencyDefinitions), symbol => {
        return !currencyDefinitions[symbol].delisted && !currencyDefinitions[symbol].frozen;
      });

      this.setState({currencies: _.zipObject(activeSymbols, _.map(activeSymbols, symbol => currencyDefinitions[symbol]))});
      if(_.includes(activeSymbols, 'ETH')) {
        return 'BTC_ETH';
      } else if(_.includes(activeSymbols, 'XMR')) {
        return 'BTC_XMR';
      } else {
        return `BTC_${activeSymbols[0]}`;
      }
    };
    handleCurrencies = handleCurrencies.bind(this);

    // function for handling the result of the HTTP request for the initial orderbook
    let handleBook = parsedRes => {
      const bids = _.map(parsedRes.bids, level => {return {
        price: parseFloat(level[0]).toFixed(props.pricePrecision),
        volume: parseFloat(level[1]),
        isBid: true,
      }; });
      const asks = _.map(parsedRes.asks, level => {return {
        price: parseFloat(level[0]).toFixed(props.pricePrecision),
        volume: parseFloat(level[1]),
        isBid: false,
      }; });
      const orderbook = _.concat(bids, asks);

      // insert the initial book into the component's state
      this.setState({initialBook: orderbook});
    };
    handleBook = handleBook.bind(this);

    // function for handling the result of the HTTP request for recent trades used to determine starting price zoom levels
    let handleTrades = tradeHistory => {
      const minRate = _.minBy(tradeHistory, 'rate').rate;
      const maxRate = _.maxBy(tradeHistory, 'rate').rate;

      // console.log(`Setting minPrice to ${minRate} and maxPrice to ${maxRate}`);
      this.setState({minPrice: minRate * .995, maxPrice: maxRate * 1.005});
    };
    handleTrades = handleTrades.bind(this);

    // function that's called to populate starting data about a currency for the visualization and initialize the viz
    let initCurrency = currency => {
      // fetch a list of recent trades for determining price range to show in the visualizations
      const tradesUrl = `https://poloniex.com/public?command=returnTradeHistory&currencyPair=${currency}`;
      fetch(tradesUrl)
        .then(res => res.json())
        .then(handleTrades).catch(console.error);

      // fetch an image of the initial orderbook from the HTTP API
      const bookUrl = `https://poloniex.com/public?command=returnOrderBook&currencyPair=${currency}&depth=1000000000`;
      fetch(bookUrl)
        .then(res => res.json())
        .then(handleBook).catch(console.error);

      // initialize WS connection to Poloniex servers
      this.connection = new autobahn.Connection({
        url: 'wss://api.poloniex.com',
        realm: 'realm1'
      });

      const pointer = this;
      this.connection.onopen = session => {
        console.log('Connection to Poloniex API open.');
        session.subscribe(currency, (args, kwargs) => {
          const {modificationCallback, removalCallback, newTradeCallback} = pointer;
          _.each(args, arg => {
            try {
              handleBookEvent(arg, modificationCallback, removalCallback, newTradeCallback);
            } catch(e) {
              console.error(e.stack);
            }
          });
          // handleBookEvent(_.cloneDeep(args), kwargs, modificationCallback, removalCallback, newTradeCallback);
        });
      };

      this.connection.open();
    };
    initCurrency = initCurrency.bind(this);

    const currenciesUrl = 'https://poloniex.com/public?command=returnCurrencies';
    fetch(currenciesUrl).then(res => res.json())
      .then(handleCurrencies).catch(console.error)
      .then(initCurrency).catch(console.error);

    // bind callback executors
    this.bookModificationExecutor = this.bookModificationExecutor.bind(this);
    this.bookRemovalExecutor = this.bookRemovalExecutor.bind(this);
    this.newTradeExecutor = this.newTradeExecutor.bind(this);

    // set up noop functions for the callbacks until the proper ones are sent over from the inner visualization
    this.modificationCallback = () => {};
    this.removalCallback = () => {};
    this.newTradeCallback = () => {};

    this.state = {
      currencies: {},
      initialBook: null,
      selectedCurrency: 'ETH',
      maxPrice: null,
      minPrice: null,
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
    if(!this.state.initialBook || !this.state.minPrice || !this.state.maxPrice) {
      return <div>{'Loading...'}</div>;
    } else {
      return (
        <OrderbookVisualizer
          bookModificationCallbackExecutor={this.bookModificationExecutor}
          bookRemovalCallbackExecutor={this.bookRemovalExecutor}
          initialBook={this.state.initialBook}
          initialTimestamp={_.now()}
          maxPrice={this.state.maxPrice.toFixed(this.props.pricePrecision)}
          minPrice={this.state.minPrice.toFixed(this.props.pricePrecision)}
          newTradeCallbackExecutor={this.newTradeExecutor}
          pricePrecision={this.props.pricePrecision}
        />
      );
    }
  }
}

IndexPage.propTypes = {
  pricePrecision: React.PropTypes.number,
};

IndexPage.defaultProps = {
  pricePrecision: 8,
};

export default IndexPage;
