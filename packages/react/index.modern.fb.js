/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

export {
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
  act as unstable_act,
  Children,
  Component,
  Fragment,
  Profiler,
  PureComponent,
  StrictMode,
  Suspense,
  SuspenseList,
  SuspenseList as unstable_SuspenseList, // TODO: Remove once call sights updated to SuspenseList
  cloneElement,
  createContext,
  createElement,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  startTransition,
  startTransition as unstable_startTransition, // TODO: Remove once call sights updated to startTransition
  unstable_Cache,
  unstable_DebugTracingMode,
  unstable_LegacyHidden,
  unstable_Offscreen,
  unstable_Scope,
  unstable_getCacheForType,
  unstable_useCacheRefresh,
  unstable_useOpaqueIdentifier,
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useDeferredValue as unstable_useDeferredValue, // TODO: Remove once call sights updated to useDeferredValue
  useEffect,
  useImperativeHandle,
  unstable_useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  useSyncExternalStore as unstable_useSyncExternalStore,
  useReducer,
  useRef,
  useState,
  useTransition,
  useTransition as unstable_useTransition, // TODO: Remove once call sights updated to useTransition
  version,
} from './src/React';
export {jsx, jsxs, jsxDEV} from './src/jsx/ReactJSX';
