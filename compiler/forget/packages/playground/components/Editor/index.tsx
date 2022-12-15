/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useDrag } from "@use-gesture/react";
import type { Diagnostic } from "babel-plugin-react-forget";
import clsx from "clsx";
import invariant from "invariant";
import { useSnackbar } from "notistack";
import { useCallback, useDeferredValue, useState } from "react";
import { useMountEffect, useWindowSize } from "../../hooks";
import { defaultStore } from "../../lib/defaultStore";
import {
  createMessage,
  initStoreFromUrlOrLocalStorage,
  MessageLevel,
  MessageSource,
  type Store,
} from "../../lib/stores";
import { useStore, useStoreDispatch } from "../StoreContext";
import { TabTypes } from "../TabbedWindow";
import Input from "./Input";
import Output from "./Output";

export default function Editor() {
  const store = useStore();
  const deferredStore = useDeferredValue(store);
  const dispatchStore = useStoreDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const [showOutputOnMobile, setShowOutputOnMobile] = useState(false);
  const { width: windowWidth } = useWindowSize();
  const isMobile = windowWidth < 640;
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const updateDiagnostics = useCallback(
    (newDiags: Diagnostic[]) => setDiagnostics(newDiags),
    [setDiagnostics]
  );
  const [tabsOpen, setTabsOpen] = useState<Map<TabTypes, boolean>>(new Map());

  /**
   * Initialize store from encoded data or fallback to the default store.
   */
  useMountEffect(() => {
    let mountStore: Store;
    try {
      mountStore = initStoreFromUrlOrLocalStorage();
    } catch (e) {
      invariant(e instanceof Error, "Only Error may be caught.");
      enqueueSnackbar(e.message, {
        variant: "message",
        ...createMessage(
          "Bad URL - fell back to the default Playground.",
          MessageLevel.Info,
          MessageSource.Playground
        ),
      });
      mountStore = defaultStore;
    }
    dispatchStore({
      type: "setStore",
      payload: { store: mountStore },
    });
  });

  return (
    <>
      <div className="flex grow">
        <div
          style={{
            width: isMobile ? "100%" : "50%",
          }}
          className={clsx("relative sm:min-w-[300px] sm:block", {
            hidden: showOutputOnMobile,
          })}
        >
          <Input diagnostics={diagnostics} />
        </div>
        <div
          style={{ width: isMobile ? "100%" : `${50}%` }}
          className={clsx("flex sm:flex sm:min-w-[300px]", {
            hidden: !showOutputOnMobile,
          })}
        >
          <Output
            tabsOpen={tabsOpen}
            setTabsOpen={setTabsOpen}
            store={deferredStore}
            updateDiagnostics={updateDiagnostics}
          />
        </div>
      </div>
      <button
        className="w-full px-3 py-2 font-mono text-sm bg-highlight text-link sm:hidden"
        onClick={() => setShowOutputOnMobile(!showOutputOnMobile)}
      >
        {showOutputOnMobile ? "< Code" : "Output >"}
      </button>
    </>
  );
}
