import * as core from '@actions/core'
import ArgoCDClient from './ArgoCDClient'
import ArgoCDContext from './ArgoCDContext'
import SimpleLogger, {SimpleLogLevelEum} from './SimpleLogger'
import {labelsStringToObject} from './utils'

const logger = SimpleLogger.instance

async function run(): Promise<void> {
  try {
    const actionLogLevel: string = core.getInput('log_level')
    const argocdHost: string = core.getInput('argocd_host')
    const argocdPort = Number(core.getInput('argocd_port'))
    const argocdUsername: string = core.getInput('argocd_username')
    const argocdPassword: string = core.getInput('argocd_password')
    const appName: string = core.getInput('app_name')
    const appLabels: string = core.getInput('app_labels')
    const newImage: string = core.getInput('image')
    const helmParamKeyName: string = core.getInput('helm_param_key_name')
    // const dryRun: boolean = core.getBooleanInput('dry_run');

    const level = actionLogLevel as keyof typeof SimpleLogLevelEum
    logger.setLogLevel(SimpleLogLevelEum[level])

    const isLoggedIn: boolean = await ArgoCDClient.instance.login(
      argocdUsername,
      argocdPassword,
      argocdHost,
      argocdPort
    )

    if (!isLoggedIn) {
      return
    }

    const ctx = new ArgoCDContext()
    ctx.appName = appName
    // expecting a=1,b=2 , c=abc
    // will turn into: {a: "1", b: "2", c: "abc"} || "" into {}
    ctx.selector = labelsStringToObject(appLabels)

    await ArgoCDClient.instance.updateImage(ctx, newImage, helmParamKeyName)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
