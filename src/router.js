import React from 'react';
import PropTypes from 'prop-types';
import { Router, Route } from 'dva/router';
import IndexPage from './routes/IndexPage';

const RouterConfig = ({ history }) => (
  <Router history={history}>
    <Route component={IndexPage} path="/" />
  </Router>
);

RouterConfig.propTypes = {
  history: PropTypes.any.isRequired,
};

export default RouterConfig;
