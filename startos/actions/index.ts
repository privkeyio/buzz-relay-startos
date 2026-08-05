import { sdk } from '../sdk'
import { config } from './config'
import { diagnostics } from './diagnostics'

export const actions = sdk.Actions.of().addAction(config).addAction(diagnostics)
