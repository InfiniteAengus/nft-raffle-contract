import { BigNumber } from "ethers";

/**
 * parseSpecial allows the parsing of notated numbers such as "5bi|18" which equates to 5_000_000_000 followed by 18 zeroes.
 * Warning: usage of decimals without a 'illion' operator (eg. mi/bi/tr) will render the right side unused.
 *    parseSpecial(1.45|5) will return 1_00000 while parseSpecial(1.45th|5) will return 1_450_00000
 * @param num the notated number string (eg. 5bi|18, 3.9m|18)
 * @returns BigNumber
 */
export const parseSpecial = (num: string): BigNumber => {
  const illions = ["th", "mi", "bi", "tr", "qd", "qt", "sx", "sp", "oc", "no", "dc"];
  const regex = /([\d.]+)(\w+)?\|?(\d+)?/gm;
  let m: RegExpExecArray | null;
  let decimals = "";
  let prefix = "";
  let primary = "";

  while ((m = regex.exec(num)) !== null) {
    // This is necessary to avoid infinite loops with zero-width matches
    if (m.index === regex.lastIndex) {
      regex.lastIndex++;
    }

    // The result can be accessed through the `m`-variable.
    m.forEach((match, groupIndex) => {
      switch (groupIndex) {
        case 1:
          if (isNaN(Number(match))) {
            throw `parsing of '${num}' failed; unknown primary: ${match}`;
          }
          primary = match;
          break;
        case 2:
          if (!match) {
            break;
          }
          if (!illions.includes(match)) {
            throw `parsing of '${num}' failed; unknown prefix: '${match}'`;
          }
          prefix = Array.from(Array(Number(illions.indexOf(match) + 1)).keys())
            .map((_) => "000")
            .join("");
          break;
        case 3:
          if (!match) {
            break;
          }
          // eslint-disable-next-line prefer-spread
          decimals = Array.from(Array(Number(match)).keys())
            .map((_) => "0")
            .join("");
          break;
      }
    });
  }

  if (primary.includes(".")) {
    const el = primary.split(".");
    if (el.length > 2) {
      throw `cannot parse '${primary}', multiple decimals`;
    }
    primary = el[0];
    const secondary = el[1].slice(0, prefix.length);
    prefix = secondary + prefix.slice(0, prefix.length - secondary.length);
  }
  return BigNumber.from(primary + prefix + decimals);
};
