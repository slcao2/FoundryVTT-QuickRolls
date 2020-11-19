export const get = (obj, path, defaultValue) => {
  const paths = path.split(".");
  return paths.reduce((o, key) => {
    return (o || {})[key];
  }, obj) || defaultValue;
};
