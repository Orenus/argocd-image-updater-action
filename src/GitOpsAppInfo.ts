export default class GitOpsAppInfo {
  name!: string
  namespace!: string
  repoURL!: string
  repoPath!: string
  repoBranch!: string
  project!: string
  syncStatus!: string
  healthStatus!: string
  image!: string
  labels: any

  static fromApiResponse(responseData: any): GitOpsAppInfo {
    const info = new GitOpsAppInfo()

    info.name = responseData.metadata.name
    info.namespace = responseData.spec.destination.namespace
    info.repoURL = responseData.spec.source.repoURL
    info.repoPath = responseData.spec.source.path
    info.repoBranch = responseData.spec.source.targetRevision
    info.project = responseData.spec.project
    info.syncStatus = responseData.status.sync.status
    info.healthStatus = responseData.status.health.status
    // info.image =
    //     // either overridden and indicated by helm value
    //     ((responseData.spec.source.helm.parameters || []).find((p: any) => p.name === 'deployments[0].containers[0].image.tag') || {}).value ||
    //     // or can be found somewhere else that corresponds to the original chart value
    //     ((responseData.status.summary.images || []).find((i: any) =>
    //         i.lastIndexOf(responseData.metadata.name.replace('-', '_').split('.')[0]) > 0 &&
    //         i.lastIndexOf(responseData.metadata.name.split('.')[1]) > 0) || '').replace(/(.*\/?.*\:)/, '');
    info.labels = responseData.metadata.labels

    return info
  }
}
