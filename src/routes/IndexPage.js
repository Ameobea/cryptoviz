// @flow

import React from 'react';
import fetch from 'dva/fetch';
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
        price: level[0],
        volume: level[1].toFixed(this.props.pricePrecision),
        isBid: true,
      }; });
      const asks = _.map(parsedRes.asks, level => {return {
        price: level[0],
        volume: level[1].toFixed(this.props.pricePrecision),
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

    // utility function used to subscribe to a websocket channel
    let wsSubscribe = channel => {
      if (this.connection.readyState === 1){
        const subCommand = {channel: channel, command: 'subscribe'};
        this.connection.send(JSON.stringify(subCommand));
      } else {
        console.error('Websocket is not yet ready; can\'t subscribe to channel!');
      }
    };
    wsSubscribe = wsSubscribe.bind(this);

    // returns a function that is called once the websocket has established a connection;
    // subscribes to price channels and handles new messages
    let handleConnOpen = currency => {
      const conn = this.connection;

      return function(e) {
        console.log('Connection to Poloniex API open.');

        wsSubscribe(currency);
        // trollbox: 1001
        // wsSubscribe(1001);
        conn['keepAlive'] = setInterval(function(){
          try{
            conn.send('.');
          } catch (err) {
            console.error(err);
          }
        }, 6e4);
      };
    };
    handleConnOpen = handleConnOpen.bind(this);

    // function for parsing the messages received from the websocket connection and sending their data to where it needs to go
    let handleWsMsg = e => {
      if (e.data.length === 0)
        return;

      var msg = JSON.parse(e.data);
      console.log(msg);
      if (msg[1] === 1)
        return e.target.subscriptions[msg[0]] = true;

      switch(msg[0]) {
      default:
        if(msg[0] > 0 && msg[0] < 1000){
          if(msg[2][0][0] == 'i'){
            const orderbook = msg[2][0][1];
            console.log(orderbook);

            if (orderbook.currencyPair != this.currency){
              console.error(`Expected symbol ${this.currency} but received data for ${marketInfo.currencyPair}`);
              break;
            }

            seq = msg[1];
          }
        }
        break;
      }
      // if(kwargs.seq === lastSeq + 1) {
      //   lastSeq += 1;
      // } else if(lastSeq === 0) {
      //   lastSeq = kwargs.seq;
      // } else if(lastSeq === kwargs.seq) {
      //   // duplicate sequence number; probably just heartbeat.  Ignore it.
      // }
      // const {modificationCallback, removalCallback, newTradeCallback} = pointer;
      // cache.push({args: args, seq: kwargs.seq});

      // _.each(_.sortBy(realArgs.args), arg => {
      //   try {
      //     handleBookEvent(arg, modificationCallback, removalCallback, newTradeCallback);
      //   } catch(e) {
      //     console.error(e.stack);
      //   }
      // });
    };
    handleWsMsg = handleWsMsg.bind(this);

    // function that's called to populate starting data about a currency for the visualization and initialize the viz
    let initCurrency = currency => {
      this.currency = currency;
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

      // initialize WS connection to Poloniex servers and open the connection
      this.connection = new WebSocket('wss://api2.poloniex.com');
      this.connection['subscriptions'] = {};
      this.connection.onopen = handleConnOpen(currency);
      this.cache = [];
      this.lastSeq = 0;
      this.connection.onmessage = handleWsMsg;
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
