/** Палитра в духе PICO-8. Смысл: жёлтый — ток, синий — вода, оранжевый — механика,
 *  красный — опасность, зелёный — успех. */
export const PAL = [
  '#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
  '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa',
] as const;
export const C = {
  black: 0, navy: 1, plum: 2, dgreen: 3, brown: 4, dgray: 5, lgray: 6, white: 7,
  red: 8, orange: 9, yellow: 10, green: 11, blue: 12, lavender: 13, pink: 14, peach: 15,
} as const;
export const BOARD_BG = '#16224a';
export const BOARD_DOT = '#2c3d74';
