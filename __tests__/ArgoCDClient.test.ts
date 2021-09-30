import axios from 'axios'
const MockAdapter = require('axios-mock-adapter')
import {describe, test, expect, afterEach, beforeAll} from '@jest/globals'
import ArgoCDClient from '../src/ArgoCDClient'
import ArgoCDContext from '../src/ArgoCDContext'
import SimpleLogger, {SimpleLogLevelEum} from '../src/SimpleLogger'
import GitOpsAppInfo from '../src/GitOpsAppInfo'
import {SyncSourceTypeEnum} from '../src/common'

const argo = ArgoCDClient.instance
SimpleLogger.instance.setLogLevel(SimpleLogLevelEum.DEBUG)
let mock = new MockAdapter(axios)

describe('testing login cases', () => {
  let serverHost: string
  let apiURL: string

  beforeAll(() => {
    serverHost = 'argocd.dummy.host'
    apiURL = `https://${serverHost}/api/v1`
  })

  afterEach(() => {
    mock.reset()
    argo.logout()
  })

  test('login https happy path', async () => {
    mock.onPost(`${apiURL}/session`).reply(200, {data: {token: '1234'}})
    const isLoggedIn: boolean = await argo.login('kuku', 'muku', serverHost)

    expect(isLoggedIn).toBeTruthy()
  })

  test('login http happy path', async () => {
    apiURL = `http://${serverHost}/api/v1`
    mock.onPost(`${apiURL}/session`).reply(200, {data: {token: '1234'}})
    const useHttpsIsFalse = false
    const isLoggedIn: boolean = await argo.login(
      'kuku',
      'muku',
      serverHost,
      80,
      useHttpsIsFalse
    )

    expect(isLoggedIn).toBeTruthy()
  })

  test('login https other than 443 port happy path', async () => {
    apiURL = `https://${serverHost}:4444/api/v1`
    mock.onPost(`${apiURL}/session`).reply(200, {data: {token: '1234'}})
    const isLoggedIn: boolean = await argo.login(
      'kuku',
      'muku',
      serverHost,
      4444
    )

    expect(isLoggedIn).toBeTruthy()
  })

  test('login bad credentials', async () => {
    mock.onPost(`${apiURL}/session`).reply(404)
    const isLoggedIn: boolean = await argo.login('kuku', 'muku', serverHost)

    expect(isLoggedIn).toBeFalsy()
  })

  test('login fail with return code other than 404', async () => {
    mock.onPost(`${apiURL}/session`).reply(410)
    const isLoggedIn: boolean = await argo.login('kuku', 'muku', serverHost)

    expect(isLoggedIn).toBeFalsy()
  })

  test('login fail with network problem should throw', async () => {
    mock.onPost(`${apiURL}/session`).networkErrorOnce()

    // TODO: make work...
    // expect(async () => await argo.login('kuku', 'muku', serverHost)).toThrow(
    //     'Network Error'
    // )
  })
})

