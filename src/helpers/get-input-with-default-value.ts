import {InputOptions, getInput} from '@actions/core'

export interface Options<T> extends InputOptions {
  default?: T
}

interface OptionsRequired<T> extends Options<T> {
  required: true
  default?: never
}

interface OptionsNotRequired<T> extends Options<T> {
  required: false
  default: T
}

export function getInputWithDefaultValue<T>(
  name: string,
  options: OptionsRequired<T> | OptionsNotRequired<T>
): string | undefined {
  const valuePassedInYaml = getInput(name, options)
  const value = valuePassedInYaml || options.default
  return JSON.parse(String(value) || 'false')
}
