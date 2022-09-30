/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default function todo(message: string): never {
  throw new Error("TODO: " + message);
}

export function todoInvariant(
  condition: unknown,
  message: string
): asserts condition {
  if (!condition) {
    throw new Error("TODO: " + message);
  }
}
