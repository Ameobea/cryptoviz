// @flow

import React from 'react';
import fetch from 'dva/fetch';
const _ = require('lodash');

import OrderbookVisualizer from '../react-orderbook/index'

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

    let processBookUpdate = update => {
      // console.log(update);
      if(update[0] == 'o') {
        // update is an orderbook update, so either execute the modification or removal callback
        if(update[3] === '0.00000000') {
          // is a removal
          this.removalCallback({timestamp: _.now(), removal: {
            price: update[2],
            isBid: !!update[1],
          }});
        } else {
          // is a modification
          this.modificationCallback({timestamp: _.now(), modification: {
            price: update[2],
            newAmount: update[3],
            isBid: !!update[1],
          }});
        }
      } else if(update[0] == 't') {
        // update is a new trade
        this.newTradeCallback({
          timestamp: _.now(), newTrade: {
            price: update[3],
            amountTraded: update[4],
            wasBidFilled: !!update[2],
          }
        });
      } else {
        console.warn(`Received unhandled update type: ${JSON.stringify(update)}`);
      }
    };
    processBookUpdate = processBookUpdate.bind(this);

    // function for parsing the messages received from the websocket connection and sending their data to where it needs to go
    let handleWsMsg = e => {
      if (e.data.length === 0)
        return;

      var msg = JSON.parse(e.data);
      // console.log(msg);
      if (msg[1] === 1)
        return e.target.subscriptions[msg[0]] = true;

      switch(msg[0]) {
      // message is an orderbook update
      case this.currencyChannel:
        // make sure that this order is in sequence
        var seq = msg[1];
        if(seq === this.lastSeq + 1) {
          // message is properly sequenced and we should process it
          this.lastSeq = seq;
          // process each of the individual updates in this message
          this.lastUpdate = msg;
          // console.log(msg[2]);
          _.each(msg[2], processBookUpdate);
          // if there's a buffer to process, drain it until we encounter another gap or fully empty it
          while(this.buffer[seq + 1]) {
            // process all of the contained updates in the buffered message
            _.each(this.buffer[seq + 1][2], update => {
              console.log(`Processing buffered update with seq ${seq + 1}`);
              processBookUpdate(update);
            });
            seq += 1;
          }
          this.buffer = [];
        }
        else if(seq === this.lastSeq) {
          // is probably a duplicate or a heartbeat message, but make sure
          if(this.lastUpdate && !_.isEqual(this.lastUpdate, msg)) {
            console.error(
              `Same sequence number but different messages: ${JSON.stringify(this.lastUpdate)} != ${JSON.stringify(msg)}`
            );
          }
        } else if(seq < this.lastSeq) {
          console.error(`sequence number ${seq} was less than we expected and we don't have a buffer for it`);
        } else if(seq > this.lastSeq + 1) {
          if(this.lastSeq + 10 < seq) {
            // there's still a chance we may still eventually receive the out-of-order message, so wait for it
            console.log(`Received out-or-sequence message with seq ${seq} (expected ${this.lastSeq + 1}); buffering it.`);
            this.buffer[seq] = msg;
          } else {
            console.error('Lost message.'); // TODO
          }
        }
        this.lastUpdate = msg;
        break;

      default:
        if(msg[0] > 0 && msg[0] < 1000){
          if(msg[2][0][0] == 'i'){
            const orderbook = msg[2][0][1];
            if (orderbook.currencyPair != this.currency){
              console.error(`Expected symbol ${this.currency} but received data for ${orderbook.currencyPair}`);
            } else {
              this.currencyChannel = msg[0];
              // console.log(orderbook);
              // TODO: handle orderbook and send to components
              this.lastSeq = msg[1];
            }
            break;
          }
        }
        break;
      }
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
      this.lastSeq = 0;
      this.buffer = [];
      this.connection.onmessage = handleWsMsg;
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
    this.modificationCallback = () => {console.warn('Dummy modification callback called!');};
    this.removalCallback = () => {console.warn('Dummy removal callback called!');};
    this.newTradeCallback = () => {console.warn('Dummy newTrade callback called!');};

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
