/* eslint-disable no-console */
export enum SimpleLogLevelEum { // eslint-disable-line no-shadow
  ERROR,
  INFO,
  DEBUG
}

export default class SimpleLogger {
  private static msInstance: SimpleLogger
  private _logLevel: SimpleLogLevelEum = SimpleLogLevelEum.INFO

  private constructor() {}

  static get instance(): SimpleLogger {
    if (!SimpleLogger.msInstance) {
      SimpleLogger.msInstance = new SimpleLogger()
    }

    return SimpleLogger.msInstance
  }

  setLogLevel(level: SimpleLogLevelEum): void {
    this._logLevel = level
  }

  get logLevel(): SimpleLogLevelEum {
    return this._logLevel
  }

  debug(message: string): void {
    this.logLevel <= SimpleLogLevelEum.DEBUG && console.log(message)
  }

  info(message: string): void {
    this.logLevel <= SimpleLogLevelEum.INFO && console.log(message)
  }

  error(message: string): void {
    this.logLevel <= SimpleLogLevelEum.ERROR && console.error(message)
  }
}
