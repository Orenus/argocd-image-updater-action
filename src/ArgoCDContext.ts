// ArgoCD API Base Commands Context
// referring to the app the command is in context with
export default class ArgoCDContext {
  appName: string | undefined
  selector: string | undefined
  imageID: string | undefined
  project: string | undefined
}
