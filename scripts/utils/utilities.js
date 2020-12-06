export const DEFAULT_RADIX = 10;

export const get = (obj, path, defaultValue) => {
  const paths = path.split('.');
  return paths.reduce((o, key) => (o || {})[key], obj) || defaultValue;
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