describe('testing applications api', () => {
  const appResultItem = (data: any): any => {
    return {
      metadata: {
        name: data.appName
      },
      spec: {
        destination: {
          namespace: data.ns
        },
        source: {
          repoURL: data.repoSource,
          path: data.repoPath,
          targetRevision: data.repoBranch
        },
        project: data.project
      },
      status: {
        health: {
          status: data.healthStatus
        },
        sync: {
          status: data.syncStatus
        }
      }
    }
  }

  const GitOpsAppInfoFromResultItem = (data: any): GitOpsAppInfo => {
    const res = new GitOpsAppInfo()
    res.name = data.appName
    res.namespace = data.ns
    res.repoURL = data.repoSource
    res.repoPath = data.repoPath
    res.repoBranch = data.repoBranch
    res.project = data.project
    res.syncStatus = data.syncStatus
    res.healthStatus = data.healthStatus
    return res
  }

  let serverHost: string = 'argocd.dummy.host'
  let apiURL: string = `https://${serverHost}/api/v1`

  beforeAll(async () => {
    // "rewiring" token to mock login
    argo['token'] = 'token'
    argo['serverURL'] = `https://${serverHost}`
    argo['apiPath'] = '/api/v1'
  })

  afterEach(() => {
    mock.reset()
  })

  test('get apps happy path', async () => {
    const resultItem: any = {
      appName: 'kuku',
      ns: 'some-ns',
      repoSource: 'abd.com',
      repoPath: '/aaa',
      repoBranch: 'dev',
      project: 'dummy',
      healthStatus: 'ok',
      syncStatus: 'ok'
    }
    const mockResultItem = appResultItem(resultItem)

    mock
      .onGet(`${apiURL}/applications`, {project: 'dummy'})
      .reply(200, {items: [mockResultItem]})
    const context: ArgoCDContext = new ArgoCDContext()
    context.project = 'dummy'
    const apps: GitOpsAppInfo[] = await argo.getApps(context)

    const expected: GitOpsAppInfo[] = [GitOpsAppInfoFromResultItem(resultItem)]
    expect(apps).toEqual(expected)
  })

  test('get apps no apps happy path', async () => {
    mock
      .onGet(`${apiURL}/applications`, {project: 'dummy'})
      .reply(200, {items: []})
    const context: ArgoCDContext = new ArgoCDContext()
    context.project = 'dummy'
    const apps: GitOpsAppInfo[] = await argo.getApps(context)

    expect(apps).toEqual([])
  })

  test('get apps returns many apps happy path', async () => {
    const resultItem: any = {
      appName: 'kuku',
      ns: 'some-ns',
      repoSource: 'abd.com',
      repoPath: '/aaa',
      repoBranch: 'dev',
      project: 'dummy',
      healthStatus: 'ok',
      syncStatus: 'ok'
    }

    const mockResultItem = appResultItem(resultItem)

    mock
      .onGet(`${apiURL}/applications`, {project: 'dummy'})
      .reply(200, {items: [mockResultItem, mockResultItem, mockResultItem]})
    const context: ArgoCDContext = new ArgoCDContext()
    context.project = 'dummy'
    const apps: GitOpsAppInfo[] = await argo.getApps(context)

    expect(apps.length).toEqual(3)
  })

  test('get apps full-info returns many apps happy path', async () => {
    // whatever items full info the non transformed reply is
    mock
      .onGet(`${apiURL}/applications`, {project: 'dummy'})
      .reply(200, [{}, {}])
    const context: ArgoCDContext = new ArgoCDContext()
    context.project = 'dummy'
    const fullInfo = true
    const apps: any[] = await argo.getApps(context, fullInfo)

    expect(apps.length).toEqual(2)
  })

  test('get app exists happy path', async () => {
    const resultItem: any = {
      appName: 'kuku',
      ns: 'some-ns',
      repoSource: 'abd.com',
      repoPath: '/aaa',
      repoBranch: 'dev',
      project: 'dummy',
      healthStatus: 'ok',
      syncStatus: 'ok'
    }
    const mockResultItem = appResultItem(resultItem)

    mock
      .onGet(`${apiURL}/applications`, {project: 'dummy'})
      .reply(200, {items: [mockResultItem]})
    const context: ArgoCDContext = new ArgoCDContext()
    context.appName = 'dummy'
    const result: boolean = await argo.appExists(context)

    expect(result).toBeTruthy()
  })

  test('get app does not exist', async () => {
    mock
      .onGet(`${apiURL}/applications`, {project: 'dummy'})
      .reply(200, {items: []})
    const context: ArgoCDContext = new ArgoCDContext()
    context.appName = 'dummy'
    const result: boolean = await argo.appExists(context)

    expect(result).toBeFalsy()
  })

  test('get app sync source type helm', async () => {
    const mockReply = {manifests: [], sourceType: 'Helm'}

    mock.onGet(`${apiURL}/applications/kuku/manifests`).reply(200, mockReply)
    const result: SyncSourceTypeEnum = await argo.getSyncSourceType('kuku')

    expect(result).toEqual(SyncSourceTypeEnum.HELM)
  })

  test('update image helm existing param happy path', async () => {
    const mockSourceTypeReply = {manifests: [], sourceType: 'Helm'}
    const mockAppReply = [
      {
        spec: {
          source: {
            helm: {
              parameters: [{name: 'name', value: 'some.image:1.0.3'}]
            }
          }
        }
      }
    ]

    const appName = 'dummy'
    const newImage = 'some.image:1.0.4'

    const patchPayload = {
      op: 'replace',
      path: `/spec/source/helm/parameters/0`,
      value: {name: 'name', value: newImage}
    }
    const payload = {
      name: appName,
      patch: JSON.stringify(patchPayload),
      patchType: 'json'
    }

    mock
      .onGet(`${apiURL}/applications/${appName}/manifests`)
      .reply(200, mockSourceTypeReply)
      .onGet(`${apiURL}/applications`, {name: appName})
      .reply(200, mockAppReply)
      .onPatch(`${apiURL}/applications/${appName}`)
      .reply(200, payload)

    const context: ArgoCDContext = new ArgoCDContext()
    context.appName = appName
    const res = await argo.updateImage(context, newImage, 'name')

    expect(res).toBeTruthy()
  })

  test('update image helm non existing param happy path', async () => {
    const mockSourceTypeReply = {manifests: [], sourceType: 'Helm'}
    const mockAppReply = [
      {
        spec: {
          source: {
            helm: {}
          }
        }
      }
    ]

    const appName = 'dummy'
    const newImage = 'some.image:1.0.4'

    const patchPayload = {
      op: 'add',
      path: '/spec/source/helm/parameters',
      value: [{name: 'name', value: newImage}]
    }
    const payload = {
      name: appName,
      patch: JSON.stringify(patchPayload),
      patchType: 'json'
    }

    mock
      .onGet(`${apiURL}/applications/${appName}/manifests`)
      .reply(200, mockSourceTypeReply)
      .onGet(`${apiURL}/applications`, {name: appName})
      .reply(200, mockAppReply)
      .onPatch(`${apiURL}/applications/${appName}`)
      .reply(200, payload)

    const context: ArgoCDContext = new ArgoCDContext()
    context.appName = appName
    const res = await argo.updateImage(context, newImage, 'name')

    expect(res).toBeTruthy()
  })

  test('update image kustomize existing image happy path', async () => {
    const mockSourceTypeReply = {manifests: [], sourceType: 'Kustomize'}
    const mockAppReply = [
      {
        spec: {
          source: {
            kustomize: {
              images: ['some.image:1.0.3']
            }
          }
        }
      }
    ]

    const appName = 'dummy'
    const newImage = 'some.image:1.0.4'

    const patchPayload = {
      op: 'replace',
      path: `/spec/source/kustomize/images/0`,
      value: newImage
    }
    const payload = {
      name: appName,
      patch: JSON.stringify(patchPayload),
      patchType: 'json'
    }

    mock
      .onGet(`${apiURL}/applications/${appName}/manifests`)
      .reply(200, mockSourceTypeReply)
      .onGet(`${apiURL}/applications`, {name: appName})
      .reply(200, mockAppReply)
      .onPatch(`${apiURL}/applications/${appName}`)
      .reply(200, payload)

    const context: ArgoCDContext = new ArgoCDContext()
    context.appName = appName
    const res = await argo.updateImage(context, newImage)

    expect(res).toBeTruthy()
  })

  test('update image kustomize non existing image happy path', async () => {
    const mockSourceTypeReply = {manifests: [], sourceType: 'Kustomize'}
    const mockAppReply = [
      {
        spec: {
          source: {
            kustomize: {}
          }
        }
      }
    ]

    const appName = 'dummy'
    const newImage = 'some.image:1.0.4'

    const patchPayload = {
      op: 'add',
      path: '/spec/source/kustomize/images',
      value: [newImage]
    }
    const payload = {
      name: appName,
      patch: JSON.stringify(patchPayload),
      patchType: 'json'
    }

    mock
      .onGet(`${apiURL}/applications/${appName}/manifests`)
      .reply(200, mockSourceTypeReply)
      .onGet(`${apiURL}/applications`, {name: appName})
      .reply(200, mockAppReply)
      .onPatch(`${apiURL}/applications/${appName}`)
      .reply(200, payload)

    const context: ArgoCDContext = new ArgoCDContext()
    context.appName = appName
    const res = await argo.updateImage(context, newImage)

    expect(res).toBeTruthy()
  })
})
