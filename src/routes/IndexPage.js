// @flow

import React from 'react';
import PropTypes from 'prop-types';
import fetch from 'dva/fetch';
const _ = require('lodash');

import { LiveOrderbook } from 'gdax-trading-toolkit/build/src/core/LiveOrderbook';
import { GDAXFeed } from 'gdax-trading-toolkit/build/src/exchanges/gdax/GDAXFeed';
import { getSubscribedFeeds } from 'gdax-trading-toolkit/build/src/factories/gdaxFactories';
import { ConsoleLoggerFactory } from 'gdax-trading-toolkit/build/src/utils/Logger';

import injectTapEventPlugin from 'react-tap-event-plugin';
injectTapEventPlugin();
import darkBaseTheme from 'material-ui/styles/baseThemes/darkBaseTheme';
import getMuiTheme from 'material-ui/styles/getMuiTheme';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';

import OrderbookVisualizer from '../react-orderbook/index';

class IndexPage extends React.Component {
  constructor(props){
    super(props);

    // function for handling the result of the HTTP request for the list of currencies from Poloniex
    let handleCurrencies = currencyDefinitions => {
      // filter out currency pairs for which there is no available data and create an array of their pairs
      const activeSymbols = _.filter(Object.keys(currencyDefinitions), symbol => {
        return !currencyDefinitions[symbol].delisted && !currencyDefinitions[symbol].frozen;
      });

      const combinedCurrencies = _.map(activeSymbols, symbol => {
        return {
          exchange: 'Poloniex',
          name: symbol,
          id: symbol,
        };
      });

      this.setState({currencies: [
        ...this.state.currencies,
        ...combinedCurrencies,
      ]});
      if(_.includes(activeSymbols, 'BTC_ETH')) {
        return 'BTC_ETH';
      } else if(_.includes(activeSymbols, 'XMR')) {
        return 'BTC_XMR';
      } else {
        return activeSymbols[0];
      }
    };

    // retrieve the list of all currency pairs from GDAX and add them to our available currencies
    publicClient.getProducts((err, res, data) => {
      // map the array of objects into an object
      const gdaxPairs = _.map(data, pair => {
        return {
          exchange: 'GDAX',
          name: pair.display_name,
          id: pair.id,
        };
      });

      this.setState({
        currencies: [
          ...this.state.currencies,
          ...gdaxPairs,
        ],
      });
    });

    handleCurrencies = handleCurrencies.bind(this);
    this.wsSubscribe = this.wsSubscribe.bind(this);
    this.handleBook = this.handleBook.bind(this);
    this.handleTrades = this.handleTrades.bind(this);
    this.handleConnOpen = this.handleConnOpen.bind(this);
    this.processBookUpdate = this.processBookUpdate.bind(this);
    this.handleWsMsg = this.handleWsMsg.bind(this);
    this.initCurrency = this.initCurrency.bind(this);

    // const currenciesUrl = 'https://poloniex.com/public?command=returnCurrencies';
    const tickerUrl = 'https://poloniex.com/public?command=returnTicker';
    fetch(tickerUrl).then(res => res.json())
      .then(handleCurrencies).catch(console.error)
      .then(this.initCurrency).catch(console.error);

    // bind callback executors
    this.bookModificationExecutor = this.bookModificationExecutor.bind(this);
    this.bookRemovalExecutor = this.bookRemovalExecutor.bind(this);
    this.newTradeExecutor = this.newTradeExecutor.bind(this);
    this.handleCurrencyChange = this.handleCurrencyChange.bind(this);

    // set up noop functions for the callbacks until the proper ones are sent over from the inner visualization
    this.modificationCallback = () => console.warn('Dummy modification callback called!');
    this.removalCallback = () => console.warn('Dummy removal callback called!');
    this.newTradeCallback = () => console.warn('Dummy newTrade callback called!');

    this.state = {
      currencies: [],
      initialBook: null,
      maxPrice: null,
      minPrice: null,
    };
  }

  // function that's called to populate starting data about a currency for the visualization and initialize the viz
  initCurrency(currency) {
    // fetch a list of recent trades for determining price range to show in the visualizations
    this.setState({selectedCurrency: currency});
    const tradesUrl = `https://poloniex.com/public?command=returnTradeHistory&currencyPair=${currency}`;
    fetch(tradesUrl)
      .then(res => res.json())
      .then(this.handleTrades).catch(console.error);

    // // fetch an image of the initial orderbook from the HTTP API
    // const bookUrl = `https://poloniex.com/public?command=returnOrderBook&currencyPair=${currency}&depth=1000000000`;
    // fetch(bookUrl)
    //   .then(res => res.json())
    //   .then(this.handleBook).catch(console.error);

    // initialize WS connection to Poloniex servers and open the connection
    this.connection = new WebSocket('wss://api2.poloniex.com');
    this.connection['subscriptions'] = {};
    this.connection.onopen = this.handleConnOpen(currency, this.wsSubscribe);
    this.lastSeq = 0;
    this.buffer = [];
    this.connection.onmessage = this.handleWsMsg;
  }

