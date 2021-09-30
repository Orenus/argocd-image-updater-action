import {describe, expect, test} from '@jest/globals'
import {labelsStringToObject} from '../src/utils'
describe('testing labelsStringToObject happy paths', () => {
  test('label string empty to return empty object', () => {
    const input = '    '
    const expected = {}
    const res = labelsStringToObject(input)

    expect(expected).toEqual(res)
  })

  test('label string with number to object happy paths', () => {
    const input = 'a=1,b=2'
    const expected = {a: '1', b: '2'}
    const res = labelsStringToObject(input)

    expect(expected).toEqual(res)
  })

  test('label string with number and extra comma to object happy paths', () => {
    const input = 'a=1,'
    const expected = {a: '1'}
    const res = labelsStringToObject(input)

    expect(expected).toEqual(res)
  })

  test('label string with mixed numbers and strings to object happy paths', () => {
    const input = 'a=1,b=dummy'
    const expected = {a: '1', b: 'dummy'}
    const res = labelsStringToObject(input)

    expect(expected).toEqual(res)
  })

  test('label string with spaces happy paths', () => {
    const input = 'a  =       1    ,   b =      dummy'
    const expected = {a: '1', b: 'dummy'}
    const res = labelsStringToObject(input)

    expect(expected).toEqual(res)
  })
})

describe('testing labelsStringToObject sad paths', () => {
  test('label string without equal sad path', () => {
    const input = 'a, b=5'
    expect(() => labelsStringToObject(input)).toThrow()
  })

  test('label string without key sad path', () => {
    const input = '=a,b=3'
    expect(() => labelsStringToObject(input)).toThrow()
  })
})
