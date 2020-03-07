/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {ReactModel} from 'react-server/src/ReactFlightServer';

import {
  createRequest,
  startWork,
  startFlowing,
} from 'react-server/src/ReactFlightServer';

function renderToReadableStream(model: ReactModel): ReadableStream {
  let request;
  return new ReadableStream({
    start(controller) {
      request = createRequest(model, controller);
      startWork(request);
    },
    pull(controller) {
      startFlowing(request);
    },
    cancel(reason) {},
  });
}

export {renderToReadableStream};
