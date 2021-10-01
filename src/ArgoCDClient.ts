import axios from 'axios'
import * as https from 'https'
import GitOpsAppInfo from './GitOpsAppInfo'
import SimpleLogger from './SimpleLogger'
import ArgoCDContext from './ArgoCDContext'
import {SyncSourceTypeEnum} from './common'

// ArgoCD API Client
export default class ArgoCDClient {
  private static msInstance: ArgoCDClient | null = null
  private clientInstance: any = undefined
  private serverURL!: string
  private apiPath!: string
  private token: string | undefined
  private logger = SimpleLogger.instance

  private constructor() {}

  /**
   * @description Singleton access
   * @returns {ArgoCDClient}
   */
  static get instance(): ArgoCDClient {
    if (ArgoCDClient.msInstance === null) {
      ArgoCDClient.msInstance = new ArgoCDClient()
    }
    return ArgoCDClient.msInstance
  }

  /**
   * @description private accessor & wrapper to axios in order to enforce client instance initialization
   * @returns {any} the client
   */
  private get client(): any {
    if (!this.clientInstance) {
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false
      })
      this.clientInstance = axios.create({httpsAgent})
    }
    return this.clientInstance
  }

  /**
   * @description prelude to any api call
   * @returns {boolean} when client is logged in
   */
  private ensureIsLoggedIn(): boolean {
    if (!this.token) {
      throw new Error('client isnt logged in, call login first')
    }
    return true
  }

  /**
   * @description wrapper to REST PATCH
   * @param {string} path to REST PATCH
   * @param {any} payload to REST PATCH
   * @returns {any} the axios response
   */
  async patch(path: string, payload: any): Promise<any> {
    this.ensureIsLoggedIn()
    const __url = `${this.serverURL}${this.apiPath}${path}`
    this.logger.debug(`PATCH :: ${__url}`)
    return this.client.patch(__url, payload)
  }

  /**
   * @description wrapper to REST POST
   * @param {string} path to REST POST
   * @param {any} payload to REST POST
   * @returns {any} the axios response
   */
  async post(path: string, payload: any): Promise<any> {
    this.ensureIsLoggedIn()
    const __url = `${this.serverURL}${this.apiPath}${path}`
    this.logger.debug(`POST :: ${__url}`)
    return this.client.post(__url, payload)
  }

  /**
   * @description wrapper to REST PUT
   * @param {string} path to REST PUT
   * @param {any} payload to REST PUT
   * @returns {any} the axios response
   */
  async put(path: string, payload: any): Promise<any> {
    this.ensureIsLoggedIn()
    const __url = `${this.serverURL}${this.apiPath}${path}`
    this.logger.debug(`PUT :: ${__url}`)
    return this.client.post(__url, payload)
  }

  /**
   * @description wrapper to REST GET
   * @param {string} path to REST GET
   * @param {any} params arguments to REST GET
   * @returns {any} the axios response
   */
  async get(path: string, params: any | undefined = undefined): Promise<any> {
    this.ensureIsLoggedIn()
    const __url = `${this.serverURL}${this.apiPath}${path}`
    this.logger.debug(`GET :: ${__url}`)
    return this.client.get(__url, params)
  }

  /**
   * @description wrapper to REST DELETE
   * @param {string} path to REST DELETE
   * @returns {any} the axios response
   */
  async delete(path: string): Promise<any> {
    this.ensureIsLoggedIn()
    const __url = `${this.serverURL}${this.apiPath}${path}`
    this.logger.debug(`DEL :: ${__url}`)
    return this.client.delete(__url)
  }

  /**
   * @description performs "local" logout by clearing login products
   */
  logout(): void {
    this.token = undefined
    this.serverURL = ''
  }

  // ********************************
  //      API IMPL FUNCTIONS
  // ********************************

  /**
   * @description login to ArgoCD server
   * @param username
   * @param pass
   * @returns {boolean} success or fail
   */
  async login(
    username: string,
    password: string,
    serverHost: string,
    serverPort = 443,
    useHttps = true
  ): Promise<boolean> {
    if (!this.token) {
      const serverProtocol = serverPort === 443 || useHttps ? 'https' : 'http'
      const port = serverPort === 443 || serverPort === 80 ? '' : `:${serverPort}`
      this.serverURL = `${serverProtocol}://${serverHost}${port}`
      this.apiPath = '/api/v1'

      this.logger.info(`Creating session @ ${this.serverURL} using username ${username}`)
      try {
        const res = await this.client.post(`${this.serverURL}${this.apiPath}/session`, {username, password})
        if (res.status !== 200) {
          return false
        }

        this.logger.debug('Session created')
        this.token = res.data.token
        this.client.defaults.headers.common['Authorization'] = `Bearer ${this.token}`
        return true
      } catch (ex) {
        this.logger.error(ex.message)
        if (!ex.response || (ex.response && ex.response.status !== 404)) {
          throw ex
        }
      }
      return false
    }
    throw new Error(`already logged in...`)
  }

  /**
   * @description ArgoCD app sync
   * @param {ArgoCDContext} context determining the app(s) to sync
   * @param {boolean} createNamespace should create namespace if namespace doest exist?
   * @param {boolean} dryRun just simulate
   * @returns {Promise<boolean>} success / fail
   */
  async sync(context: ArgoCDContext, createNamespace = false, dryRun = false): Promise<boolean> {
    const options: any = {
      prune: false,
      dryRun
    }
    // add the create namespace option
    if (createNamespace) {
      options.syncOptions = {items: ['CreateNamespace=true']}
    }

    try {
      await this.post(`/applications/${context.appName}/sync`, options)
    } catch (ex) {
      if (ex.response && ex.response.status === 404) {
        return false
      }
      // else rethrow
      throw ex
    }
    // finally
    return true
  }

  /**
   * @description returns the app manifest
   * @param {string} appName
   * @returns {any} - no interface for this object
   */
  async getAppManifests(appName: string): Promise<any> {
    const res = await this.get(`/applications/${appName}/manifests`)
    return res?.data
  }

  /**
   * @description get the sync type for an app, helm or kustomize
   * @param {string} appName
   * @returns {SyncSourceTypeEnum}
   */
  async getSyncSourceType(appName: string): Promise<SyncSourceTypeEnum> {
    const result: any = await this.getAppManifests(appName)

    if (!result || !result.sourceType) {
      throw new Error(`don't know much about ${appName} manifest is missing sourceType`)
    }

    if (result.sourceType === SyncSourceTypeEnum.HELM) {
      return SyncSourceTypeEnum.HELM
    }
    return SyncSourceTypeEnum.KUSTOMIZE
  }

  /**
   * patch payload generator for helm image update
   * @param {any} app - app data as fetch using getApps and full info (original non transformed argo data)
   * @param {string} newImageID
   * @param helmParamKeyName name of helm parameter key (there might be numerous keys and better not guess...)
   * @returns {any} the relevant payload
   */
  private async getImagePatchHelmPayload(app: any, newImageID: string, helmParamKeyName: string): Promise<any> {
    if (!app.spec.source?.helm) {
      throw new Error('unable to find the helm key on the source spec data!')
    }

    const imageParamIndex = (app.spec.source.helm.parameters || []).findIndex((e: any) => e.name === helmParamKeyName)

    const patchOpReplace = {
      op: 'replace',
      path: `/spec/source/helm/parameters/${imageParamIndex}`,
      value: {name: helmParamKeyName, value: newImageID}
    }

    const patchOpAdd = {
      op: 'add',
      path: '/spec/source/helm/parameters',
      value: [{name: helmParamKeyName, value: newImageID}]
    }

    return imageParamIndex === -1 ? patchOpAdd : patchOpReplace
  }

  /**
   * patch payload generator for kustomize image update
   * @param {any} app - app data as fetch using getApps and full info (original non transformed argo data)
   * @param {string} newImageID
   * @returns {any} the relevant payload
   */
  private getImagePatchKustomizePayload(app: any, newImageID: string): any {
    if (!app.spec.source?.kustomize) {
      throw new Error('unable to find the kustomize key on the source spec data!')
    }

    const imageRepo = `${newImageID.split('/')[0]}/`
    const imageToReplaceIndex = (app.spec.source.kustomize?.images || []).findIndex((e: string) =>
      e.startsWith(imageRepo)
    )

    const patchOpReplace = {
      op: 'replace',
      path: `/spec/source/kustomize/images/${imageToReplaceIndex}`,
      value: newImageID
    }

    const patchOpAdd = {
      op: 'add',
      path: '/spec/source/kustomize/images',
      value: [newImageID]
    }

    return imageToReplaceIndex === -1 ? patchOpAdd : patchOpReplace
  }

  /**
   * @description updates an app image
   * @param {ArgoCDContext} context   defining the app to update
   * @param {string} newImageID -     the image to update
   * @param helmParamKeyName -        for helm please provide the parameter key from your value file (ex.
   *                                  "deployments[0].containers[0].image.tag")
   * @returns {boolean} success / will throw on failure
   */
  async updateImage(
    context: ArgoCDContext,
    newImageID: string,
    helmParamKeyName: string | undefined = undefined
  ): Promise<boolean> {
    if (!context.appName) {
      throw new Error('appName is mandatory for updateImage procedure')
    }

    const syncType: SyncSourceTypeEnum = await this.getSyncSourceType(context.appName)

    const fullInfo = true
    const apps: any[] = await this.getApps(context, fullInfo)

    if (apps.length !== 1) {
      throw new Error(`in update image, cant find app ${context.appName}`)
    }

    let patchPayload

    if (syncType === SyncSourceTypeEnum.HELM) {
      if (!helmParamKeyName) {
        throw new Error('helm parameter key name must be provided')
      }
      patchPayload = this.getImagePatchHelmPayload(apps[0], newImageID, helmParamKeyName)
    } else {
      patchPayload = this.getImagePatchKustomizePayload(apps[0], newImageID)
    }

    const payload = {
      name: context.appName,
      patch: JSON.stringify([patchPayload]),
      patchType: 'json'
    }

    await this.patch(`/applications/${context.appName}`, payload)

    return true
  }

  /**
   * @description fetches app information - full info or short (basic)
   * @param {ArgoCDContext} context determining the app(s) to get
   * @param {boolean} fullInfo default is false
   * @returns any for fullInfo OR GitOpsAppInfo
   */
  async getApps(context: ArgoCDContext, fullInfo = false): Promise<any[] | GitOpsAppInfo[]> {
    const getParams = {
      params: {
        selector: !context.selector || Object.keys(context.selector).length === 0 ? undefined : context.selector,
        name: context.appName,
        project: context.project
      }
    }
    let res: any
    try {
      res = await this.get('/applications', getParams)
    } catch (ex) {
      if (ex.response && ex.response.status === 404) {
        return []
      }
      // else rethrow
      throw ex
    }

    // got here with a response other than 200? don't know what to do...
    if (res.status !== 200) {
      throw new Error(`Failed getting apps info: ${res.status}`)
    }

    // full info requested? skip the blow transformation
    if (fullInfo) {
      return res.data.items
    }

    // no data to transform? return empty array
    if (!res.data || res.data.length === 0) {
      return []
    }
    // return transformation to GitOpsAppInfo array
    return res.data.items.map((a: any) => GitOpsAppInfo.fromApiResponse(a))
  }

  /**
   * @description check if app exist by name (context can fine select identical apps in different projects)
   * @param context determine the app to check
   * @returns {boolean} exists or not
   */
  async appExists(context: ArgoCDContext): Promise<boolean> {
    if (!context.appName) {
      throw new Error('appName must be provided in context')
    }
    const res = await this.getApps(context)
    return res && res.length === 1
  }

  /**
   * @description create ArgoCD application
   * @param {GitOpsApp} appData
   * @returns axios response with full app created data
   */
  async createApp(appData: any): Promise<any> {
    // risky as there is 0 validation on data
    return this.post('/applications?validate=true', appData)
  }

  /**
   * @description add labels to an existing ArgoCD app
   * @param context determine the app to set labels to
   * @param labels key/val json
   * @returns {boolean} success / fail
   */
  async addAppLabels(context: ArgoCDContext, labels: any): Promise<boolean> {
    const payload = [
      {
        op: 'add',
        path: '/metadata/labels',
        value: labels
      }
    ]

    // const res = await this.patch(`/applications/${context.appName}`, payload);
    const command = `argocd app patch ${context.appName} --patch='${JSON.stringify(
      payload
    )}' --insecure --server= --auth-token=${this.token}`
    this.logger.debug(`Set app labels cmd: <<< ${command} >>>`)

    try {
      // execSync(command);
      this.logger.debug('exec argocd app patch done.')
    } catch (ex) {
      this.logger.error(`Update image command line exception: ${ex.message}`)
      return false
    }
    // return res.status === 200;
    return true
  }

  /**
   * @description delete an existing ArgoCD app
   * @param {string} appName to delete (o context as API does not allow that)
   * @returns {boolean}
   */
  async delApp(appName: string): Promise<boolean> {
    const res: any = this.delete(`/applications/${appName}`)
    return res.status === 200
  }
}
