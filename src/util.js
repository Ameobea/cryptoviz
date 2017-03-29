//! Misc. functions and constants used in multiple parts of the application

import React from 'react';

const ChangeShape = {
  modificiation: React.PropTypes.shape({
    price: React.PropTypes.string.isRequired,
    newAmount: React.PropTypes.string.isRequired,
    isBid: React.PropTypes.bool.isRequired
  }),
  removal: React.PropTypes.shape({
    price: React.PropTypes.string.isRequire,
    isBid: React.PropTypes.bool.isRequired
  }),
  newTrade: React.PropTypes.shape({
    price: React.PropTypes.string.isRequired,
    amountTraded: React.PropTypes.string.isRequired,
    wasBidFilled: React.PropTypes.bool.isRequired
  })
};

export { ChangeShape };
