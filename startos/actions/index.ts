import { sdk } from '../sdk'
import { config } from './config'
import { diagnostics } from './diagnostics'
import { reset } from './reset'

export const actions = sdk.Actions.of()
  .addAction(config)
  .addAction(diagnostics)
  .addAction(reset)
