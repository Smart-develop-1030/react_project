/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EnvironmentOptions } from "../HIR/Environment";

export type PluginOptions = {
  /**
   * Enable to make Forget only compile functions containing the 'use forget' directive.
   */
  enableOnlyOnUseForgetDirective: boolean;

  environment: EnvironmentOptions | null;
};

export const defaultOptions: PluginOptions = {
  enableOnlyOnUseForgetDirective: false,
  environment: null,
} as const;

export function parsePluginOptions(obj: unknown): PluginOptions {
  if (obj == null || typeof obj !== "object") {
    return defaultOptions;
  }
  const invalidOptions: Array<string> = [];
  let parsedOptions: Partial<PluginOptions> = Object.create(null);
  for (const [key, value] of Object.entries(obj)) {
    if (isCompilerFlag(key)) {
      parsedOptions[key] = value;
    } else {
      invalidOptions.push(key);
    }
  }
  if (invalidOptions.length > 0) {
    console.error(`Unexpected React Forget compiler flags: ${invalidOptions}`);
  }
  return { ...defaultOptions, ...parsedOptions };
}

function isCompilerFlag(s: string): s is keyof typeof defaultOptions {
  return Object.prototype.hasOwnProperty.call(defaultOptions, s);
}
