/* eslint-disable no-console */
const logPrefix = 'quick-rolls :';
export const debug = (...args) => console.log(`DEBUG | ${logPrefix}`, ...args);
export const info = (...args) => console.log(`${logPrefix}`, ...args);
export const warn = (...args) => console.warn(`${logPrefix}`, ...args);
export const error = (...args) => console.error(`${logPrefix}`, ...args);
