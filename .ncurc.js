/** @type {import('npm-check-updates').RunOptions} */
module.exports = {
  /** @param {string} packageName */
  cooldown: (packageName) =>
    packageName.startsWith("@photostructure/") ? 0 : 8,
};
