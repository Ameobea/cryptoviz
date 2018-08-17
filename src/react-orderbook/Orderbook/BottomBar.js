//! Settings and information displayed under the visualization

import React from 'react';
import PropTypes from 'prop-types';
import SelectField from 'material-ui/SelectField';
import Slider from 'material-ui/Slider';
import MenuItem from 'material-ui/MenuItem';

class BottomBar extends React.Component {
  constructor(props) {
    super(props);

    this.handleCurrencySelect = this.handleCurrencySelect.bind(this);
    this.handleGranularitySelect = this.handleGranularitySelect.bind(this);
    this.handleColorSchemeChange = this.handleColorSchemeChange.bind(this);
    this.updateHoveredGranularity = this.updateHoveredGranularity.bind(this);

    this.state = {
      selectedCurrency: 'BTC_ETH',
      selectedColorScheme: 'Blue Moon',
    };
  }

  handleCurrencySelect(e, i, value) {
    this.setState({ selectedCurrency: value });
    if (value != this.state.selectedCurrency) this.props.onSettingChange({ currency: value });
  }

  updateHoveredGranularity(e, newValue) {
    this.setState({ hoveredGranularity: newValue });
  }

  handleGranularitySelect() {
    let newGranularity;
    switch (this.state.hoveredGranularity) {
      case 0.0:
        newGranularity = 15;
        break;
      case 0.1:
        newGranularity = 20;
        break;
      case 0.2:
        newGranularity = 30;
        break;
      case 0.3:
        newGranularity = 50;
        break;
      case 0.4:
        newGranularity = 75;
        break;
      case 0.5:
        newGranularity = 100;
        break;
      case 0.6:
        newGranularity = 135;
        break;
      case 0.7:
        newGranularity = 175;
        break;
      case 0.8:
        newGranularity = 300;
        break;
      case 0.9:
        newGranularity = 350;
        break;
      case 1.0:
        newGranularity = 500;
        break;
    }

    this.props.onSettingChange({ priceGranularity: newGranularity });
  }

  handleColorSchemeChange(e, i, newSchemeName) {
    if (newSchemeName != this.state.selectedColorScheme) {
      this.props.onSettingChange({ colorScheme: newSchemeName });
      this.setState({ selectedColorScheme: newSchemeName });
    }
  }

  render() {
    const { currencies, colorSchemeNames } = this.props;

    const currencyItems = currencies.map(currency => (
      <MenuItem key={currency} primaryText={currency} value={currency} />
    ));
    const colorSchemeItems = colorSchemeNames.map(name => (
      <MenuItem key={name} primaryText={name} value={name} />
    ));

    return (
      <div id="bottomBar" style={{ height: '10%' }}>
        <table width="100%">
          <tbody>
            <tr>
              <td width="25%">
                <div style={{ marginTop: '-10%' }}>
                  <SelectField
                    floatingLabelText="Currency Pair"
                    onChange={this.handleCurrencySelect}
                    value={this.state.selectedCurrency}
                  >
                    {currencyItems}
                  </SelectField>
                </div>
              </td>

              <td width="40%">
                <div style={{ paddingRight: '10px' }}>
                  <p style={{ marginBottom: '-25px' }}>{'Price Level Granularity'}</p>
                  <Slider
                    onChange={this.updateHoveredGranularity}
                    onDragStop={this.handleGranularitySelect}
                    step={0.1}
                    value={0.5}
                  />
                </div>
              </td>

              <td width="25%">
                <div style={{ marginTop: '-10%' }}>
                  <SelectField
                    floatingLabelText="Color Scheme"
                    onChange={this.handleColorSchemeChange}
                    value={this.state.selectedColorScheme}
                  >
                    {colorSchemeItems}
                  </SelectField>
                </div>
              </td>

              <td>
                <p style={{ fontSize: '18px', marginTop: '-10px' }}>
                  <a href="./about.html" rel="noopener noreferrer" target="_blank">
                    {'How to Use'}
                  </a>
                </p>
              </td>
            </tr>
          </tbody>
        </table>

        <p id="footer">
          {`CryptoViz by Casey Primozic \u00A9 ${new Date().getFullYear()}.  ` +
            'Please send feedback/Issues to '}
          <a href="mailto:me@ameo.link">{'me@ameo.link'}</a>
        </p>
      </div>
    );
  }
}

BottomBar.propTypes = {
  colorSchemeNames: PropTypes.arrayOf(PropTypes.string).isRequired,
  currencies: PropTypes.arrayOf(PropTypes.string).isRequired,
  onSettingChange: PropTypes.func.isRequired,
};

export default BottomBar;
