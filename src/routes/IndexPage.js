// @flow

import React from 'react';

import OrderbookVisualizer from 'react-orderbook';

class IndexPage extends React.Component {
  constructor(props){
    super(props);

    this.bookModificationExecutor = this.bookModificationExecutor.bind(this);
    this.state = {
      curTimestamp: 1000,
      // ***DEV***
      curPrice: 18.2342
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
      const update: {timestamp: number, price: number, newAmount: number, isBid: boolean} = {
        timestamp: this.state.curTimestamp + 1,
        price: 1.0,
        newAmount: this.state.curPrice * 1.05,
        isBid: true,
      };

      callback(update);
      this.setState({curTimestamp: this.state.curTimestamp + 1, curPrice: this.state.curPrice * 1.05});
    });
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
