# Cryptoviz

![](https://tokei.rs/b1/github/Ameobea/cryptoviz)
![](https://tokei.rs/b1/github/Ameobea/cryptoviz?category=files)

Cryptoviz is an orderbook visualization tool for the Poloniex exchange. It provides a dynamic Depth-Of-Market (DOM) view that provides a much higher level of detail than traditionally used visualizations such as candlestick charts. You can use this tool yourself on [Cryptoviz](https://cryptoviz.net/).

_Example of CryptoViz Interface:_
![](https://ameo.link/u/4do.png)

## Overview

CryptoViz uses the Poloniex WebSocket API to receive live order data directly from the exchange. Internally, it maintains a copy of the full orderbook including the levels where volume lies and the amount of volume at those levels. These volume levels are then grouped together into bands and displayed on a canvas.

In addition to showing volume levels, the tool also draws trades and renders indicators varying in size according to how large the trade was.

### Cool Technical Details

Cryptoviz makes use of the [PaperJS](http://paperjs.org/) library to render the visualization UI and the trade lines/indicators. The trade lines are rendered on a separate canvas that is displayed beneath the trade lines canvas for performance reasons.

We avoid re-rendering the entire canvas every update by making use of the fact that the left-side of the chart stays constant with new volume bands only ever being added to the right side. In cases where we overrun the canvas, zoom, or change currencies, all received events are re-played in sequence to rebuild the visualization from scratch.

The site itself makes light use of React and the [DvaJS](https://github.com/dvajs/dva) framework as well as Material Design for the interface at the bottom.

## Development

Setting up the dev environmnent for this project is easy! All you really have to do is clone the repository, install dependencies with `npm install` or `yarn`, and run `npm start` to launch the local development server. There is no configuration options that need to be set or data sources to configure; the tool pulls its data directly from the public Poloniex API.

## Contributing

I'd love to work with you to add a feature, fix a bug, or implement Cryptoviz in your own project! If you'd like to make a change or find an issue that needs fixing, please open an issue.
