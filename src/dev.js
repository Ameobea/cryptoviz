//! Utilities using the development of the visualizations when live data may not be available

const mockBook = [
  {price: 1.0, volume: 2, isBid: true},
  {price: 2.0, volume: 12.23, isBid: true},
  {price: 2.3, volume: 18.2342, isBid: false},
  {price: 3.2, volume: 3.2311, isBid: false},
  {price: 3.9, volume: 5.21, isBid: false}
];

const mockInitialTimestamp = 1000;

export { mockBook, mockInitialTimestamp };