  initCurrentyGdax = currency => {
    const logger = ConsoleLoggerFactory({ level: 'debug' });

    const options = {
      wsUrl: 'wss://ws-feed.gdax.com',
      logger: logger
    };

    getSubscribedFeeds(options, [currency]).then(feed => {
      const config = { product: currency, logger };
      const book = new LiveOrderbook(config);

      book.on('LiveOrderbook.snapshot', () => {
        const state = book.book.state();

        // Map orderbook to our internal format and set it into the state
        const mapOrders = ({ price, size }) => [price, size];
        const mappedBids = _.flatten(state.bids)
          .map(_.property('orders'))
          .map(mapOrders);
        const mappedAsks = _.flatten(state.asks)
          .map(_.property('orders'))
          .map(mapOrders);
        this.handleBook({ bids, asks });

        // Set a starting min and max rate while we're at it
        this.setState({
          minPrice: book.book.highestBid * .995,
          maxPrice: book.book.lowestAsk * 1.005,
        });
      });

      book.on('LiveOrderbook.trade', ({ time, size, price, side }) => {
        this.newTradeCallback({
          timestamp: time || _.now(),
          newTrade: {
            price,
            amountTraded: size,
            wasBidFilled: side === 'ask',
          },
        });
      });

      book.on('LiveOrderbook.update', ({ price, size }) => {
        if (size === 0) {
          this.removalCallback({
            timestamp: _.now(),
            removal: {
              price,
              isBid: side === 'ask',
            },
          });
        } else {
          this.modificationCallback({
            timestmap: _.now(),
            modification: {
              price,
              newAmount: size,
              isBid: side === 'ask',
            }
          });
        }
      })
    });
  }

  // function for handling the result of the HTTP request for recent trades used to determine starting price zoom levels
  handleTrades(tradeHistory) {
    const minRate = _.minBy(tradeHistory, 'rate').rate;
    const maxRate = _.maxBy(tradeHistory, 'rate').rate;

    // console.log(`Setting minPrice to ${minRate} and maxPrice to ${maxRate}`);
    this.setState({minPrice: minRate * .995, maxPrice: maxRate * 1.005});
  }

  /**
   * Function for handling the result of the HTTP request for the initial orderbook.
   * The bids and asks parameters should arrays of [price, size] arrays.
   */
  handleBook({ bids, asks }) {
    const mappedBids = bids.map(level => ({
      price: level[0],
      volume: level[1].toFixed(this.props.pricePrecision),
      isBid: true,
    }));

    const mappedAsks = asks.map(level => ({
      price: level[0],
      volume: level[1].toFixed(this.props.pricePrecision),
      isBid: false,
    }));

    const orderbook = _.concat(mappedBids, mappedAsks);

    // insert the initial book into the component's state
    console.log('setting initial book');
    this.setState({initialBook: orderbook});
  }

  // returns a function that is called once the websocket has established a connection;
  // subscribes to price channels and handles new messages
  handleConnOpen(currency, wsSubscribe) {
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
  }

  // function for parsing the messages received from the websocket connection and sending their data to where it needs to go
  handleWsMsg(e) {
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
        _.each(msg[2], this.processBookUpdate);
        // if there's a buffer to process, drain it until we encounter another gap or fully empty it
        while(this.buffer[seq + 1]) {
          // process all of the contained updates in the buffered message
          _.each(this.buffer[seq + 1][2], update => {
            console.log(`Processing buffered update with seq ${seq + 1}`);
            this.processBookUpdate(update);
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
          console.log(`Received out-of-sequence message with seq ${seq} (expected ${this.lastSeq + 1}); buffering it.`);
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
            const mergedBook = {};
            _.each(Object.keys(orderbook.orderBook[0]), price => {
              mergedBook[price] = {volume: orderbook.orderBook[0][price], isBid: false};
            });
            _.each(Object.keys(orderbook.orderBook[1]), price => {
              mergedBook[price] = {volume: orderbook.orderBook[1][price], isBid: true};
            });
            this.setState({initialBook: mergedBook});
            this.lastSeq = msg[1];
          }
          break;
        }
      }
      break;
    }
  }

  // utility function used to subscribe to a websocket channel
  wsSubscribe(channel) {
    if (this.connection.readyState === 1){
      const subCommand = {channel: channel, command: 'subscribe'};
      this.connection.send(JSON.stringify(subCommand));
    } else {
      console.error('Websocket is not yet ready; can\'t subscribe to channel!');
    }
  }

  processBookUpdate(update) {
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

  handleCurrencyChange({ exchange, name, id }) {
    // disable old websocket to avoid sequence number resetting while we're reinitializing state
    clearInterval(this.connection.keepAlive);
    this.connection.close();

    this.currency = id;
    if(exchange == 'Poloniex') {
      this.initCurrency(id);
    } else if(exchange == 'GDAX') {
      this.initCurrentyGdax(id);
    }
  }

  render() {
    if(!this.state.initialBook || !this.state.minPrice || !this.state.maxPrice) {
      return <div>{'Loading...'}</div>;
    } else {
      return (
        <MuiThemeProvider muiTheme={getMuiTheme(darkBaseTheme)}>
          <OrderbookVisualizer
            bookModificationCallbackExecutor={this.bookModificationExecutor}
            bookRemovalCallbackExecutor={this.bookRemovalExecutor}
            currencies={this.state.currencies}
            initialBook={this.state.initialBook}
            initialTimestamp={_.now()}
            maxPrice={this.state.maxPrice.toFixed(this.props.pricePrecision)}
            minPrice={this.state.minPrice.toFixed(this.props.pricePrecision)}
            newTradeCallbackExecutor={this.newTradeExecutor}
            onCurrencyChange={this.handleCurrencyChange}
            pricePrecision={this.props.pricePrecision}
          />
        </MuiThemeProvider>
      );
    }
  }
}

IndexPage.propTypes = {
  pricePrecision: PropTypes.number,
};

IndexPage.defaultProps = {
  pricePrecision: 8,
};

export default IndexPage;
