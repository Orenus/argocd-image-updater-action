/**
 * @description utility to convert string csv labels to object
 * @example "a=1,b=2 , c=abc" will turn into: {a: "1", b: "2", c: "abc"}
 * @param {string} str labels csv
 * @returns { any } object
 */
export const labelsStringToObject = (str: string): any =>
  str
    .split(',')
    .filter(e => e.trim() !== '')
    .reduce((o: any, i: string) => {
      const left = i.split('=')[0],
        right = i.split('=')[1]
      if (!left || left.trim() === '')
        throw new Error(`invalid label key ${left}:${right}`)
      if (!right || right.trim() === '')
        throw new Error(`invalid label value ${left}:${right}`)
      o[left.trim()] = right.trim()
      return o
    }, {})
