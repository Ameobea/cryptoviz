// @flow

import React from 'react';
const _ = require('lodash');

import OrderbookVisualizer from 'react-orderbook';

class IndexPage extends React.Component {
  constructor(props){
    super(props);

    this.bookModificationExecutor = this.bookModificationExecutor.bind(this);
    this.state = {
      curTimestamp: 0,
      // ***DEV***
      curAmount: 12.23,
    };
  }

  componentShouldRender(nextProps) {
    // never re-render
    return false;
  }

  // ***DEV***
  bookModificationExecutor(callback) {
    // trigger a dummy update every second
    setInterval(() => {
      const timestampDiff = _.random(1, 2500);
      const priceDiff = _.random(-.5, .5);
      const modification: {timestamp: number, price: number, newAmount: number, isBid: boolean} = {
        timestamp: this.state.curTimestamp + timestampDiff,
        price: 2.0,
        newAmount: this.state.curAmount + priceDiff,
        isBid: true,
      };

      console.log(`Calling back with timestamp ${this.state.curTimestamp}`);
      callback({modification: modification, timestamp: this.state.curTimestamp + timestampDiff});
      this.setState({curTimestamp: this.state.curTimestamp + timestampDiff, curAmount: this.state.curAmount + priceDiff});
    }, 250);
  }

  render() {
    return (
      <OrderbookVisualizer
        bookModificationCallbackExecutor={this.bookModificationExecutor}
        initialTimestamp={this.state.curTimestamp}
      />
    );
  }
}

IndexPage.propTypes = {
};

export default IndexPage;
